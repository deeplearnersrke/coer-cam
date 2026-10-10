import React, { useEffect, useState } from "react";

type Orientation = "Portrait" | "Landscape";

export const CameraView: React.FC = () => {
  const getOrientation = (): Orientation => {
    const angle = screen.orientation?.angle;

    if (typeof angle === "number") {
      return Math.abs(angle) === 90 ? "Landscape" : "Portrait";
    }

    return window.matchMedia("(orientation: landscape)").matches
      ? "Landscape"
      : "Portrait";
  };

  const [orientation, setOrientation] =
    useState<Orientation>(getOrientation);

  const [sensorData, setSensorData] = useState({
    beta: null as number | null,
    gamma: null as number | null,
  });

  useEffect(() => {
    const updateOrientation = () => {
      setOrientation(getOrientation());
    };

    const handleDeviceOrientation = (
      event: DeviceOrientationEvent
    ) => {
      setSensorData({
        beta: event.beta,
        gamma: event.gamma,
      });

      // Use physical sensor readings if screen orientation is locked.
      if (screen.orientation?.type) {
        return;
      }

      if (event.beta !== null && event.gamma !== null) {
        const isLandscape =
          Math.abs(event.gamma) > Math.abs(event.beta);

        setOrientation(isLandscape ? "Landscape" : "Portrait");
      }
    };

    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);
    screen.orientation?.addEventListener("change", updateOrientation);
    window.addEventListener("deviceorientation", handleDeviceOrientation);

    updateOrientation();

    return () => {
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
      screen.orientation?.removeEventListener("change", updateOrientation);
      window.removeEventListener(
        "deviceorientation",
        handleDeviceOrientation
      );
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Phone Orientation</h1>

      <div className="rounded-xl border border-white/20 bg-white/10 p-6 text-center">
        <p className="text-4xl font-semibold">{orientation}</p>
        <p className="mt-3 text-sm text-gray-300">
          Screen angle: {screen.orientation?.angle ?? "Unavailable"}°
        </p>
        <p className="text-sm text-gray-300">
          Beta: {sensorData.beta ?? "Unavailable"}°
        </p>
        <p className="text-sm text-gray-300">
          Gamma: {sensorData.gamma ?? "Unavailable"}°
        </p>
      </div>
    </div>
  );
};