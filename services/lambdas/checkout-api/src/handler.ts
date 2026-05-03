import { publishEvent } from '../../shared/src/events/publishEvent';

export async function checkoutReservation(input: {
  reservationId: string;
  userToken: string;
  simulateFailure: boolean;
}) {
  console.log('[checkout] input', input);

  if (input.simulateFailure) {
    await publishEvent('payment-failed', {
      reservationId: input.reservationId,
      userToken: input.userToken,
      status: 'PAYMENT_FAILED'
    });

    return {
      status: 'PAYMENT_FAILED',
      reservationId: input.reservationId
    };
  }

  const purchasedAt = new Date().toISOString();

  await publishEvent('purchase-completed', {
    reservationId: input.reservationId,
    userToken: input.userToken,
    status: 'PURCHASED',
    purchasedAt
  });

  return {
    status: 'PURCHASED',
    reservationId: input.reservationId,
    purchasedAt
  };
}