// Сценарий «Занести в CRM»: оркестрация. Сессия сбора документов на пользователя,
// файлы — в приватный бакет `documents`, один вызов модели по «Готово»,
// карточка подтверждения, запись через Postgres-функцию import_intake.
//
// Модель здесь никогда не решает, что создавать: тип задан кнопкой, а что
// именно появится в CRM — детерминированно описано в карточке до нажатия.
// Чистая часть (промпты, карточка, типы) — src/features/telegram/services/intake-format.ts.

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Row } from '@/types/database'
import type { Json } from '@/types/supabase'
import {
  sendMessage,
  editMessageText,
  editMessageReplyMarkup,
  downloadTelegramFile,
  sendChatAction,
  type InlineKeyboardButton,
} from '@/lib/telegram/api'
import { chatCompletion, type LlmContentPart } from '@/lib/telegram/llm'
import { extractTextFromDocx } from '@/lib/telegram/docx-reader'
import { getSiteUrl } from '@/lib/telegram/site-url'
import type { BotActor } from '@/features/telegram/services/access'
import {
  INTAKE_DATA_KINDS,
  INTAKE_KIND_LABELS,
  INTAKE_PROMPTS,
  INTAKE_SYSTEM_PREAMBLE,
  INTAKE_TOOL,
  directionFor,
  intakeBlockers,
  intakeIntro,
  plural,
  renderCollectingStatus,
  renderIntakeCard,
  type IntakeExtraction,
  type IntakeFileRef,
  type IntakeKind,
} from '@/features/telegram/services/intake-format'

const BUCKET = 'documents'
/** Больше не читаем: два паспорта + выписка укладываются, а на 20 фото модель за 60 с не ответит. */
const MAX_FILES = 12
const MAX_FILE_BYTES = 20 * 1024 * 1024

export type IntakeSession = Row<'bot_intake_sessions'>

function files(s: IntakeSession): IntakeFileRef[] {
  return Array.isArray(s.files) ? (s.files as unknown as IntakeFileRef[]) : []
}

// ─── Сессии ─────────────────────────────────────────────────────────────────

/** Открытая сессия пользователя; просроченную закрывает и возвращает null. */
export async function getActiveIntake(telegramUserId: string): Promise<IntakeSession | null> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data } = await supabaseAdmin
    .from('bot_intake_sessions')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .in('status', ['collecting', 'extracting', 'extracted'])
    .maybeSingle()
  if (!data) return null
  if (new Date(data.expires_at) < new Date()) {
    await supabaseAdmin.from('bot_intake_sessions').update({ status: 'expired' }).eq('id', data.id)
    await removeSessionFiles(data)
    return null
  }
  return data
}

async function getIntakeById(id: string, actor: BotActor): Promise<IntakeSession | null> {
  const { data } = await getSupabaseAdmin()
    .from('bot_intake_sessions')
    .select('*')
    .eq('id', id)
    .eq('organization_id', actor.orgId)
    .maybeSingle()
  return data ?? null
}

/**
 * Создаёт сессию. Две страницы паспорта из одного альбома приходят
 * параллельными update — уникальный индекс пускает только одну, вторая
 * подхватывает уже созданную.
 */
async function createIntake(actor: BotActor, kind: IntakeKind): Promise<IntakeSession> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('bot_intake_sessions')
    .insert({
      organization_id: actor.orgId,
      telegram_chat_id: String(actor.chatId),
      telegram_user_id: actor.telegramUserId,
      kind,
    })
    .select('*')
    .single()
  if (data) return data
  const existing = await getActiveIntake(actor.telegramUserId)
  if (existing) return existing
  throw new Error(error?.message ?? 'Не удалось открыть сессию')
}

