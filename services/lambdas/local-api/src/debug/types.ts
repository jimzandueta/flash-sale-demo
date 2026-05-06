export type ObservabilityStage = 'shopper' | 'redis' | 'sqs' | 'worker' | 'dynamodb';
export type ObservabilityStatus = 'idle' | 'active' | 'waiting' | 'complete' | 'warning' | 'unavailable';
export type SubsystemStatus = 'ok' | 'warning' | 'unavailable';

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
    pendingSqsCount: number | null;
  };
  pipeline: Array<{
    stage: ObservabilityStage;
    status: ObservabilityStatus;
    title: string;
    summary: string;
    details?: string[];
  }>;
  redis: {
    status: SubsystemStatus;
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
    status: SubsystemStatus;
    queues: Array<{
      type: 'reservation' | 'purchase' | 'expiry';
      queueUrl: string;
      visibleMessages: number | null;
      inFlightMessages: number | null;
    }>;
  };
  dynamodb: {
    status: SubsystemStatus;
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
