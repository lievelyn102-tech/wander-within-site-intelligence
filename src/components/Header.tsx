import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  ChevronDown,
  Plus,
  Globe,
  Radio,
  ExternalLink,
  LogOut,
  User,
  ShieldCheck,
} from 'lucide-react';
import { SiteModel, NavigationTab, UserProfile } from '../types';

interface HeaderProps {
  currentTab: NavigationTab;
  sites: SiteModel[];
  activeSite: SiteModel | null;
  googleConnected?: boolean;
  userProfile?: UserProfile | null;
  onSelectSite: (site: SiteModel | null) => void;
  onOpenAddSite: () => void;
  onOpenConnectGoogle: () => void;
  onDisconnectGoogle?: () => void;
  onToggleMobileMenu: () => void;
  onRefreshSites?: () => Promise<void>;
}

const tabTitles: Record<NavigationTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Site Intelligence Dashboard',
    subtitle: 'Diagnostic overview and connection readiness for Blogger / Blogspot websites',
  },
  sites: {
    title: 'Multi-Site Manager',
    subtitle: 'Manage multiple Blogger sites, subdomains, and custom domain configurations',
  },
  search_console: {
    title: 'Google Search Console Diagnostics',
    subtitle: 'Coverage errors, sitemap status, and read-only indexing inspection architecture',
  },
  blogger: {
    title: 'Blogger API Integration',
    subtitle: 'Read-only inspection of posts, pages, feeds, and template layout health',
  },
  technical_audit: {
    title: 'Deterministic Technical Audit',
    subtitle: 'HTTP status, redirects, canonicals, robots meta tags, headings, and HTML validity',
  },
  content_analysis: {
    title: 'Content & Cannibalization Analysis',
    subtitle: 'Overlap detection, duplicate titles, topic mapping, and article depth evaluation',
  },
  indexing: {
    title: 'Indexing & Crawl Inspection',
    subtitle: 'Blogger m=1 parameters, canonical matching, robots.txt directives, and crawl coverage',
  },
  adsense: {
    title: 'AdSense Readiness Evaluation',
    subtitle: 'Content substance, navigational integrity, ads.txt presence, and policy baseline checks',
  },
  ai_diagnosis: {
    title: 'Gemini AI Diagnostic Reasoning',
    subtitle: 'High-level pattern diagnosis with Confirmed, Likely, Possible, and Unknown ratings',
  },
  reports: {
    title: 'Diagnostic Reports & History',
    subtitle: 'Audit summaries, evidence records, and technical compliance export preview',
  },
  settings: {
    title: 'Settings & Security Governance',
    subtitle: 'OAuth permissions, server environment secrets status, and read-only isolation',
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  sites,
  activeSite,
  googleConnected = false,
  userProfile = null,
  onSelectSite,
  onOpenAddSite,
  onOpenConnectGoogle,
  onDisconnectGoogle,
  onToggleMobileMenu,
  onRefreshSites,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const siteDropdownRef = useRef<HTMLDivElement>(null);

  const handleToggleSiteDropdown = () => {
    const nextState = !dropdownOpen;
    setDropdownOpen(nextState);
    if (nextState && onRefreshSites) {
      onRefreshSites().catch(() => {});
    }
  };
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const info = tabTitles[currentTab];

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        siteDropdownRef.current &&
        !siteDropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      id="app-header"
      className="sticky top-0 z-30 flex min-h-16 flex-col justify-between border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:px-8 shadow-2xs"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            id="mobile-menu-toggle-btn"
            type="button"
            onClick={onToggleMobileMenu}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50 md:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 leading-snug">
              {info.title}
            </h2>
            <p className="hidden text-xs text-slate-500 sm:block">
              {info.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2.5 sm:mt-0 sm:flex-nowrap">
        {/* Global Site Selector Dropdown */}
        <div className="relative" ref={siteDropdownRef}>
          <button
            id="site-selector-btn"
            type="button"
            onClick={handleToggleSiteDropdown}
            className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <Globe className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
            <span className="max-w-[140px] truncate sm:max-w-[190px] font-semibold">
              {activeSite ? activeSite.name : sites.length > 0 ? sites[0].name : 'Select a blog...'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          </button>

          {dropdownOpen && (
            <div
              id="site-selector-menu"
              className="absolute right-0 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg z-50 animate-in fade-in zoom-in-95"
            >
              <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                <span>Working Blogger Sites</span>
                <span>{sites.length} total</span>
              </div>

              {sites.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-500 italic text-center">
                  No Blogger sites registered yet.
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {sites.map((site) => (
                    <button
                      key={site.id}
                      id={`select-site-${site.id}`}
                      type="button"
                      onClick={() => {
                        onSelectSite(site);
                        setDropdownOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                        activeSite?.id === site.id
                          ? 'bg-indigo-50 text-indigo-800 font-semibold ring-1 ring-indigo-200'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="truncate min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5">
                          <p className="truncate font-semibold">{site.name}</p>
                          {site.connections.blogger && (
                            <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-700 shrink-0">
                              Blogger API
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-slate-400 font-mono mt-0.5">{site.url}</p>
                      </div>
                      {activeSite?.id === site.id && (
                        <Radio className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-2 border-t border-slate-100 pt-1.5">
                <button
                  id="add-site-from-dropdown-btn"
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenAddSite();
                  }}
                  className="flex w-full items-center space-x-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Blogger / Blogspot Site</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Authenticated Google Profile & Disconnect Controls */}
        {googleConnected ? (
          <div className="relative" ref={profileDropdownRef}>
            <div className="flex items-center space-x-2">
              <button
                id="google-profile-menu-btn"
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center space-x-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-xs text-emerald-900 hover:bg-emerald-100 transition-colors shadow-2xs"
              >
                {userProfile?.picture ? (
                  <img
                    src={userProfile.picture}
                    alt={userProfile.name || 'Google User'}
                    className="h-5 w-5 rounded-full object-cover ring-1 ring-emerald-400"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                    {(userProfile?.name || userProfile?.email || 'G')[0].toUpperCase()}
                  </div>
                )}
                <span className="max-w-[120px] truncate sm:max-w-[160px] font-medium">
                  {userProfile?.name || userProfile?.email || 'Google Connected'}
                </span>
                <ChevronDown className="h-3 w-3 text-emerald-600" />
              </button>

              {/* Explicit Header Disconnect Button */}
              {onDisconnectGoogle && (
                <button
                  id="header-disconnect-btn"
                  type="button"
                  onClick={onDisconnectGoogle}
                  className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors shadow-2xs"
                  title="Disconnect Google Account"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              )}
            </div>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center space-x-2.5 pb-2.5 border-b border-slate-100">
                  {userProfile?.picture ? (
                    <img
                      src={userProfile.picture}
                      alt={userProfile.name || 'Google'}
                      className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                      {(userProfile?.name || userProfile?.email || 'G')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {userProfile?.name || 'Google Account'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {userProfile?.email || 'Connected'}
                    </p>
                  </div>
                </div>

                <div className="py-2 text-[11px] text-slate-600 space-y-1">
                  <div className="flex items-center space-x-1.5 text-emerald-700 font-medium">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Read-Only Scopes Active</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Blogger API & Search Console token isolated server-side.
                  </p>
                </div>

                {onDisconnectGoogle && (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onDisconnectGoogle();
                      }}
                      className="flex w-full items-center space-x-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Disconnect Google Account</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            id="connect-google-account-btn"
            type="button"
            onClick={onOpenConnectGoogle}
            className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs transition-colors"
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center font-bold text-[11px]">
              G
            </span>
            <span>Connect Google</span>
          </button>
        )}
      </div>
    </header>
  );
};
