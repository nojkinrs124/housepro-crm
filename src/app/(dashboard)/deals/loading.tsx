export default function DealsLoading() {
  const columns = ['Новые', 'Показ', 'Переговоры', 'Договор', 'Оплата', 'Завершено']

  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-gray-200 rounded-xl" />
          <div className="h-4 w-48 bg-gray-100 rounded-lg" />
        </div>
        <div className="h-10 w-36 bg-gray-200 rounded-xl" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-[20px] p-4 shadow-sm border border-gray-100 space-y-2">
            <div className="h-3 w-20 bg-gray-200 rounded" />
            <div className="h-7 w-28 bg-gray-200 rounded-lg" />
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
                <div className="h-4 w-24 bg-gray-200 rounded" />
                <div className="h-5 w-6 bg-gray-100 rounded-full" />
              </div>
              <div className="h-4 w-16 bg-gray-100 rounded" />
            </div>

            {/* Cards */}
            <div className="space-y-3">
              {Array.from({ length: col === 'Новые' ? 3 : col === 'Переговоры' ? 2 : 1 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-[16px] p-4 shadow-sm border border-gray-100 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-5 w-6 bg-gray-200 rounded" />
                    <div className="h-5 w-16 bg-gray-100 rounded-full" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-4 w-full bg-gray-200 rounded" />
                    <div className="h-3 w-3/4 bg-gray-100 rounded" />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-6 w-6 bg-gray-200 rounded-full" />
                    <div className="h-3 w-20 bg-gray-100 rounded" />
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
