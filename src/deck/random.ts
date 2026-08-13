// Random battlegroup generator.
//
// Fills every category the two specializations grant, picking units, variants
// and transports at random, then spends up to a point target without breaking
// any of the rules in rules.ts (per-category ceilings, per-card availability,
// legal transports). Slots end up ordered cheapest-first, the way a hand-built
// deck reads.

import type { GameDb } from '../data/db'
import type { CategoryDef, CategoryKey, Deck, DeckSlot, OptionSelection } from './model'
import { CATEGORIES, DEK_VERSION, emptySlot } from './model'
import {
  availabilityMap,
  categoryCap,
  categoryPool,
  categorySlots,
  modificationsOf,
  optionsOf,
  slotCost,
  specsOf,
  unitPrice,
} from './rules'

export interface RandomDeckOptions {
  /** points to spend up to; the result never exceeds it */
  target: number
  /** chance a card that can take a transport gets one */
  transportChance?: number
}

export const DEFAULT_TARGET = 9900

const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]

function shuffled<T>(xs: readonly T[]): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** A random option for every modification — the unit's whole variant loadout. */
function randomSelection(db: GameDb, unitId: number): OptionSelection {
  const sel: OptionSelection = {}
  for (const mod of modificationsOf(db, unitId)) {
    const opts = optionsOf(db, mod.Id)
    if (opts.length) sel[mod.Id] = pick(opts).Id
  }
  return sel
}

/** Two distinct specializations of a country, at random. */
export function randomSpecs(db: GameDb, countryId: number): [number, number] | null {
  const specs = shuffled(db.countrySpecializations(countryId))
  if (specs.length < 2) return null
  return [specs[0].Id, specs[1].Id]
}

export function randomCountry(db: GameDb): number {
  return pick(db.playableCountries()).Id
}

/**
 * Build a battlegroup for `deck`'s nation and specializations. Runs in three
 * passes: seed every category with as many distinct units as its ceiling
 * affords, hand out transports, then spend what is left on extra copies —
 * randomly at first, then cheapest-first so the total lands near the target.
 */
export function generateRandomDeck(db: GameDb, deck: Deck, options: RandomDeckOptions): Deck {
  const { target, transportChance = 0.65 } = options
  const specs = specsOf(db, deck)
  const availability = availabilityMap(db, [deck.spec1, deck.spec2])

  const slots = {} as Record<CategoryKey, DeckSlot[]>
  const caps = new Map<CategoryKey, number>()
  const spent = new Map<CategoryKey, number>()
  for (const def of CATEGORIES) {
    slots[def.key] = Array.from({ length: categorySlots(specs, def) }, emptySlot)
    caps.set(def.key, categoryCap(specs, def))
    spent.set(def.key, 0)
  }

  let total = 0
  const fits = (def: CategoryDef, cost: number) =>
    total + cost <= target && spent.get(def.key)! + cost <= caps.get(def.key)!
  const charge = (def: CategoryDef, cost: number) => {
    total += cost
    spent.set(def.key, spent.get(def.key)! + cost)
  }

  // 1. One distinct unit per slot, cheap ones first so every category gets
  //    covered before the expensive picks eat the budget.
  for (const def of CATEGORIES) {
    const row = slots[def.key]
    if (row.length === 0) continue
    const pool = shuffled(categoryPool(db, availability, def))
    let i = 0
    for (const { unit } of pool) {
      if (i >= row.length) break
      const selection = randomSelection(db, unit.Id)
      const price = unitPrice(db, unit.Id, selection)
      if (!fits(def, price)) continue
      row[i] = { ...emptySlot(), unitId: unit.Id, cat: def.cat, count: 1, options: selection }
      charge(def, price)
      i++
    }
  }

  // 2. Transports for the squads that can take one.
  for (const def of CATEGORIES) {
    for (const slot of slots[def.key]) {
      if (slot.unitId == null) continue
      const transports = availability.get(slot.unitId)?.transports ?? []
      if (transports.length === 0 || Math.random() > transportChance) continue
      const transportId = pick(transports)
      const selection = randomSelection(db, transportId)
      const price = unitPrice(db, transportId, selection)
      if (!fits(def, price * slot.count)) continue
      slot.transportId = transportId
      slot.transportOptions = selection
      slot.transportCount = slot.count
      charge(def, price * slot.count)
    }
  }

  // 3. Spend the remainder on extra copies. A random walk first, so the deck
  //    isn't uniformly stacked with the cheapest card, then a cheapest-first
  //    sweep to squeeze the last few hundred points out of the target.
  /** What one more copy of this card costs — plus its transport, when the
   *  squad and its transports are 1:1 and so grow together. */
  const stepCost = (slot: DeckSlot) => {
    let cost = unitPrice(db, slot.unitId!, slot.options)
    if (slot.transportId != null && slot.transportCount === slot.count)
      cost += unitPrice(db, slot.transportId, slot.transportOptions)
    return cost
  }

  const growable = () => {
    const out: { def: CategoryDef; slot: DeckSlot; cost: number }[] = []
    for (const def of CATEGORIES)
      for (const slot of slots[def.key]) {
        if (slot.unitId == null) continue
        if (slot.count >= (availability.get(slot.unitId)?.max ?? 1)) continue
        const cost = stepCost(slot)
        if (fits(def, cost)) out.push({ def, slot, cost })
      }
    return out
  }

  const grow = (one: { def: CategoryDef; slot: DeckSlot; cost: number }) => {
    one.slot.count++
    // transports that were 1:1 with the squad stay 1:1
    if (one.slot.transportId != null && one.slot.transportCount === one.slot.count - 1)
      one.slot.transportCount++
    charge(one.def, one.cost)
  }

  for (let guard = 0; guard < 500; guard++) {
    const options = growable()
    if (options.length === 0) break
    // taper off the random phase once the deck is mostly paid for
    if (total > target * 0.9) break
    grow(pick(options))
  }
  for (let guard = 0; guard < 500; guard++) {
    const options = growable()
    if (options.length === 0) break
    grow(options.reduce((a, b) => (b.cost < a.cost ? b : a)))
  }

  // 4. Cheapest card on the left, matching how decks read in game. `cat` rides
  //    along with its slot; `slot` indices are re-numbered on export.
  for (const def of CATEGORIES) {
    slots[def.key] = [...slots[def.key]].sort((a, b) => {
      if (a.unitId == null) return b.unitId == null ? 0 : 1
      if (b.unitId == null) return -1
      return (
        unitPrice(db, a.unitId, a.options) - unitPrice(db, b.unitId, b.options) ||
        slotCost(db, a) - slotCost(db, b)
      )
    })
  }

  return { ...deck, version: deck.version || DEK_VERSION, slots }
}
