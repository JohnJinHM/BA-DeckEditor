import { useAppStore } from '../state/store'
import { UnitCard } from '../card/UnitCard'
import { CustomizationPanel } from './CustomizationPanel'
import { SlotEditor } from './SlotEditor'
import { t } from './i18n'

/**
 * Right column: the selected slot's unit card with its "Customization options"
 * panel beneath it, then — when the card rides a transport — the transport's
 * card and its own customization panel, so the vehicle is configured the same
 * way the squad is. The compact/expanded and legacy toggles apply to both.
 */
export function CardPanel() {
  const lang = useAppStore((s) => s.lang)
  const card = useAppStore((s) => s.card)
  const transportCard = useAppStore((s) => s.transportCard)
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

      <SlotEditor />

      {card ? (
        <>
          <UnitCard card={card} id="unit-card-root" />
          <CustomizationPanel target="unit" />
        </>
      ) : (
        <p className="empty-note">{t(lang, 'emptyWorkspace')}</p>
      )}

      {transportCard && (
        <>
          <div className="card-section-label">{t(lang, 'transportCard')}</div>
          <UnitCard card={transportCard} id="transport-card-root" />
          <CustomizationPanel target="transport" />
        </>
      )}
    </aside>
  )
}
