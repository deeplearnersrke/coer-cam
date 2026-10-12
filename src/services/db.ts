
import Dexie, { Table } from 'dexie';
import { SchoolEvent, GeoPhoto, AppSettings } from '../types';

export class GeoCameraDatabase extends Dexie {
  events!: Table<SchoolEvent, string>;
  photos!: Table<GeoPhoto, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('SchoolEventGeoCameraDB');

    this.version(1).stores({
      events: 'id, name, schoolName, isDefault, createdAt',
      photos: 'id, eventId, timestamp, photoNumber',
      settings: 'id',
    });
  }
}

export const db = new GeoCameraDatabase();

// Default App Settings
export const DEFAULT_SETTINGS: AppSettings = {
  id: 'default',
  schoolName: 'COER University',
  defaultStampStyle: 'gps_classic',
  imageQuality: 0.9,
  theme: 'dark',
  exportQuality: 'high',
  defaultFont: 'Inter',
  gpsHighAccuracy: true,
  autoSaveToGallery: true,
  showCompass: true,
  watermarkOpacity: 0.9,
  showQrCode: true,
};

// Default Sample Event
export const DEFAULT_EVENT: SchoolEvent = {
  id: 'evt_default_2026',
  name: 'DCodersSquad Event',
  schoolName: 'COER University',
  department: 'CSE',
  organizer: 'Muhmmad Shaban',
  locationName: 'Main Auditorium Hall B',
  remarks: 'DCodersSquad Event',
  stampStyle: 'gps_classic',
  photoPrefix: 'DCS-2026',
  currentSeqNumber: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDefault: true,
};

/**
 * Open IndexedDB explicitly.
 * Errors are allowed to propagate so the UI can display a retry option.
 */
export async function openDatabase(): Promise<void> {
  try {
    await db.open();
  } catch (error) {
    console.error('[D-Cam] IndexedDB open failed:', error);
    throw error;
  }
}

/**
 * Initialize default settings and event if they do not exist.
 * Existing events and photos are preserved.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await openDatabase();

    await db.transaction('rw', db.settings, db.events, async () => {
      const existingSettings = await db.settings.get('default');

      if (!existingSettings) {
        await db.settings.put(DEFAULT_SETTINGS);
      }

      const eventCount = await db.events.count();

      if (eventCount === 0) {
        await db.events.put(DEFAULT_EVENT);
      }
    });

    console.info('[D-Cam] IndexedDB initialization completed');
  } catch (error) {
    console.error('[D-Cam] Database initialization failed:', error);
    throw error;
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  await openDatabase();

  const settings = await db.settings.get('default');
  return settings || DEFAULT_SETTINGS;
}

export async function updateAppSettings(
  settings: Partial<AppSettings>
): Promise<AppSettings> {
  await openDatabase();

  const current = await getAppSettings();

  const updated: AppSettings = {
    ...current,
    ...settings,
    id: 'default',
  };

  await db.settings.put(updated);

  return updated;
}

export async function getNextPhotoNumber(
  event: SchoolEvent
): Promise<{ photoNumber: string; updatedEvent: SchoolEvent }> {
  await openDatabase();

  return db.transaction('rw', db.events, async () => {
    const latestEvent = await db.events.get(event.id);

    if (!latestEvent) {
      throw new Error(`Event not found: ${event.id}`);
    }

    const nextSeq = latestEvent.currentSeqNumber || 1;
    const formattedSeq = String(nextSeq).padStart(3, '0');
    const photoNumber = `${latestEvent.photoPrefix || 'EVT'}-${formattedSeq}`;

    const updatedEvent: SchoolEvent = {
      ...latestEvent,
      currentSeqNumber: nextSeq + 1,
      updatedAt: Date.now(),
    };

    await db.events.put(updatedEvent);

    return { photoNumber, updatedEvent };
  });
}
