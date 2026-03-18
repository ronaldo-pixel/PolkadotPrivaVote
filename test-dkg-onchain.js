// test-dkg-onchain.js
// End-to-end DKG test against the deployed PrivateVoting contract on polkadotTestnet.
//
// Tests in order:
//   1. Connect to deployed contract
//   2. Create a proposal
//   3. Each keyholder generates a key share (off-chain)
//   4. Each keyholder submits their share on-chain
//   5. Verify the combined election public key is correct
//   6. Verify proposal status moved to ACTIVE
//   7. Test all rejection cases (duplicate, off-curve, identity, non-keyholder)
//
// Run:  npx hardhat run test-dkg-onchain.js --network polkadotTestnet

"use strict";

const { ethers }       = require("hardhat");
const { buildBabyjub } = require("circomlibjs");

// ── Config ────────────────────────────────────────────────────────────────────

const CONTRACT_ADDRESS = "0xDc96dB3De06f88376Df9345Bf1E202917be982E8";

// These must match the addresses passed to the constructor at deploy time
// AND have funds on polkadotTestnet to send transactions.
// keyholder index 0 = accounts[0], etc. — using hardhat signers from .env PASEO_PK
// If you only have one funded account, see the note at the bottom.

// ── BabyJubJub helpers ────────────────────────────────────────────────────────

const SUBGROUP_ORDER = BigInt(
    "2736030358979909402780800718157159386076813972158567259200215660948447373041"
);
const FIELD_MODULUS = BigInt(
    "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);
const BABYJUB_A = 168700n;
const BABYJUB_D = 168696n;

function modpow(base, exp, mod) {
    let result = 1n;
    base = base % mod;
    while (exp > 0n) {
        if (exp % 2n === 1n) result = result * base % mod;
        exp >>= 1n;
        base = base * base % mod;
    }
    return result;
}

function modInverse(a, m) {
    return modpow(a, m - 2n, m);
}

function pointAdd(p1, p2) {
    const p         = FIELD_MODULUS;
    const x1x2      = p1.x * p2.x % p;
    const y1y2      = p1.y * p2.y % p;
    const dx1x2y1y2 = BABYJUB_D * x1x2 % p * y1y2 % p;
    const numX      = (p1.x * p2.y % p + p1.y * p2.x % p) % p;
    const numY      = (y1y2 + p - BABYJUB_A * x1x2 % p) % p;
    const denX      = (1n + dx1x2y1y2) % p;
    const denY      = (1n + p - dx1x2y1y2) % p;
    return {
        x: numX * modInverse(denX, p) % p,
        y: numY * modInverse(denY, p) % p,
    };
}

function isOnCurve(x, y) {
    if (x === 0n && y === 1n) return false;
    const p  = FIELD_MODULUS;
    const x2 = x * x % p;
    const y2 = y * y % p;
    const lhs = (BABYJUB_A * x2 % p + y2) % p;
    const rhs = (1n + BABYJUB_D * x2 % p * y2 % p) % p;
    return lhs === rhs;
}

// ── Logging helpers ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label) {
    console.log(`  ✓  ${label}`);
    passed++;
}

function fail(label, err) {
    console.log(`  ✗  ${label}`);
    console.log(`     ${err?.message ?? err}`);
    failed++;
}

