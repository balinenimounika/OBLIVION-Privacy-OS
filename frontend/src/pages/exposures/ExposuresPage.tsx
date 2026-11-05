import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  Plus,
  Trash2,
  Calendar,
  Globe,
  Tag,
  AlertTriangle,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  ExternalLink,
  Edit3,
  FileText,
  Activity,
  Check,
  ShieldCheck,
  Sparkles,
  Info,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { exposureApi } from '../../api/exposure.api';
import { websiteApi } from '../../api/website.api';
import { categoryApi } from '../../api/category.api';
import {
  ExposureRecord,
  Website,
  DataCategory,
  SensitivityLevel,
  RecordStatus,
  ExposureSource,
  ExposureVisibility,
  DataSharingStatus,
  RemediationStatus,
  RemovalRequestType,
  ExposureSummaryResponse,
  PaginationMeta,
} from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import {
  SensitivityBadge,
  StatusBadge,
  VisibilityBadge,
  RemediationBadge,
} from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { useToast } from '../../context/ToastContext';

const SENSITIVITY_OPTIONS = [
  { value: 'LOW', label: 'LOW (1.0x Multiplier)' },
  { value: 'MEDIUM', label: 'MEDIUM (1.3x Multiplier)' },
  { value: 'HIGH', label: 'HIGH (1.7x Multiplier)' },
  { value: 'CRITICAL', label: 'CRITICAL (2.2x Multiplier)' },
];

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Private (Internal, 1.0x)' },
  { value: 'UNKNOWN', label: 'Unknown (Default, 1.1x)' },
  { value: 'RESTRICTED', label: 'Restricted (Logged-in Users, 1.2x)' },
  { value: 'PUBLIC', label: 'Public (Indexed / Searchable, 1.5x)' },
];

const EXPOSURE_SOURCE_OPTIONS = [
  { value: 'ACCOUNT_REGISTRATION', label: 'Account Registration' },
  { value: 'JOB_APPLICATION', label: 'Job Application' },
  { value: 'SOCIAL_MEDIA', label: 'Social Media' },
  { value: 'PUBLIC_WEBSITE', label: 'Public Website' },
  { value: 'ONLINE_PURCHASE', label: 'Online Purchase' },
  { value: 'OTHER', label: 'Other' },
];

const SHARING_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active (Currently Retained)' },
  { value: 'NO_LONGER_SHARED', label: 'No Longer Shared' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

const REMEDIATION_STATUS_OPTIONS = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PROGRESS', label: 'In Progress (Active Removal)' },
  { value: 'RESOLVED', label: 'Resolved (Verified Purged)' },
];

