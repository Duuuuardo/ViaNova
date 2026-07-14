import Stripe from 'stripe'

// Lazy init (padrão validado no legado): a API sobe sem STRIPE_SECRET_KEY em
// dev — rotas de billing que dependem do Stripe respondem 503.
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' })
}
