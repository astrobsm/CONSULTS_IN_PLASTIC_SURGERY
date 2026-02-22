/**
 * PS Consult – UNTH: Dashboard Page
 *
 * Real-time overview with stats, recent consults, and today's schedule.
 */
import React, { useState, useEffect, useRef } from 'react';
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
  QrCode,
  Share2,
  Download,
  Printer,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
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
                    onClick={() => c.id && navigate(`/app/consults/${c.id}`)}
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

          {/* QR Code Card */}
          <QRCodeCard />

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

/* ─── QR Code Card ─── */
function QRCodeCard() {
  const qrRef = useRef(null);
  const APP_URL = 'https://ps-consult-unth.vercel.app';

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const link = document.createElement('a');
      link.download = 'PS-Consult-UNTH-QR.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const shareQR = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PS Consult – UNTH',
          text: 'Request a Plastic Surgery Consult at UNTH. Scan the QR code or visit:',
          url: APP_URL,
        });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(APP_URL);
      toast.success('Link copied to clipboard!');
    }
  };

  const printQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>PS Consult QR Code</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;margin:0;}
      h1{font-size:24px;color:#1e40af;margin-bottom:4px;}p{color:#64748b;font-size:14px;margin:4px 0;}img{margin:20px 0;}.url{font-size:12px;color:#0f172a;background:#f1f5f9;padding:8px 16px;border-radius:8px;}</style></head>
      <body><h1>PS Consult &ndash; UNTH</h1><p>Plastic Surgery Consult System</p>
      <img src="data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}" width="300" height="300" />
      <p>Scan to request a consult</p><div class="url">${APP_URL}</div>
      <script>setTimeout(()=>{window.print();},500);<\/script></body></html>
    `);
    win.document.close();
  };

  return (
    <Card className="mt-4 text-center">
      <h2 className="font-semibold text-slate-800 mb-2 flex items-center justify-center gap-2">
        <QrCode size={18} className="text-primary-600" /> Share Consult Form
      </h2>
      <p className="text-xs text-slate-500 mb-3">Other units scan this to request a consult</p>

      <div ref={qrRef} className="inline-block bg-white p-3 rounded-xl border-2 border-slate-100 shadow-sm">
        <QRCodeSVG
          value={APP_URL}
          size={160}
          level="H"
          includeMargin={true}
          imageSettings={{
            src: '/unth-favicon.png',
            x: undefined,
            y: undefined,
            height: 28,
            width: 28,
            excavate: true,
          }}
        />
      </div>

      <p className="text-[10px] text-slate-400 mt-2 mb-3 bg-slate-50 inline-block px-2 py-1 rounded">
        {APP_URL}
      </p>

      <div className="flex flex-wrap gap-2 justify-center">
        <button onClick={downloadQR} className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5">
          <Download size={13} /> Download
        </button>
        <button onClick={printQR} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
          <Printer size={13} /> Print
        </button>
        <button onClick={shareQR} className="btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5">
          <Share2 size={13} /> Share
        </button>
      </div>
    </Card>
  );
}
