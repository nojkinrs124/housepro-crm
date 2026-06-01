import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { updatePropertyAction } from '@/features/properties/actions/properties.actions'
import type { Property } from '@/types/database'

export default async function EditPropertyPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!property) notFound()

  const p = property as Property
  const boundAction = updatePropertyAction.bind(null, params.id)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href={`/properties/${params.id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к объекту
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Редактировать объект</h1>
        <p className="text-muted-foreground mt-1">{p.title}</p>
      </div>

      <form action={boundAction} className="space-y-8">
        {/* BASIC INFO */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground text-lg">Основная информация</h2>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Название *</label>
            <input type="text" name="title" required defaultValue={p.title} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Тип объекта *</label>
              <select name="property_type" required defaultValue={p.property_type} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary">
                <option value="apartment">Квартира</option>
                <option value="house">Дом</option>
                <option value="commercial">Коммерческое</option>
                <option value="office">Офис</option>
                <option value="warehouse">Склад</option>
                <option value="land">Земельный участок</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Тип сделки *</label>
              <select name="deal_type" required defaultValue={p.deal_type} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary">
                <option value="rent">Аренда</option>
                <option value="sale">Продажа</option>
                <option value="management">Управление</option>
                <option value="subrent">Субаренда</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Статус</label>
              <select name="status" defaultValue={p.status} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary">
                <option value="available">Доступно</option>
                <option value="reserved">Зарезервировано</option>
                <option value="rented">Сдано</option>
                <option value="sold">Продано</option>
                <option value="inactive">Неактивно</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Адрес *</label>
            <input type="text" name="address" required defaultValue={p.address} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Район</label>
            <input type="text" name="district" defaultValue={p.district || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
          </div>
        </div>

        {/* PARAMETERS */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground text-lg">Параметры</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Общая площадь (м²)</label>
              <input type="number" name="area" step="0.01" defaultValue={p.area || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Жилая площадь (м²)</label>
              <input type="number" name="living_area" step="0.01" defaultValue={p.living_area || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Площадь кухни (м²)</label>
              <input type="number" name="kitchen_area" step="0.01" defaultValue={p.kitchen_area || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Комнаты</label>
              <input type="number" name="rooms" defaultValue={p.rooms || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Этаж</label>
              <input type="number" name="floor" defaultValue={p.floor || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Этажность дома</label>
              <input type="number" name="total_floors" defaultValue={p.total_floors || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Высота потолков (м)</label>
            <input type="number" name="ceiling_height" step="0.1" defaultValue={p.ceiling_height || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
          </div>
        </div>

        {/* HOUSE INFO */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground text-lg">Дом</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Тип дома</label>
              <select name="house_type" defaultValue={p.house_type || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary">
                <option value="">Выберите...</option>
                <option value="panel">Панельный</option>
                <option value="brick">Кирпичный</option>
                <option value="monolith">Монолитный</option>
                <option value="wood">Деревянный</option>
                <option value="mixed">Смешанный</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Материал стен</label>
              <input type="text" name="wall_material" defaultValue={p.wall_material || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Год постройки</label>
              <input type="number" name="year_built" defaultValue={p.year_built || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
            </div>

            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input type="checkbox" name="has_elevator" defaultChecked={p.has_elevator} className="rounded" />
                Лифт
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input type="checkbox" name="has_parking" defaultChecked={p.has_parking} className="rounded" />
                Парковка
              </label>
            </div>
          </div>
        </div>

        {/* COMMUNICATIONS */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground text-lg">Коммуникации</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Отопление</label>
              <select name="heating_type" defaultValue={p.heating_type || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary">
                <option value="">Выберите...</option>
                <option value="central">Центральное</option>
                <option value="individual">Индивидуальное</option>
                <option value="none">Нет отопления</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Водоснабжение</label>
              <select name="water_supply_type" defaultValue={p.water_supply_type || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary">
                <option value="">Выберите...</option>
                <option value="central">Центральное</option>
                <option value="well">Скважина</option>
                <option value="none">Нет водоснабжения</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input type="checkbox" name="has_internet" defaultChecked={p.has_internet} className="rounded" />
              Интернет
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input type="checkbox" name="has_tv" defaultChecked={p.has_tv} className="rounded" />
              Телевидение
            </label>
          </div>
        </div>

        {/* FINANCIAL */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground text-lg">Финансовые условия</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Цена</label>
              <input type="number" name="price" step="0.01" defaultValue={p.price || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Залог</label>
              <input type="number" name="deposit" step="0.01" defaultValue={p.deposit || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Управление</label>
              <input type="number" name="management_fee" step="0.01" defaultValue={p.management_fee || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Включено в коммунальные</label>
              <input type="text" name="utilities_included" defaultValue={p.utilities_included || ''} className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary" placeholder="напр. вода, газ" />
            </div>
          </div>
        </div>

        {/* DESCRIPTION */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground text-lg">Описание</h2>

          <textarea
            name="description"
            rows={6}
            defaultValue={p.description || ''}
            className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
            placeholder="Подробное описание объекта для публикации на площадках..."
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
        >
          Сохранить изменения
        </button>
      </form>
    </div>
  )
}
