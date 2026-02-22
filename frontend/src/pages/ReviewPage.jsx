/**
 * PS Consult – UNTH: Review Documentation Page
 *
 * Clinical review form for Plastic Surgery team.
 * Includes wound assessment, management plan, photo upload.
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save, Camera, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { reviewsAPI } from '../api/client';
import { PageHeader, Card } from '../components/SharedUI';

const WOUND_CLASSIFICATIONS = [
  { value: 'clean', label: 'Clean' },
  { value: 'clean_contaminated', label: 'Clean-Contaminated' },
  { value: 'contaminated', label: 'Contaminated' },
  { value: 'dirty_infected', label: 'Dirty / Infected' },
];

const WOUND_PHASES = [
  { value: 'hemostasis', label: 'Hemostasis' },
  { value: 'inflammatory', label: 'Inflammatory' },
  { value: 'proliferative', label: 'Proliferative' },
  { value: 'remodeling', label: 'Remodeling' },
];

export default function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      procedure_scheduled: false,
    },
  });

  const procedureScheduled = watch('procedure_scheduled');

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      // Convert empty strings to null for optional fields
      const cleaned = { ...data };
      ['wound_length', 'wound_width', 'wound_depth'].forEach((f) => {
        if (cleaned[f] === '' || cleaned[f] === undefined) {
          delete cleaned[f];
        } else {
          cleaned[f] = parseFloat(cleaned[f]);
        }
      });
      if (!cleaned.wound_classification) delete cleaned.wound_classification;
      if (!cleaned.wound_phase) delete cleaned.wound_phase;
      if (!cleaned.procedure_date) delete cleaned.procedure_date;
      if (!cleaned.follow_up_date) delete cleaned.follow_up_date;

      await reviewsAPI.create(id, cleaned);
      toast.success('Review saved successfully!');
      navigate(`/consults/${id}`);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(e => e.msg || JSON.stringify(e)).join('; ') : 'Failed to save review';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('description', '');
        const res = await reviewsAPI.uploadPhoto(id, formData);
        setPhotos((prev) => [...prev, res.data]);
        toast.success(`Photo "${file.name}" uploaded`);
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div>
      <PageHeader
        title="Clinical Review"
        subtitle={`Documenting review for Consult #${id}`}
        action={
          <button onClick={() => navigate(-1)} className="btn-secondary text-sm flex items-center gap-1">
            <ArrowLeft size={16} /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Assessment */}
        <Card>
          <h2 className="text-base font-semibold text-slate-800 mb-4">📋 Assessment</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Assessment Notes *</label>
              <textarea
                rows={4}
                className={`input-field ${errors.assessment_notes ? 'error' : ''}`}
                placeholder="Clinical findings, examination notes..."
                {...register('assessment_notes', { required: 'Required' })}
              />
              {errors.assessment_notes && (
                <p className="text-red-500 text-xs mt-1">{errors.assessment_notes.message}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Wound Details */}
        <Card>
          <h2 className="text-base font-semibold text-slate-800 mb-4">🩹 Wound Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Wound Classification</label>
              <select className="input-field" {...register('wound_classification')}>
                <option value="">Not specified</option>
                {WOUND_CLASSIFICATIONS.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Wound Phase</label>
              <select className="input-field" {...register('wound_phase')}>
                <option value="">Not specified</option>
                {WOUND_PHASES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Wound Location</label>
              <input className="input-field" placeholder="e.g. Left forearm" {...register('wound_location')} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">Length (cm)</label>
                <input type="number" step="0.1" className="input-field" placeholder="L" {...register('wound_length')} />
              </div>
              <div>
                <label className="label">Width (cm)</label>
                <input type="number" step="0.1" className="input-field" placeholder="W" {...register('wound_width')} />
              </div>
              <div>
                <label className="label">Depth (cm)</label>
                <input type="number" step="0.1" className="input-field" placeholder="D" {...register('wound_depth')} />
              </div>
            </div>
          </div>
        </Card>

        {/* Photo Upload */}
        <Card>
          <h2 className="text-base font-semibold text-slate-800 mb-4">📷 Wound Photos</h2>
          <div className="flex items-center gap-3 mb-3">
            <label className="btn-secondary text-sm flex items-center gap-2 cursor-pointer">
              <Camera size={16} />
              {uploading ? 'Uploading...' : 'Upload Photos'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
            </label>
            <span className="text-xs text-slate-500">JPEG, PNG, WebP — Max 10MB each</span>
          </div>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <div key={p.id || i} className="bg-slate-100 rounded-lg p-2 text-xs text-center">
                  <Upload size={16} className="mx-auto mb-1 text-slate-400" />
                  {p.filename}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Management Plan */}
        <Card>
          <h2 className="text-base font-semibold text-slate-800 mb-4">📝 Management Plan</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Management Plan *</label>
              <textarea
                rows={4}
                className={`input-field ${errors.management_plan ? 'error' : ''}`}
                placeholder="Treatment plan, wound management protocol, medications..."
                {...register('management_plan', { required: 'Required' })}
              />
              {errors.management_plan && (
                <p className="text-red-500 text-xs mt-1">{errors.management_plan.message}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="procedure_scheduled"
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                {...register('procedure_scheduled')}
              />
              <label htmlFor="procedure_scheduled" className="text-sm font-medium text-slate-700">
                Procedure Scheduled
              </label>
            </div>

            {procedureScheduled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7">
                <div>
                  <label className="label">Procedure Date</label>
                  <input type="date" className="input-field" {...register('procedure_date')} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Procedure Details</label>
                  <textarea
                    rows={2}
                    className="input-field"
                    placeholder="Type of procedure planned..."
                    {...register('procedure_details')}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Follow-up Date</label>
                <input type="date" className="input-field" {...register('follow_up_date')} />
              </div>
              <div>
                <label className="label">Follow-up Notes</label>
                <input className="input-field" placeholder="Follow-up instructions..." {...register('follow_up_notes')} />
              </div>
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
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Review
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
