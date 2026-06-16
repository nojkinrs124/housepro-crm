import { createClient } from '@/lib/supabase/server'
import { Download, Home, AlertCircle } from 'lucide-react'

export default async function ExportPage() {
  const supabase = await createClient()
  const { count } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'available')

  const availableCount = count ?? 0

  const platforms = [
    {
      name: 'Авито',
      description: 'XML-фид для Avito.ru (formatVersion 3)',
      url: '/api/export/avito',
      color: 'bg-blue-50 border-blue-200',
      btnColor: 'bg-blue-600 hover:bg-blue-700',
      icon: '🟡',
      docsUrl: 'https://www.avito.ru/help/help/xml_feed',
    },
    {
      name: 'ЦИАН',
      description: 'XML-фид для Cian.ru (feed version 1)',
      url: '/api/export/cian',
      color: 'bg-emerald-50 border-emerald-200',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700',
      icon: '🟢',
      docsUrl: 'https://cian.ru/help/',
    },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Экспорт объектов</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Выгрузка объектов на рекламные площадки в XML-формате
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-[20px]">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
          <Home className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{availableCount}</p>
          <p className="text-sm text-muted-foreground">объектов готовы к выгрузке (статус «Свободен»)</p>
        </div>
      </div>

      {availableCount === 0 && (
        <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-[20px]">
          <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-900">Нет объектов для выгрузки</p>
            <p className="text-sm text-yellow-700 mt-0.5">
              Для выгрузки объект должен иметь статус «Свободен» и заполненные поля: название, адрес, цена.
            </p>
          </div>
        </div>
      )}

      {/* Platforms */}
      <div className="grid md:grid-cols-2 gap-4">
        {platforms.map(p => (
          <div key={p.name} className={`border rounded-[20px] p-6 space-y-4 ${p.color}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{p.icon}</span>
              <div>
                <h2 className="font-bold text-foreground text-lg">{p.name}</h2>
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>✅ Название и описание</p>
              <p>✅ Адрес и цена</p>
              <p>✅ Площадь, комнаты, этаж</p>
              <p>✅ Год постройки, высота потолков</p>
              <p>✅ Жилая и кухонная площадь</p>
            </div>

            <div className="flex gap-2">
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium transition ${p.btnColor}`}>
                <Download className="w-4 h-4" />
                Скачать XML
              </a>
              <a href={p.docsUrl} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-card transition">
                Docs
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="bg-card border border-border rounded-[20px] p-6 space-y-3">
        <h2 className="font-semibold text-foreground">Как использовать</h2>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Убедитесь, что у объектов заполнены: название, адрес, цена, описание</li>
          <li>Установите статус объекта «Свободен»</li>
          <li>Скачайте XML-фид для нужной площадки</li>
          <li>Загрузите файл в личный кабинет платформы или укажите URL фида для автоматического обновления</li>
        </ol>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
          <p className="text-blue-900 font-medium">💡 Авто-обновление</p>
          <p className="text-blue-700 mt-0.5">
            Укажите ссылку <code className="bg-blue-100 px-1 rounded">/api/export/avito</code> в настройках площадки для автоматического обновления объявлений.
          </p>
        </div>
      </div>
    </div>
  )
}
