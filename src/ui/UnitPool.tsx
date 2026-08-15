import { useMemo, useState } from 'react'
import { useAppStore } from '../state/store'
import { thumbnailUrl } from '../assets'
import { CATEGORIES } from '../deck/model'
import type { CategoryDef, CategoryKey, Deck } from '../deck/model'
import {
  availabilityMap,
  categoryPool,
  categorySlots,
  defaultSelection,
  specsOf,
  unitPrice,
} from '../deck/rules'
import type { UnitAvailability } from '../deck/rules'
import { resolveUnitLabel } from '../deck/label'
import type { UnitLabel } from '../deck/label'
import type { UnitRow } from '../data/types'
import { t } from './i18n'

interface PoolEntry {
  unit: UnitRow
  availability: UnitAvailability
  label: UnitLabel | null
  price: number
}

interface PoolGroup {
  def: CategoryDef
  /** slots the two specializations grant here; 0 hides the category */
  slots: number
  units: PoolEntry[]
}

/** Units of a category already on a card, by unit id → copies. */
function inDeckCounts(deck: Deck, key: CategoryKey): Map<number, number> {
  return new Map(
    (deck.slots[key] ?? [])
      .filter((s) => s.unitId != null)
      .map((s) => [s.unitId!, s.count] as const),
  )
}

/** Cards placed in a category — the same count the category rail shows. */
function usedSlots(deck: Deck, key: CategoryKey): number {
  return (deck.slots[key] ?? []).filter((s) => s.unitId != null).length
}

/** True once every slot of a category holds a unit — only cards already there
 *  can grow. */
function categoryIsFull(deck: Deck, key: CategoryKey): boolean {
  const slots = deck.slots[key] ?? []
  return slots.length > 0 && slots.every((s) => s.unitId != null)
}

/**
 * Every unit the two specializations can field. With a category open this is
 * that category's pool, priced and named; with none open it is an icon-only
 * overview of every category at once. One click adds one copy: the first drops
 * the unit into a free slot, each further click steps that card's count up to
 * the availability limit. Prices are the unit's cost with its default options,
 * which is what a fresh card costs.
 */
export function UnitPool() {
  const db = useAppStore((s) => s.db)!
  const lang = useAppStore((s) => s.lang)
  const deck = useAppStore((s) => s.deck)!
  const selected = useAppStore((s) => s.selected)
  const addUnit = useAppStore((s) => s.addUnit)
  const selectSlot = useAppStore((s) => s.selectSlot)
  const [query, setQuery] = useState('')

  const availability = useMemo(
    () => availabilityMap(db, [deck.spec1, deck.spec2]),
    [db, deck.spec1, deck.spec2],
  )

  // Both views read from one list, so the overview and the open category agree
  // on names, prices and ordering. Only the specializations feed it, so placing
  // cards does not rebuild it.
  const groups: PoolGroup[] = useMemo(() => {
    const specs = specsOf(db, deck)
    return CATEGORIES.map((def) => ({
      def,
      slots: categorySlots(specs, def),
      units: categoryPool(db, availability, def).map((entry) => ({
        ...entry,
        // pool art shows the default loadout the unit would arrive with
        label: resolveUnitLabel(db, entry.unit.Id, defaultSelection(db, entry.unit.Id)),
        price: unitPrice(db, entry.unit.Id, defaultSelection(db, entry.unit.Id)),
      })),
    }))
  }, [db, deck.spec1, deck.spec2, availability])

  const q = query.trim().toLowerCase()
  const match = (e: PoolEntry) => !q || db.unitSearchText(e.unit.Id).includes(q)

  /** Add one copy of a unit sitting in `key`, opening that category first so
   *  the new card is the one on screen. */
  const add = (key: CategoryKey, unitId: number) => {
    if (key !== selected?.category) selectSlot(key, 0)
    addUnit(unitId)
  }

  return (
    <section className="unit-pool">
      <input
        className="pool-search"
        placeholder={t(lang, 'searchUnits')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {selected ? (
        <CategoryPool
          group={groups.find((g) => g.def.key === selected.category)}
          deck={deck}
          match={match}
          onAdd={add}
        />
      ) : (
        <Overview groups={groups} deck={deck} match={match} onAdd={add} onOpen={selectSlot} />
      )}
    </section>
  )
}

interface ViewProps {
  deck: Deck
  match(entry: PoolEntry): boolean
  onAdd(key: CategoryKey, unitId: number): void
}

/** The open category: full cards with name, price and availability. */
function CategoryPool({ group, deck, match, onAdd }: ViewProps & { group: PoolGroup | undefined }) {
  const lang = useAppStore((s) => s.lang)
  const shown = (group?.units ?? []).filter(match)
  if (!group || shown.length === 0) return <p className="empty-note">{t(lang, 'noUnits')}</p>

  const inDeck = inDeckCounts(deck, group.def.key)
  const full = categoryIsFull(deck, group.def.key)

  return (
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
            onClick={() => onAdd(group.def.key, unit.Id)}
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
  )
}

/**
 * No category open: every category the specializations grant, each a dense grid
 * of label art alone. The detail (name, price, availability) lives in the
 * tooltip and in the open-category view; here the point is seeing the whole
 * roster at once.
 */
function Overview({
  groups,
  deck,
  match,
  onAdd,
  onOpen,
}: ViewProps & {
  groups: PoolGroup[]
  onOpen(key: CategoryKey, index: number): void
}) {
  const db = useAppStore((s) => s.db)!
  const lang = useAppStore((s) => s.lang)
  const shown = groups
    .filter((g) => g.slots > 0)
    .map((g) => ({ group: g, units: g.units.filter(match) }))
    .filter((g) => g.units.length > 0)

  if (shown.length === 0) return <p className="empty-note">{t(lang, 'noMatches')}</p>

  return (
    <div className="pool-overview">
      {shown.map(({ group, units }) => {
        const inDeck = inDeckCounts(deck, group.def.key)
        const full = categoryIsFull(deck, group.def.key)
        return (
          <section key={group.def.key} className="overview-group">
            <button
              className="overview-head"
              title={t(lang, 'openCategory')}
              onClick={() => onOpen(group.def.key, 0)}
            >
              <span>{db.locOr(group.def.locKey, group.def.fallback)}</span>
              <em>
                {usedSlots(deck, group.def.key)}/{group.slots}
              </em>
            </button>
            <div className="overview-grid">
              {units.map(({ unit, availability, label, price }) => {
                const taken = inDeck.get(unit.Id)
                const maxed = taken != null && taken >= availability.max
                const blocked = maxed || (taken == null && full)
                return (
                  <button
                    key={unit.Id}
                    className={`overview-cell ${taken != null ? 'in-deck' : ''} ${
                      blocked ? 'blocked' : ''
                    }`}
                    title={`${label?.name ?? unit.HUDName ?? unit.Name} — ${price} · ${
                      maxed
                        ? `${t(lang, 'availability')}: ${availability.max}`
                        : blocked
                          ? t(lang, 'categoryFull')
                          : t(lang, 'availabilityHint')
                    }`}
                    disabled={blocked}
                    onClick={() => onAdd(group.def.key, unit.Id)}
                  >
                    <img
                      className="overview-thumb"
                      src={thumbnailUrl(label?.thumbnail ?? null) ?? undefined}
                      alt={label?.name ?? unit.HUDName ?? unit.Name ?? ''}
                      loading="lazy"
                    />
                    {taken != null && <span className="overview-count">×{taken}</span>}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
