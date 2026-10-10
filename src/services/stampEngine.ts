import {
  GeoPhoto,
  SchoolEvent,
  StampStyle,
  AppSettings,
} from '../types';

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
      margin: 0, // Tighter margin for cleaner look
      width: 80, // Smaller size
      color: {
        dark: '#ffffff',
        light: '#00000000', // Transparent background
      },
    });
  } catch (err) {
    return null;
  }
}

function formatOfficialDate(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

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
  return `${Math.abs(lat).toFixed(5)}° ${dir}`; // 5 decimals is enough precision visually
}

function formatLonDegrees(lon: number): string {
  const dir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lon).toFixed(5)}° ${dir}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function truncateToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  
  let result = text;
  while (result.length > 1 && ctx.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 2
): string[] {
  if (!text || maxWidth <= 0) return [];

  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      
      // If single word exceeds width, break it
      if (ctx.measureText(word).width > maxWidth) {
         let chunk = '';
         for(let i=0; i<word.length; i++) {
             if(ctx.measureText(chunk+word[i]).width <= maxWidth) {
                 chunk += word[i];
             } else {
                 if(chunk) lines.push(chunk);
                 chunk = word[i];
             }
         }
         currentLine = chunk;
      }
    }
  }

  if (currentLine) lines.push(currentLine);

  if (maxLines > 0 && lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    trimmed[maxLines - 1] = truncateToWidth(ctx, `${trimmed[maxLines - 1]} …`, maxWidth);
    return trimmed;
  }

  return lines;
}

