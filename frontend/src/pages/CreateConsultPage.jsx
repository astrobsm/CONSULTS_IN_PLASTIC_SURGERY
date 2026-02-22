/**
 * PS Consult – UNTH: Create Consult Page
 *
 * Structured consult request form with offline support.
 * Shows confirmation/acknowledgement after submission.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { CheckCircle2, WifiOff, ArrowLeft, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { consultsAPI } from '../api/client';
import { useOnlineStatus } from '../context/OnlineStatusContext';
import { saveOfflineConsult } from '../db/offlineDb';
import { PageHeader, Card } from '../components/SharedUI';

// ── Constants ───────────────────────────────────────
const WARDS = [
  'Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5',
  'Ward 6A', 'Ward 6B', 'Ward 8', 'Ward 9', 'Ward 10',
  'Oncology Ward', 'Post Natal Ward', 'Neuro Ward',
  'Male Medical Ward Extension', 'Male Medical Ward', 'Female Medical Ward',
  'Private Suite – Pink', 'Private Suite – Purple', 'Private Suite – Blue', 'Private Suite – White',
  'Eye Ward', 'Labour Ward',
  'Surgical Emergency Ward', 'Medical Emergency Ward', 'Newborn Special Care', 'Children Emergency Ward',
];

const INVITING_UNITS = [
  'Cardiology', 'Endocrinology', 'Respiratory Medicine',
  'Nephrology', 'Dermatology & Rheumatology', 'Haematology',
  'Neurology', 'Psychiatry', 'Paediatrics',
  'Ophthalmology', 'ENT', 'Maxillofacial Surgery',
  'General Surgery', 'Urology', 'Cardiothoracic Surgery',
  'Gastroenterology', 'Radio-Oncology', 'Obstetrics & Gynaecology',
  'ICU', 'Orthopaedic Surgery',
];

const INDICATION_CATEGORIES = [
  'Wound Management', 'Burn Injury', 'Skin/Soft Tissue Defect',
  'Contracture Release', 'Scar Revision', 'Skin Grafting',
  'Flap Reconstruction', 'Hand Injury', 'Facial Injury',
  'Congenital Anomaly', 'Pressure Ulcer', 'Diabetic Foot',
  'Post-Surgical Wound', 'Tumour Excision', 'Other',
];

export default function CreateConsultPage() {
  const navigate = useNavigate();
  const { isOnline, refreshPendingCount } = useOnlineStatus();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { type: 'online'|'offline', data }

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      urgency: 'routine',
      designation: 'Registrar',
      date_of_admission: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      if (isOnline) {
        // Online: submit directly
        const res = await consultsAPI.create(data);
        setResult({ type: 'online', data: res.data });
        toast.success('Consult request submitted successfully!');
      } else {
        // Offline: save locally
        const { clientId } = await saveOfflineConsult(data);
        setResult({
          type: 'offline',
          data: { consult_id: clientId, received_at: new Date().toISOString() },
        });
        refreshPendingCount();
        toast('Consult saved offline. Will sync when online.', {
          icon: '📡',
          style: { background: '#f59e0b', color: '#1e293b' },
        });
      }
    } catch (err) {
      // If server fails, save offline
      try {
        const { clientId } = await saveOfflineConsult(data);
        setResult({
          type: 'offline',
          data: { consult_id: clientId, received_at: new Date().toISOString() },
        });
        refreshPendingCount();
        toast('Server error — saved offline instead.', {
          icon: '⚠️',
          style: { background: '#f59e0b', color: '#1e293b' },
        });
      } catch (offlineErr) {
        toast.error('Failed to save consult. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Confirmation / Acknowledgement Screen ─────────
  if (result) {
    const isOffline = result.type === 'offline';
    return (
      <div className="max-w-lg mx-auto mt-8">
        <div
          className={`rounded-2xl p-8 text-center shadow-sm border ${
            isOffline
              ? 'bg-amber-50 border-amber-200'
              : 'bg-emerald-50 border-emerald-200'
          }`}
        >
          {isOffline ? (
            <WifiOff className="mx-auto mb-4 text-amber-500" size={48} />
          ) : (
            <CheckCircle2 className="mx-auto mb-4 text-emerald-500" size={48} />
          )}

          <h2 className={`text-xl font-bold mb-2 ${isOffline ? 'text-amber-800' : 'text-emerald-800'}`}>
            {isOffline
              ? 'Consult Saved Offline'
              : 'Consult Request Successfully Received'}
          </h2>

          {!isOffline && (
            <div className="text-sm text-emerald-700 space-y-1 mb-4">
              <div>
                <strong>Consult ID:</strong> {result.data.consult_id}
              </div>
              <div>
                <strong>Time Logged:</strong>{' '}
                {new Date(result.data.received_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                hrs
              </div>
            </div>
          )}

          <p className={`text-sm mb-6 ${isOffline ? 'text-amber-700' : 'text-emerald-700'}`}>
            {isOffline
              ? 'Your request has been securely saved and will be transmitted automatically once network connectivity is restored. You may safely leave this page.'
              : 'The Plastic Surgery Unit has been notified. You will receive a response shortly.'}
          </p>

          {!isOffline && (
            <div className="inline-block bg-white rounded-lg px-4 py-2 text-sm text-slate-600 border mb-6">
              Status: <span className="font-medium text-amber-600">Pending Review</span>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setResult(null);
                reset();
              }}
              className="btn-secondary text-sm"
            >
              New Consult
            </button>
            <button
              onClick={() => navigate('/app/consults')}
              className="btn-primary text-sm"
            >
              View Consults
            </button>
          </div>
        </div>

        {/* Schedule reminder */}
        <Card className="mt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            📅 Plastic Surgery Unit Schedule
          </h3>
          <div className="text-xs text-slate-600 space-y-1">
            <div><strong>Clinic:</strong> Tue – Drs Okwesili & Nnadi | Wed – Dr Okwesili & Dr Eze</div>
            <div><strong>Theatre:</strong> Wed – Drs Okwesili & Nnadi | Thu – Dr Okwesili & Dr Eze</div>
            <div><strong>Ward Rounds:</strong> Mon – Consultants | Fri – Senior Residents</div>
          </div>
        </Card>
      </div>
    );
  }

  // ── Consult Form ──────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Create Consult Request"
        subtitle="Fill in patient and consulting unit details."
        action={
          <button onClick={() => navigate(-1)} className="btn-secondary text-sm flex items-center gap-1">
            <ArrowLeft size={16} /> Back
          </button>
        }
      />

      {!isOnline && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-amber-800">
          <WifiOff size={16} />
          You are offline. The consult will be saved locally and synced when you reconnect.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Patient Information */}
        <Card>
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            🧾 Patient Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Full Name *</label>
              <input
                className={`input-field ${errors.patient_name ? 'error' : ''}`}
                placeholder="Patient full name"
                {...register('patient_name', { required: 'Required' })}
              />
              {errors.patient_name && <p className="text-red-500 text-xs mt-1">{errors.patient_name.message}</p>}
            </div>

            <div>
              <label className="label">Hospital Number (PT Number) *</label>
              <input
                className={`input-field ${errors.hospital_number ? 'error' : ''}`}
                placeholder="e.g. UNTH/2026/12345"
                {...register('hospital_number', { required: 'Required' })}
              />
              {errors.hospital_number && <p className="text-red-500 text-xs mt-1">{errors.hospital_number.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Age *</label>
                <input
                  type="number"
                  className={`input-field ${errors.age ? 'error' : ''}`}
                  placeholder="Age"
                  {...register('age', { required: 'Required', valueAsNumber: true, min: { value: 0, message: 'Invalid' } })}
                />
                {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age.message}</p>}
              </div>
              <div>
                <label className="label">Sex *</label>
                <select className={`input-field ${errors.sex ? 'error' : ''}`} {...register('sex', { required: 'Required' })}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                {errors.sex && <p className="text-red-500 text-xs mt-1">{errors.sex.message}</p>}
              </div>
            </div>

            <div>
              <label className="label">Ward *</label>
              <select className={`input-field ${errors.ward ? 'error' : ''}`} {...register('ward', { required: 'Required' })}>
                <option value="">Select ward</option>
                {WARDS.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
              {errors.ward && <p className="text-red-500 text-xs mt-1">{errors.ward.message}</p>}
            </div>

            <div>
              <label className="label">Bed Number *</label>
              <input
                className={`input-field ${errors.bed_number ? 'error' : ''}`}
                placeholder="Bed number"
                {...register('bed_number', { required: 'Required' })}
              />
              {errors.bed_number && <p className="text-red-500 text-xs mt-1">{errors.bed_number.message}</p>}
            </div>

            <div>
              <label className="label">Date of Admission *</label>
              <input
                type="date"
                className={`input-field ${errors.date_of_admission ? 'error' : ''}`}
                {...register('date_of_admission', { required: 'Required' })}
              />
              {errors.date_of_admission && <p className="text-red-500 text-xs mt-1">{errors.date_of_admission.message}</p>}
            </div>

            <div>
              <label className="label">Urgency Level *</label>
              <select className={`input-field ${errors.urgency ? 'error' : ''}`} {...register('urgency', { required: 'Required' })}>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent (within 24h)</option>
                <option value="emergency">Emergency (Immediate)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="label">Primary Diagnosis *</label>
              <input
                className={`input-field ${errors.primary_diagnosis ? 'error' : ''}`}
                placeholder="Primary diagnosis"
                {...register('primary_diagnosis', { required: 'Required' })}
              />
              {errors.primary_diagnosis && <p className="text-red-500 text-xs mt-1">{errors.primary_diagnosis.message}</p>}
            </div>

            <div>
              <label className="label">Indication Category</label>
              <select className="input-field" {...register('indication_category')}>
                <option value="">Select category</option>
                {INDICATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="label">Indication for Consult *</label>
              <textarea
                rows={3}
                className={`input-field ${errors.indication ? 'error' : ''}`}
                placeholder="Describe the reason for requesting a Plastic Surgery consult..."
                {...register('indication', { required: 'Required' })}
              />
              {errors.indication && <p className="text-red-500 text-xs mt-1">{errors.indication.message}</p>}
            </div>
          </div>
        </Card>

        {/* Consulting Unit Details */}
        <Card>
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            🏥 Consulting Unit Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Inviting Unit *</label>
              <select
                className={`input-field ${errors.inviting_unit ? 'error' : ''}`}
                {...register('inviting_unit', { required: 'Required' })}
              >
                <option value="">Select unit</option>
                {INVITING_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              {errors.inviting_unit && <p className="text-red-500 text-xs mt-1">{errors.inviting_unit.message}</p>}
            </div>

            <div>
              <label className="label">Consultant in Charge *</label>
              <input
                className={`input-field ${errors.consultant_in_charge ? 'error' : ''}`}
                placeholder="Name of consultant"
                {...register('consultant_in_charge', { required: 'Required' })}
              />
              {errors.consultant_in_charge && <p className="text-red-500 text-xs mt-1">{errors.consultant_in_charge.message}</p>}
            </div>

            <div>
              <label className="label">Requesting Doctor *</label>
              <input
                className={`input-field ${errors.requesting_doctor ? 'error' : ''}`}
                placeholder="Your name"
                {...register('requesting_doctor', { required: 'Required' })}
              />
              {errors.requesting_doctor && <p className="text-red-500 text-xs mt-1">{errors.requesting_doctor.message}</p>}
            </div>

            <div>
              <label className="label">Designation *</label>
              <select
                className={`input-field ${errors.designation ? 'error' : ''}`}
                {...register('designation', { required: 'Required' })}
              >
                <option value="HO">House Officer (HO)</option>
                <option value="Registrar">Registrar</option>
                <option value="Senior Registrar">Senior Registrar</option>
              </select>
            </div>

            <div>
              <label className="label">Phone Number *</label>
              <input
                type="tel"
                className={`input-field ${errors.phone_number ? 'error' : ''}`}
                placeholder="080xxxxxxxx"
                {...register('phone_number', { required: 'Required', minLength: { value: 7, message: 'Too short' } })}
              />
              {errors.phone_number && <p className="text-red-500 text-xs mt-1">{errors.phone_number.message}</p>}
            </div>

            <div>
              <label className="label">Alternate Phone (Optional)</label>
              <input
                type="tel"
                className="input-field"
                placeholder="Alternate number"
                {...register('alternate_phone')}
              />
            </div>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                Submitting...
              </>
            ) : (
              <>
                <Send size={16} />
                Submit Consult
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
