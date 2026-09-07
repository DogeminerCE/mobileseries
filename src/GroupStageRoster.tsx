import { Link } from 'react-router-dom';
import { GROUP_SESSIONS, sessionPlayers } from './groupStage';

export default function GroupStageRoster({ region }: { region: string }) {
  return <div className="border border-white/10 bg-[#141416]/50 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <h3 className="text-lg font-bold text-[#FCE14B]">Group Stage · {region}</h3>
      <a className="text-xs text-white/60 underline hover:text-white" href="https://www.fortnite.com/competitive/mobile-series-groups-seeding" target="_blank" rel="noreferrer">Epic’s seeding list</a>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {GROUP_SESSIONS.map(session => <section key={session.key} className={session.key.endsWith('LCQ') ? 'sm:col-span-2' : ''}>
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2 mb-2">
          <h4 className="text-sm font-bold">{session.label}</h4>
          <Link className="text-xs text-[#FCE14B] hover:underline" to={`/drop-map?region=${encodeURIComponent(region)}&session=${encodeURIComponent(session.key)}`}>View map</Link>
        </div>
        {session.key.endsWith('LCQ') && <p className="text-xs text-white/50 mb-3">Top 12 from the LCQ final. Drops move when group assignments are published.</p>}
        <ol className={session.key.endsWith('LCQ') ? 'grid sm:grid-cols-2 gap-x-5' : ''}>
          {sessionPlayers(region, session.key).map(player => <li key={player.player} className="py-2 text-sm border-b border-white/5 break-words">{player.player}</li>)}
        </ol>
        {sessionPlayers(region, session.key).length === 0 && <p className="text-sm text-white/50 py-3">No players awaiting assignment.</p>}
      </section>)}
    </div>
  </div>;
}
