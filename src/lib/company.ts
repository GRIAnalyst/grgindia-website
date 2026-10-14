// Single source of truth for the company facts that appear on more than one page.
//
// This exists because the site used to carry three different answers at once:
// "27 years" on the channel loyalty page, "20+ years" on the home and contact
// pages, and foundingDate 2008 in the Organization schema on all 100 pages.

/**
 * The date published in the Organization schema and on the About page.
 * Read by search engines, so it is the one that has to stay accurate.
 */
export const FOUNDING_YEAR = 2008;

/**
 * The experience claim as it appears in body copy, on the home, contact and
 * channel loyalty pages.
 *
 * Deliberately a rounded claim rather than a figure derived from
 * FOUNDING_YEAR, and set by the business, not computed here. It counts the
 * rewards business rather than the 2008 GRG India date, so do not "fix" it to
 * match FOUNDING_YEAR. Change it in this one place and all three pages follow.
 */
export const YEARS_CLAIM = '20+ years';
