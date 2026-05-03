export type SessionResponse = {
  userToken: string;
  displayName: string;
};

export type SaleItem = {
  saleId: string;
  itemName: string;
  status: 'upcoming' | 'active' | 'ended';
  startsAt: string;
  endsAt: string;
  reservationTtlSeconds: number;
};

export type ReservationItem = {
  reservationId: string;
  saleId: string;
  userToken: string;
  status: string;
  expiresAt: string;
};

export type ReservationResponse =
  | {
      status: 'RESERVED';
      reservationId: string;
      expiresAt: string;
      remainingStock: number;
    }
  | {
      status:
        | 'ALREADY_RESERVED'
        | 'SOLD_OUT'
        | 'SALE_NOT_ACTIVE'
        | 'SALE_NOT_FOUND'
        | 'USER_TOKEN_REQUIRED';
    };

export type CheckoutResponse =
  | {
      status: 'PURCHASED';
      reservationId: string;
      purchasedAt: string;
    }
  | {
      status: 'PAYMENT_FAILED';
      reservationId: string;
    };

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export async function createSession(displayName: string) {
  const response = await fetch('/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName })
  });

  return readJson<SessionResponse>(response);
}

export async function listSales() {
  const response = await fetch('/sales');
  return readJson<{ items: SaleItem[] }>(response);
}

export async function listReservations(userToken: string) {
  const response = await fetch('/reservations', {
    headers: { 'x-user-token': userToken }
  });

  return readJson<{ items: ReservationItem[] }>(response);
}

export async function createReservation(saleId: string, userToken: string, idempotencyKey: string) {
  const response = await fetch(`/sales/${saleId}/reservations`, {
    method: 'POST',
    headers: { 'x-user-token': userToken, 'idempotency-key': idempotencyKey }
  });

  return readJson<ReservationResponse>(response);
}

export async function checkoutReservationRequest(
  reservationId: string,
  userToken: string,
  idempotencyKey: string,
  simulateFailure: boolean
) {
  const response = await fetch(`/reservations/${reservationId}/checkout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-token': userToken,
      'idempotency-key': idempotencyKey
    },
    body: JSON.stringify({ simulateFailure })
  });

  return readJson<CheckoutResponse>(response);
}