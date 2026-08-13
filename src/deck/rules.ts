// Deck-building rules: slot counts, point budgets, per-unit availability and
// transport pools, and validation. Every rule here is read from the game data
// (Specializations / SpecializationAvailabilities / TransportAvailabilities /
// Countries) except the two constants at the top, which are calibrated against
// the sample decks in /samples — see docs/DECK_RULES.md.

import type { GameDb } from '../data/db'
import type { ModificationRow, OptionRow, SpecializationRow, UnitRow } from '../data/types'
import type { CategoryDef, CategoryKey, Deck, DeckSlot, OptionSelection } from './model'
import { CATEGORIES } from './model'

/** A category never shows more than seven slots, however many the two specs
 *  add up to (VDV 7 + Mechanized 3 recon slots still renders 7). */
export const MAX_CATEGORY_SLOTS = 7

/** A category may overspend its own budget by 10% as long as the deck total
 *  still fits the country's MaxPoints. Both sample decks sit above several
 *  category budgets and land on exactly 10000. */
export const CATEGORY_OVERSPEND = 0.1

// ── specializations ─────────────────────────────────────────────────────────

export function specsOf(db: GameDb, deck: Deck): SpecializationRow[] {
  return [deck.spec1, deck.spec2]
    .map((id) => db.specializations.get(id))
    .filter((s): s is SpecializationRow => !!s)
}

/** Slots the two specs grant in a category, capped at MAX_CATEGORY_SLOTS. */
export function categorySlots(specs: SpecializationRow[], def: CategoryDef): number {
  const sum = specs.reduce((n, s) => n + (s[def.slotsField] as number), 0)
  return Math.min(MAX_CATEGORY_SLOTS, sum)
}

/** Points the two specs grant in a category (the seven sum to the country's
 *  MaxPoints for any valid pair). */
export function categoryBudget(specs: SpecializationRow[], def: CategoryDef): number {
  return specs.reduce((n, s) => n + (s[def.pointsField] as number), 0)
}

/** The hard per-category ceiling: budget + the 10% allowance. */
export function categoryCap(specs: SpecializationRow[], def: CategoryDef): number {
  return Math.round(categoryBudget(specs, def) * (1 + CATEGORY_OVERSPEND))
}

export function totalBudget(db: GameDb, deck: Deck): number {
  return db.countries.get(deck.countryId)?.MaxPoints ?? 10000
}

// ── modifications & option pricing ──────────────────────────────────────────

/** A unit's modifications in display order. */
export function modificationsOf(db: GameDb, unitId: number): ModificationRow[] {
  return [...(db.unitModifications.get(unitId) ?? [])].sort((a, b) => a.Order - b.Order)
}

/** A modification's options in display order. */
export function optionsOf(db: GameDb, modId: number): OptionRow[] {
  return [...(db.modificationOptions.get(modId) ?? [])].sort((a, b) => a.Order - b.Order)
}

/** The option a modification starts on: the `IsDefault` row if it has one,
 *  otherwise the lowest-`Order` row. Two thirds of the modifications flag no
 *  default, and for those the Order-0 row is the empty/none choice (Ka-52's
 *  "Custom_Option_Empty" pylons) — the row the game opens the unit on. */
export function defaultOption(db: GameDb, modId: number): OptionRow | undefined {
  const opts = optionsOf(db, modId)
  return opts.find((o) => o.IsDefault) ?? opts[0]
}

/** Full default option selection for a unit — one entry per modification, the
 *  same shape the .dek file stores. */
export function defaultSelection(db: GameDb, unitId: number): OptionSelection {
  const sel: OptionSelection = {}
  for (const mod of modificationsOf(db, unitId)) {
    const opt = defaultOption(db, mod.Id)
    if (opt) sel[mod.Id] = opt.Id
  }
  return sel
}

/** Re-key a selection onto another unit's modifications, keeping choices whose
 *  modification still exists and defaulting the rest (used when a slot's unit
 *  changes). */
export function reconcileSelection(
  db: GameDb,
  unitId: number,
  previous: OptionSelection,
): OptionSelection {
  const sel = defaultSelection(db, unitId)
  for (const [modId, optId] of Object.entries(previous)) {
    if (modId in sel && optionsOf(db, Number(modId)).some((o) => o.Id === optId))
      sel[Number(modId)] = optId
  }
  return sel
}

/** Price of one copy: the unit's base cost plus every chosen option's delta.
 *  Default options carry deltas too (the Apache's default 8×Hellfire is +100),
 *  so an untouched unit is not simply `Units.Cost`. */
export function unitPrice(db: GameDb, unitId: number, selection: OptionSelection): number {
  const base = db.units.get(unitId)?.Cost ?? 0
  let delta = 0
  for (const optId of Object.values(selection)) delta += db.options.get(optId)?.Cost ?? 0
  return base + delta
}

