import { ArrowLeft, Bell } from 'lucide-react'
import Link from 'next/link'

export default function NotificationsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к настройкам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
          <Bell className="w-5 h-5 text-yellow-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Уведомления</h1>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
        <Bell className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
        <p className="font-semibold text-yellow-900">Раздел временно недоступен</p>
        <p className="text-yellow-700 text-sm mt-1">Функционал уведомлений находится в разработке.</p>
      </div>
    </div>
  )
}