/** Кнопка меню: пользователь сам сказал, что заводим. */
export async function startIntake(actor: BotActor, kind: IntakeKind): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  const active = await getActiveIntake(actor.telegramUserId)
  let session: IntakeSession
  if (active) {
    // Начатую без типа (фото пришло раньше кнопки) — просто типизируем;
    // начатую с другим типом — закрываем, файлы переносить некуда.
    if (active.kind !== 'unknown' && active.kind !== kind) await cancelIntake(active, { silent: true })
    if (active.kind === 'unknown' || active.kind === kind) {
      const { data } = await supabaseAdmin
        .from('bot_intake_sessions')
        .update({ kind, status: 'collecting', updated_at: new Date().toISOString() })
        .eq('id', active.id)
        .select('*')
        .single()
      session = data ?? active
    } else {
      session = await createIntake(actor, kind)
    }
  } else {
    session = await createIntake(actor, kind)
  }
  await sendMessage(actor.chatId, intakeIntro(kind))
  if (files(session).length || session.notes.length) await refreshStatus(actor, session)
}

export async function cancelIntake(session: IntakeSession, opts?: { silent?: boolean }): Promise<void> {
  await getSupabaseAdmin()
    .from('bot_intake_sessions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', session.id)
  await removeSessionFiles(session)
  if (session.status_message_id && !opts?.silent) {
    await editMessageReplyMarkup(Number(session.telegram_chat_id), Number(session.status_message_id), null)
  }
}

async function removeSessionFiles(session: IntakeSession): Promise<void> {
  const paths = files(session).map((f) => f.path)
  if (!paths.length) return
  await getSupabaseAdmin().storage.from(BUCKET).remove(paths).then(({ error }) => {
    if (error) console.error('[intake] remove files:', error.message)
  })
}

// ─── Приём материалов ───────────────────────────────────────────────────────

export interface IncomingFile {
  fileId: string
  source: 'photo' | 'document'
  fileName?: string
  mimeType?: string
  fileSize?: number
  mediaGroupId?: string
  caption?: string
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
}

/**
 * Фото или документ. Без открытой сессии — заводит сессию «не выбрано» и
 * спрашивает, что это; с открытой — просто добавляет. Модель не вызывается.
 */
export async function attachFileToIntake(actor: BotActor, incoming: IncomingFile): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  const session = (await getActiveIntake(actor.telegramUserId)) ?? (await createIntake(actor, 'unknown'))

  if (files(session).length >= MAX_FILES) {
    await sendMessage(actor.chatId, `Больше ${MAX_FILES} файлов в одну сессию не беру — жми «Готово» или «Отмена».`)
    return
  }
  if (incoming.fileSize && incoming.fileSize > MAX_FILE_BYTES) {
    await sendMessage(actor.chatId, 'Файл больше 20 МБ — пришли поменьше или фото страниц.')
    return
  }

  const { base64, mimeType: detectedMime } = await downloadTelegramFile(incoming.fileId)
  const mime = incoming.mimeType ?? detectedMime
  const ext = mime === 'application/pdf' ? 'pdf' : mime.includes('wordprocessingml') ? 'docx' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  const name = incoming.fileName ?? `${incoming.source}-${Date.now()}.${ext}`
  const path = `${actor.orgId}/intake/${session.id}/${Date.now()}-${safeName(name)}`

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(base64, 'base64'), { contentType: mime, upsert: false })
  if (upErr) {
    await sendMessage(actor.chatId, `⚠️ Не смог сохранить файл: ${upErr.message}`)
    return
  }

  const ref: IntakeFileRef = { path, mime, name, source: incoming.source, media_group_id: incoming.mediaGroupId }
  // Атомарное добавление: параллельные фото альбома не должны терять друг друга.
  const { data: updated, error } = await supabaseAdmin.rpc('intake_append', {
    p_id: session.id,
    p_file: ref as unknown as Json,
    p_note: incoming.caption?.trim() || null,
  })
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([path])
    await sendMessage(actor.chatId, `⚠️ Не смог записать файл в сессию: ${error.message}`)
    return
  }
  if (!updated) {
    // Сессия в этот момент читается моделью: файл в неё уже не попадёт.
    await supabaseAdmin.storage.from(BUCKET).remove([path])
    await sendMessage(actor.chatId, '⏳ Сейчас читаю уже присланное — пришли этот файл ещё раз, когда появится карточка.')
    return
  }
  await refreshStatus(actor, updated as IntakeSession)
}

