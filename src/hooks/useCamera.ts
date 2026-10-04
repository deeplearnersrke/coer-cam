import { useState, useEffect, useRef, useCallback } from 'react';

const PORTRAIT_WIDTH = 1200;
const PORTRAIT_HEIGHT = 1600;

const LANDSCAPE_WIDTH = 1600;
const LANDSCAPE_HEIGHT = 1200;

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
    'environment'
  );
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
   * Returns the current SCREEN orientation angle in degrees.
   * 0   -> portrait (natural)
   * 90  -> landscape (rotated left)
   * 180 -> portrait (upside-down)
   * 270 -> landscape (rotated right)
   */
  const getOrientationAngle = useCallback((): number => {
    if (typeof window === 'undefined') return 0;

    let angle = 0;

    if (
      typeof screen !== 'undefined' &&
      screen.orientation &&
      typeof screen.orientation.angle === 'number'
    ) {
      angle = screen.orientation.angle;
    } else if (
      typeof (window as any).orientation === 'number'
    ) {
      angle = (window as any).orientation;
    } else if (window.innerWidth > window.innerHeight) {
      angle = 90;
    }

    angle = ((angle % 360) + 360) % 360;
    return angle;
  }, []);

  /**
   * Detects whether the DEVICE is currently being held in portrait
   * or landscape mode.
   */
  const isDevicePortrait = useCallback((): boolean => {
    if (typeof window === 'undefined') return true;

    if (
      typeof screen !== 'undefined' &&
      screen.orientation &&
      typeof screen.orientation.type === 'string'
    ) {
      return screen.orientation.type.startsWith('portrait');
    }

    return window.innerHeight >= window.innerWidth;
  }, []);

  /**
   * Capture a frame from the camera and normalize it into a
   * standard 1200x1600 (portrait) OR 1600x1200 (landscape) canvas.
   *
   * The source sensor frame is rotated to upright orientation and
   * then center-cropped to fill the target dimensions.
   */
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;

    if (!video || !isStreaming) return null;

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;

    if (!sourceWidth || !sourceHeight) {
      console.warn(
        'Camera frame is not ready:',
        sourceWidth,
        sourceHeight
      );
      return null;
    }

    playShutterSound();

    const angle = getOrientationAngle();
    const devicePortrait = isDevicePortrait();

    // Determine whether the SENSOR frame is being delivered in a
    // rotated orientation (common on Android). If the device is
    // portrait but the sensor frame is landscape, we must rotate.
    let effectiveAngle = angle;

    if (
      devicePortrait &&
      sourceWidth > sourceHeight &&
      (angle === 0 || angle === 180)
    ) {
      // Sensor is landscape but device is portrait → rotate 90°
      effectiveAngle = 90;
    }

    if (
      !devicePortrait &&
      sourceHeight > sourceWidth &&
      (angle === 0 || angle === 180)
    ) {
      // Sensor is portrait but device is landscape → rotate 90°
      effectiveAngle = 90;
    }

    const normalizedAngle =
      effectiveAngle === 90 ||
      effectiveAngle === 180 ||
      effectiveAngle === 270
        ? effectiveAngle
        : 0;

    const swapDimensions =
      normalizedAngle === 90 || normalizedAngle === 270;

    // ── 1. Rotate the raw sensor frame into upright orientation ──
    const rotatedCanvas = document.createElement('canvas');

    rotatedCanvas.width = swapDimensions
      ? sourceHeight
      : sourceWidth;

    rotatedCanvas.height = swapDimensions
      ? sourceWidth
      : sourceHeight;

    const rotatedCtx = rotatedCanvas.getContext('2d');

    if (!rotatedCtx) return null;

    rotatedCtx.save();

    if (normalizedAngle === 90) {
      rotatedCtx.translate(rotatedCanvas.width, 0);
      rotatedCtx.rotate(Math.PI / 2);
    } else if (normalizedAngle === 180) {
      rotatedCtx.translate(
        rotatedCanvas.width,
        rotatedCanvas.height
      );
      rotatedCtx.rotate(Math.PI);
    } else if (normalizedAngle === 270) {
      rotatedCtx.translate(0, rotatedCanvas.height);
      rotatedCtx.rotate(-Math.PI / 2);
    }

    // Mirror only the front camera.
    if (facingMode === 'user') {
      rotatedCtx.translate(sourceWidth, 0);
      rotatedCtx.scale(-1, 1);
    }

    rotatedCtx.drawImage(
      video,
      0,
      0,
      sourceWidth,
      sourceHeight
    );

    rotatedCtx.restore();

    // ── 2. Choose final output size based on DEVICE orientation ──
    const outputWidth = devicePortrait
      ? PORTRAIT_WIDTH
      : LANDSCAPE_WIDTH;

    const outputHeight = devicePortrait
      ? PORTRAIT_HEIGHT
      : LANDSCAPE_HEIGHT;

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;

    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) return null;

    // ── 3. Center-crop the rotated frame to fill the output ──
    const normalizedWidth = rotatedCanvas.width;
    const normalizedHeight = rotatedCanvas.height;

    const sourceAspect = normalizedWidth / normalizedHeight;
    const outputAspect = outputWidth / outputHeight;

    let drawWidth: number;
    let drawHeight: number;

    if (sourceAspect > outputAspect) {
      drawHeight = outputHeight;
      drawWidth = drawHeight * sourceAspect;
    } else {
      drawWidth = outputWidth;
      drawHeight = drawWidth / sourceAspect;
    }

    const offsetX = (outputWidth - drawWidth) / 2;
    const offsetY = (outputHeight - drawHeight) / 2;

    outputCtx.drawImage(
      rotatedCanvas,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight
    );

    console.log('[CAPTURE]', {
      angle,
      effectiveAngle,
      devicePortrait,
      source: `${sourceWidth}x${sourceHeight}`,
      output: `${outputWidth}x${outputHeight}`,
    });

    return outputCanvas.toDataURL('image/jpeg', 0.95);
  }, [
    isStreaming,
    facingMode,
    playShutterSound,
    getOrientationAngle,
    isDevicePortrait,
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