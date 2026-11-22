# Rival Roster

A private two-player browser game. Draft wrestlers and comic characters, build a roster through live auctions in fictional credits, and compare teams for a debate. The static app uses vanilla JavaScript and GitHub Pages. Firebase Authentication and Realtime Database run on the free Spark plan for personal use.

**Start with [SETUP.md](SETUP.md)** for the Firebase Console, GitHub Pages, and two-device walkthrough. For a credential-free local run, see the emulator instructions in the same guide.

## How to play

- **Blind Draft** reveals one character each turn. Recruit them or assign them to the opponent. After a roster fills, the game allocates all remaining cards to the other roster.
- **Alternating Picks** presents a visible pool. The host can select straight or snake order and add a pick timer. A timed-out turn uses the first available card in pool order.
- **Live Auction** starts at ₹100 per player by default. A pass applies for the rest of the lot. A player who passes while leading can still win for their last bid. A bid must leave the bidder enough credits to fill every other slot at the opening price. Unsold lots leave the pool. If a nominated-style player times out, the first available character is nominated. When the number of lots left equals the number of open slots, the reserve rules allocate the remaining cards in alternating order at the opening price, skipping full teams.
- **Discussion** compares weighted averages. The balanced stipulation applies until both players save the same preference. Each player can nominate a captain, log preferred matchups, write an argument, vote, and conclude the debate. The vote has no effect on the ratings.
- Both players must approve an undo or reset. Undo targets the latest eligible move and restarts an active timer on restoration. The host can start a rematch after completion or an agreed reset. Team colors can be swapped during rematch setup.

Character ratings are subjective play values, initialized from playstyle profiles with small deterministic variation. The comparison uses explicit averages and published stipulation weights. Mixed categories line up analogous game ratings across universes. Names identify fan-game subjects and belong to their applicable rights holders. The game uses stylized initials and original generic arena artwork.

## Architecture

- `rooms/{code}` contains one host seat, an atomic write-once guest seat bound to an anonymous Auth UID, a proposed configuration, session presence, and numbered matches.
- Each match has a locked configuration, an indexed pool validated against the seeded catalog, a reverse identity map, a revision log, and separate discussion entries. Standard games accept only one variant per identity. When multiple versions are allowed, each distinct variant can still enter the pool only once.
- Match creation is atomic. Each event commits through a transaction on the next revision. Firebase Rules require the immediately previous revision, validate the action and every derived state field, reject writes to existing events, and enforce room membership. Rosters and history are projections of the validated log. Room codes are invitations. After the guest seat has been claimed, knowing the code gives a third anonymous UID no room access.
- `js/engine.js` describes actions and their state transformations. `tools/rules.mjs` compiles the same definitions into the checked-in Firebase Rules. Firebase checks deadlines with its own `now`. Candidate event timestamps are bounded against that clock and determine the displayed timer, with up to two seconds of timestamp tolerance. Either connected player can trigger settlement after the database allows it. If both browsers close, the lot settles once somebody reconnects. There is no continuously running server process.
- The standard frontend uses cryptographic shuffle and builds its pool from lobby filters. Firebase enforces catalog membership, valid pool size and identity uniqueness. Because the host prepares the pool and both clients can read it, a player inspecting database traffic can preview reveals and a modified host client can choose the ordering or bypass lobby filters. Blind Draft conceals future reveals during ordinary play. The app is intended for a private game between people who trust each other on setup and reveal order.
- Rooms persist until an administrator deletes them. Anonymous player identity lives in browser storage. Use the same browser profile for reconnection. Clearing storage or moving to a different browser creates a new identity. A six-digit invitation can be guessed before the guest seat is claimed, so send invites privately. The Spark plan has normal service quotas and no billing is enabled by this project.

## Development

```bash
npm ci
npm run generate
npm test
npm run test:emulator
```

Run `generate` after editing catalog source in `tools/wrestlers.txt`, `tools/comics.txt`, or changing engine rules. Commit the generated files under `data/` and `firebase/`. When adding characters to a deployed project, import the refreshed `firebase/catalog.seed.json` at the **catalog** node. Keep old IDs to preserve prior matches. Catalog imports must be performed by a Firebase administrator.

The project contains 120 distinct wrestler identities and 118 distinct comic identities. Including versions, there are 248 playable cards.
