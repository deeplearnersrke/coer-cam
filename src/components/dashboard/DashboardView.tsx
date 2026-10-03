import React, { useEffect, useState } from 'react';
import { Camera, Calendar, Images, Map, FileText, HardDrive, MapPin, Compass, Sparkles, Plus, ArrowRight, ShieldCheck, Clock } from 'lucide-react';
import { useEventContext } from '../../contexts/EventContext';
import { useGps } from '../../hooks/useGps';
import { db } from '../../services/db';
import { GeoPhoto } from '../../types';
import { formatCoordinates, getAccuracyLevel } from '../../services/gps';

interface DashboardViewProps {
  setActiveTab: (tab: string) => void;
  onOpenPhotoDetail: (photo: GeoPhoto) => void;
  onOpenCreateEventModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  setActiveTab,
  onOpenPhotoDetail,
  onOpenCreateEventModal,
}) => {
  const { activeEvent, events } = useEventContext();
  const { location, error: gpsError, isSearching: isGpsSearching } = useGps(true);

  const [todayCount, setTodayCount] = useState<number>(0);
  const [totalPhotosCount, setTotalPhotosCount] = useState<number>(0);
  const [recentPhotos, setRecentPhotos] = useState<GeoPhoto[]>([]);
  const [storageUsedMb, setStorageUsedMb] = useState<number>(0);

  useEffect(() => {
    async function loadStats() {
      try {
        const photos = await db.photos.orderBy('timestamp').reverse().toArray();
        setTotalPhotosCount(photos.length);
        setRecentPhotos(photos.slice(0, 6));

        // Count today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayMs = todayStart.getTime();

        const countToday = photos.filter(p => p.timestamp >= todayMs).length;
        setTodayCount(countToday);

        // Estimate storage
        let totalBytes = 0;
        photos.forEach(p => {
          totalBytes += (p.stampedBlob?.size || 0) + (p.originalBlob?.size || 0);
        });
        setStorageUsedMb(Number((totalBytes / (1024 * 1024)).toFixed(1)));
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      }
    }

    loadStats();
  }, []);

  const accuracy = location ? getAccuracyLevel(location.accuracy) : null;

  return (
    <div className="pb-24 pt-4 px-4 max-w-4xl mx-auto space-y-6">

      {/* Hero Quick Camera Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 p-6 text-white shadow-2xl border border-blue-500/30">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-xs font-bold text-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Offline Geo Tag Engine Ready</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              D-Cam
            </h2>
            <p className="text-sm text-blue-100/90 max-w-md">
              Capture photos stamped with GPS coordinates, school branding, department details & location metadata.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('camera')}
            className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white text-blue-900 hover:bg-blue-50 font-extrabold text-base flex items-center justify-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all shrink-0"
          >
            <Camera className="w-6 h-6 text-blue-600" />
            <span>Open Camera</span>
          </button>
        </div>
      </div>

      {/* Active Event Banner */}
      <div className="bg-slate-800/80 dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-700/60 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Event</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCreateEventModal}
              className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-semibold text-xs border border-blue-500/30 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Event</span>
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-0.5"
            >
              <span>Change</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {activeEvent ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <h3 className="text-lg font-bold text-white leading-snug">{activeEvent.name}</h3>
              <p className="text-xs text-slate-300 font-medium">{activeEvent.schoolName}</p>
              {activeEvent.department && (
                <p className="text-xs text-slate-400 mt-1">Department: <span className="text-slate-200">{activeEvent.department}</span></p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="px-2.5 py-1 rounded-md bg-slate-700/80 border border-slate-600">
                Prefix: <strong className="text-blue-400 font-mono">{activeEvent.photoPrefix || 'EVT'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-700/80 border border-slate-600">
                Next Seq: <strong className="text-emerald-400 font-mono">#{String(activeEvent.currentSeqNumber || 1).padStart(3, '0')}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-700/80 border border-slate-600">
                Style: <strong className="text-purple-400 capitalize">{activeEvent.stampStyle.replace('_', ' ')}</strong>
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-3">
            <p className="text-sm text-slate-400">No event selected. You can create or pick one.</p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        
        <div className="bg-slate-800/60 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold">Today's Photos</span>
          </div>
          <p className="text-2xl font-extrabold text-white">{todayCount}</p>
        </div>

        <div className="bg-slate-800/60 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Images className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold">Total Stamped</span>
          </div>
          <p className="text-2xl font-extrabold text-white">{totalPhotosCount}</p>
        </div>

        <div className="bg-slate-800/60 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <HardDrive className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold">Local Storage</span>
          </div>
          <p className="text-2xl font-extrabold text-white">{storageUsedMb} <span className="text-xs font-normal text-slate-400">MB</span></p>
        </div>

        <div className="bg-slate-800/60 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold">Events Count</span>
          </div>
          <p className="text-2xl font-extrabold text-white">{events.length}</p>
        </div>

      </div>

      {/* GPS Live Status Card */}
      <div className="bg-slate-800/80 dark:bg-slate-900/80 rounded-2xl p-5 border border-slate-700/60 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <MapPin className="w-5 h-5 text-emerald-400" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <h3 className="text-sm font-bold text-white">Live GPS Satellite Feed</h3>
          </div>

          {accuracy && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold border" style={{ color: accuracy.color, borderColor: `${accuracy.color}40`, backgroundColor: `${accuracy.color}15` }}>
              {accuracy.label}
            </span>
          )}
        </div>

        {isGpsSearching ? (
          <p className="text-xs text-amber-400 animate-pulse">Acquiring satellite signal...</p>
        ) : gpsError ? (
          <p className="text-xs text-amber-400">{gpsError}</p>
        ) : location ? (
          <div className="space-y-2">
            <p className="text-base font-mono font-bold text-sky-400">
              {formatCoordinates(location.latitude, location.longitude)}
            </p>
            {location.address?.formattedAddress ? (
              <p className="text-xs text-slate-300 line-clamp-2">
                {location.address.formattedAddress}
              </p>
            ) : (
              <p className="text-xs text-slate-400">Reverse geocoding (Offline mode active)</p>
            )}
          </div>
        ) : null}
      </div>

      {/* Quick Navigation Modules */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setActiveTab('gallery')}
          className="p-4 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 flex flex-col items-center gap-2 text-slate-200 hover:text-white transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Images className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold">Photo Gallery</span>
        </button>

        <button
          onClick={() => setActiveTab('map')}
          className="p-4 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 flex flex-col items-center gap-2 text-slate-200 hover:text-white transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Map className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold">GIS Map View</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className="p-4 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 flex flex-col items-center gap-2 text-slate-200 hover:text-white transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold">Export Reports</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className="p-4 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 flex flex-col items-center gap-2 text-slate-200 hover:text-white transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Compass className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold">Settings</span>
        </button>
      </div>

      {/* Recent Photos Grid */}
      {recentPhotos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Recent Stamped Photos</h3>
            <button
              onClick={() => setActiveTab('gallery')}
              className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>View All ({totalPhotosCount})</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recentPhotos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => onOpenPhotoDetail(photo)}
                className="group relative aspect-video rounded-xl overflow-hidden bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <img
                  src={photo.stampedDataUrl || (photo.stampedBlob ? URL.createObjectURL(photo.stampedBlob) : '')}
                  alt={photo.photoNumber}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent p-2 flex flex-col justify-end">
                  <span className="text-[10px] font-mono font-bold text-amber-300">{photo.photoNumber}</span>
                  <span className="text-[10px] text-slate-300 truncate">{photo.eventName || photo.schoolName}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
