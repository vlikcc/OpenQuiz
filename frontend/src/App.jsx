import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { Trophy, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CONTENT_TYPES, POLL_TYPE_KEY } from './config/constants';
import { useAuth } from './hooks/useAuth';
import { useEntitlements } from './hooks/useEntitlements';
import { authService } from './services/authService';
import { pollService } from './services/pollService';
import { tokenStore } from './services/tokenStore';
import { setPlanLimitHandler } from './services/apiClient';

import VoterMode from './components/VoterMode';
import Dashboard from './components/Dashboard';
import TabBar from './components/TabBar';
import AuthScreen from './components/AuthScreen';
import ProfileScreen from './components/ProfileScreen';
import LandingPage from './components/LandingPage';
import LoadingPanel from './components/LoadingPanel';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import UpgradeModal from './components/UpgradeModal';
import { isPasswordResetPath, resetTokenFromSearch } from './utils/resetRoute';
import { isBillingContactSearch, planFromSearch } from './utils/billingRoute';
import {
  isResultsSearch,
  isVoterSearch,
  resultsTokenFromSearch,
  voterCodeFromSearch,
  voterIdFromSearch,
} from './utils/sessionRoute';

// The presenter pulls in the charting stack and the admin panel is reachable by
// a handful of accounts, so neither belongs in the bundle every voter downloads.
const PresenterMode = lazy(() => import('./components/PresenterMode'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const PricingScreen = lazy(() => import('./components/PricingScreen'));
const BillingContactScreen = lazy(() => import('./components/BillingContactScreen'));
const ResultsShareScreen = lazy(() => import('./components/ResultsShareScreen'));

const VoterLoadingScreen = ({ pollData }) => {
  const { t } = useTranslation();
  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-6">
      <div className="text-center">
        {pollData ? (
          <>
            <div className="text-6xl mb-4">{CONTENT_TYPES[POLL_TYPE_KEY[pollData.type]]?.icon || '🎯'}</div>
            <h1 className="text-2xl font-bold mb-2">{pollData.title}</h1>
            <p className="text-indigo-200 mb-6">{pollData.questions?.length || 0} {t('common.question')}</p>
          </>
        ) : (
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Trophy size={32} />
          </div>
        )}
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="animate-spin" size={24} />
          <span className="text-lg font-medium">{t('common.preparing')}</span>
        </div>
      </div>
    </div>
  );
};

const LoadingScreen = () => {
  const { t } = useTranslation();
  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={40} />
        <p className="text-slate-500">{t('common.loading')}</p>
      </div>
    </div>
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('Error:', error, info); }
  render() {
    if (this.state.hasError) return <div className="p-10 text-center">{this.props.fallbackMessage}</div>;
    return this.props.children;
  }
}

