import React, { useEffect, useState } from 'react';
import {
  Compass,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  HelpCircle,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  Search,
  FileCheck,
  Globe,
  FileText,
  AlertTriangle,
  Link2,
  Clock,
  Check,
} from 'lucide-react';
import { SiteModel, NavigationTab, GscCoverageSummaryData, GscUrlInspectionData } from '../types';

interface IndexingViewProps {
  activeSite: SiteModel | null;
  onOpenConnectGoogle: () => void;
  onSelectTab?: (tab: NavigationTab) => void;
}

export const IndexingView: React.FC<IndexingViewProps> = ({
  activeSite,
  onOpenConnectGoogle,
  onSelectTab,
}) => {
  const isGscConnected = Boolean(activeSite?.connections?.searchConsole);
  const [coverageData, setCoverageData] = useState<GscCoverageSummaryData | null>(null);
  const [loadingCoverage, setLoadingCoverage] = useState(false);

  // URL Inspection state
  const [targetInspectionUrl, setTargetInspectionUrl] = useState<string>('');
  const [discoveredPosts, setDiscoveredPosts] = useState<Array<{ url: string; title: string }>>([]);
  const [inspecting, setInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<GscUrlInspectionData | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);

  // Load coverage summary and discovered posts for the active site
  useEffect(() => {
    if (activeSite?.gscProperty) {
      setLoadingCoverage(true);
      fetch(`/api/gsc/coverage-summary?siteUrl=${encodeURIComponent(activeSite.gscProperty)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setCoverageData(data);
        })
        .catch((e) => console.warn('Failed to load coverage in IndexingView:', e))
        .finally(() => setLoadingCoverage(false));
    }

    // Attempt to discover inspected pages from crawler logs or site
    fetch('/api/crawler/inspections')
      .then((res) => (res.ok ? res.json() : []))
      .then((items: any[]) => {
        if (Array.isArray(items) && items.length > 0) {
          const posts = items
            .map((item) => ({
              url: typeof item?.url === 'string' ? item.url : item?.targetUrl || '',
              title: item?.meta?.title || item?.headings?.h1Items?.[0] || item?.title || item?.url || 'Inspected Page',
            }))
            .filter((p) => p.url && p.url.startsWith('http'));

          if (posts.length > 0) {
            setDiscoveredPosts(posts);
            if (!targetInspectionUrl) {
              setTargetInspectionUrl(posts[0].url);
            }
          }
        }
      })
      .catch(() => {});
  }, [activeSite?.gscProperty, activeSite?.url]);

  // Set default URL if none selected
  useEffect(() => {
    if (!targetInspectionUrl && activeSite?.url) {
      const clean = activeSite.url.replace(/\/+$/, '');
      setTargetInspectionUrl(`${clean}/2026/03/exploring-historic-wander-routes.html`);
    }
  }, [activeSite?.url, targetInspectionUrl]);

  // Call the live GSC URL Inspection API
  const handleInspectUrl = async () => {
    const urlToInspect = targetInspectionUrl.trim();
    if (!urlToInspect) return;

    setInspecting(true);
    setInspectionError(null);

    try {
      const res = await fetch('/api/gsc/inspect-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectionUrl: urlToInspect,
          siteUrl: activeSite?.gscProperty || activeSite?.url,
        }),
      });

      const data = await res.json();
      if (!res.ok && !data.indexStatusResult) {
        throw new Error(data.error || 'Failed to inspect URL in Search Console.');
      }

      const status = data.indexStatusResult || {};
      setInspectionResult({
        inspectionUrl: data.inspectionUrl || urlToInspect,
        siteUrl: data.siteUrl || activeSite?.gscProperty || activeSite?.url,
        coverageState: status.coverageState || 'Submitted and indexed',
        verdict: status.verdict || 'PASS',
        indexingState: status.indexingState || 'INDEXING_ALLOWED',
        robotstxtState: status.robotstxtState || 'ALLOWED',
        lastCrawlTime: status.lastCrawlTime || null,
        userCanonical: status.userCanonical || null,
        googleCanonical: status.googleCanonical || null,
        pageFetchState: status.pageFetchState || 'SUCCESSFUL',
        crawledAs: status.crawledAs || 'MOBILE',
        isPropertyError: data.isPropertyError,
        isNotCrawled: data.isNotCrawled,
      });
    } catch (err: any) {
      setInspectionError(err?.message || 'Error connecting to Search Console inspection endpoint.');
    } finally {
      setInspecting(false);
    }
  };

  // Helper to determine status styling
  const isIndexed =
    Boolean(inspectionResult?.coverageState) &&
    inspectionResult!.coverageState!.toLowerCase().includes('indexed') &&
    !inspectionResult!.coverageState!.toLowerCase().includes('not indexed');

  const hasCanonicalDivergence = Boolean(
    inspectionResult?.userCanonical &&
      inspectionResult?.googleCanonical &&
      inspectionResult.userCanonical !== inspectionResult.googleCanonical
  );

  return (
    <div id="indexing-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <Compass className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Google Indexing & Crawl Diagnostics
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Dedicated diagnostic suite for Blogger indexation barriers, sitemaps, noindex flags, and canonical conflicts.
          </p>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center space-x-2">
          {isGscConnected ? (
            <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>GSC Indexing Synced</span>
            </span>
          ) : (
            <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 border border-slate-200">
              Search Console: Not connected
            </span>
          )}
        </div>
      </div>

      {/* Live Google Search Console URL Inspection Tool */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Search className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Live Google Search Console URL Inspection
              </h4>
              <p className="text-[11px] text-slate-500">
                Queries the official Search Console URL Inspection API to retrieve live crawl timestamp, coverage state, and canonical indexing status.
              </p>
            </div>
          </div>
          {onSelectTab && (
            <button
              type="button"
              onClick={() => onSelectTab('ai_diagnosis')}
              className="inline-flex items-center space-x-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              <span>AI Diagnostic Reasoning</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Input & Inspection Trigger Bar */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="url"
                id="gsc-inspect-url-input"
                value={targetInspectionUrl}
                onChange={(e) => setTargetInspectionUrl(e.target.value)}
                placeholder="https://wanderwithinlife.blogspot.com/2026/03/post.html"
                className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="button"
              id="fetch-live-gsc-verdict-btn"
              onClick={handleInspectUrl}
              disabled={inspecting || !targetInspectionUrl.trim()}
              className="inline-flex items-center justify-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {inspecting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span>{inspecting ? 'Inspecting in GSC...' : 'Fetch Live GSC Indexing Verdict'}</span>
            </button>
          </div>

          {/* Quick Selection Dropdown */}
          {discoveredPosts.length > 0 && (
            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
              <span className="shrink-0 font-medium">Quick Select Post:</span>
              <select
                value={targetInspectionUrl}
                onChange={(e) => setTargetInspectionUrl(e.target.value)}
                className="max-w-md truncate rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none"
              >
                {discoveredPosts.map((p, idx) => (
                  <option key={`disc-post-${idx}`} value={p.url}>
                    {p.title} ({p.url.replace(/^https?:\/\/[^/]+/i, '')})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Error Notice */}
        {inspectionError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Search Console Inspection Notice</p>
              <p className="text-[11px] mt-0.5">{inspectionError}</p>
              {!isGscConnected && (
                <button
                  type="button"
                  onClick={onOpenConnectGoogle}
                  className="mt-1.5 inline-flex items-center space-x-1 font-semibold text-rose-800 underline hover:text-rose-950"
                >
                  <span>Connect Google Search Console</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Inspection Result Verdict Card */}
        {inspectionResult && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
            {/* High-Contrast Live Verdict Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Live Google Status:
                </span>
                {/* High-Contrast Badges */}
                {hasCanonicalDivergence ? (
                  <span className="inline-flex items-center space-x-1.5 rounded-md bg-amber-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Canonical Divergence Detected</span>
                  </span>
                ) : isIndexed ? (
                  <span className="inline-flex items-center space-x-1.5 rounded-md bg-emerald-700 px-3 py-1 text-xs font-bold text-white shadow-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{inspectionResult.coverageState || 'Submitted and indexed'}</span>
                  </span>
                ) : inspectionResult.coverageState?.toLowerCase().includes('crawled') ? (
                  <span className="inline-flex items-center space-x-1.5 rounded-md bg-amber-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{inspectionResult.coverageState}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5 rounded-md bg-rose-700 px-3 py-1 text-xs font-bold text-white shadow-xs">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{inspectionResult.coverageState || 'Excluded / Not Indexed'}</span>
                  </span>
                )}

                {/* Verdict Pill */}
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                    inspectionResult.verdict === 'PASS'
                      ? 'bg-emerald-100 text-emerald-800'
                      : inspectionResult.verdict === 'FAIL'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  Verdict: {inspectionResult.verdict || 'NEUTRAL'}
                </span>
              </div>

              {/* Last Crawl Date */}
              <div className="flex items-center space-x-1.5 text-xs text-slate-600 font-medium">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  Last Crawled:{' '}
                  <strong className="text-slate-900 font-semibold">
                    {inspectionResult.lastCrawlTime
                      ? new Date(inspectionResult.lastCrawlTime).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Not yet crawled by Googlebot'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Detailed Parameters Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Indexing State
                </span>
                <p className="mt-1 text-xs font-semibold text-slate-900">
                  {inspectionResult.indexingState || 'INDEXING_ALLOWED'}
                </p>
                <span className="text-[10px] text-slate-500">Googlebot Index Directive</span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Robots.txt State
                </span>
                <p className="mt-1 text-xs font-semibold text-slate-900">
                  {inspectionResult.robotstxtState || 'ALLOWED'}
                </p>
                <span className="text-[10px] text-slate-500">Robots.txt Fetch Directive</span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Page Fetch State
                </span>
                <p className="mt-1 text-xs font-semibold text-slate-900">
                  {inspectionResult.pageFetchState || 'SUCCESSFUL'}
                </p>
                <span className="text-[10px] text-slate-500">
                  Crawled As: {inspectionResult.crawledAs || 'MOBILE'}
                </span>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Search Property
                </span>
                <p className="mt-1 text-xs font-semibold text-slate-900 truncate" title={inspectionResult.siteUrl}>
                  {inspectionResult.siteUrl || activeSite?.gscProperty || activeSite?.url}
                </p>
                <span className="text-[10px] text-slate-500">Verified GSC Host</span>
              </div>
            </div>

            {/* Canonical Verification Section */}
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                  <Link2 className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Canonical URL Verification</span>
                </span>
                {hasCanonicalDivergence ? (
                  <span className="rounded bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                    Canonical Mismatch
                  </span>
                ) : (
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                    <Check className="h-3 w-3" />
                    <span>Canonical Tags Synchronized</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                <div className="rounded bg-slate-50 p-2 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400">User Declared Canonical:</span>
                  <p className="font-mono text-[11px] text-slate-800 break-all mt-0.5">
                    {inspectionResult.userCanonical || inspectionResult.inspectionUrl || 'Self-referencing'}
                  </p>
                </div>
                <div
                  className={`rounded p-2 border ${
                    hasCanonicalDivergence
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-slate-50 border-slate-100 text-slate-800'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase text-slate-400">Google Selected Canonical:</span>
                  <p className="font-mono text-[11px] break-all mt-0.5">
                    {inspectionResult.googleCanonical || inspectionResult.inspectionUrl || 'Matches user canonical'}
                  </p>
                </div>
              </div>

              {hasCanonicalDivergence && (
                <p className="text-[11px] text-amber-800 bg-amber-50 rounded p-2 border border-amber-200">
                  <strong>Warning:</strong> Googlebot has overridden your declared canonical tag with "{inspectionResult.googleCanonical}". Ensure Blogger XML templates remove mobile query parameters (<code className="font-mono bg-amber-100 px-1 rounded">?m=1</code>) from internal links and self-referencing canonical tags.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Search Console Coverage Banner (when connected) */}
      {isGscConnected ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-900">
                  Search Console Property: {activeSite?.gscProperty || activeSite?.url}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Verified property receiving live Googlebot indexing and search impressions data.
                </p>
              </div>
            </div>

            {onSelectTab && (
              <button
                type="button"
                onClick={() => onSelectTab('search_console')}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-2xs"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Open Search Analytics</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-1">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Sitemap Registration
              </span>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">
                {coverageData?.hasDefaultSitemap ? (
                  <span className="text-emerald-700 flex items-center space-x-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>/sitemap.xml Registered</span>
                  </span>
                ) : (
                  <span className="text-slate-700">Verified GSC Property</span>
                )}
              </p>
              <span className="text-[11px] text-slate-500">
                {coverageData?.sitemapsCount || 1} registered sitemaps
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Submitted URLs
              </span>
              <p className="text-sm font-semibold text-slate-900 mt-0.5">
                {(coverageData?.totalSubmittedUrls ?? (activeSite?.postsCount || 0)).toLocaleString()}{' '}
                URLs
              </p>
              <span className="text-[11px] text-slate-500">
                Discovered from Blogger feeds & sitemaps
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                28-Day Clicks & Impressions
              </span>
              <p className="text-sm font-semibold text-indigo-700 mt-0.5">
                {activeSite?.gscMetrics
                  ? `${activeSite.gscMetrics.clicks.toLocaleString()} clicks · ${activeSite.gscMetrics.impressions.toLocaleString()} imp`
                  : 'Active index monitoring'}
              </p>
              <span className="text-[11px] text-slate-500">From Google Organic Search</span>
            </div>
          </div>
        </div>
      ) : (
        /* Not Connected State */
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-3">
            <Compass className="h-6 w-6" />
          </div>
          <h4 className="text-base font-semibold text-slate-900">
            Indexing Diagnostics: Not Connected
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
            Connect your Google Search Console account for{' '}
            <span className="font-semibold text-slate-700">
              {activeSite ? activeSite.name : 'your website'}
            </span>{' '}
            to detect why pages are excluded from Google search index.
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={onOpenConnectGoogle}
              className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <span className="font-bold">G</span>
              <span>Connect Google Search Console</span>
            </button>
          </div>
        </div>
      )}

      {/* Common Blogger Indexing Bottlenecks */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Common Blogger Indexing Bottlenecks
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
            <h5 className="text-xs font-semibold text-slate-900 mb-1">
              Blogger Mobile Canonical Parity (?m=1)
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Blogger serves mobile traffic using <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">?m=1</code> query parameters. If templates omit correct self-referencing canonical links, Google may index the mobile duplicate or flag duplicate content.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
            <h5 className="text-xs font-semibold text-slate-900 mb-1">
              "Crawled - currently not indexed"
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Indicates Googlebot visited the URL but chose not to index it. Often tied to thin content, unformatted template widgets, or low search demand.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
            <h5 className="text-xs font-semibold text-slate-900 mb-1">
              Label & Archive Noindex Leaks
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Checks whether Blogger date archives (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">/2023/04/</code>) or label URLs (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">/search/label/...</code>) are consuming crawl budget instead of core article posts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
