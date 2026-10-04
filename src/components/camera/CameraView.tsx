import React, { useState, useEffect } from 'react';

import {
  RefreshCw,
  Zap,
  ZapOff,
  MapPin,
  AlertTriangle,
  Images,
  X,
  Wifi,
  WifiOff,
  Grid3X3,
  Info,
  Navigation,
  CheckCircle2,
} from 'lucide-react';

import { useCamera } from '../../hooks/useCamera';
import { useGps } from '../../hooks/useGps';
import { useEventContext } from '../../contexts/EventContext';
import { generateStampedImage } from '../../services/stampEngine';
import { getNextPhotoNumber, db } from '../../services/db';
import { GeoPhoto, StampStyle } from '../../types';
import { reverseGeocode } from '../../services/gps';

interface CameraViewProps {
  setActiveTab: (tab: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isOnline?: boolean;
}

/**
 * Normalize camera pixels to the device orientation before stamping.
 */
async function normalizeCapturedFrameOrientation(
  dataUrl: string,
  targetLandscape: boolean,
): Promise<string> {
  if (typeof window === 'undefined') return dataUrl;

  const img = new Image();

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () =>
      reject(new Error('Unable to read captured camera frame.'));
    img.src = dataUrl;
  });

  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;

  if (!sourceWidth || !sourceHeight) {
    return dataUrl;
  }

  const sourceLandscape = sourceWidth > sourceHeight;

  if (sourceLandscape === targetLandscape) {
    return dataUrl;
  }

  const canvas = document.createElement('canvas');

  canvas.width = sourceHeight;
  canvas.height = sourceWidth;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return dataUrl;
  }

  ctx.save();

  if (targetLandscape) {
    // Phone is landscape but camera returned portrait pixels.
    ctx.translate(0, sourceWidth);
    ctx.rotate(-Math.PI / 2);
  } else {
    // Phone is portrait but camera returned landscape pixels.
    ctx.translate(sourceHeight, 0);
    ctx.rotate(Math.PI / 2);
  }

  ctx.drawImage(
    img,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );

  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.98);
}

function dataURLtoBlob(dataurl: string): Blob {
  try {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?)\;/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const bstr = atob(arr[1]);
    let n = bstr.length;

    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new Blob([u8arr], {
      type: mime,
    });
  } catch (e) {
    return new Blob([], {
      type: 'image/jpeg',
    });
  }
}

