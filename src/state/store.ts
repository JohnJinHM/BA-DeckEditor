import { create } from 'zustand'
import { GameDb, loadGameDb } from '../data/db'
import { resolveCard } from '../data/resolve'
import type { CardModel, CardStyle } from '../card/model'
import type { CategoryKey, Deck, DeckSlot, OptionSelection } from '../deck/model'
import { CATEGORIES, CATEGORY_BY_KEY, DEK_VERSION, emptySlot } from '../deck/model'
import { decodeDek, encodeDek, slotsForSpecs } from '../deck/dek'
import type { Bytes } from '../deck/dek'
import { availabilityMap, reconcileSelection } from '../deck/rules'

export type Lang = 'eng' | 'chi'

/** Which card the right-hand panel shows for the selected slot. */
export type CardTarget = 'unit' | 'transport'

interface SlotRef {
  category: CategoryKey
  index: number
}

interface AppState {
  db: GameDb | null
  lang: Lang
  loading: boolean
  error: string | null

  deck: Deck | null
  selected: SlotRef | null

  /** rendered card for the selected slot; consumed by the ported UnitCard */
  card: CardModel | null
  cardTarget: CardTarget
  compact: boolean
  style: CardStyle
  /** the card renderer's edit affordances are ported but switched off here */
  editMode: boolean
  colorTarget: string | null

  init(lang?: Lang): Promise<void>
  setLang(lang: Lang): Promise<void>

  newDeck(countryId: number, spec1: number, spec2: number, name: string): void
  setDeckName(name: string): void
  setSpecs(spec1: number, spec2: number): void

  selectSlot(category: CategoryKey, index: number): void
  setSlotUnit(unitId: number | null): void
  setSlotCount(count: number): void
  setSlotOption(modId: number, optionId: number): void
  setTransport(unitId: number | null): void
  setTransportCount(count: number): void
  setTransportOption(modId: number, optionId: number): void

  setCardTarget(target: CardTarget): void
  setCompact(compact: boolean): void
  setStyle(style: CardStyle): void
  setColorTarget(key: string | null): void
  updateCard(mutate: (card: CardModel) => void): void

  importDek(bytes: Bytes): Promise<void>
  exportDek(): Promise<Bytes>
}

/** Re-resolve the card for the current selection. Kept as a plain field so the
 *  ported renderer can read `s.card` exactly as it does in BA-ReCard. */
function renderCard(db: GameDb | null, deck: Deck | null, ref: SlotRef | null, target: CardTarget): CardModel | null {
  if (!db || !deck || !ref) return null
  const slot = deck.slots[ref.category]?.[ref.index]
  if (!slot) return null
  const unitId = target === 'transport' ? slot.transportId : slot.unitId
  if (unitId == null) return null
  const selection = target === 'transport' ? slot.transportOptions : slot.options
  try {
    return resolveCard(db, unitId, selection)
  } catch {
    return null
  }
}

/** First slot worth opening on: the first filled one, else the first slot of
 *  the first category the specs grant. */
function firstSlotRef(deck: Deck): SlotRef | null {
  const filled = CATEGORIES.find((c) => deck.slots[c.key].some((s) => s.unitId != null))
  if (filled)
    return { category: filled.key, index: deck.slots[filled.key].findIndex((s) => s.unitId != null) }
  const any = CATEGORIES.find((c) => deck.slots[c.key].length > 0)
  return any ? { category: any.key, index: 0 } : null
}

