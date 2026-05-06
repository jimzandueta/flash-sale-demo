export type StorefrontMeta = {
  displayName: string;
  detailName: string;
  blurb: string;
  detailCopy: string;
  gradient: string;
};

const STORE_METADATA: Record<string, StorefrontMeta> = {
  'Founder Tee': {
    displayName: 'Founder Tee',
    detailName: 'KooPiBi Founder Tee',
    blurb: 'Heavyweight tee from the founder collection.',
    detailCopy: 'A more commerce-like detail page with stronger product framing, clearer urgency, and the reserve CTA as the dominant action.',
    gradient: 'linear-gradient(135deg, #8ec5fc 0%, #e0c3fc 100%)'
  },
  'KooPiBi Cap': {
    displayName: 'KooPiBi Cap',
    detailName: 'KooPiBi Cap',
    blurb: 'Embroidered cap in the current drop.',
    detailCopy: 'Fast-moving staple with short hold pressure.',
    gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)'
  },
  'KooPiBi Hoodie': {
    displayName: 'KooPiBi Hoodie',
    detailName: 'KooPiBi Hoodie',
    blurb: 'Midweight fleece hoodie in the next release.',
    detailCopy: 'Second-wave release after the current drop closes.',
    gradient: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)'
  },
  'KooPiBi Tote': {
    displayName: 'KooPiBi Tote',
    detailName: 'KooPiBi Tote',
    blurb: 'Everyday canvas tote with limited stock.',
    detailCopy: 'Short sale window and quick decision item.',
    gradient: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)'
  },
  'KooPiBi Poster': {
    displayName: 'KooPiBi Poster',
    detailName: 'KooPiBi Poster',
    blurb: 'Signed poster from an earlier drop.',
    detailCopy: 'Archive item from an earlier completed window.',
    gradient: 'linear-gradient(135deg, #d4d4d8 0%, #a1a1aa 100%)'
  },
  'Limited Sneaker': {
    displayName: 'Limited Sneaker',
    detailName: 'Limited Sneaker',
    blurb: 'High-demand sneaker with a short live window.',
    detailCopy: 'Fast-moving release with a strong urgency signal and short checkout runway.',
    gradient: 'linear-gradient(135deg, #f9a8d4 0%, #c4b5fd 100%)'
  },
  'Track Jacket': {
    displayName: 'Track Jacket',
    detailName: 'Track Jacket',
    blurb: 'Sport-weight jacket in the active drop.',
    detailCopy: 'Current-window outerwear piece with limited stock and a short decision window.',
    gradient: 'linear-gradient(135deg, #67e8f9 0%, #60a5fa 100%)'
  },
  'Collector Cap': {
    displayName: 'Collector Cap',
    detailName: 'Collector Cap',
    blurb: 'Upcoming cap release queued after the active wave.',
    detailCopy: 'Next release item that opens after the current window closes.',
    gradient: 'linear-gradient(135deg, #fde68a 0%, #fb7185 100%)'
  },
  'Retro Watch': {
    displayName: 'Retro Watch',
    detailName: 'Retro Watch',
    blurb: 'Archive watch from a completed sale window.',
    detailCopy: 'Ended-window piece kept in the catalog as a past drop reference.',
    gradient: 'linear-gradient(135deg, #d8b4fe 0%, #818cf8 100%)'
  },
  'Weekend Duffel': {
    displayName: 'Weekend Duffel',
    detailName: 'Weekend Duffel',
    blurb: 'Spacious duffel bag for short getaways.',
    detailCopy: 'Weekend-ready duffel with room for essentials.',
    gradient: 'linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%)'
  }
};

export function storefrontMeta(itemName: string): StorefrontMeta {
  return STORE_METADATA[itemName] ?? {
    displayName: itemName,
    detailName: itemName,
    blurb: 'Limited-run item from the flash sale.',
    detailCopy: 'Limited-run item from the flash sale.',
    gradient: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)'
  };
}
