import { Settings, Building2, Bell, Shield, Database } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Настройки</h1>
        <p className="text-muted-foreground mt-1">Управление системой HousePro CRM</p>
      </div>

      <div className="grid gap-4">
        {[
          {
            icon: Building2,
            title: 'Компания',
            desc: 'Название, логотип, реквизиты',
            color: 'bg-blue-50 text-blue-600',
          },
          {
            icon: Bell,
            title: 'Уведомления',
            desc: 'Email и push-уведомления',
            color: 'bg-yellow-50 text-yellow-600',
          },
          {
            icon: Shield,
            title: 'Безопасность',
            desc: 'Роли, доступы, пароли',
            color: 'bg-green-50 text-green-600',
          },
          {
            icon: Database,
            title: 'Шаблоны документов',
            desc: 'DOCX шаблоны договоров',
            color: 'bg-violet-50 text-violet-600',
          },
          {
            icon: Settings,
            title: 'Общие настройки',
            desc: 'Язык, валюта, временная зона',
            color: 'bg-gray-50 text-gray-600',
          },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.title}
              className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 hover:shadow-sm transition-all cursor-pointer hover:border-primary/30"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
              <span className="ml-auto text-muted-foreground">→</span>
            </div>
          )
        })}
      </div>

      {/* Version info */}
      <div className="bg-muted/50 rounded-2xl p-4 text-center">
        <p className="text-sm text-muted-foreground">
          HousePro CRM v1.0.0 · Powered by Next.js + Supabase
        </p>
      </div>
    </div>
  )
}
