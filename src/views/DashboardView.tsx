import React, { useState, useEffect } from 'react';
import {
  Compass,
  Code2,
  Layers,
  Link2,
  DollarSign,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Globe,
  Sparkles,
  ExternalLink,
  FileText,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { SiteModel, NavigationTab, AiDiagnosisResult } from '../types';

interface DashboardViewProps {
  activeSite: SiteModel | null;
  onOpenAddSite: () => void;
  onOpenConnectGoogle: () => void;
  onSelectTab: (tab: NavigationTab) => void;
  onNavigatePrivacy?: () => void;
  onNavigateTerms?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  activeSite,
  onOpenAddSite,
  onOpenConnectGoogle,
  onSelectTab,
  onNavigatePrivacy,
  onNavigateTerms,
}) => {
  const [latestDiagnosis, setLatestDiagnosis] = useState<AiDiagnosisResult | null>(null);
  const [latestAdSenseReport, setLatestAdSenseReport] = useState<any>(null);

  useEffect(() => {
    if (!activeSite) {
      setLatestDiagnosis(null);
      setLatestAdSenseReport(null);
      return;
    }
    let isMounted = true;
    Promise.allSettled([
      fetch(`/api/ai/diagnose/latest?siteId=${encodeURIComponent(activeSite.id)}`).then((r) => r.json()),
      fetch(`/api/adsense/readiness/latest?siteId=${encodeURIComponent(activeSite.id)}`).then((r) => r.json()),
    ])
      .then(([diagRes, adRes]) => {
        if (!isMounted) return;
        if (diagRes.status === 'fulfilled' && diagRes.value.success && diagRes.value.result) {
          setLatestDiagnosis(diagRes.value.result);
        }
        if (adRes.status === 'fulfilled' && adRes.value.success && adRes.value.report) {
          setLatestAdSenseReport(adRes.value.report);
        }
      })
      .catch((e) => console.warn('Error fetching latest diagnosis/adsense for dashboard:', e));

    return () => {
      isMounted = false;
    };
  }, [activeSite]);

  const isGscConnected = Boolean(activeSite?.connections?.searchConsole);
  const gscStatusDisplay = isGscConnected
    ? (activeSite?.gscMetrics && activeSite.gscMetrics.impressions > 0
        ? `${activeSite.gscMetrics.clicks.toLocaleString()} clicks · ${activeSite.gscMetrics.impressions.toLocaleString()} imp`
        : activeSite?.gscProperty
        ? 'Verified · Active'
        : 'Connected')
    : 'Not connected';

  const isCrawlerActive = Boolean(
    activeSite?.connections?.crawler ||
    (activeSite?.healthStatus?.technical && activeSite.healthStatus.technical !== 'Not connected')
  );
  const technicalStatusDisplay = isCrawlerActive
    ? activeSite?.healthStatus?.technical || 'Audited · Active'
    : 'Not connected';

  const isInternalLinkingActive = Boolean(
    activeSite?.healthStatus?.internalLinking &&
    activeSite?.healthStatus?.internalLinking !== 'Not connected'
  );
  const internalLinkingStatusDisplay = isInternalLinkingActive
    ? activeSite?.healthStatus?.internalLinking || 'Audited'
    : 'Not connected';

  const isContentActive = Boolean(
    activeSite?.healthStatus?.content &&
    activeSite?.healthStatus?.content !== 'Not connected'
  );
  const contentStatusDisplay = isContentActive
    ? activeSite?.healthStatus?.content || 'Audited'
    : 'Not connected';

  const healthCards = [
    {
      id: 'metric-indexing',
      category: 'Indexing',
      status: gscStatusDisplay,
      isConnected: isGscConnected,
      icon: Compass,
      desc: isGscConnected
        ? `Verified Search Console property: ${activeSite?.gscProperty || activeSite?.url}. Live performance reporting and coverage tracking active.`
        : 'Google indexing status, coverage errors, canonical parity, and mobile ?m=1 crawl diagnostics.',
      targetTab: 'search_console' as NavigationTab,
    },
    {
      id: 'metric-technical',
      category: 'Technical',
      status: technicalStatusDisplay,
      isConnected: isCrawlerActive,
      icon: Code2,
      desc: isCrawlerActive
        ? `Deterministic HTML auditor active. Score: ${activeSite?.lastAuditScore ?? 100}/100 with verified status codes, canonicals, and DOM hierarchy.`
        : 'HTTP codes, redirect chains, Blogger robots.txt directives, title tags, headings, and HTML structure.',
      targetTab: 'technical_audit' as NavigationTab,
    },
    {
      id: 'metric-content',
      category: 'Content',
      status: contentStatusDisplay,
      isConnected: isContentActive,
      icon: Layers,
      desc: isContentActive
        ? `Deterministic content metrics verified. Body word count: ${activeSite?.healthStatus?.content}.`
        : 'Article topic overlap, duplicate titles, thin content risk, and search intent alignment.',
      targetTab: 'content_analysis' as NavigationTab,
    },
    {
      id: 'metric-internal-linking',
      category: 'Internal Linking',
      status: internalLinkingStatusDisplay,
      isConnected: isInternalLinkingActive,
      icon: Link2,
      desc: isInternalLinkingActive
        ? `Link analysis verified. Link inventory: ${activeSite?.healthStatus?.internalLinking}.`
        : 'Orphan post detection, internal anchor text distribution, and Blogger archive/label link integrity.',
      targetTab: 'technical_audit' as NavigationTab,
    },
    {
      id: 'metric-adsense-readiness',
      category: 'AdSense Readiness',
      status: latestAdSenseReport
        ? `${latestAdSenseReport.readinessScore}% · ${
            latestAdSenseReport.readinessStatus === 'ready'
              ? 'Ready'
              : latestAdSenseReport.readinessStatus === 'needs_improvement'
              ? 'Needs Improvement'
              : 'Action Required'
          }`
        : activeSite?.healthStatus?.adsenseReadiness && activeSite.healthStatus.adsenseReadiness !== 'Not connected'
        ? activeSite.healthStatus.adsenseReadiness
        : 'Not audited',
      isConnected: Boolean(latestAdSenseReport || (activeSite?.healthStatus?.adsenseReadiness && activeSite.healthStatus.adsenseReadiness !== 'Not connected')),
      icon: DollarSign,
      desc: latestAdSenseReport
        ? `Readiness score: ${latestAdSenseReport.readinessScore}/100. ads.txt: ${latestAdSenseReport.checks.adsTxt.status.toUpperCase()}, Trust pages: ${latestAdSenseReport.checks.trustPages.foundCount}/4.`
        : 'ads.txt file presence, navigation completeness, privacy policy compliance, and template clean-state.',
      targetTab: 'adsense' as NavigationTab,
    },
  ];

  return (
    <div id="dashboard-view" className="space-y-8">
      {/* Primary Section: SITE HEALTH (Always visible with 5 mandatory diagnostic cards) */}
      <section id="site-health-section" aria-labelledby="site-health-heading">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2
              id="site-health-heading"
              className="text-[10px] font-bold uppercase tracking-widest text-slate-400"
            >
              Site Health
            </h2>
          </div>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            Strict Real-State
          </span>
        </div>

        {/* The 5 Required Site Health Cards in Clean Minimalism layout */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {healthCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                id={card.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {card.category}
                    </p>
                    <Icon className="h-4 w-4 text-slate-300" />
                  </div>

                  {/* Mandated exact "Not connected" indicator or live active state */}
                  <div className="mt-2 flex items-baseline space-x-1.5">
                    {card.isConnected && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 self-center" />
                    )}
                    <span
                      id={`${card.id}-status`}
                      className={`text-sm ${
                        card.isConnected
                          ? 'font-semibold text-emerald-700'
                          : 'font-medium text-slate-400'
                      }`}
                    >
                      {card.status}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-3">
                    {card.desc}
                  </p>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-2.5">
                  <button
                    type="button"
                    onClick={() => onSelectTab(card.targetTab)}
                    className="flex w-full items-center justify-between text-[11px] font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    <span>View Specifications</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Main Center Area: Active Site Overview vs Empty State */}
      {!activeSite ? (
        <div
          id="dashboard-empty-state"
          className="flex flex-col items-center justify-center bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center"
        >
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
            <Globe className="w-8 h-8 text-slate-300" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            No Site Data Available
          </h2>
          <p className="text-slate-500 max-w-sm mb-8 text-sm">
            Connect your Google Account to begin analyzing your Blogger sites, search console performance, and AdSense readiness with evidence-based diagnostics.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              id="empty-state-add-site-btn"
              type="button"
              onClick={onOpenAddSite}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Register Blogger Site</span>
            </button>
            <button
              id="empty-state-connect-google-btn"
              type="button"
              onClick={onOpenConnectGoogle}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
            >
              <span className="font-bold">G</span>
              <span>Connect Google Account</span>
            </button>
          </div>

          {/* Public Legal Links for Google OAuth Verification Compliance */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center space-x-4 text-xs text-slate-400">
            <a
              id="welcome-privacy-link"
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                onNavigatePrivacy?.();
              }}
              className="text-slate-500 hover:text-indigo-600 hover:underline transition-colors"
            >
              Privacy Policy
            </a>
            <span className="text-slate-300">•</span>
            <a
              id="welcome-terms-link"
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                onNavigateTerms?.();
              }}
              className="text-slate-500 hover:text-indigo-600 hover:underline transition-colors"
            >
              Terms of Service
            </a>
          </div>
        </div>
      ) : (
        /* When active site is selected: Show Active Site Overview card */
        <div className="space-y-6">
          <div
            id="active-site-overview-card"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-start space-x-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-indigo-600 border border-slate-200">
                  <Globe className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {activeSite.name}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                      {activeSite.platform === 'blogger_subdomain' ? 'Blogspot Subdomain' : 'Custom Domain'}
                    </span>
                    {activeSite.connections.blogger && (
                      <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Blogger API Synced</span>
                      </span>
                    )}
                  </div>
                  <a
                    href={activeSite.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center space-x-1 font-mono text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    <span>{activeSite.url}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:mt-0">
                <button
                  id="inspect-blogger-btn"
                  type="button"
                  onClick={() => onSelectTab('blogger')}
                  className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Inspect Content & Posts</span>
                </button>
                <button
                  id="inspect-gsc-btn"
                  type="button"
                  onClick={() => onSelectTab('search_console')}
                  className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <Compass className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Search Console</span>
                </button>
                <button
                  id="inspect-technical-btn"
                  type="button"
                  onClick={() => onSelectTab('technical_audit')}
                  className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span>Technical Checks</span>
                </button>
              </div>
            </div>

            {/* Diagnostic Signals Grid */}
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Blogger API v3
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeSite.connections.blogger ? (
                    <span className="text-emerald-700 flex items-center space-x-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Connected</span>
                    </span>
                  ) : (
                    <span className="text-slate-500">Ready to Connect</span>
                  )}
                </p>
                <span className="text-[11px] text-slate-500">
                  {activeSite.postsCount !== undefined
                    ? `${activeSite.postsCount} posts · ${activeSite.pagesCount || 0} pages`
                    : 'Read-only content access'}
                </span>
              </div>

              <div
                className={`rounded-xl border p-3.5 transition-colors ${
                  activeSite.connections.searchConsole
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-slate-100 bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Search Console
                  </span>
                  {activeSite.connections.searchConsole && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeSite.connections.searchConsole ? (
                    <span className="text-emerald-700">Verified & Synced</span>
                  ) : (
                    <span className="text-slate-400">Not connected</span>
                  )}
                </p>
                <span className="text-[11px] text-slate-500 truncate block">
                  {activeSite.connections.searchConsole
                    ? activeSite.gscProperty || 'Property matched'
                    : 'Connect GSC in Google Account'}
                </span>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  AdSense Readiness
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-400">
                  Not connected
                </p>
                <span className="text-[11px] text-slate-500">Phase 4 Policy Scope</span>
              </div>

              <div
                className={`rounded-xl border p-3.5 transition-colors ${
                  activeSite.connections.crawler
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-slate-100 bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    HTML Inspector
                  </span>
                  {activeSite.connections.crawler && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {activeSite.connections.crawler ? (
                    <span className="text-emerald-700">
                      Score: {activeSite.lastAuditScore ?? 100}/100
                    </span>
                  ) : (
                    <span className="text-slate-600">Audit Ready</span>
                  )}
                </p>
                <span className="text-[11px] text-slate-500">
                  {activeSite.connections.crawler
                    ? `${activeSite.auditedPagesCount || 1} page(s) audited`
                    : 'Deterministic HTML parsing'}
                </span>
              </div>
            </div>

            {/* Live 28-day Search Performance metrics directly on active site overview banner */}
            {activeSite.connections.searchConsole && activeSite.gscMetrics && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      28-Day Google Search Performance
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                      Live Search Console
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectTab('search_console')}
                    className="inline-flex items-center space-x-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    <span>View Top Queries & Sitemaps</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Search Clicks
                    </span>
                    <p className="text-xl font-bold text-slate-900 mt-0.5">
                      {activeSite.gscMetrics.clicks.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Search Impressions
                    </span>
                    <p className="text-xl font-bold text-slate-900 mt-0.5">
                      {activeSite.gscMetrics.impressions.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Average CTR
                    </span>
                    <p className="text-xl font-bold text-slate-900 mt-0.5">
                      {(activeSite.gscMetrics.ctr * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Average Position
                    </span>
                    <p className="text-xl font-bold text-slate-900 mt-0.5">
                      {activeSite.gscMetrics.position.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Diagnostic Spotlight Card (Primary Bottleneck & Signals) */}
          <div
            id="dashboard-ai-diagnostic-spotlight"
            className="rounded-2xl border border-indigo-100 bg-linear-to-r from-indigo-50/50 via-white to-indigo-50/20 p-5 sm:p-6 shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-indigo-100/60 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Gemini Diagnostic Reasoning Spotlight
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Synthesizing crawler inspection facts, canonical directives, and Search Console signals.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectTab('ai_diagnosis')}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-xs transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
              >
                <span>{latestDiagnosis ? 'Open Full AI Diagnosis' : 'Run Diagnostic Reasoning'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {latestDiagnosis ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-start space-x-3 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                      Primary Bottleneck
                    </span>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      {latestDiagnosis.primaryBottleneck || 'Under Evaluation'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                  {latestDiagnosis.overallAssessment || 'Diagnostic evaluation completed.'}
                </p>

                {/* Confidence Counts Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                  <span className="text-slate-400 font-medium">Confidence Signals:</span>
                  <span className="inline-flex items-center space-x-1 rounded bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>
                      {(latestDiagnosis.findings || []).filter((f) => f?.confidence === 'CONFIRMED').length} Confirmed
                    </span>
                  </span>
                  <span className="inline-flex items-center space-x-1 rounded bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 border border-indigo-200">
                    <Sparkles className="h-3 w-3" />
                    <span>
                      {(latestDiagnosis.findings || []).filter((f) => f?.confidence === 'LIKELY').length} Likely
                    </span>
                  </span>
                  <span className="inline-flex items-center space-x-1 rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 border border-amber-200">
                    <AlertTriangle className="h-3 w-3" />
                    <span>
                      {(latestDiagnosis.findings || []).filter((f) => f?.confidence === 'POSSIBLE').length} Possible
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
                <p>
                  No reasoning analysis executed yet for <strong>{activeSite?.name || 'this site'}</strong>. Trigger Gemini reasoning to synthesize crawl facts, discover hidden canonical bottlenecks, and generate actionable remediation steps.
                </p>
                <button
                  type="button"
                  onClick={() => onSelectTab('ai_diagnosis')}
                  className="font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap cursor-pointer"
                >
                  Synthesize Reasoning &rarr;
                </button>
              </div>
            )}
          </div>

          {/* Evidence Architecture Panels */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Deterministic Engine */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center space-x-2.5 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-50 text-slate-700">
                  <Code2 className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Deterministic Parsing Engine
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Standard deterministic code conducts verified inspections before any reasoning:
              </p>
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span>HTTP status & redirects</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span>Canonical tags & ?m=1</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span>Robots meta directives</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span>H1-H6 heading structure</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span>Missing alt attributes</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span>Sitemap & robots.txt</span>
                </li>
              </ul>
            </div>

            {/* Gemini AI Reasoning Layer */}
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex items-center space-x-2.5 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Gemini AI Reasoning Layer
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Gemini is reserved exclusively for higher-order reasoning. Every conclusion is strictly assigned a confidence level:
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <span className="font-semibold text-slate-900 text-xs">Confirmed</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Verified by deterministic data</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <span className="font-semibold text-slate-900 text-xs">Likely</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Strong multi-signal corroboration</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <span className="font-semibold text-slate-900 text-xs">Possible</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Plausible contributing factor</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <span className="font-semibold text-slate-900 text-xs">Unknown</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Proprietary search engine factor</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* System Note Banner */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-indigo-900">System Note</h3>
            <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
              Diagnostics operate in strict read-only mode. We will never modify your Blogger posts, pages, or search settings. Connect your account to enable site intelligence.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
