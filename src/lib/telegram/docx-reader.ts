import PizZip from 'pizzip'

/**
 * Достаёт текст из DOCX (уже есть pizzip как зависимость для генерации договоров —
 * переиспользуем, не добавляя новый пакет). DOCX — это zip с document.xml внутри;
 * просто убираем XML-теги, этого достаточно, чтобы модель прочитала содержание
 * (форматирование неважно, важен только текст для анализа).
 */
export function extractTextFromDocx(buffer: Buffer): string {
  const zip = new PizZip(buffer)
  const xml = zip.file('word/document.xml')?.asText()
  if (!xml) throw new Error('Не удалось прочитать word/document.xml — файл повреждён или не DOCX')

  return xml
    .replace(/<w:p[ >]/g, '\n$&') // абзацы — на новую строку, иначе всё слипнется в одну строку
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
