import { describe, it, expect } from 'vitest'
import {
  parseDay,
  parseCallbackData,
  parseAddUserInput,
  parseScheduleSlot,
  parseRubricInput,
  parseImageNote,
  parseImageStyle,
} from '@/features/telegram/services/parsing'

const RUBRICS = [
  { key: 'analytics', label: '📊 Аналитика' },
  { key: 'case',      label: '🏠 Кейс' },
  { key: 'cta',       label: '📣 CTA/оффер' },
  { key: 'adhoc',     label: '✍️ Разовый пост' },
]

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

describe('parseDay', () => {
  it('понимает короткие формы', () => {
    expect(parseDay('пн')).toBe('mon')
    expect(parseDay('вс')).toBe('sun')
    expect(parseDay('сб')).toBe('sat')
  })

  it('понимает полные названия', () => {
    expect(parseDay('понедельник')).toBe('mon')
    expect(parseDay('воскресенье')).toBe('sun')
    expect(parseDay('суббота')).toBe('sat')
    expect(parseDay('среда')).toBe('wed')
  })

  it('понимает «вск» и опечатку в хвосте', () => {
    // ровно то, что человек написал боту 04.09.2026 и получил отказ
    expect(parseDay('вск')).toBe('sun')
    expect(parseDay('воскресеньк')).toBe('sun')
  })

  it('понимает английские названия', () => {
    expect(parseDay('fri')).toBe('fri')
    expect(parseDay('Monday')).toBe('mon')
  })

  it('не гадает по одной букве', () => {
    // «в» — это вторник или воскресенье, «с» — среда или суббота
    expect(parseDay('в')).toBeNull()
    expect(parseDay('с')).toBeNull()
  })

  it('не узнаёт мусор', () => {
    expect(parseDay('завтра')).toBeNull()
  })
})

describe('parseScheduleSlot', () => {
  it('разбирает день, время и рубрику по ключу', () => {
    const res = parseScheduleSlot('пн 08:00 cta', RUBRICS)
    expect(res).toEqual({ ok: true, value: { dayKey: 'mon', dayLabel: 'Пн', time: '08:00', rubricKey: 'cta' } })
  })

  it('принимает рубрику названием, а не только ключом', () => {
    // в меню человек видит «📊 Аналитика», а не `analytics`
    const res = parseScheduleSlot('воскресенье 19:00 Аналитика', RUBRICS)
    expect(res.ok && res.value.rubricKey).toBe('analytics')
    expect(res.ok && res.value.dayKey).toBe('sun')
  })

  it('принимает название с эмодзи, скопированное из меню', () => {
    const res = parseScheduleSlot('вс 19:00 📣 CTA/оффер', RUBRICS)
    expect(res.ok && res.value.rubricKey).toBe('cta')
  })

  it('дополняет время до ЧЧ:ММ', () => {
    const res = parseScheduleSlot('ср 8:00 case', RUBRICS)
    expect(res.ok && res.value.time).toBe('08:00')
  })

  it('несуществующее время отвергается и называет причину', () => {
    const res = parseScheduleSlot('пн 99:99 cta', RUBRICS)
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.error).toContain('не бывает')
  })

  it('неизвестный день отвергается и называет причину', () => {
    const res = parseScheduleSlot('завтра 08:00 cta', RUBRICS)
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.error).toContain('день')
  })

  it('неизвестная рубрика перечисляет доступные и подсказывает, как завести новую', () => {
    // «вск 19:00 итоги недели» — реальный ввод, на который бот отвечал
    // одинаковым «не разобрал формат» и не подсказывал ничего
    const res = parseScheduleSlot('вск 19:00 итоги недели', RUBRICS)
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.error).toContain('итоги недели')
    expect(res.ok === false && res.error).toContain('Аналитика')
    expect(res.ok === false && res.error).toContain('Новая рубрика')
  })

  it('мусор отвергается с примером формата', () => {
    const res = parseScheduleSlot('привет', RUBRICS)
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.error).toContain('19:00')
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
