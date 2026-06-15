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
          About Mobile Series
        </h1>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">What is Mobile Series?</h2>
          <p className="text-white/70 leading-relaxed">
            Mobile Series is a community-built competitive Fortnite tournament tracker and leaderboard platform. It aggregates and displays real-time standings, prize pool breakdowns, and player statistics for official Fortnite Mobile competitive events — including the Venture Series, Blitz Series, and Test Cup tournaments.
          </p>
          <p className="text-white/70 leading-relaxed">
            The platform also includes an interactive Drop Map feature that allows qualified players to log in with their Epic Games account and mark their planned landing spots for upcoming heats and finals.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">Publisher</h2>
          <p className="text-white/70 leading-relaxed">
            Mobile Series is developed and maintained by <strong className="text-white/90">BabyLion</strong>, an independent developer and Fortnite community organizer. This is a fan-made community project and is not affiliated with, endorsed by, or sponsored by Epic Games, Inc.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">How It Works</h2>
          <ul className="text-white/70 leading-relaxed list-disc list-inside space-y-2">
            <li>Tournament standings are pulled from the Osirion API and updated every 30 minutes.</li>
            <li>The Drop Map uses Epic Games OAuth to verify player identities with the <code className="text-[#98D8C8] bg-white/5 px-1.5 py-0.5 rounded text-xs">basic_profile</code> scope only (Account ID and Display Name).</li>
            <li>No passwords, emails, payment info, or private data are ever accessed or stored.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-white/90">Epic Games Integration</h2>
          <p className="text-white/70 leading-relaxed">
            This application uses the Epic Games "Sign In with Epic" feature exclusively for identity verification on the Drop Map. When a player clicks "Login with Epic," they are redirected to Epic Games' official OAuth page. We only request the <code className="text-[#98D8C8] bg-white/5 px-1.5 py-0.5 rounded text-xs">basic_profile</code> scope, which grants us access to the player's public Display Name and Account ID — nothing else. Authentication tokens are handled server-side and are never exposed to the browser.
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
            Fortnite is a registered trademark of Epic Games, Inc. All tournament data, player names, and game assets are the property of their respective owners. This site is an independent community tool and is not produced, endorsed, supported, or affiliated with Epic Games.
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
