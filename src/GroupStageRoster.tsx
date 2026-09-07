import { Link } from 'react-router-dom';
import { GROUP_SESSIONS, sessionPlayers } from './groupStage';

export default function GroupStageRoster({ region }: { region: string }) {
  return (
    <div className="border border-white/10 bg-[#141416]/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h3 className="text-lg font-bold text-[#FCE14B]">Group Stage · {region}</h3>
        <a
          className="text-xs text-white/60 underline hover:text-white"
          href="https://www.fortnite.com/competitive/mobile-series-groups-seeding"
          target="_blank"
          rel="noreferrer"
        >
          Epic’s seeding list
        </a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {GROUP_SESSIONS.map(session => {
          const players = sessionPlayers(region, session.key);
          return (
            <section key={session.key}>
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold">{session.label}</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-mono">
                    {players.length} Players
                  </span>
                </div>
                <Link
                  className="text-xs text-[#FCE14B] hover:underline flex items-center gap-1 font-bold"
                  to={`/drop-map?region=${encodeURIComponent(region)}&session=${encodeURIComponent(session.key)}`}
                >
                  View map →
                </Link>
              </div>
              <ol className="divide-y divide-white/5">
                {players.map((player, idx) => (
                  <li key={player.player} className="py-1.5 text-sm flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-white/30 font-mono text-xs w-5 flex-shrink-0 text-right">
                        {idx + 1}.
                      </span>
                      <span className="truncate font-medium text-white/90">{player.player}</span>
                    </div>
                    {player.accountId && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FCE14B]/10 text-[#FCE14B] font-mono flex-shrink-0 font-bold uppercase">
                        LCQ
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              {players.length === 0 && (
                <p className="text-sm text-white/50 py-3">No players assigned.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
