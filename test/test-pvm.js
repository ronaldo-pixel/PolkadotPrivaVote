// scripts/test-pvm.js
// Full DKG + castVote + decryption test against a contract deployed from PVM artifacts.
// Reads ABI from build/PrivateVoting.abi and address from build/deployment-<chainId>.json
//
// Run:
//   npx hardhat run scripts/test-pvm.js --network polkadotTestnet
//   npx hardhat run scripts/test-pvm.js --network hardhat

"use strict";

const fs             = require("fs");
const path           = require("path");
const { buildBabyjub } = require("circomlibjs");

// ── Paths ─────────────────────────────────────────────────────────────────────

const BUILD_DIR = path.resolve(__dirname, "../build");
const ABI_FILE  = path.join(BUILD_DIR, "PrivateVoting.abi");

// ── BabyJubJub JS helpers ─────────────────────────────────────────────────────

const FIELD_MODULUS = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
const BABYJUB_A     = 168700n;
const BABYJUB_D     = 168696n;

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
    return { x: numX * modInverse(denX, p) % p, y: numY * modInverse(denY, p) % p };
}

function scalarMul(pt, scalar) {
    const ORDER = BigInt("2736030358979909402780800718157159386076813972158567259200215660948447373041");
    scalar = scalar % ORDER;
    let result  = { x: 0n, y: 1n };
    let current = { x: pt.x, y: pt.y };
    for (let i = 0; i < 254; i++) {
        if ((scalar >> BigInt(i)) & 1n) result = pointAdd(result, current);
        current = pointAdd(current, current);
    }
    return result;
}

