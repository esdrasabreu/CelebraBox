export type PaymentChoice = 'mp_pix' | 'mp_card' | 'manual_pix';

export interface FeeBreakdown {
  netAmount: number;
  grossAmount: number;
  feeAmount: number;
  feePercent: number;
}

export function roundCurrency(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates the gross checkout amount so that after Mercado Pago deducts
 * `feePercent`% from the transaction, the collector receives at least `netAmount`.
 *
 * Formula: gross = net / (1 - rate), verified against MP fee rounding.
 */
export function calculateGrossAmount(netAmount: number, feePercent: number): FeeBreakdown {
  const cleanNet = roundCurrency(Math.max(0, Number(netAmount) || 0));
  const clampedPercent = Math.min(Math.max(Number(feePercent) || 0, 0), 50);
  const rate = clampedPercent / 100;

  if (rate <= 0 || cleanNet <= 0) {
    return {
      netAmount: cleanNet,
      grossAmount: cleanNet,
      feeAmount: 0,
      feePercent: 0
    };
  }

  let grossAmount = roundCurrency(cleanNet / (1 - rate));

  // Verify against 2-decimal fee rounding so host never loses R$ 0.01
  const estimatedFee = roundCurrency(grossAmount * rate);
  const estimatedNet = roundCurrency(grossAmount - estimatedFee);
  if (estimatedNet < cleanNet) {
    grossAmount = roundCurrency(grossAmount + 0.01);
  }

  const feeAmount = roundCurrency(grossAmount - cleanNet);

  return {
    netAmount: cleanNet,
    grossAmount,
    feeAmount,
    feePercent: clampedPercent
  };
}

export function getCheckoutBreakdown(
  giftPrice: number,
  choice: PaymentChoice,
  options?: {
    passFeesToBuyer?: boolean;
    pixFeePercent?: number;
    cardFeePercent?: number;
  }
): FeeBreakdown {
  const cleanPrice = roundCurrency(Math.max(0, Number(giftPrice) || 0));

  if (choice === 'manual_pix' || options?.passFeesToBuyer === false) {
    return {
      netAmount: cleanPrice,
      grossAmount: cleanPrice,
      feeAmount: 0,
      feePercent: 0
    };
  }

  const pixPercent = options?.pixFeePercent !== undefined ? Number(options.pixFeePercent) : 0.99;
  const cardPercent = options?.cardFeePercent !== undefined ? Number(options.cardFeePercent) : 4.98;

  const targetPercent = choice === 'mp_pix' ? pixPercent : cardPercent;
  return calculateGrossAmount(cleanPrice, targetPercent);
}
