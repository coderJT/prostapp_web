const express = require('express');
const router = express.Router();
const multer = require('multer');

const runModel = require('../services/runModel');
const explainabilitySummary = require('../services/explainabilitySummary');
const { getSupabase } = require('../config/supabase');

const upload = multer({ storage: multer.memoryStorage() });
const DEFAULT_RESULTS_TABLE = 'prediction_results';
const CSV_PREVIEW_LIMIT = 10000;

// Helper function to save prediction result to database
const savePredictionResult = async (tableName, userEmail, modality, prediction, probability, csvData, latency) => {
    try {
        const supabase = getSupabase();
        const payload = {
            user_email: userEmail,
            modality: modality,
            prediction: prediction,
            probability: probability,
            csv_data: typeof csvData === 'string' ? csvData.slice(0, CSV_PREVIEW_LIMIT) : csvData,
            latency_ms: latency,
            created_at: new Date().toISOString(),
        };
        
        const { error } = await supabase
            .from(tableName)
            .insert([payload]);

        if (error) {
            console.error('Error saving prediction result:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        console.error('Error in savePredictionResult:', err);
        return { success: false, error: err.message };
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
                    const tableName = DEFAULT_RESULTS_TABLE;
                    const csvString = result.pca_csv || req.file.buffer.toString('utf8');

                    const prediction = result.prediction;
                    const probability = result.probability;
                    const latency = result.latency_ms || null;

                    const saveResult = await savePredictionResult(
                        tableName,
                        userEmail,
                        modality,
                        prediction,
                        probability,
                        csvString,
                        latency
                    );

                    if (!saveResult.success) {
                        result.database_save = {
                            success: false,
                            error: saveResult.error,
                        };
                    } else {
                        result.database_save = {
                            success: true,
                        };
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
