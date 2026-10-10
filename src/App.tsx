
import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { EventProvider, useEventContext } from './contexts/EventContext';
import { Navbar } from './components/layout/Navbar';
import { BottomNav } from './components/layout/BottomNav';
import { DashboardView } from './components/dashboard/DashboardView';
import { CameraView } from './components/camera/CameraView';
import { GalleryView } from './components/gallery/GalleryView';
import { MapView } from './components/map/MapView';
import { EventsView } from './components/events/EventsView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { PhotoDetailModal } from './components/gallery/PhotoDetailModal';
import { EventModal } from './components/events/EventModal';
import { Toast, ToastMessage } from './components/common/Toast';
import { SplashScreen } from './components/common/SplashScreen';
import { GeoPhoto } from './types';
import { db } from './services/db';
import { useGps } from './hooks/useGps';

function MainAppContent() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(
    () => navigator.onLine
  );
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Read GPS settings from the existing event/settings context.
  const { settings } = useEventContext();

  // Keep one GPS watcher active while MainAppContent is mounted.
  // Switching pages will no longer restart GPS tracking.
  const {
    location,
    isSearching: isGpsSearching,
  } = useGps(settings.gpsHighAccuracy);

  // Modals state
  const [selectedPhoto, setSelectedPhoto] = useState<GeoPhoto | null>(null);
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] =
    useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' = 'info'
  ) => {
    const id =
      'toast_' +
      Date.now() +
      '_' +
      Math.random().toString(36).slice(2, 7);

    setToasts((prev) => [...prev, { id, message, type }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // PWA install prompt listener
  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstall
      );
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();

      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        showToast('D-Cam installed to home screen!', 'success');
      }
    } catch (error) {
      console.error('PWA installation failed:', error);
      showToast('Unable to install the app right now.', 'error');
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleDeletePhoto = async (id: string) => {
    try {
      await db.photos.delete(id);
      showToast('Photo deleted', 'info');
      setSelectedPhoto(null);
    } catch (error) {
      console.error('Photo deletion failed:', error);
      showToast('Unable to delete the photo.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-slate-700 selection:text-white">
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      <Toast
        toasts={toasts}
        onDismiss={handleDismissToast}
      />

      {activeTab === 'camera' ? (
        <CameraView
          setActiveTab={setActiveTab}
          showToast={showToast}
          isOnline={isOnline}
          location={location}
          isGpsSearching={isGpsSearching}
        />
      ) : (
        <>
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isOnline={isOnline}
            deferredPrompt={deferredPrompt}
            handleInstallPwa={handleInstallPwa}
          />

          <main className="flex-1 w-full overflow-y-auto">
            {activeTab === 'dashboard' && (
              <DashboardView
                setActiveTab={setActiveTab}
                onOpenPhotoDetail={(photo) =>
                  setSelectedPhoto(photo)
                }
                onOpenCreateEventModal={() =>
                  setIsCreateEventModalOpen(true)
                }
              />
            )}

            {activeTab === 'gallery' && (
              <GalleryView
                onOpenPhotoDetail={(photo) =>
                  setSelectedPhoto(photo)
                }
                showToast={showToast}
              />
            )}

            {activeTab === 'map' && (
              <MapView
                onOpenPhotoDetail={(photo) =>
                  setSelectedPhoto(photo)
                }
              />
            )}

            {activeTab === 'events' && (
              <EventsView showToast={showToast} />
            )}

            {activeTab === 'reports' && (
              <ReportsView showToast={showToast} />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                showToast={showToast}
                deferredPrompt={deferredPrompt}
                handleInstallPwa={handleInstallPwa}
              />
            )}
          </main>

          <BottomNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </>
      )}

      {/* Photo Detail Inspection Modal */}
      {selectedPhoto && (
        <PhotoDetailModal
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onDelete={handleDeletePhoto}
          showToast={showToast}
        />
      )}

      {/* Global Quick Create Event Modal */}
      <EventModal
        isOpen={isCreateEventModalOpen}
        onClose={() => setIsCreateEventModalOpen(false)}
        showToast={showToast}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <EventProvider>
        <MainAppContent />
      </EventProvider>
    </ThemeProvider>
  );
}
