pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/**
 * An Ownable ERC20 token that limits token holder ability to transfer token only to list of allowed addresses.
 * When the contract's deployed, only the owner can transfer tokens to anyone
 * When a wallet receives tokens for the first time, it is assigned an unlock date, set to now + _lockDuration
 * Before the unlock date elapses those accounts can only transfer tokens to allowed addresses.
 * Once the unlock date elapses the token holder can transfer tokens normally to anyone
 * The owner can list, add and remove allowed addresses.
 * Any token holder can check their own unlock date
 * The owner can check any token holder's unlock date
 * The owner can stop locking transactions globally. This can only be done once and is irreversible.
 * Once performed, the contract behaves like a regular ERC20
 */
contract Lockable is ERC20, Ownable {
    uint256 internal _lockDuration;

    bool public lockingTransfers = true;

    mapping(address => uint256) private _unlockDates;

    mapping(address => bool) private _allowedAddresses;
    address[] private _allowedAddressArray;

    /**
     * @return the entire list of allowed addresses
     */
    function allowedAddresses() public view onlyOwner returns (address[] memory) {
        return _allowedAddressArray;
    }

    /**
     * add an address to the list of allowedAddresses
     */
    function addAllowedAddress(address _address) public onlyOwner whenLockingTransfers {
        if (!_allowedAddresses[_address]) {
            _allowedAddressArray.push(_address);
            _allowedAddresses[_address] = true;
        }
    }

    /**
     * remove an address from the list of allowedAddresses
     */
    function removeAllowedAddress(address _address) public onlyOwner whenLockingTransfers {
        _allowedAddresses[_address] = false;

        for (uint i = 0; i < _allowedAddressArray.length; i++) {
            if (_allowedAddressArray[i] == _address) {
                delete _allowedAddressArray[i];
                break;
            }
        }
    }

    /**
     * Stop locking transfers, this cannot be undone
     */
    function stopLockingTransfers() public onlyOwner whenLockingTransfers {
        lockingTransfers = false;
    }

    /**
     * @dev Modifier to make a function callable only when the contract is lockingTransfers.
     */
    modifier whenLockingTransfers() {
        require(lockingTransfers);
        _;
    }

    /**
    * @dev Transfer token for a specified address, set the current timestamp
    * @param to The address to transfer to.
    * @param value The amount to be transferred.
    */
    function transfer(address to, uint256 value) public returns (bool) {
        if (!lockingTransfers) {
            return super.transfer(to, value);
        }

        // Require the "to" address is in the allowed list or time has elapsed or you're the owner
        require(_allowedAddresses[to] || _unlockDates[msg.sender] <= now || msg.sender == owner());

        // transfer the token amount
        super.transfer(to, value);

        // Check if the user has no unlockDate (first time we're transferring token to them)
        if (_unlockDates[to] == 0) {
            // if so: calculate the future date and save in _unlockDates
            _unlockDates[to] = now + _lockDuration;
        }

        return true;
    }

    /**
    * @dev Transfer tokens from one address to another
    * @param from address The address which you want to send tokens from
    * @param to address The address which you want to transfer to
    * @param value uint256 the amount of tokens to be transferred
    */
    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        if (!lockingTransfers) {
            return super.transferFrom(from, to, value);
        }

        // Require the "to" address is in the allowed list or time has elapsed or you're the owner
        require(_allowedAddresses[to] || _unlockDates[from] <= now || msg.sender == owner() || from == owner());

        // transfer the token amount
        super.transferFrom(from, to, value);

        // Check if the user has no unlockDate (first time we're transferring token to them)
        if (_unlockDates[to] == 0) {
            // if so: calculate the future date and save in _unlockDates
            _unlockDates[to] = now + _lockDuration;
        }

        return true;
    }

    /**
     * @return the sender's unlock date
     */
    function myUnlockDate() public view whenLockingTransfers returns (uint) {
        return _unlockDates[msg.sender];
    }

    /**
     * @return an address's unlock date
     */
    function unlockDateOf(address _address) public view onlyOwner whenLockingTransfers returns (uint) {
        return _unlockDates[_address];
    }

    /**
     * @return an address's unlock date
     */
    function updateUnlockDate(address _address, uint unlockDate) public onlyOwner whenLockingTransfers returns (bool) {
        require(unlockDate > now);
        _unlockDates[_address] = unlockDate;
        return true;
    }
}