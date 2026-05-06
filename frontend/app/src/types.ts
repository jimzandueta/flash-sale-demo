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
  state?: 'active' | 'expired';
};

export type PurchaseSummary = {
  reservationId: string;
  saleId: string;
  itemName: string;
  price?: number;
  purchasedAt: string;
  expiresAt: string;
};

export type HeaderStep = {
  label: string;
  state: 'default' | 'active' | 'complete';
};

export type HeaderChip = {
  label: string;
  value: string;
  subtle?: string;
};

export type HeaderContent = {
  eyebrow: string;
  headline: string;
  supportingCopy?: string;
  steps?: HeaderStep[];
  chip?: HeaderChip;
};

export type DeveloperDockSource = 'frontend' | 'redis' | 'sqs' | 'worker' | 'dynamodb';

export type DeveloperDockEvent = {
  time: string;
  source: DeveloperDockSource;
  action: string;
  effect: string;
};

export type ObservabilitySnapshot = {
  generatedAt: string;
  workerMode: 'manual' | 'heartbeat';
  shopper: {
    userToken?: string;
    displayName?: string;
  };
  app: {
    page: string;
    cartCount: number;
    purchaseCount: number;
    activeSaleCount: number;
    userLabel: string;
    userSessionLabel?: string;
    pendingSqsCount: number | null;
  };
  pipeline: Array<{
    stage: 'shopper' | 'redis' | 'sqs' | 'worker' | 'dynamodb';
    status: 'idle' | 'active' | 'waiting' | 'complete' | 'warning' | 'unavailable';
    title: string;
    summary: string;
    details?: string[];
  }>;
  redis: {
    status: 'ok' | 'warning' | 'unavailable';
    stockBySale: Array<{ saleId: string; stock: number | null }>;
    userReservationIds: string[];
    reservations: Array<{
      reservationId: string;
      saleId: string;
      userToken: string;
      status: string;
      expiresAt: string;
    }>;
    expiryQueues: Array<{ saleId: string; size: number }>;
  };
  sqs: {
    status: 'ok' | 'warning' | 'unavailable';
    queues: Array<{
      type: 'reservation' | 'purchase' | 'expiry';
      queueUrl: string;
      visibleMessages: number | null;
      inFlightMessages: number | null;
    }>;
  };
  dynamodb: {
    status: 'ok' | 'warning' | 'unavailable';
    tableName: string;
    shopperRecords: Array<{
      reservationId: string;
      saleId: string;
      userToken: string;
      status: string;
      expiresAt?: string;
      purchasedAt?: string;
      updatedAt?: string;
      reservationEventId?: string;
      purchaseEventId?: string;
      expiryEventId?: string;
    }>;
  };
  manualWorker: {
    lastRunAt?: string;
    lastResult?: {
      reservation: number;
      purchase: number;
      expiry: number;
    };
    lastError?: string;
  };
};

export type ProcessWorkerResponse = {
  processed: {
    reservation: number;
    purchase: number;
    expiry: number;
  };
  processedAt: string;
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
