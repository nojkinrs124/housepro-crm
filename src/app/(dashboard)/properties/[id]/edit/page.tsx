import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updatePropertyAction } from '@/features/properties/actions/properties.actions'

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: rawProperty } = await supabase
    .from('properties').select('*').eq('id', id).single()

  if (!rawProperty) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = rawProperty as any
  const boundAction = updatePropertyAction.bind(null, id)

  const inp = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all'
  const sel = 'w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer'
  const lbl = 'block text-sm font-medium text-foreground mb-1.5'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href={`/properties/${id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к объекту
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Редактировать объект</h1>
        <p className="text-muted-foreground mt-1">{p.title}</p>
      </div>

      <form action={boundAction} className="space-y-4">

        {/* Основное */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Основные данные</h2>

          <div>
            <label className={lbl}>Название *</label>
            <input name="title" required defaultValue={p.title ?? ''} className={inp} />
          </div>

          <div>
            <label className={lbl}>Адрес *</label>
            <input name="address" required defaultValue={p.address ?? ''} className={inp} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Тип объекта</label>
              <select name="property_type" defaultValue={p.property_type ?? 'apartment'} className={sel}>
                <option value="apartment">Квартира</option>
                <option value="house">Дом</option>
                <option value="commercial">Коммерция</option>
                <option value="office">Офис</option>
                <option value="warehouse">Склад</option>
                <option value="land">Участок</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Тип сделки</label>
              <select name="deal_type" defaultValue={p.deal_type ?? 'rent'} className={sel}>
                <option value="rent">Аренда</option>
                <option value="sale">Продажа</option>
                <option value="management">Управление</option>
                <option value="subrent">Субаренда</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Статус</label>
              <select name="status" defaultValue={p.status ?? 'available'} className={sel}>
                <option value="available">Доступно</option>
                <option value="reserved">Зарезервировано</option>
                <option value="rented">Сдано</option>
                <option value="sold">Продано</option>
                <option value="inactive">Неактивно</option>
              </select>
            </div>
          </div>
        </div>

        {/* Параметры */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Параметры</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Площадь общая (м²)', name: 'area',           step: '0.1' },
              { label: 'Площадь жилая (м²)', name: 'living_area',    step: '0.1' },
              { label: 'Площадь кухни (м²)', name: 'kitchen_area',   step: '0.1' },
              { label: 'Комнат',             name: 'rooms',          step: '1'   },
              { label: 'Этаж',               name: 'floor',          step: '1'   },
              { label: 'Этажность дома',     name: 'total_floors',   step: '1'   },
              { label: 'Высота потолков (м)', name: 'ceiling_height', step: '0.1' },
            ].map(f => (
              <div key={f.name}>
                <label className={lbl}>{f.label}</label>
                <input type="number" name={f.name} step={f.step} defaultValue={p[f.name] ?? ''} className={inp} />
              </div>
            ))}
          </div>
        </div>

        {/* Дом */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Характеристики дома</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Тип дома</label>
              <select name="house_type" defaultValue={p.house_type ?? ''} className={sel}>
                <option value="">— выберите —</option>
                <option value="panel">Панельный</option>
                <option value="brick">Кирпичный</option>
                <option value="monolith">Монолит</option>
                <option value="monolith_brick">Монолит-кирпич</option>
                <option value="wood">Деревянный</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Материал стен</label>
              <select name="wall_material" defaultValue={p.wall_material ?? ''} className={sel}>
                <option value="">— выберите —</option>
                <option value="brick">Кирпич</option>
                <option value="panel">Панель</option>
                <option value="concrete">Бетон</option>
                <option value="wood">Дерево</option>
                <option value="gas_block">Газоблок</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Год постройки</label>
              <input type="number" name="year_built" defaultValue={p.year_built ?? ''} placeholder="2005" min="1900" max="2030" className={inp} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" name="has_elevator" defaultChecked={!!p.has_elevator} className="w-4 h-4 accent-primary" />
              Лифт
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" name="has_parking" defaultChecked={!!p.has_parking} className="w-4 h-4 accent-primary" />
              Парковка
            </label>
          </div>
        </div>

        {/* Коммуникации */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Коммуникации</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Отопление</label>
              <select name="heating_type" defaultValue={p.heating_type ?? ''} className={sel}>
                <option value="">— выберите —</option>
                <option value="central">Центральное</option>
                <option value="gas">Газовое</option>
                <option value="electric">Электрическое</option>
                <option value="autonomous">Автономное</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Водоснабжение</label>
              <select name="water_supply_type" defaultValue={p.water_supply_type ?? ''} className={sel}>
                <option value="">— выберите —</option>
                <option value="central">Центральное</option>
                <option value="well">Скважина/колодец</option>
                <option value="none">Нет</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" name="has_internet" defaultChecked={!!p.has_internet} className="w-4 h-4 accent-primary" />
              Интернет
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" name="has_tv" defaultChecked={!!p.has_tv} className="w-4 h-4 accent-primary" />
              Телевидение
            </label>
          </div>
        </div>

        {/* Финансы */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Финансы</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Цена (₽)</label>
              <input type="number" name="price" defaultValue={p.price ?? ''} className={inp} />
            </div>
            <div>
              <label className={lbl}>Депозит (₽)</label>
              <input type="number" name="deposit" defaultValue={p.deposit ?? ''} className={inp} />
            </div>
            <div>
              <label className={lbl}>Комиссия управления (₽)</label>
              <input type="number" name="management_fee" defaultValue={p.management_fee ?? ''} className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Что включено в коммунальные</label>
            <input type="text" name="utilities_included" defaultValue={p.utilities_included ?? ''} placeholder="вода, газ, электричество" className={inp} />
          </div>
        </div>

        {/* Описание */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Описание</h2>
          <textarea name="description" rows={4} defaultValue={p.description ?? ''}
            placeholder="Описание для публикации на Авито, ЦИАН, Домклик..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        </div>

        <div className="flex gap-3">
          <button type="submit"
            className="flex-1 h-10 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition">
            Сохранить изменения
          </button>
          <Link href={`/properties/${id}`}
            className="flex-1 h-10 flex items-center justify-center border border-border rounded-xl text-sm font-medium hover:bg-accent transition">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
