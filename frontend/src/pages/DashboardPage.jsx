/**
 * PS Consult – UNTH: Dashboard Page
 *
 * Real-time overview with stats, recent consults, and today's schedule.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Stethoscope,
  CalendarDays,
  TrendingUp,
  FilePlus,
} from 'lucide-react';
import { dashboardAPI, consultsAPI, scheduleAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../context/OnlineStatusContext';
import { getCachedConsults } from '../db/offlineDb';
import {
  PageHeader,
  StatCard,
  Card,
  StatusBadge,
  UrgencyBadge,
  LoadingSpinner,
} from '../components/SharedUI';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const { isOnline } = useOnlineStatus();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [recentConsults, setRecentConsults] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [isOnline]); // eslint-disable-line

  async function fetchData() {
    setLoading(true);
    try {
      if (isOnline) {
        const [statsRes, consultsRes, scheduleRes] = await Promise.all([
          dashboardAPI.stats(),
          consultsAPI.list({ per_page: 5 }),
          scheduleAPI.today(),
        ]);
        setStats(statsRes.data);
        setRecentConsults(consultsRes.data.consults);
        setTodaySchedule(scheduleRes.data);
      } else {
        // Offline: load from cache
        const cached = await getCachedConsults();
        setRecentConsults(cached.slice(0, 5));
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      // Try cache fallback
      const cached = await getCachedConsults();
      setRecentConsults(cached.slice(0, 5));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user?.full_name?.split(' ')[0] || 'Doctor'}`}
        subtitle={format(new Date(), "EEEE, MMMM d, yyyy — HH:mm 'hrs'")}
        action={
          <button onClick={() => navigate('/app/consults/new')} className="btn-primary flex items-center gap-2 text-sm">
            <FilePlus size={16} />
            New Consult
          </button>
        }
      />

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Consults" value={stats.total_consults} icon={ClipboardList} color="blue" />
          <StatCard label="Pending" value={stats.pending} icon={Clock} color="amber" onClick={() => navigate('/app/consults?status=pending')} />
          <StatCard label="Emergency" value={stats.emergency_count} icon={AlertTriangle} color="red" />
          <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} color="green" />
          <StatCard label="Accepted" value={stats.accepted} icon={Stethoscope} color="indigo" />
          <StatCard label="Reviewed" value={stats.reviewed} icon={TrendingUp} color="purple" />
          <StatCard label="Procedure Planned" value={stats.procedure_planned} icon={CalendarDays} color="teal" />
          <StatCard label="Today" value={stats.today_count} icon={CalendarDays} color="slate" />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Consults */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800">Recent Consults</h2>
              <button
                onClick={() => navigate('/app/consults')}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View All
              </button>
            </div>

            {recentConsults.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No consults yet.</p>
            ) : (
              <div className="space-y-3">
                {recentConsults.map((c) => (
                  <div
                    key={c.id || c.consult_id}
                    onClick={() => c.id && navigate(`/consults/${c.id}`)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border border-slate-100"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {c.patient_name}
                        </span>
                        <UrgencyBadge urgency={c.urgency} />
                      </div>
                      <div className="text-xs text-slate-500">
                        {c.consult_id} • {c.ward} • Bed {c.bed_number}
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Today's Schedule */}
        <div>
          <Card>
            <h2 className="font-semibold text-slate-800 mb-4">
              📅 Today's Schedule
            </h2>
            {todaySchedule ? (
              <div>
                <p className="text-sm text-slate-600 mb-3">{todaySchedule.message}</p>

                {todaySchedule.schedules?.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {todaySchedule.schedules.map((s) => (
                      <div key={s.id} className="p-2.5 bg-blue-50 rounded-lg">
                        <div className="text-xs font-medium text-blue-700 uppercase">
                          {s.service_type.replace('_', ' ')}
                        </div>
                        <div className="text-sm text-slate-700 mt-0.5">{s.doctors}</div>
                      </div>
                    ))}
                  </div>
                )}

                {todaySchedule.next_clinic && (
                  <div className="text-xs text-slate-500 mt-2">
                    <strong>Next Clinic:</strong> {todaySchedule.next_clinic}
                  </div>
                )}
                {todaySchedule.next_theatre && (
                  <div className="text-xs text-slate-500 mt-1">
                    <strong>Next Theatre:</strong> {todaySchedule.next_theatre}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {isOnline ? 'No schedule data.' : 'Schedule unavailable offline.'}
              </p>
            )}
          </Card>

          {/* Quick Info Card */}
          <Card className="mt-4">
            <h2 className="font-semibold text-slate-800 mb-3">🏥 Unit Information</h2>
            <div className="text-xs text-slate-600 space-y-2">
              <div>
                <strong>Clinic Days:</strong>
                <div className="ml-2 mt-0.5">Tue – Drs Okwesili & Nnadi</div>
                <div className="ml-2">Wed – Dr Okwesili & Dr Eze</div>
              </div>
              <div>
                <strong>Theatre Days:</strong>
                <div className="ml-2 mt-0.5">Wed – Drs Okwesili & Nnadi</div>
                <div className="ml-2">Thu – Dr Okwesili & Dr Eze</div>
              </div>
              <div>
                <strong>Ward Rounds:</strong>
                <div className="ml-2 mt-0.5">Daily – House Officers</div>
                <div className="ml-2">Mon – Consultants</div>
                <div className="ml-2">Fri – Senior Residents</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
