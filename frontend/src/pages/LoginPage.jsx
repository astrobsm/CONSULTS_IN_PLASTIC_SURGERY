/**
 * PS Consult – UNTH: Landing Page
 *
 * Open-access consult request form (no login required).
 * Includes "Doctor Login" button that prompts for access code.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  CheckCircle2, Send, Lock, X,
  Phone, Camera, ImageIcon, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { consultsAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';

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

export default function LoginPage() {
  const navigate = useNavigate();
  const { codeLogin } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [doctorCode, setDoctorCode] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

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

  // ── Handle photo selection ────────────────────────
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPEG, PNG, or WebP images are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image too large (max 10 MB)');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
  };

  // ── Submit consult (public – no auth) ─────────────
  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      const res = await consultsAPI.createPublic(data);

      // Upload photo if attached
      if (photoFile && res.data.consult_id) {
        try {
          const fd = new FormData();
          fd.append('file', photoFile);
          fd.append('description', 'Clinical photograph');
          await consultsAPI.uploadPhotoPublic(res.data.consult_id, fd);
        } catch {
          // Photo upload failure is non-blocking
          toast.error('Consult saved but photo upload failed.');
        }
      }

      setResult({ type: 'online', data: res.data });
      removePhoto();
      toast.success('Consult request submitted successfully!');
    } catch (err) {
      const detail = err.response?.data?.detail;
      let msg = 'Failed to submit. Please try again.';
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map((e) => e.msg || JSON.stringify(e)).join('; ');
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Doctor code login ─────────────────────────────
  const handleCodeLogin = async (e) => {
    e.preventDefault();
    if (!doctorCode.trim()) return;
    setLoginLoading(true);
    try {
      await codeLogin(doctorCode.trim());
      toast.success('Access granted. Welcome, Doctor!');
      setShowLoginModal(false);
      navigate('/app/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      let msg = 'Invalid access code.';
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map((e) => e.msg || JSON.stringify(e)).join('; ');
      }
      toast.error(msg);
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Confirmation Screen ───────────────────────────
  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-900 to-slate-900 flex items-center justify-center p-4 relative">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img src="/unth-logo.png" alt="" className="w-72 h-72 opacity-[0.04]" />
        </div>
        <div className="w-full max-w-lg relative z-10">
          <div className="rounded-2xl p-8 text-center shadow-xl bg-white">
            <img src="/unth-logo.png" alt="UNTH" className="mx-auto mb-3 w-16 h-16 object-contain" />
            <CheckCircle2 className="mx-auto mb-4 text-emerald-500" size={56} />
            <h2 className="text-xl font-bold text-emerald-800 mb-2">
              Consult Request Received!
            </h2>
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
            <p className="text-sm text-emerald-700 mb-6">
              The Plastic Surgery Unit has been notified. You will receive a response shortly.
            </p>
            <div className="inline-block bg-amber-50 rounded-lg px-4 py-2 text-sm text-amber-700 border border-amber-200 mb-6">
              Status: <span className="font-semibold">Pending Review</span>
            </div>

            {/* Schedule info */}
            <div className="bg-slate-50 rounded-lg p-4 text-left mt-4 border">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                Plastic Surgery Unit Schedule
              </h3>
              <div className="text-xs text-slate-600 space-y-1">
                <div><strong>Clinic:</strong> Tue &ndash; Drs Okwesili &amp; Nnadi | Wed &ndash; Dr Okwesili &amp; Dr Eze</div>
                <div><strong>Theatre:</strong> Wed &ndash; Drs Okwesili &amp; Nnadi | Thu &ndash; Dr Okwesili &amp; Dr Eze</div>
                <div><strong>Ward Rounds:</strong> Mon &ndash; Consultants | Fri &ndash; Senior Residents</div>
              </div>
            </div>

            <div className="flex gap-3 justify-center mt-6">
              <button
                onClick={() => {
                  setResult(null);
                  reset();
                }}
                className="px-5 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
              >
                Send Another Consult
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Landing Page ─────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 via-primary-900 to-slate-900 relative">
      {/* Full-page watermark */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
        <img src="/unth-logo.png" alt="" className="w-80 h-80 opacity-[0.04]" />
      </div>

      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20 relative z-10">
        <div className="flex items-center gap-2">
          <img src="/unth-logo.png" alt="UNTH" className="w-9 h-9 rounded-lg object-contain bg-white/10 p-0.5" />
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">PS Consult &ndash; UNTH</h1>
            <p className="text-[10px] text-blue-200/60">Plastic Surgery Unit</p>
          </div>
        </div>
        <button
          onClick={() => setShowLoginModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors border border-white/20"
        >
          <Lock size={12} />
          Plastic Team Login
        </button>
      </div>

      {/* Hero Section */}
      <div className="text-center px-4 pt-6 pb-4 relative z-10">
        <img src="/unth-logo.png" alt="UNTH Logo" className="mx-auto w-20 h-20 object-contain mb-3 drop-shadow-lg" />
        <h1 className="text-xl font-bold text-white tracking-tight">
          Request a Plastic Surgery Consult
        </h1>
        <p className="text-blue-200 text-sm mt-1 max-w-md mx-auto">
          University of Nigeria Teaching Hospital, Ituku-Ozalla
        </p>
        <p className="text-blue-300/50 text-xs mt-1">
          Fill in the form below. No login required.
        </p>
      </div>

      {/* Consult Form */}
      <div className="px-4 pb-8 max-w-2xl mx-auto relative z-10">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Patient Information */}
          <div className="bg-white rounded-xl shadow-lg p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              Patient Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Full Name *</label>
                <input
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.patient_name ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  placeholder="Patient full name"
                  {...register('patient_name', { required: 'Required' })}
                />
                {errors.patient_name && <p className="text-red-500 text-xs mt-0.5">{errors.patient_name.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Hospital Number *</label>
                <input
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.hospital_number ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  placeholder="e.g. UNTH/2026/12345"
                  {...register('hospital_number', { required: 'Required' })}
                />
                {errors.hospital_number && <p className="text-red-500 text-xs mt-0.5">{errors.hospital_number.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Age *</label>
                  <input
                    type="number"
                    className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.age ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                    placeholder="Age"
                    {...register('age', { required: 'Required', valueAsNumber: true, min: { value: 0, message: 'Invalid' } })}
                  />
                  {errors.age && <p className="text-red-500 text-xs mt-0.5">{errors.age.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Sex *</label>
                  <select className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.sex ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} {...register('sex', { required: 'Required' })}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {errors.sex && <p className="text-red-500 text-xs mt-0.5">{errors.sex.message}</p>}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Ward *</label>
                <select className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.ward ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} {...register('ward', { required: 'Required' })}>
                  <option value="">Select ward</option>
                  {WARDS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
                {errors.ward && <p className="text-red-500 text-xs mt-0.5">{errors.ward.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Bed Number *</label>
                <input
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.bed_number ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  placeholder="Bed number"
                  {...register('bed_number', { required: 'Required' })}
                />
                {errors.bed_number && <p className="text-red-500 text-xs mt-0.5">{errors.bed_number.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Date of Admission *</label>
                <input
                  type="date"
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.date_of_admission ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  {...register('date_of_admission', { required: 'Required' })}
                />
                {errors.date_of_admission && <p className="text-red-500 text-xs mt-0.5">{errors.date_of_admission.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Urgency *</label>
                <select className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.urgency ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} {...register('urgency', { required: 'Required' })}>
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent (within 24h)</option>
                  <option value="emergency">Emergency (Immediate)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Primary Diagnosis *</label>
                <input
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.primary_diagnosis ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  placeholder="Primary diagnosis"
                  {...register('primary_diagnosis', { required: 'Required' })}
                />
                {errors.primary_diagnosis && <p className="text-red-500 text-xs mt-0.5">{errors.primary_diagnosis.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Indication Category</label>
                <select className="w-full px-3 py-2 rounded-lg border text-sm border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition" {...register('indication_category')}>
                  <option value="">Select category</option>
                  {INDICATION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Indication for Consult *</label>
                <textarea
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.indication ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  placeholder="Describe the reason for requesting a Plastic Surgery consult..."
                  {...register('indication', { required: 'Required' })}
                />
                {errors.indication && <p className="text-red-500 text-xs mt-0.5">{errors.indication.message}</p>}
              </div>

              {/* Clinical Photograph (optional) */}
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Clinical Photograph <span className="text-slate-400">(optional)</span>
                </label>
                {photoPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={photoPreview}
                      alt="Clinical photo preview"
                      className="w-full max-w-xs h-40 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow hover:bg-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                    <p className="text-xs text-slate-500 mt-1">{photoFile?.name}</p>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50/40 transition-colors">
                    <Camera size={24} className="text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500">Tap to take or choose photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Consulting Unit Details */}
          <div className="bg-white rounded-xl shadow-lg p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Consulting Unit Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Inviting Unit *</label>
                <select
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.inviting_unit ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  {...register('inviting_unit', { required: 'Required' })}
                >
                  <option value="">Select unit</option>
                  {INVITING_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                {errors.inviting_unit && <p className="text-red-500 text-xs mt-0.5">{errors.inviting_unit.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Consultant in Charge *</label>
                <input
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.consultant_in_charge ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  placeholder="Name of consultant"
                  {...register('consultant_in_charge', { required: 'Required' })}
                />
                {errors.consultant_in_charge && <p className="text-red-500 text-xs mt-0.5">{errors.consultant_in_charge.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Requesting Doctor *</label>
                <input
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.requesting_doctor ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  placeholder="Your name"
                  {...register('requesting_doctor', { required: 'Required' })}
                />
                {errors.requesting_doctor && <p className="text-red-500 text-xs mt-0.5">{errors.requesting_doctor.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Designation *</label>
                <select
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.designation ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  {...register('designation', { required: 'Required' })}
                >
                  <option value="HO">House Officer (HO)</option>
                  <option value="Registrar">Registrar</option>
                  <option value="Senior Registrar">Senior Registrar</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Phone size={12} /> Phone Number *
                </label>
                <input
                  type="tel"
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition ${errors.phone_number ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  placeholder="080xxxxxxxx"
                  {...register('phone_number', { required: 'Required', minLength: { value: 7, message: 'Too short' } })}
                />
                {errors.phone_number && <p className="text-red-500 text-xs mt-0.5">{errors.phone_number.message}</p>}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Alternate Phone</label>
                <input
                  type="tel"
                  className="w-full px-3 py-2 rounded-lg border text-sm border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                  placeholder="Alternate number"
                  {...register('alternate_phone')}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                Submitting...
              </>
            ) : (
              <>
                <Send size={16} />
                Submit Consult Request
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-blue-200/40 text-xs">
            Plastic Surgery Unit &ndash; Department of Surgery, UNTH Ituku-Ozalla
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="text-blue-300/60 text-xs hover:text-blue-200 underline transition-colors"
          >
            Plastic Team Login
          </button>
        </div>
      </div>

      {/* ── Doctor Login Modal ─────────────────────── */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
            <button
              onClick={() => { setShowLoginModal(false); setDoctorCode(''); }}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-5">
              <img src="/unth-logo.png" alt="UNTH" className="mx-auto w-14 h-14 object-contain mb-3" />
              <h2 className="text-lg font-bold text-slate-800">Plastic Team Login</h2>
              <p className="text-xs text-slate-500 mt-1">
                Enter the team access code to manage consults
              </p>
            </div>

            <form onSubmit={handleCodeLogin}>
              <div className="mb-4">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Access Code</label>
                <input
                  type="password"
                  value={doctorCode}
                  onChange={(e) => setDoctorCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm text-center tracking-[0.3em] font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none uppercase"
                  placeholder="Enter code"
                  autoFocus
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading || !doctorCode.trim()}
                className="w-full py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {loginLoading ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    Enter
                  </>
                )}
              </button>
            </form>

            <p className="text-[10px] text-slate-400 text-center mt-4">
              Authorized personnel only. All access is logged.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
