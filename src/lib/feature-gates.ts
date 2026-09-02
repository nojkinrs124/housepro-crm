const PLAN_LIMITS = {
  free: {
    max_users:      1,
    max_properties: 20,
    max_contracts:  10,
    api_access:     false,
    webhooks:       false,
  },
  pro: {
    max_users:      10,
    max_properties: Infinity,
    max_contracts:  Infinity,
    api_access:     true,
    webhooks:       false,
  },
  enterprise: {
    max_users:      Infinity,
    max_properties: Infinity,
    max_contracts:  Infinity,
    api_access:     true,
    webhooks:       true,
  },
} as const

type Plan = keyof typeof PLAN_LIMITS

export function getFeatureGate(plan: string) {
  return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.free
}

export const PLAN_LABELS: Record<Plan, string> = {
  free:       'Бесплатный',
  pro:        'Pro',
  enterprise: 'Enterprise',
}

export const PLAN_PRICES: Record<Plan, { monthly: number; annual: number }> = {
  free:       { monthly: 0,     annual: 0 },
  pro:        { monthly: 2990,  annual: 24990 },
  enterprise: { monthly: 9990,  annual: 89990 },
}
