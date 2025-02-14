import {
  Account,
  Chain,
  Clarinet,
  Tx,
  types,
} from "https://deno.land/x/clarinet@v0.13.0/index.ts";

import * as Utils from './arkadiko-tests-utils.ts';

// ---------------------------------------------------------
// Stake Registry
// ---------------------------------------------------------

class StakeRegistry {
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account) {
    this.chain = chain;
    this.deployer = deployer;
  }

  getPoolData(poolAddress: string) {
    return this.chain.callReadOnlyFn("arkadiko-stake-registry-v1-1", "get-pool-data", [
      types.principal(Utils.qualifiedName(poolAddress))
    ], this.deployer.address);
  }

  getPendingRewards(user: Account, poolAddress: string) {
    return this.chain.callReadOnlyFn("arkadiko-stake-registry-v1-1", "get-pending-rewards", [
      types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
      types.principal(Utils.qualifiedName(poolAddress))
    ], user.address);
  }

  stake(user: Account, poolAddress: string, tokenAddress: string, amount: number) {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-registry-v1-1", "stake", [
        types.principal(Utils.qualifiedName("arkadiko-stake-registry-v1-1")),
        types.principal(Utils.qualifiedName(poolAddress)),
        types.principal(Utils.qualifiedName(tokenAddress)),
        types.uint(amount * 1000000)
      ], user.address)
    ]);
    return block.receipts[0].result;
  }

  unstake(user: Account, poolAddress: string, tokenAddress: string, amount: number) {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-registry-v1-1", "unstake", [
        types.principal(Utils.qualifiedName("arkadiko-stake-registry-v1-1")),
        types.principal(Utils.qualifiedName(poolAddress)),
        types.principal(Utils.qualifiedName(tokenAddress)),
        types.uint(amount * 1000000)
      ], user.address)
    ]);
    return block.receipts[0].result;
  }

  claimRewards(user: Account, poolAddress: string) {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-registry-v1-1", "claim-pending-rewards", [
        types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
        types.principal(Utils.qualifiedName(poolAddress)),
      ], user.address)
    ]);
    return block.receipts[0].result;
  }

  stakePendingRewards(user: Account, poolAddress: string) {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-registry-v1-1", "stake-pending-rewards", [
        types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
        types.principal(Utils.qualifiedName(poolAddress)),
        types.principal(Utils.qualifiedName('arkadiko-stake-pool-diko-v1-1')),
        types.principal(Utils.qualifiedName('arkadiko-token')),
      ], user.address)
    ]);
    return block.receipts[0].result;
  }

}
export { StakeRegistry };

// ---------------------------------------------------------
// DIKO pool
// ---------------------------------------------------------

class StakePoolDiko {
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account) {
    this.chain = chain;
    this.deployer = deployer;
  }

  getDikoStdikoRatio() {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-diko-v1-1", "diko-stdiko-ratio", [], this.deployer.address)
  }

  getTotalStaked() {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-diko-v1-1", "get-total-staked", [], this.deployer.address);
  }

  getDikoForStDiko(amount: number, stDikoSupply: number) {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-diko-v1-1", "diko-for-stdiko", [
      types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
      types.uint(amount * 1000000),
      types.uint(stDikoSupply * 1000000),
    ], this.deployer.address);
  }

  walletCanRedeem(user: Account) {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-diko-v1-1", "wallet-can-redeem", [
      types.principal(user.address)
    ], user.address);
  }

  getStakeOf(user: Account, stDikoSupply: number) {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-pool-diko-v1-1", "get-stake-of", [
        types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
        types.principal(user.address),
        types.uint(stDikoSupply * 1000000)
    ], user.address)
    ]);
    return block.receipts[0].result;
  }

  addRewardsToPool() {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-pool-diko-v1-1", "add-rewards-to-pool", [
        types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1'))
      ], this.deployer.address)
    ]);
    return block.receipts[0].result;
  }

  startCooldown(user: Account) {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-pool-diko-v1-1", "start-cooldown", [], user.address)
    ]);
    return block.receipts[0].result;
  }

}
export { StakePoolDiko };

// ---------------------------------------------------------
// DIKO/USDA pool
// ---------------------------------------------------------

