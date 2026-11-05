import React, { useEffect, useState, useCallback } from 'react';
import { FolderTree, Search, ShieldCheck, Info } from 'lucide-react';
import { categoryApi } from '../../api/category.api';
import { DataCategory } from '../../types';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { SensitivityBadge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { ErrorState } from '../../components/common/ErrorState';

const USER_FRIENDLY_DESCRIPTIONS: Record<string, string> = {
  'Phone Number': 'Personal mobile or telephone number.',
  'Email Address': 'Personal or recovery email address.',
  'Financial Information': 'Payment and banking-related information.',
  'Financial Information Category': 'Payment and banking-related information.',
  'Location Data': 'GPS information and location history.',
  'Location & Tracking History': 'GPS information and location history.',
  'Government Identification Category': 'Passports, national identity numbers, driver licenses, or social security registries.',
  'Credentials & Security Profile': 'Passwords, account credentials, security questions, and authentication tokens.',
  'Biometric Profile Category': 'Facial recognition markers, voiceprints, or fingerprint templates.',
  'Health & Medical Record Category': 'Medical history, diagnoses, prescriptions, and fitness tracker records.',
  'Home Address': 'Physical residential street address, postal code, and dwelling location.',
  'Personal Photograph & Media': 'Facial photos, personal camera uploads, and likeness imagery.',
  'Browsing & Behavioral Profiling': 'Ad tracking profiles, browsing interest categories, and behavioral tracking.',
  'Resume & Employment Dossier': 'Work history, curriculum vitae, salary details, and education transcripts.',
};

export const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<DataCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSensitivity, setSelectedSensitivity] = useState<string>('');

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await categoryApi.list({
        search: searchTerm || undefined,
        sensitivity: selectedSensitivity || undefined,
      });
      setCategories(res.data || []);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch categories.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedSensitivity]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
          Personal Data Categories
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Reference catalog of 12 predefined privacy categories used to classify and evaluate exposure risks.
        </p>
      </div>

      {/* Classification Template & Risk Explanation Notice */}
      <div className="p-4 rounded-xl bg-navy-900 border border-navy-750 text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-slate-100">
          <Info className="w-4 h-4 text-electric-400 shrink-0" />
          Classification Templates, Not Personal Records
        </div>
        <p className="text-slate-400 leading-relaxed">
          These predefined categories serve as classification templates to categorize types of personal information held by third-party services. They do not store your actual personal records or raw documents.
        </p>
        <p className="text-slate-400 leading-relaxed">
          <span className="text-slate-200 font-medium">How Risk Weights Work:</span> Each category carries an assigned risk weight from <span className="font-mono text-electric-300">+1 to +10</span> reflecting potential misuse, identity theft, or safety risk. When you catalog an exposure, its associated categories directly determine its contribution to your account's Privacy Risk Index.
        </p>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full sm:w-auto">
          <Input
            placeholder="Search categories (e.g. Phone, Email, Financial, Location)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            options={[
              { value: '', label: 'All Sensitivity Levels' },
              { value: 'LOW', label: 'LOW' },
              { value: 'MEDIUM', label: 'MEDIUM' },
              { value: 'HIGH', label: 'HIGH' },
              { value: 'CRITICAL', label: 'CRITICAL' },
            ]}
            value={selectedSensitivity}
            onChange={(e) => setSelectedSensitivity(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchCategories} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const catName = cat.categoryName || cat.name || 'Data Category';
            const catDesc = USER_FRIENDLY_DESCRIPTIONS[catName] || cat.description;
            const sensitivity = cat.defaultSensitivity || cat.sensitivityLevel || 'MEDIUM';

            return (
              <Card key={cat.id} className="bg-navy-900 border-navy-750 flex flex-col justify-between p-5 hover:border-navy-700 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-xl bg-navy-800 text-electric-400 border border-navy-750">
                      <FolderTree className="w-4 h-4" />
                    </div>
                    <SensitivityBadge level={sensitivity} />
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100 mb-1">{catName}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{catDesc}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-navy-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-electric-400" />
                    Risk Contribution:
                  </span>
                  <span className="font-mono font-bold text-electric-300 bg-electric-950/80 px-2 py-0.5 rounded border border-electric-500/20">
                    +{cat.riskWeight} / 10
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
