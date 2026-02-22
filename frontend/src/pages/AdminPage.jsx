/**
 * PS Consult – UNTH: Admin Page
 *
 * User management (list, create, update roles) and audit log viewer.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Plus, Edit2, Shield, Activity, Search, X, QrCode, Share2, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { authAPI, dashboardAPI } from '../api/client';
import { PageHeader, Card, LoadingSpinner, EmptyState, ConfirmModal } from '../components/SharedUI';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'senior_registrar', label: 'Senior Registrar' },
  { value: 'registrar', label: 'Registrar' },
  { value: 'inviting_unit', label: 'Inviting Unit' },
];

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700',
  consultant: 'bg-purple-100 text-purple-700',
  senior_registrar: 'bg-blue-100 text-blue-700',
  registrar: 'bg-green-100 text-green-700',
  inviting_unit: 'bg-slate-100 text-slate-700',
};

export default function AdminPage() {
  const [tab, setTab] = useState('users');

  return (
    <div>
      <PageHeader title="Administration" subtitle="Manage users and view audit logs" />

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'users' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users size={14} className="inline mr-1" /> Users
        </button>
        <button
          onClick={() => setTab('audit')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'audit' ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Activity size={14} className="inline mr-1" /> Audit Log
        </button>
      </div>

      {tab === 'users' ? <UsersTab /> : <AuditTab />}
    </div>
  );
}

/* ============ Users Tab ============ */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await authAPI.listUsers();
      setUsers(res.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input-field pl-9"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary text-sm flex items-center gap-1"
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      {showForm && (
        <UserForm
          user={editing}
          onSave={() => { setShowForm(false); setEditing(null); load(); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={<Users size={32} className="text-slate-300" />} title="No users found" />
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => (
            <Card key={user.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{user.full_name}</p>
                  <p className="text-xs text-slate-500">@{user.username} · {user.department || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] || 'bg-slate-100'}`}>
                  {user.role.replace('_', ' ')}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
                <button
                  onClick={() => { setEditing(user); setShowForm(true); }}
                  className="p-1 hover:bg-slate-100 rounded"
                  title="Edit user"
                >
                  <Edit2 size={14} className="text-slate-500" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- User Form ---------- */
function UserForm({ user, onSave, onCancel }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    username: user?.username || '',
    full_name: user?.full_name || '',
    password: '',
    role: user?.role || 'inviting_unit',
    department: user?.department || '',
    phone: user?.phone || '',
    is_active: user?.is_active ?? true,
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
      if (isEdit) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await authAPI.updateUser(user.id, payload);
        toast.success('User updated');
      } else {
        if (!form.password) {
          toast.error('Password is required');
          setSaving(false);
          return;
        }
        await authAPI.register(form);
        toast.success('User created');
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
    <Card className="mb-4 border-primary-200">
      <h3 className="font-semibold text-sm text-slate-800 mb-3 flex items-center gap-2">
        <Shield size={16} /> {isEdit ? 'Edit User' : 'Create New User'}
      </h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Username *</label>
          <input
            name="username"
            value={form.username}
            onChange={handleChange}
            className="input-field"
            required
            disabled={isEdit}
          />
        </div>
        <div>
          <label className="label">Full Name *</label>
          <input name="full_name" value={form.full_name} onChange={handleChange} className="input-field" required />
        </div>
        <div>
          <label className="label">{isEdit ? 'New Password' : 'Password *'}</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            className="input-field"
            placeholder={isEdit ? 'Leave blank to keep' : ''}
            required={!isEdit}
          />
        </div>
        <div>
          <label className="label">Role *</label>
          <select name="role" value={form.role} onChange={handleChange} className="input-field">
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Department</label>
          <input name="department" value={form.department} onChange={handleChange} className="input-field" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input name="phone" value={form.phone} onChange={handleChange} className="input-field" />
        </div>
        <div className="col-span-full flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} className="h-4 w-4 rounded" />
            Active
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}

/* ============ Audit Tab ============ */
function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const load = useCallback(async () => {
    try {
      const res = await dashboardAPI.auditLogs({ skip: (page - 1) * LIMIT, limit: LIMIT });
      setLogs(res.data);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {logs.length === 0 ? (
        <EmptyState icon={<Activity size={32} className="text-slate-300" />} title="No audit logs yet" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 pr-3">Timestamp</th>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Consult</th>
                  <th className="py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">
                      {format(parseISO(log.created_at), 'dd/MM/yy HH:mm')}
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-700">{log.user?.full_name || '—'}</td>
                    <td className="py-2 pr-3">
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">{log.action}</span>
                    </td>
                    <td className="py-2 pr-3 text-primary-600">{log.consult_request_id || '—'}</td>
                    <td className="py-2 text-slate-500 max-w-xs truncate">{log.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn-secondary text-xs disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-xs text-slate-500">Page {page}</span>
            <button
              disabled={logs.length < LIMIT}
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
