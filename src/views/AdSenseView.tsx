import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ExternalLink,
  HelpCircle,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Compass,
  ArrowRight,
  Shield,
  Layers,
  Code2,
  Lock,
} from 'lucide-react';
import {
  SiteModel,
  AdSenseReadinessReport,
  AdSenseAiPolicyReview,
  AiConfidence,
} from '../types';

interface AdSenseViewProps {
  activeSite: SiteModel | null;
  onOpenConnectGoogle: () => void;
}

export const AdSenseView: React.FC<AdSenseViewProps> = ({
  activeSite,
  onOpenConnectGoogle,
}) => {
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [runningAiReview, setRunningAiReview] = useState(false);
  const [report, setReport] = useState<AdSenseReadinessReport | null>(null);
  const [aiReview, setAiReview] = useState<AdSenseAiPolicyReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adsenseAccountStatus, setAdsenseAccountStatus] = useState<any>(null);
  const [customNotes, setCustomNotes] = useState('');
  const [showRawAdsTxt, setShowRawAdsTxt] = useState(false);

  // Load existing reports on site change
  useEffect(() => {
    if (!activeSite) {
      setReport(null);
      setAiReview(null);
      return;
    }

    let isMounted = true;

    async function loadLatestData() {
      try {
        const [repRes, aiRes, accRes] = await Promise.allSettled([
          fetch(`/api/adsense/readiness/latest?siteId=${encodeURIComponent(activeSite!.id)}`),
          fetch(`/api/adsense/ai-policy-review/latest?siteId=${encodeURIComponent(activeSite!.id)}`),
          fetch('/api/adsense/account-status'),
        ]);

        if (repRes.status === 'fulfilled' && repRes.value.ok) {
          const d = await repRes.value.json();
          if (d.success && d.report && isMounted) {
            setReport(d.report);
          }
        }

        if (aiRes.status === 'fulfilled' && aiRes.value.ok) {
          const d = await aiRes.value.json();
          if (d.success && d.review && isMounted) {
            setAiReview(d.review);
          }
        }

        if (accRes.status === 'fulfilled' && accRes.value.ok) {
          const d = await accRes.value.json();
          if (isMounted) {
            setAdsenseAccountStatus(d);
          }
        }
      } catch (e) {
        console.warn('Error fetching AdSense inspection data:', e);
      }
    }

    loadLatestData();

    return () => {
      isMounted = false;
    };
  }, [activeSite]);

  // Trigger Deterministic Readiness Audit
  const handleRunReadinessAudit = async () => {
    if (!activeSite) return;
    setCheckingReadiness(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/adsense/check-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: activeSite.id,
          siteUrl: activeSite.url,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete AdSense readiness check.');
      }

      if (data.report) {
        setReport(data.report);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during AdSense evaluation.');
    } finally {
      setCheckingReadiness(false);
    }
  };

  // Trigger Gemini AI Policy Review
  const handleRunAiPolicyReview = async () => {
    if (!activeSite) return;
    setRunningAiReview(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/adsense/ai-policy-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: activeSite.id,
          report: report || undefined,
          customNotes: customNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute AI policy review.');
      }

      if (data.review) {
        setAiReview(data.review);
        if (data.isFallback || data.notice) {
          setNotice(data.notice || 'Deterministic policy synthesis used.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during Gemini AI policy analysis.');
    } finally {
      setRunningAiReview(false);
    }
  };

  const getStatusPill = (status: 'pass' | 'warning' | 'fail') => {
    switch (status) {
      case 'pass':
        return (
          <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span>PASS</span>
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center space-x-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>WARNING</span>
          </span>
        );
      case 'fail':
      default:
        return (
          <span className="inline-flex items-center space-x-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>ATTENTION REQUIRED</span>
          </span>
        );
    }
  };

  const getConfidenceBadge = (conf: AiConfidence) => {
    switch (conf) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center space-x-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            <span>CONFIRMED</span>
          </span>
        );
      case 'LIKELY':
        return (
          <span className="inline-flex items-center space-x-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
            <Sparkles className="h-3 w-3" />
            <span>LIKELY</span>
          </span>
        );
      case 'POSSIBLE':
        return (
          <span className="inline-flex items-center space-x-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3 w-3" />
            <span>POSSIBLE</span>
          </span>
        );
      case 'UNKNOWN':
      default:
        return (
          <span className="inline-flex items-center space-x-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
            <HelpCircle className="h-3 w-3" />
            <span>UNKNOWN</span>
          </span>
        );
    }
  };

  return (
    <div id="adsense-view" className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Google AdSense Readiness & Policy Inspector
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Evidence-based pre-application audit combining deterministic Blogger policy checks with Gemini AI Publisher Policy reasoning.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
          <button
            id="run-adsense-audit-btn"
            type="button"
            onClick={handleRunReadinessAudit}
            disabled={checkingReadiness || !activeSite}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {checkingReadiness ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            <span>{checkingReadiness ? 'Auditing Policies...' : 'Run Readiness Audit'}</span>
          </button>

          <button
            id="run-ai-policy-review-btn"
            type="button"
            onClick={handleRunAiPolicyReview}
            disabled={runningAiReview || !activeSite}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
          >
            {runningAiReview ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            )}
            <span>{runningAiReview ? 'Synthesizing Policy...' : 'Gemini Policy Review'}</span>
          </button>
        </div>
      </div>

      {/* Alert Notices */}
      {error && (
        <div
          id="adsense-error-alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-start space-x-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <p className="font-semibold">Inspection Issue</p>
            <p className="mt-0.5 text-rose-700 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {notice && (
        <div
          id="adsense-notice-alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-start space-x-2.5"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold">Synthesizer Notice</p>
            <p className="mt-0.5 text-amber-700 leading-relaxed">{notice}</p>
          </div>
        </div>
      )}

      {!activeSite ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h4 className="text-sm font-semibold text-slate-800">
            No Active Site Selected
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Register or select a Blogger site to inspect its AdSense readiness and policy compliance.
          </p>
        </div>
      ) : !report ? (
        /* Empty / Invitation State before first audit */
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <DollarSign className="h-7 w-7" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-slate-900">
              AdSense Readiness Audit for {activeSite.name}
            </h4>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
              Verify your custom ads.txt directives, legal trust pages (Privacy Policy, About, Contact), content volume, and robots.txt crawler access to prevent common Blogger AdSense rejections.
            </p>
          </div>
          <div>
            <button
              id="initial-readiness-audit-btn"
              type="button"
              onClick={handleRunReadinessAudit}
              disabled={checkingReadiness}
              className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors"
            >
              {checkingReadiness ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>
                {checkingReadiness
                  ? 'Running Deterministic Policy Audit...'
                  : 'Start AdSense Readiness Audit'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        /* Live Readiness Scorecard & Audit Details */
        <div className="space-y-6">
          {/* Readiness Scorecard Hero */}
          <div
            id="adsense-readiness-scorecard"
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center space-x-4">
                <div
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl font-mono text-xl font-bold border ${
                    report.readinessScore >= 80
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : report.readinessScore >= 55
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {report.readinessScore}%
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        report.readinessScore >= 80
                          ? 'bg-emerald-100 text-emerald-800'
                          : report.readinessScore >= 55
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {report.readinessStatus === 'ready'
                        ? 'Ready for Submission'
                        : report.readinessStatus === 'needs_improvement'
                        ? 'Policy Improvements Recommended'
                        : 'Critical Rejection Risks Identified'}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      Score: {report.readinessScore}/100
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 mt-1">
                    {activeSite.name} AdSense Readiness Status
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Evaluated across ads.txt, 4 trust pages, article volume, Mediapartners-Google crawler, and navigation.
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <span className="text-[10px] text-slate-400 block">Last Evaluated</span>
                <span className="font-mono text-xs font-semibold text-slate-700 block mt-0.5">
                  {new Date(report.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <a
                  href={report.siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 font-mono text-[11px] text-indigo-600 hover:underline inline-flex items-center space-x-1"
                >
                  <span>{report.siteUrl}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* 5 Deterministic Checks Checklist */}
            <div className="mt-6 space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Deterministic Policy Criteria Breakdown
              </h4>

              <div className="grid grid-cols-1 gap-3">
                {/* Check 1: ads.txt */}
                <div
                  id="check-ads-txt"
                  className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <Code2 className="h-4 w-4 text-indigo-600 shrink-0" />
                      <h5 className="text-xs font-bold text-slate-900">
                        1. Authorized Digital Sellers (ads.txt) Verification
                      </h5>
                    </div>
                    <div>{getStatusPill(report.checks.adsTxt.status)}</div>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    {report.checks.adsTxt.message}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                      URL: {report.checks.adsTxt.url}
                    </span>
                    {report.checks.adsTxt.publisherId && (
                      <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        Publisher ID: {report.checks.adsTxt.publisherId}
                      </span>
                    )}
                    {report.checks.adsTxt.contentSnippet && (
                      <button
                        type="button"
                        onClick={() => setShowRawAdsTxt(!showRawAdsTxt)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        {showRawAdsTxt ? 'Hide ads.txt' : 'View File Snippet'}
                      </button>
                    )}
                  </div>

                  {showRawAdsTxt && report.checks.adsTxt.contentSnippet && (
                    <pre className="mt-2 rounded-lg bg-slate-50 p-2.5 font-mono text-[11px] text-slate-700 overflow-x-auto border border-slate-100">
                      {report.checks.adsTxt.contentSnippet}
                    </pre>
                  )}

                  {report.checks.adsTxt.status !== 'pass' && (
                    <div className="mt-3 rounded-lg bg-indigo-50/70 p-3 text-xs text-indigo-900 border border-indigo-100">
                      <strong className="block text-indigo-950">How to configure in Blogger:</strong>
                      <p className="mt-0.5 text-indigo-800 leading-relaxed text-[11px]">
                        In your Blogger Admin dashboard, navigate to <strong>Settings &gt; Monetization</strong>, toggle on <strong>Enable custom ads.txt</strong>, and enter your verified seller line: <code className="bg-white px-1 py-0.5 rounded font-mono text-indigo-950">google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0</code>.
                      </p>
                    </div>
                  )}
                </div>

                {/* Check 2: Mandatory Trust Pages */}
                <div
                  id="check-trust-pages"
                  className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <Shield className="h-4 w-4 text-indigo-600 shrink-0" />
                      <h5 className="text-xs font-bold text-slate-900">
                        2. Mandatory Legal & Trust Pages (Found {report.checks.trustPages.foundCount}/4)
                      </h5>
                    </div>
                    <div>{getStatusPill(report.checks.trustPages.status)}</div>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    {report.checks.trustPages.message}
                  </p>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div
                      className={`rounded-lg border p-2.5 ${
                        report.checks.trustPages.privacyPolicy.found
                          ? 'border-emerald-200 bg-emerald-50/50'
                          : 'border-rose-200 bg-rose-50/50'
                      }`}
                    >
                      <span className="font-semibold text-slate-900 text-xs block">
                        Privacy Policy
                      </span>
                      <span
                        className={`text-[11px] font-medium block mt-0.5 ${
                          report.checks.trustPages.privacyPolicy.found
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {report.checks.trustPages.privacyPolicy.found ? 'Detected' : 'Missing'}
                      </span>
                    </div>

                    <div
                      className={`rounded-lg border p-2.5 ${
                        report.checks.trustPages.aboutUs.found
                          ? 'border-emerald-200 bg-emerald-50/50'
                          : 'border-rose-200 bg-rose-50/50'
                      }`}
                    >
                      <span className="font-semibold text-slate-900 text-xs block">About Us</span>
                      <span
                        className={`text-[11px] font-medium block mt-0.5 ${
                          report.checks.trustPages.aboutUs.found
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {report.checks.trustPages.aboutUs.found ? 'Detected' : 'Missing'}
                      </span>
                    </div>

                    <div
                      className={`rounded-lg border p-2.5 ${
                        report.checks.trustPages.contact.found
                          ? 'border-emerald-200 bg-emerald-50/50'
                          : 'border-rose-200 bg-rose-50/50'
                      }`}
                    >
                      <span className="font-semibold text-slate-900 text-xs block">Contact</span>
                      <span
                        className={`text-[11px] font-medium block mt-0.5 ${
                          report.checks.trustPages.contact.found
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {report.checks.trustPages.contact.found ? 'Detected' : 'Missing'}
                      </span>
                    </div>

                    <div
                      className={`rounded-lg border p-2.5 ${
                        report.checks.trustPages.terms.found
                          ? 'border-emerald-200 bg-emerald-50/50'
                          : 'border-rose-200 bg-rose-50/50'
                      }`}
                    >
                      <span className="font-semibold text-slate-900 text-xs block">
                        Terms / Disclaimer
                      </span>
                      <span
                        className={`text-[11px] font-medium block mt-0.5 ${
                          report.checks.trustPages.terms.found
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {report.checks.trustPages.terms.found ? 'Detected' : 'Missing'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Check 3: Content Inventory & Threshold */}
                <div
                  id="check-content-threshold"
                  className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <Layers className="h-4 w-4 text-indigo-600 shrink-0" />
                      <h5 className="text-xs font-bold text-slate-900">
                        3. Content Volume & Article Depth Threshold
                      </h5>
                    </div>
                    <div>{getStatusPill(report.checks.contentThreshold.status)}</div>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    {report.checks.contentThreshold.message}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-700">
                      Published Posts: {report.checks.contentThreshold.totalPublishedPosts}
                    </span>
                    <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-700">
                      Recommended Min: {report.checks.contentThreshold.recommendedMinimum}
                    </span>
                    <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-700">
                      Avg Words: ~{report.checks.contentThreshold.averageWordCount}
                    </span>
                  </div>
                </div>

                {/* Check 4: Mediapartners-Google in robots.txt */}
                <div
                  id="check-mediapartners"
                  className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <Compass className="h-4 w-4 text-indigo-600 shrink-0" />
                      <h5 className="text-xs font-bold text-slate-900">
                        4. Mediapartners-Google Crawler Access in robots.txt
                      </h5>
                    </div>
                    <div>{getStatusPill(report.checks.mediapartners.status)}</div>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    {report.checks.mediapartners.message}
                  </p>
                </div>

                {/* Check 5: Navigation Hygiene */}
                <div
                  id="check-navigation-hygiene"
                  className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                      <h5 className="text-xs font-bold text-slate-900">
                        5. Navigation Completeness & Dead End Prevention
                      </h5>
                    </div>
                    <div>{getStatusPill(report.checks.navigation.status)}</div>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    {report.checks.navigation.message}
                  </p>

                  {report.checks.navigation.brokenOrPlaceholderLinksCount > 0 && (
                    <div className="mt-2 rounded bg-amber-50 p-2 text-[11px] text-amber-900 border border-amber-200">
                      <strong>Sample template dummy links to fix: </strong>
                      <span>{report.checks.navigation.sampleBrokenHrefs.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Common Rejection Risk Matrix */}
          {report.rejectionRisks && report.rejectionRisks.length > 0 && (
            <div id="adsense-rejection-risk-matrix" className="space-y-3">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Common AdSense Rejection Risk Matrix
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {report.rejectionRisks.map((risk, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-4 ${
                      risk.severity === 'high'
                        ? 'border-rose-200 bg-rose-50/60'
                        : 'border-amber-200 bg-amber-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                          risk.severity === 'high'
                            ? 'bg-rose-200 text-rose-900'
                            : 'bg-amber-200 text-amber-900'
                        }`}
                      >
                        {risk.severity} Risk
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {risk.riskType}
                      </span>
                    </div>

                    <h5 className="text-xs font-bold text-slate-900 mt-2">
                      {risk.title}
                    </h5>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {risk.description}
                    </p>

                    <div className="mt-2.5 border-t border-slate-200/50 pt-2 text-[11px] text-indigo-900 font-medium">
                      <span>Action: </span>
                      <span className="font-normal text-slate-700">{risk.actionRequired}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gemini AI Policy Recommendations Panel */}
          <div
            id="adsense-ai-policy-panel"
            className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  <h4 className="text-base font-semibold text-slate-900">
                    Gemini AI Publisher Policy Review
                  </h4>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deep reasoning on Webmaster Quality Guidelines, AdSense approval patterns, and content value.
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunAiPolicyReview}
                disabled={runningAiReview}
                className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm shrink-0"
              >
                {runningAiReview ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>
                  {runningAiReview ? 'Synthesizing Policy...' : 'Run Policy Analysis'}
                </span>
              </button>
            </div>

            {/* Optional scenario tuning notes */}
            <div className="mt-4 space-y-1.5">
              <label
                htmlFor="adsense-custom-notes"
                className="block text-[11px] font-semibold text-slate-700"
              >
                Optional Query / Rejection History Context
              </label>
              <input
                id="adsense-custom-notes"
                type="text"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="e.g. Previously received 'Low value content' rejection; please analyze article uniqueness."
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            {aiReview ? (
              <div className="mt-6 space-y-6">
                {/* Executive Assessment */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Policy Assessment
                    </span>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      {aiReview.overallReadinessAssessment}
                    </p>
                  </div>

                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                      Primary Policy Risk
                    </span>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      {aiReview.primaryPolicyRisk}
                    </p>
                  </div>
                </div>

                {/* Findings Roster */}
                <div className="space-y-3">
                  <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Evidence-Based Policy Findings ({aiReview.findings.length})
                  </h5>

                  <div className="grid grid-cols-1 gap-3">
                    {aiReview.findings.map((f, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getConfidenceBadge(f.confidence)}
                            <span className="font-mono text-[10px] font-semibold text-slate-500 uppercase">
                              {f.policyArea}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">#{i + 1}</span>
                        </div>

                        <h6 className="text-xs font-bold text-slate-900 mt-1">{f.title}</h6>
                        <p className="text-xs text-slate-600 leading-relaxed">{f.explanation}</p>

                        <div className="rounded bg-slate-50 p-2 text-[11px] font-mono text-slate-600 border border-slate-100">
                          Evidence: {f.evidence}
                        </div>

                        <div className="text-xs text-indigo-900 font-medium pt-1">
                          Action Step: <span className="font-normal text-slate-700">{f.actionStep}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Remediation Roadmap Checklist */}
                {aiReview.remediationRoadmap && aiReview.remediationRoadmap.length > 0 && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
                    <h5 className="text-xs font-bold text-indigo-950">
                      Sequential Pre-Submission Action Roadmap
                    </h5>
                    <ul className="space-y-1.5 text-xs text-indigo-900">
                      {aiReview.remediationRoadmap.map((step, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Mandatory Ethics & Policy Disclaimer */}
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 flex items-start space-x-2.5">
                  <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-950">Official Policy Disclaimer</p>
                    <p className="mt-0.5 text-[11px] text-amber-800 leading-relaxed">
                      {aiReview.disclaimer}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                Click <strong>Gemini Policy Review</strong> to generate an in-depth policy risk assessment based on your deterministic audit.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Crucial policy disclaimer footer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 flex items-start space-x-2.5">
        <Lock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          <strong className="text-slate-700">Strict Read-Only Guarantee:</strong> This application inspects public site signals and read-only Blogger / Search Console APIs. It will never automatically modify Blogger settings, create unauthorized files, or guarantee approval from Google AdSense.
        </p>
      </div>
    </div>
  );
};
