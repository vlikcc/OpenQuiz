import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import tr from './tr.json';
import en from './en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    fallbackLng: 'tr',
    supportedLngs: ['tr', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'oq.lang',
    },
  });

const applyDocumentLang = (lng) => {
  const short = (lng || 'tr').slice(0, 2);
  document.documentElement.lang = short === 'en' ? 'en' : 'tr';
};
applyDocumentLang(i18n.resolvedLanguage || i18n.language);
i18n.on('languageChanged', applyDocumentLang);

export default i18n;
