import { useEffect, useState } from 'react';

// October 25 is inclusive. Until Epic publishes a final match time, use the
// end of that calendar day in UTC rather than varying by the viewer's timezone.
export const SERIES_END = Date.parse('2026-10-26T00:00:00Z');
export function remainingTime(now: number) {
  const seconds = Math.max(0, Math.floor((SERIES_END - now) / 1000));
  return { days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24, minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 };
}
export default function SeriesCountdown() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const time = remainingTime(now);
  return <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-y border-white/10 px-4 py-3 text-xs">
    <span className="text-white/60">{now >= SERIES_END ? 'Fortnite Mobile Series has ended' : 'Mobile Series ends October 25'}</span>
    {now < SERIES_END && <span className="font-mono tabular-nums text-[#FCE14B]" role="timer" aria-label={`${time.days} days, ${time.hours} hours, ${time.minutes} minutes remaining`} title="Countdown to the end of October 25, 2026 (UTC)">{time.days}d {String(time.hours).padStart(2, '0')}h {String(time.minutes).padStart(2, '0')}m {String(time.seconds).padStart(2, '0')}s</span>}
  </div>;
}
