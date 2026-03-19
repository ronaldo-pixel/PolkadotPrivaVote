// test-complete.js
// Complete end-to-end test for PrivateVoting.sol
// No hardhat — uses ethers.js directly against Passet Hub or local node
//
// Run:
//   node test-complete.js
//
// Requires .env with:
//   PASEO_PK             — deployer + voter private keys (comma separated, need 10+)
//   PASEO_RPC_URL        — RPC endpoint
//   PRIVATE_VOTING_ADDRESS — deployed PrivateVoting address
//   KEYHOLDER_0_PRIV     — keyholder 0 private key
//   KEYHOLDER_1_PRIV     — keyholder 1 private key
//   KEYHOLDER_2_PRIV     — keyholder 2 private key

"use strict";

require("dotenv").config();
const { ethers }       = require("ethers");
const { buildBabyjub } = require("circomlibjs");
const fs               = require("fs");
const path             = require("path");

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL  = process.env.PASEO_RPC_URL ;
const CONTRACT_ADDRESS = "0x75dA28e24d1faBbe8cD6997A3F19C3E72bb30D31";

// Load ABI from combined JSON
const combined     = JSON.parse(fs.readFileSync(path.join(__dirname, "../build", "PrivateVoting.json")));
const contractKey  = Object.keys(combined.contracts).find(k => k.includes("contracts/PrivateVoting.sol:PrivateVoting"));
const CONTRACT_ABI = combined.contracts[contractKey].abi;

// ── BabyJubJub JS helpers ─────────────────────────────────────────────────────

const FIELD_MODULUS = BigInt(
    "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);
const BABYJUB_A = 168700n;
const BABYJUB_D = 168696n;
const SUBGROUP_ORDER = BigInt(
    "2736030358979909402780800718157159386076813972158567259200215660948447373041"
);

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
        y: numY * modInverse(denY, p) % p
    };
}

function scalarMul(pt, scalar) {
    scalar = scalar % SUBGROUP_ORDER;
    let result  = { x: 0n, y: 1n };
    let current = { x: pt.x, y: pt.y };
    for (let i = 0; i < 254; i++) {
        if ((scalar >> BigInt(i)) & 1n) result = pointAdd(result, current);
        current = pointAdd(current, current);
    }
    return result;
}

function discreteLogOffChain(target, base8, maxTally) {
    if (target.x === 0n && target.y === 1n) return 0;
    let current = { x: base8.x, y: base8.y };
    for (let m = 1; m <= maxTally; m++) {
        if (current.x === target.x && current.y === target.y) return m;
        current = pointAdd(current, base8);
    }
    return -1; // not found
}

