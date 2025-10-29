// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/**
 * @title MaliciousReentrancy
 * @notice Mock contract to test reentrancy protection
 * @dev Used in testing to ensure ReentrancyGuard works correctly
 */
contract MaliciousReentrancy {
    address public targetDistributor;
    uint256 public attackCount;
    uint256 public maxAttacks = 3;

    event AttackAttempted(uint256 count);
    event AttackFailed(string reason);

    constructor(address _targetDistributor) {
        targetDistributor = _targetDistributor;
    }

    /**
     * @notice Attempt to reenter the target contract
     */
    function attack() external payable {
        attackCount = 0;
        (bool success, ) = targetDistributor.call(abi.encodeWithSignature("claimHbar()"));

        if (!success) {
            emit AttackFailed("Initial attack failed");
        }
    }

    /**
     * @notice Receive function - attempts to reenter on HBAR receipt
     */
    receive() external payable {
        attackCount++;
        emit AttackAttempted(attackCount);

        if (attackCount < maxAttacks) {
            // Attempt reentrancy
            (bool success, ) = targetDistributor.call(abi.encodeWithSignature("claimHbar()"));

            if (!success) {
                emit AttackFailed("Reentrancy blocked");
            }
        }
    }

    /**
     * @notice Set maximum attack attempts
     */
    function setMaxAttacks(uint256 _max) external {
        maxAttacks = _max;
    }

    /**
     * @notice Withdraw any HBAR received
     */
    function withdraw() external {
        payable(msg.sender).transfer(address(this).balance);
    }
}
