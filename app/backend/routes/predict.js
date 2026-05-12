const express = require('express');
const router = express.Router();
const multer = require('multer');

const runModel = require('../services/runModel');
const explainabilitySummary = require('../services/explainabilitySummary');
const { enqueuePrediction } = require('../services/predictionQueue');
const { getSupabase } = require('../config/supabase');

const upload = multer({ storage: multer.memoryStorage() });
const DEFAULT_RESULTS_TABLE = 'prediction_results';
const CSV_PREVIEW_LIMIT = 10000;
const SUPPORTED_LANGUAGES = new Set(['en', 'ms', 'zh']);

function normalizeLanguage(value) {
    return SUPPORTED_LANGUAGES.has(value) ? value : 'en';
}

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
        run: (buffer, _modelType, language, userEmail) => runModel.runInvasive(buffer, language, userEmail),
        summaryKey: 'lime_summary',
        buildSummary: (result, language) => explainabilitySummary.summarizeLimePrediction({
            modality: 'invasive',
            predictionResult: result,
            language,
        }),
    },
    {
        path: '/predict-ftir',
        run: (buffer, modelType, language, userEmail) => runModel.runNonInvasive(buffer, modelType, language, userEmail),
        summaryKey: 'lime_summary',
        buildSummary: (result, language) => explainabilitySummary.summarizeLimePrediction({
            modality: 'non-invasive',
            predictionResult: result,
            language,
        }),
    },
    {
        path: '/shap-invasive',
        run: (buffer, _modelType, language, userEmail) => runModel.runShapInvasive(buffer, language, userEmail),
        summaryKey: 'shap_summary',
        buildSummary: (result, language) => explainabilitySummary.summarizeShapGlobal({
            modality: 'invasive',
            shapResult: result,
            language,
        }),
    },
    {
        path: '/shap-ftir',
        run: (buffer, modelType, language, userEmail) => runModel.runShapNonInvasive(buffer, modelType, language, userEmail),
        summaryKey: 'shap_summary',
        buildSummary: (result, language) => explainabilitySummary.summarizeShapGlobal({
            modality: 'non-invasive',
            shapResult: result,
            language,
        }),
    },
];

routes.forEach(({ path, run, summaryKey, buildSummary }) => {
    router.post(path, upload.single('file'), async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'CSV file is required.' });
        }

        try {
            const userEmail = req.body.userEmail || req.headers['x-user-email'] || 'anonymous';
            const modelType = req.body.modelType || 'xgb';
            const language = normalizeLanguage(req.body.language);
            const queued = enqueuePrediction(userEmail, async () => {
                let result = await run(req.file.buffer, modelType, language, userEmail);
                // attach per-feature notes for frontend & LLM prompts
                try {
                    const runModel = require('../services/runModel');
                    result = runModel.attachFeatureNotes(result);
                } catch {
                    // non-fatal
                }

                if (result?.success && buildSummary) {
                    try {
                        const summary = await buildSummary(result, language);
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

                result.queue = {
                    position: queued.position,
                    status: queued.position > 1 ? 'queued' : 'started',
                };

                return result;
            });

            const result = await queued.run;

            return res.json(result);
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    });
});

module.exports = router;
