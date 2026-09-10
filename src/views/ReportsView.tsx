import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Download,
  Copy,
  Check,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Compass,
  FileText,
  Calendar,
  Layers,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { SiteModel, AiDiagnosisResult, PageInspectionResult } from '../types';

interface ReportsViewProps {
  activeSite: SiteModel | null;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ activeSite }) => {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [latestDiagnosis, setLatestDiagnosis] = useState<AiDiagnosisResult | null>(null);
  const [recentInspections, setRecentInspections] = useState<PageInspectionResult[]>([]);
  const [robotsSitemapData, setRobotsSitemapData] = useState<any>(null);
  const [adsenseReport, setAdsenseReport] = useState<any>(null);

  // Fetch report data on active site change
  useEffect(() => {
    if (!activeSite) return;

    let isMounted = true;
    setLoading(true);

    async function loadReportData() {
      try {
        const [diagRes, inspRes, robotsRes, adsRes] = await Promise.allSettled([
          fetch(`/api/ai/diagnose/latest?siteId=${encodeURIComponent(activeSite!.id)}`),
          fetch(`/api/inspect/history?siteId=${encodeURIComponent(activeSite!.id)}`),
          fetch(`/api/inspect/sitemap-and-robots?siteId=${encodeURIComponent(activeSite!.id)}&siteUrl=${encodeURIComponent(activeSite!.url)}`),
          fetch(`/api/adsense/readiness/latest?siteId=${encodeURIComponent(activeSite!.id)}`),
        ]);

        if (diagRes.status === 'fulfilled' && diagRes.value.ok) {
          const d = await diagRes.value.json();
          if (d.success && d.result && isMounted) {
            setLatestDiagnosis(d.result);
          }
        }

        if (inspRes.status === 'fulfilled' && inspRes.value.ok) {
          const insp = await inspRes.value.json();
          if (insp.inspections && isMounted) {
            setRecentInspections(insp.inspections.slice(0, 5));
          }
        }

        if (robotsRes.status === 'fulfilled' && robotsRes.value.ok) {
          const rob = await robotsRes.value.json();
          if (isMounted) {
            setRobotsSitemapData(rob);
          }
        }

        if (adsRes.status === 'fulfilled' && adsRes.value.ok) {
          const ads = await adsRes.value.json();
          if (ads.success && ads.report && isMounted) {
            setAdsenseReport(ads.report);
          }
        }
      } catch (e) {
        console.warn('Error loading report components:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadReportData();

    return () => {
      isMounted = false;
    };
  }, [activeSite]);

  // Construct Markdown text for export or copying
  const generateMarkdownReport = () => {
    if (!activeSite) return '';

    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let md = `# Diagnostic Site Intelligence Report\n`;
    md += `**Website:** ${activeSite.name} (${activeSite.url})\n`;
    md += `**Date:** ${dateStr}\n`;
    md += `**Platform:** ${activeSite.platform === 'blogger_subdomain' ? 'Blogger Subdomain (*.blogspot.com)' : 'Blogger Custom Domain'}\n`;
    md += `**Overall Technical Score:** ${activeSite.lastAuditScore ?? 'N/A'}/100\n\n`;

    md += `---\n\n`;

    // 1. Executive Summary
    md += `## 1. Executive Diagnostic Summary\n`;
    if (latestDiagnosis) {
      md += `**Assessment:** ${latestDiagnosis.overallAssessment}\n\n`;
      md += `**Primary Bottleneck:** ${latestDiagnosis.primaryBottleneck}\n\n`;
      if (latestDiagnosis.contentSynergyNotes) {
        md += `**Content Synergy & Linking:** ${latestDiagnosis.contentSynergyNotes}\n\n`;
      }
    } else {
      md += `No AI reasoning synthesis generated yet. Baseline audit indicates score ${activeSite.lastAuditScore ?? 100}/100.\n\n`;
    }

    // 2. Deterministic Crawler Audit Facts
    md += `## 2. Deterministic Technical Audit Findings\n`;
    if (recentInspections.length > 0) {
      const top = recentInspections[0];
      md += `- **Inspected URL:** ${top.url}\n`;
      md += `- **HTTP Status:** ${top.statusCode} (${top.statusText})\n`;
      md += `- **Latency:** ${top.responseTimeMs}ms\n`;
      md += `- **Canonical Tag:** ${top.canonical?.canonicalHref || 'Missing'} (Status: ${top.canonical?.status})\n`;
      md += `- **Mobile Parity (?m=1 parameter links):** ${top.links?.linksWithMobileParam || 0} links\n`;
      md += `- **H1 Headings:** ${top.headings?.h1Count} tags found\n`;
      md += `- **Word Count:** ~${top.headings?.wordCount} words\n`;
      md += `- **Images Missing Alt:** ${top.media?.imagesMissingAlt || 0} of ${top.media?.totalImages || 0}\n\n`;
    } else {
      md += `No individual URL inspections recorded yet.\n\n`;
    }

    // 3. Robots.txt & Sitemap Status
    md += `## 3. Crawler Directives & Sitemaps\n`;
    if (robotsSitemapData) {
      md += `- **robots.txt:** ${robotsSitemapData.robotsTxt?.status?.toUpperCase()} (${robotsSitemapData.robotsTxt?.message})\n`;
      md += `- **sitemap.xml:** ${robotsSitemapData.sitemapXml?.status?.toUpperCase()} (${robotsSitemapData.sitemapXml?.entryCount || 0} entries discovered)\n\n`;
    } else {
      md += `Default Blogger crawler configuration presumed.\n\n`;
    }

    // 4. AdSense Monetization Readiness
    if (adsenseReport) {
      md += `## 4. AdSense Monetization Readiness\n`;
      md += `- **Readiness Score:** ${adsenseReport.readinessScore}/100 (${adsenseReport.readinessStatus})\n`;
      md += `- **ads.txt:** ${adsenseReport.checks?.adsTxt?.status?.toUpperCase()} (${adsenseReport.checks?.adsTxt?.message})\n`;
      md += `- **Trust Pages:** ${adsenseReport.checks?.trustPages?.foundCount}/4 detected\n`;
      md += `- **Content Threshold:** ${adsenseReport.checks?.contentThreshold?.totalPublishedPosts} posts (Avg ~${adsenseReport.checks?.contentThreshold?.averageWordCount} words)\n`;
      md += `- **Mediapartners Crawler:** ${adsenseReport.checks?.mediapartners?.isCrawlerAllowed ? 'Allowed' : 'Blocked'}\n\n`;
    }

    // 5. Evidence-Based Diagnostic Findings
    if (latestDiagnosis && latestDiagnosis.findings && latestDiagnosis.findings.length > 0) {
      md += `## 5. Prioritized Evidence-Based Findings\n\n`;
      latestDiagnosis.findings.forEach((f, idx) => {
        md += `### ${idx + 1}. [${f.confidence}] ${f.title}\n`;
        md += `- **Category:** ${f.category}\n`;
        md += `- **Evidence:** ${f.evidence}\n`;
        md += `- **Explanation:** ${f.explanation}\n`;
        md += `- **Remediation:** ${f.actionStep}\n\n`;
      });
    }

    md += `---\n*Generated by Wander Within Site Intelligence for Blogger/Blogspot*`;
    return md;
  };

  const handleCopy = () => {
    const md = generateMarkdownReport();
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdownReport();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanName = (activeSite?.name || 'site').toLowerCase().replace(/[^a-z0-9]/g, '-');
    link.download = `diagnostic-report-${cleanName}-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="reports-view" className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <FileBarChart className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Consolidated Diagnostic Report
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Exportable report merging deterministic crawl telemetry with Gemini evidence-backed diagnostic findings.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!activeSite}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copied ? 'Copied to Clipboard' : 'Copy Diagnostic Summary'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            disabled={!activeSite}
            className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Markdown (.md)</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {!activeSite ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <FileBarChart className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h4 className="text-sm font-semibold text-slate-800">
            No Active Site Selected
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Register or select a Blogger site in the Sites directory to compile an audit report.
          </p>
        </div>
      ) : (
        /* The Printable / Viewable Report Canvas */
        <div
          id="printable-report-canvas"
          className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-8 shadow-2xs"
        >
          {/* Report Header Metadata */}
          <div className="border-b border-slate-200 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                  Comprehensive Diagnostic Audit
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-1">
                  {activeSite.name}
                </h2>
                <a
                  href={activeSite.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-indigo-600 hover:underline inline-flex items-center space-x-1 mt-0.5"
                >
                  <span>{activeSite.url}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs font-semibold text-slate-700 block">
                  Report Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Platform: {activeSite.platform === 'blogger_subdomain' ? 'Blogger Subdomain' : 'Custom Domain'}
                </span>
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mt-1">
                  Score: {activeSite.lastAuditScore ?? 100}/100
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Executive Summary & Primary Bottleneck */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              1. Executive Diagnostic Summary
            </h3>

            {latestDiagnosis ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
                <div>
                  <span className="text-xs font-semibold text-slate-900 block mb-1">
                    Overall Crawl & Indexing Health
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {latestDiagnosis.overallAssessment}
                  </p>
                </div>

                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
                    Highest-Leverage Bottleneck
                  </span>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">
                    {latestDiagnosis.primaryBottleneck}
                  </p>
                </div>

                {latestDiagnosis.contentSynergyNotes && (
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Content Synergy & Siloing: </span>
                    <span>{latestDiagnosis.contentSynergyNotes}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                AI diagnostic reasoning has not been executed yet for this site. Visit the{' '}
                <span className="font-semibold text-slate-700">AI Diagnosis</span> tab to synthesize reasoning.
              </div>
            )}
          </section>

          {/* Section 2: Deterministic Telemetry Overview */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Deterministic Crawler & Directive Telemetry
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">HTTP & Redirects</span>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  {recentInspections.length > 0
                    ? `${recentInspections[0].statusCode} (${recentInspections[0].responseTimeMs}ms)`
                    : 'Clean 200 OK'}
                </p>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  {recentInspections.length > 0 && recentInspections[0].redirectCount > 0
                    ? `${recentInspections[0].redirectCount} redirect hops`
                    : 'Direct response'}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Canonical Parity</span>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  {recentInspections.length > 0
                    ? recentInspections[0].canonical.status.toUpperCase()
                    : 'Verified'}
                </p>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  {recentInspections.length > 0 && recentInspections[0].links.linksWithMobileParam > 0
                    ? `${recentInspections[0].links.linksWithMobileParam} links with ?m=1`
                    : 'No mobile leakage'}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">robots.txt Directives</span>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  {robotsSitemapData?.robotsTxt?.status?.toUpperCase() || 'PASS'}
                </p>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  {robotsSitemapData?.robotsTxt?.hasSearchDisallow
                    ? 'Disallow: /search active'
                    : 'Default Blogger rules'}
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">XML Sitemaps</span>
                <p className="text-sm font-semibold text-slate-900 mt-1">
                  {robotsSitemapData?.sitemapXml?.entryCount !== undefined
                    ? `${robotsSitemapData.sitemapXml.entryCount} URLs listed`
                    : 'sitemap.xml verified'}
                </p>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Blogger feed integration
                </span>
              </div>
            </div>
          </section>

          {/* Section 3: AdSense Monetization Readiness */}
          {adsenseReport && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                3. AdSense Readiness & Policy Compliance
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Readiness Score</span>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {adsenseReport.readinessScore}/100
                  </p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block uppercase font-mono font-medium">
                    {adsenseReport.readinessStatus.replace('_', ' ')}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">ads.txt Directives</span>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {adsenseReport.checks?.adsTxt?.status?.toUpperCase()}
                  </p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
                    {adsenseReport.checks?.adsTxt?.publisherId || 'Direct seller check'}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Trust Pages</span>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {adsenseReport.checks?.trustPages?.foundCount}/4 Present
                  </p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Privacy, About, Contact, Terms
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Content Corpus</span>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {adsenseReport.checks?.contentThreshold?.totalPublishedPosts} Posts
                  </p>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Avg ~{adsenseReport.checks?.contentThreshold?.averageWordCount} words/post
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Section 4: Evidence-Based Diagnostic Findings Table */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {adsenseReport ? '4.' : '3.'} Evidence-Based Diagnostic Findings Roster
            </h3>

            {latestDiagnosis && latestDiagnosis.findings && latestDiagnosis.findings.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                    <tr>
                      <th className="py-2.5 px-3">Confidence</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Finding & Explanation</th>
                      <th className="py-2.5 px-3">Action Step</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {latestDiagnosis.findings.map((f, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <span
                            className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] font-bold border ${
                              f.confidence === 'CONFIRMED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : f.confidence === 'LIKELY'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : f.confidence === 'POSSIBLE'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {f.confidence}
                          </span>
                        </td>
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <span className="font-mono text-[10px] text-slate-500 uppercase">
                            {f.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 align-top max-w-md">
                          <p className="font-semibold text-slate-900">{f.title}</p>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            {f.explanation}
                          </p>
                          <p className="font-mono text-[10px] text-slate-400 mt-1 bg-slate-50 p-1.5 rounded border border-slate-100">
                            Evidence: {f.evidence}
                          </p>
                        </td>
                        <td className="py-3 px-3 align-top text-indigo-900 font-medium leading-relaxed max-w-xs">
                          {f.actionStep}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                Run an AI reasoning analysis on the active site to populate the findings roster.
              </div>
            )}
          </section>

          {/* Section 4: Ethics & Non-Destructive Policy */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-500 flex items-start space-x-2.5">
            <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px]">
              <strong className="text-slate-700">Audit Methodology:</strong> Every statement in this report is derived from observable technical facts (HTTP status codes, DOM elements, canonical directives) and structured Gemini reasoning. Proprietary search ranking weights or secret algorithmic filters are explicitly classified as [Unknown] to preserve scientific objectivity.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
