import type { CampaignProfile, CreditTransaction } from '../../schemas/profileSchema';
import { progression, type ProgressionService } from '../profile/ProgressionService';

export type MissionRewardCategory = 'enemy' | 'ground' | 'pickup' | 'boss' | 'mission' | 'objective';

export interface MissionReward {
  rewardId: string;
  amount: number;
  category: MissionRewardCategory;
}

export interface MissionRewardBreakdown {
  enemyBounties: number;
  groundBounties: number;
  pickupRewards: number;
  bossReward: number;
  missionReward: number;
  objectiveBonus: number;
  difficultyBonus: number;
  lostEscrow: number;
  totalBanked: number;
}

export interface MissionEconomySnapshot {
  runId: string;
  checkpointCredits: number;
  unbankedCredits: number;
  claimedRewardIds: string[];
  checkpointClaimedRewardIds: string[];
  checkpointBreakdown: Omit<MissionRewardBreakdown, 'difficultyBonus' | 'lostEscrow' | 'totalBanked'>;
  breakdown: Omit<MissionRewardBreakdown, 'difficultyBonus' | 'lostEscrow' | 'totalBanked'>;
}

export interface MissionSettlement {
  settlementId: string;
  alreadyProcessed: boolean;
  profile: CampaignProfile;
  breakdown: MissionRewardBreakdown;
}

const emptyBreakdown = () => ({
  enemyBounties: 0,
  groundBounties: 0,
  pickupRewards: 0,
  bossReward: 0,
  missionReward: 0,
  objectiveBonus: 0,
});

function safeAmount(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function addCategory(target: ReturnType<typeof emptyBreakdown>, category: MissionRewardCategory, amount: number): void {
  if (category === 'enemy') target.enemyBounties += amount;
  if (category === 'ground') target.groundBounties += amount;
  if (category === 'pickup') target.pickupRewards += amount;
  if (category === 'boss') target.bossReward += amount;
  if (category === 'mission') target.missionReward += amount;
  if (category === 'objective') target.objectiveBonus += amount;
}

export class MissionEconomy {
  private checkpointCredits = 0;
  private unbankedCredits = 0;
  private claimed = new Set<string>();
  private checkpointClaimed = new Set<string>();
  private checkpointBreakdown = emptyBreakdown();
  private breakdown = emptyBreakdown();

  constructor(readonly runId: string) {}

  static restore(snapshot: MissionEconomySnapshot | undefined, runId: string): MissionEconomy {
    const economy = new MissionEconomy(snapshot?.runId === runId ? snapshot.runId : runId);
    if (!snapshot || snapshot.runId !== runId) return economy;
    economy.checkpointCredits = Math.max(0, Math.floor(snapshot.checkpointCredits));
    economy.unbankedCredits = Math.max(0, Math.floor(snapshot.unbankedCredits));
    economy.claimed = new Set(snapshot.claimedRewardIds);
    economy.checkpointClaimed = new Set(snapshot.checkpointClaimedRewardIds);
    economy.checkpointBreakdown = { ...emptyBreakdown(), ...snapshot.checkpointBreakdown };
    economy.breakdown = { ...emptyBreakdown(), ...snapshot.breakdown };
    return economy;
  }

  get totalEscrow(): number {
    return this.checkpointCredits + this.unbankedCredits;
  }

  get protectedCredits(): number {
    return this.checkpointCredits;
  }

  get atRiskCredits(): number {
    return this.unbankedCredits;
  }

  claim(reward: MissionReward): boolean {
    const amount = safeAmount(reward.amount);
    if (!amount || !reward.rewardId || this.claimed.has(reward.rewardId)) return false;
    this.claimed.add(reward.rewardId);
    this.unbankedCredits += amount;
    addCategory(this.breakdown, reward.category, amount);
    return true;
  }

  captureCheckpoint(): void {
    this.checkpointCredits += this.unbankedCredits;
    this.unbankedCredits = 0;
    this.checkpointClaimed = new Set(this.claimed);
    this.checkpointBreakdown = { ...this.breakdown };
  }

  retryFromCheckpoint(): void {
    this.unbankedCredits = 0;
    this.claimed = new Set(this.checkpointClaimed);
    this.breakdown = { ...this.checkpointBreakdown };
  }

  snapshot(): MissionEconomySnapshot {
    return {
      runId: this.runId,
      checkpointCredits: this.checkpointCredits,
      unbankedCredits: this.unbankedCredits,
      claimedRewardIds: [...this.claimed].sort(),
      checkpointClaimedRewardIds: [...this.checkpointClaimed].sort(),
      checkpointBreakdown: { ...this.checkpointBreakdown },
      breakdown: { ...this.breakdown },
    };
  }

  settle(
    profile: CampaignProfile,
    missionId: string,
    difficultyName: 'easy' | 'normal' | 'hard',
    missionBaseReward: number,
    progress: ProgressionService = progression,
  ): MissionSettlement {
    const settlementId = `mission:${this.runId}:${missionId}`;
    if (profile.processedSettlementIds.includes(settlementId)) {
      return {
        settlementId,
        alreadyProcessed: true,
        profile: structuredClone(profile),
        breakdown: this.resultBreakdown(0, 0),
      };
    }
    const next = structuredClone(profile);
    const baseReward = safeAmount(missionBaseReward);
    if (baseReward) {
      this.unbankedCredits += baseReward;
      addCategory(this.breakdown, 'mission', baseReward);
    }
    const raw = this.totalEscrow;
    const multiplier = difficultyName === 'hard' ? 0.25 : difficultyName === 'normal' ? 0.1 : 0;
    const difficultyBonus = Math.floor(raw * multiplier);
    const total = raw + difficultyBonus;
    next.bankedCredits += total;
    next.processedSettlementIds.push(settlementId);
    next.processedSettlementIds = next.processedSettlementIds.slice(-100);
    const transaction: CreditTransaction = {
      id: settlementId,
      runId: this.runId,
      missionId,
      timestamp: Date.now(),
      amount: total,
      reason: 'missionSettlement',
      sourceId: missionId,
      balanceAfter: next.bankedCredits,
    };
    next.recentLedger.push(transaction);
    next.recentLedger = next.recentLedger.slice(-100);
    const record = next.missionRecords[missionId] ?? { completions: 0, bestScore: 0, bestTimeSeconds: 0, bestCredits: 0 };
    record.completions += 1;
    record.bestCredits = Math.max(record.bestCredits, total);
    next.missionRecords[missionId] = record;
    const progressed = progress.applyMissionCompletion(next, missionId);
    return {
      settlementId,
      alreadyProcessed: false,
      profile: progressed,
      breakdown: this.resultBreakdown(difficultyBonus, 0),
    };
  }

  private resultBreakdown(difficultyBonus: number, lostEscrow: number): MissionRewardBreakdown {
    return {
      ...this.breakdown,
      difficultyBonus,
      lostEscrow,
      totalBanked: this.totalEscrow + difficultyBonus,
    };
  }
}
