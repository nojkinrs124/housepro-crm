import { ArrowLeft, Shield } from 'lucide-react'
import Link from 'next/link'

export default function SecurityPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться к настройкам
      </Link>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Безопасность</h1>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
        <Shield className="w-10 h-10 text-blue-400 mx-auto mb-3" />
        <p className="font-semibold text-blue-900">Раздел временно недоступен</p>
        <p className="text-blue-700 text-sm mt-1">Функционал безопасности находится в разработке.</p>
      </div>
    </div>
  )
}
