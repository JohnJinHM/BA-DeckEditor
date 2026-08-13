// Drives the built app in a headless browser and captures the main screens.
// Run `npm run build && npx vite preview --port 4173` first, or pass a URL.
//
//   node scripts/dev-screenshot.mjs [baseUrl]

import { chromium } from 'playwright'
import { mkdir, readFile } from 'node:fs/promises'
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

// 2. import a sample deck instead of creating one
await page.click('.setup-actions button:not(.primary)')
const dek = await readFile(join(ROOT, 'samples/_mech+vdv.dek'))
await page.setInputFiles('input[type=file]', {
  name: '_mech+vdv.dek',
  mimeType: 'application/octet-stream',
  buffer: dek,
})
await page.waitForSelector('.slot-card.active .slot-name')
await page.waitForTimeout(600)
await page.screenshot({ path: join(OUT, '2-deck.png') })

// 3. expanded card + an open customization row
await page.click('.segmented button:nth-child(2)')
await page.waitForTimeout(300)
await page.screenshot({ path: join(OUT, '3-expanded.png') })

// 4. an aircraft slot: several customization rows, one expanded
await page.locator('.category-row', { hasText: 'Aircraft' }).click()
await page.waitForTimeout(300)
await page.locator('.slot-strip .slot-card').first().click()
await page.waitForTimeout(400)
const row = page.locator('.card-panel .custom-row:not([disabled])').nth(1)
await row.scrollIntoViewIfNeeded()
await row.click()
await page.waitForTimeout(300)
await page.locator('.customization-unit').scrollIntoViewIfNeeded()
await page.locator('.card-panel').screenshot({ path: join(OUT, '4-customization.png') })
await page.screenshot({ path: join(OUT, '5-aircraft.png') })

// 5. an infantry squad with a transport — unit card + transport card stacked
await page.locator('.category-row', { hasText: 'Infantry' }).click()
await page.waitForTimeout(300)
await page.locator('.slot-strip .slot-card').nth(1).click()
await page.waitForTimeout(500)
await page.locator('#transport-card-root').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.locator('.card-panel').screenshot({
  path: join(OUT, '7-transport-card.png'),
  scale: 'css',
})

// 5. spec chooser
await page.click('.specs-chip')
await page.waitForSelector('.setup-dialog')
await page.waitForTimeout(400)
await page.screenshot({ path: join(OUT, '6-specs.png') })

await browser.close()

if (problems.length) {
  console.log(`${problems.length} problem(s):`)
  for (const p of [...new Set(problems)].slice(0, 40)) console.log('  ' + p)
  process.exitCode = 1
} else {
  console.log('no console errors or failed requests')
}
console.log(`screenshots -> ${OUT}`)
