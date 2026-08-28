import { LoginForm } from '@/features/auth/components/LoginForm'
import { Building2, TrendingUp, Users, FileText } from 'lucide-react'

export default function LoginPage() {
 return (
 <div className="min-h-screen flex">
 {/* Left — брендинг */}
 <div
 className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
 style={{ background: 'linear-gradient(135deg, #14532D 0%, #15803D 40%, #16A34A 100%)' }}
 >
 {/* Decorative circles */}
 <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10"
 style={{ background: 'radial-gradient(circle, #22C55E, transparent)', transform: 'translate(30%, -30%)' }} />
 <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10"
 style={{ background: 'radial-gradient(circle, #4ADE80, transparent)', transform: 'translate(-30%, 30%)' }} />

 <div className="flex items-center gap-3 relative z-10">
 <div
 className="w-11 h-11 flex items-center justify-center"
 style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)' }}
 >
 <Building2 className="w-6 h-6 text-white" />
 </div>
 <div>
 <span className="text-white font-bold text-[18px] leading-tight block tracking-tight">HousePro</span>
 <span className="text-green-200 text-[10px] font-bold tracking-widest uppercase">CRM</span>
 </div>
 </div>

 <div className="relative z-10">
 <h1 className="text-[40px] font-bold text-white leading-[1.15] mb-5 tracking-tight">
 Управляйте недвижимостью эффективно
 </h1>
 <p className="text-green-100 text-[17px] leading-relaxed max-w-sm">
 CRM система для агентства недвижимости. Клиенты, объекты, договоры — всё в одном месте.
 </p>
 </div>

 <div className="grid grid-cols-3 gap-4 relative z-10">
 {[
 { label: 'Клиентов', value: '1 200+', icon: Users },
 { label: 'Договоров', value: '450+', icon: FileText },
 { label: 'Объектов', value: '890+', icon: TrendingUp },
 ].map((stat) => {
 const Icon = stat.icon
 return (
 <div
 key={stat.label}
 className="p-4"
 style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)' }}
 >
 <Icon className="w-5 h-5 text-green-200 mb-2" />
 <div className="text-[22px] font-bold text-white leading-tight">{stat.value}</div>
 <div className="text-green-200 text-xs font-medium mt-0.5">{stat.label}</div>
 </div>
 )
 })}
 </div>
 </div>

 {/* Right — форма */}
 <div className="flex-1 flex items-center justify-center p-6 sm:p-10" style={{ background: '#F8FAFC' }}>
 <div className="w-full max-w-md">
 {/* Mobile logo */}
 <div className="flex items-center gap-3 mb-10 lg:hidden">
 <div
 className="w-11 h-11 flex items-center justify-center"
 style={{ background: 'var(--hp-gradient-primary)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}
 >
 <Building2 className="w-6 h-6 text-white" />
 </div>
 <div>
 <span className="font-bold text-foreground text-[18px] leading-tight block tracking-tight">HousePro</span>
 <span className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">CRM</span>
 </div>
 </div>

 <div className="mb-8">
 <h2 className="text-[28px] font-bold text-foreground tracking-tight leading-tight">Вход в систему</h2>
 <p className="text-muted-foreground mt-1.5 text-sm font-medium">Введите свои данные для входа</p>
 </div>

 <LoginForm />
 </div>
 </div>
 </div>
 )
}
