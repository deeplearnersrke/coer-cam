
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Trash2,
  Share2,
  Copy,
  Check,
  ExternalLink,
  School,
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'stamped' | 'original'>(
    'stamped'
  );
  const [copied, setCopied] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize the existing Leaflet + OpenStreetMap map.
  useEffect(() => {
    if (!photo || !mapContainerRef.current) return;

    let mapInstance: any = null;
    let cancelled = false;

    const initMap = async () => {
      try {
        const L = (await import('leaflet')).default;

        if (cancelled || !mapContainerRef.current) return;

        // Fix Leaflet's default marker asset paths.
        delete (L.Icon.Default.prototype as any)._getIconUrl;

        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl:
            'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl:
            'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const lat = photo.location.latitude;
        const lng = photo.location.longitude;

        mapInstance = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 15,
          zoomControl: false,
          attributionControl: true,
        });

        L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
          }
        ).addTo(mapInstance);

        L.marker([lat, lng]).addTo(mapInstance);

        // Recalculate the map dimensions after the modal is rendered.
        requestAnimationFrame(() => {
          if (!cancelled && mapInstance) {
            mapInstance.invalidateSize();
          }
        });
      } catch (error) {
        console.error('Leaflet mini map load error:', error);
      }
    };

    initMap();

    return () => {
      cancelled = true;

      if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
      }
    };
  }, [photo]);

  // Close on Escape.
  useEffect(() => {
    if (!photo) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [photo, onClose]);

  // Reset the active tab and copy status when the selected photo changes.
  useEffect(() => {
    setActiveTab('stamped');
    setCopied(false);
  }, [photo?.id]);

  if (!photo) return null;

  const lat = photo.location.latitude;
  const lng = photo.location.longitude;

  const coordinates = formatCoordinates(lat, lng);

  // Google Maps opens externally. No API key or billing is needed.
  const googleMapsUrl =
    `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`;

  const formattedDate = new Date(photo.timestamp).toLocaleString();

  const imgSrc =
    activeTab === 'stamped'
      ? photo.stampedDataUrl
      : photo.originalDataUrl;

  const activeBlob =
    activeTab === 'stamped'
      ? photo.stampedBlob
      : photo.originalBlob;

  const handleCopyCoords = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${lat},${lng}`);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = `${lat},${lng}`;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';

        document.body.appendChild(textArea);
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (!successful) {
          throw new Error('Clipboard copy failed');
        }
      }

      setCopied(true);
      showToast('Coordinates copied to clipboard!', 'success');

      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Coordinate copy error:', error);
      showToast('Unable to copy coordinates', 'error');
    }
  };

  const handleDownload = () => {
    if (!activeBlob && !imgSrc) {
      showToast('Photo is not available for download', 'error');
      return;
    }

    let url: string;
    let temporaryUrl = false;

    if (activeBlob) {
      url = URL.createObjectURL(activeBlob);
      temporaryUrl = true;
    } else {
      url = imgSrc;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = `${photo.photoNumber}_${activeTab}.jpg`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (temporaryUrl) {
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    showToast('Downloaded photo file', 'info');
  };

  const handleShare = async () => {
    try {
      if (navigator.share && activeBlob) {
        const file = new File(
          [activeBlob],
          `${photo.photoNumber}_${activeTab}.jpg`,
          { type: activeBlob.type || 'image/jpeg' }
        );

        const shareData: ShareData = {
          title: `Geo Tagged Photo ${photo.photoNumber}`,
          text:
            `Geo Tagged Event Photo: ${
              photo.eventName || photo.schoolName
            } (${coordinates})`,
          files: [file],
        };

        if (
          !navigator.canShare ||
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share(shareData);
          return;
        }
      }

      // Fallback when file sharing is unavailable.
      await handleCopyCoords();
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Photo share error:', error);
      }
    }
  };

  return (
    <div
      className="
        fixed inset-0 z-50
        h-screen h-[100dvh]
        overflow-x-hidden overflow-y-auto overscroll-contain
        bg-slate-950/95 backdrop-blur-xl
        flex flex-col
        px-3 sm:px-4
        pt-[max(0.75rem,env(safe-area-inset-top))]
        pb-[max(0.75rem,env(safe-area-inset-bottom))]
      "
      role="dialog"
      aria-modal="true"
      aria-label={`Photo details for ${photo.photoNumber}`}
    >
      {/* Modal Header */}
      <div
        className="
          max-w-4xl mx-auto w-full shrink-0
          flex flex-col gap-3
          sm:flex-row sm:items-center sm:justify-between
          pb-3 border-b border-slate-800 text-white
        "
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="
              shrink-0 text-xs font-mono font-bold
              text-amber-400 bg-amber-500/10
              px-2.5 py-1 rounded-lg
              border border-amber-500/20
            "
          >
            {photo.photoNumber}
          </span>

          {photo.orientation && (
            <span
              className="
                shrink-0 text-[10px] font-mono font-semibold
                text-slate-300 bg-slate-800
                px-2 py-0.5 rounded border border-slate-700
                uppercase
              "
            >
              {photo.orientation}
            </span>
          )}

          <h2
            className="min-w-0 flex-1 text-base font-bold truncate max-w-[180px] sm:max-w-xs"
            title={photo.eventName || photo.schoolName}
          >
            {photo.eventName || photo.schoolName}
          </h2>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          <div className="flex shrink-0 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('stamped')}
              aria-pressed={activeTab === 'stamped'}
              className={`
                px-3 py-1.5 rounded-lg font-bold transition-colors
                ${
                  activeTab === 'stamped'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }
              `}
            >
              Stamped
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('original')}
              aria-pressed={activeTab === 'original'}
              className={`
                px-3 py-1.5 rounded-lg font-bold transition-colors
                ${
                  activeTab === 'original'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }
              `}
            >
              Original
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo details"
            className="
              shrink-0 w-10 h-10 rounded-xl
              bg-slate-900 hover:bg-slate-800
              text-slate-300 flex items-center justify-center
              border border-slate-800
            "
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="
          max-w-4xl mx-auto w-full
          py-4 sm:py-5
          grid grid-cols-1 md:grid-cols-2
          gap-4 sm:gap-6 items-start
        "
      >
        {/* Photo Preview */}
        <div
          className="
            w-full min-w-0
            h-[min(42dvh,420px)]
            sm:h-[min(60vh,600px)]
            min-h-[180px] sm:min-h-[300px]
            rounded-2xl overflow-hidden
            bg-black border border-slate-800 shadow-2xl
            flex items-center justify-center
          "
        >
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={photo.photoNumber}
              className="w-full h-full object-contain"
            />
          ) : activeBlob ? (
            <BlobPhoto blob={activeBlob} alt={photo.photoNumber} />
          ) : (
            <div className="text-slate-500 text-sm text-center p-4">
              Photo not available
            </div>
          )}
        </div>

        {/* Details and Map */}
        <div className="w-full min-w-0 space-y-4 text-xs sm:text-sm text-slate-300">
          {/* Embedded OpenStreetMap */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 h-44 sm:h-52 bg-slate-900">
            <div
              ref={mapContainerRef}
              className="w-full h-full"
            />

            {/* External Google Maps link: no API key required */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="
                absolute bottom-2 right-2 z-[1000]
                px-2.5 py-1.5 rounded-lg
                bg-slate-950/90 hover:bg-slate-950
                text-blue-400 border border-slate-800
                font-semibold flex items-center gap-1
                shadow-md text-xs
              "
            >
              <span>Open Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* GPS Coordinates */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 font-semibold">
                GPS Coordinates
              </span>

              <button
                type="button"
                onClick={handleCopyCoords}
                className="
                  shrink-0 px-2 py-1 rounded-md
                  bg-slate-800 hover:bg-slate-700
                  text-blue-400 flex items-center gap-1 font-semibold
                "
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="font-mono text-sm font-bold text-sky-400 break-all">
              {coordinates}
            </p>

            {photo.location.address?.formattedAddress && (
              <p className="text-slate-400 break-words">
                {photo.location.address.formattedAddress}
              </p>
            )}
          </div>

          {/* Event and School Details */}
          <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-start gap-2 min-w-0">
              <School className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />

              <span className="font-bold text-white text-sm break-words">
                {photo.schoolName || 'School Event'}
              </span>
            </div>

            {photo.eventName && (
              <p className="break-words">
                <strong className="text-slate-400">Event:</strong>{' '}
                {photo.eventName}
              </p>
            )}

            {photo.department && (
              <p className="break-words">
                <strong className="text-slate-400">Department:</strong>{' '}
                {photo.department}
              </p>
            )}

            {photo.organizer && (
              <p className="break-words">
                <strong className="text-slate-400">Organizer:</strong>{' '}
                {photo.organizer}
              </p>
            )}

            <p className="break-words">
              <strong className="text-slate-400">Captured On:</strong>{' '}
              {formattedDate}
            </p>

            {photo.remarks && (
              <p className="pt-1 text-amber-300 font-medium break-words">
                Remarks: "{photo.remarks}"
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownload}
              className="
                flex-1 min-w-0 min-h-11 py-3 px-3
                rounded-xl bg-blue-600 hover:bg-blue-500
                text-white font-bold flex items-center justify-center gap-2
                shadow-lg shadow-blue-500/20
              "
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="
                shrink-0 min-w-11 min-h-11 p-3
                rounded-xl bg-slate-800 hover:bg-slate-700
                text-slate-200 border border-slate-700
                flex items-center justify-center
              "
              title="Share Photo"
              aria-label="Share photo"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete photo ${photo.photoNumber}?`)) {
                  onDelete(photo.id);
                  onClose();
                }
              }}
              className="
                shrink-0 min-w-11 min-h-11 p-3
                rounded-xl bg-red-500/10 hover:bg-red-500/20
                text-red-400 border border-red-500/20
                flex items-center justify-center
              "
              title="Delete Photo"
              aria-label="Delete photo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Displays a Blob without creating a leaking object URL during render.
const BlobPhoto: React.FC<{ blob: Blob; alt: string }> = ({
  blob,
  alt,
}) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setSrc(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-contain"
    />
  );
};
