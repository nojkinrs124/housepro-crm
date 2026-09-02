import { redirect } from 'next/navigation'

/**
 * Экспорт переехал в настройки: это не ежедневный раздел CRM, а разовая
 * настройка выгрузки — рядом с импортом. Путь остаётся редиректом, чтобы не
 * ломать закладки и ссылки в личных кабинетах площадок.
 */
export default function ExportPage() {
  redirect('/settings/export')
}
