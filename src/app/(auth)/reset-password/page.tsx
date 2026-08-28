import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm'
import { Building2 } from 'lucide-react'

export default function ResetPasswordPage() {
 return (
 <div className="min-h-screen flex items-center justify-center p-6 sm:p-10" style={{ background: '#F8FAFC' }}>
 <div className="w-full max-w-md">
 <div className="flex items-center gap-3 mb-10">
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
 <h1 className="text-[28px] font-bold text-foreground tracking-tight leading-tight">Новый пароль</h1>
 <p className="text-muted-foreground mt-1.5 text-sm font-medium">
 Придумайте новый пароль для входа в аккаунт
 </p>
 </div>

 <ResetPasswordForm />
 </div>
 </div>
 )
}
