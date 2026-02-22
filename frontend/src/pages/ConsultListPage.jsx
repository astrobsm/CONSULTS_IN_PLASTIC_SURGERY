/**
 * PS Consult – UNTH: Consult List Page
 *
 * Filterable, searchable list of consults with status tracking.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, X, ClipboardList, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { consultsAPI } from '../api/client';
import { useOnlineStatus } from '../context/OnlineStatusContext';
import { getCachedConsults, cacheConsults } from '../db/offlineDb';
import {
  PageHeader,
  Card,
  StatusBadge,
  UrgencyBadge,
  LoadingSpinner,
  EmptyState,
} from '../components/SharedUI';
import { format } from 'date-fns';

export default function ConsultListPage() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();
  const [searchParams, setSearchParams] = useSearchParams();

  const [consults, setConsults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [urgencyFilter, setUrgencyFilter] = useState(searchParams.get('urgency') || '');
  const [wardFilter, setWardFilter] = useState('');

  const fetchConsults = useCallback(async () => {
    setLoading(true);
    try {
      if (isOnline) {
        const params = {
          page,
          per_page: 20,
          ...(search && { search }),
          ...(statusFilter && { status: statusFilter }),
          ...(urgencyFilter && { urgency: urgencyFilter }),
          ...(wardFilter && { ward: wardFilter }),
        };
        const res = await consultsAPI.list(params);
        setConsults(res.data.consults);
        setTotal(res.data.total);
        // Cache for offline
        cacheConsults(res.data.consults);
      } else {
        const cached = await getCachedConsults();
        setConsults(cached);
        setTotal(cached.length);
      }
    } catch (err) {
      console.error('Failed to fetch consults:', err);
      const cached = await getCachedConsults();
      setConsults(cached);
      setTotal(cached.length);
    } finally {
      setLoading(false);
    }
  }, [isOnline, page, search, statusFilter, urgencyFilter, wardFilter]);

  useEffect(() => {
    fetchConsults();
  }, [fetchConsults]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setUrgencyFilter('');
    setWardFilter('');
    setPage(1);
    setSearchParams({});
  };

  const hasFilters = search || statusFilter || urgencyFilter || wardFilter;
  const totalPages = Math.ceil(total / 20);

  // ── PDF Download ──────────────────────────────────
  const downloadPDF = () => {
    if (consults.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PS Consult \u2013 UNTH', 14, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Plastic Surgery Consult List \u2013 University of Nigeria Teaching Hospital, Ituku-Ozalla', 14, 22);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')} hrs`, 14, 27);

    if (hasFilters) {
      const parts = [];
      if (search) parts.push(`Search: "${search}"`);
      if (statusFilter) parts.push(`Status: ${statusFilter}`);
      if (urgencyFilter) parts.push(`Urgency: ${urgencyFilter}`);
      if (wardFilter) parts.push(`Ward: ${wardFilter}`);
      doc.setFontSize(8);
      doc.text(`Filters: ${parts.join(' | ')}`, 14, 32);
    }

    // Table data
    const tableRows = consults.map((c) => [
      c.consult_id || '',
      c.patient_name || '',
      c.hospital_number || '',
      `${c.age || ''}/${c.sex || ''}`,
      c.ward || '',
      c.bed_number || '',
      c.inviting_unit || '',
      c.requesting_doctor || '',
      c.primary_diagnosis || '',
      (c.urgency || '').toUpperCase(),
      (c.status || '').replace(/_/g, ' ').toUpperCase(),
      c.created_at ? format(new Date(c.created_at), 'dd/MM/yy HH:mm') : '',
    ]);

    autoTable(doc, {
      startY: hasFilters ? 36 : 32,
      head: [[
        'Consult ID', 'Patient', 'Hosp. No.', 'Age/Sex',
        'Ward', 'Bed', 'Consulting Unit', 'Req. Doctor',
        'Diagnosis', 'Urgency', 'Status', 'Date',
      ]],
      body: tableRows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [15, 76, 117], fontSize: 7, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 22 },
        8: { cellWidth: 30 },
      },
      margin: { left: 14, right: 14 },
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount} \u2013 PS Consult UNTH`,
        doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 7,
        { align: 'center' },
      );
    }

    doc.save(`PS-Consult-List_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
  };

  return (
    <div>
      <PageHeader
        title="Consult Requests"
        subtitle={`${total} total consult${total !== 1 ? 's' : ''}`}
      />

      {/* Search & Filter Bar */}
      <Card className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="input-field pl-9"
              placeholder="Search by name, hospital number, or consult ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 text-sm ${showFilters ? 'bg-slate-100' : ''}`}
          >
            <Filter size={16} />
            Filters
            {hasFilters && (
              <span className="bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded-full">!</span>
            )}
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="btn-secondary text-sm flex items-center gap-1">
              <X size={14} /> Clear
            </button>
          )}
          <button
            onClick={downloadPDF}
            disabled={consults.length === 0}
            className="btn-secondary flex items-center gap-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
            title="Download current list as PDF"
          >
            <Download size={16} />
            PDF
          </button>
        </div>

        {/* Filter dropdowns */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100">
            <div>
              <label className="label">Status</label>
              <select
                className="input-field text-sm"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="on_the_way">On the Way</option>
                <option value="reviewed">Reviewed</option>
                <option value="procedure_planned">Procedure Planned</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="label">Urgency</label>
              <select
                className="input-field text-sm"
                value={urgencyFilter}
                onChange={(e) => { setUrgencyFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Urgencies</option>
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="label">Ward</label>
              <input
                className="input-field text-sm"
                placeholder="Filter by ward..."
                value={wardFilter}
                onChange={(e) => { setWardFilter(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Consult List */}
      {loading ? (
        <LoadingSpinner message="Loading consults..." />
      ) : consults.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No consults found"
          description={hasFilters ? 'Try adjusting your filters.' : 'No consult requests have been submitted yet.'}
        />
      ) : (
        <>
          <div className="space-y-3">
            {consults.map((c) => (
              <Card
                key={c.id || c.consult_id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => c.id && navigate(`/consults/${c.id}`)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-slate-800">{c.patient_name}</span>
                      <UrgencyBadge urgency={c.urgency} />
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="text-sm text-slate-500 space-y-0.5">
                      <div>
                        <span className="font-medium">{c.consult_id}</span>
                        {' • '}PT: {c.hospital_number}
                      </div>
                      <div>
                        {c.ward} • Bed {c.bed_number} • {c.inviting_unit}
                      </div>
                      <div className="text-xs text-slate-400">
                        {c.created_at && format(new Date(c.created_at), 'dd MMM yyyy, HH:mm')} hrs
                        {c.requesting_doctor && ` — Dr. ${c.requesting_doctor}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 text-right hidden sm:block">
                    {c.primary_diagnosis && (
                      <div className="text-slate-600 mb-1 max-w-[200px] truncate">
                        {c.primary_diagnosis}
                      </div>
                    )}
                    {c.phone_number}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
