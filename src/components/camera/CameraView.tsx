import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap, ZapOff, MapPin, AlertTriangle, Images, X, Wifi, WifiOff, Battery } from 'lucide-react';
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

  const [isProcessing, setIsProcessing] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');
  const [lastCapturedPhotoUrl, setLastCapturedPhotoUrl] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

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

  // Handle Immediate Capture & Direct Auto-Save (No Prompt Modal)
  const handleCapture = async () => {
    if (!isStreaming || isProcessing) return;

    setIsProcessing(true);
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 200);

    try {
      // 1. Capture camera frame
      const frameDataUrl = captureFrame();
      if (!frameDataUrl) {
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

      // 4. Run Canvas Stamp Engine
      const stamped = await generateStampedImage({
        imageSrc: frameDataUrl,
        event: activeEvent || undefined,
        photoNumber: pNum,
        location: currentLoc,
        timestamp: Date.now(),
        stampStyle: stampStyle,
        settings: settings,
      });

      const originalBlob = dataURLtoBlob(frameDataUrl);

      // 5. Directly Save Photo
      const newPhoto: GeoPhoto = {
        id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        eventId: activeEvent?.id,
        eventName: activeEvent?.name,
        schoolName: activeEvent?.schoolName || settings.schoolName,
        department: activeEvent?.department,
        organizer: activeEvent?.organizer,
        locationName: activeEvent?.locationName,
        remarks: activeEvent?.remarks || '',
        originalBlob: originalBlob,
        stampedBlob: stamped.blob,
        stampedDataUrl: stamped.dataUrl,
        originalDataUrl: frameDataUrl,
        photoNumber: pNum,
        location: currentLoc,
        timestamp: Date.now(),
        stampStyle: stampStyle,
        metadata: {
          width: 1920,
          height: 1080,
          fileSize: stamped.blob.size,
          cameraFacing: facingMode,
        },
      };

      await db.photos.put(newPhoto);
      setLastCapturedPhotoUrl(stamped.dataUrl);
      showToast(`Record ${pNum} captured and saved`, 'success');

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

      {/* Visual Shutter Flash Effect */}
      {shutterFlash && (
        <div className="absolute inset-0 z-40 bg-white animate-ping opacity-80 pointer-events-none" />
      )}

      {/* Top Status & Exit Header */}
      <div className="relative z-20 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/60 to-transparent flex items-center justify-between text-white text-xs">
        
        {/* Exit Camera Button */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 hover:bg-white/20 text-white font-medium backdrop-blur-md transition-all active:scale-95"
          title="Exit Camera Mode"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">Close Camera</span>
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
        <div className="relative z-20 mx-4 my-auto p-4 rounded-xl bg-black/85 border border-red-500/50 text-center space-y-1 max-w-md mx-auto">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto" />
          <p className="text-sm font-semibold text-white">Camera Access Notice</p>
          <p className="text-xs text-slate-300">{cameraError}</p>
        </div>
      )}

      {/* ======================================================== */}
      {/* LIVE STAMP OVERLAY (Official Monochrome Document Format)   */}
      {/* ======================================================== */}
      <div className="relative z-10 my-auto px-4 pointer-events-none transition-all w-full max-w-xl mx-auto">
        <div className="w-full rounded-xl bg-black/75 border border-white/20 p-5 shadow-2xl backdrop-blur-md text-white font-sans text-xs space-y-3 text-left">
          
          {/* Header Title & Subtitle */}
          <div className="space-y-0.5">
            <h3 className="font-semibold text-sm text-white tracking-wide">{schoolNameText}</h3>
            {eventNameText && <p className="font-medium text-xs text-slate-200">{eventNameText}</p>}
          </div>

          {/* Divider Line */}
          <div className="h-px bg-white/20 w-full" />

          {/* Key-Value Inspection Grid (Left Aligned, No Emojis, Auto Hides Empty) */}
          <div className="space-y-1 font-mono text-[11px] leading-relaxed">
            {departmentText && (
              <div className="grid grid-cols-[100px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Department</span>
                <span>:</span>
                <span className="text-white font-normal">{departmentText}</span>
              </div>
            )}

            {organizerText && (
              <div className="grid grid-cols-[100px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Organizer</span>
                <span>:</span>
                <span className="text-white font-normal">{organizerText}</span>
              </div>
            )}

            {liveAddressText && (
              <div className="grid grid-cols-[100px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Location</span>
                <span>:</span>
                <span className="text-white font-normal break-words">{liveAddressText}</span>
              </div>
            )}

            {latFormatted && (
              <div className="grid grid-cols-[100px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Latitude</span>
                <span>:</span>
                <span className="text-white font-normal">{latFormatted}</span>
              </div>
            )}

            {lonFormatted && (
              <div className="grid grid-cols-[100px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Longitude</span>
                <span>:</span>
                <span className="text-white font-normal">{lonFormatted}</span>
              </div>
            )}

            {accFormatted && (
              <div className="grid grid-cols-[100px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Accuracy</span>
                <span>:</span>
                <span className="text-white font-normal">{accFormatted}</span>
              </div>
            )}

            {altFormatted && (
              <div className="grid grid-cols-[100px_10px_1fr] items-start">
                <span className="font-medium text-slate-300">Altitude</span>
                <span>:</span>
                <span className="text-white font-normal">{altFormatted}</span>
              </div>
            )}

            <div className="grid grid-cols-[100px_10px_1fr] items-start">
              <span className="font-medium text-slate-300">Date</span>
              <span>:</span>
              <span className="text-white font-normal">{currentDateStr}</span>
            </div>

            <div className="grid grid-cols-[100px_10px_1fr] items-start">
              <span className="font-medium text-slate-300">Time</span>
              <span>:</span>
              <span className="text-white font-normal">{currentTimeStr}</span>
            </div>

            <div className="grid grid-cols-[100px_10px_1fr] items-start">
              <span className="font-medium text-slate-300">Photo ID</span>
              <span>:</span>
              <span className="text-white font-semibold">{photoNumPreview}</span>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="relative z-20 p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-center justify-between">
        
        {/* Gallery Quick Shortcut */}
        <button
          onClick={() => setActiveTab('gallery')}
          className="relative w-14 h-14 rounded-xl bg-black/60 border border-white/20 overflow-hidden flex items-center justify-center text-slate-300 hover:text-white transition-all active:scale-95 shadow-lg group"
          title="Open Inspection Gallery"
        >
          {lastCapturedPhotoUrl ? (
            <img src={lastCapturedPhotoUrl} alt="Recent inspection" className="w-full h-full object-cover" />
          ) : (
            <Images className="w-6 h-6 text-slate-300" />
          )}
        </button>

        {/* Main Capture Button */}
        <button
          onClick={handleCapture}
          disabled={!isStreaming || isProcessing}
          className="relative group w-20 h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center shadow-2xl active:scale-90 transition-transform disabled:opacity-50"
          title="Capture Official Photo"
        >
          <div className="w-16 h-16 rounded-full bg-white group-hover:scale-95 transition-transform flex items-center justify-center shadow-inner">
            {isProcessing ? (
              <div className="w-6 h-6 border-3 border-slate-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-300 opacity-30 group-hover:opacity-60 transition-opacity" />
            )}
          </div>
        </button>

        {/* Camera Controls (Switch Camera & Flash) */}
        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all ${
                torchOn ? 'bg-white text-black border-white' : 'bg-black/60 text-white border-white/20'
              }`}
              title="Toggle Flash/Torch"
            >
              {torchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}

          <button
            onClick={toggleCamera}
            className="w-12 h-12 rounded-xl bg-black/60 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95"
            title="Switch Front/Rear Camera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

      </div>

    </div>
  );
};
