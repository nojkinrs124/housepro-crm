'use client'

import { useRef, useState, useTransition } from 'react'
import { Trash2, Send, Loader2 } from 'lucide-react'
import { addDealCommentAction, deleteDealCommentAction } from '@/features/deals/actions/deal-comments.actions'
import { formatRelative, initials } from '@/lib/utils'
import { toast } from 'sonner'

interface Comment {
  id: string
  body: string
  created_at: string
  author: { id: string; full_name: string; avatar_url?: string | null } | null
}

interface Props {
  dealId: string
  comments: Comment[]
  currentUserId: string
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="hp-avatar object-cover" />
  }
  return <div className="hp-avatar">{initials(name)}</div>
}

export function DealComments({ dealId, comments: initialComments, currentUserId }: Props) {
  const [comments, setComments] = useState(initialComments)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit(formData: FormData) {
    const body = (formData.get('body') as string)?.trim()
    if (!body) return

    startTransition(async () => {
      const res = await addDealCommentAction(dealId, formData)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        formRef.current?.reset()
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        toast.success('Комментарий добавлен')
      }
    })
  }

  function handleDelete(commentId: string) {
    setDeletingId(commentId)
    startTransition(async () => {
      const res = await deleteDealCommentAction(commentId, dealId)
      if (res.error) {
        toast.error(res.error)
      } else {
        setComments(prev => prev.filter(c => c.id !== commentId))
        toast.success('Комментарий удалён')
      }
      setDeletingId(null)
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      const form = formRef.current
      if (form) handleSubmit(new FormData(form))
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

  return (
    <div className="hp-block">
      <div className="hp-block-header flex items-center justify-between">
        <span>Комментарии{comments.length > 0 ? ` · ${comments.length}` : ''}</span>
        {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
      </div>

      {comments.length === 0 && (
        <div className="hp-block-item text-[var(--hp-tertiary)]">Комментариев пока нет</div>
      )}

      {comments.map(comment => (
        <div key={comment.id} className="hp-block-item items-start group">
          <Avatar name={comment.author?.full_name ?? 'U'} url={comment.author?.avatar_url} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-semibold text-[var(--hp-ink)]">
                {comment.author?.full_name ?? 'Пользователь'}
              </span>
              <span className="text-[11.5px] text-[var(--hp-tertiary)]">
                {formatRelative(comment.created_at)}
              </span>
            </div>
            <p className="text-[var(--hp-sub)] whitespace-pre-wrap leading-relaxed mt-1">
              {comment.body}
            </p>
          </div>
          {comment.author?.id === currentUserId && (
            <button
              onClick={() => handleDelete(comment.id)}
              disabled={deletingId === comment.id}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-[var(--hp-radius-sm)] text-[var(--hp-tertiary)] hover:text-[var(--hp-danger)] hover:bg-[var(--hp-danger-tint)] disabled:opacity-30 shrink-0"
              title="Удалить комментарий"
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      ))}

      <form
        ref={formRef}
        action={handleSubmit}
        className="flex items-end gap-2 p-3 border-t border-[var(--hp-border-soft)]"
      >
        <textarea
          ref={textareaRef}
          name="body"
          rows={1}
          placeholder="Комментарий… (Ctrl+Enter для отправки)"
          onKeyDown={handleKeyDown}
          onChange={autoResize}
          className="flex-1 resize-none rounded-[var(--hp-radius)] border border-[var(--hp-border)] bg-[var(--hp-surface)] px-4 py-2.5 text-sm text-[var(--hp-ink)] placeholder:text-[var(--hp-tertiary)] outline-none focus:border-[var(--hp-ink)] transition-colors overflow-hidden"
          style={{ minHeight: 40, maxHeight: 160 }}
          disabled={isPending}
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 h-10 px-4 flex items-center gap-2 rounded-[var(--hp-radius)] bg-[var(--hp-accent)] hover:bg-[var(--hp-accent-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Send style={{ width: 15, height: 15 }} />
          <span className="hidden sm:inline">Отправить</span>
        </button>
      </form>
    </div>
  )
}
