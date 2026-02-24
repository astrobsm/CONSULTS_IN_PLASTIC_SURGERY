/**
 * PS Consult – UNTH: Push Notification Permission Prompt
 *
 * An aggressive but user-friendly banner that asks users to enable
 * push notifications. Re-appears every 24 hours if dismissed, and
 * shows as a sticky full-width banner at the top of the app.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellRing, X } from 'lucide-react';
import {
  isPushSupported,
  shouldPrompt,
  subscribeToPush,
  recordDismiss,
  getPermissionState,
  isAlreadySubscribed,
} from '../utils/pushNotifications';

export default function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [result, setResult] = useState(null); // 'success' | 'denied' | null

  useEffect(() => {
    // Small delay so the page renders first, then show the prompt
    const timer = setTimeout(() => {
      if (shouldPrompt()) {
        setVisible(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = useCallback(async () => {
    setSubscribing(true);
    const res = await subscribeToPush();
    setSubscribing(false);

    if (res.success) {
      setResult('success');
      setTimeout(() => setVisible(false), 2500);
    } else if (res.reason === 'permission_denied') {
      setResult('denied');
      setTimeout(() => setVisible(false), 4000);
    } else {
      // Network error or Vercel cold start – still close but don't mark dismissed
      setVisible(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    recordDismiss();
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] animate-slide-down">
      <div className="bg-gradient-to-r from-primary-700 via-primary-600 to-primary-700 text-white shadow-xl">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Animated bell icon */}
          <div className="flex-shrink-0 bg-white/20 rounded-full p-2 animate-pulse">
            <BellRing size={22} className="text-yellow-300" />
          </div>

          {/* Message */}
          <div className="flex-1 min-w-0">
            {result === 'success' ? (
              <p className="text-sm font-semibold text-emerald-200">
                ✅ Notifications enabled! You'll be alerted for every new consult.
              </p>
            ) : result === 'denied' ? (
              <p className="text-sm font-semibold text-red-200">
                Notifications blocked by your browser. Go to browser settings → Notifications to re-enable.
              </p>
            ) : (
              <>
                <p className="text-sm font-bold">
                  🔔 Enable Push Notifications
                </p>
                <p className="text-xs text-blue-100 mt-0.5">
                  Get instant alerts for new consult requests — even when the app is closed.
                </p>
              </>
            )}
          </div>

          {/* Action buttons */}
          {!result && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleEnable}
                disabled={subscribing}
                className="bg-white text-primary-700 hover:bg-blue-50 text-sm font-bold px-4 py-2 rounded-lg shadow transition-all disabled:opacity-60"
              >
                {subscribing ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Enabling…
                  </span>
                ) : (
                  <>
                    <Bell size={14} className="inline mr-1" />
                    Allow
                  </>
                )}
              </button>
              <button
                onClick={handleDismiss}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Dismiss"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Close for result states */}
          {result && (
            <button
              onClick={() => setVisible(false)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
