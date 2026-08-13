import { useEffect, useState } from 'react'
import { useAppStore } from './state/store'
import { DeckToolbar } from './ui/DeckToolbar'
import { DeckSetup } from './ui/DeckSetup'
import { CategoryRail } from './ui/CategoryRail'
import { SlotStrip } from './ui/SlotStrip'
import { UnitPool } from './ui/UnitPool'
import { CardPanel } from './ui/CardPanel'
import { t } from './ui/i18n'
import './app.css'

export default function App() {
  const db = useAppStore((s) => s.db)
  const lang = useAppStore((s) => s.lang)
  const loading = useAppStore((s) => s.loading)
  const error = useAppStore((s) => s.error)
  const deck = useAppStore((s) => s.deck)
  const init = useAppStore((s) => s.init)
  const [setup, setSetup] = useState<'new' | 'specs' | null>(null)

  useEffect(() => {
    void init()
  }, [init])

  // A fresh visit has no deck; open the create dialog once the data is in.
  useEffect(() => {
    if (db && !deck) setSetup((s) => s ?? 'new')
  }, [db, deck])

  if (loading) return <div className="splash">{t(lang, 'loading')}</div>
  if (error || !db)
    return (
      <div className="splash error">
        {t(lang, 'loadFailed')}: {error}
      </div>
    )

  return (
    <div className="app">
      <DeckToolbar onNewDeck={() => setSetup('new')} onChangeSpecs={() => setSetup('specs')} />
      {deck ? (
        <main className="workspace">
          <CategoryRail />
          <section className="deck-column">
            <SlotStrip />
            <UnitPool />
          </section>
          <CardPanel />
        </main>
      ) : (
        <main className="workspace empty" />
      )}
      {setup && <DeckSetup mode={setup} onClose={() => setSetup(null)} />}
      <a
        className="source-link"
        href="https://github.com/JohnJinHM/BA-DeckEditor"
        target="_blank"
        rel="noreferrer"
        title={t(lang, 'viewSource')}
      >
        GitHub
      </a>
    </div>
  )
}
