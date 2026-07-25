import React, { useState } from 'react';
import { X, Upload, Check, School, Image as ImageIcon } from 'lucide-react';
import { SchoolEvent, StampStyle } from '../../types';
import { useEventContext } from '../../contexts/EventContext';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: SchoolEvent | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  eventToEdit,
  showToast,
}) => {
  const { createEvent, updateEvent, settings } = useEventContext();

  const [schoolName, setSchoolName] = useState(eventToEdit?.schoolName || settings.schoolName || '');
  const [name, setName] = useState(eventToEdit?.name || '');
  const [department, setDepartment] = useState(eventToEdit?.department || '');
  const [organizer, setOrganizer] = useState(eventToEdit?.organizer || '');
  const [locationName, setLocationName] = useState(eventToEdit?.locationName || '');
  const [remarks, setRemarks] = useState(eventToEdit?.remarks || '');
  const [photoPrefix, setPhotoPrefix] = useState(eventToEdit?.photoPrefix || 'EVT-2026');
  const [stampStyle, setStampStyle] = useState<StampStyle>(eventToEdit?.stampStyle || 'gps_classic');
  const [logoDataUrl, setLogoDataUrl] = useState<string>(eventToEdit?.logoDataUrl || settings.logoDataUrl || '');

  if (!isOpen) return null;

  // Handle Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Logo image must be smaller than 2MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Event Name is required', 'error');
      return;
    }

    try {
      if (eventToEdit) {
        await updateEvent(eventToEdit.id, {
          schoolName,
          name,
          department,
          organizer,
          locationName,
          remarks,
          photoPrefix,
          stampStyle,
          logoDataUrl,
        });
        showToast('Event updated successfully', 'success');
      } else {
        await createEvent({
          schoolName,
          name,
          department,
          organizer,
          locationName,
          remarks,
          photoPrefix,
          stampStyle,
          logoDataUrl,
        });
        showToast('New event created & set as active', 'success');
      }
      onClose();
    } catch (err: any) {
      showToast('Failed to save event: ' + err.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-slate-100 shadow-2xl space-y-5 my-8">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <School className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold">{eventToEdit ? 'Edit School Event' : 'Create New School Event'}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          <div>
            <label className="block text-slate-400 font-bold mb-1">School / College Name *</label>
            <input
              type="text"
              required
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="e.g. St. Xavier International School"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Event Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Annual Science Exhibition 2026"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-bold mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Science & Tech"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1">Organizer / Inspector</label>
              <input
                type="text"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                placeholder="e.g. Dr. Sarah Jenkins"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-bold mb-1">Location Name</label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. Main Auditorium Hall B"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1">Photo ID Prefix</label>
              <input
                type="text"
                value={photoPrefix}
                onChange={(e) => setPhotoPrefix(e.target.value)}
                placeholder="e.g. SCI-2026"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Default Stamp Template</label>
            <select
              value={stampStyle}
              onChange={(e) => setStampStyle(e.target.value as StampStyle)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="gps_classic">GPS Camera Classic Banner</option>
              <option value="gov_inspection">Official Government Inspection Seal</option>
              <option value="modern_glass">Modern Frosted Glass Card</option>
              <option value="minimal">Minimal Sleek Bar</option>
              <option value="school_branding">School Branding Header & Footer</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">School Logo (Optional Watermark)</label>
            <div className="flex items-center gap-3">
              {logoDataUrl ? (
                <div className="relative w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 p-1 flex items-center justify-center shrink-0">
                  <img src={logoDataUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => setLogoDataUrl('')}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px]"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                  <ImageIcon className="w-5 h-5" />
                </div>
              )}

              <label className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-semibold cursor-pointer flex items-center justify-center gap-2 text-slate-300">
                <Upload className="w-4 h-4" />
                <span>Upload Logo PNG/JPG</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-bold mb-1">Remarks / Note</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Official campus inspection record..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-500/20"
            >
              {eventToEdit ? 'Save Changes' : 'Create Event'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
