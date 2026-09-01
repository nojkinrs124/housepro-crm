'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react'
import {
 parseImportFileAction,
 runImportAction,
 type ParseFileResult,
 type RunImportResult,
} from '../actions/import.actions'
import {
 ENTITY_LABELS,
 IMPORT_FIELDS,
 parseImportRow,
 type ImportEntity,
} from '@/lib/import/schema'

const ENTITIES: ImportEntity[] = ['contacts', 'properties', 'leads']

const ENTITY_HINTS: Record<ImportEntity, string> = {
 contacts: 'Клиенты и собственники: ФИО/название, телефон, почта, реквизиты юрлица.',
 properties: 'Каталог объектов: название, адрес, цена, площадь, комнаты.',
 leads: 'Входящие заявки: имя, телефон, источник, бюджет.',
}

/**
 * Мастер импорта таблиц. Три шага: файл → сопоставление колонок → результат.
 *
 * Разобранные строки живут в состоянии компонента и уходят на сервер вторым
 * запросом. Это осознанный размен: файл нигде не сохраняется (не нужен бакет
 * для временных файлов и его уборка), ценой повторной передачи данных.
 */
export function ImportWizard() {
 const [entity, setEntity] = useState<ImportEntity>('contacts')
 const [parsed, setParsed] = useState<ParseFileResult | null>(null)
 const [mapping, setMapping] = useState<Record<string, number>>({})
 const [skipDuplicates, setSkipDuplicates] = useState(true)
 const [result, setResult] = useState<RunImportResult | null>(null)
 const [error, setError] = useState<string | null>(null)
 const [isPending, startTransition] = useTransition()

 const fields = IMPORT_FIELDS[entity]

 const preview = useMemo(() => {
 if (!parsed?.rows) return []
 return parsed.rows.slice(0, 5).map((row) => parseImportRow(row, mapping, entity))
 }, [parsed, mapping, entity])

 const unmappedRequired = fields.filter((f) => f.required && mapping[f.key] === undefined)

 function handleFile(formData: FormData) {
 setError(null)
 setResult(null)
 startTransition(async () => {
 const res = await parseImportFileAction(entity, null, formData)
 if (res.error) {
 setError(res.error)
 setParsed(null)
 return
 }
 setParsed(res)
 setMapping(res.mapping ?? {})
 })
 }

 function handleImport() {
 if (!parsed?.rows) return
 setError(null)
 startTransition(async () => {
 const res = await runImportAction(entity, mapping, parsed.rows!, { skipDuplicates })
 setResult(res)
 if (res.error) {
 setError(res.error)
 return
 }
 toast.success(`Импортировано ${res.inserted} записей`)
 })
 }

 return (
 <div className="space-y-6">
 {/* Шаг 1 — что импортируем */}
 <div className="hp-card p-5 space-y-4">
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">1. Что импортируем</h2>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 {ENTITIES.map((key) => (
 <button
 key={key}
 type="button"
 onClick={() => {
 setEntity(key)
 setParsed(null)
 setResult(null)
 setError(null)
 }}
 className={`text-left p-4 border transition-colors ${
 entity === key
 ? 'border-[var(--hp-ink)] bg-[var(--hp-accent-tint)]'
 : 'border-[var(--hp-border)] bg-[var(--hp-surface)] hover:border-[var(--hp-sub)]'
 }`}
 >
 <span className="block text-sm font-semibold text-[var(--hp-ink)]">{ENTITY_LABELS[key]}</span>
 <span className="block text-xs text-[var(--hp-sub)] mt-1">{ENTITY_HINTS[key]}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Шаг 2 — файл */}
 <form action={handleFile} className="hp-card p-5 space-y-4">
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">2. Файл</h2>
 <p className="text-sm text-[var(--hp-sub)]">
 Поддерживаются .xlsx, .csv и .tsv до 10 МБ. Первая строка — заголовки колонок
 (если их нет, колонки можно сопоставить вручную на следующем шаге).
 </p>
 <div className="flex items-center gap-3 flex-wrap">
 <input
 type="file"
 name="file"
 accept=".xlsx,.xlsm,.csv,.tsv,.txt"
 required
 className="text-sm text-[var(--hp-ink)] file:mr-3 file:px-4 file:py-2 file:border file:border-[var(--hp-border)] file:bg-[var(--hp-surface)] file:text-sm file:font-semibold file:text-[var(--hp-ink)]"
 />
 <button
 type="submit"
 disabled={isPending}
 className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-60"
 >
 <Upload className="w-4 h-4" />
 {isPending ? 'Читаем…' : 'Загрузить и разобрать'}
 </button>
 </div>
 </form>

 {error && (
 <div className="flex items-start gap-2 border border-[var(--hp-border)] bg-[var(--hp-danger-tint)] px-4 py-3 text-sm text-[var(--hp-danger)]">
 <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
 {error}
 </div>
 )}

 {/* Шаг 3 — сопоставление */}
 {parsed?.headers && (
 <div className="hp-card p-5 space-y-4">
 <div className="flex items-center gap-2 flex-wrap">
 <FileSpreadsheet className="w-4 h-4 text-[var(--hp-sub)]" />
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">3. Сопоставление колонок</h2>
 <span className="hp-badge hp-badge-neutral">
 {parsed.sheetName} · {parsed.totalRows} строк
 </span>
 {parsed.truncated && (
 <span className="hp-badge hp-badge-warn">импортируются первые 5000</span>
 )}
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {fields.map((field) => (
 <div key={field.key} className="space-y-1.5">
 <label className="hp-label" htmlFor={`map-${field.key}`}>
 {field.label}
 {field.required && <span className="text-[var(--hp-danger)]"> *</span>}
 </label>
 <select
 id={`map-${field.key}`}
 value={mapping[field.key] ?? ''}
 onChange={(e) => {
 const next = { ...mapping }
 if (e.target.value === '') delete next[field.key]
 else next[field.key] = Number(e.target.value)
 setMapping(next)
 }}
 className="w-full h-10 px-4 rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] text-[var(--hp-ink)] text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer transition-colors"
 >
 <option value="">— не импортировать —</option>
 {parsed.headers!.map((header, index) => (
 <option key={`${header}-${index}`} value={index}>{header || `Колонка ${index + 1}`}</option>
 ))}
 </select>
 </div>
 ))}
 </div>

 {unmappedRequired.length > 0 && (
 <p className="text-sm text-[var(--hp-danger)]">
 Укажите колонки для обязательных полей: {unmappedRequired.map((f) => f.label).join(', ')}
 </p>
 )}

 <PreviewTable entity={entity} preview={preview} />

 <label className="flex items-center gap-2 text-sm text-[var(--hp-ink)]">
 <input
 type="checkbox"
 checked={skipDuplicates}
 onChange={(e) => setSkipDuplicates(e.target.checked)}
 />
 Пропускать записи, которые уже есть в базе
 {entity === 'properties' ? ' (по адресу)' : ' (по телефону)'}
 </label>

 <button
 type="button"
 onClick={handleImport}
 disabled={isPending || unmappedRequired.length > 0}
 className="flex items-center gap-2 px-5 py-2.5 text-white rounded-[var(--hp-radius)] text-sm font-semibold transition-colors bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] disabled:opacity-50"
 >
 {isPending ? 'Импортируем…' : `Импортировать ${parsed.rows?.length ?? 0} строк`}
 </button>
 </div>
 )}

 {/* Шаг 4 — результат */}
 {result && !result.error && (
 <div className="hp-card p-5 space-y-3">
 <div className="flex items-center gap-2">
 <CheckCircle2 className="w-4 h-4 text-[var(--hp-good)]" />
 <h2 className="font-bold text-[var(--hp-ink)] text-[15px]">Готово</h2>
 </div>
 <div className="hp-block">
 <div className="hp-block-row">
 <span className="label">Добавлено</span>
 <span className="value">{result.inserted}</span>
 </div>
 <div className="hp-block-row">
 <span className="label">Пропущено дублей</span>
 <span className="value">{result.skippedDuplicates ?? 0}</span>
 </div>
 <div className="hp-block-row">
 <span className="label">Строк с ошибками</span>
 <span className="value">{result.failed?.length ?? 0}</span>
 </div>
 </div>
 {result.failed && result.failed.length > 0 && (
 <ul className="text-sm text-[var(--hp-sub)] space-y-1">
 {result.failed.map((f) => (
 <li key={f.line}>Строка {f.line}: {f.reason}</li>
 ))}
 </ul>
 )}
 </div>
 )}
 </div>
 )
}

