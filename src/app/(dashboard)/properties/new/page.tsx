import { createPropertyAction } from '@/features/properties/actions/properties.actions'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Home } from 'lucide-react'
import Link from 'next/link'
import { ServerActionForm } from '@/components/forms/ServerActionForm'

export default async function NewPropertyPage() {
  const supabase = await createClient()
  const { data: owners } = await supabase.from('contacts').select('id, full_name').in('role', ['owner', 'both']).order('full_name')

  const inputCls = "w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
  const selectCls = "w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
  const labelCls = "text-sm font-medium text-foreground"

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/properties" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к объектам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
          <Home className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-foreground tracking-tight leading-tight">Новый объект</h1>
          <p className="text-muted-foreground text-sm">Добавьте объект недвижимости</p>
        </div>
      </div>

      <ServerActionForm action={createPropertyAction} className="space-y-4">

        {/* Основное */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Основные данные</h2>

          <div className="space-y-1.5">
            <label className={labelCls}>Название <span className="text-destructive">*</span></label>
            <input name="title" required placeholder="Квартира 3к на Ленина 15" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Адрес <span className="text-destructive">*</span></label>
            <input name="address" required placeholder="г. Москва, ул. Ленина, д. 15, кв. 32" className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Тип объекта</label>
              <select name="property_type" defaultValue="apartment" className={selectCls}>
                <option value="apartment">Квартира</option>
                <option value="house">Дом</option>
                <option value="commercial">Коммерция</option>
                <option value="office">Офис</option>
                <option value="warehouse">Склад</option>
                <option value="land">Участок</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Тип сделки</label>
              <select name="deal_type" defaultValue="rent" className={selectCls}>
                <option value="rent">Аренда</option>
                <option value="sale">Продажа</option>
                <option value="management">Управление</option>
                <option value="subrent">Субаренда</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Собственник</label>
              <select name="owner_contact_id" className={selectCls}>
                <option value="">— выберите —</option>
                {(owners ?? []).map(o => (
                  <option key={o.id} value={o.id}>{o.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Параметры */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Параметры</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Площадь общая (м²)</label>
              <input name="area" type="number" step="0.1" placeholder="65" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Площадь жилая (м²)</label>
              <input name="living_area" type="number" step="0.1" placeholder="45" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Площадь кухни (м²)</label>
              <input name="kitchen_area" type="number" step="0.1" placeholder="12" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Комнат</label>
              <input name="rooms" type="number" placeholder="3" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Этаж</label>
              <input name="floor" type="number" placeholder="5" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Этажность дома</label>
              <input name="total_floors" type="number" placeholder="9" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Высота потолков (м)</label>
              <input name="ceiling_height" type="number" step="0.1" placeholder="2.7" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Дом */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Характеристики дома</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Тип дома</label>
              <select name="house_type" className={selectCls}>
                <option value="">— выберите —</option>
                <option value="panel">Панельный</option>
                <option value="brick">Кирпичный</option>
                <option value="monolith">Монолит</option>
                <option value="monolith_brick">Монолит-кирпич</option>
                <option value="wood">Деревянный</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Материал стен</label>
              <select name="wall_material" className={selectCls}>
                <option value="">— выберите —</option>
                <option value="brick">Кирпич</option>
                <option value="panel">Панель</option>
                <option value="concrete">Бетон</option>
                <option value="wood">Дерево</option>
                <option value="gas_block">Газоблок</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Год постройки</label>
              <input name="year_built" type="number" placeholder="2005" min="1900" max="2030" className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" name="has_elevator" className="w-4 h-4 accent-primary" />
              Лифт
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" name="has_parking" className="w-4 h-4 accent-primary" />
              Парковка
            </label>
          </div>
        </div>

        {/* Коммуникации */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Коммуникации</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Отопление</label>
              <select name="heating_type" className={selectCls}>
                <option value="">— выберите —</option>
                <option value="central">Центральное</option>
                <option value="gas">Газовое</option>
                <option value="electric">Электрическое</option>
                <option value="autonomous">Автономное</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Водоснабжение</label>
              <select name="water_supply_type" className={selectCls}>
                <option value="">— выберите —</option>
                <option value="central">Центральное</option>
                <option value="well">Скважина/колодец</option>
                <option value="none">Нет</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" name="has_internet" className="w-4 h-4 accent-primary" />
              Интернет
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" name="has_tv" className="w-4 h-4 accent-primary" />
              Телевидение
            </label>
          </div>
        </div>

        {/* Право собственности */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Право собственности</h2>
          <div className="space-y-1.5">
            <label className={labelCls}>Документ-основание</label>
            <input name="ownership_basis" placeholder="Выписка из ЕГРН № ... от ..." className={inputCls} />
            <p className="text-xs text-muted-foreground">Подставляется в договоры найма/аренды по этому объекту.</p>
          </div>
        </div>

        {/* Финансы */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Финансы</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Цена продажи / аренды (₽)</label>
              <input name="price" type="number" placeholder="5 000 000" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Депозит (₽)</label>
              <input name="deposit" type="number" placeholder="50 000" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Комиссия управления (₽)</label>
              <input name="management_fee" type="number" placeholder="5 000" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Описание */}
        <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-3">
          <h2 className="font-semibold text-foreground">Описание</h2>
          <textarea name="description" rows={4} placeholder="Описание объекта..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit"
            className="flex items-center gap-2 px-6 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 transition-all" style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
            <Home className="w-4 h-4" />
            Добавить объект
          </button>
          <Link href="/properties"
            className="px-6 py-2.5 border border-border text-foreground rounded-[14px] text-sm font-medium hover:bg-accent transition-all">
            Отмена
          </Link>
        </div>
      </ServerActionForm>
    </div>
  )
}
