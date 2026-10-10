import { useEffect, useState } from "react";

export default function OrientationChecker() {
  const getOrientation = () =>
    window.matchMedia("(orientation: landscape)").matches
      ? "Landscape"
      : "Portrait";

  const [orientation, setOrientation] = useState(getOrientation);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(orientation: landscape)");

    const updateOrientation = () => {
      setOrientation(getOrientation());
    };

    mediaQuery.addEventListener("change", updateOrientation);
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);

    return () => {
      mediaQuery.removeEventListener("change", updateOrientation);
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
    };
  }, []);

  return (
    <div>
      <h2>Mobile Orientation</h2>
      <p>Current Orientation: {orientation}</p>
    </div>
  );
}