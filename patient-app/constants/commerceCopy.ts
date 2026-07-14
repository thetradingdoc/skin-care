/**
 * TOUCH-083 — Commerce microcopy matrix (Screens 17 / 18 / 19).
 * No fake stats. Payment stays on Shopify.
 */
export const COMMERCE_COPY = {
  handoffTitle: 'Opening secure checkout…',
  handoffBody: 'Payment happens on trytouche.com. We never collect card details in the app.',
  handoffNoFields: 'No payment fields here.',
  confirmTitle: 'Order received',
  confirmBody: 'We’re matching your purchase to your shelf.',
  confirmShelfAdded: 'Added to your shelf.',
  confirmNoConflicts: 'No conflicts with your current lineup.',
  confirmHasConflicts: 'We found lineup notes — review them on verdict.',
  confirmRefunds: 'Refunds and shipping stay on Shopify.',
  shopBrowseHint: 'Contextual picks — open only from Reveal, Alerts, or Profile.',
  memberBanner: 'Member pricing unlocked on checkout.',
  nonMemberBanner: 'Journal is free. Shop when you want member-priced products.',
} as const;
