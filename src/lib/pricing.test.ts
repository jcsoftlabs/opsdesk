import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calculatePricing,
  PricingNotAllowedError,
  PricingValidationError,
  type PricingRuleInput,
} from "./pricing";
import { PRICING_GRID } from "./pricing-rules.seed";

function findRule(channel: PricingRuleInput["channel"], payoutCurrency: PricingRuleInput["payoutCurrency"]) {
  const rule = PRICING_GRID.find(
    (r) => r.channel === channel && r.payoutCurrency === payoutCurrency,
  );
  if (!rule) throw new Error("règle introuvable dans la grille de test");
  return rule;
}

describe("calculatePricing — les 8 combinaisons de la grille (§4.1)", () => {
  it("Zelle → USD : 10% de frais, pas de conversion", () => {
    const result = calculatePricing(findRule("ZELLE", "USD"), 500);
    expect(result.feeAmount.toFixed(2)).toBe("50.00");
    expect(result.netPayout.toFixed(2)).toBe("450.00");
    expect(result.exchangeRateApplied).toBeNull();
    expect(result.receivedCurrency).toBe("USD");
  });

  it("Zelle → HTG : 10% de frais avant conversion au taux 133 (exemple du cahier §7.3)", () => {
    const result = calculatePricing(findRule("ZELLE", "HTG"), 500);
    expect(result.feeAmount.toFixed(2)).toBe("50.00");
    expect(result.netPayout.toFixed(0)).toBe("59850");
  });

  it("CashApp → USD : 15% de frais, pas de conversion", () => {
    const result = calculatePricing(findRule("CASHAPP", "USD"), 500);
    expect(result.feeAmount.toFixed(2)).toBe("75.00");
    expect(result.netPayout.toFixed(2)).toBe("425.00");
  });

  it("CashApp → HTG : 15% de frais, taux 133", () => {
    const result = calculatePricing(findRule("CASHAPP", "HTG"), 500);
    expect(result.feeAmount.toFixed(2)).toBe("75.00");
    expect(result.netPayout.toFixed(0)).toBe("56525");
  });

  it("Dépôt USD → USD : 10% de frais, pas de conversion", () => {
    const result = calculatePricing(findRule("DEPOSIT_USD", "USD"), 500);
    expect(result.feeAmount.toFixed(2)).toBe("50.00");
    expect(result.netPayout.toFixed(2)).toBe("450.00");
  });

  it("Dépôt USD → HTG : 0% de frais, taux 130", () => {
    const result = calculatePricing(findRule("DEPOSIT_USD", "HTG"), 500);
    expect(result.feeAmount.toFixed(2)).toBe("0.00");
    expect(result.netPayout.toFixed(0)).toBe("65000");
  });

  it("Virement HTG → HTG : 2% de frais, pas de conversion (même devise)", () => {
    const result = calculatePricing(findRule("TRANSFER_HTG", "HTG"), 500);
    expect(result.feeAmount.toFixed(2)).toBe("10.00");
    expect(result.netPayout.toFixed(0)).toBe("490");
    expect(result.exchangeRateApplied).toBeNull();
  });

  it("Virement HTG → USD : combinaison interdite, doit toujours lever, quel que soit le montant", () => {
    const rule = findRule("TRANSFER_HTG", "USD");
    expect(() => calculatePricing(rule, 500)).toThrow(PricingNotAllowedError);
    expect(() => calculatePricing(rule, 1)).toThrow(PricingNotAllowedError);
    expect(() => calculatePricing(rule, 999999)).toThrow(PricingNotAllowedError);
  });

  it("la grille complète ne contient qu'un seul cas interdit", () => {
    const forbidden = PRICING_GRID.filter((r) => !r.allowed);
    expect(forbidden).toHaveLength(1);
    expect(forbidden[0]).toMatchObject({ channel: "TRANSFER_HTG", payoutCurrency: "USD" });
  });
});

describe("calculatePricing — arrondi du montant remis en HTG", () => {
  const baseRule: PricingRuleInput = {
    channel: "DEPOSIT_USD",
    payoutCurrency: "HTG",
    allowed: true,
    feePercent: "0.00",
    exchangeRate: "133.32",
    feeBeforeConversion: true,
  };

  it("arrondit à la gourde entière par défaut (roundingUnit=1)", () => {
    // 100.005 * 133.32 = 13332.666 -> arrondi à l'entier le plus proche
    const result = calculatePricing(baseRule, "100.005");
    expect(result.netPayout.toFixed(0)).toBe("13333");
  });

  it("n'arrondit jamais le montant en USD, quel que soit roundingUnit", () => {
    const usdRule: PricingRuleInput = { ...baseRule, payoutCurrency: "USD", exchangeRate: null, roundingUnit: 5 };
    const result = calculatePricing(usdRule, "100.017");
    expect(result.netPayout.toString()).toBe("100.017");
  });

  it("arrondit au multiple de roundingUnit le plus proche quand il est paramétré à 5", () => {
    // 100 * 133.32 = 13332 -> le plus proche multiple de 5 est 13330
    const result = calculatePricing({ ...baseRule, roundingUnit: 5 }, 100);
    expect(result.netPayout.toFixed(0)).toBe("13330");
  });

  it("rejette une unité d'arrondi négative ou nulle", () => {
    expect(() => calculatePricing({ ...baseRule, roundingUnit: 0 }, 100)).toThrow(
      PricingValidationError,
    );
    expect(() => calculatePricing({ ...baseRule, roundingUnit: -1 }, 100)).toThrow(
      PricingValidationError,
    );
  });
});

