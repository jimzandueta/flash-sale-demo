export type Page =
  | 'landing'
  | 'product-list'
  | 'product-page'
  | 'checkout'
  | 'confirmation';

export type Notice = {
  tone: 'neutral' | 'success' | 'warning';
  text: string;
};

export type CartReservation = {
  reservationId: string;
  saleId: string;
  itemName: string;
  price?: number;
  expiresAt: string;
  remainingStock?: number;
};

export type PurchaseSummary = {
  reservationId: string;
  saleId: string;
  itemName: string;
  price?: number;
  purchasedAt: string;
  expiresAt: string;
};

export const flow: Page[] = [
  'landing',
  'product-list',
  'checkout'
];

export const pageLabels: Record<Page, string> = {
  landing: 'Landing',
  'product-list': 'Products',
  'product-page': 'Product Page',
  checkout: 'Checkout',
  confirmation: 'Confirmation'
};
