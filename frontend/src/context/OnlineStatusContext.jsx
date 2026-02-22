/**
 * PS Consult – UNTH: Online Status Context
 *
 * Tracks network connectivity and triggers background sync
 * when coming back online.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { consultsAPI } from '../api/client';
import { syncAllPending, getPendingConsults } from '../db/offlineDb';

const OnlineStatusContext = createContext(null);

export function OnlineStatusProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Update pending count
  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingConsults();
    setPendingCount(pending.length);
  }, []);

  // Attempt sync
  const attemptSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncAllPending(async (data) => {
        await consultsAPI.createPublic(data);
      });
      if (result.synced > 0) {
        toast.success(`${result.synced} offline consult(s) synced successfully!`, {
          icon: '✅',
          duration: 5000,
        });
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} consult(s) failed to sync. Will retry.`, {
          icon: '⚠️',
        });
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
      refreshPendingCount();
    }
  }, [syncing, refreshPendingCount]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('You are back online!', { icon: '🌐', duration: 3000 });
      // Auto-sync when coming back online
      attemptSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast('You are offline. Data will be saved locally.', {
        icon: '📡',
        duration: 4000,
        style: { background: '#f59e0b', color: '#1e293b' },
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for sync messages from service worker
    const swListener = (event) => {
      if (event.data?.type === 'SYNC_CONSULTS') {
        attemptSync();
      }
    };
    navigator.serviceWorker?.addEventListener('message', swListener);

    // Check pending on mount
    refreshPendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', swListener);
    };
  }, [attemptSync, refreshPendingCount]);

  return (
    <OnlineStatusContext.Provider
      value={{
        isOnline,
        pendingCount,
        syncing,
        attemptSync,
        refreshPendingCount,
      }}
    >
      {children}
    </OnlineStatusContext.Provider>
  );
}

export function useOnlineStatus() {
  const context = useContext(OnlineStatusContext);
  if (!context) {
    throw new Error('useOnlineStatus must be used within OnlineStatusProvider');
  }
  return context;
}
