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

    // ── Read combined JSON output from resolc ──────────────────────────────────
    const combined = JSON.parse(
        fs.readFileSync(path.join(BUILD_DIR, "PrivateVoting.json"), "utf8")
    );

    const contractKey = "contracts/PrivateVoting.sol:PrivateVoting";


    const contractData = combined.contracts[contractKey];
    const bytecode     = "0x" + contractData.bin;
    const abi          = contractData.abi;

    console.log("\nBytecode length:", contractData.bin.length / 2, "bytes");
    console.log("Bytecode prefix:", bytecode.slice(0, 16), "...");
    console.log("Object format:  ", contractData["object-format"]); // should say PVM

    // ── Deploy ─────────────────────────────────────────────────────────────────
    console.log("\nDeploying PrivateVoting...");

    // constructor(address keyholder0, address keyholder1, address keyholder2, address verifier)
    const KEYHOLDER_0_PUB      = process.env.KEYHOLDER_0_PUB;
    const KEYHOLDER_1_PUB      = process.env.KEYHOLDER_1_PUB;
    const KEYHOLDER_2_PUB      = process.env.KEYHOLDER_2_PUB;
    const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS;

    if (!VERIFIER_ADDRESS) {
        console.error("VERIFIER_ADDRESS not set in .env — deploy Verifier.sol first");
        process.exit(1);
    }

    console.log("Keyholder 0:    ", KEYHOLDER_0_PUB);
    console.log("Keyholder 1:    ", KEYHOLDER_1_PUB);
    console.log("Keyholder 2:    ", KEYHOLDER_2_PUB);
    console.log("Verifier:       ", VERIFIER_ADDRESS);

    const factory  = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy(
        KEYHOLDER_0_PUB,
        KEYHOLDER_1_PUB,
        KEYHOLDER_2_PUB,
        VERIFIER_ADDRESS,
        { gasLimit: 10_000_000n }
    );

    console.log("Deploy tx:", contract.deploymentTransaction().hash);
    console.log("Waiting for confirmation...");

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n✓ PrivateVoting deployed at:", address);

    
}

main().catch((err) => {
    console.error("Deploy failed:", err);
    process.exit(1);
});