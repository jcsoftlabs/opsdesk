// Grille tarifaire de référence — IMPLEMENTATION.md §4.1.
// Source unique de vérité pour le script de seed ET les tests du moteur de calcul :
// toute modification de la grille doit passer par ici pour rester couverte par les tests.
import type { PricingRuleInput } from "./pricing";

export const PRICING_GRID: PricingRuleInput[] = [
  {
    channel: "ZELLE",
    payoutCurrency: "USD",
    allowed: true,
    feePercent: "10.00",
    exchangeRate: null,
    feeBeforeConversion: true,
  },
  {
    channel: "ZELLE",
    payoutCurrency: "HTG",
    allowed: true,
    feePercent: "10.00",
    exchangeRate: "133.0000",
    feeBeforeConversion: true,
  },
  {
    channel: "CASHAPP",
    payoutCurrency: "USD",
    allowed: true,
    feePercent: "15.00",
    exchangeRate: null,
    feeBeforeConversion: true,
  },
  {
    channel: "CASHAPP",
    payoutCurrency: "HTG",
    allowed: true,
    feePercent: "15.00",
    exchangeRate: "133.0000",
    feeBeforeConversion: true,
  },
  {
    channel: "DEPOSIT_USD",
    payoutCurrency: "USD",
    allowed: true,
    feePercent: "10.00",
    exchangeRate: null,
    feeBeforeConversion: true,
  },
  {
    channel: "DEPOSIT_USD",
    payoutCurrency: "HTG",
    allowed: true,
    feePercent: "0.00",
    exchangeRate: "130.0000",
    feeBeforeConversion: true,
  },
  {
    channel: "TRANSFER_HTG",
    payoutCurrency: "HTG",
    allowed: true,
    feePercent: "2.00",
    exchangeRate: null,
    feeBeforeConversion: true,
  },
  {
    channel: "TRANSFER_HTG",
    payoutCurrency: "USD",
    allowed: false,
    feePercent: "0.00",
    exchangeRate: null,
    feeBeforeConversion: true,
  },
];
