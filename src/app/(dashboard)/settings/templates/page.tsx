import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, FileText, Upload, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { TemplateUploadForm } from './TemplateUploadForm'
import { deleteTemplateAction } from './templates.actions'
import { formAction } from '@/lib/form-action'

const typeLabels: Record<string, string> = {
  rent_apartment:     'Аренда квартиры',
  rent_commercial:    'Коммерческая аренда',
  sale_apartment:     'Продажа квартиры',
  sale_house:         'Продажа дома',
  property_management:'Управление',
  sublease:           'Субаренда',
  agency_contract:    'Агентский договор',
  other:              'Другое',
}

export default async function TemplatesPage() {
  const supabase = await createClient()
  const { data: templates } = await supabase
    .from('document_templates')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-medium text-[#64748B] hover:text-[#111827] transition-colors">
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Вернуться к настройкам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 bg-orange-50">
          <FileText className="text-orange-600" style={{ width: 20, height: 20 }} />
        </div>
        <div>
          <h1 className="text-[28px] font-bold text-[#111827] tracking-tight leading-tight">Шаблоны документов</h1>
          <p className="text-[#64748B] text-sm font-medium mt-0.5">DOCX-шаблоны для генерации договоров</p>
        </div>
      </div>

      {/* Upload form */}
      <TemplateUploadForm />

      {/* Template list */}
      <div className="bg-white rounded-[20px] border border-slate-100 overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)' }}>
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-bold text-[#111827] text-[15px]">Загруженные шаблоны</h2>
        </div>
        {!templates || templates.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 rounded-[20px] flex items-center justify-center mx-auto mb-4 bg-orange-50">
              <FileText style={{ width: 22, height: 22 }} className="text-orange-500" />
            </div>
            <p className="text-[#111827] font-semibold text-sm">Шаблонов ещё нет</p>
            <p className="text-[#64748B] text-xs mt-1">Загрузите первый DOCX-шаблон выше</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-all duration-200">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                  <FileText className="text-orange-600" style={{ width: 16, height: 16 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#111827] text-sm truncate">{t.name}</p>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    {typeLabels[t.template_type] ?? t.template_type} · {new Date(t.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.file_url && (
                    <a href={t.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-semibold text-[#16A34A] hover:underline px-3 py-1.5 border border-green-200 rounded-[10px] transition-colors hover:bg-green-50">
                      Скачать
                    </a>
                  )}
                  <form action={formAction(deleteTemplateAction.bind(null, t.id))}>
                    <button type="submit"
                      className="p-2 text-[#94A3B8] hover:text-red-600 hover:bg-red-50 rounded-[10px] transition-all duration-200">
                      <Trash2 style={{ width: 16, height: 16 }} />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[16px] p-4" style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <p className="text-blue-900 text-sm font-semibold">💡 Как использовать шаблоны</p>
        <p className="text-blue-700 text-sm mt-1 leading-relaxed">
          В шаблоне используйте переменные в двойных фигурных скобках, например: {'{{'} CLIENT_NAME {'}}'}, {'{{'} CONTRACT_NUMBER {'}}'}, {'{{'} PRICE {'}}'}. 
          При генерации договора переменные автоматически заменятся на данные из базы.
        </p>
      </div>
    </div>
  )
}
