import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { signInAnonymously, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, collection, getDoc, onSnapshot } from 'firebase/firestore';
import { Trophy, Loader2, CheckCircle2, AlertTriangle, LogOut, Shield, Settings } from 'lucide-react';

// Config ve sabitler
import { auth, db, googleProvider, appId, ADMIN_EMAILS, CONTENT_TYPES } from './config/firebase';

// URL parametrelerini kontrol et (QR ile gelenler için) - en başta
const urlParams = new URLSearchParams(window.location.search);
const isVoterMode = urlParams.get('mode') === 'voter' && urlParams.get('id');
const initialPollId = urlParams.get('id');

// VoterMode için eager loading - QR ile gelenlere hızlı yükleme
const VoterMode = isVoterMode 
  ? lazy(() => import(/* webpackPrefetch: true */ './components/VoterMode'))
  : lazy(() => import('./components/VoterMode'));

// Diğer lazy loaded components
const LandingPage = lazy(() => import('./components/LandingPage'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const PresenterMode = lazy(() => import('./components/PresenterMode'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));

// QR ile gelenler için VoterMode'u hemen preload et
if (isVoterMode) {
  import('./components/VoterMode');
}

// Özel Loading Screen - Voter modu için
const VoterLoadingScreen = ({ pollData }) => (
  <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6">
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
  <div className="h-screen flex items-center justify-center bg-slate-50">
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
  
  const [view, setView] = useState(() => {
    if (isVoterMode) return 'voter';
    return localStorage.getItem('appView') || 'dashboard';
  });
  
  const [activePollId, setActivePollId] = useState(() => {
    if (initialPollId) return initialPollId;
    return localStorage.getItem('activePollId') || null;
  });
  
  const [toast, setToast] = useState(null);

  // QR ile gelenler için paralel yükleme - Auth + Poll verisi aynı anda
  useEffect(() => {
    if (!isVoterMode || !initialPollId) return;
    
    // Poll verisini hemen çek (auth beklemeden)
    const pollRef = doc(db, 'artifacts', appId, 'public', 'data', 'polls', initialPollId);
    getDoc(pollRef).then((docSnap) => {
      if (docSnap.exists()) {
        setPreloadedPoll({ id: docSnap.id, ...docSnap.data() });
      }
    }).catch(console.error);
    
    // Anonymous auth'u başlat
    signInAnonymously(auth).catch(console.error);
  }, []);

  // Auth state listener
  useEffect(() => {
    // Normal modda (voter değil) anonymous auth yapma
    if (!isVoterMode) {
      // Auth zaten başladıysa tekrar başlatma
    }
    
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
    
    return () => unsubscribe();
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
    localStorage.setItem('appView', view);
    if (activePollId) localStorage.setItem('activePollId', activePollId);
  }, [view, activePollId]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const navigate = useCallback((newView, id = null) => {
    if (id) setActivePollId(id);
    setView(newView);
    window.history.pushState({}, '', '/');
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast("Giriş başarılı!");
    } catch (error) {
      console.error("Google giriş hatası:", error);
      showToast("Giriş başarısız: " + error.message, "error");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('dashboard');
      showToast("Çıkış yapıldı");
    } catch (error) {
      showToast("Çıkış hatası", "error");
    }
  };

  // Katılımcı modu için özel yükleme - Auth bekleniyor ama UI hemen göster
  if (isVoterMode && view === 'voter' && activePollId) {
    // Auth hala yükleniyor - güzel loading ekranı göster
    if (authLoading || !user) {
      return <VoterLoadingScreen pollData={preloadedPoll} />;
    }
    
    return (
      <ErrorBoundary>
        <Suspense fallback={<VoterLoadingScreen pollData={preloadedPoll} />}>
          <VoterMode 
            pollId={activePollId} 
            onExit={() => {}} 
            user={user} 
            showToast={showToast}
            preloadedPoll={preloadedPoll}
          />
        </Suspense>
        {toast && (
          <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-lg text-white font-medium flex items-center gap-2 animate-bounce-in z-50 ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {toast.message}
          </div>
        )}
      </ErrorBoundary>
    );
  }

  // Normal mod için auth yüklemesi
  if (authLoading) return <LoadingScreen />;

  // Yönetim paneli için giriş gerekli - Landing Page göster
  if (!user || !user.email) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingScreen />}>
          <LandingPage onLogin={handleGoogleLogin} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100">
        {toast && (
          <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-lg text-white font-medium flex items-center gap-2 animate-bounce-in z-50 ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {toast.message}
          </div>
        )}

        <div className="bg-slate-900 text-white p-2 sm:p-3 text-xs flex justify-between items-center px-3 sm:px-4 lg:px-6 sticky top-0 z-40 shadow-md">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-bold tracking-wider text-[10px] sm:text-xs">OPEN QUIZ</span>
            {isAdmin && (
              <span className="bg-amber-500/20 text-amber-400 px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[10px] border border-amber-500/30 flex items-center gap-1">
                <Shield size={10} /> ADMIN
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex gap-1 sm:gap-2">
              <button onClick={() => setView('dashboard')} className={`px-2 sm:px-3 py-1 rounded transition text-[10px] sm:text-xs ${view === 'dashboard' ? 'bg-white/20' : 'text-slate-400 hover:text-white'}`}>Panel</button>
              <button onClick={() => activePollId && setView('presenter')} disabled={!activePollId} className={`px-2 sm:px-3 py-1 rounded transition text-[10px] sm:text-xs ${view === 'presenter' ? 'bg-white/20' : 'text-slate-400 hover:text-white disabled:opacity-30'}`}>Sunum</button>
              {isAdmin && (
                <button onClick={() => setView('admin')} className={`px-2 sm:px-3 py-1 rounded transition text-[10px] sm:text-xs ${view === 'admin' ? 'bg-white/20' : 'text-slate-400 hover:text-white'}`}>
                  <Settings size={14} className="inline mr-1" />Yönetim
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-2 border-l border-slate-700 pl-2 sm:pl-3">
              <span className="text-slate-400 text-[10px] sm:text-xs hidden sm:inline truncate max-w-[120px]">{user.email}</span>
              <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>

        <Suspense fallback={<LoadingScreen />}>
          {view === 'dashboard' && <Dashboard onNavigate={navigate} user={user} showToast={showToast} isAdmin={isAdmin} isAuthorized={isAuthorized} />}
          {view === 'presenter' && <PresenterMode pollId={activePollId} onExit={() => navigate('dashboard')} onSwitchToVoter={() => navigate('voter', activePollId)} showToast={showToast} />}
          {view === 'voter' && <VoterMode pollId={activePollId} onExit={() => navigate('dashboard')} user={user} showToast={showToast} />}
          {view === 'admin' && isAdmin && <AdminPanel authorizedUsers={authorizedUsers} showToast={showToast} />}
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
