/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ConnectGoogleModal } from './components/ConnectGoogleModal';
import { AddSiteModal } from './components/AddSiteModal';
import { DashboardView } from './views/DashboardView';
import { SitesView } from './views/SitesView';
import { SearchConsoleView } from './views/SearchConsoleView';
import { BloggerView } from './views/BloggerView';
import { TechnicalAuditView } from './views/TechnicalAuditView';
import { ContentAnalysisView } from './views/ContentAnalysisView';
import { IndexingView } from './views/IndexingView';
import { AdSenseView } from './views/AdSenseView';
import { AiDiagnosisView } from './views/AiDiagnosisView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { PrivacyPolicyView } from './views/PrivacyPolicyView';
import { TermsOfServiceView } from './views/TermsOfServiceView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NavigationTab, SiteModel, UserProfile } from './types';

function normalizeLegalPath(rawPath: string): string {
  if (!rawPath) return '/';
  const clean = rawPath.split('?')[0].split('#')[0].replace(/\/+$/, '').toLowerCase() || '/';
  if (clean === '/term') return '/terms';
  return clean;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [sites, setSites] = useState<SiteModel[]>([]);
  const [activeSite, setActiveSite] = useState<SiteModel | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [addSiteOpen, setAddSiteOpen] = useState(false);
  const [connectGoogleOpen, setConnectGoogleOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return normalizeLegalPath(window.location.pathname);
    }
    return '/';
  });

  // Listen to browser forward/back buttons and handle /term alias redirect cleanly
  useEffect(() => {
    const handleLocationChange = () => {
      if (typeof window === 'undefined') return;
      const rawPath = window.location.pathname || '/';
      const normalized = normalizeLegalPath(rawPath);
      // Cleanly redirect /term or /term/ alias to /terms
      if (rawPath === '/term' || rawPath === '/term/') {
        window.history.replaceState({}, '', '/terms');
      }
      setCurrentPath(normalized);
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      const normalized = normalizeLegalPath(path);
      const urlToPush = normalized === '/terms' ? '/terms' : normalized === '/privacy' ? '/privacy' : normalized;
      window.history.pushState({}, '', urlToPush);
      setCurrentPath(normalized);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Synchronize auth state, user profile, discovered blogs, and registered sites
  const refreshSitesAndAuth = async () => {
    try {
      const statusRes = await fetch('/api/auth/google/status');
      let isConnected = false;
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        isConnected = Boolean(statusData.connected);
        setGoogleConnected(isConnected);
        setUserProfile({
          userId: statusData.userId,
          userEmail: statusData.userEmail,
          userName: statusData.userName,
          userPicture: statusData.userPicture,
          email: statusData.userEmail,
          name: statusData.userName,
          picture: statusData.userPicture,
        });
      }

      // Proactively trigger server-side Blogger discovery if connected
      let bloggerSites: SiteModel[] | null = null;
      let bloggerActiveSiteId: string | null = null;
      if (isConnected) {
        try {
          const blogRes = await fetch('/api/blogger/blogs');
          if (blogRes.ok) {
            const blogData = await blogRes.json();
            if (Array.isArray(blogData.sites) && blogData.sites.length > 0) {
              bloggerSites = blogData.sites;
              bloggerActiveSiteId = blogData.activeSiteId || null;
            }
          }
        } catch (blogErr) {
          console.warn('Could not auto-sync blogs:', blogErr);
        }
      }

      const sitesRes = await fetch('/api/sites');
      if (sitesRes.ok) {
        const sitesData = await sitesRes.json();
        const availableSites: SiteModel[] =
          Array.isArray(sitesData.sites) && sitesData.sites.length > 0
            ? sitesData.sites
            : (bloggerSites || []);

        setSites(availableSites);

        const targetActiveId = sitesData.activeSiteId || bloggerActiveSiteId;

        setActiveSite((prev) => {
          if (targetActiveId) {
            const found = availableSites.find((s: SiteModel) => s.id === targetActiveId);
            if (found) return found;
          }
          if (prev) {
            const updated = availableSites.find((s: SiteModel) => s.id === prev.id);
            if (updated) return updated;
          }
          return availableSites.length > 0 ? availableSites[0] : null;
        });
      } else if (bloggerSites && bloggerSites.length > 0) {
        setSites(bloggerSites);
        setActiveSite((prev) => {
          if (bloggerActiveSiteId) {
            const found = bloggerSites!.find((s) => s.id === bloggerActiveSiteId);
            if (found) return found;
          }
          return prev || bloggerSites![0];
        });
      }
    } catch (err) {
      console.error('Error refreshing sites and auth:', err);
    }
  };

  useEffect(() => {
    refreshSitesAndAuth();
  }, []);

  const handleSelectSite = async (site: SiteModel | null) => {
    setActiveSite(site);
    if (site) {
      try {
        await fetch('/api/sites/active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId: site.id }),
        });
      } catch (err) {
        console.warn('Could not notify server of active site switch:', err);
      }
    }
  };

  const handleAddSite = (newSite: SiteModel) => {
    setSites((prev) => [...prev, newSite]);
    handleSelectSite(newSite);
  };

  const handleAddExternalSite = async (url: string, name?: string) => {
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add external site.');
    }
    const data = await res.json();
    if (data.site) {
      handleAddSite(data.site);
    }
  };

  const handleDeleteSite = async (id: string) => {
    try {
      await fetch(`/api/sites/${id}`, { method: 'DELETE' });
      setSites((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (activeSite?.id === id) {
          const next = filtered.length > 0 ? filtered[0] : null;
          handleSelectSite(next);
        }
        return filtered;
      });
    } catch (err) {
      console.error('Failed to delete site:', err);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await fetch('/api/auth/google/disconnect', { method: 'POST' });
      await refreshSitesAndAuth();
    } catch (err) {
      console.error('Error disconnecting Google:', err);
    }
  };

  const handleClearSession = async () => {
    try {
      await fetch('/api/session/clear', { method: 'POST' });
      setSites([]);
      setActiveSite(null);
      setGoogleConnected(false);
      setUserProfile(null);
      await refreshSitesAndAuth();
    } catch (err) {
      console.error('Error clearing session:', err);
    }
  };

  const renderActiveView = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardView
            activeSite={activeSite}
            onOpenAddSite={() => setAddSiteOpen(true)}
            onOpenConnectGoogle={() => setConnectGoogleOpen(true)}
            onSelectTab={(tab) => setCurrentTab(tab)}
            onNavigatePrivacy={() => navigateTo('/privacy')}
            onNavigateTerms={() => navigateTo('/terms')}
          />
        );
      case 'sites':
        return (
          <SitesView
            sites={sites}
            activeSite={activeSite}
            onSelectSite={handleSelectSite}
            onOpenAddSite={() => setAddSiteOpen(true)}
            onDeleteSite={handleDeleteSite}
            onRunAudit={(site) => {
              handleSelectSite(site);
              setCurrentTab('technical_audit');
            }}
            onViewReport={(site) => {
              handleSelectSite(site);
              setCurrentTab('reports');
            }}
            onAddExternalSite={handleAddExternalSite}
          />
        );
      case 'search_console':
        return (
          <SearchConsoleView
            activeSite={activeSite}
            onOpenConnectGoogle={() => setConnectGoogleOpen(true)}
            onRefreshSites={refreshSitesAndAuth}
          />
        );
      case 'blogger':
        return (
          <BloggerView
            activeSite={activeSite}
            sites={sites}
            onOpenConnectGoogle={() => setConnectGoogleOpen(true)}
            onSelectSite={handleSelectSite}
            onRefreshSites={refreshSitesAndAuth}
          />
        );
      case 'technical_audit':
        return (
          <TechnicalAuditView
            activeSite={activeSite}
            onOpenAddSite={() => setAddSiteOpen(true)}
            onRefreshSites={refreshSitesAndAuth}
            onSelectTab={(tab) => setCurrentTab(tab)}
          />
        );
      case 'content_analysis':
        return (
          <ContentAnalysisView
            activeSite={activeSite}
            onOpenConnectGoogle={() => setConnectGoogleOpen(true)}
            onSelectTab={(tab) => setCurrentTab(tab as any)}
          />
        );
      case 'indexing':
        return (
          <IndexingView
            activeSite={activeSite}
            onOpenConnectGoogle={() => setConnectGoogleOpen(true)}
            onSelectTab={(tab) => setCurrentTab(tab)}
          />
        );
      case 'adsense':
        return (
          <AdSenseView
            activeSite={activeSite}
            onOpenConnectGoogle={() => setConnectGoogleOpen(true)}
          />
        );
      case 'ai_diagnosis':
        return (
          <ErrorBoundary
            fallbackTitle="AI Diagnosis Error"
            fallbackMessage="An unexpected error occurred while rendering the AI Diagnostic Reasoning interface. Click Try Again to reload or return to the dashboard."
            onNavigateDashboard={() => setCurrentTab('dashboard')}
          >
            <AiDiagnosisView
              activeSite={activeSite}
              onSelectTab={(tab) => setCurrentTab(tab)}
              onOpenAddSite={() => setAddSiteOpen(true)}
            />
          </ErrorBoundary>
        );
      case 'reports':
        return <ReportsView activeSite={activeSite} />;
      case 'settings':
        return (
          <SettingsView
            userProfile={userProfile}
            activeSite={activeSite}
            onRefreshGoogleAssets={refreshSitesAndAuth}
            onClearSession={handleClearSession}
            onNavigatePrivacy={() => navigateTo('/privacy')}
            onNavigateTerms={() => navigateTo('/terms')}
          />
        );
      default:
        return (
          <DashboardView
            activeSite={activeSite}
            onOpenAddSite={() => setAddSiteOpen(true)}
            onOpenConnectGoogle={() => setConnectGoogleOpen(true)}
            onSelectTab={(tab) => setCurrentTab(tab)}
            onNavigatePrivacy={() => navigateTo('/privacy')}
            onNavigateTerms={() => navigateTo('/terms')}
          />
        );
    }
  };

  // Standalone Public Legal Routes (Unauthenticated and Authenticated alike)
  // Google OAuth verification requires these to be immediately viewable without redirects or barriers
  const activeLegalRoute = normalizeLegalPath(currentPath);

  if (activeLegalRoute === '/privacy') {
    return (
      <PrivacyPolicyView
        onNavigateHome={() => navigateTo('/')}
        onNavigateTerms={() => navigateTo('/terms')}
      />
    );
  }

  if (activeLegalRoute === '/terms') {
    return (
      <TermsOfServiceView
        onNavigateHome={() => navigateTo('/')}
        onNavigatePrivacy={() => navigateTo('/privacy')}
      />
    );
  }

  return (
    <div id="app-root" className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-800 antialiased">
      {/* Main Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onNavigatePrivacy={() => navigateTo('/privacy')}
        onNavigateTerms={() => navigateTo('/terms')}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 min-h-screen bg-[#F8FAFC]">
        <Header
          currentTab={currentTab}
          sites={sites}
          activeSite={activeSite}
          googleConnected={googleConnected}
          userProfile={userProfile}
          onSelectSite={handleSelectSite}
          onOpenAddSite={() => setAddSiteOpen(true)}
          onOpenConnectGoogle={() => setConnectGoogleOpen(true)}
          onDisconnectGoogle={handleDisconnectGoogle}
          onToggleMobileMenu={() => setMobileOpen((prev) => !prev)}
          onRefreshSites={refreshSitesAndAuth}
        />

        <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <ErrorBoundary
            fallbackTitle="View Rendering Error"
            fallbackMessage="An unexpected error occurred while loading this view. You can return to the dashboard or try reloading this component."
            onNavigateDashboard={() => setCurrentTab('dashboard')}
          >
            {renderActiveView()}
          </ErrorBoundary>
        </main>

        {/* Persistent Footer at the bottom of the main content area */}
        <footer id="app-persistent-footer" className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-xs py-3.5 px-4 sm:px-6 lg:px-8 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700">Wander Within Site Intelligence</span>
              <span className="text-slate-300 select-none">•</span>
              <span className="text-slate-500">Read-Only Technical SEO &amp; Taxonomy Diagnostics</span>
            </div>
            <div className="flex items-center space-x-4">
              <a
                id="persistent-footer-privacy-link"
                href="/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/privacy');
                }}
                className="font-medium text-slate-600 hover:text-indigo-600 hover:underline transition-colors whitespace-nowrap"
              >
                Privacy Policy
              </a>
              <span className="text-slate-300 select-none">•</span>
              <a
                id="persistent-footer-terms-link"
                href="/terms"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/terms');
                }}
                className="font-medium text-slate-600 hover:text-indigo-600 hover:underline transition-colors whitespace-nowrap"
              >
                Terms of Service
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Modals */}
      <ConnectGoogleModal
        isOpen={connectGoogleOpen}
        onClose={() => setConnectGoogleOpen(false)}
        onAuthSuccess={refreshSitesAndAuth}
        onNavigatePrivacy={() => navigateTo('/privacy')}
        onNavigateTerms={() => navigateTo('/terms')}
      />

      <AddSiteModal
        isOpen={addSiteOpen}
        onClose={() => setAddSiteOpen(false)}
        onAddSite={handleAddSite}
        onOpenConnectGoogle={() => setConnectGoogleOpen(true)}
      />
    </div>
  );
}
