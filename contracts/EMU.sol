pragma solidity ^0.5.0;

import "./Lockable.sol";

contract EMU is Lockable {
    string public name = 'EMU';
    string public symbol = 'EMU';
    uint8 public constant DECIMALS = 18;
    uint256 public constant INITIAL_SUPPLY = 500000000 * (10 ** uint256(DECIMALS));
    uint private LOCK_DURATION_IN_DAYS = 40;

    constructor() public {
        _mint(msg.sender, INITIAL_SUPPLY);
        _lockDuration = 60 * 60 * 24 * LOCK_DURATION_IN_DAYS;
        addAllowedSenderAddress(msg.sender);
    }
}