import { useMemo, useState } from 'react'
import { useAppStore } from '../state/store'
import { thumbnailUrl } from '../assets'
import { CATEGORY_BY_KEY } from '../deck/model'
import { availabilityMap, categoryPool, defaultSelection, unitPrice } from '../deck/rules'
import { t } from './i18n'

/**
 * Every unit the two specializations can field in the active category.
 * Clicking one drops it into the selected slot; the price shown is the unit's
 * cost with its default options applied, which is what a fresh card costs.
 */
export function UnitPool() {
  const db = useAppStore((s) => s.db)!
  const lang = useAppStore((s) => s.lang)
  const deck = useAppStore((s) => s.deck)!
  const selected = useAppStore((s) => s.selected)
  const setSlotUnit = useAppStore((s) => s.setSlotUnit)
  const [query, setQuery] = useState('')

  const pool = useMemo(() => {
    if (!selected) return []
    const def = CATEGORY_BY_KEY.get(selected.category)!
    return categoryPool(db, availabilityMap(db, [deck.spec1, deck.spec2]), def)
  }, [db, deck.spec1, deck.spec2, selected])

  if (!selected) return null

  const q = query.trim().toLowerCase()
  const shown = q ? pool.filter((p) => db.unitSearchText(p.unit.Id).includes(q)) : pool
  const inDeck = new Set(
    deck.slots[selected.category].map((s) => s.unitId).filter((id): id is number => id != null),
  )
  const current = deck.slots[selected.category][selected.index]?.unitId ?? null

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
          {shown.map(({ unit, availability }) => {
            const taken = inDeck.has(unit.Id) && unit.Id !== current
            return (
              <button
                key={unit.Id}
                className={`pool-card ${unit.Id === current ? 'active' : ''} ${taken ? 'taken' : ''}`}
                title={taken ? t(lang, 'alreadyInDeck') : (unit.HUDName ?? unit.Name ?? '')}
                disabled={taken}
                onClick={() => setSlotUnit(unit.Id)}
              >
                <img
                  className="pool-thumb"
                  src={thumbnailUrl(unit.ThumbnailFileName) ?? undefined}
                  alt=""
                  loading="lazy"
                />
                <span className="pool-name">{unit.HUDName ?? unit.Name}</span>
                <span className="pool-meta">
                  <span className="pool-cost">{unitPrice(db, unit.Id, defaultSelection(db, unit.Id))}</span>
                  <span className="pool-avail" title={`${t(lang, 'availability')}: ${availability.max}`}>
                    ×{availability.max}
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
