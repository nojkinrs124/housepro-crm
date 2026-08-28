'use client'

import { useRef, useState, useTransition } from 'react'
import { Trash2, Send, MessageSquare, User } from 'lucide-react'
import { addDealCommentAction, deleteDealCommentAction } from '@/features/deals/actions/deal-comments.actions'
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

function formatDate(dt: string) {
  const d = new Date(dt)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин. назад`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} ч. назад`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} дн. назад`
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    return (
      <img src={url} alt={name}
        className="w-9 h-9 rounded-full object-cover border border-border shrink-0" />
    )
  }
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  const colors = [
    'bg-blue-500', 'bg-violet-500', 'bg-green-600',
    'bg-orange-500', 'bg-pink-500', 'bg-teal-500',
  ]
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initials || <User style={{ width: 14, height: 14 }} />}
    </div>
  )
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
    <div className="bg-white rounded-[20px] border border-border p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
          <MessageSquare style={{ width: 14, height: 14, color: '#2563EB' }} />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Комментарии</h2>
        {comments.length > 0 && (
          <span className="ml-auto text-xs font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
            {comments.length}
          </span>
        )}
      </div>

      {/* Comment list */}
      <div className="space-y-4 mb-5">
        {comments.length === 0 && (
          <p className="text-sm text-slate-400 py-2">Комментариев пока нет</p>
        )}
        {comments.map(comment => (
          <div key={comment.id} className="flex items-start gap-3 group">
            <Avatar
              name={comment.author?.full_name ?? 'U'}
              url={comment.author?.avatar_url}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-semibold text-foreground">
                  {comment.author?.full_name ?? 'Пользователь'}
                </span>
                <span className="text-xs text-slate-400">{formatDate(comment.created_at)}</span>
              </div>
              <div className="bg-background rounded-xl px-4 py-3 border border-border">
                <p className="text-sm text-[#374151] whitespace-pre-wrap leading-relaxed">{comment.body}</p>
              </div>
            </div>
            {comment.author?.id === currentUserId && (
              <button
                onClick={() => handleDelete(comment.id)}
                disabled={deletingId === comment.id}
                className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30"
                title="Удалить комментарий"
              >
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* New comment form */}
      <form ref={formRef} action={handleSubmit} className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          name="body"
          rows={1}
          placeholder="Напишите комментарий… (Ctrl+Enter для отправки)"
          onKeyDown={handleKeyDown}
          onChange={autoResize}
          className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-green-100 transition-all overflow-hidden"
          style={{ minHeight: 42, maxHeight: 160 }}
          disabled={isPending}
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#16A34A] to-[#22C55E] text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
        >
          <Send style={{ width: 16, height: 16 }} />
        </button>
      </form>
      <p className="text-xs text-slate-400 mt-1.5">Ctrl+Enter для отправки</p>
    </div>
  )
}
