import { useMemo, useState } from 'react'
import { useAppStore } from '../state/store'
import { flagUrl, specIconUrl, specIllustrationUrl } from '../assets'
import { CATEGORIES } from '../deck/model'
import { categoryBudget, categorySlots } from '../deck/rules'
import type { SpecializationRow } from '../data/types'
import { t } from './i18n'

interface Props {
  /** editing an existing deck's pair, rather than creating a new deck */
  mode: 'new' | 'specs'
  onClose(): void
}

/**
 * Nation + two-specialization chooser. The pair decides everything downstream:
 * the per-category slot counts and point budgets, and which units the deck can
 * field at all — so it previews the resulting budget table live.
 */
export function DeckSetup({ mode, onClose }: Props) {
  const db = useAppStore((s) => s.db)!
  const lang = useAppStore((s) => s.lang)
  const deck = useAppStore((s) => s.deck)
  const newDeck = useAppStore((s) => s.newDeck)
  const setSpecs = useAppStore((s) => s.setSpecs)

  const countries = useMemo(() => db.playableCountries(), [db])
  const [countryId, setCountryId] = useState(deck?.countryId ?? countries[0]?.Id ?? 1)
  const [picked, setPicked] = useState<number[]>(
    mode === 'specs' && deck ? [deck.spec1, deck.spec2] : [],
  )
  const [name, setName] = useState(deck?.name ?? db.locOr('ui_arsenal_newdeck_default_name', 'New battlegroup'))

  const specs = useMemo(() => db.countrySpecializations(countryId), [db, countryId])
  const chosen = picked
    .map((id) => db.specializations.get(id))
    .filter((s): s is SpecializationRow => !!s)
  const ready = chosen.length === 2

  function toggle(id: number) {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id)
      // keep the most recent two, dropping the older pick
      return prev.length < 2 ? [...prev, id] : [prev[1], id]
    })
  }

  function confirm() {
    if (!ready) return
    if (mode === 'new') newDeck(countryId, picked[0], picked[1], name.trim() || 'Battlegroup')
    else setSpecs(picked[0], picked[1])
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="setup-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="setup-head">
          <h2>{mode === 'new' ? t(lang, 'newDeck') : t(lang, 'changeSpecs')}</h2>
          <button className="icon-btn" onClick={onClose} title={t(lang, 'cancel')}>
            ×
          </button>
        </div>

        {mode === 'new' && (
          <>
            <label className="setup-field">
              <span>{t(lang, 'deckName')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
            </label>

            <h3>{db.locOr('ui_arsenal_newdeck_nation_choose', t(lang, 'chooseNation'))}</h3>
            <div className="nation-row">
              {countries.map((c) => (
                <button
                  key={c.Id}
                  className={`nation-btn ${c.Id === countryId ? 'active' : ''}`}
                  onClick={() => {
                    setCountryId(c.Id)
                    setPicked([])
                  }}
                >
                  <img src={flagUrl(c.FlagFileName) ?? undefined} alt="" />
                  <span>{db.loc(c.UIName) || c.Name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <h3>{db.locOr('ui_arsenal_newdeck_specs_choose', t(lang, 'chooseSpecs'))}</h3>
        <div className="spec-grid">
          {specs.map((s) => {
            const on = picked.includes(s.Id)
            return (
              <button
                key={s.Id}
                className={`spec-card ${on ? 'active' : ''}`}
                onClick={() => toggle(s.Id)}
                title={db.locOr(s.UIDescription, '')}
              >
                <img className="spec-art" src={specIllustrationUrl(s.Illustration) ?? undefined} alt="" />
                <img className="spec-badge" src={specIconUrl(s.Icon) ?? undefined} alt="" />
                <span className="spec-name">{db.locOr(s.UIName, s.Name)}</span>
                {on && <span className="spec-order">{picked.indexOf(s.Id) + 1}</span>}
              </button>
            )
          })}
        </div>

        {ready && (
          <table className="budget-preview">
            <thead>
              <tr>
                <th />
                <th>{t(lang, 'slots')}</th>
                <th>{t(lang, 'points')}</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.filter((def) => categorySlots(chosen, def) > 0).map((def) => (
                <tr key={def.key}>
                  <td>{db.locOr(def.locKey, def.fallback)}</td>
                  <td>{categorySlots(chosen, def)}</td>
                  <td>{categoryBudget(chosen, def)}</td>
                </tr>
              ))}
              <tr className="budget-total">
                <td>Σ</td>
                <td>{CATEGORIES.reduce((n, def) => n + categorySlots(chosen, def), 0)}</td>
                <td>{CATEGORIES.reduce((n, def) => n + categoryBudget(chosen, def), 0)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {mode === 'specs' && <p className="setup-warning">{t(lang, 'specChangeWarning')}</p>}

        <div className="setup-actions">
          <button onClick={onClose}>{t(lang, 'cancel')}</button>
          <button className="primary" disabled={!ready} onClick={confirm}>
            {mode === 'new' ? t(lang, 'create') : t(lang, 'apply')}
          </button>
        </div>
      </div>
    </div>
  )
}
