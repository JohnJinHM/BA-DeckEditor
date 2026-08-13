import { useRef, useState } from 'react'
import { useAppStore } from '../state/store'
import { flagUrl, specIconUrl } from '../assets'
import { deckTotals, filledSlotCount, validateDeck } from '../deck/rules'
import { COMPACT_QUERY, useMediaQuery } from './useMediaQuery'
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
  onRandomDeck(): void
  /** ask before an action that would throw the current battlegroup away */
  guardDiscard(action: () => void): void
}

export function DeckToolbar({ onNewDeck, onChangeSpecs, onRandomDeck, guardDiscard }: Props) {
  const db = useAppStore((s) => s.db)!
  const lang = useAppStore((s) => s.lang)
  const deck = useAppStore((s) => s.deck)
  const setDeckName = useAppStore((s) => s.setDeckName)
  const importDek = useAppStore((s) => s.importDek)
  const exportDek = useAppStore((s) => s.exportDek)
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [showIssues, setShowIssues] = useState(false)
  // narrow screens use one-word button labels so the toolbar keeps to two rows
  const compact = useMediaQuery(COMPACT_QUERY)

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
                  {/* the name drops out on a phone; the badge and the button's
                      title still identify the pair */}
                  <span className="specs-chip-name">
                    {db.locOr(s?.UIName, s?.Name ?? String(id))}
                  </span>
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

      <button onClick={() => guardDiscard(onNewDeck)}>
        {t(lang, compact ? 'newShort' : 'newDeck')}
      </button>
      <button disabled={!deck} onClick={() => guardDiscard(onRandomDeck)}>
        {t(lang, 'randomDeck')}
      </button>
      <button onClick={() => guardDiscard(() => fileInput.current?.click())}>
        {t(lang, compact ? 'importShort' : 'importDek')}
      </button>
      <button
        disabled={!deck || filledSlotCount(deck) === 0}
        onClick={async () => {
          const bytes = await exportDek()
          download(fileName(deck!.name), bytes)
        }}
      >
        {t(lang, compact ? 'exportShort' : 'exportDek')}
      </button>
      <LangToggle />
      <GithubLink />

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

export const REPO_URL = 'https://github.com/JohnJinHM/BA-DeckEditor'

function GithubLink() {
  const lang = useAppStore((s) => s.lang)
  return (
    <a
      className="github-link"
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      title={t(lang, 'github')}
      aria-label={t(lang, 'github')}
    >
      <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
             0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
             -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
             .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
             -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0
             1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
             1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
             1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
        />
      </svg>
    </a>
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
