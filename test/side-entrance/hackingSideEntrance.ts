import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

describe("SideEntrance Test", function () {
    let deployer: SignerWithAddress;
    let attacker: SignerWithAddress;
    let someUser: SignerWithAddress;
    // Pool has 1000 ETHER
    const ETHER_IN_POOL = ethers.utils.parseEther('1000');
    
  async function setupFixture() {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */

    [deployer, attacker, someUser] = await ethers.getSigners();
    const SideEntranceLedgerPoolFactory = await ethers.getContractFactory("SideEntranceLenderPool", deployer);
    const SideEntranceHacker = await ethers.getContractFactory("SideEntranceHacker", deployer);
    const pool = await SideEntranceLedgerPoolFactory.deploy();
    const hacker = await SideEntranceHacker.connect(deployer).deploy({value: ethers.utils.parseEther("1000")});
    await pool.connect(deployer).deposit({value: ETHER_IN_POOL});

    return {pool, hacker}
  }
    it("Deployment", async function () {
      const {pool, hacker} = await loadFixture(setupFixture);
      expect(
        await ethers.provider.getBalance(pool.address)).to.equal(ETHER_IN_POOL);

      expect(await ethers.provider.getBalance(hacker.address)).to.equal(ETHER_IN_POOL);
    });

    it("Exploit", async function () {
      const {pool, hacker} = await loadFixture(setupFixture);
      /** EXPLOIT */
      await hacker.connect(deployer).hack(pool.address);
      
      // From now on the pool is empty
      expect(await ethers.provider.getBalance(pool.address)).to.equal(ethers.constants.Zero);
    });
  });
