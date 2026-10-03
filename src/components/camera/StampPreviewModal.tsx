import React, { useState } from 'react';
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
  const [remarks, setRemarks] = useState('');

  const coordinates = formatCoordinates(
    location.latitude,
    location.longitude
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl overflow-y-auto">
      <div className="min-h-full flex flex-col">

        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/90">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Photo Verification
            </p>

            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="text-sm sm:text-base font-bold text-white">
                Review Photo
              </h2>

              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono font-bold text-amber-400">
                {photoNumber}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setActiveView('stamped')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                activeView === 'stamped'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Stamped
            </button>

            <button
              type="button"
              onClick={() => setActiveView('original')}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                activeView === 'original'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Original
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center px-4 py-4">

          {/* Image Preview */}
          <div className="w-full max-w-3xl flex justify-center">
            <div className="relative w-full max-h-[55vh] rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-2xl">
              <img
                src={
                  activeView === 'stamped'
                    ? stampedDataUrl
                    : originalDataUrl
                }
                alt={
                  activeView === 'stamped'
                    ? 'Stamped photo preview'
                    : 'Original photo preview'
                }
                className="block w-full max-h-[55vh] object-contain"
              />

              {/* Image Status */}
              <div className="absolute top-3 left-3">
                <span
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold backdrop-blur-md border ${
                    activeView === 'stamped'
                      ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300'
                      : 'bg-slate-900/80 border-slate-700 text-slate-300'
                  }`}
                >
                  {activeView === 'stamped'
                    ? 'STAMPED PREVIEW'
                    : 'ORIGINAL PHOTO'}
                </span>
              </div>
            </div>
          </div>

          {/* Verification Status */}
          <div className="w-full max-w-3xl mt-4">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <div>
                <p className="text-xs font-semibold text-emerald-300">
                  Photo Ready for Saving
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Verify the information below before saving
                </p>
              </div>

              <span className="text-[10px] font-semibold text-emerald-400">
                VERIFIED
              </span>
            </div>
          </div>

          {/* Metadata */}
          <div className="w-full max-w-3xl mt-3">
            <div className="rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden">

              <div className="px-3 py-2 border-b border-slate-800">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  Photo Information
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2">

                {/* GPS */}
                <div className="px-3 py-3 border-b sm:border-r border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                    GPS Coordinates
                  </p>

                  <p className="text-xs text-slate-200 font-mono mt-1 break-all">
                    {coordinates}
                  </p>

                  {location.accuracy !== undefined &&
                    location.accuracy !== null && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        Accuracy: ±{Math.round(location.accuracy)}m
                      </p>
                    )}
                </div>

                {/* Address */}
                <div className="px-3 py-3 border-b border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                    Location
                  </p>

                  <p className="text-xs text-slate-200 mt-1 line-clamp-2">
                    {location.address?.formattedAddress ||
                      'Address not available'}
                  </p>
                </div>

                {/* Event */}
                <div className="px-3 py-3 sm:border-r border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                    Event
                  </p>

                  {event ? (
                    <>
                      <p className="text-xs text-blue-400 font-semibold mt-1">
                        {event.name}
                      </p>

                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {event.schoolName}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">
                      No event selected
                    </p>
                  )}
                </div>

                {/* Stamp */}
                <div className="px-3 py-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                    Stamp Style
                  </p>

                  <p className="text-xs text-slate-200 mt-1 capitalize">
                    {String(stampStyle)}
                  </p>

                  <p className="text-[10px] text-emerald-400 mt-0.5">
                    Applied
                  </p>
                </div>

              </div>
            </div>
          </div>

          {/* Remarks */}
          <div className="w-full max-w-3xl mt-3">
            <label
              htmlFor="photo-remarks"
              className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5"
            >
              Remarks
            </label>

            <textarea
              id="photo-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add optional inspection notes or remarks..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-600 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />

            <div className="flex justify-end mt-1">
              <span className="text-[9px] text-slate-600">
                {remarks.length}/500
              </span>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="sticky bottom-0 border-t border-slate-800 bg-slate-950/95 backdrop-blur-xl px-4 py-3">
          <div className="w-full max-w-3xl mx-auto flex gap-3">

            <button
              type="button"
              onClick={onRetake}
              disabled={isSaving}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 font-semibold text-xs border border-slate-700 transition-all"
            >
              Discard & Retake
            </button>

            <button
              type="button"
              onClick={() => onSave(remarks)}
              disabled={isSaving}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
            >
              {isSaving ? 'Saving Photo...' : 'Save Photo'}
            </button>

          </div>

          <p className="text-center text-[9px] text-slate-600 mt-2">
            Review the stamped image and location information before saving.
          </p>
        </footer>

      </div>
    </div>
  );
};