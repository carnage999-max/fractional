// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./DividendDistributor.sol";

/**
 * @title FractionalFactory
 * @notice Factory contract for deploying DividendDistributor instances
 * @dev Simplifies deployment and tracking of dividend distributors
 */
contract FractionalFactory {
    // ============ State Variables ============

    /// @notice Array of all deployed distributors
    address[] public allDistributors;

    /// @notice Mapping from asset NFT to distributor address
    mapping(address => address) public assetToDistributor;

    /// @notice Mapping from fraction token to distributor address
    mapping(address => address) public fractionToDistributor;

    /// @notice Mapping to check if an address is a valid distributor
    mapping(address => bool) public isDistributor;

    /// @notice Contract owner
    address public owner;

    // ============ Events ============

    /// @notice Emitted when a new distributor is created
    event DistributorCreated(
        address indexed distributor,
        address indexed assetNft,
        address indexed fractionToken,
        uint256 totalSupply,
        address owner
    );

    /// @notice Emitted when ownership is transferred
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ Errors ============

    error Unauthorized();
    error InvalidAddress();
    error DistributorAlreadyExists();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
    }

    // ============ External Functions ============

    /**
     * @notice Create a new DividendDistributor
     * @param assetNft The HTS NFT token address
     * @param fractionToken The HTS fraction token address
     * @param totalSupply The total supply of fraction tokens
     * @param distributorOwner The owner of the new distributor
     * @return distributor The address of the newly created distributor
     */
    function createDistributor(
        address assetNft,
        address fractionToken,
        uint256 totalSupply,
        address distributorOwner
    ) external returns (address distributor) {
        if (assetNft == address(0) || fractionToken == address(0)) {
            revert InvalidAddress();
        }
        if (distributorOwner == address(0)) {
            revert InvalidAddress();
        }
        if (assetToDistributor[assetNft] != address(0)) {
            revert DistributorAlreadyExists();
        }
        if (fractionToDistributor[fractionToken] != address(0)) {
            revert DistributorAlreadyExists();
        }

        // Deploy new DividendDistributor
        DividendDistributor newDistributor = new DividendDistributor(
            assetNft,
            fractionToken,
            totalSupply,
            distributorOwner
        );

        distributor = address(newDistributor);

        // Record distributor
        allDistributors.push(distributor);
        assetToDistributor[assetNft] = distributor;
        fractionToDistributor[fractionToken] = distributor;
        isDistributor[distributor] = true;

        emit DistributorCreated(
            distributor,
            assetNft,
            fractionToken,
            totalSupply,
            distributorOwner
        );

        return distributor;
    }

    /**
     * @notice Get the total number of distributors
     * @return The count of all distributors
     */
    function getDistributorCount() external view returns (uint256) {
        return allDistributors.length;
    }

    /**
     * @notice Get distributor by index
     * @param index The index in the array
     * @return The distributor address
     */
    function getDistributorAt(uint256 index) external view returns (address) {
        require(index < allDistributors.length, "Index out of bounds");
        return allDistributors[index];
    }

    /**
     * @notice Get all distributors
     * @return Array of all distributor addresses
     */
    function getAllDistributors() external view returns (address[] memory) {
        return allDistributors;
    }

    /**
     * @notice Get distributor for an asset NFT
     * @param assetNft The asset NFT address
     * @return The distributor address
     */
    function getDistributorByAsset(address assetNft) external view returns (address) {
        return assetToDistributor[assetNft];
    }

    /**
     * @notice Get distributor for a fraction token
     * @param fractionToken The fraction token address
     * @return The distributor address
     */
    function getDistributorByFraction(address fractionToken) external view returns (address) {
        return fractionToDistributor[fractionToken];
    }

    /**
     * @notice Transfer factory ownership
     * @param newOwner The new owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();

        address oldOwner = owner;
        owner = newOwner;

        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
