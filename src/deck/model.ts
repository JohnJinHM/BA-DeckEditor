// The battlegroup ("deck") model, and the categories it is organised into.
//
// The seven categories, their order, and their `set2` keys come straight from
// the .dek wire format (see docs/DECK_FORMAT.md); the per-category slot and
// point columns come from the Specializations table.

import type { SpecializationRow } from '../data/types'

export type CategoryKey =
  | 'Recon'
  | 'Infantry'
  | 'GroundCombatVehicles'
  | 'Support'
  | 'Logistic'
  | 'Helicopters'
  | 'Aircrafts'

export interface CategoryDef {
  /** `set2` key in the .dek file, and our stable category id */
  key: CategoryKey
  /** Units.CategoryType / the entry's `cat` field (0-based) */
  cat: number
  slotsField: keyof SpecializationRow
  pointsField: keyof SpecializationRow
  /** game localization key; Logistic has no tab in game (all specs give it 0 slots) */
  locKey: string
  fallback: string
}

export const CATEGORIES: CategoryDef[] = [
  { key: 'Recon', cat: 0, slotsField: 'ReconSlots', pointsField: 'ReconPoints', locKey: 'ui_arsenal_category_rec', fallback: 'Reconnaissance' },
  { key: 'Infantry', cat: 1, slotsField: 'InfantrySlots', pointsField: 'InfantryPoints', locKey: 'ui_arsenal_category_inf', fallback: 'Infantry' },
  { key: 'GroundCombatVehicles', cat: 2, slotsField: 'CombatSlots', pointsField: 'CombatPoints', locKey: 'ui_arsenal_category_veh', fallback: 'Vehicles' },
  { key: 'Support', cat: 3, slotsField: 'SupportSlots', pointsField: 'SupportPoints', locKey: 'ui_arsenal_category_sup', fallback: 'Support' },
  { key: 'Logistic', cat: 4, slotsField: 'LogisticsSlots', pointsField: 'LogisticsPoints', locKey: 'ui_arsenal_category_log', fallback: 'Logistics' },
  { key: 'Helicopters', cat: 5, slotsField: 'HelicoptersSlots', pointsField: 'HelicoptersPoints', locKey: 'ui_arsenal_category_hel', fallback: 'Helicopters' },
  { key: 'Aircrafts', cat: 6, slotsField: 'AirSlots', pointsField: 'AirPoints', locKey: 'ui_arsenal_category_air', fallback: 'Aircraft' },
]

export const CATEGORY_BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]))

/** Chosen option per modification id — the same shape resolveCard() takes. */
export type OptionSelection = Record<number, number>

/** One card slot in a category. A slot with `unitId === null` is empty. */
export interface DeckSlot {
  unitId: number | null
  /** copies of the unit on the card; ≤ the spec's MaxAvailabilityXp0 */
  count: number
  options: OptionSelection
  /** cosmetic skin ids; not in the extracted database, preserved verbatim */
  unitSkinId?: number
  transportId: number | null
  /** transports bought for the card; ≤ `count` */
  transportCount: number
  transportOptions: OptionSelection
  transportSkinId?: number
  /** the entry's `cat` field. The game stamps it when a unit is placed and
   *  leaves it behind when the slot is cleared, so it is round-tripped as-is
   *  rather than derived. */
  cat: number
}

export interface Deck {
  name: string
  countryId: number
  spec1: number
  spec2: number
  /** .dek format version, echoed back on export (6 in the current build) */
  version: number
  slots: Record<CategoryKey, DeckSlot[]>
}

export function emptySlot(): DeckSlot {
  return {
    unitId: null,
    count: 1,
    options: {},
    transportId: null,
    transportCount: 0,
    transportOptions: {},
    cat: 0,
  }
}

export const DEK_VERSION = 6
