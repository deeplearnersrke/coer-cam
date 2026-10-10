import React, { useEffect, useMemo, useState } from 'react';

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

  Battery,

  Smartphone,

  Monitor,

  RotateCcw,

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

  showToast: (

    msg: string,

    type?: 'success' | 'error' | 'info'

  ) => void;

  isOnline?: boolean;

}

type OrientationMode = 'portrait' | 'landscape';

function getDeviceOrientation(): OrientationMode {

  if (typeof window === 'undefined') return 'portrait';

  const screenOrientationType = window.screen?.orientation?.type;

  if (screenOrientationType) {

    return screenOrientationType.includes('landscape')

      ? 'landscape'

      : 'portrait';

  }

  if (typeof window.matchMedia === 'function') {

    return window.matchMedia('(orientation: landscape)').matches

      ? 'landscape'

      : 'portrait';

  }

  return window.innerWidth > window.innerHeight

    ? 'landscape'

    : 'portrait';

}

function getDeviceRotationAngle(): number {
  if (typeof window === 'undefined') return 0;
  const screenAngle = window.screen?.orientation?.angle;
  if (typeof screenAngle === 'number' && Number.isFinite(screenAngle)) {
    return ((screenAngle % 360) + 360) % 360;
  }
  const legacyAngle = (window as Window & { orientation?: number }).orientation;
  if (typeof legacyAngle === 'number' && Number.isFinite(legacyAngle)) {
    return ((legacyAngle % 360) + 360) % 360;
  }
  return window.innerWidth > window.innerHeight ? 90 : 0;
}

function normalizeOrientation(value: unknown): OrientationMode {

  if (typeof value === 'string') {

    return value.toLowerCase().includes('land')

      ? 'landscape'

      : 'portrait';

  }

  return 'portrait';

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

    return new Blob([u8arr], {

      type: mime,

    });

  } catch (e) {

    return new Blob([], {

      type: 'image/jpeg',

    });

  }

}

