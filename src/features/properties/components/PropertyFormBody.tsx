import { DadataSuggestInput } from '@/components/forms/DadataSuggestInput'
import { ContactSelectField } from '@/features/contacts/components/ContactSelectField'
import { Field, FieldGrid, FormExtra, FormSection } from '@/components/forms/FormLayout'

/**
 * Общее тело формы объекта для /properties/new и /properties/[id]/edit.
 * Раньше обе страницы держали одинаковую разметку двумя копиями (277 и 308
 * строк) — новое поле пришлось бы добавлять дважды.
 *
 * Правило «≤ 6 полей на виду»: название, адрес, тип, назначение, собственник,
 * цена. Всё, что описывает объект подробнее (площади, дом, коммуникации,
 * документы, финансы), — в «Дополнительно»: это заполняют перед публикацией
 * или договором, а не в момент, когда собственник только позвонил.
 *
 * Серверный компонент: клиентские DadataSuggestInput / ContactSelectField
 * рендерятся как JSX, функции из них не импортируются.
 */

// `| null` вместо `?:` — колонки в базе nullable, страница отдаёт ровно то,
// что вернул запрос.
export interface PropertyDefaults {
  title?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  fias_id?: string | null
  metro?: string | null
  district?: string | null
  property_type?: string | null
  deal_type?: string | null
  status?: string | null
  owner_id?: string | null
  price?: number | null
  deposit?: number | null
  management_fee?: number | null
  utilities_included?: string | null
  area?: number | null
  living_area?: number | null
  kitchen_area?: number | null
  rooms?: number | null
  floor?: number | null
  total_floors?: number | null
  ceiling_height?: number | null
  house_type?: string | null
  wall_material?: string | null
  year_built?: number | null
  has_elevator?: boolean | null
  has_parking?: boolean | null
  has_internet?: boolean | null
  has_tv?: boolean | null
  heating_type?: string | null
  water_supply_type?: string | null
  ownership_basis?: string | null
  cadastral_number?: string | null
  land_area?: number | null
  encumbrances?: string | null
}

interface OwnerOption { id: string; full_name: string; phone?: string | null }

