require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");
require("dotenv").config();

module.exports = {
    solidity: {
        version: "0.8.28",
        settings: {
            // viaIR lets the compiler restructure stack layout before codegen.
            // Required here because BabyJubJub's _modInverse loop exhausts the
            // 16-slot EVM stack without it. resolc respects this flag.
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
            maxFeePerGas: 30000000000,        // 30 gwei
            maxPriorityFeePerGas: 2000000000, // 2 gwei
        },
    },

    ignition: {
        requiredConfirmations: 1,
    },
};