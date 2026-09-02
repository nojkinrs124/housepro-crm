import { createEmployeeAction } from '@/features/users/actions/users.actions'
import { ServerActionForm } from '@/components/forms/ServerActionForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default function NewEmployeePage() {
 return (
 <div className="max-w-2xl mx-auto space-y-6">
 <PageHeader
 title="Пригласить сотрудника"
 subtitle="На указанный email придёт ссылка для входа и создания пароля"
 backHref="/employees"
 backLabel="Вернуться к сотрудникам"
 />

 <ServerActionForm action={createEmployeeAction} className="hp-card p-6 space-y-5">
 <div>
 <label className="block text-sm font-medium text-foreground mb-2">
 Email
 </label>
 <input
 type="email"
 name="email"
 required
 className="w-full h-10 px-4 border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:border-[var(--hp-ink)] transition-all"
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
 className="w-full h-10 px-4 border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:border-[var(--hp-ink)] transition-all"
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
 className="w-full h-10 px-4 border border-input bg-background text-foreground text-sm outline-none focus:border-[var(--hp-ink)] cursor-pointer transition-all"
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
 className="w-full h-10 px-4 border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm outline-none focus:border-[var(--hp-ink)] transition-all"
 placeholder="+7 (999) 123-45-67"
 />
 </div>

 <button
 type="submit"
 className="w-full px-4 py-2 text-white font-medium transition" style={{ background: 'var(--hp-accent)', }}
 >
 Добавить сотрудника
 </button>
 </ServerActionForm>
 </div>
 )
}
