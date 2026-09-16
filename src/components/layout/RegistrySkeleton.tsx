/**
 * Скелетон списка записей под структуру эталона: шапка → полоса показателей →
 * тулбар с поиском и фильтрами → строки реестра. Используется в loading.tsx
 * модулей, чтобы при переходе экран «мигал» тем же каркасом, что и загрузится,
 * а не общим скелетоном дашборда.
 */
export function RegistrySkeleton({ stats = true, rows = 8, toolbar = true }: { stats?: boolean; rows?: number; toolbar?: boolean }) {
  const tint = 'bg-[var(--hp-neutral-tint)]'
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Загрузка">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className={`h-7 w-40 ${tint}`} />
          <div className={`h-4 w-56 ${tint}`} />
        </div>
        <div className={`h-9 w-36 ${tint} rounded-[var(--hp-radius)]`} />
      </div>

      {stats && (
        <div className="hp-strip" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="hp-strip-cell space-y-2">
              <div className={`h-3 w-24 ${tint}`} />
              <div className={`h-7 w-20 ${tint}`} />
              <div className={`h-3 w-28 ${tint}`} />
            </div>
          ))}
        </div>
      )}

      {toolbar && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`h-10 w-64 ${tint} rounded-[var(--hp-radius)]`} />
          <div className={`h-10 w-32 ${tint} rounded-[var(--hp-radius)]`} />
          <div className={`h-10 w-32 ${tint} rounded-[var(--hp-radius)]`} />
        </div>
      )}

      <div className="hp-card overflow-hidden">
        <div className={`h-10 ${tint} opacity-60`} />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-t border-[var(--hp-border-soft)]">
            <div className={`h-4 w-40 ${tint}`} />
            <div className={`h-4 w-24 ${tint} hidden sm:block`} />
            <div className={`h-4 w-32 ${tint} hidden md:block`} />
            <div className="flex-1" />
            <div className={`h-5 w-20 ${tint} rounded-[var(--hp-radius)]`} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Скелетон карточки записи: шапка с действиями → полоса → две колонки блоков. */
export function RecordSkeleton() {
  const tint = 'bg-[var(--hp-neutral-tint)]'
  const block = (rows: number, key: number) => (
    <div key={key} className="hp-block">
      <div className={`h-9 ${tint} opacity-60`} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-[18px] py-3 border-t border-[var(--hp-border-soft)]">
          <div className={`h-4 w-28 ${tint}`} />
          <div className={`h-4 w-36 ${tint}`} />
        </div>
      ))}
    </div>
  )
  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-pulse" aria-busy="true" aria-label="Загрузка">
      <div className="space-y-3">
        <div className={`h-3 w-48 ${tint}`} />
        <div className="flex items-center justify-between gap-4">
          <div className={`h-8 w-72 ${tint}`} />
          <div className="flex gap-2">
            <div className={`h-10 w-28 ${tint} rounded-[var(--hp-radius)]`} />
            <div className={`h-10 w-32 ${tint} rounded-[var(--hp-radius)]`} />
            <div className={`h-10 w-10 ${tint} rounded-[var(--hp-radius)]`} />
          </div>
        </div>
      </div>
      <div className="hp-strip" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="hp-strip-cell space-y-2">
            <div className={`h-3 w-20 ${tint}`} />
            <div className={`h-7 w-24 ${tint}`} />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">{block(5, 1)}{block(3, 2)}</div>
        <div className="space-y-4">{block(3, 3)}{block(2, 4)}</div>
      </div>
    </div>
  )
}
