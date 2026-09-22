'use client'

import { useEffect, useState } from 'react'
import { Briefcase, KeyRound, ArrowRight } from 'lucide-react'
import { LoginForm, type Audience } from './LoginForm'

/**
 * Первый шаг входа: кто пришёл.
 *
 * На эту страницу приходят двое, и им нужно разное. Сотрудник агентства
 * работает тут каждый день и входит по рабочему email. Собственник или
 * арендатор заходит раз в месяц, пароля у него нет вовсе, а код ему называет
 * менеджер — и, не увидев себя на экране, он звонит и спрашивает, туда ли
 * попал. Поэтому сначала дверь, а за ней только нужные поля: так на экране
 * нет ничего лишнего ни для одного из них.
 *
 * Выбор запоминается в браузере, и сотруднику лишний шаг достаётся ровно один
 * раз — дальше он попадает сразу на свою форму.
 */
const STORAGE_KEY = 'hp-login-audience'

const DOORS: {
  audience: Audience
  title: string
  description: string
  action: string
  Icon: typeof Briefcase
}[] = [
  {
    audience: 'staff',
    title: 'Я сотрудник агентства',
    description: 'Лиды и сделки, объекты, договоры и платежи, задачи и заявки жильцов.',
    action: 'Вход по email и паролю',
    Icon: Briefcase,
  },
  {
    audience: 'client',
    title: 'Я собственник или арендатор',
    description: 'Ваш объект: отчёты и сальдо, платежи и сроки, счётчики, заявки на мастера.',
    action: 'Вход по номеру телефона',
    Icon: KeyRound,
  },
]

export function LoginGate() {
  const [audience, setAudience] = useState<Audience | null>(null)
  /**
   * Первый кадр рисуем без выбора из хранилища.
   *
   * Сервер о нём не знает, и если подставить его сразу, разметка разойдётся с
   * серверной — React ругается на гидратацию и перерисовывает экран рывком.
   */
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved === 'staff' || saved === 'client') setAudience(saved)
    } catch {
      // Приватный режим или запрет на хранилище — просто спросим снова.
    }
    setRestored(true)
  }, [])

  function choose(next: Audience) {
    setAudience(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Не запомнили — не беда, выбор всё равно сделан на этот раз.
    }
  }

  function reset() {
    setAudience(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // см. выше
    }
  }

  // До восстановления держим место дверей, чтобы экран не прыгал.
  if (!restored) {
    return <div className="h-[260px] animate-pulse" style={{ background: 'var(--hp-neutral-tint)' }} />
  }

  if (!audience) {
    return (
      <div className="space-y-6">
        <p className="text-sm leading-relaxed text-center" style={{ color: 'var(--hp-sub)' }}>
          Выберите, кто вы, — дальше система спросит только то, что нужно именно вам.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DOORS.map(door => (
            <button
              key={door.audience}
              type="button"
              onClick={() => choose(door.audience)}
              className="group flex flex-col items-center text-center gap-3 p-6 transition-colors"
              style={{
                background: 'var(--hp-surface)',
                border: '1px solid var(--hp-border)',
                borderRadius: 'var(--hp-radius)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--hp-accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hp-border)' }}
            >
              <span
                className="w-11 h-11 flex items-center justify-center shrink-0"
                style={{ background: 'var(--hp-neutral-tint)', borderRadius: 'var(--hp-radius)' }}
              >
                <door.Icon className="w-5 h-5" style={{ color: 'var(--hp-accent)' }} />
              </span>
              <span
                className="font-bold text-[16px] leading-tight flex items-center justify-center"
                style={{ color: 'var(--hp-ink)', minHeight: '2.4em' }}
              >
                {door.title}
              </span>
              <span className="text-[13px] leading-relaxed" style={{ color: 'var(--hp-sub)' }}>
                {door.description}
              </span>
              <span
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold mt-auto pt-1"
                style={{ color: 'var(--hp-accent)' }}
              >
                {door.action}
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const current = DOORS.find(d => d.audience === audience)!

  // Форма уже, чем экран выбора: у неё одно-два поля, и во всю ширину дверей
  // строка ввода выглядит растянутой.
  return (
    <div className="space-y-5 mx-auto w-full max-w-md">
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{
          background: 'var(--hp-surface)',
          border: '1px solid var(--hp-border)',
          borderRadius: 'var(--hp-radius)',
        }}
      >
        <span className="inline-flex items-center gap-2.5 text-[13px] font-medium" style={{ color: 'var(--hp-ink)' }}>
          <current.Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--hp-accent)' }} />
          {current.title}
        </span>
        <button
          type="button"
          onClick={reset}
          className="text-[12.5px] font-semibold shrink-0 transition-colors hover:opacity-80"
          style={{ color: 'var(--hp-accent)' }}
        >
          Это не я
        </button>
      </div>

      <LoginForm audience={audience} />

      <p className="text-[12px] leading-relaxed text-center" style={{ color: 'var(--hp-sub)' }}>
        {audience === 'client'
          ? 'Доступ в кабинет выдаёт ваш менеджер — он же называет код входа.'
          : 'Доступ к CRM выдаёт администратор агентства.'}
      </p>
    </div>
  )
}
