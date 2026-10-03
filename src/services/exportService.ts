import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { GeoPhoto, SchoolEvent, AppSettings } from '../types';
import { formatCoordinates } from './gps';

/**
 * Converts a Blob to DataURL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * PDF REPORT GENERATOR
 */
export async function generatePdfReport(opts: {
  event?: SchoolEvent;
  photos: GeoPhoto[];
  settings?: AppSettings;
}): Promise<Blob> {
  const { event, photos, settings } = opts;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const schoolName = event?.schoolName || settings?.schoolName || 'D-Cam';
  const eventName = event?.name || 'Inspection & Field Documentation';
  const department = event?.department || 'General';
  const organizer = event?.organizer || 'N/A';

  // Page dimensions
  const pageW = 210;
  const pageH = 297;
  const margin = 15;

  // Title & Header Banner
  doc.setFillColor(30, 58, 138); // Blue 900
  doc.rect(0, 0, pageW, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(schoolName, margin, 15);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Official Geo Tagged Photo Documentation Report: ${eventName}`, margin, 24);

  // Event Meta Box
  let currY = 45;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currY, pageW - margin * 2, 28, 3, 3, 'F');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Department: ${department}`, margin + 5, currY + 8);
  doc.text(`Organizer/Inspector: ${organizer}`, margin + 5, currY + 16);
  doc.text(`Total Documented Photos: ${photos.length}`, margin + 5, currY + 24);

  doc.text(`Generated On: ${new Date().toLocaleString()}`, pageW - margin - 75, currY + 8);
  doc.text(`Status: Verified Geo-Stamped`, pageW - margin - 75, currY + 16);

  currY += 36;

  // Render Photos List (2 photos per A4 page)
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];

    // Check page overflow
    if (currY > pageH - 110) {
      doc.addPage();
      currY = 20;
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, currY, pageW - margin * 2, 105, 3, 3, 'S');

    // Convert stamped blob to image data
    let imgDataUrl = p.stampedDataUrl;
    if (!imgDataUrl && p.stampedBlob) {
      imgDataUrl = await blobToDataUrl(p.stampedBlob);
    }

    if (imgDataUrl) {
      try {
        // Photo aspect ~ 4:3
        doc.addImage(imgDataUrl, 'JPEG', margin + 5, currY + 5, 120, 95, undefined, 'FAST');
      } catch (err) {
        console.error('Failed to embed photo into PDF:', err);
      }
    }

    // Details sidebar on right
    const detailsX = margin + 130;
    let textY = currY + 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(37, 99, 235);
    doc.text(`Photo ID: ${p.photoNumber}`, detailsX, textY);

    textY += 8;
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Date & Time:`, detailsX, textY);
    textY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(new Date(p.timestamp).toLocaleString(), detailsX, textY);

    textY += 8;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(`GPS Coordinates:`, detailsX, textY);
    textY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(formatCoordinates(p.location.latitude, p.location.longitude), detailsX, textY);

    if (p.location.accuracy) {
      textY += 5;
      doc.text(`Accuracy: ±${Math.round(p.location.accuracy)}m`, detailsX, textY);
    }

    if (p.location.address?.formattedAddress) {
      textY += 8;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(`Location:`, detailsX, textY);
      textY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const splitAddress = doc.splitTextToSize(p.location.address.formattedAddress, 45);
      doc.text(splitAddress, detailsX, textY);
      textY += splitAddress.length * 4;
    }

    if (p.remarks) {
      textY += 5;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(`Remarks:`, detailsX, textY);
      textY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const splitRemarks = doc.splitTextToSize(p.remarks, 45);
      doc.text(splitRemarks, detailsX, textY);
    }

    currY += 112;
  }

  // Footer / Signature block on last page
  if (currY > pageH - 45) {
    doc.addPage();
    currY = 30;
  } else {
    currY += 10;
  }

  doc.setLineWidth(0.5);
  doc.setDrawColor(203, 213, 225);
  
  // Inspector signature lines
  doc.line(margin + 10, currY + 25, margin + 70, currY + 25);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Submitted By (Signature)', margin + 12, currY + 30);

  doc.line(pageW - margin - 70, currY + 25, pageW - margin - 10, currY + 25);
  doc.text('Approved By (Seal/Signature)', pageW - margin - 68, currY + 30);

  return doc.output('blob');
}

/**
 * CSV METADATA EXPORT
 */
export function exportToCsv(photos: GeoPhoto[], event?: SchoolEvent): Blob {
  const headers = [
    'Photo Number',
    'Event Name',
    'School Name',
    'Department',
    'Organizer',
    'Timestamp',
    'Date',
    'Time',
    'Latitude',
    'Longitude',
    'Accuracy (m)',
    'Altitude (m)',
    'Heading (°)',
    'Address',
    'Remarks'
  ];

  const rows = photos.map(p => {
    const d = new Date(p.timestamp);
    return [
      `"${p.photoNumber}"`,
      `"${p.eventName || event?.name || ''}"`,
      `"${p.schoolName || event?.schoolName || ''}"`,
      `"${p.department || event?.department || ''}"`,
      `"${p.organizer || event?.organizer || ''}"`,
      p.timestamp,
      `"${d.toISOString().split('T')[0]}"`,
      `"${d.toTimeString().split(' ')[0]}"`,
      p.location.latitude,
      p.location.longitude,
      p.location.accuracy || '',
      p.location.altitude || '',
      p.location.heading || '',
      `"${(p.location.address?.formattedAddress || '').replace(/"/g, '""')}"`,
      `"${(p.remarks || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

/**
 * ZIP ARCHIVE EXPORT
 */
export async function exportToZip(photos: GeoPhoto[], eventName: string = 'GeoPhotos'): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(`${eventName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Photos`);

  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const filename = `${p.photoNumber}_stamped.jpg`;
    folder?.file(filename, p.stampedBlob);

    if (p.originalBlob) {
      folder?.file(`${p.photoNumber}_original.jpg`, p.originalBlob);
    }
  }

  // Also include CSV metadata inside ZIP
  const csvBlob = exportToCsv(photos);
  folder?.file('metadata_summary.csv', csvBlob);

  return await zip.generateAsync({ type: 'blob' });
}
