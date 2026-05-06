const STOREFRONT_ITEM_PRICES: Record<string, number> = {
  'Bookipi Cap': 42,
  'Founder Tee': 48,
  'Bookipi Tote': 36,
  'Bookipi Hoodie': 64,
  'Bookipi Poster': 18,
  'Limited Sneaker': 88,
  'Track Jacket': 72,
  'Collector Cap': 38,
  'Retro Watch': 120,
  'Weekend Duffel': 96
};

export function priceForItem(itemName: string) {
  return STOREFRONT_ITEM_PRICES[itemName] ?? 0;
}

export function storefrontPrice(itemName: string, livePrice?: number) {
  return livePrice ?? STOREFRONT_ITEM_PRICES[itemName] ?? null;
}

export function formatUsd(value: number) {
  return `$${value}`;
}
