import { useSyncExternalStore } from 'react'

/** Subscribe to a CSS media query. Layout that needs a different component
 *  tree (rather than different CSS) keys off this — see App's narrow layout. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false, // SSR/prerender: assume the wide layout
  )
}

/** Below this the vertical category rail stops paying for its 240px: the
 *  categories become a chip bar above the slots and the workspace stacks. */
export const STACKED_QUERY = '(max-width: 1199px)'

/** Below this the unit pool and the card can no longer sit side by side, so
 *  they become two panes with a Units/Card switch. Above it — a tall portrait
 *  monitor, say — both stay visible. */
export const TABBED_QUERY = '(max-width: 899px)'

/** Compact toolbar labels; below this the full ones wrap to three rows. */
export const COMPACT_QUERY = '(max-width: 720px)'
