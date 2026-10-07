import { useState, useEffect, useRef, useCallback } from 'react';

export interface CapturedFrameResult {
  dataUrl: string;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Play shutter feedback sound using Web Audio API (100% offline, pure synthesized)
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
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // Audio playback quiet fallback
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
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
            frameRate: { ideal: 30 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.setAttribute('playsinline', '');

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
   * Captures a camera frame with predictable, fixed image structure
   * for both portrait and landscape orientation.
   *
   * Portrait output: 1080 x 1440
   * Landscape output: 1920 x 1080
   */
  const captureFrame = useCallback(
    (
      targetOrientation?: 'portrait' | 'landscape'
    ): CapturedFrameResult | null => {
      const video = videoRef.current;

      if (!video || !isStreaming) return null;

      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;

      // Ensure video has real frame data before capturing
      if (!vWidth || !vHeight || video.readyState < 2) {
        return null;
      }

      playShutterSound();

      const isPortrait = targetOrientation
        ? targetOrientation === 'portrait'
        : vHeight > vWidth;

      const orientation: 'portrait' | 'landscape' = isPortrait
        ? 'portrait'
        : 'landscape';

      const targetWidth = isPortrait ? 1080 : 1920;
      const targetHeight = isPortrait ? 1440 : 1080;

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');

      if (!ctx) return null;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Handle front camera mirror
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      // Center crop / fit video into target frame with no distortion
      const targetAspect = targetWidth / targetHeight;
      const videoAspect = vWidth / vHeight;

      let sx = 0;
      let sy = 0;
      let sWidth = vWidth;
      let sHeight = vHeight;

      if (videoAspect > targetAspect) {
        // Video is wider than target frame: crop horizontal excess
        sWidth = vHeight * targetAspect;
        sx = (vWidth - sWidth) / 2;
      } else {
        // Video is taller than target frame: crop vertical excess
        sHeight = vWidth / targetAspect;
        sy = (vHeight - sHeight) / 2;
      }

      ctx.drawImage(
        video,
        sx,
        sy,
        sWidth,
        sHeight,
        0,
        0,
        targetWidth,
        targetHeight
      );

      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.95),
        width: targetWidth,
        height: targetHeight,
        orientation,
      };
    },
    [isStreaming, facingMode, playShutterSound]
  );

  // Keep latest callbacks in refs so mount effect does not depend on them
  const startStreamRef = useRef(startStream);
  const stopStreamRef = useRef(stopStream);

  useEffect(() => {
    startStreamRef.current = startStream;
    stopStreamRef.current = stopStream;
  }, [startStream, stopStream]);

  useEffect(() => {
    startStreamRef.current();

    return () => {
      stopStreamRef.current();
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