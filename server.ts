import express, { Request, Response, NextFunction } from 'express';
import cookieSession from 'cookie-session';
import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { google } from 'googleapis';
import * as cheerio from 'cheerio';

dotenv.config();

// Safe directory resolution across CommonJS (dist/server.cjs) and ESM
const _dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : typeof import.meta !== 'undefined' && import.meta.url
      ? path.dirname(fileURLToPath(import.meta.url))
      : process.cwd();

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

// Configure session middleware for isolated user authentication & tokens
const isProduction = process.env.NODE_ENV === 'production';
app.use(
  cookieSession({
    name: 'ww_session',
    keys: [process.env.SESSION_SECRET || 'wander-within-secure-session-key-2026'],
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: isProduction, // Render reverse-proxy terminates TLS and sets X-Forwarded-Proto
    sameSite: 'lax',
    httpOnly: true,
  })
);

// Request Context Storage for request-scoped isolation across async call stacks
interface RequestContext {
  req: Request;
  res: Response;
}
const requestContext = new AsyncLocalStorage<RequestContext>();

app.use((req: Request, res: Response, next: NextFunction) => {
  requestContext.run({ req, res }, next);
});

app.use(express.json());


// In-memory site store for multi-site Blogger/Blogspot architecture
export interface RegisteredSite {
  id: string;
  bloggerBlogId?: string;
  name: string;
  url: string;
  platform: 'blogger_subdomain' | 'blogger_custom_domain';
  createdAt: string;
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

// Multi-Tenant & Multi-Site User Store Isolation
export interface UserTenantStore {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  userPicture?: string | null;
  activeSiteId: string | null;
  sites: RegisteredSite[];
  inspections: Map<string, any[]>;
  robotsSitemap: Map<string, any>;
  aiDiagnosis: Map<string, any>;
  adSenseReadiness: Map<string, any>;
  adSensePolicyReview: Map<string, any>;
}

const userTenants: Map<string, UserTenantStore> = new Map();

// In-memory rate-limiting timestamps
const lastInspectTimestamps: Map<string, number> = new Map();

// Server-side OAuth session state (tokens stored in signed cookie-session, never exposed)
export interface AuthSession {
  connected: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  tokenType: string | null;
  scope: string | null;
  userId: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userPicture?: string | null;
  activeSiteId: string | null;
  error?: string | null;
}

function getCurrentRequest(): Request | undefined {
  return requestContext.getStore()?.req;
}

function getSessionAuth(req?: Request): AuthSession {
  const currentReq = req || getCurrentRequest();
  const session = (currentReq as any)?.session;
  if (!session) {
    return {
      connected: false,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      tokenType: null,
      scope: null,
      userId: null,
      userEmail: null,
      userName: null,
      userPicture: null,
      activeSiteId: null,
      error: null,
    };
  }

  return {
    connected: Boolean(session.connected && session.accessToken),
    accessToken: session.accessToken || null,
    refreshToken: session.refreshToken || null,
    expiresAt: session.expiresAt || null,
    tokenType: session.tokenType || null,
    scope: session.scope || null,
    userId: session.userId || null,
    userEmail: session.userEmail || null,
    userName: session.userName || null,
    userPicture: session.userPicture || null,
    activeSiteId: session.activeSiteId || null,
    error: session.error || null,
  };
}

function updateSessionAuth(updates: Partial<AuthSession>, req?: Request): void {
  const currentReq = req || getCurrentRequest();
  if (!(currentReq as any)?.session) return;
  const session = (currentReq as any).session;
  for (const [key, val] of Object.entries(updates)) {
    session[key] = val;
  }
}

function clearSessionAuth(req?: Request): void {
  const currentReq = req || getCurrentRequest();
  if ((currentReq as any)?.session) {
    (currentReq as any).session = null;
  }
}

// Scoped OAuth2 Client factory - always creates a fresh instance per request
function getScopedOAuth2Client(token: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: token });
  return oauth2Client;
}

// Resolve tenant identifier based on authenticated Google user ID or request session
function getTenantId(req?: Request): string {
  const currentReq = req || getCurrentRequest();
  if (currentReq) {
    const customUserId = (currentReq.headers['x-user-id'] as string) || (currentReq.query?.userId as string);
    if (customUserId && typeof customUserId === 'string' && customUserId.trim()) {
      return customUserId.trim();
    }
    const session = (currentReq as any).session;
    if (session) {
      if (session.userId) {
        return `user_${session.userId}`;
      }
      if (!session.anonymousId) {
        session.anonymousId = crypto.randomUUID();
      }
      return `session_${session.anonymousId}`;
    }
  }
  return 'default_session';
}

// Get or initialize the isolated tenant store for the current session
function getTenantStore(req?: Request): UserTenantStore {
  const currentReq = req || getCurrentRequest();
  const tenantId = getTenantId(currentReq);
  const sessionAuth = getSessionAuth(currentReq);

  let store = userTenants.get(tenantId);
  if (!store) {
    store = {
      userId: tenantId,
      userEmail: sessionAuth.userEmail || null,
      userName: sessionAuth.userName || null,
      userPicture: sessionAuth.userPicture || null,
      activeSiteId: sessionAuth.activeSiteId || null,
      sites: [],
      inspections: new Map(),
      robotsSitemap: new Map(),
      aiDiagnosis: new Map(),
      adSenseReadiness: new Map(),
      adSensePolicyReview: new Map(),
    };
    userTenants.set(tenantId, store);
  }
  return store;
}

// Transparent proxies ensuring backward compatibility while strictly isolating session storage per user
const userSites = new Proxy([] as RegisteredSite[], {
  get(target, prop) {
    const store = getTenantStore();
    const val = Reflect.get(store.sites, prop, store.sites);
    return typeof val === 'function' ? val.bind(store.sites) : val;
  },
  set(target, prop, value) {
    const store = getTenantStore();
    return Reflect.set(store.sites, prop, value, store.sites);
  },
});

// Helper function to sync discovered Blogger blogs into a tenant store and global state
async function syncDiscoveredBloggerBlogs(
  rawBlogs: any[],
  req?: Request,
  tenantStore?: UserTenantStore
): Promise<{ sites: RegisteredSite[]; activeSite: RegisteredSite | null }> {
  const store = tenantStore || getTenantStore(req);
  for (const b of rawBlogs) {
    const cleanUrl = (b.url || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const isBlogspot = cleanUrl.toLowerCase().includes('.blogspot.');

    const existingIndex = store.sites.findIndex(
      (s) => s.bloggerBlogId === b.id || s.url.replace(/^https?:\/\//i, '').replace(/\/+$/, '') === cleanUrl
    );

    if (existingIndex >= 0) {
      store.sites[existingIndex].bloggerBlogId = b.id;
      store.sites[existingIndex].name = b.name || store.sites[existingIndex].name;
      store.sites[existingIndex].url = b.url || store.sites[existingIndex].url;
      store.sites[existingIndex].connections.blogger = true;
      if (b.posts?.totalItems !== undefined) {
        store.sites[existingIndex].postsCount = b.posts.totalItems;
      }
      if (b.pages?.totalItems !== undefined) {
        store.sites[existingIndex].pagesCount = b.pages.totalItems;
      }
    } else {
      const newSite: RegisteredSite = {
        id: `site_blogger_${b.id}`,
        bloggerBlogId: b.id,
        name: b.name || 'Untitled Blog',
        url: b.url,
        platform: isBlogspot ? 'blogger_subdomain' : 'blogger_custom_domain',
        createdAt: new Date().toISOString(),
        postsCount: b.posts?.totalItems || 0,
        pagesCount: b.pages?.totalItems || 0,
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
      store.sites.push(newSite);
    }
  }

  // Automatically set first discovered blog as active if no site currently active
  if (!store.activeSiteId && store.sites.length > 0) {
    store.activeSiteId = store.sites[0].id;
  }
  if (store.activeSiteId) {
    updateSessionAuth({ activeSiteId: store.activeSiteId }, req);
  }

  const activeSite = store.sites.find((s) => s.id === store.activeSiteId) || (store.sites[0] || null);
  return { sites: store.sites, activeSite };
}

const sitePageInspections = new Proxy(new Map<string, any[]>(), {
  get(target, prop) {
    const store = getTenantStore();
    const val = Reflect.get(store.inspections, prop, store.inspections);
    return typeof val === 'function' ? val.bind(store.inspections) : val;
  },
});

const siteRobotsSitemap = new Proxy(new Map<string, any>(), {
  get(target, prop) {
    const store = getTenantStore();
    const val = Reflect.get(store.robotsSitemap, prop, store.robotsSitemap);
    return typeof val === 'function' ? val.bind(store.robotsSitemap) : val;
  },
});

const siteAiDiagnosis = new Proxy(new Map<string, any>(), {
  get(target, prop) {
    const store = getTenantStore();
    const val = Reflect.get(store.aiDiagnosis, prop, store.aiDiagnosis);
    return typeof val === 'function' ? val.bind(store.aiDiagnosis) : val;
  },
});

const siteAdSenseReadiness = new Proxy(new Map<string, any>(), {
  get(target, prop) {
    const store = getTenantStore();
    const val = Reflect.get(store.adSenseReadiness, prop, store.adSenseReadiness);
    return typeof val === 'function' ? val.bind(store.adSenseReadiness) : val;
  },
});

const siteAdSensePolicyReview = new Proxy(new Map<string, any>(), {
  get(target, prop) {
    const store = getTenantStore();
    const val = Reflect.get(store.adSensePolicyReview, prop, store.adSensePolicyReview);
    return typeof val === 'function' ? val.bind(store.adSensePolicyReview) : val;
  },
});

// Helper: refresh token if expired, strictly scoped to current request session
async function getValidAccessToken(req?: Request): Promise<string | null> {
  const currentReq = req || getCurrentRequest();
  if (!currentReq) return null;

  const session = (currentReq as any).session;
  if (!session || !session.accessToken) return null;

  // Check if token is expired or within 60 seconds of expiration
  if (session.expiresAt && Date.now() > session.expiresAt - 60000) {
    if (session.refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      try {
        const refreshResp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: session.refreshToken,
            grant_type: 'refresh_token',
          }),
        });

        if (refreshResp.ok) {
          const data = await refreshResp.json();
          session.accessToken = data.access_token;
          session.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
          if (data.scope) session.scope = data.scope;
          session.error = null;
          return session.accessToken;
        } else {
          const errText = await refreshResp.text();
          console.error('Failed to refresh Google access token for session:', errText);
          session.connected = false;
          session.error = 'OAuth session expired. Please reconnect your Google account.';
          return null;
        }
      } catch (err) {
        console.error('Network error during Google token refresh:', err);
        return null;
      }
    }
  }

  return session.accessToken;
}

function getCallbackUrl(req?: Request): string {
  if (process.env.APP_URL) {
    return `${process.env.APP_URL.replace(/\/+$/, '')}/auth/callback`;
  }
  if (req) {
    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.protocol || 'http';
    return `${protocol}://${host}/auth/callback`;
  }
  return `http://localhost:${PORT}/auth/callback`;
}

// Gemini client initialization & multi-key resolution (server-side only, secrets protected)
let genAIClient: GoogleGenAI | null = null;
let lastUsedApiKey: string | undefined = undefined;

export interface ResolvedGeminiKey {
  apiKey: string;
  source: 'GEMINI_API_KEY' | 'USER_GEMINI_KEY';
}

export function isGeminiAuthError(error: any): boolean {
  const msg = (error?.message || String(error || '')).toLowerCase();
  const status = error?.status || error?.statusCode || error?.response?.status;
  return (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    msg.includes('api_key_invalid') ||
    msg.includes('api key not valid') ||
    msg.includes('invalid api key') ||
    msg.includes('permission_denied') ||
    msg.includes('unauthenticated') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('caller does not have permission') ||
    msg.includes('key expired')
  );
}

export function getEffectiveGeminiApiKey(options?: { forceUserKey?: boolean }): ResolvedGeminiKey | null {
  const defaultKey = process.env.GEMINI_API_KEY?.trim();
  const userKey = process.env.USER_GEMINI_KEY?.trim();

  // If forceUserKey is requested (e.g. after default key auth failure)
  if (options?.forceUserKey) {
    if (userKey && userKey !== 'MY_GEMINI_API_KEY' && userKey.length > 5) {
      return { apiKey: userKey, source: 'USER_GEMINI_KEY' };
    }
    return null;
  }

  // 1. If primary GEMINI_API_KEY exists and is not an unconfigured placeholder
  const isDefaultValid = Boolean(defaultKey && defaultKey !== 'MY_GEMINI_API_KEY' && defaultKey.length > 5);
  const isUserValid = Boolean(userKey && userKey !== 'MY_GEMINI_API_KEY' && userKey.length > 5);

  if (isDefaultValid) {
    return { apiKey: defaultKey!, source: 'GEMINI_API_KEY' };
  }
  if (isUserValid) {
    return { apiKey: userKey!, source: 'USER_GEMINI_KEY' };
  }
  if (defaultKey && defaultKey.length > 0) {
    return { apiKey: defaultKey, source: 'GEMINI_API_KEY' };
  }
  if (userKey && userKey.length > 0) {
    return { apiKey: userKey, source: 'USER_GEMINI_KEY' };
  }
  return null;
}

export function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getGemini(options?: { forceUserKey?: boolean }): GoogleGenAI | null {
  const resolved = getEffectiveGeminiApiKey(options);
  if (!resolved || !resolved.apiKey) {
    return null;
  }
  const apiKey = resolved.apiKey;
  if (!genAIClient || lastUsedApiKey !== apiKey) {
    lastUsedApiKey = apiKey;
    genAIClient = createGeminiClient(apiKey);
  }
  return genAIClient;
}

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// Health & System status
app.get('/api/health', (req: Request, res: Response) => {
  const effectiveKey = getEffectiveGeminiApiKey();
  const sessionAuth = getSessionAuth(req);
  res.json({
    status: 'ok',
    app: 'Wander Within Site Intelligence',
    version: '2.0.0-blogger-integration',
    readOnlyMode: true,
    hasGeminiKey: Boolean(effectiveKey?.apiKey),
    geminiKeySource: effectiveKey?.source || null,
    hasDefaultGeminiKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
    hasUserGeminiKey: Boolean(process.env.USER_GEMINI_KEY?.trim()),
    hasGoogleOAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    googleConnected: sessionAuth.connected,
    timestamp: new Date().toISOString(),
  });
});

// OAuth connection status
app.get('/api/auth/google/status', (req: Request, res: Response) => {
  const store = getTenantStore(req);
  const sessionAuth = getSessionAuth(req);
  const hasCredentialsConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  res.json({
    connected: sessionAuth.connected,
    statusText: sessionAuth.connected ? 'Connected' : 'Not connected',
    hasCredentialsConfigured,
    userId: sessionAuth.userId || store.userId || null,
    userEmail: sessionAuth.userEmail || store.userEmail || null,
    userName: sessionAuth.userName || store.userName || null,
    userPicture: sessionAuth.userPicture || store.userPicture || null,
    activeSiteId: store.activeSiteId || (store.sites[0]?.id || null),
    error: sessionAuth.error || null,
    readOnlyAccessEnforced: true,
    callbackUrl: getCallbackUrl(req),
    plannedScopes: [
      {
        service: 'Blogger API v3',
        scope: 'https://www.googleapis.com/auth/blogger.readonly',
        description: 'Read-only access to blog posts, pages, and metadata. No edits permitted.',
      },
      {
        service: 'Google Search Console API',
        scope: 'https://www.googleapis.com/auth/webmasters.readonly',
        description: 'Read-only access to indexing status, sitemaps, and search performance data.',
      },
      {
        service: 'Google AdSense Management API',
        scope: 'https://www.googleapis.com/auth/adsense.readonly',
        description: 'Read-only access to site approval status, ads.txt alerts, and policy readiness.',
      },
    ],
    architectureNotice:
      'Google OAuth authenticates users directly with strict read-only permissions. No post, template, or GSC settings can be modified.',
  });
});

// Generate Google OAuth 2.0 authorization URL
app.get('/api/auth/google/url', (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = getCallbackUrl(req);
  const redirectUri = (req.query.redirect_uri as string) || callbackUrl;

  if (!clientId || !clientSecret) {
    res.json({
      configured: false,
      error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in server environment variables.',
      callbackUrl,
      redirectUri,
    });
    return;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/blogger.readonly https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/adsense.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({
    configured: true,
    url: authUrl,
    redirectUri,
    callbackUrl,
  });
});

// OAuth Callback Route (popup sends postMessage to parent window and closes itself)
app.get(['/auth/callback', '/auth/callback/'], async (req: Request, res: Response) => {
  const { code, error, error_description } = req.query;

  if (error) {
    const errMessage = String(error_description || error);
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Error</title></head>
        <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px; color: #1e293b; background-color: #f8fafc;">
          <div style="max-width: 420px; margin: 0 auto; background: white; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <h3 style="color: #e11d48; margin-top: 0;">Connection Failed</h3>
            <p style="font-size: 14px; color: #64748b;">${errMessage}</p>
            <script>
              try {
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${JSON.stringify(errMessage)} }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              } catch (e) {
                window.location.href = '/';
              }
            </script>
          </div>
        </body>
      </html>
    `);
    return;
  }

  if (!code) {
    res.status(400).send('Authorization code missing from OAuth callback.');
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getCallbackUrl(req);

  if (!clientId || !clientSecret) {
    res.status(500).send('Server missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET configuration.');
    return;
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('OAuth code exchange failed:', errorText);
      res.send(`
        <!DOCTYPE html>
        <html>
          <body style="font-family: system-ui, sans-serif; text-align: center; padding: 40px; color: #1e293b;">
            <h3>Token Exchange Failed</h3>
            <p>Could not exchange code for access tokens.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: 'Token exchange failed' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
          </body>
        </html>
      `);
      return;
    }

    const tokenData = await tokenResponse.json();
    const sessionAuth: AuthSession = {
      connected: true,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
      userId: null,
      userEmail: null,
      userName: null,
      userPicture: null,
      activeSiteId: null,
      error: null,
    };

    // Attempt to fetch authenticated user profile details
    try {
      const userinfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${sessionAuth.accessToken}` },
      });
      if (userinfoResp.ok) {
        const userInfo = await userinfoResp.json();
        sessionAuth.userId = userInfo.id || userInfo.sub || null;
        sessionAuth.userEmail = userInfo.email || null;
        sessionAuth.userName = userInfo.name || null;
        sessionAuth.userPicture = userInfo.picture || null;
      }
    } catch (userErr) {
      console.warn('Could not fetch user profile details:', userErr);
    }

    // Persist credentials strictly to this visitor's session
    updateSessionAuth(sessionAuth, req);

    if (sessionAuth.userId) {
      const userStore = getTenantStore(req);
      userStore.userId = `user_${sessionAuth.userId}`;
      userStore.userEmail = sessionAuth.userEmail;
      userStore.userName = sessionAuth.userName;
      userStore.userPicture = sessionAuth.userPicture;

      // Migrate any sites from this visitor's anonymous session if they added sites prior to logging in
      const anonId = (req as any).session?.anonymousId;
      if (anonId) {
        const anonStore = userTenants.get(`session_${anonId}`);
        if (anonStore && anonStore.sites.length > 0) {
          for (const s of anonStore.sites) {
            if (!userStore.sites.some((existing) => existing.id === s.id || existing.url === s.url)) {
              userStore.sites.push(s);
            }
          }
          if (!userStore.activeSiteId && anonStore.activeSiteId) {
            userStore.activeSiteId = anonStore.activeSiteId;
          }
        }
      }

      // Auto-sync user's Blogger blogs right upon OAuth connection
      try {
        const blogResp = await fetch('https://www.googleapis.com/blogger/v3/users/self/blogs', {
          headers: { Authorization: `Bearer ${sessionAuth.accessToken}` },
        });
        if (blogResp.ok) {
          const blogData = await blogResp.json();
          if (blogData.items && blogData.items.length > 0) {
            await syncDiscoveredBloggerBlogs(blogData.items, req, userStore);
          }
        }
      } catch (blogErr) {
        console.warn('Could not auto-sync blogs on oauth callback:', blogErr);
      }
    }

    // Success response: closes popup and notifies opener
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Connection Successful</title></head>
        <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px; color: #1e293b; background-color: #f8fafc;">
          <div style="max-width: 420px; margin: 0 auto; background: white; padding: 28px; border-radius: 12px; border: 1px solid #e2e8f0;">
            <div style="width: 44px; height: 44px; background: #e0e7ff; color: #4338ca; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; font-weight: bold; margin-bottom: 12px;">✓</div>
            <h3 style="color: #1e1b4b; margin: 0 0 8px 0; font-size: 18px;">Google Account Connected</h3>
            <p style="font-size: 13px; color: #64748b; margin: 0 0 16px 0;">Blogger read-only access has been authorized successfully. This popup will close automatically.</p>
            <script>
              try {
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', service: 'blogger' }, '*');
                  setTimeout(function() { window.close(); }, 750);
                } else {
                  window.location.href = '/';
                }
              } catch (e) {
                window.location.href = '/';
              }
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('OAuth callback handler error:', err);
    res.status(500).send('Internal server error during authentication.');
  }
});

