import { describe, it, expect } from 'vitest'
import {
  parseCallbackData,
  parseAddUserInput,
  parseScheduleSlot,
  parseRubricInput,
  parseImageNote,
  parseImageStyle,
} from '@/features/telegram/services/parsing'

const RUBRICS = ['cta', 'case', 'analytics', 'adhoc']

describe('parseCallbackData', () => {
  it('разбирает действие и аргумент', () => {
    expect(parseCallbackData('nav:crm_leads')).toEqual({ action: 'nav', arg: 'crm_leads' })
  })

  it('не теряет двоеточия внутри аргумента', () => {
    // так приходит intent вида edit_rubric:<uuid>
    expect(parseCallbackData('set:edit:abc')).toEqual({ action: 'set', arg: 'edit:abc' })
  })

  it('данные без аргумента игнорируются', () => {
    expect(parseCallbackData('confirm')).toBeNull()
    expect(parseCallbackData('confirm:')).toBeNull()
    expect(parseCallbackData(':abc')).toBeNull()
    expect(parseCallbackData(undefined)).toBeNull()
  })
})

describe('parseAddUserInput', () => {
  it('пересланное сообщение даёт id и имя', () => {
    const res = parseAddUserInput('что угодно', 12345, 'Ольга')
    expect(res).toEqual({ ok: true, value: { telegramUserId: '12345', label: 'Ольга' } })
  })

  it('текстом: id и подпись', () => {
    const res = parseAddUserInput('395803926 Ольга, риелтор')
    expect(res).toEqual({ ok: true, value: { telegramUserId: '395803926', label: 'Ольга, риелтор' } })
  })

  it('текстом: только id', () => {
    const res = parseAddUserInput('  395803926  ')
    expect(res).toEqual({ ok: true, value: { telegramUserId: '395803926', label: undefined } })
  })

  it('не-число отвергается с подсказкой', () => {
    const res = parseAddUserInput('@olga')
    expect(res.ok).toBe(false)
  })
})

describe('parseScheduleSlot', () => {
  it('разбирает день, время и рубрику', () => {
    const res = parseScheduleSlot('пн 08:00 cta', RUBRICS)
    expect(res).toEqual({ ok: true, value: { dayKey: 'mon', dayRaw: 'пн', time: '08:00', rubricKey: 'cta' } })
  })

  it('дополняет время до ЧЧ:ММ', () => {
    const res = parseScheduleSlot('ср 8:00 case', RUBRICS)
    expect(res.ok && res.value.time).toBe('08:00')
  })

  it('понимает английские сокращения дней', () => {
    const res = parseScheduleSlot('fri 19:30 cta', RUBRICS)
    expect(res.ok && res.value.dayKey).toBe('fri')
  })

  it('несуществующее время отвергается', () => {
    // до 04.09.2026 «пн 99:99 cta» проходило регулярку и уезжало в базу
    const res = parseScheduleSlot('пн 99:99 cta', RUBRICS)
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.error).toContain('не бывает')
  })

  it('неизвестный день отвергается', () => {
    expect(parseScheduleSlot('понедельник 08:00 cta', RUBRICS).ok).toBe(false)
  })

  it('неизвестная рубрика отвергается и перечисляет доступные', () => {
    const res = parseScheduleSlot('пн 08:00 нет-такой', RUBRICS)
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.error).toContain('cta')
  })

  it('мусор отвергается', () => {
    expect(parseScheduleSlot('привет', RUBRICS).ok).toBe(false)
  })
})

describe('parseRubricInput', () => {
  it('разбирает три части', () => {
    const res = parseRubricInput('listing | 🏠 Объект дня | Расскажи об объекте.')
    expect(res).toEqual({ ok: true, value: { key: 'listing', label: '🏠 Объект дня', prompt: 'Расскажи об объекте.' } })
  })

  it('key только латиницей в нижнем регистре', () => {
    expect(parseRubricInput('Объект | Название | Промпт').ok).toBe(false)
    expect(parseRubricInput('my key | Название | Промпт').ok).toBe(false)
  })

  it('неполный ввод отвергается', () => {
    expect(parseRubricInput('listing | Название').ok).toBe(false)
    expect(parseRubricInput('listing |  | Промпт').ok).toBe(false)
  })
})

describe('parseImageNote', () => {
  it('«фото:» — пожелание к картинке', () => {
    expect(parseImageNote('фото: в тёплых тонах')).toBe('в тёплых тонах')
    expect(parseImageNote('Картинка : минимализм')).toBe('минимализм')
  })

  it('обычный ответ — не пожелание к картинке', () => {
    expect(parseImageNote('перепиши первый абзац')).toBeNull()
  })
})

describe('parseImageStyle', () => {
  it('«-» и пустая строка сбрасывают стиль', () => {
    expect(parseImageStyle('-')).toBeNull()
    expect(parseImageStyle('   ')).toBeNull()
  })

  it('текст сохраняется как стиль', () => {
    expect(parseImageStyle(' тёплые тона ')).toBe('тёплые тона')
  })
})
