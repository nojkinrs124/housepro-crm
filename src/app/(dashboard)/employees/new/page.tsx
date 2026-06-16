import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createEmployeeAction } from '@/features/users/actions/users.actions'
import { formAction } from '@/lib/form-action'

export default function NewEmployeePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/employees" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к сотрудникам
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Добавить сотрудника</h1>
        <p className="text-muted-foreground mt-1">Создание нового пользователя в системе</p>
      </div>

      <form action={formAction(createEmployeeAction)} className="bg-card border border-border rounded-[20px] p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Email
          </label>
          <input
            type="email"
            name="email"
            required
            className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
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
            className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
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
            className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:border-primary"
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
            className="w-full px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            placeholder="+7 (999) 123-45-67"
          />
        </div>

        <button
          type="submit"
          className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
        >
          Добавить сотрудника
        </button>
      </form>
    </div>
  )
}
