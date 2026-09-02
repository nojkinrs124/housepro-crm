import type { createClient } from '@/lib/supabase/server'

type Client = Awaited<ReturnType<typeof createClient>>

export type BulkPatch = Record<string, string | boolean | null>
export type BulkRow = { id: string } & Record<string, unknown>

interface Filtered<T> { in(column: string, values: string[]): Filtered<T>; eq(column: string, value: string): PromiseLike<T> }
interface BulkQuery {
  select(columns: string): Filtered<{ data: BulkRow[] | null; error: { message: string } | null }>
  update(patch: BulkPatch): Filtered<{ error: { message: string } | null }>
  delete(): Filtered<{ error: { message: string } | null }>
}

/**
 * Узкий фасад над supabase.from() для групповых операций.
 *
 * Имя таблицы здесь известно только в рантайме — приходит из REGISTRIES, — и
 * сгенерированные типы схемы к нему неприменимы: на union из десяти таблиц
 * TypeScript сводит тип patch к never. Все таблицы реестров имеют id и
 * organization_id, а состав правки проверяет вызывающий экшен по своей карте
 * колонок, так что этого интерфейса достаточно.
 */
export function bulkTable(supabase: Client, table: string): BulkQuery {
  return (supabase as unknown as { from(t: string): BulkQuery }).from(table)
}
