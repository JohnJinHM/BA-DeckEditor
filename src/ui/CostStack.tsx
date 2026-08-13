/**
 * A card's price: what one copy costs on top, what the whole card costs below
 * in smaller grey. Used wherever a count multiplies a price — slot cards and
 * the quantity/transport steppers — so the two numbers never get confused.
 */
export function CostStack({ each, count }: { each: number; count: number }) {
  return (
    <span className="cost-stack">
      <span className="cost-each">{each}</span>
      <span className="cost-total">{each * count}</span>
    </span>
  )
}