// ── Logging ───────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
function ok(label)      { console.log(`  ✓  ${label}`); passed++; }
function fail(label, e) { console.log(`  ✗  ${label}`); if (e) console.log(`     ${e?.message?.split('\n')[0] ?? e}`); failed++; }
function section(title) { console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 54 - title.length))}`); }
function info(msg)      { console.log(`     ${msg}`); }

// ── Gas overrides ─────────────────────────────────────────────────────────────

async function gasOverrides(chainId) {
    if (chainId === 420420417n || chainId === 420420420n) {
        return {
            maxFeePerGas:         ethers.parseUnits("1500", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("50",   "gwei"),
        };
    }
    return {};
}

// ── Vote input builder ────────────────────────────────────────────────────────

function buildVoteInputs(babyJub, epk, voteWeight, voteOption, nonce) {
    const base8 = { x: babyJub.F.toObject(babyJub.Base8[0]), y: babyJub.F.toObject(babyJub.Base8[1]) };
    const encVote = [];

    for (let i = 0; i < 10; i++) {
        const weight = i === voteOption ? voteWeight : 0n;
        const n      = i === voteOption ? nonce      : 1n;
        const c1     = scalarMul(base8, n);
        const weightPt = weight === 0n ? { x: 0n, y: 1n } : scalarMul(base8, weight);
        const c2     = pointAdd(weightPt, scalarMul(epk, n));
        encVote.push({ c1, c2 });
    }

    const pubSignals = new Array(44).fill(0n);
    pubSignals[0] = voteWeight;
    pubSignals[1] = 0n; // NORMAL mode
    pubSignals[2] = epk.x;
    pubSignals[3] = epk.y;
    for (let i = 0; i < 10; i++) {
        const base = 4 + i * 4;
        pubSignals[base]     = encVote[i].c1.x;
        pubSignals[base + 1] = encVote[i].c1.y;
        pubSignals[base + 2] = encVote[i].c2.x;
        pubSignals[base + 3] = encVote[i].c2.y;
    }

    // encVoteSol[option][c1/c2][x/y] — matches uint256[2][2][MAX_OPTIONS]
    const encVoteSol = encVote.map(ev => [[ev.c1.x, ev.c1.y], [ev.c2.x, ev.c2.y]]);

    return { pubSignals, encVoteSol, pA: [0n,0n], pB: [[0n,0n],[0n,0n]], pC: [0n,0n] };
}

async function mineBlocks(n) {
    for (let i = 0; i < n; i++) await ethers.provider.send("evm_mine", []);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const babyJub = await buildBabyjub();
    const base8   = { x: babyJub.F.toObject(babyJub.Base8[0]), y: babyJub.F.toObject(babyJub.Base8[1]) };

    const network  = await ethers.provider.getNetwork();
    const chainId  = network.chainId;
    const signers  = await ethers.getSigners();
    const [deployer, kh0, kh1, kh2, ...voters] = signers;
    const gas      = await gasOverrides(chainId);
    const isLocal  = chainId === 31337n;

    console.log("\n══════════════════════════════════════════════════════════");
    console.log("  PrivateVoting PVM — end-to-end test");
    console.log(`  Network : ${network.name} (${chainId})`);
    console.log("══════════════════════════════════════════════════════════");

    // ── Load ABI ──────────────────────────────────────────────────────────────
    section("Setup");

    if (!fs.existsSync(ABI_FILE)) {
        console.error(`ABI not found: ${ABI_FILE}`);
        process.exit(1);
    }
    const abi = JSON.parse(fs.readFileSync(ABI_FILE, "utf-8"));
    info(`ABI loaded (${abi.length} entries)`);

    // ── Attach or deploy contract ─────────────────────────────────────────────
    let contract;
    const deployFile = path.join(BUILD_DIR, `deployment-${chainId}.json`);

    if (fs.existsSync(deployFile)) {
        // Use existing deployment
        const record  = JSON.parse(fs.readFileSync(deployFile, "utf-8"));
        const address = record.contractAddress;
        info(`Using existing deployment: ${address}`);
        contract = new ethers.Contract(address, abi, deployer);
        ok("Contract attached from deployment record");
    } else if (isLocal) {
        // Deploy fresh on local hardhat
        const PVM_FILE = path.join(BUILD_DIR, "PrivateVoting.sol:PrivateVoting.pvm");
        let bytecode;
        if (fs.existsSync(PVM_FILE)) {
            const hex = fs.readFileSync(PVM_FILE, "utf-8").trim();
            bytecode  = hex.startsWith("0x") ? hex : "0x" + hex;
            info("Using pre-compiled PVM bytecode");
        } else {
            // Fall back to Hardhat-compiled artifact
            const Factory = await ethers.getContractFactory("PrivateVoting");
            bytecode = Factory.bytecode;
            info("Using Hardhat-compiled bytecode (PVM not found)");
        }
        const factory  = new ethers.ContractFactory(abi, bytecode, deployer);
        contract = await factory.deploy(kh0.address, kh1.address, kh2.address,
            "0x0000000000000000000000000000000000000001", gas);
        await contract.waitForDeployment();
        info(`Deployed to: ${await contract.getAddress()}`);
        ok("Contract deployed (local)");
    } else {
        console.error(`No deployment record found for chainId ${chainId}.`);
        console.error(`Run:  npx hardhat run scripts/deploy-pvm.js --network <network>`);
        process.exit(1);
    }

    // ── Read registered keyholders from the contract ──────────────────────────
    // On testnet the keyholders are whatever was passed to the constructor.
    // Match signers to those addresses.
    const khAddr = [
        await contract.keyholders(0),
        await contract.keyholders(1),
        await contract.keyholders(2),
    ];
    info(`keyholders[0]: ${khAddr[0]}`);
    info(`keyholders[1]: ${khAddr[1]}`);
    info(`keyholders[2]: ${khAddr[2]}`);

    const findSigner = (addr) =>
        signers.find(s => s.address.toLowerCase() === addr.toLowerCase());

    const khSigners = khAddr.map(a => findSigner(a));
    const allKHAvailable = khSigners.every(Boolean);
    if (!allKHAvailable) {
        info("NOTE: not all keyholder signers available — DKG and decryption tests will be partial");
    }

    // ── createProposal ────────────────────────────────────────────────────────
    section("createProposal");

    let pid;
    try {
        const tx = await contract.connect(deployer).createProposal(
            "Best L1?", ["Polkadot","Ethereum","Solana"], 0,
            isLocal ? 500 : 200,   // shorter duration on testnet
            0, 10,
            deployer.address,      // dummy tokenContract (eligibilityThreshold=0 so never called)
            gas
        );
        const receipt = await tx.wait();
        const ev = receipt.logs
            .map(l => { try { return contract.interface.parseLog(l); } catch { return null; } })
            .find(e => e?.name === "ProposalCreated");
        pid = ev.args.proposalId;
        info(`proposalId: ${pid}`);
        ok("createProposal succeeded");
    } catch (e) { fail("createProposal", e); process.exit(1); }

    const { status: initStatus } = await contract.getElectionPublicKey(pid);
    if (Number(initStatus) === 0) ok("Status is PENDING_DKG");
    else fail(`Expected PENDING_DKG, got ${initStatus}`);

    // ── DKG ───────────────────────────────────────────────────────────────────
    section("DKG — submitPublicKeyShare");

    const privateShares = [1n, 2n, 3n];
    const publicShares  = privateShares.map(s => scalarMul(base8, s));
    let epk = { x: 0n, y: 1n };
    for (const ps of publicShares) epk = pointAdd(epk, ps);
    info(`Expected EPK: (${epk.x.toString().slice(0,20)}...)`);

    // Rejection tests (callable from deployer who is not a keyholder)
    try {
        await contract.connect(deployer).submitPublicKeyShare(pid, publicShares[0].x, publicShares[0].y, gas);
        fail("Non-keyholder should be rejected");
    } catch (e) { ok("Non-keyholder rejected"); }

    try {
        await (khSigners[0] ?? deployer).sendTransaction &&
        await contract.connect(khSigners[0] ?? signers[0]).submitPublicKeyShare(pid, 0n, 1n, gas);
        fail("Identity point should be rejected");
    } catch (e) { ok("Identity point (0,1) rejected"); }

    try {
        await contract.connect(khSigners[0] ?? signers[0]).submitPublicKeyShare(pid, 1n, 2n, gas);
        fail("Off-curve point should be rejected");
    } catch (e) { ok("Off-curve point rejected"); }

    // Submit shares
    let sharesSubmitted = 0;
    for (let i = 0; i < 3; i++) {
        if (!khSigners[i]) {
            info(`KH${i} (${khAddr[i]}): no signer — submit manually:`);
            info(`  submitPublicKeyShare(${pid}, ${publicShares[i].x}, ${publicShares[i].y})`);
            continue;
        }
        try {
            const tx = await contract.connect(khSigners[i]).submitPublicKeyShare(
                pid, publicShares[i].x, publicShares[i].y, gas
            );
            const receipt = await tx.wait();
            const events  = receipt.logs
                .map(l => { try { return contract.interface.parseLog(l); } catch { return null; } })
                .filter(Boolean);
            if (events.find(e => e.name === "PublicKeyShareSubmitted")) {
                ok(`KH${i} share submitted`);
                sharesSubmitted++;
            }
            if (events.find(e => e.name === "VotingStarted")) ok("VotingStarted — DKG complete");
        } catch (e) { fail(`KH${i} share submission`, e); }
    }

    if (sharesSubmitted === 3) {
        const { x, y, status } = await contract.getElectionPublicKey(pid);
        if (Number(status) === 1) ok("Status is ACTIVE");
        else fail(`Expected ACTIVE, got ${status}`);
        if (x.toString() === epk.x.toString() && y.toString() === epk.y.toString())
            ok("On-chain EPK matches JS-computed value");
        else fail(`EPK mismatch`);
    } else {
        info(`Only ${sharesSubmitted}/3 shares submitted — skipping vote/decrypt tests`);
        printSummary();
        return;
    }

    // ── castVote ──────────────────────────────────────────────────────────────
    section("castVote");

    const { pubSignals, encVoteSol, pA, pB, pC } = buildVoteInputs(babyJub, epk, 5n, 0, 7n);

    // Wrong EPK
    try {
        const bad = [...pubSignals]; bad[2] = 999n;
        await contract.connect(deployer).castVote(pid, pA, pB, pC, bad, encVoteSol, gas);
        fail("Wrong EPK should be rejected");
    } catch (e) { ok("Wrong EPK rejected"); }

    // Valid vote from deployer
    let voteOk = false;
    try {
        const tx = await contract.connect(deployer).castVote(pid, pA, pB, pC, pubSignals, encVoteSol, gas);
        const receipt = await tx.wait();
        const ev = receipt.logs
            .map(l => { try { return contract.interface.parseLog(l); } catch { return null; } })
            .find(e => e?.name === "VoteCast");
        if (ev) { ok(`Vote cast — count: ${ev.args.voteCount}`); voteOk = true; }
        else fail("VoteCast event not found");
    } catch (e) { fail("castVote", e); }

    // Double vote
    try {
        await contract.connect(deployer).castVote(pid, pA, pB, pC, pubSignals, encVoteSol, gas);
        fail("Double vote should be rejected");
    } catch (e) { ok("Double vote rejected"); }

    // Cast more votes to reach minVoterThreshold=10
    info("Casting 9 more votes to reach threshold...");
    let totalVotes = voteOk ? 1 : 0;
    for (let v = 0; v < signers.length && totalVotes < 10; v++) {
        if (signers[v].address === deployer.address) continue;
        const n = BigInt(v + 20);
        const { pubSignals: ps, encVoteSol: ev } = buildVoteInputs(babyJub, epk, 1n, 0, n);
        try {
            await (await contract.connect(signers[v]).castVote(pid, pA, pB, pC, ps, ev, gas)).wait();
            totalVotes++;
        } catch (_) {}
    }
    info(`Total votes cast: ${totalVotes}`);

    // ── closeVoting ───────────────────────────────────────────────────────────
    section("closeVoting");

    const p2 = await contract.proposals(pid);
    const endBlock = p2.endBlock;
    const curBlock = await ethers.provider.getBlockNumber();

    if (isLocal) {
        const toMine = Number(endBlock) - curBlock + 2;
        info(`Mining ${toMine} blocks...`);
        await mineBlocks(toMine);
    } else {
        info(`Waiting for endBlock ${endBlock} (current: ${curBlock})...`);
        info("On testnet, you may need to wait or manually call closeVoting later.");
    }

    try {
        const tx = await contract.connect(deployer).closeVoting(pid, gas);
        const receipt = await tx.wait();
        const { status } = await contract.getElectionPublicKey(pid);
        const statusName = ["PENDING_DKG","ACTIVE","ENDED","REVEALED","CANCELLED"][Number(status)];
        info(`Post-closeVoting status: ${statusName}`);
        if (Number(status) === 2) ok("Status is ENDED");
        else if (Number(status) === 4) {
            ok("Status is CANCELLED (voteCount < minVoterThreshold — expected on testnet with few signers)");
            printSummary();
            return;
        } else fail(`Unexpected status: ${statusName}`);
    } catch (e) { fail("closeVoting", e); }

    // ── submitPartialDecrypt ──────────────────────────────────────────────────
    section("submitPartialDecrypt");

    const NUM_OPTIONS = 3; // "Best L1?" has 3 options
    const partialSets = [];
    for (let k = 0; k < 3; k++) {
        const partials = [];
        for (let i = 0; i < NUM_OPTIONS; i++) {
            const { c1 } = await contract.getEncryptedTally(pid, i);
            const c1pt   = { x: c1[0], y: c1[1] };
            const D      = scalarMul(c1pt, privateShares[k]);
            partials.push([D.x, D.y]);
        }
        // Pad to MAX_OPTIONS=10 with Base8 (contract ignores slots beyond optionCount)
        while (partials.length < 10) partials.push([base8.x, base8.y]);
        partialSets.push(partials);
    }

    for (let k = 0; k < 3; k++) {
        if (!khSigners[k]) {
            info(`KH${k}: submit partial decryption manually for proposal ${pid}`);
            continue;
        }
        try {
            const tx = await contract.connect(khSigners[k]).submitPartialDecrypt(pid, partialSets[k], gas);
            await tx.wait();
            ok(`KH${k} partial decryption submitted`);
        } catch (e) { fail(`KH${k} submitPartialDecrypt`, e); }
    }

    // ── finalizeResult ────────────────────────────────────────────────────────
    section("finalizeResult");

    try {
        const tx = await contract.connect(deployer).finalizeResult(pid, 50, gas);
        const receipt = await tx.wait();
        const ev = receipt.logs
            .map(l => { try { return contract.interface.parseLog(l); } catch { return null; } })
            .find(e => e?.name === "ResultRevealed");
        if (ev) ok(`ResultRevealed — winningOption: ${ev.args.winningOption}`);
        else fail("ResultRevealed event not found");

        const { tally, winningOption, status } = await contract.getResult(pid);
        info(`tally[0]: ${tally[0]}, tally[1]: ${tally[1]}, tally[2]: ${tally[2]}`);
        info(`winningOption: ${winningOption}`);
        if (Number(status) === 3) ok("Status is REVEALED");
        else fail(`Expected REVEALED, got ${status}`);
        if (Number(winningOption) === 0) ok("Winning option is 0 (Polkadot)");
        else fail(`Expected option 0, got ${winningOption}`);
    } catch (e) { fail("finalizeResult", e); }

    printSummary();
}

function printSummary() {
    console.log("\n══════════════════════════════════════════════════════════");
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log("══════════════════════════════════════════════════════════\n");
    if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });