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

  // Play a short, synthesized shutter sound. No external audio file is needed.
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
      osc.onended = () => {
        void ctx.close().catch(() => undefined);
      };
    } catch {
      // Shutter sound is optional; capture should still work if audio is unavailable.
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
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
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not supported by this browser. Use HTTPS and a supported browser.');
        }

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
          const capabilities = (track as any).getCapabilities();
          setHasTorch(Boolean(capabilities?.torch));
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
   * Captures a frame in the requested output orientation. If the camera's
   * source dimensions have the opposite orientation, the source is rotated
   * before cropping so the resulting image is upright rather than sideways.
   *
   * Output sizes: portrait 1080 x 1440; landscape 1920 x 1080.
   */
  const captureFrame = useCallback(
    (targetOrientation?: 'portrait' | 'landscape'): CapturedFrameResult | null => {
      const video = videoRef.current;
      if (!video || !isStreaming) return null;

      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      if (!sourceWidth || !sourceHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return null;
      }

      playShutterSound();

      // The caller's stable device-orientation decision takes precedence.
      // Without one, infer orientation from the actual camera frame dimensions.
      const orientation: 'portrait' | 'landscape' =
        targetOrientation ?? (sourceWidth >= sourceHeight ? 'landscape' : 'portrait');
      const targetWidth = orientation === 'landscape' ? 1920 : 1080;
      const targetHeight = orientation === 'landscape' ? 1080 : 1440;

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Rotate the source only when its dimensions conflict with the requested
      // output orientation. This avoids drawing a portrait source into a
      // landscape canvas (or vice versa) without first correcting its axes.
      const sourceIsLandscape = sourceWidth >= sourceHeight;
      const targetIsLandscape = orientation === 'landscape';
      const rotateSource = sourceIsLandscape !== targetIsLandscape;

      // After rotation, these are the dimensions used for aspect-ratio cropping.
      const orientedWidth = rotateSource ? sourceHeight : sourceWidth;
      const orientedHeight = rotateSource ? sourceWidth : sourceHeight;
      const targetAspect = targetWidth / targetHeight;
      const sourceAspect = orientedWidth / orientedHeight;

      let sx = 0;
      let sy = 0;
      let sWidth = orientedWidth;
      let sHeight = orientedHeight;

      if (sourceAspect > targetAspect) {
        sWidth = orientedHeight * targetAspect;
        sx = (orientedWidth - sWidth) / 2;
      } else if (sourceAspect < targetAspect) {
        sHeight = orientedWidth / targetAspect;
        sy = (orientedHeight - sHeight) / 2;
      }

      ctx.save();
      if (rotateSource) {
        // Rotate clockwise when changing landscape source to portrait output;
        // rotate counter-clockwise for portrait source to landscape output.
        if (sourceIsLandscape) {
          ctx.translate(targetWidth, 0);
          ctx.rotate(Math.PI / 2);
        } else {
          ctx.translate(0, targetHeight);
          ctx.rotate(-Math.PI / 2);
        }
      }

      // Mirror only the front-facing camera, and do so after orientation setup.
      // Use a separate transform so mirroring never changes the crop dimensions.
      if (facingMode === 'user') {
        ctx.translate(targetWidth, 0);
        ctx.scale(-1, 1);
      }

      // Draw the camera frame. The transformed source is clipped to the output canvas.
      // For matching source/output orientation this is a normal center crop.
      if (!rotateSource) {
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
      } else {
        // A rotated source needs its own temporary canvas so crop coordinates
        // are applied to the already-rotated pixels, not to the original axes.
        ctx.restore();
        const rotatedCanvas = document.createElement('canvas');
        rotatedCanvas.width = orientedWidth;
        rotatedCanvas.height = orientedHeight;
        const rotatedCtx = rotatedCanvas.getContext('2d');
        if (!rotatedCtx) return null;

        if (sourceIsLandscape) {
          rotatedCtx.translate(orientedWidth, 0);
          rotatedCtx.rotate(Math.PI / 2);
        } else {
          rotatedCtx.translate(0, orientedHeight);
          rotatedCtx.rotate(-Math.PI / 2);
        }
        rotatedCtx.drawImage(video, 0, 0, sourceWidth, sourceHeight);

        ctx.save();
        if (facingMode === 'user') {
          ctx.translate(targetWidth, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(
          rotatedCanvas,
          sx,
          sy,
          sWidth,
          sHeight,
          0,
          0,
          targetWidth,
          targetHeight
        );
      }
      ctx.restore();

      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.95),
        width: targetWidth,
        height: targetHeight,
        orientation,
      };
    },
    [isStreaming, facingMode, playShutterSound]
  );

  // Keep latest callbacks in refs so the mount effect can clean up correctly.
  const startStreamRef = useRef(startStream);
  const stopStreamRef = useRef(stopStream);

  useEffect(() => {
    startStreamRef.current = startStream;
    stopStreamRef.current = stopStream;
  }, [startStream, stopStream]);

  useEffect(() => {
    void startStreamRef.current();
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
