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
      photos: 'id, eventId, timestamp, photoNumber, [location.latitude+location.longitude]',
      settings: 'id'
    });
  }
}

export const db = new GeoCameraDatabase();

// Default App Settings
export const DEFAULT_SETTINGS: AppSettings = {
  id: 'default',
  schoolName: 'St. Xavier International School',
  defaultStampStyle: 'gps_classic',
  imageQuality: 0.9,
  theme: 'dark',
  exportQuality: 'high',
  defaultFont: 'Plus Jakarta Sans',
  gpsHighAccuracy: true,
  autoSaveToGallery: true,
  showCompass: true,
  watermarkOpacity: 0.9,
};

// Default Sample Event
export const DEFAULT_EVENT: SchoolEvent = {
  id: 'evt_default_2026',
  name: 'Annual Science & Innovation Expo',
  schoolName: 'St. Xavier International School',
  department: 'Science & Technology',
  organizer: 'Dr. Sarah Jenkins',
  locationName: 'Main Auditorium Hall B',
  remarks: 'Government Science Inspector Inspection',
  stampStyle: 'gps_classic',
  photoPrefix: 'SCI-2026',
  currentSeqNumber: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDefault: true,
};

export async function initializeDatabase() {
  try {
    // Check settings
    const existingSettings = await db.settings.get('default');
    if (!existingSettings) {
      await db.settings.put(DEFAULT_SETTINGS);
    }

    // Check events
    const eventCount = await db.events.count();
    if (eventCount === 0) {
      await db.events.put(DEFAULT_EVENT);
    }
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  const settings = await db.settings.get('default');
  return settings || DEFAULT_SETTINGS;
}

export async function updateAppSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const updated = { ...current, ...settings, id: 'default' };
  await db.settings.put(updated);
  return updated;
}

export async function getNextPhotoNumber(event: SchoolEvent): Promise<{ photoNumber: string; updatedEvent: SchoolEvent }> {
  const nextSeq = (event.currentSeqNumber || 1);
  const formattedSeq = String(nextSeq).padStart(3, '0');
  const photoNumber = `${event.photoPrefix || 'EVT'}-${formattedSeq}`;

  const updatedEvent: SchoolEvent = {
    ...event,
    currentSeqNumber: nextSeq + 1,
    updatedAt: Date.now(),
  };

  await db.events.put(updatedEvent);
  return { photoNumber, updatedEvent };
}
