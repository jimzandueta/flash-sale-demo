import { listSeedSales } from '../../shared/src/repositories/SalesRepository';

type ListSalesOptions = {
  getRemainingStock?: (saleId: string) => Promise<number | undefined>;
};

export async function listSales(options: ListSalesOptions = {}) {
  const items = await Promise.all(
    listSeedSales().map(async (sale) => {
      const remainingStock = await options.getRemainingStock?.(sale.saleId);

      return remainingStock === undefined ? sale : { ...sale, remainingStock };
    })
  );

  return { items };
}
