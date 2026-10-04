import { useState, useEffect, useRef, useCallback } from 'react';

const OUTPUT_WIDTH = 1600;
const OUTPUT_HEIGHT = 1200;

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
      facingMode === 'environment'
        ? 'user'
        : 'environment';

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
   * Returns the current screen orientation.
   *
   * This is used only to normalize the captured
   * frame into our fixed 1600x1200 output.
   */
  const getOrientationAngle = useCallback((): number => {
    if (typeof window === 'undefined') {
      return 0;
    }

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
    } else if (
      window.innerWidth > window.innerHeight
    ) {
      angle = 90;
    }

    angle = ((angle % 360) + 360) % 360;

    return angle;
  }, []);

  /**
   * Draw the camera frame into a fixed 1600x1200
   * landscape canvas.
   *
   * The source is rotated according to the current
   * device orientation and then center-cropped.
   */
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;

    if (!video || !isStreaming) {
      return null;
    }

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

    console.log('[FIXED CAPTURE]', {
      angle,
      sourceWidth,
      sourceHeight,
      outputWidth: OUTPUT_WIDTH,
      outputHeight: OUTPUT_HEIGHT,
      facingMode,
    });

    /*
     * First create a temporary canvas representing
     * the correctly oriented source image.
     */
    const rotatedCanvas = document.createElement('canvas');

    const normalizedAngle =
      angle === 90 ||
      angle === 180 ||
      angle === 270
        ? angle
        : 0;

    const swapDimensions =
      normalizedAngle === 90 ||
      normalizedAngle === 270;

    rotatedCanvas.width = swapDimensions
      ? sourceHeight
      : sourceWidth;

    rotatedCanvas.height = swapDimensions
      ? sourceWidth
      : sourceHeight;

    const rotatedCtx =
      rotatedCanvas.getContext('2d');

    if (!rotatedCtx) {
      return null;
    }

    rotatedCtx.save();

    /*
     * Rotate source pixels into normal viewing
     * orientation.
     */
    if (normalizedAngle === 90) {
      rotatedCtx.translate(
        rotatedCanvas.width,
        0
      );
      rotatedCtx.rotate(Math.PI / 2);
    } else if (normalizedAngle === 180) {
      rotatedCtx.translate(
        rotatedCanvas.width,
        rotatedCanvas.height
      );
      rotatedCtx.rotate(Math.PI);
    } else if (normalizedAngle === 270) {
      rotatedCtx.translate(
        0,
        rotatedCanvas.height
      );
      rotatedCtx.rotate(-Math.PI / 2);
    }

    /*
     * Mirror only the front camera.
     */
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

    /*
     * Now put the normalized image into the
     * FIXED 1600x1200 output.
     */
    const outputCanvas =
      document.createElement('canvas');

    outputCanvas.width = OUTPUT_WIDTH;
    outputCanvas.height = OUTPUT_HEIGHT;

    const outputCtx =
      outputCanvas.getContext('2d');

    if (!outputCtx) {
      return null;
    }

    const normalizedWidth =
      rotatedCanvas.width;

    const normalizedHeight =
      rotatedCanvas.height;

    const sourceAspect =
      normalizedWidth / normalizedHeight;

    const outputAspect =
      OUTPUT_WIDTH / OUTPUT_HEIGHT;

    let drawWidth: number;
    let drawHeight: number;

    if (sourceAspect > outputAspect) {
      /*
       * Source is wider.
       * Fit height and crop left/right.
       */
      drawHeight = OUTPUT_HEIGHT;
      drawWidth =
        drawHeight * sourceAspect;
    } else {
      /*
       * Source is taller.
       * Fit width and crop top/bottom.
       */
      drawWidth = OUTPUT_WIDTH;
      drawHeight =
        drawWidth / sourceAspect;
    }

    const offsetX =
      (OUTPUT_WIDTH - drawWidth) / 2;

    const offsetY =
      (OUTPUT_HEIGHT - drawHeight) / 2;

    outputCtx.drawImage(
      rotatedCanvas,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight
    );

    const result =
      outputCanvas.toDataURL(
        'image/jpeg',
        0.95
      );

    console.log('[FIXED RESULT]', {
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      orientation: 'LANDSCAPE',
    });

    return result;
  }, [
    isStreaming,
    facingMode,
    playShutterSound,
    getOrientationAngle,
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