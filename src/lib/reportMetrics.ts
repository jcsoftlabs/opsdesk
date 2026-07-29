import Decimal from "decimal.js";
import type { Channel, Currency } from "@/lib/pricing";

export interface ReportTransaction {
  channel: Channel;
  receivedCurrency: Currency;
  payoutCurrency: Currency;
  amountReceived: Decimal;
  feeAmount: Decimal;
  netPayout: Decimal;
  exchangeRateApplied: Decimal | null;
  status: string;
}

export interface VolumeRow {
  channel: Channel;
  currency: Currency;
  amountReceived: Decimal;
  netPayout: Decimal;
  count: number;
}

export interface ReportMetrics {
  volumeByChannel: VolumeRow[];
  totalFeesByCurrency: { currency: Currency; total: Decimal }[];
  exchangeMarginHtg: Decimal | null;
  transactionCount: number;
}

/**
 * Marge de change (§7.8) : différence entre le taux appliqué au client et le
 * taux de référence marché, sur le montant effectivement converti. Le calcul
 * suppose feeBeforeConversion = true (règle confirmée par le client pour
 * toutes les combinaisons en gourdes) : le montant converti = amountReceived − feeAmount.
 */
export function computeReportMetrics(
  transactions: ReportTransaction[],
  referenceRate: Decimal | null,
): ReportMetrics {
  const paid = transactions.filter((t) => t.status !== "CANCELLED");

  const volumeMap = new Map<string, VolumeRow>();
  for (const t of paid) {
    const key = `${t.channel}:${t.receivedCurrency}`;
    const existing = volumeMap.get(key);
    if (existing) {
      existing.amountReceived = existing.amountReceived.plus(t.amountReceived);
      existing.netPayout = existing.netPayout.plus(t.payoutCurrency === t.receivedCurrency ? t.netPayout : 0);
      existing.count += 1;
    } else {
      volumeMap.set(key, {
        channel: t.channel,
        currency: t.receivedCurrency,
        amountReceived: t.amountReceived,
        netPayout: t.payoutCurrency === t.receivedCurrency ? t.netPayout : new Decimal(0),
        count: 1,
      });
    }
  }

  const feesByCurrency = new Map<Currency, Decimal>();
  for (const t of paid) {
    feesByCurrency.set(t.receivedCurrency, (feesByCurrency.get(t.receivedCurrency) ?? new Decimal(0)).plus(t.feeAmount));
  }

  let exchangeMarginHtg: Decimal | null = null;
  if (referenceRate) {
    exchangeMarginHtg = new Decimal(0);
    for (const t of paid) {
      if (!t.exchangeRateApplied) continue;
      const convertedAmount = t.amountReceived.minus(t.feeAmount);
      const marginPerUnit = referenceRate.minus(t.exchangeRateApplied);
      exchangeMarginHtg = exchangeMarginHtg.plus(convertedAmount.times(marginPerUnit));
    }
  }

  return {
    volumeByChannel: Array.from(volumeMap.values()),
    totalFeesByCurrency: Array.from(feesByCurrency.entries()).map(([currency, total]) => ({ currency, total })),
    exchangeMarginHtg,
    transactionCount: paid.length,
  };
}
