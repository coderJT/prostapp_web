const XAI_SERVICE_URL = process.env.XAI_SERVICE_URL || 'http://localhost:8000';

async function callXaiService(endpoint, csvBuffer, modelType) {
    const formData = new FormData();
    // Create a Blob from the buffer to send as a file
    const blob = new Blob([csvBuffer], { type: 'text/csv' });
    formData.append('file', blob, 'data.csv');
    if (modelType) {
        formData.append('model_type', modelType);
    }

    try {
        const response = await fetch(`${XAI_SERVICE_URL}${endpoint}`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`XAI Service Error (${response.status}): ${errorText || response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error(`Could not connect to XAI service at ${XAI_SERVICE_URL}. Ensure it is running (run_all.sh).`);
        }
        throw error;
    }
}

exports.runInvasive = function(csvBuffer) {
    return callXaiService('/xai/predict/invasive', csvBuffer);
};

exports.runNonInvasive = function(csvBuffer, modelType) {
    return callXaiService('/xai/predict/non-invasive', csvBuffer, modelType);
};

exports.runShapInvasive = function(csvBuffer) {
    return callXaiService('/xai/shap/invasive', csvBuffer);
};

exports.runShapNonInvasive = function(csvBuffer, modelType) {
    return callXaiService('/xai/shap/non-invasive', csvBuffer, modelType);
};

function buildLimeInsights(lime) {
    return lime.slice(0, 8).map((f) => {
        const direction = f.weight > 0 ? 'toward class 1 (higher modeled risk)' : 'toward class 0 (lower modeled risk)';
        const magnitude = Math.abs(f.weight).toFixed(3);
        const value = f.feature_value !== undefined ? `patient value ${f.feature_value}` : 'patient value n/a';
        return `${f.feature}: pushes ${direction}, weight ${magnitude}, ${value}. Insight: model pattern links this feature level with that risk direction; interpret alongside clinical context.`;
    });
}

function buildShapInsights(shap) {
    return shap.slice(0, 8).map((f) => {
        const direction = f.mean_shap > 0 ? 'toward class 1' : 'toward class 0';
        const mag = Number(f.mean_abs_shap || 0).toFixed(3);
        return `${f.feature}: global importance ${mag}, average direction ${direction}. Insight: model globally associates higher values of this feature with ${direction}; use clinically with caution (associative, not causal).`;
    });
}

// helper to attach lime/shap results for richer LLM prompts and UI
exports.attachFeatureNotes = function(result) {
    const lime = result?.lime?.top_features || [];
    const shap = result?.global_importance || result?.shap?.global_importance || [];
    result.lime_feature_notes = lime.slice(0, 8).map((f) => ({
        feature: f.feature,
        weight: f.weight,
        value: f.feature_value,
    }));
    result.shap_feature_notes = shap.slice(0, 8).map((f) => ({
        feature: f.feature,
        mean_abs_shap: f.mean_abs_shap,
        mean_shap: f.mean_shap,
    }));
    result.lime_feature_insights = buildLimeInsights(lime);
    result.shap_feature_insights = buildShapInsights(shap);
    return result;
};
