import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/org'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const { plan, annual } = await request.json() as { plan: string; annual?: boolean }

  const PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
    pro:        {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY    ?? '',
      annual:  process.env.STRIPE_PRICE_PRO_ANNUAL     ?? '',
    },
    enterprise: {
      monthly: process.env.STRIPE_PRICE_ENT_MONTHLY    ?? '',
      annual:  process.env.STRIPE_PRICE_ENT_ANNUAL     ?? '',
    },
  }

  const priceId = PRICE_IDS[plan]?.[annual ? 'annual' : 'monthly']
  if (!priceId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id, name')
    .eq('id', orgId)
    .single()

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer: org?.stripe_customer_id ?? undefined,
    customer_email: org?.stripe_customer_id ? undefined : user.email,
    metadata: { org_id: orgId },
    success_url: `${siteUrl}/settings/billing?success=1`,
    cancel_url:  `${siteUrl}/settings/billing?cancelled=1`,
    subscription_data: {
      metadata: { org_id: orgId },
    },
  })

  return NextResponse.json({ url: session.url })
}
