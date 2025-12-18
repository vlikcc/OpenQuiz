import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

// Firebase Web Client ID
const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || '';
const AUTH_DOMAIN = import.meta.env.VITE_AUTH_DOMAIN || '';

// Unique state for CSRF protection
const generateState = () => Math.random().toString(36).substring(2, 15);

// Platform'a göre doğru auth metodunu kullan
export const signInWithGoogle = async () => {
    if (Capacitor.isNativePlatform()) {
        return signInWithGoogleNative();
    } else {
        return signInWithPopup(auth, googleProvider);
    }
};

// Native platformda In-App Browser ile auth
const signInWithGoogleNative = async () => {
    return new Promise((resolve, reject) => {
        const state = generateState();

        // Store state for verification
        sessionStorage.setItem('oauth_state', state);

        // Deep link listener - uygulama açıldığında
        const appStateListener = App.addListener('appStateChange', async (appState) => {
            if (appState.isActive) {
                // Uygulama aktif olduğunda auth result'ı kontrol et
                const storedToken = sessionStorage.getItem('google_access_token');
                if (storedToken) {
                    try {
                        const credential = GoogleAuthProvider.credential(null, storedToken);
                        const result = await signInWithCredential(auth, credential);
                        sessionStorage.removeItem('google_access_token');
                        sessionStorage.removeItem('oauth_state');
                        appStateListener.remove();
                        resolve(result);
                    } catch (error) {
                        appStateListener.remove();
                        reject(error);
                    }
                }
            }
        });

        // Firebase'in auth handler'ını kullan
        // Bu signInWithRedirect gibi çalışır ama biz browser'da açıyoruz
        const authUrl = buildGoogleAuthUrl(state);

        console.log('Opening Google auth URL...');

        // Safari'de aç
        Browser.open({
            url: authUrl,
            presentationStyle: 'popover',
            toolbarColor: '#4F46E5'
        }).catch(reject);

        // Timeout - 5 dakika
        setTimeout(() => {
            appStateListener.remove();
            reject(new Error('Auth timeout'));
        }, 300000);
    });
};

// Google OAuth URL'ini oluştur (Firebase signInWithRedirect kullanarak)
const buildGoogleAuthUrl = (state) => {
    // Firebase Auth'un kendi redirect handlerını kullan
    // Bu URL firebase tarafından yönetilir ve token'ı döner
    const params = new URLSearchParams({
        client_id: WEB_CLIENT_ID,
        redirect_uri: `https://${AUTH_DOMAIN}/__/auth/handler`,
        response_type: 'token',
        scope: 'openid email profile',
        state: state,
        prompt: 'select_account'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

// Auth sonucu işle (Firebase handler'dan dönen)
export const handleAuthRedirect = async () => {
    // URL fragment'tan token'ı al
    const hash = window.location.hash.substring(1);
    if (!hash) return null;

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const state = params.get('state');

    // State kontrolü
    const storedState = sessionStorage.getItem('oauth_state');
    if (state && storedState && state !== storedState) {
        console.error('State mismatch');
        return null;
    }

    if (accessToken) {
        try {
            const credential = GoogleAuthProvider.credential(null, accessToken);
            const result = await signInWithCredential(auth, credential);

            // Temizle
            sessionStorage.removeItem('oauth_state');
            window.location.hash = '';

            return result;
        } catch (error) {
            console.error('Auth error:', error);
            return null;
        }
    }

    return null;
};
