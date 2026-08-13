// .dek codec — reads and writes the game's own battlegroup files.
//
// A .dek is the same encrypted envelope the game uses for its unit database,
// only stored raw instead of Base64:
//
//     "fhk3s0g3" (8B) | IV (16B) | AES-256-CBC( PKCS7( UTF-8 JSON ) )
//
// See docs/DECK_FORMAT.md for the JSON schema and how it was recovered.

import type { CategoryKey, Deck, DeckSlot, OptionSelection } from './model'
import { CATEGORIES, DEK_VERSION, emptySlot } from './model'
import type { GameDb } from '../data/db'
import { categorySlots, reconcileSelection, specsOf } from './rules'

/** A standalone byte buffer — WebCrypto and Blob reject the SharedArrayBuffer
 *  case that plain `Uint8Array` allows. */
export type Bytes = Uint8Array<ArrayBuffer>

const MARKER = 'fhk3s0g3'
/** AES-256 key, the UTF-8 bytes of this literal; baked into the game's native
 *  code (BrokenArrow.Core.Security.EncryptedFileManager). */
const KEY_TEXT = '09234237536700238099172758697347'

// ── wire format ─────────────────────────────────────────────────────────────

/** One chosen option. `cost`/`run`/`cwun` duplicate the Options row's Cost,
 *  ReplaceUnitName and ConcatenateWithUnitName; `type` is 0 throughout the
 *  shipped decks. All four are written back verbatim. */
interface DekMod {
  modId: number
  optId: number
  cost: number
  run: string | null
  cwun: string | null
  type: number
}

/** Field order matches the game's serializer; absent numbers are omitted
 *  rather than written as null (empty slots carry only cat/slot/modLists). */
interface DekEntry {
  tranSkinId?: number
  unitId?: number
  unitSkinId?: number
  cat: number
  slot: number
  tranId?: number
  modList: DekMod[]
  modListTr: DekMod[]
  count?: number
  tranCount?: number
}

interface DekFile {
  set2: Record<CategoryKey, DekEntry[]>
  v: number
  name: string
  spec1: number
  spec2: number
  country: number
}

// ── crypto ──────────────────────────────────────────────────────────────────

let keyPromise: Promise<CryptoKey> | null = null

function aesKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(KEY_TEXT),
    { name: 'AES-CBC' },
    false,
    ['encrypt', 'decrypt'],
  )
  return keyPromise
}

async function decryptBytes(raw: Bytes): Promise<string> {
  const marker = new TextDecoder().decode(raw.subarray(0, MARKER.length))
  if (marker !== MARKER)
    throw new Error('Not a Broken Arrow .dek file (missing "fhk3s0g3" marker)')
  const body = raw.subarray(MARKER.length)
  const iv = body.subarray(0, 16)
  const ciphertext = body.subarray(16)
  // WebCrypto's AES-CBC strips PKCS#7 padding for us.
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    await aesKey(),
    ciphertext,
  )
  return new TextDecoder().decode(plain)
}

async function encryptText(text: string): Promise<Bytes> {
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv },
      await aesKey(),
      new TextEncoder().encode(text),
    ),
  )
  const marker = new TextEncoder().encode(MARKER)
  const out = new Uint8Array(marker.length + iv.length + ciphertext.length)
  out.set(marker, 0)
  out.set(iv, marker.length)
  out.set(ciphertext, marker.length + iv.length)
  return out
}

// ── JSON text ───────────────────────────────────────────────────────────────

/** The game writes two-space-indented JSON with CRLF line breaks (Newtonsoft's
 *  Formatting.Indented on Windows). Reproducing both keeps a re-exported file
 *  byte-identical to the one the game wrote. */
function serialize(file: DekFile): string {
  return JSON.stringify(file, null, 2).replace(/\n/g, '\r\n')
}

// ── deck ⇄ wire ─────────────────────────────────────────────────────────────

/** Options are written in the order the game's customization panel lists them
 *  (Modifications.Order, then Id). The game's own files use an unstable order
 *  — a dictionary walk — but nothing reads modList positionally, so a stable
 *  one is both valid and diff-friendly. */
function toDekMods(db: GameDb, selection: OptionSelection): DekMod[] {
  const mods: DekMod[] = []
  for (const [key, optId] of Object.entries(selection)) {
    const opt = db.options.get(optId)
    if (!opt) continue
    const modId = Number(key)
    mods.push({
      modId,
      optId,
      cost: opt.Cost,
      run: opt.ReplaceUnitName ?? null,
      cwun: opt.ConcatenateWithUnitName ?? null,
      type: 0,
    })
  }
  const rank = (m: DekMod) => db.modifications.get(m.modId)?.Order ?? 0
  return mods.sort((a, b) => rank(a) - rank(b) || a.modId - b.modId)
}

