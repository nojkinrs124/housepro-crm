import { redirect } from 'next/navigation'
export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Legacy payment IDs: look up the migrated transaction
  redirect(`/accounting`)
  // Note: legacy_payment_id link would need a lookup — redirect to list as fallback
  void id
}
