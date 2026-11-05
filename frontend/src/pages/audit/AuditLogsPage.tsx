import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollText,
  Download,
  Filter,
  Shield,
  FileCheck,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { auditApi } from '../../api/audit.api';
import { AuditLog, AuditSummary, PaginationMeta } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { useToast } from '../../context/ToastContext';

const ACTION_LABELS: Record<string, string> = {
  AUTH_REGISTER: 'Account Created',
  AUTH_LOGIN: 'Signed In',
  AUTH_LOGIN_SUCCESS: 'Signed In',
  AUTH_LOGOUT: 'Signed Out',
  WEBSITE_CREATED: 'Website Added',
  WEBSITE_UPDATED: 'Website Updated',
  WEBSITE_DELETED: 'Website Removed',
  EXPOSURE_CREATED: 'Exposure Added',
  EXPOSURE_UPDATED: 'Exposure Updated',
  EXPOSURE_DELETED: 'Exposure Removed',
  REMOVAL_REQUEST_CREATED: 'Removal Request Created',
  REMOVAL_STATUS_UPDATED: 'Removal Status Updated',
  REMINDER_CREATED: 'Reminder Set',
  NOTIFICATION_READ: 'Notification Viewed',
};

const ACTION_OPTIONS = [
  { value: '', label: 'All Activities' },
  { value: 'AUTH_REGISTER', label: 'Account Created' },
  { value: 'AUTH_LOGIN_SUCCESS', label: 'Signed In' },
  { value: 'AUTH_LOGOUT', label: 'Signed Out' },
  { value: 'WEBSITE_CREATED', label: 'Website Added' },
  { value: 'WEBSITE_UPDATED', label: 'Website Updated' },
  { value: 'WEBSITE_DELETED', label: 'Website Removed' },
  { value: 'EXPOSURE_CREATED', label: 'Exposure Added' },
  { value: 'EXPOSURE_UPDATED', label: 'Exposure Updated' },
  { value: 'EXPOSURE_DELETED', label: 'Exposure Removed' },
  { value: 'REMOVAL_REQUEST_CREATED', label: 'Removal Request Created' },
  { value: 'REMOVAL_STATUS_UPDATED', label: 'Removal Status Updated' },
  { value: 'REMINDER_CREATED', label: 'Reminder Set' },
  { value: 'NOTIFICATION_READ', label: 'Notification Viewed' },
];

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All Entities' },
  { value: 'User', label: 'User' },
  { value: 'Website', label: 'Website' },
  { value: 'ExposureRecord', label: 'ExposureRecord' },
  { value: 'RemovalRequest', label: 'RemovalRequest' },
  { value: 'Reminder', label: 'Reminder' },
  { value: 'Notification', label: 'Notification' },
];

export const AuditLogsPage: React.FC = () => {
  const { showToast } = useToast();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [exporting, setExporting] = useState<boolean>(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsRes, sumRes] = await Promise.all([
        auditApi.list({
          page: currentPage,
          limit: 15,
          action: selectedAction || undefined,
          entityType: selectedEntity || undefined,
        }),
        auditApi.getSummary(),
      ]);

      setLogs(logsRes.data || []);
      if (logsRes.meta) setMeta(logsRes.meta);
      setSummary(sumRes.data);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedAction, selectedEntity]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await auditApi.exportLogs();
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `oblivion_gdpr_export_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showToast('GDPR Article 15 compliance export generated successfully', 'success');
    } catch (err: any) {
      showToast('Failed to export compliance logs', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Activity History
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review important actions performed in your privacy account, including website additions, exposure records, removal requests, and account activity.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          isLoading={exporting}
          leftIcon={<Download className="w-4 h-4" />}
        >
          Export GDPR / CCPA Report
        </Button>
      </div>

      {/* Activity History Scope Notice */}
      <div className="p-3.5 rounded-xl bg-navy-900 border border-navy-750 text-xs text-slate-300 flex items-start gap-3">
        <Shield className="w-4 h-4 text-electric-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-slate-100">Activity History Scope: </span>
          Chronological record of privacy operations, authentication events, and erasure request milestones performed in your account.
          Supports GDPR Article 15 (Right of Access) data portability and compliance reporting.
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          options={ACTION_OPTIONS}
          value={selectedAction}
          onChange={(e) => {
            setSelectedAction(e.target.value);
            setCurrentPage(1);
          }}
        />

        <Select
          options={ENTITY_TYPE_OPTIONS}
          value={selectedEntity}
          onChange={(e) => {
            setSelectedEntity(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchLogs} />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No Activity Records Found"
          description="Security and operational actions will appear here automatically as you interact with the platform."
        />
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const displayTitle = ACTION_LABELS[log.action] || log.action;

            return (
              <Card
                key={log.id}
                className="bg-navy-900 border-navy-750 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-navy-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-navy-800 text-electric-400 border border-navy-750 shrink-0">
                    <ScrollText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-100">
                        {displayTitle}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-navy-800 px-1.5 py-0.5 rounded border border-navy-750">
                        {log.action}
                      </span>
                      <Badge variant="primary" size="sm">
                        {log.entityType}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Target UUID: {log.entityId}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-1.5 self-end sm:self-center">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
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
    </div>
  );
};
