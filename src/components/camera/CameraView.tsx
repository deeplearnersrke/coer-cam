import { useEffect, useState } from "react";

type OrientationData = {
  orientation: "Portrait" | "Landscape";
  angle: number | null;
  beta: number | null;
  gamma: number | null;
};

export default function OrientationChecker() {
  const [data, setData] = useState<OrientationData>({
    orientation: "Portrait",
    angle: null,
    beta: null,
    gamma: null,
  });

  useEffect(() => {
    const updateScreenOrientation = () => {
      const angle =
        screen.orientation?.angle ??
        (typeof window.orientation === "number"
          ? window.orientation
          : 0);

      setData((previous) => ({
        ...previous,
        orientation:
          Math.abs(angle) === 90 ? "Landscape" : "Portrait",
        angle,
      }));
    };

    const handleDeviceOrientation = (
      event: DeviceOrientationEvent
    ) => {
      // Physical device sensor readings
      const beta = event.beta;
      const gamma = event.gamma;

      // Prefer actual screen orientation when available.
      const angle =
        screen.orientation?.angle ??
        (typeof window.orientation === "number"
          ? window.orientation
          : null);

      let orientation: "Portrait" | "Landscape";

      if (angle !== null) {
        orientation =
          Math.abs(angle) === 90 ? "Landscape" : "Portrait";
      } else {
        // Fallback using physical device tilt.
        orientation =
          Math.abs(gamma ?? 0) > Math.abs(beta ?? 0)
            ? "Landscape"
            : "Portrait";
      }

      setData({ orientation, angle, beta, gamma });
    };

    updateScreenOrientation();

    window.addEventListener("resize", updateScreenOrientation);
    window.addEventListener(
      "orientationchange",
      updateScreenOrientation
    );
    screen.orientation?.addEventListener(
      "change",
      updateScreenOrientation
    );
    window.addEventListener(
      "deviceorientation",
      handleDeviceOrientation
    );

    return () => {
      window.removeEventListener("resize", updateScreenOrientation);
      window.removeEventListener(
        "orientationchange",
        updateScreenOrientation
      );
      screen.orientation?.removeEventListener(
        "change",
        updateScreenOrientation
      );
      window.removeEventListener(
        "deviceorientation",
        handleDeviceOrientation
      );
    };
  }, []);

  return (
    <div>
      <h2>Phone Orientation</h2>
      <p>Orientation: {data.orientation}</p>
      <p>Screen angle: {data.angle ?? "Unavailable"}°</p>
      <p>Beta: {data.beta ?? "Sensor unavailable"}</p>
      <p>Gamma: {data.gamma ?? "Sensor unavailable"}</p>
    </div>
  );
}