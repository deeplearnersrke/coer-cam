
import React, { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

export const SplashScreen: React.FC<{ onFinish: () => void }> = ({
  onFinish,
}) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);

      setTimeout(onFinish, 600);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-white p-6 transition-opacity duration-500 ${
        fadeOut
          ? 'opacity-0 pointer-events-none'
          : 'opacity-100'
      }`}
    >
      <div className="relative flex flex-col items-center space-y-6 text-center max-w-sm">

        {/* Animated Logo */}
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-white flex items-center justify-center shadow-2xl shadow-blue-500/30 animate-pulse overflow-hidden">
            <img
              src={`${import.meta.env.BASE_URL}d-cam-logo.png`}
              alt="D-Cam Logo"
              className="w-full h-full object-contain p-2"
            />
          </div>

          {/* Location Badge */}
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg border-2 border-slate-950">
            <MapPin className="w-5 h-5 text-slate-950" />
          </div>
        </div>

        {/* App Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">
            D <span className="text-blue-400">Cam</span>
          </h1>

          <p className="text-xs text-slate-400 font-medium">
            Capture • GeoTag • Document
          </p>
        </div>

        {/* Location Reminder */}
        <div className="w-full rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 space-y-2">
          <div className="flex items-center justify-center gap-2 text-blue-300">
            <MapPin className="w-5 h-5" />
            <span className="text-sm font-bold">
              Location Access Required
            </span>
          </div>

          <p className="text-sm leading-relaxed text-slate-300">
            Please enable your device location and allow location
            permission in your browser before starting this web app.
          </p>

          <p className="text-xs text-slate-400">
            Location access helps capture accurate GPS coordinates
            for your photos.
          </p>
        </div>

        {/* Loading Spinner */}
        <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-slate-400">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Initializing DCam...</span>
        </div>

      </div>
    </div>
  );
};
