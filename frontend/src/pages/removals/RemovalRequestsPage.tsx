import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trash2,
  Plus,
  Clock,
  CheckCircle2,
  History,
  AlertCircle,
  FileText,
  Globe,
  Tag,
  ChevronRight,
  RotateCw,
} from 'lucide-react';
import { removalRequestApi } from '../../api/removal.api';
import { websiteApi } from '../../api/website.api';
import { exposureApi } from '../../api/exposure.api';
import {
  RemovalRequest,
  RequestHistory,
  Website,
  ExposureRecord,
  RemovalRequestType,
  RequestStatus,
  PaginationMeta,
} from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { StatusBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { useToast } from '../../context/ToastContext';

const REMOVAL_TYPE_OPTIONS: { value: RemovalRequestType; label: string }[] = [
  { value: 'GDPR_ERASURE', label: 'GDPR Article 17 (Right to be Forgotten)' },
  { value: 'CCPA_DELETION', label: 'CCPA Section 1798.105 Deletion Request' },
  { value: 'DATA_ERASURE_GENERAL', label: 'General Privacy Erasure' },
  { value: 'ACCOUNT_CLOSURE', label: 'Full Account Deletion' },
  { value: 'MARKETING_OPT_OUT', label: 'Data Broker Opt-Out' },
  { value: 'CUSTOM', label: 'Custom Written Legal Request' },
];

const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ['SUBMITTED', 'REJECTED'],
  SUBMITTED: ['ACKNOWLEDGED', 'IN_PROGRESS', 'REJECTED'],
  ACKNOWLEDGED: ['IN_PROGRESS', 'FOLLOW_UP_REQUIRED', 'COMPLETED', 'REJECTED'],
  IN_PROGRESS: ['FOLLOW_UP_REQUIRED', 'COMPLETED', 'REJECTED'],
  FOLLOW_UP_REQUIRED: ['IN_PROGRESS', 'COMPLETED', 'REJECTED'],
  COMPLETED: [],
  REJECTED: ['APPEALED'],
  APPEALED: ['IN_PROGRESS', 'COMPLETED', 'REJECTED'],
};

