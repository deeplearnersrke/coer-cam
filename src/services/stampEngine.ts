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

  const department = event?.department || '';

  const organizer = event?.organizer || '';

  const locationName = event?.locationName || '';

  const remarks = event?.remarks || input.customRemarks || '';

  const logoUrl = event?.logoDataUrl || settings?.logoDataUrl || '';



  const dateStr = formatOfficialDate(timestamp);

  const timeStr = formatOfficialTime(timestamp);



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



  const directionStr =

    settings?.showCompass &&

    typeof location.heading === 'number' &&

    !Number.isNaN(location.heading)

      ? headingToCardinal(location.heading)

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



  // Build Key-Value list (ONLY non-empty values!)

  const items: KeyVal[] = [];



  if (department) {

    items.push({ label: 'Department', value: department });

  }



  if (organizer) {

    items.push({ label: 'Organizer', value: organizer });

  }



  if (addressLine) {

    items.push({ label: 'Location', value: addressLine });

  }



  if (latStr) {

    items.push({ label: 'Latitude', value: latStr });

  }



  if (lonStr) {

    items.push({ label: 'Longitude', value: lonStr });

  }



  if (accStr) {

    items.push({ label: 'Accuracy', value: accStr });

  }



  if (altStr) {

    items.push({ label: 'Altitude', value: altStr });

  }



  if (directionStr) {

    items.push({ label: 'Direction', value: directionStr });

  }



  items.push({ label: 'Date', value: dateStr });

  items.push({ label: 'Time', value: timeStr });

  items.push({ label: 'Photo ID', value: photoNumber });



  if (remarks) {

    items.push({ label: 'Remarks', value: remarks });

  }



  // QR Code (Only if enabled in settings)

  let qrImg: HTMLImageElement | null = null;



  if (settings?.showQrCode) {

    const qrText = `ID:${photoNumber}|LAT:${location.latitude.toFixed(

      6

    )}|LON:${location.longitude.toFixed(6)}`;



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



  const customFont = settings?.defaultFont?.trim();



  const fontFamily = customFont

    ? `${customFont}, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

    : `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;



  const styleOpacity =

    stampStyle === 'minimal'

      ? 0.58

      : stampStyle === 'modern_glass'

      ? 0.62

      : stampStyle === 'gov_inspection'

      ? 0.82

      : 0.76;



  const panelOpacity =

    typeof settings?.watermarkOpacity === 'number'

      ? clamp(settings.watermarkOpacity, 0.35, 0.92)

      : styleOpacity;



  // Responsive scale factor depending on image orientation and dimensions

  const referenceWidth = isLandscape ? 1600 : 1080;



  let scale = clamp(canvas.width / referenceWidth, 0.75, 2.0);



  // Compact modern card: keep the overlay small so more of the photo remains visible.
  const maxPanelHeightRatio = isLandscape ? 0.36 : 0.40;



  const createLayout = (s: number) => {

    const pad = Math.round(13 * s);

    const cornerRadius = Math.round(16 * s);





    const availableCanvasWidth = canvas.width - pad * 2;



    let panelWidth: number;



    if (isLandscape) {

      // Landscape: wider card, but still controlled

      const desired = Math.round(

        canvas.width * (qrImg ? 0.46 : 0.56)

      );



      const min = Math.round(520 * s);



      panelWidth = Math.min(

        availableCanvasWidth,

        Math.max(min, desired)

      );

    } else {

      // Portrait: bottom full-width panel

      panelWidth = availableCanvasWidth;
    }

    // Keep portrait stamps inset from the edges; center landscape stamps.
    const panelX = isLandscape
      ? Math.round((canvas.width - panelWidth) / 2)
      : pad;



    // Typography definitions

    const fontHeader = `700 ${Math.round(23 * s)}px ${fontFamily}`;

    const fontSubHeader = `500 ${Math.round(17 * s)}px ${fontFamily}`;

    const fontLabel = `600 ${Math.round(14 * s)}px ${fontFamily}`;

    const fontValue = `400 ${Math.round(14.5 * s)}px ${fontFamily}`;



    const headerLineH = Math.round(27 * s);

    const subHeaderLineH = Math.round(21 * s);

    const itemLineH = Math.round(19 * s);

    const itemGap = Math.round(2 * s);



    const colonOffset = Math.round(4 * s);

    const valueGap = Math.round(10 * s);

    const colGap = Math.round(16 * s);



    const logoSize = logoImg ? Math.round(42 * s) : 0;

    const qrSize = qrImg ? Math.round(66 * s) : 0;



    // Measure max label width for vertical alignment column

    ctx.font = fontLabel;



    let maxLabelWidth = 0;



    items.forEach((item) => {

      const w = ctx.measureText(item.label).width;



      if (w > maxLabelWidth) {

        maxLabelWidth = w;

      }

    });



    const labelColumnWidth =

      maxLabelWidth + colonOffset + valueGap;



    const innerWidth = panelWidth - pad * 2;



    // Use 2 columns only for landscape and only when QR is not enabled

    const columns =

      !qrImg &&

      isLandscape &&

      innerWidth >= Math.round(720 * s)

        ? 2

        : 1;



    const columnWidth =

      columns === 2

        ? Math.floor((innerWidth - colGap) / 2)

        : innerWidth;



    const qrReserveWidth = qrImg

      ? qrSize + Math.round(16 * s)

      : 0;



    let valueWidth =

      columnWidth -

      labelColumnWidth -

      (columns === 1 ? qrReserveWidth : 0);



    valueWidth = Math.max(

      Math.round(120 * s),

      valueWidth

    );



    const valueMaxLines = columns === 2 ? 2 : 3;



    // Pre-calculate header lines

    ctx.font = fontHeader;



    const headerAvailableWidth = Math.max(

      Math.round(120 * s),

      innerWidth -

        (logoImg ? logoSize + Math.round(12 * s) : 0)

    );



    const headerLines = wrapText(

      ctx,

      schoolName,

      headerAvailableWidth,

      2

    );



    ctx.font = fontSubHeader;



    const subHeaderLines = wrapText(

      ctx,

      eventName,

      innerWidth,

      2

    );



    // Process item lines

    ctx.font = fontValue;



    const processed = items.map((item) => {

      const valueLines = wrapText(

        ctx,

        item.value,

        valueWidth,

        valueMaxLines

      );



      const lineCount = Math.max(1, valueLines.length);



      return {

        label: item.label,

        valueLines,

        blockHeight: lineCount * itemLineH + itemGap,

      };

    });



    const headerHeight =

      headerLines.length * headerLineH;



    const subHeaderHeight =

      subHeaderLines.length > 0

        ? subHeaderLines.length * subHeaderLineH +

          Math.round(4 * s)

        : 0;



    const dividerSpace = Math.round(9 * s);



    let columnsData: {

      items: typeof processed;

      height: number;

    }[];



    const totalItemHeight = processed.reduce(

      (sum, item) => sum + item.blockHeight,

      0

    );



    if (columns === 1) {

      columnsData = [

        {

          items: processed,

          height: totalItemHeight,

        },

      ];

    } else {

      // Split sequentially into two columns to preserve reading order

      let acc = 0;

      let splitIndex = processed.length;



      for (let i = 0; i < processed.length; i++) {

        acc += processed[i].blockHeight;



        if (acc >= totalItemHeight / 2) {

          splitIndex = i + 1;

          break;

        }

      }



      const left = processed.slice(0, splitIndex);

      const right = processed.slice(splitIndex);



      const leftHeight = left.reduce(

        (sum, item) => sum + item.blockHeight,

        0

      );



      const rightHeight = right.reduce(

        (sum, item) => sum + item.blockHeight,

        0

      );



      columnsData = [

        { items: left, height: leftHeight },

        { items: right, height: rightHeight },

      ];

    }



    const maxColumnHeight = columnsData.reduce(

      (max, col) => Math.max(max, col.height),

      0

    );



    const qrReserveHeight = qrImg

      ? qrSize + Math.round(12 * s)

      : 0;



    const contentHeight =

      headerHeight +

      subHeaderHeight +

      dividerSpace +

      maxColumnHeight +

      qrReserveHeight;



    const naturalPanelHeight = pad * 2 + contentHeight;



    const maximumAllowedHeight = Math.min(

      canvas.height - pad * 2,

      Math.round(canvas.height * maxPanelHeightRatio)

    );



    const panelHeight = Math.min(

      naturalPanelHeight,

      canvas.height - pad * 2

    );



    const panelY = Math.max(

      pad,

      canvas.height - panelHeight - pad

    );



    const fits =

      naturalPanelHeight <= maximumAllowedHeight;



    return {

      scale: s,

      pad,

      cornerRadius,

      panelX,

      panelY,

      panelWidth,

      panelHeight,

      columns,

      columnWidth,

      colGap,

      maxLabelWidth,

      colonOffset,

      valueGap,

      labelColumnWidth,

      valueWidth,

      headerLines,

      subHeaderLines,

      columnsData,

      logoSize,

      qrSize,

      fontHeader,

      fontSubHeader,

      fontLabel,

      fontValue,

      headerLineH,

      subHeaderLineH,

      itemLineH,

      itemGap,

      fits,

    };

  };



  let layout = createLayout(scale);



  // Auto-shrink stamp until it fits nicely

  let guard = 0;



  while (

    !layout.fits &&

    scale > 0.62 &&

    guard < 16

  ) {

    scale = Math.max(0.62, scale * 0.9);

    layout = createLayout(scale);

    guard += 1;

  }



  const s = layout.scale;



  // ========================================================

  // RENDER OFFICIAL DOCUMENT PANEL

  // ========================================================



  ctx.save();



  drawRoundedRect(

    ctx,

    layout.panelX,

    layout.panelY,

    layout.panelWidth,

    layout.panelHeight,

    layout.cornerRadius

  );



  ctx.fillStyle = `rgba(12, 16, 24, ${panelOpacity})`;

  ctx.fill();



  // Clip content inside rounded panel

  ctx.clip();

  // Slim blue accent for the modern inspection-card appearance.
  ctx.fillStyle = 'rgba(37, 99, 235, 0.98)';
  ctx.fillRect(layout.panelX, layout.panelY, Math.max(4, Math.round(4 * s)), layout.panelHeight);

  let curY =

    layout.panelY +

    layout.pad +

    Math.round(14 * s);



  const curX = layout.panelX + layout.pad;



  // Draw Logo if available

  if (logoImg && layout.logoSize > 0) {

    ctx.drawImage(

      logoImg,

      layout.panelX +

        layout.panelWidth -

        layout.pad -

        layout.logoSize,

      layout.panelY + layout.pad,

      layout.logoSize,

      layout.logoSize

    );

  }



  // Draw Heading

  ctx.fillStyle = '#FFFFFF';

  ctx.font = layout.fontHeader;



  layout.headerLines.forEach((line) => {

    ctx.fillText(line, curX, curY);

    curY += layout.headerLineH;

  });



  // Draw Subheading

  if (layout.subHeaderLines.length > 0) {

    ctx.fillStyle = '#334155';

    ctx.font = layout.fontSubHeader;



    layout.subHeaderLines.forEach((line) => {

      ctx.fillText(line, curX, curY);

      curY += layout.subHeaderLineH;

    });



    curY += Math.round(4 * s);

  }



  // Horizontal Divider Line

  curY += Math.round(4 * s);



  ctx.fillStyle = 'rgba(100, 116, 139, 0.28)';



  ctx.fillRect(

    curX,

    curY,

    layout.panelWidth - layout.pad * 2,

    Math.max(1, Math.round(1 * s))

  );



  curY += Math.round(6 * s);



  const contentStartY = curY;



  // Draw Key-Value Columns

  layout.columnsData.forEach((column, columnIndex) => {

    const x =

      layout.panelX +

      layout.pad +

      columnIndex *

        (layout.columnWidth + layout.colGap);



    let y = contentStartY;



    column.items.forEach((item) => {

      // Label

      ctx.fillStyle = '#475569';

      ctx.font = layout.fontLabel;



      ctx.fillText(item.label, x, y);



      // Colon

      const colonX =

        x + layout.maxLabelWidth + layout.colonOffset;



      ctx.fillText(':', colonX, y);



      // Value

      const valueX = x + layout.labelColumnWidth;



      ctx.fillStyle = '#FFFFFF';

      ctx.font = layout.fontValue;



      item.valueLines.forEach((line, lineIndex) => {

        ctx.fillText(

          line,

          valueX,

          y + lineIndex * layout.itemLineH

        );

      });



      y += item.blockHeight;

    });

  });



  // Draw QR Code on bottom right if enabled

  if (qrImg && layout.qrSize > 0) {

    ctx.drawImage(

      qrImg,

      layout.panelX +

        layout.panelWidth -

        layout.pad -

        layout.qrSize,

      layout.panelY +

        layout.panelHeight -

        layout.pad -

        layout.qrSize,

      layout.qrSize,

      layout.qrSize

    );

  }



  ctx.restore();



  // Subtle 1px monochrome border

  ctx.save();



  drawRoundedRect(

    ctx,

    layout.panelX,

    layout.panelY,

    layout.panelWidth,

    layout.panelHeight,

    layout.cornerRadius

  );



  ctx.strokeStyle = 'rgba(37, 99, 235, 0.72)';

  ctx.lineWidth = Math.max(1, Math.round(1.35 * s));

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