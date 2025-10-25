// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title HederaResponseCodes
 * @notice Library containing Hedera Token Service response codes
 */
library HederaResponseCodes {
    int32 internal constant SUCCESS = 22;
    int32 internal constant INVALID_TOKEN_ID = 31;
    int32 internal constant INVALID_ACCOUNT_ID = 26;
    int32 internal constant INSUFFICIENT_TOKEN_BALANCE = 190;
}
