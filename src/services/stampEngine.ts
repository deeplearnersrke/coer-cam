import { GeoPhoto, SchoolEvent, StampStyle, AppSettings } from '../types';
import { headingToCardinal } from './gps';
import QRCode from 'qrcode';

/**
 * Loads an image or DataURL into an HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Generates a QR Code as DataURL containing photo metadata
 */
async function generateQrDataUrl(text: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, {
      margin: 1,
      width: 120,
      color: {
        dark: '#ffffff',
        light: '#00000000',
      },
    });
  } catch (err) {
    return null;
  }
}

/**
 * Formats official date: 26 Jul 2026
 */
function formatOfficialDate(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Formats official time: 01:09:28 AM
 */
function formatOfficialTime(timestamp: number): string {
  const d = new Date(timestamp);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
}

function formatLatDegrees(lat: number): string {
  const dir = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(6)}° ${dir}`;
}

function formatLonDegrees(lon: number): string {
  const dir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lon).toFixed(6)}° ${dir}`;
}

/**
 * Wraps text into multiple lines given a max width in pixels
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text || maxWidth <= 0) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width <= maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

interface StampInputData {
  imageSrc: string; // Data URL or Blob URL
  event?: SchoolEvent;
  photoNumber: string;
  location: GeoPhoto['location'];
  timestamp: number;
  stampStyle: StampStyle;
  settings?: AppSettings;
  customSchoolName?: string;
  customRemarks?: string;
  orientation?: 'portrait' | 'landscape';
}

interface KeyVal {
  label: string;
  value: string;
}

/**
 * Helper to draw rounded rectangle on Canvas
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, width: number, height: number, radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Core Canvas Stamp Engine with Official Monochrome Document Layout
 * Supports both Portrait and Landscape orientations with responsive predefined positioning
 */
