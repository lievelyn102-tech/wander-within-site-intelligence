import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
  Globe,
  Tag,
  Calendar,
  Layers,
  FileCode,
} from 'lucide-react';
import { SiteModel, BloggerBlog, BloggerPostOrPage } from '../types';

interface BloggerViewProps {
  activeSite: SiteModel | null;
  sites?: SiteModel[];
  onOpenConnectGoogle: () => void;
  onSelectSite?: (site: SiteModel) => void;
  onRefreshSites?: () => Promise<void>;
}

export const BloggerView: React.FC<BloggerViewProps> = ({
  activeSite,
  sites,
  onOpenConnectGoogle,
  onSelectSite,
  onRefreshSites,
}) => {
  const [loading, setLoading] = useState(false);
  const [blogs, setBlogs] = useState<BloggerBlog[]>([]);
  const [selectedBlogId, setSelectedBlogId] = useState<string | null>(null);
  const [blogSummary, setBlogSummary] = useState<any | null>(null);
  const [posts, setPosts] = useState<BloggerPostOrPage[]>([]);
  const [pages, setPages] = useState<BloggerPostOrPage[]>([]);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'POST' | 'PAGE'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Helper to safely parse JSON or return null
  const safeParseJson = async (res: Response) => {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return null;
    }
    try {
      return await res.json();
    } catch {
      return null;
    }
  };

  // Load blogs on mount or when activeSite changes
  const loadBloggerData = async () => {
    setLoading(true);
    setAuthError(null);

    try {
      // 1. Check Blogger API connection & scope status
      const statusRes = await fetch('/api/blogger/status');
      const statusData = await safeParseJson(statusRes);

      if (!statusRes.ok || !statusData) {
        // Not OK or non-JSON returned - treat as disconnected without throwing unhandled parse exception
        setIsConnected(false);
        setLoading(false);
        return;
      }

      setIsConnected(Boolean(statusData.connected));

      if (!statusData.connected) {
        setLoading(false);
        return;
      }

      // 2. Fetch Blogger blogs
      const blogsRes = await fetch('/api/blogger/blogs');

      if (blogsRes.status === 401) {
        setIsConnected(false);
        setAuthError('OAuth session expired or invalidated. Please reconnect your Google account.');
        setLoading(false);
        return;
      }

      const blogsData = await safeParseJson(blogsRes);

      if (!blogsRes.ok || !blogsData) {
        const errorMsg = blogsData?.error || 'Unable to retrieve Blogger blogs. Please verify API connection.';
        setAuthError(errorMsg);
        setLoading(false);
        return;
      }

      const rawBlogs: any[] = Array.isArray(blogsData.blogs) ? blogsData.blogs : [];
      const discoveredBlogs: BloggerBlog[] = rawBlogs.map((b: any) => ({
        id: String(b.id),
        name: b.name || 'Untitled Blog',
        description: b.description || '',
        published: b.published,
        updated: b.updated,
        url: b.url || '',
        selfLink: b.selfLink,
        posts: {
          totalItems: typeof b.posts?.totalItems === 'number' ? b.posts.totalItems : Number(b.posts?.totalItems || 0),
          selfLink: b.posts?.selfLink,
        },
        pages: {
          totalItems: typeof b.pages?.totalItems === 'number' ? b.pages.totalItems : Number(b.pages?.totalItems || 0),
          selfLink: b.pages?.selfLink,
        },
        status: b.status || 'LIVE',
      }));

      setBlogs(discoveredBlogs);

      if (discoveredBlogs.length > 0) {
        // Trigger parent state refresh to sync /api/sites and Header dropdown
        if (onRefreshSites) {
          onRefreshSites().catch(() => {});
        }

        // Find matching blog or default to first
        let targetBlog = discoveredBlogs[0];
        if (activeSite?.bloggerBlogId) {
          const match = discoveredBlogs.find((b) => b.id === activeSite.bloggerBlogId);
          if (match) targetBlog = match;
        } else if (activeSite?.url) {
          const cleanSiteUrl = activeSite.url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
          const match = discoveredBlogs.find(
            (b) => b.url.replace(/^https?:\/\//i, '').replace(/\/+$/, '') === cleanSiteUrl
          );
          if (match) targetBlog = match;
        }

        setSelectedBlogId(targetBlog.id);
        await loadBlogDetails(targetBlog.id);

        if (onSelectSite && (!activeSite || !activeSite.bloggerBlogId)) {
          const siteModel = sites?.find((s) => s.bloggerBlogId === targetBlog.id) || {
            id: `site_blogger_${targetBlog.id}`,
            bloggerBlogId: targetBlog.id,
            name: targetBlog.name,
            url: targetBlog.url,
            platform: targetBlog.url.includes('.blogspot.') ? 'blogger_subdomain' : 'blogger_custom_domain',
            createdAt: new Date().toISOString(),
            postsCount: targetBlog.posts.totalItems,
            pagesCount: targetBlog.pages.totalItems,
            connections: {
              blogger: true,
              searchConsole: false,
              adsense: false,
              crawler: true,
            },
            healthStatus: {
              indexing: 'Ready for audit',
              technical: 'Ready for audit',
              content: 'Ready for audit',
              internalLinking: 'Ready for audit',
              adsenseReadiness: 'Ready for audit',
            },
          };
          onSelectSite(siteModel as SiteModel);
        }
      }
    } catch (err: any) {
      console.error('Error loading Blogger data:', err);
      setAuthError(err.message || 'Failed to load Blogger data.');
    } finally {
      setLoading(false);
    }
  };

  const loadBlogDetails = async (blogId: string) => {
    try {
      // Fetch summary, posts, and pages in parallel
      const [summaryRes, postsRes, pagesRes] = await Promise.all([
        fetch(`/api/blogger/blogs/${encodeURIComponent(blogId)}/summary`),
        fetch(`/api/blogger/blogs/${encodeURIComponent(blogId)}/posts?maxResults=50`),
        fetch(`/api/blogger/blogs/${encodeURIComponent(blogId)}/pages`),
      ]);

      if (summaryRes.ok && summaryRes.headers.get('content-type')?.includes('application/json')) {
        try {
          const summary = await summaryRes.json();
          setBlogSummary(summary);
        } catch {
          // ignore non-fatal parse error
        }
      }

      if (postsRes.ok && postsRes.headers.get('content-type')?.includes('application/json')) {
        try {
          const postsData = await postsRes.json();
          setPosts(postsData.posts || []);
        } catch {
          // ignore non-fatal parse error
        }
      }

      if (pagesRes.ok && pagesRes.headers.get('content-type')?.includes('application/json')) {
        try {
          const pagesData = await pagesRes.json();
          setPages(pagesData.pages || []);
        } catch {
          // ignore non-fatal parse error
        }
      }
    } catch (err) {
      console.error('Error fetching blog details:', err);
    }
  };

  useEffect(() => {
    loadBloggerData();
  }, [activeSite?.id]);

  // Combine items for the content inventory
  const combinedItems = useMemo(() => {
    const all: BloggerPostOrPage[] = [...posts, ...pages];
    return all.filter((item) => {
      // Type filter
      if (typeFilter === 'POST' && item.type !== 'Post') return false;
      if (typeFilter === 'PAGE' && item.type !== 'Page') return false;

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesUrl = item.url.toLowerCase().includes(q);
        const matchesLabel = item.labels?.some((l) => l.toLowerCase().includes(q));
        return matchesTitle || matchesUrl || matchesLabel;
      }

      return true;
    });
  }, [posts, pages, typeFilter, searchQuery]);

  // Pagination calculation
  const totalItems = combinedItems.length;
  const totalPagesCount = Math.ceil(totalItems / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return combinedItems.slice(start, start + pageSize);
  }, [combinedItems, currentPage, pageSize]);

  // Handle switching blog
  const handleSelectBlog = (blogId: string) => {
    setSelectedBlogId(blogId);
    setCurrentPage(1);
    loadBlogDetails(blogId);

    const chosenBlog = blogs.find((b) => b.id === blogId);
    if (chosenBlog && onSelectSite) {
      const siteModel = sites?.find((s) => s.bloggerBlogId === chosenBlog.id) || {
        id: `site_blogger_${chosenBlog.id}`,
        bloggerBlogId: chosenBlog.id,
        name: chosenBlog.name,
        url: chosenBlog.url,
        platform: chosenBlog.url.includes('.blogspot.') ? 'blogger_subdomain' : 'blogger_custom_domain',
        createdAt: new Date().toISOString(),
        postsCount: chosenBlog.posts.totalItems,
        pagesCount: chosenBlog.pages.totalItems,
        connections: {
          blogger: true,
          searchConsole: false,
          adsense: false,
          crawler: true,
        },
        healthStatus: {
          indexing: 'Ready for audit',
          technical: 'Ready for audit',
          content: 'Ready for audit',
          internalLinking: 'Ready for audit',
          adsenseReadiness: 'Ready for audit',
        },
      };
      onSelectSite(siteModel as SiteModel);
    }
  };

  return (
    <div id="blogger-view" className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Blogger API v3 Diagnostic Layer
            </h3>
            {isConnected && (
              <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                <span>Connected (Read-Only)</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Read-only content retrieval, post inventory, page structures, and template metadata.
          </p>
        </div>
        <div className="mt-3 flex items-center space-x-2.5 sm:mt-0">
          {isConnected ? (
            <button
              id="refresh-blogger-data-btn"
              type="button"
              onClick={loadBloggerData}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
            </button>
          ) : (
            <button
              id="connect-blogger-google-btn"
              type="button"
              onClick={onOpenConnectGoogle}
              className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <span className="font-bold">G</span>
              <span>Connect Google Account</span>
            </button>
          )}
        </div>
      </div>

      {authError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start space-x-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <span className="font-semibold">Notice:</span> {authError}
          </div>
        </div>
      )}

      {/* When NOT connected: Clean minimal callout */}
      {!isConnected ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-3 border border-slate-100">
            <FileText className="h-6 w-6 text-slate-400" />
          </div>
          <h4 className="text-base font-semibold text-slate-900">
            Blogger API: Ready to Connect
          </h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
            Connect your Google Account with read-only permissions to securely discover all Blogger/Blogspot websites you own, inspect published articles, and audit static pages.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={onOpenConnectGoogle}
              className="inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors"
            >
              <span className="font-bold">G</span>
              <span>Connect with Google (Blogger Read-Only)</span>
            </button>
          </div>
        </div>
      ) : (
        /* Connected State: Blog Profile Summary & Content Table */
        <div className="space-y-6">
          {/* Multiple Blogs Switcher (if user has more than 1 blog) */}
          {blogs.length > 1 && (
            <div className="flex items-center space-x-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Select Discovered Blog:
              </span>
              <select
                id="discovered-blogs-select"
                value={selectedBlogId || ''}
                onChange={(e) => handleSelectBlog(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 font-medium focus:border-indigo-500 focus:outline-none"
              >
                {blogs.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.url})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Connected Blog Profile Summary Card */}
          <div
            id="blogger-profile-summary-card"
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-start space-x-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {blogSummary?.name || activeSite?.name || 'Blogger Site'}
                    </h3>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                      {blogSummary?.status || 'Connected'}
                    </span>
                  </div>
                  <a
                    href={blogSummary?.url || activeSite?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 inline-flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                  >
                    <span>{blogSummary?.url || activeSite?.url}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {blogSummary?.id && (
                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Blogger Blog ID
                  </span>
                  <p className="font-mono text-xs font-semibold text-slate-700">
                    {blogSummary.id}
                  </p>
                </div>
              )}
            </div>

            {/* Metrics Row */}
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Published Posts
                </span>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {blogSummary?.totalPosts ?? posts.length}
                </p>
                <span className="text-[11px] text-slate-500">Live articles in catalog</span>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Static Pages
                </span>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {blogSummary?.totalPages ?? pages.length}
                </p>
                <span className="text-[11px] text-slate-500">About, Privacy, Contact</span>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Access Level
                </span>
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  Read-Only v3
                </p>
                <span className="text-[11px] text-slate-500">Zero write capabilities</span>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Last Updated
                </span>
                <p className="mt-1 text-xs font-semibold text-slate-700 truncate">
                  {blogSummary?.updated
                    ? new Date(blogSummary.updated).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Recent'}
                </p>
                <span className="text-[11px] text-slate-500">Blogger API sync</span>
              </div>
            </div>
          </div>

          {/* Content Inventory Table Section */}
          <div
            id="blogger-content-inventory"
            className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs"
          >
            {/* Table Controls */}
            <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold text-slate-900">
                  Discovered Content Inventory
                </h4>
                <p className="text-[11px] text-slate-500">
                  Retrieved directly from Blogger API v3 for diagnostic and canonical inspection
                </p>
              </div>

              {/* Filters and Search */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Type Filter Pills */}
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTypeFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      typeFilter === 'ALL'
                        ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({posts.length + pages.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTypeFilter('POST');
                      setCurrentPage(1);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      typeFilter === 'POST'
                        ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Posts ({posts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTypeFilter('PAGE');
                      setCurrentPage(1);
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      typeFilter === 'PAGE'
                        ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pages ({pages.length})
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    id="blogger-content-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search by title, label, or URL..."
                    className="w-48 sm:w-64 rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Title
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Type
                    </th>
                    <th scope="col" className="px-4 py-3">
                      URL
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Published Date
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Labels / Category
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-slate-400 italic">
                        {loading ? 'Fetching content from Blogger API...' : 'No articles or pages match your search criteria.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => (
                      <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">
                          {item.title}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.type === 'Post' ? (
                            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-100">
                              Post
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100">
                              Static Page
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500 max-w-[220px] truncate">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-indigo-600 inline-flex items-center space-x-1"
                          >
                            <span className="truncate">{item.url}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px]">
                          {item.published
                            ? new Date(item.published).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {item.labels && item.labels.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {item.labels.slice(0, 3).map((lbl, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  {lbl}
                                </span>
                              ))}
                              {item.labels.length > 3 && (
                                <span className="text-[10px] text-slate-400">
                                  +{item.labels.length - 3} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              {item.type === 'Page' ? 'Standard Page' : 'Uncategorized'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPagesCount > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3">
                <div className="text-xs text-slate-500">
                  Showing <span className="font-semibold text-slate-700">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-semibold text-slate-700">
                    {Math.min(currentPage * pageSize, totalItems)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-700">{totalItems}</span> items
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="px-2 text-xs font-medium text-slate-600">
                    {currentPage} / {totalPagesCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPagesCount))}
                    disabled={currentPage >= totalPagesCount}
                    className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Planned Diagnostic Capabilities */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Planned Blogger Audit Capabilities
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
            <h5 className="text-xs font-semibold text-slate-900 mb-1">
              Article & Page Inventory
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Catalogues published posts vs drafts, static pages (About, Privacy, Contact), and publish date frequencies.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
            <h5 className="text-xs font-semibold text-slate-900 mb-1">
              Label & Category Hygiene
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Audits Blogger label taxonomy to prevent thin label archive pages from being indexed as duplicate content.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
            <h5 className="text-xs font-semibold text-slate-900 mb-1">
              Template Structural Integrity
            </h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Checks Blogger XML widget placements, viewport tags, breadcrumb schema, and canonical link generation tags.
            </p>
          </div>
        </div>
      </div>

      {/* Read-Only Guarantee */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 flex items-start space-x-2.5">
        <Lock className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px] text-slate-500">
          <strong className="text-slate-800">Strict Non-Destructive Guarantee:</strong> Wander Within Site Intelligence will NEVER edit post content, change post URLs, update themes, or modify Blogger template code. All analysis is 100% read-only.
        </p>
      </div>
    </div>
  );
};
