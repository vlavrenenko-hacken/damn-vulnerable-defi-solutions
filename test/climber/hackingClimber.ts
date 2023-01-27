import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";


describe("Climber Test", async function () {
    // Vault starts with 10 million tokens
    const VAULT_TOKEN_BALANCE = ethers.utils.parseEther('10000000');
    
    async function deployFixture() {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        const [deployer, proposer, sweeper, attacker] = await ethers.getSigners();
    
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

        expect(await vault.getSweeper()).to.eq(sweeper.address);
        expect(await vault.getLastWithdrawalTimestamp()).to.be.gt('0');
        expect(await vault.owner()).to.not.eq(ethers.constants.AddressZero);
        expect(await vault.owner()).to.not.eq(deployer.address);
        
        // Instantiate timelock
        let timelockAddress = await vault.owner();
        const timelock = (await ethers.getContractFactory('ClimberTimelock', deployer)).attach(timelockAddress);
        
        // Ensure timelock roles are correctly initialized
        expect(
            await timelock.hasRole(await timelock.PROPOSER_ROLE(), proposer.address)
        ).to.be.true;
        expect(
            await timelock.hasRole(await timelock.ADMIN_ROLE(), deployer.address)
        ).to.be.true;

        // Deploy token and transfer initial token balance to the vault
        const Token = (await ethers.getContractFactory('DamnValuableToken', deployer));
        const token = await Token.deploy();
        await token.transfer(vault.address, VAULT_TOKEN_BALANCE);

        const ClimberHacker = await ethers.getContractFactory("ClimberHacker", deployer);
        const climberHacker = await ClimberHacker.deploy(timelock.address, vault.address, token.address, attacker.address);
        
        return {attacker, vault, token, timelock, proposer, sweeper, climberHacker};
    }

    it("Exploit", async function () {
        const {attacker, vault, token, timelock, proposer, sweeper, climberHacker} = await loadFixture(deployFixture);
        await climberHacker.connect(attacker).execute();
         /** SUCCESS CONDITIONS */
         expect(await token.balanceOf(vault.address)).to.eq('0');
         expect(await token.balanceOf(attacker.address)).to.eq(VAULT_TOKEN_BALANCE);
    });
})


// tineLock execute -> reentrancy + create your own uups implementation, havin' done that you will be able to sweep the tokens


