import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

describe("NaiveReceiver Test", function () {
    let deployer: SignerWithAddress;
    let attacker: SignerWithAddress;
    let someUser: SignerWithAddress;
    // Pool has 1000 ETH in balance
    const ETHER_IN_POOL = ethers.utils.parseEther("1000");
    // Receiver has 10 ETH in balance
    const ETHER_IN_RECEIVER = ethers.utils.parseEther("10");
   
    
  async function setupFixture() {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */

    [deployer, attacker, someUser] = await ethers.getSigners();

    const LenderPoolFactory = await ethers.getContractFactory("NaiveReceiverLenderPool", deployer);
    const FlashLoanReceiverFactory = await ethers.getContractFactory("FlashLoanReceiver", deployer);
    const pool = await LenderPoolFactory.deploy();

    await deployer.sendTransaction({to: pool.address, value: ETHER_IN_POOL});
    const receiver = await FlashLoanReceiverFactory.deploy(pool.address);
    await deployer.sendTransaction({to: receiver.address, value: ETHER_IN_RECEIVER});

    const Hacker = await ethers.getContractFactory("Hacker", deployer);
    const hacker = await Hacker.deploy();

    return {pool, receiver, hacker}
  }
    it("Deployment", async function () {
      const {pool, receiver} = await loadFixture(setupFixture);
    
      expect(await ethers.provider.getBalance(pool.address)).to.be.equal(ETHER_IN_POOL);
      expect(await pool.fixedFee()).to.be.equal(ethers.utils.parseEther('1'));
      expect(await ethers.provider.getBalance(receiver.address)).to.be.equal(ETHER_IN_RECEIVER);
    });

    it("Exploit", async function () {
      const {pool, receiver, hacker} = await loadFixture(setupFixture);
      /** EXPLOIT */
      await hacker.hack(pool.address, receiver.address);

        // All ETH has been drained from the receiver
      expect(
          await ethers.provider.getBalance(receiver.address)
      ).to.be.equal('0');
      expect(
          await ethers.provider.getBalance(pool.address)
      ).to.be.equal(ETHER_IN_POOL.add(ETHER_IN_RECEIVER));
    });
  });
