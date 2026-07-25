import type { CampaignProfile, CreditTransaction } from '../../schemas/profileSchema';

const MAX_LEDGER = 100;

export function appendCreditTransaction(
  profile: CampaignProfile,
  transaction: Omit<CreditTransaction, 'balanceAfter'>,
): CampaignProfile {
  const next = structuredClone(profile);
  next.recentLedger.push({ ...transaction, balanceAfter: next.bankedCredits });
  next.recentLedger = next.recentLedger.slice(-MAX_LEDGER);
  return next;
}

export function transactionId(prefix: string): string {
  return `${prefix}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}
