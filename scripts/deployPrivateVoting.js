// scripts/deploy-pvm.js
// Deploys PrivateVoting from pre-compiled .pvm + .abi artifacts in build/
// produced by native resolc + solc compilation on Linux.
//
// Does NOT recompile — reads bytecode and ABI directly from build/ folder.
//
// Usage:
//   npx hardhat run scripts/deploy-pvm.js --network polkadotTestnet
//   npx hardhat run scripts/deploy-pvm.js --network passetHub
//   npx hardhat run scripts/deploy-pvm.js --network localNode

"use strict";

const fs   = require("fs");
const path = require("path");

// ── Paths ─────────────────────────────────────────────────────────────────────

const BUILD_DIR = path.resolve(__dirname, "../build");

const PVM_FILE = path.join(BUILD_DIR, "PrivateVoting.sol:PrivateVoting.pvm");
const ABI_FILE = path.join(BUILD_DIR, "PrivateVoting.abi");

// ── Read build artifacts ──────────────────────────────────────────────────────

function loadArtifacts() {
    if (!fs.existsSync(PVM_FILE)) {
        throw new Error(`PVM bytecode not found: ${PVM_FILE}\nRun: ./resolc-native --bin --abi contracts/PrivateVoting.sol -o build/`);
    }
    if (!fs.existsSync(ABI_FILE)) {
        throw new Error(`ABI not found: ${ABI_FILE}\nRun: ./resolc-native --bin --abi contracts/PrivateVoting.sol -o build/`);
    }

    // .pvm file is raw hex — prefix with 0x for ethers
    const pvmHex  = fs.readFileSync(PVM_FILE, "utf-8").trim();
    const bytecode = pvmHex.startsWith("0x") ? pvmHex : "0x" + pvmHex;

    const abi = JSON.parse(fs.readFileSync(ABI_FILE, "utf-8"));

    console.log(`  PVM bytecode: ${(bytecode.length - 2) / 2} bytes`);
    console.log(`  ABI entries : ${abi.length}`);

    return { bytecode, abi };
}

// ── Gas settings per network ──────────────────────────────────────────────────

async function getGasOverrides(provider, chainId) {
    if (chainId === 420420417n || chainId === 420420420n) {
        // Polkadot testnets — baseFee is 1 wei, Hardhat estimation returns 0.
        // Set explicit EIP-1559 values so the network accepts the transaction.
        return {
            maxFeePerGas:         ethers.parseUnits("1500", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("50",   "gwei"),
        };
    }
    // Local networks — let ethers estimate
    return {};
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const [deployer] = await ethers.getSigners();
    const network    = await ethers.provider.getNetwork();
    const chainId    = network.chainId;

    console.log("\n══════════════════════════════════════════════════════════");
    console.log("  PrivateVoting — deploy from pre-compiled PVM artifacts");
    console.log("══════════════════════════════════════════════════════════");
    console.log(`  Network  : ${network.name} (chainId ${chainId})`);
    console.log(`  Deployer : ${deployer.address}`);
    console.log(`  Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} PAS\n`);

    // ── Load artifacts ────────────────────────────────────────────────────────
    console.log("Loading build artifacts...");
    const { bytecode, abi } = loadArtifacts();

    // ── Keyholder addresses ───────────────────────────────────────────────────
    // Set via env vars or hardcode here.
    // These must be addresses whose private keys you control —
    // they will need to call submitPublicKeyShare() after deployment.
    const KH0 = process.env.KH0_ADDRESS || "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
    const KH1 = process.env.KH1_ADDRESS || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const KH2 = process.env.KH2_ADDRESS || "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

    // Verifier: address(1) = placeholder (BN128 precompiles unavailable on PolkaVM)
    const VERIFIER = "0x0000000000000000000000000000000000000001";

    console.log("\nConstructor arguments:");
    console.log(`  keyholder0 : ${KH0}`);
    console.log(`  keyholder1 : ${KH1}`);
    console.log(`  keyholder2 : ${KH2}`);
    console.log(`  verifier   : ${VERIFIER} (placeholder)`);

    // ── Gas overrides ─────────────────────────────────────────────────────────
    const overrides = await getGasOverrides(ethers.provider, chainId);
    if (Object.keys(overrides).length > 0) {
        console.log("\nGas overrides (EIP-1559):");
        console.log(`  maxFeePerGas        : ${ethers.formatUnits(overrides.maxFeePerGas, "gwei")} gwei`);
        console.log(`  maxPriorityFeePerGas: ${ethers.formatUnits(overrides.maxPriorityFeePerGas, "gwei")} gwei`);
    } else {
        console.log("\nGas: auto-estimated (local network)");
    }

    // ── Deploy ────────────────────────────────────────────────────────────────
    console.log("\nDeploying...");

    const factory  = new ethers.ContractFactory(abi, bytecode, deployer);
    const contract = await factory.deploy(KH0, KH1, KH2, VERIFIER, overrides);

    console.log(`  Tx hash  : ${contract.deploymentTransaction().hash}`);
    console.log("  Waiting for confirmation...");

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    // ── Write deployment record ───────────────────────────────────────────────
    const deploymentRecord = {
        network:         network.name,
        chainId:         chainId.toString(),
        contractAddress: address,
        deployer:        deployer.address,
        keyholder0:      KH0,
        keyholder1:      KH1,
        keyholder2:      KH2,
        verifier:        VERIFIER,
        txHash:          contract.deploymentTransaction().hash,
        deployedAt:      new Date().toISOString(),
        buildArtifacts: {
            pvm: PVM_FILE,
            abi: ABI_FILE,
        },
    };

    const outFile = path.join(BUILD_DIR, `deployment-${chainId}.json`);
    fs.writeFileSync(outFile, JSON.stringify(deploymentRecord, null, 2));

    console.log("\n══════════════════════════════════════════════════════════");
    console.log("  Deployed successfully");
    console.log(`  Address  : ${address}`);
    console.log(`  Record   : ${outFile}`);
    console.log("══════════════════════════════════════════════════════════");
    console.log("\n  Update these files with the new address:");
    console.log("    test-dkg-onchain.js  → CONTRACT_ADDRESS");
    console.log("    test-complete.js     → CONTRACT_ADDRESS");
    console.log("    frontend/src/utils/contractUtils.js\n");
}

main().catch((err) => {
    console.error("\nDeploy failed:", err.message ?? err);
    process.exit(1);
});