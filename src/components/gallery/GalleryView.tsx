
import React, { useCallback, useEffect, useState } from 'react';

import {
  Search,
  LayoutGrid,
  List,
  Trash2,
  Download,
  CheckSquare,
  Square,
  Images,
} from 'lucide-react';

import { GeoPhoto } from '../../types';
import { db } from '../../services/db';
import { useEventContext } from '../../contexts/EventContext';
import { exportToZip } from '../../services/exportService';

interface GalleryViewProps {
  onOpenPhotoDetail: (photo: GeoPhoto) => void;
  showToast: (
    msg: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
}

// Thumbnail component: creates and cleans up Blob URLs safely.
interface PhotoThumbnailProps {
  photo: GeoPhoto;
  className: string;
}

const PhotoThumbnail: React.FC<PhotoThumbnailProps> = ({
  photo,
  className,
}) => {
  const [blobUrl, setBlobUrl] = useState('');

  useEffect(() => {
    if (photo.stampedDataUrl || !photo.stampedBlob) {
      setBlobUrl('');
      return;
    }

    const url = URL.createObjectURL(photo.stampedBlob);
    setBlobUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [photo.stampedDataUrl, photo.stampedBlob]);

  const src = photo.stampedDataUrl || blobUrl;

  if (!src) {
    return (
      <div
        className={`${className} bg-slate-800 flex items-center justify-center`}
      >
        <Images className="w-6 h-6 text-slate-600" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={photo.photoNumber}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
};

export const GalleryView: React.FC<GalleryViewProps> = ({
  onOpenPhotoDetail,
  showToast,
}) => {
  const { events } = useEventContext();

  const [photos, setPhotos] = useState<GeoPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(
    new Set()
  );
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPhotos = useCallback(async () => {
    setLoading(true);

    try {
      const allPhotos = await db.photos
        .orderBy('timestamp')
        .reverse()
        .toArray();

      setPhotos(allPhotos);
    } catch (err) {
      console.error('Failed to load gallery photos:', err);
      showToast('Failed to load photos', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  // Filter photos by event and search query.
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredPhotos = photos.filter((photo) => {
    const matchesEvent =
      selectedEventId === 'all' ||
      photo.eventId === selectedEventId;

    const matchesQuery =
      !normalizedQuery ||
      photo.photoNumber.toLowerCase().includes(normalizedQuery) ||
      (photo.eventName || '').toLowerCase().includes(normalizedQuery) ||
      (photo.schoolName || '').toLowerCase().includes(normalizedQuery) ||
      (photo.remarks || '').toLowerCase().includes(normalizedQuery) ||
      (photo.location.address?.formattedAddress || '')
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesEvent && matchesQuery;
  });

  const toggleSelectPhoto = (id: string) => {
    setSelectedPhotoIds((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const toggleSelectMode = () => {
    setSelectMode((previous) => !previous);
    setSelectedPhotoIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedPhotoIds.size === 0 || deleting) return;

    const count = selectedPhotoIds.size;

    if (!confirm(`Delete ${count} selected photos?`)) return;

    setDeleting(true);

    try {
      await db.photos.bulkDelete(Array.from(selectedPhotoIds));

      showToast(`Deleted ${count} photos`, 'info');
      setSelectedPhotoIds(new Set());
      setSelectMode(false);

      await loadPhotos();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      showToast('Failed to delete selected photos', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDownloadZip = async () => {
    if (selectedPhotoIds.size === 0 || exporting) return;

    const itemsToExport = photos.filter((photo) =>
      selectedPhotoIds.has(photo.id)
    );

    setExporting(true);
    showToast('Preparing ZIP download...', 'info');

    let url = '';

    try {
      const zipBlob = await exportToZip(
        itemsToExport,
        'Selected_Photos'
      );

      url = URL.createObjectURL(zipBlob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `GeoPhotos_Export_${Date.now()}.zip`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast('ZIP download started', 'success');
    } catch (error) {
      console.error('ZIP export failed:', error);
      showToast('Failed to export selected photos', 'error');
    } finally {
      if (url) {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      setExporting(false);
    }
  };

  const openPhoto = (photo: GeoPhoto) => {
    if (selectMode) {
      toggleSelectPhoto(photo.id);
    } else {
      onOpenPhotoDetail(photo);
    }
  };

  const handlePhotoKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    photo: GeoPhoto
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPhoto(photo);
    }
  };

  return (
    <div
      className="
        w-full max-w-5xl mx-auto min-w-0
        px-3 sm:px-4 lg:px-6
        pt-3 sm:pt-4
        pb-[calc(6rem+env(safe-area-inset-bottom))]
        space-y-4
      "
    >
      {/* Header, Search and Controls */}
      <div className="flex flex-col gap-3">
        {/* Search input */}
        <div className="relative w-full min-w-0">
          <Search
            className="
              w-4 h-4 absolute left-3.5 top-1/2
              -translate-y-1/2 text-slate-400
            "
          />

          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search photos, events, locations..."
            aria-label="Search photos"
            className="
              w-full min-w-0 h-11
              pl-10 pr-3 sm:pr-4
              rounded-xl bg-slate-800/80
              border border-slate-700
              text-slate-100 text-sm
              placeholder-slate-400
              focus:outline-none focus:ring-2
              focus:ring-blue-500
            "
          />
        </div>

        {/* Filter and view controls */}
        <div
          className="
            grid grid-cols-[minmax(0,1fr)_auto_auto]
            sm:flex sm:items-center sm:justify-between
            gap-2 min-w-0
          "
        >
          <select
            value={selectedEventId}
            onChange={(event) => setSelectedEventId(event.target.value)}
            aria-label="Filter by event"
            className="
              w-full min-w-0 h-10
              px-2 sm:px-3
              rounded-xl bg-slate-800/80
              border border-slate-700
              text-slate-200 text-xs sm:text-sm
              focus:outline-none focus:ring-2
              focus:ring-blue-500
              sm:max-w-xs
            "
          >
            <option value="all">
              All Events ({photos.length})
            </option>

            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>

          {/* Grid/List toggle */}
          <div
            className="
              flex items-center justify-center
              bg-slate-800 p-1 rounded-xl
              border border-slate-700 h-10
            "
          >
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              className={`
                w-8 h-8 flex items-center justify-center
                rounded-lg transition-colors
                ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }
              `}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              className={`
                w-8 h-8 flex items-center justify-center
                rounded-lg transition-colors
                ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }
              `}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={toggleSelectMode}
            className={`
              h-10 px-2.5 sm:px-3
              rounded-xl text-xs sm:text-sm font-bold
              border transition-colors whitespace-nowrap
              ${
                selectMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }
            `}
          >
            {selectMode ? 'Cancel' : 'Select'}
          </button>
        </div>

        {/* Result count */}
        {!loading && (
          <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              {filteredPhotos.length}{' '}
              {filteredPhotos.length === 1 ? 'photo' : 'photos'}
            </span>

            {(searchQuery || selectedEventId !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedEventId('all');
                }}
                className="text-blue-400 hover:text-blue-300"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Multi-select toolbar */}
      {selectMode && (
        <div
          className="
            p-3 sm:p-4 rounded-2xl
            bg-slate-800 border border-slate-700
            flex flex-col sm:flex-row
            sm:items-center sm:justify-between
            gap-3 text-xs sm:text-sm text-slate-200
          "
        >
          <span className="font-semibold">
            {selectedPhotoIds.size} photo(s) selected
          </span>

          <div className="grid grid-cols-2 sm:flex gap-2">
            <button
              type="button"
              onClick={handleBulkDownloadZip}
              disabled={selectedPhotoIds.size === 0 || exporting}
              className="
                min-h-10 px-3 py-2
                rounded-lg bg-blue-600 hover:bg-blue-500
                text-white font-bold
                flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{exporting ? 'Exporting...' : 'Export ZIP'}</span>
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedPhotoIds.size === 0 || deleting}
              className="
                min-h-10 px-3 py-2
                rounded-lg bg-red-600 hover:bg-red-500
                text-white font-bold
                flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>{deleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div
          className="
            text-center py-16
            text-slate-400 text-sm
            bg-slate-800/30 rounded-2xl
          "
        >
          Loading photos...
        </div>
      ) : filteredPhotos.length === 0 ? (
        /* Empty state */
        <div
          className="
            text-center py-12 sm:py-16
            bg-slate-800/40 rounded-3xl
            border border-slate-800
            px-4 py-10 space-y-3
          "
        >
          <Images className="w-12 h-12 text-slate-600 mx-auto" />

          <h3 className="text-base font-bold text-white">
            No Photos Found
          </h3>

          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            {searchQuery || selectedEventId !== 'all'
              ? 'Try another search or event filter.'
              : 'Start capturing photos using the Camera module!'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Responsive photo grid */
        <div
          className="
            grid grid-cols-1
            min-[360px]:grid-cols-2
            sm:grid-cols-3
            lg:grid-cols-4
            gap-3
          "
        >
          {filteredPhotos.map((photo) => {
            const isSelected = selectedPhotoIds.has(photo.id);

            return (
              <div
                key={photo.id}
                role="button"
                tabIndex={0}
                aria-label={`${
                  selectMode
                    ? isSelected
                      ? 'Deselect'
                      : 'Select'
                    : 'Open'
                } photo ${photo.photoNumber}`}
                aria-pressed={selectMode ? isSelected : undefined}
                onClick={() => openPhoto(photo)}
                onKeyDown={(event) => handlePhotoKeyDown(event, photo)}
                className={`
                  group relative min-w-0
                  aspect-[4/3] sm:aspect-video
                  rounded-2xl overflow-hidden
                  bg-slate-900 border cursor-pointer
                  transition-all
                  focus:outline-none focus:ring-2
                  focus:ring-blue-500
                  ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500'
                      : 'border-slate-800 hover:border-slate-600'
                  }
                `}
              >
                <PhotoThumbnail
                  photo={photo}
                  className="
                    absolute inset-0
                    w-full h-full object-cover
                    transition-transform duration-300
                    sm:group-hover:scale-105
                  "
                />

                {/* Selection indicator */}
                {selectMode && (
                  <div className="absolute top-2 right-2 z-10">
                    {isSelected ? (
                      <CheckSquare className="w-6 h-6 text-blue-400 bg-slate-950 rounded" />
                    ) : (
                      <Square className="w-6 h-6 text-slate-200 bg-slate-950/70 rounded" />
                    )}
                  </div>
                )}

                {/* Photo information overlay */}
                <div
                  className="
                    absolute inset-0
                    bg-gradient-to-t
                    from-slate-950/90 via-slate-950/10 to-transparent
                    p-2.5 sm:p-3
                    flex flex-col justify-end
                    text-white pointer-events-none
                  "
                >
                  <span className="text-[10px] sm:text-xs font-mono font-bold text-amber-300">
                    {photo.photoNumber}
                  </span>

                  <span className="text-xs sm:text-sm font-semibold truncate">
                    {photo.eventName || photo.schoolName}
                  </span>

                  <span className="text-[10px] sm:text-xs text-slate-300">
                    {new Date(photo.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Responsive list view */
        <div className="space-y-2">
          {filteredPhotos.map((photo) => {
            const isSelected = selectedPhotoIds.has(photo.id);

            return (
              <div
                key={photo.id}
                role="button"
                tabIndex={0}
                aria-label={`${
                  selectMode
                    ? isSelected
                      ? 'Deselect'
                      : 'Select'
                    : 'Open'
                } photo ${photo.photoNumber}`}
                aria-pressed={selectMode ? isSelected : undefined}
                onClick={() => openPhoto(photo)}
                onKeyDown={(event) => handlePhotoKeyDown(event, photo)}
                className={`
                  w-full min-w-0
                  p-2.5 sm:p-3
                  rounded-2xl bg-slate-800/80 border
                  flex items-center gap-3
                  cursor-pointer transition-colors
                  focus:outline-none focus:ring-2
                  focus:ring-blue-500
                  ${
                    isSelected
                      ? 'border-blue-500 ring-1 ring-blue-500'
                      : 'border-slate-700/60 hover:bg-slate-800'
                  }
                `}
              >
                {/* Thumbnail */}
                <PhotoThumbnail
                  photo={photo}
                  className="
                    w-20 h-20
                    min-[400px]:w-24 min-[400px]:h-20
                    sm:w-28 sm:h-20
                    rounded-xl object-cover shrink-0
                  "
                />

                {/* Details */}
                <div className="flex-1 min-w-0 text-xs sm:text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                    <span className="font-mono font-bold text-amber-400">
                      {photo.photoNumber}
                    </span>

                    <span className="text-slate-400">
                      {new Date(photo.timestamp).toLocaleDateString()}
                    </span>
                  </div>

                  <h4 className="font-bold text-white truncate">
                    {photo.eventName || photo.schoolName}
                  </h4>

                  {photo.location.address?.formattedAddress && (
                    <p className="text-slate-400 text-[11px] sm:text-xs truncate mt-1">
                      {photo.location.address.formattedAddress}
                    </p>
                  )}

                  {photo.remarks && (
                    <p className="text-slate-500 text-[11px] truncate mt-1">
                      {photo.remarks}
                    </p>
                  )}
                </div>

                {/* Selection indicator */}
                {selectMode && (
                  <div className="shrink-0">
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
