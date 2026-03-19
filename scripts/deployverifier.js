require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");


const BUILD_DIR = path.join(__dirname, "..", "build");

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.PASEO_RPC_URL);
    const wallet   = new ethers.Wallet(process.env.PASEO_PK, provider);

    console.log("Deployer:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance: ", ethers.formatEther(balance), "PAS");

    if (balance === 0n) {
        console.error("No balance");
        process.exit(1);
    }

    // ── Read combined JSON ─────────────────────────────────────────────────────
    const combined = JSON.parse(
        fs.readFileSync(path.join(BUILD_DIR, "Verifier.json"), "utf8")
    );

    const contractKey = Object.keys(combined.contracts).find(k => k.includes("contracts/Verifier.sol:Groth16Verifier"));
    if (!contractKey) {
        console.error("Groth16Verifier not found in Verifier.json");
        console.error("Available keys:", Object.keys(combined.contracts));
        process.exit(1);
    }

    const contractData = combined.contracts[contractKey];
    const bytecode     = "0x" + contractData.bin;
    const abi          = contractData.abi;

    console.log("\nBytecode length:", contractData.bin.length / 2, "bytes");
    console.log("Bytecode prefix:", bytecode.slice(0, 16), "...");
    console.log("Object format:  ", contractData["object-format"]);

    // ── Deploy ─────────────────────────────────────────────────────────────────
    console.log("\nDeploying Groth16Verifier...");

    const factory  = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy({ gasLimit: 10_000_000n });

    console.log("Deploy tx:", contract.deploymentTransaction().hash);
    console.log("Waiting for confirmation...");

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n✓ Groth16Verifier deployed at:", address);
    console.log("Set this as VERIFIER_ADDRESS in your .env");

}

main().catch((err) => {
    console.error("Deploy failed:", err);
    process.exit(1);
});

