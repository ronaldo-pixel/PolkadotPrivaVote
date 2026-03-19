// test-complete.js
// Complete end-to-end test for PrivateVoting.sol
// Tests every function: createProposal, DKG, castVote, closeVoting,
// submitPartialDecrypt, finalizeResult, and all rejection cases.
//
// Run against local hardhat node (fast, free):
//   npx hardhat run test-complete.js --network hardhat
//
// Run against polkadotTestnet (uses real PAS):
//   npx hardhat run test-complete.js --network polkadotTestnet
//
// ── How the crypto test vectors work ────────────────────────────────────────
//
// Private shares: KH0=1, KH1=2, KH2=3  (deterministic for testing)
// EPK = 1*Base8 + 2*Base8 + 3*Base8 = 6*Base8
//
// Vote: weight=5, option=0, nonce=7
//   c1[0] = 7 * Base8
//   c2[0] = 5*Base8 + 7*EPK = 5*Base8 + 42*Base8 = 47*Base8
//   c1[i>0] = 1*Base8  (nonce=1 for zero-vote options — circuit requires >0 nonce)
//   c2[i>0] = 0*Base8 + 1*EPK = 0 + 6*Base8 = 6*Base8
//     (but 0*Base8 = identity, so c2[i>0] = identity + 6*Base8 = 6*Base8)
//
// Partial decryptions (after 1 vote):
//   accumulated c1[0] = 7*Base8
//   D[k][0] = privateShare[k] * c1[0] = k * 7 * Base8
//     KH0: 1*7 = 7  → D[0][0] = 7*Base8
//     KH1: 2*7 = 14 → D[1][0] = 14*Base8
//     KH2: 3*7 = 21 → D[2][0] = 21*Base8
//   c1^x[0] = D[0]+D[1]+D[2] = (7+14+21)*Base8 = 42*Base8
//   M*G[0]  = c2[0] - c1^x[0] = 47*Base8 - 42*Base8 = 5*Base8  ✓ tally=5
//
//   accumulated c1[i>0] = 1*Base8 (one vote with nonce=1)
//   D[k][i] = k * 1 * Base8 = k*Base8
//   c1^x[i] = (1+2+3)*Base8 = 6*Base8
//   M*G[i]  = 6*Base8 - 6*Base8 = identity → tally=0  ✓

"use strict";

const { ethers }       = require("hardhat");
const { buildBabyjub } = require("circomlibjs");

// ── BabyJubJub JS helpers ─────────────────────────────────────────────────────

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
function modInverse(a, m) { return modpow(a, m - 2n, m); }

function pointAdd(p1, p2) {
    const p = FIELD_MODULUS;
    const x1x2      = p1.x * p2.x % p;
    const y1y2      = p1.y * p2.y % p;
    const dx1x2y1y2 = BABYJUB_D * x1x2 % p * y1y2 % p;
    const numX      = (p1.x * p2.y % p + p1.y * p2.x % p) % p;
    const numY      = (y1y2 + p - BABYJUB_A * x1x2 % p) % p;
    const denX      = (1n + dx1x2y1y2) % p;
    const denY      = (1n + p - dx1x2y1y2) % p;
    return { x: numX * modInverse(denX, p) % p, y: numY * modInverse(denY, p) % p };
}

function scalarMul(pt, scalar) {
    const SUBGROUP_ORDER = BigInt(
        "2736030358979909402780800718157159386076813972158567259200215660948447373041"
    );
    scalar = scalar % SUBGROUP_ORDER;
    let result  = { x: 0n, y: 1n }; // identity
    let current = { x: pt.x, y: pt.y };
    for (let i = 0; i < 254; i++) {
        if ((scalar >> BigInt(i)) & 1n) result = pointAdd(result, current);
        current = pointAdd(current, current);
    }
    return result;
}

