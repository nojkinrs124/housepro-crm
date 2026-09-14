import { createPublicClient } from '@/lib/supabase/public'
import { TRUST } from '@/features/site/uslugi/config'

export interface SiteStats {
  /** Квартир в управлении сейчас */
  objectsInManagement: number
  /** Закрытых сделок за всё время */
  closedDeals: number
}

/**
 * Цифры для страницы «О компании».
 *
 * Живые значения — из CRM через `public_site_stats()` (security definer,
 * наружу только два счётчика). Базовые — со слов заказчика в `TRUST`:
 * CRM ведётся не с 2019 года и пока знает меньше сделок, чем было в жизни.
 * Показываем большее из двух — когда CRM догонит, цифры начнут расти сами,
 * и никто не забудет поправить константу.
 *
 * Ошибка запроса не роняет страницу: остаются базовые значения.
 */
export async function fetchSiteStats(): Promise<SiteStats> {
  const base: SiteStats = {
    objectsInManagement: TRUST.objectsInManagement,
    closedDeals: TRUST.closedDeals,
  }

  const supabase = createPublicClient(3600)
  const { data, error } = await supabase.rpc('public_site_stats')
  if (error) {
    console.error('[site] public_site_stats failed:', error.message)
    return base
  }

  const live = data?.[0]
  if (!live) return base

  return {
    objectsInManagement: Math.max(base.objectsInManagement, live.objects_in_management ?? 0),
    closedDeals: Math.max(base.closedDeals, live.closed_deals ?? 0),
  }
}