/** Текст или расшифровка голоса, пока сессия открыта: заметка к документам. */
export async function attachNoteToIntake(actor: BotActor, session: IntakeSession, text: string): Promise<void> {
  const { data: updated } = await getSupabaseAdmin().rpc('intake_append', {
    p_id: session.id,
    p_file: null,
    p_note: text.trim(),
  })
  if (updated) await refreshStatus(actor, updated as IntakeSession)
}

function kindKeyboard(sessionId: string): InlineKeyboardButton[][] {
  return [
    [
      { text: INTAKE_KIND_LABELS.tenant, callback_data: `intake:tenant:${sessionId}` },
      { text: INTAKE_KIND_LABELS.owner, callback_data: `intake:owner:${sessionId}` },
    ],
    [
      { text: INTAKE_KIND_LABELS.property, callback_data: `intake:property:${sessionId}` },
      { text: INTAKE_KIND_LABELS.contract, callback_data: `intake:contract:${sessionId}` },
    ],
    [
      { text: INTAKE_KIND_LABELS.receipt, callback_data: `intake:receipt:${sessionId}` },
      { text: '❌ Отмена', callback_data: `intake:cancel:${sessionId}` },
    ],
  ]
}

function collectingKeyboard(sessionId: string): InlineKeyboardButton[][] {
  return [
    [
      { text: '✅ Готово', callback_data: `intake:done:${sessionId}` },
      { text: '❌ Отмена', callback_data: `intake:cancel:${sessionId}` },
    ],
  ]
}

/**
 * Одно сообщение-статус на сессию: перерисовывается, а не плодится. Старое
 * (у которого сняли кнопки или которое не отредактировалось) заменяется новым.
 */
async function refreshStatus(actor: BotActor, session: IntakeSession): Promise<void> {
  const text = renderCollectingStatus(session.kind as IntakeKind, files(session), session.notes)
  const keyboard = session.kind === 'unknown' ? kindKeyboard(session.id) : collectingKeyboard(session.id)
  const supabaseAdmin = getSupabaseAdmin()

  if (session.status_message_id) {
    const ok = await editMessageText(actor.chatId, Number(session.status_message_id), text, { inlineKeyboard: keyboard })
    if (ok) return
    await editMessageReplyMarkup(actor.chatId, Number(session.status_message_id), null)
  }
  const sent = await sendMessage(actor.chatId, text, { inlineKeyboard: keyboard })
  const messageId = sent?.result?.message_id
  if (messageId) {
    await supabaseAdmin.from('bot_intake_sessions').update({ status_message_id: messageId }).eq('id', session.id)
  }
}

// ─── Извлечение ─────────────────────────────────────────────────────────────

async function loadFileParts(session: IntakeSession): Promise<{ parts: LlmContentPart[]; docxTexts: string[] }> {
  const storage = getSupabaseAdmin().storage.from(BUCKET)
  const parts: LlmContentPart[] = []
  const docxTexts: string[] = []
  for (const f of files(session)) {
    const { data, error } = await storage.download(f.path)
    if (error || !data) throw new Error(`не смог прочитать файл ${f.name}: ${error?.message ?? 'пусто'}`)
    const buf = Buffer.from(await data.arrayBuffer())
    if (f.mime === 'application/pdf') {
      parts.push({ type: 'file', file: { filename: f.name, file_data: `data:application/pdf;base64,${buf.toString('base64')}` } })
    } else if (f.mime.includes('wordprocessingml') || f.name.toLowerCase().endsWith('.docx')) {
      docxTexts.push(`--- Текст документа «${f.name}» ---\n${extractTextFromDocx(buf)}`)
    } else {
      parts.push({ type: 'image_url', image_url: { url: `data:${f.mime};base64,${buf.toString('base64')}` } })
    }
  }
  return { parts, docxTexts }
}

/** Материалы сессии в виде контента для модели — используется и для «🧾 Чек». */
export async function intakeContentParts(session: IntakeSession, leadText: string): Promise<LlmContentPart[]> {
  const { parts, docxTexts } = await loadFileParts(session)
  const text = [leadText, ...docxTexts, session.notes.length ? `Сообщения пользователя:\n${session.notes.map((n) => `• ${n}`).join('\n')}` : '']
    .filter(Boolean)
    .join('\n\n')
  return [{ type: 'text', text }, ...parts]
}

async function extract(session: IntakeSession, kind: Exclude<IntakeKind, 'unknown' | 'receipt'>, correction?: { previous: IntakeExtraction; text: string }): Promise<IntakeExtraction> {
  const lead = correction
    ? `Ранее ты вычитал из этих документов:\n${JSON.stringify(correction.previous)}\n\nПользователь поправил: «${correction.text}». ` +
      'Верни ПОЛНЫЙ обновлённый результат тем же инструментом — с учётом поправки, остальные поля сохрани.'
    : 'Документы и сообщения ниже. Вычитай поля и верни их инструментом submit_extraction.'
  const content = await intakeContentParts(session, lead)

  const completion = await chatCompletion({
    system: `${INTAKE_SYSTEM_PREAMBLE}\n\n${INTAKE_PROMPTS[kind]}`,
    messages: [{ role: 'user', content }],
    tools: [INTAKE_TOOL],
    toolChoice: { name: 'submit_extraction' },
    maxTokens: 2000,
  })
  const call = completion.choices?.[0]?.message?.tool_calls?.[0]
  if (!call) throw new Error('модель не вернула результат')
  let parsed: IntakeExtraction
  try {
    parsed = JSON.parse(call.function.arguments) as IntakeExtraction
  } catch {
    throw new Error('модель вернула нечитаемый результат')
  }
  return parsed
}

/**
 * «Готово»: один вызов модели с чистым контекстом (только материалы сессии) и
 * карточка подтверждения. Повторное нажатие, пока идёт извлечение, игнорируется.
 */
export async function runIntakeExtraction(actor: BotActor, sessionId: string, correctionText?: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  const session = await getIntakeById(sessionId, actor)
  if (!session || !['collecting', 'extracted'].includes(session.status)) {
    await sendMessage(actor.chatId, 'Эта сессия уже закрыта — открой новую через /menu → 📋 CRM → 📥 Занести в CRM.')
    return
  }
  const kind = session.kind as IntakeKind
  if (!INTAKE_DATA_KINDS.includes(kind)) {
    await sendMessage(actor.chatId, 'Сначала выбери, что это, кнопкой под сообщением.')
    return
  }
  if (!files(session).length && !session.notes.length) {
    await sendMessage(actor.chatId, 'Пока ничего не прислано — нужно хотя бы фото документа или текст.')
    return
  }

  const { data: locked } = await supabaseAdmin
    .from('bot_intake_sessions')
    .update({ status: 'extracting', updated_at: new Date().toISOString() })
    .eq('id', session.id)
    .in('status', ['collecting', 'extracted'])
    .select('id')
    .maybeSingle()
  if (!locked) return

  await sendChatAction(actor.chatId, 'typing')
  const progress = await sendMessage(actor.chatId, correctionText ? '✏️ Применяю поправку…' : `📖 Читаю ${files(session).length} ${plural(files(session).length, 'файл', 'файла', 'файлов')}…`)

  try {
    const previous = (session.extracted ?? null) as IntakeExtraction | null
    const extracted = await extract(
      session,
      kind as Exclude<IntakeKind, 'unknown' | 'receipt'>,
      correctionText && previous ? { previous, text: correctionText } : undefined,
    )
    await supabaseAdmin
      .from('bot_intake_sessions')
      .update({ status: 'extracted', extracted: extracted as unknown as Json, updated_at: new Date().toISOString() })
      .eq('id', session.id)
    if (session.status_message_id) await editMessageReplyMarkup(actor.chatId, Number(session.status_message_id), null)
    await showCard(actor, { ...session, extracted: extracted as unknown as Json }, extracted, progress?.result?.message_id)
  } catch (e) {
    await supabaseAdmin
      .from('bot_intake_sessions')
      .update({ status: 'collecting', updated_at: new Date().toISOString() })
      .eq('id', session.id)
    const reason = e instanceof Error ? e.message : 'ошибка'
    await sendMessage(actor.chatId, `⚠️ Не смог прочитать документы: ${reason}.\nПопробуй ещё раз «Готово» или пришли фото почётче.`, {
      inlineKeyboard: collectingKeyboard(session.id),
    })
  }
}

