import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap, ZapOff, MapPin, Compass, AlertTriangle, Images, CheckCircle2 } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { useGps } from '../../hooks/useGps';
import { useEventContext } from '../../contexts/EventContext';
import { generateStampedImage } from '../../services/stampEngine';
import { getNextPhotoNumber, db } from '../../services/db';
import { GeoPhoto, StampStyle } from '../../types';
import { formatCoordinates, getAccuracyLevel, reverseGeocode } from '../../services/gps';

interface CameraViewProps {
  setActiveTab: (tab: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
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

export const CameraView: React.FC<CameraViewProps> = ({ setActiveTab, showToast }) => {
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
  const { location, isSearching: isGpsSearching, heading } = useGps(settings.gpsHighAccuracy);

  const [stampStyle, setStampStyle] = useState<StampStyle>(
    activeEvent?.stampStyle || settings.defaultStampStyle || 'gps_classic'
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [lastCapturedPhotoUrl, setLastCapturedPhotoUrl] = useState<string | null>(null);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeStr(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync default stamp style if active event changes
  useEffect(() => {
    if (activeEvent?.stampStyle) {
      setStampStyle(activeEvent.stampStyle);
    }
  }, [activeEvent]);

  // Next photo number preview
  const nextSeq = activeEvent?.currentSeqNumber || 1;
  const photoNumPreview = `${activeEvent?.photoPrefix || 'EVT'}-${String(nextSeq).padStart(3, '0')}`;
  const schoolNameText = activeEvent?.schoolName || settings.schoolName || 'School / College Event';
  const eventNameText = activeEvent?.name || '';
  const coordsFormatted = location
    ? formatCoordinates(location.latitude, location.longitude)
    : 'GPS Searching...';

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

      // 2. Prepare GPS location & ensure reverse geocoded address is fetched
      let currentLoc: GeoPhoto['location'] = location ? { ...location } : {
        latitude: 0,
        longitude: 0,
        accuracy: 999,
        timestamp: Date.now(),
      };

      if (!currentLoc.address && currentLoc.latitude !== 0 && currentLoc.longitude !== 0) {
        try {
          const fetchedAddr = await reverseGeocode(currentLoc.latitude, currentLoc.longitude);
          if (fetchedAddr) {
            currentLoc.address = fetchedAddr;
          }
        } catch (e) {
          // ignore network failure
        }
      }

      // 3. Obtain next photo sequence number & update active event in DB
      let pNum = 'GEO-001';
      if (activeEvent) {
        const { photoNumber, updatedEvent } = await getNextPhotoNumber(activeEvent);
        pNum = photoNumber;
        setActiveEvent(updatedEvent);
      }

      // 4. Run Canvas Stamp Engine with non-overlapping dynamic formatting
      const stamped = await generateStampedImage({
        imageSrc: frameDataUrl,
        event: activeEvent || undefined,
        photoNumber: pNum,
        location: currentLoc,
        timestamp: Date.now(),
        stampStyle: stampStyle,
        settings: settings,
      });

      // Synchronous robust blob conversion
      const originalBlob = dataURLtoBlob(frameDataUrl);

      // 5. Directly Save Photo to IndexedDB without any prompt modal
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
          compassDirection: heading ? `${heading}°` : undefined,
        },
      };

      await db.photos.put(newPhoto);
      setLastCapturedPhotoUrl(stamped.dataUrl);
      showToast(`Photo ${pNum} captured & saved!`, 'success');

    } catch (err: any) {
      console.error('Capture error:', err);
      showToast('Error capturing photo: ' + (err?.message || 'Unknown camera error'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const accuracy = location ? getAccuracyLevel(location.accuracy) : null;

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-black overflow-hidden flex flex-col justify-between">
      
      {/* Video Viewport */}
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

      {/* Top Camera Status Bar */}
      <div className="relative z-20 p-4 bg-gradient-to-b from-black/85 via-black/50 to-transparent flex items-center justify-between text-white text-xs">
        
        {/* GPS Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/80 backdrop-blur-md">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            {isGpsSearching ? (
              <span className="text-amber-300 font-semibold">GPS Searching...</span>
            ) : location ? (
              <span className="font-mono font-bold text-slate-100">
                {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
              </span>
            ) : (
              <span className="text-amber-400">GPS Unavailable</span>
            )}
          </div>

          {accuracy && (
            <span
              className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-bold border"
              style={{ color: accuracy.color, borderColor: `${accuracy.color}40`, backgroundColor: `${accuracy.color}20` }}
            >
              {accuracy.label}
            </span>
          )}
        </div>

        {/* Heading & Live Clock */}
        <div className="flex items-center gap-3 font-mono font-bold">
          {heading !== null && (
            <div className="flex items-center gap-1 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-700/80">
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>{heading}°</span>
            </div>
          )}
          <span className="bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700/80 text-amber-300">
            {currentTimeStr || '00:00:00'}
          </span>
        </div>
      </div>

      {/* Camera Errors Notice */}
      {cameraError && (
        <div className="relative z-20 mx-4 my-auto p-4 rounded-2xl bg-slate-900/90 border border-red-500/50 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm font-bold text-white">Camera Access Notice</p>
          <p className="text-xs text-slate-300">{cameraError}</p>
        </div>
      )}

      {/* Floating Stamp Style Selector Pills */}
      <div className="relative z-20 px-4 flex justify-center">
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-slate-900/80 border border-slate-800 backdrop-blur-md overflow-x-auto max-w-full">
          {[
            { id: 'gps_classic', label: 'Classic' },
            { id: 'gov_inspection', label: 'Gov Record' },
            { id: 'modern_glass', label: 'Modern' },
            { id: 'minimal', label: 'Minimal' },
            { id: 'school_branding', label: 'Branded' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStampStyle(st.id as StampStyle)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
                stampStyle === st.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* LIVE CAMERA VIEWFINDER STAMP OVERLAY (Real-time Preview) */}
      {/* ======================================================== */}
      <div className="relative z-10 my-auto px-4 pointer-events-none transition-all w-full max-w-xl mx-auto">
        {stampStyle === 'gps_classic' && (
          <div className="w-full rounded-2xl overflow-hidden bg-slate-950/85 border-t-2 border-blue-500 p-3 shadow-2xl backdrop-blur-md text-white text-xs space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
              <div className="space-y-1 shrink-0">
                <div className="text-sky-400 font-mono font-bold text-xs flex items-center gap-1">
                  <span>📍 {coordsFormatted}</span>
                  {location?.accuracy && <span className="text-slate-400 text-[10px]">±{Math.round(location.accuracy)}m</span>}
                </div>
                <div className="text-slate-300 text-[11px] font-medium flex items-center gap-2">
                  <span>📅 {new Date().toLocaleDateString()}</span>
                  <span>⏰ {currentTimeStr || '00:00:00'}</span>
                </div>
                <div className="text-amber-400 font-mono font-bold text-[11px]">
                  ID: {photoNumPreview}
                </div>
              </div>

              <div className="space-y-0.5 text-left sm:text-right border-t sm:border-t-0 border-slate-800/80 pt-1.5 sm:pt-0">
                <h4 className="font-extrabold text-xs text-white break-words">{schoolNameText}</h4>
                {eventNameText && <p className="text-blue-300 font-bold text-[11px] break-words">Event: {eventNameText}</p>}
                {liveAddressText && <p className="text-slate-300 text-[10px] break-words">📍 {liveAddressText}</p>}
              </div>
            </div>
          </div>
        )}

        {stampStyle === 'gov_inspection' && (
          <div className="w-full rounded-2xl bg-slate-950/90 border-2 border-amber-500 p-3.5 shadow-2xl backdrop-blur-md text-white text-xs space-y-1.5">
            <div className="border-b border-amber-500/40 pb-1.5">
              <span className="text-[10px] font-mono font-bold text-amber-300 block">OFFICIAL INSPECTION RECORD</span>
              <h4 className="font-extrabold text-xs text-white break-words">{schoolNameText}</h4>
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="text-amber-400 font-bold">REF ID: {photoNumPreview}</div>
              {eventNameText && <div className="text-blue-300 break-words">EVENT: {eventNameText}</div>}
              <div className="text-sky-300">LAT/LON: {coordsFormatted}</div>
              {liveAddressText && <div className="text-slate-200 text-[10px] break-words">ADDR: {liveAddressText}</div>}
              <div className="text-slate-300">DATE/TIME: {new Date().toLocaleDateString()} {currentTimeStr}</div>
            </div>
          </div>
        )}

        {stampStyle === 'modern_glass' && (
          <div className="w-full rounded-2xl bg-slate-900/80 border border-white/20 p-3.5 shadow-2xl backdrop-blur-md text-white text-xs space-y-1.5">
            <h4 className="font-extrabold text-xs text-white break-words">{schoolNameText}</h4>
            {eventNameText && <p className="text-blue-400 font-semibold text-[11px] break-words">{eventNameText}</p>}
            <p className="text-sky-300 font-mono text-[11px]">📍 {coordsFormatted}</p>
            {liveAddressText && <p className="text-slate-300 text-[10px] break-words">📍 {liveAddressText}</p>}
            <p className="text-slate-400 text-[10px]">🕒 {currentTimeStr} • #{photoNumPreview}</p>
          </div>
        )}

        {stampStyle === 'minimal' && (
          <div className="w-full rounded-xl bg-black/85 border border-slate-800 p-2.5 shadow-2xl backdrop-blur-md text-white text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="break-words font-medium">
              {schoolNameText} {eventNameText ? `| ${eventNameText}` : ''} {liveAddressText ? `| ${liveAddressText}` : ''} | #{photoNumPreview}
            </div>
            <div className="text-sky-400 font-mono font-bold shrink-0">📍 {coordsFormatted}</div>
          </div>
        )}

        {stampStyle === 'school_branding' && (
          <div className="w-full rounded-2xl overflow-hidden bg-slate-950/90 border border-blue-600/50 shadow-2xl backdrop-blur-md text-white text-xs">
            <div className="bg-blue-900/90 px-3.5 py-2 border-b border-blue-500">
              <h4 className="font-extrabold text-xs text-white break-words">{schoolNameText}</h4>
              {eventNameText && <p className="text-blue-200 text-[10px] break-words">Event: {eventNameText}</p>}
            </div>
            <div className="p-3 space-y-1 font-mono text-[11px]">
              <p className="text-sky-400 font-bold">📍 {coordsFormatted}</p>
              {liveAddressText && <p className="text-slate-300 text-[10px] break-words">📍 {liveAddressText}</p>}
              <p className="text-amber-400 font-bold">ID: {photoNumPreview} • {currentTimeStr}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="relative z-20 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between">
        
        {/* Gallery Quick Thumbnail / Button */}
        <button
          onClick={() => setActiveTab('gallery')}
          className="relative w-14 h-14 rounded-2xl bg-slate-900/80 border border-slate-700 overflow-hidden flex items-center justify-center text-slate-300 hover:text-white transition-all active:scale-95 shadow-lg group"
          title="Open Gallery"
        >
          {lastCapturedPhotoUrl ? (
            <>
              <img src={lastCapturedPhotoUrl} alt="Recent photo" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-blue-600/20 group-hover:bg-transparent transition-colors" />
              <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5">
                <CheckCircle2 className="w-3 h-3" />
              </div>
            </>
          ) : (
            <Images className="w-6 h-6 text-blue-400" />
          )}
        </button>

        {/* Main Shutter Button - Click directly saves photo! */}
        <button
          onClick={handleCapture}
          disabled={!isStreaming || isProcessing}
          className="relative group w-20 h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center shadow-2xl active:scale-90 transition-transform disabled:opacity-50"
        >
          <div className="w-16 h-16 rounded-full bg-white group-hover:scale-95 transition-transform flex items-center justify-center shadow-inner">
            {isProcessing ? (
              <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 opacity-20 group-hover:opacity-40 transition-opacity" />
            )}
          </div>
        </button>

        {/* Camera Controls (Switch camera / Torch) */}
        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all ${
                torchOn ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900/80 text-slate-300 border-slate-700'
              }`}
              title="Toggle Flash/Torch"
            >
              {torchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}

          <button
            onClick={toggleCamera}
            className="w-12 h-12 rounded-2xl bg-slate-900/80 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-all active:scale-95"
            title="Switch Front/Rear Camera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

      </div>

    </div>
  );
};
