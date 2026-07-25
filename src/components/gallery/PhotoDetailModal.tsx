import React, { useState, useEffect } from 'react';
import { X, MapPin, Calendar, Download, Trash2, Share2, Copy, Check, ExternalLink, School } from 'lucide-react';
import { GeoPhoto } from '../../types';
import { formatCoordinates } from '../../services/gps';

interface PhotoDetailModalProps {
  photo: GeoPhoto | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PhotoDetailModal: React.FC<PhotoDetailModalProps> = ({
  photo,
  onClose,
  onDelete,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'stamped' | 'original'>('stamped');
  const [copied, setCopied] = useState(false);
  const [mapContainerRef, setMapContainerRef] = useState<HTMLDivElement | null>(null);

  // Initialize Leaflet map inside modal
  useEffect(() => {
    if (!photo || !mapContainerRef) return;

    let mapInstance: any = null;

    const initMap = async () => {
      try {
        const L = (await import('leaflet')).default;
        
        // Fix default icon asset path bug in Leaflet
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const lat = photo.location.latitude;
        const lng = photo.location.longitude;

        mapInstance = L.map(mapContainerRef, {
          center: [lat, lng],
          zoom: 15,
          zoomControl: false,
          attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(mapInstance);

        L.marker([lat, lng]).addTo(mapInstance);
      } catch (e) {
        console.error('Leaflet mini map load error:', e);
      }
    };

    initMap();

    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [photo, mapContainerRef]);

  if (!photo) return null;

  const handleCopyCoords = () => {
    const coords = `${photo.location.latitude},${photo.location.longitude}`;
    navigator.clipboard.writeText(coords);
    setCopied(true);
    showToast('Coordinates copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = activeTab === 'stamped' ? photo.stampedBlob : photo.originalBlob;
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${photo.photoNumber}_${activeTab}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded photo file', 'info');
  };

  const handleShare = async () => {
    if (navigator.share && photo.stampedBlob) {
      try {
        const file = new File([photo.stampedBlob], `${photo.photoNumber}.jpg`, { type: 'image/jpeg' });
        await navigator.share({
          title: `Geo Tagged Photo ${photo.photoNumber}`,
          text: `Geo Tagged Event Photo: ${photo.eventName || photo.schoolName} (${formatCoordinates(photo.location.latitude, photo.location.longitude)})`,
          files: [file],
        });
      } catch (err) {
        // share cancelled or unsupported
      }
    } else {
      handleCopyCoords();
    }
  };

  const formattedDate = new Date(photo.timestamp).toLocaleString();
  const imgSrc = activeTab === 'stamped'
    ? photo.stampedDataUrl || (photo.stampedBlob ? URL.createObjectURL(photo.stampedBlob) : '')
    : photo.originalDataUrl || (photo.originalBlob ? URL.createObjectURL(photo.originalBlob) : '');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex flex-col p-4 overflow-y-auto">
      
      {/* Modal Top Bar */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between pb-3 border-b border-slate-800 text-white">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
            {photo.photoNumber}
          </span>
          <h2 className="text-base font-bold truncate max-w-[200px] sm:max-w-xs">{photo.eventName || photo.schoolName}</h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('stamped')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                activeTab === 'stamped' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Stamped
            </button>
            <button
              onClick={() => setActiveTab('original')}
              className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                activeTab === 'original' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Original
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 flex items-center justify-center border border-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-4xl mx-auto w-full my-auto py-4 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* Photo Display */}
        <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl flex items-center justify-center min-h-[300px]">
          <img
            src={imgSrc}
            alt={photo.photoNumber}
            className="w-full h-auto max-h-[60vh] object-contain"
          />
        </div>

        {/* Details & Map Panel */}
        <div className="space-y-4 text-xs text-slate-300">
          
          {/* Mini Leaflet Map Box */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 h-44 bg-slate-900">
            <div ref={setMapContainerRef} className="w-full h-full" />
            <a
              href={`https://www.openstreetmap.org/?mlat=${photo.location.latitude}&mlon=${photo.location.longitude}#map=17/${photo.location.latitude}/${photo.location.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-2 right-2 z-20 px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-950 text-blue-400 border border-slate-800 font-semibold flex items-center gap-1 shadow-md"
            >
              <span>Open OSM</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Coordinates Block */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold">GPS Coordinates</span>
              <button
                onClick={handleCopyCoords}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-blue-400 flex items-center gap-1 font-semibold"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="font-mono text-sm font-bold text-sky-400">
              {formatCoordinates(photo.location.latitude, photo.location.longitude)}
            </p>
            {photo.location.address?.formattedAddress && (
              <p className="text-slate-400">{photo.location.address.formattedAddress}</p>
            )}
          </div>

          {/* Event & School Details */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-white text-sm">{photo.schoolName || 'School Event'}</span>
            </div>
            {photo.eventName && <p><strong className="text-slate-400">Event:</strong> {photo.eventName}</p>}
            {photo.department && <p><strong className="text-slate-400">Department:</strong> {photo.department}</p>}
            {photo.organizer && <p><strong className="text-slate-400">Organizer:</strong> {photo.organizer}</p>}
            <p><strong className="text-slate-400">Captured On:</strong> {formattedDate}</p>
            {photo.remarks && <p className="pt-1 text-amber-300 font-medium">Remarks: "{photo.remarks}"</p>}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleDownload}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>

            <button
              onClick={handleShare}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              title="Share Photo"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (confirm(`Delete photo ${photo.photoNumber}?`)) {
                  onDelete(photo.id);
                  onClose();
                }
              }}
              className="p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
              title="Delete Photo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
