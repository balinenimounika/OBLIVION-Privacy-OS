import React, { useEffect, useState, useCallback } from 'react';
import {
  Globe,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  Filter,
} from 'lucide-react';
import { websiteApi } from '../../api/website.api';
import { Website, WebsiteCategory, CreateWebsiteDTO, PaginationMeta } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Skeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { useToast } from '../../context/ToastContext';

const WEBSITE_CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'SOCIAL_MEDIA', label: 'Social Media' },
  { value: 'E_COMMERCE', label: 'E-Commerce' },
  { value: 'FINANCIAL_SERVICES', label: 'Financial Services' },
  { value: 'HEALTHCARE', label: 'Healthcare' },
  { value: 'EMPLOYMENT', label: 'Employment' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'ENTERTAINMENT', label: 'Entertainment' },
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'TELECOMMUNICATIONS', label: 'Telecommunications' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'OTHER', label: 'Other' },
];

export const WebsitesPage: React.FC = () => {
  const { showToast } = useToast();

  const [websites, setWebsites] = useState<Website[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);

  // Form states
  const [formData, setFormData] = useState<CreateWebsiteDTO>({
    websiteName: '',
    websiteUrl: '',
    websiteCategory: 'OTHER',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchWebsites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await websiteApi.list({
        page: currentPage,
        limit: 10,
        search: searchTerm || undefined,
        category: selectedCategory || undefined,
      });
      setWebsites(res.data || []);
      if (res.meta) {
        setMeta(res.meta);
      }
    } catch (err: any) {
      console.error('Failed to load websites:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch websites.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, selectedCategory]);

  useEffect(() => {
    fetchWebsites();
  }, [fetchWebsites]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.websiteName || !formData.websiteUrl) {
      setFormError('Please enter both website name and URL.');
      return;
    }

    setSubmitting(true);
    try {
      await websiteApi.create(formData);
      showToast('Website added successfully', 'success');
      setIsAddModalOpen(false);
      setFormData({ websiteName: '', websiteUrl: '', websiteCategory: 'OTHER' });
      fetchWebsites();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to add website.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWebsite) return;
    setFormError(null);

    setSubmitting(true);
    try {
      await websiteApi.update(selectedWebsite.id, {
        websiteName: formData.websiteName,
        websiteUrl: formData.websiteUrl,
        websiteCategory: formData.websiteCategory,
      });
      showToast('Website updated successfully', 'success');
      setIsEditModalOpen(false);
      setSelectedWebsite(null);
      fetchWebsites();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update website.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedWebsite) return;
    setSubmitting(true);
    try {
      await websiteApi.delete(selectedWebsite.id);
      showToast('Website deleted successfully', 'success');
      setIsDeleteModalOpen(false);
      setSelectedWebsite(null);
      fetchWebsites();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete website.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (site: Website) => {
    setSelectedWebsite(site);
    setFormData({
      websiteName: site.websiteName,
      websiteUrl: site.websiteUrl,
      websiteCategory: site.websiteCategory,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (site: Website) => {
    setSelectedWebsite(site);
    setIsDeleteModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Tracked Websites & Platforms
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Catalog third-party websites, platforms, and data brokers where your personal records are stored.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setFormData({ websiteName: '', websiteUrl: '', websiteCategory: 'OTHER' });
            setFormError(null);
            setIsAddModalOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Website
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full sm:w-auto">
          <Input
            placeholder="Search by website name or domain..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            options={WEBSITE_CATEGORIES}
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchWebsites} />
      ) : websites.length === 0 ? (
        <EmptyState
          title={searchTerm || selectedCategory ? 'No Matching Websites' : 'No Websites Tracked Yet'}
          description={
            searchTerm || selectedCategory
              ? 'Try adjusting your search criteria or category filter.'
              : 'Add your first third-party website to begin cataloging your data exposures.'
          }
          actionText={searchTerm || selectedCategory ? 'Clear Filters' : 'Add Website'}
          onAction={() => {
            if (searchTerm || selectedCategory) {
              setSearchTerm('');
              setSelectedCategory('');
            } else {
              setIsAddModalOpen(true);
            }
          }}
        />
      ) : (
        <div className="space-y-3">
          {websites.map((site) => (
            <Card
              key={site.id}
              className="bg-navy-900 border-navy-750 flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 hover:border-navy-700 transition-colors"
            >
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-navy-800 text-electric-400 border border-navy-750 shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-100">{site.websiteName}</h3>
                    <Badge variant="primary" size="sm">
                      {site.websiteCategory.replace('_', ' ')}
                    </Badge>
                  </div>
                  <a
                    href={site.websiteUrl.startsWith('http') ? site.websiteUrl : `https://${site.websiteUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 hover:text-electric-400 transition-colors inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>{site.websiteUrl}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Actions & Timestamps */}
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-navy-800">
                <div className="text-[11px] text-slate-400 text-left sm:text-right">
                  <div>Added {new Date(site.createdAt).toLocaleDateString()}</div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(site)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors"
                    title="Edit Website"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openDeleteModal(site)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
                    title="Delete Website"
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

      {/* Add Website Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register Third-Party Website"
        description="Add a service or data broker holding your personal information."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs">
              {formError}
            </div>
          )}

          <Input
            label="Platform / Website Name"
            placeholder="e.g. PeopleFinder Broker"
            value={formData.websiteName}
            onChange={(e) => setFormData({ ...formData, websiteName: e.target.value })}
            required
          />

          <Input
            label="Website URL or Domain"
            placeholder="e.g. https://peoplefinder.com"
            value={formData.websiteUrl}
            onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
            helperText="Must be a valid web URL or domain name"
            required
          />

          <Select
            label="Platform Category"
            options={WEBSITE_CATEGORIES.filter((c) => c.value !== '')}
            value={formData.websiteCategory}
            onChange={(e) =>
              setFormData({ ...formData, websiteCategory: e.target.value as WebsiteCategory })
            }
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
              Add Website
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Website Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Website Details"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs">
              {formError}
            </div>
          )}

          <Input
            label="Platform / Website Name"
            value={formData.websiteName}
            onChange={(e) => setFormData({ ...formData, websiteName: e.target.value })}
            required
          />

          <Input
            label="Website URL or Domain"
            value={formData.websiteUrl}
            onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
            required
          />

          <Select
            label="Platform Category"
            options={WEBSITE_CATEGORIES.filter((c) => c.value !== '')}
            value={formData.websiteCategory}
            onChange={(e) =>
              setFormData({ ...formData, websiteCategory: e.target.value as WebsiteCategory })
            }
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-navy-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Website Deletion"
        description="Are you sure you want to remove this website from your tracking dashboard?"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Deleting <span className="font-semibold text-slate-100">{selectedWebsite?.websiteName}</span> will
            also cascade to delete all associated exposure records and removal requests tied to this website.
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
              Delete Website
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
