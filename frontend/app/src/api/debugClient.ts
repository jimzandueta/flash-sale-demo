import type { ObservabilitySnapshot, ProcessWorkerResponse } from '../types';

export async function fetchObservabilitySnapshot(input: {
  userToken?: string;
  page: string;
  cartCount: number;
  purchaseCount: number;
  activeSaleCount: number;
  userLabel: string;
}) {
  const params = new URLSearchParams({
    page: input.page,
    cartCount: String(input.cartCount),
    purchaseCount: String(input.purchaseCount),
    activeSaleCount: String(input.activeSaleCount),
    userLabel: input.userLabel
  });

  if (input.userToken) {
    params.set('userToken', input.userToken);
  }

  const response = await fetch(`/debug/observability?${params.toString()}`, {
    cache: 'no-store'
  });
  return (await response.json()) as ObservabilitySnapshot;
}

export async function processWorkerNow() {
  const response = await fetch('/debug/process-worker', { method: 'POST' });
  return (await response.json()) as ProcessWorkerResponse;
}
