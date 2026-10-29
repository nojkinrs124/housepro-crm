'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import {
  buildContractVariables,
  generateDocxFromTemplate,
  uploadContractFile,
} from '../services/document.service'
import { buildBasicContractXml } from '../services/basic-docx'
import { getSessionContext, requireOrgId } from '@/lib/org'
import { requirePermission } from '@/lib/permissions'
import { writeAuditLog, writeAuditLogServiceRole } from '@/lib/audit'
import { toJson } from '@/lib/json'

export async function generateContractDocx(contractId: string) {
  const ctx = await getSessionContext()
  if (!ctx.ok) return { error: ctx.error }
  const { supabase, user, orgId } = ctx

  const permError = await requirePermission(user.id, 'contracts', 'update')
  if (permError) return permError

  try {
    // 1. Получаем данные договора
    // Полная строка: её снимок ложится в version_data, иначе «Восстановить»
    // в истории версий не появляется (проход 17.09.2026, RA-8).
    const { data: contract } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single()

    if (!contract) return { error: 'Договор не найден' }

    // 2. Строим переменные
    const variables = await buildContractVariables(contractId)

    // 3. Ищем шаблон для данного типа договора
    const { data: template } = await supabase
      .from('document_templates')
      .select('file_url, storage_path, name')
      .eq('template_type', contract.contract_type)
      .limit(1)
      .single()

    let docxBuffer: Buffer

    if (template?.storage_path || template?.file_url) {
      // Загружаем шаблон из Storage по storage_path (или fallback на file_url для старых записей)
      const downloadPath = template.storage_path || template.file_url
      const { data: templateFile } = await supabase.storage
        .from('document-templates')
        .download(downloadPath)

      if (!templateFile) return { error: 'Не удалось загрузить шаблон' }

      const arrayBuffer = await templateFile.arrayBuffer()
      const templateBuffer = Buffer.from(arrayBuffer)
      docxBuffer = await generateDocxFromTemplate(templateBuffer, variables)
    } else {
      // Генерируем базовый DOCX без шаблона
      docxBuffer = await generateBasicDocx(variables, contract.contract_type)
    }

    // 4. Загружаем в Storage
    const docxUrl = await uploadContractFile(
      contractId,
      docxBuffer,
      'contract.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )

    // 5. Записываем версию
    const { data: versions } = await supabase
      .from('contract_versions')
      .select('version')
      .eq('contract_id', contractId)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = versions && versions.length > 0 ? versions[0].version + 1 : 1

    await supabase.from('contract_versions').insert({
      contract_id: contractId,
      version: nextVersion,
      docx_url: docxUrl,
      version_data: toJson(contract),
      created_by: user.id,
    })

    // 6. Обновляем статус договора
    await supabase
      .from('contracts')
      .update({
        status: 'generated',
        generated_docx_url: docxUrl,
      })
      .eq('id', contractId)

    // Сформированный файл сделку не двигает: подписи под ним ещё нет.
    // Стадию переводит смена статуса договора на «Подписан» (contracts.actions).
    if (contract.deal_id) {
      revalidatePath('/deals')
      revalidatePath(`/deals/${contract.deal_id}`)
    }

    // 7. Журнал аудита — тот, что видит администратор в /settings/audit.
    //    Раньше событие писалось в таблицу logs, которую никто не читал.
    await writeAuditLog({
      userId: user.id, orgId,
      action: 'update', entityType: 'contract', entityId: contractId,
      entityLabel: `Сформирован DOCX, версия ${nextVersion}`,
      changes: { docx_url: { old: null, new: docxUrl }, version: { old: nextVersion - 1, new: nextVersion } },
    })

    revalidatePath(`/contracts/${contractId}`)
    return { success: true, docxUrl, version: nextVersion }
  } catch (err) {
    console.error('Generate contract error:', err)
    return { error: err instanceof Error ? err.message : 'Ошибка генерации' }
  }
}

/**
 * Вариант generateContractDocx() для вызовов с авторизацией по API-ключу (Telegram-бот и
 * прочие service-to-service клиенты) — там нет cookie-сессии, поэтому исходная функция
 * (requireOrgId()/auth.getUser() читают куки) не подходит напрямую. Здесь orgId передаётся
 * явно, а вся работа с БД/Storage идёт через service-role клиент — RLS обходится, поэтому
 * принадлежность договора организации проверяется вручную ниже.
 */
export async function generateContractDocxForOrg(orgId: string, contractId: string) {
  const supabaseAdmin = createServiceRoleClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, options = {}) => fetch(url, { ...(options as RequestInit), cache: 'no-store' }) } }
  )

  try {
    const { data: contract } = await supabaseAdmin
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .eq('organization_id', orgId)
      .single()

    if (!contract) return { error: 'Договор не найден или не принадлежит этой организации' }

    const variables = await buildContractVariables(contractId, supabaseAdmin)

    const { data: template } = await supabaseAdmin
      .from('document_templates')
      .select('file_url, storage_path, name')
      .eq('template_type', contract.contract_type)
      .limit(1)
      .single()

    let docxBuffer: Buffer

    if (template?.storage_path || template?.file_url) {
      const downloadPath = template.storage_path || template.file_url
      const { data: templateFile } = await supabaseAdmin.storage
        .from('document-templates')
        .download(downloadPath)

      if (!templateFile) return { error: 'Не удалось загрузить шаблон' }

      const arrayBuffer = await templateFile.arrayBuffer()
      const templateBuffer = Buffer.from(arrayBuffer)
      docxBuffer = await generateDocxFromTemplate(templateBuffer, variables)
    } else {
      docxBuffer = await generateBasicDocx(variables, contract.contract_type)
    }

    const docxUrl = await uploadContractFile(
      contractId,
      docxBuffer,
      'contract.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      supabaseAdmin
    )

    const { data: versions } = await supabaseAdmin
      .from('contract_versions')
      .select('version')
      .eq('contract_id', contractId)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = versions && versions.length > 0 ? versions[0].version + 1 : 1

    await supabaseAdmin.from('contract_versions').insert({
      contract_id: contractId,
      version: nextVersion,
      docx_url: docxUrl,
      version_data: toJson(contract),
      created_by: null,
    })

    await supabaseAdmin
      .from('contracts')
      .update({ status: 'generated', generated_docx_url: docxUrl })
      .eq('id', contractId)

    await writeAuditLogServiceRole(supabaseAdmin, {
      orgId,
      action: 'update', entityType: 'contract', entityId: contractId,
      entityLabel: `Сформирован DOCX, версия ${nextVersion} (Telegram-бот)`,
      changes: { docx_url: { old: null, new: docxUrl }, version: { old: nextVersion - 1, new: nextVersion } },
    })

    return { success: true, docxUrl, version: nextVersion }
  } catch (err) {
    console.error('Generate contract error (service-role):', err)
    return { error: err instanceof Error ? err.message : 'Ошибка генерации' }
  }
}

// Генерация базового DOCX без шаблона (встроенная заглушка)
async function generateBasicDocx(
  vars: Awaited<ReturnType<typeof buildContractVariables>>,
  contractType: string
): Promise<Buffer> {
  const xmlContent = buildBasicContractXml(vars, contractType)

  // Создаем минимальный DOCX
  const PizZip = (await import('pizzip')).default
  const zip = new PizZip()

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`)

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)

  zip.file('word/document.xml', xmlContent)

  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`)

  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
}