/**
 * Helper to draw rounded rectangle
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
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

interface StampInputData {
  imageSrc: string;
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

export async function generateStampedImage(
  input: StampInputData
): Promise<{ blob: Blob; dataUrl: string }> {
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

  if (canvas.width <= 0 || canvas.height <= 0) {
    throw new Error('Invalid image dimensions');
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw original photo
  ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

  const isLandscape = input.orientation
    ? input.orientation === 'landscape'
    : canvas.width >= canvas.height;

  // --- DATA PREPARATION ---
  const schoolName =
    event?.schoolName ||
    settings?.schoolName ||
    input.customSchoolName ||
    'INSTITUTION DOCUMENTATION';

  const eventName = event?.name || '';
  const department = event?.department || '';
  const organizer = event?.organizer || '';
  const locationName = event?.locationName || '';
  const remarks = event?.remarks || input.customRemarks || '';
  
  const dateStr = formatOfficialDate(timestamp);
  const timeStr = formatOfficialTime(timestamp);

  const hasCoords = location.latitude !== 0 || location.longitude !== 0;
  const latStr = hasCoords ? formatLatDegrees(location.latitude) : '';
  const lonStr = hasCoords ? formatLonDegrees(location.longitude) : '';
  
  const accStr =
    typeof location.accuracy === 'number' &&
    location.accuracy > 0 &&
    location.accuracy < 900
      ? `±${Math.round(location.accuracy)} m`
      : '';

  const altStr =
    typeof location.altitude === 'number'
      ? `${Math.round(location.altitude)} m`
      : '';

  const directionStr =
    settings?.showCompass &&
    typeof location.heading === 'number' &&
    !Number.isNaN(location.heading)
      ? headingToCardinal(location.heading)
      : '';

  const addr = location.address;
  const addressLine =
    addr?.formattedAddress ||
    [addr?.village, addr?.city, addr?.district, addr?.state, addr?.country]
      .filter(Boolean)
      .join(', ') ||
    locationName;

  // Build Compact List
  const items: KeyVal[] = [];
  if (department) items.push({ label: 'Dept', value: department });
  if (organizer) items.push({ label: 'Org', value: organizer });
  if (addressLine) items.push({ label: 'Loc', value: addressLine });
  if (latStr) items.push({ label: 'Lat', value: latStr });
  if (lonStr) items.push({ label: 'Lng', value: lonStr });
  if (accStr) items.push({ label: 'Acc', value: accStr });
  if (altStr) items.push({ label: 'Alt', value: altStr });
  if (directionStr) items.push({ label: 'Dir', value: directionStr });
  
  items.push({ label: 'Date', value: dateStr });
  items.push({ label: 'Time', value: timeStr });
  items.push({ label: 'ID', value: photoNumber });
  if (remarks) items.push({ label: 'Note', value: remarks });

  // QR Code
  let qrImg: HTMLImageElement | null = null;
  if (settings?.showQrCode) {
    const qrText = `ID:${photoNumber}|LAT:${location.latitude.toFixed(6)}|LON:${location.longitude.toFixed(6)}`;
    const qrData = await generateQrDataUrl(qrText);
    if (qrData) {
      try {
        qrImg = await loadImage(qrData);
      } catch (e) {}
    }
  }

  // Logo
  let logoImg: HTMLImageElement | null = null;
  const logoUrl = event?.logoDataUrl || settings?.logoDataUrl || '';
  if (logoUrl) {
    try {
      logoImg = await loadImage(logoUrl);
    } catch (e) {}
  }

  // --- STYLE CONFIGURATION ---
  const fontFamily = `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  
  // Glass Colors
  const bgColor = 'rgba(15, 23, 42, 0.75)'; // Slate-900 with transparency
  const borderColor = 'rgba(255, 255, 255, 0.15)';
  const accentColor = '#3B82F6'; // Blue-500
  
  // Scale Factor based on resolution
  const refWidth = isLandscape ? 1920 : 1080;
  const scale = clamp(canvas.width / refWidth, 0.8, 1.2);

  // Dimensions
  const padX = Math.round(24 * scale);
  const padY = Math.round(20 * scale);
  const cornerRadius = Math.round(16 * scale);
  
  // Font Sizes (Small & Clean)
  const fontHeaderSize = Math.round(18 * scale);
  const fontSubSize = Math.round(13 * scale);
  const fontLabelSize = Math.round(11 * scale);
  const fontValueSize = Math.round(12 * scale);
  
  const lineHeight = Math.round(18 * scale);
  const itemSpacing = Math.round(4 * scale);

  // Calculate Panel Width
  let panelWidth: number;
  if (isLandscape) {
    // Landscape: Fixed width card, floating bottom-left
    panelWidth = Math.round(480 * scale); 
  } else {
    // Portrait: Full width minus margins
    panelWidth = canvas.width - (padX * 2);
  }

  // Calculate Height dynamically
  // We assume roughly 2 lines per item max for calculation safety
  const estimatedContentHeight = 
    (fontHeaderSize + 10*scale) + // Header
    (eventName ? fontSubSize + 8*scale : 0) + // Subheader
    (items.length * (lineHeight + itemSpacing)) + // Items
    (qrImg ? 60*scale : 0); // QR reserve
    
  const naturalPanelHeight = padY * 2 + estimatedContentHeight;
  
  // Cap height to avoid taking over screen
  const maxHeightRatio = isLandscape ? 0.45 : 0.35;
  const maxAllowedHeight = canvas.height * maxHeightRatio;
  
  const panelHeight = Math.min(naturalPanelHeight, maxAllowedHeight);
  
  // Position
  const panelX = isLandscape ? padX : padX;
  const panelY = canvas.height - panelHeight - padY;

  // --- DRAWING ENGINE ---

  ctx.save();

  // 1. Shadow for Depth (Fake Blur/Glass effect)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 20 * scale;
  ctx.shadowOffsetY = 10 * scale;

  // 2. Background Shape
  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, cornerRadius);
  ctx.fillStyle = bgColor;
  ctx.fill();

  // Reset shadow for crisp inner drawing
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 3. Border Stroke
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  // 4. Left Accent Bar (Branding)
  ctx.fillStyle = accentColor;
  // Only draw accent bar on the left side, slightly inset
  const accentWidth = 4 * scale;
  const accentInset = 8 * scale;
  ctx.fillRect(panelX + accentInset, panelY + accentInset, accentWidth, panelHeight - (accentInset*2));

  // Content Start X (after accent bar)
  const contentX = panelX + accentInset + accentWidth + (12 * scale);
  const contentMaxWidth = panelWidth - (contentX - panelX) - padX;
  
  let curY = panelY + padY + (12 * scale);

  // --- HEADER SECTION ---
  
  // School Name (Bold, White)
  ctx.font = `700 ${fontHeaderSize}px ${fontFamily}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';
  
  const headerLines = wrapText(ctx, schoolName.toUpperCase(), contentMaxWidth, 1);
  headerLines.forEach(line => {
      ctx.fillText(line, contentX, curY);
      curY += fontHeaderSize + (4 * scale);
  });

  // Event Name (Medium, Gray-300)
  if (eventName) {
      ctx.font = `500 ${fontSubSize}px ${fontFamily}`;
      ctx.fillStyle = '#CBD5E1'; // Slate-300
      
      const subLines = wrapText(ctx, eventName, contentMaxWidth, 1);
      subLines.forEach(line => {
          ctx.fillText(line, contentX, curY);
          curY += fontSubSize + (6 * scale);
      });
  }

  // Divider Line
  curY += 4 * scale;
  ctx.beginPath();
  ctx.moveTo(contentX, curY);
  ctx.lineTo(contentX + contentMaxWidth, curY);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1 * scale;
  ctx.stroke();
  curY += 8 * scale;

  // --- INFO GRID SECTION ---
  
  // Layout Strategy:
  // If Landscape: Try 2 columns if space permits, else 1 column compact list
  // If Portrait: Always 1 column, very tight packing
  
  const useTwoColumns = isLandscape && contentMaxWidth > 300 * scale;
  const colGap = 16 * scale;
  const colWidth = useTwoColumns 
    ? (contentMaxWidth - colGap) / 2 
    : contentMaxWidth;

  ctx.font = `400 ${fontValueSize}px ${fontFamily}`;
  
  // Helper to draw a row
  const drawRow = (label: string, value: string, startX: number, startY: number, width: number) => {
      // Label (Gray, Small)
      ctx.fillStyle = '#94A3B8'; // Slate-400
      ctx.font = `600 ${fontLabelSize}px ${fontFamily}`;
      ctx.fillText(label.toUpperCase(), startX, startY);
      
      // Value (White, Normal)
      ctx.fillStyle = '#F8FAFC'; // Slate-50
      ctx.font = `400 ${fontValueSize}px ${fontFamily}`;
      
      // Truncate value if too long
      const valText = truncateToWidth(ctx, value, width - (ctx.measureText(label).width + 10*scale));
      ctx.fillText(valText, startX + ctx.measureText(label).width + (8*scale), startY);
  };

  let rowIndex = 0;
  
  items.forEach((item, index) => {
      if (useTwoColumns) {
          const isLeftCol = index % 2 === 0;
          const x = isLeftCol ? contentX : contentX + colWidth + colGap;
          const y = curY + Math.floor(index / 2) * (lineHeight + itemSpacing);
          
          // Check bounds before drawing
          if (y + lineHeight < panelY + panelHeight - padY) {
              drawRow(item.label, item.value, x, y, colWidth);
          }
      } else {
          const y = curY + index * (lineHeight + itemSpacing);
           // Check bounds
           if (y + lineHeight < panelY + panelHeight - padY) {
               drawRow(item.label, item.value, contentX, y, contentMaxWidth);
           }
      }
      rowIndex++;
  });

  // Adjust curY after grid for potential footer/QR placement logic if needed
  // For now, we rely on fixed positioning for QR

  // --- FOOTER / QR CODE ---
  
  if (qrImg) {
      const qrSize = Math.round(50 * scale);
      const qrMargin = 12 * scale;
      
      // Place QR at bottom right inside panel
      const qx = panelX + panelWidth - qrMargin - qrSize;
      const qy = panelY + panelHeight - qrMargin - qrSize;
      
      // Ensure QR doesn't overlap text if text goes low
      // Since we clipped text rendering above, this is safe
      
      ctx.globalAlpha = 0.9;
      ctx.drawImage(qrImg, qx, qy, qrSize, qrSize);
      ctx.globalAlpha = 1.0;
  }

  ctx.restore();

  // Output
  const exportQualityMap: Record<string, number> = {
    high: 0.95,
    medium: 0.86,
    compact: 0.76,
  };

  const fallbackQuality = settings?.exportQuality
    ? exportQualityMap[settings.exportQuality] ?? 0.92
    : 0.92;

  const quality = clamp(settings?.imageQuality ?? fallbackQuality, 0.5, 1);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b || new Blob()),
      'image/jpeg',
      quality
    );
  });

  return { blob, dataUrl };
}