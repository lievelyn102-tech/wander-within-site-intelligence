import React, { useState } from 'react';
import { Globe, X, Plus, AlertCircle, Sparkles } from 'lucide-react';
import { SiteModel } from '../types';

interface AddSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSite: (site: SiteModel) => void;
  onOpenConnectGoogle?: () => void;
}

export const AddSiteModal: React.FC<AddSiteModalProps> = ({
  isOpen,
  onClose,
  onAddSite,
  onOpenConnectGoogle,
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please provide a Blogger URL (e.g., yourblog.blogspot.com).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to register site.');
      }

      const { site } = await response.json();
      onAddSite(site);
      setName('');
      setUrl('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while registering site.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="add-site-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in"
    >
      <div
        id="add-site-modal-dialog"
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <button
          id="close-add-site-btn"
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-indigo-600 border border-slate-200">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Register Blogger Site
            </h3>
            <p className="text-xs text-slate-500">
              Add a Blogspot subdomain or custom domain for diagnostics
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {onOpenConnectGoogle && (
          <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-semibold text-indigo-950">Auto-Discovery Available</span>
              <p className="text-[11px] text-indigo-800">
                Connect your Google Account to auto-import your Blogger blogs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenConnectGoogle();
              }}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs transition-colors shrink-0 ml-2"
            >
              <span>Connect</span>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="site-name-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Site Title / Label (Optional)
            </label>
            <input
              id="site-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wander Within Travel Blog"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="site-url-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Blogger Website URL <span className="text-rose-500">*</span>
            </label>
            <input
              id="site-url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. wanderwithin.blogspot.com or customdomain.com"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Accepts .blogspot.com addresses or custom domain configurations.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-800">Diagnostic Safe Guarantee:</span> Registering a site only configures diagnostic target profiles. It never sends write requests or modifies your template.
          </div>

          <div className="flex items-center justify-end space-x-2.5 pt-2">
            <button
              id="cancel-add-site-btn"
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-add-site-btn"
              type="submit"
              disabled={loading}
              className="flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{loading ? 'Registering...' : 'Register Site'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
