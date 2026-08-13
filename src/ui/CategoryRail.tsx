import { useAppStore } from '../state/store'
import { deckTotals } from '../deck/rules'
import type { CategoryTotals } from '../deck/rules'

/**
 * Category list with a spend bar each. The bar fills to the category budget;
 * the 10% allowance shows as a lighter overrun segment past it, and going
 * beyond that turns the row red (the deck stops being multiplayer-legal).
 */
export function CategoryRail() {
  const db = useAppStore((s) => s.db)!
  const deck = useAppStore((s) => s.deck)!
  const selected = useAppStore((s) => s.selected)
  const selectSlot = useAppStore((s) => s.selectSlot)

  const totals = deckTotals(db, deck)

  return (
    <nav className="category-rail">
      {totals.categories
        .filter((c) => c.slots > 0)
        .map((c) => (
          <button
            key={c.def.key}
            className={`category-row ${selected?.category === c.def.key ? 'active' : ''} ${
              c.overCap ? 'over-cap' : c.overBudget ? 'over-budget' : ''
            }`}
            onClick={() => selectSlot(c.def.key, 0)}
          >
            <span className="category-name">{db.locOr(c.def.locKey, c.def.fallback)}</span>
            <span className="category-slots">
              {c.used}/{c.slots}
            </span>
            <SpendBar totals={c} />
            <span className="category-points">
              {c.spent}
              <em>/{c.budget}</em>
            </span>
          </button>
        ))}
    </nav>
  )
}

function SpendBar({ totals }: { totals: CategoryTotals }) {
  // The track is the full cap, so the budget line sits at 1/1.1 of its width.
  const pct = (n: number) => `${Math.min(100, (n / Math.max(1, totals.cap)) * 100)}%`
  return (
    <span className="spend-bar">
      <span className="spend-fill" style={{ width: pct(totals.spent) }} />
      <span className="spend-budget-line" style={{ left: pct(totals.budget) }} />
    </span>
  )
}
