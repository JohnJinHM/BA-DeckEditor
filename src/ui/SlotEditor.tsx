import { useAppStore, useSelectedSlot } from '../state/store'
import { chromeUrl, thumbnailUrl } from '../assets'
import { availabilityMap, unitPrice } from '../deck/rules'
import { t } from './i18n'

/** Quantity stepper + transport picker for the selected slot — the two knobs
 *  the .dek stores per card besides the option list (`count`/`tranCount`). */
export function SlotEditor() {
  const db = useAppStore((s) => s.db)!
  const lang = useAppStore((s) => s.lang)
  const deck = useAppStore((s) => s.deck)!
  const slot = useSelectedSlot()
  const cardTarget = useAppStore((s) => s.cardTarget)
  const setCardTarget = useAppStore((s) => s.setCardTarget)
  const setSlotCount = useAppStore((s) => s.setSlotCount)
  const setTransport = useAppStore((s) => s.setTransport)
  const setTransportCount = useAppStore((s) => s.setTransportCount)

  if (!slot || slot.unitId == null) return null
  const availability = availabilityMap(db, [deck.spec1, deck.spec2]).get(slot.unitId)
  const max = availability?.max ?? 1
  const transports = availability?.transports ?? []

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
                const u = db.units.get(id)
                return (
                  <button
                    key={id}
                    className={`transport-btn ${slot.transportId === id ? 'active' : ''}`}
                    onClick={() => setTransport(id)}
                  >
                    <img src={thumbnailUrl(u?.ThumbnailFileName ?? null) ?? undefined} alt="" />
                    <span>{u?.HUDName ?? u?.Name ?? id}</span>
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

      {slot.transportId != null && (
        <div className="card-target-toggle">
          <button
            className={cardTarget === 'unit' ? 'active' : ''}
            onClick={() => setCardTarget('unit')}
          >
            {t(lang, 'unitCard')}
          </button>
          <button
            className={cardTarget === 'transport' ? 'active' : ''}
            onClick={() => setCardTarget('transport')}
          >
            {t(lang, 'transportCard')}
          </button>
        </div>
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
      <span className="stepper-cost">{unitCost * value}</span>
    </div>
  )
}
