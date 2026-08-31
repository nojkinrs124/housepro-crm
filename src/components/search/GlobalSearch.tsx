'use client'

import { useEffect, useRef, useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, Home, FileText, CheckSquare, ArrowRight, Loader2, X } from 'lucide-react'
import { searchAction } from '@/features/search/actions/search.actions'
import type { SearchResult, SearchResults } from '@/features/search/actions/search.actions'

// ── Config ────────────────────────────────────────────────────────────────────

const GROUPS: { key: keyof SearchResults; label: string; Icon: React.ElementType; color: string }[] = [
 { key: 'contacts', label: 'Клиенты', Icon: Users, color: 'text-[var(--hp-info)]' },
 { key: 'properties', label: 'Объекты', Icon: Home, color: 'text-[var(--hp-good)]' },
 { key: 'contracts', label: 'Договоры', Icon: FileText, color: 'text-[var(--hp-sub)]' },
 { key: 'tasks', label: 'Задачи', Icon: CheckSquare, color: 'text-[var(--hp-warn)]' },
]

const QUICK_LINKS = [
 { label: 'Новый клиент', href: '/clients/new', Icon: Users, color: 'text-[var(--hp-info)]' },
 { label: 'Новый объект', href: '/properties/new', Icon: Home, color: 'text-[var(--hp-good)]' },
 { label: 'Новый договор', href: '/contracts/new', Icon: FileText, color: 'text-[var(--hp-sub)]' },
 { label: 'Новая задача', href: '/tasks/new', Icon: CheckSquare, color: 'text-[var(--hp-warn)]' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenResults(results: SearchResults | null): SearchResult[] {
 if (!results) return []
 return GROUPS.flatMap(g => results[g.key])
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GlobalSearch() {
 const [open, setOpen] = useState(false)
 const [query, setQuery] = useState('')
 const [results, setResults] = useState<SearchResults | null>(null)
 const [selectedIndex, setSelectedIndex] = useState(0)
 const [isPending, startTransition] = useTransition()
 const inputRef = useRef<HTMLInputElement>(null)
 const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
 const router = useRouter()

 // ── Open / close ─────────────────────────────────────────────────────────

 const close = useCallback(() => {
 setOpen(false)
 setQuery('')
 setResults(null)
 setSelectedIndex(0)
 }, [])

 useEffect(() => {
 function onKey(e: KeyboardEvent) {
 if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 e.preventDefault()
 setOpen(prev => !prev)
 }
 if (e.key === 'Escape') close()
 }
 document.addEventListener('keydown', onKey)
 return () => document.removeEventListener('keydown', onKey)
 }, [close])

 useEffect(() => {
 if (open) setTimeout(() => inputRef.current?.focus(), 50)
 }, [open])

 // ── Search ────────────────────────────────────────────────────────────────

 useEffect(() => {
 clearTimeout(debounceRef.current)
 if (!query.trim() || query.trim().length < 2) {
 setResults(null)
 setSelectedIndex(0)
 return
 }
 debounceRef.current = setTimeout(() => {
 startTransition(async () => {
 const data = await searchAction(query)
 setResults(data)
 setSelectedIndex(0)
 })
 }, 200)
 return () => clearTimeout(debounceRef.current)
 }, [query])

 // ── Keyboard navigation ───────────────────────────────────────────────────

 const flat = flattenResults(results)
 const totalItems = query.trim().length < 2 ? QUICK_LINKS.length : flat.length

 function handleKeyDown(e: React.KeyboardEvent) {
 if (e.key === 'ArrowDown') {
 e.preventDefault()
 setSelectedIndex(i => Math.min(i + 1, totalItems - 1))
 } else if (e.key === 'ArrowUp') {
 e.preventDefault()
 setSelectedIndex(i => Math.max(i - 1, 0))
 } else if (e.key === 'Enter') {
 e.preventDefault()
 if (query.trim().length < 2) {
 const link = QUICK_LINKS[selectedIndex]
 if (link) { close(); router.push(link.href) }
 } else {
 const item = flat[selectedIndex]
 if (item) { close(); router.push(item.href) }
 }
 }
 }

 function navigate(href: string) {
 close()
 router.push(href)
 }

 if (!open) return null

 const showQuickLinks = query.trim().length < 2
 const hasResults = !showQuickLinks && results && flat.length > 0
 const noResults = !showQuickLinks && results && flat.length === 0 && !isPending

 // running index for arrow key highlighting across groups
 let runningIndex = 0

 return (
 <div
 className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
 onClick={(e) => { if (e.target === e.currentTarget) close() }}
 >
 {/* Backdrop */}
 <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

 {/* Modal */}
 <div className="relative w-full max-w-xl hp-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">

 {/* Search input */}
 <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
 {isPending
 ? <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
 : <Search className="w-4 h-4 text-muted-foreground shrink-0" />
 }
 <input
 ref={inputRef}
 value={query}
 onChange={e => setQuery(e.target.value)}
 onKeyDown={handleKeyDown}
 placeholder="Поиск клиентов, объектов, договоров..."
 className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
 />
 {query && (
 <button onClick={() => { setQuery(''); setResults(null) }}
 className="text-muted-foreground hover:text-foreground transition-colors">
 <X className="w-4 h-4" />
 </button>
 )}
 <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-muted-foreground border border-border font-mono">
 Esc
 </kbd>
 </div>

 {/* Results */}
 <div className="max-h-[420px] overflow-y-auto">

 {/* Quick links (when no query) */}
 {showQuickLinks && (
 <div className="p-2">
 <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
 Быстрые действия
 </p>
 {QUICK_LINKS.map((link, i) => {
 const Icon = link.Icon
 const active = selectedIndex === i
 return (
 <button
 key={link.href}
 onClick={() => navigate(link.href)}
 onMouseEnter={() => setSelectedIndex(i)}
 className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${active ? 'bg-accent' : 'hover:bg-accent/50'}`}
 >
 <Icon className={`w-4 h-4 ${link.color}`} />
 <span className="text-foreground">{link.label}</span>
 <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
 </button>
 )
 })}
 </div>
 )}

 {/* Search results grouped */}
 {hasResults && (
 <div className="p-2 space-y-1">
 {GROUPS.map(group => {
 const items = results![group.key]
 if (!items.length) return null
 const GroupIcon = group.Icon
 const groupStart = runningIndex

 return (
 <div key={group.key}>
 <div className="flex items-center gap-2 px-3 py-1.5">
 <GroupIcon className={`w-3.5 h-3.5 ${group.color}`} />
 <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
 {group.label}
 </p>
 </div>
 {items.map((item) => {
 const idx = runningIndex++
 const active = selectedIndex === idx
 return (
 <button
 key={item.id}
 onClick={() => navigate(item.href)}
 onMouseEnter={() => setSelectedIndex(idx)}
 className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${active ? 'bg-accent' : 'hover:bg-accent/50'}`}
 >
 <div className="flex-1 text-left min-w-0">
 <p className="text-foreground font-medium truncate">{item.title}</p>
 {item.subtitle && (
 <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
 )}
 </div>
 <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
 </button>
 )
 })}
 </div>
 )
 // suppress unused var warning
 void groupStart
 })}
 </div>
 )}

 {/* No results */}
 {noResults && (
 <div className="py-12 text-center">
 <p className="text-sm text-muted-foreground">Ничего не найдено по запросу «{query}»</p>
 </div>
 )}

 {/* Loading */}
 {isPending && !results && (
 <div className="py-12 text-center">
 <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mx-auto" />
 </div>
 )}
 </div>

 {/* Footer hint */}
 <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
 <span className="flex items-center gap-1">
 <kbd className="px-1 py-0.5 border border-border font-mono text-[10px]">↑↓</kbd>
 навигация
 </span>
 <span className="flex items-center gap-1">
 <kbd className="px-1 py-0.5 border border-border font-mono text-[10px]">↵</kbd>
 открыть
 </span>
 <span className="flex items-center gap-1">
 <kbd className="px-1 py-0.5 border border-border font-mono text-[10px]">Esc</kbd>
 закрыть
 </span>
 </div>
 </div>
 </div>
 )
}
