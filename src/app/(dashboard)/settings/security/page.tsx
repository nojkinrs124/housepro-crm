import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SecurityPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Безопасность</h1>
        <p className="text-muted-foreground mt-1">Роли, доступы, пароли</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
        <p className="text-amber-900 font-medium">
          🔒 Раздел временно недоступен
        </p>
        <p className="text-amber-700 text-sm mt-2">
          Функционал находится в разработке. Он скоро будет доступен.
        </p>
      </div>
    </div>
  )
}
