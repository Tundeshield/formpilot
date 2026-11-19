// Business details shown on the landing and legal pages. Set these in Netlify env vars.
export const BRAND = {
  name: 'FormPilot',
  legalName: (import.meta.env.VITE_LEGAL_NAME as string) || 'FormPilot',
  supportEmail: (import.meta.env.VITE_SUPPORT_EMAIL as string) || '',
  lastUpdated: '19 November 2026',
};
export const contactLine = () => (BRAND.supportEmail ? BRAND.supportEmail : 'the contact details on our website');
