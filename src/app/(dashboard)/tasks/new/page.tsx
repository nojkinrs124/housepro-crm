import { createTaskAction } from '@/features/tasks/actions/tasks.actions'
import { ArrowLeft, CheckSquare } from 'lucide-react'
import Link from 'next/link'

export default function NewTaskPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/tasks" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Назад к задачам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
          <CheckSquare className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Новая задача</h1>
          <p className="text-muted-foreground text-sm">Создайте задачу для команды</p>
        </div>
      </div>

      <form action={createTaskAction} className="space-y-4">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Название <span className="text-destructive">*</span>
            </label>
            <input name="title" required placeholder="Позвонить клиенту по договору"
              className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Описание</label>
            <textarea name="description" rows={3} placeholder="Подробности задачи..."
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Приоритет</label>
              <select name="priority" defaultValue="medium"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Дедлайн</label>
              <input name="deadline" type="datetime-local"
                className="w-full h-10 px-4 rounded-xl border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all">
            <CheckSquare className="w-4 h-4" />
            Создать задачу
          </button>
          <Link href="/tasks"
            className="px-6 py-2.5 border border-border text-foreground rounded-xl text-sm font-medium hover:bg-accent transition-all">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  )
}
