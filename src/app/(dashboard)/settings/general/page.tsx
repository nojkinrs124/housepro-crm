import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function GeneralPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
        <ArrowLeft className="w-4 h-4" />
        Вернуться
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Общие настройки</h1>
        <p className="text-muted-foreground mt-1">Язык, валюта, временная зона</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
        <p className="text-amber-900 font-medium">
          ⚙️ Раздел находится в разработке
        </p>
        <p className="text-amber-700 text-sm mt-2">
          Функционал скоро будет доступен.
        </p>
      </div>
    </div>
  )
}
