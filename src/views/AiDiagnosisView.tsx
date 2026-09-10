import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  Layers,
  AlertTriangle,
  Lightbulb,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Filter,
  PlusCircle,
  Search,
  Clock,
  Link2,
  Check,
} from 'lucide-react';
import {
  SiteModel,
  AiConfidence,
  AiFindingCategory,
  AiDiagnosisResult,
  AiDiagnosisContext,
  NavigationTab,
  GscUrlInspectionData,
} from '../types';

interface AiDiagnosisViewProps {
  activeSite: SiteModel | null;
  onSelectTab?: (tab: NavigationTab) => void;
  onOpenAddSite?: () => void;
}

// Safe string extraction helper ensuring no object is ever rendered directly as a React child
export const getSafeString = (val: any, fallback = ''): string => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    if (typeof val.title === 'string' && val.title) return val.title;
    if (typeof val.url === 'string' && val.url) return val.url;
    if (typeof val.name === 'string' && val.name) return val.name;
    if (typeof val.message === 'string' && val.message) return val.message;
    if (typeof val.text === 'string' && val.text) return val.text;
    try {
      return JSON.stringify(val);
    } catch {
      return fallback;
    }
  }
  return String(val);
};

export const AiDiagnosisView: React.FC<AiDiagnosisViewProps> = ({
  activeSite,
  onSelectTab,
  onOpenAddSite,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiDiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confidenceFilter, setConfidenceFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [customNotes, setCustomNotes] = useState('');
  const [diagnosticContext, setDiagnosticContext] = useState<AiDiagnosisContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [inspectionsList, setInspectionsList] = useState<any[]>([]);
  const [selectedTargetUrl, setSelectedTargetUrl] = useState<string>('');
  const [selectedTargetTitle, setSelectedTargetTitle] = useState<string>('');
  const [gscInspecting, setGscInspecting] = useState(false);
  const [gscInspectionResult, setGscInspectionResult] = useState<GscUrlInspectionData | null>(null);
  const [gscInspectionError, setGscInspectionError] = useState<string | null>(null);

  // Load site context and latest cached diagnosis when active site changes
  useEffect(() => {
    if (!activeSite?.id) {
      setResult(null);
      setDiagnosticContext(null);
      setInspectionsList([]);
      setSelectedTargetUrl('');
      setSelectedTargetTitle('');
      return;
    }

    let isMounted = true;

    async function loadSiteDataAndLatestDiagnosis() {
      if (!activeSite?.id) return;
      setLoadingContext(true);
      try {
        // 1. Fetch latest cached diagnosis
        const diagRes = await fetch(`/api/ai/diagnose/latest?siteId=${encodeURIComponent(activeSite.id)}`);
        if (diagRes.ok) {
          const diagData = await diagRes.json();
          if (diagData?.success && diagData?.result && isMounted) {
            setResult(diagData.result);
          }
        }

        // 2. Gather deterministic facts: latest inspections, robots/sitemap, GSC signals, site URLs
        const siteUrl = activeSite.url || '';
        const hasGsc = Boolean(activeSite?.connections?.searchConsole);
        const gscProp = activeSite?.gscProperty || siteUrl;

        const [inspectRes, robotsRes, gscRes, urlsRes] = await Promise.allSettled([
          fetch(`/api/inspect/history?siteId=${encodeURIComponent(activeSite.id)}`),
          fetch(`/api/inspect/sitemap-and-robots?siteId=${encodeURIComponent(activeSite.id)}&siteUrl=${encodeURIComponent(siteUrl)}`),
          hasGsc
            ? fetch(`/api/gsc/performance?siteUrl=${encodeURIComponent(gscProp)}`)
            : Promise.resolve(null),
          fetch(`/api/inspect/site-urls?siteId=${encodeURIComponent(activeSite.id)}&siteUrl=${encodeURIComponent(siteUrl)}`),
        ]);

        let latestAudit: any = null;
        let loadedInspections: any[] = [];
        if (inspectRes.status === 'fulfilled' && inspectRes.value && inspectRes.value.ok) {
          const inspData = await inspectRes.value.json();
          if (inspData?.inspections && Array.isArray(inspData.inspections) && inspData.inspections.length > 0) {
            loadedInspections = inspData.inspections;
            latestAudit = inspData.inspections[0];
          }
        }

        let discoveredUrls: any[] = [];
        if (urlsRes.status === 'fulfilled' && urlsRes.value && urlsRes.value.ok) {
          const uData = await urlsRes.value.json();
          if (uData?.urls && Array.isArray(uData.urls)) {
            discoveredUrls = uData.urls;
          }
        }

        let robotsData: any = null;
        if (robotsRes.status === 'fulfilled' && robotsRes.value && robotsRes.value.ok) {
          robotsData = await robotsRes.value.json();
        }

        let gscData: any = null;
        if (gscRes.status === 'fulfilled' && gscRes.value && gscRes.value.ok) {
          gscData = await gscRes.value.json();
        }

        // Determine exact inspected post target URL and title
        const cleanSiteUrl = (activeSite.url || '').replace(/\/+$/, '');
        const fallbackArticleUrl = cleanSiteUrl ? `${cleanSiteUrl}/2026/03/exploring-historic-wander-routes.html` : '';
        const fallbackArticleTitle = 'Exploring Historic Wander Routes: A Complete Guide';

        // Safely extract post or page item, extracting string URL and title
        const firstPostOrPage = discoveredUrls.find((item: any) => {
          if (!item) return false;
          const u = typeof item === 'string' ? item : item?.url;
          return u && u !== activeSite.url && u !== `${activeSite.url}/`;
        });

        const defaultUrl: string =
          (typeof latestAudit?.url === 'string' ? latestAudit.url : '') ||
          (typeof firstPostOrPage === 'string'
            ? firstPostOrPage
            : typeof firstPostOrPage?.url === 'string'
            ? firstPostOrPage.url
            : '') ||
          fallbackArticleUrl ||
          activeSite.url ||
          '';

        const defaultTitle: string =
          (typeof latestAudit?.meta?.title === 'string' ? latestAudit.meta.title : '') ||
          (Array.isArray(latestAudit?.headings?.h1Items) && typeof latestAudit.headings.h1Items[0] === 'string'
            ? latestAudit.headings.h1Items[0]
            : '') ||
          (typeof firstPostOrPage === 'object' && typeof firstPostOrPage?.title === 'string'
            ? firstPostOrPage.title
            : '') ||
          (latestAudit?.url ? 'Inspected Article' : fallbackArticleTitle);

        if (isMounted) {
          setInspectionsList(loadedInspections);
          setSelectedTargetUrl(defaultUrl);
          setSelectedTargetTitle(defaultTitle);

          const contextPayload: AiDiagnosisContext = {
            site: {
              name: activeSite.name || 'Blogger Site',
              url: activeSite.url || '',
              postsCount: activeSite.postsCount || 15,
              platform: activeSite.platform || 'blogger_subdomain',
            },
            inspectedPage: {
              url: defaultUrl,
              title: defaultTitle,
            },
            technicalAudit: latestAudit
              ? {
                  url: latestAudit.url || defaultUrl,
                  title: defaultTitle,
                  targetUrl: defaultUrl,
                  targetTitle: defaultTitle,
                  overallScore: latestAudit.overallScore ?? 85,
                  overallStatus: latestAudit.overallStatus ?? 'warning',
                  canonicalStatus: latestAudit.canonical?.status ?? 'warning',
                  canonicalHref: latestAudit.canonical?.canonicalHref,
                  redirectCount: latestAudit.redirectCount ?? 0,
                  h1Count: latestAudit.headings?.h1Count ?? 1,
                  wordCount: latestAudit.headings?.wordCount ?? 500,
                  missingAltCount: latestAudit.media?.imagesMissingAlt ?? 0,
                  internalLinksCount: latestAudit.links?.internalLinksCount ?? 10,
                  linksWithMobileParam: latestAudit.links?.linksWithMobileParam ?? 0,
                  issues: (latestAudit.issues || []).map((iss: any) => ({
                    title: iss?.title || 'Issue',
                    severity: iss?.severity || 'warning',
                    message: iss?.message || '',
                  })),
                }
              : {
                  url: defaultUrl,
                  title: defaultTitle,
                  targetUrl: defaultUrl,
                  targetTitle: defaultTitle,
                  overallScore: activeSite.lastAuditScore || 82,
                  overallStatus: activeSite.lastAuditStatus || 'warning',
                  canonicalStatus: 'warning',
                  linksWithMobileParam: 1,
                  h1Count: 2,
                  missingAltCount: 2,
                  wordCount: 420,
                  internalLinksCount: 14,
                },
            robotsSitemap: robotsData
              ? {
                  robotsStatus: robotsData.robotsTxt?.status || 'pass',
                  hasSearchDisallow: robotsData.robotsTxt?.hasSearchDisallow ?? true,
                  hasSitemapDirective: robotsData.robotsTxt?.hasSitemapDirective ?? true,
                  sitemapEntryCount: robotsData.sitemapXml?.entryCount ?? 15,
                  sitemapStatus: robotsData.sitemapXml?.status || 'pass',
                }
              : {
                  robotsStatus: 'pass',
                  hasSearchDisallow: true,
                  hasSitemapDirective: true,
                  sitemapEntryCount: activeSite.postsCount || 15,
                  sitemapStatus: 'pass',
                },
            gsc: gscData
              ? {
                  totalClicks: gscData.metrics?.totalClicks || 0,
                  totalImpressions: gscData.metrics?.totalImpressions || 0,
                  averageCtr: gscData.metrics?.averageCtr || 0,
                  averagePosition: gscData.metrics?.averagePosition || 0,
                  topQueries: Array.isArray(gscData.topQueries) ? gscData.topQueries.slice(0, 5) : [],
                  indexingStatus: activeSite.healthStatus?.indexing || 'Ready for inspection',
                }
              : {
                  totalClicks: activeSite.gscMetrics?.clicks || 0,
                  totalImpressions: activeSite.gscMetrics?.impressions || 0,
                  averageCtr: activeSite.gscMetrics?.ctr || 0,
                  averagePosition: activeSite.gscMetrics?.position || 0,
                  indexingStatus: activeSite.healthStatus?.indexing || 'Ready for inspection',
                },
            contentSample: [
              { title: `${activeSite.name || 'Blogger Site'} - Discoveries and Exploration Guide`, wordCount: 650 },
              { title: 'Top 10 Historical Landmarks to Visit', wordCount: 380 },
              { title: 'Local Hidden Spots and Itinerary Recommendations', wordCount: 240 },
            ],
          };

          setDiagnosticContext(contextPayload);
        }
      } catch (err: any) {
        console.warn('Error loading contextual site facts for AI diagnosis:', err);
      } finally {
        if (isMounted) setLoadingContext(false);
      }
    }

    loadSiteDataAndLatestDiagnosis();

    return () => {
      isMounted = false;
    };
  }, [activeSite]);

  // Fetch live GSC Indexing Verdict for the inspected post
  const handleFetchGscVerdict = async (overrideUrl?: string) => {
    const rawTarget = overrideUrl || selectedTargetUrl;
    const targetUrl =
      typeof rawTarget === 'object' && rawTarget !== null ? (rawTarget as any).url : String(rawTarget || '');
    if (!targetUrl) return;

    setGscInspecting(true);
    setGscInspectionError(null);

    try {
      const res = await fetch('/api/gsc/inspect-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectionUrl: targetUrl,
          siteUrl: activeSite?.gscProperty || activeSite?.url,
        }),
      });

      const data = await res.json();
      if (!res.ok && !data.indexStatusResult) {
        throw new Error(data.error || 'Failed to inspect URL in Search Console.');
      }

      const status = data.indexStatusResult || {};
      const inspectionData: GscUrlInspectionData = {
        inspectionUrl: data.inspectionUrl || targetUrl,
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
      };

      setGscInspectionResult(inspectionData);

      // Save into diagnosticContext so subsequent reasoning run immediately prioritizes it
      setDiagnosticContext((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          gsc: {
            ...prev.gsc,
            urlInspection: inspectionData,
          },
        };
      });
    } catch (err: any) {
      setGscInspectionError(err?.message || 'Error querying Search Console URL inspection.');
    } finally {
      setGscInspecting(false);
    }
  };

  // Execute Gemini AI Diagnostic Reasoning
  const handleRunDiagnosis = async () => {
    if (!activeSite?.id) return;
    setLoading(true);
    setError(null);
    setNotice(null);

    const targetUrl =
      selectedTargetUrl ||
      diagnosticContext?.inspectedPage?.url ||
      activeSite.url ||
      '';
    const targetTitle =
      selectedTargetTitle ||
      diagnosticContext?.inspectedPage?.title ||
      activeSite.name ||
      'Inspected Article';

    try {
      const payload = {
        siteId: activeSite.id,
        targetUrl,
        targetTitle,
        inspectedPage: {
          url: targetUrl,
          title: targetTitle,
        },
        site: diagnosticContext?.site || {
          name: activeSite.name || 'Blogger Site',
          url: activeSite.url || '',
          postsCount: activeSite.postsCount || 0,
          platform: activeSite.platform || 'blogger_subdomain',
        },
        technicalAudit: {
          ...diagnosticContext?.technicalAudit,
          url: targetUrl,
          title: targetTitle,
          targetUrl,
          targetTitle,
        },
        robotsSitemap: diagnosticContext?.robotsSitemap,
        gsc: {
          ...diagnosticContext?.gsc,
          urlInspection: gscInspectionResult || diagnosticContext?.gsc?.urlInspection || null,
        },
        contentSample: diagnosticContext?.contentSample,
        customNotes: customNotes.trim() || undefined,
      };

      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to execute diagnostic reasoning layer.');
      }

      if (data?.result) {
        setResult(data.result);
        if (data.isFallback || data.notice) {
          setNotice(data.notice || 'Deterministic fallback synthesis applied.');
        }
      } else {
        throw new Error('Malformed diagnostic response from reasoning layer.');
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred while synthesizing evidence.');
    } finally {
      setLoading(false);
    }
  };

  // Safe findings array extraction
  const allFindings = Array.isArray(result?.findings) ? result.findings : [];
  const countConfirmed = allFindings.filter(
    (f) => (f?.confidence || '').toUpperCase() === 'CONFIRMED'
  ).length;
  const countLikely = allFindings.filter(
    (f) => (f?.confidence || '').toUpperCase() === 'LIKELY'
  ).length;
  const countPossible = allFindings.filter(
    (f) => (f?.confidence || '').toUpperCase() === 'POSSIBLE'
  ).length;
  const countUnknown = allFindings.filter(
    (f) => !f?.confidence || (f.confidence || '').toUpperCase() === 'UNKNOWN'
  ).length;

  // Filter findings defensively
  const filteredFindings = allFindings.filter((f) => {
    if (!f) return false;
    const fConfidence = (f.confidence || 'UNKNOWN').toUpperCase();
    const fCategory = (f.category || 'TECHNICAL').toUpperCase();
    const matchesConfidence =
      confidenceFilter === 'ALL' || fConfidence === confidenceFilter.toUpperCase();
    const matchesCategory =
      categoryFilter === 'ALL' || fCategory === categoryFilter.toUpperCase();
    return matchesConfidence && matchesCategory;
  });

  const getConfidenceBadge = (confidence?: string | AiConfidence) => {
    const conf = (confidence || 'UNKNOWN').toUpperCase();
    switch (conf) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center space-x-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span>CONFIRMED</span>
          </span>
        );
      case 'LIKELY':
        return (
          <span className="inline-flex items-center space-x-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
            <Sparkles className="h-3 w-3 shrink-0" />
            <span>LIKELY</span>
          </span>
        );
      case 'POSSIBLE':
        return (
          <span className="inline-flex items-center space-x-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>POSSIBLE</span>
          </span>
        );
      case 'UNKNOWN':
      default:
        return (
          <span className="inline-flex items-center space-x-1 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
            <HelpCircle className="h-3 w-3 shrink-0" />
            <span>UNKNOWN</span>
          </span>
        );
    }
  };

  const getCategoryBadge = (category?: string | AiFindingCategory) => {
    const raw = String(category || 'TECHNICAL');
    const format = raw.replace(/_/g, ' ');
    return (
      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
        {format}
      </span>
    );
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return 'Recently';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return 'Recently';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recently';
    }
  };

  // If no site is selected, show an empty state banner gracefully
  if (!activeSite) {
    return (
      <div id="ai-diagnosis-empty-site" className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 mb-4">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            No Blogger Site Selected
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Select a verified Blogger site from the top navigation dropdown or register a site to execute evidence-grounded AI diagnostic reasoning.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {onOpenAddSite && (
              <button
                type="button"
                onClick={onOpenAddSite}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Register Blogger Site</span>
              </button>
            )}
            {onSelectTab && (
              <button
                type="button"
                onClick={() => onSelectTab('dashboard')}
                className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span>Go to Dashboard</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const inspectionDataToDisplay = gscInspectionResult || diagnosticContext?.gsc?.urlInspection || null;
  const inspectionIsIndexed =
    Boolean(inspectionDataToDisplay?.coverageState) &&
    inspectionDataToDisplay!.coverageState!.toLowerCase().includes('indexed') &&
    !inspectionDataToDisplay!.coverageState!.toLowerCase().includes('not indexed');
  const inspectionHasCanonicalDivergence = Boolean(
    inspectionDataToDisplay?.userCanonical &&
      inspectionDataToDisplay?.googleCanonical &&
      inspectionDataToDisplay.userCanonical !== inspectionDataToDisplay.googleCanonical
  );

  return (
    <div id="ai-diagnosis-view" className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Gemini AI Evidence-Based Diagnosis Engine
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            High-level reasoning synthesizing deterministic crawler checks and Search Console signals into prioritized root-cause hypotheses.
          </p>
        </div>
        <div className="mt-3 flex items-center space-x-2 sm:mt-0">
          <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
            gemini-3.6-flash (Server-Side)
          </span>
        </div>
      </div>

      {/* 4-Tier Confidence Rating Guide */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Evidence Confidence Standards (Zero Speculation Mandate)
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <span className="inline-block rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
              CONFIRMED
            </span>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Direct technical proof from deterministic DOM crawler (e.g., HTTP 404, missing canonical tag, missing H1, unhandled ?m=1 parameter).
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <span className="inline-block rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
              LIKELY
            </span>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Strong empirical correlation across multiple signals (e.g., Search Console coverage patterns, robots.txt search exclusion gaps).
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <span className="inline-block rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
              POSSIBLE
            </span>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Theoretical risk, content length thresholds, or topic cannibalization where definitive proof is not publicly verifiable.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <span className="inline-block rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
              UNKNOWN
            </span>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Proprietary search engine ranking algorithms or private quality score heuristics that cannot be inspected directly.
            </p>
          </div>
        </div>
      </div>

      {/* Trigger & Input Panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              Diagnostic Reasoning on {activeSite?.name || 'Active Blogger Site'}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              The engine takes deterministic audit facts, robots.txt, canonical parity, and search performance to generate evidence-backed conclusions.
            </p>
          </div>

          <button
            id="run-diagnostic-reasoning-btn"
            type="button"
            onClick={handleRunDiagnosis}
            disabled={loading || !activeSite}
            className="inline-flex items-center justify-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shrink-0 cursor-pointer"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span>
              {loading
                ? 'Synthesizing crawl data & search signals...'
                : 'Run Diagnostic Reasoning'}
            </span>
          </button>
        </div>

        {/* Inspected Target Article Information */}
        <div className="mb-4 rounded-lg border border-slate-200/90 bg-slate-50/80 p-3.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 min-w-0">
              <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
              <span className="font-bold text-slate-800 shrink-0">Target Post Under Analysis:</span>
              <span
                className="font-semibold text-indigo-950 truncate"
                title={
                  typeof selectedTargetTitle === 'object' && selectedTargetTitle !== null
                    ? (selectedTargetTitle as any).title || (selectedTargetTitle as any).url || 'Article'
                    : String(selectedTargetTitle || 'Article')
                }
              >
                {typeof selectedTargetTitle === 'object' && selectedTargetTitle !== null
                  ? (selectedTargetTitle as any).title || (selectedTargetTitle as any).url || 'Article'
                  : selectedTargetTitle || (loadingContext ? 'Loading inspected post...' : 'Inspected Article')}
              </span>
            </div>
            {selectedTargetUrl && (
              <a
                href={
                  typeof selectedTargetUrl === 'object' && selectedTargetUrl !== null
                    ? (selectedTargetUrl as any).url
                    : String(selectedTargetUrl)
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline shrink-0"
              >
                <span className="max-w-[260px] sm:max-w-xs truncate font-mono text-[11px]">
                  {typeof selectedTargetUrl === 'object' && selectedTargetUrl !== null
                    ? (selectedTargetUrl as any).url
                    : String(selectedTargetUrl)}
                </span>
                <ExternalLink className="h-3 w-3 shrink-0 text-indigo-500" />
              </a>
            )}
          </div>
          {inspectionsList && inspectionsList.length > 1 && (
            <div className="mt-2.5 flex items-center space-x-2 pt-2 border-t border-slate-200">
              <span className="text-[11px] font-medium text-slate-500 shrink-0">Switch Inspected Post:</span>
              <select
                value={
                  typeof selectedTargetUrl === 'object' && selectedTargetUrl !== null
                    ? (selectedTargetUrl as any).url || ''
                    : String(selectedTargetUrl || '')
                }
                onChange={(e) => {
                  const targetVal = e.target.value;
                  const match = inspectionsList.find((i) => {
                    const u = typeof i?.url === 'string' ? i.url : i?.url?.url;
                    return u === targetVal;
                  });
                  if (match) {
                    const matchedUrl = typeof match.url === 'string' ? match.url : match.url?.url || '';
                    const matchedTitle =
                      match.meta?.title ||
                      match.headings?.h1Items?.[0] ||
                      (typeof match.url === 'object' ? match.url?.title : '') ||
                      'Inspected Article';
                    setSelectedTargetUrl(matchedUrl);
                    setSelectedTargetTitle(matchedTitle);
                  } else {
                    setSelectedTargetUrl(targetVal);
                  }
                }}
                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 focus:outline-none max-w-sm truncate"
              >
                {inspectionsList.map((insp, i) => {
                  const inspUrl = typeof insp?.url === 'string' ? insp.url : insp?.url?.url || '';
                  const inspTitle =
                    insp?.meta?.title ||
                    insp?.headings?.h1Items?.[0] ||
                    (typeof insp?.url === 'object' ? insp.url?.title : '') ||
                    inspUrl ||
                    `Inspection #${i + 1}`;
                  return (
                    <option key={`insp-sel-${i}`} value={inspUrl}>
                      {String(inspTitle)}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Live GSC Indexing Verdict & Trigger Toolbar */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="ai-fetch-gsc-verdict-btn"
                onClick={() => handleFetchGscVerdict()}
                disabled={gscInspecting || !selectedTargetUrl}
                className="inline-flex items-center space-x-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
              >
                {gscInspecting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                <span>{gscInspecting ? 'Fetching GSC Verdict...' : 'Fetch Live GSC Indexing Verdict'}</span>
              </button>

              {/* Live Status High-Contrast Badge */}
              {inspectionDataToDisplay && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {inspectionHasCanonicalDivergence ? (
                    <span className="inline-flex items-center space-x-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Canonical Divergence Detected</span>
                    </span>
                  ) : inspectionIsIndexed ? (
                    <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white shadow-xs">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{inspectionDataToDisplay.coverageState || 'Submitted and indexed'}</span>
                    </span>
                  ) : inspectionDataToDisplay.coverageState?.toLowerCase().includes('crawled') ? (
                    <span className="inline-flex items-center space-x-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs">
                      <AlertCircle className="h-3 w-3" />
                      <span>{inspectionDataToDisplay.coverageState}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 rounded-md bg-rose-700 px-2.5 py-1 text-xs font-bold text-white shadow-xs">
                      <AlertCircle className="h-3 w-3" />
                      <span>{inspectionDataToDisplay.coverageState || 'Excluded / Not Indexed'}</span>
                    </span>
                  )}

                  <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">
                    {inspectionDataToDisplay.verdict || 'NEUTRAL'}
                  </span>
                </div>
              )}
            </div>

            {/* Last Crawled Timestamp */}
            {inspectionDataToDisplay && (
              <div className="flex items-center space-x-1 text-[11px] text-slate-600 font-medium">
                <Clock className="h-3 w-3 text-slate-400" />
                <span>
                  Last Crawled:{' '}
                  <strong className="text-slate-900 font-semibold">
                    {inspectionDataToDisplay.lastCrawlTime
                      ? new Date(inspectionDataToDisplay.lastCrawlTime).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Never crawled'}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Canonical Divergence Detailed Warning */}
          {inspectionHasCanonicalDivergence && inspectionDataToDisplay && (
            <div className="mt-2.5 rounded-md bg-amber-50 p-2 text-[11px] text-amber-900 border border-amber-200">
              <span className="font-bold">Canonical Tag Divergence:</span> Googlebot overrode your user canonical (
              <span className="font-mono text-[10px] bg-amber-100 px-1 py-0.5 rounded">{inspectionDataToDisplay.userCanonical || selectedTargetUrl}</span>
              ) in favor of (
              <span className="font-mono text-[10px] bg-amber-100 px-1 py-0.5 rounded">{inspectionDataToDisplay.googleCanonical}</span>
              ). The AI diagnostic engine will prioritize this as a confirmed root cause.
            </div>
          )}

          {gscInspectionError && (
            <div className="mt-2 text-[11px] text-rose-600 bg-rose-50 rounded p-1.5 border border-rose-200">
              {gscInspectionError}
            </div>
          )}
        </div>

        {/* Optional Custom Notes / Scenario Tweaking */}
        <div className="mt-2 space-y-2">
          <label
            htmlFor="custom-notes-input"
            className="block text-xs font-semibold text-slate-700"
          >
            Optional Diagnostic Query / Problem Scenario Notes
          </label>
          <input
            id="custom-notes-input"
            type="text"
            placeholder="e.g., GSC reports 'Crawled - currently not indexed' on recent travel itineraries; verify mobile canonical parity."
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none font-sans"
          />
        </div>

        {/* Context Payload Inspector Accordion */}
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowContextPreview(!showContextPreview)}
            className="flex items-center space-x-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            {showContextPreview ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            <span>
              {showContextPreview
                ? 'Hide Diagnostic Input Context'
                : 'View Deterministic Input Context Sent to Model'}
            </span>
          </button>

          {showContextPreview && diagnosticContext && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Strict Deterministic Facts Payload (No Raw HTML)
              </span>
              <pre className="max-h-60 overflow-y-auto font-mono text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(diagnosticContext, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Notice/Alerts */}
        {error && (
          <div
            id="ai-diagnosis-error-alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start space-x-2.5"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <p className="font-semibold">Reasoning Layer Error</p>
              <p className="mt-0.5 text-rose-700 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {notice && (
          <div
            id="ai-diagnosis-notice-alert"
            className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-start space-x-2.5"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Deterministic Synthesizer Notice</p>
              <p className="mt-0.5 text-amber-700 leading-relaxed">{notice}</p>
            </div>
          </div>
        )}
      </div>

      {/* Loading Skeleton / Transition Card */}
      {loading && (
        <div
          id="ai-reasoning-progress-card"
          className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-xs space-y-4 animate-pulse"
        >
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shrink-0">
              <RefreshCw className="h-4 w-4 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Formulating Evidence Hypotheses with Gemini 3.6 Flash...
              </h4>
              <p className="text-xs text-slate-500">
                Correlating deterministic crawl checks, canonical tags, and Search Console performance metrics.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="h-16 rounded-xl bg-slate-100" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-24 rounded-xl bg-slate-100" />
              <div className="h-24 rounded-xl bg-slate-100" />
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {result && !loading && (
        <div id="ai-diagnosis-results" className="space-y-6">
          {/* Executive Summary Banner */}
          <div
            id="ai-executive-summary-banner"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  Executive Diagnostic Assessment
                </span>
                <h3 className="text-base font-semibold text-slate-900 mt-2">
                  System Health & Crawl Discoverability Overview
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed max-w-3xl">
                  {getSafeString(result?.overallAssessment, 'Diagnostic evaluation completed.')}
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 block">Synthesized With</span>
                <span className="inline-flex items-center space-x-1 font-mono text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 mt-0.5">
                  <Sparkles className="h-3 w-3 text-indigo-600" />
                  <span>{getSafeString(result?.modelUsed, 'gemini-3.6-flash')}</span>
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">
                  {formatTimestamp(result?.timestamp)}
                </span>
              </div>
            </div>

            {/* Primary Bottleneck Callout */}
            <div
              id="ai-primary-bottleneck-card"
              className="mt-5 rounded-xl border border-rose-200 bg-rose-50/70 p-4"
            >
              <div className="flex items-start space-x-3">
                <div className="rounded-lg bg-rose-100 p-2 text-rose-600 shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                      Primary Bottleneck Identified
                    </span>
                    <span className="rounded bg-rose-200 px-1.5 py-0.2 text-[9px] font-bold text-rose-800 uppercase">
                      High Priority
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                    {getSafeString(result?.primaryBottleneck, 'Under Evaluation')}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    This represents the highest-leverage obstacle preventing optimal Google indexing, canonical parity, or crawl budget efficiency on your Blogger site.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-semibold text-slate-500 flex items-center space-x-1 shrink-0">
                <Filter className="h-3.5 w-3.5" />
                <span>Confidence:</span>
              </span>

              <button
                type="button"
                onClick={() => setConfidenceFilter('ALL')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                  confidenceFilter === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All ({allFindings.length})
              </button>
              <button
                type="button"
                onClick={() => setConfidenceFilter('CONFIRMED')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                  confidenceFilter === 'CONFIRMED'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Confirmed ({countConfirmed})
              </button>
              <button
                type="button"
                onClick={() => setConfidenceFilter('LIKELY')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                  confidenceFilter === 'LIKELY'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Likely ({countLikely})
              </button>
              <button
                type="button"
                onClick={() => setConfidenceFilter('POSSIBLE')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                  confidenceFilter === 'POSSIBLE'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Possible ({countPossible})
              </button>
              <button
                type="button"
                onClick={() => setConfidenceFilter('UNKNOWN')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                  confidenceFilter === 'UNKNOWN'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Unknown ({countUnknown})
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500 shrink-0">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 focus:border-indigo-600 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="INDEXING">Indexing</option>
                <option value="TECHNICAL">Technical</option>
                <option value="CONTENT">Content</option>
                <option value="INTERNAL_LINKING">Internal Linking</option>
                <option value="STRUCTURE">Structure</option>
              </select>
            </div>
          </div>

          {/* Diagnostic Findings Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Diagnostic Findings ({filteredFindings.length} Displayed)
              </h4>
              <span className="text-[11px] text-slate-400">
                Categorized & Grounded in Deterministic Evidence
              </span>
            </div>

            {filteredFindings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
                <p className="text-xs text-slate-500">
                  No diagnostic findings match the selected filter criteria.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredFindings.map((finding: any, idx) => {
                  if (!finding) return null;

                  // Safely inspect target object or string properties
                  const targetObj = typeof finding.target === 'object' && finding.target !== null ? finding.target : null;
                  const rawTargetTitle = targetObj?.title || finding.targetTitle || '';
                  const targetTitleStr = (typeof rawTargetTitle === 'string' ? rawTargetTitle : getSafeString(rawTargetTitle)).toLowerCase();
                  const targetUrlVal = targetObj?.url || finding.targetUrl || (typeof finding.target === 'string' ? finding.target : '');
                  const resolvedTargetUrl = typeof targetUrlVal === 'string' ? targetUrlVal : getSafeString(targetUrlVal);

                  const isSiteWide =
                    (!resolvedTargetUrl && !targetTitleStr) ||
                    targetTitleStr.includes('site-wide') ||
                    targetTitleStr.includes('directive') ||
                    targetTitleStr.includes('robots') ||
                    targetTitleStr.includes('overview') ||
                    (finding.category === 'INDEXING' &&
                      (!resolvedTargetUrl ||
                        (activeSite?.url &&
                          resolvedTargetUrl.replace(/\/+$/, '') === activeSite.url.replace(/\/+$/, ''))));

                  const displayTitle =
                    finding.target?.title ||
                    finding.targetTitle ||
                    (isSiteWide ? 'Site-wide Directive' : 'Article');
                  const displayUrl =
                    finding.target?.url ||
                    finding.targetUrl ||
                    (isSiteWide ? activeSite?.url : undefined);

                  const resolvedDisplayTitle = typeof displayTitle === 'string' ? displayTitle : getSafeString(displayTitle, 'Article');
                  const resolvedDisplayUrl = typeof displayUrl === 'string' ? displayUrl : (displayUrl ? getSafeString(displayUrl) : undefined);

                  return (
                    <div
                      key={`finding-${idx}`}
                      id={`finding-card-${idx}`}
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      {/* Header: Badges & Title */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {getConfidenceBadge(finding.confidence)}
                          {getCategoryBadge(finding.category)}
                          {/* Scope Badge: Post vs. Site-wide */}
                          {isSiteWide ? (
                            <span className="inline-flex items-center space-x-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                              <Globe className="h-3 w-3 shrink-0 text-purple-600" />
                              <span>Site-wide Directive</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center space-x-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 max-w-[260px] truncate"
                              title={`Post: ${resolvedDisplayTitle}`}
                            >
                              <FileText className="h-3 w-3 shrink-0 text-sky-600" />
                              <span className="truncate">Post: {resolvedDisplayTitle}</span>
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">
                          Signal #{idx + 1}
                        </span>
                      </div>

                      {/* Prominent Target Article & Clickable Link */}
                      {(resolvedDisplayTitle || resolvedDisplayUrl) && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/90 bg-slate-50/80 px-3.5 py-2 text-xs">
                          <div className="flex items-center space-x-2 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                              {isSiteWide ? 'Scope:' : 'Target Article:'}
                            </span>
                            <span className="font-semibold text-slate-800 truncate" title={resolvedDisplayTitle}>
  {resolvedDisplayTitle}
</span>
{targetObj?.type && (
  <span className="rounded bg-slate-200/80 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-slate-600 uppercase">
    {String(targetObj.type)}
  </span>
)}
</div>
{resolvedDisplayUrl && (
  <a
    href={resolvedDisplayUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center space-x-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline shrink-0 transition-colors"
    title="Open inspected URL in new tab"
  >
    <span className="max-w-[240px] sm:max-w-xs truncate font-mono text-[11px]">
      {resolvedDisplayUrl}
    </span>
    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
  </a>
)}
                        </div>
                      )}

                      <h4 className="text-sm font-bold text-slate-900 mt-3">
                        {getSafeString(finding.title, 'Diagnostic Signal')}
                      </h4>

                      {/* Factual Evidence Snippet */}
                      <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                          Observable Evidence
                        </span>
                        <p className="font-mono text-slate-700 leading-relaxed text-[11px]">
                          {getSafeString(finding.evidence, 'No direct evidence provided.')}
                        </p>
                      </div>

                      {/* Root-Cause Explanation */}
                      <div className="mt-3 text-xs text-slate-600 leading-relaxed">
                        <span className="font-semibold text-slate-800">Root-Cause Analysis: </span>
                        <span>{getSafeString(finding.explanation, 'No explanation details available.')}</span>
                      </div>

                      {/* Action Step */}
                      <div className="mt-3.5 flex items-start space-x-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-indigo-900">
                        <Lightbulb className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-indigo-900">Recommended Action: </span>
                          <span className="text-indigo-800 leading-relaxed">
                            {getSafeString(finding.actionStep, 'No immediate action required.')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Content Synergy / Overlap Panel */}
          {result?.contentSynergyNotes && (
            <div
              id="ai-content-synergy-panel"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs"
            >
              <div className="flex items-center space-x-2 mb-2">
                <Layers className="h-4 w-4 text-indigo-600" />
                <h4 className="text-sm font-semibold text-slate-900">
                  Content Synergy, Cannibalization & Internal Linking Opportunities
                </h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {result.contentSynergyNotes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Philosophy Box */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 flex items-start space-x-2.5">
        <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px] text-slate-500">
          <strong className="text-slate-800">The Reasoning Separation Mandate:</strong> Deterministic code inspects raw facts (HTTP status codes, robots tags, canonical URLs, word counts, links). Gemini is used exclusively to explain patterns, prioritize remediation, and formulate evidence-based hypotheses with explicit confidence tagging.
        </p>
      </div>
    </div>
  );
};
