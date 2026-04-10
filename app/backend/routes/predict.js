const express = require('express');
const router = express.Router();
const multer = require('multer');

const runModel = require('../services/runModel');
const explainabilitySummary = require('../services/explainabilitySummary');
const { getSupabase } = require('../config/supabase');

const upload = multer({ storage: multer.memoryStorage() });
const INVASIVE_RESULTS_TABLE = 'invasive_table';
const DEFAULT_RESULTS_TABLE = 'prediction_results';

const parseFirstCsvRow = (csvData) => {
    const lines = String(csvData || '').trim().split(/\r?\n/);
    if (lines.length < 2) {
        return null;
    }

    const headers = lines[0].split(',').map((h) => h.trim());
    const values = lines[1].split(',').map((v) => v.trim());
    const row = {};
    headers.forEach((header, idx) => {
        row[header] = values[idx];
    });
    return row;
};

const toNumberOrNull = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

// Helper function to save prediction result to database
const savePredictionResult = async (tableName, userEmail, modality, prediction, probability, csvData, latency) => {
    try {
        const supabase = getSupabase();
        let payload;

        if (tableName === INVASIVE_RESULTS_TABLE) {
            const csvRow = parseFirstCsvRow(csvData);
            if (!csvRow) {
                throw new Error('Invalid CSV input for invasive_table save.');
            }

            payload = {
                user_email: userEmail,
                result: toNumberOrNull(prediction),
                age: toNumberOrNull(csvRow.age),
                'psa_(ng/ml)': toNumberOrNull(csvRow['psa_(ng/ml)']),
                'body_weight_(kg)': toNumberOrNull(csvRow['body_weight_(kg)']),
                'height_(cm)': toNumberOrNull(csvRow['height_(cm)']),
                family_history_prostate_cancer: toNumberOrNull(csvRow.family_history_prostate_cancer),
                educational_background: toNumberOrNull(csvRow.educational_background),
                hypertension: toNumberOrNull(csvRow.hypertension),
                heart_disease: toNumberOrNull(csvRow.heart_disease),
                cerebro_vascular_disease: toNumberOrNull(csvRow.cerebro_vascular_disease),
                hyperlipidemia: toNumberOrNull(csvRow.hyperlipidemia),
                diabetes_melitus: toNumberOrNull(csvRow.diabetes_melitus),
                renal_disease: toNumberOrNull(csvRow.renal_disease),
                other_cancer: toNumberOrNull(csvRow.other_cancer),
                other_disease: toNumberOrNull(csvRow.other_disease),
                region_rural: toNumberOrNull(csvRow.region_Rural),
                race_c: toNumberOrNull(csvRow.race_C),
                race_i: toNumberOrNull(csvRow.race_I),
                race_m: toNumberOrNull(csvRow.race_M),
            };
        } else {
            payload = {
                user_email: userEmail,
                modality: modality,
                prediction: prediction,
                probability: probability,
                csv_data: csvData,
                latency_ms: latency,
                created_at: new Date().toISOString(),
            };
        }
        
        const { error } = await supabase
            .from(tableName)
            .insert([payload]);

        if (error) {
            console.error('Error saving prediction result:', error);
            return false;
        }

        return true;
    } catch (err) {
        console.error('Error in savePredictionResult:', err);
        return false;
    }
};

const routes = [
    {
        path: '/predict-invasive',
        run: (buffer) => runModel.runInvasive(buffer),
        summaryKey: 'lime_summary',
        buildSummary: (result) => explainabilitySummary.summarizeLimePrediction({
            modality: 'invasive',
            predictionResult: result,
        }),
    },
    {
        path: '/predict-ftir',
        run: (buffer, modelType) => runModel.runNonInvasive(buffer, modelType),
        summaryKey: 'lime_summary',
        buildSummary: (result) => explainabilitySummary.summarizeLimePrediction({
            modality: 'non-invasive',
            predictionResult: result,
        }),
    },
    {
        path: '/shap-invasive',
        run: (buffer) => runModel.runShapInvasive(buffer),
        summaryKey: 'shap_summary',
        buildSummary: (result) => explainabilitySummary.summarizeShapGlobal({
            modality: 'invasive',
            shapResult: result,
        }),
    },
    {
        path: '/shap-ftir',
        run: (buffer, modelType) => runModel.runShapNonInvasive(buffer, modelType),
        summaryKey: 'shap_summary',
        buildSummary: (result) => explainabilitySummary.summarizeShapGlobal({
            modality: 'non-invasive',
            shapResult: result,
        }),
    },
];

routes.forEach(({ path, run, summaryKey, buildSummary }) => {
    router.post(path, upload.single('file'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'CSV file is required.' });
        }

        try {
            const modelType = req.body.modelType || 'xgb';
            let result = await run(req.file.buffer, modelType);
            // attach per-feature notes for frontend & LLM prompts
            try {
                const runModel = require('../services/runModel');
                result = runModel.attachFeatureNotes(result);
            } catch {
                // non-fatal
            }

            if (result?.success && buildSummary) {
                try {
                    const summary = await buildSummary(result);
                    if (summary) {
                        result[summaryKey] = summary;
                    }
                } catch {
                    // Keep the primary prediction response available even when LLM summarization fails.
                }
            }

            // Save prediction result to database
            if (result?.success && path.startsWith('/predict-')) {
                try {
                    const userEmail = req.body.userEmail || req.headers['x-user-email'] || null;
                    const modality = path.includes('invasive') ? 'invasive' : 'ftir';
                    const tableName = modality === 'invasive' ? INVASIVE_RESULTS_TABLE : DEFAULT_RESULTS_TABLE;
                    const csvString = result.pca_csv || req.file.buffer.toString('utf8');
                    
                    if (userEmail) {
                        const prediction = result.prediction;
                        const probability = result.probability;
                        const latency = result.latency_ms || null;
                        
                        await savePredictionResult(tableName, userEmail, modality, prediction, probability, csvString, latency);
                    }
                } catch (err) {
                    // Non-fatal: log error but don't fail the prediction response
                    console.error('Failed to save prediction result:', err);
                }
            }

            return res.json(result);
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    });
});

module.exports = router;
