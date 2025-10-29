// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/**
 * @title Ownable
 * @notice Contract module providing basic access control mechanism
 * @dev Owner account is granted exclusive access to specific functions
 */
abstract contract Ownable {
    address private _owner;

    /// @notice Emitted when ownership is transferred
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /// @notice Error thrown when caller is not the owner
    error OwnableUnauthorizedAccount(address account);

    /// @notice Error thrown when trying to set invalid owner
    error OwnableInvalidOwner(address owner);

    /**
     * @notice Initializes the contract setting the deployer as the initial owner
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @notice Throws if called by any account other than the owner
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @notice Returns the address of the current owner
     * @return The owner address
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @notice Throws if the sender is not the owner
     */
    function _checkOwner() internal view virtual {
        if (owner() != msg.sender) {
            revert OwnableUnauthorizedAccount(msg.sender);
        }
    }

    /**
     * @notice Leaves the contract without owner (renounces ownership)
     * @dev Can only be called by the current owner
     * WARNING: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @notice Transfers ownership of the contract to a new account
     * @param newOwner The address of the new owner
     * @dev Can only be called by the current owner
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @notice Transfers ownership of the contract to a new account
     * @param newOwner The address of the new owner
     * @dev Internal function without access restriction
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
