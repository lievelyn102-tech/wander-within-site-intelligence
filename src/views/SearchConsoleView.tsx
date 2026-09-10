import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ShieldCheck,
  AlertCircle,
  ArrowUpRight,
  Compass,
  FileCheck,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  TrendingUp,
  MousePointer,
  Eye,
  Target,
  FileText,
  BarChart3,
  HelpCircle,
  Globe,
  ChevronDown,
  Check,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  SiteModel,
  GscSiteProperty,
  GscPerformanceData,
  GscCoverageSummaryData,
  GscMatchPropertyResult,
} from '../types';

interface SearchConsoleViewProps {
  activeSite: SiteModel | null;
  onOpenConnectGoogle: () => void;
  onRefreshSites?: () => void;
}

export const SearchConsoleView: React.FC<SearchConsoleViewProps> = ({
  activeSite,
  onOpenConnectGoogle,
  onRefreshSites,
}) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // GSC Properties state
  const [allProperties, setAllProperties] = useState<GscSiteProperty[]>([]);
  const [selectedPropertyUrl, setSelectedPropertyUrl] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<GscMatchPropertyResult | null>(null);

  // Performance and coverage data
  const [performanceData, setPerformanceData] = useState<GscPerformanceData | null>(null);
  const [coverageData, setCoverageData] = useState<GscCoverageSummaryData | null>(null);

  // Filters & Tabs within GSC View
  const [activeSubTab, setActiveSubTab] = useState<'queries' | 'pages' | 'sitemaps'>('queries');
  const [querySearch, setQuerySearch] = useState('');
  const [pageSearch, setPageSearch] = useState('');
  const [sortBy, setSortBy] = useState<'clicks' | 'impressions' | 'ctr' | 'position'>('clicks');

  // Load Search Console data
  const loadGscData = async (targetSiteUrl?: string, overrideProperty?: string) => {
    setLoading(true);
    setError(null);

    try {
      // 1. Verify Google OAuth connection
      const authRes = await fetch('/api/auth/google/status');
      if (!authRes.ok) throw new Error('Could not check Google connection status.');
      const authData = await authRes.json();
      setIsConnected(authData.connected);
      setUserEmail(authData.userEmail || null);

      if (!authData.connected) {
        setLoading(false);
        return;
      }

      // 2. Fetch accessible Search Console sites
      const sitesRes = await fetch('/api/gsc/sites');
      if (sitesRes.status === 401) {
        setIsConnected(false);
        setLoading(false);
        return;
      }

      if (!sitesRes.ok) {
        const errData = await sitesRes.json();
        throw new Error(errData.error || 'Failed to list Search Console properties.');
      }

      const sitesData = await sitesRes.json();
      const properties: GscSiteProperty[] = sitesData.sites || [];
      setAllProperties(properties);

      // Determine target URL to match
      const urlToMatch = targetSiteUrl || activeSite?.url;
      if (!urlToMatch && !overrideProperty) {
        setLoading(false);
        return;
      }

      let propertyToQuery: string | null = overrideProperty || null;

      if (!propertyToQuery && urlToMatch) {
        // 3. Match property against user's GSC sites
        const matchRes = await fetch(
          `/api/gsc/match-property?siteUrl=${encodeURIComponent(urlToMatch)}`
        );
        if (matchRes.ok) {
          const matchData: GscMatchPropertyResult = await matchRes.json();
          setMatchResult(matchData);
          if (matchData.matched && matchData.property) {
            propertyToQuery = matchData.property.siteUrl;
            setSelectedPropertyUrl(propertyToQuery);
          } else {
            setSelectedPropertyUrl(null);
          }
        }
      } else if (overrideProperty) {
        setSelectedPropertyUrl(overrideProperty);
      }

      // If a property is selected or matched, query performance and coverage
      if (propertyToQuery) {
        await Promise.all([
          fetchPerformance(propertyToQuery),
          fetchCoverage(propertyToQuery),
        ]);
        setLastSynced(new Date());
        if (onRefreshSites) {
          onRefreshSites();
        }
      } else {
        setPerformanceData(null);
        setCoverageData(null);
      }
    } catch (err: any) {
      console.error('Error loading Search Console data:', err);
      setError(err.message || 'Failed to load Search Console data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformance = async (propertyUrl: string) => {
    try {
      const perfRes = await fetch(
        `/api/gsc/performance?siteUrl=${encodeURIComponent(propertyUrl)}`
      );
      if (perfRes.ok) {
        const data: GscPerformanceData = await perfRes.json();
        setPerformanceData(data);
      } else {
        const errData = await perfRes.json();
        console.warn('Performance fetch error:', errData);
      }
    } catch (e) {
      console.error('Failed to fetch performance:', e);
    }
  };

  const fetchCoverage = async (propertyUrl: string) => {
    try {
      const covRes = await fetch(
        `/api/gsc/coverage-summary?siteUrl=${encodeURIComponent(propertyUrl)}`
      );
      if (covRes.ok) {
        const data: GscCoverageSummaryData = await covRes.json();
        setCoverageData(data);
      } else {
        const errData = await covRes.json();
        console.warn('Coverage fetch error:', errData);
      }
    } catch (e) {
      console.error('Failed to fetch coverage:', e);
    }
  };

  const handleManualSync = async () => {
    if (!selectedPropertyUrl) return;
    setSyncing(true);
    setError(null);
    try {
      await Promise.all([
        fetchPerformance(selectedPropertyUrl),
        fetchCoverage(selectedPropertyUrl),
      ]);
      setLastSynced(new Date());
      if (onRefreshSites) {
        onRefreshSites();
      }
    } catch (err: any) {
      setError('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectProperty = async (propertyUrl: string) => {
    setSelectedPropertyUrl(propertyUrl);
    setLoading(true);
    await Promise.all([
      fetchPerformance(propertyUrl),
      fetchCoverage(propertyUrl),
    ]);
    setLastSynced(new Date());
    setLoading(false);
    if (onRefreshSites) {
      onRefreshSites();
    }
  };

  useEffect(() => {
    loadGscData();
  }, [activeSite?.id, activeSite?.url]);

  // Filtered queries
  const filteredQueries = useMemo(() => {
    if (!performanceData?.topQueries) return [];
    let list = performanceData.topQueries.filter((q) =>
      q.query.toLowerCase().includes(querySearch.toLowerCase())
    );

    return list.sort((a, b) => {
      if (sortBy === 'clicks') return b.clicks - a.clicks;
      if (sortBy === 'impressions') return b.impressions - a.impressions;
      if (sortBy === 'ctr') return b.ctr - a.ctr;
      if (sortBy === 'position') return a.position - b.position;
      return 0;
    });
  }, [performanceData?.topQueries, querySearch, sortBy]);

  // Filtered pages
  const filteredPages = useMemo(() => {
    if (!performanceData?.topPages) return [];
    let list = performanceData.topPages.filter((p) =>
      p.page.toLowerCase().includes(pageSearch.toLowerCase())
    );

    return list.sort((a, b) => {
      if (sortBy === 'clicks') return b.clicks - a.clicks;
      if (sortBy === 'impressions') return b.impressions - a.impressions;
      if (sortBy === 'ctr') return b.ctr - a.ctr;
      if (sortBy === 'position') return a.position - b.position;
      return 0;
    });
  }, [performanceData?.topPages, pageSearch, sortBy]);

  return (
    <div id="search-console-view" className="space-y-6">
      {/* Scope Header */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Google Search Console (GSC) Read-Only Integration
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Real-time search performance, click analytics, average keyword ranking, and sitemap indexing validation.
          </p>
        </div>

        <div className="mt-3 flex items-center space-x-2.5 sm:mt-0">
          {isConnected && (
            <button
              id="gsc-sync-btn"
              type="button"
              onClick={handleManualSync}
              disabled={syncing || loading || !selectedPropertyUrl}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Metrics'}</span>
            </button>
          )}

          {!isConnected ? (
            <button
              id="gsc-connect-google-btn"
              type="button"
              onClick={onOpenConnectGoogle}
              className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <span className="font-bold">G</span>
              <span>Connect Google Account</span>
            </button>
          ) : (
            <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>GSC Scope Active</span>
            </span>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800 flex items-start space-x-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Search Console Notice</p>
            <p className="leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* State 1: Not Authenticated with Google */}
      {isConnected === false && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-3 border border-slate-100">
            <Search className="h-6 w-6" />
          </div>
          <h4 className="text-base font-semibold text-slate-900">
            Google Search Console: Not Connected
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
            Connect your Google account with the read-only{' '}
            <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">
              webmasters.readonly
            </code>{' '}
            scope to inspect search queries, click impressions, CTR, and indexing status for{' '}
            <strong className="text-slate-700">
              {activeSite ? activeSite.name : 'your Blogger site'}
            </strong>
            .
          </p>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={onOpenConnectGoogle}
              className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <span className="font-bold">G</span>
              <span>Connect Google Account</span>
            </button>
          </div>
        </div>
      )}

      {/* State 2: Authenticated, but no verified GSC property matched for this site */}
      {isConnected && !selectedPropertyUrl && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <h4 className="text-sm font-semibold text-amber-950">
                  Unverified Property in Google Search Console
                </h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  No verified Search Console property automatically matched{' '}
                  <span className="font-semibold">{activeSite?.url || 'your active site'}</span>{' '}
                  under your connected account ({userEmail || 'Google User'}).
                </p>
              </div>

              {/* Step-by-step 1-minute verification guide */}
              <div className="rounded-xl border border-amber-200/80 bg-white p-4 text-xs space-y-2.5">
                <p className="font-semibold text-slate-900">
                  How to verify your Blogger blog in 60 seconds (Zero coding required):
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600 pl-1 leading-relaxed">
                  <li>
                    Open{' '}
                    <a
                      href="https://search.google.com/search-console"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center space-x-0.5"
                    >
                      <span>Google Search Console</span>
                      <ExternalLink className="h-3 w-3 inline" />
                    </a>{' '}
                    in your browser using the same Google Account.
                  </li>
                  <li>
                    Click <strong className="text-slate-800">Add Property</strong> &gt; Select{' '}
                    <strong className="text-slate-800">URL prefix</strong>.
                  </li>
                  <li>
                    Enter your Blogger URL:{' '}
                    <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">
                      {activeSite?.url ? `${activeSite.url}/` : 'https://yourname.blogspot.com/'}
                    </code>
                  </li>
                  <li>
                    Click <strong className="text-slate-800">Continue</strong>.{' '}
                    <span className="text-emerald-700 font-medium">
                      Google automatically verifies Blogger sites instantly
                    </span>{' '}
                    since both services reside within your Google workspace.
                  </li>
                </ol>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
                  <a
                    href="https://search.google.com/search-console"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-2xs"
                  >
                    <span>Open Google Search Console</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => loadGscData()}
                    className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                    <span>Re-check & Match Property</span>
                  </button>
                </div>
              </div>

              {/* Or manual property selector if they have other properties */}
              {allProperties.length > 0 && (
                <div className="pt-2">
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Or select from your other verified Search Console properties ({allProperties.length}):
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {allProperties.map((prop) => (
                      <button
                        key={prop.siteUrl}
                        type="button"
                        onClick={() => handleSelectProperty(prop.siteUrl)}
                        className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 transition-colors font-mono"
                      >
                        <Globe className="h-3.5 w-3.5 text-slate-400" />
                        <span>{prop.siteUrl}</span>
                        <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] text-slate-500 font-sans">
                          {prop.permissionLevel}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* State 3: Active GSC Property Selected & Loaded */}
      {isConnected && selectedPropertyUrl && (
        <>
          {/* Matched Property Banner */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-xs font-semibold text-slate-900">
                      Search Console Property:
                    </h4>
                    <span className="font-mono text-xs font-semibold text-indigo-700">
                      {selectedPropertyUrl}
                    </span>
                    {matchResult?.matchType && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                        {matchResult.matchType === 'exact_url'
                          ? 'Exact URL Match'
                          : matchResult.matchType === 'sc_domain'
                          ? 'Domain Property (sc-domain)'
                          : 'Prefix Match'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Authorized via Google Account ({userEmail || 'Authenticated'}) ·{' '}
                    {lastSynced
                      ? `Last synced ${lastSynced.toLocaleTimeString()}`
                      : 'Live connection active'}
                  </p>
                </div>
              </div>

              {/* Property switch dropdown if user has multiple */}
              {allProperties.length > 1 && (
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-400">Switch:</span>
                  <select
                    value={selectedPropertyUrl}
                    onChange={(e) => handleSelectProperty(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 font-mono focus:border-indigo-500 focus:outline-hidden"
                  >
                    {allProperties.map((p) => (
                      <option key={p.siteUrl} value={p.siteUrl}>
                        {p.siteUrl} ({p.permissionLevel})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Performance 28-Day Metric Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                28-Day Search Performance Overview
              </h4>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200">
                {performanceData?.startDate && performanceData?.endDate
                  ? `${performanceData.startDate} to ${performanceData.endDate} (2-day lag)`
                  : 'Last 28 days'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {/* Clicks */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Total Clicks
                  </span>
                  <MousePointer className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="mt-2 flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {(performanceData?.metrics?.totalClicks ?? 0).toLocaleString()}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Organic Google Search visits
                </span>
              </div>

              {/* Impressions */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Total Impressions
                  </span>
                  <Eye className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="mt-2 flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {(performanceData?.metrics?.totalImpressions ?? 0).toLocaleString()}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Search result appearances
                </span>
              </div>

              {/* Average CTR */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Average CTR
                  </span>
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                </div>
                <div className="mt-2 flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {((performanceData?.metrics?.averageCtr ?? 0) * 100).toFixed(2)}%
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Click-through percentage
                </span>
              </div>

              {/* Average Position */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Average Position
                  </span>
                  <Target className="h-4 w-4 text-purple-600" />
                </div>
                <div className="mt-2 flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {performanceData?.metrics?.averagePosition
                      ? performanceData.metrics.averagePosition.toFixed(1)
                      : '—'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Average ranking in Google
                </span>
              </div>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div className="border-b border-slate-200">
            <div className="flex space-x-6">
              <button
                type="button"
                onClick={() => setActiveSubTab('queries')}
                className={`pb-3 text-xs font-semibold transition-colors border-b-2 flex items-center space-x-2 ${
                  activeSubTab === 'queries'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>Top Search Queries</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {performanceData?.topQueries?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('pages')}
                className={`pb-3 text-xs font-semibold transition-colors border-b-2 flex items-center space-x-2 ${
                  activeSubTab === 'pages'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>Top Performing Pages</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {performanceData?.topPages?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('sitemaps')}
                className={`pb-3 text-xs font-semibold transition-colors border-b-2 flex items-center space-x-2 ${
                  activeSubTab === 'sitemaps'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>Sitemaps & Coverage</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {coverageData?.sitemapsCount || 0}
                </span>
              </button>
            </div>
          </div>

          {/* Tab 1: Top Search Queries Table */}
          {activeSubTab === 'queries' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={querySearch}
                    onChange={(e) => setQuerySearch(e.target.value)}
                    placeholder="Search queries..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden shadow-2xs"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-400">Sort:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
                    {(['clicks', 'impressions', 'ctr', 'position'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSortBy(s)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                          sortBy === s
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredQueries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                  {performanceData?.topQueries && performanceData.topQueries.length === 0
                    ? 'No search query clicks recorded for this 28-day window yet. Google will populate queries as readers search and discover your blog.'
                    : 'No queries match your search filter.'}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-3 pl-4 pr-3">Query</th>
                          <th className="py-3 px-3 text-right">Clicks</th>
                          <th className="py-3 px-3 text-right">Impressions</th>
                          <th className="py-3 px-3 text-right">CTR</th>
                          <th className="py-3 pr-4 pl-3 text-right">Position</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredQueries.map((row, idx) => {
                          const pos = row.position;
                          let posColor = 'text-slate-700 bg-slate-100';
                          if (pos <= 3) posColor = 'text-emerald-700 bg-emerald-50 border border-emerald-200';
                          else if (pos <= 10) posColor = 'text-indigo-700 bg-indigo-50 border border-indigo-200';
                          else if (pos <= 20) posColor = 'text-amber-700 bg-amber-50 border border-amber-200';

                          return (
                            <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 pl-4 pr-3 font-medium text-slate-900">
                                {row.query}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-indigo-600">
                                {row.clicks.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                {row.impressions.toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                {(row.ctr * 100).toFixed(1)}%
                              </td>
                              <td className="py-2.5 pr-4 pl-3 text-right">
                                <span
                                  className={`inline-block font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full ${posColor}`}
                                >
                                  {row.position.toFixed(1)}
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
            </div>
          )}

          {/* Tab 2: Top Performing Pages Table */}
          {activeSubTab === 'pages' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={pageSearch}
                    onChange={(e) => setPageSearch(e.target.value)}
                    placeholder="Search URLs..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden shadow-2xs"
                  />
                </div>
              </div>

              {filteredPages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                  {performanceData?.topPages && performanceData.topPages.length === 0
                    ? 'No page URLs have received organic impressions in this period.'
                    : 'No pages match your search filter.'}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-3 pl-4 pr-3">Page URL</th>
                          <th className="py-3 px-3 text-right">Clicks</th>
                          <th className="py-3 px-3 text-right">Impressions</th>
                          <th className="py-3 px-3 text-right">CTR</th>
                          <th className="py-3 pr-4 pl-3 text-right">Avg Position</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPages.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 pl-4 pr-3">
                              <a
                                href={row.page}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center space-x-1 max-w-md truncate"
                              >
                                <span className="truncate">{row.page}</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-indigo-600">
                              {row.clicks.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {row.impressions.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {(row.ctr * 100).toFixed(1)}%
                            </td>
                            <td className="py-2.5 pr-4 pl-3 text-right font-mono text-slate-700">
                              {row.position.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Sitemaps & Coverage Diagnosis */}
          {activeSubTab === 'sitemaps' && (
            <div className="space-y-5">
              {/* Coverage summary card */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Sitemaps Status
                  </span>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {coverageData?.indexingStatus || 'Verified Property'}
                  </p>
                  <span className="text-[11px] text-slate-500">
                    {coverageData?.sitemapsCount || 0} registered sitemaps
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Blogger Default Sitemaps
                  </span>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {coverageData?.hasDefaultSitemap ? (
                      <span className="text-emerald-700 flex items-center space-x-1">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>/sitemap.xml Detected</span>
                      </span>
                    ) : (
                      <span className="text-amber-700">/sitemap.xml Not Submitted</span>
                    )}
                  </p>
                  <span className="text-[11px] text-slate-500">
                    Blogger generates XML sitemaps natively
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total Submitted URLs
                  </span>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {(coverageData?.totalSubmittedUrls ?? 0).toLocaleString()}
                  </p>
                  <span className="text-[11px] text-slate-500">
                    Across all verified sitemap files
                  </span>
                </div>
              </div>

              {/* Sitemaps list table */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <h5 className="text-xs font-semibold text-slate-900">
                  Registered Sitemaps in Google Search Console
                </h5>

                {coverageData?.sitemaps && coverageData.sitemaps.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-2.5 pl-3 pr-2">Sitemap URL</th>
                          <th className="py-2.5 px-2">Last Submitted</th>
                          <th className="py-2.5 px-2 text-right">Submitted</th>
                          <th className="py-2.5 px-2 text-right">Errors</th>
                          <th className="py-2.5 pr-3 pl-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {coverageData.sitemaps.map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="py-2.5 pl-3 pr-2 font-mono text-slate-800">
                              {s.path}
                            </td>
                            <td className="py-2.5 px-2 text-slate-500">
                              {s.lastSubmitted
                                ? new Date(s.lastSubmitted).toLocaleDateString()
                                : 'Recent'}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono">
                              {s.submitted.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono">
                              {s.errors > 0 ? (
                                <span className="text-rose-600 font-semibold">{s.errors}</span>
                              ) : (
                                <span className="text-emerald-600">0</span>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 pl-2 text-right">
                              <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                                <Check className="h-3 w-3" />
                                <span>Success</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                    No sitemaps are currently recorded for this property in Search Console.{' '}
                    <span className="text-indigo-600 font-medium">
                      Tip: Submit <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">sitemap.xml</code> in Search Console to speed up new post indexation.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Planned Diagnostic Scope Card (Always visible for clarity) */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Search Console Diagnostic Scope
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
            <h5 className="text-xs font-semibold text-slate-900 mb-1">
              Coverage & Indexing Status
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Detects "Discovered - currently not indexed", "Crawled - currently not indexed", and 404 exclusions common on Blogger.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
            <h5 className="text-xs font-semibold text-slate-900 mb-1">
              Blogger Sitemap Inspection
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Verifies whether Blogger's default sitemaps (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">/sitemap.xml</code> and <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">/atom.xml?redirect=false</code>) are properly submitted and recognized.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
            <h5 className="text-xs font-semibold text-slate-900 mb-1">
              Mobile Canonical Parity (?m=1)
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Checks if Google is mistakenly indexing Blogger mobile parameter URLs (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">?m=1</code>) instead of desktop canonical versions.
            </p>
          </div>
        </div>
      </div>

      {/* Strict Read-Only Assurance */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 flex items-start space-x-2.5">
        <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px] text-slate-500">
          <strong className="text-slate-800">Read-Only Access Assurance:</strong> The application exclusively utilizes the <code className="font-mono text-slate-700">webmasters.readonly</code> scope. It cannot and will never alter sitemaps, submit removal requests, or change property ownership settings.
        </p>
      </div>
    </div>
  );
};
