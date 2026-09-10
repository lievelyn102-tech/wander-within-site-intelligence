import React from 'react';
import {
  ShieldCheck,
  Lock,
  ArrowLeft,
  ExternalLink,
  FileText,
  CheckCircle2,
  Database,
  Globe,
  Trash2,
  Printer,
} from 'lucide-react';

interface PrivacyPolicyViewProps {
  onNavigateHome: () => void;
  onNavigateTerms: () => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({
  onNavigateHome,
  onNavigateTerms,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="privacy-policy-page" className="min-h-screen bg-[#F8FAFC] text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Standalone Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onNavigateHome}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              aria-label="Back to Application"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to App</span>
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <div>
              <span className="text-xs font-bold tracking-tight text-indigo-600 uppercase leading-none">
                Wander Within
              </span>
              <span className="ml-1 text-[11px] text-slate-500 font-medium">
                Site Intelligence
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onNavigateTerms}
              className="text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              title="Print Privacy Policy"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* Document Header Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-2xs">
          <div className="flex items-center space-x-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="h-4 w-4" />
            <span>Official Policy Document</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
            This Privacy Policy explains how <strong>Wander Within Site Intelligence</strong> accesses, uses, processes, and protects your information when you connect your Google Account and inspect Blogger / Blogspot websites.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-4">
            <div>
              <span className="font-semibold text-slate-700">Application:</span> Wander Within Site Intelligence
            </div>
            <div>•</div>
            <div>
              <span className="font-semibold text-slate-700">Last Updated:</span> September 2026
            </div>
            <div>•</div>
            <div>
              <span className="font-semibold text-slate-700">Effective Date:</span> September 8, 2026
            </div>
          </div>
        </div>

        {/* Highlighted Google API Services User Data Policy Card (Mandatory Requirement) */}
        <div className="mt-6 rounded-2xl border-2 border-indigo-200 bg-indigo-50/60 p-6 sm:p-8">
          <div className="flex items-start space-x-3.5">
            <div className="rounded-xl bg-indigo-600 p-2 text-white shrink-0 mt-0.5 shadow-sm">
              <Lock className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-bold text-indigo-950">
                Google API Services User Data Policy Compliance
              </h2>
              <blockquote className="rounded-xl border-l-4 border-indigo-600 bg-white p-4 font-serif text-sm italic leading-relaxed text-slate-800 shadow-2xs">
                &ldquo;Wander Within Site Intelligence&apos;s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.&rdquo;
              </blockquote>
              <p className="text-xs text-indigo-900/80 leading-relaxed pt-1">
                For detailed information regarding Google&apos;s developer policies and user data protections, please review the official{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-0.5 font-semibold text-indigo-700 underline hover:text-indigo-900"
                >
                  <span>Google API Services User Data Policy</span>
                  <ExternalLink className="h-3 w-3 inline ml-0.5" />
                </a>.
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="mt-8 space-y-6">
          {/* Section 1: Application Identity */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Globe className="h-5 w-5 text-indigo-600" />
              <span>1. Application Identity</span>
            </h2>
            <div className="mt-3 space-y-2.5 text-sm text-slate-600 leading-relaxed">
              <p>
                <strong>Wander Within Site Intelligence</strong> (&ldquo;the Application&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is an evidence-based diagnostic and technical SEO auditing assistant specifically engineered for webmasters, content creators, and operators of Blogger / Blogspot websites (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-xs">*.blogspot.com</code> and mapped custom domains).
              </p>
              <p>
                The Application provides automated technical inspections, canonical URL validation, search performance analysis, and content taxonomy diagnostics to help webmasters identify search visibility issues without altering any blog content or settings.
              </p>
            </div>
          </section>

          {/* Section 2: Data Accessed */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Database className="h-5 w-5 text-indigo-600" />
              <span>2. Data Accessed via Google APIs</span>
            </h2>
            <div className="mt-3 space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                The Application connects to Google APIs solely upon your explicit authorization via the standard Google OAuth 2.0 consent flow. We request strictly <strong>read-only</strong> permissions:
              </p>

              <div className="space-y-3 pt-1">
                {/* Blogger API */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 text-sm">
                      Blogger API v3 (Read-Only)
                    </h3>
                    <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      https://www.googleapis.com/auth/blogger.readonly
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    <strong>Information accessed:</strong> List of your owned or authored blogs, blog identifiers, blog titles, URLs, published posts (titles, publication dates, canonical URLs, labels/tags, post content for read-time/word-count analysis), and static page summaries.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    <em>Write permissions:</em> None. The application has zero capability to create, edit, delete, or publish posts or pages.
                  </p>
                </div>

                {/* Search Console API */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 text-sm">
                      Google Search Console API (Read-Only)
                    </h3>
                    <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      https://www.googleapis.com/auth/webmasters.readonly
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    <strong>Information accessed:</strong> Verified site property list, submitted sitemap status, and aggregated 28-day organic search performance metrics (clicks, impressions, average click-through rate [CTR], and average ranking position).
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    <em>Write permissions:</em> None. The application cannot submit disavow files, modify site ownership, or alter Search Console settings.
                  </p>
                </div>

                {/* Basic Profile */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 text-sm">
                      Basic Profile & Email (OAuth 2.0 User Info)
                    </h3>
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      openid, email, profile
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    <strong>Information accessed:</strong> Google account email address, display name, and profile picture avatar, solely to display your active connected user session in the application header.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Purpose of Data Processing */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              <span>3. Purpose of Data Processing</span>
            </h2>
            <div className="mt-3 space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                The information retrieved from Google APIs is processed in real time solely to deliver the specific diagnostic features you request:
              </p>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-700 list-disc pl-5">
                <li>
                  <strong>Real-Time Technical SEO Auditing:</strong> Inspecting HTTP status codes, mobile parameter redirects (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-xs">?m=1</code>), canonical tag consistency, robots meta directives, and heading hierarchy.
                </li>
                <li>
                  <strong>Sitemap Inspection:</strong> Verifying whether sitemap feeds (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-xs">/sitemap.xml</code> and <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-xs">/atom.xml?redirect=false&amp;start-index=1&amp;max-results=500</code>) are detected and reachable.
                </li>
                <li>
                  <strong>Content Taxonomy Diagnostics:</strong> Calculating word count, identifying keyword cannibalization risks, uncovering duplicate title tags, and evaluating internal navigation integrity.
                </li>
                <li>
                  <strong>AdSense Readiness Assessment:</strong> Providing a deterministic preliminary policy checklist regarding content substance and privacy baseline readiness before AdSense submission.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4: Storage, Retention & Security */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Lock className="h-5 w-5 text-indigo-600" />
              <span>4. Storage, Retention &amp; Non-Disclosure</span>
            </h2>
            <div className="mt-3 space-y-3 text-sm text-slate-600 leading-relaxed">
              <p className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs sm:text-sm font-medium text-emerald-950 leading-relaxed">
                <strong>Storage &amp; Retention Guarantee:</strong> Authentication tokens are stored in secure, encrypted session cookies and destroyed upon sign-out. No Google user data or credentials are permanently saved, sold, or shared with third parties.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-center space-x-2 text-emerald-800 font-semibold text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Encrypted Session Tokens</span>
                  </div>
                  <p className="mt-1.5 text-xs text-emerald-950/80 leading-relaxed">
                    Authentication tokens are held in secure, encrypted session storage. Tokens are never exposed to browser client-side storage (such as unencrypted local storage).
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-center space-x-2 text-emerald-800 font-semibold text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Immediate Destruction on Sign-Out</span>
                  </div>
                  <p className="mt-1.5 text-xs text-emerald-950/80 leading-relaxed">
                    When you click &ldquo;Disconnect&rdquo; or &ldquo;Clear Session&rdquo;, all active access and refresh tokens are destroyed immediately on the server.
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-center space-x-2 text-emerald-800 font-semibold text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>No Permanent Data Storage</span>
                  </div>
                  <p className="mt-1.5 text-xs text-emerald-950/80 leading-relaxed">
                    No Google user data, post content, Search Console statistics, or credentials are permanently saved in any external database.
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-center space-x-2 text-emerald-800 font-semibold text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Never Sold or Shared</span>
                  </div>
                  <p className="mt-1.5 text-xs text-emerald-950/80 leading-relaxed">
                    We never sell, rent, monetize, or transfer your Google user data or credentials to third parties, advertisers, or data brokers.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Limited Use Requirements */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <span>5. Limited Use Requirements Disclosure</span>
            </h2>
            <div className="mt-3 space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                Wander Within Site Intelligence affirms strict compliance with the Google API Services User Data Policy:
              </p>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-700 list-disc pl-5">
                <li>
                  <strong>User-Facing Feature Constraint:</strong> We only request access to Google API data that is necessary to implement the user-facing technical SEO diagnostic features described in this policy.
                </li>
                <li>
                  <strong>No Data Transfer:</strong> We do not transfer, distribute, or make available your Google data to third parties, unless necessary to provide or improve these user-facing features, comply with applicable law, or as part of a merger or acquisition with explicit notice.
                </li>
                <li>
                  <strong>No Advertising:</strong> We do not use or transfer Google user data for serving ads, including retargeting, personalized, or interest-based advertising.
                </li>
                <li>
                  <strong>No Model Training:</strong> We do not use Google user data to train, retrain, or improve generalized machine learning or artificial intelligence models outside your specific diagnostic session.
                </li>
                <li>
                  <strong>No Human Oversight of Sensitive Data:</strong> No human is permitted to read user data obtained from Google APIs unless you have provided affirmative agreement for troubleshooting specific errors, it is necessary for security purposes, or to comply with law.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 6: User Rights & Revocation */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Trash2 className="h-5 w-5 text-indigo-600" />
              <span>6. User Rights, Session Revocation & Data Deletion</span>
            </h2>
            <div className="mt-3 space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                You retain complete, continuous control over your Google Account authorization and can revoke access at any time through two easy methods:
              </p>
              <div className="space-y-2 pt-1">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:text-sm">
                  <p className="font-semibold text-slate-900">Method 1: In-App One-Click Disconnect</p>
                  <p className="mt-1 text-slate-600">
                    Open <strong>Settings</strong> in the application and click <strong>&ldquo;Disconnect Google Account&rdquo;</strong> or <strong>&ldquo;Clear Session Cache&rdquo;</strong>. This immediately purges the active session tokens.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:text-sm">
                  <p className="font-semibold text-slate-900">Method 2: Google Account Security Permissions</p>
                  <p className="mt-1 text-slate-600">
                    Visit your Google Account&apos;s Third-Party Apps permission page at{' '}
                    <a
                      href="https://myaccount.google.com/permissions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-indigo-600 underline hover:text-indigo-800"
                    >
                      https://myaccount.google.com/permissions
                    </a>{' '}
                    and select <strong>Wander Within Site Intelligence</strong> &gt; <strong>Remove Access</strong>.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 7: Contact Information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900">
              7. Contact Information
            </h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600 leading-relaxed">
              <p>
                If you have questions, inquiries, or privacy concerns regarding this Privacy Policy or our data practices, please reach out to our privacy team:
              </p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:text-sm space-y-1">
                <p><strong>Application:</strong> Wander Within Site Intelligence</p>
                <p><strong>Developer / Support Email:</strong>{' '}
                  <a href="mailto:lievelyn102@gmail.com" className="text-indigo-600 underline hover:text-indigo-800 font-medium">
                    lievelyn102@gmail.com
                  </a>
                </p>
                <p><strong>Primary Domain:</strong> Blogger / Blogspot Site Intelligence Suite</p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <footer className="mt-12 border-t border-slate-200 pt-8 pb-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} Wander Within Site Intelligence. All rights reserved.
          </div>
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={onNavigateTerms}
              className="text-slate-600 hover:text-indigo-600 hover:underline transition-colors"
            >
              Terms of Service
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={onNavigateHome}
              className="text-slate-600 hover:text-indigo-600 hover:underline transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
};
