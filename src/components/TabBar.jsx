import React from 'react';
import { Home, PlusCircle, User, Trophy } from 'lucide-react';

const TabBar = ({ activeTab, onTabChange, isAdmin }) => {
    const tabs = [
        { id: 'dashboard', label: 'Ana Sayfa', icon: Home },
        { id: 'create', label: 'Oluştur', icon: PlusCircle },
        { id: 'profile', label: 'Profil', icon: User },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 safe-area-bottom">
            <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${isActive
                                    ? 'text-indigo-600'
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <Icon
                                size={24}
                                strokeWidth={isActive ? 2.5 : 2}
                                className={isActive ? 'mb-0.5' : 'mb-0.5'}
                            />
                            <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>
                                {tab.label}
                            </span>
                            {isActive && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-indigo-600 rounded-full" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default TabBar;
