import { useEffect, useState } from "react";

export const CameraView = () => {
  const getOrientation = () =>
    window.matchMedia("(orientation: landscape)").matches
      ? "Landscape"
      : "Portrait";

  const [orientation, setOrientation] = useState(getOrientation);

  useEffect(() => {
    const query = window.matchMedia("(orientation: landscape)");

    const update = () => setOrientation(getOrientation());

    query.addEventListener("change", update);
    window.addEventListener("resize", update);

    return () => {
      query.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="p-4 text-white">
      <h2>Mobile Orientation</h2>
      <p>Current Orientation: {orientation}</p>
    </div>
  );
};