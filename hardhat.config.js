require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-polkadot");
require("dotenv").config();

module.exports = {
    solidity: "0.8.28",
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
        paseo: {
            polkavm: true,
            url: "https://testnet-passet-hub-eth-rpc.polkadot.io",
            accounts: [process.env.PASEO_PK],
        },
    },
};