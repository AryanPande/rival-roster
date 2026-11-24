# Day 2 test results

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm test` | 15 passed | Six existing core cases, six solo decision cases across both universes, and three catalog cases |
| `npm run test:emulator` | 3 passed | Existing two-player setup, draft, reconnect and auction rules tests, plus the new and historical catalog ID case |
| `npm run generate` | Passed | 154 wrestlers, 121 comics, 29 retired wrestler cards. A separate test generated the catalog artifacts in a temporary directory and compared bytes. |
| Baseline comparison | Passed | Approved wrestler fields match the Day 1 baseline apart from wrestling Raven's two identifier fields. All 248 existing Firebase mappings are preserved. Comic JSON and Firebase rules match the baseline. |

The solo decision tests cover keeping five, giving away five, mixed decisions, automatic award order, stale action rejection, unique identities, both final roster sizes and fresh game state. Existing multiplayer tests cover consent, timer expiry, reserve allocation, bids, nomination, synchronization and reconnect. Emulator permission-denied warnings for deliberate rejection assertions are expected.

## Browser checks

- Chromium desktop at 1280 px completed wrestling with five Keep decisions.
- Chromium mobile-width touch context at 390 px completed comics with five Let Go decisions.
- Both runs loaded only the static app, with every external request blocked and a saved multiplayer room key present. Neither attempted a Firebase connection. Both displayed one current card, showed sequential automatic assignments, finished with ten unique identities across 5–5 teams, and passed comparison, clipboard, JSON export, Play Again, Home and both Raven profile checks.
- Two independent Chromium identities completed an emulator-backed wrestling auction through Multiplayer. The full active wrestler pool supplied 18 possible lots, results contained ten unique awards, the guest reloaded into the results, and the host exported JSON. The earlier sole eligible bidder countdown still behaved as in the baseline.

Browser automation used Chromium with desktop and mobile layouts. Production Firebase and physical mobile devices were outside this verification.

## Reproduce

Run `npm ci` and `npm test`. Start `npm run dev` in a second terminal, then run `npm run test:browser` with Chromium installed. Set `CHROMIUM_PATH` if the executable is outside `/usr/bin/chromium`, or set `RIVAL_BROWSER_URL` if the local static server uses a different port. Run `npm run test:emulator` with Java 21. In this managed environment the test run used writable Firebase cache and config paths and direct loopback connections.
