const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = [
    'You are a senior urologist and prostate-cancer clinical decision-support expert working with a clinical data scientist.',
    'Explain SHAP/LIME outputs using prostate-domain knowledge in careful plain language for a clinician-facing research dashboard.',
    'Do not diagnose, prescribe, or imply the model output is a definitive cancer or biopsy decision.',
    'Do not invent unsupported facts, treatment reasons, or causal mechanisms.',
    'When a feature is encoded categorically, explain it as a model encoding and avoid assuming the patient belongs to a group unless the value clearly indicates presence.',
    'Keep uncertainty explicit and tie every statement back to the model signal and the supplied feature values.',
].join(' ');

const PROSTATE_DOMAIN_GUIDANCE = [
    'Clinical interpretation guidance:',
    '- PSA is prostate-specific antigen. Higher PSA can be associated with prostate cancer, benign prostatic enlargement, prostatitis, urinary infection, recent instrumentation, or ejaculation; interpret with age, prostate volume, exam findings, repeat testing, and clinical context.',
    '- Age is a major prostate-cancer risk factor, but an older age alone does not determine whether invasive assessment is appropriate; fitness, life expectancy, symptoms, PSA kinetics, MRI findings, and patient preference matter.',
    '- Family history of prostate cancer increases baseline risk, especially in first-degree relatives or early-onset disease.',
    '- Race/ethnicity variables are protected demographic model inputs, not biological explanations. This project notebook includes bias evaluation data: race distribution imbalance, subgroup performance disparities, and possible proxy variables were flagged. When race or proxy variables appear, describe them as fairness-risk signals requiring audit, not clinical reasons.',
    '- Diabetes, education, and region may behave as weak race or access-to-care proxies in this dataset. Explain that possibility when those variables influence a result.',
    '- Diabetes, hyperlipidemia, hypertension, renal disease, cardiovascular disease, and body size are comorbidity/context variables. Discuss them as possible correlates of pathway selection or background health status, not direct causes of prostate cancer or procedure need.',
    '- Height and weight rarely have direct clinical meaning for prostate biopsy decisions; if they appear important, frame them as model-learned associations that need clinical review.',
    '- For invasive-modality predictions, class 1 means the model is leaning toward invasive modality being necessary or higher modeled need; class 0 means lower modeled need. Use the exact predicted probability.',
    '- For FTIR/non-invasive predictions, explain that spectral/PCA components may reflect biochemical patterns but are not directly interpretable as individual clinical findings unless mapped back to wavenumber bands.',
    '- The FTIR workflow uses urinary extracellular vesicles (uEVs). EV cargo can differ between normal and cancer-derived cells, and FTIR measures mid-infrared absorbance patterns from biochemical bonds rather than PSA-like single lab values.',
    '- For FTIR spectra, explain common regions in plain language: 3500-3000 cm-1 proteins/water hydration, 3000-2800 cm-1 lipid C-H stretching, 1740-1720 cm-1 lipid carbonyl, 1700-1470 cm-1 protein Amide I/II, 1470-1200 cm-1 protein/lipid deformation and Amide III, 1200-1000 and 1000-700 cm-1 carbohydrates/nucleic acids/phosphate, 700-400 cm-1 phosphates/lipid skeletal vibrations.',
    '- If the FTIR model reports PCA components, say that the model compressed thousands of wavenumber readings into components, so the safest explanation is "spectral pattern consistent with biochemical differences" unless a component-to-wavenumber map is available.',
    '- Positive LIME/SHAP direction means the feature pushes the model toward class 1; negative direction means it pushes toward class 0. Magnitude reflects model influence, not clinical severity.',
].join('\n');

const OUTPUT_RULES = [
    'Output format:',
    'Patient takeaway',
    'Write 2-3 short sentences a patient can understand. Include probability/class, whether this is lower/intermediate/higher modeled concern, and what the result does and does not mean.',
    '',
    'What influenced the result',
    'Use up to 5 bullets prefixed with "- ". For each bullet, write: feature label; patient value if available; model direction and weight/importance; plain clinical meaning; caution if the feature is a demographic, comorbidity, or PCA/spectral component.',
    '',
    'FTIR interpretation',
    'If modality is FTIR/non-invasive, explain urinary EV FTIR in 2-3 sentences: the model looks at spectral patterns related to proteins, lipids, carbohydrates/nucleic acids, phosphates, and hydration; PCA components are compressed spectral patterns, not named diagnoses. If modality is invasive/clinical, write "Not applicable for this clinical-data report."',
    '',
    'Suggested next context',
    'Use 2 bullets prefixed with "- ". Mention the specific clinical context that would help interpretation, such as PSA trend, DRE, MRI, biopsy history, urinary symptoms/infection, prostate volume, family history, and clinician review.',
    '',
    'Clinical caution',
    'Write 1 short sentence that this is decision support and not a diagnosis.',
].join('\n');

const LANGUAGE_INSTRUCTIONS = {
    en: 'Write the entire explanation in English.',
    ms: 'Write the entire explanation in Bahasa Malaysia. Keep medical abbreviations such as PSA, DRE, MRI, LIME, and SHAP in their standard form, with clear Bahasa Malaysia wording around them.',
    zh: 'Write the entire explanation in Chinese. Keep medical abbreviations such as PSA, DRE, MRI, LIME, and SHAP in their standard form, with clear Chinese wording around them.',
};

function getLanguageInstruction(language) {
    return LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;
}

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

async function summarizeLimePrediction({ modality, predictionResult, language = 'en' }) {
    if (!hasLlmConfig()) {
        return null;
    }

    const prompt = [
        'Explain this patient-specific LIME result as a prostate/urology decision-support expert.',
        getLanguageInstruction(language),
        PROSTATE_DOMAIN_GUIDANCE,
        OUTPUT_RULES,
        'Patient-specific LIME rules:',
        '- Focus on this individual report. Do not overgeneralize from global SHAP.',
        '- If probability is near the decision boundary, explicitly say the model confidence is limited.',
        '- Avoid vague phrases such as "primarily driven by age and race" unless you also explain what each supplied value means clinically and what it does not prove.',
        '- A fairness/bias audit is available in the project notebook. If race, diabetes, education, or region appears, explicitly say the driver may reflect dataset bias/proxy structure and must not guide care by itself.',
        '- For FTIR, do not call PCA components biomarkers. Explain them as compressed spectrum patterns and connect only at broad region/biomolecule level when supported.',
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

async function summarizeShapGlobal({ modality, shapResult, language = 'en' }) {
    if (!hasLlmConfig()) {
        return null;
    }

    const prompt = [
        'Explain this model-wide SHAP result as a prostate/urology decision-support expert.',
        getLanguageInstruction(language),
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