/** Apply `mutate` to the selected slot and re-render the card. */
function editSlot(state: AppState, mutate: (slot: DeckSlot) => void): Partial<AppState> {
  const { db, deck, selected, cardTarget } = state
  if (!deck || !selected) return {}
  const slots = deck.slots[selected.category]
  const slot = slots?.[selected.index]
  if (!slot) return {}
  const next: DeckSlot = {
    ...slot,
    options: { ...slot.options },
    transportOptions: { ...slot.transportOptions },
  }
  mutate(next)
  const nextDeck: Deck = {
    ...deck,
    slots: {
      ...deck.slots,
      [selected.category]: slots.map((s, i) => (i === selected.index ? next : s)),
    },
  }
  // A slot with no transport can't show a transport card.
  const target = cardTarget === 'transport' && next.transportId == null ? 'unit' : cardTarget
  return { deck: nextDeck, cardTarget: target, card: renderCard(db, nextDeck, selected, target) }
}

export const useAppStore = create<AppState>((set, get) => ({
  db: null,
  lang: 'eng',
  loading: true,
  error: null,

  deck: null,
  selected: null,

  card: null,
  cardTarget: 'unit',
  compact: true,
  style: 'new',
  editMode: false,
  colorTarget: null,

  async init(lang = 'eng') {
    try {
      const db = await loadGameDb(lang)
      set({ db, lang, loading: false, error: null })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) })
    }
  },

  async setLang(lang) {
    if (lang === get().lang) return
    const db = await loadGameDb(lang)
    const { deck, selected, cardTarget } = get()
    set({ db, lang, card: renderCard(db, deck, selected, cardTarget) })
  },

  newDeck(countryId, spec1, spec2, name) {
    const db = get().db
    if (!db) return
    const base: Deck = {
      name,
      countryId,
      spec1,
      spec2,
      version: DEK_VERSION,
      slots: Object.fromEntries(CATEGORIES.map((c) => [c.key, []])) as unknown as Deck['slots'],
    }
    const deck = { ...base, slots: slotsForSpecs(db, base) }
    set({ deck, selected: firstSlotRef(deck), cardTarget: 'unit', card: null })
  },

  setDeckName(name) {
    const deck = get().deck
    if (deck) set({ deck: { ...deck, name } })
  },

  setSpecs(spec1, spec2) {
    const { db, deck } = get()
    if (!db || !deck) return
    const next: Deck = { ...deck, spec1, spec2 }
    next.slots = slotsForSpecs(db, next)
    // Drop units the new pair cannot field, and clamp counts to the new limits.
    const available = availabilityMap(db, [spec1, spec2])
    for (const def of CATEGORIES) {
      next.slots[def.key] = next.slots[def.key].map((slot) => {
        if (slot.unitId == null) return slot
        const a = available.get(slot.unitId)
        if (!a) return emptySlot()
        const count = Math.min(slot.count, a.max)
        const keepTransport = slot.transportId != null && a.transports.includes(slot.transportId)
        return {
          ...slot,
          count,
          transportId: keepTransport ? slot.transportId : null,
          transportCount: keepTransport ? Math.min(slot.transportCount, count) : 0,
          transportOptions: keepTransport ? slot.transportOptions : {},
        }
      })
    }
    const prev = get().selected
    const selected =
      prev && prev.index < next.slots[prev.category].length ? prev : firstSlotRef(next)
    set({ deck: next, selected, card: renderCard(db, next, selected, 'unit'), cardTarget: 'unit' })
  },

  selectSlot(category, index) {
    const { db, deck } = get()
    const selected = { category, index }
    set({ selected, cardTarget: 'unit', card: renderCard(db, deck, selected, 'unit') })
  },

  setSlotUnit(unitId) {
    const db = get().db
    if (!db) return
    set((state) =>
      editSlot(state, (slot) => {
        if (unitId == null) {
          // Clearing keeps `cat`: the game leaves the stamp behind too.
          slot.unitId = null
          slot.count = 1
          slot.options = {}
          slot.unitSkinId = undefined
          slot.transportId = null
          slot.transportCount = 0
          slot.transportOptions = {}
          slot.transportSkinId = undefined
          return
        }
        const max = availabilityMap(db, [state.deck!.spec1, state.deck!.spec2]).get(unitId)?.max ?? 1
        const changed = slot.unitId !== unitId
        slot.unitId = unitId
        slot.cat = CATEGORY_BY_KEY.get(state.selected!.category)!.cat
        // Modifications belong to exactly one unit, so reconciling against a
        // different unit's selection just yields that unit's defaults.
        slot.options = reconcileSelection(db, unitId, slot.options)
        slot.count = changed ? max : Math.min(slot.count, max)
        if (changed) {
          slot.unitSkinId = undefined
          slot.transportId = null
          slot.transportCount = 0
          slot.transportOptions = {}
          slot.transportSkinId = undefined
        }
      }),
    )
  },

  setSlotCount(count) {
    const db = get().db
    if (!db) return
    set((state) =>
      editSlot(state, (slot) => {
        const max =
          slot.unitId == null
            ? 1
            : (availabilityMap(db, [state.deck!.spec1, state.deck!.spec2]).get(slot.unitId)?.max ?? 1)
        slot.count = Math.min(Math.max(1, count), max)
        if (slot.transportId != null) slot.transportCount = Math.min(slot.transportCount, slot.count)
      }),
    )
  },

  setSlotOption(modId, optionId) {
    set((state) => editSlot(state, (slot) => void (slot.options[modId] = optionId)))
  },

  setTransport(unitId) {
    const db = get().db
    if (!db) return
    set((state) =>
      editSlot(state, (slot) => {
        if (unitId == null) {
          // Going back on foot keeps the transport's option list, as the game
          // does — picking the same transport again restores the loadout.
          slot.transportId = null
          slot.transportCount = 0
          slot.transportSkinId = undefined
          return
        }
        if (slot.transportId !== unitId) {
          const changed = slot.transportId != null
          slot.transportId = unitId
          slot.transportOptions = reconcileSelection(db, unitId, slot.transportOptions)
          slot.transportCount = slot.count
          if (changed) slot.transportSkinId = undefined
        }
      }),
    )
  },

  setTransportCount(count) {
    set((state) =>
      editSlot(state, (slot) => {
        slot.transportCount = Math.min(Math.max(0, count), slot.count)
      }),
    )
  },

  setTransportOption(modId, optionId) {
    set((state) => editSlot(state, (slot) => void (slot.transportOptions[modId] = optionId)))
  },

  setCardTarget(target) {
    const { db, deck, selected } = get()
    set({ cardTarget: target, card: renderCard(db, deck, selected, target) })
  },

  setCompact(compact) {
    set({ compact })
  },
  setStyle(style) {
    set({ style })
  },
  setColorTarget(key) {
    set({ colorTarget: key })
  },
  updateCard(mutate) {
    const card = get().card
    if (!card) return
    const next = structuredClone(card)
    mutate(next)
    set({ card: next })
  },

  async importDek(bytes) {
    const db = get().db
    if (!db) throw new Error('Database not loaded')
    const deck = await decodeDek(db, bytes)
    const selected = firstSlotRef(deck)
    set({ deck, selected, cardTarget: 'unit', card: renderCard(db, deck, selected, 'unit') })
  },

  async exportDek() {
    const { db, deck } = get()
    if (!db || !deck) throw new Error('No battlegroup to export')
    return encodeDek(db, deck)
  },
}))

/** Selected slot, or null. */
export function useSelectedSlot(): DeckSlot | null {
  return useAppStore((s) =>
    s.deck && s.selected ? (s.deck.slots[s.selected.category]?.[s.selected.index] ?? null) : null,
  )
}

/** Option selection currently driving the card (unit or transport). */
export function useActiveSelection(): { unitId: number | null; selection: OptionSelection } {
  const slot = useSelectedSlot()
  const target = useAppStore((s) => s.cardTarget)
  if (!slot) return { unitId: null, selection: {} }
  return target === 'transport'
    ? { unitId: slot.transportId, selection: slot.transportOptions }
    : { unitId: slot.unitId, selection: slot.options }
}
