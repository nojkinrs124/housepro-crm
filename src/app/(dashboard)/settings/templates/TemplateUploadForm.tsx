'use client'

import { useState } from 'react'
import { Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { uploadTemplateAction } from './templates.actions'
import { CONTRACT_TYPES } from '@/features/contracts/config/contract-types'

const typeOptions = [
 ...CONTRACT_TYPES.map(t => ({ value: t.value, label: t.shortLabel })),
 { value: 'other', label: 'Другое' },
]

export function TemplateUploadForm() {
 const [loading, setLoading] = useState(false)
 const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)

 async function handleSubmit(formData: FormData) {
 setLoading(true)
 setResult(null)
 const res = await uploadTemplateAction(formData)
 setResult(res)
 setLoading(false)
 if (res.success) {
 // Reset form
 const form = document.getElementById('template-upload-form') as HTMLFormElement
 form?.reset()
 }
 }

 return (
 <div className="hp-card p-6 space-y-4">
 <h2 className="font-semibold text-foreground flex items-center gap-2">
 <Upload className="w-4 h-4" />
 Загрузить шаблон
 </h2>

 <form id="template-upload-form" action={handleSubmit} className="space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className="text-sm font-medium text-foreground">Название шаблона</label>
 <input name="name" required placeholder="Договор аренды 2024"
 className="w-full h-10 px-4 border border-input bg-background text-foreground text-sm outline-none focus:border-[var(--hp-ink)] transition-all" />
 </div>
 <div className="space-y-1.5">
 <label className="text-sm font-medium text-foreground">Тип договора</label>
 <select name="template_type" required defaultValue=""
 className="w-full h-10 px-4 border border-input bg-background text-foreground text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer">
 <option value="" disabled>Выберите тип</option>
 {typeOptions.map(o => (
 <option key={o.value} value={o.value}>{o.label}</option>
 ))}
 </select>
 </div>
 </div>

 <div className="space-y-1.5">
 <label className="text-sm font-medium text-foreground">DOCX файл</label>
 <input name="file" type="file" accept=".docx" required
 className="w-full px-4 py-2 border border-input bg-background text-foreground text-sm file:mr-4 file:py-1 file:px-3 file: file:border-0 file:text-sm file:font-medium file:bg-[var(--hp-accent)] file:text-white hover:file:bg-[var(--hp-accent)] cursor-pointer" />
 </div>

 {result?.error && (
 <div className="flex items-center gap-2 p-3 bg-[var(--hp-danger-tint)] border border-[var(--hp-border)] text-sm text-[var(--hp-danger)]">
 <AlertCircle className="w-4 h-4 shrink-0" />
 {result.error}
 </div>
 )}
 {result?.success && (
 <div className="flex items-center gap-2 p-3 bg-[var(--hp-good-tint)] border border-[var(--hp-border)] text-sm text-[var(--hp-good)]">
 <CheckCircle2 className="w-4 h-4 shrink-0" />
 Шаблон успешно загружен
 </div>
 )}

 <button type="submit" disabled={loading}
 className="flex items-center gap-2 px-6 py-2.5 text-white text-sm font-bold disabled:opacity-60 disabled:hover:translate-y-0 transition-all"
 style={{ background: 'var(--hp-accent)', }}>
 {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
 {loading ? 'Загрузка...' : 'Загрузить шаблон'}
 </button>
 </form>
 </div>
 )
}
