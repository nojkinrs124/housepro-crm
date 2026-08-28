export default function AnalyticsLoading() {
 return (
 <div className="space-y-6 animate-pulse">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="space-y-2">
 <div className="h-7 w-40 bg-gray-200" />
 <div className="h-4 w-56 bg-gray-100" />
 </div>
 <div className="h-10 w-48 bg-gray-200" />
 </div>

 {/* KPI cards */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="bg-white p-5 shadow-sm border border-gray-100 space-y-3">
 <div className="h-4 w-28 bg-gray-200" />
 <div className="h-9 w-36 bg-gray-200" />
 <div className="h-3 w-20 bg-gray-100" />
 </div>
 ))}
 </div>

 {/* Main charts row */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* Bar chart placeholder */}
 <div className="bg-white p-6 shadow-sm border border-gray-100 space-y-4">
 <div className="h-5 w-44 bg-gray-200" />
 <div className="h-[220px] flex items-end gap-3 pt-4">
 {Array.from({ length: 6 }).map((_, i) => (
 <div key={i} className="flex-1 flex flex-col justify-end gap-1">
 <div
 className="bg-gray-200"
 style={{ height: `${40 + (i % 3) * 40 + (i % 2) * 30}px` }}
 />
 </div>
 ))}
 </div>
 <div className="flex justify-between">
 {Array.from({ length: 6 }).map((_, i) => (
 <div key={i} className="h-3 w-8 bg-gray-100" />
 ))}
 </div>
 </div>

 {/* Pie chart placeholder */}
 <div className="bg-white p-6 shadow-sm border border-gray-100 space-y-4">
 <div className="h-5 w-36 bg-gray-200" />
 <div className="flex items-center gap-8">
 <div className="w-40 h-40 bg-gray-200 rounded-full shrink-0" />
 <div className="flex-1 space-y-3">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="flex items-center gap-3">
 <div className="w-3 h-3 rounded-full bg-gray-200 shrink-0" />
 <div className="h-3 flex-1 bg-gray-100" />
 <div className="h-3 w-10 bg-gray-200" />
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>

 {/* Bottom row */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {Array.from({ length: 3 }).map((_, i) => (
 <div key={i} className="bg-white p-6 shadow-sm border border-gray-100 space-y-4">
 <div className="h-5 w-32 bg-gray-200" />
 <div className="h-[140px] bg-gray-100" />
 </div>
 ))}
 </div>
 </div>
 )
}
