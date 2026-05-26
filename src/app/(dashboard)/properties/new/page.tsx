import { createPropertyAction } from '@/features/properties/actions/properties.actions'
import { ArrowLeft, Home } from 'lucide-react'
import Link from 'next/link'

export default function NewPropertyPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/properties" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к объектам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
          <Home className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Новый объект</h1>
          <p className="text-muted-foreground text-sm">Добавьте объект недвижимости</p>
        </div>
      </div>

      <form action={createPropertyAction} className="space-y-4">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Основные данные</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Название <span className="text-destructive">*</span>
            </label>
            <input name="title" required placeholder="Квартира 3к на Ленина 15"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Адрес <span className="text-destructive">*</span>
            </label>
            <input name="address" required placeholder="г. Москва, ул. Ленина, д. 15, кв. 32"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Тип объекта</label>
              <select name="property_type" defaultValue="apartment"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="apartment">Квартира</option>
                <option value="house">Дом</option>
                <option value="commercial">Коммерция</option>
                <option value="office">Офис</option>
                <option value="warehouse">Склад</option>
                <option value="land">Участок</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Тип сделки</label>
              <select name="deal_type" defaultValue="rent"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="rent">Аренда</option>
                <option value="sale">Продажа</option>
                <option value="management">Управление</option>
                <option value="subrent">Субаренда</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Цена (₽)</label>
              <input name="price" type="number" placeholder="50000"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Площадь (м²)</label>
              <input name="area" type="number" placeholder="65"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Комнат</label>
              <input name="rooms" type="number" placeholder="3"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Описание</h2>
          <textarea name="description" rows={4} placeholder="Описание объекта..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
            <Home className="w-4 h-4" />
            Добавить объект
          </button>
          <Link href="/properties"
            className="px-6 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-all">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
