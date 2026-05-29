'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createContractAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const values: any = {
    contract_type: formData.get('contract_type') as string,
    client_id:     formData.get('client_id')     as string || null,
    owner_id:      formData.get('owner_id')      as string || null,
    property_id:   formData.get('property_id')   as string || null,
    amount:        formData.get('amount')    ? Number(formData.get('amount'))  : null,
    deposit:       formData.get('deposit')   ? Number(formData.get('deposit')) : null,
    start_date:    formData.get('start_date') as string || null,
    end_date:      formData.get('end_date')   as string || null,
    notes:         formData.get('notes')      as string || null,
    status:        'draft',
    manager_id:    user.id,
  }

  const { error } = await supabase.from('contracts').insert(values)
  if (error) return { error: error.message }

  revalidatePath('/contracts')
  redirect('/contracts')
}
