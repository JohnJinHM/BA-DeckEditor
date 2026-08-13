// End-to-end check of the real app: import each sample .dek through the UI,
// export it again, and diff the decrypted JSON against the file the game
// wrote. Anything the deck model drops or reorders shows up here.
//
//   npm run build && npx vite preview --port 4173
//   node scripts/e2e-roundtrip.mjs [baseUrl]

import { chromium } from 'playwright'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { webcrypto } from 'node:crypto'

globalThis.crypto ??= webcrypto

const BASE = process.argv[2] ?? 'http://localhost:4173/BA-DeckEditor/'
const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode('09234237536700238099172758697347'),
  { name: 'AES-CBC' },
  false,
  ['decrypt'],
)

async function decrypt(raw) {
  const body = raw.subarray(8)
  return new TextDecoder().decode(
    await crypto.subtle.decrypt({ name: 'AES-CBC', iv: body.subarray(0, 16) }, key, body.subarray(16)),
  )
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++)
    if (a[i] !== b[i])
      return `at ${i}\n  original: ${JSON.stringify(a.slice(Math.max(0, i - 60), i + 60))}\n  exported: ${JSON.stringify(b.slice(Math.max(0, i - 60), i + 60))}`
  return a.length === b.length ? null : `length ${a.length} vs ${b.length}`
}

/** The game writes each entry's option lists in an unstable (dictionary) order
 *  and nothing reads them positionally, so equality is judged with the lists
 *  sorted; byte-identity is reported separately as a bonus. */
