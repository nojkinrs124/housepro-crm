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
      <Link href="/settings" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к настройкам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Шаблоны документов</h1>
          <p className="text-muted-foreground mt-1">DOCX-шаблоны для генерации договоров</p>
        </div>
      </div>

      {/* Upload form */}
      <TemplateUploadForm />

      {/* Template list */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Загруженные шаблоны</h2>
        </div>
        {!templates || templates.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">Шаблонов ещё нет</p>
            <p className="text-muted-foreground text-xs mt-1">Загрузите первый DOCX-шаблон выше</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-4 p-4 hover:bg-accent/30 transition">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {typeLabels[t.template_type] ?? t.template_type} · {new Date(t.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {t.file_url && (
                    <a href={t.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline px-3 py-1.5 border border-primary/20 rounded-lg transition hover:bg-primary/5">
                      Скачать
                    </a>
                  )}
                  <form action={formAction(deleteTemplateAction.bind(null, t.id))}>
                    <button type="submit"
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-blue-900 text-sm font-medium">💡 Как использовать шаблоны</p>
        <p className="text-blue-700 text-sm mt-1">
          В шаблоне используйте переменные в двойных фигурных скобках, например: {'{{'} CLIENT_NAME {'}}'}, {'{{'} CONTRACT_NUMBER {'}}'}, {'{{'} PRICE {'}}'}. 
          При генерации договора переменные автоматически заменятся на данные из базы.
        </p>
      </div>
    </div>
  )
}