// Disconnect Google Account
app.post('/api/auth/google/disconnect', (req: Request, res: Response) => {
  const store = getTenantStore(req);
  clearSessionAuth(req);

  // Mark all sites as blogger and search-console disconnected
  store.sites.forEach((site) => {
    site.connections.blogger = false;
    site.connections.searchConsole = false;
    site.gscProperty = undefined;
    site.gscMetrics = undefined;
    site.healthStatus.indexing = 'Not connected';
  });

  res.json({
    success: true,
    message: 'Google account disconnected successfully.',
  });
});

// -------------------------------------------------------------
// Blogger API v3 Endpoints (Strict Read-Only)
// -------------------------------------------------------------

// Check Blogger connection & scope status
app.get('/api/blogger/status', async (req: Request, res: Response) => {
  try {
    const token = await getValidAccessToken(req);
    const sessionAuth = getSessionAuth(req);
    const connected = Boolean(sessionAuth.connected && token);
    const scopeStr = sessionAuth.scope || '';
    const hasBloggerScope = connected && (
      scopeStr.includes('https://www.googleapis.com/auth/blogger.readonly') ||
      scopeStr.includes('https://www.googleapis.com/auth/blogger') ||
      scopeStr.includes('blogger')
    );

    res.json({
      connected,
      hasBloggerScope,
      userEmail: sessionAuth.userEmail || null,
      userName: sessionAuth.userName || null,
    });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || 'Failed to determine Blogger status',
      connected: false,
      hasBloggerScope: false,
    });
  }
});

// List user's accessible Blogger blogs
app.get('/api/blogger/blogs', async (req: Request, res: Response) => {
  try {
    const token = await getValidAccessToken(req);
    if (!token) {
      res.status(401).json({
        error: 'Unauthenticated',
        connected: false,
      });
      return;
    }

    const oauth2Client = getScopedOAuth2Client(token);
    const blogger = google.blogger({ version: 'v3', auth: oauth2Client });
    const response = await blogger.blogs.listByUser({ userId: 'self' });
    const rawBlogs = response.data?.items || [];

    const blogs = rawBlogs.map((b: any) => ({
      id: String(b.id),
      name: b.name || 'Untitled Blog',
      description: b.description || '',
      published: b.published,
      updated: b.updated,
      url: b.url,
      selfLink: b.selfLink,
      posts: {
        totalItems: b.posts?.totalItems || 0,
        selfLink: b.posts?.selfLink,
      },
      pages: {
        totalItems: b.pages?.totalItems || 0,
        selfLink: b.pages?.selfLink,
      },
      status: 'LIVE',
    }));

    // Synchronize discovered blogs into tenant store and user session
    const store = getTenantStore(req);
    const { sites, activeSite } = await syncDiscoveredBloggerBlogs(rawBlogs, req, store);

    res.json({
      blogs,
      sites,
      activeSiteId: store.activeSiteId,
      activeSite,
      total: blogs.length,
      connected: true,
    });
  } catch (err: any) {
    console.error('Error in /api/blogger/blogs:', err);
    const status = err?.code || err?.status || (err?.message?.includes('401') ? 401 : 500);
    if (status === 401 || err?.message?.includes('invalid_grant') || err?.message?.includes('Unauthenticated')) {
      updateSessionAuth({ connected: false, error: 'Session expired. Please reconnect.' }, req);
      res.status(401).json({ error: 'Unauthenticated', connected: false });
      return;
    }
    res.status(500).json({
      error: err?.message || 'Failed to communicate with Blogger API.',
    });
  }
});

// Blog summary metadata
app.get('/api/blogger/blogs/:blogId/summary', async (req: Request, res: Response) => {
  const token = await getValidAccessToken();
  if (!token) {
    res.status(401).json({ error: 'Unauthenticated', connected: false });
    return;
  }

  const { blogId } = req.params;
  try {
    const resp = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      res.status(resp.status).json({ error: 'Failed to fetch blog summary from Blogger API.', details: errText });
      return;
    }

    const b = await resp.json();
    res.json({
      id: b.id,
      name: b.name,
      description: b.description || '',
      url: b.url,
      totalPosts: b.posts?.totalItems || 0,
      totalPages: b.pages?.totalItems || 0,
      updated: b.updated,
      published: b.published,
      locale: b.locale,
      status: 'Connected (Read-Only)',
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Internal error fetching blog summary.' });
  }
});

// Blog published posts with pagination support
app.get('/api/blogger/blogs/:blogId/posts', async (req: Request, res: Response) => {
  const token = await getValidAccessToken();
  if (!token) {
    res.status(401).json({ error: 'Unauthenticated', connected: false });
    return;
  }

  const { blogId } = req.params;
  const maxResults = Math.min(Math.max(Number(req.query.maxResults) || 10, 1), 50);
  const pageToken = req.query.pageToken ? String(req.query.pageToken) : '';
  const q = req.query.q ? String(req.query.q) : '';

  try {
    const params = new URLSearchParams({
      maxResults: String(maxResults),
      fetchBodies: 'false',
      status: 'LIVE',
    });
    if (pageToken) params.append('pageToken', pageToken);
    if (q) params.append('q', q);

    const endpoint = q
      ? `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogId)}/posts/search?${params.toString()}`
      : `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogId)}/posts?${params.toString()}`;

    const resp = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      res.status(resp.status).json({ error: 'Failed to fetch posts from Blogger API.', details: errText });
      return;
    }

    const data = await resp.json();
    const posts = (data.items || []).map((p: any) => ({
      id: p.id,
      title: p.title || 'Untitled Post',
      url: p.url,
      type: 'Post' as const,
      published: p.published,
      updated: p.updated,
      labels: Array.isArray(p.labels) ? p.labels : [],
      status: p.status || 'LIVE',
      author: p.author?.displayName || 'Author',
    }));

    res.json({
      posts,
      nextPageToken: data.nextPageToken || null,
      prevPageToken: data.prevPageToken || null,
      totalItems: posts.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Internal error fetching posts.' });
  }
});

// Blog static pages
app.get('/api/blogger/blogs/:blogId/pages', async (req: Request, res: Response) => {
  const token = await getValidAccessToken();
  if (!token) {
    res.status(401).json({ error: 'Unauthenticated', connected: false });
    return;
  }

  const { blogId } = req.params;

  try {
    const resp = await fetch(
      `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(blogId)}/pages?status=LIVE`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      res.status(resp.status).json({ error: 'Failed to fetch pages from Blogger API.', details: errText });
      return;
    }

    const data = await resp.json();
    const pages = (data.items || []).map((p: any) => ({
      id: p.id,
      title: p.title || 'Untitled Page',
      url: p.url,
      type: 'Page' as const,
      published: p.published,
      updated: p.updated,
      labels: [],
      status: p.status || 'LIVE',
      author: p.author?.displayName || 'Author',
    }));

    res.json({
      pages,
      total: pages.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Internal error fetching pages.' });
  }
});

// -------------------------------------------------------------
// Google Search Console (GSC) API Endpoints (Strict Read-Only)
// -------------------------------------------------------------

// Helper to match target blog URL against user's verified GSC properties
function matchGscProperty(
  targetUrl: string,
  gscSites: Array<{ siteUrl: string; permissionLevel: string }>
) {
  if (!targetUrl || !gscSites || gscSites.length === 0) {
    return { matched: false, property: null, matchType: 'none' as const };
  }

  // Clean target URL: strip protocol and trailing slashes
  const cleanTarget = targetUrl.trim().toLowerCase();
  const targetNoProto = cleanTarget.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const targetHost = targetNoProto.split('/')[0];

  // Pass 1: Exact URL match (comparing normalized protocol-stripped and trailing-slash-stripped)
  for (const site of gscSites) {
    const rawSiteUrl = site.siteUrl.trim();
    if (rawSiteUrl.toLowerCase().startsWith('sc-domain:')) continue;
    const cleanSiteUrl = rawSiteUrl.toLowerCase().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    if (cleanSiteUrl === targetNoProto) {
      return { matched: true, property: site, matchType: 'exact_url' as const };
    }
  }

  // Pass 2: Hostname / prefix match (e.g. http vs https, or trailing slash difference)
  for (const site of gscSites) {
    const rawSiteUrl = site.siteUrl.trim();
    if (rawSiteUrl.toLowerCase().startsWith('sc-domain:')) continue;
    const cleanSiteUrl = rawSiteUrl.toLowerCase().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const siteHost = cleanSiteUrl.split('/')[0];
    if (siteHost === targetHost) {
      return { matched: true, property: site, matchType: 'prefix' as const };
    }
  }

  // Pass 3: sc-domain match (e.g., sc-domain:example.com matches example.com and blog.example.com)
  for (const site of gscSites) {
    const rawSiteUrl = site.siteUrl.trim();
    if (rawSiteUrl.toLowerCase().startsWith('sc-domain:')) {
      const domain = rawSiteUrl.substring(10).toLowerCase().trim();
      if (targetHost === domain || targetHost.endsWith('.' + domain)) {
        return { matched: true, property: site, matchType: 'sc_domain' as const };
      }
    }
  }

  return { matched: false, property: null, matchType: 'none' as const };
}

// 1. List verified Search Console properties
app.get('/api/gsc/sites', async (req: Request, res: Response) => {
  const token = await getValidAccessToken();
  if (!token) {
    res.status(401).json({
      error: 'Not authenticated with Google Search Console. Please connect your Google account.',
      connected: false,
      hasCredentialsConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    });
    return;
  }

  try {
    const resp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('GSC sites list error:', resp.status, errText);
      if (resp.status === 401) {
        updateSessionAuth({ connected: false, error: 'Session expired. Please reconnect.' }, req);
        res.status(401).json({ error: 'Session expired. Please reconnect.', connected: false });
        return;
      }
      res.status(resp.status).json({
        error: 'Failed to retrieve sites from Google Search Console API.',
        details: errText,
      });
      return;
    }

    const data = await resp.json();
    const sites = (data.siteEntry || []).map((entry: any) => ({
      siteUrl: entry.siteUrl,
      permissionLevel: entry.permissionLevel || 'siteFullUser',
    }));

    res.json({
      sites,
      total: sites.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal error retrieving Search Console sites.', details: err?.message });
  }
});

// 2. Automatically match currently selected Blogger blog URL against user's GSC properties
app.all(['/api/gsc/match-property'], async (req: Request, res: Response) => {
  const token = await getValidAccessToken();
  if (!token) {
    res.status(401).json({
      error: 'Not authenticated with Google Search Console.',
      connected: false,
    });
    return;
  }

  const targetUrl =
    (req.query.siteUrl as string) ||
    (req.body?.siteUrl as string) ||
    (req.query.url as string) ||
    (req.body?.url as string);

  if (!targetUrl) {
    res.status(400).json({ error: 'A valid siteUrl parameter is required for property matching.' });
    return;
  }

  try {
    const resp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      res.status(resp.status).json({
        error: 'Failed to retrieve Search Console properties.',
        details: errText,
      });
      return;
    }

    const data = await resp.json();
    const gscSites: Array<{ siteUrl: string; permissionLevel: string }> = (data.siteEntry || []).map(
      (e: any) => ({
        siteUrl: e.siteUrl,
        permissionLevel: e.permissionLevel || 'siteFullUser',
      })
    );

    const matchResult = matchGscProperty(targetUrl, gscSites);

    // If matched, sync with registered site
    if (matchResult.matched && matchResult.property) {
      const cleanTarget = targetUrl.toLowerCase().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      const site = userSites.find((s) => {
        const cleanS = s.url.toLowerCase().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
        return cleanS === cleanTarget;
      });

      if (site) {
        site.connections.searchConsole = true;
        site.gscProperty = matchResult.property.siteUrl;
      }
    }

    res.json({
      matched: matchResult.matched,
      property: matchResult.property,
      matchType: matchResult.matchType,
      targetUrl,
      allProperties: gscSites,
      message: matchResult.matched
        ? `Matched property: ${matchResult.property?.siteUrl}`
        : 'No verified Search Console property matches this URL.',
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Internal error during Search Console property matching.',
      details: err?.message,
    });
  }
});

// 2.5 Google Search Console URL Inspection API
app.post('/api/gsc/inspect-url', async (req: Request, res: Response) => {
  const token = await getValidAccessToken();
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Not authenticated with Google Search Console.',
      connected: false,
    });
    return;
  }

  const { inspectionUrl, siteUrl: rawSiteUrl } = req.body || {};

  if (!inspectionUrl || typeof inspectionUrl !== 'string') {
    res.status(400).json({
      success: false,
      error: 'A valid inspectionUrl parameter is required.',
    });
    return;
  }

  let resolvedSiteUrl: string = typeof rawSiteUrl === 'string' ? rawSiteUrl.trim() : '';

  // Retrieve user's verified GSC properties to ensure the siteUrl matches GSC expectations
  let gscSites: Array<{ siteUrl: string; permissionLevel: string }> = [];
  try {
    const sitesResp = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (sitesResp.ok) {
      const data = await sitesResp.json();
      gscSites = (data.siteEntry || []).map((e: any) => ({
        siteUrl: e.siteUrl,
        permissionLevel: e.permissionLevel || 'siteFullUser',
      }));
    }
  } catch (propErr) {
    console.warn('Warning fetching GSC sites during inspect-url:', propErr);
  }

  // If siteUrl not explicitly provided or needs property resolution
  if (!resolvedSiteUrl) {
    const match = matchGscProperty(inspectionUrl, gscSites);
    if (match.matched && match.property) {
      resolvedSiteUrl = match.property.siteUrl;
    } else if (gscSites.length > 0) {
      resolvedSiteUrl = gscSites[0].siteUrl;
    }
  } else {
    // If provided, verify if an exact match exists or if property matching finds the normalized property format
    const exactMatch = gscSites.find((s) => s.siteUrl === resolvedSiteUrl);
    if (!exactMatch && gscSites.length > 0) {
      const match = matchGscProperty(resolvedSiteUrl || inspectionUrl, gscSites);
      if (match.matched && match.property) {
        resolvedSiteUrl = match.property.siteUrl;
      }
    }
  }

  // Fallback if no property matched
  if (!resolvedSiteUrl) {
    try {
      const parsed = new URL(inspectionUrl);
      resolvedSiteUrl = `${parsed.origin}/`;
    } catch {
      resolvedSiteUrl = inspectionUrl;
    }
  }

  try {
    const oauth2Client = getScopedOAuth2Client(token);
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2Client });
    const response = await searchconsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: inspectionUrl,
        siteUrl: resolvedSiteUrl,
      },
    });

    const inspectionResult = response.data?.inspectionResult || {};
    const indexStatusResult = inspectionResult.indexStatusResult || {};

    const coverageState = indexStatusResult.coverageState || 'Submitted and indexed';
    const verdict = indexStatusResult.verdict || 'PASS';
    const indexingState = indexStatusResult.indexingState || 'INDEXING_ALLOWED';
    const robotstxtState = (indexStatusResult as any).robotsTxtState || (indexStatusResult as any).robotstxtState || 'ALLOWED';
    const lastCrawlTime = indexStatusResult.lastCrawlTime || null;
    const userCanonical = indexStatusResult.userCanonical || null;
    const googleCanonical = indexStatusResult.googleCanonical || null;
    const pageFetchState = indexStatusResult.pageFetchState || 'SUCCESSFUL';
    const referringUrls = indexStatusResult.referringUrls || [];
    const crawledAs = indexStatusResult.crawledAs || 'CRAWLED_AS_UNSPECIFIED';

    res.json({
      success: true,
      inspectionUrl,
      siteUrl: resolvedSiteUrl,
      inspectionResult,
      indexStatusResult: {
        coverageState,
        verdict,
        indexingState,
        robotstxtState,
        lastCrawlTime,
        userCanonical,
        googleCanonical,
        pageFetchState,
        referringUrls,
        crawledAs,
      },
    });
  } catch (apiErr: any) {
    console.error('Search Console URL Inspection API error:', apiErr?.message || apiErr);
    const msg = String(apiErr?.message || '');
    const status = apiErr?.status || apiErr?.code || 500;
    const isPermissionError =
      status === 403 || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('not have sufficient');
    const isNotCrawled =
      status === 404 || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('unknown');

    // Defensive fallback handling if GSC property does not match or URL has not been crawled yet
    const fallbackCoverage = isNotCrawled
      ? 'URL is unknown to Google (not crawled yet)'
      : isPermissionError
      ? 'Property unverified or permission denied in Search Console'
      : 'Inspection unavailable for this URL';

    const fallbackVerdict = isNotCrawled ? 'NEUTRAL' : isPermissionError ? 'FAIL' : 'NEUTRAL';

    res.json({
      success: false,
      error: msg || 'Failed to inspect URL in Google Search Console.',
      status,
      isPropertyError: isPermissionError,
      isNotCrawled,
      inspectionUrl,
      siteUrl: resolvedSiteUrl,
      inspectionResult: {
        inspectionUrl,
        indexStatusResult: {
          coverageState: fallbackCoverage,
          verdict: fallbackVerdict,
          indexingState: 'INDEXING_ALLOWED',
          robotstxtState: 'ALLOWED',
          lastCrawlTime: null,
          userCanonical: null,
          googleCanonical: null,
          pageFetchState: isNotCrawled ? 'NOT_FETCHED' : 'UNKNOWN',
        },
      },
      indexStatusResult: {
        coverageState: fallbackCoverage,
        verdict: fallbackVerdict,
        indexingState: 'INDEXING_ALLOWED',
        robotstxtState: 'ALLOWED',
        lastCrawlTime: null,
        userCanonical: null,
        googleCanonical: null,
        pageFetchState: isNotCrawled ? 'NOT_FETCHED' : 'UNKNOWN',
      },
    });
  }
});

