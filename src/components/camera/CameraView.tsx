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



function dataURLtoBlob(dataurl: string): Blob {

  try {

    const arr = dataurl.split(',');

    const mimeMatch = arr[0].match(/:(.\*?);/);

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



  const { activeEvent, settings, setActiveEvent } = useEventContext();



  const {

    location,

    isSearching: isGpsSearching,

  } = useGps(settings.gpsHighAccuracy);



  const [stampStyle] = useState<StampStyle>(

    activeEvent?.stampStyle ||

      settings.defaultStampStyle ||

      'gps_classic'

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
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(orientation: landscape)');

    const handleOrientationChange = () => {
      setIsLandscape(mediaQuery.matches);
    };

    handleOrientationChange();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleOrientationChange);
      return () => {
        mediaQuery.removeEventListener('change', handleOrientationChange);
      };
    }

    mediaQuery.addListener(handleOrientationChange);
    return () => {
      mediaQuery.removeListener(handleOrientationChange);
    };
  }, []);





  /\*

   \* ---------------------------------------------------------

   \* LIVE CLOCK

   \* ---------------------------------------------------------

   \*/



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



  /\*

   \* ---------------------------------------------------------

   \* PHOTO NUMBER

   \* ---------------------------------------------------------

   \*/



  const nextSeq = activeEvent?.currentSeqNumber || 1;



  const photoNumPreview = `${

    activeEvent?.photoPrefix || 'EVT'

  }-${String(nextSeq).padStart(3, '0')}`;



  /\*

   \* ---------------------------------------------------------

   \* EVENT INFORMATION

   \* ---------------------------------------------------------

   \*/



  const schoolNameText =

    activeEvent?.schoolName ||

    settings.schoolName ||

    'INSTITUTION DOCUMENTATION';



  const eventNameText = activeEvent?.name || '';

  const departmentText = activeEvent?.department || '';

  const organizerText = activeEvent?.organizer || '';



  /\*

   \* ---------------------------------------------------------

   \* GPS INFORMATION

   \* ---------------------------------------------------------

   \*/



  const hasCoords =

    location &&

    (location.latitude !== 0 || location.longitude !== 0);



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

    location?.accuracy && location.accuracy < 900

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



  /\*

   \* ---------------------------------------------------------

   \* GPS QUALITY

   \* ---------------------------------------------------------

   \*/



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



  /\*

   \* ---------------------------------------------------------

   \* CAPTURE SUCCESS AUTO HIDE

   \* ---------------------------------------------------------

   \*/



  useEffect(() => {

    if (!captureSuccess) return;



    const timer = setTimeout(() => {

      setCaptureSuccess(false);

    }, 2500);



    return () => clearTimeout(timer);

  }, [captureSuccess]);



  /\*

   \* ---------------------------------------------------------

   \* CAPTURE

   \* ---------------------------------------------------------

   \*/



  const handleCapture = async () => {

    if (!isStreaming || isProcessing) return;



    setIsProcessing(true);



    setShutterFlash(true);



    setTimeout(() => {

      setShutterFlash(false);

    }, 180);



    try {

      /\*

       \* 1. Capture camera frame

       \*/



      const frameDataUrl = captureFrame();



      if (!frameDataUrl) {

        throw new Error(

          'Camera frame not ready. Ensure camera permission is granted.'

        );

      }



      /\*

       \* 2. Prepare GPS location

       \*/



      let currentLoc: GeoPhoto['location'] = location

        ? { ...location }

        : {

            latitude: 0,

            longitude: 0,

            accuracy: 999,

            timestamp: Date.now(),

          };



      /\*

       \* 3. Reverse geocode if needed

       \*/



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

          // Network failure should not block photo capture.

        }

      }



      /\*

       \* 4. Generate photo number

       \*/



      let pNum = 'EVT-001';



      if (activeEvent) {

        const {

          photoNumber,

          updatedEvent,

        } = await getNextPhotoNumber(activeEvent);



        pNum = photoNumber;



        setActiveEvent(updatedEvent);

      }



      /\*

       \* 5. Generate stamped image

       \*/



      const stamped = await generateStampedImage({

        imageSrc: frameDataUrl,

        event: activeEvent || undefined,

        photoNumber: pNum,

        location: currentLoc,

        timestamp: Date.now(),

        stampStyle: stampStyle,

        settings: settings,

      });



      /\*

       \* 6. Original image blob

       \*/



      const originalBlob = dataURLtoBlob(frameDataUrl);



      /\*

       \* 7. Create photo object

       \*/



      const newPhoto: GeoPhoto = {

        id:

          'photo\_' +

          Date.now() +

          '\_' +

          Math.random().toString(36).substr(2, 4),



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



      /\*

       \* 8. Save to IndexedDB

       \*/



      await db.photos.put(newPhoto);



      /\*

       \* 9. Update thumbnail

       \*/



      setLastCapturedPhotoUrl(stamped.dataUrl);



      /\*

       \* 10. Capture success UI

       \*/



      setCaptureMessage(pNum);

      setCaptureSuccess(true);



      showToast(

        `Record ${pNum} captured and saved`,

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



  /\*

   \* ---------------------------------------------------------

   \* RENDER

   \* ---------------------------------------------------------

   \*/



  return (

    <div data-camera-orientation={isLandscape ? "landscape" : "portrait"} className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-hidden select-none w-screen h-[100dvh]">



      {/\* =====================================================

          CAMERA VIDEO

      ====================================================== \*/}



      <video

        ref={videoRef}

        playsInline

        muted

        className={`absolute inset-0 w-full h-full object-cover ${

          facingMode === 'user' ? 'scale-x-[-1]' : ''

        }`}

      />



      {/\* =====================================================

          CAMERA DARK GRADIENTS

      ====================================================== \*/}



      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/50 via-transparent to-black/70" />



      {/\* =====================================================

          GRID

      ====================================================== \*/}



      {showGrid && (

        <div className="absolute inset-0 z-10 pointer-events-none">



          {/\* Vertical lines \*/}



          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/25" />



          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/25" />



          {/\* Horizontal lines \*/}



          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/25" />



          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/25" />



        </div>

      )}



      {/\* =====================================================

          CENTER FOCUS RETICLE

      ====================================================== \*/}



      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">



        <div className="relative w-16 h-16 opacity-70">



          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/70 -translate-x-1/2" />



          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/70 -translate-y-1/2" />



          <div className="absolute inset-3 border border-white/80 rounded-sm" />



        </div>



      </div>



      {/\* =====================================================

          LEVEL INDICATOR

      ====================================================== \*/}



      <div className="absolute z-20 top-[19%] left-1/2 -translate-x-1/2 pointer-events-none">



        <div className="flex flex-col items-center gap-1">



          <div className="relative w-28 h-4">



            <div className="absolute left-0 right-0 top-1/2 h-px bg-white/40" />



            <div

              className={`absolute left-1/2 top-1/2 w-10 h-1 rounded-full -translate-x-1/2 -translate-y-1/2 ${

                isLevelled

                  ? 'bg-emerald-400'

                  : 'bg-amber-400'

              }`}

            />



            <div className="absolute left-0 top-1/2 w-1 h-1 rounded-full bg-white/70 -translate-y-1/2" />



            <div className="absolute right-0 top-1/2 w-1 h-1 rounded-full bg-white/70 -translate-y-1/2" />



          </div>



          {isLevelled && (

            <span className="text-[8px] uppercase tracking-widest text-emerald-300/80">

              Level

            </span>

          )}



        </div>



      </div>



      {/\* =====================================================

          SHUTTER FLASH

      ====================================================== \*/}



      {shutterFlash && (

        <div className="absolute inset-0 z-50 bg-white opacity-80 pointer-events-none" />

      )}



      {/\* =====================================================

          TOP HEADER

      ====================================================== \*/}



      <div className="relative z-30 px-3 sm:px-5 pt-3 sm:pt-4">



        <div className="flex items-center justify-between gap-2">



          {/\* Close \*/}



          <button

            onClick={() => setActiveTab('dashboard')}

            className="

              flex items-center gap-2

              px-3 py-2

              rounded-xl

              bg-black/55

              border border-white/15

              backdrop-blur-xl

              hover:bg-black/75

              active:scale-95

              transition-all

            "

            title="Exit Camera Mode"

          >

            <X className="w-4 h-4" />



            <span className="hidden sm:inline text-xs font-medium">

              Close

            </span>

          </button>



          {/\* Center GPS \*/}



          <div

            className={`

              flex items-center gap-2

              px-3 py-2

              rounded-xl

              bg-black/55

              border

              backdrop-blur-xl

              ${

                isGpsSearching

                  ? 'border-amber-400/30'

                  : hasCoords

                  ? 'border-emerald-400/30'

                  : 'border-white/15'

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



              <span className="text-[9px] uppercase tracking-widest text-slate-400">

                GPS

              </span>



              <span

                className={`text-[11px] font-medium ${

                  hasCoords

                    ? 'text-emerald-300'

                    : 'text-slate-300'

                }`}

              >

                {isGpsSearching

                  ? 'Searching'

                  : hasCoords

                  ? gpsQualityText

                  : 'Unavailable'}

              </span>



            </div>



            {hasCoords && accFormatted && (

              <span className="text-[10px] font-mono text-white/80">

                {accFormatted}

              </span>

            )}



          </div>



          {/\* Right Status \*/}



          <div className="flex items-center gap-2">



            {/\* Network \*/}



            <div

              className="

                flex items-center gap-1.5

                px-2.5 py-2

                rounded-xl

                bg-black/55

                border border-white/15

                backdrop-blur-xl

              "

            >

              {isOnline ? (

                <Wifi className="w-3.5 h-3.5 text-emerald-400" />

              ) : (

                <WifiOff className="w-3.5 h-3.5 text-amber-400" />

              )}



              <span className="hidden md:inline text-[10px]">

                {isOnline ? 'Online' : 'Offline'}

              </span>

            </div>



            {/\* Time \*/}



            <div

              className="

                px-2.5 py-2

                rounded-xl

                bg-black/55

                border border-white/15

                backdrop-blur-xl

                font-mono

                text-[10px]

                sm:text-[11px]

              "

            >

              {currentTimeStr}

            </div>



          </div>



        </div>



      </div>



      {/\* =====================================================

          CAMERA ERROR

      ====================================================== \*/}



      {cameraError && (

        <div className="absolute z-40 inset-x-4 top-1/2 -translate-y-1/2">



          <div

            className="

              mx-auto

              max-w-md

              p-5

              rounded-2xl

              bg-black/90

              border border-red-500/40

              backdrop-blur-xl

              text-center

              shadow-2xl

            "

          >



            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/10 flex items-center justify-center">



              <AlertTriangle className="w-6 h-6 text-red-400" />



            </div>



            <p className="text-sm font-semibold">

              Camera Access Notice

            </p>



            <p className="mt-1 text-xs text-slate-300 leading-relaxed">

              {cameraError}

            </p>



          </div>



        </div>

      )}



      {/\* =====================================================

          LIVE STAMP

      ====================================================== \*/}



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

            w-auto

            sm:max-w-md

            pointer-events-none

          "

        >



          <div

            className="

              rounded-xl

              bg-black/60

              border border-white/15

              backdrop-blur-md

              shadow-xl

              px-3.5

              py-3

              sm:px-4

              sm:py-3.5

            "

          >



            {/\* Header \*/}



            <div className="flex items-start justify-between gap-4">



              <div className="min-w-0">



                <h3 className="font-semibold text-xs sm:text-sm tracking-wide truncate">

                  {schoolNameText}

                </h3>



                {eventNameText && (

                  <p className="mt-0.5 text-[10px] sm:text-xs text-slate-300 truncate">

                    {eventNameText}

                  </p>

                )}



              </div>



              <div className="shrink-0 flex items-center gap-1.5">



                <div

                  className={`w-1.5 h-1.5 rounded-full ${

                    hasCoords

                      ? 'bg-emerald-400'

                      : 'bg-amber-400'

                  }`}

                />



                <span className="text-[9px] uppercase tracking-wider text-slate-400">

                  {hasCoords ? 'GPS' : 'No GPS'}

                </span>



              </div>



            </div>



            <div className="h-px bg-white/15 my-2.5" />



            {/\* Information \*/}



            <div className="space-y-1 font-mono text-[9px] sm:text-[10px] leading-relaxed">



              {departmentText && (

                <div className="grid grid-cols-[70px_8px_1fr]">

                  <span className="text-slate-400">

                    Department

                  </span>



                  <span>:</span>



                  <span className="text-white truncate">

                    {departmentText}

                  </span>

                </div>

              )}



              {organizerText && (

                <div className="grid grid-cols-[70px_8px_1fr]">

                  <span className="text-slate-400">

                    Organizer

                  </span>



                  <span>:</span>



                  <span className="text-white truncate">

                    {organizerText}

                  </span>

                </div>

              )}



              {liveAddressText && (

                <div className="grid grid-cols-[70px_8px_1fr]">

                  <span className="text-slate-400">

                    Location

                  </span>



                  <span>:</span>



                  <span className="text-white line-clamp-2">

                    {liveAddressText}

                  </span>

                </div>

              )}



              {latFormatted && (

                <div className="grid grid-cols-[70px_8px_1fr]">

                  <span className="text-slate-400">

                    Latitude

                  </span>



                  <span>:</span>



                  <span className="text-white">

                    {latFormatted}

                  </span>

                </div>

              )}



              {lonFormatted && (

                <div className="grid grid-cols-[70px_8px_1fr]">

                  <span className="text-slate-400">

                    Longitude

                  </span>



                  <span>:</span>



                  <span className="text-white">

                    {lonFormatted}

                  </span>

                </div>

              )}



              {accFormatted && (

                <div className="grid grid-cols-[70px_8px_1fr]">

                  <span className="text-slate-400">

                    Accuracy

                  </span>



                  <span>:</span>



                  <span className="text-emerald-300">

                    {accFormatted}

                  </span>

                </div>

              )}



              {altFormatted && (

                <div className="grid grid-cols-[70px_8px_1fr]">

                  <span className="text-slate-400">

                    Altitude

                  </span>



                  <span>:</span>



                  <span className="text-white">

                    {altFormatted}

                  </span>

                </div>

              )}



              <div className="grid grid-cols-[70px_8px_1fr]">

                <span className="text-slate-400">

                  Date

                </span>



                <span>:</span>



                <span className="text-white">

                  {currentDateStr}

                </span>

              </div>



              <div className="grid grid-cols-[70px_8px_1fr]">

                <span className="text-slate-400">

                  Time

                </span>



                <span>:</span>



                <span className="text-white">

                  {currentTimeStr}

                </span>

              </div>



              <div className="grid grid-cols-[70px_8px_1fr]">

                <span className="text-slate-400">

                  Photo ID

                </span>



                <span>:</span>



                <span className="text-white font-semibold">

                  {photoNumPreview}

                </span>

              </div>



            </div>



          </div>



        </div>

      )}



      {/\* =====================================================

          TOP CAMERA TOOLS

      ====================================================== \*/}



      <div className="absolute z-30 top-20 sm:top-24 right-3 sm:right-5">



        <div

          className="

            flex flex-col

            gap-2

            p-1.5

            rounded-2xl

            bg-black/45

            border border-white/10

            backdrop-blur-xl

          "

        >



          {/\* Grid \*/}



          <button

            onClick={() => setShowGrid((prev) => !prev)}

            className={`

              w-10 h-10

              rounded-xl

              flex items-center justify-center

              transition-all

              active:scale-90

              ${

                showGrid

                  ? 'bg-white text-black'

                  : 'bg-white/5 text-white hover:bg-white/15'

              }

            `}

            title="Toggle Camera Grid"

          >

            <Grid3X3 className="w-4 h-4" />

          </button>



          {/\* Stamp \*/}



          <button

            onClick={() => setShowStamp((prev) => !prev)}

            className={`

              w-10 h-10

              rounded-xl

              flex items-center justify-center

              transition-all

              active:scale-90

              ${

                showStamp

                  ? 'bg-white text-black'

                  : 'bg-white/5 text-white hover:bg-white/15'

              }

            `}

            title="Toggle Information Overlay"

          >

            <Info className="w-4 h-4" />

          </button>



          {/\* GPS \*/}



          <div

            className="

              w-10 h-10

              rounded-xl

              bg-white/5

              flex items-center justify-center

            "

            title={

              hasCoords

                ? `GPS accuracy ${accFormatted || 'unknown'}`

                : 'GPS unavailable'

            }

          >

            <Navigation

              className={`

                w-4 h-4

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



      {/\* =====================================================

          CAPTURE SUCCESS

      ====================================================== \*/}



      {captureSuccess && (

        <div

          className="

            absolute

            z-40

            top-20

            sm:top-24

            left-1/2

            -translate-x-1/2

            pointer-events-none

          "

        >



          <div

            className="

              flex items-center gap-2

              px-4 py-2.5

              rounded-full

              bg-black/80

              border border-emerald-400/30

              backdrop-blur-xl

              shadow-2xl

            "

          >



            <CheckCircle2 className="w-4 h-4 text-emerald-400" />



            <div className="flex flex-col">



              <span className="text-[10px] font-semibold text-emerald-300">

                PHOTO SAVED

              </span>



              <span className="text-[9px] text-white/70 font-mono">

                {captureMessage}

              </span>



            </div>



          </div>



        </div>

      )}



      {/\* =====================================================

          BOTTOM CAMERA CONTROLS

      ====================================================== \*/}



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

          pt-10

          bg-gradient-to-t

          from-black/95

          via-black/60

          to-transparent

        "

      >



        <div className="flex items-center justify-between max-w-xl mx-auto">



          {/\* =================================================

              GALLERY

          ================================================== \*/}



          <button

            onClick={() => setActiveTab('gallery')}

            className="

              relative

              w-14

              h-14

              sm:w-16

              sm:h-16

              rounded-2xl

              bg-black/65

              border border-white/20

              overflow-hidden

              flex items-center justify-center

              text-slate-300

              hover:text-white

              hover:bg-black/80

              transition-all

              active:scale-90

              shadow-xl

            "

            title="Open Inspection Gallery"

          >



            {lastCapturedPhotoUrl ? (

              <img

                src={lastCapturedPhotoUrl}

                alt="Recent inspection"

                className="w-full h-full object-cover"

              />

            ) : (

              <Images className="w-6 h-6" />

            )}



            {/\* Gallery indicator \*/}



            <div

              className="

                absolute

                bottom-1.5

                right-1.5

                w-2

                h-2

                rounded-full

                bg-white

                shadow

              "

            />



          </button>



          {/\* =================================================

              CAPTURE BUTTON

          ================================================== \*/}



          <button

            onClick={handleCapture}

            disabled={!isStreaming || isProcessing}

            className="

              relative

              w-20

              h-20

              sm:w-[88px]

              sm:h-[88px]

              rounded-full

              border-[4px]

              border-white

              bg-white/10

              flex items-center justify-center

              shadow-[0_0_30px_rgba(0,0,0,0.5)]

              active:scale-90

              transition-all

              disabled:opacity-40

              disabled:active:scale-100

            "

            title="Capture Official Photo"

          >



            <div

              className="

                w-[62px]

                h-[62px]

                sm:w-[70px]

                sm:h-[70px]

                rounded-full

                bg-white

                flex items-center justify-center

                transition-transform

                group-hover:scale-95

              "

            >



              {isProcessing ? (

                <div

                  className="

                    w-7

                    h-7

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

                    w-12

                    h-12

                    sm:w-14

                    sm:h-14

                    rounded-full

                    bg-slate-200

                  "

                />

              )}



            </div>



          </button>



          {/\* =================================================

              CAMERA CONTROLS

          ================================================== \*/}



          <div className="flex items-center gap-2">



            {/\* Torch \*/}



            {hasTorch && (

              <button

                onClick={toggleTorch}

                className={`

                  w-12

                  h-12

                  sm:w-14

                  sm:h-14

                  rounded-2xl

                  border

                  flex items-center justify-center

                  transition-all

                  active:scale-90

                  ${

                    torchOn

                      ? 'bg-white text-black border-white'

                      : 'bg-black/65 text-white border-white/20'

                  }

                `}

                title="Toggle Flash/Torch"

              >

                {torchOn ? (

                  <Zap className="w-5 h-5 fill-current" />

                ) : (

                  <ZapOff className="w-5 h-5" />

                )}

              </button>

            )}



            {/\* Camera switch \*/}



            <button

              onClick={toggleCamera}

              className="

                w-12

                h-12

                sm:w-14

                sm:h-14

                rounded-2xl

                bg-black/65

                border border-white/20

                flex items-center justify-center

                text-white

                hover:bg-black/80

                transition-all

                active:scale-90

              "

              title="Switch Front/Rear Camera"

            >

              <RefreshCw className="w-5 h-5" />

            </button>



          </div>



        </div>



        {/\* Bottom helper text \*/}



        <div className="mt-3 text-center">



          <span className="text-[9px] sm:text-[10px] text-white/40 tracking-wide">

            {isProcessing

              ? 'PROCESSING PHOTO...'

              : hasCoords

              ? `READY • ${gpsQualityText.toUpperCase()} GPS`

              : 'READY • WAITING FOR GPS'}

          </span>



        </div>



      </div>



    </div>

  );

};