// ── Logging ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label)       { console.log(`  ✓  ${label}`); passed++; }
function fail(label, e)  { console.log(`  ✗  ${label}`); if (e) console.log(`     ${e?.message?.split('\n')[0] ?? e}`); failed++; }
function section(title)  { console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 54 - title.length))}`); }
function info(msg)       { console.log(`     ${msg}`); }

// ── Helpers ───────────────────────────────────────────────────────────────────

async function mineBlocks(n) {
    for (let i = 0; i < n; i++)
        await ethers.provider.send("evm_mine", []);
}

/**
 * Build pubSignals[44] and encVote[10][2][2] for castVote.
 *
 * @param babyJub      circomlibjs instance
 * @param epk          election public key {x, y}
 * @param voteWeight   weight to place on voteOption
 * @param voteOption   0-based option index to vote for
 * @param nonce        ElGamal nonce for the voted option (use different per vote)
 * @param votingMode   0=NORMAL, 1=QUADRATIC
 * @param claimedBal   claimedBalance value (must equal tokenBalance for NORMAL)
 */
function buildVoteInputs(babyJub, epk, voteWeight, voteOption, nonce, votingMode, claimedBal) {
    const MAX_OPTIONS = 10;
    const F = babyJub.F;

    // Base8 point as {x,y} bigints
    const base8 = {
        x: babyJub.F.toObject(babyJub.Base8[0]),
        y: babyJub.F.toObject(babyJub.Base8[1]),
    };

    // Encrypt each option
    const encVote = [];
    for (let i = 0; i < MAX_OPTIONS; i++) {
        const weight = (i === voteOption) ? voteWeight : 0n;
        const n      = (i === voteOption) ? nonce      : 1n;   // non-zero nonce required

        // c1 = n * Base8
        const c1 = scalarMul(base8, n);

        // c2 = weight * Base8 + n * EPK
        const weightPt = weight === 0n ? { x: 0n, y: 1n } : scalarMul(base8, weight);
        const nEpk     = scalarMul(epk, n);
        const c2       = pointAdd(weightPt, nEpk);

        encVote.push({ c1, c2 });
    }

    // pubSignals[44]:
    //   [0]     claimedBalance
    //   [1]     votingMode
    //   [2,3]   publicKey x,y
    //   [4+i*4] c1.x, [5+i*4] c1.y, [6+i*4] c2.x, [7+i*4] c2.y
    const pubSignals = new Array(44).fill(0n);
    pubSignals[0] = claimedBal;
    pubSignals[1] = BigInt(votingMode);
    pubSignals[2] = epk.x;
    pubSignals[3] = epk.y;
    for (let i = 0; i < MAX_OPTIONS; i++) {
        const base = 4 + i * 4;
        pubSignals[base]     = encVote[i].c1.x;
        pubSignals[base + 1] = encVote[i].c1.y;
        pubSignals[base + 2] = encVote[i].c2.x;
        pubSignals[base + 3] = encVote[i].c2.y;
    }

    // encVote array for Solidity: [option][c1/c2][x/y]
    const encVoteSol = encVote.map(ev => [
        [ev.c1.x, ev.c1.y],
        [ev.c2.x, ev.c2.y],
    ]);

    // dummy proof (verifierContract == address(1) → skipped on-chain)
    const pA = [0n, 0n];
    const pB = [[0n, 0n], [0n, 0n]];
    const pC = [0n, 0n];

    return { pubSignals, encVoteSol, pA, pB, pC };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log("\n══════════════════════════════════════════════════════════════");
    console.log("  PrivateVoting — complete end-to-end test");
    console.log("══════════════════════════════════════════════════════════════");

    const babyJub = await buildBabyjub();
    const base8   = {
        x: babyJub.F.toObject(babyJub.Base8[0]),
        y: babyJub.F.toObject(babyJub.Base8[1]),
    };

    const signers = await ethers.getSigners();
    const [deployer, kh0, kh1, kh2, voter1, voter2, stranger] = signers;

    info(`Deployer : ${deployer.address}`);
    info(`KH0      : ${kh0.address}`);
    info(`KH1      : ${kh1.address}`);
    info(`KH2      : ${kh2.address}`);
    info(`Voter1   : ${voter1.address}`);

    // ── Deploy ────────────────────────────────────────────────────────────────
    section("Deploy");

    let contract;
    try {
        const Factory = await ethers.getContractFactory("PrivateVoting");
        contract = await Factory.deploy(
            kh0.address,
            kh1.address,
            kh2.address,
            "0x0000000000000000000000000000000000000001" // placeholder verifier
        );
        await contract.waitForDeployment();
        info(`Contract: ${await contract.getAddress()}`);
        ok("Contract deployed");
    } catch (e) { fail("Deploy", e); process.exit(1); }

    // ── createProposal ────────────────────────────────────────────────────────
    section("createProposal");

    let proposalId;
    try {
        const tx = await contract.connect(deployer).createProposal(
            "Best protocol?",
            ["Polkadot", "Ethereum", "Solana"],
            0,              // NORMAL
            500,            // duration: 500 blocks
            0,              // eligibilityThreshold: 0 = open to all
            10,             // minVoterThreshold
            deployer.address // tokenContract — EOA used as dummy (balanceOf will return 0)
        );
        const receipt = await tx.wait();
        const iface   = contract.interface;
        const ev      = receipt.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).filter(Boolean);
        const created = ev.find(e => e.name === "ProposalCreated");
        proposalId = created.args.proposalId;
        info(`proposalId: ${proposalId}`);
        ok("createProposal emits ProposalCreated");
    } catch (e) { fail("createProposal", e); process.exit(1); }

    // status = PENDING_DKG
    try {
        const { status } = await contract.getElectionPublicKey(proposalId);
        if (Number(status) === 0) ok("Initial status is PENDING_DKG");
        else fail(`Expected PENDING_DKG, got ${status}`);
    } catch (e) { fail("getElectionPublicKey initial", e); }

    // rejects invalid option count
    try {
        await contract.connect(deployer).createProposal("x", ["only one"], 0, 100, 0, 10, deployer.address);
        fail("Should reject 1 option");
    } catch (e) { ok("Rejects option count < 2"); }

    // rejects zero duration
    try {
        await contract.connect(deployer).createProposal("x", ["a","b"], 0, 0, 0, 10, deployer.address);
        fail("Should reject duration=0");
    } catch (e) { ok("Rejects duration = 0"); }

    // rejects minVoterThreshold < 10
    try {
        await contract.connect(deployer).createProposal("x", ["a","b"], 0, 100, 0, 5, deployer.address);
        fail("Should reject minVoterThreshold < 10");
    } catch (e) { ok("Rejects minVoterThreshold < 10"); }

    // ── DKG: submitPublicKeyShare ─────────────────────────────────────────────
    section("DKG — submitPublicKeyShare");

    // Deterministic private shares for predictable test vectors
    const privateShares = [1n, 2n, 3n];
    const publicShares  = privateShares.map(s => scalarMul(base8, s));

    // Expected EPK = P0 + P1 + P2 = 6 * Base8
    let epk = { x: 0n, y: 1n };
    for (const ps of publicShares) epk = pointAdd(epk, ps);
    info(`Expected EPK x: ${epk.x}`);
    info(`Expected EPK y: ${epk.y}`);

    // Reject: non-keyholder
    try {
        await contract.connect(stranger).submitPublicKeyShare(proposalId, publicShares[0].x, publicShares[0].y);
        fail("Non-keyholder should be rejected");
    } catch (e) { ok("Non-keyholder rejected (NotKeyholder)"); }

    // Reject: identity point (0, 1)
    try {
        await contract.connect(kh0).submitPublicKeyShare(proposalId, 0n, 1n);
        fail("Identity point should be rejected");
    } catch (e) { ok("Identity point (0,1) rejected (InvalidPoint)"); }

    // Reject: off-curve point
    try {
        await contract.connect(kh0).submitPublicKeyShare(proposalId, 1n, 2n);
        fail("Off-curve point should be rejected");
    } catch (e) { ok("Off-curve point rejected (InvalidPoint)"); }

    // KH0 submits — valid
    try {
        const tx = await contract.connect(kh0).submitPublicKeyShare(proposalId, publicShares[0].x, publicShares[0].y);
        await tx.wait();
        const { submitted } = await contract.getDKGStatus(proposalId);
        if (submitted[0] && !submitted[1] && !submitted[2]) ok("KH0 share accepted, others still pending");
        else fail("DKG status wrong after KH0");
    } catch (e) { fail("KH0 submitPublicKeyShare", e); }

    // Reject: duplicate from KH0
    try {
        await contract.connect(kh0).submitPublicKeyShare(proposalId, publicShares[0].x, publicShares[0].y);
        fail("Duplicate submission should be rejected");
    } catch (e) { ok("Duplicate submission rejected (AlreadySubmittedShare)"); }

    // KH1 submits
    try {
        await (await contract.connect(kh1).submitPublicKeyShare(proposalId, publicShares[1].x, publicShares[1].y)).wait();
        ok("KH1 share accepted");
    } catch (e) { fail("KH1 submitPublicKeyShare", e); }

    // KH2 submits — triggers _finalizeElectionKey
    let startBlock, endBlock;
    try {
        const tx = await contract.connect(kh2).submitPublicKeyShare(proposalId, publicShares[2].x, publicShares[2].y);
        const receipt = await tx.wait();
        const iface  = contract.interface;
        const events = receipt.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).filter(Boolean);

        const keyEv     = events.find(e => e.name === "ElectionKeyComputed");
        const votingEv  = events.find(e => e.name === "VotingStarted");

        if (keyEv)    ok("ElectionKeyComputed event emitted");
        else          fail("ElectionKeyComputed event missing");
        if (votingEv) { ok("VotingStarted event emitted"); startBlock = votingEv.args.startBlock; endBlock = votingEv.args.endBlock; }
        else          fail("VotingStarted event missing");
    } catch (e) { fail("KH2 submitPublicKeyShare (final)", e); process.exit(1); }

    // Verify combined key
    try {
        const { x, y, status, sharesIn } = await contract.getElectionPublicKey(proposalId);
        if (Number(sharesIn) === 3)       ok("All 3 shares recorded");
        else                              fail(`Expected 3 shares, got ${sharesIn}`);
        if (Number(status) === 1)         ok("Status transitioned to ACTIVE");
        else                              fail(`Expected ACTIVE(1), got ${status}`);
        if (x.toString() === epk.x.toString() && y.toString() === epk.y.toString())
                                          ok("On-chain EPK matches JS-computed 6×Base8");
        else                              fail(`EPK mismatch — got (${x}, ${y})`);
    } catch (e) { fail("getElectionPublicKey post-DKG", e); }

    // Verify getPublicKeyShare returns correct coords
    try {
        for (let i = 0; i < 3; i++) {
            const { x, y, submitted } = await contract.getPublicKeyShare(proposalId, i);
            if (!submitted) { fail(`KH${i} share not marked submitted`); continue; }
            if (x.toString() === publicShares[i].x.toString() &&
                y.toString() === publicShares[i].y.toString())
                ok(`getPublicKeyShare(${i}) correct`);
            else
                fail(`getPublicKeyShare(${i}) mismatch`);
        }
    } catch (e) { fail("getPublicKeyShare", e); }

    // Cannot submit share once ACTIVE
    try {
        await contract.connect(kh0).submitPublicKeyShare(proposalId, publicShares[0].x, publicShares[0].y);
        fail("Should reject share after DKG complete");
    } catch (e) { ok("Share submission rejected after DKG complete (WrongStatus)"); }

    // ── castVote ──────────────────────────────────────────────────────────────
    section("castVote");

    // Build vote: weight=5, option=0 (Polkadot), nonce=7
    const VOTE_WEIGHT  = 5n;
    const VOTE_OPTION  = 0;
    const VOTE_NONCE   = 7n;

    const { pubSignals, encVoteSol, pA, pB, pC } = buildVoteInputs(
        babyJub, epk, VOTE_WEIGHT, VOTE_OPTION, VOTE_NONCE,
        0,          // NORMAL mode
        VOTE_WEIGHT // claimedBalance = weight (for NORMAL mode: weight == claimedBalance)
    );

    info(`Vote: weight=${VOTE_WEIGHT}, option=${VOTE_OPTION}, nonce=${VOTE_NONCE}`);

    // Reject: wrong votingMode in signals
    try {
        const badSignals = [...pubSignals];
        badSignals[1] = 1n; // claim QUADRATIC but proposal is NORMAL
        await contract.connect(voter1).castVote(proposalId, pA, pB, pC, badSignals, encVoteSol);
        fail("Wrong votingMode should be rejected");
    } catch (e) { ok("Wrong votingMode rejected (PublicInputMismatch)"); }

    // Reject: wrong EPK in signals
    try {
        const badSignals = [...pubSignals];
        badSignals[2] = 12345n;
        await contract.connect(voter1).castVote(proposalId, pA, pB, pC, badSignals, encVoteSol);
        fail("Wrong EPK x should be rejected");
    } catch (e) { ok("Wrong EPK in signals rejected (PublicInputMismatch)"); }

    // Reject: encVote doesn't match signals
    try {
        const badEncVote = encVoteSol.map(opt => [[opt[0][0], opt[0][1]], [opt[1][0], opt[1][1]]]);
        badEncVote[0][0][0] = 999n; // corrupt c1.x for option 0
        await contract.connect(voter1).castVote(proposalId, pA, pB, pC, pubSignals, badEncVote);
        fail("Mismatched encVote should be rejected");
    } catch (e) { ok("Mismatched encVote rejected (c1.x mismatch)"); }

    // Reject: vote before startBlock (mine to be safe — on hardhat startBlock == current, so test may pass)
    // Instead test castVote when status is PENDING_DKG by using a fresh proposal
    try {
        const tx2 = await contract.connect(deployer).createProposal(
            "Pending proposal", ["A","B"], 0, 100, 0, 10, deployer.address
        );
        const r2   = await tx2.wait();
        const iface = contract.interface;
        const ev2   = r2.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).filter(Boolean);
        const pid2  = ev2.find(e => e.name === "ProposalCreated").args.proposalId;
        await contract.connect(voter1).castVote(pid2, pA, pB, pC, pubSignals, encVoteSol);
        fail("Vote on PENDING_DKG proposal should be rejected");
    } catch (e) { ok("Vote on PENDING_DKG proposal rejected (VotingNotOpen)"); }

    // Valid vote — voter1
    let voteReceipt;
    try {
        const tx = await contract.connect(voter1).castVote(
            proposalId, pA, pB, pC, pubSignals, encVoteSol
        );
        voteReceipt = await tx.wait();
        const iface  = contract.interface;
        const events = voteReceipt.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).filter(Boolean);
        const voteCastEv = events.find(e => e.name === "VoteCast");
        if (voteCastEv) {
            ok(`VoteCast emitted — voteCount: ${voteCastEv.args.voteCount}`);
        } else {
            fail("VoteCast event not found");
        }
    } catch (e) { fail("Valid castVote", e); }

    // Reject: double vote
    try {
        await contract.connect(voter1).castVote(proposalId, pA, pB, pC, pubSignals, encVoteSol);
        fail("Double vote should be rejected");
    } catch (e) { ok("Double vote rejected (AlreadyVoted)"); }

    // Verify encrypted tally updated
    try {
        const { c1, c2 } = await contract.getEncryptedTally(proposalId, 0);
        const expectedC1 = scalarMul(base8, VOTE_NONCE); // nonce * Base8
        if (c1[0].toString() === expectedC1.x.toString() &&
            c1[1].toString() === expectedC1.y.toString())
            ok("Encrypted tally c1[0] updated correctly (nonce*Base8)");
        else
            fail(`Tally c1[0] mismatch — got (${c1[0]}, ${c1[1]})`);
    } catch (e) { fail("getEncryptedTally after vote", e); }

    // ── closeVoting ───────────────────────────────────────────────────────────
    section("closeVoting");

    // Reject: voting window still open
    try {
        await contract.connect(deployer).closeVoting(proposalId);
        fail("closeVoting before endBlock should fail");
    } catch (e) { ok("closeVoting before endBlock correctly rejected"); }

    // Mine past endBlock
    const currentBlock = await ethers.provider.getBlockNumber();
    const blocksToMine = Number(endBlock) - currentBlock + 2;
    info(`Mining ${blocksToMine} blocks to pass endBlock ${endBlock}...`);
    await mineBlocks(blocksToMine);

    // Reject: voteCount (1) < minVoterThreshold (10) → should CANCEL
    try {
        const tx = await contract.connect(deployer).closeVoting(proposalId);
        const receipt = await tx.wait();
        const iface  = contract.interface;
        const events = receipt.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).filter(Boolean);
        const endedEv = events.find(e => e.name === "VotingEnded");
        if (endedEv) ok(`VotingEnded emitted — totalVotes: ${endedEv.args.totalVotes}`);
        else fail("VotingEnded event not found");

        // Should be CANCELLED because voteCount=1 < minVoterThreshold=10
        const { status } = await contract.getElectionPublicKey(proposalId);
        if (Number(status) === 4) ok("Status is CANCELLED (vote count below threshold)");
        else fail(`Expected CANCELLED(4), got ${status}`);
    } catch (e) { fail("closeVoting", e); }

    // ── New proposal for ENDED path (submit enough votes) ────────────────────
    section("Full flow: ENDED → REVEALED");

    // Create a fresh proposal with minVoterThreshold=1 so 1 vote suffices
    // We need to patch minVoterThreshold — but MIN_VOTERS=10 is hardcoded.
    // Workaround: use a short duration and cast a vote, then we need 10 voters.
    // Instead: create a new contract with MIN_VOTERS=1 is not possible.
    // Solution: cast 10+ votes from different signers, then closeVoting.

    info("Creating new proposal for full decryption flow (need 10 votes)...");

    let pid2;
    let epk2 = epk; // reuse same EPK — need to submit DKG shares again for new proposal

    try {
        const tx = await contract.connect(deployer).createProposal(
            "Decryption test",
            ["Alpha", "Beta", "Gamma"],
            0,      // NORMAL
            2000,   // duration: 2000 blocks
            0,      // no token gating
            10,     // minVoterThreshold
            deployer.address
        );
        const receipt = await tx.wait();
        const iface  = contract.interface;
        const events = receipt.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).filter(Boolean);
        pid2 = events.find(e => e.name === "ProposalCreated").args.proposalId;
        info(`New proposal id: ${pid2}`);
        ok("New proposal created");
    } catch (e) { fail("Create decryption test proposal", e); process.exit(1); }

    // Submit DKG shares for new proposal
    try {
        await (await contract.connect(kh0).submitPublicKeyShare(pid2, publicShares[0].x, publicShares[0].y)).wait();
        await (await contract.connect(kh1).submitPublicKeyShare(pid2, publicShares[1].x, publicShares[1].y)).wait();
        await (await contract.connect(kh2).submitPublicKeyShare(pid2, publicShares[2].x, publicShares[2].y)).wait();
        const { status } = await contract.getElectionPublicKey(pid2);
        if (Number(status) === 1) ok("DKG complete for new proposal → ACTIVE");
        else fail(`Expected ACTIVE(1), got ${status}`);
    } catch (e) { fail("DKG for new proposal", e); process.exit(1); }

    // Cast 10 votes from different signers (all for option 0, weight=1)
    // Using signers[0..9] — deployer + all available signers
    info("Casting 10 votes...");
    let votescast = 0;
    for (let v = 0; v < 10 && v < signers.length; v++) {
        const voter  = signers[v];
        const nonce  = BigInt(v + 10); // unique nonce per voter
        const weight = 1n;
        const { pubSignals: ps, encVoteSol: ev } = buildVoteInputs(
            babyJub, epk2, weight, 0, nonce, 0, weight
        );
        try {
            await (await contract.connect(voter).castVote(pid2, pA, pB, pC, ps, ev)).wait();
            votescast++;
        } catch (e) {
            info(`  voter ${v} failed: ${e?.message?.split('\n')[0]}`);
        }
    }
    info(`Votes cast: ${votescast}`);
    if (votescast >= 10) ok("10 votes cast successfully");
    else                 fail(`Only ${votescast}/10 votes cast — not enough signers`);

    // Mine past endBlock of new proposal
    const p2info = await contract.getElectionPublicKey(pid2);
    const p2storage = await contract.proposals(pid2);
    const p2end = p2storage.endBlock;
    const cur2  = await ethers.provider.getBlockNumber();
    const mine2 = Number(p2end) - cur2 + 2;
    info(`Mining ${mine2} blocks to pass endBlock ${p2end}...`);
    await mineBlocks(mine2);

    // closeVoting → ENDED
    try {
        await (await contract.connect(deployer).closeVoting(pid2)).wait();
        const { status } = await contract.getElectionPublicKey(pid2);
        if (Number(status) === 2) ok("Status is ENDED");
        else fail(`Expected ENDED(2), got ${status}`);
    } catch (e) { fail("closeVoting new proposal", e); }

    // ── submitPartialDecrypt ──────────────────────────────────────────────────
    section("submitPartialDecrypt");

    // Reject: non-keyholder
    try {
        const dummyPartials = Array(10).fill([base8.x, base8.y]);
        await contract.connect(stranger).submitPartialDecrypt(pid2, dummyPartials);
        fail("Non-keyholder should be rejected");
    } catch (e) { ok("Non-keyholder partial decrypt rejected"); }

    // Reject: wrong status (use old CANCELLED proposal)
    try {
        const dummyPartials = Array(10).fill([base8.x, base8.y]);
        await contract.connect(kh0).submitPartialDecrypt(proposalId, dummyPartials);
        fail("Should reject on CANCELLED proposal");
    } catch (e) { ok("Partial decrypt on CANCELLED proposal rejected (WrongStatus)"); }

    // Compute correct partial decryptions for new proposal
    // For each option i, D[k][i] = privateShare[k] * c1_tally[i]
    // c1_tally[i] = sum of all votes' c1[i]
    // Each vote: c1[0] = nonce*Base8, c1[i>0] = 1*Base8
    // After 10 votes: c1_tally[0] = (10+11+...+19)*Base8 = 145*Base8
    //                 c1_tally[i>0] = 10 * 1*Base8 = 10*Base8

    info("Computing partial decryptions...");
    // pid2 has 3 options — read only those, pad remaining 7 slots with Base8
    // (contract only validates partials[0..optionCount-1], ignores the rest)
    const NUM_OPTIONS_PID2 = 3;
    const partialSets = [];
    for (let k = 0; k < 3; k++) {
        const partials = [];
        for (let i = 0; i < NUM_OPTIONS_PID2; i++) {
            const { c1 } = await contract.getEncryptedTally(pid2, i);
            const c1pt   = { x: c1[0], y: c1[1] };
            const D      = scalarMul(c1pt, privateShares[k]);
            partials.push([D.x, D.y]);
        }
        // Pad to MAX_OPTIONS=10 with Base8 (any valid on-curve point)
        while (partials.length < 10) partials.push([base8.x, base8.y]);
        partialSets.push(partials);
    }

    // Reject: invalid (off-curve) partial
    try {
        const badPartials = Array(10).fill([1n, 2n]); // off-curve
        await contract.connect(kh0).submitPartialDecrypt(pid2, badPartials);
        fail("Off-curve partial should be rejected");
    } catch (e) { ok("Off-curve partial decryption rejected (InvalidPoint)"); }

    // KH0 submits
    try {
        const tx = await contract.connect(kh0).submitPartialDecrypt(pid2, partialSets[0]);
        const receipt = await tx.wait();
        const iface  = contract.interface;
        const events = receipt.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).filter(Boolean);
        if (events.find(e => e.name === "PartialDecryptionSubmitted"))
            ok("KH0 partial decryption submitted");
        else
            fail("PartialDecryptionSubmitted event not found");
    } catch (e) { fail("KH0 submitPartialDecrypt", e); }

    // Reject: duplicate from KH0
    try {
        await contract.connect(kh0).submitPartialDecrypt(pid2, partialSets[0]);
        fail("Duplicate partial should be rejected");
    } catch (e) { ok("Duplicate partial decryption rejected (AlreadySubmittedPartial)"); }

    // KH1 and KH2 submit
    try {
        await (await contract.connect(kh1).submitPartialDecrypt(pid2, partialSets[1])).wait();
        ok("KH1 partial decryption submitted");
    } catch (e) { fail("KH1 submitPartialDecrypt", e); }

    try {
        await (await contract.connect(kh2).submitPartialDecrypt(pid2, partialSets[2])).wait();
        ok("KH2 partial decryption submitted");
    } catch (e) { fail("KH2 submitPartialDecrypt", e); }

    // ── finalizeResult ────────────────────────────────────────────────────────
    section("finalizeResult");

    // Reject: maxTally = 0
    try {
        await contract.connect(deployer).finalizeResult(pid2, 0);
        fail("maxTally=0 should be rejected");
    } catch (e) { ok("maxTally=0 rejected"); }

    // Reject: not all partials submitted (use proposalId 0 which is CANCELLED)
    try {
        await contract.connect(deployer).finalizeResult(proposalId, 100);
        fail("Should reject on CANCELLED proposal");
    } catch (e) { ok("finalizeResult on CANCELLED proposal rejected (WrongStatus)"); }

    // Valid finalize
    // Expected: 10 votes of weight=1 on option 0 → tally[0]=10, tally[1..9]=0
    info("Finalizing result (maxTally=50)...");
    try {
        const tx = await contract.connect(deployer).finalizeResult(pid2, 50);
        const receipt = await tx.wait();
        const iface  = contract.interface;
        const events = receipt.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).filter(Boolean);
        const revealedEv = events.find(e => e.name === "ResultRevealed");
        if (revealedEv) {
            ok(`ResultRevealed emitted — winningOption: ${revealedEv.args.winningOption}`);
            if (Number(revealedEv.args.winningOption) === 0)
                ok("Correct winning option (0 = Alpha)");
            else
                fail(`Expected winning option 0, got ${revealedEv.args.winningOption}`);
        } else {
            fail("ResultRevealed event not found");
        }
    } catch (e) { fail("finalizeResult", e); }

    // Verify getResult
    try {
        const { tally, winningOption, status } = await contract.getResult(pid2);
        info(`tally: [${tally.slice(0,3).map(t => t.toString()).join(', ')}, ...]`);
        info(`winningOption: ${winningOption}`);
        info(`status: ${["PENDING_DKG","ACTIVE","ENDED","REVEALED","CANCELLED"][Number(status)]}`);

        if (Number(status) === 3)      ok("Status is REVEALED");
        else                           fail(`Expected REVEALED(3), got ${status}`);
        if (Number(winningOption) === 0) ok("Winning option is 0 (Alpha)");
        else                           fail(`Expected winning option 0, got ${winningOption}`);
        if (Number(tally[0]) === 10)   ok("tally[0] = 10 (correct)");
        else                           fail(`Expected tally[0]=10, got ${tally[0]}`);
        if (Number(tally[1]) === 0 && Number(tally[2]) === 0)
                                       ok("tally[1] and tally[2] = 0 (correct)");
        else                           fail(`Expected tally[1,2]=0, got [${tally[1]}, ${tally[2]}]`);
    } catch (e) { fail("getResult", e); }

    // Reject: finalizeResult again on REVEALED proposal
    try {
        await contract.connect(deployer).finalizeResult(pid2, 50);
        fail("Should reject finalize on REVEALED proposal");
    } catch (e) { ok("finalizeResult on REVEALED proposal rejected (WrongStatus)"); }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════════════════════");
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log("══════════════════════════════════════════════════════════════\n");

    if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });