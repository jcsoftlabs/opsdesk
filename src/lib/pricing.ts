// Moteur de calcul des transferts — module pur, sans accès base de données.
// Référence : IMPLEMENTATION.md §4.3. Toute valeur monétaire est un Decimal, jamais un number.
import Decimal from "decimal.js";

export type Channel = "ZELLE" | "CASHAPP" | "DEPOSIT_USD" | "TRANSFER_HTG";
export type Currency = "USD" | "HTG";

// La devise reçue est déterminée par le canal, jamais choisie librement (§4.1).
export const RECEIVED_CURRENCY_BY_CHANNEL: Record<Channel, Currency> = {
  ZELLE: "USD",
  CASHAPP: "USD",
  DEPOSIT_USD: "USD",
  TRANSFER_HTG: "HTG",
};

// Préfixe de la référence générée par le système (§7.3, confirmé 2026-07-28) :
// le numéro de confirmation réel n'apparaît pas toujours dans les captures
// d'écran (surtout CashApp), donc la référence n'est plus saisie à la main.
export const CHANNEL_REF_PREFIX: Record<Channel, string> = {
  ZELLE: "ZL",
  CASHAPP: "CA",
  DEPOSIT_USD: "DU",
  TRANSFER_HTG: "VH",
};

export interface PricingRuleInput {
  channel: Channel;
  payoutCurrency: Currency;
  allowed: boolean;
  feePercent: Decimal.Value;
  exchangeRate: Decimal.Value | null;
  feeBeforeConversion: boolean;
  /** Unité d'arrondi du montant remis en HTG. Défaut : 1 (gourde entière). */
  roundingUnit?: Decimal.Value;
}

export interface PricingResult {
  receivedCurrency: Currency;
  payoutCurrency: Currency;
  feePercentApplied: Decimal;
  exchangeRateApplied: Decimal | null;
  feeAmount: Decimal;
  netPayout: Decimal;
}

export class PricingNotAllowedError extends Error {
  constructor(channel: Channel, payoutCurrency: Currency) {
    super(`Combinaison interdite : ${channel} vers ${payoutCurrency}`);
    this.name = "PricingNotAllowedError";
  }
}

export class PricingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingValidationError";
  }
}

/**
 * Calcule le montant à remettre au client pour une transaction, à partir
 * de la règle tarifaire en vigueur et du montant reçu. Ne dépend d'aucun
 * accès base de données : la règle et le montant sont fournis par l'appelant.
 */
export function calculatePricing(
  rule: PricingRuleInput,
  amountReceived: Decimal.Value,
): PricingResult {
  if (!rule.allowed) {
    throw new PricingNotAllowedError(rule.channel, rule.payoutCurrency);
  }

  const amount = new Decimal(amountReceived);
  if (!amount.isFinite() || amount.lessThanOrEqualTo(0)) {
    throw new PricingValidationError(
      "Le montant reçu doit être un nombre fini strictement positif",
    );
  }

  const receivedCurrency = RECEIVED_CURRENCY_BY_CHANNEL[rule.channel];
  const needsConversion = rule.payoutCurrency !== receivedCurrency;

  const feePercent = new Decimal(rule.feePercent);
  if (feePercent.lessThan(0) || feePercent.greaterThan(100)) {
    throw new PricingValidationError(
      "Le pourcentage de frais doit être compris entre 0 et 100",
    );
  }

  let exchangeRate: Decimal | null = null;
  if (needsConversion) {
    if (rule.exchangeRate == null) {
      throw new PricingValidationError(
        `Taux de change requis pour convertir ${receivedCurrency} vers ${rule.payoutCurrency}`,
      );
    }
    exchangeRate = new Decimal(rule.exchangeRate);
    if (exchangeRate.lessThanOrEqualTo(0)) {
      throw new PricingValidationError("Le taux de change doit être strictement positif");
    }
  }

  const feeFactor = new Decimal(1).minus(feePercent.dividedBy(100));

  let feeAmount: Decimal;
  let netPayout: Decimal;

  if (rule.feeBeforeConversion) {
    const net = amount.times(feeFactor);
    feeAmount = amount.minus(net);
    netPayout = needsConversion ? net.times(exchangeRate!) : net;
  } else {
    const brut = needsConversion ? amount.times(exchangeRate!) : amount;
    netPayout = brut.times(feeFactor);
    feeAmount = brut.minus(netPayout);
  }

  if (rule.payoutCurrency === "HTG") {
    const unit = new Decimal(rule.roundingUnit ?? 1);
    if (unit.lessThanOrEqualTo(0)) {
      throw new PricingValidationError("L'unité d'arrondi doit être strictement positive");
    }
    netPayout = netPayout
      .dividedBy(unit)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .times(unit);
  }

  return {
    receivedCurrency,
    payoutCurrency: rule.payoutCurrency,
    feePercentApplied: feePercent,
    exchangeRateApplied: exchangeRate,
    feeAmount,
    netPayout,
  };
}
