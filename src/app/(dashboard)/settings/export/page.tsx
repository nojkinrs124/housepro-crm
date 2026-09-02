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
 docsUrl: 'https://www.avito.ru/help/help/xml_feed',
 },
 {
 name: 'ЦИАН',
 description: 'XML-фид для Cian.ru (feed version 1)',
 url: '/api/export/cian',
 docsUrl: 'https://cian.ru/help/',
 },
 {
 name: 'Яндекс.Недвижимость',
 description: 'XML-фид в формате YRL (с координатами объектов)',
 url: '/api/export/yandex-realty',
 docsUrl: 'https://yandex.ru/support/realty/feeds/requirements.html',
 },
 {
 name: 'Домклик',
 description: 'Тот же формат YRL — у площадки свой постоянный адрес фида',
 url: '/api/export/domclick',
 docsUrl: 'https://domclick.ru/',
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
 <div className="flex items-center gap-4 hp-card p-5" style={{ }}>
 <div className="w-11 h-11 flex items-center justify-center shrink-0 bg-[var(--hp-good-tint)]">
 <Home className="text-[var(--hp-good)]" style={{ width: 20, height: 20 }} />
 </div>
 <div className="min-w-0">
 <p className="text-2xl font-bold text-foreground leading-tight">{availableCount}</p>
 <p className="text-sm text-muted-foreground font-medium mt-0.5">объектов готовы к выгрузке (статус «Свободен»)</p>
 </div>
 </div>

 {availableCount === 0 && (
 <div className="flex items-start gap-3 p-4" style={{ background: 'rgba(254,243,199,0.5)', border: '1px solid rgba(245,158,11,0.25)' }}>
 <AlertCircle className="text-[var(--hp-warn)] shrink-0 mt-0.5" style={{ width: 18, height: 18 }} />
 <div className="min-w-0">
 <p className="text-sm font-semibold text-[var(--hp-warn)]">Нет объектов для выгрузки</p>
 <p className="text-sm text-[var(--hp-warn)] mt-0.5 leading-relaxed">
 Для выгрузки объект должен иметь статус «Свободен» и заполненные поля: название, адрес, цена.
 </p>
 </div>
 </div>
 )}

 {/* Platforms */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {platforms.map(p => (
 <div key={p.name} className="hp-card p-6 space-y-4" style={{ }}>
 <div className="flex items-center gap-3">
 <div className="w-11 h-11 flex items-center justify-center shrink-0 bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)]">
 <Download className="text-[var(--hp-sub)]" style={{ width: 18, height: 18 }} />
 </div>
 <div className="min-w-0">
 <h2 className="font-bold text-foreground text-base leading-tight">{p.name}</h2>
 <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.description}</p>
 </div>
 </div>

 <div className="space-y-1.5">
 {checklist.map(item => (
 <p key={item} className="text-sm text-muted-foreground flex items-start gap-2">
 <span className="text-[var(--hp-good)] shrink-0">✓</span>
 <span>{item}</span>
 </p>
 ))}
 </div>

 <div className="flex flex-col sm:flex-row gap-2">
 <a href={p.url} target="_blank" rel="noopener noreferrer"
 className="flex-1 flex items-center justify-center gap-2 py-2.5 text-white text-sm font-semibold transition-colors"
 style={{ background: 'var(--hp-accent)' }}>
 <Download style={{ width: 16, height: 16 }} />
 Скачать XML
 </a>
 <a href={p.docsUrl} target="_blank" rel="noopener noreferrer"
 className="flex items-center justify-center px-4 py-2.5 border border-[var(--hp-border)] text-sm font-semibold text-muted-foreground hover:bg-[var(--hp-neutral-tint)] hover:text-foreground transition-all shrink-0">
 Docs
 </a>
 </div>
 </div>
 ))}
 </div>

 {/* CSV / 1C export */}
 <div className="hp-card p-6 space-y-4" style={{ }}>
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 flex items-center justify-center shrink-0 bg-[var(--hp-neutral-tint)]">
 <FileText className="text-[var(--hp-sub)]" style={{ width: 16, height: 16 }} />
 </div>
 <div>
 <h2 className="font-bold text-foreground text-[15px]">Экспорт CSV (для 1С)</h2>
 <p className="text-xs text-muted-foreground mt-0.5">UTF-8 с BOM, разделитель «;»</p>
 </div>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 {[
 { label: 'Контакты', url: '/api/export/contacts' },
 { label: 'Сделки', url: '/api/export/deals' },
 { label: 'Договоры', url: '/api/export/contracts' },
 { label: 'Бухгалтерия', url: '/api/export/accounting' },
 ].map(item => (
 <a
 key={item.url}
 href={item.url}
 className="flex items-center justify-center gap-1.5 py-2.5 px-3 border border-[var(--hp-border)] text-sm font-medium text-[var(--hp-sub)] hover:border-[var(--hp-border)] hover:bg-[var(--hp-neutral-tint)] hover:text-[var(--hp-sub)] transition-colors"
 >
 <Download className="w-3.5 h-3.5" />
 {item.label}
 </a>
 ))}
 </div>
 </div>

 {/* Instructions */}
 <div className="hp-card p-6 space-y-4" style={{ }}>
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 flex items-center justify-center shrink-0 bg-[var(--hp-neutral-tint)]">
 <FileText className="text-[var(--hp-sub)]" style={{ width: 16, height: 16 }} />
 </div>
 <h2 className="font-bold text-foreground text-[15px]">Как использовать</h2>
 </div>

 <div className="space-y-3">
 {steps.map((step, i) => (
 <div key={step} className="flex items-start gap-3">
 <span className="w-5 h-5 rounded-[var(--hp-radius)] bg-[var(--hp-neutral-tint)] border border-[var(--hp-border)] text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
 {i + 1}
 </span>
 <p className="text-sm text-[var(--hp-ink)] leading-relaxed">{step}</p>
 </div>
 ))}
 </div>

 <div className="p-4 flex gap-3" style={{ background: 'var(--hp-info-tint)', border: '1px solid var(--hp-border)' }}>
 <Lightbulb className="w-5 h-5 text-[var(--hp-info)] shrink-0 mt-0.5" />
 <div>
 <p className="text-[var(--hp-info)] font-semibold text-sm">Авто-обновление</p>
 <p className="text-[var(--hp-info)] mt-1 text-sm leading-relaxed break-words">
 Укажите ссылку <code className="bg-[var(--hp-info-tint)] px-1.5 py-0.5 text-xs break-all">/api/export/avito</code> в настройках площадки для автоматического обновления объявлений.
 </p>
 </div>
 </div>
 </div>
 </div>
 )
}
