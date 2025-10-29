// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.13",
        settings: {
          optimizer: { enabled: false, runs: 200 },
          evmVersion: "istanbul",
          metadata: { bytecodeHash: "none" },
        },
      },
    ],
  },
  networks: {
    local: {
      url: process.env.HEDERA_LOCAL_RPC_URL || "http://localhost:7546", // Example for local node
      accounts: [process.env.PRIVATE_KEY],
    },
    testnet: {
      url: process.env.HEDERA_TESTNET_URL || "https://testnet.hashio.io/api", // Example for testnet
      accounts: [process.env.PRIVATE_KEY],
    },
    mainnet: {
      url: process.env.HEDERA_MAINNET_URL || "https://mainnet.hashio.io/api", // Example for mainnet
      accounts: [process.env.PRIVATE_KEY],
    },
    // Add other networks here as needed
  },
  // You can add other configurations here, such as compiler settings or plugins [5]
};
