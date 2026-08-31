import { ReactNode } from 'react'

export interface StatItem {
  /** Капс-подпись: «ВСЕГО В БАЗЕ», «СУММА СДЕЛКИ» */
  label: string
  /** Крупное значение — цифра, сумма или дата */
  value: ReactNode
  /** Мелкая строка под значением: «+32 за неделю», «оборот 1 602 000 ₽» */
  hint?: ReactNode
  /** Значение поменьше — для дат и текстовых значений, чтобы не переносилось */
  small?: boolean
  /** Красит значение и подсказку в --hp-danger: «118 без касания» */
  alert?: boolean
}

/**
 * Полоса показателей — одна плоская панель, ячейки разделены линиями
 * (макет «Кабинет», направление 1c). Заменяет ряд отдельных мини-карточек:
 * так шапка страницы читается как единый блок, а не как рассыпанные плитки.
 * На узком экране схлопывается в 2 колонки (правило в globals.css).
 */
export function StatStrip({ items }: { items: StatItem[] }) {
  return (
    <div className="hp-strip" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(item => (
        <div key={item.label} className={`hp-strip-cell${item.alert ? ' is-alert' : ''}`}>
          <p className="hp-strip-label">{item.label}</p>
          <p className={`hp-strip-value${item.small ? ' sm' : ''}`}>{item.value}</p>
          {item.hint && <p className="hp-strip-hint">{item.hint}</p>}
        </div>
      ))}
    </div>
  )
}
