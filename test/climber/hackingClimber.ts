import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";


describe("Climber Test", async function () {
    const [deployer, proposer, sweeper, attacker] = await ethers.getSigners();
    
    // Vault starts with 10 million tokens
    const VAULT_TOKEN_BALANCE = ethers.utils.parseEther('10000000');
    
    async function setupFixture() {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x16345785d8a0000", // 0.1 ETH
    ]);

    expect(
        await ethers.provider.getBalance(attacker.address)
    ).to.equal(ethers.utils.parseEther('0.1'));
    
    // Deploy the vault behind a proxy using the UUPS pattern,
    // passing the necessary addresses for the `ClimberVault::initialize(address,address,address)` function
    const vault = await upgrades.deployProxy(
        await ethers.getContractFactory('ClimberVault', deployer),
        [ deployer.address, proposer.address, sweeper.address ],
        { kind: 'uups' }
    );
    
    // Instantiate timelock
    let timelockAddress = await vault.owner();
    const timelock = (
        await ethers.getContractFactory('ClimberTimelock', deployer)
    ).attach(timelockAddress);
    
    // Deploy token and transfer initial token balance to the vault
    const token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
    await token.transfer(vault.address, VAULT_TOKEN_BALANCE);
    return {vault, timelock};
    
  }
    it("Deployment", async function () {
        const {vault, timelock} = await loadFixture(setupFixture);
        expect(await vault.getSweeper()).to.eq(sweeper.address);
        expect(await vault.getLastWithdrawalTimestamp()).to.be.gt('0');
        expect(await vault.owner()).to.not.eq(ethers.constants.AddressZero);
        expect(await vault.owner()).to.not.eq(deployer.address);
        
         // Ensure timelock roles are correctly initialized
        expect(
            await timelock.hasRole(await timelock.PROPOSER_ROLE(), proposer.address)
        ).to.be.true;
        expect(
            await timelock.hasRole(await timelock.ADMIN_ROLE(), deployer.address)
        ).to.be.true;
    });

    it("Exploit", async function () {
        const {vault, timelock} = await loadFixture(setupFixture);
        
        
    });
  });
