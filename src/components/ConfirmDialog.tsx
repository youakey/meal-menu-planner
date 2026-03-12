import React from 'react'

export function ConfirmDialog({
  open,
  title,
  description,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-6">
        <div className="text-xl font-semibold text-amber-50">{title}</div>
        {description && <div className="mt-3 text-sm leading-7 text-amber-100/65">{description}</div>}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Отмена
          </button>
          <button
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="btn-danger"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  )
}
