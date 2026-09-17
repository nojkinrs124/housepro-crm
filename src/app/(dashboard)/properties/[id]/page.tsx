import { createClient } from '@/lib/supabase/server'
import { deletePropertyAction } from '@/features/properties/actions/properties.actions'
import { AvitoPublishToggle } from '@/features/avito/components/AvitoPublishToggle'
import { SitePublishToggle } from '@/features/properties/components/SitePublishToggle'
import { Edit, TrendingUp, FileText, Plus, User, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CONTRACT_TYPE_LABELS, isActiveRentContract } from '@/features/contracts/config/contract-types'
import { PageHeader } from '@/components/layout/PageHeader'
import { RecordActions } from '@/components/layout/RecordActions'
import { ConfirmDeleteButton } from '@/components/forms/ConfirmDeleteButton'
import { StatStrip } from '@/components/layout/StatStrip'
import Image from 'next/image'
import { PropertyMap } from '@/features/properties/components/PropertyMap'
import { formatAmount, formatDate } from '@/lib/utils'
import { toAvitoStatus } from '@/features/avito/config/status'
import { PROPERTY_TYPE_LABELS as typeLabels, PROPERTY_DEAL_LABELS as dealLabels, PROPERTY_STATUS_LABELS } from '@/features/properties/config/property-labels'
import { DEAL_TYPE_LABELS, DEAL_STATUS_LABELS } from '@/features/deals/config/deal-stages'
import { ReadinessPanel } from '@/components/layout/ReadinessPanel'
import { checkProperty } from '@/lib/readiness'
import { FilesSection } from '@/features/files/components/FilesSection'

const statusBadge: Record<string, string> = {
  available: 'hp-badge-good',
  reserved:  'hp-badge-warn',
  rented:    'hp-badge-info',
  sold:      'hp-badge-neutral',
  inactive:  'hp-badge-neutral',
}
const houseTypeLabels: Record<string, string> = {
  panel: 'Панельный', brick: 'Кирпичный', monolith: 'Монолит',
  monolith_brick: 'Монолит-кирпич', wood: 'Деревянный',
}
const wallMaterialLabels: Record<string, string> = {
  brick: 'Кирпич', panel: 'Панель', concrete: 'Бетон', wood: 'Дерево', gas_block: 'Газоблок',
}
const heatingLabels: Record<string, string> = {
  central: 'Центральное', gas: 'Газовое', electric: 'Электрическое', autonomous: 'Автономное',
}
const waterLabels: Record<string, string> = {
  central: 'Центральное', well: 'Скважина/колодец', none: 'Нет',
}
const contractStatusLabels: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'черновик',  cls: 'text-[var(--hp-tertiary)]' },
  generated: { label: 'создан',    cls: 'text-[var(--hp-sub)]' },
  signed:    { label: 'подписан',  cls: 'text-[var(--hp-good)]' },
  completed: { label: 'завершён',  cls: 'text-[var(--hp-good)]' },
  cancelled: { label: 'отменён',   cls: 'text-[var(--hp-danger)]' },
}

const yesNo = (v: boolean | null | undefined) => (v == null ? null : v ? 'да' : 'нет')

/**
 * Карточка объекта — по скелету эталона (сделки). Счётчики (MetersPanel) и
 * вложения (FilesSection) скрыты: записей нет, см. docs/HIDDEN.md.
 */
