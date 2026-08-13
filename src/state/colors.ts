// Per-field color overrides on the rendered card, keyed by a stable string (a
// text field's colorKey, or an icon's). The deck editor never writes them —
// the hook exists so the card renderer stays byte-identical to BA-ReCard's.

import { useAppStore } from './store'

/** Override for `key` on the current card; undefined = theme default. */
export function useColorOverride(key: string | undefined): string | undefined {
  return useAppStore((s) => (key ? s.card?.textColors?.[key] : undefined))
}
