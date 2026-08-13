import { useMemo, useState } from 'react'
import { useAppStore } from '../state/store'
import { thumbnailUrl } from '../assets'
import { CATEGORY_BY_KEY } from '../deck/model'
import { availabilityMap, categoryPool, defaultSelection, unitPrice } from '../deck/rules'
import { resolveUnitLabel } from '../deck/label'
import { t } from './i18n'

/**
 * Every unit the two specializations can field in the active category. One
 * click adds one copy: the first drops the unit into a free slot, each further
 * click steps that card's count up to the availability limit. Prices are the
 * unit's cost with its default options, which is what a fresh card costs.
 */
export function UnitPool() {
  const db = useAppStore((s) => s.db)!
  const lang = useAppStore((s) => s.lang)
  const deck = useAppStore((s) => s.deck)!
  const selected = useAppStore((s) => s.selected)
  const addUnit = useAppStore((s) => s.addUnit)
  const [query, setQuery] = useState('')

  const pool = useMemo(() => {
    if (!selected) return []
    const def = CATEGORY_BY_KEY.get(selected.category)!
    return categoryPool(db, availabilityMap(db, [deck.spec1, deck.spec2]), def).map((entry) => ({
      ...entry,
      // pool art shows the default loadout the unit would arrive with
      label: resolveUnitLabel(db, entry.unit.Id, defaultSelection(db, entry.unit.Id)),
      price: unitPrice(db, entry.unit.Id, defaultSelection(db, entry.unit.Id)),
    }))
  }, [db, deck.spec1, deck.spec2, selected])

  if (!selected) return null

  const slots = deck.slots[selected.category]
  const q = query.trim().toLowerCase()
  const shown = q ? pool.filter((p) => db.unitSearchText(p.unit.Id).includes(q)) : pool
  const inDeck = new Map(
    slots.filter((s) => s.unitId != null).map((s) => [s.unitId!, s.count] as const),
  )
  const full = slots.every((s) => s.unitId != null)

  return (
    <section className="unit-pool">
      <input
        className="pool-search"
        placeholder={t(lang, 'searchUnits')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {shown.length === 0 ? (
        <p className="empty-note">{t(lang, 'noUnits')}</p>
      ) : (
        <div className="pool-grid">
          {shown.map(({ unit, availability, label, price }) => {
            const taken = inDeck.get(unit.Id)
            const maxed = taken != null && taken >= availability.max
            // With every slot filled, only units already in the deck can grow.
            const blocked = maxed || (taken == null && full)
            return (
              <button
                key={unit.Id}
                className={`pool-card ${taken != null ? 'in-deck' : ''} ${blocked ? 'blocked' : ''}`}
                title={
                  maxed
                    ? `${label?.name ?? unit.Name} — ${t(lang, 'availability')}: ${availability.max}`
                    : blocked
                      ? t(lang, 'categoryFull')
                      : `${label?.name ?? unit.Name} — ${t(lang, 'availabilityHint')}`
                }
                disabled={blocked}
                onClick={() => addUnit(unit.Id)}
              >
                <img
                  className="pool-thumb"
                  src={thumbnailUrl(label?.thumbnail ?? null) ?? undefined}
                  alt=""
                  loading="lazy"
                />
                <span className="pool-name">{label?.name ?? unit.HUDName ?? unit.Name}</span>
                <span className="pool-meta">
                  <span className="pool-cost">{price}</span>
                  <span className="pool-avail">
                    {taken != null ? (
                      <>
                        <em>{taken}</em> / {availability.max}
                      </>
                    ) : (
                      `×${availability.max}`
                    )}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