export default function App() {
  const { t } = useTranslation();
  const { user, loading: authLoading, logout } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const isAuthorized = !!user?.canCreate || isAdmin;
  const { can, plan, refresh: refreshEntitlements } = useEntitlements();

  const search = window.location.search;
  const isVoterMode = isVoterSearch(search);
  const initialPollId = voterIdFromSearch(search);
  const voterCode = voterCodeFromSearch(search);
  const isResultsMode = isResultsSearch(search);
  const resultsToken = resultsTokenFromSearch(search);

  const [preloadedPoll, setPreloadedPoll] = useState(null);
  const [joinError, setJoinError] = useState(null);
  // Raised from anywhere a 402 (plan_limit_exceeded / plan_feature_required)
  // comes back from the API — see the setPlanLimitHandler wiring below.
  const [upgradeInfo, setUpgradeInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeScreen, setActiveScreen] = useState('tabs');
  const [activePollId, setActivePollId] = useState(() => voterIdFromSearch(window.location.search) || localStorage.getItem('activePollId'));
  const [toast, setToast] = useState(null);
  // null when the dashboard is showing the poll list, otherwise the poll being
  // composed: { contentType, pollId } with a null pollId for a new one.
  const [composer, setComposer] = useState(null);
  const [showLandingPage, setShowLandingPage] = useState(true);
  const [showPricing, setShowPricing] = useState(false);
  // The reset e-mail lands on this same SPA; once the form is done we drop
  // the path so the next render is the ordinary landing / sign-in screen.
  const [leaveReset, setLeaveReset] = useState(false);
  // Manual checkout lands on `?billing=contact`; once the user leaves we
  // strip the query so a later dashboard render is not trapped here.
  const [leaveBillingContact, setLeaveBillingContact] = useState(false);
  const [leaveResults, setLeaveResults] = useState(false);
  const [billingContactAuth, setBillingContactAuth] = useState(false);

  // QR / room-code voter preload
  useEffect(() => {
    if (!isVoterMode) return;
    if (initialPollId) {
      pollService.get(initialPollId).then(setPreloadedPoll).catch(console.error);
      return;
    }
    if (!voterCode) return;
    pollService.getByCode(voterCode)
      .then((poll) => {
        setPreloadedPoll(poll);
        setActivePollId(poll.id);
      })
      .catch(() => setJoinError(t('session.joinFailed')));
  }, [isVoterMode, initialPollId, voterCode, t]);

  useEffect(() => {
    if (activePollId) localStorage.setItem('activePollId', activePollId);
  }, [activePollId]);

  useEffect(() => {
    setPlanLimitHandler((info) => {
      setUpgradeInfo(info);
      // The user may have just been upgraded elsewhere (another tab, an
      // admin's manual plan change) — re-fetching means the very next
      // attempt reflects the real, current plan rather than a stale one.
      refreshEntitlements();
    });
    return () => setPlanLimitHandler(null);
  }, [refreshEntitlements]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const navigate = useCallback((screen, id = null) => {
    if (id) setActivePollId(id);
    if (screen === 'dashboard') { setActiveScreen('tabs'); setActiveTab('dashboard'); }
    else setActiveScreen(screen);
  }, []);

  // Leaving or re-entering the create tab always starts a fresh poll, otherwise
  // a poll left mid-edit would reappear behind the "Create" button.
  const handleTabChange = (tab) => {
    if (tab === 'create') { setComposer({ contentType: 'contest', pollId: null }); setActiveTab('dashboard'); }
    else { setComposer(null); setActiveTab(tab); }
  };

  const handleGoogleLogin = async (idToken) => {
    try {
      await authService.googleLogin(idToken);
      showToast(t('auth.loginSuccess'));
    } catch (err) {
      console.error(err);
      showToast(err.message || t('auth.googleFailed'), 'error');
      throw err;
    }
  };

  const handleEmailLogin = async (email, password) => {
    await authService.login(email, password);
    showToast(t('auth.loginSuccess'));
  };

  const handleEmailRegister = async (email, password, displayName) => {
    await authService.register(email, password, displayName);
    showToast(t('auth.registerSuccess'));
  };

  const handleLogout = async () => {
    await logout();
    setActiveTab('dashboard');
    setActiveScreen('tabs');
    showToast(t('auth.logoutSuccess'));
  };

  const handlePasswordReset = async (email) => {
    await authService.passwordResetRequest(email);
  };

  if (isPasswordResetPath(window.location.pathname) && !leaveReset) {
    return (
      <ErrorBoundary fallbackMessage={t('common.errorRefresh')}>
        <ResetPasswordScreen
          token={resetTokenFromSearch(window.location.search)}
          onFinished={() => {
            window.history.replaceState({}, '', '/');
            setLeaveReset(true);
            setShowLandingPage(false);
          }}
        />
      </ErrorBoundary>
    );
  }

  if (isResultsMode && resultsToken && !leaveResults) {
    return (
      <ErrorBoundary fallbackMessage={t('common.errorRefresh')}>
        <Suspense fallback={<LoadingPanel />}>
          <ResultsShareScreen
            token={resultsToken}
            onClose={() => {
              window.history.replaceState({}, '', window.location.pathname || '/');
              setLeaveResults(true);
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // QR Voter Mode
  if (isVoterMode) {
    if (joinError) {
      return (
        <ErrorBoundary fallbackMessage={t('common.errorRefresh')}>
          <div className="h-full w-full flex items-center justify-center bg-slate-50 p-8 text-center text-slate-600">
            {joinError}
          </div>
        </ErrorBoundary>
      );
    }
    if (!activePollId) return <VoterLoadingScreen pollData={preloadedPoll} />;
    if (authLoading && tokenStore.getAccessToken()) return <VoterLoadingScreen pollData={preloadedPoll} />;
    return (
      <ErrorBoundary fallbackMessage={t('common.errorRefresh')}>
        <div className="h-full w-full flex flex-col overflow-hidden">
          <VoterMode
            pollId={activePollId}
            onExit={() => {}}
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
        {upgradeInfo && <UpgradeModal info={upgradeInfo} onClose={() => setUpgradeInfo(null)} />}
      </ErrorBoundary>
    );
  }

  if (authLoading) return <LoadingScreen />;

  if (isBillingContactSearch(window.location.search) && !leaveBillingContact) {
    const dismissBillingContact = () => {
      window.history.replaceState({}, '', window.location.pathname || '/');
      setLeaveBillingContact(true);
      setBillingContactAuth(false);
    };

    if (billingContactAuth && !user) {
      return (
        <ErrorBoundary fallbackMessage={t('common.errorRefresh')}>
          <AuthScreen
            onGoogleLogin={handleGoogleLogin}
            onEmailLogin={handleEmailLogin}
            onEmailRegister={handleEmailRegister}
            onPasswordReset={handlePasswordReset}
            isLoading={false}
            onBack={() => setBillingContactAuth(false)}
          />
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary fallbackMessage={t('common.errorRefresh')}>
        <Suspense fallback={<LoadingPanel dark />}>
          <BillingContactScreen
            planCode={planFromSearch(window.location.search)}
            user={user}
            onBack={dismissBillingContact}
            onLogin={() => {
              setBillingContactAuth(true);
              setShowLandingPage(false);
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (!user) {
    if (showPricing) {
      return (
        <ErrorBoundary fallbackMessage={t('common.errorRefresh')}>
          <Suspense fallback={<LoadingPanel dark />}>
            <PricingScreen
              onBack={() => setShowPricing(false)}
              onLogin={() => { setShowPricing(false); setShowLandingPage(false); }}
            />
          </Suspense>
        </ErrorBoundary>
      );
    }
    if (!showLandingPage) {
      return (
        <ErrorBoundary fallbackMessage={t('common.errorRefresh')}>
          <AuthScreen
            onGoogleLogin={handleGoogleLogin}
            onEmailLogin={handleEmailLogin}
            onEmailRegister={handleEmailRegister}
            onPasswordReset={handlePasswordReset}
            isLoading={false}
            onBack={() => setShowLandingPage(true)}
          />
        </ErrorBoundary>
      );
    }
    return (
      <ErrorBoundary fallbackMessage={t('common.errorRefresh')}>
        <LandingPage
          onLogin={() => setShowLandingPage(false)}
          onPricing={() => setShowPricing(true)}
        />
      </ErrorBoundary>
    );
  }

  if (activeScreen === 'presenter' && activePollId) {
    return (
      <ErrorBoundary fallbackMessage={t('common.errorRefresh')}>
        <div className="h-full w-full flex flex-col overflow-hidden">
          <Suspense fallback={<LoadingPanel dark />}>
            <PresenterMode
              pollId={activePollId}
              onExit={() => navigate('dashboard')}
              showToast={showToast}
            />
          </Suspense>
        </div>
        {toast && (
          <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-lg text-white font-medium flex items-center gap-2 animate-bounce-in z-50 ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {toast.message}
          </div>
        )}
        {upgradeInfo && <UpgradeModal info={upgradeInfo} onClose={() => setUpgradeInfo(null)} />}
      </ErrorBoundary>
    );
  }

  if (activeScreen === 'voter' && activePollId) {
    return (
      <ErrorBoundary fallbackMessage={t('common.errorRefresh')}>
        <div className="h-full w-full flex flex-col overflow-hidden">
          <VoterMode pollId={activePollId} onExit={() => navigate('dashboard')} user={user} showToast={showToast} />
        </div>
      </ErrorBoundary>
    );
  }

  if (activeScreen === 'admin' && isAdmin) {
    return (
      <ErrorBoundary fallbackMessage={t('common.errorRefresh')}>
        <div className="h-full w-full flex flex-col overflow-hidden bg-slate-50">
          <div className="bg-slate-900 text-white p-4 flex items-center gap-4">
            <button onClick={() => navigate('dashboard')} className="text-white/70 hover:text-white">← {t('common.back')}</button>
            <h1 className="font-bold">{t('admin.title')}</h1>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Suspense fallback={<LoadingPanel />}>
              <AdminPanel showToast={showToast} />
            </Suspense>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary fallbackMessage={t('common.errorRefresh')}>
      <div className="h-full w-full bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden">
        {toast && (
          <div className={`fixed top-4 left-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium flex items-center gap-2 animate-bounce-in z-50 ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            {toast.message}
          </div>
        )}

        <div className="flex-1 overflow-hidden pb-16">
          {activeTab === 'dashboard' && (
            <Dashboard
              onNavigate={navigate}
              user={user}
              showToast={showToast}
              isAdmin={isAdmin}
              isAuthorized={isAuthorized}
              composer={composer}
              setComposer={setComposer}
              can={can}
              plan={plan}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileScreen
              user={user}
              isAdmin={isAdmin}
              onLogout={handleLogout}
              onNavigateToAdmin={() => setActiveScreen('admin')}
              showToast={showToast}
            />
          )}
        </div>

        <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
        {upgradeInfo && <UpgradeModal info={upgradeInfo} onClose={() => setUpgradeInfo(null)} />}
      </div>
    </ErrorBoundary>
  );
}
