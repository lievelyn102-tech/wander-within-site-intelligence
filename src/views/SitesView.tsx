import React, { useState } from 'react';
import {
  Globe,
  Plus,
  Trash2,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Zap,
  FileText,
  AlertTriangle,
  Layers,
  Sparkles,
  Users,
  Search,
  Check,
} from 'lucide-react';
import { SiteModel } from '../types';

interface SitesViewProps {
  sites: SiteModel[];
  activeSite: SiteModel | null;
  onSelectSite: (site: SiteModel) => void;
  onOpenAddSite: () => void;
  onDeleteSite: (id: string) => void;
  onRunAudit?: (site: SiteModel) => void;
  onViewReport?: (site: SiteModel) => void;
  onAddExternalSite?: (url: string, name?: string) => Promise<void>;
}

export const SitesView: React.FC<SitesViewProps> = ({
  sites,
  activeSite,
  onSelectSite,
  onOpenAddSite,
  onDeleteSite,
  onRunAudit,
  onViewReport,
  onAddExternalSite,
}) => {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickUrl, setQuickUrl] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim()) return;

    setQuickLoading(true);
    setQuickError(null);

    try {
      if (onAddExternalSite) {
        await onAddExternalSite(quickUrl.trim(), quickName.trim() || undefined);
      } else {
        const res = await fetch('/api/sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: quickUrl.trim(),
            name: quickName.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to add site.');
        }
        window.location.reload();
      }
      setQuickUrl('');
      setQuickName('');
      setShowQuickAdd(false);
    } catch (err: any) {
      setQuickError(err?.message || 'Error adding external site.');
    } finally {
      setQuickLoading(false);
    }
  };

  const filteredSites = sites.filter(
    (s) =>
      s.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      s.url.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div id="sites-view" className="space-y-6">
      {/* Top Banner & Header Controls */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-semibold text-slate-900">
              Blogger & Blogspot Site Portfolio
            </h3>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              {sites.length} {sites.length === 1 ? 'Site' : 'Sites'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Isolated sessions, per-site cached diagnostics, and support for your own blogs or friend & client sites.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="sites-quick-add-toggle-btn"
            type="button"
            onClick={() => setShowQuickAdd((prev) => !prev)}
            className="flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Users className="h-3.5 w-3.5 text-slate-500" />
            <span>Audit Friend/External Site</span>
          </button>

          <button
            id="sites-add-btn"
            type="button"
            onClick={onOpenAddSite}
            className="flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-2xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Site</span>
          </button>
        </div>
      </div>

      {/* Quick Add External Blogger URL Drawer / Form */}
      {showQuickAdd && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-900">
                  Audit a Friend or Client's Blogger Site
                </h4>
                <p className="text-[11px] text-slate-600">
                  No Search Console ownership needed. Wander Within inspects public RSS/Atom feeds, robots.txt, HTML headings, and canonicals safely.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickAdd(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleQuickAdd} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="e.g. wanderwithintravel.blogspot.com"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
            <input
              type="text"
              placeholder="Display Name (optional)"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              className="w-full sm:w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={quickLoading}
              className="inline-flex items-center justify-center space-x-1 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-2xs whitespace-nowrap"
            >
              {quickLoading ? (
                <span>Adding...</span>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Register & Audit</span>
                </>
              )}
            </button>
          </form>
          {quickError && <p className="mt-2 text-xs text-rose-600">{quickError}</p>}
        </div>
      )}

      {/* Filter / Search bar if more than 2 sites */}
      {sites.length > 2 && (
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by site title or domain URL..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}

      {/* Sites Grid */}
      {filteredSites.length === 0 ? (
        <div
          id="sites-empty-state"
          className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-3">
            <Globe className="h-6 w-6" />
          </div>
          <h4 className="text-base font-semibold text-slate-900">
            {filterQuery ? 'No sites match your search' : 'No sites registered yet'}
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
            {filterQuery
              ? 'Try adjusting your search keywords or clear the filter.'
              : 'Wander Within supports multiple Blogger/Blogspot websites per session. Connect your Google account to auto-discover all blogs or enter any public Blogger URL to begin diagnosing.'}
          </p>
          <div className="mt-4 flex justify-center space-x-2">
            {filterQuery ? (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Clear Search
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAddSite}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add First Site</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSites.map((site) => {
            const isActive = activeSite?.id === site.id;
            const isSubdomain = site.platform === 'blogger_subdomain';

            return (
              <div
                key={site.id}
                id={`site-card-${site.id}`}
                className={`flex flex-col justify-between rounded-xl border p-5 transition-all ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50/15 shadow-xs ring-1 ring-indigo-500'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 text-indigo-600 border-slate-200'
                        }`}
                      >
                        <Globe className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-slate-900 leading-snug truncate max-w-[180px]">
                          {site.name}
                        </h4>
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                          {isSubdomain ? 'Blogspot Subdomain' : 'Custom Domain'}
                        </span>
                      </div>
                    </div>

                    {isActive && (
                      <span className="flex items-center space-x-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                        <Check className="h-3 w-3" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  {/* URL */}
                  <div className="mt-2.5 flex items-center space-x-1 text-xs font-mono text-slate-600">
                    <span className="truncate">{site.url}</span>
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-indigo-600 shrink-0"
                      title="Open website"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Health Summary Badges */}
                  <div className="mt-3.5 space-y-2 rounded-lg bg-slate-50 p-3 text-xs border border-slate-100">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Technical Audit:</span>
                      {site.lastAuditScore !== undefined ? (
                        <span
                          className={`font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                            site.lastAuditScore >= 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : site.lastAuditScore >= 60
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          Score: {site.lastAuditScore}/100 · {site.lastAuditStatus?.toUpperCase() || 'AUDITED'}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">Not audited yet</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Indexing Health:</span>
                      <span
                        className={`font-medium truncate max-w-[150px] text-right ${
                          site.healthStatus.indexing?.includes('Optimal')
                            ? 'text-emerald-700 font-semibold'
                            : site.healthStatus.indexing?.includes('Warning')
                            ? 'text-amber-700 font-semibold'
                            : 'text-slate-500'
                        }`}
                      >
                        {site.healthStatus.indexing || 'Pending audit'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">AdSense Readiness:</span>
                      <span
                        className={`font-medium truncate max-w-[150px] text-right ${
                          site.healthStatus.adsenseReadiness?.includes('READY')
                            ? 'text-emerald-700 font-semibold'
                            : site.healthStatus.adsenseReadiness?.includes('MODERATE')
                            ? 'text-amber-700 font-semibold'
                            : site.healthStatus.adsenseReadiness?.includes('HIGH')
                            ? 'text-rose-700 font-semibold'
                            : 'text-slate-500'
                        }`}
                      >
                        {site.healthStatus.adsenseReadiness || 'Not checked'}
                      </span>
                    </div>
                  </div>

                  {/* Connection pills */}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded border ${
                        site.connections.blogger
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      <span>Blogger API</span>
                      {site.connections.blogger && site.postsCount !== undefined && (
                        <span>({site.postsCount})</span>
                      )}
                    </span>

                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded border ${
                        site.connections.searchConsole
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      <span>Search Console</span>
                    </span>

                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded border ${
                        site.connections.crawler
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      <span>HTML Crawler</span>
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    {!isActive ? (
                      <button
                        id={`set-active-site-${site.id}`}
                        type="button"
                        onClick={() => onSelectSite(site)}
                        className="inline-flex items-center space-x-1 rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        <Layers className="h-3 w-3" />
                        <span>Switch to this site</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-xs font-semibold text-indigo-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Active Working Blog</span>
                      </span>
                    )}

                    <div className="flex items-center space-x-1">
                      {onRunAudit && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSite(site);
                            onRunAudit(site);
                          }}
                          className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                          title="Run Technical Audit"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {onViewReport && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSite(site);
                            onViewReport(site);
                          }}
                          className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                          title="View Executive Report"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        id={`delete-site-${site.id}`}
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove "${site.name}" and its cached diagnostic audit history?`)) {
                            onDeleteSite(site.id);
                          }
                        }}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Remove site"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Multi-Site Session Isolation Architecture Box */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex items-start space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-900">
              Multi-Tenant Session Isolation & Cached Scopes
            </h4>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Diagnostics (HTML crawl trees, robots.txt analyses, sitemaps, AdSense readiness, and AI syntheses) are scoped exclusively to the active site and user session. Switching active blogs instantly recalls that site's cached audit data without redundant HTTP requests.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
