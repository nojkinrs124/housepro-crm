'use client'

import { Printer } from 'lucide-react'

/** Печать текущей страницы. Отдельный клиентский компонент — window.print()
 *  недоступен в серверной разметке счёта. */
export function PrintButton({ label = 'Печать' }: { label?: string }) {
 return (
 <button
 type="button"
 onClick={() => window.print()}
 className="flex items-center gap-2 px-4 py-2 border border-[var(--hp-border)] rounded-[var(--hp-radius)] text-sm font-medium text-[var(--hp-ink)] hover:border-[var(--hp-sub)] transition-colors print:hidden"
 >
 <Printer className="w-4 h-4" />
 {label}
 </button>
 )
}
