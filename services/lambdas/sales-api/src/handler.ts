import { listSeedSales } from '../../shared/src/repositories/SalesRepository';

export async function listSales() {
  return { items: listSeedSales() };
}