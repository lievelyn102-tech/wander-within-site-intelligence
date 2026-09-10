import React, { useState, useEffect } from 'react';
import {
  Layers,
  AlertCircle,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Code2,
  RefreshCw,
  Search,
  BookOpen,
  Image as ImageIcon,
  ArrowRight,
} from 'lucide-react';
import { SiteModel, PageInspectionResult } from '../types';

interface ContentAnalysisViewProps {
  activeSite: SiteModel | null;
  onOpenConnectGoogle: () => void;
  onSelectTab?: (tab: string) => void;
}

export const ContentAnalysisView: React.FC<ContentAnalysisViewProps> = ({
  activeSite,
  onOpenConnectGoogle,
  onSelectTab,
}) => {
  const [inspections, setInspections] = useState<PageInspectionResult[]>([]);
  const [discoveredUrls, setDiscoveredUrls] = useState<
    Array<{ url: string; title: string; type: 'Home' | 'Post' | 'Page' }>
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuditingUrl, setIsAuditingUrl] = useState<string | null>(null);

  const loadData = async (siteId: string, siteUrl: string) => {
    setIsLoading(true);
    try {
      // 1. Load inspections history
      const historyRes = await fetch(`/api/inspect/history?siteId=${encodeURIComponent(siteId)}`);
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        if (Array.isArray(historyData.inspections)) {
          setInspections(historyData.inspections);
        }
      }

      // 2. Load discoverable URLs
      const urlsRes = await fetch(
        `/api/inspect/site-urls?siteId=${encodeURIComponent(siteId)}&siteUrl=${encodeURIComponent(siteUrl)}`
      );
      if (urlsRes.ok) {
        const urlsData = await urlsRes.json();
        if (Array.isArray(urlsData.urls)) {
          setDiscoveredUrls(urlsData.urls);
        }
      }
    } catch (err) {
      console.warn('Failed to load content analysis data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeSite?.id && activeSite?.url) {
      loadData(activeSite.id, activeSite.url);
    }
  }, [activeSite?.id, activeSite?.url]);

  const handleQuickAudit = async (url: string) => {
    if (!activeSite) return;
    setIsAuditingUrl(url);
    try {
      const res = await fetch('/api/inspect/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          siteId: activeSite.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setInspections((prev) => [data.inspection, ...prev.filter((p) => p.finalUrl !== data.inspection.finalUrl)]);
      }
    } catch (err) {
      console.error('Failed to audit post:', err);
    } finally {
      setIsAuditingUrl(null);
    }
  };

  // Helper to determine if an inspection is an Index Hub / Feed portal or a standard Post
  const checkIsIndexHub = (item: PageInspectionResult) => {
    if (item.isHomepage !== undefined) return item.isHomepage;
    if (item.headings?.isHomepage !== undefined) return item.headings.isHomepage;
    if (item.pageType === 'INDEX_HUB' || item.headings?.pageType === 'INDEX_HUB') return true;
    const url = (item.finalUrl || item.url || '').split('?')[0].replace(/\/+$/, '');
    const siteUrl = activeSite?.url ? activeSite.url.split('?')[0].replace(/\/+$/, '') : '';
    return url === siteUrl || url === `${siteUrl}/` || !url.includes('.html');
  };

  const checkIsPostPage = (item: PageInspectionResult) => {
    if (item.isPostPage !== undefined) return item.isPostPage;
    return !checkIsIndexHub(item);
  };

  // Aggregated Content Metrics
  const totalInspected = inspections.length;
  const postInspections = inspections.filter(checkIsPostPage);
  const avgWordCount =
    postInspections.length > 0
      ? Math.round(
          postInspections.reduce((sum, item) => sum + (item.headings?.wordCount || 0), 0) / postInspections.length
        )
      : totalInspected > 0
      ? Math.round(
          inspections.reduce((sum, item) => sum + (item.headings?.wordCount || 0), 0) / totalInspected
        )
      : 0;

  // Thin Content Risk count only increments for actual post pages (isPostPage && wordCount < 250)
  const thinContentArticles = inspections.filter((item) => {
    const isPost = checkIsPostPage(item);
    const wordCount = item.headings?.wordCount || 0;
    return isPost && wordCount < 250;
  });
  const totalImages = inspections.reduce((sum, item) => sum + (item.media?.totalImages || 0), 0);
  const totalMissingAlt = inspections.reduce((sum, item) => sum + (item.media?.imagesMissingAlt || 0), 0);
  const altCoverageRate =
    totalImages > 0 ? Math.round(((totalImages - totalMissingAlt) / totalImages) * 100) : 100;

  const isConnected = totalInspected > 0;

  return (
    <div id="content-analysis-view" className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Deterministic Content & Structure Analysis
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Word count density, subheading distribution, and accessibility across your Blogger articles.
          </p>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center space-x-2">
          <span
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            {isConnected ? `Content: ${totalInspected} Page(s) Audited` : 'Content: Not connected'}
          </span>
          {activeSite && (
            <button
              type="button"
              onClick={() => loadData(activeSite.id, activeSite.url)}
              disabled={isLoading}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      {isConnected ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Pages Audited
            </span>
            <span className="mt-1 text-xl font-bold text-slate-900 block">{totalInspected}</span>
            <span className="text-[11px] text-slate-500">From active blog</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Avg Word Count
            </span>
            <span className="mt-1 text-xl font-bold text-slate-900 block">~{avgWordCount}</span>
            <span className="text-[11px] text-slate-500">Body content</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Thin Content Risk
            </span>
            <span
              className={`mt-1 text-xl font-bold block ${
                thinContentArticles.length > 0 ? 'text-amber-600' : 'text-emerald-700'
              }`}
            >
              {thinContentArticles.length}
            </span>
            <span className="text-[11px] text-slate-500">&lt;250 words (hub exempt)</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Image Alt Coverage
            </span>
            <span
              className={`mt-1 text-xl font-bold block ${
                altCoverageRate >= 90 ? 'text-emerald-700' : 'text-amber-600'
              }`}
            >
              {altCoverageRate}%
            </span>
            <span className="text-[11px] text-slate-500">
              {totalMissingAlt} missing alt tag{totalMissingAlt !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-3">
            <Layers className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900">
            No Pages Audited Yet
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
            Run a technical inspection on your homepage or posts to populate deterministic word counts,
            heading density, and image accessibility benchmarks for{' '}
            <strong className="text-slate-700">{activeSite ? activeSite.name : 'your site'}</strong>.
          </p>
          {onSelectTab && (
            <button
              type="button"
              onClick={() => onSelectTab('technical_audit')}
              className="mt-4 inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Go to Technical Audit</span>
            </button>
          )}
        </div>
      )}

      {/* Inspected Articles Table */}
      {inspections.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Audited Articles Breakdown ({inspections.length})
              </h4>
              <span className="text-[11px] text-slate-400">
                Factual metrics parsed directly from Blogger HTML DOM
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Article / Page</th>
                  <th className="py-3 px-3">Word Count</th>
                  <th className="py-3 px-3">H1 Status</th>
                  <th className="py-3 px-3">Subheadings</th>
                  <th className="py-3 px-3">Missing Alt</th>
                  <th className="py-3 px-4 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inspections.map((item, idx) => {
                  const isHub = checkIsIndexHub(item);
                  const isPost = checkIsPostPage(item);
                  const wordCount = item.headings?.wordCount || 0;
                  const isThin = isPost && wordCount < 250;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center space-x-1.5">
                          <p className="font-semibold text-slate-800 truncate" title={item.meta.title || item.finalUrl}>
                            {item.meta.title || (isHub ? 'Homepage / Index Feed' : 'Untitled Page')}
                          </p>
                          {isHub && (
                            <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                              Index Hub
                            </span>
                          )}
                        </div>
                        <a
                          href={item.finalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-indigo-600 hover:underline truncate block"
                        >
                          {item.finalUrl}
                        </a>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-semibold ${
                            isThin ? 'text-amber-600' : 'text-slate-800'
                          }`}
                        >
                          ~{wordCount}
                        </span>
                        {isHub ? (
                          <span className="inline-flex items-center space-x-1 mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                            <span>Index Hub / Feed</span>
                          </span>
                        ) : isThin ? (
                          <span className="block text-[10px] text-amber-600 font-medium">
                            Thin Risk
                          </span>
                        ) : (
                          <span className="block text-[10px] text-emerald-600 font-medium">
                            Pass ({wordCount}w)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {item.headings?.h1Count === 1 ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>1 (Valid)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-amber-700 font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            <span>{item.headings?.h1Count || 0} H1s</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {item.headings?.h2Count || 0} H2 · {item.headings?.h3Count || 0} H3
                      </td>
                      <td className="py-3 px-3">
                        {item.media?.imagesMissingAlt === 0 ? (
                          <span className="text-emerald-700 font-medium">All Alt Set</span>
                        ) : (
                          <span className="text-amber-700 font-semibold">
                            {item.media?.imagesMissingAlt} of {item.media?.totalImages}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            item.overallScore >= 80
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : item.overallScore >= 50
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {item.overallScore}/100
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Discovered Articles Ready for Audit */}
      {discoveredUrls.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Discovered Articles from Blogger Feed / Sitemap ({discoveredUrls.length})
              </h4>
              <span className="text-[11px] text-slate-400">
                Click "Audit" to instantly run deterministic inspection and add to metrics
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {discoveredUrls.slice(0, 10).map((post, idx) => {
              const alreadyAudited = inspections.some((insp) => insp.finalUrl === post.url || insp.url === post.url);
              return (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 truncate">{post.title}</p>
                    <span className="text-[11px] text-slate-400 truncate block font-mono">
                      {post.url}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center space-x-2">
                    {alreadyAudited ? (
                      <span className="inline-flex items-center space-x-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Audited</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleQuickAudit(post.url)}
                        disabled={isAuditingUrl === post.url}
                        className="inline-flex items-center space-x-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-60"
                      >
                        {isAuditingUrl === post.url ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            <span>Auditing...</span>
                          </>
                        ) : (
                          <>
                            <Code2 className="h-3 w-3" />
                            <span>Audit Post</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Content Diagnostic Guidelines */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Blogger Content Quality & Search Guidance
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <h5 className="text-xs font-semibold text-slate-900 mb-1">
              Topic Overlap & Cannibalization
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Detects when multiple Blogger articles target identical search queries, causing Google to alternate or suppress rankings between them.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <h5 className="text-xs font-semibold text-slate-900 mb-1">
              Thin Content & Word Count Thresholds
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Identifies posts with minimal original text body, heavy image-only layouts without context, or repetitive boilerplate.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <h5 className="text-xs font-semibold text-slate-900 mb-1">
              Search Intent Alignment
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Evaluates whether article headings and structure fulfill the informational or transactional intent of the title promise.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
