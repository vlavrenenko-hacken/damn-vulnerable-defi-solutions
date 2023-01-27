import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";


describe("Rewarder Test", function () {
   
    let deployer: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress; 
    let charlie: SignerWithAddress;
    let david: SignerWithAddress; 
    let attacker:SignerWithAddress;
    let users:SignerWithAddress[];
    const TOKENS_IN_LENDER_POOL = ethers.utils.parseEther('1000000'); // 1 million tokens
    const AMOUNT = ethers.utils.parseEther('100');

  async function setupFixture() {
        [deployer, alice, bob, charlie, david, attacker] = await ethers.getSigners();
        users = [alice, bob, charlie, david];

        const FlashLoanerPoolFactory = await ethers.getContractFactory('FlashLoanerPool', deployer);
        const TheRewarderPoolFactory = await ethers.getContractFactory('TheRewarderPool', deployer);
        const DamnValuableTokenFactory = await ethers.getContractFactory('DamnValuableToken', deployer);
        const RewardTokenFactory = await ethers.getContractFactory('RewardToken', deployer);
        const AccountingTokenFactory = await ethers.getContractFactory('AccountingToken', deployer);
        const HackTheRewarderFactory = await ethers.getContractFactory("HackTheRewarder", deployer);

        const liquidityToken = await DamnValuableTokenFactory.deploy();
        const flashLoanPool = await FlashLoanerPoolFactory.deploy(liquidityToken.address);

        // Set initial token balance of the pool offering flash loans
        await liquidityToken.transfer(flashLoanPool.address, TOKENS_IN_LENDER_POOL);

        const rewarderPool = await TheRewarderPoolFactory.deploy(liquidityToken.address);
        const rewardToken =  RewardTokenFactory.attach(await rewarderPool.rewardToken());
        const accountingToken = AccountingTokenFactory.attach(await rewarderPool.accToken());
        const hacktherewarder = await HackTheRewarderFactory.connect(attacker).deploy(liquidityToken.address, flashLoanPool.address, rewarderPool.address, rewardToken.address);

        // Alice, Bob, Charlie and David deposit 100 tokens each
        for (let i = 0; i < users.length; i++) {
          const amount = ethers.utils.parseEther('100');
          await liquidityToken.transfer(users[i].address, amount);
          await liquidityToken.connect(users[i]).approve(rewarderPool.address, amount);
          await rewarderPool.connect(users[i]).deposit(amount);
          expect(
              await accountingToken.balanceOf(users[i].address)
          ).to.be.eq(amount);
      }
      expect(await accountingToken.totalSupply()).to.be.eq(ethers.utils.parseEther('400'));
      expect(await rewardToken.totalSupply()).to.be.eq('0');

      // Advance time 5 days so that depositors can get rewards
      await ethers.provider.send("evm_increaseTime", [5 * 24 * 60 * 60]); // 5 days
      
      // Each depositor gets 25 reward tokens
      for (let i = 0; i < users.length; i++) {
          await rewarderPool.connect(users[i]).distributeRewards();
          expect(
              await rewardToken.balanceOf(users[i].address)
          ).to.be.eq(ethers.utils.parseEther('25'));
      }
      expect(await rewardToken.totalSupply()).to.be.eq(ethers.utils.parseEther('100'));

      // Attacker starts with zero DVT tokens in balance
      expect(await liquidityToken.balanceOf(attacker.address)).to.eq('0');
      
      // Two rounds should have occurred so far
      expect(
          await rewarderPool.roundNumber()
      ).to.be.eq('2');
      
        return {accountingToken, rewardToken, liquidityToken, rewarderPool, hacktherewarder};
    }
    it("Deployment", async function () {
      const { accountingToken, rewardToken, liquidityToken } = await loadFixture(setupFixture);
     
    });

    it("Exploit", async function () {
      const { accountingToken, rewardToken, liquidityToken, rewarderPool, hacktherewarder } = await loadFixture(setupFixture);
      
      const lastRecordedSnapshotTimestamp = await rewarderPool.lastRecordedSnapshotTimestamp();
      const timenow = lastRecordedSnapshotTimestamp.add(5 * 24 * 3600); // plus five days
      await time.increaseTo(timenow);
      await hacktherewarder.connect(attacker).hack(TOKENS_IN_LENDER_POOL);
      await hacktherewarder.connect(attacker).withdrawAllTokens();
      //rewind the time to have block.timestamp + 5 days
      // loan the tokens


      // /** SUCCESS CONDITIONS */
        
      //   // Only one round should have taken place
        expect(
          await rewarderPool.roundNumber()
      ).to.be.eq('3');

      // // Users should get neglegible rewards this round
      for (let i = 0; i < users.length; i++) {
          await rewarderPool.connect(users[i]).distributeRewards();
          let rewards = await rewardToken.balanceOf(users[i].address);
          
          // The difference between current and previous rewards balance should be lower than 0.01 tokens
          let delta = rewards.sub(ethers.utils.parseEther('25'));
          expect(delta).to.be.lt(ethers.utils.parseUnits('1', 16))
      }
      // // Rewards must have been issued to the attacker account
      expect(await rewardToken.totalSupply()).to.be.gt(ethers.utils.parseEther('100'));
      let rewards = await rewardToken.balanceOf(attacker.address);
      // The amount of rewards earned should be really close to 100 tokens
      let delta = ethers.utils.parseEther('100').sub(rewards);
      expect(delta).to.be.lt(ethers.utils.parseUnits('1', 17));

      // Attacker finishes with zero DVT tokens in balance
      expect(await liquidityToken.balanceOf(attacker.address)).to.eq('0');

    });
  });
