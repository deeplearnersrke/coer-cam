import React, { useEffect, useState } from 'react';
import { Camera, MapPin, Sparkles } from 'lucide-react';

export const SplashScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onFinish, 600);
    }, 1800);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-white p-6 transition-opacity duration-500 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="relative flex flex-col items-center space-y-6 text-center max-w-sm">
        
        {/* Animated Badge Icon */}
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/30 animate-pulse">
            <Camera className="w-12 h-12 text-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg border-2 border-slate-950">
            <MapPin className="w-5 h-5 text-slate-950 fill-current" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">
            D <span className="text-blue-400">Cam</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">Capture • GeoTag • Document</p>
        </div>

        {/* Loading Spinner */}
        <div className="pt-4 flex items-center gap-2 text-xs font-semibold text-slate-400">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Initializing Offline IndexedDB Engine...</span>
        </div>

      </div>
    </div>
  );
};
