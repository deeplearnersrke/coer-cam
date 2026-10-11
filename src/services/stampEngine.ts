import {

  GeoPhoto,

  SchoolEvent,

  StampStyle,

  AppSettings,

} from '../types';


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

    // Generate a high-resolution QR with a proper quiet zone and error correction.
    // The canvas may later scale it down, so generate at a larger source size.
    return await QRCode.toDataURL(text, {
      // Medium correction keeps the URL QR less dense and easier for phone cameras to scan.
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 512,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
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

  const months = [

    'Jan',

    'Feb',

    'Mar',

    'Apr',

    'May',

    'Jun',

    'Jul',

    'Aug',

    'Sep',

    'Oct',

    'Nov',

    'Dec',

  ];

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

function clamp(value: number, min: number, max: number): number {

  return Math.min(max, Math.max(min, value));

}

function truncateToWidth(

  ctx: CanvasRenderingContext2D,

  text: string,

  maxWidth: number

): string {

  if (!text) return '';

  if (ctx.measureText(text).width <= maxWidth) {

    return text;

  }

  let result = text;

  while (

    result.length > 1 &&

    ctx.measureText(`${result}…`).width > maxWidth

  ) {

    result = result.slice(0, -1);

  }

  return `${result}…`;

}

/**

 * Wraps text into multiple lines given a max width in pixels.

 * Optionally limits total lines and adds ellipsis.

 */

function wrapText(

  ctx: CanvasRenderingContext2D,

  text: string,

  maxWidth: number,

  maxLines = 0

): string[] {

  if (!text || maxWidth <= 0) return [];

  const words = String(text)

    .trim()

    .split(/\s+/)

    .filter(Boolean);

  if (words.length === 0) return [];

  const lines: string[] = [];

  let currentLine = '';

  for (const word of words) {

    // If a single word is too wide, break it by characters

    if (ctx.measureText(word).width > maxWidth) {

      if (currentLine) {

        lines.push(currentLine);

        currentLine = '';

      }

      let chunk = '';

      for (let i = 0; i < word.length; i++) {

        const char = word[i];

        if (ctx.measureText(chunk + char).width <= maxWidth) {

          chunk += char;

        } else {

          if (chunk) lines.push(chunk);

          chunk = char;

        }

      }

      currentLine = chunk;

      continue;

    }

    const testLine = currentLine

      ? `${currentLine} ${word}`

      : word;

    if (ctx.measureText(testLine).width <= maxWidth) {

      currentLine = testLine;

    } else {

      if (currentLine) lines.push(currentLine);

      currentLine = word;

    }

  }

  if (currentLine) {

    lines.push(currentLine);

  }

  if (maxLines > 0 && lines.length > maxLines) {

    const trimmed = lines.slice(0, maxLines);

    trimmed[maxLines - 1] = truncateToWidth(

      ctx,

      `${trimmed[maxLines - 1]} …`,

      maxWidth

    );

    return trimmed;

  }

  return lines;

}

/**

 * Helper to draw rounded rectangle on Canvas

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

  ctx.quadraticCurveTo(

    x + width,

    y + height,

    x + width - radius,

    y + height

  );

  ctx.lineTo(x + radius, y + height);

  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);

  ctx.lineTo(x, y + radius);

  ctx.quadraticCurveTo(x, y, x + radius, y);

  ctx.closePath();

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

 * Core Canvas Stamp Engine with Official Monochrome Document Layout

 *

 * Supports both Portrait and Landscape orientations:

 *

 * Portrait:

 * - bottom full-width stamp panel

 * - single-column information layout

 *

 * Landscape:

 * - wider bottom-left / bottom-area stamp panel

 * - optional 2-column information layout when space allows

 * - auto-shrinks to prevent overflow

 */

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

  canvas.width =

    baseImg.naturalWidth || baseImg.width || 1920;

  canvas.height =

    baseImg.naturalHeight || baseImg.height || 1080;

  if (canvas.width <= 0 || canvas.height <= 0) {

    throw new Error('Invalid image dimensions');

  }

  const ctx = canvas.getContext('2d');

  if (!ctx) {

    throw new Error('Could not get canvas context');

  }

  ctx.imageSmoothingEnabled = true;

  ctx.imageSmoothingQuality = 'high';

  // Draw original photo

  ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

  // Detect orientation (explicit or inferred from canvas aspect ratio)

  const isLandscape = input.orientation

    ? input.orientation === 'landscape'

    : canvas.width >= canvas.height;

  // Field values

  const schoolName =

    event?.schoolName ||

    settings?.schoolName ||

    input.customSchoolName ||

    'INSTITUTION DOCUMENTATION';

  const eventName = event?.name || '';


  const organizer = event?.organizer || '';

  const locationName = event?.locationName || '';


  const logoUrl = event?.logoDataUrl || settings?.logoDataUrl || '';

  const dateStr = formatOfficialDate(timestamp);


  const hasCoords =

    location.latitude !== 0 || location.longitude !== 0;

  const latStr = hasCoords

    ? formatLatDegrees(location.latitude)

    : '';

  const lonStr = hasCoords

    ? formatLonDegrees(location.longitude)

    : '';

  const accStr =

    typeof location.accuracy === 'number' &&

    location.accuracy > 0 &&

    location.accuracy < 900

      ? `±${Math.round(location.accuracy)} m`

      : '';

  const altStr =

    location.altitude !== null &&

    location.altitude !== undefined

      ? `${Math.round(location.altitude)} m`

      : '';

  const addr = location.address;

  const addressLine =

    addr?.formattedAddress ||

    [

      addr?.village,

      addr?.city,

      addr?.district,

      addr?.state,

      addr?.country,

    ]

      .filter(Boolean)

      .join(', ') ||

    locationName;

  // QR Code (Only if enabled in settings)

  let qrImg: HTMLImageElement | null = null;

  if (
    settings?.showQrCode &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    (location.latitude !== 0 || location.longitude !== 0)
  ) {

    const latitude = location.latitude;
    const longitude = location.longitude;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
    const qrData = await generateQrDataUrl(mapsUrl);

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

  const customFont = settings?.defaultFont?.trim();

  const fontFamily = customFont

    ? `${customFont}, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

    : `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

  // Reference-matched dark glass stamp. Location gets a full-width row;
  // the remaining metadata stays in two columns. Direction is intentionally omitted.
  const panelAlpha = typeof settings?.watermarkOpacity === 'number'
    ? clamp(settings.watermarkOpacity, 0.78, 0.96)
    : 0.88;

  const s = clamp(canvas.width / (isLandscape ? 1600 : 1080), 0.72, 1.8);
  const margin = Math.round(canvas.width * 0.022);
  // Keep the stamp broad in landscape too, so the address, metadata and QR
  // have enough room instead of compressing into a narrow card.
  const panelWidth = isLandscape
    ? Math.round(canvas.width * 0.84)
    : canvas.width - margin * 2;
  const panelX = Math.round((canvas.width - panelWidth) / 2);
  const pad = Math.round(22 * s);
  const radius = Math.round(24 * s);
  const headerFont = `700 ${Math.round(29 * s)}px ${fontFamily}`;
  const subtitleFont = `500 ${Math.round(20 * s)}px ${fontFamily}`;
  const labelFont = `500 ${Math.round(16 * s)}px ${fontFamily}`;
  const valueFont = `500 ${Math.round(17 * s)}px ${fontFamily}`;
  const rowGap = Math.round(13 * s);
  const lineHeight = Math.round(22 * s);
  const headerLine = Math.round(34 * s);
  const subtitleLine = Math.round(25 * s);
  const qrSize = qrImg ? Math.round(96 * s) : 0;
  const qrFramePad = Math.round(7 * s);
  const qrFrameSize = qrImg ? qrSize + qrFramePad * 2 : 0;

  const innerWidth = panelWidth - pad * 2;
  const headerIconSize = Math.round(66 * s);
  const headerTextX = panelX + pad + headerIconSize + Math.round(20 * s);
  const columnGap = Math.round(28 * s);
  const columnWidth = Math.floor((innerWidth - columnGap) / 2);
  const leftX = panelX + pad;
  const rightX = leftX + columnWidth + columnGap;
  const labelWidthLeft = Math.min(Math.round(100 * s), Math.round(columnWidth * 0.36));
  const labelWidthRight = Math.min(Math.round(78 * s), Math.round(columnWidth * 0.32));

  const gpsItems: KeyVal[] = [];
  if (latStr && lonStr) gpsItems.push({ label: 'GPS', value: `${latStr}, ${lonStr}` });
  else if (latStr || lonStr) gpsItems.push({ label: 'GPS', value: [latStr, lonStr].filter(Boolean).join(', ') });
  if (accStr) gpsItems.push({ label: 'Accuracy', value: accStr });
  if (altStr) gpsItems.push({ label: 'Altitude', value: altStr });

  const dateItems: KeyVal[] = [
    { label: 'Date', value: dateStr },
    { label: 'Time', value: formatOfficialTime(timestamp).replace(/:\d{2} (?=[AP]M)/, '') },
    { label: 'Photo ID', value: photoNumber },
  ];

  // Location is deliberately measured across the full inner panel width.
  // No max-line limit is supplied, so the complete address is retained.
  ctx.font = valueFont;
  const locationLabelWidth = Math.round(96 * s);
  const locationValueWidth = Math.max(40, innerWidth - Math.round(34 * s) - locationLabelWidth - Math.round(12 * s));
  const locationLines = addressLine ? wrapText(ctx, addressLine, locationValueWidth) : [];
  const locationRowHeight = addressLine
    ? Math.max(lineHeight, locationLines.length * lineHeight) + rowGap
    : 0;

  const measureColumn = (items: KeyVal[], maxValueWidth: number) => {
    ctx.font = valueFont;
    return items.map((item) => ({
      ...item,
      lines: wrapText(ctx, item.value, Math.max(40, maxValueWidth)),
    }));
  };

  const leftMeasured = measureColumn(
    gpsItems,
    columnWidth - Math.round(34 * s) - labelWidthLeft - Math.round(8 * s)
  );
  // Keep the metadata column readable. The QR tile is placed in the free
  // far-right panel area, so it should not reduce Date/Time/Photo ID text width.
  const rightMeasured = measureColumn(
    dateItems,
    columnWidth - Math.round(34 * s) - labelWidthRight - Math.round(8 * s)
  );
  const itemHeight = (item: { lines: string[] }) => Math.max(1, item.lines.length) * lineHeight + rowGap;
  const leftContentHeight = leftMeasured.reduce((sum, item) => sum + itemHeight(item), 0);
  const rightContentHeight = rightMeasured.reduce((sum, item) => sum + itemHeight(item), 0);
  const headerTop = pad + Math.round(3 * s);
  const headerHeight = Math.max(headerIconSize, headerLine + subtitleLine + Math.round(6 * s));
  const dividerYRelative = headerTop + headerHeight + Math.round(20 * s);
  const contentTopRelative = dividerYRelative + Math.round(27 * s);
  const locationTopRelative = contentTopRelative;
  const columnsTopRelative = contentTopRelative + locationRowHeight;
  const columnsHeight = Math.max(leftContentHeight, rightContentHeight);
  // QR is placed beside the Date/Time/Photo ID stack, with its bottom aligned
  // to the Photo ID row. No separate QR footer is needed, so the panel stays compact.
  // Account for the QR tile in the measured panel height. Previously the
  // QR could extend beyond the panel's clipped content area on compact layouts.
  const contentHeight = Math.max(columnsHeight, qrFrameSize);
  const panelHeight = Math.min(
    canvas.height - margin * 2,
    columnsTopRelative + contentHeight + pad
  );
  const panelY = canvas.height - panelHeight - margin;
  const locationTop = panelY + locationTopRelative;
  const columnsTop = panelY + columnsTopRelative;

  ctx.save();
  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, radius);
  const glassGradient = ctx.createLinearGradient(panelX, panelY, panelX + panelWidth, panelY + panelHeight);
  glassGradient.addColorStop(0, `rgba(9, 17, 27, ${panelAlpha})`);
  glassGradient.addColorStop(0.52, `rgba(11, 20, 31, ${Math.max(0.72, panelAlpha - 0.06)})`);
  glassGradient.addColorStop(1, `rgba(5, 11, 19, ${panelAlpha})`);
  ctx.fillStyle = glassGradient;
  ctx.fill();
  ctx.clip();

  // Cyan edge and signature vertical accent.
  ctx.fillStyle = '#22E6F8';
  ctx.fillRect(panelX, panelY + Math.round(24 * s), Math.max(4, Math.round(5 * s)), Math.min(Math.round(88 * s), panelHeight - Math.round(48 * s)));

  // Circular university emblem with a simple graduation-cap line drawing.
  const iconCx = panelX + pad + headerIconSize / 2;
  const iconCy = panelY + headerTop + headerIconSize / 2;
  ctx.beginPath();
  ctx.arc(iconCx, iconCy, headerIconSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 210, 235, 0.16)';
  ctx.fill();
  ctx.strokeStyle = '#22E6F8';
  ctx.lineWidth = Math.max(2, 2.2 * s);
  ctx.beginPath();
  ctx.moveTo(iconCx - 22 * s, iconCy - 4 * s);
  ctx.lineTo(iconCx, iconCy - 13 * s);
  ctx.lineTo(iconCx + 22 * s, iconCy - 4 * s);
  ctx.lineTo(iconCx, iconCy + 5 * s);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(iconCx - 14 * s, iconCy + 2 * s);
  ctx.lineTo(iconCx - 14 * s, iconCy + 13 * s);
  ctx.quadraticCurveTo(iconCx, iconCy + 24 * s, iconCx + 14 * s, iconCy + 13 * s);
  ctx.lineTo(iconCx + 14 * s, iconCy + 2 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(iconCx + 22 * s, iconCy - 4 * s);
  ctx.lineTo(iconCx + 22 * s, iconCy + 12 * s);
  ctx.stroke();

  // Header and event subtitle.
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#F8FAFC';
  ctx.font = headerFont;
  ctx.fillText(truncateToWidth(ctx, schoolName, panelWidth - (headerTextX - panelX) - pad), headerTextX, panelY + headerTop + Math.round(4 * s));
  ctx.fillStyle = '#A8B8CA';
  ctx.font = subtitleFont;
  const subtitle = [eventName, organizer].filter(Boolean).join(' · ');
  if (subtitle) ctx.fillText(truncateToWidth(ctx, subtitle, panelWidth - (headerTextX - panelX) - pad), headerTextX, panelY + headerTop + headerLine + Math.round(3 * s));

  // Header divider.
  ctx.fillStyle = 'rgba(148, 163, 184, 0.24)';
  ctx.fillRect(panelX + pad, panelY + dividerYRelative, panelWidth - pad * 2, Math.max(1, Math.round(1.2 * s)));

  // Vertical divider starts below the full-width Location row.
  const verticalDividerX = rightX - Math.round(columnGap / 2);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.fillRect(verticalDividerX, columnsTop, Math.max(1, Math.round(s)), Math.max(leftContentHeight, rightContentHeight));

  const drawFieldIcon = (x: number, y: number, label: string) => {
    const cx = x + Math.round(13 * s);
    const cy = y + Math.round(8 * s);
    ctx.save();
    ctx.strokeStyle = '#22E6F8';
    ctx.fillStyle = '#22E6F8';
    ctx.lineWidth = Math.max(1.7, 2 * s);
    if (label === 'Location') {
      ctx.beginPath(); ctx.arc(cx, cy - 2 * s, 6 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 4 * s, cy + 2 * s); ctx.lineTo(cx, cy + 10 * s); ctx.lineTo(cx + 4 * s, cy + 2 * s); ctx.stroke();
    } else if (label === 'GPS') {
      ctx.beginPath(); ctx.arc(cx, cy, 7 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 2 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 11 * s, cy); ctx.lineTo(cx - 8 * s, cy); ctx.moveTo(cx + 8 * s, cy); ctx.lineTo(cx + 11 * s, cy); ctx.stroke();
    } else if (label === 'Accuracy') {
      ctx.beginPath(); ctx.arc(cx, cy, 7 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 10 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 7 * s, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 10 * s, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    } else if (label === 'Altitude') {
      ctx.beginPath(); ctx.moveTo(cx - 10 * s, cy + 7 * s); ctx.lineTo(cx, cy - 8 * s); ctx.lineTo(cx + 10 * s, cy + 7 * s); ctx.closePath(); ctx.stroke();
    } else if (label === 'Date') {
      ctx.strokeRect(cx - 8 * s, cy - 7 * s, 16 * s, 15 * s);
      ctx.beginPath(); ctx.moveTo(cx - 8 * s, cy - 2 * s); ctx.lineTo(cx + 8 * s, cy - 2 * s); ctx.moveTo(cx - 4 * s, cy - 10 * s); ctx.lineTo(cx - 4 * s, cy - 4 * s); ctx.moveTo(cx + 4 * s, cy - 10 * s); ctx.lineTo(cx + 4 * s, cy - 4 * s); ctx.stroke();
    } else if (label === 'Time') {
      ctx.beginPath(); ctx.arc(cx, cy, 9 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 5 * s); ctx.moveTo(cx, cy); ctx.lineTo(cx + 5 * s, cy + 3 * s); ctx.stroke();
    } else {
      ctx.strokeRect(cx - 8 * s, cy - 9 * s, 16 * s, 18 * s);
      ctx.beginPath(); ctx.moveTo(cx - 4 * s, cy + 3 * s); ctx.lineTo(cx, cy - 2 * s); ctx.lineTo(cx + 4 * s, cy + 3 * s); ctx.stroke();
    }
    ctx.restore();
  };

  // Full-width Location row. The complete address wraps naturally and is never ellipsized.
  if (addressLine) {
    drawFieldIcon(leftX, locationTop, 'Location');
    const locationTextX = leftX + Math.round(34 * s);
    ctx.textBaseline = 'top';
    ctx.font = labelFont;
    ctx.fillStyle = '#A8B8CA';
    ctx.fillText('Location', locationTextX, locationTop);
    ctx.font = valueFont;
    ctx.fillStyle = '#F8FAFC';
    const locationValueX = locationTextX + locationLabelWidth;
    locationLines.forEach((line, lineIndex) => {
      ctx.fillText(line, locationValueX, locationTop + lineIndex * lineHeight);
    });
  }


  const drawColumn = (itemsToDraw: Array<KeyVal & { lines: string[] }>, x: number, labelWidth: number) => {
    let y = columnsTop;
    itemsToDraw.forEach((item) => {
      drawFieldIcon(x, y, item.label);
      const textX = x + Math.round(34 * s);
      ctx.textBaseline = 'top';
      ctx.font = labelFont;
      ctx.fillStyle = '#A8B8CA';
      ctx.fillText(item.label, textX, y);
      ctx.font = valueFont;
      ctx.fillStyle = '#F8FAFC';
      const valueX = textX + labelWidth;
      item.lines.forEach((line, lineIndex) => {
        ctx.fillText(line, valueX, y + lineIndex * lineHeight);
      });
      y += itemHeight(item);
    });
  };

  drawColumn(leftMeasured, leftX, labelWidthLeft);
  drawColumn(rightMeasured, rightX, labelWidthRight);

  // QR tile sits immediately to the right of the Photo ID row. Its vertical
  // center aligns with that row; the panel height above accounts for the tile.
  if (qrImg && qrSize > 0) {
    const frameSize = qrFrameSize;
    const qrX = panelX + panelWidth - pad - frameSize;
    const photoIdIndex = rightMeasured.findIndex((item) => item.label === 'Photo ID');
    let photoIdY = columnsTop;
    for (let i = 0; i < photoIdIndex; i++) {
      photoIdY += itemHeight(rightMeasured[i]);
    }
    // Center the QR tile on the Photo ID row. Calculate against the actual
    // Photo ID row (not the panel bottom), then clamp only to the panel's
    // inner bounds so the QR cannot be pushed into a separate footer position.
    const photoIdRowCenter = photoIdY + lineHeight / 2;
    const qrMinY = panelY + dividerYRelative + Math.round(8 * s);
    const qrMaxY = panelY + panelHeight - pad - frameSize;
    const desiredQrY = photoIdRowCenter - frameSize / 2;
    const qrY = qrMaxY >= qrMinY
      ? clamp(desiredQrY, qrMinY, qrMaxY)
      : Math.max(qrMinY, desiredQrY);
    drawRoundedRect(ctx, qrX, qrY, frameSize, frameSize, Math.round(10 * s));
    ctx.fillStyle = 'rgba(4, 10, 18, 0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(34, 230, 248, 0.95)';
    ctx.lineWidth = Math.max(1.5, 1.4 * s);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrX + qrFramePad, qrY + qrFramePad, qrSize, qrSize);
    ctx.drawImage(qrImg, qrX + qrFramePad, qrY + qrFramePad, qrSize, qrSize);
  }
  ctx.restore();

  // Crisp cyan outline around the glass panel.
  ctx.save();
  drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, radius);
  ctx.strokeStyle = 'rgba(34, 230, 248, 0.98)';
  ctx.lineWidth = Math.max(1.5, 1.4 * s);
  ctx.stroke();
  ctx.restore();

  // Output blob & dataUrl

  const exportQualityMap: Record<string, number> = {

    high: 0.95,

    medium: 0.86,

    compact: 0.76,

  };

  const fallbackQuality = settings?.exportQuality

    ? exportQualityMap[settings.exportQuality] ?? 0.92

    : 0.92;

  const quality = clamp(

    settings?.imageQuality ?? fallbackQuality,

    0.5,

    1

  );

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
