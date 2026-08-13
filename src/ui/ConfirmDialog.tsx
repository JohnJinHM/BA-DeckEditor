import type { ReactNode } from 'react'
import { useAppStore } from '../state/store'
import { t } from './i18n'

interface Props {
  title: string
  body: ReactNode
  /** label for the destructive action; defaults to "Continue" */
  confirmLabel?: string
  onConfirm(): void
  onCancel(): void
}

/** Guard in front of anything that throws away the current battlegroup. */
export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: Props) {
  const lang = useAppStore((s) => s.lang)
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="confirm-body">{body}</div>
        <div className="setup-actions">
          <button onClick={onCancel}>{t(lang, 'cancel')}</button>
          <button className="danger" onClick={onConfirm}>
            {confirmLabel ?? t(lang, 'continueAnyway')}
          </button>
        </div>
      </div>
    </div>
  )
}
