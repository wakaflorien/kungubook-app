/** Round to the nearest 100 (installments and balances are shown to the hundred). */
export const roundTo100 = (v: number): number => Math.round(v / 100) * 100;

export interface Installment {
  /** 1-based installment number. */
  number: number;
  payment: number;
  interest: number;
  principal: number;
  /** Balance left after this installment, rounded to 100. */
  balance: number;
}

export interface Amortization {
  installment: number;
  schedule: Installment[];
  totalPaid: number;
  totalInterest: number;
  /** Balance left after `k` installments (k = 0 → the principal). */
  balanceAfter(k: number): number;
}

/**
 * Preview a monthly amortized loan (TRD §6, doc 05 §4). The API's saved schedule wins.
 *
 * @param principal amount in minor units (RWF: francs)
 * @param annualRateBps yearly rate in basis points (14.5% → 1450)
 * @param months number of monthly installments
 * @param override optional installment the user typed instead of the computed one
 *
 * Installment = P·r / (1 − (1+r)^−n) with r = annual / 12, rounded to 100.
 * The last installment absorbs the rounding so the loan ends at exactly 0.
 * Matches `design/build.py`: RWF 5,000,000 at 14.5% over 42 months → 152,500 a month,
 * RWF 3,160,800 left after 18 payments.
 */
export function amortize(principal: number, annualRateBps: number, months: number, override?: number): Amortization {
  if (!Number.isInteger(principal) || principal <= 0) throw new RangeError('principal must be a positive integer');
  if (!Number.isInteger(months) || months <= 0) throw new RangeError('months must be a positive integer');
  if (annualRateBps < 0) throw new RangeError('rate must be ≥ 0');

  const r = annualRateBps / 10_000 / 12;
  const exact = r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months);
  const installment = override ?? roundTo100(exact);

  const schedule: Installment[] = [];
  let balance = principal; // kept as a float, like the reference model
  for (let n = 1; n <= months && balance > 0.005; n++) {
    const interestExact = balance * r;
    const isLast = n === months || balance + interestExact <= installment;
    const payment = isLast ? Math.round(balance + interestExact) : installment;
    const principalPart = isLast ? balance : payment - interestExact;
    balance = isLast ? 0 : balance - principalPart;
    const interest = Math.round(interestExact);
    schedule.push({
      number: n,
      payment,
      interest,
      principal: payment - interest,
      balance: roundTo100(Math.max(balance, 0)),
    });
  }

  const totalPaid = schedule.reduce((sum, i) => sum + i.payment, 0);
  return {
    installment,
    schedule,
    totalPaid,
    totalInterest: totalPaid - principal,
    balanceAfter(k: number) {
      if (k <= 0) return principal;
      return schedule[Math.min(k, schedule.length) - 1]!.balance;
    },
  };
}
