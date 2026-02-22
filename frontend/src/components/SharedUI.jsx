/**
 * PS Consult – UNTH: Shared UI Components
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

// ── Status Badge ────────────────────────────────────
const STATUS_STYLES = {
  pending: 'badge-pending',
  accepted: 'badge-accepted',
  on_the_way: 'badge-accepted',
  reviewed: 'badge-reviewed',
  procedure_planned: 'badge-procedure',
  completed: 'badge-completed',
  cancelled: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  on_the_way: 'On the Way',
  reviewed: 'Reviewed',
  procedure_planned: 'Procedure Planned',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_STYLES[status] || 'badge-pending'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ── Urgency Badge ───────────────────────────────────
const URGENCY_STYLES = {
  routine: 'badge-routine',
  urgent: 'badge-urgent',
  emergency: 'badge-emergency',
};

export function UrgencyBadge({ urgency }) {
  return (
    <span className={`badge ${URGENCY_STYLES[urgency] || 'badge-routine'}`}>
      {urgency?.charAt(0).toUpperCase() + urgency?.slice(1)}
    </span>
  );
}

// ── Loading Spinner ─────────────────────────────────
export function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
      <Loader2 className="animate-spin mb-3" size={28} />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Empty State ─────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  // Icon can be a component reference OR a JSX element
  const isElement = Icon && typeof Icon === 'object';
  return (
    <div className="text-center py-12">
      {isElement ? Icon : Icon && <Icon className="mx-auto mb-3 text-slate-300" size={48} />}
      <h3 className="text-lg font-medium text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ── Card ────────────────────────────────────────────
export function Card({ children, className = '', ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

// ── Page Header ─────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────
export function StatCard({ label, value, icon: Icon, color = 'blue', onClick }) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
    indigo: 'from-indigo-500 to-indigo-600',
    slate: 'from-slate-500 to-slate-600',
    teal: 'from-teal-500 to-teal-600',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-gradient-to-br ${colors[color]} rounded-xl p-4 text-white shadow-sm
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white/80">{label}</span>
        {Icon && <Icon size={20} className="text-white/60" />}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// ── Confirmation Modal ──────────────────────────────
export function ConfirmModal({ open, title, message, onConfirm, onCancel, confirmText = 'Confirm' }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 relative z-10">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-primary text-sm">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
