import { LoginForm } from '@/features/auth/components/LoginForm'
import { Building2 } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left — брендинг */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xl font-bold tracking-tight">HousePro CRM</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Управляйте недвижимостью эффективно
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed">
            CRM система для агентства недвижимости. Клиенты, объекты, договоры — всё в одном месте.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Клиентов', value: '1,200+' },
            { label: 'Договоров', value: '450+' },
            { label: 'Объектов', value: '890+' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-blue-200 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — форма */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-bold">HousePro CRM</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Вход в систему</h2>
            <p className="text-muted-foreground mt-1">Введите свои данные для входа</p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  )
}
