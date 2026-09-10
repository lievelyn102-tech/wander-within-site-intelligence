export type NavigationTab =
  | 'dashboard'
  | 'sites'
  | 'search_console'
  | 'blogger'
  | 'technical_audit'
  | 'content_analysis'
  | 'indexing'
  | 'adsense'
  | 'ai_diagnosis'
  | 'reports'
  | 'settings';

export type ConfidenceRating = 'Confirmed' | 'Likely' | 'Possible' | 'Unknown';

export interface SiteModel {
  id: string;
  name: string;
  url: string;
  platform: 'blogger_subdomain' | 'blogger_custom_domain';
  createdAt: string;
  bloggerBlogId?: string;
  postsCount?: number;
  pagesCount?: number;
  gscProperty?: string;
  gscMetrics?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  connections: {
    blogger: boolean;
    searchConsole: boolean;
    adsense: boolean;
    crawler: boolean;
  };
  healthStatus: {
    indexing: string;
    technical: string;
    content: string;
    internalLinking: string;
    adsenseReadiness: string;
  };
  lastAuditScore?: number;
  lastAuditStatus?: 'pass' | 'warning' | 'fail';
  auditedPagesCount?: number;
  lastAuditTimestamp?: string;
}

export interface InspectionIssue {
  id: string;
  category: 'canonical' | 'meta' | 'headings' | 'media' | 'links' | 'directives';
  severity: 'critical' | 'warning' | 'info' | 'good';
  title: string;
  message: string;
  recommendation?: string;
}

export interface CanonicalAudit {
  hasCanonical: boolean;
  canonicalHref: string | null;
  isAbsolute: boolean;
  isSelfReferential: boolean;
  hasMobileParameter: boolean; // contains ?m=1
  hasMobileAlternate: boolean; // <link rel="alternate" media="...">
  mobileAlternateHref: string | null;
  status: 'pass' | 'warning' | 'fail';
}

export interface MetaAudit {
  title: string | null;
  titleLength: number;
  titleStatus: 'pass' | 'warning' | 'fail';
  metaDescription: string | null;
  descriptionLength: number;
  descriptionStatus: 'pass' | 'warning' | 'fail';
  robotsDirectives: string[];
  hasNoindex: boolean;
  hasNofollow: boolean;
  hasNoarchive: boolean;
  viewport: string | null;
  hasViewport: boolean;
  openGraph: {
    title?: string;
    description?: string;
    image?: string;
    type?: string;
  };
}

export interface HeadingsAudit {
  h1Count: number;
  h1Items: string[];
  h2Count: number;
  h3Count: number;
  h4Count: number;
  status: 'pass' | 'warning' | 'fail';
  wordCount: number;
  readingTimeMinutes: number;
  isThinContent: boolean;
  isHomepage?: boolean;
  pageType?: 'INDEX_HUB' | 'POST' | 'PAGE' | string;
}

export interface MediaAudit {
  totalImages: number;
  imagesWithAlt: number;
  imagesMissingAlt: number;
  missingAltSources: string[];
  status: 'pass' | 'warning' | 'fail';
}

export interface LinksAudit {
  totalLinks: number;
  internalLinksCount: number;
  externalLinksCount: number;
  linksWithMobileParam: number; // contains ?m=1
  brokenOrEmptyHrefs: number;
  sampleInternalLinks: { text: string; href: string }[];
  sampleExternalLinks: { text: string; href: string }[];
  status: 'pass' | 'warning' | 'fail';
}

export interface PageInspectionResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  statusText: string;
  responseTimeMs: number;
  redirected: boolean;
  redirectCount: number;
  redirectChain: string[];
  overallScore: number; // 0 - 100
  overallStatus: 'pass' | 'warning' | 'fail';
  timestamp: string;
  isHomepage?: boolean;
  isPostPage?: boolean;
  pageType?: 'INDEX_HUB' | 'POST' | 'PAGE' | string;
  canonical: CanonicalAudit;
  meta: MetaAudit;
  headings: HeadingsAudit;
  media: MediaAudit;
  links: LinksAudit;
  issues: InspectionIssue[];
}

export interface RobotsAndSitemapResult {
  siteUrl: string;
  robotsTxt: {
    url: string;
    fetched: boolean;
    statusCode: number;
    content: string;
    isDefaultBlogger: boolean;
    hasSearchDisallow: boolean;
    hasSitemapDirective: boolean;
    disallowRules: string[];
    allowRules: string[];
    sitemapsFound: string[];
    status: 'pass' | 'warning' | 'fail';
    message: string;
  };
  sitemapXml: {
    url: string;
    fetched: boolean;
    statusCode: number;
    isXml: boolean;
    entryCount: number;
    sampleUrls: string[];
    hasError: boolean;
    errorMessage?: string;
    status: 'pass' | 'warning' | 'fail';
    message: string;
  };
  atomFeed?: {
    url: string;
    fetched: boolean;
    statusCode: number;
    entryCount: number;
  };
  timestamp: string;
}

