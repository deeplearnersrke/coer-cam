import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SchoolEvent, AppSettings } from '../types';
import { db, getAppSettings, DEFAULT_EVENT, initializeDatabase } from '../services/db';

interface EventContextType {
  events: SchoolEvent[];
  activeEvent: SchoolEvent | null;
  settings: AppSettings;
  isLoading: boolean;
  setActiveEvent: (event: SchoolEvent) => void;
  loadEvents: () => Promise<void>;
  createEvent: (eventData: Omit<SchoolEvent, 'id' | 'createdAt' | 'updatedAt' | 'currentSeqNumber'>) => Promise<SchoolEvent>;
  updateEvent: (id: string, updates: Partial<SchoolEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [activeEvent, setActiveEventState] = useState<SchoolEvent | null>(null);
  const [settings, setSettings] = useState<AppSettings>(getAppSettings as any);
  const [isLoading, setIsLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      await initializeDatabase();
      
      const allEvents = await db.events.toArray();
      setEvents(allEvents);

      const appSet = await getAppSettings();
      setSettings(appSet);

      // Restore active event
      const savedActiveId = localStorage.getItem('geo_camera_active_event_id');
      let foundActive = allEvents.find(e => e.id === savedActiveId);
      if (!foundActive && allEvents.length > 0) {
        foundActive = allEvents.find(e => e.isDefault) || allEvents[0];
      }
      
      setActiveEventState(foundActive || DEFAULT_EVENT);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    const s = await getAppSettings();
    setSettings(s);
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const setActiveEvent = (event: SchoolEvent) => {
    setActiveEventState(event);
    localStorage.setItem('geo_camera_active_event_id', event.id);
  };

  const createEvent = async (eventData: Omit<SchoolEvent, 'id' | 'createdAt' | 'updatedAt' | 'currentSeqNumber'>): Promise<SchoolEvent> => {
    const newEvent: SchoolEvent = {
      ...eventData,
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      currentSeqNumber: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.events.put(newEvent);
    await loadEvents();
    setActiveEvent(newEvent);
    return newEvent;
  };

  const updateEvent = async (id: string, updates: Partial<SchoolEvent>) => {
    const existing = await db.events.get(id);
    if (existing) {
      const updated = { ...existing, ...updates, updatedAt: Date.now() };
      await db.events.put(updated);
      await loadEvents();
      if (activeEvent?.id === id) {
        setActiveEventState(updated);
      }
    }
  };

  const deleteEvent = async (id: string) => {
    await db.events.delete(id);
    await loadEvents();
  };

  return (
    <EventContext.Provider
      value={{
        events,
        activeEvent,
        settings,
        isLoading,
        setActiveEvent,
        loadEvents,
        createEvent,
        updateEvent,
        deleteEvent,
        refreshSettings,
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export const useEventContext = () => {
  const context = useContext(EventContext);
  if (!context) throw new Error('useEventContext must be used within EventProvider');
  return context;
};
