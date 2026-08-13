# The `.dek` battlegroup file

Broken Arrow saves each battlegroup as a `.dek` file (Windows:
`%USERPROFILE%\Documents\Broken Arrow\Decks\`). This documents the container,
the JSON inside it, and how both were recovered — enough to read or write the
files without the game.

Implemented in [`src/deck/dek.ts`](../src/deck/dek.ts); checked against the two
files in [`/samples`](../samples) by
[`scripts/verify-dek.mjs`](../scripts/verify-dek.mjs) and
[`scripts/e2e-roundtrip.mjs`](../scripts/e2e-roundtrip.mjs).

## 1. Container

A `.dek` is the **same encrypted envelope the game uses for its unit
database**, stored raw instead of Base64:

```
+----------------+------------------+-----------------------------------+
| marker (8 B)   | IV (16 B)        | AES-256-CBC ciphertext (PKCS7)    |
| "fhk3s0g3"     | random per file  | PKCS7( UTF8( json ) )             |
+----------------+------------------+-----------------------------------+
```

- **Cipher:** AES-256-CBC, PKCS#7 padding (WebCrypto's `AES-CBC` handles the
  padding both ways).
- **Key:** the UTF-8 bytes of `09234237536700238099172758697347`.
- **Marker/IV:** ASCII `fhk3s0g3`, then the per-file IV.

Key and marker live in the game's native code
(`BrokenArrow.Core.Security.EncryptedFileManager`), not in the assets; they were
recovered once with Il2CppDumper — see
[BA-Units/docs/EXTRACTION.md](https://github.com/JohnJinHM/BA-Units/blob/main/docs/EXTRACTION.md).
`DataBaseCompiled.asset` wraps the identical structure in Base64, which is how
the same key decrypts both.

If a patch rotates the key, re-recover it with `BA-Units/tools/recover_key.py`
and change `KEY_TEXT` in `src/deck/dek.ts`.

## 2. JSON

The plaintext is two-space-indented JSON with **CRLF** line breaks
(Newtonsoft `Formatting.Indented` on Windows). Reproducing the indent, the line
endings and the field order below makes a re-exported file byte-identical to
the game's.

```jsonc
{
  "set2": {
    "Recon":                [ /* one entry per slot */ ],
    "Infantry":             [ … ],
    "GroundCombatVehicles": [ … ],
    "Support":              [ … ],
    "Logistic":             [ … ],   // always empty: no spec grants logistics slots
    "Helicopters":          [ … ],
    "Aircrafts":            [ … ]
  },
  "v": 6,                  // format version (build 1.1.1.x)
  "name": "_arm+mar",      // deck name; the file is usually named after it
  "spec1": 4,              // Specializations.Id
  "spec2": 3,              // Specializations.Id
  "country": 2             // Countries.Id (1 Russia, 2 USA)
}
```

Every category array holds **exactly as many entries as the two specs grant
slots** (see [DECK_RULES.md](DECK_RULES.md)), filled or not.

### Slot entry

Fields appear in this order; the optional ones are omitted rather than written
as `null`.

| Field | Type | Meaning |
|---|---|---|
| `tranSkinId` | int? | cosmetic skin on the transport (not in the extracted DB) |
| `unitId` | int? | `Units.Id`; absent on an empty slot |
| `unitSkinId` | int? | cosmetic skin on the unit |
| `cat` | int | `UnitCategoryType` — see the note below |
| `slot` | int | 0-based index within the category |
| `tranId` | int? | transport `Units.Id`, absent when the card goes on foot |
| `modList` | array | chosen option **per modification of the unit** (below) |
| `modListTr` | array | the same for the transport |
| `count` | int? | copies of the unit on this card; absent on an empty slot |
| `tranCount` | int? | transports bought, `≤ count`; absent with no transport |

Two fields keep state the UI has moved on from, and the app round-trips both:

- **`cat` is stamped, not derived.** The game writes the category when a unit
  is placed and leaves the value behind when the slot is cleared, so a
  never-used slot has `cat: 0` while a cleared Helicopters slot keeps `cat: 5`.
- **`modListTr` outlives its transport.** Switching a card back to "on foot"
  drops `tranId`/`tranCount` but keeps the transport's option list, so picking
  the same transport again restores its loadout. Three entries in
  `_mech+vdv.dek` are in exactly that state.

### `modList` / `modListTr` entry

One entry **per `Modifications` row of that unit** — defaults included, never a
subset:

```json
{ "modId": 490, "optId": 1768, "cost": 10, "run": "M3A4 CFV", "cwun": null, "type": 0 }
```

| Field | Source |
|---|---|
| `modId` | `Modifications.Id` |
| `optId` | the chosen `Options.Id` |
| `cost` | `Options.Cost` (a delta on the unit's base cost) |
| `run` | `Options.ReplaceUnitName` |
| `cwun` | `Options.ConcatenateWithUnitName` |
| `type` | `0` in every shipped deck; **not** `Modifications.Type` |

`cost`, `run` and `cwun` duplicate the `Options` row, so a deck stays readable
without the database. All 118 entries across the two samples match their
`Options` rows exactly, which is what pins this mapping down.

The **order within a list is not meaningful** — the game's own files use an
unstable order (a dictionary walk: `[489, 490, 22]` where the table order is
`[22, 489, 490]`), and nothing reads the list positionally. This app writes
them in customization-panel order (`Modifications.Order`, then `Id`) so exports
diff cleanly.

## 3. What is *not* in the extracted data

`unitSkinId` / `tranSkinId` reference cosmetic skins, which have no table in
`DataBaseCompiled.asset`. The editor preserves both verbatim on import/export
but offers no UI for them.
