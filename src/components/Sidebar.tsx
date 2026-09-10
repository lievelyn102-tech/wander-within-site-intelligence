import React from 'react';
import {
  LayoutDashboard,
  Globe,
  Search,
  FileText,
  Code2,
  Layers,
  Compass,
  DollarSign,
  Sparkles,
  FileBarChart,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { NavigationTab } from '../types';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateTerms?: () => void;
}

const navItems: { id: NavigationTab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'sites', label: 'Sites', icon: Globe },
  { id: 'search_console', label: 'Search Console', icon: Search },
  { id: 'blogger', label: 'Blogger', icon: FileText },
  { id: 'technical_audit', label: 'Technical Audit', icon: Code2 },
  { id: 'content_analysis', label: 'Content Analysis', icon: Layers },
  { id: 'indexing', label: 'Indexing', icon: Compass },
  { id: 'adsense', label: 'AdSense', icon: DollarSign },
  { id: 'ai_diagnosis', label: 'AI Diagnosis', icon: Sparkles },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  onNavigatePrivacy,
  onNavigateTerms,
}) => {
  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          id="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out md:static md:translate-x-0 flex-shrink-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Branding header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h1 className="text-sm font-bold tracking-tight text-indigo-600 uppercase leading-none">
              Wander Within
            </h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase mt-1">
              Site Intelligence
            </p>
          </div>
          <button
            id="sidebar-close-btn"
            type="button"
            onClick={onCloseMobile}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-5 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Platform
          </div>
          <nav className="space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobile();
                  }}
                  className={`group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-50 text-indigo-600 font-medium'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`mr-3 h-4 w-4 shrink-0 transition-colors ${
                      isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Read-only guard footer */}
        <div className="p-4 border-t border-slate-100 bg-white space-y-2.5">
          <div className="flex items-start space-x-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-slate-800 text-[11px]">Safe Mode Active</p>
              <p className="mt-0.5 text-[10px] text-slate-500 leading-tight">
                Read-only analysis. Blogger posts and settings are never altered.
              </p>
            </div>
          </div>

          {/* Legal Links right below Safe Mode Active badge */}
          <div className="flex items-center justify-center space-x-3 text-xs pt-0.5">
            <a
              id="sidebar-privacy-link"
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                onCloseMobile();
                onNavigatePrivacy?.();
              }}
              className="font-medium text-slate-600 hover:text-indigo-600 hover:underline transition-colors whitespace-nowrap"
            >
              Privacy Policy
            </a>
            <span className="text-slate-300 select-none">•</span>
            <a
              id="sidebar-terms-link"
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                onCloseMobile();
                onNavigateTerms?.();
              }}
              className="font-medium text-slate-600 hover:text-indigo-600 hover:underline transition-colors whitespace-nowrap"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </aside>
    </>
  );
};
