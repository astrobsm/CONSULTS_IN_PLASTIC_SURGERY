/**
 * PS Consult – UNTH: Notifications Page
 *
 * Lists user notifications with read/unread state, mark-all-read.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Clock, FileText, AlertTriangle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { dashboardAPI } from '../api/client';
import { PageHeader, Card, LoadingSpinner, EmptyState } from '../components/SharedUI';

const TYPE_ICONS = {
  new_consult: <FileText size={16} className="text-blue-500" />,
  status_update: <RefreshCw size={16} className="text-green-500" />,
  urgent: <AlertTriangle size={16} className="text-red-500" />,
  default: <Bell size={16} className="text-slate-400" />,
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await dashboardAPI.notifications();
      setNotifications(res.data);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await dashboardAPI.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // silent
    }
  };

  const markAllRead = async () => {
    try {
      await dashboardAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('All marked as read');
    } catch {
      toast.error('Failed');
    }
  };

  const handleClick = (notif) => {
    if (!notif.is_read) markRead(notif.id);
    if (notif.consult_request_id) {
      navigate(`/consults/${notif.consult_request_id}`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
        action={
          unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary text-sm flex items-center gap-1">
              <CheckCheck size={16} /> Mark all read
            </button>
          )
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell size={32} className="text-slate-300" />}
          title="No notifications"
          message="You're all caught up."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={`cursor-pointer transition hover:shadow-md ${
                notif.is_read ? 'opacity-70' : 'border-l-4 border-l-primary-400'
              }`}
              onClick={() => handleClick(notif)}
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  {TYPE_ICONS[notif.notification_type] || TYPE_ICONS.default}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${notif.is_read ? 'text-slate-600' : 'text-slate-900 font-medium'}`}>
                    {notif.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock size={10} />
                      {formatDistanceToNow(parseISO(notif.created_at), { addSuffix: true })}
                    </span>
                    {notif.consult_request_id && (
                      <span className="text-xs text-primary-500">View consult →</span>
                    )}
                  </div>
                </div>
                {!notif.is_read && (
                  <div className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
