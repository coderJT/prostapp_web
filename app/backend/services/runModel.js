// Fallback to VITE_API_BASE_URL because the user likely set that in Vercel pointing to the Render Python backend
const XAI_SERVICE_URL = process.env.XAI_SERVICE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function callXaiService(endpoint, csvBuffer, modelType, language, userEmail) {
    const formData = new FormData();
    // Create a Blob from the buffer to send as a file
    const blob = new Blob([csvBuffer], { type: 'text/csv' });
    formData.append('file', blob, 'data.csv');
    if (modelType) {
        formData.append('model_type', modelType);
    }
    if (language) {
        formData.append('language', language);
    }
    if (userEmail) {
        formData.append('userEmail', userEmail);
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

exports.runInvasive = function(csvBuffer, language, userEmail) {
    return callXaiService('/xai/predict/invasive', csvBuffer, undefined, language, userEmail);
};

exports.runNonInvasive = function(csvBuffer, modelType, language, userEmail) {
    return callXaiService('/xai/predict/non-invasive', csvBuffer, modelType, language, userEmail);
};

exports.runShapInvasive = function(csvBuffer, language, userEmail) {
    return callXaiService('/xai/shap/invasive', csvBuffer, undefined, language, userEmail);
};

exports.runShapNonInvasive = function(csvBuffer, modelType, language, userEmail) {
    return callXaiService('/xai/shap/non-invasive', csvBuffer, modelType, language, userEmail);
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

const CLINICAL_FEATURES = {
    age: {
        label: 'Age',
        value: (value) => `${formatNumber(value, 0)} years`,
        meaning: 'Age is a background risk factor and should be interpreted with PSA trend, symptoms, exam findings, and overall health.',
    },
    'psa_(ng/ml)': {
        label: 'PSA level',
        value: (value) => `${formatNumber(value, 2)} ng/mL`,
        meaning: 'PSA is a prostate blood marker; elevated values can occur with cancer, benign enlargement, infection, inflammation, or recent procedures.',
    },
    'body_weight_(kg)': {
        label: 'Body weight',
        value: (value) => `${formatNumber(value, 1)} kg`,
        meaning: 'Body size is a model context variable here, not a standalone prostate cancer decision factor.',
    },
    'height_(cm)': {
        label: 'Height',
        value: (value) => `${formatNumber(value, 1)} cm`,
        meaning: 'Body size is a model context variable here, not a standalone prostate cancer decision factor.',
    },
    family_history_prostate_cancer: {
        label: 'Family history of prostate cancer',
        value: formatYesNo,
        meaning: 'Family history can raise baseline prostate cancer risk, especially for first-degree relatives or early-onset disease.',
    },
    educational_background: {
        label: 'Education background',
        value: (value) => ({
            0: 'No formal / primary',
            1: 'Secondary',
            2: 'Tertiary',
            3: 'Postgraduate',
        }[Math.round(Number(value))] || `Code ${formatNumber(value, 0)}`),
        meaning: 'Education is a contextual dataset variable and should not be treated as a direct biological risk factor.',
    },
    region_Rural: {
        label: 'Region',
        value: (value) => Number(value) >= 0.5 ? 'Rural' : 'Urban / not rural',
        meaning: 'Region is a care-context and access variable in the dataset; it is not a biological explanation.',
    },
    race_C: {
        label: 'Race indicator: Chinese',
        value: (value) => Number(value) >= 0.5 ? 'Chinese: yes' : 'Chinese: no',
        meaning: 'Race/ethnicity is a demographic model input. Treat it as a learned dataset association, not a biological cause.',
    },
    race_I: {
        label: 'Race indicator: Indian',
        value: (value) => Number(value) >= 0.5 ? 'Indian: yes' : 'Indian: no',
        meaning: 'Race/ethnicity is a demographic model input. Treat it as a learned dataset association, not a biological cause.',
    },
    race_M: {
        label: 'Race indicator: Malay',
        value: (value) => Number(value) >= 0.5 ? 'Malay: yes' : 'Malay: no',
        meaning: 'Race/ethnicity is a demographic model input. Treat it as a learned dataset association, not a biological cause.',
    },
};

[
    'hypertension',
    'heart_disease',
    'cerebro_vascular_disease',
    'hyperlipidemia',
    'diabetes_melitus',
    'renal_disease',
    'other_cancer',
    'other_disease',
].forEach((feature) => {
    CLINICAL_FEATURES[feature] = {
        label: feature.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
        value: formatYesNo,
        meaning: 'This is a background health-status field. Interpret it as care pathway context, not a direct causal finding.',
    };
});

function formatNumber(value, decimals = 3) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'N/A';
    if (Number.isInteger(numeric)) return String(numeric);
    return numeric.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
    });
}

function formatYesNo(value) {
    return Number(value) >= 0.5 ? 'Yes' : 'No';
}

function buildDisplayNote(feature) {
    const metadata = CLINICAL_FEATURES[feature.feature];
    const value = feature.feature_value ?? feature.value;
    const direction = Number(feature.weight) > 0
        ? ' In this explanation, it pushed the model toward the higher-risk class.'
        : Number(feature.weight) < 0
            ? ' In this explanation, it pushed the model toward the lower-risk class.'
            : '';

    if (metadata) {
        return {
            displayFeature: metadata.label,
            displayValue: metadata.value(value),
            meaning: `${metadata.meaning}${direction}`,
        };
    }

    if (/^Column_\d+$/.test(feature.feature || '')) {
        return {
            displayFeature: `FTIR PCA component ${(feature.feature || '').replace('Column_', '')}`,
            displayValue: `PCA score ${formatNumber(value, 4)}`,
            meaning: `This is a PCA component derived from the FTIR spectrum. It reflects compressed spectral patterns, not a directly named clinical measurement.${direction}`,
        };
    }

    return {
        displayValue: formatNumber(value, 4),
        meaning: `Patient-specific LIME contribution.${direction}`,
    };
}

// helper to attach lime/shap results for richer LLM prompts and UI
exports.attachFeatureNotes = function(result) {
    const lime = result?.lime?.top_features || [];
    const shap = result?.global_importance || result?.shap?.global_importance || [];
    result.lime_feature_notes = lime.slice(0, 8).map((f) => {
        const displayNote = buildDisplayNote(f);
        return {
            feature: f.feature,
            weight: f.weight,
            value: f.feature_value,
            displayFeature: displayNote.displayFeature,
            displayValue: displayNote.displayValue,
            meaning: displayNote.meaning,
        };
    });
    result.shap_feature_notes = shap.slice(0, 8).map((f) => ({
        feature: f.feature,
        mean_abs_shap: f.mean_abs_shap,
        mean_shap: f.mean_shap,
    }));
    result.lime_feature_insights = buildLimeInsights(lime);
    result.shap_feature_insights = buildShapInsights(shap);
    return result;
};
