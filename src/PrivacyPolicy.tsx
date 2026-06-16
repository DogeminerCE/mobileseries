import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white p-8 md:p-16 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => navigate('/')}
          className="text-white/40 hover:text-white/80 text-sm transition-colors"
        >
          ← Back to Leaderboard
        </button>

        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-[#FCE14B] mb-2">
          Privacy Policy
        </h1>

        <p className="text-sm text-white/50">
          Effective Date: June 15, 2026 &nbsp;|&nbsp; Last Updated: June 15, 2026
        </p>

        <p className="text-white/70 leading-relaxed">
          This Privacy Policy describes how mobileseries.xyz ("we", "us", "our"), operated by Babylion122, collects, uses, shares, and retains your personal information when you use our website and services.
        </p>

        {/* ── 1. Data Capture ──────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">1. How We Capture Your Data</h2>
          <p className="text-white/70 leading-relaxed">
            We collect personal information in the following ways:
          </p>
          <ul className="text-white/70 leading-relaxed list-disc list-inside space-y-2 pl-2">
            <li>
              <strong className="text-white/90">Account Authentication:</strong> When you choose to log in using a third-party OAuth provider, you are redirected to that provider's login page. Upon successful authentication, we receive your <strong className="text-white/80">public display name</strong> and <strong className="text-white/80">account identifier</strong>. We do not receive or store your password, email address, payment information, or any other private account details.
            </li>
            <li>
              <strong className="text-white/90">Drop Map Interactions:</strong> When you place a drop spot on the interactive map, we capture the coordinates and polygon shape of the area you draw, along with the color you selected. This data is associated with your account identifier.
            </li>
            <li>
              <strong className="text-white/90">Automatic Data:</strong> We do not use cookies for tracking purposes. We do not collect IP addresses, browser fingerprints, or any analytics data. No third-party analytics or advertising scripts are loaded on our site.
            </li>
          </ul>
        </section>

        {/* ── 2. Data Usage ────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">2. How We Use Your Data</h2>
          <p className="text-white/70 leading-relaxed">
            The personal information we collect is used strictly for the following purposes:
          </p>
          <ul className="text-white/70 leading-relaxed list-disc list-inside space-y-2 pl-2">
            <li>
              <strong className="text-white/90">Identity Verification:</strong> Your display name and account identifier are used to verify that you are a qualified player and to prevent impersonation on the interactive drop map.
            </li>
            <li>
              <strong className="text-white/90">Drop Map Functionality:</strong> Your display name is shown on the map next to the drop area you have placed, so other players can see where each participant plans to land.
            </li>
            <li>
              <strong className="text-white/90">Session Management:</strong> Authentication tokens are used server-side to maintain your login session. These tokens are temporary and expire automatically.
            </li>
          </ul>
          <p className="text-white/70 leading-relaxed">
            We do not use your data for marketing, advertising, profiling, or any purpose other than those listed above.
          </p>
        </section>

        {/* ── 3. Data Sharing ──────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">3. How We Share Your Data</h2>
          <p className="text-white/70 leading-relaxed">
            <strong className="text-white/90">We do not sell, trade, rent, or otherwise share your personal information with any third parties.</strong>
          </p>
          <p className="text-white/70 leading-relaxed">
            The only information that is publicly visible to other users of mobileseries.xyz is your <strong className="text-white/80">display name</strong> and the <strong className="text-white/80">drop area you place</strong> on the interactive map. Your account identifier is never publicly displayed.
          </p>
          <p className="text-white/70 leading-relaxed">
            We use Firebase (provided by Google) as our database hosting provider. Your data is stored on their servers under industry-standard security protections. Firebase acts solely as a data processor on our behalf and does not use your data for any independent purpose.
          </p>
        </section>

        {/* ── 4. Data Retention ────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">4. How We Retain Your Data</h2>
          <p className="text-white/70 leading-relaxed">
            Your personal data is retained as follows:
          </p>
          <ul className="text-white/70 leading-relaxed list-disc list-inside space-y-2 pl-2">
            <li>
              <strong className="text-white/90">Account Information:</strong> Your display name and account identifier are retained for as long as you have an active drop spot on the map. If you remove your drop spot, the associated data is deleted immediately from our database.
            </li>
            <li>
              <strong className="text-white/90">Authentication Tokens:</strong> Login session tokens are temporary and expire automatically. They are not stored permanently.
            </li>
            <li>
              <strong className="text-white/90">Drop Map Data:</strong> Your drop spot coordinates and polygon shape are retained for the duration of the active tournament season. At the end of each season, all drop map data is cleared.
            </li>
          </ul>
        </section>

        {/* ── 5. Data Deletion ─────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">5. Your Rights &amp; Data Deletion</h2>
          <p className="text-white/70 leading-relaxed">
            You have the right to request the deletion of all personal data associated with your account at any time. You can do this by:
          </p>
          <ul className="text-white/70 leading-relaxed list-disc list-inside space-y-2 pl-2">
            <li>Removing your drop spot directly from the interactive map (this deletes your data immediately).</li>
            <li>Contacting us at <a href="mailto:babylionbiz@gmail.com" className="text-[#98D8C8] hover:underline">babylionbiz@gmail.com</a> to request full account data deletion. We will process your request within 30 days.</li>
          </ul>
        </section>

        {/* ── 6. Security ──────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">6. Data Security</h2>
          <p className="text-white/70 leading-relaxed">
            We implement industry-standard security measures to protect your personal information, including encrypted data transmission (HTTPS), secure server-side token handling, and access-controlled database storage. While no method of transmission over the Internet is 100% secure, we take reasonable precautions to safeguard your data.
          </p>
        </section>

        {/* ── 7. Children ──────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">7. Children's Privacy</h2>
          <p className="text-white/70 leading-relaxed">
            mobileseries.xyz does not knowingly collect personal information from children under 13 years of age. If you believe a child under 13 has provided us with personal information, please contact us immediately and we will take steps to delete such information.
          </p>
        </section>

        {/* ── 8. Changes ───────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">8. Changes to This Policy</h2>
          <p className="text-white/70 leading-relaxed">
            We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. Your continued use of mobileseries.xyz after any modifications constitutes your acceptance of the revised policy.
          </p>
        </section>

        {/* ── 9. Contact ───────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">9. Contact Us</h2>
          <p className="text-white/70 leading-relaxed">
            If you have any questions about this Privacy Policy, wish to exercise your data rights, or have any other inquiries, please contact us at:
          </p>
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <p className="text-white/80"><strong>Babylion122</strong></p>
            <p className="text-white/70">Email: <a href="mailto:babylionbiz@gmail.com" className="text-[#98D8C8] hover:underline">babylionbiz@gmail.com</a></p>
            <p className="text-white/70">Website: <a href="https://mobileseries.xyz" className="text-[#98D8C8] hover:underline">mobileseries.xyz</a></p>
          </div>
        </section>
      </div>
    </div>
  );
}
