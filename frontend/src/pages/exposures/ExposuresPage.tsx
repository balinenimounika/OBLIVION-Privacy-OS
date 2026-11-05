import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  Plus,
  Trash2,
  Calendar,
  Globe,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import { exposureApi } from '../../api/exposure.api';
import { websiteApi } from '../../api/website.api';
import { categoryApi } from '../../api/category.api';
import {
  ExposureRecord,
  Website,
  DataCategory,
  SensitivityLevel,
  RecordStatus,
  PaginationMeta,
} from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { SensitivityBadge, StatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { useToast } from '../../context/ToastContext';

const SENSITIVITY_OPTIONS = [
  { value: 'LOW', label: 'LOW (1.0x Multiplier)' },
  { value: 'MEDIUM', label: 'MEDIUM (1.5x Multiplier)' },
  { value: 'HIGH', label: 'HIGH (2.0x Multiplier)' },
  { value: 'CRITICAL', label: 'CRITICAL (3.0x Multiplier)' },
];

const RECORD_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active Exposure' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'REMOVAL_REQUESTED', label: 'Removal Requested' },
  { value: 'REMOVED', label: 'Removed / Erased' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export const ExposuresPage: React.FC = () => {
  const { showToast } = useToast();

  const [exposures, setExposures] = useState<ExposureRecord[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [categories, setCategories] = useState<DataCategory[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>('');
  const [selectedSensitivity, setSelectedSensitivity] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [selectedExposure, setSelectedExposure] = useState<ExposureRecord | null>(null);

  // Form states
  const [websiteId, setWebsiteId] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [sensitivityLevel, setSensitivityLevel] = useState<SensitivityLevel>('MEDIUM');
  const [dateShared, setDateShared] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, webRes, catRes] = await Promise.all([
        exposureApi.list({
          page: currentPage,
          limit: 10,
          websiteId: selectedWebsiteId || undefined,
          sensitivityLevel: selectedSensitivity || undefined,
          recordStatus: selectedStatus || undefined,
        }),
        websiteApi.list({ limit: 100 }),
        categoryApi.list(),
      ]);

      setExposures(expRes.data || []);
      if (expRes.meta) setMeta(expRes.meta);
      setWebsites(webRes.data || []);
      setCategories(catRes.data || []);
    } catch (err: any) {
      console.error('Failed to load exposures:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch exposure records.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedWebsiteId, selectedSensitivity, selectedStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!websiteId || !purpose) {
      setFormError('Please select a website and specify the purpose of data exposure.');
      return;
    }

    setSubmitting(true);
    try {
      await exposureApi.create({
        websiteId,
        purpose,
        sensitivityLevel,
        dateShared: new Date(dateShared).toISOString(),
        notes: notes || undefined,
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
      });

      showToast('Exposure record created with dynamic risk score calculation', 'success');
      setIsAddModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create exposure.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedExposure) return;
    setSubmitting(true);
    try {
      await exposureApi.delete(selectedExposure.id);
      showToast('Exposure record deleted', 'success');
      setIsDeleteModalOpen(false);
      setSelectedExposure(null);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete exposure.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setWebsiteId(websites[0]?.id || '');
    setPurpose('');
    setSensitivityLevel('MEDIUM');
    setDateShared(new Date().toISOString().split('T')[0]);
    setNotes('');
    setSelectedCategoryIds([]);
    setFormError(null);
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Personal Exposure Records
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track specific personal data points exposed to third-party platforms with automated risk calculation.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={websites.length === 0}
          onClick={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Catalog Exposure
        </Button>
      </div>

      {websites.length === 0 && !loading && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>You must register at least one third-party website before logging personal exposures.</span>
          </div>
        </div>
      )}

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          options={[
            { value: '', label: 'All Websites' },
            ...websites.map((w) => ({ value: w.id, label: w.websiteName })),
          ]}
          value={selectedWebsiteId}
          onChange={(e) => {
            setSelectedWebsiteId(e.target.value);
            setCurrentPage(1);
          }}
        />

        <Select
          options={[
            { value: '', label: 'All Sensitivity Levels' },
            { value: 'LOW', label: 'LOW' },
            { value: 'MEDIUM', label: 'MEDIUM' },
            { value: 'HIGH', label: 'HIGH' },
            { value: 'CRITICAL', label: 'CRITICAL' },
          ]}
          value={selectedSensitivity}
          onChange={(e) => {
            setSelectedSensitivity(e.target.value);
            setCurrentPage(1);
          }}
        />

        <Select
          options={[
            { value: '', label: 'All Statuses' },
            ...RECORD_STATUS_OPTIONS,
          ]}
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Exposure Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : exposures.length === 0 ? (
        <EmptyState
          title="No Exposures Found"
          description="Log the personal information records (e.g. phone numbers, resume, home address) entrusted to external platforms."
          actionText={websites.length > 0 ? 'Catalog Exposure' : undefined}
          onAction={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
        />
      ) : (
        <div className="space-y-3">
          {exposures.map((exp) => (
            <Card
              key={exp.id}
              className="bg-navy-900 border-navy-750 p-5 hover:border-navy-700 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <SensitivityBadge level={exp.sensitivityLevel} />
                    <StatusBadge status={exp.recordStatus} />
                    <span className="text-xs font-mono text-slate-400">ID: {exp.id.slice(0, 8)}...</span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100">{exp.purpose}</h3>

                  <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Globe className="w-3.5 h-3.5 text-electric-400" />
                      {exp.website?.websiteName || 'Unknown Platform'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Shared: {new Date(exp.dateShared).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Attached Categories */}
                  {exp.categories && exp.categories.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <Tag className="w-3 h-3 text-slate-500" />
                      {exp.categories.map((c) => (
                        <span
                          key={c.dataCategory.id}
                          className="px-2 py-0.5 rounded-md bg-navy-800 text-[10px] text-slate-300 border border-navy-750"
                        >
                          {c.dataCategory.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {exp.notes && (
                    <p className="text-xs text-slate-400 italic pt-1">"{exp.notes}"</p>
                  )}
                </div>

                {/* Right: Calculated Risk Score & Actions */}
                <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-center border-t lg:border-t-0 pt-3 lg:pt-0 border-navy-800 gap-3 shrink-0">
                  <div className="text-left lg:text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                      Backend Risk Score
                    </div>
                    <div className="flex items-baseline lg:justify-end gap-1.5">
                      <span className="text-xl font-bold font-mono text-amber-400">
                        {exp.calculatedRiskScore ?? 0}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        ({exp.calculatedRiskRating || 'LOW'})
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedExposure(exp);
                      setIsDeleteModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                    title="Delete Exposure"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}

          {/* Pagination Controls */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-xs text-slate-400">
              <div>
                Page <span className="font-semibold text-slate-200">{meta.page}</span> of{' '}
                <span className="font-semibold text-slate-200">{meta.totalPages}</span> ({meta.total} total)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= meta.totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(meta.totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Exposure Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Catalog Personal Data Exposure"
        description="Record sensitive personal details held by an external platform."
        maxWidth="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Target Platform / Website *"
              options={websites.map((w) => ({ value: w.id, label: w.websiteName }))}
              value={websiteId}
              onChange={(e) => setWebsiteId(e.target.value)}
              required
            />

            <Select
              label="Sensitivity Rating *"
              options={SENSITIVITY_OPTIONS}
              value={sensitivityLevel}
              onChange={(e) => setSensitivityLevel(e.target.value as SensitivityLevel)}
              required
            />
          </div>

          <Input
            label="Exposure Purpose / Context *"
            placeholder="e.g. Account profile registration, public resume posting"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Date Shared / Discovered *"
              type="date"
              value={dateShared}
              onChange={(e) => setDateShared(e.target.value)}
              required
            />
            <Input
              label="Notes / Metadata"
              placeholder="e.g. Includes work email and cellphone"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Associate Data Categories (Calculates Dynamic Risk Score)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-navy-850 rounded-xl border border-navy-750">
              {categories.map((cat) => {
                const isSelected = selectedCategoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors border ${
                      isSelected
                        ? 'bg-electric-600/30 border-electric-500 text-white'
                        : 'bg-navy-900 border-navy-750 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="text-[10px] text-electric-400 font-mono ml-1">
                      +{cat.riskWeight}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-navy-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
              Create Exposure Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Exposure Deletion"
        description="Are you sure you want to delete this personal exposure entry?"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Deleting this exposure record will also cascade to remove any attached data categories
            and removal requests associated specifically with this record.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-navy-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDelete}
              isLoading={submitting}
            >
              Delete Exposure
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
