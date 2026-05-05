const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = [
    'You are a senior urologist and prostate-cancer clinical decision-support expert working with a clinical data scientist.',
    'Explain SHAP/LIME outputs using prostate-domain knowledge in careful plain language for a clinician-facing research dashboard.',
    'Do not diagnose, prescribe, or imply the model output is a definitive cancer or biopsy decision.',
    'Do not invent unsupported facts, protected-attribute bias claims, treatment reasons, or causal mechanisms.',
    'When a feature is encoded categorically, explain it as a model encoding and avoid assuming the patient belongs to a group unless the value clearly indicates presence.',
    'Keep uncertainty explicit and tie every statement back to the model signal and the supplied feature values.',
].join(' ');

const PROSTATE_DOMAIN_GUIDANCE = [
    'Clinical interpretation guidance:',
    '- PSA is prostate-specific antigen. Higher PSA can be associated with prostate cancer, benign prostatic enlargement, prostatitis, urinary infection, recent instrumentation, or ejaculation; interpret with age, prostate volume, exam findings, repeat testing, and clinical context.',
    '- Age is a major prostate-cancer risk factor, but an older age alone does not determine whether invasive assessment is appropriate; fitness, life expectancy, symptoms, PSA kinetics, MRI findings, and patient preference matter.',
    '- Family history of prostate cancer increases baseline risk, especially in first-degree relatives or early-onset disease.',
    '- Race/ethnicity variables are demographic model inputs, not biological explanations. Describe them as learned associations in the training data and avoid saying the model is biased unless bias evaluation data is provided.',
    '- Diabetes, hyperlipidemia, hypertension, renal disease, cardiovascular disease, and body size are comorbidity/context variables. Discuss them as possible correlates of pathway selection or background health status, not direct causes of prostate cancer or procedure need.',
    '- Height and weight rarely have direct clinical meaning for prostate biopsy decisions; if they appear important, frame them as model-learned associations that need clinical review.',
    '- For invasive-modality predictions, class 1 means the model is leaning toward invasive modality being necessary or higher modeled need; class 0 means lower modeled need. Use the exact predicted probability.',
    '- For FTIR/non-invasive predictions, explain that spectral/PCA components may reflect biochemical patterns but are not directly interpretable as individual clinical findings unless mapped back to wavenumber bands.',
    '- Positive LIME/SHAP direction means the feature pushes the model toward class 1; negative direction means it pushes toward class 0. Magnitude reflects model influence, not clinical severity.',
].join('\n');

const OUTPUT_RULES = [
    'Output format:',
    'Summary',
    'Write 3-4 sentences. Include the predicted probability/class when available, name the top drivers, explain what those drivers clinically suggest, and include one sentence on uncertainty/next clinical context.',
    '',
    'Feature interpretation',
    'Use up to 6 bullets prefixed with "- ". For each bullet, write: Feature label: patient value; model direction and weight/importance; clinical interpretation; limitation/caution if needed.',
    '',
    'Clinical caution',
    'Write 1 short sentence that this is decision support and should be interpreted with PSA history, symptoms, DRE, MRI/biopsy history, comorbidities, and clinician judgement.',
].join('\n');

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
                    content: SYSTEM_PROMPT,
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
        'Explain this patient-specific LIME result as a prostate/urology decision-support expert.',
        PROSTATE_DOMAIN_GUIDANCE,
        OUTPUT_RULES,
        'Patient-specific LIME rules:',
        '- Focus on this individual report. Do not overgeneralize from global SHAP.',
        '- If probability is near the decision boundary, explicitly say the model confidence is limited.',
        '- Avoid vague phrases such as "primarily driven by age and race" unless you also explain what each supplied value means clinically and what it does not prove.',
        '- Never say a race variable means the model is biased unless a fairness/bias audit is provided.',
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
        'Explain this model-wide SHAP result as a prostate/urology decision-support expert.',
        PROSTATE_DOMAIN_GUIDANCE,
        OUTPUT_RULES,
        'Model-wide SHAP rules:',
        '- Focus on global model behavior, not this patient specifically.',
        '- Mention sample count and warn strongly if sample_count is very small.',
        '- Explain mean_abs_shap as average model influence and mean_shap as average direction toward class 1 or class 0.',
        '- Do not describe global SHAP as prostate cancer risk if this modality endpoint is predicting invasive modality need; use the modality label and class meaning.',
        '- Avoid turning demographic or comorbidity associations into biological causes.',
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
