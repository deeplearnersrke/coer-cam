
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';

import { SchoolEvent, AppSettings } from '../types';

import {
  db,
  getAppSettings,
  DEFAULT_EVENT,
  DEFAULT_SETTINGS,
  initializeDatabase,
} from '../services/db';

interface EventContextType {
  events: SchoolEvent[];
  activeEvent: SchoolEvent | null;
  settings: AppSettings;
  isLoading: boolean;
  initializationError: string | null;
  setActiveEvent: (event: SchoolEvent) => void;
  loadEvents: () => Promise<void>;
  createEvent: (
    eventData: Omit<
      SchoolEvent,
      'id' | 'createdAt' | 'updatedAt' | 'currentSeqNumber'
    >
  ) => Promise<SchoolEvent>;
  updateEvent: (id: string, updates: Partial<SchoolEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [activeEvent, setActiveEventState] = useState<SchoolEvent | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(
    null
  );

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setInitializationError(null);

    try {
      console.info('[D-Cam] Starting database initialization');

      await initializeDatabase();

      console.info('[D-Cam] Database initialized');

      const [allEvents, appSettings] = await Promise.all([
        db.events.toArray(),
        getAppSettings(),
      ]);

      setEvents(allEvents);
      setSettings(appSettings);

      let foundActive: SchoolEvent | undefined;

      try {
        const savedActiveId = localStorage.getItem(
          'geo_camera_active_event_id'
        );

        foundActive = allEvents.find((event) => event.id === savedActiveId);
      } catch (error) {
        console.warn('[D-Cam] Unable to read saved event selection:', error);
      }

      if (!foundActive && allEvents.length > 0) {
        foundActive =
          allEvents.find((event) => event.isDefault) || allEvents[0];
      }

      setActiveEventState(foundActive || DEFAULT_EVENT);

      console.info('[D-Cam] Startup data loaded successfully');
    } catch (error) {
      console.error('[D-Cam] Initialization failed:', error);

      setInitializationError(
        error instanceof Error
          ? error.message
          : 'Unable to initialize local database.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const appSettings = await getAppSettings();
      setSettings(appSettings);
    } catch (error) {
      console.error('[D-Cam] Failed to refresh settings:', error);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const setActiveEvent = useCallback((event: SchoolEvent) => {
    setActiveEventState(event);

    try {
      localStorage.setItem('geo_camera_active_event_id', event.id);
    } catch (error) {
      console.warn('[D-Cam] Unable to save active event selection:', error);
    }
  }, []);

  const createEvent = async (
    eventData: Omit<
      SchoolEvent,
      'id' | 'createdAt' | 'updatedAt' | 'currentSeqNumber'
    >
  ): Promise<SchoolEvent> => {
    const now = Date.now();

    const newEvent: SchoolEvent = {
      ...eventData,
      id: `evt_${now}_${Math.random().toString(36).slice(2, 6)}`,
      currentSeqNumber: 1,
      createdAt: now,
      updatedAt: now,
    };

    await db.events.put(newEvent);
    await loadEvents();
    setActiveEvent(newEvent);

    return newEvent;
  };

  const updateEvent = async (
    id: string,
    updates: Partial<SchoolEvent>
  ): Promise<void> => {
    const existing = await db.events.get(id);

    if (!existing) return;

    const updated: SchoolEvent = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    await db.events.put(updated);
    await loadEvents();

    if (activeEvent?.id === id) {
      setActiveEventState(updated);
    }
  };

  const deleteEvent = async (id: string): Promise<void> => {
    await db.events.delete(id);

    if (activeEvent?.id === id) {
      try {
        localStorage.removeItem('geo_camera_active_event_id');
      } catch (error) {
        console.warn('[D-Cam] Unable to clear saved event selection:', error);
      }
    }

    await loadEvents();
  };

  return (
    <EventContext.Provider
      value={{
        events,
        activeEvent,
        settings,
        isLoading,
        initializationError,
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

  if (!context) {
    throw new Error('useEventContext must be used within EventProvider');
  }

  return context;
};
