import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { canUseTool, ADMIN_ONLY_TOOLS, MEMBER_SCREENS } from '@/features/telegram/services/access'
import { TOOL_DEFINITIONS, MUTATING_TOOLS, COSTLY_TOOLS, toolDefinitionsFor } from '@/lib/telegram/tools'

const TOOLS_SOURCE = readFileSync(resolve(__dirname, '../../lib/telegram/tools.ts'), 'utf8')
const toolNames = TOOL_DEFINITIONS.map((d) => d.function.name)

describe('роли и инструменты ассистента', () => {
  it('владелец может всё', () => {
    for (const name of toolNames) expect(canUseTool('admin', name), name).toBe(true)
  })

  it('сотруднику закрыты деньги и канал — как и соответствующие экраны меню', () => {
    expect(canUseTool('member', 'get_finance_summary')).toBe(false)
    expect(canUseTool('member', 'get_finance_chart')).toBe(false)
    expect(canUseTool('member', 'create_channel_post')).toBe(false)
    expect(canUseTool('member', 'get_channel_stats')).toBe(false)
    // Экрана «Деньги» у сотрудника нет — значит и инструментов денег быть не должно.
    expect(MEMBER_SCREENS).not.toContain('crm_payments')
  })

  it('сотруднику остаётся его работа: сделки, контакты, задачи, показания', () => {
    for (const name of ['get_deals', 'get_client', 'list_tasks', 'get_meters', 'add_meter_readings', 'create_lead']) {
      expect(canUseTool('member', name), name).toBe(true)
    }
  })

  it('постороннему не достаётся ничего', () => {
    for (const name of toolNames) expect(canUseTool('stranger', name), name).toBe(false)
  })

  it('модель сотрудника не видит закрытых схем вовсе', () => {
    const memberTools = toolDefinitionsFor('member').map((d) => d.function.name)
    expect(memberTools).not.toContain('get_finance_summary')
    expect(memberTools).not.toContain('create_channel_post')
    expect(memberTools.length).toBeLessThan(toolDefinitionsFor('admin').length)
  })
})

describe('списки инструментов не расходятся со схемой', () => {
  it('ADMIN_ONLY_TOOLS ссылается только на существующие инструменты', () => {
    for (const name of ADMIN_ONLY_TOOLS) expect(toolNames, name).toContain(name)
  })

  it('MUTATING_TOOLS ссылается только на существующие инструменты', () => {
    for (const name of MUTATING_TOOLS) expect(toolNames, name).toContain(name)
  })

  it('COSTLY_TOOLS ссылается только на существующие инструменты', () => {
    for (const name of COSTLY_TOOLS) expect(toolNames, name).toContain(name)
  })

  it('ни один инструмент не попал одновременно в mutating и costly', () => {
    for (const name of COSTLY_TOOLS) expect(MUTATING_TOOLS as readonly string[]).not.toContain(name)
  })
})

describe('контракт параметров: что объявлено модели — то доходит до API', () => {
  // Реальный баг 28.10.2026: get_deals объявлял deal_type, а диспетчер его не
  // передавал и API его не читал — «сделки по аренде» отвечали всеми сделками.
  // Тест ловит повторение паттерна: любой параметр read-only инструмента должен
  // читаться в tools.ts как `args.<name>`.
  const readOnlyApiTools = [
    'get_deals', 'list_properties', 'get_client', 'list_tasks',
    'list_overdue_payments', 'get_finance_summary', 'get_finance_chart',
    'get_meters', 'market_research',
  ]

  for (const name of readOnlyApiTools) {
    it(`${name}: каждый объявленный параметр используется`, () => {
      const definition = TOOL_DEFINITIONS.find((d) => d.function.name === name)
      expect(definition, name).toBeTruthy()
      const properties = Object.keys(
        (definition!.function.parameters as { properties?: Record<string, unknown> }).properties ?? {},
      )
      for (const property of properties) {
        expect(TOOLS_SOURCE.includes(`args.${property}`), `${name}.${property} объявлен, но не читается`).toBe(true)
      }
    })
  }
})
