import React, { useState } from 'react';
import { Settings, School, Shield, Database, Trash2, Smartphone, Save, RotateCcw } from 'lucide-react';
import { useEventContext } from '../../contexts/EventContext';
import { updateAppSettings, db } from '../../services/db';
import { StampStyle } from '../../types';

interface SettingsViewProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  deferredPrompt: any;
  handleInstallPwa: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  showToast,
  deferredPrompt,
  handleInstallPwa,
}) => {
  const { settings, refreshSettings } = useEventContext();

  const [schoolName, setSchoolName] = useState(settings.schoolName || '');
  const [stampStyle, setStampStyle] = useState<StampStyle>(settings.defaultStampStyle || 'gps_classic');
  const [imageQuality, setImageQuality] = useState(settings.imageQuality || 0.9);
  const [gpsHighAccuracy, setGpsHighAccuracy] = useState(settings.gpsHighAccuracy ?? true);

  const handleSaveSettings = async () => {
    try {
      await updateAppSettings({
        schoolName,
        defaultStampStyle: stampStyle,
        imageQuality,
        gpsHighAccuracy,
      });
      await refreshSettings();
      showToast('Settings saved successfully', 'success');
    } catch (err) {
      showToast('Failed to save settings', 'error');
    }
  };

  const handleClearAllData = async () => {
    if (confirm('CRITICAL WARNING: This will permanently delete ALL stored photos and events from your browser IndexedDB. Are you sure?')) {
      if (confirm('Double check: Are you absolutely certain you want to wipe all local data?')) {
        await db.photos.clear();
        await db.events.clear();
        localStorage.clear();
        showToast('All local data cleared successfully', 'info');
        setTimeout(() => window.location.reload(), 1000);
      }
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-3xl mx-auto space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight">App Preferences & Storage</h2>
        <p className="text-xs text-slate-400">Configure school branding, stamp defaults, camera compression & local IndexedDB storage.</p>
      </div>

      {/* PWA Banner if available */}
      {deferredPrompt && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-between gap-4 text-xs">
          <div className="space-y-0.5">
            <h4 className="font-bold text-white flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-blue-400" />
              <span>Install Mobile PWA App</span>
            </h4>
            <p className="text-slate-300">Add to home screen for full standalone mobile app experience offline.</p>
          </div>
          <button
            onClick={handleInstallPwa}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shrink-0 shadow-md"
          >
            Install
          </button>
        </div>
      )}

      {/* Settings Form */}
      <div className="p-6 rounded-3xl bg-slate-800/80 border border-slate-700/60 space-y-5 text-xs">
        
        <div>
          <label className="block font-bold text-slate-300 mb-1">Default School / Institution Name</label>
          <input
            type="text"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="e.g. St. Xavier International School"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-300 mb-1">Default Photo Stamp Template</label>
          <select
            value={stampStyle}
            onChange={(e) => setStampStyle(e.target.value as StampStyle)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="gps_classic">GPS Camera Classic Banner</option>
            <option value="gov_inspection">Official Government Inspection Seal</option>
            <option value="modern_glass">Modern Frosted Glass Card</option>
            <option value="minimal">Minimal Sleek Bar</option>
            <option value="school_branding">School Branding Header & Footer</option>
          </select>
        </div>

        <div>
          <label className="block font-bold text-slate-300 mb-1">
            JPEG Compression Quality: <span className="text-blue-400 font-mono">{Math.round(imageQuality * 100)}%</span>
          </label>
          <input
            type="range"
            min={0.5}
            max={1.0}
            step={0.05}
            value={imageQuality}
            onChange={(e) => setImageQuality(parseFloat(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <span className="text-[10px] text-slate-400">Higher quality results in larger file size per photo.</span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
          <div>
            <h4 className="font-bold text-slate-200">High Precision GPS Satellites</h4>
            <p className="text-[11px] text-slate-400">Request high-accuracy location hardware from device</p>
          </div>
          <input
            type="checkbox"
            checked={gpsHighAccuracy}
            onChange={(e) => setGpsHighAccuracy(e.target.checked)}
            className="w-5 h-5 rounded accent-blue-600 cursor-pointer"
          />
        </div>

        <div className="pt-2">
          <button
            onClick={handleSaveSettings}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <Save className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>

      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-3xl bg-red-950/20 border border-red-500/30 space-y-3 text-xs">
        <h3 className="text-sm font-bold text-red-400 flex items-center gap-1.5">
          <Trash2 className="w-4 h-4" />
          <span>Reset & Clear Local Database</span>
        </h3>
        <p className="text-slate-300 leading-relaxed">
          Wipe all stored photos, events, and configuration from browser IndexedDB storage.
        </p>

        <button
          onClick={handleClearAllData}
          className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-2 shadow-md"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Clear All Data</span>
        </button>
      </div>

    </div>
  );
};