function PreviewTable({
 entity,
 preview,
}: {
 entity: ImportEntity
 preview: ReturnType<typeof parseImportRow>[]
}) {
 if (preview.length === 0) return null
 const fields = IMPORT_FIELDS[entity].filter((f) => preview.some((p) => p.values[f.key] !== undefined))
 const warnings = preview.flatMap((p) => p.warnings)

 return (
 <div className="space-y-2">
 <p className="hp-label">Предпросмотр первых строк</p>
 <div className="overflow-x-auto border border-[var(--hp-border)]">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-[var(--hp-neutral-tint)]">
 {fields.map((f) => (
 <th key={f.key} className="text-left px-3 py-2 font-semibold text-[var(--hp-ink)] whitespace-nowrap">
 {f.label}
 </th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-[var(--hp-border-soft)]">
 {preview.map((row, i) => (
 <tr key={i} className={row.errors.length > 0 ? 'bg-[var(--hp-danger-tint)]' : ''}>
 {fields.map((f) => (
 <td key={f.key} className="px-3 py-2 text-[var(--hp-ink)] whitespace-nowrap">
 {String(row.values[f.key] ?? '—')}
 </td>
 ))}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 {warnings.length > 0 && (
 <ul className="text-xs text-[var(--hp-sub)] space-y-0.5">
 {[...new Set(warnings)].slice(0, 5).map((w) => (
 <li key={w}>{w}</li>
 ))}
 </ul>
 )}
 </div>
 )
}
