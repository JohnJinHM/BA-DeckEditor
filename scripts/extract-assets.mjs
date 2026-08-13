// Extracts the deck-editor-relevant assets from the game's AssetRipper export
// into public/assets/. Source locations are documented in
// BA-ReCard/docs/extracted/ASSETS.md; this script adds the deck layer
// (specialization icons/illustrations and Arsenal chrome).
//
//   node scripts/extract-assets.mjs [exportRoot]
//
// Portraits and unit thumbnails are recompressed to WebP (~310 MB of PNG →
// ~25 MB); everything else is copied verbatim.

import { mkdir, readdir, copyFile, readFile } from 'node:fs/promises'
import { join, basename, dirname, relative } from 'node:path'
import sharp from 'sharp'

const EXPORT_ROOT =
  process.argv[2] ??
  'C:/Users/jinha/Desktop/Temp/AssetRipper_export_20260813_021732/ExportedProject'
const SRC = join(EXPORT_ROOT, 'Assets')
const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const OUT = join(ROOT, 'public/assets')

const IMG = join(SRC, 'Prefabs/GUI/HUD/Images')
const MOVED = join(SRC, 'Resources_moved/Images')

async function copyPngs(srcDir, outDir, { recurse = false, filter = () => true } = {}) {
  await mkdir(outDir, { recursive: true })
  const entries = await readdir(srcDir, { withFileTypes: true, recursive: recurse })
  let n = 0
  for (const e of entries) {
    if (!e.isFile() || !e.name.toLowerCase().endsWith('.png') || !filter(e.name)) continue
    await copyFile(join(e.parentPath ?? e.path, e.name), join(outDir, e.name))
    n++
  }
  return n
}

/** PNG → WebP for one directory tree, mirroring its subfolders (thumbnails
 *  have an `outline/` variant folder that Options.ThumbnailOverride refers to
 *  by relative path, and portraits are `<COUNTRY>/<UNIT>/`). `filter` receives
 *  the path relative to `srcDir`, with forward slashes. */
async function webpTree(srcDir, outDir, { filter = () => true, quality = 85, recurse = false } = {}) {
  let n = 0
  for (const e of await readdir(srcDir, { withFileTypes: true, recursive: recurse })) {
    if (!e.isFile() || !e.name.endsWith('.png')) continue
    const dir = e.parentPath ?? e.path
    const rel = relative(srcDir, join(dir, e.name)).replace(/\\/g, '/')
    if (!filter(rel)) continue
    const dest = join(outDir, rel.replace(/\.png$/, '.webp'))
    await mkdir(dirname(dest), { recursive: true })
    await sharp(join(dir, e.name)).webp({ quality }).toFile(dest)
    n++
  }
  return n
}

/** Thumbnail/portrait names actually referenced by the unit table, so we skip
 *  the ~700 label pngs for cut content. */
async function referencedNames() {
  const units = JSON.parse(
    await readFile(join(ROOT, 'public/data/tables/Units.json'), 'utf8'),
  )
  const options = JSON.parse(
    await readFile(join(ROOT, 'public/data/tables/Options.json'), 'utf8'),
  )
  const thumbs = new Set()
  const add = (n) => n && thumbs.add(n.replace(/\\/g, '/'))
  for (const u of units) add(u.ThumbnailFileName)
  for (const o of options) add(o.ThumbnailOverride)
  const pictures = new Set(options.map((o) => o.OptionPicture).filter(Boolean))
  return { thumbs, pictures }
}

async function main() {
  const { thumbs, pictures } = await referencedNames()

  // 1. Infocard stat/trait/target icons — flattened
  let n = await copyPngs(join(IMG, 'Infocard'), join(OUT, 'icons'), { recurse: true })
  for (const rel of [
    'Menu/pinned.png',
    'Menu/pin.png',
    'Menu/Kinetic.png',
    'Menu/HEAT.png',
    'collapse.png',
    'expand.png',
    'ActionPanel/Ability_Radar.png',
    'ActionPanel/Order_Stop.png',
    'ActionPanel/FireMission/FM_Ammo_Smoke.png',
  ]) {
    await copyFile(join(IMG, rel), join(OUT, 'icons', basename(rel)))
    n++
  }
  console.log(`icons: ${n}`)

  // 2. Arsenal chrome (card gradients, deck slot art, category headers)
  console.log(
    'chrome:',
    await copyPngs(join(SRC, 'Prefabs/GUI/Arsenal/Images'), join(OUT, 'chrome')),
  )

  // 3. Weapon / ammo icons, flags — verbatim
  console.log('weapons:', await copyPngs(join(MOVED, 'Weapons/Icons'), join(OUT, 'weapons')))
  console.log('ammo:', await copyPngs(join(MOVED, 'Ammunition/Icons'), join(OUT, 'ammo')))
  console.log('flags:', await copyPngs(join(MOVED, 'Nations & Specs/Flags'), join(OUT, 'flags')))

  // 4. Specialization icons (Specializations.Icon) + illustrations
  const specs = join(MOVED, 'Nations & Specs/Specs')
  console.log('specs:', await copyPngs(specs, join(OUT, 'specs')))
  console.log(
    'spec illustrations:',
    await webpTree(join(specs, 'illustrations'), join(OUT, 'specs/illustrations'), {
      quality: 80,
    }),
  )

  // 5. Options.OptionPicture art. Three quarters of the names live in the
  //    Modifications folder and the rest are weapon silhouettes, so both land
  //    in one folder and src/assets.ts resolves a single path.
  let mods = await copyPngs(join(MOVED, 'Modifications'), join(OUT, 'modifications'), {
    recurse: true,
  })
  mods += await copyPngs(join(MOVED, 'Weapons/Icons'), join(OUT, 'modifications'), {
    filter: (f) => pictures.has(f.replace(/\.png$/, '')),
  })
  console.log(`modifications: ${mods}`)

  // 6. Fonts (Inter statics)
  await mkdir(join(OUT, 'fonts'), { recursive: true })
  let fonts = 0
  for (const f of await readdir(join(SRC, 'Font'))) {
    if (/^Inter-(Regular|Medium|SemiBold|Bold|ExtraBold)\.ttf$/.test(f)) {
      await copyFile(join(SRC, 'Font', f), join(OUT, 'fonts', f))
      fonts++
    }
  }
  console.log(`fonts: ${fonts}`)

  // 7. Unit thumbnails (deck slot art), referenced ones only, PNG → WebP.
  //    Keeps the `outline/` subfolder, which Options.ThumbnailOverride uses.
  console.log(
    'thumbnails:',
    await webpTree(join(MOVED, 'Labels/Icons'), join(OUT, 'thumbnails'), {
      recurse: true,
      filter: (rel) => thumbs.has(rel.replace(/\.png$/, '')),
    }),
  )

  // 8. Portraits: default variant only (skip _BASIC/_HOVER), PNG → WebP
  console.log(
    'portraits:',
    await webpTree(join(MOVED, 'UnitPortraits'), join(OUT, 'portraits'), {
      recurse: true,
      filter: (rel) => !/_BASIC\.png$|_HOVER\.png$/.test(rel),
    }),
  )
}

await main()
