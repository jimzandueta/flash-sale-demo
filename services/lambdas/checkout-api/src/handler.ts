export async function checkoutReservation(input: {
  reservationId: string;
  userToken: string;
  simulateFailure: boolean;
}) {
  console.log('[checkout] input', input);

  if (input.simulateFailure) {
    return {
      status: 'PAYMENT_FAILED',
      reservationId: input.reservationId
    };
  }

  return {
    status: 'PURCHASED',
    reservationId: input.reservationId,
    purchasedAt: new Date().toISOString()
  };
}