describe("calculatePricing — montants limites", () => {
  it("gère un très petit montant sans perte de précision (pas de number)", () => {
    const result = calculatePricing(findRule("ZELLE", "USD"), "0.01");
    expect(result.netPayout.toString()).toBe("0.009");
  });

  it("gère un très grand montant sans dépassement (Decimal, pas de number)", () => {
    const result = calculatePricing(findRule("DEPOSIT_USD", "HTG"), "1000000000.00");
    expect(result.netPayout.toFixed(0)).toBe("130000000000");
  });

  it("rejette un montant nul", () => {
    expect(() => calculatePricing(findRule("ZELLE", "USD"), 0)).toThrow(PricingValidationError);
  });

  it("rejette un montant négatif", () => {
    expect(() => calculatePricing(findRule("ZELLE", "USD"), -10)).toThrow(PricingValidationError);
  });

  it("rejette un montant non fini (Infinity/NaN)", () => {
    expect(() => calculatePricing(findRule("ZELLE", "USD"), Infinity)).toThrow(
      PricingValidationError,
    );
  });
});

describe("calculatePricing — validation de la règle", () => {
  it("exige un taux de change quand la conversion est nécessaire", () => {
    const brokenRule: PricingRuleInput = {
      channel: "ZELLE",
      payoutCurrency: "HTG",
      allowed: true,
      feePercent: "10.00",
      exchangeRate: null,
      feeBeforeConversion: true,
    };
    expect(() => calculatePricing(brokenRule, 500)).toThrow(PricingValidationError);
  });

  it("rejette un taux de change négatif ou nul", () => {
    const brokenRule: PricingRuleInput = {
      channel: "ZELLE",
      payoutCurrency: "HTG",
      allowed: true,
      feePercent: "10.00",
      exchangeRate: 0,
      feeBeforeConversion: true,
    };
    expect(() => calculatePricing(brokenRule, 500)).toThrow(PricingValidationError);
  });

  it("rejette un pourcentage de frais hors de [0, 100]", () => {
    const over: PricingRuleInput = { ...findRule("ZELLE", "USD"), feePercent: "150" };
    const under: PricingRuleInput = { ...findRule("ZELLE", "USD"), feePercent: "-1" };
    expect(() => calculatePricing(over, 500)).toThrow(PricingValidationError);
    expect(() => calculatePricing(under, 500)).toThrow(PricingValidationError);
  });
});

describe("calculatePricing — ordre frais/conversion (feeBeforeConversion)", () => {
  it("donne le même montant net que feeBeforeConversion=true dans ce cas (commutativité), mais un feeAmount dans une devise différente", () => {
    const before: PricingRuleInput = {
      channel: "ZELLE",
      payoutCurrency: "HTG",
      allowed: true,
      feePercent: "10.00",
      exchangeRate: "133.0000",
      feeBeforeConversion: true,
    };
    const after: PricingRuleInput = { ...before, feeBeforeConversion: false };

    const resultBefore = calculatePricing(before, 500);
    const resultAfter = calculatePricing(after, 500);

    // Même montant remis...
    expect(resultBefore.netPayout.toFixed(0)).toBe(resultAfter.netPayout.toFixed(0));
    // ...mais feeAmount exprimé dans des unités différentes : USD avant conversion, HTG après.
    expect(resultBefore.feeAmount.toFixed(2)).toBe("50.00"); // USD
    expect(resultAfter.feeAmount.toFixed(2)).toBe("6650.00"); // HTG (50 USD * 133)
  });
});

describe("calculatePricing — le caissier ne peut jamais influencer le calcul", () => {
  it("les valeurs appliquées sont toujours celles de la règle, jamais dérivées du montant", () => {
    const rule = findRule("CASHAPP", "HTG");
    const result = calculatePricing(rule, 1234.56);
    expect(result.feePercentApplied.toString()).toBe(new Decimal(rule.feePercent).toString());
    expect(result.exchangeRateApplied?.toString()).toBe(new Decimal(rule.exchangeRate!).toString());
  });
});
