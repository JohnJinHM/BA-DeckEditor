# Deck-building rules

Every constraint the editor enforces, where it comes from in the game data, and
how it was verified. Implemented in [`src/deck/rules.ts`](../src/deck/rules.ts).

The current database is **1.2.0.3** (24 tables, 16,687 rows). Russian Guard /
Defense Forces is specialization 12. `npm run verify` now exercises the actual
resolver, rules, generator and encrypted codec against all 30 playable
specialization pairs, even when no game-exported sample decks are present.
It also checks all 540 unit cards, 2,046 options and referenced asset paths.

The two sample battlegroups in [`/samples`](../samples) are the calibration
set: both are complete, in-game-legal decks, and both come to **exactly 10000
points** under the model below. `npm run verify` re-checks that.

## Specializations

A battlegroup picks a **country** and **two specializations** of that country
(`Specializations.CountryId`, `ShowInHangar` filters out the mission-editor
row). The pair decides everything else.

Each `Specializations` row carries a slot count and a point budget for each of
the seven categories:

| Category (`set2` key) | `cat` | Slots column | Points column | Localization |
|---|---|---|---|---|
| `Recon` | 0 | `ReconSlots` | `ReconPoints` | `ui_arsenal_category_rec` |
| `Infantry` | 1 | `InfantrySlots` | `InfantryPoints` | `ui_arsenal_category_inf` |
| `GroundCombatVehicles` | 2 | `CombatSlots` | `CombatPoints` | `ui_arsenal_category_veh` |
| `Support` | 3 | `SupportSlots` | `SupportPoints` | `ui_arsenal_category_sup` |
| `Logistic` | 4 | `LogisticsSlots` | `LogisticsPoints` | — |
| `Helicopters` | 5 | `HelicoptersSlots` | `HelicoptersPoints` | `ui_arsenal_category_hel` |
| `Aircrafts` | 6 | `AirSlots` | `AirPoints` | `ui_arsenal_category_air` |

Logistics is 0/0 for every shipped specialization, so the category exists in
the file format but never has a tab; the editor hides categories with no slots.

## Slots

```
slots(category) = min(7, spec1.<Slots> + spec2.<Slots>)
```

The **cap of 7** is what makes the two samples' arrays line up: VDV (7 recon) +
Mechanized (3 recon) = 10, and the file has 7 entries; VDV (2 combat) +
Mechanized (4 combat) = 6, and the file has 6. Every one of the 13 non-empty
category arrays across both files matches.

## Points

```
budget(category) = spec1.<Points> + spec2.<Points>
cap(category)    = round(budget × 1.1)          ← the 10% per-category allowance
total budget     = Countries.MaxPoints          ← 10000 for both playable countries
```

The seven category budgets always sum to exactly `MaxPoints`, so the allowance
is the only slack: a category may run up to 10% over **as long as the deck
total still fits 10000**. Both samples exploit it — `_arm+mar` is over budget in
Recon, Infantry, Support, Helicopters and Aircraft at once, and still totals
10000.

### What a slot costs

```
price(unit, options) = Units.Cost + Σ Options.Cost of every chosen option
slotCost             = price(unit)      × count
                     + price(transport) × tranCount     (when a transport is set)
```

Two details this pins down:

- **Default options are priced.** 137 `IsDefault` options carry a nonzero
  `Cost` (the AH-64D's default 8×Hellfire is +100), and `modList` always lists
  every modification, so a fresh card costs more than `Units.Cost`. The unit
  pool shows the with-defaults price for that reason.
- **The slot's own unit is charged**, not an option's `ReplaceUnitId`
  replacement — the replacement's `Cost` is not authoritative.

Summing this over both samples lands on 10000/10000 for each, which is the
strongest evidence the model is right.

## Which units, and how many

`SpecializationAvailabilities` is the roster: one row per
(specialization, unit), with `MaxAvailabilityXp0` as the copies allowed on one
card. `MaxAvailabilityXp1..3` are veterancy tiers and are 0 throughout the
shipped data.

- A deck's pool is the **union** of its two specs' rows. No unit appears under
  two specializations of the same country in build 1.2.0.3, so no merge rule is
  exercised; the code takes the larger limit if that ever changes.
- The category tab of a unit is `Units.CategoryType`.
- `count ≤ MaxAvailabilityXp0`.

## Transports

`TransportAvailabilities` hangs off a *specialization-availability* row, not
off the unit — the same squad can get different transports in different
specializations. So the legal transports for a card are the union of
`TransportAvailabilities` over that unit's availability rows in the two chosen
specs.

- `tranId` must be one of them; "on foot" (no `tranId`) is always allowed.
- `tranCount ≤ count`: a card can carry fewer transports than squads.
- The transport has its own `modList` and is priced independently.

## Default option selection

A unit opens on, per modification: its `IsDefault` option, else the option with
the **lowest `Order`**, with `Id` breaking ties. The card resolver uses the same
ordering; an omitted selection and an explicit default selection now render
the same loadout and cost.

Many of the 615 modifications flag no default, and for those the
`Order`-0 row is consistently the empty/none choice — Ka-52 "Custom_Option_
Empty" pylons, LMTV "Custom_Option_None". Falling back to table order instead
would open the Ka-52 on 12×Vikhr (+100). The deck itself always stores an
explicit `optId` for every modification, so this rule only applies when a unit
is first placed.

## Random battlegroups

[`deck/random.ts`](../src/deck/random.ts) builds a deck from the same rules, in
four passes:

1. **Cover every category.** Walk each category's pool in random order, giving
   each slot a distinct unit with a random option for every modification, and
   skipping any pick that would break the category ceiling or the point target.
2. **Hand out transports** to ~⅔ of the cards that can take one, 1:1 with the
   squad, again only where they fit.
3. **Spend the rest** on extra copies — randomly until the deck is ~90% paid
   for, then cheapest-increment-first so the total lands just under the target.
   A card and its 1:1 transports grow together.
4. **Sort each category cheapest-first**, the way a hand-built deck reads.

The result never exceeds the target (9900 by default) or any category ceiling,
and in practice lands within ~100 points of the target.

## Validation

| Condition | Severity | In-game message |
|---|---|---|
| deck total > `MaxPoints` | error | `ui_arsenal_deckpreview_invalid` |
| category spend > cap | error | — |
| unit not in either spec's roster | error | — |
| `count` > availability | error | — |
| transport not offered for the unit | error | — |
| `tranCount` > `count` | error | — |
| a category has empty slots | warning | `ui_arsenal_deckpreview_incomplete` |
| the same unit fills two slots of a category | warning | — |

Errors are the conditions the game calls out as making a battlegroup unusable
in multiplayer; warnings correspond to its "incomplete battlegroup" notice.
Nothing here is enforced by blocking the edit — the game lets you save an
invalid battlegroup too — but `previewSpecChange()` reports the same rules
ahead of a nation/specialization switch, so the cards a change would cost are
listed before it is applied.
The duplicate-unit rule is inferred (neither sample repeats a unit) and is only
a warning for that reason — the unit pool greys out units already in the
category, but an imported deck that repeats one is not rejected.
