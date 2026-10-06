import React, { useState } from 'react';
import { User, LogOut, Shield, ChevronRight, Globe, Info, Moon, HelpCircle, Sun, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BillingSection from './BillingSection';
import BrandingSection from './BrandingSection';
import { applyTheme, getStoredTheme } from '../utils/theme';
import { infoService } from '../services/infoService';

const ProfileScreen = ({ user, isAdmin, onLogout, onNavigateToAdmin, showToast }) => {
    const { t, i18n } = useTranslation();
    const lang = i18n.resolvedLanguage || i18n.language;
    const setLang = (l) => i18n.changeLanguage(l);
    const [theme, setTheme] = useState(getStoredTheme);
    const [panel, setPanel] = useState(null);
    const [about, setAbout] = useState(null);

    const chooseTheme = (next) => {
        applyTheme(next);
        setTheme(next);
    };

    const openAbout = async () => {
        setPanel('about');
        try {
            setAbout(await infoService.get());
        } catch {
            setAbout({ name: 'OpenQuiz', version: '1.0.0' });
        }
    };

    return (
        <div className="h-full w-full bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 pt-12 pb-8 px-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <User size={32} className="text-white" />
                        )}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-white">{user.displayName || t('common.user')}</h2>
                        <p className="text-white/70 text-sm truncate">{user.email}</p>
                        {isAdmin && (
                            <span className="inline-flex items-center gap-1 bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded text-xs mt-1">
                                <Shield size={10} /> Admin
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {isAdmin && (
                    <button
                        onClick={onNavigateToAdmin}
                        className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700"
                    >
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                            <Shield size={20} className="text-amber-600" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{t('profile.admin')}</div>
                            <div className="text-xs text-slate-500">{t('profile.adminDesc')}</div>
                        </div>
                        <ChevronRight size={20} className="text-slate-400" />
                    </button>
                )}

                <BillingSection showToast={showToast} />
                <BrandingSection showToast={showToast} />

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
                            <Globe size={20} className="text-sky-600" />
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{t('profile.language')}</div>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setLang('tr')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${lang === 'tr' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                TR
                            </button>
                            <button
                                onClick={() => setLang('en')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${lang === 'en' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                EN
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                            {theme === 'dark' ? <Moon size={20} className="text-slate-600 dark:text-slate-200" /> : <Sun size={20} className="text-slate-600" />}
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{t('profile.appearance')}</div>
                            <div className="text-xs text-slate-500">{t('profile.appearanceDesc')}</div>
                        </div>
                        <div className="flex gap-1">
                            <button
                                type="button"
                                onClick={() => chooseTheme('light')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${theme === 'light' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                {t('session.themeLight')}
                            </button>
                            <button
                                type="button"
                                onClick={() => chooseTheme('dark')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${theme === 'dark' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                {t('session.themeDark')}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                    <button onClick={() => setPanel('help')} className="w-full flex items-center gap-4 p-4">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <HelpCircle size={20} className="text-emerald-600" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{t('profile.help')}</div>
                            <div className="text-xs text-slate-500">{t('profile.helpDesc')}</div>
                        </div>
                        <ChevronRight size={20} className="text-slate-400" />
                    </button>

                    <button onClick={openAbout} className="w-full flex items-center gap-4 p-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Info size={20} className="text-blue-600" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{t('profile.about')}</div>
                            <div className="text-xs text-slate-500">{t('profile.version')}</div>
                        </div>
                        <ChevronRight size={20} className="text-slate-400" />
                    </button>
                </div>

                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-4 bg-red-50 dark:bg-red-950/40 p-4 rounded-2xl border border-red-100 dark:border-red-900"
                >
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                        <LogOut size={20} className="text-red-600" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-red-600">{t('profile.logout')}</div>
                        <div className="text-xs text-red-400">{t('profile.logoutDesc')}</div>
                    </div>
                </button>
            </div>

            {panel && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100">
                                {panel === 'help' ? t('session.helpTitle') : t('session.aboutTitle')}
                            </h3>
                            <button type="button" aria-label={t('common.close')} onClick={() => setPanel(null)} className="p-1 text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>
                        {panel === 'help' ? (
                            <dl className="space-y-4 text-sm">
                                <div>
                                    <dt className="font-bold text-slate-800 dark:text-slate-100">{t('session.helpJoin')}</dt>
                                    <dd className="text-slate-500 mt-1">{t('session.helpJoinBody')}</dd>
                                </div>
                                <div>
                                    <dt className="font-bold text-slate-800 dark:text-slate-100">{t('session.helpPresent')}</dt>
                                    <dd className="text-slate-500 mt-1">{t('session.helpPresentBody')}</dd>
                                </div>
                                <div>
                                    <dt className="font-bold text-slate-800 dark:text-slate-100">{t('session.helpExport')}</dt>
                                    <dd className="text-slate-500 mt-1">{t('session.helpExportBody')}</dd>
                                </div>
                            </dl>
                        ) : (
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                {about?.name || 'OpenQuiz'} {about?.version || '1.0.0'}
                                {about?.phase ? ` · ${about.phase}` : ''}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileScreen;
