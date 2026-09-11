/**
 * The occasion designs a customer can pick when buying a gift card. Fixed
 * image assets in public/gift-cards rather than admin-managed rows — the
 * card artwork is print-design work, not something edited from the admin.
 * Only the chosen `slug` is persisted on the gift card, so the delivery
 * email can render the same card the buyer picked.
 */
export interface GiftCardDesign {
  slug: string;
  name: string;
  /** Public path, also resolved under public/ to embed in emails. */
  image: string;
}

export const GIFT_CARD_DESIGNS: GiftCardDesign[] = [
  { slug: "gift", name: "Gift", image: "/gift-cards/gift.jpg" },
  { slug: "happy-birthday", name: "Happy Birthday", image: "/gift-cards/happy-birthday.jpg" },
  { slug: "merry-christmas", name: "Merry Christmas", image: "/gift-cards/merry-christmas.jpg" },
  { slug: "i-love-my-mum", name: "I Love My Mum", image: "/gift-cards/i-love-my-mum.jpg" },
  { slug: "love-you-dad", name: "Love You Dad", image: "/gift-cards/love-you-dad.jpg" },
];

export const DEFAULT_GIFT_CARD_DESIGN = GIFT_CARD_DESIGNS[0];

export function getGiftCardDesign(slug: string | null | undefined): GiftCardDesign {
  return GIFT_CARD_DESIGNS.find((d) => d.slug === slug) ?? DEFAULT_GIFT_CARD_DESIGN;
}

/** Smallest value a gift card can be sold for. */
export const MIN_GIFT_CARD_AMOUNT = 50;
