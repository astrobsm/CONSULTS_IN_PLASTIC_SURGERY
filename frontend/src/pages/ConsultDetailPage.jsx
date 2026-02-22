/**
 * PS Consult – UNTH: Consult Detail Page
 *
 * Full consult view with status management, acknowledgement,
 * review history, and audit trail.
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  User,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  FileText,
  Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { consultsAPI, reviewsAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader,
  Card,
  StatusBadge,
  UrgencyBadge,
  LoadingSpinner,
  ConfirmModal,
} from '../components/SharedUI';

const STATUS_FLOW = [
  'pending',
  'accepted',
  'on_the_way',
  'reviewed',
  'procedure_planned',
  'completed',
];

export default function ConsultDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isPlasticSurgeryTeam, hasRole } = useAuth();

  const [consult, setConsult] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchConsult();
  }, [id]); // eslint-disable-line

  async function fetchConsult() {
    setLoading(true);
    try {
      const [consultRes, reviewsRes] = await Promise.all([
        consultsAPI.get(id),
        reviewsAPI.list(id),
      ]);
      setConsult(consultRes.data);
      setReviews(reviewsRes.data);
    } catch (err) {
      toast.error('Failed to load consult');
      navigate('/app/consults');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(newStatus) {
    setUpdating(true);
    try {
      await consultsAPI.updateStatus(id, { status: newStatus });
      toast.success(`Status updated to "${newStatus.replace('_', ' ')}"`);
      fetchConsult();
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
      setStatusModal(null);
    }
  }

  async function handleAcknowledge() {
    try {
      await consultsAPI.acknowledge(id);
      toast.success('Consult acknowledged');
      fetchConsult();
    } catch (err) {
      toast.error('Failed to acknowledge');
    }
  }

  if (loading) return <LoadingSpinner message="Loading consult..." />;
  if (!consult) return null;

  const canManage = isPlasticSurgeryTeam() || hasRole('admin');
  const currentStatusIdx = STATUS_FLOW.indexOf(consult.status);

  return (
    <div>
      <PageHeader
        title={`Consult ${consult.consult_id}`}
        subtitle={`Created ${format(new Date(consult.created_at), 'dd MMM yyyy, HH:mm')} hrs`}
        action={
          <button onClick={() => navigate('/app/consults')} className="btn-secondary text-sm flex items-center gap-1">
            <ArrowLeft size={16} /> Back
          </button>
        }
      />

      {/* Status Bar */}
      <Card className="mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={consult.status} />
          <UrgencyBadge urgency={consult.urgency} />
          {consult.acknowledged_at && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
              ✓ Acknowledged {format(new Date(consult.acknowledged_at), 'HH:mm')} hrs
            </span>
          )}
          {consult.accepted_at && (
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              ✓ Accepted {format(new Date(consult.accepted_at), 'HH:mm')} hrs
            </span>
          )}
        </div>

        {/* Status Progress */}
        <div className="mt-4 flex items-center gap-1 overflow-x-auto">
          {STATUS_FLOW.map((s, idx) => (
            <div key={s} className="flex items-center">
              <div
                className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap
                  ${idx <= currentStatusIdx
                    ? 'bg-primary-100 text-primary-800'
                    : 'bg-slate-100 text-slate-400'
                  }`}
              >
                {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </div>
              {idx < STATUS_FLOW.length - 1 && (
                <div className={`w-4 h-0.5 ${idx < currentStatusIdx ? 'bg-primary-400' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        {canManage && consult.status !== 'completed' && consult.status !== 'cancelled' && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
            {!consult.acknowledged_at && (
              <button onClick={handleAcknowledge} className="btn-secondary text-sm">
                Acknowledge Receipt
              </button>
            )}
            {consult.status === 'pending' && (
              <button onClick={() => setStatusModal('accepted')} className="btn-primary text-sm">
                Accept Consult
              </button>
            )}
            {consult.status === 'accepted' && (
              <button onClick={() => setStatusModal('on_the_way')} className="btn-primary text-sm">
                On the Way
              </button>
            )}
            {['accepted', 'on_the_way'].includes(consult.status) && (
              <button
                onClick={() => navigate(`/app/consults/${id}/review`)}
                className="btn-success text-sm"
              >
                Review & Document
              </button>
            )}
            {consult.status === 'procedure_planned' && (
              <button onClick={() => setStatusModal('completed')} className="btn-success text-sm">
                Mark Completed
              </button>
            )}
            {consult.status === 'reviewed' && (
              <button onClick={() => setStatusModal('completed')} className="btn-success text-sm">
                Mark Completed
              </button>
            )}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Patient Info */}
        <Card>
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <User size={16} /> Patient Information
          </h3>
          <dl className="space-y-2 text-sm">
            <InfoRow label="Full Name" value={consult.patient_name} />
            <InfoRow label="Hospital Number" value={consult.hospital_number} />
            <InfoRow label="Age / Sex" value={`${consult.age} years / ${consult.sex}`} />
            <InfoRow label="Ward" value={consult.ward} />
            <InfoRow label="Bed Number" value={consult.bed_number} />
            <InfoRow label="Date of Admission" value={consult.date_of_admission} />
            <InfoRow label="Primary Diagnosis" value={consult.primary_diagnosis} />
            <InfoRow label="Indication Category" value={consult.indication_category || '—'} />
            <InfoRow label="Indication" value={consult.indication} />
          </dl>
        </Card>

        {/* Consulting Unit */}
        <Card>
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <MapPin size={16} /> Consulting Unit
          </h3>
          <dl className="space-y-2 text-sm">
            <InfoRow label="Inviting Unit" value={consult.inviting_unit} />
            <InfoRow label="Consultant in Charge" value={consult.consultant_in_charge} />
            <InfoRow label="Requesting Doctor" value={consult.requesting_doctor} />
            <InfoRow label="Designation" value={consult.designation} />
            <InfoRow
              label="Phone"
              value={
                <a href={`tel:${consult.phone_number}`} className="text-primary-600 hover:underline flex items-center gap-1">
                  <Phone size={12} /> {consult.phone_number}
                </a>
              }
            />
            {consult.alternate_phone && (
              <InfoRow
                label="Alt. Phone"
                value={
                  <a href={`tel:${consult.alternate_phone}`} className="text-primary-600 hover:underline">
                    {consult.alternate_phone}
                  </a>
                }
              />
            )}
          </dl>
        </Card>

        {/* Timeline / Audit */}
        <Card>
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Clock size={16} /> Timeline
          </h3>
          <div className="space-y-3 text-sm">
            <TimelineItem
              label="Created"
              time={consult.created_at}
            />
            {consult.acknowledged_at && (
              <TimelineItem label="Acknowledged" time={consult.acknowledged_at} />
            )}
            {consult.accepted_at && (
              <TimelineItem label="Accepted" time={consult.accepted_at} />
            )}
            {consult.reviewed_at && (
              <TimelineItem label="Reviewed" time={consult.reviewed_at} />
            )}
            {consult.completed_at && (
              <TimelineItem label="Completed" time={consult.completed_at} />
            )}
          </div>
        </Card>

        {/* Reviews */}
        <Card>
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <FileText size={16} /> Reviews ({reviews.length})
          </h3>
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500">No reviews yet.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">
                    {format(new Date(r.created_at), 'dd MMM yyyy, HH:mm')} hrs
                    {r.reviewer && ` — ${r.reviewer.full_name}`}
                  </div>
                  <div className="text-sm text-slate-700 mb-2">{r.assessment_notes}</div>
                  {r.wound_classification && (
                    <span className="badge bg-purple-100 text-purple-700 mr-2">
                      Wound: {r.wound_classification.replace('_', ' ')}
                    </span>
                  )}
                  {r.wound_phase && (
                    <span className="badge bg-teal-100 text-teal-700">
                      Phase: {r.wound_phase}
                    </span>
                  )}
                  {r.management_plan && (
                    <div className="mt-2 text-xs text-slate-600">
                      <strong>Plan:</strong> {r.management_plan}
                    </div>
                  )}
                  {r.follow_up_date && (
                    <div className="mt-1 text-xs text-slate-500">
                      Follow-up: {r.follow_up_date}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Status Update Modal */}
      <ConfirmModal
        open={!!statusModal}
        title="Update Status"
        message={`Change consult status to "${statusModal?.replace('_', ' ')}"?`}
        confirmText={updating ? 'Updating...' : 'Confirm'}
        onConfirm={() => handleStatusUpdate(statusModal)}
        onCancel={() => setStatusModal(null)}
      />
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2">
      <dt className="text-slate-500 min-w-[140px] shrink-0">{label}:</dt>
      <dd className="text-slate-800 font-medium">{value || '—'}</dd>
    </div>
  );
}

function TimelineItem({ label, time }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-2 h-2 bg-primary-500 rounded-full shrink-0" />
      <div>
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-400 ml-2">
          {format(new Date(time), 'dd MMM yyyy, HH:mm')} hrs
        </span>
      </div>
    </div>
  );
}