export function PropertyFormBody({
  property,
  owners,
  defaultDealType = 'rent',
  showStatus = false,
  /** Описание рендерит страница сама: на редактировании рядом с ним генератор объявления */
  descriptionSlot,
}: {
  property?: PropertyDefaults
  owners: OwnerOption[]
  defaultDealType?: string
  showStatus?: boolean
  descriptionSlot?: React.ReactNode
}) {
  const p = property ?? {}
  const num = (v: number | null | undefined) => (v == null ? '' : String(v))

  return (
    <>
      <FormSection title="Объект">
        <Field label="Название" required hint="Как объект будет называться в списках: «Квартира 3к на Ленина 15»">
          <input name="title" required defaultValue={p.title ?? ''} placeholder="Квартира 3к на Ленина 15" className="hp-input" data-testid="property-title" />
        </Field>

        <Field label="Адрес" required hint="Выберите из подсказки — подставятся координаты для карты и площадок">
          <DadataSuggestInput
            name="address"
            kind="address"
            required
            defaultValue={p.address ?? ''}
            placeholder="г. Москва, ул. Ленина, д. 15, кв. 32"
            className="hp-input"
            fillFields={{
              latitude: 'latitude',
              longitude: 'longitude',
              fiasId: 'fias_id',
              metro: 'metro',
              cityDistrict: 'district',
            }}
            hintTemplate="Координаты: {latitude}, {longitude}"
          />
          {/* Геоданные из подсказки: пользователь их не редактирует, но без них
              нет карты в подборке и корректного фида на площадки. */}
          <input type="hidden" name="latitude" defaultValue={num(p.latitude)} />
          <input type="hidden" name="longitude" defaultValue={num(p.longitude)} />
          <input type="hidden" name="fias_id" defaultValue={p.fias_id ?? ''} />
          <input type="hidden" name="metro" defaultValue={p.metro ?? ''} />
          <input type="hidden" name="district" defaultValue={p.district ?? ''} />
        </Field>

        <FieldGrid>
          <Field label="Тип объекта">
            <select name="property_type" defaultValue={p.property_type ?? 'apartment'} className="hp-input cursor-pointer">
              <option value="apartment">Квартира</option>
              <option value="house">Дом</option>
              <option value="commercial">Коммерция</option>
              <option value="office">Офис</option>
              <option value="warehouse">Склад</option>
              <option value="land">Участок</option>
            </select>
          </Field>
          <Field label="Что с ним делаем">
            <select name="deal_type" defaultValue={p.deal_type ?? defaultDealType} className="hp-input cursor-pointer">
              <option value="rent">Сдаём</option>
              <option value="sale">Продаём</option>
              <option value="management">Берём в управление</option>
              <option value="subrent">Субаренда</option>
            </select>
          </Field>
          {showStatus && (
            <Field label="Статус">
              <select name="status" defaultValue={p.status ?? 'available'} className="hp-input cursor-pointer">
                <option value="available">Доступен</option>
                <option value="reserved">Зарезервирован</option>
                <option value="rented">Сдан</option>
                <option value="sold">Продан</option>
                <option value="inactive">Неактивен</option>
              </select>
            </Field>
          )}
          {/* Собственник: без него в «Управлении» и в отчёте будет прочерк. */}
          <ContactSelectField contacts={owners} defaultContactId={p.owner_id ?? ''} />
          <Field label="Цена, ₽" hint="За месяц при аренде, полная при продаже">
            <input step="any" name="price" type="number" min="0" defaultValue={num(p.price)} placeholder="50 000" className="hp-input" />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormExtra summary="площади и этаж, дом и коммуникации, депозит и комиссия, документы на объект">
        <h3 className="hp-label !mb-0">Площади и планировка</h3>
        <FieldGrid>
          <Field label="Общая площадь, м²">
            <input name="area" type="number" step="0.1" min="0" defaultValue={num(p.area)} placeholder="65" className="hp-input" />
          </Field>
          <Field label="Комнат">
            <input name="rooms" type="number" min="0" defaultValue={num(p.rooms)} placeholder="3" className="hp-input" />
          </Field>
          <Field label="Жилая площадь, м²">
            <input name="living_area" type="number" step="0.1" min="0" defaultValue={num(p.living_area)} placeholder="45" className="hp-input" />
          </Field>
          <Field label="Кухня, м²">
            <input name="kitchen_area" type="number" step="0.1" min="0" defaultValue={num(p.kitchen_area)} placeholder="12" className="hp-input" />
          </Field>
          <Field label="Этаж">
            <input name="floor" type="number" defaultValue={num(p.floor)} placeholder="5" className="hp-input" />
          </Field>
          <Field label="Этажей в доме">
            <input name="total_floors" type="number" min="1" defaultValue={num(p.total_floors)} placeholder="9" className="hp-input" />
          </Field>
          <Field label="Высота потолков, м">
            <input name="ceiling_height" type="number" step="0.1" min="0" defaultValue={num(p.ceiling_height)} placeholder="2.7" className="hp-input" />
          </Field>
          <Field label="Участок, соток">
            <input name="land_area" type="number" step="0.01" min="0" defaultValue={num(p.land_area)} placeholder="12" className="hp-input" />
          </Field>
        </FieldGrid>

        <h3 className="hp-label !mb-0 pt-2">Дом и коммуникации</h3>
        <FieldGrid>
          <Field label="Тип дома">
            <select name="house_type" defaultValue={p.house_type ?? ''} className="hp-input cursor-pointer">
              <option value="">— не указан —</option>
              <option value="panel">Панельный</option>
              <option value="brick">Кирпичный</option>
              <option value="monolith">Монолит</option>
              <option value="monolith_brick">Монолит-кирпич</option>
              <option value="wood">Деревянный</option>
            </select>
          </Field>
          <Field label="Материал стен">
            <select name="wall_material" defaultValue={p.wall_material ?? ''} className="hp-input cursor-pointer">
              <option value="">— не указан —</option>
              <option value="brick">Кирпич</option>
              <option value="panel">Панель</option>
              <option value="concrete">Бетон</option>
              <option value="wood">Дерево</option>
              <option value="gas_block">Газоблок</option>
            </select>
          </Field>
          <Field label="Год постройки">
            <input name="year_built" type="number" min="1900" max="2030" defaultValue={num(p.year_built)} placeholder="2005" className="hp-input" />
          </Field>
          <Field label="Отопление">
            <select name="heating_type" defaultValue={p.heating_type ?? ''} className="hp-input cursor-pointer">
              <option value="">— не указано —</option>
              <option value="central">Центральное</option>
              <option value="gas">Газовое</option>
              <option value="electric">Электрическое</option>
              <option value="autonomous">Автономное</option>
            </select>
          </Field>
          <Field label="Водоснабжение">
            <select name="water_supply_type" defaultValue={p.water_supply_type ?? ''} className="hp-input cursor-pointer">
              <option value="">— не указано —</option>
              <option value="central">Центральное</option>
              <option value="well">Скважина/колодец</option>
              <option value="none">Нет</option>
            </select>
          </Field>
        </FieldGrid>
        <div className="flex items-center gap-6 flex-wrap">
          {([
            ['has_elevator', 'Лифт', p.has_elevator],
            ['has_parking', 'Парковка', p.has_parking],
            ['has_internet', 'Интернет', p.has_internet],
            ['has_tv', 'Телевидение', p.has_tv],
          ] as const).map(([name, label, checked]) => (
            <label key={name} className="flex items-center gap-2 cursor-pointer text-sm text-[var(--hp-ink)]">
              <input type="checkbox" name={name} defaultChecked={!!checked} className="w-4 h-4" style={{ accentColor: 'var(--hp-accent)' }} />
              {label}
            </label>
          ))}
        </div>

        <h3 className="hp-label !mb-0 pt-2">Деньги</h3>
        <FieldGrid>
          <Field label="Депозит, ₽" hint="Обеспечительный платёж арендатора">
            <input step="any" name="deposit" type="number" min="0" defaultValue={num(p.deposit)} placeholder="50 000" className="hp-input" />
          </Field>
          <Field label="Комиссия управления, ₽" hint="Сколько агентство берёт в месяц за ведение объекта">
            <input step="any" name="management_fee" type="number" min="0" defaultValue={num(p.management_fee)} placeholder="5 000" className="hp-input" />
          </Field>
          <Field label="Что включено в коммунальные">
            <input type="text" name="utilities_included" defaultValue={p.utilities_included ?? ''} placeholder="вода, газ, электричество" className="hp-input" />
          </Field>
        </FieldGrid>

        <h3 className="hp-label !mb-0 pt-2">Документы на объект — нужны для договора</h3>
        <FieldGrid>
          <Field label="Основание права собственности" hint="Подставляется в договоры найма и аренды">
            <input name="ownership_basis" defaultValue={p.ownership_basis ?? ''} placeholder="Выписка из ЕГРН № … от …" className="hp-input" />
          </Field>
          <Field label="Кадастровый номер">
            <input name="cadastral_number" defaultValue={p.cadastral_number ?? ''} placeholder="50:21:0040214:1187" className="hp-input" />
          </Field>
          <Field label="Обременения" hint="Ипотека, арест, аренда — если есть">
            <input name="encumbrances" defaultValue={p.encumbrances ?? ''} placeholder="нет" className="hp-input" />
          </Field>
        </FieldGrid>
      </FormExtra>

      {descriptionSlot}
    </>
  )
}
