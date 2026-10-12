
import React from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950 text-white"
      role="status"
      aria-live="polite"
      aria-label="Initializing D-Cam"
    >
      <img
        src={`${import.meta.env.BASE_URL}d-cam-logo.png`}
        alt="D-Cam"
        className="mb-6 h-24 w-24 object-contain"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />

      <h1 className="text-3xl font-bold tracking-wide">D-Cam</h1>

      <p className="mt-3 text-sm text-slate-400">
        Initializing D-Cam...
      </p>

      <div
        className="mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-slate-800"
        aria-hidden="true"
      >
        <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-500" />
      </div>
    </div>
  );
};

export default SplashScreen;
