import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

// Firebase Config - .env dosyasından
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID
};

// Config kontrolü
if (!firebaseConfig.apiKey) {
  console.error("Firebase Ayarları Bulunamadı! Lütfen .env dosyanızı oluşturduğunuzdan emin olun.");
}

// Firebase başlatma
const app = initializeApp(firebaseConfig);

// Auth initialization - Capacitor için özel persistence
let auth;
if (Capacitor.isNativePlatform()) {
  // Native platforms (iOS/Android) - use indexedDB persistence
  auth = initializeAuth(app, {
    persistence: indexedDBLocalPersistence
  });
} else {
  // Web - use default getAuth
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Sabitler
export const appId = 'quiz-master-pro';
export const ADMIN_EMAILS = ['vli.kcc@gmail.com'];
export const COLORS = ['#4F46E5', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6', '#3B82F6'];

// İçerik Türleri
export const CONTENT_TYPES = {
  contest: {
    label: 'Yarışma',
    icon: '🏆',
    color: 'indigo',
    description: 'Doğru cevaplı sorular, puanlama sistemi',
    hasCorrectAnswer: true,
    multipleQuestions: true,
    questionType: 'multiple'
  },
  survey: {
    label: 'Anket',
    icon: '📊',
    color: 'emerald',
    description: 'Fikir toplama, doğru cevap yok',
    hasCorrectAnswer: false,
    multipleQuestions: true,
    questionType: 'multiple'
  },
  quiz: {
    label: 'Quiz',
    icon: '❓',
    color: 'amber',
    description: 'Tek sorulu hızlı test',
    hasCorrectAnswer: true,
    multipleQuestions: true,
    questionType: 'multiple'
  },
  exam: {
    label: 'Sınav',
    icon: '📝',
    color: 'rose',
    description: 'Çoktan seçmeli ve açık uçlu sorular, KaTeX formül desteği',
    hasCorrectAnswer: true,
    multipleQuestions: true,
    questionType: 'mixed', // multiple, open
    supportsKatex: true
  }
};

