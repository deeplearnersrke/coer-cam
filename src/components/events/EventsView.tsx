import React, { useState } from 'react';
import { Plus, School, Check, Edit2, Trash2, Calendar, MapPin, Hash, Sparkles } from 'lucide-react';
import { useEventContext } from '../../contexts/EventContext';
import { SchoolEvent } from '../../types';
import { EventModal } from './EventModal';

interface EventsViewProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const EventsView: React.FC<EventsViewProps> = ({ showToast }) => {
  const { events, activeEvent, setActiveEvent, deleteEvent } = useEventContext();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<SchoolEvent | null>(null);

  const handleOpenCreate = () => {
    setEventToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (evt: SchoolEvent) => {
    setEventToEdit(evt);
    setIsModalOpen(true);
  };

  const handleDelete = async (evt: SchoolEvent) => {
    if (events.length <= 1) {
      showToast('Cannot delete the only event. Create another event first.', 'error');
      return;
    }
    if (confirm(`Delete event "${evt.name}"?`)) {
      await deleteEvent(evt.id);
      showToast(`Deleted event ${evt.name}`, 'info');
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">School Events & Inspection Tasks</h2>
          <p className="text-xs text-slate-400">Organize photos under distinct events, departments & custom prefix codes.</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Event</span>
        </button>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {events.map((evt) => {
          const isActive = activeEvent?.id === evt.id;

          return (
            <div
              key={evt.id}
              className={`p-5 rounded-2xl border transition-all ${
                isActive
                  ? 'bg-slate-800/90 border-blue-500/80 shadow-xl ring-1 ring-blue-500/50'
                  : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800/80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/30 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Active Event
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-400">{evt.schoolName}</span>
                  </div>

                  <h3 className="text-base font-bold text-white">{evt.name}</h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                    {evt.department && (
                      <span>Dept: <strong className="text-slate-200">{evt.department}</strong></span>
                    )}
                    {evt.organizer && (
                      <span>Org: <strong className="text-slate-200">{evt.organizer}</strong></span>
                    )}
                    {evt.locationName && (
                      <span className="flex items-center gap-1 text-slate-400">
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        {evt.locationName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-1 text-xs text-slate-400 font-mono">
                    <span>Prefix: <strong className="text-blue-400">{evt.photoPrefix}</strong></span>
                    <span>Next Seq: <strong className="text-emerald-400">#{String(evt.currentSeqNumber || 1).padStart(3, '0')}</strong></span>
                    <span className="capitalize">Stamp: <strong className="text-purple-400">{evt.stampStyle.replace('_', ' ')}</strong></span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {!isActive && (
                    <button
                      onClick={() => {
                        setActiveEvent(evt);
                        showToast(`Switched active event to ${evt.name}`, 'success');
                      }}
                      className="px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold text-xs border border-blue-500/30 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Activate</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenEdit(evt)}
                    className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200"
                    title="Edit Event"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(evt)}
                    className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                    title="Delete Event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        eventToEdit={eventToEdit}
        showToast={showToast}
      />

    </div>
  );
};
