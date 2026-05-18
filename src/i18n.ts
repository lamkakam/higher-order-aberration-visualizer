import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

const isTest = import.meta.env.MODE === 'test';
const testResources = isTest
  ? {
      en: {
        translation: (await import('../public/locales/en/translation.json')).default
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
    order: ['localStorage', 'navigator'],
    lookupLocalStorage: 'i18nextLng'
  },
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  },
  load: 'languageOnly',
  ns: ['translation'],
  resources: testResources,
  supportedLngs: ['en']
});

export const cachedLanguageKey = 'i18nextLng';
export default i18nInstance;
