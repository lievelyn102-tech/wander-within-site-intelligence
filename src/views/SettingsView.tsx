import React, { useEffect, useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Lock,
  Server,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Database,
  Layers,
  User,
  Activity,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { UserProfile, SiteModel, SessionInfo } from '../types';

interface SettingsViewProps {
  userProfile?: UserProfile | null;
  activeSite?: SiteModel | null;
  onRefreshGoogleAssets?: () => Promise<void>;
  onClearSession?: () => Promise<void>;
  onNavigatePrivacy?: () => void;
  onNavigateTerms?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userProfile,
  activeSite,
  onRefreshGoogleAssets,
  onClearSession,
  onNavigatePrivacy,
  onNavigateTerms,
}) => {
  const [serverStatus, setServerStatus] = useState<{
    status: string;
    hasGeminiKey: boolean;
    readOnlyMode: boolean;
    googleConnected: boolean;
  } | null>(null);

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoadingSession(true);
    try {
      const [healthRes, sessionRes] = await Promise.all([
        fetch('/api/health').then((r) => r.json()),
        fetch('/api/session/info').then((r) => r.json()),
      ]);

      setServerStatus({
        status: healthRes.status,
        hasGeminiKey: healthRes.hasGeminiKey,
        readOnlyMode: healthRes.readOnlyMode,
        googleConnected: healthRes.googleConnected,
      });

      setSessionInfo(sessionRes);
    } catch (err) {
      console.warn('Failed to load settings data:', err);
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncAssets = async () => {
    setSyncing(true);
    setActionMessage(null);
    try {
      if (onRefreshGoogleAssets) {
        await onRefreshGoogleAssets();
      } else {
        await fetch('/api/blogger/blogs');
      }
      await loadData();
      setActionMessage({ type: 'success', text: 'Google assets and Blogger sites re-synchronized successfully.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to re-sync Google assets.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleClearSessionCache = async () => {
    if (!confirm('Are you sure you want to flush local cached audits, diagnostics, and session tokens?')) {
      return;
    }

    setClearing(true);
    setActionMessage(null);
    try {
      if (onClearSession) {
        await onClearSession();
      } else {
        await fetch('/api/session/clear', { method: 'POST' });
      }
      await loadData();
      setActionMessage({ type: 'success', text: 'All cached diagnostics and active session data flushed cleanly.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to flush session cache.' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div id="settings-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center shadow-2xs">
        <div>
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Session Management & Security Governance
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Multi-tenant session isolation, live cache counters, OAuth scope statuses, and strict read-only guarantees.
          </p>
        </div>

        {actionMessage && (
          <div
            className={`mt-3 sm:mt-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {actionMessage.text}
          </div>
        )}
      </div>

      {/* Active Session Information Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Active Authenticated Session
              </h4>
              <p className="text-xs text-slate-500">
                Session isolation boundary ensures zero cross-user diagnostic leakage.
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center space-x-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              serverStatus?.googleConnected
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                serverStatus?.googleConnected ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            ></span>
            <span>{serverStatus?.googleConnected ? 'OAuth Connected' : 'Anonymous / Guest Session'}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
            <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">
              Connected Profile
            </span>
            <div className="mt-1 flex items-center space-x-2">
              {sessionInfo?.userPicture ? (
                <img
                  src={sessionInfo.userPicture}
                  alt="Profile"
                  className="h-6 w-6 rounded-full ring-1 ring-slate-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                  {(sessionInfo?.userName || sessionInfo?.userEmail || 'G')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800 truncate">
                  {sessionInfo?.userName || 'Not signed in'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {sessionInfo?.userEmail || 'Local guest mode'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
            <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">
              Tenant Session ID
            </span>
            <p className="mt-1 font-mono text-[11px] text-slate-700 truncate font-semibold">
              {sessionInfo?.userId || 'default_session'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Isolated in-memory cache key
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
            <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">
              Active Working Site
            </span>
            <p className="mt-1 font-semibold text-slate-800 truncate">
              {activeSite?.name || 'None selected'}
            </p>
            <p className="text-[11px] font-mono text-slate-500 truncate">
              {activeSite?.url || 'No active domain'}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100">
            <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">
              Total Managed Sites
            </span>
            <p className="mt-1 text-base font-bold text-indigo-600">
              {sessionInfo?.sitesCount || 0}
            </p>
            <p className="text-[10px] text-slate-400">
              Registered Blogger domains
            </p>
          </div>
        </div>

        {/* OAuth Scope Status Grid */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h5 className="text-xs font-semibold text-slate-900 mb-2">
            Google OAuth 2.0 Scope Status (Strict Read-Only)
          </h5>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
              <div>
                <span className="font-semibold text-slate-800">Blogger API v3</span>
                <p className="text-[10px] text-slate-500">blogger.readonly</p>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  sessionInfo?.scopes?.blogger
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {sessionInfo?.scopes?.blogger ? 'Active' : 'Unauthenticated'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
              <div>
                <span className="font-semibold text-slate-800">Search Console</span>
                <p className="text-[10px] text-slate-500">webmasters.readonly</p>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  sessionInfo?.scopes?.searchConsole
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {sessionInfo?.scopes?.searchConsole ? 'Active' : 'Unauthenticated'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
              <div>
                <span className="font-semibold text-slate-800">Google AdSense</span>
                <p className="text-[10px] text-slate-500">adsense.readonly</p>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  sessionInfo?.scopes?.adsense
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {sessionInfo?.scopes?.adsense ? 'Active' : 'Unauthenticated'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cache & Diagnostic Storage Management */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Diagnostic Cache & State Management
              </h4>
              <p className="text-xs text-slate-500">
                Live breakdown of scoped crawl data, deterministic audit logs, and AI syntheses.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="sync-google-assets-btn"
              type="button"
              onClick={handleSyncAssets}
              disabled={syncing}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Force Re-Sync Assets'}</span>
            </button>

            <button
              id="clear-session-cache-btn"
              type="button"
              onClick={handleClearSessionCache}
              disabled={clearing}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              <span>{clearing ? 'Clearing...' : 'Clear Audit History'}</span>
            </button>
          </div>
        </div>

        {/* Live Cache Breakdown Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span>URL Inspections</span>
              <Activity className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <p className="text-lg font-bold text-slate-900">
              {sessionInfo?.cacheStats?.inspectionsCount ?? 0}
            </p>
            <p className="text-[10px] text-slate-400">Pages crawled & parsed</p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span>Sitemaps Cached</span>
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <p className="text-lg font-bold text-slate-900">
              {sessionInfo?.cacheStats?.sitemapsCached ?? 0}
            </p>
            <p className="text-[10px] text-slate-400">robots.txt & sitemap maps</p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span>AI Diagnoses</span>
              <FileText className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <p className="text-lg font-bold text-slate-900">
              {sessionInfo?.cacheStats?.diagnosesCached ?? 0}
            </p>
            <p className="text-[10px] text-slate-400">Gemini synthesis reports</p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span>AdSense Reports</span>
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <p className="text-lg font-bold text-slate-900">
              {(sessionInfo?.cacheStats?.adSenseReportsCached ?? 0) + (sessionInfo?.cacheStats?.adSenseReviewsCached ?? 0)}
            </p>
            <p className="text-[10px] text-slate-400">Policy & readiness reviews</p>
          </div>
        </div>
      </div>

      {/* Security Architecture Matrix */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center space-x-2.5 mb-2">
            <Server className="h-4 w-4 text-indigo-600" />
            <h4 className="text-xs font-semibold text-slate-900">
              Server-Side Node.js Proxy
            </h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-3">
            All API communications with Google services and Gemini execute on the server. Zero API keys or secrets are exposed to the client browser.
          </p>
          <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Server Proxy Active</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center space-x-2.5 mb-2">
            <Lock className="h-4 w-4 text-indigo-600" />
            <h4 className="text-xs font-semibold text-slate-900">
              Diagnostic Read-Only Lock
            </h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-3">
            Write actions are strictly forbidden. The system cannot create, modify, or delete Blogger posts, pages, layout widgets, or GSC settings.
          </p>
          <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Read-Only Mode Enforced</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center space-x-2.5 mb-2">
            <KeyRound className="h-4 w-4 text-indigo-600" />
            <h4 className="text-xs font-semibold text-slate-900">
              Server Environment Secrets
            </h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-3">
            Managed via server-side environment variables (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded text-slate-700">.env</code>). No user copy-pasting into client forms.
          </p>
          <div className="flex items-center space-x-1.5 text-xs font-semibold">
            {serverStatus?.hasGeminiKey ? (
              <span className="flex items-center space-x-1 text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>GEMINI_API_KEY Configured</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-amber-700">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>GEMINI_API_KEY Awaiting Setup</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Legal & Google OAuth Compliance Documentation */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              <span>Google OAuth Verification &amp; Public Legal Documents</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
              Wander Within Site Intelligence adheres to the Google API Services User Data Policy, including the Limited Use requirements. View our complete standalone legal disclosures:
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <a
              id="settings-privacy-link"
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                onNavigatePrivacy?.();
              }}
              className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors shadow-2xs"
            >
              <span>Privacy Policy</span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
            <a
              id="settings-terms-link"
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                onNavigateTerms?.();
              }}
              className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-indigo-600 transition-colors shadow-2xs"
            >
              <span>Terms of Service</span>
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
