import React from 'react';
import { User, LogOut, Shield, ChevronRight, Bell, Moon, HelpCircle, Info } from 'lucide-react';

const ProfileScreen = ({ user, isAdmin, isAuthorized, onLogout, onNavigateToAdmin }) => {
    return (
        <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden">
            {/* Header */}
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
                        <h2 className="text-xl font-bold text-white">{user.displayName || 'Kullanıcı'}</h2>
                        <p className="text-white/70 text-sm truncate">{user.email}</p>
                        {isAdmin && (
                            <span className="inline-flex items-center gap-1 bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded text-xs mt-1">
                                <Shield size={10} /> Admin
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {isAdmin && (
                    <button
                        onClick={onNavigateToAdmin}
                        className="w-full flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100"
                    >
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                            <Shield size={20} className="text-amber-600" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-slate-800">Admin Paneli</div>
                            <div className="text-xs text-slate-500">Kullanıcı yönetimi</div>
                        </div>
                        <ChevronRight size={20} className="text-slate-400" />
                    </button>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100">
                    <button className="w-full flex items-center gap-4 p-4">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <Bell size={20} className="text-indigo-600" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-slate-800">Bildirimler</div>
                            <div className="text-xs text-slate-500">Push bildirimleri</div>
                        </div>
                        <ChevronRight size={20} className="text-slate-400" />
                    </button>

                    <button className="w-full flex items-center gap-4 p-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                            <Moon size={20} className="text-slate-600" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-slate-800">Görünüm</div>
                            <div className="text-xs text-slate-500">Tema ayarları</div>
                        </div>
                        <ChevronRight size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100">
                    <button className="w-full flex items-center gap-4 p-4">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <HelpCircle size={20} className="text-emerald-600" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-slate-800">Yardım</div>
                            <div className="text-xs text-slate-500">Sık sorulan sorular</div>
                        </div>
                        <ChevronRight size={20} className="text-slate-400" />
                    </button>

                    <button className="w-full flex items-center gap-4 p-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Info size={20} className="text-blue-600" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="font-semibold text-slate-800">Hakkında</div>
                            <div className="text-xs text-slate-500">Versiyon 1.0.0</div>
                        </div>
                        <ChevronRight size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Logout Button */}
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-4 bg-red-50 p-4 rounded-2xl border border-red-100"
                >
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                        <LogOut size={20} className="text-red-600" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="font-semibold text-red-600">Çıkış Yap</div>
                        <div className="text-xs text-red-400">Hesabından çıkış yap</div>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default ProfileScreen;
