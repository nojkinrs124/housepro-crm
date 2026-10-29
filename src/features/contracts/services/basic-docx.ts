/**
 * Документ договора без загруженного шаблона.
 *
 * Шаблоны есть не у всех типов договоров (на 28.10.2026 — только у найма и
 * агентского с заказчиком). Прежняя заглушка выдавала «бланк с именами»:
 * раздел «Сроки аренды» у агентского и купли-продажи, «Паспорт» у ООО,
 * «(тысяч рублей)» вместо суммы прописью, «г. Москва» на всех документах,
 * без шрифта и полей (QA 28.10.2026, A-06, A-07, B-06, B-07, C-14).
 *
 * Юридический текст договора эта функция НЕ сочиняет — его даёт шаблон
 * агентства (Настройки → Шаблоны документов). Она собирает аккуратную
 * сводку условий с правильными для типа подписями и честно пишет, что
 * шаблон не загружен.
 *
 * Файл без 'use client' и без 'use server': чистая сборка XML, покрыта тестом.
 */
import { CONTRACT_TYPE_MAP } from '../config/contract-types'

export interface BasicDocVars {
  CONTRACT_NUMBER: string
  CONTRACT_DATE: string
  CITY: string
  PARTY2_NAME: string
  PARTY2_PASSPORT: string
  PARTY2_PHONE: string
  OWNER_NAME?: string
  OWNER_PASSPORT?: string
  OWNER_PHONE?: string
  PARTY2_IS_LEGAL?: boolean
  OWNER_IS_LEGAL?: boolean
  PROPERTY_TITLE: string
  PROPERTY_ADDRESS: string
  PROPERTY_AREA: string
  START_DATE: string
  END_DATE: string
  PRICE: string
  PRICE_WORDS: string
  DEPOSIT: string
  DEPOSIT_WORDS: string
  ИСПОЛНИТЕЛЬ_НАЗВАНИЕ: string
}

const esc = (v: unknown): string => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const RUN = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/></w:rPr>'
const RUN_B = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="24"/></w:rPr>'

function p(text: string, opts: { bold?: boolean; align?: 'center' | 'both' | 'left'; after?: number; size?: number } = {}): string {
  const align = opts.align ?? 'both'
  const after = opts.after ?? 120
  const rpr = opts.size
    ? `<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${opts.bold ? '<w:b/>' : ''}<w:sz w:val="${opts.size}"/></w:rPr>`
    : opts.bold ? RUN_B : RUN
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="${after}" w:line="276" w:lineRule="auto"/></w:pPr><w:r>${rpr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`
}
const h = (text: string) => p(text, { bold: true, align: 'left', after: 80 })

/** Строка «стороны»: у юрлица — без паспорта. */
function partyLine(role: string, name: string, passport: string, phone: string, isLegal: boolean): string[] {
  const out = [p(`${role}: ${name}`, { after: 40 })]
  if (!isLegal) out.push(p(`Паспорт: ${passport}`, { after: 40 }))
  out.push(p(`Телефон: ${phone}`))
  return out
}

/** XML word/document.xml для договора без шаблона. */
export function buildBasicContractXml(vars: BasicDocVars, contractType: string): string {
  const cfg = CONTRACT_TYPE_MAP[contractType]
  const title = cfg?.docTitle ?? 'ДОГОВОР'
  const agencyIsParty = cfg?.party1Role === 'agency'
  const party1Label = cfg?.party1Label ?? 'Сторона 1'
  const party2Label = cfg?.party2Label ?? 'Сторона 2'
  const amountLabel = (cfg?.amountLabel ?? 'Сумма').replace(/\s*\(₽.*\)\s*$/, '')
  const periodic = /\/мес/.test(cfg?.amountLabel ?? '')

  const body: string[] = []
  body.push(p(title, { bold: true, align: 'center', after: 60, size: 28 }))
  body.push(p(`№ ${vars.CONTRACT_NUMBER}`, { align: 'center', after: 240 }))
  body.push(p(`${vars.CITY}                                                                                ${vars.CONTRACT_DATE}`, { align: 'left', after: 240 }))

  body.push(p('Шаблон этого типа договора не загружен в CRM. Ниже — условия, внесённые в карточку договора. Чтобы получать полный текст договора, загрузите шаблон агентства в разделе «Настройки → Шаблоны документов».', { after: 240, size: 20 }))

  body.push(h('1. Стороны'))
  if (agencyIsParty) {
    body.push(p(`${party1Label}: ${vars.ИСПОЛНИТЕЛЬ_НАЗВАНИЕ}`))
  } else {
    body.push(...partyLine(party1Label, vars.OWNER_NAME ?? '_______________', vars.OWNER_PASSPORT ?? '_______________', vars.OWNER_PHONE ?? '_______________', Boolean(vars.OWNER_IS_LEGAL)))
  }
  body.push(...partyLine(party2Label, vars.PARTY2_NAME, vars.PARTY2_PASSPORT, vars.PARTY2_PHONE, Boolean(vars.PARTY2_IS_LEGAL)))

  const hasProperty = vars.PROPERTY_ADDRESS && !/^_+$/.test(vars.PROPERTY_ADDRESS)
  if (hasProperty) {
    body.push(h('2. Объект'))
    body.push(p(`${vars.PROPERTY_TITLE}, ${vars.PROPERTY_ADDRESS}${vars.PROPERTY_AREA && vars.PROPERTY_AREA !== '___' ? `, площадь ${vars.PROPERTY_AREA}` : ''}`))
  }

  const n = hasProperty ? 3 : 2
  body.push(h(`${n}. Срок`))
  if (cfg?.dateMode === 'single') {
    body.push(p(`${cfg.startDateLabel}: ${vars.START_DATE}`))
  } else {
    body.push(p(`${cfg?.startDateLabel ?? 'Начало'}: ${vars.START_DATE}`, { after: 40 }))
    body.push(p(`${cfg?.endDateLabel ?? 'Окончание'}: ${vars.END_DATE}`))
  }

  body.push(h(`${n + 1}. Деньги`))
  body.push(p(`${amountLabel}: ${vars.PRICE} руб. (${vars.PRICE_WORDS})${periodic ? ' в месяц' : ''}`, { after: 40 }))
  if (cfg?.showDeposit && vars.DEPOSIT !== '0') {
    body.push(p(`${cfg.depositLabel?.replace(/\s*\(₽\)\s*$/, '') ?? 'Залог'}: ${vars.DEPOSIT} руб. (${vars.DEPOSIT_WORDS})`))
  }

  body.push(h(`${n + 2}. Подписи сторон`))
  const p1Name = agencyIsParty ? vars.ИСПОЛНИТЕЛЬ_НАЗВАНИЕ : (vars.OWNER_NAME ?? '_______________')
  body.push(p(`${party1Label}: ${p1Name}`, { after: 40 }))
  body.push(p('_______________ / _______________ /', { after: 240 }))
  body.push(p(`${party2Label}: ${vars.PARTY2_NAME}`, { after: 40 }))
  body.push(p('_______________ / _______________ /'))

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
${body.join('\n')}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>
</w:body>
</w:document>`
}

/** Есть ли у типа договора шаблон — подсказка для интерфейса до формирования. */
export const BASIC_DOC_NOTICE =
  'Для этого типа договора шаблон не загружен — сформируется сводка условий без юридического текста. Загрузите шаблон в «Настройки → Шаблоны документов».'
