'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceRoleClient } from '@supabase/supabase-js'
import {
  buildContractVariables,
  generateDocxFromTemplate,
  uploadContractFile,
} from '../services/document.service'
import { CONTRACT_TYPE_MAP } from '../config/contract-types'
import { requireOrgId } from '@/lib/org'

export async function generateContractDocx(contractId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  try {
    // 1. Получаем данные договора
    const { data: contract } = await supabase
      .from('contracts')
      .select('contract_type')
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

    // 7. Логируем
    await supabase.from('logs').insert({
      user_id: user.id,
      action: 'generate_contract',
      entity_type: 'contract',
      entity_id: contractId,
      new_data: { version: nextVersion, docx_url: docxUrl },
      organization_id: orgId,
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
      .select('contract_type')
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
      created_by: null,
    })

    await supabaseAdmin
      .from('contracts')
      .update({ status: 'generated', generated_docx_url: docxUrl })
      .eq('id', contractId)

    await supabaseAdmin.from('logs').insert({
      user_id: null,
      action: 'generate_contract',
      entity_type: 'contract',
      entity_id: contractId,
      new_data: { version: nextVersion, docx_url: docxUrl, source: 'telegram_bot' },
      organization_id: orgId,
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
  // Функция для экранирования XML спецсимволов
  const escapeXml = (str: string): string => {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  // Используем экранированные переменные
  const title = CONTRACT_TYPE_MAP[contractType]?.docTitle || 'ДОГОВОР'
  const xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
  <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${escapeXml(title)}</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:t>№ ${escapeXml(vars.CONTRACT_NUMBER)}</w:t></w:r>
  </w:p>
  <w:p><w:r><w:t xml:space="preserve">${escapeXml(vars.CITY)}, ${escapeXml(vars.CONTRACT_DATE)}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Стороны договора:</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Сторона договора: ${escapeXml(vars.PARTY2_NAME)}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Паспорт: ${escapeXml(vars.PARTY2_PASSPORT)}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Телефон: ${escapeXml(vars.PARTY2_PHONE)}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Предмет договора:</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Объект: ${escapeXml(vars.PROPERTY_TITLE)}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Адрес: ${escapeXml(vars.PROPERTY_ADDRESS)}</w:t></w:r></w:p>
  ${vars.PROPERTY_AREA !== '___' ? `<w:p><w:r><w:t xml:space="preserve">Площадь: ${escapeXml(vars.PROPERTY_AREA)}</w:t></w:r></w:p>` : ''}
  <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Сроки аренды:</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Начало: ${escapeXml(vars.START_DATE)}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Окончание: ${escapeXml(vars.END_DATE)}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Финансовые условия:</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Стоимость: ${escapeXml(vars.PRICE)} руб. (${escapeXml(vars.PRICE_WORDS)})</w:t></w:r></w:p>
  ${vars.DEPOSIT !== '0' ? `<w:p><w:r><w:t xml:space="preserve">Залог: ${escapeXml(vars.DEPOSIT)} руб. (${escapeXml(vars.DEPOSIT_WORDS)})</w:t></w:r></w:p>` : ''}
  <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
  <w:p><w:pPr><w:jc w:val="left"/></w:pPr>
    <w:r><w:t xml:space="preserve">Исполнитель: ${escapeXml(vars.ИСПОЛНИТЕЛЬ_НАЗВАНИЕ)}                    Подпись: _______________</w:t></w:r>
  </w:p>
  <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Сторона: ${escapeXml(vars.PARTY2_NAME)}                              Подпись: _______________</w:t></w:r></w:p>
  <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="2160" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>
</w:body>
</w:document>`

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
