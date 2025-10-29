// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "../interfaces/IHederaTokenService.sol";
import "../libraries/HederaResponseCodes.sol";

/**
 * @title MockHederaTokenService
 * @notice Mock implementation of IHederaTokenService for testing
 * @dev This mock allows testing without actual HTS integration
 */
contract MockHederaTokenService is IHederaTokenService {
    // Mock storage
    mapping(address => mapping(address => int64)) private balances;
    mapping(address => mapping(address => bool)) private associations;

    // Events for testing
    event MockTransfer(address token, address from, address to, int64 amount);
    event MockAssociation(address account, address token);

    /**
     * @notice Mock token transfer
     */
    function transferToken(
        address token,
        address from,
        address to,
        int64 amount
    ) external override returns (int32 responseCode) {
        if (balances[token][from] < amount) {
            return HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE;
        }

        balances[token][from] -= amount;
        balances[token][to] += amount;

        emit MockTransfer(token, from, to, amount);
        return HederaResponseCodes.SUCCESS;
    }

    /**
     * @notice Mock bulk token transfer
     */
    function transferTokens(
        address token,
        address[] memory from,
        address[] memory to,
        int64[] memory amounts
    ) external override returns (int32 responseCode) {
        require(from.length == to.length && to.length == amounts.length, "Array length mismatch");

        for (uint i = 0; i < from.length; i++) {
            if (balances[token][from[i]] < amounts[i]) {
                return HederaResponseCodes.INSUFFICIENT_TOKEN_BALANCE;
            }

            balances[token][from[i]] -= amounts[i];
            balances[token][to[i]] += amounts[i];

            emit MockTransfer(token, from[i], to[i], amounts[i]);
        }

        return HederaResponseCodes.SUCCESS;
    }

    /**
     * @notice Mock balance query
     */
    function balanceOf(address token, address account)
        external
        view
        override
        returns (int32 responseCode, int64 balance)
    {
        return (HederaResponseCodes.SUCCESS, balances[token][account]);
    }

    /**
     * @notice Mock token association
     */
    function associateToken(address account, address token)
        external
        override
        returns (int32 responseCode)
    {
        associations[account][token] = true;
        emit MockAssociation(account, token);
        return HederaResponseCodes.SUCCESS;
    }

    /**
     * @notice Mock association check
     */
    function isAssociated(address account, address token)
        external
        view
        override
        returns (int32 responseCode, bool associated)
    {
        return (HederaResponseCodes.SUCCESS, associations[account][token]);
    }

    // ============ Test Helper Functions ============

    /**
     * @notice Mint tokens to an account (for testing)
     */
    function mintTo(address token, address account, int64 amount) external {
        balances[token][account] += amount;
        associations[account][token] = true;
    }

    /**
     * @notice Set balance directly (for testing)
     */
    function setBalance(address token, address account, int64 amount) external {
        balances[token][account] = amount;
    }

    /**
     * @notice Set association status (for testing)
     */
    function setAssociation(address account, address token, bool associated) external {
        associations[account][token] = associated;
    }
}
