// Confirmed rename supplied by the site owner. Keep the old name for matching
// historical drops and Epic's published seeding, which may still use it.
export function currentPlayerName(name: string): string {
  if (!name) return '';
  return name.trim().toLowerCase() === 'mtrx dogeee' ? '不组队就赢了不的猴子们' : name;
}
