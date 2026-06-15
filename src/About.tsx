import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white p-8 md:p-16 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        <button
          onClick={() => navigate('/')}
          className="text-white/40 hover:text-white/80 text-sm transition-colors"
        >
          ← Back to Leaderboard
        </button>

        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-[#FCE14B]">
          About mobileseries.xyz
        </h1>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">What is mobileseries.xyz?</h2>
          <p className="text-white/70 leading-relaxed">
            mobileseries.xyz is a community-built competitive Fortnite tournament tracker and leaderboard platform. It aggregates and displays real-time standings, prize pool breakdowns, and player statistics for Fortnite Mobile competitive events — including the Venture Series, Blitz Series, and Test Cup tournaments.
          </p>
          <p className="text-white/70 leading-relaxed">
            The platform also includes an interactive Drop Map feature that allows qualified players to log in and mark their planned landing spots for upcoming heats and finals.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">Publisher</h2>
          <p className="text-white/70 leading-relaxed">
            mobileseries.xyz is developed and maintained by <strong className="text-white/90">Babylion122</strong>, an independent developer and Fortnite community organizer.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">How It Works</h2>
          <ul className="text-white/70 leading-relaxed list-disc list-inside space-y-2">
            <li>Tournament standings are pulled from publicly available APIs and updated regularly.</li>
            <li>The Drop Map uses third-party OAuth authentication to verify player identities using only their public display name and account identifier.</li>
            <li>No passwords, emails, payment info, or private data are ever accessed or stored.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">Authentication</h2>
          <p className="text-white/70 leading-relaxed">
            This application uses a third-party OAuth provider for identity verification on the Drop Map. We only request the minimum scope necessary to retrieve the player's public display name and account identifier — nothing else. Authentication tokens are handled server-side and are never exposed to the browser.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">Contact</h2>
          <p className="text-white/70 leading-relaxed">
            For questions, data removal requests, or any other inquiries, please reach out via email at{' '}
            <a href="mailto:babylionbiz@gmail.com" className="text-[#98D8C8] hover:underline">
              babylionbiz@gmail.com
            </a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">Legal</h2>
          <p className="text-white/70 leading-relaxed">
            Fortnite is a registered trademark of its respective owner. All tournament data, player names, and game assets are the property of their respective owners. This site is an independent community tool and is not produced, endorsed, supported, or affiliated with any game publisher.
          </p>
          <p className="text-white/70 leading-relaxed">
            View our full{' '}
            <a href="/pp" className="text-[#98D8C8] hover:underline">Privacy Policy</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
