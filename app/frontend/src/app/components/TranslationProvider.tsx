import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { appTranslations } from '../lib/appTranslations';
import { getPreferredLanguage, type LanguageCode } from '../lib/language';

const originalTextNodes = new WeakMap<Text, string>();
const translatedAttributes = ['placeholder', 'aria-label', 'title'] as const;
const translatableLanguages = ['ms', 'zh'] as const;

function getCanonicalSourceText(value: string) {
  const trimmed = value.trim();
  const sourceMatch = Object.entries(appTranslations).find(([, entry]) => (
    translatableLanguages.some((language) => entry[language] === trimmed)
  ));

  if (!sourceMatch) {
    return value;
  }

  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  return `${leading}${sourceMatch[0]}${trailing}`;
}

function translateText(value: string, language: LanguageCode) {
  if (language === 'en') {
    return value;
  }

  const trimmed = value.trim();
  const scoreMatch = trimmed.match(/^Score:\s*(\d+)\/100$/);
  if (scoreMatch) {
    const translated = language === 'ms' ? `Skor: ${scoreMatch[1]}/100` : `评分：${scoreMatch[1]}/100`;
    return value.replace(trimmed, translated);
  }

  const riskScoreMatch = trimmed.match(/^Risk score:\s*(\d+)\s*\/\s*100$/);
  if (riskScoreMatch) {
    const translated = language === 'ms'
      ? `Skor risiko: ${riskScoreMatch[1]}/100`
      : `风险评分：${riskScoreMatch[1]}/100`;
    return value.replace(trimmed, translated);
  }

  const stepMatch = trimmed.match(/^Step\s+(\d+)\s+of\s+(\d+):\s+(.+)$/);
  if (stepMatch) {
    const stepTitle = appTranslations[stepMatch[3]]?.[language] || stepMatch[3];
    const translated = language === 'ms'
      ? `Langkah ${stepMatch[1]} daripada ${stepMatch[2]}: ${stepTitle}`
      : `步骤 ${stepMatch[1]} / ${stepMatch[2]}：${stepTitle}`;
    return value.replace(trimmed, translated);
  }

  const percentCompleteMatch = trimmed.match(/^(\d+)%\s+complete$/);
  if (percentCompleteMatch) {
    const translated = language === 'ms'
      ? `${percentCompleteMatch[1]}% selesai`
      : `${percentCompleteMatch[1]}% 完成`;
    return value.replace(trimmed, translated);
  }

  const probabilityMatch = trimmed.match(/^Model probability:\s*([\d.]+%)$/);
  if (probabilityMatch) {
    const translated = language === 'ms'
      ? `Kebarangkalian model: ${probabilityMatch[1]}`
      : `模型概率：${probabilityMatch[1]}`;
    return value.replace(trimmed, translated);
  }

  const fileUploadPredictionMatch = trimmed.match(/^File-upload prediction:\s*([\d.]+%)$/);
  if (fileUploadPredictionMatch) {
    const translated = language === 'ms'
      ? `Ramalan muat naik fail: ${fileUploadPredictionMatch[1]}`
      : `文件上传预测：${fileUploadPredictionMatch[1]}`;
    return value.replace(trimmed, translated);
  }

  const coreValuesMatch = trimmed.match(/^Age\s+([^,]+),\s+PSA\s+([^,]+)\s+ng\/mL,\s+weight\s+([^,]+)\s+kg,\s+height\s+([^,]+)\s+cm\.$/);
  if (coreValuesMatch) {
    const translated = language === 'ms'
      ? `Umur ${coreValuesMatch[1]}, PSA ${coreValuesMatch[2]} ng/mL, berat ${coreValuesMatch[3]} kg, tinggi ${coreValuesMatch[4]} cm.`
      : `年龄 ${coreValuesMatch[1]}，PSA ${coreValuesMatch[2]} ng/mL，体重 ${coreValuesMatch[3]} kg，身高 ${coreValuesMatch[4]} cm。`;
    return value.replace(trimmed, translated);
  }

  const datasetCodingMatch = trimmed.match(/^Race\s+([^,]+),\s+region\s+([^,]+),\s+education code\s+(.+)\.$/);
  if (datasetCodingMatch) {
    const translated = language === 'ms'
      ? `Kaum ${datasetCodingMatch[1]}, wilayah ${datasetCodingMatch[2]}, kod pendidikan ${datasetCodingMatch[3]}.`
      : `族裔 ${datasetCodingMatch[1]}，地区 ${datasetCodingMatch[2]}，教育代码 ${datasetCodingMatch[3]}。`;
    return value.replace(trimmed, translated);
  }

  const riskMatch = trimmed.match(/^(Low|Moderate|High)\s+risk$/i);
  if (riskMatch) {
    const riskTranslations = {
      ms: { low: 'Risiko rendah', moderate: 'Risiko sederhana', high: 'Risiko tinggi' },
      zh: { low: '低风险', moderate: '中等风险', high: '高风险' },
    } as const;
    const translated = riskTranslations[language][riskMatch[1].toLowerCase() as 'low' | 'moderate' | 'high'];
    return value.replace(trimmed, translated);
  }

  const mixedRiskMatch = trimmed.match(/^(Rendah|Sederhana|Tinggi|低|中等|高)\s+Risk$/i);
  if (mixedRiskMatch) {
    const riskWord = mixedRiskMatch[1].toLowerCase();
    const normalizedRisk = {
      rendah: 'low',
      sederhana: 'moderate',
      tinggi: 'high',
      '低': 'low',
      '中等': 'moderate',
      '高': 'high',
    }[riskWord] as 'low' | 'moderate' | 'high' | undefined;

    if (normalizedRisk) {
      const riskTranslations = {
        ms: { low: 'Risiko rendah', moderate: 'Risiko sederhana', high: 'Risiko tinggi' },
        zh: { low: '低风险', moderate: '中等风险', high: '高风险' },
      } as const;
      return value.replace(trimmed, riskTranslations[language][normalizedRisk]);
    }
  }

  const modelResultMatch = trimmed.match(/^(\d+)\s+model results? tracked$/);
  if (modelResultMatch) {
    const translated = language === 'ms'
      ? `${modelResultMatch[1]} keputusan model dijejaki`
      : `已跟踪 ${modelResultMatch[1]} 个模型结果`;
    return value.replace(trimmed, translated);
  }

  const assessmentCountMatch = trimmed.match(/^(\d+)\s+assessments$/);
  if (assessmentCountMatch) {
    const translated = language === 'ms'
      ? `${assessmentCountMatch[1]} penilaian`
      : `${assessmentCountMatch[1]} 项评估`;
    return value.replace(trimmed, translated);
  }

  const registeredUsersMatch = trimmed.match(/^(\d+)\s+registered users from Supabase$/);
  if (registeredUsersMatch) {
    const translated = language === 'ms'
      ? `${registeredUsersMatch[1]} pengguna berdaftar daripada Supabase`
      : `${registeredUsersMatch[1]} 名来自 Supabase 的注册用户`;
    return value.replace(trimmed, translated);
  }

  const reportsTableMatch = trimmed.match(/^(\d+)\s+reports from the prediction_reports table$/);
  if (reportsTableMatch) {
    const translated = language === 'ms'
      ? `${reportsTableMatch[1]} laporan daripada jadual prediction_reports`
      : `${reportsTableMatch[1]} 份来自 prediction_reports 表的报告`;
    return value.replace(trimmed, translated);
  }

  const comparisonMatch = trimmed.match(/^Latest saved PSA and FTIR model outputs are both available\. Their displayed probabilities differ by ([\d.]+) percentage points, so this page now keeps them visible as separate results rather than blending them together\.$/);
  if (comparisonMatch) {
    const translated = language === 'ms'
      ? `Output model PSA dan FTIR tersimpan terkini tersedia. Kebarangkalian yang dipaparkan berbeza sebanyak ${comparisonMatch[1]} mata peratusan, jadi halaman ini memaparkannya sebagai keputusan berasingan dan tidak menggabungkannya.`
      : `最新保存的 PSA 和 FTIR 模型输出均可用。它们显示的概率相差 ${comparisonMatch[1]} 个百分点，因此本页面将它们作为独立结果显示，而不是混合在一起。`;
    return value.replace(trimmed, translated);
  }

  const translated = appTranslations[trimmed]?.[language];
  if (translated) {
    const leading = value.match(/^\s*/)?.[0] || '';
    const trailing = value.match(/\s*$/)?.[0] || '';
    return `${leading}${translated}${trailing}`;
  }

  let translatedValue = value;
  const entries = Object.entries(appTranslations)
    .filter(([source, entry]) => source.length > 12 && entry[language])
    .sort(([a], [b]) => b.length - a.length);

  entries.forEach(([source, entry]) => {
    const nextText = entry[language];
    if (nextText && translatedValue.includes(source)) {
      translatedValue = translatedValue.split(source).join(nextText);
    }
  });

  return translatedValue;
}