function section(title) {
    console.log(`\n── ${title} ${"─".repeat(55 - title.length)}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log("\n══════════════════════════════════════════════════════════════");
    console.log("  PrivateVoting DKG — on-chain integration test");
    console.log(`  Contract: ${CONTRACT_ADDRESS}`);
    console.log("══════════════════════════════════════════════════════════════");

    // ── Setup ─────────────────────────────────────────────────────────────────
    section("Setup");

    const babyJub  = await buildBabyjub();
    const signers  = await ethers.getSigners();
    const deployer = signers[0];

    console.log(`  Deployer/caller: ${deployer.address}`);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`  Balance: ${ethers.formatEther(balance)} PAS`);

    if (balance === 0n) {
        console.error("\n  ERROR: deployer has no funds. Get tokens from https://faucet.polkadot.io\n");
        process.exit(1);
    }

    // Attach to deployed contract
    const PrivateVoting = await ethers.getContractFactory("PrivateVoting");
    const contract      = PrivateVoting.attach(CONTRACT_ADDRESS);

    // Verify connection by reading public state
    try {
        const kh0 = await contract.keyholders(0);
        console.log(`  keyholders[0]: ${kh0}`);
        const kh1 = await contract.keyholders(1);
        console.log(`  keyholders[1]: ${kh1}`);
        const kh2 = await contract.keyholders(2);
        console.log(`  keyholders[2]: ${kh2}`);
        ok("Contract is reachable and returns keyholder addresses");
    } catch (e) {
        fail("Contract connection", e);
        process.exit(1);
    }

    // ── Generate key shares off-chain ─────────────────────────────────────────
    section("Off-chain key share generation");

    // Use deterministic test scalars so we can predict the combined key
    // In production each keyholder uses a random scalar from keyholder.js
    const privateShares = [1n, 2n, 3n];
    const publicShares  = privateShares.map(s => {
        const raw = babyJub.mulPointEscalar(babyJub.Base8, s);
        return {
            x: babyJub.F.toObject(raw[0]),
            y: babyJub.F.toObject(raw[1]),
        };
    });

    let expectedCombined = { x: 0n, y: 1n };
    for (const share of publicShares) {
        expectedCombined = pointAdd(expectedCombined, share);
    }

    for (let i = 0; i < 3; i++) {
        const valid = isOnCurve(publicShares[i].x, publicShares[i].y);
        console.log(`  KH${i} share on-curve (JS check): ${valid}`);
        if (valid) ok(`Keyholder ${i} public share is valid`);
        else fail(`Keyholder ${i} public share on-curve check`);
    }

    console.log(`\n  Expected combined key:`);
    console.log(`    x = ${expectedCombined.x}`);
    console.log(`    y = ${expectedCombined.y}`);

    // ── Create a proposal ─────────────────────────────────────────────────────
    section("Create proposal");

    let proposalId;
    try {
        const tx = await contract.connect(deployer).createProposal(
            "Test DKG proposal",
            ["Option A", "Option B", "Option C"],
            0,           // VotingMode.NORMAL
            1000,        // duration in blocks
            0,           // eligibilityThreshold (0 = no token gating for test)
            10,          // minVoterThreshold
            deployer.address  // tokenContract — using deployer as dummy for test
        );
        const receipt = await tx.wait();
        console.log(`  tx hash: ${receipt.hash}`);

        // Parse ProposalCreated event to get proposalId
        const iface  = PrivateVoting.interface;
        const events = receipt.logs
            .map(log => { try { return iface.parseLog(log); } catch { return null; } })
            .filter(Boolean);

        const created = events.find(e => e.name === "ProposalCreated");
        if (!created) throw new Error("ProposalCreated event not found in receipt");

        proposalId = created.args.proposalId;
        console.log(`  proposalId: ${proposalId}`);
        ok("createProposal() succeeded and emitted ProposalCreated");
    } catch (e) {
        fail("createProposal()", e);
        process.exit(1);
    }

    // Confirm status = PENDING_DKG (0)
    try {
        const { status } = await contract.getElectionPublicKey(proposalId);
        if (Number(status) === 0) ok("Proposal status is PENDING_DKG (0)");
        else fail(`Expected status 0, got ${status}`);
    } catch (e) {
        fail("getElectionPublicKey() after createProposal", e);
    }

    // ── Rejection tests (before any valid submissions) ────────────────────────
    section("Rejection tests");

    // Test 1: non-keyholder cannot submit
    try {
        await contract.connect(deployer).submitPublicKeyShare(
            proposalId,
            publicShares[0].x,
            publicShares[0].y
        );
        // If deployer IS a keyholder this will succeed — check address
        const kh0 = await contract.keyholders(0);
        if (kh0.toLowerCase() === deployer.address.toLowerCase()) {
            ok("Deployer is keyholder[0] — submit succeeded as expected");
        } else {
            fail("Non-keyholder was allowed to submit (should have reverted)");
        }
    } catch (e) {
        if (e.message.includes("NotKeyholder") || e.message.includes("revert")) {
            ok("Non-keyholder submission correctly rejected");
        } else {
            fail("Unexpected error on non-keyholder test", e);
        }
    }

    // Test 2: identity point (0, 1) rejected
    try {
        await contract.connect(deployer).submitPublicKeyShare(proposalId, 0n, 1n);
        fail("Identity point (0,1) should have been rejected");
    } catch (e) {
        if (e.message.includes("InvalidPoint") || e.message.includes("revert")) {
            ok("Identity point (0,1) correctly rejected");
        } else {
            fail("Unexpected error on identity point test", e);
        }
    }

    // Test 3: off-curve point rejected
    try {
        await contract.connect(deployer).submitPublicKeyShare(proposalId, 1n, 2n);
        fail("Off-curve point (1,2) should have been rejected");
    } catch (e) {
        if (e.message.includes("InvalidPoint") || e.message.includes("revert")) {
            ok("Off-curve point (1,2) correctly rejected");
        } else {
            fail("Unexpected error on off-curve test", e);
        }
    }

    // ── Submit key shares ─────────────────────────────────────────────────────
    section("Submit public key shares on-chain");

    // NOTE: In a real deployment, each keyholder runs this from their own wallet.
    // Here we submit all 3 from the same deployer account if it is registered
    // as a keyholder, OR we show what each call would look like.
    //
    // The contract checks msg.sender against keyholders[] — so these calls
    // must come from the exact addresses set in the constructor.
    // If you deployed with [0x90F7..., 0x7099..., 0x3C44...] and only have
    // one funded account, only the first share can be submitted in this test.

    const keyholderAddresses = [
        await contract.keyholders(0),
        await contract.keyholders(1),
        await contract.keyholders(2),
    ];

    let sharesSubmitted = 0;

    for (let i = 0; i < 3; i++) {
        const matchingSigner = signers.find(
            s => s.address.toLowerCase() === keyholderAddresses[i].toLowerCase()
        );

        if (!matchingSigner) {
            console.log(`  Keyholder ${i} (${keyholderAddresses[i]}): no matching signer available`);
            console.log(`  → To submit manually:`);
            console.log(`    submitPublicKeyShare(${proposalId}, ${publicShares[i].x}, ${publicShares[i].y})`);
            continue;
        }

        try {
            const tx = await contract.connect(matchingSigner).submitPublicKeyShare(
                proposalId,
                publicShares[i].x,
                publicShares[i].y
            );
            const receipt = await tx.wait();

            // Parse events
            const iface  = PrivateVoting.interface;
            const events = receipt.logs
                .map(log => { try { return iface.parseLog(log); } catch { return null; } })
                .filter(Boolean);

            const shareEvent = events.find(e => e.name === "PublicKeyShareSubmitted");
            if (shareEvent) {
                ok(`Keyholder ${i} share submitted (tx: ${receipt.hash.slice(0,10)}...)`);
                sharesSubmitted++;
            }

            // Check if VotingStarted was emitted (happens on last share)
            const votingStarted = events.find(e => e.name === "VotingStarted");
            if (votingStarted) {
                ok(`VotingStarted emitted — all shares collected, election key computed`);
            }

            const keyComputed = events.find(e => e.name === "ElectionKeyComputed");
            if (keyComputed) {
                console.log(`  Combined key from event:`);
                console.log(`    x = ${keyComputed.args.keyX}`);
                console.log(`    y = ${keyComputed.args.keyY}`);
            }
        } catch (e) {
            fail(`Keyholder ${i} share submission`, e);
        }
    }

    // ── Duplicate submission rejection ────────────────────────────────────────
    if (sharesSubmitted > 0) {
        section("Duplicate submission rejection");
        const firstKH = signers.find(
            s => s.address.toLowerCase() === keyholderAddresses[0].toLowerCase()
        );
        if (firstKH) {
            try {
                await contract.connect(firstKH).submitPublicKeyShare(
                    proposalId, publicShares[0].x, publicShares[0].y
                );
                fail("Duplicate submission should have been rejected");
            } catch (e) {
                if (e.message.includes("AlreadySubmittedShare") || e.message.includes("revert")) {
                    ok("Duplicate submission correctly rejected");
                } else {
                    fail("Unexpected error on duplicate test", e);
                }
            }
        }
    }

    // ── Verify final state ────────────────────────────────────────────────────
    section("Verify final state");

    try {
        const { x, y, status, sharesIn } = await contract.getElectionPublicKey(proposalId);
        console.log(`  status:    ${["PENDING_DKG","ACTIVE","ENDED","REVEALED","CANCELLED"][Number(status)]}`);
        console.log(`  sharesIn:  ${sharesIn} / 3`);
        console.log(`  EPK x:     ${x}`);
        console.log(`  EPK y:     ${y}`);

        if (Number(sharesIn) === 3) {
            ok("All 3 shares recorded");

            if (Number(status) === 1) ok("Proposal status is ACTIVE (1)");
            else fail(`Expected status ACTIVE (1), got ${status}`);

            // Verify combined key matches our JS calculation
            if (x.toString() === expectedCombined.x.toString() &&
                y.toString() === expectedCombined.y.toString()) {
                ok("On-chain election public key matches JS-computed combined key");
            } else {
                fail("Election public key mismatch");
                console.log(`  Expected x: ${expectedCombined.x}`);
                console.log(`  Got x:      ${x}`);
            }
        } else {
            console.log(`  Only ${sharesIn}/3 shares submitted — remaining keyholders must call submitPublicKeyShare() manually`);
        }
    } catch (e) {
        fail("getElectionPublicKey() final state check", e);
    }

    // getDKGStatus
    try {
        const { addresses, submitted } = await contract.getDKGStatus(proposalId);
        console.log("\n  DKG status per keyholder:");
        for (let i = 0; i < 3; i++) {
            console.log(`    [${i}] ${addresses[i]}  submitted: ${submitted[i]}`);
        }
        ok("getDKGStatus() returned correctly");
    } catch (e) {
        fail("getDKGStatus()", e);
    }

    // getPublicKeyShare for each slot
    try {
        for (let i = 0; i < 3; i++) {
            const { x, y, submitted } = await contract.getPublicKeyShare(proposalId, i);
            if (submitted) {
                const match = x.toString() === publicShares[i].x.toString()
                           && y.toString() === publicShares[i].y.toString();
                if (match) ok(`getPublicKeyShare(${i}) returns correct coordinates`);
                else fail(`getPublicKeyShare(${i}) coordinates mismatch`);
            }
        }
    } catch (e) {
        fail("getPublicKeyShare()", e);
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════════════════════");
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log("══════════════════════════════════════════════════════════════\n");

    if (failed > 0) process.exit(1);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});