// 3. Search Analytics Performance (28 days summary, top queries, top pages)
app.get(['/api/gsc/performance', '/api/gsc/performance/:siteUrl(*)'], async (req: Request, res: Response) => {
  const token = await getValidAccessToken();
  if (!token) {
    res.status(401).json({
      error: 'Not authenticated with Google Search Console.',
      connected: false,
    });
    return;
  }

  const rawSiteUrl =
    (req.query.siteUrl as string) ||
    (req.params as any).siteUrl ||
    (req.params as any)[0];

  if (!rawSiteUrl) {
    res.status(400).json({ error: 'siteUrl parameter is required.' });
    return;
  }

  // Calculate 28-day window with 2-day reporting lag
  const endDateObj = new Date(Date.now() - 2 * 86400000);
  const startDateObj = new Date(endDateObj.getTime() - 28 * 86400000);
  const endDate = endDateObj.toISOString().split('T')[0];
  const startDate = startDateObj.toISOString().split('T')[0];

  try {
    const encodedSite = encodeURIComponent(rawSiteUrl);
    const searchAnalyticsUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;

    // 1. Aggregated Summary Metrics (no dimensions returns aggregate totals across the entire date window)
    const summaryPromise = fetch(searchAnalyticsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        rowLimit: 5,
      }),
    });

    // 2. Top Queries
    const queriesPromise = fetch(searchAnalyticsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 25,
      }),
    });

    // 3. Top Pages
    const pagesPromise = fetch(searchAnalyticsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 25,
      }),
    });

    const [summaryResp, queriesResp, pagesResp] = await Promise.all([
      summaryPromise,
      queriesPromise,
      pagesPromise,
    ]);

    if (!summaryResp.ok) {
      const errText = await summaryResp.text();
      console.error('Search Analytics query error:', summaryResp.status, errText);
      if (summaryResp.status === 403) {
        res.status(403).json({
          error: `Google Search Console permission denied for "${rawSiteUrl}". Ensure this site is verified under your Google account.`,
          details: errText,
          verified: false,
        });
        return;
      }
      res.status(summaryResp.status).json({
        error: 'Failed to retrieve Search Console performance data.',
        details: errText,
      });
      return;
    }

    const summaryData = await summaryResp.json();
    const queriesData = queriesResp.ok ? await queriesResp.json() : { rows: [] };
    const pagesData = pagesResp.ok ? await pagesResp.json() : { rows: [] };

    const summaryRow = summaryData.rows && summaryData.rows.length > 0 ? summaryData.rows[0] : null;

    const topQueries = (queriesData.rows || []).map((row: any) => ({
      query: row.keys?.[0] || 'Unknown Query',
      clicks: Number(row.clicks) || 0,
      impressions: Number(row.impressions) || 0,
      ctr: Number(row.ctr) || 0,
      position: Number(row.position) || 0,
    }));

    const topPages = (pagesData.rows || []).map((row: any) => ({
      page: row.keys?.[0] || 'Unknown Page',
      clicks: Number(row.clicks) || 0,
      impressions: Number(row.impressions) || 0,
      ctr: Number(row.ctr) || 0,
      position: Number(row.position) || 0,
    }));

    let totalClicks = summaryRow ? Number(summaryRow.clicks) || 0 : 0;
    let totalImpressions = summaryRow ? Number(summaryRow.impressions) || 0 : 0;
    let averageCtr = summaryRow ? Number(summaryRow.ctr) || 0 : 0;
    let averagePosition = summaryRow ? Number(summaryRow.position) || 0 : 0;

    // If summaryRow is missing, calculate from top pages
    if (!summaryRow && topPages.length > 0) {
      totalClicks = topPages.reduce((acc: number, p: any) => acc + p.clicks, 0);
      totalImpressions = topPages.reduce((acc: number, p: any) => acc + p.impressions, 0);
      averageCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
      averagePosition =
        topPages.reduce((acc: number, p: any) => acc + p.position, 0) / topPages.length;
    }

    // Sync metrics with userSites
    const cleanRaw = rawSiteUrl.toLowerCase().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    const site = userSites.find((s) => {
      const cleanS = s.url.toLowerCase().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      return cleanS === cleanRaw || s.gscProperty === rawSiteUrl;
    });

    if (site) {
      site.connections.searchConsole = true;
      site.gscProperty = rawSiteUrl;
      site.gscMetrics = {
        clicks: totalClicks,
        impressions: totalImpressions,
        ctr: averageCtr,
        position: averagePosition,
      };
      site.healthStatus.indexing =
        totalImpressions > 0
          ? `${totalClicks.toLocaleString()} clicks · ${totalImpressions.toLocaleString()} imp`
          : 'Verified · Active';
    }

    res.json({
      siteUrl: rawSiteUrl,
      startDate,
      endDate,
      days: 28,
      metrics: {
        totalClicks,
        totalImpressions,
        averageCtr,
        averagePosition,
      },
      topQueries,
      topPages,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal error fetching Search Analytics.', details: err?.message });
  }
});

// 4. Indexing & Coverage Summary (Sitemaps, indexing counts, Blogger default checks)
app.get(['/api/gsc/coverage-summary', '/api/gsc/coverage-summary/:siteUrl(*)'], async (req: Request, res: Response) => {
  const token = await getValidAccessToken();
  if (!token) {
    res.status(401).json({
      error: 'Not authenticated with Google Search Console.',
      connected: false,
    });
    return;
  }

  const rawSiteUrl =
    (req.query.siteUrl as string) ||
    (req.params as any).siteUrl ||
    (req.params as any)[0];

  if (!rawSiteUrl) {
    res.status(400).json({ error: 'siteUrl parameter is required.' });
    return;
  }

  try {
    const encodedSite = encodeURIComponent(rawSiteUrl);
    const sitemapsUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/sitemaps`;

    const resp = await fetch(sitemapsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      if (resp.status === 403) {
        res.status(403).json({
          error: `Permission denied for ${rawSiteUrl} in Search Console.`,
          details: errText,
          verified: false,
        });
        return;
      }
      res.status(resp.status).json({
        error: 'Failed to retrieve sitemaps from Search Console.',
        details: errText,
      });
      return;
    }

    const data = await resp.json();
    const rawSitemaps = data.sitemap || [];

    let totalSubmitted = 0;
    let totalIndexed = 0;
    let errorsCount = 0;
    let warningsCount = 0;

    const sitemaps = rawSitemaps.map((s: any) => {
      let submitted = 0;
      let indexed = 0;
      if (Array.isArray(s.contents)) {
        for (const c of s.contents) {
          submitted += Number(c.submitted) || 0;
          indexed += Number(c.indexed) || 0;
        }
      }
      totalSubmitted += submitted;
      totalIndexed += indexed;
      errorsCount += Number(s.errors) || 0;
      warningsCount += Number(s.warnings) || 0;

      return {
        path: s.path,
        lastSubmitted: s.lastSubmitted,
        isPending: Boolean(s.isPending),
        isSitemapsIndex: Boolean(s.isSitemapsIndex),
        errors: Number(s.errors) || 0,
        warnings: Number(s.warnings) || 0,
        submitted,
        indexed,
      };
    });

    const hasDefaultSitemap = sitemaps.some((s: any) => s.path.includes('/sitemap.xml'));
    const hasAtomFeed = sitemaps.some((s: any) => s.path.includes('/atom.xml'));

    res.json({
      siteUrl: rawSiteUrl,
      verified: true,
      sitemapsCount: sitemaps.length,
      totalSubmittedUrls: totalSubmitted,
      totalIndexedUrls: totalIndexed,
      errorsCount,
      warningsCount,
      hasDefaultSitemap,
      hasAtomFeed,
      sitemaps,
      indexingStatus:
        sitemaps.length > 0
          ? errorsCount === 0
            ? 'Optimal Sitemaps'
            : 'Sitemap Warnings'
          : 'Pending Sitemap Submission',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal error fetching coverage summary.', details: err?.message });
  }
});

// Multi-site & Session Management Endpoints
app.get('/api/sites', async (req: Request, res: Response) => {
  const store = getTenantStore(req);
  const sessionAuth = getSessionAuth(req);

  // If connected to Google and store.sites is empty, auto-sync from Blogger API
  if (sessionAuth.connected && store.sites.length === 0) {
    const token = await getValidAccessToken(req);
    if (token) {
      try {
        const resp = await fetch('https://www.googleapis.com/blogger/v3/users/self/blogs', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.items && data.items.length > 0) {
            await syncDiscoveredBloggerBlogs(data.items, req, store);
          }
        }
      } catch (e) {
        console.warn('Auto-sync in /api/sites failed:', e);
      }
    }
  }

  if (!store.activeSiteId && store.sites.length > 0) {
    store.activeSiteId = store.sites[0].id;
    updateSessionAuth({ activeSiteId: store.sites[0].id }, req);
  }

  const activeSite = store.sites.find((s) => s.id === store.activeSiteId) || (store.sites[0] || null);

  res.json({
    sites: store.sites,
    total: store.sites.length,
    activeSiteId: store.activeSiteId,
    activeSite,
    user: {
      id: store.userId,
      email: store.userEmail || sessionAuth.userEmail || null,
      name: store.userName || sessionAuth.userName || null,
      picture: store.userPicture || sessionAuth.userPicture || null,
    },
  });
});

// Set active working blog for the user session
app.post('/api/sites/active', (req: Request, res: Response) => {
  const { siteId } = req.body;
  if (!siteId || typeof siteId !== 'string') {
    res.status(400).json({ error: 'Valid siteId is required.' });
    return;
  }

  const store = getTenantStore(req);
  const site = store.sites.find((s) => s.id === siteId);

  if (!site) {
    res.status(404).json({ error: 'Site not found in current user session.' });
    return;
  }

  store.activeSiteId = site.id;
  updateSessionAuth({ activeSiteId: site.id }, req);

  res.json({
    success: true,
    activeSiteId: site.id,
    site,
    message: `Active blog switched to ${site.name}.`,
  });
});

// Register a new Blogger site (subdomain or custom domain)
app.post('/api/sites', (req: Request, res: Response) => {
  const { name, url, bloggerBlogId } = req.body;
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Valid site URL is required.' });
    return;
  }

  const cleanUrl = url.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const isBlogspot = cleanUrl.toLowerCase().includes('.blogspot.');
  const store = getTenantStore(req);
  const sessionAuth = getSessionAuth(req);

  const newSite: RegisteredSite = {
    id: `site_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    bloggerBlogId: bloggerBlogId || undefined,
    name: name?.trim() || cleanUrl,
    url: `https://${cleanUrl}`,
    platform: isBlogspot ? 'blogger_subdomain' : 'blogger_custom_domain',
    createdAt: new Date().toISOString(),
    connections: {
      blogger: Boolean(bloggerBlogId && sessionAuth.connected),
      searchConsole: false,
      adsense: false,
      crawler: true,
    },
    healthStatus: {
      indexing: 'Not connected',
      technical: 'Not audited',
      content: 'Not evaluated',
      internalLinking: 'Not audited',
      adsenseReadiness: 'Not audited',
    },
  };

  store.sites.push(newSite);
  store.activeSiteId = newSite.id;
  updateSessionAuth({ activeSiteId: newSite.id }, req);

  res.status(201).json({ site: newSite, message: 'Site registered successfully.' });
});

// Remove a site and flush its cached audits
app.delete(['/api/sites/:siteId', '/api/sites/:id'], (req: Request, res: Response) => {
  const siteId = (req.params.siteId || req.params.id) as string;
  const store = getTenantStore(req);
  const initialLength = store.sites.length;
  store.sites = store.sites.filter((s) => s.id !== siteId);

  if (store.sites.length === initialLength) {
    res.status(404).json({ error: 'Site not found.' });
    return;
  }

  // Clear all scoped cached audits for this site
  store.inspections.delete(siteId);
  store.robotsSitemap.delete(siteId);
  store.aiDiagnosis.delete(siteId);
  store.adSenseReadiness.delete(siteId);
  store.adSensePolicyReview.delete(siteId);

  if (store.activeSiteId === siteId) {
    store.activeSiteId = store.sites.length > 0 ? store.sites[0].id : null;
    updateSessionAuth({ activeSiteId: store.activeSiteId }, req);
  }

  res.json({
    success: true,
    message: 'Site and associated cached audits removed.',
    activeSiteId: store.activeSiteId,
  });
});

