const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

function hasLlmConfig() {
    return Boolean(process.env.GROQ_API_KEY);
}

async function callLlm(prompt) {
    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            temperature: 0.2,
            messages: [
                {
                    role: 'system',
                    content: 'You summarize medical ML explainability outputs (SHAP/LIME) in plain, concise language for research dashboards. Avoid diagnosis claims and keep uncertainty explicit.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        }),
    });

    if (!response.ok) {
        const details = await response.text();
        throw new Error(`LLM request failed (${response.status}): ${details}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
        throw new Error('LLM returned an empty response.');
    }

    return text;
}

function formatLimeFeatures(limeFeatures) {
    return (limeFeatures || []).slice(0, 8).map((item) => ({
        feature: item.feature,
        value: item.feature_value,
        weight: item.weight,
    }));
}

function formatShapFeatures(globalImportance) {
    return (globalImportance || []).slice(0, 10).map((item) => ({
        feature: item.feature,
        mean_abs_shap: item.mean_abs_shap,
        mean_shap: item.mean_shap,
    }));
}

function formatFeaturePairsForLLM(lime, shap) {
    return {
        lime_top: formatLimeFeatures(lime),
        shap_top: formatShapFeatures(shap),
    };
}

async function summarizeLimePrediction({ modality, predictionResult }) {
    if (!hasLlmConfig()) {
        return null;
    }

    const prompt = [
        'Act as a clinical data scientist explaining LIME for a single patient.',
        'Return plain text with two sections:',
        '1) Summary (2 sentences) stating predicted class/probability and overall drivers.',
        '2) Bullet list (up to 6 bullets, prefix with "- ") where each bullet says: feature name, patient value, weight direction (toward class 1 or 0), and a brief clinical rationale for that direction.',
        'Tone: cautious, model-based, not diagnostic.',
        '',
        `Modality: ${modality}`,
        `Predicted class: ${predictionResult?.prediction}`,
        `Predicted probability (class 1): ${predictionResult?.probability}`,
        `Top LIME features with values: ${JSON.stringify(formatLimeFeatures(predictionResult?.lime?.top_features))}`,
        `Top SHAP (for reference if available): ${JSON.stringify(formatShapFeatures(predictionResult?.shap?.global_importance || []))}`,
        `Raw feature notes: ${JSON.stringify(predictionResult?.lime_feature_notes || [])}`,
    ].join('\n');

    return callLlm(prompt);
}

async function summarizeShapGlobal({ modality, shapResult }) {
    if (!hasLlmConfig()) {
        return null;
    }

    const prompt = [
        'Act as a clinical data scientist explaining SHAP global importance for prostate cancer risk models.',
        'Return plain text with two sections:',
        '1) Summary (2 sentences) on overall top drivers and what positive/negative mean SHAP implies.',
        '2) Bullet list (up to 6 bullets, prefix with "- ") each stating: feature, mean_abs_shap, mean_shap direction (toward class 1 or 0), and a short rationale relating that feature to prostate cancer risk directionally.',
        'Mention sample count. Caution that these are associations, not causal. Keep it concise and non-diagnostic.',
        '',
        `Modality: ${modality}`,
        `Sample count: ${shapResult?.sample_count}`,
        `Feature importance: ${JSON.stringify(formatShapFeatures(shapResult?.global_importance))}`,
        `Top LIME (for context if available): ${JSON.stringify(formatLimeFeatures((shapResult || {}).lime_top_features || []))}`,
        `Raw feature notes: ${JSON.stringify(shapResult?.shap_feature_notes || [])}`,
    ].join('\n');

    return callLlm(prompt);
}

module.exports = {
    summarizeLimePrediction,
    summarizeShapGlobal,
};
