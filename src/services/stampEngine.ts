import { GeoPhoto, SchoolEvent, StampStyle, AppSettings } from '../types';
import { formatCoordinates, headingToCardinal } from './gps';
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
 * Generates a QR Code as DataURL containing photo metadata or share link
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
 * Formats date into readable string
 */
function formatDateTime(timestamp: number): { dateStr: string; timeStr: string } {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const timeStr = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;

  return { dateStr, timeStr };
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
}

/**
 * Core Canvas Stamp Engine
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
  canvas.width = baseImg.naturalWidth || baseImg.width || 1280;
  canvas.height = baseImg.naturalHeight || baseImg.height || 720;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Draw original photo
  ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

  const scale = Math.max(canvas.width, canvas.height) / 1200; // Relative scale factor
  const pad = Math.round(20 * scale);
  const fontSizeBase = Math.round(16 * scale);

  // Field values with smart auto-hiding
  const schoolName = event?.schoolName || settings?.schoolName || input.customSchoolName || '';
  const eventName = event?.name || '';
  const department = event?.department || '';
  const organizer = event?.organizer || '';
  const locationName = event?.locationName || '';
  const remarks = event?.remarks || input.customRemarks || '';
  const logoUrl = event?.logoDataUrl || settings?.logoDataUrl || '';

  const { dateStr, timeStr } = formatDateTime(timestamp);
  const coordsStr = formatCoordinates(location.latitude, location.longitude);
  const accStr = location.accuracy ? `±${Math.round(location.accuracy)}m` : '';
  const altStr = location.altitude ? `${Math.round(location.altitude)}m Alt` : '';
  const headingStr = location.heading !== undefined && location.heading !== null 
    ? `${headingToCardinal(location.heading)} (${Math.round(location.heading)}°)`
    : '';

  const addr = location.address;
  const addressLine = addr?.formattedAddress || [
    addr?.village,
    addr?.city,
    addr?.district,
    addr?.state,
    addr?.country,
  ].filter(Boolean).join(', ');

  // Generate QR Code if needed
  let qrImg: HTMLImageElement | null = null;
  const qrData = await generateQrDataUrl(`LOC:${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}|ID:${photoNumber}`);
  if (qrData) {
    try {
      qrImg = await loadImage(qrData);
    } catch (e) {
      // ignore QR load error
    }
  }

  // Load School Logo if available
  let logoImg: HTMLImageElement | null = null;
  if (logoUrl) {
    try {
      logoImg = await loadImage(logoUrl);
    } catch (e) {
      // logo failed to load
    }
  }

  // ==========================================
  // RENDER STAMP STYLES
  // ==========================================

  if (stampStyle === 'gps_classic') {
    renderGpsClassic({
      ctx, canvas, scale, pad, fontSizeBase,
      schoolName, eventName, department, organizer, locationName, remarks,
      dateStr, timeStr, coordsStr, accStr, altStr, headingStr, addressLine,
      photoNumber, logoImg, qrImg
    });
  } else if (stampStyle === 'gov_inspection') {
    renderGovInspection({
      ctx, canvas, scale, pad, fontSizeBase,
      schoolName, eventName, department, organizer, locationName, remarks,
      dateStr, timeStr, coordsStr, accStr, altStr, headingStr, addressLine,
      photoNumber, logoImg, qrImg
    });
  } else if (stampStyle === 'modern_glass') {
    renderModernGlass({
      ctx, canvas, scale, pad, fontSizeBase,
      schoolName, eventName, department, organizer, locationName, remarks,
      dateStr, timeStr, coordsStr, accStr, altStr, headingStr, addressLine,
      photoNumber, logoImg, qrImg
    });
  } else if (stampStyle === 'minimal') {
    renderMinimal({
      ctx, canvas, scale, pad, fontSizeBase,
      schoolName, eventName, locationName,
      dateStr, timeStr, coordsStr, accStr, photoNumber
    });
  } else if (stampStyle === 'school_branding') {
    renderSchoolBranding({
      ctx, canvas, scale, pad, fontSizeBase,
      schoolName, eventName, department, organizer, locationName, remarks,
      dateStr, timeStr, coordsStr, accStr, altStr, headingStr, addressLine,
      photoNumber, logoImg, qrImg
    });
  }

  // Output blob & dataUrl
  const quality = settings?.imageQuality || 0.9;
  const dataUrl = canvas.toDataURL('image/jpeg', quality);

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', quality);
  });

  return { blob, dataUrl };
}

// Helper to draw rounded rectangle
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

// 1. STYLE: GPS CLASSIC
function renderGpsClassic(opts: any) {
  const {
    ctx, canvas, scale, pad, fontSizeBase,
    schoolName, eventName, department, organizer, locationName, remarks,
    dateStr, timeStr, coordsStr, accStr, altStr, headingStr, addressLine,
    photoNumber, logoImg, qrImg
  } = opts;

  // Bottom overlay banner
  const bannerHeight = Math.round(180 * scale);
  const bannerY = canvas.height - bannerHeight;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(0, bannerY, canvas.width, bannerHeight);

  // Top accent line
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, bannerY, canvas.width, Math.round(4 * scale));

  // Left column (GPS Tech Data)
  const leftX = pad;
  let currY = bannerY + Math.round(28 * scale);

  ctx.fillStyle = '#38bdf8'; // Light blue accent
  ctx.font = `bold ${Math.round(fontSizeBase * 1.1)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`📍 ${coordsStr}`, leftX, currY);

  currY += Math.round(22 * scale);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `${Math.round(fontSizeBase * 0.85)}px 'JetBrains Mono', monospace`;

  const metaParts = [accStr ? `Acc: ${accStr}` : '', altStr, headingStr].filter(Boolean);
  if (metaParts.length > 0) {
    ctx.fillText(metaParts.join(' | '), leftX, currY);
    currY += Math.round(22 * scale);
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.95)}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillText(`📅 ${dateStr}  ⏰ ${timeStr}`, leftX, currY);

  currY += Math.round(22 * scale);
  ctx.fillStyle = '#fbbf24'; // Amber ID badge
  ctx.font = `bold ${Math.round(fontSizeBase * 0.9)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`ID: ${photoNumber}`, leftX, currY);

  // Right column (School & Event Context)
  const rightX = Math.round(canvas.width * 0.45);
  currY = bannerY + Math.round(28 * scale);

  if (schoolName) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(fontSizeBase * 1.2)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(schoolName, rightX, currY, canvas.width - rightX - (qrImg ? 110 * scale : pad));
    currY += Math.round(24 * scale);
  }

  if (eventName) {
    ctx.fillStyle = '#60a5fa';
    ctx.font = `600 ${Math.round(fontSizeBase * 1.0)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(`Event: ${eventName}`, rightX, currY, canvas.width - rightX - (qrImg ? 110 * scale : pad));
    currY += Math.round(22 * scale);
  }

  const deptOrg = [department ? `Dept: ${department}` : '', organizer ? `Org: ${organizer}` : ''].filter(Boolean).join(' | ');
  if (deptOrg) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = `${Math.round(fontSizeBase * 0.85)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(deptOrg, rightX, currY, canvas.width - rightX - pad);
    currY += Math.round(20 * scale);
  }

  if (locationName || addressLine) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `${Math.round(fontSizeBase * 0.85)}px 'Plus Jakarta Sans', sans-serif`;
    const locText = locationName ? `📍 ${locationName}${addressLine ? ' - ' + addressLine : ''}` : `📍 ${addressLine}`;
    ctx.fillText(locText, rightX, currY, canvas.width - rightX - pad);
  }

  // Draw QR code on right edge if available
  if (qrImg) {
    const qrSize = Math.round(90 * scale);
    ctx.drawImage(qrImg, canvas.width - qrSize - pad, bannerY + Math.round(35 * scale), qrSize, qrSize);
  }

  // Draw Logo on top left if available
  if (logoImg) {
    const logoSize = Math.round(70 * scale);
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logoImg, pad, pad, logoSize, logoSize);
    ctx.restore();
  }
}

// 2. STYLE: GOVERNMENT INSPECTION
function renderGovInspection(opts: any) {
  const {
    ctx, canvas, scale, pad, fontSizeBase,
    schoolName, eventName, department, organizer, locationName, remarks,
    dateStr, timeStr, coordsStr, accStr, altStr, headingStr, addressLine,
    photoNumber, logoImg, qrImg
  } = opts;

  // Header Banner
  const headerH = Math.round(80 * scale);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(0, 0, canvas.width, headerH);

  // Gold seal line
  ctx.fillStyle = '#d97706';
  ctx.fillRect(0, headerH - Math.round(4 * scale), canvas.width, Math.round(4 * scale));

  // Logo + Title
  if (logoImg) {
    const lSize = Math.round(55 * scale);
    ctx.drawImage(logoImg, pad, Math.round(12 * scale), lSize, lSize);
  }

  const headerTextX = logoImg ? pad + Math.round(70 * scale) : pad;
  ctx.fillStyle = '#fef08a'; // Yellow badge
  ctx.font = `bold ${Math.round(fontSizeBase * 0.8)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`OFFICIAL INSPECTION & DOCUMENTATION RECORD`, headerTextX, Math.round(25 * scale));

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(fontSizeBase * 1.2)}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillText(schoolName || 'EDUCATIONAL INSTITUTION RECORD', headerTextX, Math.round(52 * scale));

  // Bottom Box Panel
  const boxW = Math.round(520 * scale);
  const boxH = Math.round(220 * scale);
  const boxX = pad;
  const boxY = canvas.height - boxH - pad;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = Math.round(2 * scale);

  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, Math.round(12 * scale));
  ctx.fill();
  ctx.stroke();

  let innerY = boxY + Math.round(30 * scale);
  const innerX = boxX + Math.round(16 * scale);

  ctx.fillStyle = '#f8fafc';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.95)}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillText(`REF ID: ${photoNumber}`, innerX, innerY);

  if (eventName) {
    innerY += Math.round(22 * scale);
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold ${Math.round(fontSizeBase * 0.9)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(`EVENT: ${eventName}`, innerX, innerY);
  }

  if (department || organizer) {
    innerY += Math.round(20 * scale);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `${Math.round(fontSizeBase * 0.8)}px 'Plus Jakarta Sans', sans-serif`;
    const details = [department ? `DEPT: ${department}` : '', organizer ? `INSPECTOR: ${organizer}` : ''].filter(Boolean).join(' | ');
    ctx.fillText(details, innerX, innerY);
  }

  innerY += Math.round(22 * scale);
  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.85)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`LAT/LON: ${coordsStr}`, innerX, innerY);

  innerY += Math.round(20 * scale);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `${Math.round(fontSizeBase * 0.8)}px 'JetBrains Mono', monospace`;
  const meta = [accStr ? `ACC: ${accStr}` : '', altStr, headingStr].filter(Boolean).join('  ');
  ctx.fillText(meta, innerX, innerY);

  if (locationName || addressLine) {
    innerY += Math.round(20 * scale);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `${Math.round(fontSizeBase * 0.8)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(`LOC: ${locationName || addressLine}`, innerX, innerY, boxW - 30 * scale);
  }

  innerY += Math.round(22 * scale);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.85)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`DATE/TIME: ${dateStr} ${timeStr}`, innerX, innerY);
}

// 3. STYLE: MODERN GLASS
function renderModernGlass(opts: any) {
  const {
    ctx, canvas, scale, pad, fontSizeBase,
    schoolName, eventName, locationName,
    dateStr, timeStr, coordsStr, accStr,
    photoNumber, logoImg
  } = opts;

  const cardW = Math.round(480 * scale);
  const cardH = Math.round(150 * scale);
  const cardX = pad;
  const cardY = canvas.height - cardH - pad;

  ctx.save();
  // Glass card fill
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = Math.round(1.5 * scale);

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, Math.round(16 * scale));
  ctx.fill();
  ctx.stroke();

  let cY = cardY + Math.round(28 * scale);
  const cX = cardX + Math.round(20 * scale);

  // Top header inside glass
  if (schoolName) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(fontSizeBase * 1.1)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(schoolName, cX, cY, cardW - 40 * scale);
    cY += Math.round(24 * scale);
  }

  if (eventName || locationName) {
    ctx.fillStyle = '#60a5fa';
    ctx.font = `600 ${Math.round(fontSizeBase * 0.9)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(eventName || locationName, cX, cY, cardW - 40 * scale);
    cY += Math.round(24 * scale);
  }

  // Coordinates pill
  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.85)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`📍 ${coordsStr} ${accStr ? `(${accStr})` : ''}`, cX, cY);

  cY += Math.round(22 * scale);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `${Math.round(fontSizeBase * 0.8)}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillText(`🕒 ${dateStr} ${timeStr} • #${photoNumber}`, cX, cY);

  ctx.restore();
}

// 4. STYLE: MINIMAL
function renderMinimal(opts: any) {
  const {
    ctx, canvas, scale, pad, fontSizeBase,
    schoolName, eventName, dateStr, timeStr, coordsStr, photoNumber
  } = opts;

  const barH = Math.round(50 * scale);
  const barY = canvas.height - barH;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, barY, canvas.width, barH);

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.round(fontSizeBase * 0.85)}px 'Plus Jakarta Sans', sans-serif`;
  
  const text = [schoolName, eventName, photoNumber].filter(Boolean).join(' | ');
  ctx.fillText(text, pad, barY + Math.round(30 * scale), canvas.width * 0.5);

  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.85)}px 'JetBrains Mono', monospace`;
  const rightText = `${coordsStr}  ${dateStr} ${timeStr}`;
  ctx.textAlign = 'right';
  ctx.fillText(rightText, canvas.width - pad, barY + Math.round(30 * scale));
  ctx.textAlign = 'left';
}

// 5. STYLE: SCHOOL BRANDING
function renderSchoolBranding(opts: any) {
  const {
    ctx, canvas, scale, pad, fontSizeBase,
    schoolName, eventName, department, organizer, locationName, remarks,
    dateStr, timeStr, coordsStr, accStr, altStr, addressLine,
    photoNumber, logoImg, qrImg
  } = opts;

  // Header Banner
  const headerH = Math.round(90 * scale);
  ctx.fillStyle = '#1e3a8a'; // Deep blue school header
  ctx.fillRect(0, 0, canvas.width, headerH);

  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, headerH - Math.round(4 * scale), canvas.width, Math.round(4 * scale));

  if (logoImg) {
    const lSize = Math.round(60 * scale);
    ctx.drawImage(logoImg, pad, Math.round(15 * scale), lSize, lSize);
  }

  const hX = logoImg ? pad + Math.round(75 * scale) : pad;
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.round(fontSizeBase * 1.3)}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillText(schoolName || 'SCHOOL EVENT GEO CAMERA', hX, Math.round(42 * scale));

  if (eventName) {
    ctx.fillStyle = '#93c5fd';
    ctx.font = `600 ${Math.round(fontSizeBase * 0.95)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(`Event: ${eventName}`, hX, Math.round(68 * scale));
  }

  // Footer Banner
  const footerH = Math.round(110 * scale);
  const footerY = canvas.height - footerH;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(0, footerY, canvas.width, footerH);

  let fY = footerY + Math.round(28 * scale);
  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.95)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`📍 ${coordsStr} ${accStr ? `(${accStr})` : ''}`, pad, fY);

  fY += Math.round(22 * scale);
  ctx.fillStyle = '#f8fafc';
  ctx.font = `${Math.round(fontSizeBase * 0.85)}px 'Plus Jakarta Sans', sans-serif`;
  const loc = [locationName, addressLine].filter(Boolean).join(' - ');
  if (loc) {
    ctx.fillText(`Location: ${loc}`, pad, fY, canvas.width - Math.round(150 * scale));
    fY += Math.round(22 * scale);
  }

  ctx.fillStyle = '#fbbf24';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.85)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`ID: ${photoNumber}   Date: ${dateStr} ${timeStr}`, pad, fY);
}
