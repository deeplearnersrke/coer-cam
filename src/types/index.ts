export type StampStyle =
  | 'gps_classic'
  | 'gov_inspection'
  | 'modern_glass'
  | 'minimal'
  | 'school_branding';

export interface AddressInfo {
  village?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  postcode?: string;
  formattedAddress?: string;
}

export interface GeoLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
  address?: AddressInfo;
}

export interface SchoolEvent {
  id: string;
  name: string;
  schoolName: string;
  department?: string;
  organizer?: string;
  locationName?: string;
  remarks?: string;
  logoDataUrl?: string;
  stampStyle: StampStyle;
  photoPrefix: string;
  currentSeqNumber: number;
  createdAt: number;
  updatedAt: number;
  isDefault?: boolean;
}

export interface GeoPhotoMetadata {
  width: number;
  height: number;
  fileSize: number; // bytes
  orientation?: 'portrait' | 'landscape';
  deviceOrientation?: string;
  compassDirection?: string;
  weatherTemp?: string;
  cameraFacing?: 'user' | 'environment';
}

export interface GeoPhoto {
  id: string;
  eventId?: string;
  eventName?: string;
  schoolName?: string;
  department?: string;
  organizer?: string;
  locationName?: string;
  remarks?: string;
  orientation?: 'portrait' | 'landscape';

  // Images stored as Blob in IndexedDB
  originalBlob: Blob;
  stampedBlob: Blob;

  // Data URLs generated dynamically for UI preview
  originalDataUrl?: string;
  stampedDataUrl?: string;

  photoNumber: string;
  location: GeoLocationData;
  timestamp: number;
  stampStyle: StampStyle;
  metadata: GeoPhotoMetadata;
}

export interface AppSettings {
  id?: string; // single row ID 'default'
  schoolName: string;
  defaultEventId?: string;
  logoDataUrl?: string;
  defaultStampStyle: StampStyle;
  imageQuality: number; // 0.5 to 1.0
  theme: 'light' | 'dark' | 'system';
  exportQuality: 'high' | 'medium' | 'compact';
  defaultFont: string;
  gpsHighAccuracy: boolean;
  autoSaveToGallery: boolean;
  showCompass: boolean;
  watermarkOpacity: number;
  showQrCode?: boolean;
}