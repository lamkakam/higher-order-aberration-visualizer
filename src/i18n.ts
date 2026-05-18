import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

const isTest = import.meta.env.MODE === 'test';
export const supportedLanguageCodes = ['en', 'zh-Hant'] as const;
export type SupportedLanguageCode = (typeof supportedLanguageCodes)[number];
export const cachedLanguageKey = 'i18nextLng';
const traditionalChineseLocales = ['zh-hant', 'zh-tw', 'zh-hk', 'zh-mo'] as const;

const testResources = isTest
  ? {
      en: {
        translation: (await import('../public/locales/en/translation.json')).default
      },
      'zh-Hant': {
        translation: (await import('../public/locales/zh-Hant/translation.json')).default
      }
    }
  : undefined;

const i18nInstance = i18n.use(LanguageDetector).use(initReactI18next);

if (!isTest) {
  i18nInstance.use(HttpBackend);
}

void i18nInstance.init({
  backend: {
    loadPath: '/locales/{{lng}}/{{ns}}.json'
  },
  detection: {
    caches: ['localStorage'],
    convertDetectedLanguage: (language: string) => matchSupportedLanguage(language) ?? language,
    order: ['localStorage', 'navigator'],
    lookupLocalStorage: 'i18nextLng'
  },
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  },
  load: 'currentOnly',
  ns: ['translation'],
  resources: testResources,
  supportedLngs: supportedLanguageCodes
});

function matchSupportedLanguage(language: string | undefined): SupportedLanguageCode | undefined {
  if (language === undefined) {
    return undefined;
  }

  const normalizedLanguage = language.toLowerCase();
  const exactMatch = supportedLanguageCodes.find(
    (supportedLanguage) => supportedLanguage.toLowerCase() === normalizedLanguage
  );

  if (exactMatch !== undefined) {
    return exactMatch;
  }

  if (
    traditionalChineseLocales.includes(
      normalizedLanguage as (typeof traditionalChineseLocales)[number]
    )
  ) {
    return 'zh-Hant';
  }

  const baseLanguage = normalizedLanguage.split(/[-_]/)[0];
  return baseLanguage === 'en' ? 'en' : undefined;
}

export function resolveSupportedLanguage(): SupportedLanguageCode {
  const cachedLanguage = matchSupportedLanguage(
    window.localStorage.getItem(cachedLanguageKey) ?? undefined
  );

  if (cachedLanguage !== undefined) {
    return cachedLanguage;
  }

  const browserLanguages =
    navigator.languages.length > 0 ? navigator.languages : [navigator.language];

  for (const browserLanguage of browserLanguages) {
    const matchedLanguage = matchSupportedLanguage(browserLanguage);

    if (matchedLanguage !== undefined) {
      return matchedLanguage;
    }
  }

  return matchSupportedLanguage(navigator.language) ?? 'en';
}

export default i18nInstance;