/** What a slot costs the category: units × unit price + transports × transport
 *  price. Matches both sample decks to the point. */
export function slotCost(db: GameDb, slot: DeckSlot): number {
  if (slot.unitId == null) return 0
  let cost = unitPrice(db, slot.unitId, slot.options) * slot.count
  if (slot.transportId != null)
    cost += unitPrice(db, slot.transportId, slot.transportOptions) * slot.transportCount
  return cost
}

// ── availability ────────────────────────────────────────────────────────────

export interface UnitAvailability {
  unitId: number
  /** copies allowed on one card */
  max: number
  /** transport unit ids offered for this unit */
  transports: number[]
}

/** Every unit the two specs can field, keyed by unit id. Availability rows
 *  never overlap between two specs of the same country in the shipped data;
 *  `max` takes the larger value should that ever change. */
export function availabilityMap(db: GameDb, specIds: number[]): Map<number, UnitAvailability> {
  const map = new Map<number, UnitAvailability>()
  for (const specId of specIds) {
    for (const row of db.specAvailabilities.get(specId) ?? []) {
      const transports = (db.transportAvailabilities.get(row.Id) ?? []).map((t) => t.UnitId)
      const existing = map.get(row.UnitId)
      if (existing) {
        existing.max = Math.max(existing.max, row.MaxAvailabilityXp0)
        for (const t of transports) if (!existing.transports.includes(t)) existing.transports.push(t)
      } else {
        map.set(row.UnitId, { unitId: row.UnitId, max: row.MaxAvailabilityXp0, transports })
      }
    }
  }
  return map
}

/** Availability entries for one category, as armory unit rows + their limits. */
export function categoryPool(
  db: GameDb,
  availability: Map<number, UnitAvailability>,
  def: CategoryDef,
): { unit: UnitRow; availability: UnitAvailability }[] {
  const out: { unit: UnitRow; availability: UnitAvailability }[] = []
  for (const a of availability.values()) {
    const unit = db.units.get(a.unitId)
    if (unit && unit.CategoryType === def.cat) out.push({ unit, availability: a })
  }
  return out.sort((x, y) => x.unit.Cost - y.unit.Cost || x.unit.Id - y.unit.Id)
}

// ── totals & validation ─────────────────────────────────────────────────────

export interface CategoryTotals {
  def: CategoryDef
  slots: number
  used: number
  spent: number
  budget: number
  cap: number
  /** spending above the category budget but within the 10% allowance */
  overBudget: boolean
  /** spending above the allowance — the deck is unusable */
  overCap: boolean
}

export interface DeckTotals {
  categories: CategoryTotals[]
  spent: number
  budget: number
  overTotal: boolean
}

export function deckTotals(db: GameDb, deck: Deck): DeckTotals {
  const specs = specsOf(db, deck)
  const categories = CATEGORIES.map((def) => {
    const slots = deck.slots[def.key] ?? []
    const spent = slots.reduce((n, s) => n + slotCost(db, s), 0)
    const budget = categoryBudget(specs, def)
    const cap = categoryCap(specs, def)
    return {
      def,
      slots: categorySlots(specs, def),
      used: slots.filter((s) => s.unitId != null).length,
      spent,
      budget,
      cap,
      overBudget: spent > budget,
      overCap: spent > cap,
    }
  })
  const spent = categories.reduce((n, c) => n + c.spent, 0)
  const budget = totalBudget(db, deck)
  return { categories, spent, budget, overTotal: spent > budget }
}

// ── destructive-change preview ──────────────────────────────────────────────

export interface SpecChangeImpact {
  /** units the new pair cannot field at all */
  removed: { category: CategoryKey; name: string }[]
  /** cards whose copy count is above the new availability */
  clamped: { category: CategoryKey; name: string; from: number; to: number }[]
  /** transports the new pair does not offer for their squad */
  transportsDropped: { category: CategoryKey; name: string }[]
  /** slots lost because the new pair grants fewer of them */
  slotsLost: { category: CategoryKey; count: number }[]
  /** true when nothing in the deck changes */
  clean: boolean
}

/** What switching to another nation/specialization pair would do to the deck.
 *  Shown before the change is applied — it cannot be undone. */
