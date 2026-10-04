import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap, ZapOff, MapPin, AlertTriangle, Images, X, Wifi, WifiOff, Battery, Smartphone, Monitor } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { useGps } from '../../hooks/useGps';
import { useEventContext } from '../../contexts/EventContext';
import { generateStampedImage } from '../../services/stampEngine';
import { getNextPhotoNumber, db } from '../../services/db';
import { GeoPhoto, StampStyle } from '../../types';
import { formatCoordinates, reverseGeocode } from '../../services/gps';

interface CameraViewProps {
  setActiveTab: (tab: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isOnline?: boolean;
}

function dataURLtoBlob(dataurl: string): Blob {
  try {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    return new Blob([], { type: 'image/jpeg' });
  }
}

export const CameraView: React.FC<CameraViewProps> = ({ setActiveTab, showToast, isOnline = true }) => {
  const {
    videoRef,
    isStreaming,
    facingMode,
    hasTorch,
    torchOn,
    error: cameraError,
    toggleCamera,
    toggleTorch,
    captureFrame,
  } = useCamera();

  const { activeEvent, settings, setActiveEvent } = useEventContext();
  const { location, isSearching: isGpsSearching } = useGps(settings.gpsHighAccuracy);

  const [stampStyle] = useState<StampStyle>(
    activeEvent?.stampStyle || settings.defaultStampStyle || 'gps_classic'
  );

  // Orientation State: automatically detected & user-togglable
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => {
    if (typeof window !== 'undefined') {
      if (window.screen?.orientation?.type?.includes('landscape')) return 'landscape';
      return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    }
    return 'portrait';
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [lastCapturedPhotoUrl, setLastCapturedPhotoUrl] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  // Automatic Orientation Detection Listener
  useEffect(() => {
    const handleOrientationChange = () => {
      const isLandscape = window.screen?.orientation?.type
        ? window.screen.orientation.type.includes('landscape')
        : window.innerWidth > window.innerHeight;
      setOrientation(isLandscape ? 'landscape' : 'portrait');
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    }

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      }
    };
  }, []);

