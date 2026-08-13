import { useRef, useState } from 'react'
import { useAppStore } from '../state/store'
import { flagUrl, specIconUrl } from '../assets'
import { deckTotals, validateDeck } from '../deck/rules'
import { dekToJson } from '../deck/dek'
import { t } from './i18n'

function download(name: string, bytes: BlobPart, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Sanitise a deck name for use as a filename (the game names files after the
 *  deck, and the name is stored inside the file too). */
function fileName(name: string): string {
  const safe = name.replace(/[\\/:*?"<>|]/g, '_').trim()
  return `${safe || 'battlegroup'}.dek`
}

interface Props {
  onNewDeck(): void
  onChangeSpecs(): void
}

export function DeckToolbar({ onNewDeck, onChangeSpecs }: Props) {
  const db = useAppStore((s) => s.db)!
  const lang = useAppStore((s) => s.lang)
  const deck = useAppStore((s) => s.deck)
  const setDeckName = useAppStore((s) => s.setDeckName)
  const importDek = useAppStore((s) => s.importDek)
  const exportDek = useAppStore((s) => s.exportDek)
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [showIssues, setShowIssues] = useState(false)

  const totals = deck ? deckTotals(db, deck) : null
  const issues = deck ? validateDeck(db, deck) : []
  const errors = issues.filter((i) => i.severity === 'error')

  async function onFile(file: File) {
    setError(null)
    try {
      await importDek(new Uint8Array(await file.arrayBuffer()))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        <strong>{t(lang, 'title')}</strong>
      </div>

      {deck && (
        <>
          <input
            className="deck-name"
            value={deck.name}
            onChange={(e) => setDeckName(e.target.value)}
            maxLength={64}
          />
          <button className="specs-chip" onClick={onChangeSpecs} title={t(lang, 'changeSpecs')}>
            <img src={flagUrl(db.countries.get(deck.countryId)?.FlagFileName ?? null) ?? undefined} alt="" />
            {[deck.spec1, deck.spec2].map((id) => {
              const s = db.specializations.get(id)
              return (
                <span key={id} className="specs-chip-item">
                  <img src={specIconUrl(s?.Icon ?? null) ?? undefined} alt="" />
                  {db.locOr(s?.UIName, s?.Name ?? String(id))}
                </span>
              )
            })}
          </button>

          <div className={`total-points ${totals!.overTotal ? 'over' : ''}`}>
            <span className="total-value">{totals!.spent}</span>
            <span className="total-budget">/ {totals!.budget}</span>
          </div>

          <button
            className={`validity ${errors.length ? 'invalid' : issues.length ? 'incomplete' : 'valid'}`}
            onClick={() => setShowIssues((v) => !v)}
          >
            {errors.length
              ? db.locOr('ui_arsenal_deckpreview_invalid', 'Points limit exceeded')
              : issues.length
                ? db.locOr('ui_arsenal_deckpreview_incomplete', 'This battlegroup is incomplete.')
                : db.locOr('ui_arsenal_deckpreview_ok', t(lang, 'deckValid'))}
            {issues.length > 0 && <em> ({issues.length})</em>}
          </button>
          {showIssues && issues.length > 0 && (
            <ul className="issue-list">
              {issues.map((i, n) => (
                <li key={n} className={i.severity}>
                  {i.message}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <span className="toolbar-spacer" />

      <button onClick={onNewDeck}>{t(lang, 'newDeck')}</button>
      <button onClick={() => fileInput.current?.click()}>{t(lang, 'importDek')}</button>
      <button
        disabled={!deck}
        onClick={async () => {
          const bytes = await exportDek()
          download(fileName(deck!.name), bytes)
        }}
      >
        {t(lang, 'exportDek')}
      </button>
      <button
        disabled={!deck}
        title={t(lang, 'exportJson')}
        onClick={async () => {
          const json = await dekToJson(await exportDek())
          download(fileName(deck!.name).replace(/\.dek$/, '.json'), json, 'application/json')
        }}
      >
        JSON
      </button>
      <LangToggle />

      <input
        ref={fileInput}
        type="file"
        accept=".dek"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void onFile(f)
        }}
      />
      {error && (
        <div className="toolbar-error" onClick={() => setError(null)}>
          {t(lang, 'importFailed')}: {error}
        </div>
      )}
    </header>
  )
}

function LangToggle() {
  const lang = useAppStore((s) => s.lang)
  const setLang = useAppStore((s) => s.setLang)
  return (
    <button
      className="lang-toggle"
      title={t(lang, 'langToggle')}
      onClick={() => void setLang(lang === 'eng' ? 'chi' : 'eng')}
    >
      {lang === 'eng' ? '中文' : 'EN'}
    </button>
  )
}
