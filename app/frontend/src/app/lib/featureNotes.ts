export type FeatureNoteLike = {
  feature?: string;
  displayFeature?: string | null;
  display_feature?: string | null;
  value?: number | string | null;
  feature_value?: number | string | null;
  displayValue?: string | null;
  display_value?: string | null;
  weight?: number | string | null;
  mean_abs_shap?: number | string | null;
  mean_shap?: number | string | null;
  meaning?: string;
};

const binaryFeatureLabels: Record<string, string> = {
  family_history_prostate_cancer: 'family history of prostate cancer',
  hypertension: 'hypertension history',
  heart_disease: 'heart disease history',
  cerebro_vascular_disease: 'cerebrovascular disease history',
  hyperlipidemia: 'hyperlipidemia history',
  diabetes_melitus: 'diabetes mellitus history',
  renal_disease: 'renal disease history',
  other_cancer: 'other cancer history',
  other_disease: 'other disease history',
  race_C: 'Chinese race indicator',
  race_I: 'Indian race indicator',
  race_M: 'Malay race indicator',
};

function getNumericValue(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCompactNumber(value: number, maxDecimals = 3) {
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxDecimals,
      });
}

export function formatModelNumber(value: unknown) {
  const numeric = getNumericValue(value);
  if (numeric === null) return 'N/A';
  if (Math.abs(numeric) >= 10) return formatCompactNumber(numeric, 2);
  if (Math.abs(numeric) >= 1) return formatCompactNumber(numeric, 3);
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export function formatFeatureName(value: unknown) {
  if (value && typeof value === 'object') {
    const note = value as FeatureNoteLike;
    const displayFeature = note.displayFeature ?? note.display_feature;
    if (typeof displayFeature === 'string' && displayFeature.trim()) return displayFeature;
    value = note.feature;
  }

  const rawName = typeof value === 'string' && value.trim() ? value.trim() : 'Unknown feature';
  const clinicalNames: Record<string, string> = {
    age: 'Age',
    'psa_(ng/ml)': 'PSA level',
    'body_weight_(kg)': 'Body weight',
    'height_(cm)': 'Height',
    family_history_prostate_cancer: 'Family history of prostate cancer',
    educational_background: 'Education background',
    hypertension: 'Hypertension',
    heart_disease: 'Heart disease',
    cerebro_vascular_disease: 'Cerebrovascular disease',
    hyperlipidemia: 'Hyperlipidemia',
    diabetes_melitus: 'Diabetes mellitus',
    renal_disease: 'Renal disease',
    other_cancer: 'Other cancer',
    other_disease: 'Other disease',
    region_Rural: 'Region',
    race_C: 'Race indicator: Chinese',
    race_I: 'Race indicator: Indian',
    race_M: 'Race indicator: Malay',
  };

  if (clinicalNames[rawName]) return clinicalNames[rawName];
  if (/^Column_\d+$/.test(rawName)) return `FTIR PCA component ${rawName.replace('Column_', '')}`;

  return rawName
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatBinary(value: number, yesLabel = 'Yes', noLabel = 'No') {
  return value >= 0.5 ? yesLabel : noLabel;
}

export function getFeatureNoteRawValue(note: FeatureNoteLike) {
  return note.value ?? note.feature_value ?? note.weight ?? note.mean_abs_shap ?? note.mean_shap;
}

export function formatFeatureNoteValue(note: FeatureNoteLike) {
  const displayValue = note.displayValue ?? note.display_value;
  if (typeof displayValue === 'string' && displayValue.trim()) {
    return displayValue;
  }

  const feature = note.feature || '';
  const rawValue = note.value ?? note.feature_value;
  const numeric = getNumericValue(rawValue);

  if (numeric !== null) {
    if (feature === 'age') return `${formatCompactNumber(numeric, 0)} years`;
    if (feature === 'psa_(ng/ml)') return `${formatCompactNumber(numeric, 2)} ng/mL`;
    if (feature === 'body_weight_(kg)') return `${formatCompactNumber(numeric, 1)} kg`;
    if (feature === 'height_(cm)') return `${formatCompactNumber(numeric, 1)} cm`;
    if (feature === 'educational_background') {
      const educationLabels: Record<number, string> = {
        0: 'No formal / primary',
        1: 'Secondary',
        2: 'Tertiary',
        3: 'Postgraduate',
      };
      return educationLabels[Math.round(numeric)] || `Code ${formatCompactNumber(numeric, 0)}`;
    }
    if (feature === 'region_Rural') return formatBinary(numeric, 'Rural', 'Urban / not rural');
    if (feature === 'race_C') return formatBinary(numeric, 'Chinese: yes', 'Chinese: no');
    if (feature === 'race_I') return formatBinary(numeric, 'Indian: yes', 'Indian: no');
    if (feature === 'race_M') return formatBinary(numeric, 'Malay: yes', 'Malay: no');
    if (binaryFeatureLabels[feature]) return formatBinary(numeric);
    if (/^Column_\d+$/.test(feature)) return `PCA score ${formatModelNumber(numeric)}`;
    return formatModelNumber(numeric);
  }

  if (note.mean_abs_shap !== undefined || note.mean_shap !== undefined) {
    return `Mean impact ${formatModelNumber(note.mean_abs_shap ?? note.mean_shap)}`;
  }

  return formatModelNumber(getFeatureNoteRawValue(note));
}

function getDirectionPhrase(note: FeatureNoteLike) {
  const weight = getNumericValue(note.weight ?? note.mean_shap);
  if (weight === null || weight === 0) return '';
  return weight > 0
    ? ' In this explanation, it pushed the model toward the higher-risk class.'
    : ' In this explanation, it pushed the model toward the lower-risk class.';
}

export function getFeatureNoteMeaning(note: FeatureNoteLike) {
  if (note.meaning) return note.meaning;

  const feature = note.feature || '';
  const direction = getDirectionPhrase(note);

  if (feature === 'psa_(ng/ml)') {
    return `PSA is a prostate blood marker; elevated values can occur with cancer, benign enlargement, infection, inflammation, or recent procedures.${direction}`;
  }
  if (feature === 'age') {
    return `Age is a background risk factor and should be interpreted with PSA trend, symptoms, exam findings, and overall health.${direction}`;
  }
  if (feature === 'family_history_prostate_cancer') {
    return `Family history can raise baseline prostate cancer risk, especially for first-degree relatives or early-onset disease.${direction}`;
  }
  if (feature === 'educational_background') {
    return `Education is a contextual dataset variable and should not be treated as a direct biological risk factor. It can also behave as a social-context proxy, so any influence should be reviewed for dataset bias rather than used as a clinical reason.${direction}`;
  }
  if (feature === 'body_weight_(kg)' || feature === 'height_(cm)') {
    return `Body size is a model context variable here, not a standalone prostate cancer decision factor.${direction}`;
  }
  if (feature === 'region_Rural') {
    return `Region is a care-context and access variable in the dataset; it is not a biological explanation. It may capture access-to-care or sampling patterns rather than disease biology.${direction}`;
  }
  if (feature === 'race_C' || feature === 'race_I' || feature === 'race_M') {
    return `Race/ethnicity is a protected demographic input, not a biological explanation. The project notebook flagged race imbalance and group fairness disparities, so this contribution should be treated as a potential bias signal, not a clinical reason.${direction}`;
  }
  if (feature === 'diabetes_melitus') {
    return `This records diabetes mellitus history. Clinically it is comorbidity context, not a direct prostate cancer finding. The project notebook also noted diabetes may act as a weak proxy for race in this dataset, so interpret its model influence cautiously.${direction}`;
  }
  if (binaryFeatureLabels[feature]) {
    return `This records ${binaryFeatureLabels[feature]}. It may reflect background health status or care pathway context, not a direct causal finding.${direction}`;
  }
  if (/^Column_\d+$/.test(feature)) {
    return `This is a PCA component derived from a defined FTIR wavenumber region. It should be interpreted with neighboring components as regional biochemical context, not as a standalone biomarker or clinical measurement.${direction}`;
  }
  if (note.mean_abs_shap !== undefined || note.mean_shap !== undefined) {
    return 'Model-wide SHAP importance. Use it as model context, not patient-specific proof.';
  }
  if (note.weight !== undefined) {
    return `Patient-specific LIME contribution.${direction}`;
  }

  return 'No clinical interpretation available for this feature.';
}
