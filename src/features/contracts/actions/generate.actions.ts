'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  buildContractVariables,
  generateDocxFromTemplate,
  uploadContractFile,
} from '../services/document.service'

export async function generateContractDocx(contractId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

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
      .select('file_url, name')
      .eq('template_type', contract.contract_type)
      .limit(1)
      .single()

    let docxBuffer: Buffer

    if (template?.file_url) {
      // Загружаем шаблон из Storage
      const { data: templateFile } = await supabase.storage
        .from('document-templates')
        .download(template.file_url)

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
    })

    revalidatePath(`/contracts/${contractId}`)
    return { success: true, docxUrl, version: nextVersion }
  } catch (err) {
    console.error('Generate contract error:', err)
    return { error: err instanceof Error ? err.message : 'Ошибка генерации' }
  }
}

// Генерация базового DOCX без шаблона (встроенная заглушка)
async function generateBasicDocx(
  vars: Awaited<ReturnType<typeof buildContractVariables>>,
  contractType: string
): Promise<Buffer> {
  // Простой DOCX через XML
  const typeNames: Record<string, string> = {
    rent_apartment: 'ДОГОВОР НАЙМА ЖИЛОГО ПОМЕЩЕНИЯ',
    rent_commercial: 'ДОГОВОР АРЕНДЫ НЕЖИЛОГО ПОМЕЩЕНИЯ',
    sale_apartment: 'ДОГОВОР КУПЛИ-ПРОДАЖИ КВАРТИРЫ',
    sale_house: 'ДОГОВОР КУПЛИ-ПРОДАЖИ ДОМА',
    property_management: 'ДОГОВОР ДОВЕРИТЕЛЬНОГО УПРАВЛЕНИЯ',
    sublease: 'ДОГОВОР СУБАРЕНДЫ',
    agency_contract: 'АГЕНТСКИЙ ДОГОВОР',
  }

  const title = typeNames[contractType] || 'ДОГОВОР'

  const xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
  <w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:pPr>
    <w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${title}</w:t></w:r>
  </w:p>
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:t>№ ${vars.CONTRACT_NUMBER}</w:t></w:r>
  </w:p>
  <w:p><w:r><w:t xml:space="preserve">${vars.CITY}, ${vars.CONTRACT_DATE}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Стороны договора:</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Наниматель/Покупатель: ${vars.CLIENT_NAME}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Паспорт: ${vars.CLIENT_PASSPORT}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Телефон: ${vars.CLIENT_PHONE}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Предмет договора:</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Объект: ${vars.PROPERTY_TITLE}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Адрес: ${vars.PROPERTY_ADDRESS}</w:t></w:r></w:p>
  ${vars.PROPERTY_AREA !== '___' ? `<w:p><w:r><w:t xml:space="preserve">Площадь: ${vars.PROPERTY_AREA}</w:t></w:r></w:p>` : ''}
  <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Сроки аренды:</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Начало: ${vars.START_DATE}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Окончание: ${vars.END_DATE}</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Финансовые условия:</w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Стоимость: ${vars.PRICE} руб. (${vars.PRICE_WORDS})</w:t></w:r></w:p>
  ${vars.DEPOSIT !== '0' ? `<w:p><w:r><w:t xml:space="preserve">Залог: ${vars.DEPOSIT} руб. (${vars.DEPOSIT_WORDS})</w:t></w:r></w:p>` : ''}
  <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
  <w:p><w:pPr><w:jc w:val="left"/></w:pPr>
    <w:r><w:t xml:space="preserve">Менеджер агентства: ${vars.MANAGER_NAME}                    Подпись: _______________</w:t></w:r>
  </w:p>
  <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
  <w:p><w:r><w:t xml:space="preserve">Клиент: ${vars.CLIENT_NAME}                              Подпись: _______________</w:t></w:r></w:p>
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
