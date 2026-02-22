/**
 * PS Consult – UNTH: Schedule Page
 *
 * Displays Plastic Surgery unit schedule (clinics, theatres, ward rounds).
 * Admins can create/update/delete schedule entries.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Clock, Plus, Edit2, Trash2, MapPin, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { scheduleAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getCachedSchedule, cacheSchedule } from '../db/offlineDb';
import { PageHeader, Card, LoadingSpinner, EmptyState, ConfirmModal } from '../components/SharedUI';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };

const SERVICE_COLORS = {
  clinic: 'bg-blue-50 border-blue-200 text-blue-800',
  theatre: 'bg-green-50 border-green-200 text-green-800',
  ward_round: 'bg-purple-50 border-purple-200 text-purple-800',
  emergency: 'bg-red-50 border-red-200 text-red-800',
};

const SERVICE_ICONS = {
  clinic: '🏥',
  theatre: '🔪',
  ward_round: '🚶',
  emergency: '🚨',
};

export default function SchedulePage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [schedule, setSchedule] = useState([]);
  const [todayInfo, setTodayInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    try {
      const [schedRes, todayRes] = await Promise.all([
        scheduleAPI.list(),
        scheduleAPI.today(),
      ]);
      setSchedule(schedRes.data);
      setTodayInfo(todayRes.data);
      cacheSchedule(schedRes.data);
    } catch {
      const cached = await getCachedSchedule();
      if (cached.length > 0) {
        setSchedule(cached);
        toast('Showing cached schedule', { icon: '📦' });
      } else {
        toast.error('Failed to load schedule');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await scheduleAPI.remove(deleteTarget);
      toast.success('Deleted');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('Delete failed');
    }
  };

  // Group schedule by day
  const grouped = DAYS.reduce((acc, day) => {
    acc[day] = schedule.filter((s) => s.day_of_week === day);
    return acc;
  }, {});

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Unit Schedule"
        subtitle="Plastic Surgery Unit – UNTH Ituku-Ozalla"
        action={
          isAdmin && (
            <button
              onClick={() => { setEditing(null); setShowForm(!showForm); }}
              className="btn-primary text-sm flex items-center gap-1"
            >
              <Plus size={16} /> Add Entry
            </button>
          )
        }
      />

      {/* Today's info card */}
      {todayInfo && (
        <Card className="mb-6 bg-gradient-to-r from-primary-50 to-blue-50 border-primary-200">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <CalendarDays size={20} className="text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-primary-800">Today – {todayInfo.today}</h3>
              {todayInfo.today_schedule?.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {todayInfo.today_schedule.map((s, i) => (
                    <li key={i} className="text-sm text-primary-700">
                      {SERVICE_ICONS[s.service_type]} {s.service_type.replace('_', ' ')} — {s.start_time}–{s.end_time}
                      {s.location && ` @ ${s.location}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-primary-600 mt-1">No scheduled activities today.</p>
              )}
              {todayInfo.contextual_message && (
                <p className="text-xs text-primary-500 mt-2 flex items-center gap-1">
                  <AlertCircle size={12} /> {todayInfo.contextual_message}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Schedule Form (admin) */}
      {showForm && <ScheduleForm
        entry={editing}
        onSave={() => { setShowForm(false); setEditing(null); load(); }}
        onCancel={() => { setShowForm(false); setEditing(null); }}
      />}

      {/* Weekly grid */}
      <div className="space-y-3">
        {DAYS.map((day) => {
          const entries = grouped[day];
          return (
            <Card key={day} className={entries.length === 0 ? 'opacity-60' : ''}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800 text-sm">
                  {day}
                  <span className="text-slate-400 ml-1 font-normal">({DAY_SHORT[day]})</span>
                </h3>
                {entries.length === 0 && (
                  <span className="text-xs text-slate-400">No activities</span>
                )}
              </div>
              {entries.length > 0 && (
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between border rounded-lg px-3 py-2 ${SERVICE_COLORS[entry.service_type] || 'bg-slate-50 border-slate-200'}`}
                    >
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-lg">{SERVICE_ICONS[entry.service_type]}</span>
                        <div>
                          <span className="font-medium capitalize">{entry.service_type.replace('_', ' ')}</span>
                          <div className="flex items-center gap-3 text-xs opacity-75 mt-0.5">
                            <span className="flex items-center gap-1"><Clock size={10} /> {entry.start_time}–{entry.end_time}</span>
                            {entry.location && <span className="flex items-center gap-1"><MapPin size={10} /> {entry.location}</span>}
                          </div>
                          {entry.notes && <p className="text-xs mt-1 opacity-70">{entry.notes}</p>}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditing(entry); setShowForm(true); }}
                            className="p-1 hover:bg-white/60 rounded"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(entry.id)}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Schedule Entry"
        message="Are you sure you want to delete this schedule entry?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/* ---------- Schedule Form (admin inline) ---------- */
function ScheduleForm({ entry, onSave, onCancel }) {
  const [form, setForm] = useState({
    day_of_week: entry?.day_of_week || 'Monday',
    service_type: entry?.service_type || 'clinic',
    start_time: entry?.start_time || '08:00',
    end_time: entry?.end_time || '12:00',
    location: entry?.location || '',
    notes: entry?.notes || '',
    is_active: entry?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (entry?.id) {
        await scheduleAPI.update(entry.id, form);
        toast.success('Updated');
      } else {
        await scheduleAPI.create(form);
        toast.success('Created');
      }
      onSave();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(e => e.msg || JSON.stringify(e)).join('; ') : 'Save failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-6 border-primary-200">
      <h3 className="font-semibold text-sm text-slate-800 mb-3">{entry ? 'Edit Entry' : 'New Schedule Entry'}</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Day</label>
          <select name="day_of_week" value={form.day_of_week} onChange={handleChange} className="input-field">
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Service Type</label>
          <select name="service_type" value={form.service_type} onChange={handleChange} className="input-field">
            <option value="clinic">Clinic</option>
            <option value="theatre">Theatre</option>
            <option value="ward_round">Ward Round</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
        <div>
          <label className="label">Start Time</label>
          <input type="time" name="start_time" value={form.start_time} onChange={handleChange} className="input-field" />
        </div>
        <div>
          <label className="label">End Time</label>
          <input type="time" name="end_time" value={form.end_time} onChange={handleChange} className="input-field" />
        </div>
        <div>
          <label className="label">Location</label>
          <input name="location" value={form.location} onChange={handleChange} className="input-field" placeholder="e.g. PS Clinic Room" />
        </div>
        <div>
          <label className="label">Notes</label>
          <input name="notes" value={form.notes} onChange={handleChange} className="input-field" placeholder="Optional" />
        </div>
        <div className="col-span-full flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} className="h-4 w-4 rounded" />
            Active
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? 'Saving...' : entry ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}
