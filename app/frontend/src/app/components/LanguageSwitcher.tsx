import { useEffect, useState } from 'react';
import { getPreferredLanguage, languageOptions, setPreferredLanguage, type LanguageCode } from '../lib/language';

type LanguageSwitcherProps = {
  className?: string;
  size?: 'sm' | 'md';
};

export function LanguageSwitcher({ className = '', size = 'sm' }: LanguageSwitcherProps) {
  const [language, setLanguage] = useState<LanguageCode>(() => getPreferredLanguage());

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<LanguageCode>).detail;
      if (nextLanguage) {
        setLanguage(nextLanguage);
      }
    };

    window.addEventListener('prostapp-language-change', handleLanguageChange);
    return () => window.removeEventListener('prostapp-language-change', handleLanguageChange);
  }, []);

  const buttonPadding = size === 'md' ? 'px-3 py-1.5' : 'px-2.5 py-1.5';

  return (
    <div
      className={`flex items-center gap-1 rounded-2xl border border-slate-200 bg-white/90 p-1 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ${className}`}
      aria-label="Language selector"
    >
      {languageOptions.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => {
            setLanguage(option.code);
            setPreferredLanguage(option.code);
          }}
          className={`rounded-xl ${buttonPadding} transition ${
            language === option.code
              ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
              : 'hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white'
          }`}
          aria-pressed={language === option.code}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
