/** Single source of truth for product identity.
 *  Official Product Name: NegoLinks Education Management ERP
 *  Organization: Nego Links Systems Ltd (brand: NegoLinks)
 */
export const BRAND = {
  /** Brand / wordmark */
  name: 'NegoLinks',
  /** Official product name */
  product: 'NegoLinks Education Management ERP',
  /** Short product name */
  productShort: 'NegoLinks Education ERP',
  /** Application name (in-app / browser tab) */
  app: 'Education ERP',
  /** Legal owner */
  company: 'Nego Links Systems Ltd',
} as const;

export const copyrightLine = () =>
  `${BRAND.product} — © ${new Date().getFullYear()} ${BRAND.company}`;