  // Live Clock
  useEffect(() => {
    const updateDateTime = () => {
      const d = new Date();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      setCurrentTimeStr(`${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`);

      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      setCurrentDateStr(`${day} ${months[d.getMonth()]} ${d.getFullYear()}`);
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Battery status API listener
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        const handleLevel = () => setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', handleLevel);
      }).catch(() => {});
    }
  }, []);

  // Next photo number preview
  const nextSeq = activeEvent?.currentSeqNumber || 1;
  const photoNumPreview = `${activeEvent?.photoPrefix || 'EVT'}-${String(nextSeq).padStart(3, '0')}`;
  const schoolNameText = activeEvent?.schoolName || settings.schoolName || 'INSTITUTION DOCUMENTATION';
  const eventNameText = activeEvent?.name || '';
  const departmentText = activeEvent?.department || '';
  const organizerText = activeEvent?.organizer || '';

  const hasCoords = location && (location.latitude !== 0 || location.longitude !== 0);
  const latFormatted = hasCoords ? `${Math.abs(location.latitude).toFixed(6)}° ${location.latitude >= 0 ? 'N' : 'S'}` : '';
  const lonFormatted = hasCoords ? `${Math.abs(location.longitude).toFixed(6)}° ${location.longitude >= 0 ? 'E' : 'W'}` : '';
  const accFormatted = location?.accuracy && location.accuracy < 900 ? `±${Math.round(location.accuracy)} m` : '';
  const altFormatted = location?.altitude ? `${Math.round(location.altitude)} m` : '';

  const liveAddressText = location?.address?.formattedAddress || [
    location?.address?.village,
    location?.address?.city,
    location?.address?.district,
    location?.address?.state,
    location?.address?.country,
  ].filter(Boolean).join(', ') || activeEvent?.locationName || '';

  // Manual orientation toggle
  const toggleOrientation = () => {
    setOrientation(prev => (prev === 'portrait' ? 'landscape' : 'portrait'));
  };

  // Handle Immediate Capture & Direct Auto-Save (Fixed Image Structure & Predefined Stamp Position)
  const handleCapture = async () => {
    if (!isStreaming || isProcessing) return;

    setIsProcessing(true);
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 200);

    try {
      // 1. Capture camera frame with target orientation and fixed frame structure
      const captured = captureFrame(orientation);
      if (!captured || !captured.dataUrl) {
        throw new Error('Camera frame not ready. Ensure camera permission is granted.');
      }

      // 2. Prepare GPS location & reverse geocode if needed
      let currentLoc: GeoPhoto['location'] = location ? { ...location } : {
        latitude: 0,
        longitude: 0,
        accuracy: 999,
        timestamp: Date.now(),
      };

      if (!currentLoc.address && currentLoc.latitude !== 0 && currentLoc.longitude !== 0 && isOnline) {
        try {
          const fetchedAddr = await reverseGeocode(currentLoc.latitude, currentLoc.longitude);
          if (fetchedAddr) {
            currentLoc.address = fetchedAddr;
          }
        } catch (e) {
          // ignore network failure
        }
      }

      // 3. Sequence photo number
      let pNum = 'EVT-001';
      if (activeEvent) {
        const { photoNumber, updatedEvent } = await getNextPhotoNumber(activeEvent);
        pNum = photoNumber;
        setActiveEvent(updatedEvent);
      }

      // 4. Run Canvas Stamp Engine with orientation
      const stamped = await generateStampedImage({
        imageSrc: captured.dataUrl,
        event: activeEvent || undefined,
        photoNumber: pNum,
        location: currentLoc,
        timestamp: Date.now(),
        stampStyle: stampStyle,
        settings: settings,
        orientation: captured.orientation,
      });

      const originalBlob = dataURLtoBlob(captured.dataUrl);

      // 5. Directly Save Photo with exact metadata and orientation
      const newPhoto: GeoPhoto = {
        id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        eventId: activeEvent?.id,
        eventName: activeEvent?.name,
        schoolName: activeEvent?.schoolName || settings.schoolName,
        department: activeEvent?.department,
        organizer: activeEvent?.organizer,
        locationName: activeEvent?.locationName,
        remarks: activeEvent?.remarks || '',
        orientation: captured.orientation,
        originalBlob: originalBlob,
        stampedBlob: stamped.blob,
        stampedDataUrl: stamped.dataUrl,
        originalDataUrl: captured.dataUrl,
        photoNumber: pNum,
        location: currentLoc,
        timestamp: Date.now(),
        stampStyle: stampStyle,
        metadata: {
          width: captured.width,
          height: captured.height,
          orientation: captured.orientation,
          fileSize: stamped.blob.size,
          cameraFacing: facingMode,
        },
      };

      await db.photos.put(newPhoto);
      setLastCapturedPhotoUrl(stamped.dataUrl);
      showToast(`Record ${pNum} (${captured.orientation.toUpperCase()}) captured and saved`, 'success');

    } catch (err: any) {
      console.error('Capture error:', err);
      showToast('Capture error: ' + (err?.message || 'Unknown camera error'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between overflow-hidden select-none w-screen h-screen">
      
      {/* Live Video Viewport */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
      />

      {/* Viewfinder Composition Guide Frame (Fixed structure visual indicator) */}
      <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center p-4 sm:p-8">
        <div
          className={`relative transition-all duration-300 border border-white/20 rounded-2xl ${
            orientation === 'portrait'
              ? 'aspect-[3/4] h-full max-h-[82vh] w-auto'
              : 'aspect-[16/9] w-full max-w-[92vw] h-auto'
          }`}
        >
          {/* Viewfinder Corner Brackets */}
          <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-white/60 rounded-tl" />
          <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-white/60 rounded-tr" />
          <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-white/60 rounded-bl" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-white/60 rounded-br" />
        </div>
      </div>

      {/* Visual Shutter Flash Effect */}
      {shutterFlash && (
        <div className="absolute inset-0 z-40 bg-white animate-ping opacity-80 pointer-events-none" />
      )}

      {/* Top Status & Controls Header */}
      <div className="relative z-30 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/60 to-transparent flex items-center justify-between text-white text-xs">
        
        {/* Exit Camera Button */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 hover:bg-white/20 text-white font-medium backdrop-blur-md transition-all active:scale-95"
          title="Exit Camera Mode"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">Close</span>
        </button>

        {/* GPS Status Indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-white/20 backdrop-blur-md text-[11px] font-mono">
          <MapPin className={`w-3.5 h-3.5 ${isGpsSearching ? 'text-amber-400 animate-pulse' : hasCoords ? 'text-emerald-400' : 'text-slate-400'}`} />
          {isGpsSearching ? (
            <span>GPS Searching...</span>
          ) : hasCoords ? (
            <span>GPS Connected {accFormatted && `(${accFormatted})`}</span>
          ) : (
            <span>GPS Offline</span>
          )}
        </div>

        {/* Orientation Toggle Button */}
        <button
          onClick={toggleOrientation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 hover:bg-white/20 text-white font-medium backdrop-blur-md transition-all active:scale-95 text-[11px]"
          title="Toggle Portrait / Landscape Mode"
        >
          {orientation === 'portrait' ? (
            <>
              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
              <span>Portrait</span>
            </>
          ) : (
            <>
              <Monitor className="w-3.5 h-3.5 text-emerald-400" />
              <span>Landscape</span>
            </>
          )}
        </button>

        {/* Status Indicators: Network, Battery, Clock */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-black/60 border border-white/20">
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Offline</span>
              </>
            )}
          </div>

          {batteryLevel !== null && (
            <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md bg-black/60 border border-white/20">
              <Battery className="w-3.5 h-3.5 text-slate-300" />
              <span>{batteryLevel}%</span>
            </div>
          )}

          <div className="px-2.5 py-1 rounded-md bg-black/60 border border-white/20 font-medium">
            {currentTimeStr}
          </div>
        </div>
      </div>

      {/* Camera Errors Notice */}
      {cameraError && (
        <div className="relative z-30 mx-4 my-auto p-4 rounded-xl bg-black/85 border border-red-500/50 text-center space-y-1 max-w-md mx-auto">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto" />
          <p className="text-sm font-semibold text-white">Camera Access Notice</p>
          <p className="text-xs text-slate-300">{cameraError}</p>
        </div>
      )}

      {/* ======================================================== */}
      {/* LIVE STAMP OVERLAY (Responsive Predefined Placement)     */}
      {/* Portrait -> Bottom full-width container                  */}
      {/* Landscape -> Bottom-Left designated inspection card      */}
      {/* ======================================================== */}
      <div
        className={`pointer-events-none transition-all duration-300 z-20 ${
          orientation === 'portrait'
            ? 'absolute bottom-28 left-3 right-3 sm:left-6 sm:right-6 max-w-lg mx-auto'
            : 'absolute bottom-24 left-4 sm:bottom-6 sm:left-6 max-w-sm sm:max-w-md w-[380px] sm:w-[440px]'
        }`}
      >
        <div className="w-full rounded-xl bg-black/75 border border-white/20 p-4 sm:p-5 shadow-2xl backdrop-blur-md text-white font-sans text-xs space-y-2.5 text-left">
          
          {/* Header Title & Subtitle */}
          <div className="space-y-0.5">
            <h3 className="font-semibold text-xs sm:text-sm text-white tracking-wide truncate">{schoolNameText}</h3>
            {eventNameText && <p className="font-medium text-[11px] sm:text-xs text-slate-200 truncate">{eventNameText}</p>}
          </div>

          {/* Divider Line */}
          <div className="h-px bg-white/20 w-full" />

          {/* Key-Value Inspection Grid (Left Aligned, No Emojis, Auto Hides Empty) */}
          <div className="space-y-1 font-mono text-[10px] sm:text-[11px] leading-relaxed">
            {departmentText && (
              <div className="grid grid-cols-[85px_10px_1fr] sm:grid-cols-[95px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Department</span>
                <span>:</span>
                <span className="text-white font-normal truncate">{departmentText}</span>
              </div>
            )}

            {organizerText && (
              <div className="grid grid-cols-[85px_10px_1fr] sm:grid-cols-[95px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Organizer</span>
                <span>:</span>
                <span className="text-white font-normal truncate">{organizerText}</span>
              </div>
            )}

            {liveAddressText && (
              <div className="grid grid-cols-[85px_10px_1fr] sm:grid-cols-[95px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Location</span>
                <span>:</span>
                <span className="text-white font-normal break-words line-clamp-2">{liveAddressText}</span>
              </div>
            )}

            {latFormatted && (
              <div className="grid grid-cols-[85px_10px_1fr] sm:grid-cols-[95px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Latitude</span>
                <span>:</span>
                <span className="text-white font-normal">{latFormatted}</span>
              </div>
            )}

            {lonFormatted && (
              <div className="grid grid-cols-[85px_10px_1fr] sm:grid-cols-[95px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Longitude</span>
                <span>:</span>
                <span className="text-white font-normal">{lonFormatted}</span>
              </div>
            )}

            {accFormatted && (
              <div className="grid grid-cols-[85px_10px_1fr] sm:grid-cols-[95px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Accuracy</span>
                <span>:</span>
                <span className="text-white font-normal">{accFormatted}</span>
              </div>
            )}

            {altFormatted && (
              <div className="grid grid-cols-[85px_10px_1fr] sm:grid-cols-[95px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Altitude</span>
                <span>:</span>
                <span className="text-white font-normal">{altFormatted}</span>
              </div>
            )}

            <div className="grid grid-cols-[85px_10px_1fr] sm:grid-cols-[95px_10px_1fr] items-start">
              <span className="font-medium text-slate-300">Date</span>
              <span>:</span>
              <span className="text-white font-normal">{currentDateStr}</span>
            </div>

            <div className="grid grid-cols-[85px_10px_1fr] sm:grid-cols-[95px_10px_1fr] items-start">
              <span className="font-medium text-slate-300">Time</span>
              <span>:</span>
              <span className="text-white font-normal">{currentTimeStr}</span>
            </div>

            <div className="grid grid-cols-[85px_10px_1fr] sm:grid-cols-[95px_10px_1fr] items-start">
              <span className="font-medium text-slate-300">Photo ID</span>
              <span>:</span>
              <span className="text-white font-semibold">{photoNumPreview}</span>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="relative z-30 p-4 sm:p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-center justify-between">
        
        {/* Gallery Quick Shortcut */}
        <button
          onClick={() => setActiveTab('gallery')}
          className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-black/60 border border-white/20 overflow-hidden flex items-center justify-center text-slate-300 hover:text-white transition-all active:scale-95 shadow-lg group"
          title="Open Inspection Gallery"
        >
          {lastCapturedPhotoUrl ? (
            <img src={lastCapturedPhotoUrl} alt="Recent inspection" className="w-full h-full object-cover" />
          ) : (
            <Images className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300" />
          )}
        </button>

        {/* Main Capture Button */}
        <button
          onClick={handleCapture}
          disabled={!isStreaming || isProcessing}
          className="relative group w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center shadow-2xl active:scale-90 transition-transform disabled:opacity-50"
          title={`Capture ${orientation.toUpperCase()} Photo`}
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white group-hover:scale-95 transition-transform flex items-center justify-center shadow-inner">
            {isProcessing ? (
              <div className="w-6 h-6 border-3 border-slate-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-300 opacity-30 group-hover:opacity-60 transition-opacity" />
            )}
          </div>
        </button>

        {/* Camera Controls (Switch Camera & Flash) */}
        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center transition-all ${
                torchOn ? 'bg-white text-black border-white' : 'bg-black/60 text-white border-white/20'
              }`}
              title="Toggle Flash/Torch"
            >
              {torchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}

          <button
            onClick={toggleCamera}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-black/60 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95"
            title="Switch Front/Rear Camera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

      </div>

    </div>
  );
};