async function showCard(actor: BotActor, session: IntakeSession, extracted: IntakeExtraction, replaceMessageId?: number): Promise<void> {
  const kind = session.kind as IntakeKind
  const blockers = intakeBlockers(kind, extracted)
  const withDeal = kind !== 'property'
  const text = renderIntakeCard(kind, extracted, { createDeal: withDeal, fileCount: files(session).length })
  const keyboard: InlineKeyboardButton[][] = []
  if (blockers.length) {
    keyboard.push([{ text: '🔁 Прочитать заново', callback_data: `intake:done:${session.id}` }])
  } else {
    keyboard.push([{ text: '✅ Создать', callback_data: `intake:create:${session.id}` }])
    if (kind === 'tenant' || kind === 'owner') {
      keyboard.push([{ text: '🧲 Только контакт и лид, без сделки', callback_data: `intake:lead:${session.id}` }])
    }
  }
  keyboard.push([{ text: '❌ Отмена', callback_data: `intake:cancel:${session.id}` }])

  const full = blockers.length
    ? `${text}\n\n⛔ Не хватает: ${blockers.join(', ')}. Пришли документ почётче или напиши недостающее текстом и нажми «Прочитать заново».`
    : text

  let messageId: number | undefined
  if (replaceMessageId) {
    const ok = await editMessageText(actor.chatId, replaceMessageId, full, { inlineKeyboard: keyboard })
    if (ok) messageId = replaceMessageId
  }
  if (!messageId) {
    const sent = await sendMessage(actor.chatId, full, { inlineKeyboard: keyboard })
    messageId = sent?.result?.message_id
  }
  if (messageId) {
    await getSupabaseAdmin().from('bot_intake_sessions').update({ status_message_id: messageId }).eq('id', session.id)
  }
}

// ─── Запись в CRM ───────────────────────────────────────────────────────────

export async function commitIntake(actor: BotActor, sessionId: string, mode: 'full' | 'lead'): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  const session = await getIntakeById(sessionId, actor)
  if (!session || session.status !== 'extracted' || !session.extracted) {
    await sendMessage(actor.chatId, 'Это подтверждение уже недоступно.')
    return
  }
  if (session.telegram_user_id !== actor.telegramUserId) {
    await sendMessage(actor.chatId, '⛔ Эту сессию открыл другой пользователь.')
    return
  }
  const kind = session.kind as IntakeKind
  const extracted = session.extracted as unknown as IntakeExtraction

  // Блокируем повторное нажатие «Создать».
  const { data: locked } = await supabaseAdmin
    .from('bot_intake_sessions')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('id', session.id)
    .eq('status', 'extracted')
    .select('id')
    .maybeSingle()
  if (!locked) return
  if (session.status_message_id) await editMessageReplyMarkup(actor.chatId, Number(session.status_message_id), null)

  const createDeal = mode === 'full' && kind !== 'property'
  const payload = {
    contact: extracted.contact ?? null,
    tenant: extracted.tenant ?? null,
    property: extracted.property ?? null,
    lead: extracted.lead ?? {},
    deal: { ...(extracted.deal ?? {}), direction: createDeal ? directionFor(kind, extracted) : null },
    create_lead: kind === 'tenant' || kind === 'owner',
    create_deal: createDeal,
  }

  const { data, error } = await supabaseAdmin.rpc('import_intake', {
    p_org_id: actor.orgId,
    p_kind: kind,
    p_payload: payload as unknown as Json,
  })
  if (error || !data) {
    await supabaseAdmin.from('bot_intake_sessions').update({ status: 'extracted' }).eq('id', session.id)
    await sendMessage(actor.chatId, `⚠️ Не получилось записать: ${friendlyImportError(error?.message)}`, {
      inlineKeyboard: [[{ text: '✅ Попробовать ещё раз', callback_data: `intake:${mode === 'full' ? 'create' : 'lead'}:${session.id}` }]],
    })
    return
  }

  const result = data as unknown as {
    contact_id: string | null
    contact_existed: boolean
    tenant_id: string | null
    tenant_existed: boolean
    property_id: string | null
    property_existed: boolean
    lead_id: string | null
    deal_id: string | null
  }
  await supabaseAdmin.from('bot_intake_sessions').update({ result: result as unknown as Json }).eq('id', session.id)

  const attached = await attachFilesToEntities(session, kind, result)
  await sendMessage(actor.chatId, renderDone(kind, result, attached), { inlineKeyboard: doneKeyboard(result) })
}