export async function generateStampedImage(input: StampInputData): Promise<{ blob: Blob; dataUrl: string }> {
  const {
    imageSrc,
    event,
    photoNumber,
    location,
    timestamp,
    stampStyle = 'gps_classic',
    settings,
  } = input;

  const baseImg = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = baseImg.naturalWidth || baseImg.width || 1920;
  canvas.height = baseImg.naturalHeight || baseImg.height || 1080;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Draw original photo
  ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

  // Detect orientation (explicit or inferred from canvas aspect ratio)
  const isLandscape = input.orientation 
    ? input.orientation === 'landscape' 
    : canvas.width >= canvas.height;

  // Responsive scale factor depending on image orientation and dimensions
  const scale = isLandscape
    ? Math.max(0.65, Math.min(2.4, canvas.width / 1600))
    : Math.max(0.65, Math.min(2.4, canvas.width / 1080));

  const pad = Math.round(18 * scale);
  const cornerRadius = Math.round(10 * scale);

  // Field values - auto hide empty values
  const schoolName = event?.schoolName || settings?.schoolName || input.customSchoolName || 'INSTITUTION DOCUMENTATION';
  const eventName = event?.name || '';
  const department = event?.department || '';
  const organizer = event?.organizer || '';
  const locationName = event?.locationName || '';
  const remarks = event?.remarks || input.customRemarks || '';
  const logoUrl = event?.logoDataUrl || settings?.logoDataUrl || '';

  const dateStr = formatOfficialDate(timestamp);
  const timeStr = formatOfficialTime(timestamp);

  const hasCoords = location.latitude !== 0 || location.longitude !== 0;
  const latStr = hasCoords ? formatLatDegrees(location.latitude) : '';
  const lonStr = hasCoords ? formatLonDegrees(location.longitude) : '';
  const accStr = location.accuracy && location.accuracy < 900 ? `±${Math.round(location.accuracy)} m` : '';
  const altStr = location.altitude ? `${Math.round(location.altitude)} m` : '';

  const addr = location.address;
  const addressLine = addr?.formattedAddress || [
    addr?.village,
    addr?.city,
    addr?.district,
    addr?.state,
    addr?.country,
  ].filter(Boolean).join(', ') || locationName;

  // Build Key-Value list (ONLY non-empty values!)
  const items: KeyVal[] = [];

  if (department) items.push({ label: 'Department', value: department });
  if (organizer) items.push({ label: 'Organizer', value: organizer });
  if (addressLine) items.push({ label: 'Location', value: addressLine });
  if (latStr) items.push({ label: 'Latitude', value: latStr });
  if (lonStr) items.push({ label: 'Longitude', value: lonStr });
  if (accStr) items.push({ label: 'Accuracy', value: accStr });
  if (altStr) items.push({ label: 'Altitude', value: altStr });
  items.push({ label: 'Date', value: dateStr });
  items.push({ label: 'Time', value: timeStr });
  items.push({ label: 'Photo ID', value: photoNumber });
  if (remarks) items.push({ label: 'Remarks', value: remarks });

  // QR Code (Only if enabled in settings)
  let qrImg: HTMLImageElement | null = null;
  if (settings?.showQrCode) {
    const qrText = `ID:${photoNumber}|LAT:${location.latitude.toFixed(6)}|LON:${location.longitude.toFixed(6)}`;
    const qrData = await generateQrDataUrl(qrText);
    if (qrData) {
      try {
        qrImg = await loadImage(qrData);
      } catch (e) {
        // ignore
      }
    }
  }

  // School Logo (Optional)
  let logoImg: HTMLImageElement | null = null;
  if (logoUrl) {
    try {
      logoImg = await loadImage(logoUrl);
    } catch (e) {
      // ignore
    }
  }

  // ========================================================
  // RENDER OFFICIAL DOCUMENT PANEL
  // ========================================================

  // Typography definitions (SemiBold, Medium, Regular)
  const fontHeader = `600 ${Math.round(17 * scale)}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;
  const fontSubHeader = `500 ${Math.round(14 * scale)}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;
  const fontLabel = `500 ${Math.round(12.5 * scale)}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;
  const fontValue = `400 ${Math.round(12.5 * scale)}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;

  // Predefined Stamp Positions for Portrait vs Landscape:
  // 1. Portrait: Bottom full-width container across the bottom of the portrait photo
  // 2. Landscape: Bottom-left inspection card positioned in the lower-left quadrant
  let panelWidth = 0;
  let panelX = pad;

  if (isLandscape) {
    // Landscape Predefined Position: Bottom-Left Card
    const desiredWidth = Math.round(canvas.width * 0.44);
    const minWidth = Math.round(480 * scale);
    panelWidth = Math.min(canvas.width - pad * 2, Math.max(minWidth, desiredWidth));
    panelX = pad;
  } else {
    // Portrait Predefined Position: Bottom Full-Width Panel
    panelWidth = canvas.width - (pad * 2);
    panelX = pad;
  }

  // Measure max label width for vertical alignment column
  ctx.font = fontLabel;
  let maxLabelWidth = 0;
  items.forEach((item) => {
    const w = ctx.measureText(`${item.label} : `).width;
    if (w > maxLabelWidth) maxLabelWidth = w;
  });

  const qrSpace = qrImg ? Math.round(76 * scale) : 0;
  const valueAvailWidth = Math.max(
    Math.round(140 * scale),
    panelWidth - (pad * 2) - maxLabelWidth - qrSpace
  );

  // Pre-calculate lines for wrapping
  ctx.font = fontHeader;
  const headerLines = wrapText(ctx, schoolName, panelWidth - pad * 2 - (logoImg ? Math.round(56 * scale) : 0));

  ctx.font = fontSubHeader;
  const subHeaderLines = wrapText(ctx, eventName, panelWidth - pad * 2);

  // Process item lines
  ctx.font = fontValue;
  const processedItems: { label: string; valLines: string[] }[] = [];
  items.forEach((item) => {
    const valLines = wrapText(ctx, item.value, valueAvailWidth);
    processedItems.push({ label: item.label, valLines });
  });

  // Calculate panel height
  const headerLineH = Math.round(23 * scale);
  const subHeaderLineH = Math.round(19 * scale);
  const itemLineH = Math.round(17 * scale);

  let totalContentH = pad * 2; // top and bottom padding
  totalContentH += headerLines.length * headerLineH;
  if (subHeaderLines.length > 0) totalContentH += subHeaderLines.length * subHeaderLineH + Math.round(4 * scale);
  totalContentH += Math.round(10 * scale); // divider margin

  processedItems.forEach((pi) => {
    totalContentH += Math.max(1, pi.valLines.length) * itemLineH + Math.round(2.5 * scale);
  });

  // Ensure stamp stays inside bounds
  const panelHeight = Math.min(canvas.height - pad * 2, totalContentH);
  const panelY = Math.max(pad, canvas.height - panelHeight - pad);

  // Background Panel: Semi-transparent black 75% opacity, rounded corners
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, cornerRadius);
  ctx.fill();

  // Subtle 1px monochrome border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.stroke();

  // Content start coordinates
  let curY = panelY + pad + Math.round(14 * scale);
  const curX = panelX + pad;

  // Draw Logo if available
  if (logoImg) {
    const logoSize = Math.round(46 * scale);
    ctx.drawImage(logoImg, panelX + panelWidth - pad - logoSize, panelY + pad, logoSize, logoSize);
  }

  // Draw Heading (School / College / Institution)
  ctx.fillStyle = '#FFFFFF';
  ctx.font = fontHeader;
  headerLines.forEach((line) => {
    ctx.fillText(line, curX, curY);
    curY += headerLineH;
  });

  // Draw Subheading (Event Name)
  if (subHeaderLines.length > 0) {
    ctx.fillStyle = '#E2E8F0'; // Light gray
    ctx.font = fontSubHeader;
    subHeaderLines.forEach((line) => {
      ctx.fillText(line, curX, curY);
      curY += subHeaderLineH;
    });
  }

  // Horizontal Divider Line
  curY += Math.round(4 * scale);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(curX, curY, panelWidth - pad * 2, Math.max(1, Math.round(1 * scale)));
  curY += Math.round(11 * scale);

  // Draw Key-Value Pairs
  processedItems.forEach((pi) => {
    const labelText = `${pi.label}`;
    
    // Label (Medium font, Light Gray)
    ctx.fillStyle = '#CBD5E1';
    ctx.font = fontLabel;
    ctx.fillText(labelText, curX, curY);

    // Colon
    const colonX = curX + maxLabelWidth - Math.round(12 * scale);
    ctx.fillText(':', colonX, curY);

    // Value (Regular font, White / Light Gray)
    const valX = curX + maxLabelWidth;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = fontValue;

    pi.valLines.forEach((valLine, idx) => {
      ctx.fillText(valLine, valX, curY + (idx * itemLineH));
    });

    curY += Math.max(1, pi.valLines.length) * itemLineH + Math.round(2.5 * scale);
  });

  // Draw QR Code on bottom right if enabled
  if (qrImg) {
    const qrSize = Math.round(68 * scale);
    ctx.drawImage(qrImg, panelX + panelWidth - pad - qrSize, panelY + panelHeight - pad - qrSize, qrSize, qrSize);
  }

  ctx.restore();

  // Output blob & dataUrl
  const quality = settings?.imageQuality || 0.95;
  const dataUrl = canvas.toDataURL('image/jpeg', quality);

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', quality);
  });

  return { blob, dataUrl };
}
