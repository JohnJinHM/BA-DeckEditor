import { useState } from 'react'
import { useAppStore, useActiveSelection } from '../state/store'
import { iconUrl, optionPictureUrl } from '../assets'
import { modificationsOf, optionsOf } from '../deck/rules'
import type { ModificationRow, OptionRow } from '../data/types'
import { t } from './i18n'

/** Row icon per Modifications.Type. Type 3 covers the weapon packages, pylons
 *  and ammunition slots the reference screenshot shows with the cartridges
 *  icon; type 5 is the armor slot (shield); the rest fall back to the generic
 *  modification gear the game's "Unit Modification List Button" prefab wires. */
const SLOT_ICONS: Record<number, string> = {
  3: 'Resupply_Rearm',
  5: 'Modification Armor Slot Icon',
}
const DEFAULT_SLOT_ICON = 'Modification Icon'

/** Prettify option/slot keys the localization files don't cover
 *  ("Custom_Option_2xR73" → "2xR73"). */
function pretty(s: string): string {
  return s.replace(/^Custom_(Option|Slot)_/, '').replace(/_/g, ' ')
}

/**
 * The "Customization options" panel that sits under the unit card in game:
 * one row per modification — slot icon, slot name, the chosen option, and its
 * point delta. Clicking a row expands the choices for that slot.
 */
export function CustomizationPanel() {
  const db = useAppStore((s) => s.db)!
  const lang = useAppStore((s) => s.lang)
  const target = useAppStore((s) => s.cardTarget)
  const setSlotOption = useAppStore((s) => s.setSlotOption)
  const setTransportOption = useAppStore((s) => s.setTransportOption)
  const { unitId, selection } = useActiveSelection()
  const [open, setOpen] = useState<number | null>(null)

  if (unitId == null) return null
  const mods = modificationsOf(db, unitId)
  if (mods.length === 0) return null
  const choose = target === 'transport' ? setTransportOption : setSlotOption

  return (
    <section className="customization">
      <h3>{t(lang, 'customization')}</h3>
      {mods.map((mod) => (
        <ModRow
          key={mod.Id}
          mod={mod}
          options={optionsOf(db, mod.Id)}
          currentId={selection[mod.Id]}
          expanded={open === mod.Id}
          onToggle={() => setOpen(open === mod.Id ? null : mod.Id)}
          onPick={(optId) => {
            choose(mod.Id, optId)
            setOpen(null)
          }}
        />
      ))}
    </section>
  )
}

interface RowProps {
  mod: ModificationRow
  options: OptionRow[]
  currentId: number | undefined
  expanded: boolean
  onToggle(): void
  onPick(optionId: number): void
}

function ModRow({ mod, options, currentId, expanded, onToggle, onPick }: RowProps) {
  const db = useAppStore((s) => s.db)!
  const current = options.find((o) => o.Id === currentId) ?? options[0]
  const icon = SLOT_ICONS[mod.Type] ?? DEFAULT_SLOT_ICON

  return (
    <div className={`custom-row-group ${expanded ? 'expanded' : ''}`}>
      <button className="custom-row" onClick={onToggle} disabled={options.length < 2}>
        <img className="custom-icon" src={iconUrl(icon) ?? undefined} alt="" />
        <span className="custom-slot">{db.locOr(mod.UIName, pretty(mod.Name ?? ''))}</span>
        <span className="custom-option">
          {current ? db.locOr(current.UIName, pretty(current.Name ?? '')) : '—'}
        </span>
        <span className={`custom-cost ${current && current.Cost > 0 ? '' : 'zero'}`}>
          {current && current.Cost > 0 ? `+${current.Cost}` : '—'}
        </span>
      </button>
      {expanded && (
        <div className="custom-options">
          {options.map((o) => (
            <button
              key={o.Id}
              className={`custom-choice ${o.Id === current?.Id ? 'active' : ''}`}
              onClick={() => onPick(o.Id)}
            >
              <img className="custom-choice-art" src={optionPictureUrl(o.OptionPicture) ?? undefined} alt="" />
              <span className="custom-choice-name">{db.locOr(o.UIName, pretty(o.Name ?? ''))}</span>
              <span className={`custom-cost ${o.Cost > 0 ? '' : 'zero'}`}>
                {o.Cost > 0 ? `+${o.Cost}` : '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