export interface GscSiteProperty {
  siteUrl: string;
  permissionLevel: string;
}

export interface GscQueryMetric {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPageMetric {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPerformanceData {
  siteUrl: string;
  startDate: string;
  endDate: string;
  days: number;
  metrics: {
    totalClicks: number;
    totalImpressions: number;
    averageCtr: number;
    averagePosition: number;
  };
  topQueries: GscQueryMetric[];
  topPages: GscPageMetric[];
}

export interface GscSitemapEntry {
  path: string;
  lastSubmitted?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  errors: number;
  warnings: number;
  submitted: number;
  indexed: number;
}

export interface GscCoverageSummaryData {
  siteUrl: string;
  verified: boolean;
  sitemapsCount: number;
  totalSubmittedUrls: number;
  totalIndexedUrls: number;
  errorsCount: number;
  warningsCount: number;
  hasDefaultSitemap: boolean;
  hasAtomFeed: boolean;
  sitemaps: GscSitemapEntry[];
  indexingStatus: string;
}

export interface GscMatchPropertyResult {
  matched: boolean;
  property: GscSiteProperty | null;
  matchType?: 'exact_url' | 'prefix' | 'sc_domain' | 'none';
  targetUrl: string;
  allProperties: GscSiteProperty[];
  message?: string;
}

export interface BloggerBlog {
  id: string;
  name: string;
  description?: string;
  published?: string;
  updated?: string;
  url: string;
  selfLink?: string;
  posts: {
    totalItems: number;
    selfLink?: string;
  };
  pages: {
    totalItems: number;
    selfLink?: string;
  };
  status?: string;
}

export interface BloggerPostOrPage {
  id: string;
  title: string;
  url: string;
  type: 'Post' | 'Page';
  published: string;
  updated: string;
  labels?: string[];
  status: string;
  author?: string;
}

export interface HealthMetricCard {
  id: string;
  category: 'Indexing' | 'Technical' | 'Content' | 'Internal Linking' | 'AdSense Readiness';
  status: 'Not connected';
  description: string;
  plannedChecks: string[];
}

export interface DiagnosticArchitectureSpec {
  framework: string;
  deterministicChecks: string[];
  geminiReasoningLayer: string[];
  confidenceLevels: { level: ConfidenceRating; description: string }[];
  ethicsPolicy: string;
}

export interface GoogleAuthStatus {
  connected: boolean;
  statusText: string;
  readOnlyAccessEnforced: boolean;
  hasCredentialsConfigured: boolean;
  userEmail?: string | null;
  error?: string | null;
  plannedScopes: {
    service: string;
    scope: string;
    description: string;
  }[];
  architectureNotice: string;
  callbackUrl?: string;
}

export type AiConfidence = 'CONFIRMED' | 'LIKELY' | 'POSSIBLE' | 'UNKNOWN';
export type AiFindingCategory = 'INDEXING' | 'TECHNICAL' | 'CONTENT' | 'INTERNAL_LINKING' | 'STRUCTURE';

export interface AiDiagnosticFinding {
  id?: string;
  title: string;
  confidence: AiConfidence;
  category: AiFindingCategory;
  evidence: string;
  explanation: string;
  actionStep: string;
  targetUrl?: string;
  targetTitle?: string;
  target?: {
    url?: string;
    title?: string;
    type?: string;
  } | string;
}

export interface AiDiagnosisResult {
  overallAssessment: string;
  primaryBottleneck: string;
  findings: AiDiagnosticFinding[];
  contentSynergyNotes: string;
  modelUsed?: string;
  timestamp: string;
  isFallback?: boolean;
}

export interface GscUrlInspectionData {
  inspectionUrl: string;
  siteUrl?: string;
  coverageState?: string;
  verdict?: 'PASS' | 'NEUTRAL' | 'FAIL' | string;
  indexingState?: string;
  robotstxtState?: string;
  lastCrawlTime?: string | null;
  userCanonical?: string | null;
  googleCanonical?: string | null;
  pageFetchState?: string;
  referringUrls?: string[];
  crawledAs?: string;
  isPropertyError?: boolean;
  isNotCrawled?: boolean;
  rawInspectionResult?: any;
}

export interface AiDiagnosisContext {
  site?: {
    name: string;
    url: string;
    postsCount?: number;
    platform?: string;
  };
  inspectedPage?: {
    url: string;
    title?: string;
  };
  technicalAudit?: {
    url?: string;
    title?: string;
    targetUrl?: string;
    targetTitle?: string;
    overallScore: number;
    overallStatus: string;
    canonicalStatus?: string;
    canonicalHref?: string | null;
    redirectCount?: number;
    h1Count?: number;
    wordCount?: number;
    missingAltCount?: number;
    internalLinksCount?: number;
    linksWithMobileParam?: number;
    issues?: Array<{ title: string; severity: string; message: string }>;
  };
  robotsSitemap?: {
    robotsStatus?: string;
    hasSearchDisallow?: boolean;
    hasSitemapDirective?: boolean;
    sitemapEntryCount?: number;
    sitemapStatus?: string;
  };
  gsc?: {
    totalClicks?: number;
    totalImpressions?: number;
    averageCtr?: number;
    averagePosition?: number;
    topQueries?: Array<{ query: string; clicks: number; impressions: number; position: number }>;
    indexingStatus?: string;
    urlInspection?: GscUrlInspectionData | null;
  };
  contentSample?: Array<{ title: string; url?: string; wordCount?: number; labels?: string[] }>;
  customNotes?: string;
}

export interface AdsTxtCheck {
  url: string;
  exists: boolean;
  statusCode: number;
  contentSnippet: string | null;
  hasValidFormat: boolean;
  publisherId: string | null;
  status: 'pass' | 'warning' | 'fail';
  message: string;
}

export interface TrustPageItem {
  type: 'privacy' | 'about' | 'contact' | 'terms';
  name: string;
  found: boolean;
  url: string | null;
  source: 'pages_api' | 'navigation_links' | 'heuristic' | 'none';
}

export interface TrustPagesCheck {
  privacyPolicy: TrustPageItem;
  aboutUs: TrustPageItem;
  contact: TrustPageItem;
  terms: TrustPageItem;
  foundCount: number;
  totalRequired: number;
  status: 'pass' | 'warning' | 'fail';
  message: string;
}

export interface ContentThresholdCheck {
  totalPublishedPosts: number;
  recommendedMinimum: number;
  isVolumeSufficient: boolean;
  averageWordCount: number;
  thinContentCount: number;
  status: 'pass' | 'warning' | 'fail';
  message: string;
}

export interface MediapartnersCheck {
  robotsUrl: string;
  isCrawlerAllowed: boolean;
  hasExplicitDisallow: boolean;
  status: 'pass' | 'warning' | 'fail';
  message: string;
}

export interface NavigationHygieneCheck {
  totalNavigationLinks: number;
  brokenOrPlaceholderLinksCount: number;
  sampleBrokenHrefs: string[];
  emptyCategoryOrLabelRisk: boolean;
  status: 'pass' | 'warning' | 'fail';
  message: string;
}

export interface AdSenseReadinessReport {
  siteId: string;
  siteUrl: string;
  siteName: string;
  readinessScore: number;
  readinessStatus: 'ready' | 'needs_improvement' | 'action_required';
  checkedAt: string;
  checks: {
    adsTxt: AdsTxtCheck;
    trustPages: TrustPagesCheck;
    contentThreshold: ContentThresholdCheck;
    mediapartners: MediapartnersCheck;
    navigation: NavigationHygieneCheck;
  };
  rejectionRisks: Array<{
    riskType: string;
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    actionRequired: string;
  }>;
}

export interface AdSenseAiPolicyFinding {
  title: string;
  confidence: AiConfidence;
  policyArea: 'CONTENT_QUALITY' | 'NAVIGATION' | 'POLICY_PAGES' | 'TECHNICAL_SETUP' | 'ADS_TXT';
  evidence: string;
  explanation: string;
  actionStep: string;
}

export interface AdSenseAiPolicyReview {
  overallReadinessAssessment: string;
  primaryPolicyRisk: string;
  findings: AdSenseAiPolicyFinding[];
  remediationRoadmap: string[];
  disclaimer: string;
  modelUsed: string;
  timestamp: string;
  isFallback?: boolean;
}

export interface UserProfile {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userPicture?: string | null;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
}

export interface SessionInfo {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  userPicture?: string | null;
  connected: boolean;
  activeSiteId: string | null;
  sitesCount: number;
  scopes: {
    blogger: boolean;
    searchConsole: boolean;
    adsense: boolean;
  };
  cacheStats: {
    inspectionsCount: number;
    sitemapsCached: number;
    diagnosesCached: number;
    adSenseReportsCached: number;
    adSenseReviewsCached: number;
  };
}

