'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContractSchema } from '@/lib/schemas'
import { requireOrgId } from '@/lib/org'
import { writeAuditLog } from '@/lib/audit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createContractAction(_prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const parsed = ContractSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  const { data: contract, error } = await supabase
    .from('contracts')
    .insert({ ...parsed.data, status: 'draft', manager_id: user.id, organization_id: orgId })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/contracts')
  revalidatePath('/analytics', 'page')
  redirect(`/contracts/${contract.id}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateContractAction(id: string, _prevState: any, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const parsed = ContractSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, fields: parsed.error.flatten().fieldErrors }
  }

  // Сохраняем текущую версию перед обновлением
  const { data: current } = await supabase
    .from('contracts').select('*').eq('id', id).single()

  if (current) {
    const { data: versions } = await supabase
      .from('contract_versions')
      .select('version')
      .eq('contract_id', id)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = versions?.[0]?.version ? versions[0].version + 1 : 1

    await supabase.from('contract_versions').insert({
      contract_id:     id,
      organization_id: orgId,
      version:         nextVersion,
      version_data:    current,
      created_by:      user.id,
    })
  }

  const { error } = await supabase.from('contracts').update(parsed.data).eq('id', id)
  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'update', entityType: 'contract',
    entityId: id, entityLabel: (current as any)?.number ?? 'Договор',
  })

  revalidatePath('/contracts')
  revalidatePath('/analytics', 'page')
  revalidatePath(`/contracts/${id}`)
  redirect(`/contracts/${id}`)
}

export async function deleteContractAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await requireOrgId().catch(() => null)

  const { data: userRole } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  if (userRole?.role !== 'admin') {
    return { error: 'Только администраторы могут удалять договоры' }
  }

  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) return { error: error.message }

  if (orgId) {
    await writeAuditLog({
      userId: user.id, orgId,
      action: 'delete', entityType: 'contract',
      entityId: id, entityLabel: 'Договор',
    })
  }

  revalidatePath('/contracts')
  revalidatePath('/analytics', 'page')
  redirect('/contracts')
}

export async function updateContractStatusAction(id: string, status: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const valid = ['draft', 'generated', 'signed', 'completed', 'cancelled']
  if (!valid.includes(status)) return { error: 'Недопустимый статус' }

  const { error } = await supabase.from('contracts').update({ status }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/contracts')
  revalidatePath('/analytics', 'page')
  revalidatePath(`/contracts/${id}`)
  return { success: true }
}

export async function restoreContractVersionAction(contractId: string, versionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Не авторизован' }

  const orgId = await requireOrgId().catch(() => null)
  if (!orgId) return { error: 'Организация не найдена' }

  const { data: version } = await supabase
    .from('contract_versions')
    .select('version_data, version')
    .eq('id', versionId)
    .eq('contract_id', contractId)
    .single()

  if (!version?.version_data) return { error: 'Версия не найдена или не содержит данных' }

  // Сохранить текущую перед восстановлением
  const { data: current } = await supabase
    .from('contracts').select('*').eq('id', contractId).single()

  if (current) {
    const { data: versions } = await supabase
      .from('contract_versions')
      .select('version')
      .eq('contract_id', contractId)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = versions?.[0]?.version ? versions[0].version + 1 : 1
    await supabase.from('contract_versions').insert({
      contract_id: contractId, organization_id: orgId,
      version: nextVersion, version_data: current,
      created_by: user.id,
      note: `Автосохранение перед восстановлением версии ${version.version}`,
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { id: _id, created_at: _ca, updated_at: _ua, organization_id: _oid, ...restoreData } = version.version_data as any

  const { error } = await supabase
    .from('contracts')
    .update({ ...restoreData, updated_at: new Date().toISOString() })
    .eq('id', contractId)

  if (error) return { error: error.message }

  await writeAuditLog({
    userId: user.id, orgId,
    action: 'update', entityType: 'contract',
    entityId: contractId, entityLabel: 'Восстановление версии',
  })

  revalidatePath(`/contracts/${contractId}`)
  return { success: true }
}
