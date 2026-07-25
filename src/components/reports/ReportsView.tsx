import React, { useState } from 'react';
import { FileText, Download, FileSpreadsheet, Archive, CheckCircle2, Shield, Calendar, Images } from 'lucide-react';
import { useEventContext } from '../../contexts/EventContext';
import { db } from '../../services/db';
import { generatePdfReport, exportToCsv, exportToZip } from '../../services/exportService';

interface ReportsViewProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ showToast }) => {
  const { events, activeEvent, settings } = useEventContext();
  const [selectedEventId, setSelectedEventId] = useState<string>(activeEvent?.id || 'all');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // PDF Export
  const handleExportPdf = async () => {
    setIsExporting(true);
    showToast('Generating official PDF report...', 'info');

    try {
      const photos = await db.photos.toArray();
      const targetPhotos = selectedEventId === 'all'
        ? photos
        : photos.filter(p => p.eventId === selectedEventId);

      if (targetPhotos.length === 0) {
        showToast('No photos found for the selected report filter', 'error');
        setIsExporting(false);
        return;
      }

      const evtObj = events.find(e => e.id === selectedEventId) || activeEvent || undefined;
      const pdfBlob = await generatePdfReport({
        event: evtObj,
        photos: targetPhotos,
        settings: settings,
      });

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Geo_Inspection_Report_${evtObj?.photoPrefix || 'EVT'}_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('PDF Report downloaded successfully!', 'success');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      showToast('Failed to generate PDF: ' + err.message, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // CSV Export
  const handleExportCsv = async () => {
    try {
      const photos = await db.photos.toArray();
      const targetPhotos = selectedEventId === 'all'
        ? photos
        : photos.filter(p => p.eventId === selectedEventId);

      if (targetPhotos.length === 0) {
        showToast('No photos found for CSV export', 'error');
        return;
      }

      const evtObj = events.find(e => e.id === selectedEventId) || activeEvent || undefined;
      const csvBlob = exportToCsv(targetPhotos, evtObj);

      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Geo_Metadata_${evtObj?.photoPrefix || 'EVT'}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('CSV metadata exported successfully!', 'success');
    } catch (err: any) {
      showToast('CSV export failed', 'error');
    }
  };

  // ZIP Export
  const handleExportZip = async () => {
    setIsExporting(true);
    showToast('Compressing photos into ZIP archive...', 'info');

    try {
      const photos = await db.photos.toArray();
      const targetPhotos = selectedEventId === 'all'
        ? photos
        : photos.filter(p => p.eventId === selectedEventId);

      if (targetPhotos.length === 0) {
        showToast('No photos found for ZIP export', 'error');
        setIsExporting(false);
        return;
      }

      const evtObj = events.find(e => e.id === selectedEventId) || activeEvent || undefined;
      const zipBlob = await exportToZip(targetPhotos, evtObj?.name || 'GeoPhotos');

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GeoPhotos_${evtObj?.photoPrefix || 'EVT'}_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      showToast('ZIP archive downloaded successfully!', 'success');
    } catch (err: any) {
      showToast('ZIP export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight">Inspection & Event Reports Export</h2>
        <p className="text-xs text-slate-400">Generate official PDF inspection reports, CSV metadata spreadsheets, or bulk ZIP image archives.</p>
      </div>

      {/* Filter Selection */}
      <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
        <label className="block text-xs font-bold text-slate-300">Select Event Scope for Export</label>
        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Events (Entire Local Database)</option>
          {events.map((evt) => (
            <option key={evt.id} value={evt.id}>
              {evt.name} ({evt.schoolName})
            </option>
          ))}
        </select>
      </div>

      {/* Export Format Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* PDF Card */}
        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 flex flex-col justify-between space-y-4 hover:border-blue-500/50 transition-colors">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">PDF Inspection Report</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Formatted A4 PDF document containing school header, verified photo table, GPS coordinates & signature lines.
            </p>
          </div>

          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Generate PDF</span>
          </button>
        </div>

        {/* CSV Card */}
        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 flex flex-col justify-between space-y-4 hover:border-emerald-500/50 transition-colors">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">CSV Metadata Spreadsheet</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Structured dataset including Photo IDs, exact Lat/Lng coordinates, timestamps, address text & inspection notes.
            </p>
          </div>

          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* ZIP Card */}
        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 flex flex-col justify-between space-y-4 hover:border-purple-500/50 transition-colors">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Archive className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">ZIP Photo Archive</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Complete compressed package containing high-resolution stamped photos, original un-stamped copies & metadata.
            </p>
          </div>

          <button
            onClick={handleExportZip}
            disabled={isExporting}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Download ZIP</span>
          </button>
        </div>

      </div>

    </div>
  );
};
