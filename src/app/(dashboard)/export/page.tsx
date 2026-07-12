import { createClient } from '@/lib/supabase/server'
import { Download, Home, AlertCircle, FileText, Lightbulb } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

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
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      btnBg: 'linear-gradient(135deg, #2563EB, #3B82F6)',
      btnShadow: '0 4px 16px rgba(37,99,235,0.3)',
      icon: '',
      docsUrl: 'https://www.avito.ru/help/help/xml_feed',
    },
    {
      name: 'ЦИАН',
      description: 'XML-фид для Cian.ru (feed version 1)',
      url: '/api/export/cian',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      btnBg: 'var(--hp-gradient-primary)',
      btnShadow: '0 4px 16px rgba(22,163,74,0.35)',
      icon: '',
      docsUrl: 'https://cian.ru/help/',
    },
  ]

  const checklist = [
    'Название и описание',
    'Адрес и цена',
    'Площадь, комнаты, этаж',
    'Год постройки, высота потолков',
    'Жилая и кухонная площадь',
  ]

  const steps = [
    'Убедитесь, что у объектов заполнены: название, адрес, цена, описание',
    'Установите статус объекта «Свободен»',
    'Скачайте XML-фид для нужной площадки',
    'Загрузите файл в личный кабинет платформы или укажите URL фида для автоматического обновления',
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="Экспорт объектов" subtitle="Выгрузка объектов на рекламные площадки в XML-формате" />

      {/* Stats */}
      <div className="flex items-center gap-4 bg-white rounded-[20px] border border-slate-100 p-5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-emerald-50">
          <Home className="text-emerald-600" style={{ width: 20, height: 20 }} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-foreground leading-tight">{availableCount}</p>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">объектов готовы к выгрузке (статус «Свободен»)</p>
        </div>
      </div>

      {availableCount === 0 && (
        <div className="flex items-start gap-3 p-4 rounded-[16px]" style={{ background: 'rgba(254,243,199,0.5)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <AlertCircle className="text-amber-600 shrink-0 mt-0.5" style={{ width: 18, height: 18 }} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">Нет объектов для выгрузки</p>
            <p className="text-sm text-amber-700 mt-0.5 leading-relaxed">
              Для выгрузки объект должен иметь статус «Свободен» и заполненные поля: название, адрес, цена.
            </p>
          </div>
        </div>
      )}

      {/* Platforms */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {platforms.map(p => (
          <div key={p.name} className="bg-white rounded-[20px] border border-slate-100 p-6 space-y-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${p.iconBg}`}>
                <span className="text-xl">{p.icon}</span>
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-foreground text-base leading-tight">{p.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.description}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              {checklist.map(item => (
                <p key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-green-600 shrink-0">✓</span>
                  <span>{item}</span>
                </p>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[14px] text-white text-sm font-bold transition-all hover:-translate-y-0.5"
                style={{ background: p.btnBg, boxShadow: p.btnShadow }}>
                <Download style={{ width: 16, height: 16 }} />
                Скачать XML
              </a>
              <a href={p.docsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center px-4 py-2.5 border border-slate-200 rounded-[14px] text-sm font-semibold text-muted-foreground hover:bg-slate-50 hover:text-foreground transition-all shrink-0">
                Docs
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* CSV / 1C export */}
      <div className="bg-white rounded-[20px] border border-slate-100 p-6 space-y-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-violet-50">
            <FileText className="text-violet-600" style={{ width: 16, height: 16 }} />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-[15px]">Экспорт CSV (для 1С)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">UTF-8 с BOM, разделитель «;»</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Контакты',     url: '/api/export/contacts' },
            { label: 'Сделки',       url: '/api/export/deals' },
            { label: 'Договоры',     url: '/api/export/contracts' },
            { label: 'Бухгалтерия',  url: '/api/export/accounting' },
          ].map(item => (
            <a
              key={item.url}
              href={item.url}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {item.label}
            </a>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-[20px] border border-slate-100 p-6 space-y-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-slate-100">
            <FileText className="text-slate-600" style={{ width: 16, height: 16 }} />
          </div>
          <h2 className="font-bold text-foreground text-[15px]">Как использовать</h2>
        </div>

        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={step} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-[#374151] leading-relaxed">{step}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[14px] p-4 flex gap-3" style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <Lightbulb className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-900 font-semibold text-sm">Авто-обновление</p>
            <p className="text-blue-700 mt-1 text-sm leading-relaxed break-words">
              Укажите ссылку <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs break-all">/api/export/avito</code> в настройках площадки для автоматического обновления объявлений.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
