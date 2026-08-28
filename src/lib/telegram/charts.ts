// Настоящие графики с реальными цифрами — через QuickChart.io (бесплатный публичный
// рендер Chart.js в PNG по URL, без ключа и без своего canvas-сервера на Vercel).
// Это осознанно ОТДЕЛЬНО от generateChannelImage() в channel-generate.ts — та рисует
// иллюстративные картинки БЕЗ цифр моделью (см. комментарий там), а тут наоборот:
// никакого ИИ, только числа из БД, отрисованные детерминированно — то, что модели рисовать
// нельзя доверять (см. SYSTEM_PROMPT в webhook/route.ts, пункт про "не умеет графики с цифрами").

const QUICKCHART_BASE = 'https://quickchart.io/chart'

function encodeChartConfig(config: Record<string, unknown>): string {
  // QuickChart принимает конфиг Chart.js как JSON в query-параметре `c`.
  return `${QUICKCHART_BASE}?width=700&height=420&backgroundColor=white&c=${encodeURIComponent(JSON.stringify(config))}`
}

/** Столбчатый график доход/расход/прибыль по периодам (например, по месяцам). */
export function buildFinanceChartUrl(labels: string[], income: number[], expense: number[]): string {
  const profit = income.map((v, i) => v - (expense[i] ?? 0))
  return encodeChartConfig({
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Доход', backgroundColor: '#4B6B46', data: income },
        { label: 'Расход', backgroundColor: '#A24B30', data: expense },
        { label: 'Прибыль', type: 'line', borderColor: '#41546B', backgroundColor: '#41546B', data: profit, fill: false },
      ],
    },
    options: {
      plugins: { title: { display: true, text: 'Финансы' } },
      scales: { y: { ticks: { callback: 'function(v){ return v.toLocaleString("ru-RU") + " ₽" }' } } },
    },
  })
}

/** Воронка сделок — количество сделок на каждом этапе пайплайна. */
export function buildDealsFunnelChartUrl(stageLabels: string[], counts: number[]): string {
  return encodeChartConfig({
    type: 'bar',
    data: {
      labels: stageLabels,
      datasets: [{ label: 'Сделок', backgroundColor: '#4B6B46', data: counts }],
    },
    options: {
      indexAxis: 'y',
      plugins: { title: { display: true, text: 'Воронка сделок' }, legend: { display: false } },
    },
  })
}
