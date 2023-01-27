import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

describe("Truster Test", function () {
    let deployer: SignerWithAddress;
    let attacker: SignerWithAddress;
    let someUser: SignerWithAddress;
    // Pool has 1M * 10**18 tokens
    const TOKENS_IN_POOL = ethers.utils.parseEther('1000000');
    
  async function setupFixture() {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */

    [deployer, attacker, someUser] = await ethers.getSigners();

    const DamnValuableTokenFactory = await ethers.getContractFactory('DamnValuableToken', deployer);
    const TrusterLenderPool = await ethers.getContractFactory('TrusterLenderPool', deployer);
    const TrusterHacker = await ethers.getContractFactory("TrusterHacker", deployer);

    const token = await DamnValuableTokenFactory.deploy();
    const pool = await TrusterLenderPool.deploy(token.address);
    const hacker = await TrusterHacker.deploy();

    await token.transfer(pool.address, TOKENS_IN_POOL);
    
    return {token, pool, hacker}
  }
    it("Deployment", async function () {
      const {token, pool} = await loadFixture(setupFixture);

      expect(
        await token.balanceOf(pool.address)
    ).to.equal(TOKENS_IN_POOL);

    expect(await token.balanceOf(attacker.address)).to.eq(ethers.constants.Zero);
    });

    it("Exploit", async function () {
      const {token, pool, hacker} = await loadFixture(setupFixture);
      /** EXPLOIT */
      await hacker.connect(attacker).hack(pool.address, token.address);
      /** SUCCESS CONDITIONS */

        // From now on the pool is empty
        expect(
          await token.balanceOf(attacker.address)
        ).to.equal(TOKENS_IN_POOL);

        expect(
          await token.balanceOf(pool.address)
        ).to.equal('0');
    });
  });
