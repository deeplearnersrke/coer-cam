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
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;

      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        200,
        ctx.currentTime + 0.08
      );

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + 0.08
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Optional audio feedback.
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

        const stream =
          await navigator.mediaDevices.getUserMedia(constraints);

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

        setError(
          err?.message ||
            'Unable to access camera. Please check permissions.'
        );

        setIsStreaming(false);
      }
    },
    [facingMode, stopStream]
  );

  const toggleCamera = useCallback(() => {
    const nextMode =
      facingMode === 'environment' ? 'user' : 'environment';

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
   * Get device/screen orientation.
   *
   * screen.orientation.angle is the primary source.
   * viewport dimensions are used as a fallback.
   */
  const getCurrentOrientation = useCallback(() => {
    if (typeof window === 'undefined') {
      return {
        angle: 0,
        landscape: false,
      };
    }

    let angle = 0;

    if (
      typeof screen !== 'undefined' &&
      screen.orientation &&
      typeof screen.orientation.angle === 'number'
    ) {
      angle = screen.orientation.angle;
    } else if (typeof (window as any).orientation === 'number') {
      angle = (window as any).orientation;
    } else {
      angle =
        window.innerWidth > window.innerHeight
          ? 90
          : 0;
    }

    angle = ((angle % 360) + 360) % 360;

    let landscape =
      angle === 90 || angle === 270;

    // Fallback for browsers reporting angle 0 incorrectly.
    if (angle === 0) {
      landscape =
        window.innerWidth > window.innerHeight;
    }

    return {
      angle,
      landscape,
    };
  }, []);

  /**
   * Capture camera frame and normalize it to
   * the current device orientation.
   */
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;

    if (!video || !isStreaming) {
      return null;
    }

    if (!video.videoWidth || !video.videoHeight) {
      console.warn(
        'Camera frame is not ready:',
        video.videoWidth,
        video.videoHeight
      );

      return null;
    }

    playShutterSound();

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;

    const { angle, landscape } =
      getCurrentOrientation();

    console.log('[CAMERA CAPTURE]', {
      angle,
      landscape,
      sourceWidth,
      sourceHeight,
      facingMode,
    });

    /*
     * IMPORTANT:
     *
     * We do NOT use sourceWidth/sourceHeight
     * to decide the rotation.
     *
     * The device orientation determines the
     * desired final orientation.
     */

    const rotate =
      angle === 90
        ? 90
        : angle === 180
        ? 180
        : angle === 270
        ? 270
        : 0;

    const swapDimensions =
      rotate === 90 || rotate === 270;

    const canvas = document.createElement('canvas');

    canvas.width = swapDimensions
      ? sourceHeight
      : sourceWidth;

    canvas.height = swapDimensions
      ? sourceWidth
      : sourceHeight;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    ctx.save();

    /*
     * Rotate the raw camera pixels.
     */

    if (rotate === 90) {
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
    } else if (rotate === 180) {
      ctx.translate(canvas.width, canvas.height);
      ctx.rotate(Math.PI);
    } else if (rotate === 270) {
      ctx.translate(0, canvas.height);
      ctx.rotate(-Math.PI / 2);
    }

    /*
     * Front camera mirroring.
     *
     * Apply mirroring in the camera coordinate
     * system before drawing the frame.
     */
    if (facingMode === 'user') {
      ctx.translate(sourceWidth, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      video,
      0,
      0,
      sourceWidth,
      sourceHeight
    );

    ctx.restore();

    const result = canvas.toDataURL(
      'image/jpeg',
      0.95
    );

    console.log('[CAMERA RESULT]', {
      width: canvas.width,
      height: canvas.height,
      orientation:
        canvas.width > canvas.height
          ? 'LANDSCAPE'
          : 'PORTRAIT',
      rotationApplied: rotate,
      deviceLandscape: landscape,
    });

    return result;
  }, [
    isStreaming,
    facingMode,
    playShutterSound,
    getCurrentOrientation,
  ]);

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