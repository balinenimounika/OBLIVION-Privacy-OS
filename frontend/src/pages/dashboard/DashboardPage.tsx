import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe,
  ShieldAlert,
  Trash2,
  Activity,
  Plus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { dashboardApi } from '../../api/dashboard.api';
import {
  DashboardOverview,
  ExposureBreakdown,
  RemovalProgress,
} from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [breakdown, setBreakdown] = useState<ExposureBreakdown | null>(null);
  const [removals, setRemovals] = useState<RemovalProgress | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, bkRes, rmRes] = await Promise.all([
        dashboardApi.getOverview(),
        dashboardApi.getExposureBreakdown(),
        dashboardApi.getRemovalProgress(),
      ]);

      setOverview(ovRes.data);
      setBreakdown(bkRes.data);
      setRemovals(rmRes.data);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  const isBrandNewUser =
    (overview?.totalWebsites ?? 0) === 0 &&
    (overview?.totalExposures ?? 0) === 0 &&
    (overview?.activeRemovalRequests ?? 0) === 0 &&
    (overview?.completedRemovalRequests ?? 0) === 0;

  // Chart data formatting
  const categoryRaw: Record<string, number> =
    breakdown?.categoryDistribution ||
    (breakdown?.topCategories && Array.isArray(breakdown.topCategories)
      ? Object.fromEntries(breakdown.topCategories.map((c: { categoryName: string; count: number }) => [c.categoryName, c.count]))
      : {});

  const categoryChartData = Object.entries(categoryRaw)
    .filter(([_, count]) => count > 0)
    .map(([name, count]) => ({
      name: name.replace(/_/g, ' '),
      count,
    }));

  const SENSITIVITY_COLORS: Record<string, string> = {
    LOW: '#10B981',
    MEDIUM: '#06B6D4',
    HIGH: '#F59E0B',
    CRITICAL: '#F43F5E',
  };

  const sensitivityRaw: Record<string, number> =
    breakdown?.sensitivityDistribution || (breakdown as any)?.bySensitivity || {};

  const sensitivityChartData = Object.entries(sensitivityRaw)
    .filter(([_, count]) => count > 0)
    .map(([level, count]) => ({
      name: level,
      value: count,
      color: SENSITIVITY_COLORS[level] || '#8B5CF6',
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Privacy Posture Overview
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time privacy exposure index and right-to-be-forgotten orchestration metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/websites')}
            leftIcon={<Globe className="w-3.5 h-3.5" />}
          >
            Add Website
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/app/removal-requests')}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            New Removal Request
          </Button>
        </div>
      </div>

      {isBrandNewUser ? (
        <EmptyState
          title="No Tracked Data Yet"
          description="Your privacy dashboard will populate automatically as you add third-party websites and catalog your personal exposures."
          actionText="Add Your First Website"
          onAction={() => navigate('/app/websites')}
        />
      ) : (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Websites */}
            <Card className="bg-navy-900 border-navy-750">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Tracked Websites</span>
                <Globe className="w-4 h-4 text-electric-400" />
              </div>
              <div className="text-2xl font-bold text-slate-100 font-mono">
                {overview?.totalWebsites ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Platforms monitored in your account
              </div>
            </Card>

            {/* Total Exposures */}
            <Card className="bg-navy-900 border-navy-750">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Active Exposures</span>
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-slate-100 font-mono">
                {overview?.activeExposures ?? overview?.totalExposures ?? 0}
                <span className="text-xs font-normal text-slate-400 ml-1.5">
                  / {overview?.totalExposures ?? 0} total
                </span>
              </div>
              <div className="text-[10px] text-emerald-400 mt-1">
                {overview?.resolvedExposures ?? 0} exposures erased
              </div>
            </Card>

            {/* Privacy Risk Index */}
            <Card className="bg-navy-900 border-navy-750">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Privacy Risk Index</span>
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <div
                  className={`text-2xl font-bold font-mono ${
                    ((overview?.privacyRiskIndex ?? overview?.privacyExposureIndex) || 0) > 60
                      ? 'text-rose-400'
                      : ((overview?.privacyRiskIndex ?? overview?.privacyExposureIndex) || 0) > 30
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {overview?.privacyRiskIndex ?? overview?.privacyExposureIndex ?? 0}
                </div>
                <span className="text-xs text-slate-400">/ 100</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Rating: <span className="font-semibold text-slate-200">{overview?.privacyRiskRating || overview?.privacyHealthRating || 'LOW'}</span>
              </div>
            </Card>

            {/* Completed Removals */}
            <Card className="bg-navy-900 border-navy-750">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Erasure Requests</span>
                <Trash2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-slate-100 font-mono">
                {overview?.completedRemovalRequests ?? 0}
                <span className="text-xs font-normal text-slate-400 ml-1.5">
                  / {((overview?.completedRemovalRequests ?? 0) + (overview?.activeRemovalRequests ?? 0)) || overview?.totalRemovals || 0}
                </span>
              </div>
              <div className="text-[10px] text-electric-400 mt-1">
                {overview?.activeRemovalRequests ?? 0} currently active
              </div>
            </Card>
          </div>

          {/* Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Exposure Distribution */}
            <Card className="bg-navy-900 border-navy-750 flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-navy-800">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Exposures by Category</h3>
                  <p className="text-[10px] text-slate-400">Distribution across seeded data categories</p>
                </div>
                <Badge variant="primary" size="sm">Real-Time</Badge>
              </div>

              <div className="py-4 flex-1 min-h-[240px]">
                {categoryChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No categorized exposure records found.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                      <XAxis
                        dataKey="name"
                        stroke="#64748B"
                        fontSize={10}
                        angle={-25}
                        textAnchor="end"
                      />
                      <YAxis stroke="#64748B" fontSize={10} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0E1424',
                          borderColor: '#1E2B4B',
                          borderRadius: '12px',
                          fontSize: '11px',
                        }}
                      />
                      <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Sensitivity Rating Breakdown */}
            <Card className="bg-navy-900 border-navy-750 flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-navy-800">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Sensitivity Breakdown</h3>
                  <p className="text-[10px] text-slate-400">Risk weight multipliers by record severity</p>
                </div>
                <Badge variant="info" size="sm">Severity</Badge>
              </div>

              <div className="py-4 flex-1 min-h-[240px] flex items-center justify-center">
                {sensitivityChartData.length === 0 ? (
                  <div className="text-xs text-slate-400">No active exposures found.</div>
                ) : (
                  <div className="w-full flex flex-col sm:flex-row items-center justify-around gap-4">
                    <div className="w-48 h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sensitivityChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={4}
                          >
                            {sensitivityChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0E1424',
                              borderColor: '#1E2B4B',
                              borderRadius: '12px',
                              fontSize: '11px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-2 text-xs">
                      {sensitivityChartData.map((entry) => (
                        <div key={entry.name} className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="font-medium text-slate-300">{entry.name}:</span>
                          <span className="font-bold text-slate-100">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
