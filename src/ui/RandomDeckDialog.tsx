import { useState } from 'react'
import { useAppStore } from '../state/store'
import { DEFAULT_TARGET, randomCountry, randomSpecs } from '../deck/random'
import { totalBudget } from '../deck/rules'
import { t } from './i18n'

/** Roll a whole battlegroup: every category filled with random units and
 *  variants, spent up to a point target. */
export function RandomDeckDialog({ onClose }: { onClose(): void }) {
  const db = useAppStore((s) => s.db)!
  const lang = useAppStore((s) => s.lang)
  const deck = useAppStore((s) => s.deck)!
  const setSpecs = useAppStore((s) => s.setSpecs)
  const randomizeDeck = useAppStore((s) => s.randomizeDeck)

  const cap = totalBudget(db, deck)
  const [target, setTarget] = useState(Math.min(DEFAULT_TARGET, cap))
  const [rerollSpecs, setRerollSpecs] = useState(false)

  function generate() {
    if (rerollSpecs) {
      const countryId = randomCountry(db)
      const pair = randomSpecs(db, countryId)
      if (pair) setSpecs(countryId, pair[0], pair[1])
    }
    randomizeDeck({ target: Math.max(0, Math.min(target, cap)) })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="setup-dialog narrow" onClick={(e) => e.stopPropagation()}>
        <div className="setup-head">
          <h2>{t(lang, 'randomDeck')}</h2>
          <button className="icon-btn" onClick={onClose} title={t(lang, 'cancel')}>
            ×
          </button>
        </div>

        <p className="setup-note">{t(lang, 'randomDeckHint')}</p>

        <label className="setup-field">
          <span>{t(lang, 'targetPoints')}</span>
          <input
            type="number"
            min={0}
            max={cap}
            step={100}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
          <em className="setup-suffix">/ {cap}</em>
        </label>

        <label className="setup-check">
          <input
            type="checkbox"
            checked={rerollSpecs}
            onChange={(e) => setRerollSpecs(e.target.checked)}
          />
          {t(lang, 'randomizeSpecsToo')}
        </label>

        <div className="setup-actions">
          <button onClick={onClose}>{t(lang, 'cancel')}</button>
          <button className="primary" onClick={generate}>
            {t(lang, 'generate')}
          </button>
        </div>
      </div>
    </div>
  )
}
