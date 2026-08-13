import { useAppStore } from '../state/store'
import { UnitCard } from '../card/UnitCard'
import { CustomizationPanel } from './CustomizationPanel'
import { SlotEditor } from './SlotEditor'
import { t } from './i18n'

/**
 * Right column: the selected card rendered by the ported BA-ReCard renderer,
 * its compact/expanded and legacy toggles, then the slot's quantity/transport
 * controls and the in-game "Customization options" list.
 */
export function CardPanel() {
  const lang = useAppStore((s) => s.lang)
  const card = useAppStore((s) => s.card)
  const compact = useAppStore((s) => s.compact)
  const setCompact = useAppStore((s) => s.setCompact)
  const style = useAppStore((s) => s.style)
  const setStyle = useAppStore((s) => s.setStyle)

  return (
    <aside className="card-panel">
      <div className="card-toolbar">
        <div className="segmented">
          <button className={compact ? 'active' : ''} onClick={() => setCompact(true)}>
            {t(lang, 'compact')}
          </button>
          <button className={compact ? '' : 'active'} onClick={() => setCompact(false)}>
            {t(lang, 'expanded')}
          </button>
        </div>
        <label className="legacy-toggle" title={t(lang, 'legacyHint')}>
          <input
            type="checkbox"
            checked={style === 'legacy'}
            onChange={(e) => setStyle(e.target.checked ? 'legacy' : 'new')}
          />
          {t(lang, 'legacy')}
        </label>
      </div>

      {card ? (
        <div className="card-stage">
          <UnitCard card={card} />
        </div>
      ) : (
        <p className="empty-note">{t(lang, 'emptyWorkspace')}</p>
      )}

      <SlotEditor />
      <CustomizationPanel />
    </aside>
  )
}
