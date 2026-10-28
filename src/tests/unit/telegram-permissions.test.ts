import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CAPABILITIES, can, canOpenScreen, canUseTool, canRunAction, canRunCallback,
  canFulfilIntentKey, canRunCommand, canSeePrompt,
  KNOWN_CALLBACK_ACTIONS, MEMBER_SCREENS, ADMIN_ONLY_TOOLS,
} from '@/features/telegram/services/permissions'
import { NAV_SCREENS } from '@/lib/telegram/webhook/handlers/menu'
import { TOOL_DEFINITIONS, MUTATING_TOOLS } from '@/lib/telegram/tools'

const CALLBACK_INDEX_SOURCE = readFileSync(
  resolve(__dirname, '../../lib/telegram/webhook/handlers/callback/index.ts'),
  'utf8',
)

describe('таблица прав: одно место вместо трёх', () => {
  it('каждый экран меню имеет запись — иначе экран молча закроется всем, кроме владельца', () => {
    for (const screen of NAV_SCREENS) {
      expect(CAPABILITIES[`screen:${screen}`], screen).toBeDefined()
    }
  })

  it('каждый инструмент имеет запись — иначе он молча закроется сотруднику', () => {
    for (const tool of TOOL_DEFINITIONS.map((d) => d.function.name)) {
      expect(CAPABILITIES[`tool:${tool}`], tool).toBeDefined()
    }
  })

  it('каждое мутирующее действие покрыто тем же ключом, что и инструмент', () => {
    for (const name of MUTATING_TOOLS) {
      expect(CAPABILITIES[`tool:${name}`], name).toBeDefined()
    }
  })

  it('каждое действие кнопки, которое обрабатывает диспетчер, известно таблице или диспетчеру', () => {
    // Вытаскиваем `action === 'x'` из диспетчера: новая кнопка без записи в
    // таблице получит «доступно только владельцу» вместо работы — надо ловить.
    const actions = new Set([...CALLBACK_INDEX_SOURCE.matchAll(/action === '([a-z_]+)'/g)].map((m) => m[1]))
    expect(actions.size).toBeGreaterThan(10)
    for (const action of actions) {
      expect(KNOWN_CALLBACK_ACTIONS, action).toContain(action)
    }
  })

  it('нет ключей, которые никто не спросит: опечатка в имени = тихо отключённое право', () => {
    const toolNames = new Set<string>(TOOL_DEFINITIONS.map((d) => d.function.name))
    for (const key of Object.keys(CAPABILITIES)) {
      const [kind, name] = key.split(':')
      if (kind === 'screen') expect(NAV_SCREENS as readonly string[], key).toContain(name)
      if (kind === 'tool') expect(toolNames.size > 0 && toolNames.has(name), key).toBe(true)
    }
  })
})

describe('can: владелец, сотрудник, посторонний', () => {
  it('владелец может всё, включая неизвестный ключ', () => {
    for (const key of Object.keys(CAPABILITIES)) expect(can('admin', key), key).toBe(true)
    expect(can('admin', 'screen:какой-то-новый')).toBe(true)
  })

  it('посторонний не может ничего', () => {
    for (const key of Object.keys(CAPABILITIES)) expect(can('stranger', key), key).toBe(false)
  })

  it('сотруднику закрыты деньги, канал и настройки', () => {
    expect(canOpenScreen('member', 'crm_payments')).toBe(false)
    expect(canOpenScreen('member', 'crm_management')).toBe(false)
    expect(canOpenScreen('member', 'channel')).toBe(false)
    expect(canOpenScreen('member', 'settings_users')).toBe(false)
    expect(canUseTool('member', 'get_finance_summary')).toBe(false)
    expect(canUseTool('member', 'get_finance_chart')).toBe(false)
    expect(canRunAction('member', 'ownerpay')).toBe(false)
    expect(canRunAction('member', 'money', 'add')).toBe(false)
    expect(canRunCommand('member', 'repair_cta')).toBe(false)
    expect(canSeePrompt('member', 'channel')).toBe(false)
  })

  it('сотруднику открыта его работа', () => {
    for (const screen of ['root', 'today', 'crm', 'crm_leads', 'crm_deals', 'crm_properties', 'crm_contacts', 'crm_tasks', 'crm_intake']) {
      expect(canOpenScreen('member', screen), screen).toBe(true)
    }
    expect(canRunAction('member', 'leadnext')).toBe(true)
    expect(canRunAction('member', 'prop', 'find')).toBe(true)
    expect(canRunAction('member', 'intake', 'rent:new')).toBe(true)
    expect(canUseTool('member', 'add_meter_readings')).toBe(true)
    expect(canSeePrompt('member', 'channel')).toBe(false)
  })
})

describe('canRunCallback: кнопка решается по таблице', () => {
  it('nav проверяется по экрану, а не по действию', () => {
    expect(canRunCallback('member', 'nav', 'crm_leads')).toBe(true)
    expect(canRunCallback('member', 'nav', 'crm_payments')).toBe(false)
    expect(canRunCallback('member', 'nav', 'crm_leads:2')).toBe(true) // страница вторая
    expect(canRunCallback('admin', 'nav', 'settings_users')).toBe(true)
  })

  it('подтверждение батча — уровень сотрудника (что именно — проверяет батч)', () => {
    expect(canRunCallback('member', 'confirm', 'batch-1')).toBe(true)
    expect(canRunCallback('member', 'cancel', 'batch-1')).toBe(true)
    expect(canRunCallback('stranger', 'confirm', 'batch-1')).toBe(false)
  })

  it('неизвестная кнопка — не отказ по роли, а «устарела»', () => {
    expect(canRunCallback('member', 'chlegacything', 'x')).toBe(true)
  })

  it('конкретная пара «действие:аргумент» важнее общего действия', () => {
    expect(canRunCallback('member', 'prop', 'find')).toBe(true)
    expect(canRunCallback('member', 'money', 'chart')).toBe(false)
    expect(canRunCallback('member', 'ownerpay', 'op-1')).toBe(false)
  })
})

describe('производные списки не расходятся с таблицей', () => {
  it('MEMBER_SCREENS собран из таблицы', () => {
    expect(MEMBER_SCREENS).toContain('crm_intake')
    expect(MEMBER_SCREENS).not.toContain('crm_payments')
    expect(MEMBER_SCREENS).not.toContain('channel')
    for (const screen of MEMBER_SCREENS) expect(CAPABILITIES[`screen:${screen}`]).toBe('member')
  })

  it('ADMIN_ONLY_TOOLS собран из таблицы', () => {
    expect(ADMIN_ONLY_TOOLS).toContain('get_finance_summary')
    expect(ADMIN_ONLY_TOOLS).not.toContain('get_deals')
    for (const tool of ADMIN_ONLY_TOOLS) expect(CAPABILITIES[`tool:${tool}`]).toBe('admin')
  })

  it('формы ожидания ввода различаются членом и владельцем', () => {
    expect(canFulfilIntentKey('member', 'find_contact')).toBe(true)
    expect(canFulfilIntentKey('member', 'add_money')).toBe(false)
    expect(canFulfilIntentKey('member', 'edit_rubric:abc')).toBe(false)
    expect(canFulfilIntentKey('admin', 'edit_rubric:abc')).toBe(true)
  })
})
