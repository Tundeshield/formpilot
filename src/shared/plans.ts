// Single source of truth for plans: used by the API (limits) and the landing page (pricing).
export type PlanId = 'free' | 'pro';

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyUsd: number;
  yearlyUsd: number; // billed annually
  aiAnswers: number; // AI-written answers per month (profile-filled fields are always free)
  imports: number; // CV/document imports per month
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free', name: 'Free', tagline: 'For the occasional form.', monthlyUsd: 0, yearlyUsd: 0,
    aiAnswers: 30, imports: 2,
    features: ['30 AI-written answers a month', 'Unlimited profile fills (name, email, links…)', '2 CV imports a month', 'Review, edit and approve every answer'],
  },
  pro: {
    id: 'pro', name: 'Pro', tagline: 'For job hunts, applications and busy weeks.', monthlyUsd: 9, yearlyUsd: 79,
    aiAnswers: 1000, imports: 30,
    features: ['1,000 AI-written answers a month', 'Unlimited profile fills', '30 CV & document imports a month', 'Regenerate with tone controls', 'Priority support'],
  },
};
