const { ethers } = require('hardhat');
const { expect } = require('chai');
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const DEPOSIT_TOKEN_AMOUNT = ethers.utils.parseEther('2000042');
const DEPOSIT_ADDRESS = '0x79658d35aB5c38B6b988C23D02e0410A380B8D5c';


describe("safeMiners Test", function () {
    let deployer:SignerWithAddress;
    let attacker: SignerWithAddress;

    before(async function () {
        
    });


    async function setupFixture() {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */  
            
        [deployer, attacker] = await ethers.getSigners();
        const token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();

        // Deposit the DVT tokens to the address
        await token.transfer(DEPOSIT_ADDRESS, DEPOSIT_TOKEN_AMOUNT);
        return {token};
    }

    it("Deployment", async function () {
        const {token} = await loadFixture(setupFixture);
         // Ensure initial balances are correctly set
         expect(await token.balanceOf(DEPOSIT_ADDRESS)).eq(DEPOSIT_TOKEN_AMOUNT);
         expect(await token.balanceOf(attacker.address)).eq('0');

         
    });

    it("Exploit", async function() {
        const {token} = await loadFixture(setupFixture);
        expect(
            await token.balanceOf(DEPOSIT_ADDRESS)
        ).to.eq('0');
        expect(
            await token.balanceOf(attacker.address)
        ).to.eq(DEPOSIT_TOKEN_AMOUNT);
    });
});