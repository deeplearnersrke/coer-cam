import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap, ZapOff, MapPin, Compass, AlertTriangle, Images, Calendar, Layers, Shield } from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { useGps } from '../../hooks/useGps';
import { useEventContext } from '../../contexts/EventContext';
import { generateStampedImage } from '../../services/stampEngine';
import { getNextPhotoNumber, db } from '../../services/db';
import { GeoPhoto, StampStyle } from '../../types';
import { StampPreviewModal } from './StampPreviewModal';
import { formatCoordinates, getAccuracyLevel } from '../../services/gps';

interface CameraViewProps {
  setActiveTab: (tab: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
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

  const { activeEvent, settings, refreshSettings } = useEventContext();
  const { location, error: gpsError, isSearching: isGpsSearching, heading } = useGps(settings.gpsHighAccuracy);

  const [stampStyle, setStampStyle] = useState<StampStyle>(
    activeEvent?.stampStyle || settings.defaultStampStyle || 'gps_classic'
  );

  const [previewData, setPreviewData] = useState<{
    originalDataUrl: string;
    stampedDataUrl: string;
    stampedBlob: Blob;
    originalBlob: Blob;
    photoNumber: string;
    locationData: GeoPhoto['location'];
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeStr(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update default stamp style if active event changes
  useEffect(() => {
    if (activeEvent?.stampStyle) {
      setStampStyle(activeEvent.stampStyle);
    }
  }, [activeEvent]);

  // Handle Capture Action
  const handleCapture = async () => {
    if (!isStreaming || isProcessing) return;

    setIsProcessing(true);

    try {
      // 1. Capture camera frame
      const frameDataUrl = captureFrame();
      if (!frameDataUrl) {
        throw new Error('Failed to capture frame from video camera');
      }

      // 2. Fallback GPS location if signal searching
      const currentLoc: GeoPhoto['location'] = location || {
        latitude: 0,
        longitude: 0,
        accuracy: 999,
        timestamp: Date.now(),
      };

      // 3. Obtain next photo sequence number
      let pNum = 'GEO-001';
      if (activeEvent) {
        const { photoNumber } = await getNextPhotoNumber(activeEvent);
        pNum = photoNumber;
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

      // Convert original frame dataURL to Blob
      const originalBlob = await (await fetch(frameDataUrl)).blob();

      setPreviewData({
        originalDataUrl: frameDataUrl,
        stampedDataUrl: stamped.dataUrl,
        stampedBlob: stamped.blob,
        originalBlob: originalBlob,
        photoNumber: pNum,
        locationData: currentLoc,
      });
    } catch (err: any) {
      console.error('Capture error:', err);
      showToast('Error capturing photo: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Save Photo to IndexedDB
  const handleSavePhoto = async (remarks: string) => {
    if (!previewData) return;
    setIsSaving(true);

    try {
      const newPhoto: GeoPhoto = {
        id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        eventId: activeEvent?.id,
        eventName: activeEvent?.name,
        schoolName: activeEvent?.schoolName || settings.schoolName,
        department: activeEvent?.department,
        organizer: activeEvent?.organizer,
        locationName: activeEvent?.locationName,
        remarks: remarks,
        originalBlob: previewData.originalBlob,
        stampedBlob: previewData.stampedBlob,
        stampedDataUrl: previewData.stampedDataUrl,
        originalDataUrl: previewData.originalDataUrl,
        photoNumber: previewData.photoNumber,
        location: previewData.locationData,
        timestamp: Date.now(),
        stampStyle: stampStyle,
        metadata: {
          width: 1920,
          height: 1080,
          fileSize: previewData.stampedBlob.size,
          cameraFacing: facingMode,
          compassDirection: heading ? `${heading}°` : undefined,
        },
      };

      await db.photos.put(newPhoto);
      showToast(`Saved photo ${previewData.photoNumber} successfully!`, 'success');
      setPreviewData(null);
    } catch (err: any) {
      console.error('Failed to save photo:', err);
      showToast('Failed to save photo to local database.', 'error');
    } finally {
      setIsSaving(false);
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

      {/* Top Camera Status Bar */}
      <div className="relative z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between text-white text-xs">
        
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

      {/* Camera Errors or Loading Banner */}
      {cameraError && (
        <div className="relative z-20 mx-4 my-auto p-4 rounded-2xl bg-slate-900/90 border border-red-500/50 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm font-bold text-white">Camera Access Notice</p>
          <p className="text-xs text-slate-300">{cameraError}</p>
        </div>
      )}

      {/* Floating Style Picker (Top Center overlay) */}
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

      {/* Bottom Controls Bar */}
      <div className="relative z-20 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between">
        
        {/* Gallery Quick Thumbnail / Button */}
        <button
          onClick={() => setActiveTab('gallery')}
          className="w-12 h-12 rounded-2xl bg-slate-900/80 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-all active:scale-95"
          title="Open Gallery"
        >
          <Images className="w-6 h-6 text-blue-400" />
        </button>

        {/* Main Shutter Button */}
        <button
          onClick={handleCapture}
          disabled={!isStreaming || isProcessing}
          className="relative group w-20 h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center shadow-2xl active:scale-90 transition-transform disabled:opacity-50"
        >
          <div className="w-16 h-16 rounded-full bg-white group-hover:scale-95 transition-transform flex items-center justify-center shadow-inner">
            {isProcessing && <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />}
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

      {/* Stamp Preview Modal after Capture */}
      {previewData && (
        <StampPreviewModal
          originalDataUrl={previewData.originalDataUrl}
          stampedDataUrl={previewData.stampedDataUrl}
          photoNumber={previewData.photoNumber}
          location={previewData.locationData}
          event={activeEvent}
          stampStyle={stampStyle}
          onSave={handleSavePhoto}
          onRetake={() => setPreviewData(null)}
          isSaving={isSaving}
        />
      )}

    </div>
  );
};
