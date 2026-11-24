# Single-player implementation

Day 1 findings informed the catalog migration and multiplayer regression checks. The Day 2 branch adds playable wrestling and comics drafts while preserving the multiplayer room flow.

## Play

Choose **Single Player** on the home screen, then **Start wrestling draft** or **Start comics draft**. The app shuffles the chosen universe, selects ten distinct identities, and shows one card at a time. Keep gives the card to your team. Let Go gives it to the passive opponent. When one roster fills, the app reveals and assigns the remaining cards individually. Manual selections have no time limit. Open a revealed card or a roster entry to see the existing profile and ratings.

Both rosters display open slots and the current draft displays reveal progress. Results show both rosters, the existing balanced comparison and suggested matchups. Play Again starts a fresh draft in the same universe. Copy Teams uses the existing clipboard fallback. JSON Export includes the universe, full roster records, ordered assignments with automatic flags, and the comparison metrics.

## Implementation

- `js/solo.js` handles pool selection and assignment. It reuses the identity-aware shuffle in `js/characters.js` and guards against stale reveal actions and roster overflow.
- `js/solo-view.js` builds the mode picker, active draft and final results from existing UI components.
- `js/app.js`, `js/views.js` and `index.html` integrate home navigation, solo rendering, profiles, results and export. Multiplayer still offers existing room actions, and an invite URL still opens the multiplayer room flow. Selecting Multiplayer restores a saved room from the home screen.
- The existing responsive grid and profile dialog are reused. Firebase SDK connections remain specific to multiplayer. Solo uses static assets and page memory, so a full reload ends an in-progress solo draft.
- `tools/catalog.mjs` and the authored data reconcile active and historical character records. See [Catalog reconciliation](CATALOG_RECONCILIATION.md).

## Preview and release

Run `npm run dev` and open the displayed address on the same computer. Choose Single Player. The reviewed build was also opened in shared Chrome in the Codex environment. Solo requires no Firebase setup.

This branch is ready for review. Production release is gated on the read-only catalog verification and any required approved additive update described in the catalog report. Existing multiplayer game rules and auction behavior continue as before. Comics solo implements drafting only. Attack & Defend requires finalized rules.