export const RemovalRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [requests, setRequests] = useState<RemovalRequest[]>([]);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [exposures, setExposures] = useState<ExposureRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingDependencies, setLoadingDependencies] = useState<boolean>(false);
  const [dependencyError, setDependencyError] = useState<string | null>(null);

  // Filter
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<RemovalRequest | null>(null);
  const [historyList, setHistoryList] = useState<RequestHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Form states
  const [websiteId, setWebsiteId] = useState<string>('');
  const [exposedDataDescription, setExposedDataDescription] = useState<string>('');
  const [requestType, setRequestType] = useState<RemovalRequestType>('GDPR_ERASURE');
  const [requestReason, setRequestReason] = useState<string>('');
  const [externalReference, setExternalReference] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Transition form
  const [nextStatus, setNextStatus] = useState<RequestStatus>('SUBMITTED');
  const [transitionRemarks, setTransitionRemarks] = useState<string>('');

  const fetchDependencies = useCallback(async () => {
    setLoadingDependencies(true);
    setDependencyError(null);
    try {
      const webRes = await websiteApi.list({ limit: 100 });
      setWebsites(webRes.data || []);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load tracked websites.';
      setDependencyError(msg);
    } finally {
      setLoadingDependencies(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, webRes] = await Promise.all([
        removalRequestApi.list({
          page: currentPage,
          limit: 10,
          requestStatus: selectedStatus || undefined,
        }),
        websiteApi.list({ limit: 100 }),
      ]);

      setRequests(reqRes.data || []);
      if (reqRes.meta) setMeta(reqRes.meta);
      setWebsites(webRes.data || []);
    } catch (err: any) {
      console.error('Failed to load removal requests:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch removal requests.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!websiteId || !exposedDataDescription.trim() || !requestReason.trim()) {
      setFormError('Please select a target website, describe the exposed personal information, and specify the statutory basis.');
      return;
    }

    setSubmitting(true);
    try {
      await removalRequestApi.create({
        websiteId,
        exposedDataDescription: exposedDataDescription.trim(),
        requestType,
        requestReason: requestReason.trim(),
        externalReference: externalReference.trim() || undefined,
      });

      showToast('Removal request created with auto-generated tracking token', 'success');
      setIsAddModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create removal request.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setFormError(null);

    setSubmitting(true);
    try {
      await removalRequestApi.updateStatus(selectedRequest.id, {
        requestStatus: nextStatus,
        remarks: transitionRemarks || undefined,
      });

      showToast(`Request transitioned to ${nextStatus.replace('_', ' ')}`, 'success');
      setIsTransitionModalOpen(false);
      setSelectedRequest(null);
      fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Status transition rejected.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const openHistoryModal = async (req: RemovalRequest) => {
    setSelectedRequest(req);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await removalRequestApi.getHistory(req.id);
      setHistoryList(res.data || []);
    } catch {
      showToast('Failed to load request history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const openTransitionModal = (req: RemovalRequest) => {
    setSelectedRequest(req);
    const allowed = VALID_TRANSITIONS[req.requestStatus] || [];
    setNextStatus(allowed[0] || 'COMPLETED');
    setTransitionRemarks('');
    setFormError(null);
    setIsTransitionModalOpen(true);
  };

  const resetForm = () => {
    setWebsiteId('');
    setExposedDataDescription('');
    setRequestType('GDPR_ERASURE');
    setRequestReason('');
    setExternalReference('');
    setFormError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Removal Requests & Erasure Tracking
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Orchestrate GDPR Article 17 Right to be Forgotten and CCPA personal data deletion requests.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            resetForm();
            setIsAddModalOpen(true);
            if (websites.length === 0 || exposures.length === 0) {
              fetchDependencies();
            }
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Removal Request
        </Button>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-3">
        <div className="w-full sm:w-64">
          <Select
            options={[
              { value: '', label: 'All Request Statuses' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'SUBMITTED', label: 'Submitted' },
              { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
              { value: 'FOLLOW_UP_REQUIRED', label: 'Follow Up Required' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'REJECTED', label: 'Rejected' },
              { value: 'APPEALED', label: 'Appealed' },
            ]}
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : requests.length === 0 ? (
        <EmptyState
          title="No Removal Requests Logged"
          description="Initiate formal erasure requests against websites holding your cataloged personal exposures."
          actionText={exposures.length > 0 ? 'Create Removal Request' : undefined}
          onAction={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
        />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const allowedTransitions = VALID_TRANSITIONS[req.requestStatus] || [];
            const isTerminal = allowedTransitions.length === 0;

            return (
              <Card
                key={req.id}
                className="bg-navy-900 border-navy-750 p-5 hover:border-navy-700 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <StatusBadge status={req.requestStatus} />
                      <span className="text-xs font-mono text-electric-400 bg-electric-950/80 px-2 py-0.5 rounded border border-electric-500/20">
                        {req.trackingToken}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Type: {req.requestType.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-100">{req.requestReason}</h3>

                    {/* Exposed Personal Information Description */}
                    {(req.exposureRecord?.notes || req.exposureRecord?.purpose) && (
                      <div className="p-3 rounded-xl bg-navy-850/80 border border-navy-750 text-xs text-slate-200">
                        <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
                          Exposed Personal Information:
                        </span>
                        {req.exposureRecord.notes || req.exposureRecord.purpose}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <Globe className="w-3.5 h-3.5 text-electric-400" />
                        Target: {req.website?.websiteName || 'Unknown Platform'}
                      </span>
                      {req.externalReference && (
                        <span className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5" />
                          Ref: {req.externalReference}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Created: {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions & Status Machine */}
                  <div className="flex items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-navy-800 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openHistoryModal(req)}
                      leftIcon={<History className="w-3.5 h-3.5" />}
                    >
                      History
                    </Button>

                    {!isTerminal && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openTransitionModal(req)}
                        rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                      >
                        Advance Status
                      </Button>
                    )}

                    {isTerminal && (
                      <span className="text-xs font-medium text-emerald-400 flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Erased
                      </span>
                    )}
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

      {/* Add Request Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Initiate Formal Removal Request"
        description="Submit and track a statutory erasure request for cataloged personal information."
        maxWidth="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs">
              {formError}
            </div>
          )}

          {dependencyError && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-3">
              <span>{dependencyError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchDependencies}
                leftIcon={<RotateCw className="w-3.5 h-3.5" />}
              >
                Retry
              </Button>
            </div>
          )}

          {loadingDependencies ? (
            <div className="py-6 text-center text-xs text-slate-400">
              <RotateCw className="w-5 h-5 text-electric-400 animate-spin mx-auto mb-2" />
              Loading your tracked websites...
            </div>
          ) : websites.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-100">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                No tracked websites found. Please add a website first.
              </div>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                Before initiating a formal erasure request, you must add the target website to your account.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setIsAddModalOpen(false);
                  navigate('/app/websites');
                }}
              >
                Go to Websites Page
              </Button>
            </div>
          ) : (
            <>
              <Select
                label="Target Website *"
                options={[
                  { value: '', label: '-- Select Tracked Website --' },
                  ...websites.map((w) => ({ value: w.id, label: w.websiteName })),
                ]}
                value={websiteId}
                onChange={(e) => setWebsiteId(e.target.value)}
                required
              />

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Describe the Exposed Personal Information *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Example: My phone number is publicly visible on Instagram."
                  value={exposedDataDescription}
                  onChange={(e) => setExposedDataDescription(e.target.value)}
                  className="w-full rounded-xl bg-navy-950 border border-navy-750 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-electric-500 focus:border-transparent transition-all resize-y"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Describe the exposed personal data in your own words so the service can identify and expunge it.
                </p>
              </div>
            </>
          )}

          <Select
            label="Regulatory Erasure Framework *"
            options={REMOVAL_TYPE_OPTIONS}
            value={requestType}
            onChange={(e) => setRequestType(e.target.value as RemovalRequestType)}
            required
          />

          <Input
            label="Statutory Basis / Request Reason *"
            placeholder="e.g. Exercise of Right to Erasure under GDPR Article 17"
            value={requestReason}
            onChange={(e) => setRequestReason(e.target.value)}
            required
          />

          <Input
            label="External Ticket or Case Reference (Optional)"
            placeholder="e.g. TICKET-99214, Support Case #102"
            value={externalReference}
            onChange={(e) => setExternalReference(e.target.value)}
          />

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
              Initiate Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Advance Status Modal */}
      <Modal
        isOpen={isTransitionModalOpen}
        onClose={() => setIsTransitionModalOpen(false)}
        title="Advance Request Status"
        description="Update the lifecycle state of this privacy removal request."
      >
        <form onSubmit={handleStatusTransition} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs">
              {formError}
            </div>
          )}

          <div className="text-xs text-slate-400">
            Current Status:{' '}
            <span className="font-semibold text-slate-200">
              {selectedRequest?.requestStatus.replace('_', ' ')}
            </span>
          </div>

          <Select
            label="Target Status *"
            options={(selectedRequest ? VALID_TRANSITIONS[selectedRequest.requestStatus] : []).map(
              (s) => ({ value: s, label: s.replace(/_/g, ' ') })
            )}
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as RequestStatus)}
            required
          />

          <Input
            label="Operational Remarks (Recorded to Immutable History)"
            placeholder="e.g. Received acknowledgment confirmation from data protection officer"
            value={transitionRemarks}
            onChange={(e) => setTransitionRemarks(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-navy-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTransitionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
              Apply Status Transition
            </Button>
          </div>
        </form>
      </Modal>

      {/* Request History Modal */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Removal Request Transition History"
        description={`Immutable audit trail for tracking token ${selectedRequest?.trackingToken || ''}`}
        maxWidth="md"
      >
        <div className="py-2">
          {loadingHistory ? (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : historyList.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">
              No previous state transitions recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {historyList.map((h, idx) => (
                <div
                  key={h.id}
                  className="p-3 rounded-xl bg-navy-850 border border-navy-750 flex items-start gap-3"
                >
                  <div className="p-1 rounded-md bg-electric-600/20 text-electric-400 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{h.fromStatus}</span>
                      <span className="text-slate-500">➔</span>
                      <span className="font-semibold text-electric-400">{h.toStatus}</span>
                    </div>
                    {h.remarks && <p className="text-[11px] text-slate-400 mt-1">"{h.remarks}"</p>}
                    <div className="text-[10px] text-slate-500 mt-1">
                      {new Date(h.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
