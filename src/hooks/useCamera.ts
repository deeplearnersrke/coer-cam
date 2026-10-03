import { useState, useEffect, useRef, useCallback } from 'react';

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
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
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
    } catch {
      // Audio feedback is optional.
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsStreaming(false);
    setHasTorch(false);
    setTorchOn(false);
  }, []);

  const startStream = useCallback(
    async (mode: 'user' | 'environment' = facingMode) => {
      stopStream();
      setError(null);

      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setIsStreaming(true);

        const track = stream.getVideoTracks()[0];
        if (track && 'getCapabilities' in track) {
          const capabilities = (track as any).getCapabilities();
          if (capabilities?.torch) {
            setHasTorch(true);
          }
        }
      } catch (err: any) {
        console.error('Camera stream error:', err);
        setError(err?.message || 'Unable to access camera. Please check permissions.');
        setIsStreaming(false);
      }
    },
    [facingMode, stopStream]
  );

  const toggleCamera = useCallback(() => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startStream(nextMode);
  }, [facingMode, startStream]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !hasTorch) return;

    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (e) {
      console.error('Failed to toggle torch:', e);
    }
  }, [hasTorch, torchOn]);

  /**
   * Read orientation at the exact moment Capture is pressed.
   * This deliberately does not use React orientation state.
   */
  const getCurrentOrientation = useCallback(() => {
    if (typeof window === 'undefined') {
      return { angle: 0, landscape: false };
    }

    let angle = 0;

    if (screen.orientation && typeof screen.orientation.angle === 'number') {
      angle = screen.orientation.angle;
    }

    // iOS/Safari fallback.
    if (angle === 0 && typeof (window as any).orientation === 'number') {
      angle = (window as any).orientation;
    }

    angle = ((angle % 360) + 360) % 360;

    const viewportLandscape = window.innerWidth > window.innerHeight;

    return {
      angle,
      landscape:
        angle === 90 || angle === 270
          ? true
          : angle === 0 || angle === 180
            ? false
            : viewportLandscape,
    };
  }, []);

  /**
   * Capture and normalize the actual camera pixels.
   * The stamp engine receives an image whose width/height match
   * the current physical device orientation.
   */
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;

    if (!video || !isStreaming) return null;

    if (!video.videoWidth || !video.videoHeight) {
      console.warn('Camera frame is not ready:', video.videoWidth, video.videoHeight);
      return null;
    }

    playShutterSound();

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const { angle, landscape: targetLandscape } = getCurrentOrientation();
    const sourceLandscape = sourceWidth > sourceHeight;

    console.log('[CAMERA CAPTURE]', {
      angle,
      targetLandscape,
      sourceWidth,
      sourceHeight,
      sourceLandscape,
      facingMode,
    });

    const needsRotation = sourceLandscape !== targetLandscape;

    const canvas = document.createElement('canvas');

    if (needsRotation) {
      canvas.width = sourceHeight;
      canvas.height = sourceWidth;
    } else {
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.save();

    if (!needsRotation) {
      // Normal capture. Mirror only the front camera.
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, sourceWidth, sourceHeight);
    } else if (targetLandscape && !sourceLandscape) {
      // Portrait camera buffer -> landscape output.
      ctx.translate(0, sourceWidth);
      ctx.rotate(-Math.PI / 2);

      if (facingMode === 'user') {
        ctx.translate(sourceHeight, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, sourceWidth, sourceHeight);
    } else {
      // Landscape camera buffer -> portrait output.
      ctx.translate(sourceHeight, 0);
      ctx.rotate(Math.PI / 2);

      if (facingMode === 'user') {
        ctx.translate(sourceWidth, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, sourceWidth, sourceHeight);
    }

    ctx.restore();

    const result = canvas.toDataURL('image/jpeg', 0.95);

    console.log('[CAMERA RESULT]', {
      width: canvas.width,
      height: canvas.height,
      orientation: canvas.width > canvas.height ? 'LANDSCAPE' : 'PORTRAIT',
      rotated: needsRotation,
    });

    return result;
  }, [isStreaming, facingMode, playShutterSound, getCurrentOrientation]);

  useEffect(() => {
    startStream();
    return () => {
      stopStream();
    };
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
  };
}
