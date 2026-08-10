/**
 * NegoLinks School Management ERP — Brand & Identity Constants
 * Product: NegoLinks School Management ERP  |  Slug: school
 * URL: school.negolinks.com
 * Publisher: Nego Links Systems Ltd (NegoLinks)
 */
export const BRAND = {
  /** Brand / wordmark (always shown in gold) */
  name: 'NegoLinks',
  /** Full product name */
  product: 'NegoLinks School Management ERP',
  /** Short name — used as subtitle and in browser tab */
  productShort: 'School Management ERP',
  /** Application label used in headings and tabs */
  app: 'School Management ERP',
  /** Legal owner */
  company: 'Nego Links Systems Ltd',
  /** Suite footer text */
  suite: 'NegoLinks Enterprise Suite',
  /** Contact */
  contact: { phone: ['+2348063337624', '+2349067761126'], email: 'info@negolinks.com', web: 'www.negolinks.com' },
  /** School ERP accent palette */
  accent: {
    primary: '#6366F1',
    light:   '#818CF8',
    deep:    '#4338CA',
    glow:    'rgba(99,102,241,0.15)',
    border:  'rgba(99,102,241,0.30)',
  },
  /** Chart palette — Corporate/Academic category */
  charts: ['#6366F1', '#818CF8', '#4338CA', '#22C55E', '#F59E0B', '#3B82F6'],
} as const;

export const browserTitle = (orgName?: string) =>
  orgName ? `${orgName} | ${BRAND.productShort}` : `NegoLinks | ${BRAND.productShort}`;

export const footerText = () =>
  `© ${new Date().getFullYear()} ${BRAND.company}. All rights reserved.`;
