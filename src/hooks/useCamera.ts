import { useState, useEffect, useRef, useCallback } from 'react';

export interface CapturedFrameResult {
  dataUrl: string;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

type OrientationMode = 'portrait' | 'landscape';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playShutterSound = useCallback(() => {
    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx: AudioContext = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
      osc.onended = () => void ctx.close().catch(() => undefined);
    } catch {
      // Sound is optional; capture must still work without it.
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsStreaming(false);
    setHasTorch(false);
    setTorchOn(false);
  }, []);

  const startStream = useCallback(
    async (mode: 'user' | 'environment' = facingMode) => {
      stopStream();
      setError(null);

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not supported by this browser. Use HTTPS and a supported browser.');
        }

        // These are preview-stream preferences only. Full-resolution still
        // capture is attempted separately through ImageCapture.takePhoto().
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          throw new Error('Camera preview is not ready. Please reopen camera mode.');
        }

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        await video.play();
        setIsStreaming(true);

        const track = stream.getVideoTracks()[0];
        if (track && 'getCapabilities' in track) {
          try {
            const capabilities = (track as any).getCapabilities();
            setHasTorch(Boolean(capabilities?.torch));
          } catch {
            setHasTorch(false);
          }
        }
      } catch (err: any) {
        console.error('Camera stream error:', err);
        setError(err?.message || 'Unable to access camera. Please check camera permissions.');
        setIsStreaming(false);
      }
    },
    [facingMode, stopStream]
  );

  const toggleCamera = useCallback(() => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    void startStream(nextMode);
  }, [facingMode, startStream]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !hasTorch) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({ advanced: [{ torch: nextState }] });
      setTorchOn(nextState);
    } catch (e) {
      console.error('Failed to toggle torch:', e);
    }
  }, [hasTorch, torchOn]);

  /**
   * Legacy video-frame capture fallback.
   * Uses the actual stream dimensions rather than forcing every capture into
   * a fixed 1920x1080 / 1080x1440 canvas.
   */
  const captureFrame = useCallback(
    (targetOrientation?: OrientationMode): CapturedFrameResult | null => {
      const video = videoRef.current;
      if (!video || !isStreaming) return null;

      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      if (!sourceWidth || !sourceHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return null;
      }

      playShutterSound();

      const sourceIsLandscape = sourceWidth >= sourceHeight;
      const orientation: OrientationMode =
        targetOrientation ?? (sourceIsLandscape ? 'landscape' : 'portrait');
      const rotateSource = sourceIsLandscape !== (orientation === 'landscape');
      const width = rotateSource ? sourceHeight : sourceWidth;
      const height = rotateSource ? sourceWidth : sourceHeight;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.save();

      if (rotateSource) {
        if (sourceIsLandscape) {
          ctx.translate(width, 0);
          ctx.rotate(Math.PI / 2);
        } else {
          ctx.translate(0, height);
          ctx.rotate(-Math.PI / 2);
        }
      }

      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, sourceWidth, sourceHeight);
      ctx.restore();

      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.98),
        width,
        height,
        orientation: width > height ? 'landscape' : 'portrait',
      };
    },
    [isStreaming, facingMode, playShutterSound]
  );

  /**
   * Preferred capture path: request a full-resolution still photo from the
   * active camera when supported. If unsupported or rejected, use the video
   * frame fallback above. Native dimensions are preserved; no fixed-size
   * output canvas is imposed.
   */
  const capturePhoto = useCallback(
    async (targetOrientation?: OrientationMode): Promise<CapturedFrameResult | null> => {
      const track = streamRef.current?.getVideoTracks()[0];

      if (track && typeof (window as any).ImageCapture === 'function') {
        try {
          const ImageCaptureClass = (window as any).ImageCapture;
          const imageCapture = new ImageCaptureClass(track);
          const photoBlob: Blob = await imageCapture.takePhoto();

          if (!photoBlob || photoBlob.size === 0) {
            throw new Error('Camera returned an empty still photo.');
          }

          // createImageBitmap applies the image's orientation metadata on
          // browsers that support imageOrientation: from-image.
          let bitmap: ImageBitmap;
          try {
            bitmap = await createImageBitmap(photoBlob, { imageOrientation: 'from-image' });
          } catch {
            bitmap = await createImageBitmap(photoBlob);
          }

          try {
            const sourceWidth = bitmap.width;
            const sourceHeight = bitmap.height;
            if (!sourceWidth || !sourceHeight) {
              throw new Error('The captured photo has invalid dimensions.');
            }

            const sourceIsLandscape = sourceWidth >= sourceHeight;
            const desiredOrientation =
              targetOrientation ?? (sourceIsLandscape ? 'landscape' : 'portrait');
            const rotateSource = sourceIsLandscape !== (desiredOrientation === 'landscape');
            const width = rotateSource ? sourceHeight : sourceWidth;
            const height = rotateSource ? sourceWidth : sourceHeight;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Could not create a canvas for the full-resolution photo.');

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.save();

            if (rotateSource) {
              if (sourceIsLandscape) {
                ctx.translate(width, 0);
                ctx.rotate(Math.PI / 2);
              } else {
                ctx.translate(0, height);
                ctx.rotate(-Math.PI / 2);
              }
            }

            // Preserve the app's existing mirrored-preview behavior for selfies.
            if (facingMode === 'user') {
              ctx.translate(width, 0);
              ctx.scale(-1, 1);
            }

            ctx.drawImage(bitmap, 0, 0, sourceWidth, sourceHeight);
            ctx.restore();

            playShutterSound();
            return {
              dataUrl: canvas.toDataURL('image/jpeg', 0.98),
              width,
              height,
              orientation: width > height ? 'landscape' : 'portrait',
            };
          } finally {
            bitmap.close();
          }
        } catch (err) {
          // Some browsers expose ImageCapture but fail to take a still photo.
          // Log and safely fall back to the live video frame.
          console.warn('High-resolution still capture unavailable; using video-frame fallback.', err);
        }
      }

      return captureFrame(targetOrientation);
    },
    [captureFrame, facingMode, playShutterSound]
  );

  const startStreamRef = useRef(startStream);
  const stopStreamRef = useRef(stopStream);

  useEffect(() => {
    startStreamRef.current = startStream;
    stopStreamRef.current = stopStream;
  }, [startStream, stopStream]);

  useEffect(() => {
    void startStreamRef.current();
    return () => stopStreamRef.current();
  }, []);

  return {
    videoRef,
    isStreaming,
    facingMode,
    hasTorch,
    torchOn,
    error,
    startStream,
    stopStream,
    toggleCamera,
    toggleTorch,
    captureFrame,
    capturePhoto,
  };
}
