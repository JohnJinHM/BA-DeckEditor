import { useMemo } from 'react'
import { useAppStore, useSelectedSlot } from '../state/store'
import { chromeUrl, thumbnailUrl } from '../assets'
import { availabilityMap, defaultSelection, unitPrice } from '../deck/rules'
import { resolveUnitLabel } from '../deck/label'
import { CostStack } from './CostStack'
import { t } from './i18n'

/** Quantity stepper + transport picker for the selected slot — the two knobs
 *  the .dek stores per card besides the option lists (`count`/`tranCount`). */
export function SlotEditor() {
  const db = useAppStore((s) => s.db)!
  const lang = useAppStore((s) => s.lang)
  const deck = useAppStore((s) => s.deck)!
  const slot = useSelectedSlot()
  const setSlotCount = useAppStore((s) => s.setSlotCount)
  const setTransport = useAppStore((s) => s.setTransport)
  const setTransportCount = useAppStore((s) => s.setTransportCount)
  const availability = useMemo(
    () => availabilityMap(db, [deck.spec1, deck.spec2]),
    [db, deck.spec1, deck.spec2],
  )

  if (!slot || slot.unitId == null) return null
  const entry = availability.get(slot.unitId)
  const max = entry?.max ?? 1
  const transports = entry?.transports ?? []

  return (
    <section className="slot-editor">
      <Stepper
        label={t(lang, 'quantity')}
        value={slot.count}
        min={1}
        max={max}
        unitCost={unitPrice(db, slot.unitId, slot.options)}
        onChange={setSlotCount}
      />

      {transports.length > 0 && (
        <>
          <div className="transport-row">
            <span className="editor-label">{t(lang, 'transport')}</span>
            <div className="transport-choices">
              <button
                className={`transport-btn ${slot.transportId == null ? 'active' : ''}`}
                onClick={() => setTransport(null)}
              >
                <img src={chromeUrl('On Foot Icon')} alt="" />
                <span>{db.locOr('ui_deck_unit_on_foot', 'On foot')}</span>
              </button>
              {transports.map((id) => {
                // the picked transport shows its configured variant art, the
                // rest the loadout they would arrive with
                const label = resolveUnitLabel(
                  db,
                  id,
                  slot.transportId === id ? slot.transportOptions : defaultSelection(db, id),
                )
                return (
                  <button
                    key={id}
                    className={`transport-btn ${slot.transportId === id ? 'active' : ''}`}
                    onClick={() => setTransport(id)}
                  >
                    <img src={thumbnailUrl(label?.thumbnail ?? null) ?? undefined} alt="" />
                    <span>{label?.name ?? id}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {slot.transportId != null && (
            <Stepper
              label={t(lang, 'transports')}
              value={slot.transportCount}
              min={0}
              max={slot.count}
              unitCost={unitPrice(db, slot.transportId, slot.transportOptions)}
              onChange={setTransportCount}
            />
          )}
        </>
      )}
    </section>
  )
}

function Stepper({ label, value, min, max, unitCost, onChange }: {
  label: string
  value: number
  min: number
  max: number
  unitCost: number
  onChange(v: number): void
}) {
  return (
    <div className="stepper-row">
      <span className="editor-label">{label}</span>
      <div className="stepper">
        <button disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <span className="stepper-value">{value}</span>
        <button disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
      <span className="stepper-max">/ {max}</span>
      <span className="stepper-cost">
        <CostStack each={unitCost} count={value} />
      </span>
    </div>
  )
}
