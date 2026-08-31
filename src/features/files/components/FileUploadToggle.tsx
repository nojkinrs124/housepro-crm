'use client'

import { useState, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { FileUpload } from './FileUpload'

/**
 * Блок документов с раскрывающейся загрузкой: в шапке — «+ Загрузить»,
 * внутри — переданный сервером список (children), под ним по клику
 * разворачивается дроп-зона. Так блок в покое остаётся компактным списком,
 * а не занимает полэкрана пустой формой.
 *
 * Список приходит пропсом `children` из серверного компонента — запрос
 * к БД остаётся на сервере, клиентским здесь является только раскрытие.
 */
export function FileUploadToggle({
  title = 'Документы',
  clientId, propertyId, contractId, dealId,
  children,
}: {
  title?: string
  clientId?: string
  propertyId?: string
  contractId?: string
  dealId?: string
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="hp-block">
      <div className="hp-block-header flex items-center justify-between">
        <span>{title}</span>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors"
        >
          {open ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {open ? 'Свернуть' : 'Загрузить'}
        </button>
      </div>

      {children}

      {open && (
        <div className="p-4 border-t border-[var(--hp-border-soft)]">
          <FileUpload
            clientId={clientId}
            propertyId={propertyId}
            contractId={contractId}
            dealId={dealId}
          />
        </div>
      )}
    </div>
  )
}
