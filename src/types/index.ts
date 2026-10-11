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
  logoDataUrl?: string; // Legacy school/event logo; retained for compatibility.
  logoADataUrl?: string; // Optional top-left event logo.
  logoBDataUrl?: string; // Optional top-center event logo.
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
  fileSize: number;
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
  originalBlob: Blob;
  stampedBlob: Blob;
  originalDataUrl?: string;
  stampedDataUrl?: string;
  photoNumber: string;
  location: GeoLocationData;
  timestamp: number;
  stampStyle: StampStyle;
  metadata: GeoPhotoMetadata;
}

export interface AppSettings {
  id?: string;
  schoolName: string;
  defaultEventId?: string;
  logoDataUrl?: string;
  defaultStampStyle: StampStyle;
  imageQuality: number;
  theme: 'light' | 'dark' | 'system';
  exportQuality: 'high' | 'medium' | 'compact';
  defaultFont: string;
  gpsHighAccuracy: boolean;
  autoSaveToGallery: boolean;
  showCompass: boolean;
  watermarkOpacity: number;
  showQrCode?: boolean;
}
