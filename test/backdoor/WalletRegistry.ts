import { ethers } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { WalletRegistry } from '../../typechain-types/contracts/backdoor/WalletRegistry';
import {} from "../../typechain-types/@gnosis.pm/safe-contracts/contracts/"
import { DamnValuableToken } from '../../typechain-types';
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe('[Challenge] Backdoor', function () {
    let deployer:SignerWithAddress, users:string[], attacker:SignerWithAddress;
    let walletRegistry: WalletRegistry;
    let token:DamnValuableToken;

    const AMOUNT_TOKENS_DISTRIBUTED = ethers.utils.parseEther('40');

    async function deployFixture() {
        /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        const [deployer, alice, bob, charlie, david, attacker] = await ethers.getSigners();
        users = [alice.address, bob.address, charlie.address, david.address]
        let token;

        // Deploy Gnosis Safe master copy and factory contracts
        const masterCopy = await (await ethers.getContractFactory('GnosisSafe', deployer)).deploy();
        const walletFactory = await (await ethers.getContractFactory('GnosisSafeProxyFactory', deployer)).deploy();
        token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
        
        // Deploy the registry
        walletRegistry = await (await ethers.getContractFactory('WalletRegistry', deployer)).deploy(
            masterCopy.address,
            walletFactory.address,
            token.address,
            users
        );

        const backdoorHackerContract = await (await ethers.getContractFactory("BackdoorHackerContract", deployer)).connect(attacker).deploy();
        // Users are registered as beneficiaries
        for (let i = 0; i < users.length; i++) {
            expect(
                await walletRegistry.beneficiaries(users[i])
            ).to.be.true;            
        }

        // Transfer tokens to be distributed to the registry
        await token.transfer(walletRegistry.address, AMOUNT_TOKENS_DISTRIBUTED);
        return {users, masterCopy, walletFactory, token, walletRegistry,backdoorHackerContract, attacker}
    }

    it('Exploit', async function () {
        const {users, masterCopy, walletFactory, token, walletRegistry, backdoorHackerContract, attacker} = await loadFixture(deployFixture);
        await backdoorHackerContract.connect(attacker).hack(walletFactory.address, walletRegistry.address, masterCopy.address, token.address, users);


        for (let i = 0; i < users.length; i++) {
            let wallet = await walletRegistry.wallets(users[i]);
            
            // User must have registered a wallet
            expect(wallet).to.not.eq(ethers.constants.AddressZero, "User did not register a wallet");

            // User is no longer registered as a beneficiary
            expect(
                await walletRegistry.beneficiaries(users[i])
            ).to.be.false;
        }

        // Attacker must have taken all tokens
        expect(
            await token.balanceOf(attacker.address)
        ).to.eq(AMOUNT_TOKENS_DISTRIBUTED);

    });
});


// GnosisSafe - impl multisig that controls GnosisSafeProxies that are controlled by GnosisSafeProxyFactory
// 1) GnosisSafeProxyFactory, createProxyWithCallback
// 2) createProxyWithNonce
// 3) WalletRegistry.proxyCreated()
// 4) add an address of the Token to the Proxy as a fallback handler, 
// 5) Send the data to the fallback of the Proxy to transfer 10DVT from it to the msg.sender
// 6) Do that as many times as beneficiaries are