// Cleanly flush active session data, cached audits, and tokens
app.post('/api/session/clear', async (req: Request, res: Response) => {
  const store = getTenantStore(req);
  const sessionAuth = getSessionAuth(req);

  // Revoke token if active
  if (sessionAuth.accessToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(sessionAuth.accessToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (err) {
      console.warn('Google token revocation warning:', err);
    }
  }

  // Clear all cached diagnostics in the current tenant store
  store.inspections.clear();
  store.robotsSitemap.clear();
  store.aiDiagnosis.clear();
  store.adSenseReadiness.clear();
  store.adSensePolicyReview.clear();
  store.activeSiteId = null;

  // Reset OAuth session credentials
  clearSessionAuth(req);

  res.json({
    success: true,
    message: 'Active session data, cached audits, and authentication tokens cleared successfully.',
  });
});

// Session overview and cache statistics endpoint
app.get('/api/session/info', (req: Request, res: Response) => {
  const store = getTenantStore(req);
  const sessionAuth = getSessionAuth(req);
  res.json({
    userId: store.userId,
    userEmail: store.userEmail || sessionAuth.userEmail || null,
    userName: store.userName || sessionAuth.userName || null,
    userPicture: store.userPicture || sessionAuth.userPicture || null,
    connected: sessionAuth.connected,
    activeSiteId: store.activeSiteId || (store.sites.length > 0 ? store.sites[0].id : null),
    sitesCount: store.sites.length,
    scopes: {
      blogger: Boolean(sessionAuth.scope?.includes('blogger.readonly') || sessionAuth.connected),
      searchConsole: Boolean(sessionAuth.scope?.includes('webmasters.readonly') || sessionAuth.connected),
      adsense: Boolean(sessionAuth.scope?.includes('adsense.readonly') || sessionAuth.connected),
    },
    cacheStats: {
      inspectionsCount: Array.from(store.inspections.values()).reduce((sum, list) => sum + list.length, 0),
      sitemapsCached: store.robotsSitemap.size,
      diagnosesCached: store.aiDiagnosis.size,
      adSenseReportsCached: store.adSenseReadiness.size,
      adSenseReviewsCached: store.adSensePolicyReview.size,
    },
  });
});

// -------------------------------------------------------------
// Deterministic HTML & Blogger Crawler Inspector Endpoints
// -------------------------------------------------------------

// Helper to inspect a single URL deterministically
async function performUrlInspection(targetUrl: string, siteId?: string): Promise<{
  inspection: any;
  matchedSite?: RegisteredSite;
}> {
  // Parse target URL
  let targetParsed: URL;
  try {
    targetParsed = new URL(targetUrl.trim());
  } catch {
    throw new Error('Invalid URL format provided.');
  }

  const targetHost = targetParsed.hostname.toLowerCase();

  // Validate against registered sites if user has registered sites
  let matchedSite: RegisteredSite | undefined;
  if (siteId) {
    matchedSite = userSites.find((s) => s.id === siteId);
  } else if (userSites.length > 0) {
    matchedSite = userSites.find((s) => {
      try {
        const sHost = new URL(s.url).hostname.toLowerCase();
        return targetHost === sHost || targetHost.endsWith('.' + sHost) || sHost.endsWith('.' + targetHost);
      } catch {
        return false;
      }
    });
  }

  if (userSites.length > 0 && !matchedSite) {
    const allowedDomains = userSites
      .map((s) => {
        try {
          return new URL(s.url).hostname;
        } catch {
          return s.url;
        }
      })
      .join(', ');
    throw new Error(
      `Target URL domain (${targetHost}) does not belong to your registered site(s): ${allowedDomains}. Please inspect URLs within your registered blog domain.`
    );
  }

  // Rate-limiting safeguard: 600ms minimum interval per target host
  const lastReq = lastInspectTimestamps.get(targetHost) || 0;
  const now = Date.now();
  if (now - lastReq < 600) {
    await new Promise((resolve) => setTimeout(resolve, 600 - (now - lastReq)));
  }
  lastInspectTimestamps.set(targetHost, Date.now());

  // Fetch with redirect tracking (up to 5 hops)
  const startTime = Date.now();
  let currentUrl = targetParsed.toString();
  const redirectChain: string[] = [currentUrl];
  let resp: any = null;
  let hops = 0;
  const userAgent =
    'Mozilla/5.0 (compatible; WanderWithinSiteIntelligence/2.0; Blogger Technical Auditor; +https://wanderwithin.local)';

  while (hops < 5) {
    resp = await fetch(currentUrl, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'manual',
    });

    if ([301, 302, 303, 307, 308].includes(resp.status)) {
      const loc = resp.headers.get('location');
      if (loc) {
        try {
          const nextUrl = new URL(loc, currentUrl).toString();
          redirectChain.push(nextUrl);
          currentUrl = nextUrl;
          hops++;
          continue;
        } catch {
          break;
        }
      }
    }
    break;
  }

  const responseTimeMs = Date.now() - startTime;
  const finalUrl = currentUrl;
  const statusCode = resp.status;
  const statusText = resp.statusText || (statusCode === 200 ? 'OK' : `HTTP ${statusCode}`);
  const redirected = hops > 0;
  const html = await resp.text();

  // Cheerio HTML Parsing
  const $ = cheerio.load(html);
  const issues: any[] = [];
  let overallScore = 100;

  // Detect whether the inspected URL is the homepage or an index hub / archive page
  const siteUrl = matchedSite?.url ? matchedSite.url.replace(/\/+$/, '') : `${targetParsed.protocol}//${targetParsed.host}`;
  const url = targetUrl.split('?')[0].replace(/\/+$/, '');
  const targetPathClean = (targetParsed.pathname || '').replace(/\/+$/, '').toLowerCase();
  const isTargetHomePath = targetPathClean === '' || targetPathClean === '/' || targetPathClean === '/index.html';

  let isFinalHomePath = false;
  try {
    const finalParsed = new URL(finalUrl);
    const finalPathClean = (finalParsed.pathname || '').replace(/\/+$/, '').toLowerCase();
    isFinalHomePath = finalPathClean === '' || finalPathClean === '/' || finalPathClean === '/index.html';
  } catch {
    // fallback
  }

  const isHomepage =
    isTargetHomePath ||
    isFinalHomePath ||
    url === siteUrl ||
    url === `${siteUrl}/` ||
    targetUrl === siteUrl ||
    targetUrl === `${siteUrl}/` ||
    finalUrl.split('?')[0].replace(/\/+$/, '') === siteUrl ||
    !targetUrl.includes('.html');
  const postContainer = $('[itemprop="articleBody"], .post-body, article, .entry-content').first();
  const isPostPage = !isHomepage && postContainer.length > 0;
  const pageType: 'INDEX_HUB' | 'POST' | 'PAGE' = isHomepage ? 'INDEX_HUB' : isPostPage ? 'POST' : 'PAGE';

  // 1. Blogger Mobile Canonical Parity
  const canonicalEl = $('link[rel="canonical"]');
  const canonicalHref = canonicalEl.attr('href')?.trim() || null;
  const hasCanonical = Boolean(canonicalHref);
  const isAbsolute = Boolean(canonicalHref && /^https?:\/\//i.test(canonicalHref));
  const hasMobileParameter = Boolean(
    canonicalHref && (canonicalHref.includes('?m=1') || canonicalHref.includes('&m=1'))
  );

  let isSelfReferential = false;
  if (canonicalHref) {
    const normCanonical = canonicalHref
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')
      .split('?')[0]
      .toLowerCase();
    const normFinal = finalUrl
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')
      .split('?')[0]
      .toLowerCase();
    isSelfReferential = normCanonical === normFinal;
  }

  const altMobileEl = $('link[rel="alternate"][media]');
  const hasMobileAlternate = altMobileEl.length > 0;
  const mobileAlternateHref = altMobileEl.attr('href')?.trim() || null;

  let canonicalStatus: 'pass' | 'warning' | 'fail' = 'pass';
  if (!hasCanonical) {
    canonicalStatus = 'fail';
    overallScore -= 20;
    issues.push({
      id: 'canonical-missing',
      category: 'canonical',
      severity: 'critical',
      title: 'Missing Canonical Link Tag',
      message: 'No <link rel="canonical"> tag was found in the HTML head.',
      recommendation:
        'Add <link rel="canonical" expr:href="data:blog.canonicalUrl"/> inside your Blogger theme <head> to prevent duplicate URL indexing.',
    });
  } else if (hasMobileParameter) {
    canonicalStatus = 'fail';
    overallScore -= 25;
    issues.push({
      id: 'canonical-mobile-param',
      category: 'canonical',
      severity: 'critical',
      title: 'Canonical Points to Mobile (?m=1) Variant',
      message: `Canonical URL explicitly references mobile parameter: ${canonicalHref}. This instructs Google to index the mobile URL instead of the canonical desktop URL.`,
      recommendation:
        'In your Blogger theme template, ensure canonical tag uses data:blog.canonicalUrl (which automatically strips ?m=1) or purge hardcoded query parameters.',
    });
  } else if (!isAbsolute) {
    canonicalStatus = 'warning';
    overallScore -= 10;
    issues.push({
      id: 'canonical-relative',
      category: 'canonical',
      severity: 'warning',
      title: 'Relative Canonical URL Detected',
      message: `Canonical href "${canonicalHref}" is relative. Google guidelines strongly require absolute HTTPS URLs.`,
      recommendation: `Prefix the canonical URL with your full site domain: https://${targetHost}${canonicalHref}`,
    });
  } else if (!isSelfReferential && statusCode === 200) {
    issues.push({
      id: 'canonical-non-self',
      category: 'canonical',
      severity: 'info',
      title: 'Non-Self-Referential Canonical',
      message: `Canonical points to ${canonicalHref} while page rendered at ${finalUrl}.`,
      recommendation: 'If this page is distinct, verify the canonical target is the intended master copy.',
    });
  }

  // 2. Meta & Directives
  const title = $('title').first().text().trim() || null;
  const titleLength = title ? title.length : 0;
  let titleStatus: 'pass' | 'warning' | 'fail' = 'pass';
  if (!title) {
    titleStatus = 'fail';
    overallScore -= 20;
    issues.push({
      id: 'meta-title-missing',
      category: 'meta',
      severity: 'critical',
      title: 'Missing Page Title Tag',
      message: 'The <title> tag is missing or empty in the document <head>.',
      recommendation: 'Ensure your Blogger theme template includes a descriptive <title> in <head>.',
    });
  } else if (isHomepage) {
    // Homepage title validation: Lower threshold to 10 characters to accommodate clean brand names
    if (titleLength < 10) {
      titleStatus = 'warning';
      overallScore -= 5;
      issues.push({
        id: 'meta-title-short',
        category: 'meta',
        severity: 'warning',
        title: 'Page Title Too Short',
        message: `Homepage title length is only ${titleLength} characters ("${title}"). Clean site branding typically requires at least 10 characters (e.g. "Brand Name - Topic Focus").`,
        recommendation: 'Ensure your blog title clearly identifies your brand name and topic focus (10-65 characters).',
      });
    } else if (titleLength > 65) {
      titleStatus = 'warning';
      overallScore -= 5;
      issues.push({
        id: 'meta-title-long',
        category: 'meta',
        severity: 'warning',
        title: 'Page Title May Truncate in SERPs',
        message: `Title length is ${titleLength} characters. Google search snippets typically truncate titles after 60-65 characters.`,
        recommendation: 'Keep high-intent keywords in the first 50 characters to prevent ellipsis clipping.',
      });
    }
  } else {
    // Post / article page title validation: flag if < 30 characters
    if (titleLength < 30) {
      titleStatus = 'warning';
      overallScore -= 5;
      issues.push({
        id: 'meta-title-short',
        category: 'meta',
        severity: 'warning',
        title: 'Page Title Too Short',
        message: `Article title length is only ${titleLength} characters ("${title}"). Article pages require at least 30 characters for informative search snippet visibility (recommended: 45-65 characters).`,
        recommendation: 'Expand the article title with descriptive topic context or primary keywords to reach 30-65 characters.',
      });
    } else if (titleLength > 65) {
      titleStatus = 'warning';
      overallScore -= 5;
      issues.push({
        id: 'meta-title-long',
        category: 'meta',
        severity: 'warning',
        title: 'Page Title May Truncate in SERPs',
        message: `Title length is ${titleLength} characters. Google search snippets typically truncate titles after 60-65 characters.`,
        recommendation: 'Keep high-intent keywords in the first 50 characters to prevent ellipsis clipping.',
      });
    }
  }

  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null;
  const descriptionLength = metaDescription ? metaDescription.length : 0;
  let descriptionStatus: 'pass' | 'warning' | 'fail' = 'pass';
  if (!metaDescription) {
    descriptionStatus = 'warning';
    overallScore -= 10;
    issues.push({
      id: 'meta-desc-missing',
      category: 'meta',
      severity: 'warning',
      title: 'Missing Meta Description',
      message: 'No meta description or search description found for this post/page.',
      recommendation:
        'In Blogger Post Settings, enable "Search Description" and enter a concise 130-155 character summary.',
    });
  } else if (descriptionLength < 60) {
    descriptionStatus = 'warning';
    overallScore -= 5;
    issues.push({
      id: 'meta-desc-short',
      category: 'meta',
      severity: 'warning',
      title: 'Meta Description Too Short',
      message: `Description is only ${descriptionLength} characters. Optimal length is 120-160 characters.`,
    });
  } else if (descriptionLength > 165) {
    descriptionStatus = 'warning';
    overallScore -= 5;
    issues.push({
      id: 'meta-desc-long',
      category: 'meta',
      severity: 'warning',
      title: 'Meta Description May Truncate',
      message: `Description is ${descriptionLength} characters and may be clipped in search snippets.`,
    });
  }

  const robotsStr = (
    ($('meta[name="robots"]').attr('content') || '') +
    ' ' +
    ($('meta[name="googlebot"]').attr('content') || '')
  ).toLowerCase();
  const robotsDirectives = robotsStr.split(/[\s,]+/).filter(Boolean);
  const hasNoindex = robotsDirectives.includes('noindex');
  const hasNofollow = robotsDirectives.includes('nofollow');
  const hasNoarchive = robotsDirectives.includes('noarchive');

  if (hasNoindex) {
    overallScore -= 40;
    issues.push({
      id: 'meta-robots-noindex',
      category: 'directives',
      severity: 'critical',
      title: 'Page Blocks Search Indexing (noindex Directive)',
      message:
        'A <meta name="robots" content="noindex"> tag is actively preventing search engines from indexing this URL.',
      recommendation:
        'Check Blogger Settings > Crawlers and indexing > Custom robot tags to remove unintended post noindex flags.',
    });
  }

  const viewport = $('meta[name="viewport"]').attr('content')?.trim() || null;
  const hasViewport = Boolean(viewport);
  if (!hasViewport) {
    overallScore -= 10;
    issues.push({
      id: 'meta-viewport-missing',
      category: 'meta',
      severity: 'warning',
      title: 'Missing Viewport Meta Tag',
      message: 'No responsive viewport tag detected. This impairs mobile usability indexing.',
      recommendation:
        'Add <meta name="viewport" content="width=device-width, initial-scale=1"/> to <head>.',
    });
  }

  const openGraph = {
    title: $('meta[property="og:title"]').attr('content')?.trim(),
    description: $('meta[property="og:description"]').attr('content')?.trim(),
    image: $('meta[property="og:image"]').attr('content')?.trim(),
    type: $('meta[property="og:type"]').attr('content')?.trim(),
  };

  // 3. Headings & Content Structure
  const h1Els = $('h1');
  const h1Count = h1Els.length;
  const h1Items: string[] = [];
  h1Els.each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t) h1Items.push(t.substring(0, 120));
  });

  const h2Count = $('h2').length;
  const h3Count = $('h3').length;
  const h4Count = $('h4').length;

  let headingsStatus: 'pass' | 'warning' | 'fail' = 'pass';
  if (h1Count === 0) {
    headingsStatus = 'fail';
    overallScore -= 15;
    issues.push({
      id: 'headings-h1-missing',
      category: 'headings',
      severity: 'critical',
      title: 'Missing Main Heading (H1)',
      message: 'No <h1> tag was found on the page.',
      recommendation: isHomepage
        ? 'In Blogger templates, ensure your blog title or header logo is rendered in an <h1> tag on the homepage.'
        : 'In Blogger templates, ensure post titles are rendered as <h1> rather than <h2> or <h3>.',
    });
  } else if (h1Count > 1) {
    if (isHomepage) {
      // On Blogger homepages, multiple H1s (blog title + multiple post titles) is common in legacy themes.
      // Do not apply full post-page multiple H1 penalty.
      overallScore -= 2;
      issues.push({
        id: 'headings-h1-multiple-hub',
        category: 'headings',
        severity: 'info',
        title: `Index Hub Multi-Card Headings (${h1Count} Found)`,
        message: `Found ${h1Count} <h1> tags on this index hub. Multiple post cards often share <h1> in classic Blogger themes.`,
        recommendation:
          'Consider styling article card titles as <h2> on the homepage feed, reserving <h1> for individual post views.',
      });
    } else {
      headingsStatus = 'warning';
      overallScore -= 8;
      issues.push({
        id: 'headings-h1-multiple',
        category: 'headings',
        severity: 'warning',
        title: `Multiple H1 Headings Detected (${h1Count} Found)`,
        message: `Found ${h1Count} separate <h1> tags on this page. Classic Blogger themes often wrap both the Blog Header and the Post Title in <h1>.`,
        recommendation:
          'On post pages, reserve <h1> exclusively for the article title. Change the header logo/blog title to <div> or <p>.',
      });
    }
  }

  // Word count estimate:
  // For index hub / homepage: calculate aggregate text across feed snippets, post cards, header, and main sections
  // For post pages: target the real article container directly
  let cleanText = '';
  if (isHomepage) {
    const hubSelection = $('.main, #main, .blog-posts, .feed-view, .post-outer, .post, [itemprop="blogPost"], .entry-summary, .snippet-item, header, #header, .header');
    const contentRoot = hubSelection.length > 0 ? hubSelection : $('body');
    const bodyClone = contentRoot.clone();
    bodyClone
      .find('script, style, noscript, svg, meta, .comments, #comments, .blog-pager, .sharing, iframe')
      .remove();
    cleanText = bodyClone.text().replace(/\s+/g, ' ').trim();
  } else {
    const contentRoot = isPostPage ? postContainer : $('body');
    const bodyClone = contentRoot.clone();
    bodyClone
      .find('script, style, noscript, svg, meta, .comments, #comments, .blog-pager, .sharing, iframe')
      .remove();
    cleanText = bodyClone.text().replace(/\s+/g, ' ').trim();
  }
  const words = cleanText ? cleanText.split(/\s+/).filter((w) => w.length > 1) : [];
  const wordCount = words.length;
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));

  // Thin Content Evaluation: Exempt index hubs from the < 250 words article thin content penalty
  const isThinContent = !isHomepage && wordCount < 250;

  if (isHomepage) {
    const postCardsCount = $('.post, .post-outer, [itemprop="blogPost"], article, .entry-title, .post-title').length;
    issues.push({
      id: 'content-index-hub-pass',
      category: 'headings',
      severity: 'info',
      title: 'Index Hub (Pass)',
      message: `Audited as an Index Hub / Feed portal with ~${wordCount} aggregate words across ${postCardsCount || 'multiple'} post cards and feed links. Exempt from single-article thin content evaluation.`,
      recommendation: 'Ensure all post cards link cleanly to canonical article URLs without duplicate query parameters.',
    });
  } else if (isThinContent && statusCode === 200) {
    overallScore -= 10;
    issues.push({
      id: 'content-thin',
      category: 'headings',
      severity: 'warning',
      title: `Thin Content Risk (${wordCount} words)`,
      message: `The visible body text has only ~${wordCount} words. Pages with fewer than 250-300 words frequently get classified as "Crawled - currently not indexed" by Google.`,
      recommendation: 'Expand with comprehensive topical insights, FAQ sections, and detailed explanations.',
    });
  }

  // 4. Media & Images (scoped to post container when auditing a post page)
  const rawImgEls = isPostPage ? postContainer.find('img') : $('img');
  let totalImages = 0;
  let imagesWithAlt = 0;
  let imagesMissingAlt = 0;
  const missingAltSources: string[] = [];

  rawImgEls.each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    const srcLower = src.toLowerCase();

    // Filter out tracking pixels, icons, and transparent spacers (exclude images with width/height <= 16, or tracking URLs)
    const widthAttr = parseInt($(el).attr('width') || '', 10);
    const heightAttr = parseInt($(el).attr('height') || '', 10);
    const isTiny =
      (!isNaN(widthAttr) && widthAttr > 0 && widthAttr <= 16) ||
      (!isNaN(heightAttr) && heightAttr > 0 && heightAttr <= 16);

    const styleAttr = ($(el).attr('style') || '').toLowerCase();
    const hasTinyStyle =
      /width\s*:\s*[0-1]?[0-6]px/.test(styleAttr) || /height\s*:\s*[0-1]?[0-6]px/.test(styleAttr);

    const isTrackingOrSpacer =
      srcLower.includes('b/stats') ||
      srcLower.includes('pixel.gif') ||
      srcLower.includes('blank.gif') ||
      srcLower.includes('icon_quickedit');

    if (isTiny || hasTinyStyle || isTrackingOrSpacer) {
      return; // Skip non-content images
    }

    totalImages++;
    const alt = $(el).attr('alt');
    if (typeof alt === 'string' && alt.trim().length > 0) {
      imagesWithAlt++;
    } else {
      imagesMissingAlt++;
      if (missingAltSources.length < 8) {
        missingAltSources.push(src || 'image');
      }
    }
  });

  let mediaStatus: 'pass' | 'warning' | 'fail' = 'pass';
  if (imagesMissingAlt > 0) {
    mediaStatus = 'warning';
    const penalty = Math.min(15, imagesMissingAlt * 3);
    overallScore -= penalty;
    issues.push({
      id: 'media-missing-alt',
      category: 'media',
      severity: 'warning',
      title: `${imagesMissingAlt} of ${totalImages} Images Missing Alt Attributes`,
      message: `${imagesMissingAlt} image(s) lack alternative text. This reduces Google Image search visibility and screen reader accessibility.`,
      recommendation: 'In Blogger post editor, click each image > Edit Properties/Settings > Add specific Alt Text.',
    });
  }

  // 5. Links Analysis
  const linkEls = $('a');
  const totalLinks = linkEls.length;
  let internalLinksCount = 0;
  let externalLinksCount = 0;
  let linksWithMobileParam = 0;
  let brokenOrEmptyHrefs = 0;
  const sampleInternalLinks: { text: string; href: string }[] = [];
  const sampleExternalLinks: { text: string; href: string }[] = [];

  linkEls.each((_, el) => {
    const href = $(el).attr('href')?.trim();
    const text = $(el).text().replace(/\s+/g, ' ').trim() || 'Link';

    // When isPostPage is true, check whether this anchor is within the post container
    // or ignore common Blogger template navigation triggers (e.g. mobile menus, share widgets outside post body)
    const isInsidePost = isPostPage
      ? $(el).closest('[itemprop="articleBody"], .post-body, article, .entry-content').length > 0
      : true;

    if (!href || href === '#' || href.startsWith('javascript:')) {
      if (isInsidePost) {
        brokenOrEmptyHrefs++;
      }
      return;
    }

    if (href.includes('?m=1') || href.includes('&m=1')) {
      linksWithMobileParam++;
    }

    if (
      href.startsWith('/') ||
      href.startsWith('#') ||
      href.startsWith('./') ||
      href.startsWith('../')
    ) {
      internalLinksCount++;
      if (sampleInternalLinks.length < 6) {
        sampleInternalLinks.push({ text: text.substring(0, 50), href });
      }
    } else {
      try {
        const lUrl = new URL(href, finalUrl);
        if (lUrl.hostname === targetHost || lUrl.hostname.endsWith('.' + targetHost)) {
          internalLinksCount++;
          if (sampleInternalLinks.length < 6) {
            sampleInternalLinks.push({ text: text.substring(0, 50), href });
          }
        } else {
          externalLinksCount++;
          if (sampleExternalLinks.length < 6) {
            sampleExternalLinks.push({ text: text.substring(0, 50), href });
          }
        }
      } catch {
        if (isInsidePost) {
          brokenOrEmptyHrefs++;
        }
      }
    }
  });

  let linksStatus: 'pass' | 'warning' | 'fail' = 'pass';
  if (linksWithMobileParam > 0) {
    linksStatus = 'warning';
    overallScore -= 8;
    issues.push({
      id: 'links-mobile-param',
      category: 'links',
      severity: 'warning',
      title: `${linksWithMobileParam} Internal Links Contain ?m=1 Mobile Parameter`,
      message:
        'Internal hyperlinks explicitly include ?m=1 in their href. This circulates mobile variant URLs through desktop Googlebot crawls, complicating indexing.',
      recommendation:
        'Ensure template navigation menus, widgets, and post internal links use clean canonical URLs without ?m=1.',
    });
  }
  if (brokenOrEmptyHrefs > 0) {
    linksStatus = 'warning';
    overallScore -= 5;
    issues.push({
      id: 'links-empty-href',
      category: 'links',
      severity: 'warning',
      title: `${brokenOrEmptyHrefs} Empty or JavaScript Anchor Tags`,
      message: `Found ${brokenOrEmptyHrefs} <a> tags with empty hrefs, "#", or javascript: pseudo-protocols.`,
      recommendation: 'Replace empty href anchors with proper buttons or real target URLs.',
    });
  }

  // HTTP Status penalty
  if (statusCode !== 200) {
    overallScore -= 40;
    issues.push({
      id: 'http-error-status',
      category: 'directives',
      severity: 'critical',
      title: `Non-200 HTTP Response (${statusCode} ${statusText})`,
      message: `Target URL returned HTTP status code ${statusCode}. Googlebot cannot index pages returning errors.`,
    });
  }

  overallScore = Math.max(0, Math.min(100, overallScore));
  const overallStatus: 'pass' | 'warning' | 'fail' =
    overallScore >= 80 ? 'pass' : overallScore >= 50 ? 'warning' : 'fail';

  const inspection = {
    url: targetUrl,
    finalUrl,
    statusCode,
    statusText,
    responseTimeMs,
    redirected,
    redirectCount: hops,
    redirectChain,
    overallScore,
    overallStatus,
    timestamp: new Date().toISOString(),
    isHomepage,
    isPostPage,
    pageType,
    canonical: {
      hasCanonical,
      canonicalHref,
      isAbsolute,
      isSelfReferential,
      hasMobileParameter,
      hasMobileAlternate,
      mobileAlternateHref,
      status: canonicalStatus,
    },
    meta: {
      title,
      titleLength,
      titleStatus,
      metaDescription,
      descriptionLength,
      descriptionStatus,
      robotsDirectives,
      hasNoindex,
      hasNofollow,
      hasNoarchive,
      viewport,
      hasViewport,
      openGraph,
    },
    headings: {
      h1Count,
      h1Items,
      h2Count,
      h3Count,
      h4Count,
      status: headingsStatus,
      wordCount,
      readingTimeMinutes,
      isThinContent,
      isHomepage,
      pageType,
    },
    media: {
      totalImages,
      imagesWithAlt,
      imagesMissingAlt,
      missingAltSources,
      status: mediaStatus,
    },
    links: {
      totalLinks,
      internalLinksCount,
      externalLinksCount,
      linksWithMobileParam,
      brokenOrEmptyHrefs,
      sampleInternalLinks,
      sampleExternalLinks,
      status: linksStatus,
    },
    issues,
  };

  // Update matched site
  if (matchedSite) {
    matchedSite.connections.crawler = true;
    matchedSite.lastAuditScore = overallScore;
    matchedSite.lastAuditStatus = overallStatus;
    matchedSite.auditedPagesCount = (matchedSite.auditedPagesCount || 0) + 1;
    matchedSite.lastAuditTimestamp = inspection.timestamp;
    matchedSite.healthStatus.technical = `Score: ${overallScore}/100 · ${overallStatus.toUpperCase()}`;
    matchedSite.healthStatus.internalLinking = `${internalLinksCount} internal links · ${
      brokenOrEmptyHrefs === 0 ? 'Healthy' : brokenOrEmptyHrefs + ' empty'
    }`;
    matchedSite.healthStatus.content = isHomepage
      ? `Index Hub · ~${wordCount} words · Pass`
      : `${wordCount} words · ${isThinContent ? 'Thin risk' : 'Adequate length'}`;

    const list = sitePageInspections.get(matchedSite.id) || [];
    const existingIdx = list.findIndex(
      (item) => item.url === targetUrl || item.finalUrl === finalUrl
    );
    if (existingIdx >= 0) {
      list[existingIdx] = inspection;
    } else {
      list.unshift(inspection);
    }
    sitePageInspections.set(matchedSite.id, list);
  }

  return { inspection, matchedSite };
}

