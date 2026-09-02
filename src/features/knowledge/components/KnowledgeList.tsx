'use client'

import Link from 'next/link'
import { BookOpen, EyeOff } from 'lucide-react'
import { RegistryToolbar } from '@/components/layout/RegistryToolbar'
import { useRegistryFilters } from '@/hooks/useRegistryFilters'
import { formatDateCompact } from '@/lib/utils'

export interface ArticleRow {
  id: string
  slug: string
  title: string
  category: string
  summary: string | null
  isPublished: boolean
  updatedAt: string | null
}

/**
 * Статьи сгруппированы по рубрикам, а не выведены плоским реестром: базу
 * знаний читают, а не фильтруют по колонкам, и человеку важнее «где про
 * деньги», чем сортировка по дате.
 */
export function KnowledgeList({ articles, canEdit }: { articles: ArticleRow[]; canEdit: boolean }) {
  const categories = [...new Set(articles.map(a => a.category))].sort()

  const { search, setSearch, filtered, toolbarFilters, reset } = useRegistryFilters(articles, {
    storageKey: 'knowledge',
    haystack: a => [a.title, a.summary, a.category].filter(Boolean).join(' '),
    filters: [{
      key: 'category',
      options: [{ value: 'all', label: 'Рубрика: все' }, ...categories.map(c => ({ value: c, label: c }))],
      field: a => a.category,
    }],
  })

  const grouped = categories
    .map(category => ({ category, items: filtered.filter(a => a.category === category) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="space-y-4">
      <RegistryToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по инструкциям"
        filters={toolbarFilters}
        onReset={reset}
        foundLabel={<>Найдено: <span className="font-semibold text-[var(--hp-ink)]">{filtered.length}</span> из {articles.length}</>}
      />

      {grouped.length === 0 ? (
        <div className="hp-card hp-empty">
          <p className="text-[var(--hp-sub)] text-sm">Ничего не найдено по запросу</p>
        </div>
      ) : (
        grouped.map(group => (
          <div key={group.category} className="hp-block">
            <div className="hp-block-header">{group.category}</div>
            {group.items
              .sort((a, b) => a.title.localeCompare(b.title))
              .map(article => (
                <Link key={article.id} href={`/knowledge/${article.slug}`} className="hp-block-item">
                  <BookOpen className="w-4 h-4 shrink-0 text-[var(--hp-sub)]" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-semibold text-[var(--hp-ink)]">{article.title}</span>
                    {article.summary && (
                      <span className="block truncate text-[11.5px] text-[var(--hp-sub)]">{article.summary}</span>
                    )}
                  </span>
                  {!article.isPublished && canEdit && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11.5px] text-[var(--hp-warn)]">
                      <EyeOff className="w-3 h-3" />
                      черновик
                    </span>
                  )}
                  <span className="shrink-0 text-[11.5px] text-[var(--hp-tertiary)]">
                    {formatDateCompact(article.updatedAt)}
                  </span>
                </Link>
              ))}
          </div>
        ))
      )}
    </div>
  )
}
