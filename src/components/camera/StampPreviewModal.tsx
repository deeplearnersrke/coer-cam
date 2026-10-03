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







  // Draw original high-res photo



  ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);







  const scale = Math.max(canvas.width, canvas.height) / 1200; // Relative scale factor



  const pad = Math.round(20 * scale); // 20px padding as specified



  const cornerRadius = Math.round(12 * scale); // 12px rounded corners as specified







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



  const fontHeader = `600 ${Math.round(18 * scale)}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;



  const fontSubHeader = `500 ${Math.round(15 * scale)}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;



  const fontLabel = `500 ${Math.round(13 * scale)}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;



  const fontValue = `400 ${Math.round(13 * scale)}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;







  // --------------------------------------------------------

  // ORIENTATION-AWARE PANEL

  //

  // Do NOT use CSS/device orientation for the final stamp.

  // The actual captured image dimensions are authoritative:

  //   width > height  => landscape photo

  //   width <= height => portrait photo

  //

  // Portrait:

  //   wide panel along the bottom

  //

  // Landscape:

  //   compact vertical panel on the right side

  // --------------------------------------------------------

  const isLandscapePhoto = canvas.width > canvas.height;



  // Landscape gets a side panel. Portrait keeps the existing

  // bottom-panel style.

  const panelWidth = isLandscapePhoto

    ? Math.min(

        canvas.width - pad * 2,

        Math.round(420 * scale)

      )

    : Math.min(

        canvas.width - pad * 2,

        Math.round(620 * scale)

      );



  const panelX = isLandscapePhoto

    ? canvas.width - panelWidth - pad

    : pad;



  // Landscape needs a slightly more compact panel so it does

  // not cover a large portion of the photo.

  const effectivePad = isLandscapePhoto

    ? Math.round(14 * scale)

    : pad;



  const headerFontSize = isLandscapePhoto ? 16 : 18;

  const subHeaderFontSize = isLandscapePhoto ? 13 : 15;

  const labelFontSize = isLandscapePhoto ? 11 : 13;

  const valueFontSize = isLandscapePhoto ? 11 : 13;



  const panelFontHeader =

    `600 ${Math.round(headerFontSize * scale)}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;

  const panelFontSubHeader =

    `500 ${Math.round(subHeaderFontSize * scale)}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;

  const panelFontLabel =

    `500 ${Math.round(labelFontSize * scale)}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;

  const panelFontValue =

    `400 ${Math.round(valueFontSize * scale)}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;



  // Measure label column.

  ctx.font = panelFontLabel;

  let maxLabelWidth = 0;

  items.forEach((item) => {

    const w = ctx.measureText(`${item.label} : `).width;

    if (w > maxLabelWidth) maxLabelWidth = w;

  });



  // Keep QR out of the text column.

  const qrReserve = qrImg

    ? Math.round((isLandscapePhoto ? 64 : 80) * scale)

    : 0;



  const valueAvailWidth = Math.max(

    Math.round(80 * scale),

    panelWidth -

      (effectivePad * 2) -

      maxLabelWidth -

      qrReserve

  );



  // Header wrapping.

  ctx.font = panelFontHeader;

  const headerLines = wrapText(

    ctx,

    schoolName,

    panelWidth -

      effectivePad * 2 -

      (logoImg ? Math.round(50 * scale) : 0)

  );



  ctx.font = panelFontSubHeader;

  const subHeaderLines = wrapText(

    ctx,

    eventName,

    panelWidth - effectivePad * 2

  );



  // Process item lines.

  ctx.font = panelFontValue;

  const processedItems: { label: string; valLines: string[] }[] = [];



  items.forEach((item) => {

    const valLines = wrapText(ctx, item.value, valueAvailWidth);

    processedItems.push({

      label: item.label,

      valLines: valLines.length ? valLines : ['']

    });

  });



  // Compact line heights for landscape.

  const headerLineH = Math.round(

    (isLandscapePhoto ? 20 : 24) * scale

  );

  const subHeaderLineH = Math.round(

    (isLandscapePhoto ? 17 : 20) * scale

  );

  const itemLineH = Math.round(

    (isLandscapePhoto ? 15 : 18) * scale

  );

  const itemGap = Math.round(

    (isLandscapePhoto ? 2 : 3) * scale

  );



  let totalContentH = effectivePad * 2;



  totalContentH += headerLines.length * headerLineH;



  if (subHeaderLines.length > 0) {

    totalContentH +=

      subHeaderLines.length * subHeaderLineH +

      Math.round(3 * scale);

  }



  totalContentH += Math.round(

    (isLandscapePhoto ? 8 : 12) * scale

  );



  processedItems.forEach((pi) => {

    totalContentH +=

      Math.max(1, pi.valLines.length) * itemLineH +

      itemGap;

  });



  // Reserve QR space if the panel is landscape so it never

  // overlaps the bottom text.

  const qrSize = qrImg

    ? Math.round((isLandscapePhoto ? 58 : 72) * scale)

    : 0;



  if (qrImg && isLandscapePhoto) {

    totalContentH += qrSize + Math.round(4 * scale);

  }



  const panelHeight = Math.min(

    totalContentH,

    canvas.height - pad * 2

  );



  // Portrait keeps the panel at the bottom. Landscape moves the panel

  // to the right and vertically centers it inside the image.

  const panelY = isLandscapePhoto

    ? Math.max(

        pad,

        Math.round((canvas.height - panelHeight) / 2)

      )

    : canvas.height - panelHeight - pad;



  // Background panel.

  ctx.save();



  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';



  drawRoundedRect(

    ctx,

    panelX,

    panelY,

    panelWidth,

    panelHeight,

    cornerRadius

  );



  ctx.fill();



  // Border.

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';

  ctx.lineWidth = Math.max(

    1,

    Math.round(1 * scale)

  );

  ctx.stroke();



  // Content coordinates.

  let curY =

    panelY +

    effectivePad +

    Math.round(

      (isLandscapePhoto ? 10 : 14) * scale

    );



  const curX = panelX + effectivePad;



  // Logo.

  if (logoImg) {

    const logoSize = Math.round(

      (isLandscapePhoto ? 38 : 48) * scale

    );



    ctx.drawImage(

      logoImg,

      panelX +

        panelWidth -

        effectivePad -

        logoSize,

      panelY + effectivePad,

      logoSize,

      logoSize

    );

  }



  // Heading.

  ctx.fillStyle = '#FFFFFF';

  ctx.font = panelFontHeader;



  headerLines.forEach((line) => {

    ctx.fillText(line, curX, curY);

    curY += headerLineH;

  });



  // Event name.

  if (subHeaderLines.length > 0) {

    ctx.fillStyle = '#E2E8F0';

    ctx.font = panelFontSubHeader;



    subHeaderLines.forEach((line) => {

      ctx.fillText(line, curX, curY);

      curY += subHeaderLineH;

    });

  }



  // Divider.

  curY += Math.round(

    (isLandscapePhoto ? 3 : 4) * scale

  );



  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';



  ctx.fillRect(

    curX,

    curY,

    panelWidth - effectivePad * 2,

    Math.max(1, Math.round(1 * scale))

  );



  curY += Math.round(

    (isLandscapePhoto ? 8 : 12) * scale

  );



  // Key-value pairs.

  processedItems.forEach((pi) => {

    const labelText = pi.label;



    ctx.fillStyle = '#CBD5E1';

    ctx.font = panelFontLabel;

    ctx.fillText(labelText, curX, curY);



    const colonX =

      curX +

      maxLabelWidth -

      Math.round(10 * scale);



    ctx.fillText(':', colonX, curY);



    const valX = curX + maxLabelWidth;



    ctx.fillStyle = '#FFFFFF';

    ctx.font = panelFontValue;



    pi.valLines.forEach((valLine, idx) => {

      ctx.fillText(

        valLine,

        valX,

        curY + idx * itemLineH

      );

    });



    curY +=

      Math.max(1, pi.valLines.length) *

        itemLineH +

      itemGap;

  });



  // QR:

  // Portrait => bottom-right, as before.

  // Landscape => bottom-right of the vertical side panel.

  if (qrImg) {

    const qrX =

      panelX +

      panelWidth -

      effectivePad -

      qrSize;



    const qrY =

      panelY +

      panelHeight -

      effectivePad -

      qrSize;



    ctx.drawImage(

      qrImg,

      qrX,

      qrY,

      qrSize,

      qrSize

    );

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