/** Сканы из сессии — в карточку: паспорта к контакту, выписка к объекту, договор к сделке. */
async function attachFilesToEntities(
  session: IntakeSession,
  kind: IntakeKind,
  result: { contact_id: string | null; property_id: string | null; deal_id: string | null },
): Promise<number> {
  const target =
    kind === 'property'
      ? { column: 'property_id' as const, id: result.property_id }
      : kind === 'contract'
        ? { column: 'deal_id' as const, id: result.deal_id }
        : { column: 'client_id' as const, id: result.contact_id }
  if (!target.id) return 0

  const supabaseAdmin = getSupabaseAdmin()
  const storage = supabaseAdmin.storage.from(BUCKET)
  let attached = 0
  for (const f of files(session)) {
    const newPath = `${session.organization_id}/${target.id}/${f.path.split('/').pop()}`
    const { error: moveErr } = await storage.move(f.path, newPath)
    if (moveErr) {
      console.error('[intake] move file:', moveErr.message)
      continue
    }
    const { error } = await supabaseAdmin.from('files').insert({
      organization_id: session.organization_id,
      file_name: f.name,
      file_url: newPath,
      file_type: f.mime,
      [target.column]: target.id,
    })
    if (error) console.error('[intake] files insert:', error.message)
    else attached++
  }
  return attached
}

function renderDone(
  kind: IntakeKind,
  r: { contact_id: string | null; contact_existed: boolean; tenant_id: string | null; tenant_existed: boolean; property_id: string | null; property_existed: boolean; lead_id: string | null; deal_id: string | null },
  attached: number,
): string {
  const lines: string[] = ['✅ Записал в CRM:']
  if (r.contact_id) lines.push(`• контакт${r.contact_existed ? ' — уже был, дополнил' : ''}`)
  if (r.tenant_id) lines.push(`• арендатор${r.tenant_existed ? ' — уже был, дополнил' : ''}`)
  if (r.property_id) lines.push(`• объект${r.property_existed ? ' — уже был по кадастровому номеру, дополнил' : ''}`)
  if (r.lead_id) lines.push(`• лид (источник Telegram${r.deal_id ? ', сразу конвертирован' : ''})`)
  if (r.deal_id) lines.push('• сделка — стоит «на проверку», дозаполни и сними отметку')
  if (attached) lines.push(`• ${attached} ${plural(attached, 'файл', 'файла', 'файлов')} в карточке`)
  if (kind === 'property' && r.property_id) lines.push('\nНазначение объекта и цену уточни в карточке.')
  return lines.join('\n')
}

function doneKeyboard(r: { contact_id: string | null; property_id: string | null; deal_id: string | null; lead_id: string | null }): InlineKeyboardButton[][] {
  const base = getSiteUrl()
  const row: InlineKeyboardButton[] = []
  if (r.deal_id) row.push({ text: '🤝 Открыть сделку', url: `${base}/deals/${r.deal_id}` })
  if (r.contact_id) row.push({ text: '👤 Контакт', url: `${base}/contacts/${r.contact_id}` })
  if (r.property_id) row.push({ text: '🏠 Объект', url: `${base}/properties/${r.property_id}` })
  if (!r.deal_id && r.lead_id) row.push({ text: '🧲 Лид', url: `${base}/leads/${r.lead_id}` })
  return row.length ? [row] : []
}

function friendlyImportError(message?: string): string {
  if (!message) return 'база не ответила'
  if (message.includes('не хватает')) return message.replace(/^import_intake:\s*/, '')
  if (message.includes('check constraint')) return 'значение не из справочника — напиши поправку и попробуй снова'
  return message
}
