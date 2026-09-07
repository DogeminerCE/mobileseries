# Mobile Series

`npm ci` then `npm run dev` starts the site at http://localhost:3000.
`npm test`, `npm run lint`, and `npm run build` validate the maintained app and scripts.
Epic sign-in requires `EPIC_CLIENT_ID`, `EPIC_CLIENT_SECRET`, and `FIREBASE_SERVICE_ACCOUNT` in the server environment (or local `.env`). Existing production values can be reused.

## Group Stage

`src/data/group-stage.json` contains Epic's official two-group roster per region and the top 12 from the completed September 6, 2026 LCQ **Round 2**. Previous inferred qualifier roll-downs do not grant map access. LCQ identity uses Epic account IDs, including after display-name changes. Official seeding is name-based because Epic's page does not publish account IDs. Unicode is preserved; only whitespace and two known encoding errors in Epic's page are normalized.

Run `npm run sync:groups` to refresh the roster. The scheduled workflow also runs it. Failed or incomplete responses retain the last verified data; Epic sometimes returns HTTP 403 to automation, in which case update the official groups in the snapshot from https://www.fortnite.com/competitive/mobile-series-groups-seeding and redeploy. Do not guess identities for duplicate names. The September 7 snapshot lists RXB zigtra in both NA-West groups; existing unassigned marks for that name are not automatically assigned to either one.

Maps are `Group Stage 1`, `Group Stage 2`, and `Group Stage LCQ`. Updating a player's official assignment automatically routes pending LCQ marks to that group. A saved destination mark wins over historical marks; otherwise the newest matching mark is used. Renamed LCQ accounts are deduplicated by their roster identity. Unqualified marks remain archived and are excluded from group maps.

`npm run migrate:drops` previews the live Firestore migration. Add `-- --apply` to copy eligible marks into their destination maps while retaining the original records for the old site. It saves a local backup and preserves shapes, account ownership and timestamps. Authenticate with Firebase CLI and run `firebase projects:list` first, or supply `GOOGLE_OAUTH_ACCESS_TOKEN`. Repeating the migration skips already-migrated player maps.

On September 7, 2026, 152 destination documents were created from 1,175 original records. These resolve to 132 distinct player/region maps after deduplicating historical LCQ names. The original records were preserved. A verification run reported zero pending moves.

## Release

Deploy the website and `api/epic-auth.ts` together through the existing Vercel deployment. Then run:

```sh
npx firebase-tools deploy --only firestore:rules --project mobileseriesxyz
```

The rules use the `group_maps` claim issued by the updated sign-in endpoint. Deploying them before that endpoint would prevent existing users from placing marks. Players signed in before this release, or before a later group reassignment, should sign out and back in to refresh access. The rules were successfully compiled with Firebase's deployment dry run; they have not yet been released.

The countdown ends at the end of October 25, 2026 in UTC (`2026-10-26T00:00:00Z`). This treats the supplied end date as inclusive; adjust `SERIES_END` when an exact final-match time is available.
