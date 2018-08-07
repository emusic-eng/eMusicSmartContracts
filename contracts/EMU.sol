pragma solidity ^0.4.19;

import 'openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol';
import "openzeppelin-solidity/contracts/lifecycle/Destructible.sol";

contract EMU is StandardToken, Destructible {
    string public name = 'EMU';
    string public symbol = 'EMU';
    uint8 public decimals = 18;
    uint public INITIAL_SUPPLY = 500000000 * (10 ** uint256(decimals));

    constructor() public {
        totalSupply_ = INITIAL_SUPPLY;
        balances[msg.sender] = INITIAL_SUPPLY;
    }
}