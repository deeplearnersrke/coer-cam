import React from 'react';
import { LayoutDashboard, Camera, Images, Map, Calendar, FileText, Settings } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'camera', label: 'Camera', icon: Camera, highlight: true },
    { id: 'gallery', label: 'Gallery', icon: Images },
    { id: 'map', label: 'Map', icon: Map },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 text-slate-400 py-2 px-2 shadow-2xl">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          if (item.highlight) {
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="relative -top-4 flex flex-col items-center group focus:outline-none"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform group-active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-blue-500/40 ring-4 ring-slate-900'
                      : 'bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-blue-600/30 ring-4 ring-slate-900'
                  }`}
                >
                  <Icon className="w-7 h-7" />
                </div>
                <span className={`text-[10px] font-bold mt-1 ${isActive ? 'text-blue-400' : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all ${
                isActive ? 'text-blue-400 font-bold scale-105' : 'hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