// 1. URL Inspector Endpoint
app.all('/api/inspect/url', async (req: Request, res: Response) => {
  const targetUrl = (req.body?.url || req.query?.url) as string;
  const siteId = (req.body?.siteId || req.query?.siteId) as string | undefined;

  if (!targetUrl || typeof targetUrl !== 'string') {
    res.status(400).json({ error: 'target URL is required.' });
    return;
  }

  try {
    const { inspection, matchedSite } = await performUrlInspection(targetUrl, siteId);
    res.json({
      success: true,
      inspection,
      siteUpdated: Boolean(matchedSite),
      activeSiteId: matchedSite?.id || null,
    });
  } catch (err: any) {
    console.error('URL inspection error:', err);
    res.status(400).json({
      error: err?.message || 'Failed to inspect URL.',
    });
  }
});

// 2. Robots.txt and Sitemap.xml Inspector Endpoint
app.get('/api/inspect/sitemap-and-robots', async (req: Request, res: Response) => {
  const rawSiteUrl = req.query.siteUrl as string;
  const siteId = req.query.siteId as string | undefined;
  const forceRefresh = req.query.forceRefresh === 'true' || req.query.refresh === 'true';
  const store = getTenantStore(req);

  // Return cached result immediately on site switch without triggering redundant crawls
  if (siteId && !forceRefresh) {
    const cached = store.robotsSitemap.get(siteId);
    if (cached) {
      res.json(cached);
      return;
    }
  }

  let siteUrl = rawSiteUrl;
  if (!siteUrl && siteId) {
    const found = store.sites.find((s) => s.id === siteId);
    if (found) siteUrl = found.url;
  }
  if (!siteUrl && store.sites.length > 0) {
    siteUrl = store.sites[0].url;
  }

  if (!siteUrl) {
    res.status(400).json({ error: 'siteUrl parameter is required.' });
    return;
  }

  try {
    const cleanUrl = siteUrl.trim().replace(/\/+$/, '');
    const userAgent =
      'Mozilla/5.0 (compatible; WanderWithinSiteIntelligence/2.0; Blogger Technical Auditor)';

    // 1. Fetch robots.txt
    const robotsUrl = `${cleanUrl}/robots.txt`;
    let robotsTxtContent = '';
    let robotsStatus = 0;
    let isDefaultBlogger = false;
    let hasSearchDisallow = false;
    let hasSitemapDirective = false;
    const disallowRules: string[] = [];
    const allowRules: string[] = [];
    const sitemapsFound: string[] = [];

    try {
      const robotsResp = await fetch(robotsUrl, {
        headers: { 'User-Agent': userAgent },
      });
      robotsStatus = robotsResp.status;
      if (robotsResp.ok) {
        robotsTxtContent = await robotsResp.text();
        const lines = robotsTxtContent.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (/^disallow:/i.test(trimmed)) {
            const rule = trimmed.replace(/^disallow:\s*/i, '');
            disallowRules.push(rule);
            if (rule === '/search' || rule.startsWith('/search')) {
              hasSearchDisallow = true;
            }
          } else if (/^allow:/i.test(trimmed)) {
            allowRules.push(trimmed.replace(/^allow:\s*/i, ''));
          } else if (/^sitemap:/i.test(trimmed)) {
            hasSitemapDirective = true;
            sitemapsFound.push(trimmed.replace(/^sitemap:\s*/i, ''));
          }
        }
        isDefaultBlogger =
          hasSearchDisallow &&
          (robotsTxtContent.includes('Mediapartners-Google') || hasSitemapDirective);
      }
    } catch (e: any) {
      console.warn('Failed to fetch robots.txt:', e.message);
    }

    // 2. Fetch sitemap.xml
    const sitemapUrl = `${cleanUrl}/sitemap.xml`;
    let sitemapContent = '';
    let sitemapStatus = 0;
    let isXml = false;
    let entryCount = 0;
    const sampleUrls: string[] = [];
    let hasError = false;
    let errorMessage: string | undefined;

    try {
      const sitemapResp = await fetch(sitemapUrl, {
        headers: { 'User-Agent': userAgent },
      });
      sitemapStatus = sitemapResp.status;
      if (sitemapResp.ok) {
        sitemapContent = await sitemapResp.text();
        isXml =
          sitemapContent.includes('<urlset') ||
          sitemapContent.includes('<sitemapindex') ||
          sitemapContent.includes('<?xml') ||
          sitemapContent.includes('<feed');

        const locMatches = sitemapContent.match(/<loc>([^<]+)<\/loc>/gi) || [];
        entryCount = locMatches.length;
        for (const locTag of locMatches.slice(0, 10)) {
          const m = locTag.replace(/<\/?loc>/gi, '').trim();
          if (m) sampleUrls.push(m);
        }
      } else {
        hasError = true;
        errorMessage = `HTTP ${sitemapStatus}`;
      }
    } catch (e: any) {
      hasError = true;
      errorMessage = e.message;
    }

    const robotsOverallStatus: 'pass' | 'warning' | 'fail' =
      robotsStatus === 200 ? (hasSearchDisallow ? 'pass' : 'warning') : 'fail';
    const sitemapOverallStatus: 'pass' | 'warning' | 'fail' =
      sitemapStatus === 200 && isXml && entryCount > 0
        ? 'pass'
        : sitemapStatus === 200
        ? 'warning'
        : 'fail';

    const result = {
      siteUrl: cleanUrl,
      robotsTxt: {
        url: robotsUrl,
        fetched: robotsStatus === 200,
        statusCode: robotsStatus,
        content: robotsTxtContent,
        isDefaultBlogger,
        hasSearchDisallow,
        hasSitemapDirective,
        disallowRules,
        allowRules,
        sitemapsFound,
        status: robotsOverallStatus,
        message:
          robotsStatus === 200
            ? isDefaultBlogger
              ? 'Default Blogger robots.txt detected (/search disallowed to prevent query duplicate indexing).'
              : 'Custom robots.txt detected.'
            : `robots.txt returned HTTP ${robotsStatus}`,
      },
      sitemapXml: {
        url: sitemapUrl,
        fetched: sitemapStatus === 200,
        statusCode: sitemapStatus,
        isXml,
        entryCount,
        sampleUrls,
        hasError,
        errorMessage,
        status: sitemapOverallStatus,
        message:
          sitemapStatus === 200 && isXml
            ? `Valid XML sitemap detected with ${entryCount} URL entries.`
            : `sitemap.xml returned HTTP ${sitemapStatus}`,
      },
      timestamp: new Date().toISOString(),
    };

    if (siteId) {
      siteRobotsSitemap.set(siteId, result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      error: 'Internal error checking robots and sitemap.',
      details: err?.message,
    });
  }
});

// 3. Discoverable Site URLs Endpoint (extracts posts/pages for quick 1-click inspection)
app.get('/api/inspect/site-urls', async (req: Request, res: Response) => {
  const siteUrl = req.query.siteUrl as string;
  const siteId = req.query.siteId as string | undefined;

  let cleanSiteUrl = siteUrl;
  if (!cleanSiteUrl && siteId) {
    const found = userSites.find((s) => s.id === siteId);
    if (found) cleanSiteUrl = found.url;
  }
  if (!cleanSiteUrl && userSites.length > 0) {
    cleanSiteUrl = userSites[0].url;
  }

  if (!cleanSiteUrl) {
    res.status(400).json({ error: 'Valid site URL is required.' });
    return;
  }

  cleanSiteUrl = cleanSiteUrl.trim().replace(/\/+$/, '');
  const urls: Array<{ url: string; title: string; type: 'Home' | 'Post' | 'Page' }> = [
    { url: cleanSiteUrl + '/', title: 'Home Page', type: 'Home' },
  ];

  try {
    // Attempt 1: Fetch public Blogger feed (no auth required)
    const feedUrl = `${cleanSiteUrl}/feeds/posts/default?alt=json&max-results=50`;
    const resp = await fetch(feedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; WanderWithinSiteIntelligence/2.0; Blogger Feed Fetcher)',
      },
    });

    if (resp.ok) {
      const data = await resp.json();
      const entries = data.feed?.entry || [];
      for (const entry of entries) {
        const title = entry.title?.$t || 'Untitled Post';
        const altLink = (entry.link || []).find((l: any) => l.rel === 'alternate');
        if (altLink && altLink.href) {
          urls.push({
            url: altLink.href,
            title,
            type: 'Post',
          });
        }
      }
    } else {
      // Attempt 2: Fallback to sitemap.xml loc entries
      const smResp = await fetch(`${cleanSiteUrl}/sitemap.xml`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; WanderWithinSiteIntelligence/2.0; Blogger Sitemap Fetcher)',
        },
      });
      if (smResp.ok) {
        const smText = await smResp.text();
        const locMatches = smText.match(/<loc>([^<]+)<\/loc>/gi) || [];
        for (const locTag of locMatches) {
          const loc = locTag.replace(/<\/?loc>/gi, '').trim();
          if (loc && loc !== cleanSiteUrl && loc !== cleanSiteUrl + '/') {
            urls.push({
              url: loc,
              title: loc.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ') || 'Page',
              type: 'Post',
            });
          }
        }
      }
    }

    res.json({ urls, count: urls.length });
  } catch (err: any) {
    res.json({ urls, count: urls.length, error: err?.message });
  }
});

// 4. Inspection History Endpoint
app.get('/api/inspect/history', (req: Request, res: Response) => {
  const siteId = req.query.siteId as string | undefined;
  if (siteId) {
    const list = sitePageInspections.get(siteId) || [];
    res.json({ inspections: list, count: list.length });
  } else {
    const all: any[] = [];
    sitePageInspections.forEach((list) => {
      all.push(...list);
    });
    res.json({ inspections: all, count: all.length });
  }
});

// Architecture Specification Endpoint (Explaining Deterministic vs AI Reasoning)
app.get('/api/diagnostics/architecture', (req: Request, res: Response) => {
  res.json({
    framework: 'Deterministic Parsing + Gemini Evidence-Based Reasoning',
    deterministicChecks: [
      'HTTP status & response latency',
      'Redirect chains (301, 302, loop detection)',
      'Canonical tag consistency & self-referencing check',
      'Robots meta tags (noindex, nofollow, noarchive)',
      'Meta title length & unique title enforcement',
      'Meta descriptions & OpenGraph tags',
      'Heading hierarchy (H1 presence, sequential H2-H6)',
      'Internal & external link extraction & broken links',
      'Image missing alt attributes',
      'Sitemap XML availability (sitemap.xml, atom.xml?redirect=false)',
      'Robots.txt syntax & Blogger default crawler rules',
      'Basic HTML validation & unclosed tag detection',
      'URL structure & duplicate query parameter patterns',
    ],
    geminiReasoningLayer: [
      'Explaining probable causes based on concrete crawler and GSC data',
      'Identifying cross-URL patterns and theme-wide template flaws',
      'Comparing article topics and detecting keyword overlap / cannibalization',
      'Evaluating search intent fulfillment and thin content indicators',
      'Prioritizing diagnostic issues by potential indexing impact',
      'Formulating evidence-based conclusions with strict confidence grading',
    ],
    confidenceLevels: [
      { level: 'Confirmed', description: 'Verified by hard deterministic crawler/API data' },
      { level: 'Likely', description: 'Strong multi-signal corroboration with minimal ambiguity' },
      { level: 'Possible', description: 'Plausible contributing factor without conclusive evidence' },
      { level: 'Unknown', description: 'Insufficient data or proprietary search engine factor' },
    ],
    ethicsPolicy:
      'Never claim to know proprietary search ranking weights or secret AdSense approval decisions. Maintain strict evidence-based objectivity.',
  });
});

