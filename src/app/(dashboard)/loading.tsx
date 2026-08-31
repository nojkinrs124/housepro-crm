export default function DashboardLoading() {
 return (
 <div className="space-y-6 animate-pulse">
 {/* Page header skeleton */}
 <div className="flex items-center justify-between">
 <div className="space-y-2">
 <div className="h-7 w-48 bg-[var(--hp-neutral-tint)]" />
 <div className="h-4 w-72 bg-[var(--hp-neutral-tint)]" />
 </div>
 <div className="h-10 w-36 bg-[var(--hp-neutral-tint)]" />
 </div>

 {/* Stats row skeleton */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <div
 key={i}
 className="bg-white p-5 border border-[var(--hp-border)] space-y-3"
 >
 <div className="flex items-center justify-between">
 <div className="h-4 w-24 bg-[var(--hp-neutral-tint)]" />
 <div className="h-9 w-9 bg-[var(--hp-neutral-tint)]" />
 </div>
 <div className="h-8 w-32 bg-[var(--hp-neutral-tint)]" />
 <div className="h-3 w-20 bg-[var(--hp-neutral-tint)]" />
 </div>
 ))}
 </div>

 {/* Content area skeleton */}
 <div className="bg-white border border-[var(--hp-border)] p-6 space-y-4">
 <div className="h-5 w-40 bg-[var(--hp-neutral-tint)]" />
 {Array.from({ length: 5 }).map((_, i) => (
 <div key={i} className="flex items-center gap-4 py-3 border-b border-[var(--hp-border)] last:border-0">
 <div className="h-10 w-10 bg-[var(--hp-neutral-tint)] rounded-[var(--hp-radius)] shrink-0" />
 <div className="flex-1 space-y-2">
 <div className="h-4 w-48 bg-[var(--hp-neutral-tint)]" />
 <div className="h-3 w-32 bg-[var(--hp-neutral-tint)]" />
 </div>
 <div className="h-6 w-20 bg-[var(--hp-neutral-tint)] rounded-[var(--hp-radius)]" />
 </div>
 ))}
 </div>
 </div>
 )
}
