export default function AnalyticsLoading() {
 return (
 <div className="space-y-6 animate-pulse">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="space-y-2">
 <div className="h-7 w-40 bg-[var(--hp-neutral-tint)]" />
 <div className="h-4 w-56 bg-[var(--hp-neutral-tint)]" />
 </div>
 <div className="h-10 w-48 bg-[var(--hp-neutral-tint)]" />
 </div>

 {/* KPI cards */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="bg-[var(--hp-surface)] p-5 border border-[var(--hp-border)] space-y-3">
 <div className="h-4 w-28 bg-[var(--hp-neutral-tint)]" />
 <div className="h-9 w-36 bg-[var(--hp-neutral-tint)]" />
 <div className="h-3 w-20 bg-[var(--hp-neutral-tint)]" />
 </div>
 ))}
 </div>

 {/* Main charts row */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Bar chart placeholder */}
 <div className="bg-[var(--hp-surface)] p-6 border border-[var(--hp-border)] space-y-4">
 <div className="h-5 w-44 bg-[var(--hp-neutral-tint)]" />
 <div className="h-[220px] flex items-end gap-3 pt-4">
 {Array.from({ length: 6 }).map((_, i) => (
 <div key={i} className="flex-1 flex flex-col justify-end gap-1">
 <div
 className="bg-[var(--hp-neutral-tint)]"
 style={{ height: `${40 + (i % 3) * 40 + (i % 2) * 30}px` }}
 />
 </div>
 ))}
 </div>
 <div className="flex justify-between">
 {Array.from({ length: 6 }).map((_, i) => (
 <div key={i} className="h-3 w-8 bg-[var(--hp-neutral-tint)]" />
 ))}
 </div>
 </div>

 {/* Pie chart placeholder */}
 <div className="bg-[var(--hp-surface)] p-6 border border-[var(--hp-border)] space-y-4">
 <div className="h-5 w-36 bg-[var(--hp-neutral-tint)]" />
 <div className="flex items-center gap-8">
 <div className="w-40 h-40 bg-[var(--hp-neutral-tint)] rounded-full shrink-0" />
 <div className="flex-1 space-y-3">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="flex items-center gap-3">
 <div className="w-3 h-3 rounded-full bg-[var(--hp-neutral-tint)] shrink-0" />
 <div className="h-3 flex-1 bg-[var(--hp-neutral-tint)]" />
 <div className="h-3 w-10 bg-[var(--hp-neutral-tint)]" />
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>

 {/* Bottom row */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {Array.from({ length: 3 }).map((_, i) => (
 <div key={i} className="bg-[var(--hp-surface)] p-6 border border-[var(--hp-border)] space-y-4">
 <div className="h-5 w-32 bg-[var(--hp-neutral-tint)]" />
 <div className="h-[140px] bg-[var(--hp-neutral-tint)]" />
 </div>
 ))}
 </div>
 </div>
 )
}
