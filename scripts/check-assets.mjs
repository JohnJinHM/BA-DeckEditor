// Cross-checks every sprite name referenced by the extracted tables against
// the files under public/assets/. Run after extract-assets.mjs; anything it
// prints is a name the app will 404 on (fix with a mapping in src/assets.ts).
//
//   node scripts/check-assets.mjs

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const DATA = join(ROOT, 'public/data/tables')
const ASSETS = join(ROOT, 'public/assets')

const table = async (name) => JSON.parse(await readFile(join(DATA, `${name}.json`), 'utf8'))

async function names(dir, ext) {
  try {
    const out = new Set()
    for (const f of await readdir(join(ASSETS, dir), { recursive: true })) {
      if (f.endsWith(ext)) out.add(f.replace(/\\/g, '/').slice(0, -ext.length))
    }
    return out
  } catch {
    return new Set()
  }
}

// Resolve names through the application's actual URL helpers, including case
// aliases and bare DLC portrait names. A remap must point to an existing file.
const source = ts.transpileModule(await readFile(join(ROOT, 'src/assets.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replaceAll('import.meta.env.BASE_URL', "'/'")
const assets = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const resolvedName = (resolver, dir, ext) => (name) =>
  decodeURIComponent(resolver(name)).replace(`/assets/${dir}/`, '').slice(0, -ext.length)
let failures = 0

function report(label, referenced, have, resolveName = (name) => name) {
  const refs = new Set([...referenced].filter(Boolean).map((n) => n.replace(/\\/g, '/')))
  const missing = [...refs].filter((n) => !have.has(resolveName(n)))
  failures += missing.length
  const known = [...refs].filter((n) => n !== resolveName(n) && have.has(resolveName(n))).length
  const status = missing.length ? `MISSING ${missing.length}` : `ok${known ? ` (${known} remapped)` : ''}`
  console.log(`${label.padEnd(16)} ${String(refs.size).padStart(5)} referenced  ${status}`)
  if (missing.length) console.log('   ', missing.slice(0, 30).join(', '))
}

const [units, weapons, ammo, countries, specs, options, mods] = await Promise.all(
  ['Units', 'Weapons', 'Ammunitions', 'Countries', 'Specializations', 'Options', 'Modifications'].map(table),
)

const collect = (rows, ...fields) => {
  const s = new Set()
  for (const r of rows) for (const f of fields) if (r[f]) s.add(r[f])
  return s
}

report('weapons', collect(weapons, 'HUDIcon'), await names('weapons', '.png'), resolvedName(assets.weaponIconUrl, 'weapons', '.png'))
report('ammo', collect(ammo, 'HUDIcon'), await names('ammo', '.png'))
report('flags', collect(countries, 'FlagFileName'), await names('flags', '.png'))
report('specs', collect(specs, 'Icon'), await names('specs', '.png'))
report(
  'illustrations',
  new Set([...collect(specs, 'Illustration')].map((s) => s.split(/[\\/]/).pop().replace(/\.png$/, ''))),
  await names('specs/illustrations', '.webp'),
)
report(
  'thumbnails',
  collect(units, 'ThumbnailFileName').union(collect(options, 'ThumbnailOverride')),
  await names('thumbnails', '.webp'),
)
report(
  'portraits',
  new Set(
    [...collect(units, 'PortraitFileName'), ...collect(options, 'PortraitOverride')].map((p) =>
      p.replace(/\\/g, '/'),
    ),
  ),
  await names('portraits', '.webp'),
  resolvedName(assets.portraitUrl, 'portraits', '.webp'),
)
// Options.OptionPicture art: partly Modifications sprites, partly weapon
// silhouettes — extract-assets.mjs collects both into one folder.
report(
  'option art',
  collect(options, 'OptionPicture').union(collect(mods, 'ThumbnailFileName')),
  await names('modifications', '.png'),
  resolvedName(assets.optionPictureUrl, 'modifications', '.png'),
)

process.exitCode = failures ? 1 : 0
