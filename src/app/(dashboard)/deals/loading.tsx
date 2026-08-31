export default function DealsLoading() {
 const columns = ['Новые', 'Показ', 'Переговоры', 'Договор', 'Оплата', 'Завершено']

 return (
 <div className="space-y-6 animate-pulse">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="space-y-2">
 <div className="h-7 w-32 bg-[var(--hp-neutral-tint)]" />
 <div className="h-4 w-48 bg-[var(--hp-neutral-tint)]" />
 </div>
 <div className="h-10 w-36 bg-[var(--hp-neutral-tint)]" />
 </div>

 {/* Stats */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="bg-[var(--hp-surface)] p-4 border border-[var(--hp-border)] space-y-2">
 <div className="h-3 w-20 bg-[var(--hp-neutral-tint)]" />
 <div className="h-7 w-28 bg-[var(--hp-neutral-tint)]" />
 </div>
 ))}
 </div>

 {/* Kanban board */}
 <div className="flex gap-4 overflow-x-auto pb-4">
 {columns.map((col) => (
 <div key={col} className="shrink-0 w-72 space-y-3">
 {/* Column header */}
 <div className="flex items-center justify-between px-1">
 <div className="flex items-center gap-2">
 <div className="h-4 w-24 bg-[var(--hp-neutral-tint)]" />
 <div className="h-5 w-6 bg-[var(--hp-neutral-tint)] rounded-[var(--hp-radius)]" />
 </div>
 <div className="h-4 w-16 bg-[var(--hp-neutral-tint)]" />
 </div>

 {/* Cards */}
 <div className="space-y-3">
 {Array.from({ length: col === 'Новые' ? 3 : col === 'Переговоры' ? 2 : 1 }).map((_, i) => (
 <div
 key={i}
 className="bg-[var(--hp-surface)] p-4 border border-[var(--hp-border)] space-y-3"
 >
 <div className="flex items-start justify-between gap-2">
 <div className="h-5 w-6 bg-[var(--hp-neutral-tint)]" />
 <div className="h-5 w-16 bg-[var(--hp-neutral-tint)] rounded-[var(--hp-radius)]" />
 </div>
 <div className="space-y-1.5">
 <div className="h-4 w-full bg-[var(--hp-neutral-tint)]" />
 <div className="h-3 w-3/4 bg-[var(--hp-neutral-tint)]" />
 </div>
 <div className="flex items-center gap-2 pt-1">
 <div className="h-6 w-6 bg-[var(--hp-neutral-tint)] rounded-[var(--hp-radius)]" />
 <div className="h-3 w-20 bg-[var(--hp-neutral-tint)]" />
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 )
}
