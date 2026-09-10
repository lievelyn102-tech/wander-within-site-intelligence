import React, { useState, useEffect } from 'react';
import {
  Code2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Search,
  FileText,
  Layers,
  Link2,
  Image as ImageIcon,
  Smartphone,
  Globe,
  Timer,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  FileCode,
  ArrowRight,
} from 'lucide-react';
import { SiteModel, PageInspectionResult, RobotsAndSitemapResult } from '../types';

interface TechnicalAuditViewProps {
  activeSite: SiteModel | null;
  onOpenAddSite: () => void;
  onRefreshSites?: () => void;
  onSelectTab?: (tab: any) => void;
}

export const TechnicalAuditView: React.FC<TechnicalAuditViewProps> = ({
  activeSite,
  onOpenAddSite,
  onRefreshSites,
  onSelectTab,
}) => {
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [inspectionResult, setInspectionResult] = useState<PageInspectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Discoverable site URLs for quick selection
  const [discoveredUrls, setDiscoveredUrls] = useState<
    Array<{ url: string; title: string; type: 'Home' | 'Post' | 'Page' }>
  >([]);
  const [isLoadingUrls, setIsLoadingUrls] = useState<boolean>(false);

  // Robots.txt & sitemap state
  const [robotsSitemapResult, setRobotsSitemapResult] = useState<RobotsAndSitemapResult | null>(null);
  const [isInspectingRobots, setIsInspectingRobots] = useState<boolean>(false);
  const [showRawRobots, setShowRawRobots] = useState<boolean>(false);

  // Accordion active sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    canonical: true,
    meta: true,
    headings: true,
    media: true,
    links: true,
    robotsSitemap: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Sync target URL when active site changes
  useEffect(() => {
    if (activeSite?.url) {
      setTargetUrl(activeSite.url.replace(/\/+$/, '') + '/');
      loadDiscoveredUrls(activeSite.id, activeSite.url);
      loadRecentHistory(activeSite.id);
    }
  }, [activeSite?.id, activeSite?.url]);

  const loadDiscoveredUrls = async (siteId: string, siteUrl: string) => {
    setIsLoadingUrls(true);
    try {
      const res = await fetch(
        `/api/inspect/site-urls?siteId=${encodeURIComponent(siteId)}&siteUrl=${encodeURIComponent(siteUrl)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.urls) && data.urls.length > 0) {
          setDiscoveredUrls(data.urls);
        }
      }
    } catch (err) {
      console.warn('Failed to load discoverable URLs:', err);
    } finally {
      setIsLoadingUrls(false);
    }
  };

  const loadRecentHistory = async (siteId: string) => {
    try {
      const res = await fetch(`/api/inspect/history?siteId=${encodeURIComponent(siteId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.inspections) && data.inspections.length > 0) {
          // If no inspection selected yet, load the latest
          setInspectionResult((prev) => prev || data.inspections[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to load inspection history:', err);
    }
  };

  // Run URL Inspection
  const handleInspectUrl = async (urlToInspect?: string) => {
    const finalUrl = (urlToInspect || targetUrl).trim();
    if (!finalUrl) {
      setError('Please enter or select a URL to inspect.');
      return;
    }

    setIsInspecting(true);
    setError(null);

    try {
      const res = await fetch('/api/inspect/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: finalUrl,
          siteId: activeSite?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to inspect target URL.');
      }

      setInspectionResult(data.inspection);
      setTargetUrl(finalUrl);

      // Refresh parent site state so dashboard health cards reflect the new audit
      if (onRefreshSites) {
        onRefreshSites();
      }
    } catch (err: any) {
      setError(err?.message || 'Inspection failed.');
    } finally {
      setIsInspecting(false);
    }
  };

  // Run Robots.txt & Sitemap.xml inspection
  const handleInspectRobotsAndSitemap = async () => {
    if (!activeSite?.url) return;
    setIsInspectingRobots(true);

    try {
      const res = await fetch(
        `/api/inspect/sitemap-and-robots?siteId=${encodeURIComponent(activeSite.id)}&siteUrl=${encodeURIComponent(
          activeSite.url
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        setRobotsSitemapResult(data);
      }
    } catch (err) {
      console.error('Failed to inspect robots and sitemap:', err);
    } finally {
      setIsInspectingRobots(false);
    }
  };

  // Auto-fetch robots & sitemap when active site is available
  useEffect(() => {
    if (activeSite?.url && !robotsSitemapResult) {
      handleInspectRobotsAndSitemap();
    }
  }, [activeSite?.id]);

  // Evaluated rule states for the 13 deterministic checks
  const getRuleEvaluation = (ruleIndex: number) => {
    if (!inspectionResult) {
      return { status: 'pending', note: 'Awaiting inspection' };
    }

    switch (ruleIndex) {
      case 0: // HTTP Status & Latency
        return {
          status: inspectionResult.statusCode === 200 ? 'pass' : 'fail',
          note: `${inspectionResult.statusCode} ${inspectionResult.statusText} (${inspectionResult.responseTimeMs} ms)`,
        };
      case 1: // Redirects & Chain Loops
        return {
          status: inspectionResult.redirected ? 'warning' : 'pass',
          note: inspectionResult.redirected
            ? `${inspectionResult.redirectCount} hop(s) detected`
            : 'Direct 200 OK (0 redirects)',
        };
      case 2: // Canonical Tags & Self-References
        return {
          status: inspectionResult.canonical.status,
          note: inspectionResult.canonical.hasCanonical
            ? inspectionResult.canonical.hasMobileParameter
              ? 'Warning: Points to ?m=1'
              : inspectionResult.canonical.isSelfReferential
              ? 'Valid self-referential'
              : 'Points to target canonical'
            : 'Missing canonical tag',
        };
      case 3: // Robots Directives & Meta
        return {
          status: inspectionResult.meta.hasNoindex ? 'fail' : 'pass',
          note: inspectionResult.meta.hasNoindex
            ? 'Blocked by noindex'
            : inspectionResult.meta.robotsDirectives.length > 0
            ? inspectionResult.meta.robotsDirectives.join(', ')
            : 'Indexable (Default)',
        };
      case 4: // Title Tags & Meta Descriptions
        return {
          status:
            inspectionResult.meta.titleStatus === 'pass' &&
            inspectionResult.meta.descriptionStatus === 'pass'
              ? 'pass'
              : 'warning',
          note: `Title: ${inspectionResult.meta.titleLength}c | Desc: ${inspectionResult.meta.descriptionLength}c`,
        };
      case 5: // Heading Structure
        return {
          status: inspectionResult.headings.status,
          note: `${inspectionResult.headings.h1Count} H1 | ${inspectionResult.headings.h2Count} H2 | ${inspectionResult.headings.h3Count} H3`,
        };
      case 6: // Link Extraction & Broken Links
        return {
          status: inspectionResult.links.status,
          note: `${inspectionResult.links.internalLinksCount} internal | ${inspectionResult.links.externalLinksCount} external`,
        };
      case 7: // Duplicate Titles & Meta
        return {
          status: inspectionResult.meta.titleStatus,
          note: inspectionResult.meta.title ? 'Title verified' : 'No title',
        };
      case 8: // Missing Image Alt Attributes
        return {
          status: inspectionResult.media.status,
          note:
            inspectionResult.media.imagesMissingAlt === 0
              ? `${inspectionResult.media.totalImages} images (All with Alt)`
              : `${inspectionResult.media.imagesMissingAlt} of ${inspectionResult.media.totalImages} missing alt`,
        };
      case 9: // Sitemap Availability
        return {
          status: robotsSitemapResult?.sitemapXml.status || 'pending',
          note: robotsSitemapResult
            ? `${robotsSitemapResult.sitemapXml.entryCount} URLs in sitemap`
            : 'Checking /sitemap.xml',
        };
      case 10: // robots.txt Directives
        return {
          status: robotsSitemapResult?.robotsTxt.status || 'pending',
          note: robotsSitemapResult
            ? robotsSitemapResult.robotsTxt.isDefaultBlogger
              ? 'Blogger Default (/search disallowed)'
              : 'Custom robots.txt active'
            : 'Checking robots.txt',
        };
      case 11: // HTML Validity & Viewport
        return {
          status: inspectionResult.meta.hasViewport ? 'pass' : 'warning',
          note: inspectionResult.meta.hasViewport ? 'Mobile viewport verified' : 'Missing viewport tag',
        };
      case 12: // URL Relationships & ?m=1 Mobile
        return {
          status:
            !inspectionResult.canonical.hasMobileParameter &&
            inspectionResult.links.linksWithMobileParam === 0
              ? 'pass'
              : 'warning',
          note:
            inspectionResult.canonical.hasMobileParameter
              ? 'Canonical has ?m=1'
              : inspectionResult.links.linksWithMobileParam > 0
              ? `${inspectionResult.links.linksWithMobileParam} ?m=1 internal link(s)`
              : 'Clean canonical & links',
        };
      default:
        return { status: 'pending', note: 'Pending' };
    }
  };

  const deterministicAudits = [
    {
      title: 'HTTP Status & Response Codes',
      spec: '200 OK verification, 404 dead endpoints, 5xx server errors, response latency benchmarks.',
    },
    {
      title: 'Redirects & Chain Loops',
      spec: '301 permanent vs 302 temporary redirects, redirect chain lengths, and infinite redirect loops.',
    },
    {
      title: 'Canonical Tags & Self-References',
      spec: 'rel="canonical" presence, self-referential canonical consistency, and mismatch with rendered URL.',
    },
    {
      title: 'Robots Directives & Meta Tags',
      spec: '<meta name="robots"> parsing (noindex, nofollow, noarchive, nosnippet), X-Robots-Tag headers.',
    },
    {
      title: 'Title Tags & Meta Descriptions',
      spec: 'Length constraints (45-65 chars for titles, 120-160 for descriptions), missing tags, truncation.',
    },
    {
      title: 'Heading Structure (H1 - H4)',
      spec: 'Single H1 enforcement, logical nesting order, empty heading tags, Blogger widget heading collisions.',
    },
    {
      title: 'Link Extraction & Broken Links',
      spec: 'Internal vs external link ratio, broken anchor targets (#), relative vs absolute URL consistency.',
    },
    {
      title: 'Duplicate Titles & Meta',
      spec: 'Exact-match title tag occurrences across post URLs, label archives, and pagination pages.',
    },
    {
      title: 'Missing Image Alt Attributes',
      spec: '<img> tags lacking alt descriptions, empty alt text, and Blogger CDN image rendering.',
    },
    {
      title: 'Sitemap Availability & Structure',
      spec: 'Presence of /sitemap.xml, XML schema validation, and URL freshness.',
    },
    {
      title: 'robots.txt Directives & Disallow Rules',
      spec: 'Syntax validation, Blogger default disallow patterns (/search crawl permissions), user-agent rules.',
    },
    {
      title: 'HTML Validity & Viewport',
      spec: 'Viewport meta definition, mobile viewport responsiveness, and clean document headers.',
    },
    {
      title: 'Blogger Mobile Parity & ?m=1',
      spec: 'Blogger ?m=1 mobile variant parameter containment, alternate tags, and canonical integrity.',
    },
  ];

  return (
    <div id="technical-audit-view" className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <Code2 className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Deterministic Technical HTML Audit Engine
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Factual, server-side DOM crawler specifically calibrated for Blogger & Blogspot architecture.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
          <span
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
              activeSite?.connections?.crawler
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            {activeSite?.connections?.crawler
              ? activeSite.healthStatus.technical || 'Crawler Active'
              : 'Technical: Not connected'}
          </span>
          {activeSite && (
            <button
              type="button"
              onClick={handleInspectRobotsAndSitemap}
              disabled={isInspectingRobots}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs disabled:opacity-60"
            >
              <RefreshCw className={`h-3 w-3 ${isInspectingRobots ? 'animate-spin' : ''}`} />
              <span>Audit Robots & Sitemap</span>
            </button>
          )}
        </div>
      </div>

      {/* URL Inspection Input & Selector Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="inspect-url-input" className="text-xs font-semibold text-slate-900 flex items-center space-x-1.5">
            <Search className="h-3.5 w-3.5 text-indigo-600" />
            <span>Target Page or Post URL</span>
          </label>
          <span className="text-[11px] text-slate-400">
            Domain: <strong className="text-slate-600">{activeSite ? activeSite.name : 'No active blog'}</strong>
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              id="inspect-url-input"
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://yourblog.blogspot.com/2024/05/article.html"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={isInspecting}
            />
          </div>

          <button
            id="run-url-inspection-btn"
            type="button"
            onClick={() => handleInspectUrl()}
            disabled={isInspecting || !targetUrl.trim()}
            className="inline-flex items-center justify-center space-x-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-60 shrink-0"
          >
            {isInspecting ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Auditing DOM...</span>
              </>
            ) : (
              <>
                <Code2 className="h-3.5 w-3.5" />
                <span>Run Inspection</span>
              </>
            )}
          </button>
        </div>

        {/* Quick select discovered posts/pages */}
        {discoveredUrls.length > 0 && (
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-[11px]">
            <span className="text-slate-400 shrink-0">Quick Pick:</span>
            {discoveredUrls.slice(0, 5).map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTargetUrl(item.url);
                  handleInspectUrl(item.url);
                }}
                disabled={isInspecting}
                className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                title={item.url}
              >
                {item.type === 'Home' ? 'Homepage' : item.title.length > 28 ? item.title.substring(0, 26) + '...' : item.title}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-700 flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Inspection Failed</p>
              <p className="mt-0.5 text-rose-600">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Inspection Results */}
      {inspectionResult && (
        <div id="inspection-results-panel" className="space-y-6">
          {/* Audit Summary Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center space-x-4">
                {/* Score badge circle */}
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-center font-bold shadow-xs ${
                    inspectionResult.overallScore >= 80
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : inspectionResult.overallScore >= 50
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  <div>
                    <span className="text-xl leading-none">{inspectionResult.overallScore}</span>
                    <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                      / 100
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex items-center space-x-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                        inspectionResult.overallStatus === 'pass'
                          ? 'bg-emerald-100 text-emerald-800'
                          : inspectionResult.overallStatus === 'warning'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {inspectionResult.overallStatus === 'pass' ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      <span>{inspectionResult.overallStatus.toUpperCase()}</span>
                    </span>

                    <span className="text-xs text-slate-400">
                      Audited {new Date(inspectionResult.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <a
                    href={inspectionResult.finalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center space-x-1 text-xs font-semibold text-slate-800 hover:text-indigo-600 break-all"
                  >
                    <span>{inspectionResult.finalUrl}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                  </a>

                  {inspectionResult.redirected && (
                    <p className="mt-0.5 text-[11px] text-amber-600 flex items-center space-x-1">
                      <Info className="h-3 w-3" />
                      <span>
                        Redirected from {inspectionResult.url} ({inspectionResult.redirectCount} hop
                        {inspectionResult.redirectCount > 1 ? 's' : ''})
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Fast Stats Row */}
              <div className="grid grid-cols-3 gap-3 sm:flex sm:items-center text-center">
                <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">
                    HTTP Code
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      inspectionResult.statusCode === 200 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {inspectionResult.statusCode} {inspectionResult.statusText}
                  </span>
                </div>

                <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">
                    Response Time
                  </span>
                  <span className="text-xs font-bold text-slate-700 flex items-center justify-center space-x-0.5">
                    <Timer className="h-3 w-3 text-slate-400" />
                    <span>{inspectionResult.responseTimeMs} ms</span>
                  </span>
                </div>

                <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">
                    Word Count
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    ~{inspectionResult.headings.wordCount} words
                  </span>
                </div>
              </div>
            </div>

            {/* Critical Issues Banner */}
            {inspectionResult.issues.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Actionable Findings ({inspectionResult.issues.length})
                </h5>
                <div className="space-y-2">
                  {inspectionResult.issues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`rounded-lg border p-3 text-xs ${
                        issue.severity === 'critical'
                          ? 'border-rose-200 bg-rose-50/50 text-rose-900'
                          : issue.severity === 'warning'
                          ? 'border-amber-200 bg-amber-50/50 text-amber-900'
                          : 'border-blue-200 bg-blue-50/50 text-blue-900'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {issue.severity === 'critical' ? (
                          <XCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                        ) : issue.severity === 'warning' ? (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        ) : (
                          <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <p className="font-semibold">{issue.title}</p>
                          <p className="text-[11px] leading-relaxed opacity-90">{issue.message}</p>
                          {issue.recommendation && (
                            <p className="text-[11px] font-medium pt-1 text-slate-700">
                              <strong>Recommendation:</strong> {issue.recommendation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Grouped Findings Accordion Panels */}
          <div className="space-y-3">
            {/* 1. Canonical & Blogger Mobile Parity */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => toggleSection('canonical')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <Smartphone className="h-4 w-4 text-indigo-600" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Blogger Mobile Canonical Parity & ?m=1 Containment
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Evaluates canonical tag integrity and mobile URL contamination.
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      inspectionResult.canonical.status === 'pass'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {inspectionResult.canonical.status.toUpperCase()}
                  </span>
                  {openSections.canonical ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {openSections.canonical && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/40 text-xs space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Canonical Link Tag
                      </span>
                      <p className="mt-1 font-mono text-[11px] text-slate-800 break-all">
                        {inspectionResult.canonical.canonicalHref || 'None (<link rel="canonical"> missing)'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                        <span
                          className={`rounded px-1.5 py-0.5 font-medium ${
                            inspectionResult.canonical.hasCanonical
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {inspectionResult.canonical.hasCanonical ? 'Tag Present' : 'Missing Tag'}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-medium ${
                            inspectionResult.canonical.isAbsolute
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {inspectionResult.canonical.isAbsolute ? 'Absolute URL' : 'Relative URL'}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-medium ${
                            inspectionResult.canonical.isSelfReferential
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {inspectionResult.canonical.isSelfReferential
                            ? 'Self-referential'
                            : 'Cross-URL Target'}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Mobile ?m=1 Parameter Integrity
                      </span>
                      <p
                        className={`mt-1 font-semibold ${
                          inspectionResult.canonical.hasMobileParameter
                            ? 'text-rose-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {inspectionResult.canonical.hasMobileParameter
                          ? 'FAIL: Canonical contains ?m=1 query parameter!'
                          : 'PASS: Canonical is clean (no ?m=1 leak)'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                        Blogger dynamically serves mobile views at <code>?m=1</code>. If your template
                        incorrectly sets the canonical tag to include <code>?m=1</code>, Google will index
                        both versions as competing duplicates.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Meta Tags & Directives */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => toggleSection('meta')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <FileCode className="h-4 w-4 text-indigo-600" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Meta Tags, Directives & Viewport
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Title tags, meta descriptions, robots indexing directives, and OpenGraph tags.
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      inspectionResult.meta.titleStatus === 'pass' &&
                      inspectionResult.meta.descriptionStatus === 'pass'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {inspectionResult.meta.titleStatus === 'pass' ? 'PASS' : 'WARNING'}
                  </span>
                  {openSections.meta ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {openSections.meta && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/40 text-xs space-y-3">
                  <div className="space-y-3">
                    {/* Title */}
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Title Tag ({inspectionResult.meta.titleLength} characters)
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            inspectionResult.meta.titleStatus === 'pass'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          Target: {inspectionResult.isHomepage ? '10–65 characters (Homepage Brand)' : '30–65 characters'}
                        </span>
                      </div>
                      <p className="mt-1 font-semibold text-slate-900">
                        {inspectionResult.meta.title || 'Missing <title> tag'}
                      </p>
                    </div>

                    {/* Description */}
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Meta Description ({inspectionResult.meta.descriptionLength} characters)
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            inspectionResult.meta.descriptionStatus === 'pass'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          Target: 120–160 characters
                        </span>
                      </div>
                      <p className="mt-1 text-slate-700">
                        {inspectionResult.meta.metaDescription || (
                          <span className="text-amber-600 italic">
                            No search description found. Enable "Search Description" in Blogger post settings.
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Directives & Viewport */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg bg-white p-3 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Meta Robots Directives
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                          {inspectionResult.meta.hasNoindex ? (
                            <span className="rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-800">
                              noindex (Blocks Google)
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                              index (Permitted)
                            </span>
                          )}
                          {inspectionResult.meta.hasNofollow && (
                            <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                              nofollow
                            </span>
                          )}
                          {inspectionResult.meta.hasNoarchive && (
                            <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                              noarchive
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg bg-white p-3 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Viewport Meta Tag
                        </span>
                        <p className="mt-1 font-mono text-[11px] text-slate-800 truncate">
                          {inspectionResult.meta.viewport || 'None detected'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Headings & Content Structure */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => toggleSection('headings')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Headings Hierarchy & Content Depth
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      H1 single-use verification, subheading density (H2–H4), and word count analysis.
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      inspectionResult.headings.status === 'pass'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {inspectionResult.headings.status.toUpperCase()}
                  </span>
                  {openSections.headings ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {openSections.headings && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/40 text-xs space-y-3">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">H1 Count</span>
                      <span
                        className={`text-sm font-bold ${
                          inspectionResult.headings.h1Count === 1 ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {inspectionResult.headings.h1Count}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">H2 Count</span>
                      <span className="text-sm font-bold text-slate-800">
                        {inspectionResult.headings.h2Count}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">H3 Count</span>
                      <span className="text-sm font-bold text-slate-800">
                        {inspectionResult.headings.h3Count}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">H4 Count</span>
                      <span className="text-sm font-bold text-slate-800">
                        {inspectionResult.headings.h4Count}
                      </span>
                    </div>
                  </div>

                  {inspectionResult.headings.h1Items.length > 0 && (
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Rendered H1 Tags Found ({inspectionResult.headings.h1Items.length}):
                      </span>
                      <ul className="space-y-1 text-slate-700 list-disc list-inside">
                        {inspectionResult.headings.h1Items.map((item, idx) => (
                          <li key={idx} className="font-medium text-[11px]">
                            {item}
                          </li>
                        ))}
                      </ul>
                      {inspectionResult.headings.h1Count > 1 && (
                        <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 p-2 rounded">
                          <strong>Blogger Template Note:</strong> Many classic themes wrap both the Blog Title
                          and Post Title in &lt;h1&gt;. Best practice is reserving &lt;h1&gt; exclusively for the
                          article title on post pages.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. Media & Images */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => toggleSection('media')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <ImageIcon className="h-4 w-4 text-indigo-600" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Image Accessibility & Missing Alt Attributes
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Audits &lt;img&gt; elements for empty or missing alt text.
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      inspectionResult.media.status === 'pass'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {inspectionResult.media.status.toUpperCase()}
                  </span>
                  {openSections.media ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {openSections.media && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/40 text-xs space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Images</span>
                      <span className="text-sm font-bold text-slate-800">
                        {inspectionResult.media.totalImages}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">With Alt Text</span>
                      <span className="text-sm font-bold text-emerald-700">
                        {inspectionResult.media.imagesWithAlt}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Missing Alt</span>
                      <span
                        className={`text-sm font-bold ${
                          inspectionResult.media.imagesMissingAlt === 0
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {inspectionResult.media.imagesMissingAlt}
                      </span>
                    </div>
                  </div>

                  {inspectionResult.media.missingAltSources.length > 0 && (
                    <div className="rounded-lg bg-white p-3 border border-slate-200 space-y-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Images Lacking Alt Text (First {inspectionResult.media.missingAltSources.length}):
                      </span>
                      <ul className="space-y-1 font-mono text-[10px] text-slate-600 break-all">
                        {inspectionResult.media.missingAltSources.map((src, idx) => (
                          <li key={idx} className="bg-slate-50 p-1.5 rounded border border-slate-100">
                            {src}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 5. Links Analysis */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => toggleSection('links')}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <Link2 className="h-4 w-4 text-indigo-600" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Links & Anchor Graph Analysis
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Internal vs external balance, empty anchors, and mobile query links.
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      inspectionResult.links.status === 'pass'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {inspectionResult.links.status.toUpperCase()}
                  </span>
                  {openSections.links ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {openSections.links && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/40 text-xs space-y-3">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Links</span>
                      <span className="text-sm font-bold text-slate-800">
                        {inspectionResult.links.totalLinks}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Internal</span>
                      <span className="text-sm font-bold text-emerald-700">
                        {inspectionResult.links.internalLinksCount}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">External</span>
                      <span className="text-sm font-bold text-indigo-700">
                        {inspectionResult.links.externalLinksCount}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">?m=1 Links</span>
                      <span
                        className={`text-sm font-bold ${
                          inspectionResult.links.linksWithMobileParam === 0
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {inspectionResult.links.linksWithMobileParam}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Crawl Directives: Robots.txt & Sitemap.xml Inspection Panel */}
      {robotsSitemapResult && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-900">
                Site Crawl Directives: robots.txt & sitemap.xml
              </h4>
            </div>
            <span className="text-[11px] text-slate-400">
              Verified {new Date(robotsSitemapResult.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* robots.txt Card */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">robots.txt</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    robotsSitemapResult.robotsTxt.status === 'pass'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  HTTP {robotsSitemapResult.robotsTxt.statusCode}
                </span>
              </div>
              <p className="text-xs text-slate-600">{robotsSitemapResult.robotsTxt.message}</p>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  {robotsSitemapResult.robotsTxt.disallowRules.length} disallow rules
                </span>
                <button
                  type="button"
                  onClick={() => setShowRawRobots(!showRawRobots)}
                  className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {showRawRobots ? 'Hide raw rules' : 'View raw rules'}
                </button>
              </div>

              {showRawRobots && robotsSitemapResult.robotsTxt.content && (
                <pre className="p-2.5 bg-slate-900 text-slate-100 rounded text-[10px] font-mono overflow-x-auto">
                  {robotsSitemapResult.robotsTxt.content}
                </pre>
              )}
            </div>

            {/* sitemap.xml Card */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">sitemap.xml</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    robotsSitemapResult.sitemapXml.status === 'pass'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  HTTP {robotsSitemapResult.sitemapXml.statusCode}
                </span>
              </div>
              <p className="text-xs text-slate-600">{robotsSitemapResult.sitemapXml.message}</p>

              {robotsSitemapResult.sitemapXml.sampleUrls.length > 0 && (
                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
                  <span className="font-semibold text-slate-700 block">Sample Indexed URLs:</span>
                  <ul className="space-y-0.5 font-mono text-[10px] truncate">
                    {robotsSitemapResult.sitemapXml.sampleUrls.slice(0, 3).map((u, i) => (
                      <li key={i} className="truncate">
                        {u}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Audit Checklist Grid (13 Rules Matrix) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Deterministic Inspection Rules ({deterministicAudits.length} Checks)
          </h4>
          <span className="text-[11px] text-slate-400">
            Target: {activeSite ? activeSite.name : 'Select or register a site'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {deterministicAudits.map((item, idx) => {
            const evalState = getRuleEvaluation(idx);
            return (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">{item.title}</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        evalState.status === 'pass'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : evalState.status === 'warning'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : evalState.status === 'fail'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-50 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {evalState.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed">{item.spec}</p>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Status</span>
                  <span
                    className={`font-semibold ${
                      evalState.status === 'pass'
                        ? 'text-emerald-700'
                        : evalState.status === 'fail'
                        ? 'text-rose-700'
                        : evalState.status === 'warning'
                        ? 'text-amber-700'
                        : 'text-slate-500'
                    }`}
                  >
                    {evalState.note}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Architecture Note */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <h5 className="font-semibold text-slate-800 mb-1">
          Separation of Deterministic Code and Gemini AI
        </h5>
        <p className="text-[11px] leading-relaxed text-slate-500">
          In Wander Within Site Intelligence, deterministic code handles the factual, binary
          measurements (status codes, canonical parity, missing alt attributes, heading hierarchies). Gemini
          is reserved for interpreting cross-post semantic relationships and root cause diagnosis.
        </p>
      </div>
    </div>
  );
};
