// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

/**
 * @title IHederaTokenService
 * @notice Interface for interacting with Hedera Token Service (HTS) via system contract
 * @dev HTS precompile is located at address 0x167
 * @dev Response codes: SUCCESS=22, INVALID_TOKEN_ID=31, INVALID_ACCOUNT_ID=26, INSUFFICIENT_TOKEN_BALANCE=190
 */
interface IHederaTokenService {

    /**
     * @notice Transfer tokens from one account to another
     * @param token The token address
     * @param from The sender account
     * @param to The recipient account
     * @param amount The amount to transfer
     * @return responseCode The response code from HTS
     */
    function transferToken(
        address token,
        address from,
        address to,
        int64 amount
    ) external returns (int32 responseCode);

    /**
     * @notice Transfer tokens using the transferFrom pattern
     * @param token The token address
     * @param from The sender accounts
     * @param to The recipient accounts
     * @param amounts The amounts to transfer
     * @return responseCode The response code from HTS
     */
    function transferTokens(
        address token,
        address[] memory from,
        address[] memory to,
        int64[] memory amounts
    ) external returns (int32 responseCode);

    /**
     * @notice Get the balance of an account for a specific token
     * @param token The token address
     * @param account The account to query
     * @return responseCode The response code
     * @return balance The token balance
     */
    function balanceOf(address token, address account)
        external
        view
        returns (int32 responseCode, int64 balance);

    /**
     * @notice Associate a token with an account
     * @param account The account to associate
     * @param token The token address
     * @return responseCode The response code from HTS
     */
    function associateToken(address account, address token)
        external
        returns (int32 responseCode);

    /**
     * @notice Check if an account is associated with a token
     * @param account The account to check
     * @param token The token address
     * @return responseCode The response code
     * @return associated Whether the account is associated
     */
    function isAssociated(address account, address token)
        external
        view
        returns (int32 responseCode, bool associated);
}
