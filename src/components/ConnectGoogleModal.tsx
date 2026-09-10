import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  AlertCircle,
  X,
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { GoogleAuthStatus } from '../types';

interface ConnectGoogleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateTerms?: () => void;
}

export const ConnectGoogleModal: React.FC<ConnectGoogleModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  onNavigatePrivacy,
  onNavigateTerms,
}) => {
  const [authStatus, setAuthStatus] = useState<GoogleAuthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/google/status');
      if (res.ok) {
        const data = await res.json();
        setAuthStatus(data);
      }
    } catch (err: any) {
      console.error('Failed to load auth status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setError(null);
      setSuccessNotice(null);
    }
  }, [isOpen]);

  // Listen for OAuth postMessage events from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setConnecting(false);
        setSuccessNotice('Google Account connected successfully! Discovering Blogger sites...');
        fetchStatus();
        if (onAuthSuccess) {
          onAuthSuccess();
        }
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setConnecting(false);
        setError(event.data.error || 'Google authorization was denied or failed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onAuthSuccess]);

  if (!isOpen) return null;

  const handleStartOAuth = async () => {
    setConnecting(true);
    setError(null);
    setSuccessNotice(null);

    try {
      const res = await fetch('/api/auth/google/url');
      const data = await res.json();

      if (!data.configured || !data.url) {
        setConnecting(false);
        setError(
          data.error ||
            'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured in environment variables. Please add them in Settings to connect your live Google account.'
        );
        return;
      }

      // Open OAuth popup window centered
      const width = 540;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2.5;

      const popup = window.open(
        data.url,
        'google_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        setConnecting(false);
        setError('Popup was blocked by your browser. Please allow popups for this site to continue.');
      }
    } catch (err: any) {
      setConnecting(false);
      setError(err.message || 'Failed to initialize Google OAuth flow.');
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/google/disconnect', { method: 'POST' });
      if (res.ok) {
        setSuccessNotice('Google account disconnected.');
        fetchStatus();
        if (onAuthSuccess) {
          onAuthSuccess();
        }
      }
    } catch (err: any) {
      setError('Failed to disconnect Google account.');
    } finally {
      setLoading(false);
    }
  };

  const callbackUrl =
    authStatus?.callbackUrl ||
    `${window.location.origin}/auth/callback`;

  const copyCallbackUrl = () => {
    navigator.clipboard.writeText(callbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="connect-google-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in"
    >
      <div
        id="connect-google-modal-dialog"
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <button
          id="close-google-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-base font-bold text-indigo-600">
            G
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-semibold text-slate-900">
                Google Account Integration
              </h3>
              {authStatus?.connected && (
                <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Connected</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Blogger API v3 Read-Only Integration & Discovery
            </p>
          </div>
        </div>

        {/* Notifications */}
        {successNotice && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Connection Notice</p>
              <p className="mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Connection State Panel */}
        {authStatus?.connected ? (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-emerald-950">Active Session</p>
                <p className="text-emerald-800 font-mono text-[11px] mt-0.5">
                  {authStatus.userEmail || 'Google Account Connected'}
                </p>
              </div>
              <button
                id="disconnect-google-btn"
                type="button"
                onClick={handleDisconnect}
                disabled={loading}
                className="inline-flex items-center space-x-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors shadow-2xs"
              >
                <LogOut className="h-3 w-3" />
                <span>Disconnect</span>
              </button>
            </div>
            <p className="mt-2 text-[11px] text-emerald-700">
              Read-only permissions are active. Your Blogger sites, published posts, and pages are automatically discovered.
            </p>
          </div>
        ) : (
          <div className="mb-5 space-y-3">
            {/* Primary Connect CTA */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-900">
                    Connect Blogger Account
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Authorize read-only access to discover your blogs, posts, and static pages.
                  </p>
                </div>
                <button
                  id="start-oauth-btn"
                  type="button"
                  onClick={handleStartOAuth}
                  disabled={connecting || loading}
                  className="inline-flex items-center justify-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-colors shrink-0"
                >
                  {connecting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Authorizing...</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold">G</span>
                      <span>Connect with Google</span>
                    </>
                  )}
                </button>
              </div>

              {connecting && (
                <div className="mt-3 flex items-center space-x-2 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg p-2.5">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span>
                    Popup opened. Please complete the Google authorization prompt.
                  </span>
                </div>
              )}
            </div>

            {/* OAuth Credentials Configuration Notice */}
            {!authStatus?.hasCredentialsConfigured && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div className="space-y-1.5 w-full">
                    <p className="font-semibold text-amber-950">
                      OAuth Credentials Setup (Google Cloud Console)
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      To authenticate with your real Blogger account, set <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code> and <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">GOOGLE_CLIENT_SECRET</code> in Settings.
                    </p>
                    <div className="mt-2 pt-2 border-t border-amber-200/80">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        Authorized Redirect URI:
                      </span>
                      <div className="mt-1 flex items-center justify-between rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-700">
                        <span className="truncate mr-2">{callbackUrl}</span>
                        <button
                          type="button"
                          onClick={copyCallbackUrl}
                          className="inline-flex items-center space-x-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 hover:bg-slate-50 shrink-0"
                        >
                          {copied ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span className="text-emerald-600">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Read-Only Scopes Specification */}
        <div className="space-y-3 mb-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Permissions & Scopes
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5 text-xs">
            <div className="flex items-start space-x-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-800">Blogger API v3 (Phase 2 Active)</span>
                  <span className="rounded bg-indigo-100 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700">
                    Read-Only
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] font-mono mt-0.5">
                  https://www.googleapis.com/auth/blogger.readonly
                </p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Retrieves blog summaries, published posts, static pages, and label taxonomies. Zero write or delete permissions.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200/80 pt-2 flex items-start space-x-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-800">Google Search Console API (Phase 3 Active)</span>
                  <span className="rounded bg-indigo-100 px-1.5 py-0.2 text-[9px] font-bold text-indigo-700">
                    Read-Only
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] font-mono mt-0.5">
                  https://www.googleapis.com/auth/webmasters.readonly
                </p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Retrieves 28-day performance metrics (clicks, impressions, CTR, average position), sitemap submission status, and coverage data.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200/80 pt-2 flex items-start space-x-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-700">Google AdSense Management (Phase 4)</span>
                  <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[9px] font-bold text-slate-600">
                    Planned
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] font-mono mt-0.5">
                  https://www.googleapis.com/auth/adsense.readonly
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 mb-5 flex items-start space-x-2.5 text-xs text-slate-600">
          <Lock className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px]">
            <strong className="text-slate-800">Strict Non-Destructive Guarantee:</strong> Tokens are stored exclusively in server-side session memory and never transmitted to client browsers. The application contains zero update or delete endpoints.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center space-x-3 text-xs text-slate-500">
            <a
              id="connect-modal-privacy-link"
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                onClose();
                onNavigatePrivacy?.();
              }}
              className="text-slate-500 hover:text-indigo-600 hover:underline transition-colors"
            >
              Privacy Policy
            </a>
            <span className="text-slate-300">•</span>
            <a
              id="connect-modal-terms-link"
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                onClose();
                onNavigateTerms?.();
              }}
              className="text-slate-500 hover:text-indigo-600 hover:underline transition-colors"
            >
              Terms of Service
            </a>
          </div>

          <button
            id="close-connect-modal-action-btn"
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