function fromDekMods(mods: DekMod[] | undefined): OptionSelection {
  const sel: OptionSelection = {}
  for (const m of mods ?? []) sel[m.modId] = m.optId
  return sel
}

/** Assigned in DekEntry's declared order — JSON.stringify writes insertion
 *  order, and matching the game's keeps re-exported files byte-identical. */
function toDekEntry(db: GameDb, slot: DeckSlot, index: number): DekEntry {
  const entry = {} as DekEntry
  if (slot.transportSkinId != null) entry.tranSkinId = slot.transportSkinId
  if (slot.unitId != null) entry.unitId = slot.unitId
  if (slot.unitSkinId != null) entry.unitSkinId = slot.unitSkinId
  entry.cat = slot.cat
  entry.slot = index
  if (slot.transportId != null) entry.tranId = slot.transportId
  entry.modList = slot.unitId != null ? toDekMods(db, slot.options) : []
  // `modListTr` outlives the transport: switching a card back to "on foot"
  // leaves the last transport's option list in the file, and the game reloads
  // it when a transport is picked again.
  entry.modListTr = toDekMods(db, slot.transportOptions)
  if (slot.unitId != null) entry.count = slot.count
  if (slot.transportId != null) entry.tranCount = slot.transportCount
  return entry
}

function fromDekEntry(entry: DekEntry): DeckSlot {
  const slot = emptySlot()
  slot.cat = entry.cat ?? 0
  if (entry.unitId != null) {
    slot.unitId = entry.unitId
    slot.count = entry.count ?? 1
    slot.options = fromDekMods(entry.modList)
  }
  if (entry.unitSkinId != null) slot.unitSkinId = entry.unitSkinId
  slot.transportOptions = fromDekMods(entry.modListTr)
  if (entry.tranId != null) {
    slot.transportId = entry.tranId
    slot.transportCount = entry.tranCount ?? 0
  }
  if (entry.tranSkinId != null) slot.transportSkinId = entry.tranSkinId
  return slot
}

/** Resize every category's slot array to what the two specs grant. Imported
 *  files can carry more entries than the current pair allows (or fewer, after
 *  a spec change); slots past the limit are dropped, missing ones appended. */
export function slotsForSpecs(db: GameDb, deck: Deck): Record<CategoryKey, DeckSlot[]> {
  const specs = specsOf(db, deck)
  const out = {} as Record<CategoryKey, DeckSlot[]>
  for (const def of CATEGORIES) {
    const want = categorySlots(specs, def)
    const have = deck.slots[def.key] ?? []
    const next = have.slice(0, want)
    while (next.length < want) next.push(emptySlot())
    out[def.key] = next
  }
  return out
}

// ── public API ──────────────────────────────────────────────────────────────

export async function decodeDek(db: GameDb, bytes: Bytes): Promise<Deck> {
  let file: DekFile
  try {
    file = JSON.parse(await decryptBytes(bytes)) as DekFile
  } catch (e) {
    if (e instanceof Error && e.message.includes('marker')) throw e
    throw new Error('Could not read this .dek file — it may be corrupt or from a newer build.')
  }
  if (!file || typeof file !== 'object' || !file.set2)
    throw new Error('Not a battlegroup file (no "set2" section).')

  const slots = {} as Record<CategoryKey, DeckSlot[]>
  for (const def of CATEGORIES)
    slots[def.key] = (file.set2[def.key] ?? []).map((entry) => {
      const slot = fromDekEntry(entry)
      // A deck saved by an older build can miss a modification added since;
      // filling it with its default keeps every selection complete, which is
      // what both the card resolver and the exporter expect.
      if (slot.unitId != null) slot.options = reconcileSelection(db, slot.unitId, slot.options)
      if (slot.transportId != null)
        slot.transportOptions = reconcileSelection(db, slot.transportId, slot.transportOptions)
      return slot
    })

  const deck: Deck = {
    name: file.name ?? 'Imported battlegroup',
    countryId: file.country,
    spec1: file.spec1,
    spec2: file.spec2,
    version: file.v ?? DEK_VERSION,
    slots,
  }
  deck.slots = slotsForSpecs(db, deck)
  return deck
}

export async function encodeDek(db: GameDb, deck: Deck): Promise<Bytes> {
  const set2 = {} as Record<CategoryKey, DekEntry[]>
  for (const def of CATEGORIES)
    set2[def.key] = (deck.slots[def.key] ?? []).map((s, i) => toDekEntry(db, s, i))
  const file: DekFile = {
    set2,
    v: deck.version || DEK_VERSION,
    name: deck.name,
    spec1: deck.spec1,
    spec2: deck.spec2,
    country: deck.countryId,
  }
  return encryptText(serialize(file))
}