export const CameraView: React.FC<CameraViewProps> = ({
  setActiveTab,
  showToast,
  isOnline = true,
}) => {
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

  const {
    activeEvent,
    settings,
    setActiveEvent,
  } = useEventContext();

  const {
    location,
    isSearching: isGpsSearching,
  } = useGps(settings.gpsHighAccuracy);

  const [stampStyle] = useState<StampStyle>(
    activeEvent?.stampStyle ||
      settings.defaultStampStyle ||
      'gps_classic',
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);

  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentDateStr, setCurrentDateStr] = useState('');

  const [lastCapturedPhotoUrl, setLastCapturedPhotoUrl] =
    useState<string | null>(null);

  const [showGrid, setShowGrid] = useState(false);
  const [showStamp, setShowStamp] = useState(true);
  const [isLevelled, setIsLevelled] = useState(true);

  const [captureSuccess, setCaptureSuccess] = useState(false);
  const [captureMessage, setCaptureMessage] = useState('');

  // Track device orientation for the live camera UI.
  // The actual saved-photo stamp orientation is determined by stampEngine.ts
  // from the captured image dimensions.
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(orientation: landscape)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(
      '(orientation: landscape)',
    );

    const handleOrientationChange = () => {
      setIsLandscape(mediaQuery.matches);
    };

    handleOrientationChange();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener(
        'change',
        handleOrientationChange,
      );

      return () => {
        mediaQuery.removeEventListener(
          'change',
          handleOrientationChange,
        );
      };
    }

    mediaQuery.addListener(handleOrientationChange);

    return () => {
      mediaQuery.removeListener(handleOrientationChange);
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * LIVE CLOCK
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const updateDateTime = () => {
      const d = new Date();

      let hours = d.getHours();

      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');

      const ampm = hours >= 12 ? 'PM' : 'AM';

      hours = hours % 12 || 12;

      setCurrentTimeStr(
        `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`,
      );

      const day = String(d.getDate()).padStart(2, '0');

      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];

      setCurrentDateStr(
        `${day} ${months[d.getMonth()]} ${d.getFullYear()}`,
      );
    };

    updateDateTime();

    const timer = setInterval(updateDateTime, 1000);

    return () => clearInterval(timer);
  }, []);

  /*
   * ---------------------------------------------------------
   * PHOTO NUMBER
   * ---------------------------------------------------------
   */

  const nextSeq = activeEvent?.currentSeqNumber || 1;

  const photoNumPreview = `${
    activeEvent?.photoPrefix || 'EVT'
  }-${String(nextSeq).padStart(3, '0')}`;

  /*
   * ---------------------------------------------------------
   * EVENT INFORMATION
   * ---------------------------------------------------------
   */

  const schoolNameText =
    activeEvent?.schoolName ||
    settings.schoolName ||
    'INSTITUTION DOCUMENTATION';

  const eventNameText = activeEvent?.name || '';
  const departmentText = activeEvent?.department || '';
  const organizerText = activeEvent?.organizer || '';

  /*
   * ---------------------------------------------------------
   * GPS INFORMATION
   * ---------------------------------------------------------
   */

  const hasCoords =
    location &&
    (location.latitude !== 0 ||
      location.longitude !== 0);

  const latFormatted = hasCoords
    ? `${Math.abs(location.latitude).toFixed(6)}° ${
        location.latitude >= 0 ? 'N' : 'S'
      }`
    : '';

  const lonFormatted = hasCoords
    ? `${Math.abs(location.longitude).toFixed(6)}° ${
        location.longitude >= 0 ? 'E' : 'W'
      }`
    : '';

  const accFormatted =
    location?.accuracy &&
    location.accuracy < 900
      ? `±${Math.round(location.accuracy)} m`
      : '';

  const altFormatted = location?.altitude
    ? `${Math.round(location.altitude)} m`
    : '';

  const liveAddressText =
    location?.address?.formattedAddress ||
    [
      location?.address?.village,
      location?.address?.city,
      location?.address?.district,
      location?.address?.state,
      location?.address?.country,
    ]
      .filter(Boolean)
      .join(', ') ||
    activeEvent?.locationName ||
    '';

  /*
   * ---------------------------------------------------------
   * GPS QUALITY
   * ---------------------------------------------------------
   */

  const gpsAccuracy = location?.accuracy ?? null;

  const gpsQuality =
    gpsAccuracy === null
      ? 'unknown'
      : gpsAccuracy <= 10
        ? 'excellent'
        : gpsAccuracy <= 30
          ? 'good'
          : gpsAccuracy <= 75
            ? 'fair'
            : 'weak';

  const gpsQualityText =
    gpsQuality === 'excellent'
      ? 'Excellent'
      : gpsQuality === 'good'
        ? 'Good'
        : gpsQuality === 'fair'
          ? 'Fair'
          : gpsQuality === 'weak'
            ? 'Weak'
            : 'Waiting';

  /*
   * ---------------------------------------------------------
   * CAPTURE SUCCESS AUTO HIDE
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!captureSuccess) return;

    const timer = setTimeout(() => {
      setCaptureSuccess(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, [captureSuccess]);

  /*
   * ---------------------------------------------------------
   * CAPTURE
   * ---------------------------------------------------------
   */

  const handleCapture = async () => {
    if (!isStreaming || isProcessing) return;

    setIsProcessing(true);

    setShutterFlash(true);

    setTimeout(() => {
      setShutterFlash(false);
    }, 180);

    try {
      /*
       * 1. Capture camera frame
       */

      const rawFrameDataUrl = captureFrame();

      if (!rawFrameDataUrl) {
        throw new Error(
          'Camera frame not ready. Ensure camera permission is granted.',
        );
      }

      // Normalize the actual pixels before the stamp engine decides layout.
      // This fixes mobile browsers that keep the frame buffer portrait after
      // the device is rotated to landscape.
      const frameDataUrl =
        await normalizeCapturedFrameOrientation(
          rawFrameDataUrl,
          isLandscape,
        );

      /*
       * 2. Prepare GPS location
       */

      let currentLoc: GeoPhoto['location'] =
        location
          ? { ...location }
          : {
              latitude: 0,
              longitude: 0,
              accuracy: 999,
              timestamp: Date.now(),
            };

      /*
       * 3. Reverse geocode if needed
       */

      if (
        !currentLoc.address &&
        currentLoc.latitude !== 0 &&
        currentLoc.longitude !== 0 &&
        isOnline
      ) {
        try {
          const fetchedAddr = await reverseGeocode(
            currentLoc.latitude,
            currentLoc.longitude,
          );

          if (fetchedAddr) {
            currentLoc.address = fetchedAddr;
          }
        } catch (e) {
          // Network failure should not block photo capture.
        }
      }

      /*
       * 4. Generate photo number
       */

      let pNum = 'EVT-001';

      if (activeEvent) {
        const {
          photoNumber,
          updatedEvent,
        } = await getNextPhotoNumber(activeEvent);

        pNum = photoNumber;

        setActiveEvent(updatedEvent);
      }

      /*
       * 5. Generate stamped image
       */

      const stamped = await generateStampedImage({
        imageSrc: frameDataUrl,
        event: activeEvent || undefined,
        photoNumber: pNum,
        location: currentLoc,
        timestamp: Date.now(),
        stampStyle: stampStyle,
        settings: settings,
      });

      /*
       * 6. Original image blob
       */

      const originalBlob =
        dataURLtoBlob(frameDataUrl);

      /*
       * 7. Create photo object
       */

      const newPhoto: GeoPhoto = {
        id:
          'photo_' +
          Date.now() +
          '_' +
          Math.random()
            .toString(36)
            .substr(2, 4),

        eventId: activeEvent?.id,

        eventName: activeEvent?.name,

        schoolName:
          activeEvent?.schoolName ||
          settings.schoolName,

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

      /*
       * 8. Save to IndexedDB
       */

      await db.photos.put(newPhoto);

      /*
       * 9. Update thumbnail
       */

      setLastCapturedPhotoUrl(
        stamped.dataUrl,
      );

      /*
       * 10. Capture success UI
       */

      setCaptureMessage(pNum);
      setCaptureSuccess(true);

      showToast(
        `Record ${pNum} captured and saved`,
        'success',
      );
    } catch (err: any) {
      console.error('Capture error:', err);

      showToast(
        'Capture error: ' +
          (err?.message || 'Unknown camera error'),
        'error',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div
      data-camera-orientation={
        isLandscape ? 'landscape' : 'portrait'
      }
      className="
        fixed inset-0 z-50
        w-screen h-[100dvh]
        overflow-hidden
        bg-black
        text-white
        select-none
      "
    >

      {/* =====================================================
          CAMERA VIDEO
      ====================================================== */}

      <video
        ref={videoRef}
        playsInline
        muted
        className={`
          absolute inset-0
          w-full h-full
          object-cover
          ${facingMode === 'user' ? 'scale-x-[-1]' : ''}
        `}
      />

      {/* =====================================================
          CINEMATIC OVERLAY
      ====================================================== */}

      <div
        className="
          absolute inset-0
          pointer-events-none
          bg-gradient-to-b
          from-black/45
          via-transparent
          to-black/75
        "
      />

      {/* Subtle edge vignette */}
      <div
        className="
          absolute inset-0
          pointer-events-none
          bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.32)_100%)]
        "
      />

      {/* =====================================================
          GRID
      ====================================================== */}

      {showGrid && (
        <div className="absolute inset-0 z-10 pointer-events-none">

          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />

          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />

          {/* Center grid point */}
          <div
            className="
              absolute
              left-1/2 top-1/2
              -translate-x-1/2
              -translate-y-1/2
              w-1.5 h-1.5
              rounded-full
              bg-white/70
            "
          />
        </div>
      )}

      {/* =====================================================
          CENTER FOCUS RETICLE
      ====================================================== */}

      <div
        className="
          absolute inset-0
          z-10
          pointer-events-none
          flex items-center justify-center
        "
      >
        <div
          className="
            relative
            w-16 h-16
            opacity-65
          "
        >
          <div
            className="
              absolute
              left-1/2
              top-0 bottom-0
              w-px
              bg-white/60
              -translate-x-1/2
            "
          />

          <div
            className="
              absolute
              top-1/2
              left-0 right-0
              h-px
              bg-white/60
              -translate-y-1/2
            "
          />

          <div
            className="
              absolute inset-3
              border
              border-white/80
              rounded-sm
            "
          />
        </div>
      </div>

      {/* =====================================================
          LEVEL INDICATOR
      ====================================================== */}

      <div
        className="
          absolute
          z-20
          top-[18%]
          left-1/2
          -translate-x-1/2
          pointer-events-none
        "
      >
        <div className="flex flex-col items-center gap-1">

          <div className="relative w-28 h-4">

            <div
              className="
                absolute
                left-0 right-0
                top-1/2
                h-px
                bg-white/35
              "
            />

            <div
              className={`
                absolute
                left-1/2 top-1/2
                w-10 h-1
                rounded-full
                -translate-x-1/2
                -translate-y-1/2
                shadow-lg
                ${
                  isLevelled
                    ? 'bg-emerald-400 shadow-emerald-400/40'
                    : 'bg-amber-400 shadow-amber-400/40'
                }
              `}
            />

            <div className="absolute left-0 top-1/2 w-1 h-1 rounded-full bg-white/60 -translate-y-1/2" />

            <div className="absolute right-0 top-1/2 w-1 h-1 rounded-full bg-white/60 -translate-y-1/2" />

          </div>

          {isLevelled && (
            <span
              className="
                text-[8px]
                uppercase
                tracking-[0.2em]
                text-emerald-300/80
              "
            >
              Level
            </span>
          )}
        </div>
      </div>

      {/* =====================================================
          SHUTTER FLASH
      ====================================================== */}

      {shutterFlash && (
        <div
          className="
            absolute inset-0
            z-50
            bg-white
            opacity-80
            pointer-events-none
          "
        />
      )}

      {/* =====================================================
          TOP HEADER
      ====================================================== */}

      <div
        className="
          absolute
          z-30
          top-0
          left-0
          right-0
          px-3
          sm:px-5
          pt-3
          sm:pt-5
        "
      >

        <div
          className="
            relative
            flex items-center
            justify-between
            gap-2
            rounded-2xl
            border border-white/15
            bg-black/45
            backdrop-blur-xl
            shadow-2xl
            px-3 py-2.5
            sm:px-4 sm:py-3
          "
        >

          {/* =================================================
              LEFT — CLOSE + DATE
          ================================================== */}

          <div className="flex items-center gap-2.5 min-w-0">

            <button
              onClick={() =>
                setActiveTab('dashboard')
              }
              className="
                w-9 h-9
                sm:w-10 sm:h-10
                shrink-0
                rounded-xl
                bg-white/10
                border border-white/15
                flex items-center justify-center
                hover:bg-white/20
                active:scale-95
                transition-all
              "
              title="Exit Camera Mode"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <div className="hidden sm:block leading-tight">

              <div
                className="
                  text-sm
                  font-semibold
                  tracking-wide
                "
              >
                {currentTimeStr}
              </div>

              <div
                className="
                  mt-0.5
                  text-[10px]
                  text-white/50
                "
              >
                {currentDateStr}
              </div>

            </div>
          </div>

          {/* =================================================
              CENTER — ORIENTATION STATUS
          ================================================== */}

          <div
            className="
              absolute
              left-1/2
              -translate-x-1/2
              flex items-center
              gap-2
              px-3
              sm:px-4
              py-2
              rounded-full
              bg-black/40
              border border-white/20
              backdrop-blur-md
              shadow-lg
              whitespace-nowrap
            "
          >

            <div
              className={`
                w-2
                h-2
                rounded-full
                ${
                  isLandscape
                    ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]'
                    : 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                }
              `}
            />

            <span className="hidden sm:inline text-[10px] text-white/50 uppercase tracking-wider">
              Format
            </span>

            <span
              className="
                text-[10px]
                sm:text-xs
                font-semibold
              "
            >
              {isLandscape
                ? 'Landscape • 1920 × 1080'
                : 'Portrait • 1080 × 1440'}
            </span>
          </div>

          {/* =================================================
              RIGHT — NETWORK + GPS
          ================================================== */}

          <div className="flex items-center gap-1.5 sm:gap-2">

            {/* Network */}
            <div
              className="
                flex items-center gap-1.5
                px-2.5 py-2
                rounded-full
                bg-black/35
                border border-white/10
                backdrop-blur-md
              "
            >
              {isOnline ? (
                <Wifi
                  className="
                    w-3.5 h-3.5
                    text-emerald-400
                  "
                />
              ) : (
                <WifiOff
                  className="
                    w-3.5 h-3.5
                    text-amber-400
                  "
                />
              )}

              <span className="hidden md:inline text-[9px]">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* GPS */}
            <div
              className={`
                flex items-center gap-1.5
                px-2.5 py-2
                rounded-full
                bg-black/35
                border
                backdrop-blur-md
                ${
                  isGpsSearching
                    ? 'border-amber-400/25'
                    : hasCoords
                      ? 'border-emerald-400/25'
                      : 'border-white/10'
                }
              `}
            >

              <MapPin
                className={`
                  w-4 h-4
                  ${
                    isGpsSearching
                      ? 'text-amber-400 animate-pulse'
                      : hasCoords
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                  }
                `}
              />

              <div className="hidden sm:flex flex-col leading-none">

                <span
                  className="
                    text-[8px]
                    uppercase
                    tracking-[0.15em]
                    text-white/40
                  "
                >
                  GPS
                </span>

                <span
                  className={`
                    mt-0.5
                    text-[9px]
                    font-medium
                    ${
                      hasCoords
                        ? 'text-emerald-300'
                        : 'text-white/60'
                    }
                  `}
                >
                  {isGpsSearching
                    ? 'Searching'
                    : hasCoords
                      ? gpsQualityText
                      : 'Unavailable'}
                </span>
              </div>

              {hasCoords && accFormatted && (
                <span
                  className="
                    hidden lg:inline
                    text-[9px]
                    font-mono
                    text-white/60
                  "
                >
                  {accFormatted}
                </span>
              )}
            </div>

            {/* Mobile clock */}
            <div
              className="
                sm:hidden
                text-[8px]
                font-mono
                text-white/60
              "
            >
              {currentTimeStr}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          CAMERA ERROR
      ====================================================== */}

      {cameraError && (
        <div
          className="
            absolute
            z-40
            inset-x-4
            top-1/2
            -translate-y-1/2
          "
        >
          <div
            className="
              mx-auto
              max-w-md
              rounded-2xl
              border border-red-400/30
              bg-black/75
              backdrop-blur-2xl
              p-5
              text-center
              shadow-2xl
            "
          >

            <div
              className="
                w-12 h-12
                mx-auto mb-3
                rounded-full
                bg-red-500/10
                border border-red-400/20
                flex items-center
                justify-center
              "
            >
              <AlertTriangle
                className="
                  w-6 h-6
                  text-red-400
                "
              />
            </div>

            <p className="text-sm font-semibold">
              Camera Access Notice
            </p>

            <p
              className="
                mt-1
                text-xs
                text-white/60
                leading-relaxed
              "
            >
              {cameraError}
            </p>

          </div>
        </div>
      )}

      {/* =====================================================
          LIVE STAMP / INFORMATION CARD
      ====================================================== */}

      {showStamp && (
        <div
          className="
            absolute
            z-20
            left-3
            right-3
            bottom-28
            sm:left-5
            sm:right-auto
            sm:bottom-32
            sm:w-[430px]
            pointer-events-none
          "
        >

          <div
            className="
              overflow-hidden
              rounded-2xl
              border border-white/15
              bg-black/55
              backdrop-blur-xl
              shadow-2xl
            "
          >

            {/* Card top */}
            <div
              className="
                flex
                items-center
                justify-between
                gap-3
                px-4
                py-3
                border-b
                border-white/10
              "
            >

              <div className="flex items-center gap-3 min-w-0">

                {/* GPS indicator */}
                <div
                  className={`
                    w-10 h-10
                    shrink-0
                    rounded-xl
                    flex items-center justify-center
                    border
                    ${
                      hasCoords
                        ? 'bg-emerald-400/10 border-emerald-400/20'
                        : 'bg-amber-400/10 border-amber-400/20'
                    }
                  `}
                >
                  <MapPin
                    className={`
                      w-5 h-5
                      ${
                        hasCoords
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }
                    `}
                  />
                </div>

                <div className="min-w-0">

                  <div className="flex items-center gap-2">

                    <h3
                      className="
                        text-xs
                        sm:text-sm
                        font-semibold
                        tracking-wide
                        truncate
                      "
                    >
                      {eventNameText ||
                        'Default Event'}
                    </h3>

                    <span
                      className="
                        hidden sm:inline
                        px-1.5
                        py-0.5
                        rounded
                        bg-blue-500/15
                        border border-blue-400/20
                        text-[7px]
                        uppercase
                        tracking-wider
                        text-blue-300
                      "
                    >
                      Live
                    </span>
                  </div>

                  <p
                    className="
                      mt-0.5
                      text-[9px]
                      sm:text-[10px]
                      text-white/50
                      truncate
                    "
                  >
                    {schoolNameText}
                  </p>

                  <p
                    className="
                      mt-1
                      text-[9px]
                      font-mono
                      font-semibold
                      text-white/80
                    "
                  >
                    {photoNumPreview}
                  </p>
                </div>
              </div>

              {/* GPS state */}
              <div
                className="
                  shrink-0
                  flex
                  items-center
                  gap-1.5
                "
              >

                <span
                  className={`
                    w-1.5
                    h-1.5
                    rounded-full
                    ${
                      hasCoords
                        ? 'bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.8)]'
                        : 'bg-amber-400'
                    }
                  `}
                />

                <span
                  className="
                    text-[8px]
                    uppercase
                    tracking-wider
                    text-white/40
                  "
                >
                  {hasCoords
                    ? 'GPS'
                    : 'No GPS'}
                </span>
              </div>
            </div>

            {/* Card details */}
            <div
              className="
                px-4
                py-3
                bg-black/10
              "
            >

              <div
                className="
                  grid
                  grid-cols-2
                  gap-x-5
                  gap-y-2
                  font-mono
                  text-[8px]
                  sm:text-[9px]
                "
              >

                {departmentText && (
                  <div className="min-w-0">
                    <span
                      className="
                        block
                        text-[7px]
                        uppercase
                        tracking-wider
                        text-white/35
                        mb-0.5
                      "
                    >
                      Department
                    </span>

                    <span className="block text-white/80 truncate">
                      {departmentText}
                    </span>
                  </div>
                )}

                {organizerText && (
                  <div className="min-w-0">
                    <span
                      className="
                        block
                        text-[7px]
                        uppercase
                        tracking-wider
                        text-white/35
                        mb-0.5
                      "
                    >
                      Organizer
                    </span>

                    <span className="block text-white/80 truncate">
                      {organizerText}
                    </span>
                  </div>
                )}

                {liveAddressText && (
                  <div className="col-span-2 min-w-0">
                    <span
                      className="
                        block
                        text-[7px]
                        uppercase
                        tracking-wider
                        text-white/35
                        mb-0.5
                      "
                    >
                      Location
                    </span>

                    <span
                      className="
                        block
                        text-white/80
                        line-clamp-1
                      "
                    >
                      {liveAddressText}
                    </span>
                  </div>
                )}

                {latFormatted && (
                  <div>
                    <span
                      className="
                        block
                        text-[7px]
                        uppercase
                        tracking-wider
                        text-white/35
                        mb-0.5
                      "
                    >
                      Latitude
                    </span>

                    <span className="text-white/80">
                      {latFormatted}
                    </span>
                  </div>
                )}

                {lonFormatted && (
                  <div>
                    <span
                      className="
                        block
                        text-[7px]
                        uppercase
                        tracking-wider
                        text-white/35
                        mb-0.5
                      "
                    >
                      Longitude
                    </span>

                    <span className="text-white/80">
                      {lonFormatted}
                    </span>
                  </div>
                )}

                {accFormatted && (
                  <div>
                    <span
                      className="
                        block
                        text-[7px]
                        uppercase
                        tracking-wider
                        text-white/35
                        mb-0.5
                      "
                    >
                      Accuracy
                    </span>

                    <span className="text-emerald-300">
                      {accFormatted}
                    </span>
                  </div>
                )}

                {altFormatted && (
                  <div>
                    <span
                      className="
                        block
                        text-[7px]
                        uppercase
                        tracking-wider
                        text-white/35
                        mb-0.5
                      "
                    >
                      Altitude
                    </span>

                    <span className="text-white/80">
                      {altFormatted}
                    </span>
                  </div>
                )}

                <div>
                  <span
                    className="
                      block
                      text-[7px]
                      uppercase
                      tracking-wider
                      text-white/35
                      mb-0.5
                    "
                  >
                    Date
                  </span>

                  <span className="text-white/80">
                    {currentDateStr}
                  </span>
                </div>

                <div>
                  <span
                    className="
                      block
                      text-[7px]
                      uppercase
                      tracking-wider
                      text-white/35
                      mb-0.5
                    "
                  >
                    Time
                  </span>

                  <span className="text-white/80">
                    {currentTimeStr}
                  </span>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          RIGHT CAMERA TOOLS
      ====================================================== */}

      <div
        className="
          absolute
          z-30
          top-1/2
          right-3
          sm:right-5
          -translate-y-1/2
        "
      >

        <div
          className="
            flex flex-col
            gap-2
            p-1.5
            rounded-2xl
            bg-black/45
            border border-white/15
            backdrop-blur-xl
            shadow-2xl
          "
        >

          {/* Grid */}
          <button
            onClick={() =>
              setShowGrid((prev) => !prev)
            }
            className={`
              group
              w-11 h-11
              sm:w-12 sm:h-12
              rounded-xl
              flex items-center
              justify-center
              border
              transition-all
              active:scale-90
              ${
                showGrid
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 text-white border-transparent hover:bg-white/15'
              }
            `}
            title="Toggle Camera Grid"
          >
            <Grid3X3
              className="
                w-4 h-4
                sm:w-5 sm:h-5
              "
            />
          </button>

          {/* Stamp */}
          <button
            onClick={() =>
              setShowStamp((prev) => !prev)
            }
            className={`
              w-11 h-11
              sm:w-12 sm:h-12
              rounded-xl
              flex items-center
              justify-center
              border
              transition-all
              active:scale-90
              ${
                showStamp
                  ? 'bg-white text-black border-white'
                  : 'bg-white/5 text-white border-transparent hover:bg-white/15'
              }
            `}
            title="Toggle Information Overlay"
          >
            <Info
              className="
                w-4 h-4
                sm:w-5 sm:h-5
              "
            />
          </button>

          {/* GPS */}
          <div
            className="
              w-11 h-11
              sm:w-12 sm:h-12
              rounded-xl
              bg-white/5
              border border-transparent
              flex items-center
              justify-center
            "
            title={
              hasCoords
                ? `GPS accuracy ${
                    accFormatted || 'unknown'
                  }`
                : 'GPS unavailable'
            }
          >
            <Navigation
              className={`
                w-4 h-4
                sm:w-5 sm:h-5
                ${
                  hasCoords
                    ? 'text-emerald-400'
                    : isGpsSearching
                      ? 'text-amber-400 animate-pulse'
                      : 'text-slate-500'
                }
              `}
            />
          </div>
        </div>
      </div>

      {/* =====================================================
          CAPTURE SUCCESS
      ====================================================== */}

      {captureSuccess && (
        <div
          className="
            absolute
            z-40
            top-24
            sm:top-28
            left-1/2
            -translate-x-1/2
            pointer-events-none
          "
        >
          <div
            className="
              flex items-center
              gap-2.5
              px-4 py-2.5
              rounded-2xl
              bg-black/70
              border border-emerald-400/25
              backdrop-blur-xl
              shadow-2xl
            "
          >

            <div
              className="
                w-7 h-7
                rounded-full
                bg-emerald-400/10
                flex items-center
                justify-center
              "
            >
              <CheckCircle2
                className="
                  w-4 h-4
                  text-emerald-400
                "
              />
            </div>

            <div className="flex flex-col">

              <span
                className="
                  text-[9px]
                  font-semibold
                  tracking-wider
                  text-emerald-300
                "
              >
                PHOTO SAVED
              </span>

              <span
                className="
                  text-[9px]
                  text-white/60
                  font-mono
                "
              >
                {captureMessage}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          BOTTOM CAMERA CONTROLS
      ====================================================== */}

      <div
        className="
          absolute
          z-30
          bottom-0
          left-0
          right-0
          px-4
          sm:px-8
          pb-5
          sm:pb-7
          pt-16
          bg-gradient-to-t
          from-black
          via-black/80
          to-transparent
        "
      >

        <div
          className="
            max-w-3xl
            mx-auto
            flex
            items-end
            justify-between
            gap-4
          "
        >

          {/* =================================================
              GALLERY
          ================================================== */}

          <div
            className="
              flex
              flex-col
              items-center
              gap-1.5
            "
          >

            <button
              onClick={() =>
                setActiveTab('gallery')
              }
              className="
                relative
                w-13 h-13
                sm:w-16 sm:h-16
                rounded-2xl
                bg-black/55
                border border-white/20
                backdrop-blur-xl
                overflow-hidden
                flex items-center
                justify-center
                text-white/70
                hover:text-white
                hover:bg-white/10
                active:scale-90
                transition-all
                shadow-xl
              "
              title="Open Inspection Gallery"
            >

              {lastCapturedPhotoUrl ? (
                <img
                  src={lastCapturedPhotoUrl}
                  alt="Recent inspection"
                  className="
                    w-full h-full
                    object-cover
                  "
                />
              ) : (
                <Images
                  className="
                    w-5 h-5
                    sm:w-6 sm:h-6
                  "
                />
              )}

              <div
                className="
                  absolute
                  bottom-1.5
                  right-1.5
                  w-2 h-2
                  rounded-full
                  bg-white
                  shadow-[0_0_6px_rgba(255,255,255,0.7)]
                "
              />
            </button>

            <span
              className="
                text-[9px]
                sm:text-[10px]
                text-white/50
              "
            >
              Gallery
            </span>
          </div>

          {/* =================================================
              CENTER CAPTURE AREA
          ================================================== */}

          <div
            className="
              flex
              flex-col
              items-center
              gap-2
            "
          >

            {/* Orientation status pill */}

            <div
              className="
                hidden
                sm:flex
                items-center
                gap-2
                px-3.5
                py-1.5
                rounded-full
                bg-black/50
                border border-white/15
                backdrop-blur-xl
              "
            >

              <span
                className={`
                  w-1.5 h-1.5
                  rounded-full
                  ${
                    isLandscape
                      ? 'bg-blue-400'
                      : 'bg-cyan-400'
                  }
                `}
              />

              <span
                className="
                  text-[8px]
                  uppercase
                  tracking-[0.15em]
                  text-white/60
                "
              >
                {isLandscape
                  ? 'Landscape 1920×1080'
                  : 'Portrait 1080×1440'}
              </span>
            </div>

            {/* Capture button */}

            <button
              onClick={handleCapture}
              disabled={
                !isStreaming ||
                isProcessing
              }
              className="
                group
                relative
                w-[82px]
                h-[82px]
                sm:w-[94px]
                sm:h-[94px]
                rounded-full
                border-[3px]
                sm:border-[4px]
                border-white
                bg-white/10
                backdrop-blur-sm
                flex items-center
                justify-center
                shadow-[0_0_35px_rgba(0,0,0,0.55)]
                hover:bg-white/15
                active:scale-90
                transition-all
                disabled:opacity-40
                disabled:active:scale-100
              "
              title="Capture Official Photo"
            >

              <div
                className="
                  w-[66px]
                  h-[66px]
                  sm:w-[76px]
                  sm:h-[76px]
                  rounded-full
                  bg-white
                  flex items-center
                  justify-center
                  shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]
                  transition-transform
                  group-hover:scale-[0.96]
                "
              >

                {isProcessing ? (
                  <div
                    className="
                      w-7 h-7
                      border-[3px]
                      border-slate-900
                      border-t-transparent
                      rounded-full
                      animate-spin
                    "
                  />
                ) : (
                  <div
                    className="
                      w-12 h-12
                      sm:w-14 sm:h-14
                      rounded-full
                      bg-slate-200
                      group-hover:bg-slate-300
                      transition-colors
                    "
                  />
                )}
              </div>
            </button>

            <span
              className="
                text-[8px]
                sm:text-[9px]
                uppercase
                tracking-[0.18em]
                text-white/35
              "
            >
              {isProcessing
                ? 'Processing'
                : 'Capture'}
            </span>
          </div>

          {/* =================================================
              CAMERA CONTROLS
          ================================================== */}

          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            {/* Torch */}

            {hasTorch && (
              <div
                className="
                  flex
                  flex-col
                  items-center
                  gap-1.5
                "
              >
                <button
                  onClick={toggleTorch}
                  className={`
                    w-12 h-12
                    sm:w-14 sm:h-14
                    rounded-2xl
                    border
                    backdrop-blur-xl
                    flex items-center
                    justify-center
                    transition-all
                    active:scale-90
                    shadow-xl
                    ${
                      torchOn
                        ? 'bg-white text-black border-white'
                        : 'bg-black/55 text-white border-white/20 hover:bg-white/10'
                    }
                  `}
                  title="Toggle Flash/Torch"
                >
                  {torchOn ? (
                    <Zap
                      className="
                        w-5 h-5
                        fill-current
                      "
                    />
                  ) : (
                    <ZapOff
                      className="
                        w-5 h-5
                      "
                    />
                  )}
                </button>

                <span
                  className="
                    text-[8px]
                    text-white/40
                  "
                >
                  Torch
                </span>
              </div>
            )}

            {/* Camera switch */}

            <div
              className="
                flex
                flex-col
                items-center
                gap-1.5
              "
            >
              <button
                onClick={toggleCamera}
                className="
                  w-12 h-12
                  sm:w-14 sm:h-14
                  rounded-2xl
                  bg-black/55
                  border border-white/20
                  backdrop-blur-xl
                  flex items-center
                  justify-center
                  text-white
                  hover:bg-white/10
                  transition-all
                  active:scale-90
                  shadow-xl
                "
                title="Switch Front/Rear Camera"
              >
                <RefreshCw
                  className="
                    w-5 h-5
                  "
                />
              </button>

              <span
                className="
                  text-[8px]
                  text-white/40
                "
              >
                {facingMode === 'user'
                  ? 'Front'
                  : 'Rear'}
              </span>
            </div>
          </div>
        </div>

        {/* =================================================
            BOTTOM STATUS
        ================================================== */}

        <div
          className="
            mt-3
            flex
            items-center
            justify-center
            gap-2
          "
        >

          <span
            className={`
              w-1.5 h-1.5
              rounded-full
              ${
                isProcessing
                  ? 'bg-amber-400 animate-pulse'
                  : hasCoords
                    ? 'bg-emerald-400'
                    : 'bg-white/30'
              }
            `}
          />

          <span
            className="
              text-[8px]
              sm:text-[9px]
              uppercase
              tracking-[0.16em]
              text-white/35
            "
          >
            {isProcessing
              ? 'Processing photo...'
              : hasCoords
                ? `Ready • ${gpsQualityText} GPS`
                : 'Ready • Waiting for GPS'}
          </span>
        </div>
      </div>
    </div>
  );
};