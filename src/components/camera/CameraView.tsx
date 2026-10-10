
import React, { useEffect, useState } from "react";

type Orientation = "Portrait" | "Landscape";

export const CameraView: React.FC = () => {
  const [orientation, setOrientation] =
    useState<Orientation>("Portrait");

  const [beta, setBeta] = useState<number | null>(null);
  const [gamma, setGamma] = useState<number | null>(null);

  useEffect(() => {
    let currentOrientation: Orientation = "Portrait";

    const handleOrientation = (
      event: DeviceOrientationEvent
    ) => {
      if (event.beta === null || event.gamma === null) {
        return;
      }

      const b = event.beta;
      const g = event.gamma;
      const absGamma = Math.abs(g);

      setBeta(b);
      setGamma(g);

      // Switch to landscape only after a substantial rotation.
      if (
        currentOrientation === "Portrait" &&
        absGamma > 60
      ) {
        currentOrientation = "Landscape";
        setOrientation("Landscape");
      }

      // Return to portrait only after rotating back further.
      else if (
        currentOrientation === "Landscape" &&
        absGamma < 30
      ) {
        currentOrientation = "Portrait";
        setOrientation("Portrait");
      }
    };

    window.addEventListener(
      "deviceorientation",
      handleOrientation
    );

    return () => {
      window.removeEventListener(
        "deviceorientation",
        handleOrientation
      );
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold">
        Phone Orientation
      </h1>

      <div className="rounded-2xl border border-white/20 bg-white/10 p-8 text-center">
        <h2 className="text-5xl font-bold">
          {orientation}
        </h2>

        <div className="mt-6 space-y-2 text-lg text-gray-300">
          <p>
            Beta: {beta !== null ? `${beta.toFixed(1)}°` : "--"}
          </p>

          <p>
            Gamma: {gamma !== null ? `${gamma.toFixed(1)}°` : "--"}
          </p>
        </div>
      </div>
    </div>
  );
};
