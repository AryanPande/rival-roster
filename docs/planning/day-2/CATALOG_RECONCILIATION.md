# Catalog reconciliation

## Sources and artifacts

| Catalog | Cards | Identity and eligibility |
| --- | ---: | --- |
| Active wrestlers | 154 | 154 identities, all Standard |
| Active comics | 121 | 118 identities with three existing variants |
| Historical wrestler archive | 29 | Historical rendering and Firebase compatibility |
| Combined Firebase catalog | 304 | Unique keys covering active and historical cards |

`tools/wrestlers.json` replaces the old pipe-delimited wrestler input. It stores the approved 154 records in full, including ratings, descriptions and stable IDs. The only change to the approved data is wrestling Raven's `id` and `identity`, now `wrestler-raven`. Comic Raven keeps `raven`. The comic generator and three comic variants produce the same output as before. Wrestling generation emits zero active alternate versions.

The separately authored retired catalog uses the prior published record for each removed card. The generated `data/retired-wrestlers.json` is available to the existing match lookup and omitted from library browsing and new pools. Historical `raven` resolves to the comic as it did in the prior public catalog. An old custom pool containing removed IDs may need a fresh active selection before a rematch. New drafts and exports distinguish both Raven profiles. Existing room and match records are kept as stored.

`firebase/catalog.seed.json` and `firebase/seed.json` preserve every mapping from the former 248-key seed and add 56 keys, including `wrestler-raven`. The checked-in database rules are unchanged. The generator and catalog tests verify the seed and static file relationship. Tests also validate byte-for-byte regenerated artifacts and acceptance of new and historical IDs by the emulator.

## Production release gate

1. Obtain a read-only export of the current production `catalog` mapping and compare it with the branch seed. The earlier unauthenticated request could not read this node. Production contents remain unverified.
2. If mappings are missing, get explicit approval for an additive catalog-only change. Preserve existing keys and identities, including any production-only entries. Investigate conflicting mappings before applying changes. Keep room data outside the operation.
3. Confirm all active IDs resolve in production before merging or publishing the frontend, since a pool containing an absent key fails match creation. Validate a new room with two separate browsers and review an existing match after rollout. During transition, refresh cached clients before starting a new match.

No production import, rule deployment, room write or main merge was performed.
