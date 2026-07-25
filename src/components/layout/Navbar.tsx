import React from 'react';
import { Camera, MapPin, Sun, Moon, Wifi, WifiOff, School, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useEventContext } from '../../contexts/EventContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOnline: boolean;
  deferredPrompt: any;
  handleInstallPwa: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isOnline,
  deferredPrompt,
  handleInstallPwa,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { activeEvent } = useEventContext();

  return (
    <header className="sticky top-0 z-30 w-full bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        
        {/* Brand Title */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2.5 text-left group focus:outline-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Camera className="w-5.5 h-5.5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-base tracking-tight text-white leading-tight">
                School Event <span className="text-blue-400">Geo Cam</span>
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Capture • GeoTag • Document</p>
          </div>
        </button>

        {/* Active Event Badge */}
        {activeEvent && (
          <button
            onClick={() => setActiveTab('events')}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs font-semibold text-slate-200 transition-colors max-w-[220px] truncate"
            title={`Active Event: ${activeEvent.name}`}
          >
            <School className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">{activeEvent.name}</span>
          </button>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          
          {/* Online/Offline Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
            title={isOnline ? 'Online - Reverse Geocoding Active' : 'Offline Mode - GPS Coordinates Active'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* PWA Install Button */}
          {deferredPrompt && (
            <button
              onClick={handleInstallPwa}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md transition-all animate-pulse"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-colors"
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>
        </div>

      </div>
    </header>
  );
};
