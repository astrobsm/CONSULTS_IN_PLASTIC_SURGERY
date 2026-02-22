/**
 * PS Consult – UNTH: Review Documentation Page
 *
 * Clinical review form for Plastic Surgery team.
 * Includes wound assessment, management plan, photo upload.
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save, Camera, Upload, Share2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { reviewsAPI, consultsAPI } from '../api/client';
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
  const [savedReview, setSavedReview] = useState(null);
  const [consult, setConsult] = useState(null);

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

      const reviewRes = await reviewsAPI.create(id, cleaned);
      // Fetch consult details for PDF generation
      try {
        const consultRes = await consultsAPI.get(id);
        setConsult(consultRes.data);
      } catch { /* proceed without consult data */ }
      setSavedReview({ ...cleaned, ...reviewRes.data, created_at: new Date().toISOString() });
      toast.success('Review saved successfully!');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(e => e.msg || JSON.stringify(e)).join('; ') : 'Failed to save review';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /** Generate PDF from the saved review + consult */
  function buildPDF() {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PLASTIC SURGERY CONSULT REVIEW', pw / 2, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('University of Nigeria Teaching Hospital (UNTH), Ituku-Ozalla', pw / 2, 25, { align: 'center' });
    doc.setDrawColor(0, 102, 153);
    doc.setLineWidth(0.5);
    doc.line(14, 28, pw - 14, 28);

    let y = 35;

    if (consult) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Patient Information', 14, y);
      y += 2;
      const t1 = autoTable(doc, {
        startY: y,
        theme: 'grid',
        headStyles: { fillColor: [0, 102, 153] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
        body: [
          ['Consult ID', consult.consult_id],
          ['Patient Name', consult.patient_name],
          ['Hospital Number', consult.hospital_number],
          ['Age / Sex', `${consult.age} yrs / ${consult.sex}`],
          ['Ward', consult.ward],
          ['Primary Diagnosis', consult.primary_diagnosis],
          ['Indication', consult.indication],
          ['Inviting Unit', consult.inviting_unit],
          ['Requesting Doctor', consult.requesting_doctor],
          ['Urgency', consult.urgency?.replace('_', ' ').toUpperCase()],
        ],
      });
      y = t1.finalY + 10;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Review Details', 14, y);
    y += 2;

    const rows = [
      ['Assessment Notes', savedReview.assessment_notes || '—'],
    ];
    if (savedReview.wound_classification) rows.push(['Wound Classification', savedReview.wound_classification.replace('_', ' ')]);
    if (savedReview.wound_phase) rows.push(['Wound Phase', savedReview.wound_phase]);
    if (savedReview.wound_location) rows.push(['Wound Location', savedReview.wound_location]);
    if (savedReview.wound_length || savedReview.wound_width || savedReview.wound_depth) {
      rows.push(['Wound Size (cm)', `L: ${savedReview.wound_length || '—'} × W: ${savedReview.wound_width || '—'} × D: ${savedReview.wound_depth || '—'}`]);
    }
    if (savedReview.management_plan) rows.push(['Management Plan', savedReview.management_plan]);
    if (savedReview.procedure_scheduled) {
      rows.push(['Procedure Scheduled', 'Yes']);
      if (savedReview.procedure_date) rows.push(['Procedure Date', savedReview.procedure_date]);
      if (savedReview.procedure_details) rows.push(['Procedure Details', savedReview.procedure_details]);
    }
    if (savedReview.follow_up_date) rows.push(['Follow-up Date', savedReview.follow_up_date]);
    if (savedReview.follow_up_notes) rows.push(['Follow-up Notes', savedReview.follow_up_notes]);

    const t2 = autoTable(doc, {
      startY: y,
      theme: 'grid',
      headStyles: { fillColor: [0, 102, 153] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
      body: rows,
    });

    y = t2.finalY + 12;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(120);
    doc.text('Generated by PS Consult – UNTH. For clinical use only.', pw / 2, y, { align: 'center' });
    return doc;
  }

  function handleDownloadPDF() {
    const doc = buildPDF();
    doc.save(`Review_Consult_${id}.pdf`);
    toast.success('PDF downloaded');
  }

  function handleShareWhatsApp() {
    const c = consult;
    const r = savedReview;
    const lines = [
      '*PLASTIC SURGERY CONSULT REVIEW*',
      'UNTH, Ituku-Ozalla',
      '',
    ];
    if (c) {
      lines.push(
        `*Patient:* ${c.patient_name}`,
        `*Hospital No:* ${c.hospital_number}`,
        `*Age/Sex:* ${c.age} yrs / ${c.sex}`,
        `*Ward:* ${c.ward}`,
        `*Diagnosis:* ${c.primary_diagnosis}`,
        `*Indication:* ${c.indication}`,
        `*Inviting Unit:* ${c.inviting_unit}`,
        '',
      );
    }
    lines.push(
      '--- REVIEW ---',
      `*Assessment:* ${r.assessment_notes || '—'}`,
    );
    if (r.wound_classification) lines.push(`*Wound:* ${r.wound_classification.replace('_', ' ')}`);
    if (r.management_plan) lines.push(`*Plan:* ${r.management_plan}`);
    if (r.procedure_scheduled) lines.push(`*Procedure:* Scheduled${r.procedure_date ? ' — ' + r.procedure_date : ''}`);
    if (r.follow_up_date) lines.push(`*Follow-up:* ${r.follow_up_date}`);
    lines.push('', '_Sent from PS Consult – UNTH_');

    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank');

    handleDownloadPDF();
    toast.success('PDF downloaded — attach it in WhatsApp');
  }

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

      {/* Post-submit success panel */}
      {savedReview ? (
        <Card className="mb-6">
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Review Saved Successfully</h2>
            <p className="text-sm text-slate-500 mb-6">Share the review summary with the inviting unit via WhatsApp or download the PDF.</p>

            <div className="flex flex-wrap justify-center gap-3 mb-6">
              <button
                onClick={handleShareWhatsApp}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
              >
                <Share2 size={18} />
                Share on WhatsApp
              </button>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
              >
                <Download size={18} />
                Download PDF
              </button>
            </div>

            <button
              onClick={() => navigate(`/app/consults/${id}`)}
              className="text-sm text-primary-600 hover:text-primary-800 font-medium underline"
            >
              ← Back to Consult Detail
            </button>
          </div>
        </Card>
      ) : (

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
      )}
    </div>
  );
}
