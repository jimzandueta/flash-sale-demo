export function createSqsClient() {
  return {
    endpoint: process.env.SQS_ENDPOINT ?? 'http://localhost:4566'
  };
}