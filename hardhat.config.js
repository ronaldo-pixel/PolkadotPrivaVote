require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");
require("dotenv").config();

module.exports = {
    solidity: {
        version: "0.8.28",
        settings: {
            viaIR: true,
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },

    resolc: {
        compilerSource: "npm",
        settings: {
            optimizer: {
                enabled: true,
                parameters: "z",
                fallbackOz: true,
                runs: 200,
            },
            standardJson: true,
        },
    },

    networks: {
        hardhat: {
            polkavm: true,
            nodeConfig: {
                nodeBinaryPath: "./bin/substrate-node",
                rpcPort: 8000,
                dev: true,
            },
            adapterConfig: {
                adapterBinaryPath: "./bin/eth-rpc",
                dev: true,
            },
        },
        localNode: {
            polkavm: true,
            url: "http://127.0.0.1:8545",
        },
        passetHub: {
            polkavm: true,
            url: "https://testnet-passet-hub-eth-rpc.polkadot.io",
            accounts: [process.env.PASEO_PK],
            ignition: {
                maxFeePerGas:         10_000_000_000n, // 10 gwei
                maxPriorityFeePerGas:  5_000_000_000n, //  5 gwei
                disableFeeBumping: false,
            },
        },
        polkadotTestnet: {
            polkavm: true,
            url: "https://services.polkadothub-rpc.com/testnet",
            chainId: 420420417,
            accounts: [
                process.env.PASEO_PK,
                process.env.PASEO_PK_1,
                process.env.PASEO_PK_2,
                process.env.PASEO_PK_3,
            ].filter(Boolean),
            // These go INSIDE ignition: {} — top-level gas fields are ignored by Ignition
            ignition: {
                maxFeePerGas:         1500000000000, // 10 gwei — covers baseFee fluctuations
                maxPriorityFeePerGas:  50000000000, //  5 gwei — must be > baseFee (currently 1)
                disableFeeBumping: false,
            },
        },
    },

    ignition: {
        requiredConfirmations: 1,
    },
};