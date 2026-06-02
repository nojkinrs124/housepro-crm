import { ArrowLeft, Settings } from 'lucide-react'
import Link from 'next/link'

export default function GeneralSettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к настройкам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
          <Settings className="w-5 h-5 text-gray-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Общие настройки</h1>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
        <Settings className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="font-semibold text-gray-900">Раздел в разработке</p>
        <p className="text-gray-600 text-sm mt-1">Функционал общих настроек будет доступен в следующем обновлении.</p>
      </div>
    </div>
  )
}