function translateElementAttributes(element: Element, language: LanguageCode) {
  translatedAttributes.forEach((attribute) => {
    const originalAttribute = `data-i18n-original-${attribute}`;
    const currentValue = element.getAttribute(attribute);

    if (currentValue && !element.hasAttribute(originalAttribute)) {
      element.setAttribute(originalAttribute, currentValue);
    }

    const originalValue = element.getAttribute(originalAttribute);
    if (!originalValue) {
      return;
    }

    const nextValue = translateText(originalValue, language);
    if (element.getAttribute(attribute) !== nextValue) {
      element.setAttribute(attribute, nextValue);
    }
  });
}

function translateNode(node: Node, language: LanguageCode) {
  if (node.nodeType === Node.TEXT_NODE) {
    const textNode = node as Text;
    const currentValue = textNode.nodeValue || '';
    const hasStoredOriginal = originalTextNodes.has(textNode);
    const storedOriginal = originalTextNodes.get(textNode);

    if (hasStoredOriginal && storedOriginal !== undefined) {
      const knownValues = [storedOriginal, ...translatableLanguages.map((nextLanguage) => translateText(storedOriginal, nextLanguage))];
      if (!knownValues.includes(currentValue)) {
        originalTextNodes.set(textNode, getCanonicalSourceText(currentValue));
      }
    }

    const originalValue = originalTextNodes.get(textNode) || getCanonicalSourceText(currentValue);
    if (!hasStoredOriginal) {
      originalTextNodes.set(textNode, originalValue);
    }

    if (originalValue.trim()) {
      const nextValue = translateText(originalValue, language);
      if (textNode.nodeValue !== nextValue) {
        textNode.nodeValue = nextValue;
      }
    }
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const element = node as Element;
  if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(element.tagName)) {
    return;
  }

  translateElementAttributes(element, language);
  element.childNodes.forEach((childNode) => translateNode(childNode, language));
}

function translateDocument(language: LanguageCode) {
  translateNode(document.body, language);
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let language = getPreferredLanguage();
    translateDocument(language);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => translateNode(node, language));
        if (mutation.type === 'characterData') {
          translateNode(mutation.target, language);
        }
        if (mutation.type === 'attributes') {
          translateNode(mutation.target, language);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatedAttributes],
    });

    const handleLanguageChange = (event: Event) => {
      language = (event as CustomEvent<LanguageCode>).detail || getPreferredLanguage();
      translateDocument(language);
    };

    window.addEventListener('prostapp-language-change', handleLanguageChange);
    return () => {
      observer.disconnect();
      window.removeEventListener('prostapp-language-change', handleLanguageChange);
    };
  }, []);

  return <>{children}</>;
}
