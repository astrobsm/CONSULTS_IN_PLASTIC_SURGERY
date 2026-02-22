/**
 * PS Consult – UNTH: Dexie.js Offline Database
 *
 * IndexedDB-based local storage for offline-first functionality.
 * Stores consult requests locally and syncs when online.
 */
import Dexie from 'dexie';

const db = new Dexie('PSConsultDB');

db.version(1).stores({
  // Offline consult queue: pending submissions
  offlineConsults: '++id, clientId, status, createdAt',
  // Cached consults from server (for offline viewing)
  cachedConsults: 'id, consultId, ward, urgency, status, createdAt',
  // Cached schedule
  cachedSchedule: 'id, serviceType, dayOfWeek',
  // Sync log
  syncLog: '++id, action, timestamp, synced',
});

export default db;

// ── Offline Consult Queue ───────────────────────────

/**
 * Save a consult to the offline queue with a unique client ID.
 */
export async function saveOfflineConsult(consultData) {
  const clientId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const entry = {
    clientId,
    data: { ...consultData, client_id: clientId },
    status: 'pending', // pending | synced | failed
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  const id = await db.offlineConsults.add(entry);
  return { id, clientId };
}

/**
 * Get all pending (unsynced) consults.
 */
export async function getPendingConsults() {
  return db.offlineConsults.where('status').equals('pending').toArray();
}

/**
 * Mark an offline consult as synced.
 */
export async function markConsultSynced(id) {
  return db.offlineConsults.update(id, { status: 'synced' });
}

/**
 * Mark an offline consult as failed.
 */
export async function markConsultFailed(id) {
  const entry = await db.offlineConsults.get(id);
  if (entry) {
    await db.offlineConsults.update(id, {
      status: 'failed',
      attempts: (entry.attempts || 0) + 1,
    });
  }
}

/**
 * Clear all synced entries older than 7 days.
 */
export async function cleanupSyncedConsults() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return db.offlineConsults
    .where('status')
    .equals('synced')
    .filter((entry) => entry.createdAt < cutoff)
    .delete();
}

// ── Cache Helpers ───────────────────────────────────

/**
 * Cache consults from server for offline viewing.
 */
export async function cacheConsults(consults) {
  await db.cachedConsults.clear();
  if (consults.length > 0) {
    await db.cachedConsults.bulkPut(
      consults.map((c) => ({
        id: c.id,
        consultId: c.consult_id,
        ward: c.ward,
        urgency: c.urgency,
        status: c.status,
        createdAt: c.created_at,
        data: c,
      }))
    );
  }
}

/**
 * Get cached consults for offline display.
 */
export async function getCachedConsults() {
  const entries = await db.cachedConsults.orderBy('createdAt').reverse().toArray();
  return entries.map((e) => e.data);
}

/**
 * Cache schedule from server.
 */
export async function cacheSchedule(schedules) {
  await db.cachedSchedule.clear();
  if (schedules.length > 0) {
    await db.cachedSchedule.bulkPut(
      schedules.map((s) => ({
        id: s.id,
        serviceType: s.service_type,
        dayOfWeek: s.day_of_week,
        data: s,
      }))
    );
  }
}

/**
 * Get cached schedule for offline display.
 */
export async function getCachedSchedule() {
  const entries = await db.cachedSchedule.toArray();
  return entries.map((e) => e.data);
}

// ── Sync Engine ─────────────────────────────────────

/**
 * Attempt to sync all pending offline consults to the server.
 * Returns { synced: number, failed: number }
 */
export async function syncAllPending(syncFn) {
  const pending = await getPendingConsults();
  let synced = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      await syncFn(entry.data);
      await markConsultSynced(entry.id);
      synced++;
    } catch (err) {
      await markConsultFailed(entry.id);
      failed++;
    }
  }

  // Cleanup old synced entries
  await cleanupSyncedConsults();

  return { synced, failed };
}
