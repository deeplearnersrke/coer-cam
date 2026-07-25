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
}

/**
 * Core Canvas Stamp Engine with Dynamic Height & Non-Overlapping Text Wrapping
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
    addr?.postcode,
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
      schoolName, eventName, locationName, addressLine,
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

  const leftWidth = Math.round(canvas.width * 0.42);
  const rightX = leftWidth + pad;
  const qrSize = qrImg ? Math.round(90 * scale) : 0;
  const rightWidth = canvas.width - rightX - pad - (qrImg ? qrSize + pad : 0);

  // Set fonts to calculate text wrapping height
  const schoolFont = `800 ${Math.round(fontSizeBase * 1.15)}px 'Plus Jakarta Sans', sans-serif`;
  const eventFont = `600 ${Math.round(fontSizeBase * 0.95)}px 'Plus Jakarta Sans', sans-serif`;
  const subFont = `${Math.round(fontSizeBase * 0.85)}px 'Plus Jakarta Sans', sans-serif`;

  ctx.font = schoolFont;
  const schoolLines = wrapText(ctx, schoolName, rightWidth);

  ctx.font = eventFont;
  const eventLines = wrapText(ctx, eventName ? `Event: ${eventName}` : '', rightWidth);

  const deptOrg = [department ? `Dept: ${department}` : '', organizer ? `Org: ${organizer}` : ''].filter(Boolean).join(' | ');
  ctx.font = subFont;
  const deptLines = wrapText(ctx, deptOrg, rightWidth);

  const fullLoc = [locationName ? `Loc: ${locationName}` : '', addressLine ? `Addr: ${addressLine}` : ''].filter(Boolean).join(' - ');
  const locLines = wrapText(ctx, fullLoc, rightWidth);

  const remarkLines = wrapText(ctx, remarks ? `Note: ${remarks}` : '', rightWidth);

  // Calculate dynamic banner height
  const lineGap = Math.round(22 * scale);
  let rightContentH = (schoolLines.length * Math.round(26 * scale)) +
    (eventLines.length * Math.round(22 * scale)) +
    (deptLines.length * lineGap) +
    (locLines.length * lineGap) +
    (remarkLines.length * lineGap) + (pad * 2);

  const leftContentH = Math.round(130 * scale);
  const bannerHeight = Math.max(leftContentH, rightContentH, qrSize + pad * 2, Math.round(160 * scale));
  const bannerY = canvas.height - bannerHeight;

  // Background overlay
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fillRect(0, bannerY, canvas.width, bannerHeight);

  // Top accent bar
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, bannerY, canvas.width, Math.round(4 * scale));

  // Render Left Column (Telemetry)
  let leftY = bannerY + Math.round(28 * scale);
  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold ${Math.round(fontSizeBase * 1.05)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`📍 ${coordsStr}`, pad, leftY);

  leftY += Math.round(22 * scale);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `${Math.round(fontSizeBase * 0.85)}px 'JetBrains Mono', monospace`;
  const metaParts = [accStr ? `Acc: ${accStr}` : '', altStr, headingStr].filter(Boolean);
  if (metaParts.length > 0) {
    ctx.fillText(metaParts.join(' | '), pad, leftY);
    leftY += Math.round(22 * scale);
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.9)}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillText(`📅 ${dateStr}  ⏰ ${timeStr}`, pad, leftY);

  leftY += Math.round(22 * scale);
  ctx.fillStyle = '#fbbf24';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.9)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`ID: ${photoNumber}`, pad, leftY);

  // Render Right Column (Text Wrapped context)
  let rightY = bannerY + Math.round(28 * scale);

  if (schoolLines.length > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = schoolFont;
    schoolLines.forEach(l => {
      ctx.fillText(l, rightX, rightY);
      rightY += Math.round(24 * scale);
    });
  }

  if (eventLines.length > 0) {
    ctx.fillStyle = '#60a5fa';
    ctx.font = eventFont;
    eventLines.forEach(l => {
      ctx.fillText(l, rightX, rightY);
      rightY += Math.round(22 * scale);
    });
  }

  if (deptLines.length > 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = subFont;
    deptLines.forEach(l => {
      ctx.fillText(l, rightX, rightY);
      rightY += Math.round(20 * scale);
    });
  }

  if (locLines.length > 0) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = subFont;
    locLines.forEach(l => {
      ctx.fillText(l, rightX, rightY);
      rightY += Math.round(20 * scale);
    });
  }

  if (remarkLines.length > 0) {
    ctx.fillStyle = '#fb7185';
    ctx.font = subFont;
    remarkLines.forEach(l => {
      ctx.fillText(l, rightX, rightY);
      rightY += Math.round(20 * scale);
    });
  }

  // Draw QR code on far right
  if (qrImg) {
    ctx.drawImage(qrImg, canvas.width - qrSize - pad, bannerY + Math.round(25 * scale), qrSize, qrSize);
  }

  // Draw Logo on top left corner
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
  const headerH = Math.round(85 * scale);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(0, 0, canvas.width, headerH);

  // Gold seal line
  ctx.fillStyle = '#d97706';
  ctx.fillRect(0, headerH - Math.round(4 * scale), canvas.width, Math.round(4 * scale));

  if (logoImg) {
    const lSize = Math.round(55 * scale);
    ctx.drawImage(logoImg, pad, Math.round(15 * scale), lSize, lSize);
  }

  const headerTextX = logoImg ? pad + Math.round(70 * scale) : pad;
  ctx.fillStyle = '#fef08a';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.8)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`OFFICIAL INSPECTION & DOCUMENTATION RECORD`, headerTextX, Math.round(28 * scale));

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(fontSizeBase * 1.15)}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillText(schoolName || 'EDUCATIONAL INSTITUTION RECORD', headerTextX, Math.round(56 * scale), canvas.width - headerTextX - pad);

  // Bottom Inspection Panel Box
  const boxW = Math.min(canvas.width - pad * 2, Math.round(620 * scale));
  const innerWidth = boxW - Math.round(32 * scale);

  ctx.font = `bold ${Math.round(fontSizeBase * 0.85)}px 'Plus Jakarta Sans', sans-serif`;
  const eventLines = wrapText(ctx, eventName ? `EVENT: ${eventName}` : '', innerWidth);

  const deptInspector = [department ? `DEPT: ${department}` : '', organizer ? `INSPECTOR: ${organizer}` : ''].filter(Boolean).join(' | ');
  ctx.font = `${Math.round(fontSizeBase * 0.8)}px 'Plus Jakarta Sans', sans-serif`;
  const deptLines = wrapText(ctx, deptInspector, innerWidth);

  const locAddress = [locationName ? `LOCATION: ${locationName}` : '', addressLine ? `ADDRESS: ${addressLine}` : ''].filter(Boolean).join(' - ');
  ctx.font = `${Math.round(fontSizeBase * 0.8)}px 'Plus Jakarta Sans', sans-serif`;
  const locLines = wrapText(ctx, locAddress, innerWidth);

  const lineH = Math.round(20 * scale);
  const boxH = Math.round(110 * scale) + (eventLines.length * lineH) + (deptLines.length * lineH) + (locLines.length * lineH);
  const boxX = pad;
  const boxY = canvas.height - boxH - pad;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = Math.round(2 * scale);

  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, Math.round(12 * scale));
  ctx.fill();
  ctx.stroke();

  let innerY = boxY + Math.round(28 * scale);
  const innerX = boxX + Math.round(16 * scale);

  ctx.fillStyle = '#f8fafc';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.95)}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillText(`REF ID: ${photoNumber}`, innerX, innerY);
  innerY += lineH;

  if (eventLines.length > 0) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold ${Math.round(fontSizeBase * 0.85)}px 'Plus Jakarta Sans', sans-serif`;
    eventLines.forEach(l => {
      ctx.fillText(l, innerX, innerY);
      innerY += lineH;
    });
  }

  if (deptLines.length > 0) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `${Math.round(fontSizeBase * 0.8)}px 'Plus Jakarta Sans', sans-serif`;
    deptLines.forEach(l => {
      ctx.fillText(l, innerX, innerY);
      innerY += lineH;
    });
  }

  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.85)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`LAT/LON: ${coordsStr}`, innerX, innerY);
  innerY += lineH;

  ctx.fillStyle = '#94a3b8';
  ctx.font = `${Math.round(fontSizeBase * 0.8)}px 'JetBrains Mono', monospace`;
  const meta = [accStr ? `ACC: ${accStr}` : '', altStr, headingStr].filter(Boolean).join('  ');
  if (meta) {
    ctx.fillText(meta, innerX, innerY);
    innerY += lineH;
  }

  if (locLines.length > 0) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `${Math.round(fontSizeBase * 0.8)}px 'Plus Jakarta Sans', sans-serif`;
    locLines.forEach(l => {
      ctx.fillText(l, innerX, innerY);
      innerY += lineH;
    });
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.85)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`DATE/TIME: ${dateStr} ${timeStr}`, innerX, innerY);
}

// 3. STYLE: MODERN GLASS
function renderModernGlass(opts: any) {
  const {
    ctx, canvas, scale, pad, fontSizeBase,
    schoolName, eventName, locationName, addressLine,
    dateStr, timeStr, coordsStr, accStr, photoNumber
  } = opts;

  const cardW = Math.min(canvas.width - pad * 2, Math.round(580 * scale));
  const innerW = cardW - Math.round(40 * scale);

  ctx.font = `800 ${Math.round(fontSizeBase * 1.1)}px 'Plus Jakarta Sans', sans-serif`;
  const schoolLines = wrapText(ctx, schoolName, innerW);

  ctx.font = `600 ${Math.round(fontSizeBase * 0.9)}px 'Plus Jakarta Sans', sans-serif`;
  const eventLines = wrapText(ctx, eventName, innerW);

  ctx.font = `${Math.round(fontSizeBase * 0.8)}px 'Plus Jakarta Sans', sans-serif`;
  const locStr = [locationName, addressLine].filter(Boolean).join(' - ');
  const locLines = wrapText(ctx, locStr, innerW);

  const lineH = Math.round(22 * scale);
  const cardH = Math.round(90 * scale) + (schoolLines.length * lineH) + (eventLines.length * lineH) + (locLines.length * lineH);
  const cardX = pad;
  const cardY = canvas.height - cardH - pad;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = Math.round(1.5 * scale);

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, Math.round(16 * scale));
  ctx.fill();
  ctx.stroke();

  let cY = cardY + Math.round(28 * scale);
  const cX = cardX + Math.round(20 * scale);

  if (schoolLines.length > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(fontSizeBase * 1.1)}px 'Plus Jakarta Sans', sans-serif`;
    schoolLines.forEach(l => {
      ctx.fillText(l, cX, cY);
      cY += lineH;
    });
  }

  if (eventLines.length > 0) {
    ctx.fillStyle = '#60a5fa';
    ctx.font = `600 ${Math.round(fontSizeBase * 0.9)}px 'Plus Jakarta Sans', sans-serif`;
    eventLines.forEach(l => {
      ctx.fillText(l, cX, cY);
      cY += lineH;
    });
  }

  if (locLines.length > 0) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `${Math.round(fontSizeBase * 0.8)}px 'Plus Jakarta Sans', sans-serif`;
    locLines.forEach(l => {
      ctx.fillText(l, cX, cY);
      cY += lineH;
    });
  }

  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.85)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`📍 ${coordsStr} ${accStr ? `(${accStr})` : ''}`, cX, cY);

  cY += lineH;
  ctx.fillStyle = '#94a3b8';
  ctx.font = `${Math.round(fontSizeBase * 0.8)}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillText(`🕒 ${dateStr} ${timeStr} • #${photoNumber}`, cX, cY);

  ctx.restore();
}

// 4. STYLE: MINIMAL
function renderMinimal(opts: any) {
  const {
    ctx, canvas, scale, pad, fontSizeBase,
    schoolName, eventName, locationName, addressLine,
    dateStr, timeStr, coordsStr, photoNumber
  } = opts;

  ctx.font = `600 ${Math.round(fontSizeBase * 0.85)}px 'Plus Jakarta Sans', sans-serif`;
  const infoText = [schoolName, eventName, addressLine || locationName, photoNumber].filter(Boolean).join(' | ');
  const infoLines = wrapText(ctx, infoText, canvas.width - pad * 2);

  const lineH = Math.round(20 * scale);
  const barH = Math.round(40 * scale) + (infoLines.length * lineH);
  const barY = canvas.height - barH;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(0, barY, canvas.width, barH);

  let curY = barY + Math.round(24 * scale);
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.round(fontSizeBase * 0.85)}px 'Plus Jakarta Sans', sans-serif`;

  infoLines.forEach(l => {
    ctx.fillText(l, pad, curY);
    curY += lineH;
  });

  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.85)}px 'JetBrains Mono', monospace`;
  const rightText = `📍 ${coordsStr}  ${dateStr} ${timeStr}`;
  ctx.fillText(rightText, pad, curY);
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
  ctx.fillStyle = '#1e3a8a';
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
  ctx.fillText(schoolName || 'SCHOOL EVENT GEO CAMERA', hX, Math.round(42 * scale), canvas.width - hX - pad);

  if (eventName) {
    ctx.fillStyle = '#93c5fd';
    ctx.font = `600 ${Math.round(fontSizeBase * 0.95)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(`Event: ${eventName}`, hX, Math.round(68 * scale), canvas.width - hX - pad);
  }

  // Footer Banner
  ctx.font = `${Math.round(fontSizeBase * 0.85)}px 'Plus Jakarta Sans', sans-serif`;
  const loc = [locationName, addressLine].filter(Boolean).join(' - ');
  const locLines = wrapText(ctx, loc ? `Location: ${loc}` : '', canvas.width - pad * 2 - Math.round(120 * scale));

  const lineH = Math.round(22 * scale);
  const footerH = Math.round(80 * scale) + (locLines.length * lineH);
  const footerY = canvas.height - footerH;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fillRect(0, footerY, canvas.width, footerH);

  let fY = footerY + Math.round(28 * scale);
  ctx.fillStyle = '#38bdf8';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.95)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`📍 ${coordsStr} ${accStr ? `(${accStr})` : ''}`, pad, fY);

  if (locLines.length > 0) {
    fY += lineH;
    ctx.fillStyle = '#f8fafc';
    ctx.font = `${Math.round(fontSizeBase * 0.85)}px 'Plus Jakarta Sans', sans-serif`;
    locLines.forEach(l => {
      ctx.fillText(l, pad, fY);
      fY += lineH;
    });
  }

  fY += lineH;
  ctx.fillStyle = '#fbbf24';
  ctx.font = `bold ${Math.round(fontSizeBase * 0.85)}px 'JetBrains Mono', monospace`;
  ctx.fillText(`ID: ${photoNumber}   Date: ${dateStr} ${timeStr}`, pad, fY);
}
