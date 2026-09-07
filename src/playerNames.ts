// Confirmed renames supplied by the site owner. Keep old names for matching
// historical drops and Epic's published seeding, which may still use them.
export function currentPlayerName(name: string): string {
  if (!name) return '';
  const lower = name.trim().toLowerCase();
  if (lower === 'mtrx dogeee') return '不组队就赢了不的猴子们';
  if (lower === 'amp x misty' || lower === 'hylnd amp') return 'hylnd amp';
  if (lower === 'law mohanad' || lower === 'spk mohanad') return 'spk mohanad';
  const v = lower.replaceAll('çƒ', 'ǃ').replaceAll('!', 'ǃ');
  if (v === 'vediana 19ǃ' || lower === 'hylnd sc vediana') return 'HYLND SC VEDIANA';
  const cleanedKeyxity = lower.replace(/[.ǃ!]/g, '').trim();
  if (cleanedKeyxity === 'mtb keyxity' || lower === '不组队就不了的猴子们') return '不组队就不了的猴子们';
  return name;
}
