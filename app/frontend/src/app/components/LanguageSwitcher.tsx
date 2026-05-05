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

  const buttonPadding = size === 'md' ? 'px-2 py-1' : 'px-1.5 py-1';

  return (
    <div
      className={`flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 ${className}`}
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
          className={`${buttonPadding} transition ${
            language === option.code
              ? 'text-slate-950 underline underline-offset-4 dark:text-white'
              : 'hover:text-slate-950 dark:hover:text-white'
          }`}
          aria-pressed={language === option.code}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
