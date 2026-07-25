import React, { useEffect, useState } from 'react';
import { Search, Filter, LayoutGrid, List, Trash2, Download, CheckSquare, Square, Images, Calendar } from 'lucide-react';
import { GeoPhoto } from '../../types';
import { db } from '../../services/db';
import { useEventContext } from '../../contexts/EventContext';
import { exportToZip } from '../../services/exportService';

interface GalleryViewProps {
  onOpenPhotoDetail: (photo: GeoPhoto) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({ onOpenPhotoDetail, showToast }) => {
  const { events } = useEventContext();
  const [photos, setPhotos] = useState<GeoPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());

  const loadPhotos = async () => {
    setLoading(true);
    try {
      let allPhotos = await db.photos.orderBy('timestamp').reverse().toArray();
      setPhotos(allPhotos);
    } catch (err) {
      console.error('Failed to load gallery photos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, []);

  // Filter photos
  const filteredPhotos = photos.filter(p => {
    const matchesEvent = selectedEventId === 'all' || p.eventId === selectedEventId;
    const q = searchQuery.toLowerCase();
    const matchesQuery = !searchQuery || 
      p.photoNumber.toLowerCase().includes(q) ||
      (p.eventName && p.eventName.toLowerCase().includes(q)) ||
      (p.schoolName && p.schoolName.toLowerCase().includes(q)) ||
      (p.remarks && p.remarks.toLowerCase().includes(q)) ||
      (p.location.address?.formattedAddress && p.location.address.formattedAddress.toLowerCase().includes(q));

    return matchesEvent && matchesQuery;
  });

  const toggleSelectPhoto = (id: string) => {
    const next = new Set(selectedPhotoIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPhotoIds(next);
  };

  const handleBulkDelete = async () => {
    if (selectedPhotoIds.size === 0) return;
    if (confirm(`Delete ${selectedPhotoIds.size} selected photos?`)) {
      await db.photos.bulkDelete(Array.from(selectedPhotoIds));
      showToast(`Deleted ${selectedPhotoIds.size} photos`, 'info');
      setSelectedPhotoIds(new Set());
      setSelectMode(false);
      loadPhotos();
    }
  };

  const handleBulkDownloadZip = async () => {
    if (selectedPhotoIds.size === 0) return;
    const itemsToExport = photos.filter(p => selectedPhotoIds.has(p.id));
    showToast('Preparing ZIP download...', 'info');
    const zipBlob = await exportToZip(itemsToExport, 'Selected_Photos');
    
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GeoPhotos_Export_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-5xl mx-auto space-y-4">
      
      {/* Header & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search photos by ID, event, location..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-100 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter Dropdown & View Mode */}
        <div className="flex items-center gap-2">
          
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Events ({photos.length})</option>
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.name}
              </option>
            ))}
          </select>

          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-slate-300 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'hover:text-white'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-slate-300 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              setSelectMode(!selectMode);
              setSelectedPhotoIds(new Set());
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
              selectMode ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {selectMode ? 'Cancel Select' : 'Select'}
          </button>

        </div>

      </div>

      {/* Multi-Select Bar */}
      {selectMode && (
        <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-between text-xs text-slate-200 animate-fadeIn">
          <span>{selectedPhotoIds.size} photo(s) selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDownloadZip}
              disabled={selectedPhotoIds.size === 0}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export ZIP</span>
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={selectedPhotoIds.size === 0}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Gallery Items */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs">Loading photos...</div>
      ) : filteredPhotos.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/40 rounded-3xl border border-slate-800 p-8 space-y-3">
          <Images className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Photos Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery ? 'Try matching another search query or event filter.' : 'Start capturing photos using the Camera module!'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredPhotos.map((p) => {
            const isSelected = selectedPhotoIds.has(p.id);
            const src = p.stampedDataUrl || (p.stampedBlob ? URL.createObjectURL(p.stampedBlob) : '');

            return (
              <div
                key={p.id}
                onClick={() => selectMode ? toggleSelectPhoto(p.id) : onOpenPhotoDetail(p)}
                className={`group relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border cursor-pointer transition-all ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-500' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <img src={src} alt={p.photoNumber} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                
                {selectMode && (
                  <div className="absolute top-2 right-2 z-10">
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-blue-400 bg-slate-950 rounded fill-blue-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400 bg-slate-950/60 rounded" />
                    )}
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent p-2.5 flex flex-col justify-end text-white">
                  <span className="text-[10px] font-mono font-bold text-amber-300">{p.photoNumber}</span>
                  <span className="text-[11px] font-semibold truncate">{p.eventName || p.schoolName}</span>
                  <span className="text-[9px] text-slate-400">{new Date(p.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPhotos.map((p) => {
            const isSelected = selectedPhotoIds.has(p.id);
            const src = p.stampedDataUrl || (p.stampedBlob ? URL.createObjectURL(p.stampedBlob) : '');

            return (
              <div
                key={p.id}
                onClick={() => selectMode ? toggleSelectPhoto(p.id) : onOpenPhotoDetail(p)}
                className={`p-3 rounded-2xl bg-slate-800/80 border flex items-center gap-3 cursor-pointer transition-all ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-500' : 'border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                <img src={src} alt={p.photoNumber} className="w-20 h-14 rounded-xl object-cover shrink-0" />
                
                <div className="flex-1 min-w-0 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400">{p.photoNumber}</span>
                    <span className="text-slate-400">{new Date(p.timestamp).toLocaleString()}</span>
                  </div>
                  <h4 className="font-bold text-white truncate">{p.eventName || p.schoolName}</h4>
                  {p.location.address?.formattedAddress && (
                    <p className="text-slate-400 text-[11px] truncate">{p.location.address.formattedAddress}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