// ── Logging ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label)      { console.log(`  ✓  ${label}`); passed++; }
function fail(label, e) { console.log(`  ✗  ${label}`); if (e) console.log(`     ${e?.message?.split('\n')[0] ?? e}`); failed++; }
function section(title) { console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 54 - title.length))}`); }
function info(msg)      { console.log(`     ${msg}`); }

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForTx(tx) {
    info(`Tx: ${tx.hash}`);
    const provider = tx.provider;
    let attempts = 0;
    while (attempts < 60) {
        await new Promise(r => setTimeout(r, 3000));
        const receipt = await provider.getTransactionReceipt(tx.hash);
        if (receipt) return receipt;
        attempts++;
        process.stdout.write(".");
    }
    throw new Error("Transaction not confirmed after 180s");
}

function parseEvents(receipt, iface) {
    return receipt.logs
        .map(l => { try { return iface.parseLog(l); } catch { return null; } })
        .filter(Boolean);
}

function buildVoteInputs(base8, epk, voteWeight, voteOption, nonce, votingMode, claimedBal) {
    const MAX_OPTIONS = 10;
    const encVote = [];

    for (let i = 0; i < MAX_OPTIONS; i++) {
        const weight = (i === voteOption) ? voteWeight : 0n;
        const n      = (i === voteOption) ? nonce      : 1n;

        const c1       = scalarMul(base8, n);
        const weightPt = weight === 0n ? { x: 0n, y: 1n } : scalarMul(base8, weight);
        const nEpk     = scalarMul(epk, n);
        const c2       = pointAdd(weightPt, nEpk);

        encVote.push({ c1, c2 });
    }

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

    const encVoteSol = encVote.map(ev => [
        [ev.c1.x, ev.c1.y],
        [ev.c2.x, ev.c2.y],
    ]);

    // dummy proof — verifier is address(1) so proof is skipped on-chain
    const pA = [0n, 0n];
    const pB = [[0n, 0n], [0n, 0n]];
    const pC = [0n, 0n];

    return { pubSignals, encVoteSol, pA, pB, pC };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log("\n══════════════════════════════════════════════════════════════");
    console.log("  PrivateVoting — complete end-to-end test (no hardhat)");
    console.log("══════════════════════════════════════════════════════════════");

    // ── Setup provider and wallets ────────────────────────────────────────────
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Deployer wallet
    const deployer = new ethers.Wallet(process.env.PASEO_PK, provider);

    // Keyholder wallets — each has their own private key
    const kh0 = new ethers.Wallet(process.env.KEYHOLDER_0_PRIV, provider);
    const kh1 = new ethers.Wallet(process.env.KEYHOLDER_1_PRIV, provider);
    const kh2 = new ethers.Wallet(process.env.KEYHOLDER_2_PRIV, provider);

    // Voter wallets — derive from deployer key with different indices
    // For testing we use the same deployer key for all voters
    // In production each voter has their own wallet
    // Generate deterministic test wallets from index
    const voters = [];
    for (let i = 0; i < 12; i++) {
        // derive deterministic wallets from a mnemonic or use deployer for first
        const w = ethers.Wallet.fromPhrase(
            "test test test test test test test test test test test junk",
            provider,
            `m/44'/60'/0'/0/${i}`
        );
        voters.push(w.connect(provider));
    }

    for (const kh of [kh0, kh1, kh2]) {
        const bal = await provider.getBalance(kh.address);
       
            info(`Funding ${kh.address}...`);
            const tx = await deployer.sendTransaction({
                to: kh.address,
                value: ethers.parseEther("2")
            });
            await waitForTx(tx);
        
    }

    // deployer is also a voter
    const stranger = voters[11];

    info(`Deployer : ${deployer.address}`);
    info(`KH0      : ${kh0.address}`);
    info(`KH1      : ${kh1.address}`);
    info(`KH2      : ${kh2.address}`);
    info(`Contract : ${CONTRACT_ADDRESS}`);
    info(`RPC      : ${RPC_URL}`);

    const deployerBalance = await provider.getBalance(deployer.address);
    info(`Deployer balance: ${ethers.formatEther(deployerBalance)} PAS`);

    if (deployerBalance === 0n) {
        console.error("No balance — get tokens from faucet first");
        process.exit(1);
    }

    // ── BabyJubJub setup ─────────────────────────────────────────────────────
    const babyJub = await buildBabyjub();
    const base8   = {
        x: babyJub.F.toObject(babyJub.Base8[0]),
        y: babyJub.F.toObject(babyJub.Base8[1]),
    };

    // Deterministic private shares for testing
    const privateShares = [1n, 2n, 3n];
    const publicShares  = privateShares.map(s => scalarMul(base8, s));

    // Expected EPK = 1*Base8 + 2*Base8 + 3*Base8 = 6*Base8
    let epk = { x: 0n, y: 1n };
    for (const ps of publicShares) epk = pointAdd(epk, ps);
    info(`EPK x: ${epk.x}`);
    info(`EPK y: ${epk.y}`);

    // ── Connect to contract ───────────────────────────────────────────────────
    const iface    = new ethers.Interface(CONTRACT_ABI);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, deployer);

    // ── createProposal ────────────────────────────────────────────────────────
    section("createProposal");

    let proposalId;
    try {
        const tx = await contract.createProposal(
            "Best protocol?",
            ["Polkadot", "Ethereum", "Solana"],
            0,              // NORMAL
            500,            // duration: 500 blocks
            0,              // eligibilityThreshold: 0 = open to all
            10              // minVoterThreshold
        );
        const receipt = await waitForTx(tx);
        const events  = parseEvents(receipt, iface);
        const created = events.find(e => e.name === "ProposalCreated");
        proposalId    = created.args.proposalId;
        info(`proposalId: ${proposalId}`);
        ok("createProposal emits ProposalCreated");
    } catch (e) { fail("createProposal", e); process.exit(1); }

    // status = PENDING_DKG
    try {
        const { status } = await contract.getElectionPublicKey(proposalId);
        if (Number(status) === 0) ok("Initial status is PENDING_DKG");
        else fail(`Expected PENDING_DKG(0), got ${status}`);
    } catch (e) { fail("getElectionPublicKey initial", e); }

    // Reject: invalid option count
    try {
        await contract.createProposal("x", ["only one"], 0, 100, 0, 10);
        fail("Should reject 1 option");
    } catch (e) { ok("Rejects option count < 2"); }

    // Reject: zero duration
    try {
        await contract.createProposal("x", ["a","b"], 0, 0, 0, 10);
        fail("Should reject duration=0");
    } catch (e) { ok("Rejects duration = 0"); }

    // Reject: minVoterThreshold < 10
    try {
        await contract.createProposal("x", ["a","b"], 0, 100, 0, 5);
        fail("Should reject minVoterThreshold < 10");
    } catch (e) { ok("Rejects minVoterThreshold < 10"); }

    // ── DKG: submitPublicKeyShare ─────────────────────────────────────────────
    section("DKG — submitPublicKeyShare");

    // Reject: non-keyholder
    try {
        await contract.connect(stranger).submitPublicKeyShare.staticCall(proposalId, publicShares[0].x, publicShares[0].y);
        fail("Non-keyholder should be rejected");
    } catch (e) { ok("Non-keyholder rejected (NotKeyholder)"); }

    // Reject: identity point (0, 1)
    try {
        await contract.connect(kh0).submitPublicKeyShare.staticCall(proposalId, 0n, 1n);
        fail("Identity point should be rejected");
    } catch (e) { ok("Identity point (0,1) rejected (InvalidPoint)"); }

    // Reject: off-curve point
    try {
        await contract.connect(kh0).submitPublicKeyShare.staticCall(proposalId, 1n, 2n);
        fail("Off-curve point should be rejected");
    } catch (e) { ok("Off-curve point rejected (InvalidPoint)"); }

    // KH0 submits
    try {
        const tx = await contract.connect(kh0).submitPublicKeyShare(
            proposalId, publicShares[0].x, publicShares[0].y,
            { gasLimit: 1_000_000n }
        );
        await waitForTx(tx);
        const { addresses, submitted } = await contract.getDKGStatus(proposalId);
        if (submitted[0] && !submitted[1] && !submitted[2])
            ok("KH0 share accepted, others pending");
        else
            fail("DKG status wrong after KH0");
    } catch (e) { fail("KH0 submitPublicKeyShare", e); }

    // Reject: duplicate from KH0
    try {
        await contract.connect(kh0).submitPublicKeyShare.staticCall(
            proposalId, publicShares[0].x, publicShares[0].y
        );
        fail("Duplicate should be rejected");
    } catch (e) { ok("Duplicate submission rejected (AlreadySubmittedShare)"); }

    // KH1 submits
    try {
        const tx = await contract.connect(kh1).submitPublicKeyShare(
            proposalId, publicShares[1].x, publicShares[1].y,
            { gasLimit: 1_000_000n }
        );
        await waitForTx(tx);
        ok("KH1 share accepted");
    } catch (e) { fail("KH1 submitPublicKeyShare", e); }

    // KH2 submits — triggers _finalizeElectionKey
    let endBlock;
    try {
        const tx = await contract.connect(kh2).submitPublicKeyShare(
            proposalId, publicShares[2].x, publicShares[2].y,
            { gasLimit: 2_000_000n }
        );
        const receipt = await waitForTx(tx);
        const events  = parseEvents(receipt, iface);

        const keyEv    = events.find(e => e.name === "ElectionKeyComputed");
        const votingEv = events.find(e => e.name === "VotingStarted");

        if (keyEv)    ok("ElectionKeyComputed event emitted");
        else          fail("ElectionKeyComputed event missing");
        if (votingEv) {
            ok("VotingStarted event emitted");
            endBlock = votingEv.args.endBlock;
            info(`startBlock: ${votingEv.args.startBlock}  endBlock: ${endBlock}`);
        } else {
            fail("VotingStarted event missing");
        }
    } catch (e) { fail("KH2 submitPublicKeyShare (final)", e); process.exit(1); }

    // Verify combined key on-chain
    try {
        const { x, y, status, sharesIn } = await contract.getElectionPublicKey(proposalId);
        if (Number(sharesIn) === 3)   ok("All 3 shares recorded (shareCount=3)");
        else                          fail(`Expected 3 shares, got ${sharesIn}`);
        if (Number(status) === 1)     ok("Status transitioned to ACTIVE");
        else                          fail(`Expected ACTIVE(1), got ${status}`);
        if (x.toString() === epk.x.toString() && y.toString() === epk.y.toString())
                                      ok("On-chain EPK matches JS-computed 6×Base8");
        else                          fail(`EPK mismatch — on-chain (${x}, ${y})`);
    } catch (e) { fail("getElectionPublicKey post-DKG", e); }

    // Verify individual shares
    try {
        for (let i = 0; i < 3; i++) {
            const { x, y, submitted } = await contract.getPublicKeyShare(proposalId, i);
            if (!submitted)                                  { fail(`KH${i} share not marked submitted`); continue; }
            if (x.toString() === publicShares[i].x.toString() &&
                y.toString() === publicShares[i].y.toString())
                ok(`getPublicKeyShare(${i}) correct`);
            else
                fail(`getPublicKeyShare(${i}) mismatch`);
        }
    } catch (e) { fail("getPublicKeyShare", e); }

    // Cannot submit after DKG complete
    try {
        await contract.connect(kh0).submitPublicKeyShare.staticCall(
            proposalId, publicShares[0].x, publicShares[0].y
        );
        fail("Should reject share after DKG complete");
    } catch (e) { ok("Share rejected after DKG complete (WrongStatus)"); }

    // ── castVote ──────────────────────────────────────────────────────────────
    section("castVote");

    const VOTE_WEIGHT = 5n;
    const VOTE_OPTION = 0;
    const VOTE_NONCE  = 7n;

    const { pubSignals, encVoteSol, pA, pB, pC } = buildVoteInputs(
        base8, epk, VOTE_WEIGHT, VOTE_OPTION, VOTE_NONCE, 0, VOTE_WEIGHT
    );

    info(`Vote: weight=${VOTE_WEIGHT}, option=${VOTE_OPTION}, nonce=${VOTE_NONCE}`);

    // Reject: wrong votingMode in signals
    try {
        const badSignals = [...pubSignals]; badSignals[1] = 1n;
        await contract.connect(deployer).castVote.staticCall(
            proposalId, pA, pB, pC, badSignals, encVoteSol
        );
        fail("Wrong votingMode should be rejected");
    } catch (e) { ok("Wrong votingMode rejected (PublicInputMismatch)"); }

    // Reject: wrong EPK in signals
    try {
        const badSignals = [...pubSignals]; badSignals[2] = 12345n;
        await contract.connect(deployer).castVote.staticCall(
            proposalId, pA, pB, pC, badSignals, encVoteSol
        );
        fail("Wrong EPK x should be rejected");
    } catch (e) { ok("Wrong EPK in signals rejected (PublicInputMismatch)"); }

    // Reject: encVote doesn't match signals
    try {
        const badEncVote = encVoteSol.map(opt => [[opt[0][0], opt[0][1]], [opt[1][0], opt[1][1]]]);
        badEncVote[0][0][0] = 999n;
        await contract.connect(deployer).castVote.staticCall(
            proposalId, pA, pB, pC, pubSignals, badEncVote
        );
        fail("Mismatched encVote should be rejected");
    } catch (e) { ok("Mismatched encVote rejected (C1XMismatch)"); }

    // Valid vote — deployer
    try {
        const tx = await contract.connect(deployer).castVote(
            proposalId, pA, pB, pC, pubSignals, encVoteSol,
            { gasLimit: 5_000_000n }
        );
        const receipt = await waitForTx(tx);
        const events  = parseEvents(receipt, iface);
        const voteCastEv = events.find(e => e.name === "VoteCast");
        if (voteCastEv) ok(`VoteCast emitted — voteCount: ${voteCastEv.args.voteCount}`);
        else            fail("VoteCast event not found");
    } catch (e) { fail("Valid castVote", e); }

    // Reject: double vote
    try {
        await contract.connect(deployer).castVote.staticCall(
            proposalId, pA, pB, pC, pubSignals, encVoteSol
        );
        fail("Double vote should be rejected");
    } catch (e) { ok("Double vote rejected (AlreadyVoted)"); }

    // Verify encrypted tally updated
    try {
        const { c1 } = await contract.getEncryptedTally(proposalId, 0);
        const expectedC1 = scalarMul(base8, VOTE_NONCE);
        if (c1[0].toString() === expectedC1.x.toString() &&
            c1[1].toString() === expectedC1.y.toString())
            ok("Encrypted tally c1[0] correct (nonce*Base8)");
        else
            fail(`Tally c1[0] mismatch — got (${c1[0]}, ${c1[1]})`);
    } catch (e) { fail("getEncryptedTally after vote", e); }

    // ── Full flow: ENDED → REVEALED ───────────────────────────────────────────
    section("Full flow: ENDED → REVEALED (new proposal)");

    info("Creating new proposal (minVoterThreshold=10, need 10 votes)...");
    let pid2;
    try {
        const tx = await contract.createProposal(
            "Decryption test",
            ["Alpha", "Beta", "Gamma"],
            0,      // NORMAL
            60,   // duration
            0,      // no token gating
            10      // minVoterThreshold
        );
        const receipt = await waitForTx(tx);
        const events  = parseEvents(receipt, iface);
        pid2 = events.find(e => e.name === "ProposalCreated").args.proposalId;
        info(`New proposalId: ${pid2}`);
        ok("New proposal created");
    } catch (e) { fail("Create decryption test proposal", e); process.exit(1); }

    // DKG for new proposal
    try {
        info("Submitting DKG shares for new proposal...");
        const tx0 = await contract.connect(kh0).submitPublicKeyShare(
            pid2, publicShares[0].x, publicShares[0].y, { gasLimit: 1_000_000n }
        );
        await waitForTx(tx0);
        const tx1 = await contract.connect(kh1).submitPublicKeyShare(
            pid2, publicShares[1].x, publicShares[1].y, { gasLimit: 1_000_000n }
        );
        await waitForTx(tx1);
        const tx2 = await contract.connect(kh2).submitPublicKeyShare(
            pid2, publicShares[2].x, publicShares[2].y, { gasLimit: 2_000_000n }
        );
        await waitForTx(tx2);
        const { status } = await contract.getElectionPublicKey(pid2);
        if (Number(status) === 1) ok("DKG complete for new proposal → ACTIVE");
        else fail(`Expected ACTIVE(1), got ${status}`);
    } catch (e) { fail("DKG for new proposal", e); process.exit(1); }

    // Cast 10 votes from different wallets
    // Use derived wallets for this — fund them first from deployer
    info("Casting 10 votes from different wallets...");
    info("NOTE: derived wallets need PAS balance. Funding from deployer...");

    let votescast = 0;
    const voterWallets = [];

    for (let v = 0; v < 10; v++) {
        // derive test wallet
        const wallet = ethers.Wallet.fromPhrase(
            "test test test test test test test test test test test junk",
            `m/44'/60'/0'/0/${v}`
        ).connect(provider);
        voterWallets.push(wallet);

        // fund voter with enough PAS for gas
        try {
            const bal = await provider.getBalance(wallet.address);
            if (bal < ethers.parseEther("0.1")) {
                info(`Funding voter ${v} (${wallet.address})...`);
                const fundTx = await deployer.sendTransaction({
                    to: wallet.address,
                    value: ethers.parseEther("0.5"),
                    gasLimit: 21000n
                });
                await waitForTx(fundTx);
            }
        } catch (e) {
            info(`Could not fund voter ${v}: ${e.message?.split('\n')[0]}`);
        }
    }

    for (let v = 0; v < 10; v++) {
        const voter  = voterWallets[v];
        const nonce  = BigInt(v + 10);
        const weight = 1n;
        const { pubSignals: ps, encVoteSol: ev } = buildVoteInputs(
            base8, epk, weight, 0, nonce, 0, weight
        );
        try {
            
            await waitForTx(tx);
            votescast++;
            info(`  Voter ${v} voted ✓`);
        } catch (e) {
            info(`  Voter ${v} failed: ${e?.message?.split('\n')[0]}`);
        }
    }

    if (votescast >= 10) ok(`${votescast} votes cast successfully`);
    else                 fail(`Only ${votescast}/10 votes cast`);

    // closeVoting — need to wait for endBlock
    // On a real chain we cannot mine blocks, we wait
    info("Waiting for endBlock to pass (this may take a while on real chain)...");
    const proposalData = await contract.proposals(pid2);
    const pid2EndBlock = proposalData.endBlock;
    info(`endBlock: ${pid2EndBlock}`);

    let currentBlock = await provider.getBlockNumber();
    if (BigInt(currentBlock) <= pid2EndBlock) {
        const blocksLeft = Number(pid2EndBlock - BigInt(currentBlock)) + 1;
        info(`Need to wait ${blocksLeft} more blocks (~${(blocksLeft * 6 / 60).toFixed(1)} minutes)...`);
        info("Polling every 30 seconds...");
        while (true) {
            await new Promise(r => setTimeout(r, 30000));
            currentBlock = await provider.getBlockNumber();
            info(`Current block: ${currentBlock} / endBlock: ${pid2EndBlock}`);
            if (BigInt(currentBlock) > pid2EndBlock) break;
        }
    }

    // closeVoting
    try {
        const tx = await contract.closeVoting(pid2, { gasLimit: 500_000n });
        const receipt = await waitForTx(tx);
        const events  = parseEvents(receipt, iface);
        const endedEv = events.find(e => e.name === "VotingEnded");
        if (endedEv) ok(`VotingEnded emitted — totalVotes: ${endedEv.args.totalVotes}`);
        else         fail("VotingEnded event not found");
        const { status } = await contract.getElectionPublicKey(pid2);
        if (Number(status) === 2) ok("Status is ENDED");
        else                      fail(`Expected ENDED(2), got ${status}`);
    } catch (e) { fail("closeVoting new proposal", e); }

    // ── submitPartialDecrypt ──────────────────────────────────────────────────
    section("submitPartialDecrypt");

    // Reject: non-keyholder
    try {
        const dummyPartials = Array(10).fill([base8.x, base8.y]);
        await contract.connect(stranger).submitPartialDecrypt.staticCall(pid2, dummyPartials);
        fail("Non-keyholder should be rejected");
    } catch (e) { ok("Non-keyholder partial decrypt rejected"); }

    // Reject: off-curve partial
    try {
        const badPartials = Array(10).fill([1n, 2n]);
        await contract.connect(kh0).submitPartialDecrypt.staticCall(pid2, badPartials);
        fail("Off-curve partial should be rejected");
    } catch (e) { ok("Off-curve partial decryption rejected (InvalidPoint)"); }

    // Compute correct partial decryptions
    info("Computing partial decryptions off-chain...");
    const partialSets = [];
    for (let k = 0; k < 3; k++) {
        const partials = [];
        for (let i = 0; i < 10; i++) {
            const { c1 } = await contract.getEncryptedTally(pid2, i);
            const c1pt   = { x: BigInt(c1[0].toString()), y: BigInt(c1[1].toString()) };
            // D_i = privateShare * c1
            const D = scalarMul(c1pt, privateShares[k]);
            partials.push([D.x, D.y]);
        }
        partialSets.push(partials);
    }

    // KH0
    try {
        const tx = await contract.connect(kh0).submitPartialDecrypt(
            pid2, partialSets[0], { gasLimit: 3_000_000n }
        );
        const receipt = await waitForTx(tx);
        const events  = parseEvents(receipt, iface);
        if (events.find(e => e.name === "PartialDecryptionSubmitted"))
            ok("KH0 partial decryption submitted");
        else
            fail("PartialDecryptionSubmitted event not found");
    } catch (e) { fail("KH0 submitPartialDecrypt", e); }

    // Reject: duplicate from KH0
    try {
        await contract.connect(kh0).submitPartialDecrypt.staticCall(pid2, partialSets[0]);
        fail("Duplicate partial should be rejected");
    } catch (e) { ok("Duplicate partial rejected (AlreadySubmittedPartial)"); }

    // KH1
    try {
        const tx = await contract.connect(kh1).submitPartialDecrypt(
            pid2, partialSets[1], { gasLimit: 3_000_000n }
        );
        await waitForTx(tx);
        ok("KH1 partial decryption submitted");
    } catch (e) { fail("KH1 submitPartialDecrypt", e); }

    // KH2 — triggers _finalizeResult automatically
    try {
        const tx = await contract.connect(kh2).submitPartialDecrypt(
            pid2, partialSets[2], { gasLimit: 5_000_000n }
        );
        const receipt = await waitForTx(tx);
        const events  = parseEvents(receipt, iface);
        if (events.find(e => e.name === "ResultRevealed"))
            ok("KH2 submission triggered automatic finalizeResult → ResultRevealed");
        else
            fail("ResultRevealed event not found after KH2 submission");
    } catch (e) { fail("KH2 submitPartialDecrypt", e); }

    // Reject: duplicate from KH2
    try {
        await contract.connect(kh2).submitPartialDecrypt.staticCall(pid2, partialSets[2]);
        fail("Duplicate partial should be rejected");
    } catch (e) { ok("Duplicate partial rejected after all submitted"); }

    // ── Verify final result ───────────────────────────────────────────────────
    section("Verify final result");

    try {
        const { tally, winningOption, status } = await contract.getResult(pid2);
        const statusNames = ["PENDING_DKG","ACTIVE","ENDED","REVEALED","CANCELLED"];
        info(`status      : ${statusNames[Number(status)]}`);
        info(`winningOption: ${winningOption}`);
        info(`tally[0]    : ${tally[0]}`);
        info(`tally[1]    : ${tally[1]}`);
        info(`tally[2]    : ${tally[2]}`);

        if (Number(status) === 3)        ok("Status is REVEALED");
        else                             fail(`Expected REVEALED(3), got ${status}`);

        if (Number(winningOption) === 0) ok("Winning option is 0 (Alpha) ✓");
        else                             fail(`Expected winning option 0, got ${winningOption}`);

        // 10 votes of weight=1 on option 0
        if (Number(tally[0]) === 10)     ok("tally[0] = 10 ✓");
        else                             fail(`Expected tally[0]=10, got ${tally[0]}`);

        if (Number(tally[1]) === 0)      ok("tally[1] = 0 ✓");
        else                             fail(`Expected tally[1]=0, got ${tally[1]}`);

        if (Number(tally[2]) === 0)      ok("tally[2] = 0 ✓");
        else                             fail(`Expected tally[2]=0, got ${tally[2]}`);
    } catch (e) { fail("getResult", e); }

    // Verify result off-chain manually
    try {
        info("Cross-checking result off-chain...");
        for (let i = 0; i < 3; i++) {
            const { c1, c2 } = await contract.getEncryptedTally(pid2, i);
            const c1pt = { x: BigInt(c1[0].toString()), y: BigInt(c1[1].toString()) };
            const c2pt = { x: BigInt(c2[0].toString()), y: BigInt(c2[1].toString()) };

            // sum partials
            let fullD = { x: 0n, y: 1n };
            for (let k = 0; k < 3; k++) {
                const D = scalarMul(c1pt, privateShares[k]);
                fullD = pointAdd(fullD, D);
            }

            // mg = c2 - fullD
            const negFullD = { x: fullD.x === 0n ? 0n : FIELD_MODULUS - fullD.x, y: fullD.y };
            const mg = pointAdd(c2pt, negFullD);

            // discrete log
            const tally = discreteLogOffChain(mg, base8, 50);
            info(`  option ${i}: tally = ${tally}`);
        }
        ok("Off-chain cross-check complete");
    } catch (e) { fail("Off-chain cross-check", e); }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════════════════════");
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log("══════════════════════════════════════════════════════════════\n");

    if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });