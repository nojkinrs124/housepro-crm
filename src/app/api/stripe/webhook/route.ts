import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Stripe not configured', { status: 503 })
  }

  const body = await request.text()
  const headersList = await headers()
  const sig = headersList.get('stripe-signature')!

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return new Response(`Webhook error: ${err}`, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const orgId = session.metadata?.org_id
      if (orgId && session.customer) {
        await supabase
          .from('organizations')
          .update({ stripe_customer_id: session.customer })
          .eq('id', orgId)
      }
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object
      const plan = sub.items.data[0]?.price?.lookup_key ?? 'pro'
      await supabase
        .from('organizations')
        .update({
          plan,
          subscription_status:    sub.status,
          stripe_subscription_id: sub.id,
          trial_ends_at:          sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : null,
        })
        .eq('stripe_customer_id', sub.customer)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object
      await supabase
        .from('organizations')
        .update({ plan: 'free', subscription_status: 'cancelled', stripe_subscription_id: null })
        .eq('stripe_customer_id', sub.customer)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object
      await supabase
        .from('organizations')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', invoice.customer)
      break
    }
  }

  return new Response('OK')
}
