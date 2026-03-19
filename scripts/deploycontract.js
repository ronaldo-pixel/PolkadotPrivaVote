/**
 * Deploy PrecompileTest to Passet Hub
 *
 * Usage:
 *   node scripts/deployPrecompileTest.js
 *
 * Prerequisites:
 *   - .env with PASEO_PK set
 *   - Contract compiled:
 *     ./resolc-native --bin --abi contracts/PrecompileTest.sol -o build/ --overwrite
 */

require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL    = "https://eth-rpc-testnet.polkadot.io/";
const BUILD_DIR  = path.join(__dirname, "..", "build");

async function main() {
    // ── Setup ──────────────────────────────────────────────────────────────────
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet   = new ethers.Wallet(process.env.PASEO_PK, provider);

    console.log("Deployer:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance: ", ethers.formatEther(balance), "PAS");

    if (balance === 0n) {
        console.error("No balance — get tokens from https://faucet.polkadot.io/?parachain=1111");
        process.exit(1);
    }

    // ── Read compiled artifacts ────────────────────────────────────────────────
    // resolc outputs .pvm binary and .abi json
    const pvmPath = path.join(BUILD_DIR, "Groth16Verifier.pvm");
    const abiPath = path.join(BUILD_DIR, "Groth16Verifier.abi");

    if (!fs.existsSync(pvmPath)) {
        console.error(`PVM binary not found at ${pvmPath}`);
        console.error("Compile first:");
        console.error("  ./resolc-native --bin --abi contracts/PrecompileTest.sol -o build/ --overwrite");
        process.exit(1);
    }

    // .pvm is a binary file — read as hex
    const bytecode = "0x" + fs.readFileSync(pvmPath).toString("hex");
    const abi      = JSON.parse(fs.readFileSync(abiPath, "utf8"));

    console.log("\nBytecode length:", bytecode.length / 2 - 1, "bytes");
    console.log("Bytecode prefix:", bytecode.slice(0, 16), "...");

    // ── Deploy ─────────────────────────────────────────────────────────────────
    console.log("\nDeploying PrecompileTest...");

    const factory  = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy({
        gasLimit: 10_000_000n,
    });

    console.log("Deploy tx:", contract.deploymentTransaction().hash);
    console.log("Waiting for confirmation...");

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n✓ PrecompileTest deployed at:", address);
    console.log("\nSave this address — pass it to callPrecompileTest.js");

    // ── Save address to file ───────────────────────────────────────────────────
    fs.writeFileSync(
        path.join(__dirname, "..", "build", "deployedAddress.json"),
        JSON.stringify({ PrecompileTest: address }, null, 2)
    );
    console.log("Address saved to build/deployedAddress.json");
}

main().catch((err) => {
    console.error("Deploy failed:", err);
    process.exit(1);
});