'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2, CheckCircle, AlertCircle, Save, Lock, User } from 'lucide-react'
import { updateProfileAction, updatePasswordAction, uploadAvatarAction } from '@/features/profile/actions/profile.actions'
import type { User as UserType } from '@/types/database'

const roleLabels: Record<string, string> = {
  admin: 'Администратор',
  manager: 'Менеджер',
  agent: 'Агент',
  accountant: 'Бухгалтер',
}

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  agent: 'bg-green-100 text-green-700',
  accountant: 'bg-orange-100 text-orange-700',
}

type FeedbackState = { type: 'success' | 'error'; message: string } | null

export function ProfileForm({ user }: { user: UserType }) {
  const [profileFeedback, setProfileFeedback] = useState<FeedbackState>(null)
  const [passwordFeedback, setPasswordFeedback] = useState<FeedbackState>(null)
  const [avatarSrc, setAvatarSrc] = useState(user.avatar_url ?? '')
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [profilePending, startProfileTransition] = useTransition()
  const [passwordPending, startPasswordTransition] = useTransition()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const passwordFormRef = useRef<HTMLFormElement>(null)

  // ── Avatar ────────────────────────────────────────────────
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Instant preview
    const preview = URL.createObjectURL(file)
    setAvatarSrc(preview)
    setAvatarLoading(true)

    const fd = new FormData()
    fd.append('avatar', file)
    const result = await uploadAvatarAction(fd)
    setAvatarLoading(false)

    if (result.error) {
      setAvatarSrc(user.avatar_url ?? '')
      setProfileFeedback({ type: 'error', message: result.error })
    } else if (result.url) {
      setAvatarSrc(result.url)
    }
  }

  // ── Profile save ─────────────────────────────────────────
  function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setProfileFeedback(null)
    startProfileTransition(async () => {
      const result = await updateProfileAction(fd)
      if (result.error) {
        setProfileFeedback({ type: 'error', message: result.error })
      } else {
        setProfileFeedback({ type: 'success', message: 'Профиль сохранён' })
        setTimeout(() => setProfileFeedback(null), 3000)
      }
    })
  }

  // ── Password save ─────────────────────────────────────────
  function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setPasswordFeedback(null)
    startPasswordTransition(async () => {
      const result = await updatePasswordAction(fd)
      if (result.error) {
        setPasswordFeedback({ type: 'error', message: result.error })
      } else {
        setPasswordFeedback({ type: 'success', message: 'Пароль обновлён' })
        passwordFormRef.current?.reset()
        setTimeout(() => setPasswordFeedback(null), 3000)
      }
    })
  }

  const initials = user.full_name?.charAt(0)?.toUpperCase() ?? 'U'

  return (
    <div className="space-y-6">

      {/* ── Avatar + basic info ── */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start gap-5 mb-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 overflow-hidden flex items-center justify-center">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary text-2xl font-bold">{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarLoading}
              className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shadow-md hover:bg-primary/90 transition-all"
              title="Сменить фото"
            >
              {avatarLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Camera className="w-3.5 h-3.5" />
              }
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">{user.full_name}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <span className={`inline-block mt-2 text-xs px-2.5 py-1 rounded-full font-medium ${roleColors[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
              {roleLabels[user.role] ?? user.role}
            </span>
          </div>
        </div>

        {/* Profile form */}
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <h3 className="font-medium text-foreground flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-muted-foreground" />
            Личные данные
          </h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Полное имя *
              </label>
              <input
                name="full_name"
                defaultValue={user.full_name}
                required
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Телефон
              </label>
              <input
                name="phone"
                defaultValue={user.phone ?? ''}
                type="tel"
                placeholder="+7 (999) 000-00-00"
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Email
            </label>
            <input
              value={user.email}
              disabled
              className="w-full h-10 px-3 rounded-xl border border-input bg-muted/50 text-sm text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">Email изменить нельзя</p>
          </div>

          <div className="flex items-center justify-between pt-1">
            {profileFeedback && (
              <div className={`flex items-center gap-2 text-sm ${profileFeedback.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
                {profileFeedback.type === 'success'
                  ? <CheckCircle className="w-4 h-4" />
                  : <AlertCircle className="w-4 h-4" />
                }
                {profileFeedback.message}
              </div>
            )}
            <button
              type="submit"
              disabled={profilePending}
              className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-all"
            >
              {profilePending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Сохранение...</>
                : <><Save className="w-4 h-4" /> Сохранить</>
              }
            </button>
          </div>
        </form>
      </div>

      {/* ── Password ── */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-medium text-foreground flex items-center gap-2 text-sm mb-4">
          <Lock className="w-4 h-4 text-muted-foreground" />
          Смена пароля
        </h3>

        <form ref={passwordFormRef} onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Новый пароль
              </label>
              <input
                name="password"
                type="password"
                minLength={6}
                required
                placeholder="Минимум 6 символов"
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Повтор пароля
              </label>
              <input
                name="confirm"
                type="password"
                required
                placeholder="Повторите пароль"
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            {passwordFeedback && (
              <div className={`flex items-center gap-2 text-sm ${passwordFeedback.type === 'success' ? 'text-green-600' : 'text-destructive'}`}>
                {passwordFeedback.type === 'success'
                  ? <CheckCircle className="w-4 h-4" />
                  : <AlertCircle className="w-4 h-4" />
                }
                {passwordFeedback.message}
              </div>
            )}
            <button
              type="submit"
              disabled={passwordPending}
              className="ml-auto flex items-center gap-2 px-5 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent disabled:opacity-60 transition-all"
            >
              {passwordPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Обновление...</>
                : <><Lock className="w-4 h-4" /> Обновить пароль</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