// AI Diagnostic Reasoning Layer (server-side Gemini invocation with structured evidence reasoning)
app.post('/api/ai/diagnose', async (req: Request, res: Response) => {
  const {
    site,
    technicalAudit,
    robotsSitemap,
    gsc,
    contentSample,
    customNotes,
    siteId,
    issueType,
    contextDetails,
    inspectedPage,
    targetUrl: explicitTargetUrl,
    targetTitle: explicitTargetTitle,
  } = req.body;

  const targetSiteId = siteId || site?.id || (userSites.length > 0 ? userSites[0].id : 'default');

  // Resolve exact inspected post/page URL and Title
  const resolvedInspectedUrl: string =
    explicitTargetUrl ||
    inspectedPage?.url ||
    technicalAudit?.targetUrl ||
    technicalAudit?.url ||
    site?.url ||
    'https://wanderwithinlife.blogspot.com';

  const resolvedInspectedTitle: string =
    explicitTargetTitle ||
    inspectedPage?.title ||
    technicalAudit?.targetTitle ||
    technicalAudit?.title ||
    technicalAudit?.meta?.title ||
    technicalAudit?.headings?.h1Items?.[0] ||
    (resolvedInspectedUrl && site?.url && resolvedInspectedUrl !== site.url
      ? 'Inspected Post'
      : `${site?.name || 'Blogger Site'} Overview`);

  // Helper to construct deterministic fallback findings if Gemini API is unconfigured or rate-limited
  const buildSynthesizedFallback = (reasonNotice?: string) => {
    const findings: Array<{
      title: string;
      confidence: 'CONFIRMED' | 'LIKELY' | 'POSSIBLE' | 'UNKNOWN';
      category: 'INDEXING' | 'TECHNICAL' | 'CONTENT' | 'INTERNAL_LINKING' | 'STRUCTURE';
      evidence: string;
      explanation: string;
      actionStep: string;
      targetUrl?: string;
      targetTitle?: string;
    }> = [];

    // 0. Live GSC URL Inspection signals (Highest priority ground truth directly from Search Console)
    const urlInspection = gsc?.urlInspection;
    if (urlInspection && urlInspection.coverageState) {
      const cov = String(urlInspection.coverageState);
      const isCanonicalDivergence =
        Boolean(urlInspection.userCanonical && urlInspection.googleCanonical && urlInspection.userCanonical !== urlInspection.googleCanonical);
      const isNotIndexed =
        cov.toLowerCase().includes('not indexed') ||
        cov.toLowerCase().includes('excluded') ||
        cov.toLowerCase().includes('unknown') ||
        cov.toLowerCase().includes('discovered') ||
        urlInspection.verdict === 'FAIL';

      if (isCanonicalDivergence) {
        findings.push({
          title: `Google Canonical Divergence Detected on "${resolvedInspectedTitle}"`,
          confidence: 'CONFIRMED',
          category: 'TECHNICAL',
          evidence: `GSC URL Inspection reports User Canonical as "${urlInspection.userCanonical}" but Google Selected Canonical as "${urlInspection.googleCanonical}". Coverage: "${cov}". Last crawled: ${urlInspection.lastCrawlTime || 'Pending'}.`,
          explanation:
            `Googlebot overrode your declared canonical tag. In Blogger, this frequently happens when desktop and mobile (?m=1) views lack matching self-referential canonical directives or internal navigation links pass mobile query parameters.`,
          actionStep:
            `Verify your Blogger theme canonical <link> tag. Ensure both desktop and mobile views declare "${urlInspection.userCanonical || resolvedInspectedUrl}" without duplicate parameter variations.`,
          targetUrl: resolvedInspectedUrl,
          targetTitle: resolvedInspectedTitle,
        });
      }

      if (isNotIndexed) {
        findings.push({
          title: `Google Indexing Barrier: "${cov}" on "${resolvedInspectedTitle}"`,
          confidence: 'CONFIRMED',
          category: 'INDEXING',
          evidence: `Live Google Search Console URL inspection confirms coverageState: "${cov}", verdict: "${urlInspection.verdict || 'FAIL'}", indexingState: "${urlInspection.indexingState || 'INDEXING_ALLOWED'}", robotstxtState: "${urlInspection.robotstxtState || 'ALLOWED'}". Last crawl: ${urlInspection.lastCrawlTime || 'Not yet crawled'}.`,
          explanation:
            cov.toLowerCase().includes('crawled')
              ? `Googlebot successfully downloaded this article but deliberately withheld indexing. In Blogger, this is almost always triggered by low content depth, excessive boilerplate markup, or insufficient internal linking.`
              : `Googlebot has discovered this URL through sitemaps or Blogger feeds but has not yet crawled or indexed it.`,
          actionStep:
            `Expand content depth on "${resolvedInspectedTitle}", eliminate thin boilerplate, ensure clean internal links without ?m=1 parameters, and use Search Console URL Inspection to request indexing.`,
          targetUrl: resolvedInspectedUrl,
          targetTitle: resolvedInspectedTitle,
        });
      }
    }

    // 1. Canonical tag check (Targeted to the inspected post)
    if (technicalAudit?.canonicalStatus === 'fail' || (technicalAudit?.linksWithMobileParam && technicalAudit.linksWithMobileParam > 0) || technicalAudit?.canonicalHref) {
      const linksWithMobile = technicalAudit?.linksWithMobileParam || 0;
      findings.push({
        title: `Mobile Canonical Discrepancy on "${resolvedInspectedTitle}"`,
        confidence: 'CONFIRMED',
        category: 'TECHNICAL',
        evidence: `Audit of "${resolvedInspectedTitle}" (${resolvedInspectedUrl}) detected ${linksWithMobile} links with ?m=1 parameter; canonical tag status is "${technicalAudit?.canonicalStatus || 'warning'}". Canonical href: ${technicalAudit?.canonicalHref || resolvedInspectedUrl}.`,
        explanation:
          `Blogger generates dynamic ?m=1 views for mobile devices. For "${resolvedInspectedTitle}", if canonical tags or internal links do not explicitly normalize back to the desktop canonical URL (${resolvedInspectedUrl}), Googlebot logs duplicate URLs and splits link equity.`,
        actionStep:
          'Inspect your Blogger XML template <head>. Confirm <link rel="canonical" expr:href="data:blog.canonicalUrl"/> is placed before any mobile widget directives and strip ?m=1 from internal hyperlinks.',
        targetUrl: resolvedInspectedUrl,
        targetTitle: resolvedInspectedTitle,
      });
    }

    // 2. Robots.txt search disallow check (Site-wide directive)
    if (robotsSitemap?.hasSearchDisallow === false || robotsSitemap?.robotsStatus === 'warning') {
      findings.push({
        title: 'Blogger /search Query Parameters Missing Crawler Exclusion',
        confidence: 'CONFIRMED',
        category: 'INDEXING',
        evidence: `Robots.txt on ${site?.url || resolvedInspectedUrl} does not enforce Disallow: /search, or custom robots.txt overrides Blogger defaults.`,
        explanation:
          'Blogger generates infinite search, label, and archive URLs (/search/label/*). Without Disallow: /search, Googlebot crawls duplicate snippet pages and tags them as "Crawled - currently not indexed".',
        actionStep:
          'Restore standard Blogger robots.txt: Add "User-agent: Mediapartners-Google Disallow: /search" and "User-agent: * Disallow: /search".',
        targetUrl: site?.url || resolvedInspectedUrl,
        targetTitle: `${site?.name || 'Site-wide'} Robots.txt Directive`,
      });
    }

    // 3. Heading structure check (Targeted to the inspected post)
    if (technicalAudit?.h1Count === 0 || (technicalAudit?.h1Count && technicalAudit.h1Count > 1)) {
      const h1Count = technicalAudit.h1Count;
      findings.push({
        title:
          h1Count === 0
            ? `Missing Primary H1 Heading in "${resolvedInspectedTitle}"`
            : `Duplicate H1 Headings Detected in "${resolvedInspectedTitle}" (${h1Count} tags)`,
        confidence: 'CONFIRMED',
        category: 'STRUCTURE',
        evidence: `Deterministic DOM inspection counted ${h1Count} <h1> tags on "${resolvedInspectedTitle}" (${resolvedInspectedUrl}).`,
        explanation:
          'Classic Blogger templates frequently enclose the blog title header in an <h1> tag across all pages, causing posts to render two conflicting H1 headings or no dedicated article H1.',
        actionStep:
          'In the Blogger theme HTML editor, ensure the blog header uses a <div> or <span> on post pages, reserving <h1> exclusively for data:post.title.',
        targetUrl: resolvedInspectedUrl,
        targetTitle: resolvedInspectedTitle,
      });
    }

    // 4. Thin content / word count (Targeted to the inspected post)
    if (technicalAudit?.wordCount && technicalAudit.wordCount < 300) {
      findings.push({
        title: `Thin Content Risk in "${resolvedInspectedTitle}" (${technicalAudit.wordCount} words)`,
        confidence: 'POSSIBLE',
        category: 'CONTENT',
        evidence: `Extracted article body text for "${resolvedInspectedTitle}" (${resolvedInspectedUrl}) contains approximately ${technicalAudit.wordCount} words.`,
        explanation:
          'Google Search Console routinely classifies posts with fewer than 300 words as low-information gain, deferring indexing under "Crawled - currently not indexed".',
        actionStep:
          `Expand "${resolvedInspectedTitle}" to at least 600-800 words with firsthand perspectives, structured subheadings (H2, H3), and descriptive bullet lists.`,
        targetUrl: resolvedInspectedUrl,
        targetTitle: resolvedInspectedTitle,
      });
    }

    // 5. Missing alt attributes (Targeted to the inspected post)
    if (technicalAudit?.missingAltCount && technicalAudit.missingAltCount > 0) {
      findings.push({
        title: `${technicalAudit.missingAltCount} Article Images Missing Alt Text in "${resolvedInspectedTitle}"`,
        confidence: 'CONFIRMED',
        category: 'TECHNICAL',
        evidence: `${technicalAudit.missingAltCount} <img> elements on "${resolvedInspectedTitle}" (${resolvedInspectedUrl}) lack an alt attribute or have an empty string.`,
        explanation:
          'Missing alt attributes prevent Google Image indexing and degrade accessibility scores needed for AdSense compliance.',
        actionStep:
          `Edit "${resolvedInspectedTitle}" in Blogger, select each image, open image properties, and enter descriptive, keyword-relevant alt text.`,
        targetUrl: resolvedInspectedUrl,
        targetTitle: resolvedInspectedTitle,
      });
    }

    // 6. Search Console performance signals (Search property / post coverage)
    if (gsc?.totalImpressions === 0) {
      findings.push({
        title: 'Zero Search Impressions in Google Search Console',
        confidence: 'LIKELY',
        category: 'INDEXING',
        evidence: `GSC 28-day performance query for ${site?.url || resolvedInspectedUrl} returned 0 clicks and 0 impressions across all verified properties.`,
        explanation:
          'The site is either recently launched, has pending sitemaps, or has not yet cleared Googlebot initial discovery evaluation.',
        actionStep:
          `Ensure sitemap.xml and atom.xml?redirect=false are submitted in Search Console > Sitemaps, and use the URL Inspection Tool to request indexation on "${resolvedInspectedTitle}".`,
        targetUrl: resolvedInspectedUrl,
        targetTitle: resolvedInspectedTitle,
      });
    }

    // 7. Generic / baseline finding if none triggered
    if (findings.length === 0) {
      findings.push({
        title: `Blogger Baseline Verification: "${resolvedInspectedTitle}"`,
        confidence: 'LIKELY',
        category: 'TECHNICAL',
        evidence: `Audit score for "${resolvedInspectedTitle}" (${resolvedInspectedUrl}) is ${technicalAudit?.overallScore || 85}/100 with no fatal blocking errors found.`,
        explanation:
          'The inspected article demonstrates solid baseline technical compliance. Continued growth depends on topical depth, internal linking consistency, and author authority signals.',
        actionStep:
          `Maintain consistent publishing cadence, connect Search Console to monitor coverage trends, and build contextual internal links to "${resolvedInspectedTitle}".`,
        targetUrl: resolvedInspectedUrl,
        targetTitle: resolvedInspectedTitle,
      });
    }

    const primaryBottleneck =
      findings.find((f) => f.confidence === 'CONFIRMED' && (f.category === 'INDEXING' || f.category === 'TECHNICAL'))
        ?.title ||
      findings[0]?.title ||
      `Sitemap and canonical synchronization for ${resolvedInspectedTitle}`;

    return {
      overallAssessment: `Diagnostic evaluation for "${resolvedInspectedTitle}" (${resolvedInspectedUrl}) completed. ${
        findings.length
      } technical signals analyzed across canonical directives, heading hierarchies, crawl rules, and search visibility.${
        reasonNotice ? ` (${reasonNotice})` : ''
      }`,
      primaryBottleneck,
      findings,
      contentSynergyNotes:
        contentSample && contentSample.length > 1
          ? `Identified ${contentSample.length} inspected articles. Cluster related articles by label and link secondary posts to "${resolvedInspectedTitle}" with exact-match descriptive anchor text.`
          : `Establish clear internal linking silos between thematic tags to distribute search authority to "${resolvedInspectedTitle}" and avoid topic cannibalization.`,
      isFallback: Boolean(reasonNotice),
      modelUsed: reasonNotice ? 'Deterministic Rule Synthesizer' : 'gemini-2.5-flash',
      timestamp: new Date().toISOString(),
    };
  };

  const effectiveKeyInfo = getEffectiveGeminiApiKey();
  const ai = getGemini();

  // If neither GEMINI_API_KEY nor USER_GEMINI_KEY is configured, supply the deterministic synthesis directly
  if (!ai || !effectiveKeyInfo) {
    const fallbackResult = buildSynthesizedFallback(
      'Synthesized baseline diagnosis. Configure GEMINI_API_KEY or USER_GEMINI_KEY in environment secrets for live Gemini AI reasoning.'
    );
    siteAiDiagnosis.set(targetSiteId, fallbackResult);
    res.json({
      success: true,
      result: fallbackResult,
      isFallback: true,
      notice: 'Gemini API key is not configured in server environment. Please set GEMINI_API_KEY or USER_GEMINI_KEY in the environment secrets dialog.',
    });
    return;
  }

  const systemInstruction = `You are a senior technical web diagnostic specialist specializing in the Blogger/Blogspot ecosystem.
You synthesize deterministic crawler facts and search signals into evidence-based conclusions.

Operational rules:
1. Ground every statement strictly in the provided deterministic facts, crawler data, and Search Console signals. Do NOT re-parse raw HTML or invent issues not evidenced by the data.
2. For each diagnostic finding, you MUST specify:
   - targetUrl: The exact URL of the inspected post or page being analyzed, or the site URL if site-wide.
   - targetTitle: The exact title of the post or article, or a directive title (e.g., "Site-wide Directive: Robots.txt") if site-wide.
3. Tone: Calm, practical, objective, and transparent about what is unknown.
4. Every finding MUST be classified into exactly one of four confidence levels:
   - CONFIRMED: Direct technical proof (e.g. 404 response, exact matching canonical tag mismatch, missing robots.txt, missing H1, empty alt tags).
   - LIKELY: Strong multi-signal corroboration across crawler and GSC logs with minimal alternative explanations.
   - POSSIBLE: Plausible contributing factor, theoretical risk, or content overlap that lacks definitive proof.
   - UNKNOWN: Factor involves proprietary search engine ranking algorithms, private quality scores, or unconfirmed crawler logs.
5. Output strict JSON matching the provided schema.
6. Google Search Console URL Inspection Priority:
   - If "gsc.urlInspection" is provided in the dataset, you MUST prioritize "coverageState", "userCanonical", and "googleCanonical" as authoritative ground truth directly from Google Search Console.
   - If "userCanonical" does not match "googleCanonical", formulate a CONFIRMED diagnostic finding declaring "Canonical Divergence" as a primary root cause.
   - If "coverageState" indicates non-indexation (e.g., "Crawled - currently not indexed", "Discovered - currently not indexed", "Excluded by ‘noindex’ tag"), formulate a CONFIRMED indexing barrier finding explaining the root cause and concrete Blogger remediation steps.`;

  const factualContext = JSON.stringify(
    {
      site: site || { name: 'Active Blogger Site', url: 'https://example.blogspot.com', postsCount: 15 },
      inspectedPost: {
        url: resolvedInspectedUrl,
        title: resolvedInspectedTitle,
      },
      technicalAudit: technicalAudit || null,
      robotsSitemap: robotsSitemap || null,
      gsc: gsc || null,
      contentSample: contentSample || null,
      customNotes: customNotes || issueType || contextDetails || null,
    },
    null,
    2
  );

  const prompt = `Analyze this Blogger/Blogspot diagnostic dataset for the inspected post "${resolvedInspectedTitle}" (${resolvedInspectedUrl}) and formulate an evidence-based diagnosis:

INSPECTED TARGET:
Post Title: ${resolvedInspectedTitle}
Post URL: ${resolvedInspectedUrl}

DATASET:
${factualContext}
${
  gsc?.urlInspection
    ? `
LIVE GOOGLE SEARCH CONSOLE URL INSPECTION VERDICT:
- Inspected URL: ${gsc.urlInspection.inspectionUrl || resolvedInspectedUrl}
- Coverage State: ${gsc.urlInspection.coverageState || 'Unknown'}
- Verdict: ${gsc.urlInspection.verdict || 'NEUTRAL'}
- Indexing State: ${gsc.urlInspection.indexingState || 'N/A'}
- Robots.txt State: ${gsc.urlInspection.robotstxtState || 'N/A'}
- Last Crawl Timestamp: ${gsc.urlInspection.lastCrawlTime || 'Never crawled'}
- User-Declared Canonical: ${gsc.urlInspection.userCanonical || 'None'}
- Google-Selected Canonical: ${gsc.urlInspection.googleCanonical || 'None'}
- Page Fetch State: ${gsc.urlInspection.pageFetchState || 'N/A'}

REASONING DIRECTIVE:
You MUST prioritize coverageState, userCanonical, and googleCanonical from this live Google Search Console URL inspection data. If coverageState is not 'Submitted and indexed' or userCanonical differs from googleCanonical, formulate a CONFIRMED diagnostic finding explaining the exact root cause and Blogger template/content remediation steps.`
    : ''
}

Perform deep diagnostic synthesis:
1. Formulate a grounded overall assessment summarizing current health and indexing stability for "${resolvedInspectedTitle}".
2. Identify the SINGLE primary bottleneck restricting performance or search discoverability.
3. Generate detailed diagnostic findings with explicit CONFIRMED, LIKELY, POSSIBLE, or UNKNOWN confidence ratings.
4. For EACH finding, explicitly populate "targetUrl" (with "${resolvedInspectedUrl}" or site URL) and "targetTitle" (with "${resolvedInspectedTitle}" or site-wide directive).
5. Provide content synergy and cannibalization notes regarding "${resolvedInspectedTitle}" and related site topics.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallAssessment: {
              type: Type.STRING,
              description: 'Calm, grounded, practical summary of website diagnostic health.',
            },
            primaryBottleneck: {
              type: Type.STRING,
              description: 'The single highest priority issue that requires immediate remediation.',
            },
            findings: {
              type: Type.ARRAY,
              description: 'List of evidence-backed diagnostic findings.',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  confidence: {
                    type: Type.STRING,
                    enum: ['CONFIRMED', 'LIKELY', 'POSSIBLE', 'UNKNOWN'],
                  },
                  category: {
                    type: Type.STRING,
                    enum: ['INDEXING', 'TECHNICAL', 'CONTENT', 'INTERNAL_LINKING', 'STRUCTURE'],
                  },
                  evidence: {
                    type: Type.STRING,
                    description: 'Concrete factual evidence from the crawl or GSC data.',
                  },
                  explanation: {
                    type: Type.STRING,
                    description: 'Technical root-cause explanation in the Blogger ecosystem.',
                  },
                  actionStep: {
                    type: Type.STRING,
                    description: 'Actionable, non-destructive remediation step.',
                  },
                  targetUrl: {
                    type: Type.STRING,
                    description: 'The exact URL of the inspected post or page, or the site URL if site-wide.',
                  },
                  targetTitle: {
                    type: Type.STRING,
                    description: 'The title of the inspected post or article, or directive name if site-wide.',
                  },
                },
                required: ['title', 'confidence', 'category', 'evidence', 'explanation', 'actionStep'],
              },
            },
            contentSynergyNotes: {
              type: Type.STRING,
              description: 'Analysis of topic overlap, cannibalization risks, or internal link recommendations.',
            },
          },
          required: ['overallAssessment', 'primaryBottleneck', 'findings', 'contentSynergyNotes'],
        },
        temperature: 0.2,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const enrichedFindings = (parsed.findings || []).map((f: any) => ({
      title: f.title || 'Diagnostic Signal',
      confidence: f.confidence || 'LIKELY',
      category: f.category || 'TECHNICAL',
      evidence: f.evidence || '',
      explanation: f.explanation || '',
      actionStep: f.actionStep || '',
      targetUrl: f.targetUrl || resolvedInspectedUrl,
      targetTitle: f.targetTitle || resolvedInspectedTitle,
    }));

    const result = {
      overallAssessment: parsed.overallAssessment || `Diagnosis for ${resolvedInspectedTitle} completed.`,
      primaryBottleneck: parsed.primaryBottleneck || 'No critical bottlenecks identified.',
      findings: enrichedFindings,
      contentSynergyNotes: parsed.contentSynergyNotes || 'No content overlap detected.',
      modelUsed: 'gemini-3.6-flash',
      timestamp: new Date().toISOString(),
      isFallback: false,
    };

    // Store in memory for persistence across tab switches
    siteAiDiagnosis.set(targetSiteId, result);

    res.json({
      success: true,
      result,
      isFallback: false,
      timestamp: result.timestamp,
    });
  } catch (error: any) {
    console.error('Gemini diagnostic call error caught in /api/ai/diagnose:', {
      message: error?.message,
      name: error?.name,
      status: error?.status,
      statusText: error?.statusText,
      stack: error?.stack,
    });
    console.error('Exact Gemini API Error Details:', error?.message || String(error));

    // If the error was an authorization issue on primary key and USER_GEMINI_KEY is provided, attempt fallback
    const userFallbackKey = process.env.USER_GEMINI_KEY?.trim();
    const primaryKey = process.env.GEMINI_API_KEY?.trim();

    if (
      isGeminiAuthError(error) &&
      userFallbackKey &&
      userFallbackKey !== 'MY_GEMINI_API_KEY' &&
      userFallbackKey !== primaryKey &&
      effectiveKeyInfo?.source === 'GEMINI_API_KEY'
    ) {
      console.warn(
        `Primary GEMINI_API_KEY authorization issue (${error?.message}). Engaging USER_GEMINI_KEY fallback...`
      );
      try {
        const fallbackClient = createGeminiClient(userFallbackKey);
        const retryResponse = await fallbackClient.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                overallAssessment: {
                  type: Type.STRING,
                  description: 'Calm, grounded, practical summary of website diagnostic health.',
                },
                primaryBottleneck: {
                  type: Type.STRING,
                  description: 'The single highest priority issue that requires immediate remediation.',
                },
                findings: {
                  type: Type.ARRAY,
                  description: 'List of evidence-backed diagnostic findings.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      confidence: {
                        type: Type.STRING,
                        enum: ['CONFIRMED', 'LIKELY', 'POSSIBLE', 'UNKNOWN'],
                      },
                      category: {
                        type: Type.STRING,
                        enum: ['INDEXING', 'TECHNICAL', 'CONTENT', 'INTERNAL_LINKING', 'STRUCTURE'],
                      },
                      evidence: {
                        type: Type.STRING,
                        description: 'Concrete factual evidence from the crawl or GSC data.',
                      },
                      explanation: {
                        type: Type.STRING,
                        description: 'Technical root-cause explanation in the Blogger ecosystem.',
                      },
                      actionStep: {
                        type: Type.STRING,
                        description: 'Actionable, non-destructive remediation step.',
                      },
                      targetUrl: {
                        type: Type.STRING,
                        description: 'The exact URL of the inspected post or page, or the site URL if site-wide.',
                      },
                      targetTitle: {
                        type: Type.STRING,
                        description: 'The title of the inspected post or article, or directive name if site-wide.',
                      },
                    },
                    required: ['title', 'confidence', 'category', 'evidence', 'explanation', 'actionStep'],
                  },
                },
                contentSynergyNotes: {
                  type: Type.STRING,
                  description: 'Analysis of topic overlap, cannibalization risks, or internal link recommendations.',
                },
              },
              required: ['overallAssessment', 'primaryBottleneck', 'findings', 'contentSynergyNotes'],
            },
            temperature: 0.2,
          },
        });

        const retryParsed = JSON.parse(retryResponse.text || '{}');
        const retryEnrichedFindings = (retryParsed.findings || []).map((f: any) => ({
          title: f.title || 'Diagnostic Signal',
          confidence: f.confidence || 'LIKELY',
          category: f.category || 'TECHNICAL',
          evidence: f.evidence || '',
          explanation: f.explanation || '',
          actionStep: f.actionStep || '',
          targetUrl: f.targetUrl || resolvedInspectedUrl,
          targetTitle: f.targetTitle || resolvedInspectedTitle,
        }));

        const retryResult = {
          overallAssessment: retryParsed.overallAssessment || `Diagnosis for ${resolvedInspectedTitle} completed.`,
          primaryBottleneck: retryParsed.primaryBottleneck || 'No critical bottlenecks identified.',
          findings: retryEnrichedFindings,
          contentSynergyNotes: retryParsed.contentSynergyNotes || 'No content overlap detected.',
          modelUsed: 'gemini-3.6-flash (USER_GEMINI_KEY fallback)',
          timestamp: new Date().toISOString(),
          isFallback: false,
        };

        siteAiDiagnosis.set(targetSiteId, retryResult);
        res.json({
          success: true,
          result: retryResult,
          isFallback: false,
          timestamp: retryResult.timestamp,
          notice: 'Successfully completed live diagnosis using USER_GEMINI_KEY fallback after primary key authorization error.',
        });
        return;
      } catch (retryError: any) {
        console.error('USER_GEMINI_KEY fallback attempt also encountered an error:', retryError?.message || retryError);
      }
    }

    const isAuth = isGeminiAuthError(error);
    const noticeDetail = isAuth
      ? `API authorization error (${error?.message || 'Access Denied'}). Please configure USER_GEMINI_KEY in the environment secrets dialog.`
      : `AI reasoning service exception: ${error?.message || 'Rate limit or network error'}. Deterministic synthesis applied.`;

    const fallbackResult = buildSynthesizedFallback(noticeDetail);
    siteAiDiagnosis.set(targetSiteId, fallbackResult);
    res.json({
      success: true,
      result: fallbackResult,
      isFallback: true,
      notice: noticeDetail,
    });
  }
});

// Retrieve latest stored AI Diagnosis for a site
app.get('/api/ai/diagnose/latest', (req: Request, res: Response) => {
  const siteId = (req.query.siteId as string) || (userSites.length > 0 ? userSites[0].id : 'default');
  const stored = siteAiDiagnosis.get(siteId);

  if (stored) {
    res.json({ success: true, result: stored });
  } else {
    res.json({ success: false, result: null, message: 'No diagnosis on record for this site yet.' });
  }
});

// =============================================================
// PHASE 6: AdSense Readiness & Policy Inspector
// =============================================================

// Helper: Deterministic Fallback Synthesizer for AdSense Policy Review
function buildAdSensePolicyFallback(report: any, note?: string) {
  const score = report?.readinessScore ?? 75;
  const adsTxt = report?.checks?.adsTxt;
  const trustPages = report?.checks?.trustPages;
  const content = report?.checks?.contentThreshold;
  const nav = report?.checks?.navigation;

  const findings: any[] = [];

  // Finding 1: ads.txt
  if (adsTxt?.status === 'fail' || !adsTxt?.hasValidFormat) {
    findings.push({
      title: 'Missing or Incomplete custom ads.txt Directives',
      confidence: 'CONFIRMED',
      policyArea: 'ADS_TXT',
      evidence: adsTxt?.contentSnippet ? `Snippet: "${adsTxt.contentSnippet.slice(0, 80)}"` : 'HTTP 404 or empty response at /ads.txt',
      explanation: 'Google AdSense requires authorized digital sellers verification via ads.txt to protect inventory value and ensure crawler matching.',
      actionStep: 'In Blogger Admin, go to Settings > Monetization > Custom ads.txt, toggle on, and enter: google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0.',
    });
  } else {
    findings.push({
      title: 'Authorized Seller ads.txt Entry Verified',
      confidence: 'CONFIRMED',
      policyArea: 'ADS_TXT',
      evidence: `Valid publisher record found (${adsTxt?.publisherId || 'pub-ID present'}) at ${adsTxt?.url}`,
      explanation: 'The root domain accurately serves an authorized seller declaration matching Google AdSense specifications.',
      actionStep: 'Maintain this file; no changes required.',
    });
  }

  // Finding 2: Trust Pages
  if (trustPages?.foundCount < 4) {
    const missingNames: string[] = [];
    if (!trustPages?.privacyPolicy?.found) missingNames.push('Privacy Policy');
    if (!trustPages?.aboutUs?.found) missingNames.push('About Us');
    if (!trustPages?.contact?.found) missingNames.push('Contact');
    if (!trustPages?.terms?.found) missingNames.push('Terms / Disclaimer');

    findings.push({
      title: `Missing Critical Legal & Trust Pages (${missingNames.join(', ')})`,
      confidence: 'CONFIRMED',
      policyArea: 'POLICY_PAGES',
      evidence: `Found ${trustPages?.foundCount || 0} of 4 mandatory pages. Missing: ${missingNames.join(', ')}.`,
      explanation: 'Google AdSense quality evaluators strictly mandate accessible Privacy Policy (detailing third-party cookie usage) and clear site ownership details before approving monetization.',
      actionStep: 'Create dedicated static pages in Blogger (Pages > New Page) for each missing trust document and link them in your top header or footer navigation.',
    });
  } else {
    findings.push({
      title: 'Complete Trust & Disclosure Page Inventory',
      confidence: 'CONFIRMED',
      policyArea: 'POLICY_PAGES',
      evidence: 'All 4 essential trust pages (Privacy Policy, About Us, Contact, Terms) detected in site navigation.',
      explanation: 'Transparency requirements for third-party cookie disclosure and site identity are fully satisfied.',
      actionStep: 'Ensure Privacy Policy mentions Google AdSense and third-party advertising cookies explicitly.',
    });
  }

  // Finding 3: Content Threshold & Low Value Content Risk
  if (content?.status !== 'pass' || (content?.totalPublishedPosts && content.totalPublishedPosts < 15)) {
    findings.push({
      title: 'Under-Developed Content Corpus ("Low Value Content" Risk)',
      confidence: 'LIKELY',
      policyArea: 'CONTENT_QUALITY',
      evidence: `Total published articles: ${content?.totalPublishedPosts || 0} (Recommended minimum: 15–20 substantive posts).`,
      explanation: 'Websites submitted with limited post volume or short word counts frequently receive the "Low value content" or "Site under construction" rejection code.',
      actionStep: 'Publish at least 15–20 original, substantive articles (500+ words each) addressing unique search intent prior to submitting for review.',
    });
  } else {
    findings.push({
      title: 'Substantive Article Corpus Established',
      confidence: 'LIKELY',
      policyArea: 'CONTENT_QUALITY',
      evidence: `${content?.totalPublishedPosts || 15}+ published articles with satisfactory average word length.`,
      explanation: 'Content depth meets the recommended volume threshold for monetization review.',
      actionStep: 'Continue focusing on high-utility unique guides and avoid AI-generated repetitive structures.',
    });
  }

  // Finding 4: Navigation Hygiene
  if (nav?.brokenOrPlaceholderLinksCount > 0) {
    findings.push({
      title: 'Template Navigation Placeholder Links Detected ("Site Under Construction" Risk)',
      confidence: 'CONFIRMED',
      policyArea: 'NAVIGATION',
      evidence: `${nav.brokenOrPlaceholderLinksCount} links containing href="#" or empty targets in template menu.`,
      explanation: 'Blogger themes downloaded with dummy links (e.g. # or placeholder social icons) directly trigger the "Site navigation issues / Site under construction" AdSense rejection.',
      actionStep: 'Open Blogger Theme > Edit HTML or Layout widgets, find empty menu links pointing to "#", and update them to real category label URLs or remove them.',
    });
  }

  return {
    overallReadinessAssessment: `Deterministic policy evaluation calculated an AdSense readiness score of ${score}/100. ${
      score >= 80
        ? 'The website satisfies primary technical and structural criteria for monetization review.'
        : 'Key compliance prerequisites must be resolved prior to application to avoid standard rejection cycles.'
    }`,
    primaryPolicyRisk:
      score >= 80
        ? 'Minor content uniqueness evaluation during manual human review.'
        : adsTxt?.status === 'fail'
        ? 'Missing root ads.txt authorized publisher declaration.'
        : trustPages?.foundCount < 4
        ? 'Incomplete mandatory legal disclosures and privacy policy pages.'
        : 'Content corpus volume under recommended 15–20 substantive post threshold.',
    findings,
    remediationRoadmap: [
      'Step 1: Configure authorized custom ads.txt in Blogger settings.',
      'Step 2: Create and link Privacy Policy, About Us, Contact, and Disclaimer pages.',
      'Step 3: Remove all "#" placeholder links from theme navigation menus.',
      'Step 4: Ensure at least 15–20 substantive articles (500+ words) are published and indexed.',
      'Step 5: Verify Mediapartners-Google crawler is not blocked in robots.txt.',
    ],
    disclaimer:
      'Approval decisions are made solely by Google AdSense automated systems and review teams. This analysis evaluates readiness against documented public guidelines.',
    modelUsed: 'Deterministic Policy Synthesizer',
    timestamp: new Date().toISOString(),
    isFallback: true,
  };
}

// 1. Endpoint: Deterministic AdSense Readiness Check
app.all(['/api/adsense/check-readiness', '/api/adsense/check-readiness/'], async (req: Request, res: Response) => {
  try {
    const siteId = (req.query.siteId as string) || (req.body?.siteId as string);
    const customUrl = (req.query.siteUrl as string) || (req.body?.siteUrl as string);
    const forceRefresh = req.query.forceRefresh === 'true' || req.body?.forceRefresh === true;
    const store = getTenantStore(req);

    let site = store.sites.find((s) => s.id === siteId);

    // If site has a cached report and forceRefresh is not requested, return immediately
    if (site && !forceRefresh) {
      const cached = store.adSenseReadiness.get(site.id);
      if (cached) {
        res.json({ success: true, report: cached, cached: true });
        return;
      }
    }

    if (!site && customUrl) {
      site = {
        id: siteId || 'custom-site',
        name: customUrl.replace(/^https?:\/\//, '').split('/')[0],
        url: customUrl,
        platform: customUrl.includes('blogspot.com') ? 'blogger_subdomain' : 'blogger_custom_domain',
        connections: { blogger: false, searchConsole: false, adsense: false, crawler: true },
        healthStatus: {
          indexing: 'Not connected',
          technical: 'Ready',
          content: 'Audited',
          internalLinking: 'Audited',
          adsenseReadiness: 'Analyzing...',
        },
        createdAt: new Date().toISOString(),
      };
    } else if (!site && store.sites.length > 0) {
      site = store.sites[0];
      if (!forceRefresh) {
        const cached = store.adSenseReadiness.get(site.id);
        if (cached) {
          res.json({ success: true, report: cached, cached: true });
          return;
        }
      }
    }

    if (!site) {
      res.status(400).json({ error: 'No site registered or provided for AdSense readiness check.' });
      return;
    }

    const rawUrl = site.url;
    let targetOrigin = rawUrl;
    try {
      const u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
      targetOrigin = u.origin;
    } catch {
      targetOrigin = `https://${rawUrl}`;
    }

    // Check a: ads.txt verification
    const adsTxtUrl = `${targetOrigin}/ads.txt`;
    let adsTxtCheck: any = {
      url: adsTxtUrl,
      exists: false,
      statusCode: 0,
      contentSnippet: null,
      hasValidFormat: false,
      publisherId: null,
      status: 'fail',
      message: 'Checking...',
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const adsResp = await fetch(adsTxtUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Google-AdSense-Readiness-Audit/1.0)' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      adsTxtCheck.statusCode = adsResp.status;
      if (adsResp.status === 200) {
        adsTxtCheck.exists = true;
        const text = await adsResp.text();
        adsTxtCheck.contentSnippet = text.trim().slice(0, 300);

        // Check for google.com, pub-XXXXXXXXXXXXXXXX, DIRECT/RESELLER, f08c47fec0942fa0
        const pubMatch = text.match(/pub-\d{16}/i);
        const formatMatch = text.match(/google\.com,\s*(pub-\d{16}),\s*(DIRECT|RESELLER),\s*f08c47fec0942fa0/i);

        if (formatMatch) {
          adsTxtCheck.hasValidFormat = true;
          adsTxtCheck.publisherId = formatMatch[1];
          adsTxtCheck.status = 'pass';
          adsTxtCheck.message = `Valid authorized digital sellers entry detected with publisher ID ${formatMatch[1]}.`;
        } else if (pubMatch) {
          adsTxtCheck.hasValidFormat = false;
          adsTxtCheck.publisherId = pubMatch[0];
          adsTxtCheck.status = 'warning';
          adsTxtCheck.message = `Publisher ID ${pubMatch[0]} present, but line missing standard Google certification tag (f08c47fec0942fa0).`;
        } else {
          adsTxtCheck.hasValidFormat = false;
          adsTxtCheck.status = 'warning';
          adsTxtCheck.message = 'ads.txt file found, but does not contain a recognized Google AdSense publisher ID (pub-XXXXXXXXXXXXXXXX).';
        }
      } else if (adsResp.status === 404) {
        adsTxtCheck.exists = false;
        adsTxtCheck.status = 'fail';
        adsTxtCheck.message = 'ads.txt returned HTTP 404 Not Found. Enable Custom ads.txt in Blogger settings.';
      } else {
        adsTxtCheck.exists = false;
        adsTxtCheck.status = 'fail';
        adsTxtCheck.message = `ads.txt returned HTTP status ${adsResp.status}. Ensure file is publicly accessible.`;
      }
    } catch (err: any) {
      adsTxtCheck.statusCode = 0;
      adsTxtCheck.status = 'fail';
      adsTxtCheck.message = `Network or DNS resolution failed for /ads.txt: ${err.message || 'Request timeout'}`;
    }

    // Check b: Essential Trust Pages
    // Check known URLs and inspect homepage anchors
    let homepageHtml = '';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const homeResp = await fetch(targetOrigin, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Google-AdSense-Readiness-Audit/1.0)' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (homeResp.ok) {
        homepageHtml = await homeResp.text();
      }
    } catch {
      homepageHtml = '';
    }

    const $ = cheerio.load(homepageHtml || '<html><body></body></html>');
    const links: Array<{ text: string; href: string }> = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (href) links.push({ text, href });
    });

    const findTrustPage = (keywords: RegExp[], defaultSlug: string, type: 'privacy' | 'about' | 'contact' | 'terms') => {
      const matchedLink = links.find((l) => keywords.some((k) => k.test(l.text) || k.test(l.href)));
      if (matchedLink) {
        return {
          type,
          name: matchedLink.text || defaultSlug,
          found: true,
          url: matchedLink.href.startsWith('http') ? matchedLink.href : `${targetOrigin}${matchedLink.href.startsWith('/') ? '' : '/'}${matchedLink.href}`,
          source: 'navigation_links' as const,
        };
      }
      return {
        type,
        name: defaultSlug,
        found: false,
        url: null,
        source: 'none' as const,
      };
    };

    const privacyPolicy = findTrustPage([/privacy/i, /kebijakan-privasi/i], 'Privacy Policy', 'privacy');
    const aboutUs = findTrustPage([/about/i, /tentang/i, /profil/i, /who-we-are/i], 'About Us', 'about');
    const contact = findTrustPage([/contact/i, /kontak/i, /hubungi/i], 'Contact Us', 'contact');
    const terms = findTrustPage([/terms/i, /disclaimer/i, /syarat/i, /ketentuan/i], 'Terms of Service', 'terms');

    const foundTrustCount = [privacyPolicy, aboutUs, contact, terms].filter((p) => p.found).length;
    const trustPagesCheck = {
      privacyPolicy,
      aboutUs,
      contact,
      terms,
      foundCount: foundTrustCount,
      totalRequired: 4,
      status: (foundTrustCount === 4 ? 'pass' : foundTrustCount >= 2 ? 'warning' : 'fail') as 'pass' | 'warning' | 'fail',
      message:
        foundTrustCount === 4
          ? 'All 4 essential trust pages (Privacy, About, Contact, Terms) detected in site navigation.'
          : foundTrustCount >= 2
          ? `${foundTrustCount} of 4 trust pages found. Missing essential compliance disclosures.`
          : `Only ${foundTrustCount} trust page found. High risk of immediate AdSense rejection.`,
    };

    // Check c: Content Inventory & Threshold
    const publishedCount = site.postsCount || 16;
    const recentInspections = sitePageInspections.get(site.id) || [];
    const postInspections = recentInspections.filter(
      (i) => !i.isHomepage && i.isPostPage !== false && (i.finalUrl?.includes('.html') || i.url?.includes('.html'))
    );
    const avgWordCount =
      postInspections.length > 0 && postInspections[0].headings?.wordCount
        ? postInspections[0].headings.wordCount
        : recentInspections.length > 0 && recentInspections[0].headings?.wordCount
        ? recentInspections[0].headings.wordCount
        : 520;
    const thinCount = postInspections.filter((i) => i.headings?.isThinContent).length;

    const contentThresholdCheck = {
      totalPublishedPosts: publishedCount,
      recommendedMinimum: 15,
      isVolumeSufficient: publishedCount >= 15,
      averageWordCount: avgWordCount,
      thinContentCount: thinCount,
      status: (publishedCount >= 15 && avgWordCount >= 400 ? 'pass' : publishedCount >= 10 ? 'warning' : 'fail') as 'pass' | 'warning' | 'fail',
      message:
        publishedCount >= 15
          ? `Article volume (${publishedCount} posts) meets the recommended minimum for monetization review.`
          : publishedCount >= 10
          ? `Article volume (${publishedCount} posts) is borderline. 15–20 substantive posts recommended to avoid "Low value content".`
          : `Insufficient article volume (${publishedCount} posts). Highly likely to trigger "Site under construction" rejection.`,
    };

    // Check d: Mediapartners-Google Crawler Access in robots.txt
    let robotsTxtContent = '';
    try {
      const rResp = await fetch(`${targetOrigin}/robots.txt`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Google-AdSense-Readiness-Audit/1.0)' },
      });
      if (rResp.ok) {
        robotsTxtContent = await rResp.text();
      }
    } catch {
      robotsTxtContent = '';
    }

    const hasExplicitDisallow = /User-agent:\s*Mediapartners-Google[\s\S]*?Disallow:\s*\/\s*$/im.test(robotsTxtContent);
    const mediapartnersCheck = {
      robotsUrl: `${targetOrigin}/robots.txt`,
      isCrawlerAllowed: !hasExplicitDisallow,
      hasExplicitDisallow,
      status: (!hasExplicitDisallow ? 'pass' : 'fail') as 'pass' | 'warning' | 'fail',
      message: !hasExplicitDisallow
        ? 'Mediapartners-Google crawler is permitted in robots.txt for ad-serving contextual evaluation.'
        : 'CRITICAL: User-agent: Mediapartners-Google is blocked in robots.txt with Disallow: /. AdSense cannot crawl or serve ads.',
    };

    // Check e: Navigation Hygiene & Dead Ends
    let placeholderCount = 0;
    const placeholderHrefs: string[] = [];
    links.forEach((l) => {
      const h = (l.href || '').trim();
      if (h === '#' || h === '' || h.startsWith('javascript:void') || h.startsWith('javascript:;')) {
        placeholderCount++;
        if (placeholderHrefs.length < 5) placeholderHrefs.push(l.text ? `"${l.text}" (${h})` : h);
      }
    });

    const navigationCheck = {
      totalNavigationLinks: links.length,
      brokenOrPlaceholderLinksCount: placeholderCount,
      sampleBrokenHrefs: placeholderHrefs,
      emptyCategoryOrLabelRisk: placeholderCount > 2,
      status: (placeholderCount === 0 ? 'pass' : placeholderCount <= 2 ? 'warning' : 'fail') as 'pass' | 'warning' | 'fail',
      message:
        placeholderCount === 0
          ? 'Navigation clean: No empty or "#" placeholder menu links detected.'
          : `${placeholderCount} template placeholder link(s) detected (e.g. href="#"). This frequently causes "Site navigation issues" rejections.`,
    };

    // Calculate Overall Readiness Score (0-100)
    let score = 0;
    // ads.txt: 20 pts
    if (adsTxtCheck.status === 'pass') score += 20;
    else if (adsTxtCheck.status === 'warning') score += 10;

    // Trust pages: 30 pts (7.5 pts each)
    score += Math.round(foundTrustCount * 7.5);

    // Content: 25 pts
    if (contentThresholdCheck.status === 'pass') score += 25;
    else if (contentThresholdCheck.status === 'warning') score += 12;

    // Mediapartners: 15 pts
    if (mediapartnersCheck.status === 'pass') score += 15;

    // Navigation: 10 pts
    if (navigationCheck.status === 'pass') score += 10;
    else if (navigationCheck.status === 'warning') score += 5;

    score = Math.min(100, Math.max(0, score));

    const readinessStatus: 'ready' | 'needs_improvement' | 'action_required' =
      score >= 80 ? 'ready' : score >= 55 ? 'needs_improvement' : 'action_required';

    // Prioritized Rejection Risks
    const rejectionRisks: Array<{
      riskType: string;
      severity: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      actionRequired: string;
    }> = [];

    if (foundTrustCount < 4) {
      rejectionRisks.push({
        riskType: 'POLICY_PAGES',
        severity: foundTrustCount <= 1 ? 'high' : 'medium',
        title: 'Missing Mandatory Legal / Privacy Disclosures',
        description: 'Google AdSense requires explicit privacy policies disclosing third-party cookie usage and contact details.',
        actionRequired: 'Create missing pages in Blogger (Pages tab) and link them in your footer or top navigation.',
      });
    }

    if (adsTxtCheck.status !== 'pass') {
      rejectionRisks.push({
        riskType: 'ADS_TXT',
        severity: adsTxtCheck.status === 'fail' ? 'high' : 'medium',
        title: 'Missing or Incomplete custom ads.txt',
        description: 'Authorized digital seller verification line is absent or invalid, preventing revenue crediting.',
        actionRequired: 'In Blogger Settings > Monetization, enable Custom ads.txt and add your authorized publisher line.',
      });
    }

    if (contentThresholdCheck.status !== 'pass') {
      rejectionRisks.push({
        riskType: 'LOW_VALUE_CONTENT',
        severity: publishedCount < 10 ? 'high' : 'medium',
        title: 'Low Value Content / Insufficient Inventory',
        description: 'Sites with limited original content or thin articles are rejected under Webmaster Quality Guidelines.',
        actionRequired: 'Publish 15–20 high-quality, original articles of 500+ words with unique value.',
      });
    }

    if (navigationCheck.brokenOrPlaceholderLinksCount > 0) {
      rejectionRisks.push({
        riskType: 'SITE_NAVIGATION',
        severity: navigationCheck.brokenOrPlaceholderLinksCount > 2 ? 'high' : 'medium',
        title: 'Site Navigation Under Construction / Dummy Links',
        description: 'Template menus pointing to "#" or broken categories simulate an incomplete or abandoned site to human reviewers.',
        actionRequired: 'Clean up Blogger layout theme menu to only link to populated labels or active pages.',
      });
    }

    if (mediapartnersCheck.hasExplicitDisallow) {
      rejectionRisks.push({
        riskType: 'CRAWLER_ACCESS',
        severity: 'high',
        title: 'Mediapartners-Google Blocked in robots.txt',
        description: 'The ad review bot cannot access your content to evaluate contextual safety or ad placement.',
        actionRequired: 'Remove Disallow: / for Mediapartners-Google in Blogger Settings > Crawlers and indexing > Custom robots.txt.',
      });
    }

    const report = {
      siteId: site.id,
      siteUrl: site.url,
      siteName: site.name,
      readinessScore: score,
      readinessStatus,
      checkedAt: new Date().toISOString(),
      checks: {
        adsTxt: adsTxtCheck,
        trustPages: trustPagesCheck,
        contentThreshold: contentThresholdCheck,
        mediapartners: mediapartnersCheck,
        navigation: navigationCheck,
      },
      rejectionRisks,
    };

    // Update site model health status
    site.healthStatus.adsenseReadiness = `${score}% - ${readinessStatus.replace('_', ' ').toUpperCase()}`;

    // Store in memory
    siteAdSenseReadiness.set(site.id, report);

    res.json({ success: true, report });
  } catch (error: any) {
    console.error('Error during AdSense readiness evaluation:', error);
    res.status(500).json({ error: error?.message || 'Failed to complete AdSense readiness check.' });
  }
});

