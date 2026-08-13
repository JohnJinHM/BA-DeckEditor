// Drives the built app in a headless browser and captures the main screens.
// Run `npm run build && npx vite preview --port 4173` first, or pass a URL.
//
//   node scripts/dev-screenshot.mjs [baseUrl]

import { chromium } from 'playwright'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const BASE = process.argv[2] ?? 'http://localhost:4173/BA-DeckEditor/'
const OUT = new URL('../.shots/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

await mkdir(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } })

const problems = []
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`)
})
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('response', (r) => {
  if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`)
})

await page.goto(BASE, { waitUntil: 'networkidle' })

// 1. the create-battlegroup dialog opens on a fresh visit
await page.waitForSelector('.setup-dialog')
await page.screenshot({ path: join(OUT, '1-setup.png') })

// 2. fill a deck: import a sample if one is checked out, else roll a random
//    one, so the shots work from a clean clone too
const dek = await sampleDeck()

async function sampleDeck() {
  try {
    const f = (await readdir(join(ROOT, 'samples'))).find((n) => n.endsWith('.dek'))
    return f ? await readFile(join(ROOT, 'samples', f)) : null
  } catch {
    return null
  }
}

/** Get `page` from the create dialog to a filled deck. */
async function fillDeck(page) {
  if (dek) {
    await page.click('.setup-actions button:not(.primary)')
    await page.setInputFiles('input[type=file]', {
      name: 'sample.dek',
      mimeType: 'application/octet-stream',
      buffer: dek,
    })
  } else {
    await page.locator('.spec-random').click()
    await page.click('.setup-actions button.primary')
    await page.getByRole('button', { name: 'Random' }).first().click()
    await page.waitForSelector('.setup-dialog.narrow')
    await page.locator('.setup-actions button', { hasText: 'Generate' }).click()
  }
  await page.waitForSelector('.slot-card:not(.empty)')
  await page.waitForTimeout(600)
}

await fillDeck(page)
await page.screenshot({ path: join(OUT, '2-deck.png') })

// 3. expanded card + an open customization row
await page.click('.segmented button:nth-child(2)')
await page.waitForTimeout(300)
await page.screenshot({ path: join(OUT, '3-expanded.png') })

/** Open the first filled slot of a category. Returns false if it has none —
 *  a randomly generated deck cannot promise any particular unit. */
async function openSlot(category) {
  const rail = page.locator('.category-row', { hasText: category })
  if ((await rail.count()) === 0) return false
  await rail.click()
  await page.waitForTimeout(300)
  const slot = page.locator('.slot-strip .slot-card:not(.empty)').first()
  if ((await slot.count()) === 0) return false
  await slot.click()
  await page.waitForTimeout(400)
  return true
}

// 4. an aircraft slot: several customization rows, one expanded
if (await openSlot('Aircraft')) {
  const row = page.locator('.card-panel .custom-row:not([disabled])').first()
  if ((await row.count()) > 0) {
    await row.scrollIntoViewIfNeeded()
    await row.click()
    await page.waitForTimeout(300)
  }
  const panel = page.locator('.customization-unit').first()
  if ((await panel.count()) > 0) await panel.scrollIntoViewIfNeeded()
  await page.locator('.card-panel').screenshot({ path: join(OUT, '4-customization.png') })
  await page.screenshot({ path: join(OUT, '5-aircraft.png') })
}

// 5. an infantry squad with a transport — unit card + transport card stacked
await openSlot('Infantry')
const withTransport = page.locator('.slot-strip .slot-card:has(.slot-transport)').first()
if ((await withTransport.count()) > 0) {
  await withTransport.click()
  await page.waitForTimeout(500)
  await page.locator('#transport-card-root').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.locator('.card-panel').screenshot({
    path: join(OUT, '7-transport-card.png'),
    scale: 'css',
  })
}

// 6. nation + spec chooser, showing what the change would cost the deck
await page.click('.specs-chip')
await page.waitForSelector('.setup-dialog')
await page.locator('.setup-dialog .nation-btn', { hasText: 'USA' }).click()
await page.locator('.spec-random').click()
await page.waitForTimeout(400)
await page.screenshot({ path: join(OUT, '6-specs.png') })
await page.locator('.setup-actions button', { hasText: 'Cancel' }).click()

// 7. the discard guard and the random-battlegroup panel
await page.getByRole('button', { name: 'New battlegroup' }).click()
await page.waitForSelector('.confirm-dialog')
await page.screenshot({ path: join(OUT, '8-discard-guard.png') })
await page.locator('.confirm-dialog button', { hasText: 'Cancel' }).click()

await page.getByRole('button', { name: 'Random' }).click()
if ((await page.locator('.confirm-dialog').count()) === 1)
  await page.locator('.confirm-dialog button', { hasText: 'Discard' }).click()
await page.waitForSelector('.setup-dialog.narrow')
await page.waitForTimeout(300)
await page.screenshot({ path: join(OUT, '9-random-panel.png') })
await page.locator('.setup-actions button', { hasText: 'Generate' }).click()
await page.waitForTimeout(1000)
await page.screenshot({ path: join(OUT, '10-random-deck.png') })

// ── portrait / narrow layouts ───────────────────────────────────────────────

for (const [label, viewport] of [
  ['phone', { width: 390, height: 844 }],
  ['tablet', { width: 820, height: 1180 }],
  ['portrait-monitor', { width: 1080, height: 1920 }],
]) {
  const p = await browser.newPage({ viewport, deviceScaleFactor: 1 })
  p.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console(${label}): ${m.text()}`)
  })
  p.on('pageerror', (e) => problems.push(`pageerror(${label}): ${e.message}`))
  await p.goto(BASE, { waitUntil: 'networkidle' })
  await p.waitForSelector('.setup-dialog')
  await p.screenshot({ path: join(OUT, `p1-${label}-setup.png`) })

  await fillDeck(p)
  await p.screenshot({ path: join(OUT, `p2-${label}-units.png`) })

  // the horizontal scrollers must not spill into the page
  const overflow = await p.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  if (overflow > 0) problems.push(`${label}: page scrolls horizontally by ${overflow}px`)

  const tab = p.locator('.pane-tabs button', { hasText: 'Card' })
  if ((await tab.count()) > 0) await tab.click()
  await p.waitForTimeout(500)
  await p.screenshot({ path: join(OUT, `p3-${label}-card.png`), fullPage: false })

  const cardWidth = await p
    .locator('#unit-card-root')
    .evaluate((el) => el.getBoundingClientRect().width)
  if (cardWidth > viewport.width)
    problems.push(`${label}: card is ${Math.round(cardWidth)}px wide in a ${viewport.width}px viewport`)

  await p.close()
}

await browser.close()

if (problems.length) {
  console.log(`${problems.length} problem(s):`)
  for (const p of [...new Set(problems)].slice(0, 40)) console.log('  ' + p)
  process.exitCode = 1
} else {
  console.log('no console errors or failed requests')
}
console.log(`screenshots -> ${OUT}`)
