/**
 * Call PrecompileTest on Passet Hub
 *
 * Usage:
 *   node scripts/callPrecompileTest.js <contractAddress>
 *   node scripts/callPrecompileTest.js   # reads from build/deployedAddress.json
 *
 * Tests:
 *   1. testGeneratorDoubling() — G + G using ecAdd precompile
 *   2. testEcMul()             — 2 * G using ecMul precompile
 *   3. Compares both results   — should be identical (both = 2G on BN128)
 */

require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL   = "https://eth-rpc-testnet.polkadot.io/";
const BUILD_DIR = path.join(__dirname, "..", "build");

// Known correct value of 2*G on BN128 — for verification
const TWO_G = {
    x: "1368015179489954701390400359078579693043519447331113978918064868415326638035",
    y: "9918110051302171585080402603319702774565515993150576347155970296011118125764",
};

async function main() {
    // ── Setup ──────────────────────────────────────────────────────────────────
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet   = new ethers.Wallet(process.env.PASEO_PK, provider);

    // ── Get contract address ───────────────────────────────────────────────────
    let contractAddress = process.argv[2];
    if (!contractAddress) {
        const saved = path.join(BUILD_DIR, "deployedAddress.json");
        if (fs.existsSync(saved)) {
            contractAddress = JSON.parse(fs.readFileSync(saved)).PrecompileTest;
            console.log("Using saved address:", contractAddress);
        } else {
            console.error("Usage: node callPrecompileTest.js <contractAddress>");
            process.exit(1);
        }
    }

    // ── Load ABI ───────────────────────────────────────────────────────────────
    const abi = JSON.parse(
        fs.readFileSync(path.join(BUILD_DIR, "PrecompileTest.abi"), "utf8")
    );

    const contract = new ethers.Contract(contractAddress, abi, wallet);

    console.log("=".repeat(60));
    console.log("PrecompileTest at:", contractAddress);
    console.log("=".repeat(60));

    // ── Test 1: G + G via ecAdd precompile ────────────────────────────────────
    console.log("\n[Test 1] testGeneratorDoubling() — ecAdd(G, G)");
    console.log("Expected: 2*G on BN128");
    console.log("Expected X:", TWO_G.x);
    console.log("Expected Y:", TWO_G.y);

    try {
        const tx1 = await contract.testGeneratorDoubling({ gasLimit: 1_000_000n });
        console.log("Tx hash:", tx1.hash);
        const receipt1 = await tx1.wait();
        console.log("Gas used:", receipt1.gasUsed.toString());

        // read stored result
        const [rx1, ry1, rs1] = await contract.getLastResult();
        console.log("\nResult:");
        console.log("  success:", rs1);
        console.log("  X:", rx1.toString());
        console.log("  Y:", ry1.toString());

        const xMatch = rx1.toString() === TWO_G.x;
        const yMatch = ry1.toString() === TWO_G.y;
        console.log("  X correct:", xMatch ? "✓" : "✗ WRONG");
        console.log("  Y correct:", yMatch ? "✓" : "✗ WRONG");

        if (!rs1) {
            console.log("\n  ✗ PRECOMPILE CALL FAILED");
            console.log("  ecAdd precompile (0x06) is not available on this network");
        }
    } catch (err) {
        console.error("  Error:", err.message);
    }

    // ── Test 2: scalar * G via ecMul precompile ───────────────────────────────
    console.log("\n[Test 2] testEcMul(G, 2) — ecMul(G, scalar=2)");
    console.log("Expected: same as 2*G above");

    // BN128 generator
    const GX = 1n;
    const GY = 2n;
    const SCALAR = 2n;

    try {
        const tx2 = await contract.testEcMul(GX, GY, SCALAR, { gasLimit: 1_000_000n });
        console.log("Tx hash:", tx2.hash);
        const receipt2 = await tx2.wait();
        console.log("Gas used:", receipt2.gasUsed.toString());

        const [rx2, ry2, rs2] = await contract.getLastResult();
        console.log("\nResult:");
        console.log("  success:", rs2);
        console.log("  X:", rx2.toString());
        console.log("  Y:", ry2.toString());

        const xMatch2 = rx2.toString() === TWO_G.x;
        const yMatch2 = ry2.toString() === TWO_G.y;
        console.log("  X correct:", xMatch2 ? "✓" : "✗ WRONG");
        console.log("  Y correct:", yMatch2 ? "✓" : "✗ WRONG");

        if (!rs2) {
            console.log("\n  ✗ PRECOMPILE CALL FAILED");
            console.log("  ecMul precompile (0x07) is not available on this network");
        }
    } catch (err) {
        console.error("  Error:", err.message);
    }

    // ── Test 3: custom ecAdd ───────────────────────────────────────────────────
    console.log("\n[Test 3] testEcAdd(G, G) — explicit call with G coordinates");

    try {
        const tx3 = await contract.testEcAdd(GX, GY, GX, GY, { gasLimit: 1_000_000n });
        console.log("Tx hash:", tx3.hash);
        const receipt3 = await tx3.wait();
        console.log("Gas used:", receipt3.gasUsed.toString());

        const [rx3, ry3, rs3] = await contract.getLastResult();
        console.log("\nResult:");
        console.log("  success:", rs3);
        console.log("  X:", rx3.toString());
        console.log("  Y:", ry3.toString());
    } catch (err) {
        console.error("  Error:", err.message);
    }

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log("\n" + "=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log("If all tests show ✓ and success=true:");
    console.log("  → EVM precompiles 0x06 and 0x07 work on this network");
    console.log("  → Your Verifier.sol and BabyJubJub math will work");
    console.log("\nIf tests show success=false or revert:");
    console.log("  → Precompiles not available (PVM network)");
    console.log("  → Need pure Solidity fallback or Rust PVM verifier");
}

main().catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
});