const fs = require('fs');
let code = fs.readFileSync('scripts/aggregate.ts', 'utf8');

const retryLogic = `
async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    const data = await res.json();
    if (data.success || data.errorCode !== 'RATELIMITED') return data;
    console.log(\`[WARN] Rate limited on \${url}, retrying in 5s...\`);
    await new Promise(r => setTimeout(r, 5000));
  }
  return { success: false, entries: [] };
}
`;

code = code.replace("const SERIES_PRIZE_TABLES:", retryLogic + "\nconst SERIES_PRIZE_TABLES:");
code = code.replace(/await fetch\([^)]+\)\.then\([^)]+\)/g, "await fetchWithRetry");
// Replace specific fetches:
code = code.replace(/const tourneyResp = await fetch\(tourneyUrl\);\s*const tourneyData = await tourneyResp\.json\(\);/g, "const tourneyData = await fetchWithRetry(tourneyUrl);");
code = code.replace(/const lbResp = await fetch\(lbUrl\);\s*const lbData = await lbResp\.json\(\);/g, "const lbData = await fetchWithRetry(lbUrl);");

fs.writeFileSync('scripts/aggregate.ts', code);
