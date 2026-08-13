import { useMemo } from 'react'
import { useAppStore } from '../state/store'
import { thumbnailUrl } from '../assets'
import { CATEGORY_BY_KEY } from '../deck/model'
import type { DeckSlot } from '../deck/model'
import { availabilityMap, slotCost, unitPrice } from '../deck/rules'
import { resolveUnitLabel } from '../deck/label'
import type { GameDb } from '../data/db'
import { t } from './i18n'

/** The active category's slots, in .dek slot order. */
export function SlotStrip() {
  const db = useAppStore((s) => s.db)!
  const lang = useAppStore((s) => s.lang)
  const deck = useAppStore((s) => s.deck)!
  const selected = useAppStore((s) => s.selected)
  const selectSlot = useAppStore((s) => s.selectSlot)
  const setSlotUnit = useAppStore((s) => s.setSlotUnit)
  const availability = useMemo(
    () => availabilityMap(db, [deck.spec1, deck.spec2]),
    [db, deck.spec1, deck.spec2],
  )

  if (!selected) return null
  const def = CATEGORY_BY_KEY.get(selected.category)!
  const slots = deck.slots[selected.category]
  if (slots.length === 0) return <p className="empty-note">{t(lang, 'noSlots')}</p>

  return (
    <div className="slot-strip">
      {slots.map((slot, i) => (
        <div
          key={i}
          className={`slot-card ${i === selected.index ? 'active' : ''} ${slot.unitId == null ? 'empty' : ''}`}
          onClick={() => selectSlot(def.key, i)}
        >
          {slot.unitId == null ? (
            <span className="slot-empty-label">{t(lang, 'emptySlot')}</span>
          ) : (
            <FilledSlot db={db} slot={slot} max={availability.get(slot.unitId)?.max ?? slot.count} />
          )}
          {slot.unitId != null && i === selected.index && (
            <button
              className="slot-remove"
              title={t(lang, 'removeUnit')}
              onClick={(e) => {
                e.stopPropagation()
                setSlotUnit(null)
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function FilledSlot({ db, slot, max }: { db: GameDb; slot: DeckSlot; max: number }) {
  // name and label art follow the chosen options, which can rename the unit,
  // swap it outright (SSO → SSO 2) or override the thumbnail
  const unit = resolveUnitLabel(db, slot.unitId!, slot.options)
  const transport =
    slot.transportId != null ? resolveUnitLabel(db, slot.transportId, slot.transportOptions) : null
  return (
    <>
      <img className="slot-thumb" src={thumbnailUrl(unit?.thumbnail ?? null) ?? undefined} alt="" />
      <span className="slot-name">{unit?.name ?? '—'}</span>
      <span className="slot-meta">
        <span className={`slot-count ${slot.count > max ? 'invalid' : ''}`}>×{slot.count}</span>
        <span className="slot-cost">{slotCost(db, slot)}</span>
      </span>
      {transport && (
        <span className="slot-transport" title={transport.name}>
          {transport.name} ×{slot.transportCount}
          <em>{unitPrice(db, transport.unit.Id, slot.transportOptions) * slot.transportCount}</em>
        </span>
      )}
    </>
  )
}