const StampField: React.FC<{

  label: string;

  value?: React.ReactNode;

  isLandscape: boolean;

  valueClassName?: string;

}> = ({ label, value, isLandscape, valueClassName = 'font-normal truncate' }) => {

  if (value === undefined || value === null || value === '') {

    return null;

  }

  return (

    <div

      className={`grid items-start ${

        isLandscape

          ? 'grid-cols-[68px_8px_1fr]'

          : 'grid-cols-[85px_10px_1fr] sm:grid-cols-[95px_10px_1fr]'

      }`}

    >

      <span className="font-medium text-slate-600">{label}</span>

      <span>:</span>

      <span className={`text-slate-900 ${valueClassName}`}>{value}</span>

    </div>

  );

};

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

  const stampStyle = useMemo<StampStyle>(

    () =>

      (activeEvent?.stampStyle ||

        settings.defaultStampStyle ||

        'gps_classic') as StampStyle,

    [activeEvent?.stampStyle, settings.defaultStampStyle]

  );

  // =========================================================

  // ORIENTATION STATE

  // =========================================================

  const [orientation, setOrientation] = useState<OrientationMode>(

    () => getDeviceOrientation()

  );

  const [autoRotate, setAutoRotate] = useState(true);
  const [rotationAngle, setRotationAngle] = useState(0);

  const isPortrait = orientation === 'portrait';

  const isLandscape = orientation === 'landscape';

  const [isProcessing, setIsProcessing] = useState(false);

  const [shutterFlash, setShutterFlash] = useState(false);

  const [currentTimeStr, setCurrentTimeStr] = useState('');

  const [currentDateStr, setCurrentDateStr] = useState('');

  const [lastCapturedPhotoUrl, setLastCapturedPhotoUrl] =

    useState<string | null>(null);

  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  // =========================================================

  // AUTOMATIC ORIENTATION DETECTION

  // =========================================================

  useEffect(() => {
    let resizeTimer: number | undefined;

    const syncOrientation = () => {
      const angle = getDeviceRotationAngle();
      setRotationAngle((prev) => (prev === angle ? prev : angle));
      if (autoRotate) {
        const next = getDeviceOrientation();
        setOrientation((prev) => (prev === next ? prev : next));
      }
    };

    const syncOrientationDelayed = () => {

      window.clearTimeout(resizeTimer);

      resizeTimer = window.setTimeout(syncOrientation, 100);

    };

    const mq = window.matchMedia('(orientation: landscape)');

    const handleMediaQueryChange = (

      event: MediaQueryListEvent

    ) => {

      if (autoRotate) setOrientation(event.matches ? 'landscape' : 'portrait');
      setRotationAngle(getDeviceRotationAngle());

    };

    if (typeof mq.addEventListener === 'function') {

      mq.addEventListener('change', handleMediaQueryChange);

    } else {

      (mq as any).addListener(handleMediaQueryChange);

    }

    window.addEventListener('resize', syncOrientationDelayed);

    window.addEventListener(

      'orientationchange',

      syncOrientationDelayed

    );

    const screenOrientation = window.screen?.orientation;

    if (screenOrientation) {

      screenOrientation.addEventListener(

        'change',

        syncOrientationDelayed

      );

    }

    syncOrientation();

    return () => {

      window.clearTimeout(resizeTimer);

      if (typeof mq.removeEventListener === 'function') {

        mq.removeEventListener(

          'change',

          handleMediaQueryChange

        );

      } else {

        (mq as any).removeListener(handleMediaQueryChange);

      }

      window.removeEventListener(

        'resize',

        syncOrientationDelayed

      );

      window.removeEventListener(

        'orientationchange',

        syncOrientationDelayed

      );

      if (screenOrientation) {

        screenOrientation.removeEventListener(

          'change',

          syncOrientationDelayed

        );

      }

    };

  }, [autoRotate]);

  // =========================================================

  // LIVE CLOCK

  // =========================================================

  useEffect(() => {

    const updateDateTime = () => {

      const d = new Date();

      let hours = d.getHours();

      const minutes = String(d.getMinutes()).padStart(2, '0');

      const seconds = String(d.getSeconds()).padStart(2, '0');

      const ampm = hours >= 12 ? 'PM' : 'AM';

      hours = hours % 12 || 12;

      setCurrentTimeStr(

        `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`

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

        `${day} ${months[d.getMonth()]} ${d.getFullYear()}`

      );

    };

    updateDateTime();

    const timer = setInterval(updateDateTime, 1000);

    return () => clearInterval(timer);

  }, []);

  // =========================================================

  // BATTERY STATUS

  // =========================================================

  useEffect(() => {

    let battery: any;

    const updateBattery = () => {

      if (battery) {

        setBatteryLevel(Math.round(battery.level * 100));

      }

    };

    if ('getBattery' in navigator) {

      (navigator as any)

        .getBattery()

        .then((b: any) => {

          battery = b;

          updateBattery();

          b.addEventListener('levelchange', updateBattery);

        })

        .catch(() => {});

    }

    return () => {

      if (battery) {

        battery.removeEventListener('levelchange', updateBattery);

      }

    };

  }, []);

  // =========================================================

  // PHOTO INFORMATION

  // =========================================================

  const nextSeq = activeEvent?.currentSeqNumber || 1;

  const photoNumPreview = `${

    activeEvent?.photoPrefix || 'EVT'

  }-${String(nextSeq).padStart(3, '0')}`;

  const schoolNameText =

    activeEvent?.schoolName ||

    settings.schoolName ||

    'INSTITUTION DOCUMENTATION';

  const eventNameText = activeEvent?.name || '';

  const departmentText = activeEvent?.department || '';

  const organizerText = activeEvent?.organizer || '';

  // =========================================================

  // GPS INFORMATION

  // =========================================================

  const loc = location;

  const hasCoords = Boolean(

    loc && (loc.latitude !== 0 || loc.longitude !== 0)

  );

  const latFormatted =

    hasCoords && loc

      ? `${Math.abs(loc.latitude).toFixed(6)}° ${

          loc.latitude >= 0 ? 'N' : 'S'

        }`

      : '';

  const lonFormatted =

    hasCoords && loc

      ? `${Math.abs(loc.longitude).toFixed(6)}° ${

          loc.longitude >= 0 ? 'E' : 'W'

        }`

      : '';

  const accFormatted =

    loc?.accuracy && loc.accuracy < 900

      ? `±${Math.round(loc.accuracy)} m`

      : '';

  const altFormatted = loc?.altitude

    ? `${Math.round(loc.altitude)} m`

    : '';

  const liveAddressText =

    loc?.address?.formattedAddress ||

    [

      loc?.address?.village,

      loc?.address?.city,

      loc?.address?.district,

      loc?.address?.state,

      loc?.address?.country,

    ]

      .filter(Boolean)

      .join(', ') ||

    activeEvent?.locationName ||

    '';

  // =========================================================

  // ORIENTATION CONTROLS

  // =========================================================

  const setOrientationManually = (next: OrientationMode) => {

    if (autoRotate) return;

    setOrientation(next);

  };

  const handleAutoRotateToggle = () => {

    const next = !autoRotate;

    setAutoRotate(next);

    if (next) {

      setOrientation(getDeviceOrientation());

    }

  };

  // =========================================================

  // RESPONSIVE UI SIZES

  // =========================================================

  const galleryButtonSize = isLandscape

    ? 'w-11 h-11'

    : 'w-12 h-12 sm:w-14 sm:h-14';

  const galleryIconSize = isLandscape

    ? 'w-4 h-4'

    : 'w-5 h-5 sm:w-6 sm:h-6';

  const shutterButtonSize = isLandscape

    ? 'w-16 h-16'

    : 'w-[72px] h-[72px] sm:w-20 sm:h-20';

  const shutterInnerSize = isLandscape

    ? 'w-12 h-12'

    : 'w-14 h-14 sm:w-16 sm:h-16';

  const shutterDotSize = isLandscape

    ? 'w-8 h-8'

    : 'w-10 h-10 sm:w-12 sm:h-12';

  const spinnerSize = isLandscape ? 'w-5 h-5' : 'w-6 h-6';

  const sideButtonSize = isLandscape

    ? 'w-10 h-10'

    : 'w-11 h-11 sm:w-12 sm:h-12';

  const sideIconSize = isLandscape ? 'w-4 h-4' : 'w-5 h-5';

  // =========================================================

  // CAPTURE + AUTO SAVE

  // =========================================================

  const handleCapture = async () => {

    if (!isStreaming || isProcessing) {

      return;

    }

    const requestedOrientation = orientation;

    setIsProcessing(true);

    setShutterFlash(true);

    setTimeout(() => setShutterFlash(false), 180);

    try {

      // 1. Capture camera frame

      const captured = captureFrame(requestedOrientation);

      if (!captured || !captured.dataUrl) {

        throw new Error(

          'Camera frame not ready. Ensure camera permission is granted.'

        );

      }

      const finalOrientation = normalizeOrientation(

        (captured as any).orientation ?? requestedOrientation

      );

      // 2. Prepare GPS location

      let currentLoc: GeoPhoto['location'] = loc

        ? { ...loc }

        : {

            latitude: 0,

            longitude: 0,

            accuracy: 999,

            timestamp: Date.now(),

          };

      // 3. Reverse geocode

      if (

        !currentLoc.address &&

        currentLoc.latitude !== 0 &&

        currentLoc.longitude !== 0 &&

        isOnline

      ) {

        try {

          const fetchedAddr = await reverseGeocode(

            currentLoc.latitude,

            currentLoc.longitude

          );

          if (fetchedAddr) {

            currentLoc.address = fetchedAddr;

          }

        } catch (e) {

          // ignore network failure

        }

      }

      // 4. Sequence photo number

      let pNum = 'EVT-001';

      if (activeEvent) {

        const { photoNumber, updatedEvent } =

          await getNextPhotoNumber(activeEvent);

        pNum = photoNumber;

        setActiveEvent(updatedEvent);

      }

      // 5. Run Canvas Stamp Engine

      const stamped = await generateStampedImage({

        imageSrc: captured.dataUrl,

        event: activeEvent || undefined,

        photoNumber: pNum,

        location: currentLoc,

        timestamp: Date.now(),

        stampStyle,

        settings,

        orientation: finalOrientation,

      });

      // 6. Original image blob

      const originalBlob = dataURLtoBlob(captured.dataUrl);

      // 7. Create photo object

      const newPhoto: GeoPhoto = {

        id:

          'photo_' +

          Date.now() +

          '_' +

          Math.random().toString(36).slice(2, 6),

        eventId: activeEvent?.id,

        eventName: activeEvent?.name,

        schoolName:

          activeEvent?.schoolName || settings.schoolName,

        department: activeEvent?.department,

        organizer: activeEvent?.organizer,

        locationName: activeEvent?.locationName,

        remarks: activeEvent?.remarks || '',

        orientation: finalOrientation,

        originalBlob,

        stampedBlob: stamped.blob,

        stampedDataUrl: stamped.dataUrl,

        originalDataUrl: captured.dataUrl,

        photoNumber: pNum,

        location: currentLoc,

        timestamp: Date.now(),

        stampStyle,

        metadata: {

          width: captured.width ?? 0,

          height: captured.height ?? 0,

          orientation: finalOrientation,

          fileSize: stamped.blob.size,

          cameraFacing: facingMode,

        },

      };

      // 8. SAVE

      await db.photos.put(newPhoto);

      // 9. Gallery preview

      setLastCapturedPhotoUrl(stamped.dataUrl);

      // 10. Success toast

      showToast(

        `Record ${pNum} (${finalOrientation.toUpperCase()}) captured and saved`,

        'success'

      );

    } catch (err: any) {

      console.error('Capture error:', err);

      showToast(

        'Capture error: ' +

          (err?.message || 'Unknown camera error'),

        'error'

      );

    } finally {

      setIsProcessing(false);

    }

  };

  // =========================================================

  // UI

  // =========================================================

  return (

    <div

      className="

        fixed inset-0

        z-50

        bg-black

        text-white

        flex flex-col

        justify-between

        overflow-hidden

        select-none

        w-screen

        h-screen

      "

    >

      {/* =====================================================

          LIVE VIDEO

      ====================================================== */}

      <video

        ref={videoRef}

        playsInline

        muted

        autoPlay

        className={`

          absolute

          inset-0

          w-full

          h-full

          object-cover

          ${

            facingMode === 'user'

              ? 'scale-x-[-1]'

              : ''

          }

        `}

      />

      {/* Visual polish */}

      <div

        className="

          absolute

          inset-0

          z-[5]

          pointer-events-none

          bg-gradient-to-b

          from-black/20

          via-transparent

          to-black/45

        "

      />

      <div

        className="

          absolute

          inset-0

          z-[5]

          pointer-events-none

          bg-[radial-gradient(circle_at_center,transparent_48%,rgba(0,0,0,0.25)_100%)]

        "

      />

      {/* =====================================================

          VIEWFINDER

      ====================================================== */}

      <div

        className="

          absolute

          inset-0

          pointer-events-none

          z-10

          flex

          items-center

          justify-center

          p-4

          sm:p-6

        "

      >

        <div

          className={`

            relative

            transition-all

            duration-300

            border

            border-white/20

            rounded-2xl

            ${

              isPortrait

                ? 'aspect-[3/4] h-full max-h-[78vh] w-auto'

                : 'aspect-[16/9] w-full max-w-[94vw] max-h-[62vh] h-auto'

            }

          `}

        >

          <div

            className="

              absolute

              -top-1

              -left-1

              w-5

              h-5

              border-t-2

              border-l-2

              border-white/60

              rounded-tl

            "

          />

          <div

            className="

              absolute

              -top-1

              -right-1

              w-5

              h-5

              border-t-2

              border-r-2

              border-white/60

              rounded-tr

            "

          />

          <div

            className="

              absolute

              -bottom-1

              -left-1

              w-5

              h-5

              border-b-2

              border-l-2

              border-white/60

              rounded-bl

            "

          />

          <div

            className="

              absolute

              -bottom-1

              -right-1

              w-5

              h-5

              border-b-2

              border-r-2

              border-white/60

              rounded-br

            "

          />

        </div>

      </div>

      {/* =====================================================

          SHUTTER FLASH

      ====================================================== */}

      <div

        className={`

          absolute

          inset-0

          z-40

          bg-white

          pointer-events-none

          transition-opacity

          duration-150

          ${

            shutterFlash

              ? 'opacity-80'

              : 'opacity-0'

          }

        `}

      />

      {/* =====================================================

          TOP STATUS HEADER

      ====================================================== */}

      <div

        className={`

          relative

          z-30

          m-2

          sm:m-3

          p-2

          sm:p-3

          rounded-2xl

          bg-black/45

          backdrop-blur-xl

          border

          border-white/15

          shadow-2xl

          flex

          items-center

          justify-between

          gap-1.5

          sm:gap-2

          text-white

          ${

            isLandscape

              ? 'text-[10px]'

              : 'text-xs'

          }

        `}

      >

        {/* Exit */}

        <button

          onClick={() => setActiveTab('dashboard')}

          className="

            shrink-0

            flex

            items-center

            gap-1.5

            px-2.5

            py-1.5

            rounded-lg

            bg-black/55

            border

            border-white/20

            hover:bg-white/15

            text-white

            font-medium

            backdrop-blur-xl

            transition-all

            active:scale-95

            shadow-lg

          "

          title="Exit Camera Mode"

        >

          <X className="w-4 h-4" />

          <span

            className={

              isLandscape

                ? 'hidden xl:inline'

                : 'hidden sm:inline'

            }

          >

            Close

          </span>

        </button>

        {/* GPS */}

        <div

          className="

            flex

            items-center

            gap-1

            px-2

            py-1

            rounded-full

            bg-black/50

            border

            border-white/15

            backdrop-blur-xl

            shadow-lg

            font-mono

            text-[10px]

            sm:text-[11px]

            min-w-0

            max-w-[34vw]

            sm:max-w-none

          "

        >

          <MapPin

            className={`

              shrink-0

              w-3.5

              h-3.5

              ${

                isGpsSearching

                  ? 'text-amber-400 animate-pulse'

                  : hasCoords

                  ? 'text-emerald-400'

                  : 'text-slate-400'

              }

            `}

          />

          <span

            className={`

              truncate

              ${

                isLandscape

                  ? 'hidden lg:inline'

                  : 'hidden sm:inline'

              }

            `}

          >

            {isGpsSearching

              ? 'GPS Searching...'

              : hasCoords

              ? 'GPS Connected'

              : 'GPS Offline'}

          </span>

          {hasCoords && accFormatted && (

            <span

              className={`

                truncate

                ${

                  isLandscape

                    ? 'inline'

                    : 'hidden sm:inline'

                }

              `}

            >

              {accFormatted}

            </span>

          )}

        </div>

        {/* Orientation Controls */}

        <div className="flex items-center gap-1.5 shrink-0">

          <button

            type="button"

            onClick={handleAutoRotateToggle}

            className={`

              flex

              items-center

              gap-1

              px-2

              py-1.5

              rounded-lg

              border

              text-[9px]

              sm:text-[10px]

              font-semibold

              tracking-wide

              transition-all

              active:scale-95

              shadow-lg

              backdrop-blur-xl

              ${

                autoRotate

                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'

                  : 'bg-black/55 border-white/20 text-white/70'

              }

            `}

            title="Auto rotate camera UI and stamp with device orientation"

          >

            <RotateCcw className="w-3.5 h-3.5" />

            <span

              className={

                isLandscape

                  ? 'hidden sm:inline'

                  : ''

              }

            >

              {autoRotate ? 'AUTO' : 'MANUAL'}

            </span>

          </button>

          <div

            className={`

              hidden

              md:flex

              items-center

              gap-0.5

              p-1

              rounded-full

              bg-black/50

              border

              border-white/15

              backdrop-blur-xl

              shadow-lg

              ${

                autoRotate

                  ? 'opacity-40'

                  : ''

              }

            `}

          >

            <button

              type="button"

              disabled={autoRotate}

              onClick={() =>

                setOrientationManually('portrait')

              }

              className={`

                px-2.5

                py-1

                rounded-full

                text-[9px]

                font-semibold

                tracking-wide

                transition-all

                disabled:cursor-not-allowed

                ${

                  orientation === 'portrait'

                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'

                    : 'text-white/55 hover:text-white hover:bg-white/10 disabled:hover:bg-transparent'

                }

              `}

              title="Use Portrait Photo Format"

            >

              <span className="flex items-center gap-1">

                <Smartphone className="w-3 h-3" />

                PORTRAIT

              </span>

            </button>

            <button

              type="button"

              disabled={autoRotate}

              onClick={() =>

                setOrientationManually('landscape')

              }

              className={`

                px-2.5

                py-1

                rounded-full

                text-[9px]

                font-semibold

                tracking-wide

                transition-all

                disabled:cursor-not-allowed

                ${

                  orientation === 'landscape'

                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'

                    : 'text-white/55 hover:text-white hover:bg-white/10 disabled:hover:bg-transparent'

                }

              `}

              title="Use Landscape Photo Format"

            >

              <span className="flex items-center gap-1">

                <Monitor className="w-3 h-3" />

                LANDSCAPE

              </span>

            </button>

          </div>

        </div>

        {/* Live orientation and rotation report */}
        <div
          className="flex items-center gap-1 rounded-md border border-cyan-300/30 bg-cyan-950/60 px-2 py-1 font-mono text-[9px] sm:text-[10px] text-cyan-100 whitespace-nowrap"
          aria-live="polite"
          title="Live screen orientation and rotation angle"
        >
          <RotateCcw className="h-3 w-3" />
          <span>{orientation.toUpperCase()}</span>
          <span className="text-cyan-300">{rotationAngle}°</span>
        </div>

        {/* Network / Battery / Clock */}

        <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-[10px] sm:text-[11px] shrink-0">

          <div

            className="

              hidden

              sm:flex

              items-center

              gap-1

              px-2

              py-1

              rounded-md

              bg-black/50

              border

              border-white/15

              backdrop-blur-xl

              shadow-lg

            "

          >

            {isOnline ? (

              <>

                <Wifi className="w-3.5 h-3.5 text-emerald-400" />

                <span

                  className={

                    isLandscape

                      ? 'hidden lg:inline'

                      : ''

                  }

                >

                  Online

                </span>

              </>

            ) : (

              <>

                <WifiOff className="w-3.5 h-3.5 text-amber-400" />

                <span

                  className={

                    isLandscape

                      ? 'hidden lg:inline'

                      : ''

                  }

                >

                  Offline

                </span>

              </>

            )}

          </div>

          {batteryLevel !== null && (

            <div

              className="

                hidden

                md:flex

                items-center

                gap-1

                px-2

                py-1

                rounded-md

                bg-black/50

                border

                border-white/15

                backdrop-blur-xl

                shadow-lg

              "

            >

              <Battery className="w-3.5 h-3.5 text-slate-300" />

              <span>{batteryLevel}%</span>

            </div>

          )}

          <div

            className="

              px-2

              py-1

              rounded-md

              bg-black/50

              border

              border-white/15

              backdrop-blur-xl

              shadow-lg

              font-medium

              whitespace-nowrap

            "

          >

            {currentTimeStr}

          </div>

        </div>

      </div>

      {/* =====================================================

          CAMERA ERROR

      ====================================================== */}

      {cameraError && (

        <div

          className={`

            relative

            z-30

            mx-auto

            my-4

            p-4

            rounded-xl

            bg-black/85

            border

            border-red-500/50

            text-center

            space-y-1

            ${

              isLandscape

                ? 'max-w-sm'

                : 'max-w-md'

            }

          `}

        >

          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto" />

          <p className="text-sm font-semibold text-white">

            Camera Access Notice

          </p>

          <p className="text-xs text-slate-300">

            {cameraError}

          </p>

        </div>

      )}

      {/* =====================================================

          LIVE STAMP OVERLAY

      ====================================================== */}

      <div

        className={`

          pointer-events-none

          transition-all

          duration-300

          z-20

          ${

            isPortrait

              ? 'absolute bottom-28 left-3 right-3 sm:left-6 sm:right-6 max-w-lg mx-auto'

              : 'absolute bottom-20 left-3 right-3 sm:left-6 sm:right-6 max-w-3xl mx-auto'

          }

        `}

      >

        <div

          className={`

            w-full

            rounded-2xl

            bg-slate-50/95

            border

            border-slate-200/90

            shadow-2xl

            backdrop-blur-xl

            text-slate-900

            font-sans

            text-left

            ring-1

            ring-cyan-500/10

            ${

              isLandscape

                ? 'p-4 text-[11px] space-y-2'

                : 'p-4 sm:p-5 text-xs space-y-2.5'

            }

          `}

        >

          {/* Header */}

          <div className="space-y-0.5">

            <h3

              className={`

                font-semibold

                text-slate-900

                tracking-wide

                truncate

                ${

                  isLandscape

                    ? 'text-xs sm:text-sm'

                    : 'text-sm sm:text-base'

                }

              `}

            >

              {schoolNameText}

            </h3>

            {eventNameText && (

              <p

                className={`

                  font-medium

                  text-slate-600

                  truncate

                  ${

                    isLandscape

                      ? 'text-[10px] sm:text-[11px]'

                      : 'text-[11px] sm:text-xs'

                  }

                `}

              >

                {eventNameText}

              </p>

            )}

          </div>

          {/* Divider */}

          <div className="h-px bg-slate-300 w-full" />

          {/* Information grid */}

          <div

            className={`

              font-mono

              leading-relaxed

              ${

                isLandscape

                  ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[9px] sm:text-[10px]'

                  : 'space-y-1 text-[10px] sm:text-[11px]'

              }

            `}

          >

            <StampField

              label="Department"

              value={departmentText}

              isLandscape={isLandscape}

            />

            <StampField

              label="Organizer"

              value={organizerText}

              isLandscape={isLandscape}

            />

            <StampField

              label="Location"

              value={liveAddressText}

              isLandscape={isLandscape}

              valueClassName="font-normal break-words line-clamp-2"

            />

            <StampField

              label="Latitude"

              value={latFormatted}

              isLandscape={isLandscape}

            />

            <StampField

              label="Longitude"

              value={lonFormatted}

              isLandscape={isLandscape}

            />

            <StampField

              label="Accuracy"

              value={accFormatted}

              isLandscape={isLandscape}

            />

            <StampField

              label="Altitude"

              value={altFormatted}

              isLandscape={isLandscape}

            />

            <StampField

              label="Date"

              value={currentDateStr}

              isLandscape={isLandscape}

            />

            <StampField

              label="Time"

              value={currentTimeStr}

              isLandscape={isLandscape}

            />

            <StampField

              label="Photo ID"

              value={photoNumPreview}

              isLandscape={isLandscape}

              valueClassName="font-semibold"

            />

          </div>

        </div>

      </div>

      {/* =====================================================

          CURRENT FORMAT BADGE

      ====================================================== */}

      <div

        className={`

          absolute

          z-20

          pointer-events-none

          ${

            isLandscape

              ? 'top-16 left-1/2 -translate-x-1/2'

              : 'bottom-[104px] left-1/2 -translate-x-1/2 sm:bottom-[118px]'

          }

        `}

      >

        <div

          className="

            px-3

            py-1.5

            rounded-full

            bg-black/50

            border

            border-white/15

            backdrop-blur-xl

            shadow-lg

            text-[9px]

            font-mono

            text-white/65

            whitespace-nowrap

          "

        >

          {isPortrait

            ? 'PORTRAIT • 1080 × 1440'

            : 'LANDSCAPE • 1920 × 1080'}

        </div>

      </div>

      {/* =====================================================

          BOTTOM CONTROLS

      ====================================================== */}

      <div

        className={`

          relative

          z-30

          m-2

          sm:m-3

          p-3

          sm:p-4

          rounded-2xl

          bg-black/40

          backdrop-blur-xl

          border

          border-white/10

          shadow-2xl

          bg-gradient-to-t

          from-black/85

          via-black/55

          to-transparent

          flex

          items-center

          justify-between

          gap-3

          ${

            isLandscape

              ? 'text-[10px]'

              : ''

          }

        `}

        style={{

          paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',

          paddingRight: 'max(0.75rem, env(safe-area-inset-right))',

          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',

        }}

      >

        {/* Gallery */}

        <button

          onClick={() => setActiveTab('gallery')}

          className={`

            relative

            rounded-xl

            bg-black/55

            border

            border-white/20

            overflow-hidden

            flex

            items-center

            justify-center

            text-slate-300

            hover:text-white

            hover:bg-white/10

            transition-all

            active:scale-95

            shadow-xl

            group

            backdrop-blur-xl

            ${galleryButtonSize}

          `}

          title="Open Inspection Gallery"

        >

          {lastCapturedPhotoUrl ? (

            <img

              src={lastCapturedPhotoUrl}

              alt="Recent inspection"

              className="w-full h-full object-cover"

            />

          ) : (

            <Images

              className={`

                text-slate-300

                ${galleryIconSize}

              `}

            />

          )}

        </button>

        {/* Capture */}

        <button

          onClick={handleCapture}

          disabled={!isStreaming || isProcessing}

          className={`

            relative

            group

            rounded-full

            bg-white/15

            border-4

            border-white

            flex

            items-center

            justify-center

            shadow-[0_0_35px_rgba(0,0,0,0.55)]

            active:scale-90

            transition-transform

            disabled:opacity-50

            backdrop-blur-md

            ring-1

            ring-white/20

            ${shutterButtonSize}

          `}

          title={`Capture ${orientation.toUpperCase()} Photo`}

        >

          <div

            className={`

              rounded-full

              bg-white

              group-hover:scale-95

              transition-transform

              flex

              items-center

              justify-center

              shadow-inner

              ${shutterInnerSize}

            `}

          >

            {isProcessing ? (

              <div

                className={`

                  border-[3px]

                  border-slate-900

                  border-t-transparent

                  rounded-full

                  animate-spin

                  ${spinnerSize}

                `}

              />

            ) : (

              <div

                className={`

                  rounded-full

                  bg-slate-300

                  opacity-30

                  group-hover:opacity-60

                  transition-opacity

                  ${shutterDotSize}

                `}

              />

            )}

          </div>

        </button>

        {/* Camera Controls */}

        <div className="flex items-center gap-2">

          {hasTorch && (

            <button

              onClick={toggleTorch}

              className={`

                rounded-xl

                border

                flex

                items-center

                justify-center

                transition-all

                shadow-xl

                backdrop-blur-xl

                ${

                  torchOn

                    ? 'bg-white text-black border-white'

                    : 'bg-black/60 text-white border-white/20'

                }

                ${sideButtonSize}

              `}

              title="Toggle Flash/Torch"

            >

              {torchOn ? (

                <Zap

                  className={`

                    fill-current

                    ${sideIconSize}

                  `}

                />

              ) : (

                <ZapOff

                  className={`${sideIconSize}`}

                />

              )}

            </button>

          )}

          <button

            onClick={toggleCamera}

            className={`

              rounded-xl

              bg-black/55

              border

              border-white/20

              flex

              items-center

              justify-center

              text-white

              hover:bg-white/15

              transition-all

              active:scale-95

              shadow-xl

              backdrop-blur-xl

              ${sideButtonSize}

            `}

            title="Switch Front/Rear Camera"

          >

            <RefreshCw

              className={`${sideIconSize}`}

            />

          </button>

        </div>

      </div>

    </div>

  );

};