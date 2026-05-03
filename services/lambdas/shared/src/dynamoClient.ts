export function createDynamoClient() {
  return {
    tableName: process.env.RESERVATIONS_TABLE ?? 'flash-sale-reservations'
  };
}