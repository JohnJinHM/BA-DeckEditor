import { useEffect, useState } from 'react'
import { useAppStore } from './state/store'
import { DeckToolbar } from './ui/DeckToolbar'
import { DeckSetup } from './ui/DeckSetup'
import { RandomDeckDialog } from './ui/RandomDeckDialog'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { CategoryRail } from './ui/CategoryRail'
import { SlotStrip } from './ui/SlotStrip'
import { UnitPool } from './ui/UnitPool'
import { CardPanel } from './ui/CardPanel'
import { filledSlotCount } from './deck/rules'
import { t } from './ui/i18n'
import './app.css'

export default function App() {
  const db = useAppStore((s) => s.db)
  const lang = useAppStore((s) => s.lang)
  const loading = useAppStore((s) => s.loading)
  const error = useAppStore((s) => s.error)
  const deck = useAppStore((s) => s.deck)
  const init = useAppStore((s) => s.init)
  const [dialog, setDialog] = useState<'new' | 'specs' | 'random' | null>(null)
  /** action held back until the user confirms losing the current deck */
  const [pending, setPending] = useState<(() => void) | null>(null)

  useEffect(() => {
    void init()
  }, [init])

  // A fresh visit has no deck; open the create dialog once the data is in.
  useEffect(() => {
    if (db && !deck) setDialog((d) => d ?? 'new')
  }, [db, deck])

  if (loading) return <div className="splash">{t(lang, 'loading')}</div>
  if (error || !db)
    return (
      <div className="splash error">
        {t(lang, 'loadFailed')}: {error}
      </div>
    )

  const filled = deck ? filledSlotCount(deck) : 0
  /** Run `action`, but confirm first if it would discard cards. */
  const guardDiscard = (action: () => void) => (filled > 0 ? setPending(() => action) : action())

  return (
    <div className="app">
      <DeckToolbar
        onNewDeck={() => setDialog('new')}
        onChangeSpecs={() => setDialog('specs')}
        onRandomDeck={() => setDialog('random')}
        guardDiscard={guardDiscard}
      />
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

      {(dialog === 'new' || dialog === 'specs') && (
        <DeckSetup mode={dialog} onClose={() => setDialog(null)} />
      )}
      {dialog === 'random' && <RandomDeckDialog onClose={() => setDialog(null)} />}
      {pending && (
        <ConfirmDialog
          title={t(lang, 'discardTitle')}
          body={t(lang, 'discardBody').replace('{n}', String(filled))}
          confirmLabel={t(lang, 'discardConfirm')}
          onConfirm={() => {
            const run = pending
            setPending(null)
            run()
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
