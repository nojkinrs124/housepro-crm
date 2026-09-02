import { redirect } from 'next/navigation'

/**
 * Календарь показов стал общим календарём агентства (/calendar): там же дедлайны
 * задач и плановые платежи. Путь остаётся редиректом ради закладок.
 */
export default async function ShowingsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  redirect(`/calendar?kind=showing${month ? `&month=${month}` : ''}`)
}
