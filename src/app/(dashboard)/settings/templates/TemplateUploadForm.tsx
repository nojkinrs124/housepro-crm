'use client'

import { useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'
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
    <div className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-4">
      <h2 className="font-semibold text-foreground flex items-center gap-2">
        <Upload className="w-4 h-4" />
        Загрузить шаблон
      </h2>

      <form id="template-upload-form" action={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Название шаблона</label>
            <input name="name" required placeholder="Договор аренды 2024"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Тип договора</label>
            <select name="template_type" required defaultValue=""
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
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
            className="w-full px-4 py-2 rounded-xl border border-input bg-background text-foreground text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-600 file:text-white hover:file:bg-green-700 cursor-pointer" />
        </div>

        {result?.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            ❌ {result.error}
          </div>
        )}
        {result?.success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            ✅ Шаблон успешно загружен
          </div>
        )}

        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 text-white rounded-[14px] text-sm font-bold hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 transition-all"
          style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {loading ? 'Загрузка...' : 'Загрузить шаблон'}
        </button>
      </form>
    </div>
  )
}
