// scripts/deploy.js
// Deploys PrivateVoting directly without Hardhat Ignition.
// Gives full control over gas parameters — required for Polkadot testnet
// where Ignition's fee estimation produces transactions the network rejects.
//
// Usage:
//   npx hardhat run scripts/deploy.js --network polkadotTestnet
//   npx hardhat run scripts/deploy.js --network hardhat

"use strict";

require("dotenv").config();

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("\nDeploying PrivateVoting");
    console.log("  Deployer :", deployer.address);
    console.log("  Balance  :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "PAS");

    // ── Keyholder addresses ───────────────────────────────────────────────────
    // Set these to the actual keyholder addresses for your deployment.
    const KH0 = process.env.KH0_ADDRESS || "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
    const KH1 = process.env.KH1_ADDRESS || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const KH2 = process.env.KH2_ADDRESS || "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    const VERIFIER = "0x0000000000000000000000000000000000000001"; // placeholder

    console.log("  KH0      :", KH0);
    console.log("  KH1      :", KH1);
    console.log("  KH2      :", KH2);

    // ── Gas parameters ────────────────────────────────────────────────────────
    // Polkadot testnet baseFee = 1 wei. Priority must be > baseFee.
    // We set explicit values to bypass Hardhat's fee estimation entirely.
    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);

    let overrides = {};

    if (chainId === 420420417) {
        // polkadotTestnet — explicit EIP-1559 fees
        overrides = {
            maxFeePerGas:         ethers.parseUnits("1500", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("50",  "gwei"),
        };
        console.log("  Gas mode : EIP-1559 (polkadotTestnet)");
        console.log("  maxFeePerGas        :", ethers.formatUnits(overrides.maxFeePerGas, "gwei"), "gwei");
        console.log("  maxPriorityFeePerGas:", ethers.formatUnits(overrides.maxPriorityFeePerGas, "gwei"), "gwei");
    } else if (chainId === 420420420) {
        // passetHub testnet
        overrides = {
            maxFeePerGas:         ethers.parseUnits("10", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("2",  "gwei"),
        };
        console.log("  Gas mode : EIP-1559 (passetHub)");
    } else {
        // hardhat / localNode — let ethers estimate
        console.log("  Gas mode : auto (local)");
    }

    // ── Deploy ────────────────────────────────────────────────────────────────
    console.log("\nDeploying...");

    const Factory = await ethers.getContractFactory("PrivateVoting");
    const contract = await Factory.deploy(KH0, KH1, KH2, VERIFIER, overrides);

    console.log("  Tx hash  :", contract.deploymentTransaction().hash);
    console.log("  Waiting for confirmation...");

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n  PrivateVoting deployed to:", address);
    console.log("\n  Save this address — you will need it for:");
    console.log("    - test-dkg-onchain.js  (CONTRACT_ADDRESS)");
    console.log("    - test-complete.js     (if testing on this network)");
    console.log("    - frontend             (contractUtils.js)");
    console.log("");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});