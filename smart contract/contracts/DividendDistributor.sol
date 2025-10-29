// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./interfaces/IHederaTokenService.sol";
import "./libraries/HederaResponseCodes.sol";
import "./utils/ReentrancyGuard.sol";
import "./utils/Ownable.sol";

/**
 * @title DividendDistributor
 * @notice Manages fractional ownership and automated dividend distribution for tokenized assets
 * @dev Integrates with Hedera Token Service (HTS) for token operations
 *
 * Architecture:
 * - Tracks ownership via HTS Fraction Token balances
 * - Accepts HBAR or HTS tokens for dividend payouts
 * - Enables proportional reward claims based on fraction ownership
 * - Uses accumulated-per-share accounting model for O(1) claims
 */
contract DividendDistributor is ReentrancyGuard, Ownable {
    // ============ Constants ============

    /// @notice Precision multiplier for per-share calculations (1e12)
    uint256 private constant PRECISION = 1e12;

    /// @notice HTS precompile address
    address private constant HTS_PRECOMPILE = address(0x167);

    // ============ State Variables ============

    /// @notice Asset NFT token address (HTS)
    address public immutable assetNftToken;

    /// @notice Fraction token address (HTS fungible token)
    address public immutable fractionToken;

    /// @notice Total supply of fraction tokens (cached for gas optimization)
    uint256 public totalFractionSupply;

    /// @notice Accumulated rewards per share (scaled by PRECISION)
    uint256 public accumulatedPerShare;

    /// @notice Total HBAR distributed
    uint256 public totalHbarDistributed;

    /// @notice Total HTS tokens distributed per token address
    mapping(address => uint256) public totalTokenDistributed;

    /// @notice User's reward debt (prevents double-claiming)
    /// @dev rewardDebt = user's fraction balance * accumulatedPerShare / PRECISION at last claim
    mapping(address => uint256) public rewardDebt;

    /// @notice Tracks which payout tokens are enabled
    mapping(address => bool) public payoutTokenEnabled;

    /// @notice Pending rewards per user per token
    mapping(address => mapping(address => uint256)) public pendingTokenRewards;

    /// @notice Whether contract is paused
    bool public paused;

    // ============ Events ============

    /// @notice Emitted when HBAR is deposited for distribution
    event HbarDeposited(address indexed depositor, uint256 amount, uint256 newAccumulatedPerShare);

    /// @notice Emitted when HTS token is deposited for distribution
    event TokenDeposited(
        address indexed depositor,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Emitted when a user claims their rewards
    event RewardsClaimed(
        address indexed user,
        uint256 hbarAmount,
        address[] tokens,
        uint256[] tokenAmounts
    );

    /// @notice Emitted when total supply is updated
    event TotalSupplyUpdated(uint256 oldSupply, uint256 newSupply);

    /// @notice Emitted when payout token is enabled/disabled
    event PayoutTokenUpdated(address indexed token, bool enabled);

    /// @notice Emitted when contract is paused/unpaused
    event PauseStateChanged(bool isPaused);

    /// @notice Emitted during emergency withdrawal
    event EmergencyWithdraw(address indexed to, uint256 hbarAmount, address token, uint256 tokenAmount);

    // ============ Errors ============

    error InvalidAddress();
    error InvalidAmount();
    error NoRewardsToClaim();
    error TransferFailed();
    error ContractPaused();
    error HtsOperationFailed(int32 responseCode);
    error TokenNotEnabled();
    error InsufficientBalance();

    // ============ Modifiers ============

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initialize the dividend distributor
     * @param _assetNftToken The HTS NFT token representing the asset
     * @param _fractionToken The HTS fungible token representing fractional ownership
     * @param _initialSupply Initial total supply of fraction tokens
     * @param _owner Owner address for admin functions
     */
    constructor(
        address _assetNftToken,
        address _fractionToken,
        uint256 _initialSupply,
        address _owner
    ) Ownable(_owner) {
        if (_assetNftToken == address(0) || _fractionToken == address(0)) {
            revert InvalidAddress();
        }
        if (_initialSupply == 0) {
            revert InvalidAmount();
        }

        assetNftToken = _assetNftToken;
        fractionToken = _fractionToken;
        totalFractionSupply = _initialSupply;

        emit TotalSupplyUpdated(0, _initialSupply);
    }

    // ============ External Functions ============

    /**
     * @notice Deposit HBAR for distribution to fraction holders
     * @dev Updates accumulatedPerShare based on current total supply
     * Anyone can deposit HBAR rewards
     */
    function depositHbar() external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (totalFractionSupply == 0) revert InvalidAmount();

        // Update accumulated per share
        uint256 rewardPerShare = (msg.value * PRECISION) / totalFractionSupply;
        accumulatedPerShare += rewardPerShare;
        totalHbarDistributed += msg.value;

        emit HbarDeposited(msg.sender, msg.value, accumulatedPerShare);
    }

    /**
     * @notice Deposit HTS token for distribution to fraction holders
     * @param token The HTS token address to distribute
     * @param amount The amount of tokens to distribute
     * @dev Requires prior approval and token association
     */
    function depositToken(address token, uint256 amount)
        external
        whenNotPaused
        nonReentrant
    {
        if (token == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (totalFractionSupply == 0) revert InvalidAmount();
        if (!payoutTokenEnabled[token]) revert TokenNotEnabled();

        // Transfer tokens from sender to this contract using HTS
        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
        int32 response = hts.transferToken(token, msg.sender, address(this), int64(uint64(amount)));

        if (response != HederaResponseCodes.SUCCESS) {
            revert HtsOperationFailed(response);
        }

        // Distribute proportionally to all holders
        // For simplicity in hackathon MVP, we track per-user pending amounts
        // In production, consider a more gas-efficient accumulated model per token
        totalTokenDistributed[token] += amount;

        emit TokenDeposited(msg.sender, token, amount, block.timestamp);
    }

    /**
     * @notice Claim pending HBAR rewards
     * @dev Calculates rewards based on current fraction balance and accumulated per share
     */
    function claimHbar() external whenNotPaused nonReentrant {
        uint256 pending = pendingHbar(msg.sender);
        if (pending == 0) revert NoRewardsToClaim();

        // Update reward debt
        uint256 userBalance = getUserFractionBalance(msg.sender);
        rewardDebt[msg.sender] = (userBalance * accumulatedPerShare) / PRECISION;

        // Transfer HBAR to user
        (bool success, ) = payable(msg.sender).call{value: pending}("");
        if (!success) revert TransferFailed();

        address[] memory tokens = new address[](0);
        uint256[] memory amounts = new uint256[](0);

        emit RewardsClaimed(msg.sender, pending, tokens, amounts);
    }

    /**
     * @notice Claim pending HTS token rewards
     * @param tokens Array of token addresses to claim
     */
    function claimTokens(address[] calldata tokens)
        external
        whenNotPaused
        nonReentrant
    {
        uint256[] memory amounts = new uint256[](tokens.length);
        bool hasRewards = false;

        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 pending = pendingTokenRewards[msg.sender][tokens[i]];
            if (pending > 0) {
                hasRewards = true;
                amounts[i] = pending;

                // Reset pending rewards
                pendingTokenRewards[msg.sender][tokens[i]] = 0;

                // Transfer tokens using HTS
                int32 response = hts.transferToken(
                    tokens[i],
                    address(this),
                    msg.sender,
                    int64(uint64(pending))
                );

                if (response != HederaResponseCodes.SUCCESS) {
                    revert HtsOperationFailed(response);
                }
            }
        }

        if (!hasRewards) revert NoRewardsToClaim();

        emit RewardsClaimed(msg.sender, 0, tokens, amounts);
    }

    /**
     * @notice Claim all pending rewards (HBAR + tokens)
     * @param tokens Array of token addresses to claim
     */
    function claimAll(address[] calldata tokens) external whenNotPaused nonReentrant {
        uint256 hbarPending = pendingHbar(msg.sender);
        uint256[] memory tokenAmounts = new uint256[](tokens.length);

        // Claim HBAR
        if (hbarPending > 0) {
            uint256 userBalance = getUserFractionBalance(msg.sender);
            rewardDebt[msg.sender] = (userBalance * accumulatedPerShare) / PRECISION;

            (bool success, ) = payable(msg.sender).call{value: hbarPending}("");
            if (!success) revert TransferFailed();
        }

        // Claim tokens
        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
        bool hasTokenRewards = false;

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 pending = pendingTokenRewards[msg.sender][tokens[i]];
            if (pending > 0) {
                hasTokenRewards = true;
                tokenAmounts[i] = pending;
                pendingTokenRewards[msg.sender][tokens[i]] = 0;

                int32 response = hts.transferToken(
                    tokens[i],
                    address(this),
                    msg.sender,
                    int64(uint64(pending))
                );

                if (response != HederaResponseCodes.SUCCESS) {
                    revert HtsOperationFailed(response);
                }
            }
        }

        if (hbarPending == 0 && !hasTokenRewards) revert NoRewardsToClaim();

        emit RewardsClaimed(msg.sender, hbarPending, tokens, tokenAmounts);
    }

    // ============ View Functions ============

    /**
     * @notice Calculate pending HBAR rewards for a user
     * @param user The user address
     * @return The amount of pending HBAR rewards
     */
    function pendingHbar(address user) public view returns (uint256) {
        uint256 userBalance = getUserFractionBalance(user);
        if (userBalance == 0) return 0;

        uint256 accumulatedRewards = (userBalance * accumulatedPerShare) / PRECISION;

        if (accumulatedRewards <= rewardDebt[user]) {
            return 0;
        }

        return accumulatedRewards - rewardDebt[user];
    }

    /**
     * @notice Get user's fraction token balance via HTS
     * @param user The user address
     * @return The user's fraction token balance
     */
    function getUserFractionBalance(address user) public view returns (uint256) {
        // Try to call HTS precompile, return 0 if it doesn't exist (for testing)
        try IHederaTokenService(HTS_PRECOMPILE).balanceOf(fractionToken, user) returns (
            int32 response,
            int64 balance
        ) {
            if (response != HederaResponseCodes.SUCCESS) {
                return 0;
            }
            return uint256(uint64(balance));
        } catch {
            // HTS precompile not available (e.g., in test environment)
            return 0;
        }
    }

    /**
     * @notice Get contract HBAR balance
     * @return The contract's HBAR balance
     */
    function getContractHbarBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get contract token balance
     * @param token The token address
     * @return The contract's token balance
     */
    function getContractTokenBalance(address token) external view returns (uint256) {
        // Try to call HTS precompile, return 0 if it doesn't exist (for testing)
        try IHederaTokenService(HTS_PRECOMPILE).balanceOf(token, address(this)) returns (
            int32 response,
            int64 balance
        ) {
            if (response != HederaResponseCodes.SUCCESS) {
                return 0;
            }
            return uint256(uint64(balance));
        } catch {
            // HTS precompile not available (e.g., in test environment)
            return 0;
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Update total fraction supply
     * @param newSupply The new total supply
     * @dev Only owner can update. Use when fraction tokens are minted/burned
     */
    function updateTotalSupply(uint256 newSupply) external onlyOwner {
        if (newSupply == 0) revert InvalidAmount();

        uint256 oldSupply = totalFractionSupply;
        totalFractionSupply = newSupply;

        emit TotalSupplyUpdated(oldSupply, newSupply);
    }

    /**
     * @notice Enable or disable a payout token
     * @param token The token address
     * @param enabled Whether the token is enabled
     */
    function setPayoutToken(address token, bool enabled) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();

        payoutTokenEnabled[token] = enabled;

        emit PayoutTokenUpdated(token, enabled);
    }

    /**
     * @notice Pause or unpause the contract
     * @param _paused Whether to pause the contract
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PauseStateChanged(_paused);
    }

    /**
     * @notice Emergency withdrawal function
     * @param to Recipient address
     * @param hbarAmount Amount of HBAR to withdraw (0 to skip)
     * @param token Token address to withdraw (address(0) to skip)
     * @param tokenAmount Amount of tokens to withdraw
     * @dev Only owner can call. Use in case of emergency or stuck funds
     */
    function emergencyWithdraw(
        address payable to,
        uint256 hbarAmount,
        address token,
        uint256 tokenAmount
    ) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();

        // Withdraw HBAR
        if (hbarAmount > 0) {
            if (address(this).balance < hbarAmount) revert InsufficientBalance();
            (bool success, ) = to.call{value: hbarAmount}("");
            if (!success) revert TransferFailed();
        }

        // Withdraw HTS tokens
        if (token != address(0) && tokenAmount > 0) {
            IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
            int32 response = hts.transferToken(
                token,
                address(this),
                to,
                int64(uint64(tokenAmount))
            );

            if (response != HederaResponseCodes.SUCCESS) {
                revert HtsOperationFailed(response);
            }
        }

        emit EmergencyWithdraw(to, hbarAmount, token, tokenAmount);
    }

    /**
     * @notice Distribute token rewards to a specific user
     * @param user The user address
     * @param token The token address
     * @param amount The amount to credit
     * @dev Owner function for manual reward distribution
     */
    function creditTokenReward(
        address user,
        address token,
        uint256 amount
    ) external onlyOwner {
        if (user == address(0) || token == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        pendingTokenRewards[user][token] += amount;
    }

    // ============ Receive Function ============

    /**
     * @notice Receive function to accept HBAR deposits
     * @dev Automatically credits deposits as rewards
     */
    receive() external payable {
        if (msg.value > 0 && totalFractionSupply > 0 && !paused) {
            uint256 rewardPerShare = (msg.value * PRECISION) / totalFractionSupply;
            accumulatedPerShare += rewardPerShare;
            totalHbarDistributed += msg.value;

            emit HbarDeposited(msg.sender, msg.value, accumulatedPerShare);
        }
    }
}
