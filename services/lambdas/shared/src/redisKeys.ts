export const redisKeys = {
  stock: (saleId: string) => `sale:${saleId}:stock`,
  saleUser: (saleId: string, userToken: string) => `sale:${saleId}:user:${userToken}`,
  userReservations: (userToken: string) => `user:${userToken}:reservations`,
  reservation: (reservationId: string) => `reservation:${reservationId}`,
  expiries: (saleId: string) => `sale:${saleId}:expiries`,
  reservationIdempotency: (saleId: string, userToken: string, idempotencyKey: string) =>
    `sale:${saleId}:user:${userToken}:idempotency:${idempotencyKey}`
};