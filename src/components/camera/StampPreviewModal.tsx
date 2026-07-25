import React, { useState } from 'react';
import { Check, X, MapPin, Calendar, Layers, Edit3, Download, Share2 } from 'lucide-react';
import { GeoPhoto, SchoolEvent, StampStyle } from '../../types';
import { formatCoordinates } from '../../services/gps';

interface StampPreviewModalProps {
  originalDataUrl: string;
  stampedDataUrl: string;
  photoNumber: string;
  location: GeoPhoto['location'];
  event: SchoolEvent | null;
  stampStyle: StampStyle;
  onSave: (remarks: string) => void;
  onRetake: () => void;
  isSaving: boolean;
}

export const StampPreviewModal: React.FC<StampPreviewModalProps> = ({
  originalDataUrl,
  stampedDataUrl,
  photoNumber,
  location,
  event,
  stampStyle,
  onSave,
  onRetake,
  isSaving,
}) => {
  const [activeView, setActiveView] = useState<'stamped' | 'original'>('stamped');
  const [remarks, setRemarks] = useState<string>('');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between p-4 overflow-y-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between text-white border-b border-slate-800 pb-3">
        <div>
          <span className="text-xs font-mono font-bold text-amber-400">ID: {photoNumber}</span>
          <h2 className="text-base font-bold">Review Stamped Photo</h2>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveView('stamped')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              activeView === 'stamped' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Stamped
          </button>
          <button
            onClick={() => setActiveView('original')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              activeView === 'original' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Original
          </button>
        </div>
      </div>

      {/* Main Image View */}
      <div className="my-auto flex flex-col items-center justify-center max-h-[58vh]">
        <div className="relative max-w-full max-h-[55vh] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-black">
          <img
            src={activeView === 'stamped' ? stampedDataUrl : originalDataUrl}
            alt="Preview"
            className="object-contain max-h-[55vh] w-auto mx-auto"
          />
        </div>
      </div>

      {/* Footer Controls & Metadata Input */}
      <div className="space-y-4 max-w-lg mx-auto w-full">
        
        {/* GPS & Event Summary Pill */}
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1">
          <div className="flex items-center justify-between text-slate-300 font-mono">
            <span className="flex items-center gap-1 text-sky-400 font-bold">
              <MapPin className="w-3.5 h-3.5" />
              {formatCoordinates(location.latitude, location.longitude)}
            </span>
            {location.accuracy && (
              <span className="text-slate-400">±{Math.round(location.accuracy)}m</span>
            )}
          </div>

          {location.address?.formattedAddress && (
            <p className="text-slate-400 text-[11px] truncate">{location.address.formattedAddress}</p>
          )}

          {event && (
            <p className="text-slate-300 font-medium pt-1 border-t border-slate-800/80">
              Event: <span className="text-blue-400 font-bold">{event.name}</span> ({event.schoolName})
            </p>
          )}
        </div>

        {/* Optional Remarks Input */}
        <div className="relative">
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add optional remarks / inspection notes..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Actions Bar */}
        <div className="flex items-center gap-3">
          <button
            onClick={onRetake}
            disabled={isSaving}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors"
          >
            <X className="w-4 h-4 text-red-400" />
            <span>Discard & Retake</span>
          </button>

          <button
            onClick={() => onSave(remarks)}
            disabled={isSaving}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
          >
            <Check className="w-4 h-4 text-emerald-300" />
            <span>{isSaving ? 'Saving...' : 'Save Photo'}</span>
          </button>
        </div>

      </div>

    </div>
  );
};
