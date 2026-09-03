import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, KeyRound } from 'lucide-react'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { currentScope } from '@/features/portal/services/access.service'

export const dynamic = 'force-dynamic'

/**
 * Главная кабинета: объекты, к которым у вошедшего есть доступ.
 *
 * Один человек может быть и собственником одной квартиры, и арендатором
 * другой — тогда здесь два раздела, а не переключатель ролей.
 */
export default async function CabinetPage() {
  const scope = await currentScope()
  if (!scope) redirect('/cabinet/login')

  const supabaseAdmin = getSupabaseAdmin()
  const propertyIds = [...new Set(scope.grants.map(g => g.propertyId))]
  const { data: properties } = await supabaseAdmin
    .from('properties')
    .select('id, title, address')
    .in('id', propertyIds)

  const byId = new Map((properties ?? []).map(p => [p.id, p]))
  const owned = scope.grants.filter(g => g.role === 'owner')
  const rented = scope.grants.filter(g => g.role === 'tenant')

  return (
    <div className="space-y-6">
      {owned.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--hp-ink)]">Мои объекты в управлении</h2>
          <div className="hp-block">
            {owned.map(grant => {
              const property = byId.get(grant.propertyId)
              return (
                <Link key={grant.id} href={`/cabinet/owner/${grant.propertyId}`} className="hp-block-item">
                  <Building2 className="w-4 h-4 shrink-0 text-[var(--hp-tertiary)]" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[var(--hp-ink)]">{property?.title ?? 'Объект'}</span>
                    {property?.address && (
                      <span className="block truncate text-[12px] text-[var(--hp-sub)]">{property.address}</span>
                    )}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {rented.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--hp-ink)]">Я снимаю</h2>
          <div className="hp-block">
            {rented.map(grant => {
              const property = byId.get(grant.propertyId)
              return (
                <Link key={grant.id} href={`/cabinet/tenant/${grant.propertyId}`} className="hp-block-item">
                  <KeyRound className="w-4 h-4 shrink-0 text-[var(--hp-tertiary)]" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[var(--hp-ink)]">{property?.title ?? 'Объект'}</span>
                    {property?.address && (
                      <span className="block truncate text-[12px] text-[var(--hp-sub)]">{property.address}</span>
                    )}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
