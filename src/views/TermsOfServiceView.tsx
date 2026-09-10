import React from 'react';
import {
  FileText,
  ShieldCheck,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Printer,
} from 'lucide-react';

interface TermsOfServiceViewProps {
  onNavigateHome: () => void;
  onNavigatePrivacy: () => void;
}

export const TermsOfServiceView: React.FC<TermsOfServiceViewProps> = ({
  onNavigateHome,
  onNavigatePrivacy,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="terms-of-service-page" className="min-h-screen bg-[#F8FAFC] text-slate-800 antialiased selection:bg-indigo-100 selection:text-indigo-900">
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
              onClick={onNavigatePrivacy}
              className="text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center space-x-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              title="Print Terms of Service"
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
            <FileText className="h-4 w-4" />
            <span>Legal Agreement</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
            These Terms of Service govern your access to and use of <strong>Wander Within Site Intelligence</strong>, including all technical SEO auditing, sitemap inspection, and content taxonomy diagnostic tools.
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

        {/* Read-Only & Non-Destructive Warranty Highlight Box */}
        <div className="mt-6 rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-6 sm:p-8">
          <div className="flex items-start space-x-3.5">
            <div className="rounded-xl bg-emerald-600 p-2 text-white shrink-0 mt-0.5 shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-bold text-emerald-950">
                Core Guarantee: Strict Read-Only &amp; Non-Destructive Architecture
              </h2>
              <p className="text-sm leading-relaxed text-emerald-900">
                <strong>Wander Within Site Intelligence operates exclusively in read-only mode.</strong> Under no circumstances does the application make write requests, modify your Blogger blog settings, alter post HTML, change XML themes/templates, overwrite robots.txt files, or alter Google Search Console properties. Your websites, content, and search configurations remain 100% untouched.
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="mt-8 space-y-6">
          {/* Section 1: Acceptance */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">1</span>
              <span>Acceptance of Terms</span>
            </h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600 leading-relaxed">
              <p>
                By accessing, browsing, or utilizing the Wander Within Site Intelligence software suite (collectively, the &ldquo;Service&rdquo;), you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service and our accompanying Privacy Policy. If you do not agree to these terms, please do not use the Service.
              </p>
            </div>
          </section>

          {/* Section 2: Use of Service */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">2</span>
              <span>Use of Service</span>
            </h2>
            <div className="mt-3 space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                <strong>Diagnostic and analytical utility provided for website audits:</strong> Wander Within Site Intelligence is designed solely to evaluate, analyze, and diagnose technical SEO configurations, sitemaps, canonical tags, heading hierarchies, content depth, keyword cannibalization, and AdSense readiness indicators for Blogger / Blogspot websites (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-xs">*.blogspot.com</code> and custom mapped domains).
              </p>
              <p>
                As a user, you agree that:
              </p>
              <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700 list-disc pl-5">
                <li>You will only connect or inspect websites and Google Search Console properties that you own or for which you have received express authorization to perform diagnostic audits.</li>
                <li>You will not use the Service for any unlawful purpose or in violation of any applicable local, state, national, or international regulations.</li>
                <li>You will not attempt to reverse-engineer, decompile, or bypass security rate limits or session protections implemented by the Service.</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Read-Only Disclaimer */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">3</span>
              <span>Diagnostic Disclaimer &amp; Non-Destructive Nature</span>
            </h2>
            <div className="mt-3 space-y-3 text-sm text-slate-600 leading-relaxed">
              <p>
                <strong>Analysis is read-only and non-destructive:</strong> All evaluations, audits, confidence ratings (Confirmed, Likely, Possible, Unknown), and AdSense readiness assessments generated by Wander Within Site Intelligence are advisory and informational in nature.
              </p>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs sm:text-sm text-amber-900 space-y-1.5">
                <div className="flex items-center space-x-2 font-semibold">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Important Diagnostic Notice</span>
                </div>
                <p className="leading-relaxed">
                  The Service does not execute automated changes on your behalf. Any decisions made to alter template code, update post content, modify canonical tags, adjust robots.txt directives, or submit properties to search engines or monetization programs remain the sole discretion, choice, and responsibility of the webmaster.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: No Search Engine or AdSense Guarantee */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">4</span>
              <span>No Guarantee of Search Rankings or AdSense Approval</span>
            </h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600 leading-relaxed">
              <p>
                Search engines (including Google Search) utilize proprietary, frequently updated algorithms. Wander Within Site Intelligence does not represent or warrant that implementing suggested diagnostic recommendations will result in indexed status, specific search ranking positions, traffic increases, or approval into the Google AdSense program.
              </p>
            </div>
          </section>

          {/* Section 5: Intellectual Property & Trademarks */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">5</span>
              <span>Intellectual Property &amp; Trademarks</span>
            </h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600 leading-relaxed">
              <p>
                Wander Within Site Intelligence is an independent technical audit utility. Blogger, Google Search Console, Google AdSense, and Google are registered trademarks of Google LLC. Reference to these trademarks does not imply any affiliation with, endorsement by, or sponsorship from Google LLC.
              </p>
              <p>
                All original software code, UI designs, and analytical logic comprising the Service are the intellectual property of the application creators.
              </p>
            </div>
          </section>

          {/* Section 6: Limitation of Liability */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">6</span>
              <span>Disclaimer of Warranties &amp; Limitation of Liability</span>
            </h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600 leading-relaxed">
              <p>
                THE SERVICE IS PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY, AND NON-INFRINGEMENT.
              </p>
              <p>
                IN NO EVENT SHALL WANDER WITHIN SITE INTELLIGENCE OR ITS CONTRIBUTORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.
              </p>
            </div>
          </section>

          {/* Section 7: Termination */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">7</span>
              <span>Termination &amp; Revocation</span>
            </h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600 leading-relaxed">
              <p>
                You may terminate your relationship with the Service at any time by disconnecting your Google Account in the Settings view or by revoking permissions in your Google Account security center.
              </p>
            </div>
          </section>

          {/* Section 8: Contact */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs">
            <h2 className="text-lg font-bold text-slate-900">
              8. Contact Information
            </h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600 leading-relaxed">
              <p>
                For questions regarding these Terms of Service, please contact:
              </p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:text-sm space-y-1">
                <p><strong>Application:</strong> Wander Within Site Intelligence</p>
                <p><strong>Email:</strong>{' '}
                  <a href="mailto:lievelyn102@gmail.com" className="text-indigo-600 underline hover:text-indigo-800 font-medium">
                    lievelyn102@gmail.com
                  </a>
                </p>
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
              onClick={onNavigatePrivacy}
              className="text-slate-600 hover:text-indigo-600 hover:underline transition-colors"
            >
              Privacy Policy
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
