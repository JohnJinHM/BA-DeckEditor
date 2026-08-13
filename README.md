# [BA-DeckEditor](https://johnjinhm.github.io/BA-DeckEditor/)

Build **Broken Arrow battlegroups** in the browser — pick a nation and two
specializations, fill the category slots under the game's own point and
availability limits, and **import/export real `.dek` files**.

Unit cards are rendered by the card engine from
**[BA-ReCard](https://github.com/JohnJinHM/BA-ReCard)**; the game data comes
from **[BA-Units](https://github.com/JohnJinHM/BA-Units)**.

Built with **React + TypeScript + Vite**, deployed to GitHub Pages.
Everything runs client-side — no deck ever leaves your browser.

> 🇨🇳 [中文](README_CN.md)

## Features

- **Battlegroup setup** — nation + two specializations, with a live preview of
  the slot counts and point budgets the pair produces.
- **Seven category tabs** with per-category spend bars: the budget line, the
  10% overspend allowance past it, and a hard 10000-point deck total.
- **Slot editing** — a unit pool limited to what the two specs can field, with
  each unit's per-card availability, quantity steppers, and the transport list
  the game offers for that unit in that specialization.
- **Unit cards** in compact or expanded form (plus the Legacy card style),
  re-resolved as you change options, for the unit *or* its transport.
- **Customization options** panel under the card — one row per modification
  slot, showing the chosen loadout and its point delta, expanding to the
  choices with their loadout art.
- **`.dek` import/export**, byte-compatible with the game (also exports the
  decrypted JSON for inspection).

## Contents

```
src/
  data/        table types, loader/indexes (GameDb), unit→card resolver   [BA-ReCard]
  card/        CardModel + the in-game card renderer                      [BA-ReCard]
               (copied verbatim so it can be re-synced; its edit-mode
                affordances stay switched off — store.editMode is false)
  deck/        model.ts   categories, slots, the Deck type
               rules.ts   slots, budgets, availability, pricing, validation
               dek.ts     .dek codec (AES-256-CBC via WebCrypto)
  state/       zustand store (deck, selection, rendered card)
  ui/          setup dialog, category rail, slot strip, unit pool,
               card panel, customization options, toolbar
public/
  data/        game database dump (24 tables + localization, from BA-Units)
  assets/      extracted game assets — produced by scripts/extract-assets.mjs
docs/
  DECK_FORMAT.md   the .dek container, its JSON, and how it was decrypted
  DECK_RULES.md    slot/point/availability rules and how each was verified
scripts/
  extract-assets.mjs   AssetRipper export → public/assets
  check-assets.mjs     every sprite name in the tables resolves to a file
  verify-dek.mjs       codec + rules against the sample decks
  e2e-roundtrip.mjs    the built app: import → export → diff, and build-a-deck
  dev-screenshot.mjs   headless captures of the main screens
```

## Development

```sh
npm install
npm run dev        # http://localhost:5173/BA-DeckEditor/
npm run build      # type-check + production build to dist/
npm run verify     # deck rules + .dek codec against /samples, asset coverage
npm run deploy     # build + publish dist/ to the gh-pages branch
```

`npm run e2e` drives the built app in a headless browser (needs
`npx vite preview --port 4173` running) and checks that both sample decks
survive an import → export round trip, then builds a deck from scratch and
verifies the pricing.

## Refreshing after a game patch

```sh
# 1. Re-export the game with AssetRipper.
# 2. Decrypt the database (from a BA-Units checkout):
python tools/extract_database.py     --asset <export>/Assets/Resources/DataBaseCompiled.asset \
                                     --out   <this repo>/public/data --indent 0
python tools/extract_localization.py --text-dir <export>/Assets/TextAsset \
                                     --out   <this repo>/public/data/localization --all
python tools/extract_manifest.py     --root  <export> --out <this repo>/public/data
# (keep eng.json + chi.json; delete the other languages)

# 3. Re-extract the sprites and confirm nothing dangles:
npm run extract-assets -- <export>
npm run verify
```

If `extract_database.py` reports *"blob does not start with marker"*, the
developers rotated the encryption key — recover it with
`BA-Units/tools/recover_key.py` and update `KEY_TEXT` in
[`src/deck/dek.ts`](src/deck/dek.ts) too, since `.dek` files use the same key.

## How it works

1. `loadGameDb()` fetches the 24 tables + localization and builds id/FK indexes
   — including the three deck tables the card tool ignores
   (`Specializations`, `SpecializationAvailabilities`, `TransportAvailabilities`).
2. Choosing two specializations fixes the deck: `deck/rules.ts` derives each
   category's slot count (`min(7, s1 + s2)`), its point budget (`s1 + s2`, the
   seven always summing to the country's 10000), the 10% per-category
   allowance, the unit pool, per-card availability, and the transport list.
3. A slot stores an explicit option id for **every** modification of its unit,
   exactly as the `.dek` does, so pricing is `Units.Cost + Σ Options.Cost`
   times the copy count, plus the same for the transport.
4. Selecting a slot re-runs BA-ReCard's `resolveCard(db, unitId, selection)`
   and renders the result with its `UnitCard`, so cards match the game's.
5. Import/export decrypts and re-encrypts the `fhk3s0g3` + IV + AES-256-CBC
   envelope with WebCrypto, reproducing the game's indentation, CRLF line
   endings and field order.

## Documentation

- [docs/DECK_FORMAT.md](docs/DECK_FORMAT.md) — the `.dek` container and JSON
  schema, field by field.
- [docs/DECK_RULES.md](docs/DECK_RULES.md) — every deck-building rule, its
  source column, and how it was verified.
- [BA-ReCard/docs/DATA_SCHEMA.md](https://github.com/JohnJinHM/BA-ReCard/blob/main/docs/DATA_SCHEMA.md)
  — the 24 tables and how they join.
- [BA-Units/docs/EXTRACTION.md](https://github.com/JohnJinHM/BA-Units/blob/main/docs/EXTRACTION.md)
  — how the database (and therefore the `.dek` key) was decrypted.

## Status

- [x] Nation + two-specialization setup with a budget preview
- [x] Category slots, point budgets, 10% allowance, 10000 total
- [x] Unit pool with per-specialization availability limits
- [x] Transport selection and independent transport counts
- [x] Unit/transport cards (compact, expanded, legacy)
- [x] Customization options panel
- [x] `.dek` import/export verified against real game files
- [x] Deck validation (points, availability, transports, completeness)
- [ ] Unit skins (`unitSkinId`/`tranSkinId` are preserved but not editable —
      the game ships no skin table in `DataBaseCompiled.asset`)
- [ ] Deck sharing via URL / deck image export
