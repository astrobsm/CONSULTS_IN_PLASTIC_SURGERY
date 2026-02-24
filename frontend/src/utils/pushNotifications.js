/**
 * PS Consult – UNTH: Push Notification Utilities
 *
 * Handles browser push permission, service-worker subscription,
 * and server-side registration via the /api/push/ endpoints.
 */
import { pushAPI } from '../api/client';

const PUSH_SUBSCRIBED_KEY = 'ps_push_subscribed';
const PUSH_DISMISSED_KEY = 'ps_push_dismissed_at';

// How long (ms) before we re-prompt after a dismiss (24 hours)
const RE_PROMPT_INTERVAL = 24 * 60 * 60 * 1000;

/**
 * Is the Push API available in this browser?
 */
export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Is the user already subscribed to push?
 */
export function isAlreadySubscribed() {
  return localStorage.getItem(PUSH_SUBSCRIBED_KEY) === 'true';
}

/**
 * Current Notification permission state.
 */
export function getPermissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Should we show the push-permission prompt?
 * Returns true when:
 *  - Push is supported
 *  - Notification permission is not already 'denied'
 *  - User has NOT already subscribed
 *  - User has NOT dismissed the prompt recently
 */
export function shouldPrompt() {
  if (!isPushSupported()) return false;
  if (Notification.permission === 'denied') return false;
  if (isAlreadySubscribed()) return false;

  // Check if user dismissed recently
  const dismissedAt = localStorage.getItem(PUSH_DISMISSED_KEY);
  if (dismissedAt) {
    const elapsed = Date.now() - Number(dismissedAt);
    if (elapsed < RE_PROMPT_INTERVAL) return false;
  }

  return true;
}

/**
 * Record that the user dismissed the prompt (to avoid spamming).
 */
export function recordDismiss() {
  localStorage.setItem(PUSH_DISMISSED_KEY, String(Date.now()));
}

/**
 * Convert a URL-safe base64 VAPID key to a Uint8Array (for PushManager).
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

/**
 * Full subscribe flow:
 * 1. Request notification permission
 * 2. Get VAPID public key from server
 * 3. Subscribe via PushManager
 * 4. Send subscription to server
 *
 * Returns { success: boolean, reason?: string }
 */
export async function subscribeToPush() {
  try {
    // 1. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, reason: 'permission_denied' };
    }

    // 2. Get VAPID key
    const { data } = await pushAPI.getVapidKey();
    const vapidKey = data.public_key;
    if (!vapidKey) return { success: false, reason: 'no_vapid_key' };

    // 3. Subscribe via service-worker
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    // 4. Send to server
    const subJson = subscription.toJSON();
    await pushAPI.subscribe({
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
    });

    localStorage.setItem(PUSH_SUBSCRIBED_KEY, 'true');
    localStorage.removeItem(PUSH_DISMISSED_KEY);
    return { success: true };
  } catch (err) {
    console.error('[Push] Subscribe error:', err);
    return { success: false, reason: err.message || 'unknown' };
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await pushAPI.unsubscribe(subscription.endpoint);
      await subscription.unsubscribe();
    }
    localStorage.removeItem(PUSH_SUBSCRIBED_KEY);
    return { success: true };
  } catch (err) {
    console.error('[Push] Unsubscribe error:', err);
    return { success: false, reason: err.message };
  }
}
