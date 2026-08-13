// Round-trips the sample .dek files through the app's codec and rules:
// decode → re-encode → compare the decrypted JSON byte-for-byte, then re-derive
// each deck's point totals and check them against the category budgets.
//
//   node scripts/verify-dek.mjs [file.dek ...]
//
// Node runs the same crypto.subtle the browser build uses, so this exercises
// src/deck/dek.ts's real code path with a hand-rolled loader for the two TS
// modules it needs (no bundler in the loop).

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { webcrypto } from 'node:crypto'

globalThis.crypto ??= webcrypto

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const DATA = join(ROOT, 'public/data')

const MARKER = 'fhk3s0g3'
const KEY_TEXT = '09234237536700238099172758697347'

const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(KEY_TEXT),
  { name: 'AES-CBC' },
  false,
  ['encrypt', 'decrypt'],
)

async function decrypt(raw) {
  if (new TextDecoder().decode(raw.subarray(0, 8)) !== MARKER) throw new Error('bad marker')
  const body = raw.subarray(8)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: body.subarray(0, 16) },
    key,
    body.subarray(16),
  )
  return new TextDecoder().decode(plain)
}

async function encrypt(text) {
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, new TextEncoder().encode(text)),
  )
  const out = new Uint8Array(8 + 16 + ct.length)
  out.set(new TextEncoder().encode(MARKER), 0)
  out.set(iv, 8)
  out.set(ct, 24)
  return out
}

// ── the rules under test, mirrored from src/deck/rules.ts ───────────────────

const CATEGORIES = [
  ['Recon', 'ReconSlots', 'ReconPoints'],
  ['Infantry', 'InfantrySlots', 'InfantryPoints'],
  ['GroundCombatVehicles', 'CombatSlots', 'CombatPoints'],
  ['Support', 'SupportSlots', 'SupportPoints'],
  ['Logistic', 'LogisticsSlots', 'LogisticsPoints'],
  ['Helicopters', 'HelicoptersSlots', 'HelicoptersPoints'],
  ['Aircrafts', 'AirSlots', 'AirPoints'],
]
const MAX_CATEGORY_SLOTS = 7
const CATEGORY_OVERSPEND = 0.1

const table = async (n) => JSON.parse(await readFile(join(DATA, 'tables', `${n}.json`), 'utf8'))
const byId = (rows) => new Map(rows.map((r) => [r.Id, r]))

const units = byId(await table('Units'))
const options = byId(await table('Options'))
const specs = byId(await table('Specializations'))
const countries = byId(await table('Countries'))
const availability = new Map()
for (const r of await table('SpecializationAvailabilities'))
  availability.set(`${r.SpecializationId}:${r.UnitId}`, r)
const transportsBySa = new Map()
for (const r of await table('TransportAvailabilities')) {
  const list = transportsBySa.get(r.SpecializationAvailabilityId) ?? []
  list.push(r.UnitId)
  transportsBySa.set(r.SpecializationAvailabilityId, list)
}

const price = (unitId, mods) =>
  (units.get(unitId)?.Cost ?? 0) + mods.reduce((n, m) => n + (options.get(m.optId)?.Cost ?? 0), 0)

// ── checks ──────────────────────────────────────────────────────────────────

let failures = 0
const check = (ok, label, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
}

const files =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : (await readdir(join(ROOT, 'samples')))
        .filter((f) => f.endsWith('.dek'))
        .map((f) => join(ROOT, 'samples', f))

for (const path of files) {
  const raw = new Uint8Array(await readFile(path))
  const json = await decrypt(raw)
  const deck = JSON.parse(json)
  console.log(`\n${path}  (${units.get(0) ? '' : ''}${json.length} bytes of JSON)`)

  // 1. re-serialize exactly as src/deck/dek.ts does
  const reserialized = JSON.stringify(deck, null, 2).replace(/\n/g, '\r\n')
  check(reserialized === json, 'JSON serializer reproduces the game byte-for-byte')

  // 2. encrypt → decrypt → same text
  check((await decrypt(await encrypt(json))) === json, 'encrypt/decrypt round-trip')

  // 3. rules
  const s1 = specs.get(deck.spec1)
  const s2 = specs.get(deck.spec2)
  check(!!s1 && !!s2, 'both specializations resolve', `${s1?.Name} + ${s2?.Name}`)
  check(
    s1.CountryId === deck.country && s2.CountryId === deck.country,
    'specializations belong to the deck country',
    countries.get(deck.country)?.Name,
  )

  let total = 0
  for (const [cat, slotField, pointField] of CATEGORIES) {
    const entries = deck.set2[cat] ?? []
    const slots = Math.min(MAX_CATEGORY_SLOTS, s1[slotField] + s2[slotField])
    const budget = s1[pointField] + s2[pointField]
    const cap = Math.round(budget * (1 + CATEGORY_OVERSPEND))
    let spent = 0
    for (const e of entries) {
      if (e.unitId == null) continue
      spent += price(e.unitId, e.modList) * e.count
      if (e.tranId != null) spent += price(e.tranId, e.modListTr) * e.tranCount
      // availability + transport legality
      const rows = [deck.spec1, deck.spec2]
        .map((s) => availability.get(`${s}:${e.unitId}`))
        .filter(Boolean)
      const max = Math.max(0, ...rows.map((r) => r.MaxAvailabilityXp0))
      if (e.count > max) check(false, `${cat}: ${units.get(e.unitId).Name} count ${e.count} > ${max}`)
      if (e.tranId != null) {
        const allowed = rows.flatMap((r) => transportsBySa.get(r.Id) ?? [])
        if (!allowed.includes(e.tranId))
          check(false, `${cat}: ${units.get(e.tranId).Name} is not a legal transport`)
        if (e.tranCount > e.count)
          check(false, `${cat}: tranCount ${e.tranCount} > count ${e.count}`)
      }
    }
    total += spent
    check(entries.length === slots, `${cat}: ${entries.length} entries == ${slots} slots`)
    check(spent <= cap, `${cat}: ${spent} <= cap ${cap}`, `(budget ${budget})`)
  }
  const maxPoints = countries.get(deck.country)?.MaxPoints ?? 10000
  check(total <= maxPoints, `total ${total} <= ${maxPoints}`)
  console.log(`  total: ${total} / ${maxPoints}`)
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