export function previewSpecChange(
  db: GameDb,
  deck: Deck,
  spec1: number,
  spec2: number,
): SpecChangeImpact {
  const specs = [spec1, spec2]
    .map((id) => db.specializations.get(id))
    .filter((s): s is SpecializationRow => !!s)
  const available = availabilityMap(db, [spec1, spec2])
  const impact: SpecChangeImpact = {
    removed: [],
    clamped: [],
    transportsDropped: [],
    slotsLost: [],
    clean: true,
  }

  for (const def of CATEGORIES) {
    const slots = deck.slots[def.key] ?? []
    const keep = categorySlots(specs, def)
    const filledPastLimit = slots.slice(keep).filter((s) => s.unitId != null).length
    if (filledPastLimit > 0) impact.slotsLost.push({ category: def.key, count: filledPastLimit })

    for (const slot of slots.slice(0, keep)) {
      if (slot.unitId == null) continue
      const name = db.units.get(slot.unitId)?.HUDName ?? String(slot.unitId)
      const a = available.get(slot.unitId)
      if (!a) {
        impact.removed.push({ category: def.key, name })
        continue
      }
      if (slot.count > a.max)
        impact.clamped.push({ category: def.key, name, from: slot.count, to: a.max })
      if (slot.transportId != null && !a.transports.includes(slot.transportId))
        impact.transportsDropped.push({
          category: def.key,
          name: db.units.get(slot.transportId)?.HUDName ?? String(slot.transportId),
        })
    }
  }

  impact.clean =
    impact.removed.length === 0 &&
    impact.clamped.length === 0 &&
    impact.transportsDropped.length === 0 &&
    impact.slotsLost.length === 0
  return impact
}

/** Cards currently in the deck — the "is there anything to lose?" test. */
export function filledSlotCount(deck: Deck): number {
  return CATEGORIES.reduce(
    (n, def) => n + (deck.slots[def.key] ?? []).filter((s) => s.unitId != null).length,
    0,
  )
}

export interface DeckIssue {
  severity: 'error' | 'warning'
  category?: CategoryKey
  message: string
}

/** Everything wrong with a deck, in the order the in-game validator reports it
 *  (points first, then completeness). `error` means the game refuses it in
 *  multiplayer; `warning` is the "incomplete battlegroup" notice. */
export function validateDeck(db: GameDb, deck: Deck): DeckIssue[] {
  const issues: DeckIssue[] = []
  const totals = deckTotals(db, deck)
  const availability = availabilityMap(db, [deck.spec1, deck.spec2])

  // Imported files are untrusted: a deck built on a spec this build no longer
  // has would silently get the wrong budgets everywhere.
  for (const id of [deck.spec1, deck.spec2]) {
    const spec = db.specializations.get(id)
    if (!spec) issues.push({ severity: 'error', message: `Unknown specialization ${id}` })
    else if (spec.CountryId !== deck.countryId)
      issues.push({
        severity: 'error',
        message: `${spec.Name} does not belong to ${db.countries.get(deck.countryId)?.Name ?? deck.countryId}`,
      })
  }

  if (totals.overTotal)
    issues.push({
      severity: 'error',
      message: `Points limit exceeded: ${totals.spent} / ${totals.budget}`,
    })

  for (const c of totals.categories) {
    if (c.overCap)
      issues.push({
        severity: 'error',
        category: c.def.key,
        message: `${c.def.fallback}: ${c.spent} points exceeds the ${c.cap} ceiling`,
      })
    if (c.slots > 0 && c.used < c.slots)
      issues.push({
        severity: 'warning',
        category: c.def.key,
        message: `${c.def.fallback}: ${c.used} of ${c.slots} slots filled`,
      })
  }

  for (const def of CATEGORIES) {
    for (const [i, slot] of (deck.slots[def.key] ?? []).entries()) {
      if (slot.unitId == null) continue
      const unit = db.units.get(slot.unitId)
      const a = availability.get(slot.unitId)
      const where = `${def.fallback} slot ${i + 1}`
      if (!a) {
        issues.push({
          severity: 'error',
          category: def.key,
          message: `${where}: ${unit?.HUDName ?? unit?.Name ?? slot.unitId} is not available to these specializations`,
        })
        continue
      }
      if (slot.count > a.max)
        issues.push({
          severity: 'error',
          category: def.key,
          message: `${where}: ${slot.count} copies exceeds the limit of ${a.max}`,
        })
      if (slot.transportId != null && !a.transports.includes(slot.transportId))
        issues.push({
          severity: 'error',
          category: def.key,
          message: `${where}: ${db.units.get(slot.transportId)?.Name ?? slot.transportId} is not a valid transport`,
        })
      if (slot.transportId != null && slot.transportCount > slot.count)
        issues.push({
          severity: 'error',
          category: def.key,
          message: `${where}: more transports (${slot.transportCount}) than units (${slot.count})`,
        })
    }
  }

  const duplicates = new Set<string>()
  for (const def of CATEGORIES) {
    const seen = new Set<number>()
    for (const slot of deck.slots[def.key] ?? []) {
      if (slot.unitId == null) continue
      if (seen.has(slot.unitId)) duplicates.add(`${def.key}:${slot.unitId}`)
      seen.add(slot.unitId)
    }
  }
  for (const dup of duplicates) {
    const [key, id] = dup.split(':')
    issues.push({
      severity: 'warning',
      category: key as CategoryKey,
      message: `${db.units.get(Number(id))?.HUDName ?? id} occupies more than one slot`,
    })
  }

  return issues
}
