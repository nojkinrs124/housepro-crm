import type { Database } from '@/types/supabase'

type Tables = Database['public']['Tables']

export type MeterRowDb = Tables['utility_meters']['Row']
export type MeterInsertDb = Tables['utility_meters']['Insert']
export type MeterUpdateDb = Tables['utility_meters']['Update']
export type ReadingRowDb = Tables['meter_readings']['Row']
export type ReadingInsertDb = Tables['meter_readings']['Insert']

export type MeterInsert = MeterInsertDb
export type MeterUpdate = MeterUpdateDb
export type ReadingInsert = ReadingInsertDb
export type ReadingRowWithExtras = ReadingRowDb
export type MeterRowWithExtras = MeterRowDb
