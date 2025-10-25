// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ReentrancyGuard
 * @notice Contract module that helps prevent reentrant calls to a function
 * @dev Provides a modifier that prevents a contract from calling itself, directly or indirectly
 */
abstract contract ReentrancyGuard {
    // Reentrancy status codes
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /// @notice Error thrown when reentrancy is detected
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @notice Prevents a contract from calling itself, directly or indirectly
     * @dev Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered
        _status = NOT_ENTERED;
    }

    /**
     * @notice Returns true if the reentrancy guard is currently set to "entered"
     * @return True if the guard is entered
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}
