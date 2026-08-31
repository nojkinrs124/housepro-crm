'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
 Zap, TrendingUp, Users, Home, FileText, CheckSquare
} from 'lucide-react'

const iconMap: Record<string, React.ElementType> = {
 Zap, TrendingUp, Users, Home, FileText, CheckSquare,
}

interface KpiCard {
 title: string
 value: number
 icon: string
 color: string
 iconBg: string
 href: string
 trend: string
 trendPos: boolean | null
}

export function DashboardKpiCards({ cards }: { cards: KpiCard[] }) {
 return (
 <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
 {cards.map((card, i) => {
 const Icon = iconMap[card.icon]
 const trendClass =
 card.trendPos === true
 ? 'text-green-600 bg-green-50 border border-green-100'
 : card.trendPos === false
 ? 'text-red-600 bg-red-50 border border-red-100'
 : 'text-[var(--hp-sub)] bg-slate-50 border border-[var(--hp-border-soft)]'

 return (
 <motion.div
 key={card.title}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.4, delay: i * 0.06, ease: 'easeOut' }}
 >
 <Link href={card.href}>
 <motion.div
 className="group bg-white p-5 border border-[var(--hp-border-soft)] cursor-pointer"
 style={{ }}
 whileHover={{
 y: -4,
 }}
 transition={{ duration: 0.2 }}
 >
 <div className="flex items-start justify-between mb-4">
 <motion.div
 className="w-11 h-11 flex items-center justify-center"
 style={{ background: card.iconBg }}
 whileHover={{ scale: 1.1 }}
 transition={{ duration: 0.15 }}
 >
 {Icon && <Icon style={{ width: 20, height: 20, color: card.color }} />}
 </motion.div>
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[var(--hp-radius-badge)] ${trendClass}`}>
 {card.trend}
 </span>
 </div>
 <p className="text-[32px] font-bold text-foreground leading-none tracking-tight">
 {card.value.toLocaleString('ru-RU')}
 </p>
 <p className="text-xs text-muted-foreground mt-2 leading-snug font-medium">{card.title}</p>
 </motion.div>
 </Link>
 </motion.div>
 )
 })}
 </div>
 )
}