const RECORD_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active Exposure' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'REMOVAL_REQUESTED', label: 'Removal Requested' },
  { value: 'REMOVED', label: 'Removed / Erased' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const REMOVAL_REQUEST_TYPES: { value: RemovalRequestType; label: string }[] = [
  { value: 'GDPR_ERASURE', label: 'GDPR Article 17 (Right to be Forgotten)' },
  { value: 'CCPA_DELETION', label: 'CCPA / CPRA Request to Delete' },
  { value: 'ACCOUNT_CLOSURE', label: 'Full Account Closure & Data Purge' },
  { value: 'MARKETING_OPT_OUT', label: 'Data Broker / Marketing Opt-Out' },
  { value: 'DATA_ERASURE_GENERAL', label: 'General Privacy Erasure Request' },
];

/**
 * Authoritative client-side risk simulation mirroring backend formula
 */
function computeClientRisk(
  categoryWeights: number[],
  sensitivity: SensitivityLevel,
  visibility: ExposureVisibility,
  sharing: DataSharingStatus,
  remediation: RemediationStatus
) {
  const count = categoryWeights.length;
  const baseWeight = count > 0 ? categoryWeights.reduce((a, b) => a + b, 0) : 5;
  const volumeFactor = count > 1 ? 1 + Math.min(0.3, (count - 1) * 0.05) : 1.0;

  const sensMultiplier =
    sensitivity === 'CRITICAL' ? 2.2 : sensitivity === 'HIGH' ? 1.7 : sensitivity === 'MEDIUM' ? 1.3 : 1.0;
  const visMultiplier =
    visibility === 'PUBLIC' ? 1.5 : visibility === 'RESTRICTED' ? 1.2 : visibility === 'PRIVATE' ? 1.0 : 1.1;
  const sharingMultiplier = sharing === 'NO_LONGER_SHARED' ? 0.75 : sharing === 'UNKNOWN' ? 0.95 : 1.0;
  const remedMultiplier = remediation === 'RESOLVED' ? 0.2 : remediation === 'IN_PROGRESS' ? 0.75 : 1.0;

  const raw = baseWeight * volumeFactor * (sensMultiplier / 1.5) * visMultiplier * sharingMultiplier * remedMultiplier;
  const score = Math.max(0, Math.min(100, Math.round((raw / 60) * 100)));

  let rating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (score > 70) rating = 'CRITICAL';
  else if (score > 40) rating = 'HIGH';
  else if (score > 20) rating = 'MEDIUM';

  return { score, rating, baseWeight, volumeFactor, sensMultiplier, visMultiplier };
}

export const ExposuresPage: React.FC = () => {
  const { showToast } = useToast();

  const [exposures, setExposures] = useState<ExposureRecord[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [categories, setCategories] = useState<DataCategory[]>([]);
  const [summary, setSummary] = useState<ExposureSummaryResponse | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>('');
  const [selectedSensitivity, setSelectedSensitivity] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedVisibility, setSelectedVisibility] = useState<string>('');
  const [selectedRemediation, setSelectedRemediation] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isRemovalModalOpen, setIsRemovalModalOpen] = useState<boolean>(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState<boolean>(false);
  const [selectedExposure, setSelectedExposure] = useState<ExposureRecord | null>(null);

  // Form states (Create & Edit)
  const [websiteId, setWebsiteId] = useState<string>('');
  const [platformUrl, setPlatformUrl] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [dataDescription, setDataDescription] = useState<string>('');
  const [sensitivityLevel, setSensitivityLevel] = useState<SensitivityLevel>('MEDIUM');
  const [exposureSource, setExposureSource] = useState<ExposureSource>('OTHER');
  const [visibility, setVisibility] = useState<ExposureVisibility>('UNKNOWN');
  const [sharingStatus, setSharingStatus] = useState<DataSharingStatus>('ACTIVE');
  const [dateShared, setDateShared] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lastVerifiedDate, setLastVerifiedDate] = useState<string>('');
  const [remediationStatus, setRemediationStatus] = useState<RemediationStatus>('NOT_STARTED');
  const [evidenceAttachment, setEvidenceAttachment] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Removal Request Form
  const [removalType, setRemovalType] = useState<RemovalRequestType>('GDPR_ERASURE');
  const [removalReason, setRemovalReason] = useState<string>('');
  const [removalReference, setRemovalReference] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, webRes, catRes, sumRes] = await Promise.all([
        exposureApi.list({
          page: currentPage,
          limit: 10,
          websiteId: selectedWebsiteId || undefined,
          sensitivityLevel: selectedSensitivity || undefined,
          recordStatus: selectedStatus || undefined,
          visibility: selectedVisibility || undefined,
          remediationStatus: selectedRemediation || undefined,
          search: searchTerm || undefined,
          sortBy,
          sortOrder,
        }),
        websiteApi.list({ limit: 100 }),
        categoryApi.list(),
        exposureApi.getSummary().catch(() => null),
      ]);

      setExposures(expRes.data || []);
      if (expRes.meta) setMeta(expRes.meta);
      setWebsites(webRes.data || []);
      setCategories(catRes.data || []);
      if (sumRes?.data) setSummary(sumRes.data);
    } catch (err: any) {
      console.error('Failed to load exposures:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch exposure records.');
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    selectedWebsiteId,
    selectedSensitivity,
    selectedStatus,
    selectedVisibility,
    selectedRemediation,
    searchTerm,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live client-side risk preview calculation
  const liveRiskPreview = useMemo(() => {
    const selectedWeights = categories
      .filter((c) => selectedCategoryIds.includes(c.id))
      .map((c) => c.riskWeight);
    return computeClientRisk(selectedWeights, sensitivityLevel, visibility, sharingStatus, remediationStatus);
  }, [categories, selectedCategoryIds, sensitivityLevel, visibility, sharingStatus, remediationStatus]);

  const resetForm = (initialWebsite?: Website) => {
    const defaultSite = initialWebsite || websites[0];
    setWebsiteId(defaultSite?.id || '');
    setPlatformUrl(defaultSite?.websiteUrl || '');
    setPurpose('');
    setDataDescription('');
    setSensitivityLevel('MEDIUM');
    setExposureSource('OTHER');
    setVisibility('UNKNOWN');
    setSharingStatus('ACTIVE');
    setDateShared(new Date().toISOString().split('T')[0]);
    setLastVerifiedDate('');
    setRemediationStatus('NOT_STARTED');
    setEvidenceAttachment('');
    setNotes('');
    setSelectedCategoryIds([]);
    setFormError(null);
  };

  const openEditModal = (exp: ExposureRecord) => {
    setSelectedExposure(exp);
    setWebsiteId(exp.websiteId);
    setPlatformUrl(exp.platformUrl || exp.website?.websiteUrl || '');
    setPurpose(exp.purpose);
    setDataDescription(exp.dataDescription || '');
    setSensitivityLevel(exp.sensitivityLevel);
    setExposureSource(exp.exposureSource || 'OTHER');
    setVisibility(exp.visibility || 'UNKNOWN');
    setSharingStatus(exp.sharingStatus || 'ACTIVE');
    setDateShared(exp.dateShared ? exp.dateShared.split('T')[0] : new Date().toISOString().split('T')[0]);
    setLastVerifiedDate(exp.lastVerifiedDate ? exp.lastVerifiedDate.split('T')[0] : '');
    setRemediationStatus(exp.remediationStatus || 'NOT_STARTED');
    setEvidenceAttachment(exp.evidenceAttachment || '');
    setNotes(exp.notes || '');
    setSelectedCategoryIds(exp.categories ? exp.categories.map((c) => c.dataCategory.id) : []);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const openDetailsModal = async (exp: ExposureRecord) => {
    setSelectedExposure(exp);
    setIsDetailsModalOpen(true);
    // Fetch full exposure details including audit logs and removals
    try {
      const res = await exposureApi.getById(exp.id);
      if (res.data) setSelectedExposure(res.data);
    } catch (e) {
      console.error('Failed to load full exposure details', e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!websiteId || !purpose) {
      setFormError('Please select a target platform and specify the exposure purpose.');
      return;
    }

    setSubmitting(true);
    try {
      await exposureApi.create({
        websiteId,
        purpose,
        sensitivityLevel,
        dateShared: new Date(dateShared).toISOString(),
        platformUrl: platformUrl || undefined,
        dataDescription: dataDescription || undefined,
        exposureSource,
        visibility,
        sharingStatus,
        lastVerifiedDate: lastVerifiedDate ? new Date(lastVerifiedDate).toISOString() : undefined,
        remediationStatus,
        evidenceAttachment: evidenceAttachment || undefined,
        notes: notes || undefined,
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
      });

      showToast('Personal exposure record cataloged with dynamic risk calculation', 'success');
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExposure) return;
    setFormError(null);

    setSubmitting(true);
    try {
      await exposureApi.update(selectedExposure.id, {
        websiteId,
        purpose,
        sensitivityLevel,
        dateShared: new Date(dateShared).toISOString(),
        platformUrl: platformUrl || undefined,
        dataDescription: dataDescription || undefined,
        exposureSource,
        visibility,
        sharingStatus,
        lastVerifiedDate: lastVerifiedDate ? new Date(lastVerifiedDate).toISOString() : null,
        remediationStatus,
        evidenceAttachment: evidenceAttachment || null,
        notes: notes || null,
        categoryIds: selectedCategoryIds,
      });

      showToast('Exposure record and risk assessment updated', 'success');
      setIsEditModalOpen(false);
      setSelectedExposure(null);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update exposure.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkResolved = async () => {
    if (!selectedExposure) return;
    setSubmitting(true);
    try {
      await exposureApi.markAsResolved(selectedExposure.id);
      showToast('Exposure marked as resolved. Risk score updated with remediation discount.', 'success');
      setIsResolveModalOpen(false);
      setIsDetailsModalOpen(false);
      setSelectedExposure(null);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to mark exposure as resolved.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRemovalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExposure) return;
    if (!removalReason || removalReason.trim().length < 5) {
      showToast('Please provide a descriptive reason for data removal (minimum 5 characters).', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await exposureApi.createRemovalRequest(selectedExposure.id, {
        requestType: removalType,
        requestReason: removalReason,
        externalReference: removalReference || undefined,
      });

      showToast('Removal request successfully initiated and linked to exposure record', 'success');
      setIsRemovalModalOpen(false);
      setRemovalReason('');
      setRemovalReference('');
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to initiate removal request.';
      showToast(msg, 'error');
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
      setIsDetailsModalOpen(false);
      setSelectedExposure(null);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete exposure.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleWebsiteChange = (newWebId: string) => {
    setWebsiteId(newWebId);
    const site = websites.find((w) => w.id === newWebId);
    if (site && (!platformUrl || websites.some((w) => w.websiteUrl === platformUrl))) {
      setPlatformUrl(site.websiteUrl);
    }
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
            Privacy exposure management with automated normalized risk scoring (0–100), remediation tracking, and direct removal requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
      </div>

      {/* Website Required Warning Banner */}
      {websites.length === 0 && !loading && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>You must register at least one target website/platform before logging personal exposures.</span>
          </div>
          <Link to="/app/websites" className="text-xs font-semibold text-amber-300 underline hover:text-white">
            Register Platform &rarr;
          </Link>
        </div>
      )}

      {/* Summary KPI Metric Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-navy-900 border-navy-750 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Total Exposures</span>
              <Globe className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">{summary.totalExposures}</div>
            <div className="text-[11px] text-slate-400 mt-1">Tracked data points</div>
          </Card>

          <Card className="bg-navy-900 border-navy-750 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Active Exposures</span>
              <Clock className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-cyan-300">{summary.activeExposures}</div>
            <div className="text-[11px] text-slate-400 mt-1">Requiring surveillance</div>
          </Card>

          <Card className="bg-navy-900 border-navy-750 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Critical Exposures</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-400">{summary.criticalExposures}</div>
            <div className="text-[11px] text-slate-400 mt-1">Risk score &gt; 70 / 100</div>
          </Card>

          <Card className="bg-navy-900 border-navy-750 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Resolved</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">{summary.resolvedExposures}</div>
            <div className="text-[11px] text-slate-400 mt-1">Purged &amp; verified</div>
          </Card>
        </div>
      )}

      {/* Risk Distribution & Platform Aggregation Visual Bar */}
      {summary && summary.totalExposures > 0 && (
        <Card className="bg-navy-900 border-navy-750 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-electric-400" />
              Dynamic Risk Distribution &amp; Platform Vulnerability
            </span>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-emerald-400">LOW: {summary.riskDistribution.low}</span>
              <span className="text-cyan-400">MED: {summary.riskDistribution.medium}</span>
              <span className="text-amber-400">HIGH: {summary.riskDistribution.high}</span>
              <span className="text-rose-400 font-bold">CRIT: {summary.riskDistribution.critical}</span>
            </div>
          </div>

          {/* Segmented Distribution Bar */}
          <div className="h-2 w-full bg-navy-800 rounded-full overflow-hidden flex">
            {summary.riskDistribution.low > 0 && (
              <div
                style={{ width: `${(summary.riskDistribution.low / summary.totalExposures) * 100}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`LOW Risk: ${summary.riskDistribution.low}`}
              />
            )}
            {summary.riskDistribution.medium > 0 && (
              <div
                style={{ width: `${(summary.riskDistribution.medium / summary.totalExposures) * 100}%` }}
                className="bg-cyan-500 transition-all duration-500"
                title={`MEDIUM Risk: ${summary.riskDistribution.medium}`}
              />
            )}
            {summary.riskDistribution.high > 0 && (
              <div
                style={{ width: `${(summary.riskDistribution.high / summary.totalExposures) * 100}%` }}
                className="bg-amber-500 transition-all duration-500"
                title={`HIGH Risk: ${summary.riskDistribution.high}`}
              />
            )}
            {summary.riskDistribution.critical > 0 && (
              <div
                style={{ width: `${(summary.riskDistribution.critical / summary.totalExposures) * 100}%` }}
                className="bg-rose-500 transition-all duration-500"
                title={`CRITICAL Risk: ${summary.riskDistribution.critical}`}
              />
            )}
          </div>
        </Card>
      )}

      {/* Filter, Search & Sorting Controls */}
      <Card className="bg-navy-900 border-navy-750 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            placeholder="Search purpose, notes, platform..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            leftIcon={<Search className="w-4 h-4" />}
          />

          <Select
            options={[
              { value: '', label: 'All Websites / Platforms' },
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
              { value: '', label: 'All Visibility Types' },
              { value: 'PRIVATE', label: 'Private (1.0x)' },
              { value: 'UNKNOWN', label: 'Unknown (1.1x)' },
              { value: 'RESTRICTED', label: 'Restricted (1.2x)' },
              { value: 'PUBLIC', label: 'Public (1.5x)' },
            ]}
            value={selectedVisibility}
            onChange={(e) => {
              setSelectedVisibility(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-navy-800">
          <Select
            options={[
              { value: '', label: 'All Remediation States' },
              { value: 'NOT_STARTED', label: 'Not Started' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
              { value: 'RESOLVED', label: 'Resolved' },
            ]}
            value={selectedRemediation}
            onChange={(e) => {
              setSelectedRemediation(e.target.value);
              setCurrentPage(1);
            }}
          />

          <Select
            options={[
              { value: '', label: 'All Record Statuses' },
              ...RECORD_STATUS_OPTIONS,
            ]}
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
          />

          <Select
            options={[
              { value: 'createdAt-desc', label: 'Newest First' },
              { value: 'riskScore-desc', label: 'Highest Risk (0–100) First' },
              { value: 'riskScore-asc', label: 'Lowest Risk First' },
              { value: 'sensitivityLevel-desc', label: 'Highest Sensitivity First' },
              { value: 'dateShared-desc', label: 'Date Shared First' },
            ]}
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split('-');
              setSortBy(sb);
              setSortOrder(so as 'asc' | 'desc');
              setCurrentPage(1);
            }}
          />
        </div>
      </Card>

      {/* Exposure Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
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
          {exposures.map((exp) => {
            const riskScore = exp.calculatedRiskScore ?? 0;
            const riskRating = exp.calculatedRiskRating || 'LOW';

            const scoreColor =
              riskScore > 70
                ? 'text-rose-400 border-rose-500/30 bg-rose-950/60'
                : riskScore > 40
                ? 'text-amber-400 border-amber-500/30 bg-amber-950/60'
                : riskScore > 20
                ? 'text-cyan-400 border-cyan-500/30 bg-cyan-950/60'
                : 'text-emerald-400 border-emerald-500/30 bg-emerald-950/60';

            return (
              <Card
                key={exp.id}
                className="bg-navy-900 border-navy-750 p-5 hover:border-navy-700 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Metadata & Descriptions */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SensitivityBadge level={exp.sensitivityLevel} />
                      <VisibilityBadge visibility={exp.visibility} />
                      <RemediationBadge status={exp.remediationStatus} />
                      <StatusBadge status={exp.recordStatus} />
                      <span className="text-xs font-mono text-slate-500">ID: {exp.id.slice(0, 8)}...</span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-100">{exp.purpose}</h3>

                    {exp.dataDescription && (
                      <p className="text-xs text-slate-300 font-mono bg-navy-850 px-2.5 py-1 rounded-md border border-navy-750 inline-block">
                        Data: {exp.dataDescription}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <Globe className="w-3.5 h-3.5 text-electric-400" />
                        {exp.website?.websiteName || 'Unknown Platform'}
                      </span>
                      {exp.platformUrl && (
                        <a
                          href={exp.platformUrl.startsWith('http') ? exp.platformUrl : `https://${exp.platformUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-electric-400 hover:text-electric-300 underline font-mono text-[11px]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Platform URL
                        </a>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Shared: {new Date(exp.dateShared).toLocaleDateString()}
                      </span>
                      {exp.lastVerifiedDate && (
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Verified: {new Date(exp.lastVerifiedDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Attached Categories */}
                    {exp.categories && exp.categories.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <Tag className="w-3 h-3 text-slate-500" />
                        {exp.categories.map((c) => (
                          <span
                            key={c.dataCategory.id}
                            className="px-2 py-0.5 rounded-md bg-navy-800 text-[10px] text-slate-300 border border-navy-750 font-mono"
                          >
                            {c.dataCategory.categoryName || c.dataCategory.name} (+{c.dataCategory.riskWeight})
                          </span>
                        ))}
                      </div>
                    )}

                    {exp.notes && <p className="text-xs text-slate-400 italic pt-1">"{exp.notes}"</p>}
                  </div>

                  {/* Right: Calculated Risk Score & Action Buttons */}
                  <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-center border-t lg:border-t-0 pt-3 lg:pt-0 border-navy-800 gap-3 shrink-0">
                    <div className="text-left lg:text-right">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        Dynamic Risk Score
                      </div>
                      <div className="flex items-baseline lg:justify-end gap-2 mt-0.5">
                        <span
                          className={`text-2xl font-bold font-mono px-2.5 py-0.5 rounded-lg border ${scoreColor}`}
                        >
                          {riskScore}
                          <span className="text-xs font-normal text-slate-400">/100</span>
                        </span>
                        <span className="text-[11px] font-semibold text-slate-300">({riskRating})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetailsModal(exp)}
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                        title="View Full Exposure Details & Breakdown"
                      >
                        Details
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedExposure(exp);
                          setRemovalType('GDPR_ERASURE');
                          setRemovalReason(`Request deletion of personal ${exp.purpose} data held on ${exp.website?.websiteName || 'platform'}`);
                          setRemovalReference('');
                          setIsRemovalModalOpen(true);
                        }}
                        leftIcon={<FileText className="w-3.5 h-3.5" />}
                        title="Initiate Data Removal Request"
                      >
                        Removal
                      </Button>

                      {exp.remediationStatus !== 'RESOLVED' && (
                        <button
                          onClick={() => {
                            setSelectedExposure(exp);
                            setIsResolveModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/20 transition-colors border border-navy-750 hover:border-emerald-500/30"
                          title="Mark Exposure as Resolved"
                        >
                          <Check className="w-4 h-4 text-emerald-400" />
                        </button>
                      )}

                      <button
                        onClick={() => openEditModal(exp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-navy-800 transition-colors border border-navy-750"
                        title="Edit Exposure Details"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedExposure(exp);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors border border-navy-750"
                        title="Delete Exposure Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

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
        description="Record sensitive personal details held by an external platform with real-time risk scoring."
        maxWidth="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs">
              {formError}
            </div>
          )}

          {/* Platform and URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Target Platform / Website *"
              options={websites.map((w) => ({ value: w.id, label: w.websiteName }))}
              value={websiteId}
              onChange={(e) => handleWebsiteChange(e.target.value)}
              required
            />
            <Input
              label="Platform URL (Optional)"
              placeholder="e.g. https://service.com/account/profile"
              value={platformUrl}
              onChange={(e) => setPlatformUrl(e.target.value)}
            />
          </div>

          {/* Purpose & Data Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Exposure Purpose / Context *"
              placeholder="e.g. Account profile registration, job application"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              required
            />
            <Input
              label="Data Description (Masked only)"
              placeholder="e.g. Work Email, Mobile (ends 4812), Billing Address"
              value={dataDescription}
              onChange={(e) => setDataDescription(e.target.value)}
            />
          </div>

          <div className="p-2.5 rounded-lg bg-navy-850 border border-navy-750 text-[11px] text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-electric-400 shrink-0" />
            <span>
              <strong>Zero-Knowledge Safety:</strong> Never enter actual raw passwords, API keys, full card numbers, or full government ID numbers. Use masked descriptions.
            </span>
          </div>

          {/* Sensitivity, Source, Visibility, Sharing Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select
              label="Sensitivity *"
              options={SENSITIVITY_OPTIONS}
              value={sensitivityLevel}
              onChange={(e) => setSensitivityLevel(e.target.value as SensitivityLevel)}
              required
            />
            <Select
              label="Exposure Source"
              options={EXPOSURE_SOURCE_OPTIONS}
              value={exposureSource}
              onChange={(e) => setExposureSource(e.target.value as ExposureSource)}
            />
            <Select
              label="Visibility"
              options={VISIBILITY_OPTIONS}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as ExposureVisibility)}
            />
            <Select
              label="Data Sharing Status"
              options={SHARING_STATUS_OPTIONS}
              value={sharingStatus}
              onChange={(e) => setSharingStatus(e.target.value as DataSharingStatus)}
            />
          </div>

          {/* Dates & Remediation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Date Shared / Discovered *"
              type="date"
              value={dateShared}
              onChange={(e) => setDateShared(e.target.value)}
              required
            />
            <Input
              label="Last Verified Date"
              type="date"
              value={lastVerifiedDate}
              onChange={(e) => setLastVerifiedDate(e.target.value)}
            />
            <Select
              label="Remediation Status"
              options={REMEDIATION_STATUS_OPTIONS}
              value={remediationStatus}
              onChange={(e) => setRemediationStatus(e.target.value as RemediationStatus)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Evidence Attachment URL / Reference"
              placeholder="e.g. https://vault/docs/proof-screenshot.png"
              value={evidenceAttachment}
              onChange={(e) => setEvidenceAttachment(e.target.value)}
            />
            <Input
              label="Notes / Metadata"
              placeholder="Optional notes or observations"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Associate Data Categories (Feeds Dynamic Risk Engine)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2.5 bg-navy-850 rounded-xl border border-navy-750">
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
                    <span className="truncate">{cat.categoryName || cat.name}</span>
                    <span className="text-[10px] text-electric-400 font-mono ml-1">+{cat.riskWeight}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Dynamic Risk Preview Box */}
          <div className="p-3.5 rounded-xl bg-navy-950 border border-electric-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-electric-400" />
              <div>
                <div className="text-xs font-semibold text-slate-200">Live Dynamic Risk Engine Preview</div>
                <div className="text-[11px] text-slate-400">
                  {selectedCategoryIds.length} categories &bull; {liveRiskPreview.sensMultiplier}x sensitivity &bull; {liveRiskPreview.visMultiplier}x visibility
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-xl font-bold text-electric-300">{liveRiskPreview.score}/100</span>
              <span className="text-xs px-2 py-0.5 rounded bg-navy-800 text-slate-300 border border-navy-700">
                {liveRiskPreview.rating}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-navy-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
              Catalog Exposure Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Exposure Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Exposure Record"
        description="Update exposure parameters, status, and category associations."
        maxWidth="lg"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
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
              onChange={(e) => handleWebsiteChange(e.target.value)}
              required
            />
            <Input
              label="Platform URL"
              value={platformUrl}
              onChange={(e) => setPlatformUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Exposure Purpose / Context *"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              required
            />
            <Input
              label="Data Description (Masked only)"
              value={dataDescription}
              onChange={(e) => setDataDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select
              label="Sensitivity *"
              options={SENSITIVITY_OPTIONS}
              value={sensitivityLevel}
              onChange={(e) => setSensitivityLevel(e.target.value as SensitivityLevel)}
              required
            />
            <Select
              label="Exposure Source"
              options={EXPOSURE_SOURCE_OPTIONS}
              value={exposureSource}
              onChange={(e) => setExposureSource(e.target.value as ExposureSource)}
            />
            <Select
              label="Visibility"
              options={VISIBILITY_OPTIONS}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as ExposureVisibility)}
            />
            <Select
              label="Sharing Status"
              options={SHARING_STATUS_OPTIONS}
              value={sharingStatus}
              onChange={(e) => setSharingStatus(e.target.value as DataSharingStatus)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Date Shared *"
              type="date"
              value={dateShared}
              onChange={(e) => setDateShared(e.target.value)}
              required
            />
            <Input
              label="Last Verified Date"
              type="date"
              value={lastVerifiedDate}
              onChange={(e) => setLastVerifiedDate(e.target.value)}
            />
            <Select
              label="Remediation Status"
              options={REMEDIATION_STATUS_OPTIONS}
              value={remediationStatus}
              onChange={(e) => setRemediationStatus(e.target.value as RemediationStatus)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Evidence Attachment URL / Reference"
              value={evidenceAttachment}
              onChange={(e) => setEvidenceAttachment(e.target.value)}
            />
            <Input
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Associate Data Categories
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2.5 bg-navy-850 rounded-xl border border-navy-750">
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
                    <span className="truncate">{cat.categoryName || cat.name}</span>
                    <span className="text-[10px] text-electric-400 font-mono ml-1">+{cat.riskWeight}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-navy-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detailed Exposure View Modal */}
      {selectedExposure && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title="Exposure Record Full Dossier"
          description={`ID: ${selectedExposure.id}`}
          maxWidth="lg"
        >
          <div className="space-y-5 text-xs text-slate-300">
            {/* Top Risk & Status Banner */}
            <div className="p-4 rounded-xl bg-navy-850 border border-navy-750 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <SensitivityBadge level={selectedExposure.sensitivityLevel} />
                  <VisibilityBadge visibility={selectedExposure.visibility} />
                  <RemediationBadge status={selectedExposure.remediationStatus} />
                  <StatusBadge status={selectedExposure.recordStatus} />
                </div>
                <h3 className="text-base font-bold text-white pt-1">{selectedExposure.purpose}</h3>
                <p className="text-slate-400 font-mono text-[11px]">
                  Platform: {selectedExposure.website?.websiteName} ({selectedExposure.platformUrl || selectedExposure.website?.websiteUrl})
                </p>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Normalized Risk Score</div>
                <div className="text-2xl font-bold font-mono text-electric-400 mt-0.5">
                  {selectedExposure.calculatedRiskScore ?? 0}
                  <span className="text-xs text-slate-400 font-normal"> / 100</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-navy-800 text-slate-300 font-semibold border border-navy-750">
                  {selectedExposure.calculatedRiskRating || 'LOW'}
                </span>
              </div>
            </div>

            {/* Dynamic Risk Breakdown Card */}
            {selectedExposure.riskBreakdown && (
              <div className="p-4 rounded-xl bg-navy-950 border border-electric-500/20 space-y-2.5">
                <div className="flex items-center gap-2 font-semibold text-slate-200">
                  <Activity className="w-4 h-4 text-electric-400" />
                  Dynamic Risk Breakdown &amp; Explanatory Factors
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-[11px]">
                  <div className="p-2 rounded bg-navy-900 border border-navy-800">
                    <span className="text-slate-400 block text-[10px]">Base Category</span>
                    <strong className="text-white">{selectedExposure.riskBreakdown.baseCategoryWeight}</strong>
                  </div>
                  <div className="p-2 rounded bg-navy-900 border border-navy-800">
                    <span className="text-slate-400 block text-[10px]">Sensitivity Multiplier</span>
                    <strong className="text-amber-400">{selectedExposure.riskBreakdown.platformSensitivityMultiplier}x</strong>
                  </div>
                  <div className="p-2 rounded bg-navy-900 border border-navy-800">
                    <span className="text-slate-400 block text-[10px]">Visibility Multiplier</span>
                    <strong className="text-cyan-400">{selectedExposure.riskBreakdown.visibilityMultiplier}x</strong>
                  </div>
                  <div className="p-2 rounded bg-navy-900 border border-navy-800">
                    <span className="text-slate-400 block text-[10px]">Remediation Multiplier</span>
                    <strong className="text-emerald-400">{selectedExposure.riskBreakdown.remediationMultiplier}x</strong>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Key Risk Factors:</span>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-300 text-[11px]">
                    {selectedExposure.riskBreakdown.keyFactors.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Description & Categories */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-navy-850 border border-navy-750 space-y-1.5">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Data Description (Masked)</span>
                <p className="text-slate-200 font-mono text-xs">{selectedExposure.dataDescription || 'Not specified'}</p>
                {selectedExposure.notes && (
                  <p className="text-slate-400 text-xs italic pt-1">Notes: "{selectedExposure.notes}"</p>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-navy-850 border border-navy-750 space-y-1.5">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Associated Data Categories</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedExposure.categories && selectedExposure.categories.length > 0 ? (
                    selectedExposure.categories.map((c) => (
                      <span
                        key={c.dataCategory.id}
                        className="px-2 py-0.5 rounded-md bg-navy-800 text-[11px] text-slate-300 border border-navy-750 font-mono"
                      >
                        {c.dataCategory.categoryName || c.dataCategory.name} (+{c.dataCategory.riskWeight})
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 italic">No categories attached</span>
                  )}
                </div>
              </div>
            </div>

            {/* Verification & Dates */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 text-xs font-mono p-3 bg-navy-850 rounded-xl border border-navy-750">
              <div>
                <span className="text-slate-500 text-[10px] block">Shared Date</span>
                {new Date(selectedExposure.dateShared).toLocaleDateString()}
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Last Verified</span>
                {selectedExposure.lastVerifiedDate ? new Date(selectedExposure.lastVerifiedDate).toLocaleDateString() : 'Never'}
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Created At</span>
                {new Date(selectedExposure.createdAt).toLocaleDateString()}
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Evidence</span>
                {selectedExposure.evidenceAttachment ? (
                  <a
                    href={selectedExposure.evidenceAttachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-electric-400 underline truncate block"
                  >
                    View Evidence
                  </a>
                ) : (
                  <span className="text-slate-500">None</span>
                )}
              </div>
            </div>

            {/* Associated Removal Requests */}
            <div className="p-3.5 rounded-xl bg-navy-850 border border-navy-750 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-electric-400" />
                  Associated Removal Requests
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setRemovalType('GDPR_ERASURE');
                    setRemovalReason(`Request deletion of personal ${selectedExposure.purpose} data held on ${selectedExposure.website?.websiteName}`);
                    setRemovalReference('');
                    setIsRemovalModalOpen(true);
                  }}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Create Removal Request
                </Button>
              </div>

              {selectedExposure.removalRequests && selectedExposure.removalRequests.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  {selectedExposure.removalRequests.map((rem: any) => (
                    <div
                      key={rem.id}
                      className="p-2.5 rounded-lg bg-navy-900 border border-navy-750 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-200">{rem.requestType}</span>
                        <span className="text-slate-500 ml-2 font-mono text-[11px]">ID: {rem.id.slice(0, 8)}...</span>
                      </div>
                      <StatusBadge status={rem.requestStatus} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-xs italic">
                  No removal requests currently linked. You can initiate a deletion request directly above.
                </p>
              )}
            </div>

            {/* Activity Timeline */}
            {selectedExposure.activityTimeline && selectedExposure.activityTimeline.length > 0 && (
              <div className="p-3.5 rounded-xl bg-navy-850 border border-navy-750 space-y-2">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Exposure Activity Audit Trail
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {selectedExposure.activityTimeline.map((item: any) => (
                    <div
                      key={item.id}
                      className="text-[11px] font-mono p-1.5 rounded bg-navy-900 border border-navy-800 flex items-center justify-between"
                    >
                      <span className="text-electric-400">{item.action}</span>
                      <span className="text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-navy-800">
              {selectedExposure.remediationStatus !== 'RESOLVED' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsResolveModalOpen(true)}
                  leftIcon={<Check className="w-3.5 h-3.5 text-emerald-400" />}
                >
                  Mark as Resolved
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  openEditModal(selectedExposure);
                }}
                leftIcon={<Edit3 className="w-3.5 h-3.5" />}
              >
                Edit Exposure
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete Exposure
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Direct Removal Request Modal */}
      <Modal
        isOpen={isRemovalModalOpen}
        onClose={() => setIsRemovalModalOpen(false)}
        title="Initiate Data Removal Request"
        description="Generate an erasure request tied directly to this exposure record."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateRemovalRequest} className="space-y-4">
          <Select
            label="Legal Request Type *"
            options={REMOVAL_REQUEST_TYPES}
            value={removalType}
            onChange={(e) => setRemovalType(e.target.value as RemovalRequestType)}
            required
          />

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Reason / Legal Justification *
            </label>
            <textarea
              rows={4}
              value={removalReason}
              onChange={(e) => setRemovalReason(e.target.value)}
              placeholder="State why this data should be removed (e.g. consent revoked, no longer active user)..."
              className="w-full rounded-xl bg-navy-900 border text-slate-100 placeholder-slate-500 text-xs p-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-electric-500 focus:border-electric-500 border-navy-700/80"
              required
            />
          </div>

          <Input
            label="External Reference / Ticket ID (Optional)"
            placeholder="e.g. CASE-10928, SUPPORT-771"
            value={removalReference}
            onChange={(e) => setRemovalReference(e.target.value)}
          />

          <div className="p-3 rounded-lg bg-navy-900 border border-navy-750 text-[11px] text-slate-400">
            <strong>Notice:</strong> Submitting this request logs the request in your Removal Requests ledger and associates it with this exposure. The exposure will remain under surveillance until explicitly resolved.
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-navy-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsRemovalModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
              Initiate Removal Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Mark Resolved Modal */}
      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        title="Confirm Exposure Resolution"
        description="Verify that the personal data has been confirmed removed or erased from the platform."
      >
        <div className="space-y-4 text-xs text-slate-300">
          <p>
            Marking this exposure as <strong>RESOLVED</strong> transitions the record status to <em>REMOVED</em> and applies an <strong>80% risk discount</strong> to the exposure's dynamic score, reflecting successful remediation.
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-navy-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsResolveModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleMarkResolved} isLoading={submitting}>
              Confirm Resolution
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Exposure Deletion"
        description="Are you sure you want to delete this personal exposure entry?"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <p>
            Deleting this exposure record will cascade to remove category associations and linked reminders. Historical audit records will be retained for tamper-evident compliance.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-navy-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={handleDelete} isLoading={submitting}>
              Delete Exposure
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
