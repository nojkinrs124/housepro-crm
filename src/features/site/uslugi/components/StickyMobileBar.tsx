'use client'

import { useEffect, useState } from 'react'
import { Calculator, Phone } from 'lucide-react'
import { ANALYTICS_EVENTS, analyticsAttrs } from '../analytics'
import { USLUGI_ANCHORS, USLUGI_CONTACTS } from '../config'
import { scrollToAnchor } from '../lead-context-store'

interface Props {
  /** id первого экрана: панель появляется, когда он ушёл за верх окна */
  heroId: string
}

/**
 * Липкая панель на мобильном: «Рассчитать доход» · «Позвонить».
 *
 * Показывается только после прокрутки первого экрана (там калькулятор и так
 * на виду) и только до `md` — на десктопе телефон в шапке, а калькулятор
 * помещается в первый экран. Наблюдаем за hero через IntersectionObserver,
 * а не за scrollY: не нужно считать высоту экрана и дёргать ререндер на
 * каждый пиксель.
 */
export function StickyMobileBar({ heroId }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const hero = document.getElementById(heroId)
    if (!hero) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom < 0),
      { threshold: 0 }
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [heroId])

  return (
    <div
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 border-t transition-transform duration-200 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ background: 'var(--hp-surface)', borderColor: 'var(--hp-border)' }}
      aria-hidden={!visible}
    >
      <div className="px-4 py-3 grid grid-cols-2 gap-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <button
          type="button"
          tabIndex={visible ? 0 : -1}
          onClick={() => scrollToAnchor(USLUGI_ANCHORS.calculator)}
          className="hp-btn-primary h-11 justify-center"
          {...analyticsAttrs(ANALYTICS_EVENTS.calcInteract)}
        >
          <Calculator style={{ width: 16, height: 16 }} />
          Рассчитать доход
        </button>
        <a
          href={USLUGI_CONTACTS.phoneHref}
          tabIndex={visible ? 0 : -1}
          className="hp-btn-secondary h-11 justify-center"
          {...analyticsAttrs(ANALYTICS_EVENTS.phoneClick)}
        >
          <Phone style={{ width: 16, height: 16, color: 'var(--hp-accent)' }} />
          Позвонить
        </a>
      </div>
    </div>
  )
}
