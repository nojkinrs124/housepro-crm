'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Eye, Pencil } from 'lucide-react'
import { Markdown } from './Markdown'
import { KNOWLEDGE_CATEGORIES } from '@/features/knowledge/config/categories'

type State = { error?: string } | undefined
type Action = (state: State, formData: FormData) => Promise<State>

export interface ArticleDefaults {
  id?: string
  title?: string
  category?: string
  summary?: string | null
  body?: string
  sort_order?: number
  is_published?: boolean
}

/**
 * Редактор статьи с предпросмотром: текст пишется в markdown, вкладка
 * «Просмотр» показывает его тем же рендером, что и читатель — без сохранения.
 */
export function ArticleForm({
  action,
  defaults = {},
  submitLabel,
  backHref,
}: {
  action: Action
  defaults?: ArticleDefaults
  submitLabel: string
  backHref: string
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [body, setBody] = useState(defaults.body ?? '')
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p className="hp-card p-3 text-sm text-[var(--hp-danger)]">{state.error}</p>
      )}

      <div className="hp-card p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="hp-label" htmlFor="title">Заголовок</label>
          <input id="title" name="title" required defaultValue={defaults.title ?? ''}
            placeholder="Как принять объект в управление" className="hp-input" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="category">Рубрика</label>
            <input id="category" name="category" list="knowledge-categories"
              defaultValue={defaults.category ?? 'Общее'} className="hp-input" />
            <datalist id="knowledge-categories">
              {KNOWLEDGE_CATEGORIES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <label className="hp-label" htmlFor="sort_order">Порядок</label>
            <input id="sort_order" name="sort_order" type="number" defaultValue={defaults.sort_order ?? 0}
              className="hp-input" />
          </div>
          <div className="space-y-1.5">
            <span className="hp-label">Видимость</span>
            <label className="flex items-center gap-2 h-10 text-sm text-[var(--hp-ink)]">
              <input type="checkbox" name="is_published" defaultChecked={defaults.is_published ?? true}
                className="w-4 h-4 accent-[var(--hp-accent)]" />
              Опубликована
            </label>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="hp-label" htmlFor="summary">Краткое описание</label>
          <input id="summary" name="summary" defaultValue={defaults.summary ?? ''}
            placeholder="Одной строкой — о чём статья" className="hp-input" />
        </div>
      </div>

      <div className="hp-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTab('edit')}
            className={`hp-chip${tab === 'edit' ? ' active' : ''}`}>
            <Pencil className="w-3.5 h-3.5 shrink-0" />
            Текст
          </button>
          <button type="button" onClick={() => setTab('preview')}
            className={`hp-chip${tab === 'preview' ? ' active' : ''}`}>
            <Eye className="w-3.5 h-3.5 shrink-0" />
            Просмотр
          </button>
          <span className="text-xs text-[var(--hp-sub)] ml-auto">
            Markdown: ## заголовок, - список, **жирный**, таблицы через |
          </span>
        </div>

        {tab === 'edit' ? (
          <textarea
            name="body"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={24}
            className="w-full px-4 py-3 border border-[var(--hp-border)] bg-[var(--hp-surface)] text-sm outline-none focus:border-[var(--hp-ink)] transition-colors leading-relaxed"
            placeholder={'## Когда применять\n\nКороткое объяснение.\n\n- первый шаг\n- второй шаг'}
          />
        ) : (
          <>
            <input type="hidden" name="body" value={body} />
            <div className="border border-[var(--hp-border)] p-5 min-h-[300px]">
              {body.trim() ? <Markdown source={body} /> : (
                <p className="text-sm text-[var(--hp-tertiary)]">Пока пусто — напишите текст на вкладке «Текст».</p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button type="submit" disabled={pending} className="hp-btn-primary">
          {pending ? 'Сохранение…' : submitLabel}
        </button>
        <Link href={backHref} className="hp-chip">Отмена</Link>
      </div>
    </form>
  )
}