export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select('*, manager:users(full_name), owner:contacts!owner_id(id, full_name, phone, email)')
    .eq('id', id)
    .single()

  if (propertyError && propertyError.code !== 'PGRST116') {
    throw new Error(`Не удалось загрузить объект: ${propertyError.message}`)
  }
  if (!property) notFound()

  const [{ data: contracts }, { data: deals }, { data: engagement }] = await Promise.all([
    supabase.from('contracts')
      .select('id, contract_number, contract_type, status, amount, created_at, end_date')
      .eq('property_id', id).order('created_at', { ascending: false }),
    supabase.from('deals')
      .select('id, deal_type, status, amount, created_at, deal_number')
      .eq('property_id', id).order('created_at', { ascending: false }).limit(5),
    // Объект в управлении — отдельная сущность, а не тип сделки в карточке
    supabase.from('management_engagements')
      .select('id')
      .eq('property_id', id)
      .is('ended_at', null)
      .maybeSingle(),
  ])

  const p = property
  const manager = p.manager as { full_name?: string } | null
  const owner = p.owner as { id: string; full_name: string; phone?: string | null; email?: string | null } | null

  // Договор аренды и статус объекта расходятся чаще всего: статус переставить
  // забывают, и сданный объект продолжает висеть в рекламе.
  const hasActiveRentContract = (contracts ?? []).some(c => isActiveRentContract(c))
  const issues = checkProperty(p, { hasActiveRentContract, hasActiveEngagement: !!engagement })

  const photos = (p.photo_urls ?? []) as string[]

  const params_ = [
    { label: 'Общая площадь', value: p.area ? `${p.area} м²` : null },
    { label: 'Жилая площадь', value: p.living_area ? `${p.living_area} м²` : null },
    { label: 'Кухня', value: p.kitchen_area ? `${p.kitchen_area} м²` : null },
    { label: 'Участок', value: p.land_area ? `${p.land_area} сот.` : null },
    { label: 'Комнат', value: p.rooms },
    { label: 'Этаж', value: p.floor && p.total_floors ? `${p.floor} из ${p.total_floors}` : (p.floor ?? null) },
    { label: 'Высота потолков', value: p.ceiling_height ? `${p.ceiling_height} м` : null },
    { label: 'Тип дома', value: p.house_type ? houseTypeLabels[p.house_type] ?? p.house_type : null },
    { label: 'Материал стен', value: p.wall_material ? wallMaterialLabels[p.wall_material] ?? p.wall_material : null },
    { label: 'Год постройки', value: p.year_built },
    { label: 'Лифт', value: yesNo(p.has_elevator) },
    { label: 'Парковка', value: yesNo(p.has_parking) },
    { label: 'Отопление', value: p.heating_type ? heatingLabels[p.heating_type] ?? p.heating_type : null },
    { label: 'Водоснабжение', value: p.water_supply_type ? waterLabels[p.water_supply_type] ?? p.water_supply_type : null },
    { label: 'Интернет', value: yesNo(p.has_internet) },
    { label: 'Телевидение', value: yesNo(p.has_tv) },
    { label: 'Кадастровый №', value: p.cadastral_number },
    { label: 'Обременения', value: p.encumbrances },
  ].filter(i => i.value != null && String(i.value).trim() !== '')

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <PageHeader
        crumbs={[{ label: 'Объекты', href: '/properties' }, { label: p.title }]}
        title={p.title}
        badges={
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className={`hp-badge ${statusBadge[p.status] ?? 'hp-badge-neutral'}`}>
              {PROPERTY_STATUS_LABELS[p.status]?.label ?? p.status}
            </span>
            {p.property_type && <span className="hp-badge hp-badge-neutral">{typeLabels[p.property_type] ?? p.property_type}</span>}
            {p.deal_type && <span className="hp-badge hp-badge-neutral">{dealLabels[p.deal_type] ?? p.deal_type}</span>}
          </span>
        }
        meta={
          <>
            <span>{p.address}</span>
            {p.metro && (<><span className="sep">·</span><span>м. {p.metro}</span></>)}
            {manager?.full_name && (<><span className="sep">·</span><span>риелтор {manager.full_name}</span></>)}
          </>
        }
        actions={
          <RecordActions
            primary={
              <Link href={`/deals/new?property_id=${id}`} className="hp-btn-primary" data-testid="property-new-deal">
                <TrendingUp className="w-4 h-4" />
                Новая сделка
              </Link>
            }
            secondary={
              <Link href={`/properties/${id}/edit`} className="hp-btn-secondary" data-testid="property-edit">
                <Edit className="w-4 h-4" />
                Редактировать
              </Link>
            }
            more={
              <ConfirmDeleteButton
                action={deletePropertyAction.bind(null, id)}
                confirmText={`Удалить объект «${p.title}»? Сделки и договоры по нему останутся, но потеряют связь с объектом. Отменить нельзя.`}
                label="Удалить объект"
              />
            }
          />
        }
      />

      <ReadinessPanel issues={issues} />

      {(p.price || p.deposit || p.management_fee || p.area) && (
        <StatStrip
          items={[
            { label: p.deal_type === 'sale' ? 'Цена' : 'Цена в месяц', value: p.price ? <>{formatAmount(p.price)} <span className="text-[var(--hp-tertiary)]">₽</span></> : '—' },
            { label: 'Депозит', value: p.deposit ? <>{formatAmount(p.deposit)} <span className="text-[var(--hp-tertiary)]">₽</span></> : '—' },
            { label: 'Комиссия управления', value: p.management_fee ? <>{formatAmount(p.management_fee)} <span className="text-[var(--hp-tertiary)]">₽</span></> : '—' },
            { label: 'Площадь', value: p.area ? `${p.area} м²` : '—', hint: p.rooms ? `${p.rooms}-комн.` : undefined },
          ]}
        />
      )}

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">

          {photos.length > 0 && (
            <div className="hp-block">
              <div className="hp-block-header flex items-center justify-between">
                <span>Фотографии · {photos.length}</span>
                <Link href={`/properties/${id}/edit`}
                  className="flex items-center gap-1 normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
                  Управлять
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 p-3">
                {photos.map((url, i) => (
                  <div key={url} className="relative aspect-[4/3] overflow-hidden border border-[var(--hp-border-soft)] bg-[var(--hp-neutral-tint)]">
                    <Image src={url} alt={`Фото ${i + 1}`} fill sizes="150px" className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {params_.length > 0 && (
            <div className="hp-block">
              <div className="hp-block-header">Параметры</div>
              <div className="hp-block-grid">
                {params_.map(item => (
                  <div key={item.label} className="hp-block-row">
                    <span className="label">{item.label}</span>
                    <span className="value">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {p.description && (
            <div className="hp-block">
              <div className="hp-block-header">Описание</div>
              <p className="px-[18px] py-3 text-sm text-[var(--hp-sub)] leading-relaxed whitespace-pre-wrap">{p.description}</p>
            </div>
          )}

          {/* Карта — только если у объекта есть координаты (заполняются подсказками
              DaData при вводе адреса). */}
          {p.latitude && p.longitude && (
            <div className="hp-card p-4">
              <PropertyMap
                points={[{ id: p.id, latitude: Number(p.latitude), longitude: Number(p.longitude), title: p.title, subtitle: p.address }]}
                height={280}
              />
            </div>
          )}

          <div className="hp-block">
            <div className="hp-block-header flex items-center justify-between">
              <span>Договоры</span>
              <Link href={`/contracts/new?property_id=${id}`}
                className="flex items-center gap-1 normal-case tracking-normal text-[11px] font-semibold text-[var(--hp-sub)] hover:text-[var(--hp-ink)] transition-colors">
                <Plus className="w-3 h-3" />
                Договор
              </Link>
            </div>
            {!contracts?.length ? (
              <div className="hp-block-item text-[var(--hp-tertiary)]">
                <FileText className="w-4 h-4 shrink-0" />
                Договоров пока нет
              </div>
            ) : (
              contracts.map(c => {
                const st = contractStatusLabels[c.status] ?? { label: c.status, cls: 'text-[var(--hp-sub)]' }
                return (
                  <Link key={c.id} href={`/contracts/${c.id}`} className="hp-block-item">
                    <FileText className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[var(--hp-ink)] font-medium">
                        {CONTRACT_TYPE_LABELS[c.contract_type] ?? c.contract_type}
                        {c.contract_number ? ` · ${c.contract_number}` : ''}
                      </span>
                      <span className="block text-[11.5px] text-[var(--hp-sub)]">
                        {formatDate(c.created_at)}{c.amount ? ` · ${formatAmount(c.amount)} ₽` : ''}
                      </span>
                    </span>
                    <span className={`shrink-0 text-[11.5px] font-medium ${st.cls}`}>{st.label}</span>
                  </Link>
                )
              })
            )}
          </div>

          {(deals?.length ?? 0) > 0 && (
            <div className="hp-block">
              <div className="hp-block-header">Сделки</div>
              {deals!.map(d => (
                <Link key={d.id} href={`/deals/${d.id}`} className="hp-block-item">
                  <TrendingUp className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-[var(--hp-ink)] font-medium">
                      {d.deal_number ? `СД-${d.deal_number} · ` : ''}{DEAL_TYPE_LABELS[d.deal_type] ?? d.deal_type}
                    </span>
                    <span className="block text-[11.5px] text-[var(--hp-sub)]">{DEAL_STATUS_LABELS[d.status] ?? d.status}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {d.amount && <span className="block text-sm font-semibold text-[var(--hp-ink)]">{formatAmount(d.amount)} ₽</span>}
                    <span className="block text-[11.5px] text-[var(--hp-tertiary)]">{formatDate(d.created_at)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Собственник — до всего остального: объект без собственника не
              попадает в отчёт, а без координат — на площадки. */}
          <div className="hp-block">
            <div className="hp-block-header">Собственник</div>
            {owner ? (
              <Link href={`/contacts/${owner.id}`} className="hp-block-item">
                <User className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                <span className="flex-1 min-w-0 truncate text-[var(--hp-ink)] font-semibold">{owner.full_name}</span>
                {owner.phone && <span className="shrink-0 text-[12px] text-[var(--hp-sub)]">{owner.phone}</span>}
              </Link>
            ) : (
              <Link href={`/properties/${id}/edit`} className="hp-block-item">
                <User className="w-4 h-4 shrink-0 text-[var(--hp-tertiary)]" />
                <span className="flex-1 min-w-0 text-[var(--hp-tertiary)]">Не указан — объект не попадёт в отчёт собственнику</span>
                <span className="shrink-0 text-[12px] font-medium text-[var(--hp-accent)]">Указать</span>
              </Link>
            )}
          </div>

          {/* Авито — публикация по кнопке */}
          <AvitoPublishToggle
            propertyId={id}
            isPublished={!!p.avito_publish}
            status={toAvitoStatus(p.avito_status)}
            error={p.avito_error}
            syncedAt={p.avito_synced_at}
            eligible={p.status === 'available'}
          />

          {/* Публичный сайт «ХаусПро» */}
          <SitePublishToggle propertyId={id} isPublished={!!p.site_publish} />

          <div className="hp-block">
            <div className="hp-block-header">Информация</div>
            {p.district && (
              <div className="hp-block-row"><span className="label">Район</span><span className="value">{p.district}</span></div>
            )}
            <div className="hp-block-row"><span className="label">Добавлен</span><span className="value">{formatDate(p.created_at)}</span></div>
            {p.updated_at && (
              <div className="hp-block-row"><span className="label">Обновлён</span><span className="value">{formatDate(p.updated_at)}</span></div>
            )}
          </div>

          {/* Документы на объект — приватный бакет documents (#35 закрыта 17.09.2026) */}
          <FilesSection propertyId={id} title="Документы на объект" />
        </div>
      </div>
    </div>
  )
}
