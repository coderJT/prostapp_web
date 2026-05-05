export const languageOptions = [
  { code: 'en', label: 'EN', promptLabel: 'English' },
  { code: 'ms', label: 'MY', promptLabel: 'Bahasa Malaysia' },
  { code: 'zh', label: '中文', promptLabel: 'Chinese' },
] as const;

export type LanguageCode = (typeof languageOptions)[number]['code'];

export const LANGUAGE_STORAGE_KEY = 'prostapp-language';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return languageOptions.some((option) => option.code === value);
}

export function getPreferredLanguage(): LanguageCode {
  if (typeof window === 'undefined') {
    return 'en';
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isLanguageCode(storedLanguage) ? storedLanguage : 'en';
}

export function setPreferredLanguage(language: LanguageCode) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  window.dispatchEvent(new CustomEvent('prostapp-language-change', { detail: language }));
}