function normalize(json) {
  const deck = JSON.parse(json)
  for (const entries of Object.values(deck.set2))
    for (const e of entries)
      for (const list of ['modList', 'modListTr'])
        e[list] = (e[list] ?? []).sort((x, y) => x.modId - y.modId)
  return JSON.stringify(deck, null, 2).replace(/\n/g, '\r\n')
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const problems = []
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.setup-dialog')
await page.click('.setup-actions button:not(.primary)')

let failures = 0
const samples = (await readdir(join(ROOT, 'samples'))).filter((f) => f.endsWith('.dek'))

for (const name of samples) {
  const raw = new Uint8Array(await readFile(join(ROOT, 'samples', name)))
  const expected = await decrypt(raw)

  await page.setInputFiles('input[type=file]', {
    name,
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(raw),
  })
  await page.waitForSelector('.slot-card:not(.empty)')

  // Export .dek, decrypt, and compare with the file we fed in.
  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export .dek' }).click()
  const path = await (await dl).path()
  const actual = await decrypt(new Uint8Array(await readFile(path)))

  const diff = firstDiff(normalize(expected), normalize(actual))
  if (diff) {
    failures++
    console.log(`FAIL  ${name} — re-exported deck differs ${diff}`)
  } else {
    const exact = expected === actual ? 'byte-identical' : 'option lists reordered only'
    console.log(`ok    ${name} — ${expected.length} bytes round-tripped (${exact})`)
  }
}

// ── phase 2: build a deck from scratch and round-trip that ─────────────────

const check = (ok, label, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
}
const totalSpent = () => page.locator('.total-value').innerText().then(Number)

console.log('\nbuilding a deck from scratch')
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.setup-dialog')
await page.fill('.setup-field input', 'e2e test')
await page.getByRole('button', { name: 'USA' }).click()
await page.locator('.spec-card', { hasText: 'Armored Brigade' }).click()
await page.locator('.spec-card', { hasText: 'USMC' }).click()
await page.click('.setup-actions button.primary')

await page.waitForSelector('.slot-strip')
check((await totalSpent()) === 0, 'a new deck starts at 0 points')
check((await page.locator('.slot-card').count()) === 7, 'recon has 7 slots (4 + 3)')

// one click on a pool unit = one copy
const first = page.locator('.pool-card:not([disabled])').first()
const listed = Number(await first.locator('.pool-cost').innerText())
await first.click()
await page.waitForSelector('.slot-card:not(.empty)')
check((await totalSpent()) === listed, 'one click on a unit adds exactly one copy', String(listed))
check(
  (await page.locator('.slot-card:not(.empty)').count()) === 1,
  'the copy lands in a single slot',
)

// clicking the same unit again steps that card's count up
await first.click()
check((await totalSpent()) === listed * 2, 'clicking the same unit again adds another copy')
check(
  (await page.locator('.slot-card:not(.empty)').count()) === 1,
  'repeat clicks grow the existing card rather than filling a new slot',
)
check(
  (await page.locator('.slot-card.active .slot-count').innerText()) === '×2',
  'the slot shows the new count',
)

const copies = 2
// a paid option adds exactly its delta, per copy
const paid = page.locator('.customization-unit .custom-row:not([disabled])').first()
/** Expand each customization row in `scope` until one offers a costed option
 *  that isn't already selected, pick it, and return its delta. */
const pickPaidOption = async (scope, label) => {
  const rows = page.locator(`${scope} .custom-row:not([disabled])`)
  for (let r = 0; r < (await rows.count()); r++) {
    await rows.nth(r).scrollIntoViewIfNeeded()
    await rows.nth(r).click()
    const choices = page.locator(`${scope} .custom-choice`)
    for (let i = 0; i < (await choices.count()); i++) {
      const cost = await choices.nth(i).locator('.custom-cost').innerText()
      const cls = (await choices.nth(i).getAttribute('class')) ?? ''
      if (cost.startsWith('+') && !cls.includes('active')) {
        await choices.nth(i).click()
        return Number(cost.slice(1))
      }
    }
    await rows.nth(r).click() // collapse and try the next slot
  }
  console.log(`  note  ${label}: no paid alternative to pick`)
  return null
}

if ((await paid.count()) > 0) {
  const before = await totalSpent()
  const delta = await pickPaidOption('.customization-unit', 'unit')
  if (delta != null)
    check(
      (await totalSpent()) === before + delta * copies,
      'a paid option adds its delta once per copy',
      `+${delta} × ${copies}`,
    )
}

// an infantry squad: pick a transport, then customize the vehicle too
await page.locator('.category-row', { hasText: 'Infantry' }).click()
await page.waitForTimeout(200)
const squad = page.locator('.pool-card:not([disabled])').first()
await squad.click()
await squad.click()
await page.waitForSelector('.transport-btn')
const squadCopies = 2

const transportBtn = page.locator('.transport-btn').nth(1)
const before = await totalSpent()
await transportBtn.click()
await page.waitForSelector('#transport-card-root')
const transportTotal = Number(await page.locator('.stepper-cost').nth(1).innerText())
check(
  (await totalSpent()) === before + transportTotal,
  'adding a transport charges it once per squad copy',
  `${transportTotal} for ${squadCopies}`,
)
check(
  (await page.locator('#transport-card-root').count()) === 1,
  'the transport gets its own unit card',
)

const withTransport = await totalSpent()
const delta = await pickPaidOption('.customization-transport', 'transport')
if (delta != null)
  check(
    (await totalSpent()) === withTransport + delta * squadCopies,
    'the transport has its own customization options',
    `+${delta} × ${squadCopies}`,
  )

// A variant that swaps the Units row must swap the label art with it. Scout
// Snipers' "M107 AMR" is the USMC counterpart of the SSO case: the option
// carries both ReplaceUnitId and ThumbnailOverride.
await page.locator('.category-row', { hasText: 'Reconnaissance' }).click()
await page.fill('.pool-search', 'Scout Snipers')
await page.waitForSelector('.pool-card')
await page.locator('.pool-card').first().click()
await page.waitForSelector('.customization-unit')

const nameBefore = await page.locator('.slot-card.active .slot-name').innerText()
const thumbBefore = await page.locator('.slot-card.active .slot-thumb').getAttribute('src')
const loadout = page.locator('.customization-unit .custom-row:not([disabled])').first()
await loadout.scrollIntoViewIfNeeded()
await loadout.click()
await page.locator('.customization-unit .custom-choice:not(.active)').first().click()

const thumbAfter = await page.locator('.slot-card.active .slot-thumb').getAttribute('src')
check(thumbAfter !== thumbBefore, 'a unit-swapping variant updates the slot thumbnail',
  `${thumbBefore?.split('/').pop()} → ${thumbAfter?.split('/').pop()}`)
check(
  thumbAfter?.includes('M107'),
  'the thumbnail is the variant’s own label art',
  String(thumbAfter?.split('/').pop()),
)
check(
  (await page.locator('.slot-card.active .slot-name').innerText()) !== nameBefore ||
    thumbAfter !== thumbBefore,
  'the slot reflects the variant',
)
check(
  (await page.locator('.pool-card.in-deck .pool-thumb').first().getAttribute('src')) ===
    thumbBefore,
  'the pool keeps showing the default loadout’s art',
)

// export what we built and read it straight back in
const built = page.waitForEvent('download')
await page.getByRole('button', { name: 'Export .dek' }).click()
const builtPath = await (await built).path()
const builtJson = await decrypt(new Uint8Array(await readFile(builtPath)))
const spent = await totalSpent()

await page.setInputFiles('input[type=file]', {
  name: 'e2e test.dek',
  mimeType: 'application/octet-stream',
  buffer: Buffer.from(await readFile(builtPath)),
})
await page.waitForSelector('.slot-card:not(.empty)')
check((await totalSpent()) === spent, 're-importing the exported deck restores the same total', String(spent))

const again = page.waitForEvent('download')
await page.getByRole('button', { name: 'Export .dek' }).click()
const againJson = await decrypt(new Uint8Array(await readFile(await (await again).path())))
check(builtJson === againJson, 'export → import → export is byte-stable')

await browser.close()
for (const p of problems) console.log(p)
if (problems.length) failures++
console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
