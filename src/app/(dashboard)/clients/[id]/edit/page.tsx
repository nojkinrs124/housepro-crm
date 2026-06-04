import { redirect } from 'next/navigation'

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/contacts/${id}/edit`)
}
