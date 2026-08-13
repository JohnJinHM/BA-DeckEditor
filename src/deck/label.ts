// How a unit presents itself in the deck UI (slot cards, unit pool, transport
// buttons) once its chosen options are applied.
//
// Options can rename a unit, swap it for another Units row entirely
// (`ReplaceUnitId` — SSO's "Standoff" loadout becomes the separate "SSO 2"
// row), and override its label art (`ThumbnailOverride`, 161 options). The
// card renderer already does this for the portrait; the deck chrome needs the
// same treatment for names and thumbnails, which is what this does.

import type { GameDb } from '../data/db'
import type { UnitRow } from '../data/types'
import type { OptionSelection } from './model'
import { modificationsOf } from './rules'

export interface UnitLabel {
  /** the unit actually fielded, after any ReplaceUnitId */
  unit: UnitRow
  name: string
  /** Units.ThumbnailFileName, or an option's ThumbnailOverride */
  thumbnail: string | null
}

/** Resolve a unit + option selection to the name and label art the deck shows.
 *  Mirrors resolveCard()'s naming rules (data/resolve.ts) on the cheap fields,
 *  without building a whole card. */
export function resolveUnitLabel(
  db: GameDb,
  unitId: number,
  selection: OptionSelection,
): UnitLabel | null {
  const base = db.units.get(unitId)
  if (!base) return null

  const chosen = modificationsOf(db, unitId)
    .map((mod) => db.options.get(selection[mod.Id] ?? -1))
    .filter((o) => o != null)

  // A replacement unit brings its own name and label art, so resolve it first.
  let unit = base
  for (const opt of chosen) {
    if (opt.ReplaceUnitId) unit = db.units.get(opt.ReplaceUnitId) ?? unit
  }

  let name = unit.HUDName ?? unit.Name ?? ''
  let thumbnail = unit.ThumbnailFileName
  for (const opt of chosen) {
    if (opt.ReplaceUnitName) name = db.cardLoc(opt.ReplaceUnitName)
    // direct concatenation, no separator: "BMP-3" + "M" → "BMP-3M"
    else if (opt.ConcatenateWithUnitName) name = `${name}${db.cardLoc(opt.ConcatenateWithUnitName)}`
    if (opt.ThumbnailOverride) thumbnail = opt.ThumbnailOverride
  }
  return { unit, name, thumbnail }
}
