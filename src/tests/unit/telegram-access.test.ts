import { describe, it, expect } from 'vitest'
import { roleOf, isAtLeastMember, canBootstrap, ownsIntent } from '@/features/telegram/services/access'

const ADMIN = '395803926'
const MEMBER = '111111111'
const STRANGER = '999999999'

describe('roleOf', () => {
  it('админ узнаётся по admin_telegram_user_id', () => {
    expect(roleOf(ADMIN, ADMIN, [])).toBe('admin')
  })

  it('админ остаётся админом, даже если его нет в списке допущенных', () => {
    expect(roleOf(ADMIN, ADMIN, [MEMBER])).toBe('admin')
  })

  it('допущенный сотрудник — member', () => {
    expect(roleOf(MEMBER, ADMIN, [MEMBER])).toBe('member')
  })

  it('посторонний — stranger', () => {
    expect(roleOf(STRANGER, ADMIN, [MEMBER])).toBe('stranger')
  })

  it('без назначенного админа никто не становится админом сам собой', () => {
    expect(roleOf(ADMIN, null, [ADMIN])).toBe('member')
  })
})

describe('isAtLeastMember', () => {
  it('админ имеет права сотрудника', () => {
    expect(isAtLeastMember('admin')).toBe(true)
    expect(isAtLeastMember('member')).toBe(true)
    expect(isAtLeastMember('stranger')).toBe(false)
  })
})

describe('canBootstrap', () => {
  it('первый запуск: списка нет, админ не назначен — пускаем', () => {
    expect(canBootstrap(STRANGER, null, 0)).toBe(true)
  })

  it('список опустел, но админ назначен — пускаем только его', () => {
    expect(canBootstrap(ADMIN, ADMIN, 0)).toBe(true)
    expect(canBootstrap(STRANGER, ADMIN, 0)).toBe(false)
  })

  it('пока в списке кто-то есть, автодобавления нет ни для кого', () => {
    expect(canBootstrap(ADMIN, ADMIN, 1)).toBe(false)
    expect(canBootstrap(STRANGER, null, 1)).toBe(false)
  })
})

describe('ownsIntent', () => {
  it('незавершённый ввод потребляет только тот, кто его начал', () => {
    expect(ownsIntent(ADMIN, ADMIN)).toBe(true)
    expect(ownsIntent(STRANGER, ADMIN)).toBe(false)
  })

  it('ввод без владельца не подставляется никому', () => {
    expect(ownsIntent(ADMIN, null)).toBe(false)
    expect(ownsIntent(ADMIN, undefined)).toBe(false)
  })
})

describe('воронка лида в боте', () => {
  it('не содержит статусов, которых нет в базе', async () => {
    const { LEAD_PIPELINE, LEAD_STATUS_VALUES } = await import('@/features/leads/config/lead-statuses')
    // До 04.09.2026 у бота была своя копия воронки со статусом `meeting`, которого
    // нет ни в базе, ни в вебе: кнопка «следующий статус» записала бы его в
    // leads.status, и лид пропал бы с доски.
    for (const status of LEAD_PIPELINE) {
      expect(LEAD_STATUS_VALUES).toContain(status)
    }
    expect(LEAD_PIPELINE).not.toContain('meeting')
  })

  it('не предлагает автоматически закрыть лид или отказать', () => {
    // «Закрыт» и «Отказ» — решение человека, а не следующий шаг воронки
    return import('@/features/leads/config/lead-statuses').then(({ LEAD_PIPELINE }) => {
      expect(LEAD_PIPELINE).not.toContain('closed')
      expect(LEAD_PIPELINE).not.toContain('rejected')
      expect(LEAD_PIPELINE[LEAD_PIPELINE.length - 1]).toBe('converted')
    })
  })
})

describe('canOpenScreen', () => {
  it('владельцу открыт весь бот', async () => {
    const { canOpenScreen } = await import('@/features/telegram/services/access')
    expect(canOpenScreen('admin', 'channel_rubrics')).toBe(true)
    expect(canOpenScreen('admin', 'settings_users')).toBe(true)
    expect(canOpenScreen('admin', 'crm_leads')).toBe(true)
  })

  it('сотруднику — разделы CRM, но не настройки и не канал', async () => {
    const { canOpenScreen } = await import('@/features/telegram/services/access')
    expect(canOpenScreen('member', 'crm_leads')).toBe(true)
    expect(canOpenScreen('member', 'crm_tasks')).toBe(true)
    expect(canOpenScreen('member', 'help')).toBe(true)
    // промпты рубрик задают то, что бот пишет в публичный канал
    expect(canOpenScreen('member', 'channel_rubrics')).toBe(false)
    // а здесь правится список тех, у кого вообще есть доступ
    expect(canOpenScreen('member', 'settings_users')).toBe(false)
    expect(canOpenScreen('member', 'multiagent')).toBe(false)
  })

  it('постороннему не открыто ничего', async () => {
    const { canOpenScreen } = await import('@/features/telegram/services/access')
    expect(canOpenScreen('stranger', 'root')).toBe(false)
    expect(canOpenScreen('stranger', 'crm_leads')).toBe(false)
  })
})
