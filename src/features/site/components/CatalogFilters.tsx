import { Search } from 'lucide-react'
import type { CatalogFilters as Filters } from '@/features/site/lib/properties'
import { DEAL_TYPE_LABELS, PROPERTY_TYPE_LABELS } from '@/features/site/lib/labels'

/**
 * Фильтр каталога — обычная GET-форма без JS: состояние живёт в URL, значит
 * ссылку на отфильтрованную выдачу можно переслать, а страница остаётся
 * серверной. Никакого клиентского состояния тут не нужно.
 */
export function CatalogFilters({
  filters,
  districts,
  compact = false,
}: {
  filters: Filters
  districts: string[]
  compact?: boolean
}) {
  const selectClass =
    'w-full h-11 px-3 text-[14px] border outline-none transition-colors cursor-pointer bg-[var(--hp-surface)] text-[var(--hp-ink)] border-[var(--hp-border)] focus:border-[var(--hp-ink)] rounded-[var(--hp-radius)]'
  const inputClass =
    'w-full min-w-0 h-11 px-3 text-[14px] border outline-none transition-colors bg-[var(--hp-surface)] text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] border-[var(--hp-border)] focus:border-[var(--hp-ink)] rounded-[var(--hp-radius)]'

  return (
    <form
      method="get"
      action="/catalog"
      className="p-4 sm:p-5 border"
      style={{
        background: 'var(--hp-surface)',
        borderColor: 'var(--hp-border)',
        borderRadius: 'var(--hp-radius)',
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <label className="hp-label" htmlFor="f-deal">Тип сделки</label>
          <select id="f-deal" name="deal_type" defaultValue={filters.deal_type ?? ''} className={selectClass}>
            <option value="">Любой</option>
            {Object.entries(DEAL_TYPE_LABELS).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="hp-label" htmlFor="f-type">Тип объекта</label>
          <select id="f-type" name="property_type" defaultValue={filters.property_type ?? ''} className={selectClass}>
            <option value="">Любой</option>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="hp-label" htmlFor="f-rooms">Комнат</label>
          <select id="f-rooms" name="rooms" defaultValue={filters.rooms ?? ''} className={selectClass}>
            <option value="">Не важно</option>
            <option value="1">1 или студия</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4 и больше</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="hp-label" htmlFor="f-district">Район</label>
          <select
            id="f-district"
            name="district"
            defaultValue={filters.district ?? ''}
            disabled={districts.length === 0}
            className={`${selectClass} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <option value="">{districts.length === 0 ? 'Район не указан' : 'Любой'}</option>
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {!compact && (
          <>
            <div className="space-y-1.5">
              <label className="hp-label" htmlFor="f-price-min">Цена от, ₽</label>
              <input
                id="f-price-min"
                name="price_min"
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                defaultValue={filters.price_min ?? ''}
                placeholder="20 000"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="hp-label" htmlFor="f-price-max">Цена до, ₽</label>
              <input
                id="f-price-max"
                name="price_max"
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                defaultValue={filters.price_max ?? ''}
                placeholder="60 000"
                className={inputClass}
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button type="submit" className="hp-btn-primary h-11">
          <Search style={{ width: 15, height: 15 }} />
          {compact ? 'Подобрать объект' : 'Показать объекты'}
        </button>
        <a href="/catalog" className="hp-btn-secondary h-11">
          Сбросить
        </a>
      </div>
    </form>
  )
}