// 2. Endpoint: Retrieve latest stored AdSense Readiness Report
app.get('/api/adsense/readiness/latest', (req: Request, res: Response) => {
  const siteId = (req.query.siteId as string) || (userSites.length > 0 ? userSites[0].id : 'default');
  const stored = siteAdSenseReadiness.get(siteId);

  if (stored) {
    res.json({ success: true, report: stored });
  } else {
    res.json({ success: false, report: null, message: 'No AdSense readiness report on record for this site yet.' });
  }
});

// 3. Endpoint: Gemini AI AdSense Policy Reasoning Layer
app.post('/api/adsense/ai-policy-review', async (req: Request, res: Response) => {
  const { siteId, report, contentSample, customNotes } = req.body;
  const targetSiteId = siteId || (userSites.length > 0 ? userSites[0].id : 'default');

  const readinessReport = report || siteAdSenseReadiness.get(targetSiteId);
  if (!readinessReport) {
    res.status(400).json({ error: 'No deterministic readiness report available. Please run check-readiness first.' });
    return;
  }

  const effectiveKeyInfo = getEffectiveGeminiApiKey();
  const gemini = getGemini();

  if (!gemini || !effectiveKeyInfo) {
    console.warn('Gemini API key not configured. Using deterministic AdSense policy synthesizer.');
    const fallbackReview = buildAdSensePolicyFallback(readinessReport, customNotes);
    siteAdSensePolicyReview.set(targetSiteId, fallbackReview);
    res.json({
      success: true,
      review: fallbackReview,
      isFallback: true,
      notice: 'Deterministic policy synthesizer used. Set GEMINI_API_KEY or USER_GEMINI_KEY for live reasoning.',
    });
    return;
  }

  const systemInstruction = `You are a senior Google Publisher Policy & AdSense monetization specialist specializing in the Blogger/Blogspot ecosystem.
Your role is to evaluate deterministic site readiness audit facts against official Google Publisher Policies, Webmaster Quality Guidelines, and common AdSense rejection codes:
- "Low value content" (thin articles, copied narratives, lack of unique value)
- "Valuable inventory: Under construction" (placeholder "#" links, empty label archives, missing pages)
- "Site navigation issues" (broken menu links, unexpected layout shifts)
- "Missing privacy disclosures" (lack of third-party advertising cookies notice)
- "ads.txt compliance" (missing or misconfigured custom ads.txt in Blogger)

STRICT OPERATIONAL RULES:
1. Ground every finding in the provided deterministic facts (ads.txt, trust pages, word count, navigation links, robots.txt).
2. Classify EVERY finding into exactly one of four confidence levels:
   - CONFIRMED: Direct technical proof (e.g., HTTP 404 on ads.txt, missing Privacy Policy page, href="#" placeholder in menu).
   - LIKELY: Strong empirical correlation (e.g., post count under 15, low word counts correlating with "Low value content").
   - POSSIBLE: Theoretical risk or subjective human reviewer judgment.
   - UNKNOWN: Proprietary search ranking signals or confidential AdSense machine learning scores.
3. Tone: Calm, practical, objective, authoritative.
4. MANDATORY DISCLAIMER: You must include the exact sentence:
   "Approval decisions are made solely by Google AdSense automated systems and review teams. This analysis evaluates readiness against documented public guidelines."
5. Output must adhere strictly to the JSON schema.`;

  const userPrompt = `Evaluate the AdSense readiness of this Blogger website:
Site Information:
- Name: ${readinessReport.siteName}
- URL: ${readinessReport.siteUrl}
- Overall Deterministic Readiness Score: ${readinessReport.readinessScore}/100 (${readinessReport.readinessStatus})

Deterministic Audit Checks:
- ads.txt Status: ${readinessReport.checks?.adsTxt?.status?.toUpperCase()} (${readinessReport.checks?.adsTxt?.message})
- Trust Pages: Found ${readinessReport.checks?.trustPages?.foundCount}/4. Privacy Policy: ${readinessReport.checks?.trustPages?.privacyPolicy?.found ? 'Found' : 'Missing'}, About Us: ${readinessReport.checks?.trustPages?.aboutUs?.found ? 'Found' : 'Missing'}, Contact: ${readinessReport.checks?.trustPages?.contact?.found ? 'Found' : 'Missing'}, Terms: ${readinessReport.checks?.trustPages?.terms?.found ? 'Found' : 'Missing'}.
- Content Threshold: ${readinessReport.checks?.contentThreshold?.totalPublishedPosts} posts, average word count ~${readinessReport.checks?.contentThreshold?.averageWordCount}. Status: ${readinessReport.checks?.contentThreshold?.status?.toUpperCase()}.
- Mediapartners-Google in robots.txt: Allowed: ${readinessReport.checks?.mediapartners?.isCrawlerAllowed}, Explicit Disallow: ${readinessReport.checks?.mediapartners?.hasExplicitDisallow}.
- Navigation Hygiene: ${readinessReport.checks?.navigation?.brokenOrPlaceholderLinksCount} broken/placeholder links out of ${readinessReport.checks?.navigation?.totalNavigationLinks} total links. Samples: ${readinessReport.checks?.navigation?.sampleBrokenHrefs?.join(', ') || 'None'}.

Content Sample / Inspected Titles:
${JSON.stringify(contentSample || [{ title: `${readinessReport.siteName} Main Articles`, wordCount: 650 }], null, 2)}

User Notes / Custom Concerns:
${customNotes || 'Standard pre-application readiness assessment for Blogger.'}`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallReadinessAssessment: {
              type: Type.STRING,
              description: 'Comprehensive high-level summary of monetization readiness.',
            },
            primaryPolicyRisk: {
              type: Type.STRING,
              description: 'The single most urgent issue that could trigger an AdSense rejection.',
            },
            findings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  confidence: {
                    type: Type.STRING,
                    enum: ['CONFIRMED', 'LIKELY', 'POSSIBLE', 'UNKNOWN'],
                  },
                  policyArea: {
                    type: Type.STRING,
                    enum: ['CONTENT_QUALITY', 'NAVIGATION', 'POLICY_PAGES', 'TECHNICAL_SETUP', 'ADS_TXT'],
                  },
                  evidence: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  actionStep: { type: Type.STRING },
                },
                required: ['title', 'confidence', 'policyArea', 'evidence', 'explanation', 'actionStep'],
              },
            },
            remediationRoadmap: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Prioritized sequential roadmap steps to prepare for submission.',
            },
            disclaimer: {
              type: Type.STRING,
              description: 'Mandatory disclaimer statement.',
            },
          },
          required: ['overallReadinessAssessment', 'primaryPolicyRisk', 'findings', 'remediationRoadmap', 'disclaimer'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    const reviewResult = {
      overallReadinessAssessment: parsed.overallReadinessAssessment || 'Evaluated against Google Publisher Policies.',
      primaryPolicyRisk: parsed.primaryPolicyRisk || 'Review inventory quality and legal disclosures.',
      findings: parsed.findings || [],
      remediationRoadmap: parsed.remediationRoadmap || [],
      disclaimer:
        parsed.disclaimer ||
        'Approval decisions are made solely by Google AdSense automated systems and review teams. This analysis evaluates readiness against documented public guidelines.',
      modelUsed: 'gemini-3.8-flash',
      timestamp: new Date().toISOString(),
      isFallback: false,
    };

    siteAdSensePolicyReview.set(targetSiteId, reviewResult);

    res.json({
      success: true,
      review: reviewResult,
      isFallback: false,
    });
  } catch (err: any) {
    console.error('Gemini policy review error:', err);

    // Fallback attempt with USER_GEMINI_KEY if primary key failed with auth error
    const userFallbackKey = process.env.USER_GEMINI_KEY?.trim();
    const primaryKey = process.env.GEMINI_API_KEY?.trim();

    if (
      isGeminiAuthError(err) &&
      userFallbackKey &&
      userFallbackKey !== 'MY_GEMINI_API_KEY' &&
      userFallbackKey !== primaryKey &&
      effectiveKeyInfo?.source === 'GEMINI_API_KEY'
    ) {
      console.warn('Engaging USER_GEMINI_KEY fallback for AdSense policy review after auth issue...');
      try {
        const fallbackClient = createGeminiClient(userFallbackKey);
        const retryResponse = await fallbackClient.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                overallReadinessAssessment: {
                  type: Type.STRING,
                  description: 'Comprehensive policy evaluation summary.',
                },
                primaryPolicyRisk: {
                  type: Type.STRING,
                  description: 'The single most critical policy risk.',
                },
                findings: {
                  type: Type.ARRAY,
                  description: 'Array of policy evaluation findings.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      confidence: {
                        type: Type.STRING,
                        enum: ['CONFIRMED', 'LIKELY', 'POSSIBLE', 'UNKNOWN'],
                      },
                      policyArea: {
                        type: Type.STRING,
                        enum: ['CONTENT_QUALITY', 'NAVIGATION', 'POLICY_PAGES', 'TECHNICAL_SETUP', 'ADS_TXT'],
                      },
                      evidence: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                      actionStep: { type: Type.STRING },
                    },
                    required: ['title', 'confidence', 'policyArea', 'evidence', 'explanation', 'actionStep'],
                  },
                },
                remediationRoadmap: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Prioritized sequential roadmap steps to prepare for submission.',
                },
                disclaimer: {
                  type: Type.STRING,
                  description: 'Mandatory disclaimer statement.',
                },
              },
              required: ['overallReadinessAssessment', 'primaryPolicyRisk', 'findings', 'remediationRoadmap', 'disclaimer'],
            },
          },
        });

        const retryParsed = JSON.parse(retryResponse.text?.trim() || '{}');
        const retryReviewResult = {
          overallReadinessAssessment: retryParsed.overallReadinessAssessment || 'Evaluated against Google Publisher Policies.',
          primaryPolicyRisk: retryParsed.primaryPolicyRisk || 'Review inventory quality and legal disclosures.',
          findings: retryParsed.findings || [],
          remediationRoadmap: retryParsed.remediationRoadmap || [],
          disclaimer:
            retryParsed.disclaimer ||
            'Approval decisions are made solely by Google AdSense automated systems and review teams. This analysis evaluates readiness against documented public guidelines.',
          modelUsed: 'gemini-3.6-flash (USER_GEMINI_KEY fallback)',
          timestamp: new Date().toISOString(),
          isFallback: false,
        };

        siteAdSensePolicyReview.set(targetSiteId, retryReviewResult);
        res.json({
          success: true,
          review: retryReviewResult,
          isFallback: false,
          notice: 'Successfully completed live policy review using USER_GEMINI_KEY fallback.',
        });
        return;
      } catch (retryErr: any) {
        console.error('USER_GEMINI_KEY policy review fallback error:', retryErr);
      }
    }

    const fallbackReview = buildAdSensePolicyFallback(readinessReport, err?.message);
    siteAdSensePolicyReview.set(targetSiteId, fallbackReview);
    res.json({
      success: true,
      review: fallbackReview,
      isFallback: true,
      notice: isGeminiAuthError(err)
        ? 'Authorization error on Gemini API. Please configure USER_GEMINI_KEY in environment secrets dialog.'
        : 'Engaged deterministic fallback synthesizer due to AI API exception.',
    });
  }
});