class StakePoolDikoUsda {
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account) {
    this.chain = chain;
    this.deployer = deployer;
  }

  getTotalStaked() {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-diko-usda-v1-1", "get-total-staked", [], this.deployer.address);
  }

  getStakeOf(user: Account) {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-diko-usda-v1-1", "get-stake-amount-of", [types.principal(user.address)], user.address);
  }

  getCummulativeRewardPerStakeOf(user: Account) {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-diko-usda-v1-1", "get-stake-cumm-reward-per-stake-of", [types.principal(user.address)], user.address);
  }

  getCummulativeRewardPerStake() {
    return  this.chain.callReadOnlyFn("arkadiko-stake-pool-diko-usda-v1-1", "get-cumm-reward-per-stake", [], this.deployer.address);
  }

  calculateCummulativeRewardPerStake() {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-diko-usda-v1-1", "calculate-cumm-reward-per-stake", [
      types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
    ], this.deployer.address);
  }

  addRewardsToPool() {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-pool-diko-usda-v1-1", "add-rewards-to-pool", [
        types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1'))
      ], this.deployer.address)
    ]);
    return block.receipts[0].result;
  }

  emergencyWithdraw(user: Account) {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-pool-diko-usda-v1-1", "emergency-withdraw", [
        types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
      ], user.address)
    ]);
    return block.receipts[0].result;
  }

  increaseCumulativeRewardPerStake() {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-pool-diko-usda-v1-1", "increase-cumm-reward-per-stake", [
        types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
      ], this.deployer.address)
    ]);
    return block.receipts[0].result;
  }

}
export { StakePoolDikoUsda };

// ---------------------------------------------------------
// wSTX/USDA pool
// ---------------------------------------------------------

class StakePoolStxUsda {
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account) {
    this.chain = chain;
    this.deployer = deployer;
  }

  getTotalStaked() {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-wstx-usda-v1-1", "get-total-staked", [], this.deployer.address);
  }

  getStakeOf(user: Account) {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-wstx-usda-v1-1", "get-stake-amount-of", [types.principal(user.address)], user.address);
  }

  getCummulativeRewardPerStakeOf(user: Account) {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-wstx-usda-v1-1", "get-stake-cumm-reward-per-stake-of", [types.principal(user.address)], user.address);
  }

  getCummulativeRewardPerStake() {
    return  this.chain.callReadOnlyFn("arkadiko-stake-pool-wstx-usda-v1-1", "get-cumm-reward-per-stake", [], this.deployer.address);
  }

  calculateCummulativeRewardPerStake() {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-wstx-usda-v1-1", "calculate-cumm-reward-per-stake", [
      types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
    ], this.deployer.address);
  }

  addRewardsToPool() {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-pool-wstx-usda-v1-1", "add-rewards-to-pool", [
        types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1'))
      ], this.deployer.address)
    ]);
    return block.receipts[0].result;
  }

  emergencyWithdraw(user: Account) {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-pool-wstx-usda-v1-1", "emergency-withdraw", [
        types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
      ], user.address)
    ]);
    return block.receipts[0].result;
  }

  increaseCumulativeRewardPerStake() {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-pool-wstx-usda-v1-1", "increase-cumm-reward-per-stake", [
        types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
      ], this.deployer.address)
    ]);
    return block.receipts[0].result;
  }

}
export { StakePoolStxUsda };

// ---------------------------------------------------------
// wSTX/DIKO pool
// ---------------------------------------------------------

class StakePoolStxDiko {
  chain: Chain;
  deployer: Account;

  constructor(chain: Chain, deployer: Account) {
    this.chain = chain;
    this.deployer = deployer;
  }

  getTotalStaked() {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-wstx-diko-v1-1", "get-total-staked", [], this.deployer.address);
  }

  getStakeOf(user: Account) {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-wstx-diko-v1-1", "get-stake-amount-of", [types.principal(user.address)], user.address);
  }

  getCummulativeRewardPerStakeOf(user: Account) {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-wstx-diko-v1-1", "get-stake-cumm-reward-per-stake-of", [types.principal(user.address)], user.address);
  }

  getCummulativeRewardPerStake() {
    return  this.chain.callReadOnlyFn("arkadiko-stake-pool-wstx-diko-v1-1", "get-cumm-reward-per-stake", [], this.deployer.address);
  }

  calculateCummulativeRewardPerStake() {
    return this.chain.callReadOnlyFn("arkadiko-stake-pool-wstx-diko-v1-1", "calculate-cumm-reward-per-stake", [
      types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
    ], this.deployer.address);
  }

  addRewardsToPool() {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-pool-wstx-diko-v1-1", "add-rewards-to-pool", [
        types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1'))
      ], this.deployer.address)
    ]);
    return block.receipts[0].result;
  }

  emergencyWithdraw(user: Account) {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-pool-wstx-diko-v1-1", "emergency-withdraw", [
        types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
      ], user.address)
    ]);
    return block.receipts[0].result;
  }

  increaseCumulativeRewardPerStake() {
    let block = this.chain.mineBlock([
      Tx.contractCall("arkadiko-stake-pool-wstx-diko-v1-1", "increase-cumm-reward-per-stake", [
        types.principal(Utils.qualifiedName('arkadiko-stake-registry-v1-1')),
      ], this.deployer.address)
    ]);
    return block.receipts[0].result;
  }

}
export { StakePoolStxDiko };