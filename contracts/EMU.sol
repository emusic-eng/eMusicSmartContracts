pragma solidity ^0.5.0;

import "./Lockable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

contract EMU is Lockable, ERC20Detailed {
    uint8 private constant _decimals = 18;
    uint256 public constant INITIAL_SUPPLY = 500000000 * (10 ** uint256(_decimals));

    constructor() public ERC20Detailed("EMU", "EMU", _decimals) {
        _mint(msg.sender, INITIAL_SUPPLY);
        // 40 days
        _lockDuration = 60 * 60 * 24 * 40;
        addAllowedSenderAddress(msg.sender);
    }
}