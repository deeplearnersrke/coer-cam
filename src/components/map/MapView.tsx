import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Maximize2, Filter, Layers } from 'lucide-react';
import { GeoPhoto } from '../../types';
import { db } from '../../services/db';
import { useEventContext } from '../../contexts/EventContext';
import { formatCoordinates } from '../../services/gps';

interface MapViewProps {
  onOpenPhotoDetail: (photo: GeoPhoto) => void;
}

export const MapView: React.FC<MapViewProps> = ({ onOpenPhotoDetail }) => {
  const { events } = useEventContext();
  const [photos, setPhotos] = useState<GeoPhoto[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    async function loadData() {
      const allPhotos = await db.photos.toArray();
      setPhotos(allPhotos);
    }
    loadData();
  }, []);

  const filteredPhotos = photos.filter(p => selectedEventId === 'all' || p.eventId === selectedEventId);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    let map: any = null;

    const initMap = async () => {
      try {
        const L = (await import('leaflet')).default;

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        // Default location (e.g. 20.5937, 78.9629 or first photo location)
        let initialLat = 20.5937;
        let initialLng = 78.9629;
        let initialZoom = 5;

        if (filteredPhotos.length > 0) {
          initialLat = filteredPhotos[0].location.latitude;
          initialLng = filteredPhotos[0].location.longitude;
          initialZoom = 13;
        }

        map = L.map(mapContainerRef.current, {
          center: [initialLat, initialLng],
          zoom: initialZoom,
          zoomControl: false,
        });

        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);

        L.control.zoom({ position: 'topright' }).addTo(map);

        // Add markers
        const bounds: [number, number][] = [];

        filteredPhotos.forEach((p) => {
          const lat = p.location.latitude;
          const lng = p.location.longitude;
          bounds.push([lat, lng]);

          const marker = L.marker([lat, lng]).addTo(map);

          const src = p.stampedDataUrl || (p.stampedBlob ? URL.createObjectURL(p.stampedBlob) : '');

          const popupContent = document.createElement('div');
          popupContent.className = 'text-xs space-y-2 p-1 font-sans';
          popupContent.innerHTML = `
            <div style="width:180px;">
              <img src="${src}" style="width:100%; height:100px; object-fit:cover; border-radius:8px; margin-bottom:6px;" />
              <div style="font-weight:bold; color:#1e293b;">${p.photoNumber}</div>
              <div style="color:#64748b; font-size:11px;">${p.eventName || p.schoolName}</div>
              <div style="color:#2563eb; font-size:10px; margin-top:4px;">${formatCoordinates(lat, lng)}</div>
            </div>
          `;

          const btn = document.createElement('button');
          btn.textContent = 'View Details';
          btn.className = 'mt-2 w-full py-1 bg-blue-600 text-white rounded font-bold text-xs cursor-pointer';
          btn.onclick = () => onOpenPhotoDetail(p);
          popupContent.appendChild(btn);

          marker.bindPopup(popupContent);
        });

        if (bounds.length > 1) {
          map.fitBounds(bounds, { padding: [40, 40] });
        }
      } catch (err) {
        console.error('Leaflet Map View init error:', err);
      }
    };

    initMap();

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, [filteredPhotos]);

  const handleFitBounds = () => {
    if (!mapInstanceRef.current || filteredPhotos.length === 0) return;
    const L = (window as any).L;
    const bounds = filteredPhotos.map(p => [p.location.latitude, p.location.longitude] as [number, number]);
    if (bounds.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden flex flex-col">
      
      {/* Top Filter Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-2 max-w-lg mx-auto">
        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-white text-xs font-bold shadow-xl focus:outline-none"
        >
          <option value="all">All Events ({photos.length} pins)</option>
          {events.map((evt) => (
            <option key={evt.id} value={evt.id}>{evt.name}</option>
          ))}
        </select>

        <button
          onClick={handleFitBounds}
          className="p-2.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-slate-200 hover:text-white shadow-xl flex items-center gap-1.5 text-xs font-bold"
          title="Fit Map to Photo Markers"
        >
          <Maximize2 className="w-4 h-4 text-blue-400" />
          <span className="hidden sm:inline">Fit Markers</span>
        </button>
      </div>

      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {photos.length === 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm text-center">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 max-w-sm space-y-2">
            <MapPin className="w-10 h-10 text-blue-400 mx-auto" />
            <h3 className="text-base font-bold text-white">No Geo Photos Recorded</h3>
            <p className="text-xs text-slate-400">Capture photos using the camera to plot interactive pins on the GIS Map.</p>
          </div>
        </div>
      )}

    </div>
  );
};
