import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search,
  ShieldCheck,
  Info,
  FileBadge,
  CreditCard,
  KeyRound,
  User,
  Phone,
  MapPin,
  Fingerprint,
  Activity,
  Briefcase,
  GraduationCap,
  Share2,
  Users,
  FolderTree,
  PlusCircle,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { categoryApi } from '../../api/category.api';
import { DataCategory } from '../../types';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { SensitivityBadge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { ErrorState } from '../../components/common/ErrorState';

export interface PredefinedCategoryConfig {
  name: string;
  examples: string[];
  riskWeight: number;
  sensitivityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  aliases: string[];
}

/**
 * 12 Canonical Personal Data Categories for OBLIVION Privacy OS
 *
 * Risk Level Mapping:
 * - 1–3:  LOW
 * - 4–6:  MEDIUM
 * - 7–8:  HIGH
 * - 9–10: CRITICAL
 */
export const PREDEFINED_CATEGORIES: PredefinedCategoryConfig[] = [
  {
    name: 'Government Identification',
    examples: ['Aadhaar', 'PAN', 'Passport', 'Voter ID'],
    riskWeight: 10,
    sensitivityLevel: 'CRITICAL',
    description: 'Passports, national identity numbers, PAN, Aadhaar, voter identification cards, and statutory government registries.',
    icon: FileBadge,
    aliases: ['Government Identification Category', 'Government ID', 'National ID'],
  },
  {
    name: 'Financial Information',
    examples: ['Bank Account', 'UPI ID', 'Card Details'],
    riskWeight: 10,
    sensitivityLevel: 'CRITICAL',
    description: 'Bank account numbers, UPI IDs, credit/debit card details, credit score inquiries, and banking credentials.',
    icon: CreditCard,
    aliases: ['Financial Information Category', 'Financial Data', 'Banking Information'],
  },
  {
    name: 'Authentication Credentials',
    examples: ['Passwords', 'API Keys', 'Login Credentials'],
    riskWeight: 10,
    sensitivityLevel: 'CRITICAL',
    description: 'Master passwords, OAuth API keys, login credentials, authentication tokens, and session secrets.',
    icon: KeyRound,
    aliases: ['Credentials & Security Profile', 'Credentials', 'Passwords & Keys'],
  },
  {
    name: 'Identity Information',
    examples: ['Full Name', 'Date of Birth', 'Gender'],
    riskWeight: 7,
    sensitivityLevel: 'HIGH',
    description: 'Legal full name, date of birth, gender, nationality, and primary demographic profile indicators.',
    icon: User,
    aliases: ['Personal Photograph & Media', 'Identity Data', 'Basic Identity'],
  },
  {
    name: 'Contact Information',
    examples: ['Phone Number', 'Email Address'],
    riskWeight: 7,
    sensitivityLevel: 'HIGH',
    description: 'Cellular telephone numbers, primary and recovery email addresses, and personal communication channels.',
    icon: Phone,
    aliases: ['Phone Number', 'Email Address', 'Contact Data', 'Contact Details'],
  },
  {
    name: 'Location Information',
    examples: ['Home Address', 'GPS', 'Live Location'],
    riskWeight: 9,
    sensitivityLevel: 'CRITICAL',
    description: 'Physical residential street address, real-time GPS telemetry, frequent geolocation check-ins, and travel routes.',
    icon: MapPin,
    aliases: ['Location & Tracking History', 'Location Data', 'Home Address', 'Location Tracking'],
  },
  {
    name: 'Biometric Information',
    examples: ['Face Data', 'Fingerprints', 'Voiceprints'],
    riskWeight: 10,
    sensitivityLevel: 'CRITICAL',
    description: 'Facial recognition geometry, fingerprint templates, voiceprint signatures, and biological markers.',
    icon: Fingerprint,
    aliases: ['Biometric Profile Category', 'Biometric Data', 'Biometrics'],
  },
  {
    name: 'Health Information',
    examples: ['Medical Records', 'Prescriptions'],
    riskWeight: 9,
    sensitivityLevel: 'CRITICAL',
    description: 'Electronic health records, clinical prescriptions, diagnostic reports, and medical treatment histories.',
    icon: Activity,
    aliases: ['Health & Medical Record Category', 'Medical Data', 'Health Records'],
  },
  {
    name: 'Employment Information',
    examples: ['Employee ID', 'Company', 'Salary'],
    riskWeight: 6,
    sensitivityLevel: 'MEDIUM',
    description: 'Current employer, employee ID numbers, salary data, work history, and curriculum vitae.',
    icon: Briefcase,
    aliases: ['Resume & Employment Dossier', 'Employment Data', 'Work History'],
  },
  {
    name: 'Education Information',
    examples: ['Student ID', 'Certificates', 'Academic Records'],
    riskWeight: 5,
    sensitivityLevel: 'MEDIUM',
    description: 'Student ID numbers, university degrees, academic transcripts, and institutional educational certifications.',
    icon: GraduationCap,
    aliases: ['Education Data', 'Academic Profile'],
  },
  {
    name: 'Social Media Information',
    examples: ['Social Profiles', 'Posts', 'Connections'],
    riskWeight: 6,
    sensitivityLevel: 'MEDIUM',
    description: 'Public social profiles, personal posts, subscriber connections, and social network relationship graphs.',
    icon: Share2,
    aliases: ['Browsing & Behavioral Profiling', 'Social Media', 'Social Profiles'],
  },
  {
    name: 'Family & Personal Relationships',
    examples: ['Family Details', 'Emergency Contacts'],
    riskWeight: 7,
    sensitivityLevel: 'HIGH',
    description: 'Family member records, next-of-kin declarations, household associations, and emergency contact details.',
    icon: Users,
    aliases: ['Family Information', 'Personal Relationships', 'Family & Contacts'],
  },
];

/**
 * Computes standard risk badge level based on risk weight:
 * - 1–3:  LOW
 * - 4–6:  MEDIUM
 * - 7–8:  HIGH
 * - 9–10: CRITICAL
 */
export function getRiskLevelFromWeight(weight: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (weight >= 9) return 'CRITICAL';
  if (weight >= 7) return 'HIGH';
  if (weight >= 4) return 'MEDIUM';
  return 'LOW';
}

function findMatchingPredefinedConfig(name?: string): PredefinedCategoryConfig | undefined {
  if (!name) return undefined;
  const cleanName = name.trim().toLowerCase();

  return PREDEFINED_CATEGORIES.find((cat) => {
    if (cat.name.toLowerCase() === cleanName) return true;
    return cat.aliases.some((alias) => alias.toLowerCase() === cleanName);
  });
}

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
      const res = await categoryApi.list();
      setCategories(res.data || []);
    } catch (err: any) {
      console.error('Failed to load categories:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Merge loaded categories with rich predefined metadata
  const displayItems = useMemo(() => {
    // If backend returns records, enrich them
    if (categories.length > 0) {
      return categories.map((cat) => {
        const catName = cat.categoryName || cat.name || 'Data Category';
        const config = findMatchingPredefinedConfig(catName);
        const riskWeight = typeof cat.riskWeight === 'number' ? cat.riskWeight : config?.riskWeight ?? 5;
        const sensitivity = getRiskLevelFromWeight(riskWeight);

        return {
          id: cat.id,
          name: catName,
          description: cat.description || config?.description || 'Personal privacy data classification template.',
          examples: config?.examples || ['Classification Attribute', 'Privacy Metadata'],
          riskWeight,
          sensitivityLevel: sensitivity,
          icon: config?.icon || FolderTree,
        };
      });
    }

    // Fallback to static catalog if backend has no data yet
    return PREDEFINED_CATEGORIES.map((cat, idx) => ({
      id: `predefined-${idx + 1}`,
      name: cat.name,
      description: cat.description,
      examples: cat.examples,
      riskWeight: cat.riskWeight,
      sensitivityLevel: cat.sensitivityLevel,
      icon: cat.icon,
    }));
  }, [categories]);

  // Client-side filtering ensures instant feedback on real-world example keywords
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const sensFilter = selectedSensitivity.trim().toUpperCase();

    return displayItems.filter((item) => {
      // Sensitivity filter check
      if (sensFilter && item.sensitivityLevel !== sensFilter) {
        return false;
      }

      // Search term check across name, description, and examples
      if (!term) return true;

      const matchesName = item.name.toLowerCase().includes(term);
      const matchesDesc = item.description.toLowerCase().includes(term);
      const matchesExample = item.examples.some((ex) => ex.toLowerCase().includes(term));

      return matchesName || matchesDesc || matchesExample;
    });
  }, [displayItems, searchTerm, selectedSensitivity]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedSensitivity('');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Personal Data Categories
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Reference catalog of 12 predefined privacy categories with real-world examples and risk weights.
          </p>
        </div>

        <Link
          to="/app/exposures"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-electric-600 hover:bg-electric-500 text-white text-xs font-medium transition-colors border border-electric-400/20 shadow-sm self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Track an Exposure
        </Link>
      </div>

      {/* Classification Template & Risk Safeguard Banner */}
      <div className="p-4 rounded-xl bg-navy-900 border border-navy-750 text-xs text-slate-300 space-y-2.5">
        <div className="flex items-center gap-2 font-semibold text-slate-100">
          <Info className="w-4 h-4 text-electric-400 shrink-0" />
          Classification Templates, Not Personal Records
        </div>
        <p className="text-slate-400 leading-relaxed">
          These 12 standardized categories serve as classification taxonomy templates to map third-party digital exposure. OBLIVION enforces strict zero-knowledge safeguards: <span className="text-slate-200 font-medium">we never collect, store, or expose real Aadhaar numbers, PAN numbers, passwords, or personal documents.</span>
        </p>
        <div className="pt-2 border-t border-navy-800 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-slate-400">
          <span>
            <strong className="text-slate-200">Risk Weight Scale:</strong> <span className="font-mono text-electric-300">+1 to +10</span> based on identity theft, financial hazard, and credential misuse severity.
          </span>
          <span>
            <strong className="text-slate-200">Badge Mapping:</strong> 1–3 <span className="text-emerald-400">LOW</span> &bull; 4–6 <span className="text-cyan-400">MEDIUM</span> &bull; 7–8 <span className="text-amber-400">HIGH</span> &bull; 9–10 <span className="text-rose-400">CRITICAL</span>
          </span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full sm:w-auto">
          <Input
            placeholder="Search by category or real-world example (e.g. Aadhaar, UPI, GPS, Password, Salary)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            options={[
              { value: '', label: 'All Sensitivity Levels' },
              { value: 'CRITICAL', label: 'CRITICAL (Risk 9–10)' },
              { value: 'HIGH', label: 'HIGH (Risk 7–8)' },
              { value: 'MEDIUM', label: 'MEDIUM (Risk 4–6)' },
              { value: 'LOW', label: 'LOW (Risk 1–3)' },
            ]}
            value={selectedSensitivity}
            onChange={(e) => setSelectedSensitivity(e.target.value)}
          />
        </div>
      </div>

      {/* Result Counter & Active Filters */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-0.5">
        <span>
          Showing <strong className="text-slate-200 font-mono">{filteredItems.length}</strong> of{' '}
          <strong className="text-slate-200 font-mono">{displayItems.length}</strong> categories
        </span>
        {(searchTerm || selectedSensitivity) && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 text-xs text-electric-400 hover:text-electric-300 font-medium transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        )}
      </div>

      {/* Category Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchCategories} />
      ) : filteredItems.length === 0 ? (
        <Card className="bg-navy-900 border-navy-750 p-8 text-center rounded-xl">
          <FolderTree className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-200 mb-1">No matching categories found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            No personal data categories matched your search criteria. Try a different search term or clear active filters.
          </p>
          <button
            onClick={handleClearFilters}
            className="px-3.5 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-750 text-electric-400 text-xs font-medium border border-navy-700 transition-colors"
          >
            Clear Filters
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((cat) => {
            const IconComponent = cat.icon;

            return (
              <Card
                key={cat.id}
                className="bg-navy-900 border-navy-750 flex flex-col justify-between p-5 hover:border-navy-700 transition-all rounded-xl group shadow-sm"
              >
                <div>
                  {/* Top Bar: Category Icon & Risk Badge */}
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="p-2.5 rounded-xl bg-navy-800 text-electric-400 border border-navy-750 group-hover:border-electric-500/30 group-hover:text-electric-300 transition-colors">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <SensitivityBadge level={cat.sensitivityLevel} />
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-semibold text-slate-100 tracking-tight mb-1.5">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {cat.description}
                  </p>

                  {/* Real-World Examples Section */}
                  <div className="mt-3.5 pt-3 border-t border-navy-800/80">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                      Real-World Examples
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.examples.map((ex) => (
                        <span
                          key={ex}
                          className="inline-flex items-center px-2 py-0.5 rounded-md bg-navy-850 text-[11px] font-mono text-slate-300 border border-navy-750 group-hover:border-navy-700 transition-colors"
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer: Risk Weight Contribution */}
                <div className="mt-4 pt-3 border-t border-navy-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-4 h-4 text-electric-400" />
                    Risk Weight:
                  </span>
                  <span className="font-mono font-bold text-electric-300 bg-electric-950/80 px-2.5 py-0.5 rounded-md border border-electric-500/20 text-xs">
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