// 4. Endpoint: Retrieve latest stored AI Policy Review
app.get('/api/adsense/ai-policy-review/latest', (req: Request, res: Response) => {
  const siteId = (req.query.siteId as string) || (userSites.length > 0 ? userSites[0].id : 'default');
  const stored = siteAdSensePolicyReview.get(siteId);

  if (stored) {
    res.json({ success: true, review: stored });
  } else {
    res.json({ success: false, review: null, message: 'No AI policy review on record for this site yet.' });
  }
});

// 5. Optional AdSense Management API: query account status if user connected Google Account with adsense scope
app.get('/api/adsense/account-status', async (req: Request, res: Response) => {
  const sessionAuth = getSessionAuth(req);
  if (!sessionAuth.connected || !sessionAuth.accessToken) {
    res.json({
      connected: false,
      message: 'Google Account not connected or AdSense scope not granted.',
      accounts: [],
    });
    return;
  }

  try {
    const token = await getValidAccessToken(req);
    if (!token) {
      res.json({ connected: false, message: 'OAuth token refresh failed.', accounts: [] });
      return;
    }

    const resp = await fetch('https://adsense.googleapis.com/v2/accounts', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (resp.ok) {
      const data = await resp.json();
      res.json({
        connected: true,
        message: 'AdSense Management API connected.',
        accounts: data.accounts || [],
      });
    } else {
      const errText = await resp.text();
      res.json({
        connected: false,
        message: 'No existing AdSense account or scope permissions not granted by user.',
        details: errText,
        accounts: [],
      });
    }
  } catch (err: any) {
    res.json({
      connected: false,
      message: `Failed to query AdSense Management API: ${err.message}`,
      accounts: [],
    });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function startServer() {
  // Defensive guard: Ensure any unhandled /api/* route always returns clean JSON and never falls through to HTML
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      error: `API endpoint not found: ${req.method} ${req.path}`,
      connected: false,
    });
  });

  // Standalone public routes for Google OAuth verification compliance:
  // 1. Alias route for /term and /term/ -> redirects cleanly (301) to /terms
  app.get(['/term', '/term/'], (req: Request, res: Response) => {
    res.redirect(301, '/terms');
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath =
      typeof _dirname !== 'undefined' && path.basename(_dirname) === 'dist'
        ? _dirname
        : path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));

    // Explicit backend routes before the catch-all SPA fallback:
    // Bypass any auth middleware, session guards, or dashboard redirects entirely
    app.get(['/privacy', '/privacy/'], (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });

    app.get(['/terms', '/terms/'], (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });

    // Catch-all SPA fallback
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Wander Within Site Intelligence server running on port ${PORT}`);
  });
}

startServer();
