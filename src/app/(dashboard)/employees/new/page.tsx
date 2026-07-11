import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createEmployeeAction } from '@/features/users/actions/users.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'

export default function NewEmployeePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/employees" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к сотрудникам
      </Link>

      <div>
        <h1 className="text-[28px] font-bold text-foreground tracking-tight leading-tight">Добавить сотрудника</h1>
        <p className="text-muted-foreground mt-1">Создание нового пользователя в системе</p>
      </div>

      <ServerActionForm action={createEmployeeAction} className="bg-white border border-slate-100 rounded-[20px] shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Email
          </label>
          <input
            type="email"
            name="email"
            required
            className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            placeholder="user@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Полное имя
          </label>
          <input
            type="text"
            name="full_name"
            required
            className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            placeholder="Иван Иванов"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Роль
          </label>
          <select
            name="role"
            required
            defaultValue="agent"
            className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer transition-all"
          >
            <option value="admin">Администратор</option>
            <option value="manager">Менеджер</option>
            <option value="agent">Риелтор</option>
            <option value="accountant">Бухгалтер</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Телефон (опционально)
          </label>
          <input
            type="tel"
            name="phone"
            className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            placeholder="+7 (999) 123-45-67"
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 rounded-[14px] text-white font-medium hover:-translate-y-0.5 transition" style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}
        >
          Добавить сотрудника
        </button>
      </ServerActionForm>
    </div>
  )
}
