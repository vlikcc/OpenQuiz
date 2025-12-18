import React, { useState, useEffect, useCallback } from 'react';
import { signInAnonymously, onAuthStateChanged, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { doc, collection, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { Trophy, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

// Config ve sabitler
import { auth, db, googleProvider, appId, ADMIN_EMAILS, CONTENT_TYPES } from './config/firebase';

// URL parametrelerini kontrol et (QR ile gelenler için) - en başta
const urlParams = new URLSearchParams(window.location.search);
const isVoterMode = urlParams.get('mode') === 'voter' && urlParams.get('id');
const initialPollId = urlParams.get('id');

// Static imports
import VoterMode from './components/VoterMode';
import Dashboard from './components/Dashboard';
import PresenterMode from './components/PresenterMode';
import AdminPanel from './components/AdminPanel';
import TabBar from './components/TabBar';
import AuthScreen from './components/AuthScreen';
import ProfileScreen from './components/ProfileScreen';

// Özel Loading Screen - Voter modu için
const VoterLoadingScreen = ({ pollData }) => (
  <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6">
    <div className="text-center">
      {pollData ? (
        <>
          <div className="text-6xl mb-4">{CONTENT_TYPES[pollData.type]?.icon || '🎯'}</div>
          <h1 className="text-2xl font-bold mb-2">{pollData.title}</h1>
          <p className="text-indigo-200 mb-6">{pollData.questions?.length || 0} soru</p>
        </>
      ) : (
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Trophy size={32} />
        </div>
      )}
      <div className="flex items-center justify-center gap-3">
        <Loader2 className="animate-spin" size={24} />
        <span className="text-lg font-medium">Hazırlanıyor...</span>
      </div>
    </div>
  </div>
);

// Genel Loading fallback
const LoadingScreen = () => (
  <div className="h-full w-full flex items-center justify-center bg-slate-50">
    <div className="text-center">
      <Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={40} />
      <p className="text-slate-500">Yükleniyor...</p>
    </div>
  </div>
);

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("Hata:", error, errorInfo); }
  render() {
    if (this.state.hasError) return <div className="p-10 text-center">Bir hata oluştu. Lütfen sayfayı yenileyin.</div>;
    return this.props.children;
  }
}

// Ana Bileşen
export default function QuizApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [preloadedPoll, setPreloadedPoll] = useState(null);

  // Tab-based navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeScreen, setActiveScreen] = useState('tabs'); // 'tabs', 'presenter', 'voter', 'admin', 'create'
  const [activePollId, setActivePollId] = useState(() => {
    if (initialPollId) return initialPollId;
    return localStorage.getItem('activePollId') || null;
  });

  const [toast, setToast] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // QR ile gelenler için paralel yükleme
  useEffect(() => {
    if (!isVoterMode || !initialPollId) return;

    const pollRef = doc(db, 'artifacts', appId, 'public', 'data', 'polls', initialPollId);
    getDoc(pollRef).then((docSnap) => {
      if (docSnap.exists()) {
        setPreloadedPoll({ id: docSnap.id, ...docSnap.data() });
      }
    }).catch(console.error);

    signInAnonymously(auth).catch(console.error);
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser && currentUser.email) {
        const adminStatus = ADMIN_EMAILS.includes(currentUser.email);
        setIsAdmin(adminStatus);

        if (adminStatus) {
          setIsAuthorized(true);
        } else {
          const userDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'authorizedUsers', currentUser.email);
          const userDoc = await getDoc(userDocRef);
          setIsAuthorized(userDoc.exists() && userDoc.data().canCreate === true);
        }
      } else {
        setIsAdmin(false);
        setIsAuthorized(false);
      }

      setAuthLoading(false);
    });

    const timer = setTimeout(() => {
      setAuthLoading((prev) => {
        if (prev) {
          console.warn("Auth timeout reached");
          return false;
        }
        return prev;
      });
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  // Yetkili kullanıcıları dinle (admin için)
  useEffect(() => {
    if (!isAdmin) return;

    const q = collection(db, 'artifacts', appId, 'public', 'data', 'authorizedUsers');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ email: doc.id, ...doc.data() }));
      setAuthorizedUsers(users);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    if (activePollId) localStorage.setItem('activePollId', activePollId);
  }, [activePollId]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const navigate = useCallback((screen, id = null) => {
    if (id) setActivePollId(id);
    if (screen === 'dashboard') {
      setActiveScreen('tabs');
      setActiveTab('dashboard');
    } else {
      setActiveScreen(screen);
    }
  }, []);

  const handleTabChange = (tab) => {
    if (tab === 'create') {
      setIsCreating(true);
      setActiveTab('dashboard');
    } else {
      setIsCreating(false);
      setActiveTab(tab);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast("Giriş başarılı!");
    } catch (error) {
      console.error("Google giriş hatası:", error);
      showToast("Giriş başarısız: " + error.message, "error");
    }
  };

  const handleEmailLogin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Giriş başarılı!");
    } catch (error) {
      console.error("Email giriş hatası:", error);
      let message = "Giriş başarısız";
      if (error.code === 'auth/user-not-found') message = "Kullanıcı bulunamadı";
      else if (error.code === 'auth/wrong-password') message = "Yanlış şifre";
      else if (error.code === 'auth/invalid-email') message = "Geçersiz email";
      else if (error.code === 'auth/invalid-credential') message = "Email veya şifre hatalı";
      throw new Error(message);
    }
  };

  const handleEmailRegister = async (email, password, displayName) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });

      // Kayıtlı kullanıcıyı Firestore'a kaydet
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'registeredUsers', userCredential.user.uid), {
        email: email.toLowerCase(),
        displayName,
        createdAt: serverTimestamp(),
        authProvider: 'email',
        uid: userCredential.user.uid
      });

      showToast("Kayıt başarılı!");
    } catch (error) {
      console.error("Kayıt hatası:", error);
      let message = "Kayıt başarısız";
      if (error.code === 'auth/email-already-in-use') message = "Bu email zaten kullanımda";
      else if (error.code === 'auth/weak-password') message = "Şifre çok zayıf";
      else if (error.code === 'auth/invalid-email') message = "Geçersiz email";
      throw new Error(message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('dashboard');
      setActiveScreen('tabs');
      showToast("Çıkış yapıldı");
    } catch (error) {
      showToast("Çıkış hatası", "error");
    }
  };

  const handlePasswordReset = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Şifre sıfırlama hatası:", error);
      let message = "Şifre sıfırlama başarısız";
      if (error.code === 'auth/user-not-found') message = "Bu email ile kayıtlı kullanıcı bulunamadı";
      else if (error.code === 'auth/invalid-email') message = "Geçersiz email";
      throw new Error(message);
    }
  };

  // QR Voter Mode - özel handling
  if (isVoterMode && initialPollId) {
    if (authLoading || !user) {
      return <VoterLoadingScreen pollData={preloadedPoll} />;
    }

    return (
      <ErrorBoundary>
        <div className="h-full w-full flex flex-col overflow-hidden">
          <VoterMode
            pollId={activePollId}
            onExit={() => { }}
            user={user}
            showToast={showToast}
            preloadedPoll={preloadedPoll}
          />
        </div>
        {toast && (
          <div className={`fixed bottom-20 left-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium flex items-center gap-2 animate-bounce-in z-50 ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {toast.message}
          </div>
        )}
      </ErrorBoundary>
    );
  }

  // Auth loading
  if (authLoading) return <LoadingScreen />;

  // Giriş yapılmamış - Auth Screen göster
  if (!user || !user.email) {
    return (
      <ErrorBoundary>
        <AuthScreen
          onGoogleLogin={handleGoogleLogin}
          onEmailLogin={handleEmailLogin}
          onEmailRegister={handleEmailRegister}
          onPasswordReset={handlePasswordReset}
          isLoading={authLoading}
        />
      </ErrorBoundary>
    );
  }

  // Full-screen modlar (Presenter, Voter, Admin)
  if (activeScreen === 'presenter' && activePollId) {
    return (
      <ErrorBoundary>
        <div className="h-full w-full flex flex-col overflow-hidden">
          <PresenterMode
            pollId={activePollId}
            onExit={() => navigate('dashboard')}
            onSwitchToVoter={() => navigate('voter')}
            showToast={showToast}
          />
        </div>
        {toast && (
          <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-lg text-white font-medium flex items-center gap-2 animate-bounce-in z-50 ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {toast.message}
          </div>
        )}
      </ErrorBoundary>
    );
  }

  if (activeScreen === 'voter' && activePollId) {
    return (
      <ErrorBoundary>
        <div className="h-full w-full flex flex-col overflow-hidden">
          <VoterMode
            pollId={activePollId}
            onExit={() => navigate('dashboard')}
            user={user}
            showToast={showToast}
          />
        </div>
        {toast && (
          <div className={`fixed bottom-20 left-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium flex items-center gap-2 animate-bounce-in z-50 ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {toast.message}
          </div>
        )}
      </ErrorBoundary>
    );
  }

  if (activeScreen === 'admin' && isAdmin) {
    return (
      <ErrorBoundary>
        <div className="h-full w-full flex flex-col overflow-hidden bg-slate-50">
          <div className="bg-slate-900 text-white p-4 flex items-center gap-4">
            <button onClick={() => navigate('dashboard')} className="text-white/70 hover:text-white">
              ← Geri
            </button>
            <h1 className="font-bold">Admin Paneli</h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            <AdminPanel authorizedUsers={authorizedUsers} showToast={showToast} />
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Tab-based main app
  return (
    <ErrorBoundary>
      <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden">
        {toast && (
          <div className={`fixed top-4 left-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium flex items-center gap-2 animate-bounce-in z-50 ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {toast.message}
          </div>
        )}

        {/* Main Content Area - with bottom padding for tab bar */}
        <div className="flex-1 overflow-hidden pb-16">
          {activeTab === 'dashboard' && (
            <Dashboard
              onNavigate={navigate}
              user={user}
              showToast={showToast}
              isAdmin={isAdmin}
              isAuthorized={isAuthorized}
              isCreating={isCreating}
              setIsCreating={setIsCreating}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileScreen
              user={user}
              isAdmin={isAdmin}
              isAuthorized={isAuthorized}
              onLogout={handleLogout}
              onNavigateToAdmin={() => setActiveScreen('admin')}
            />
          )}
        </div>

        {/* Tab Bar */}
        <TabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isAdmin={isAdmin}
        />
      </div>
    </ErrorBoundary>
  );
}
