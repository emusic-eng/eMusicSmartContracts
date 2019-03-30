pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

/**
 * An Ownable ERC20 token that for a set time, limits token holder ability to transfer token only to list of allowed receiver addresses.
 * When the contract's deployed, only the owner can transfer tokens to anyone
 * When a wallet receives tokens for the first time, it is assigned an unlock date, set to now + _lockDuration
 * Before the unlock date elapses those accounts can only transfer tokens to allowed receiver addresses.
 * Once the unlock date elapses the token holder can transfer tokens normally to anyone
 * The owner can list, add and remove allowed receiver addresses.
 * The owner can list, add and remove allowed sender addresses.
 * Wallets listed in the allowed sender addresses can transfer tokens to anyone without waiting the _lockDuration
 * A wallet that has elapsed the unlock date, can transfer tokens to anyone. Those recipients can transfer the token onward without a waiting period
 * Any token holder can check their own unlock date
 * The owner can check any token holder's unlock date
 * The owner can stop locking transactions globally. This can only be done once and is irreversible.
 * Once performed, the contract behaves like a regular ERC20
 */
contract Lockable is ERC20, Ownable {
    //TODO: change requires to have a second param explaining the error
    uint256 internal _lockDuration;

    bool public lockingTransfers = true;

    mapping(address => uint256) private _unlockDates;

    mapping(address => bool) private _allowedReceiverAddressMap;
    address[] private _allowedReceiverAddressArray;

    mapping(address => bool) private _allowedSenderAddressMap;
    address[] private _allowedSenderAddressArray;

    /**
     * adds an address from both array and map
     */
    function _addAllowedAddress(address _address, mapping(address => bool) storage _addressMap, address[] storage _addressArray) private {
        if (!_addressMap[_address]) {
            _addressArray.push(_address);
            _addressMap[_address] = true;
        }
    }

    /**
     * removes an address from both array and map
     */
    function _removeAllowedAddress(address _address, mapping(address => bool) storage _addressMap, address[] storage _addressArray) private {
        _addressMap[_address] = false;

        for (uint i = 0; i < _addressArray.length; i++) {
            if (_addressArray[i] == _address) {
                delete _addressArray[i];
                break;
            }
        }
    }

    /**** RECEIVER ZONE ****/
    /**
     * @return the entire list of allowed receiver addresses
     */
    function allowedReceiverAddresses() public view onlyOwner returns (address[] memory) {
        return _allowedReceiverAddressArray;
    }

    /**
     * add an address to the list of allowedReceiverAddresses
     */
    function addAllowedReceiverAddress(address _address) public onlyOwner whenLockingTransfers {
        _addAllowedAddress(_address, _allowedReceiverAddressMap, _allowedReceiverAddressArray);
    }

    /**
     * remove an address from the list of allowedReceiverAddresses
     */
    function removeAllowedReceiverAddress(address _address) public onlyOwner whenLockingTransfers {
        _removeAllowedAddress(_address, _allowedReceiverAddressMap, _allowedReceiverAddressArray);
    }

    /**** SENDER ZONE ****/
    /**
    * @return the entire list of allowed sender addresses
    */
    function allowedSenderAddresses() public view onlyOwner returns (address[] memory) {
        return _allowedSenderAddressArray;
    }

    /**
     * add an address to the list of allowedSenderAddresses
     */
    function addAllowedSenderAddress(address _address) public onlyOwner whenLockingTransfers {
        _addAllowedAddress(_address, _allowedSenderAddressMap, _allowedSenderAddressArray);
    }


    /**
     * remove an address from the list of allowedSenderAddresses
     */
    function removeAllowedSenderAddress(address _address) public onlyOwner whenLockingTransfers {
        _removeAllowedAddress(_address, _allowedSenderAddressMap, _allowedSenderAddressArray);
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
        require(lockingTransfers, "Function only available when locking transfers");
        _;
    }

    function _updateUnlockDate(address _from, address _to) private returns (bool){
        if (_unlockDates[_to] > 0 && _unlockDates[_to] <= now) {
            // if receiver's unlock date has passed, no need to update anything
            return true;
        }

        if (_allowedSenderAddressMap[_to]) {
            // don't bother assigning an unlock date to allowed addresses
            return true;
        }

        if (!_allowedSenderAddressMap[_from]) {
            // if receiving from unlocked user (regardless of  previous unlock date), set unlock to now
            // an unlocked user sent you this
            _unlockDates[_to] = now;
        } else if (_unlockDates[_to] == 0) {
            // an allowed sender sent you this
            // The user has no unlockDate (first time we're transferring token to them)
            // if so: calculate the future date and save in _unlockDates
            _unlockDates[_to] = now + _lockDuration;
        }
        // The user has a future unlock date, don't update it

        return true;
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

        // Require the "to" address is in the allowed list or time has elapsed or the the sender is allowed (or is owner)
        require(_allowedSenderAddressMap[msg.sender] || _allowedReceiverAddressMap[to] ||
            (_unlockDates[msg.sender] > 0 &&_unlockDates[msg.sender] <= now),
            "Transfer not allowed, unlock date not yet reached");

        // transfer the token amount
        super.transfer(to, value);

        return _updateUnlockDate(msg.sender, to);
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
        require(_allowedSenderAddressMap[from] || _allowedReceiverAddressMap[to] ||
            (_unlockDates[from] > 0 &&_unlockDates[from] <= now),
            "Transfer not allowed, unlock date not yet reached");

        // transfer the token amount
        super.transferFrom(from, to, value);

        return _updateUnlockDate(from, to);
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
        _unlockDates[_address] = unlockDate;
        return true;
    }
}