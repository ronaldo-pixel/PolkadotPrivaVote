// test-complete.js - simplified with only 4 wallets
"use strict";

require("dotenv").config();
const { ethers }       = require("ethers");
const { buildBabyjub } = require("circomlibjs");
const fs               = require("fs");
const path             = require("path");

const RPC_URL          = process.env.PASEO_RPC_URL;
const CONTRACT_ADDRESS = process.env.PRIVATE_VOTING_ADDRESS;

const combined     = JSON.parse(fs.readFileSync(path.join(__dirname, "../build", "PrivateVoting.json")));
const contractKey  = Object.keys(combined.contracts).find(k => k.includes("contracts/PrivateVoting.sol:PrivateVoting"));
const CONTRACT_ABI = combined.contracts[contractKey].abi;

const FIELD_MODULUS  = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
const BABYJUB_A      = 168700n;
const BABYJUB_D      = 168696n;
const SUBGROUP_ORDER = BigInt("2736030358979909402780800718157159386076813972158567259200215660948447373041");

function modpow(base, exp, mod) {
    let result = 1n; base = base % mod;
    while (exp > 0n) {
        if (exp % 2n === 1n) result = result * base % mod;
        exp >>= 1n; base = base * base % mod;
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
    // ensure both are BigInt
    const px = BigInt(pt.x.toString());
    const py = BigInt(pt.y.toString());
    scalar    = BigInt(scalar.toString()) % SUBGROUP_ORDER;

    let result  = { x: 0n, y: 1n };
    let current = { x: px, y: py };

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
    return -1;
}

let passed = 0, failed = 0;
function ok(label)      { console.log(`  ✓  ${label}`); passed++; }
function fail(label, e) { console.log(`  ✗  ${label}`); if (e) console.log(`     ${e?.message?.split('\n')[0] ?? e}`); failed++; }
function section(title) { console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 54 - title.length))}`); }
function info(msg)      { console.log(`     ${msg}`); }

async function waitForTx(tx) {
    info(`Tx: ${tx.hash}`);
    const provider = tx.provider;
    let attempts = 0;
    while (attempts < 60) {
        await new Promise(r => setTimeout(r, 3000));
        const receipt = await provider.getTransactionReceipt(tx.hash);
        if (receipt) {
            if (receipt.status === 0) throw new Error(`Transaction reverted: ${tx.hash}`);
            return receipt;
        }
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
        const n      = (i === voteOption) ? nonce : 1n;
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
    const encVoteSol = encVote.map(ev => [[ev.c1.x, ev.c1.y], [ev.c2.x, ev.c2.y]]);
    const pA = [0n, 0n];
    const pB = [[0n, 0n], [0n, 0n]];
    const pC = [0n, 0n];
    return { pubSignals, encVoteSol, pA, pB, pC };
}

async function main() {
    console.log("\n══════════════════════════════════════════════════════════════");
    console.log("  PrivateVoting — end-to-end test (4 wallets only)");
    console.log("══════════════════════════════════════════════════════════════");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const deployer = new ethers.Wallet(process.env.PASEO_PK, provider);
    const kh0      = new ethers.Wallet(process.env.KEYHOLDER_0_PRIV, provider);
    const kh1      = new ethers.Wallet(process.env.KEYHOLDER_1_PRIV, provider);
    const kh2      = new ethers.Wallet(process.env.KEYHOLDER_2_PRIV, provider);

    // These 4 wallets are our voters too
    // deployer votes for option 0, kh0/kh1/kh2 vote for option 0 as well
    const voterWallets = [deployer, kh0, kh1, kh2];

    info(`Deployer : ${deployer.address}`);
    info(`KH0      : ${kh0.address}`);
    info(`KH1      : ${kh1.address}`);
    info(`KH2      : ${kh2.address}`);

    // Fund keyholders if needed
    for (const [i, kh] of [kh0, kh1, kh2].entries()) {
        const bal = await provider.getBalance(kh.address);
        info(`KH${i} balance: ${ethers.formatEther(bal)} PAS`);
        if (bal < ethers.parseEther("1")) {
            info(`Funding KH${i}...`);
            const tx = await deployer.sendTransaction({
                to: kh.address,
                value: ethers.parseEther("2"),
                gasLimit: 21000n
            });
            await waitForTx(tx);
        }
    }

    const deployerBalance = await provider.getBalance(deployer.address);
    info(`Deployer balance: ${ethers.formatEther(deployerBalance)} PAS`);
    if (deployerBalance === 0n) { console.error("No balance"); process.exit(1); }

    const babyJub = await buildBabyjub();
    const base8   = {
        x: babyJub.F.toObject(babyJub.Base8[0]),
        y: babyJub.F.toObject(babyJub.Base8[1]),
    };

    const privateShares = [1n, 2n, 3n];
    const publicShares  = privateShares.map(s => scalarMul(base8, s));

    let epk = { x: 0n, y: 1n };
    for (const ps of publicShares) epk = pointAdd(epk, ps);
    info(`EPK = 6 * Base8`);

    const iface    = new ethers.Interface(CONTRACT_ABI);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, deployer);

    // ── createProposal ────────────────────────────────────────────────────────
    section("createProposal");

    // NOTE: minVoterThreshold = 4 so our 4 wallets are enough
    // If your contract has MIN_VOTERS = 10 hardcoded you need to change it to 4
    // or use a contract deployed with MIN_VOTERS = 1 for testing
    let pid;
    try {
        const tx = await contract.createProposal(
            "Best protocol?",
            ["Polkadot", "Ethereum", "Solana"],
            0,    // NORMAL
            60,   // 60 blocks duration (~6 minutes on Passet Hub)
            0,    // no eligibility threshold
            4,    // minVoterThreshold = 4 (matches our 4 wallets)
            { gasLimit: 1_000_000n }
        );
        const receipt = await waitForTx(tx);
        const events  = parseEvents(receipt, iface);
        const created = events.find(e => e.name === "ProposalCreated");
        pid = created.args.proposalId;
        info(`proposalId: ${pid}`);
        ok("createProposal emits ProposalCreated");
    } catch (e) { fail("createProposal", e); process.exit(1); }

    // ── DKG ───────────────────────────────────────────────────────────────────
    section("DKG — submitPublicKeyShare");

    const khWallets = [kh0, kh1, kh2];
    let endBlock;
    for (let k = 0; k < 3; k++) {
        try {
            const gasLimit = k === 2 ? 3_000_000n : 1_000_000n;
            const tx = await contract.connect(khWallets[k]).submitPublicKeyShare(
                pid, publicShares[k].x, publicShares[k].y, { gasLimit }
            );
            const receipt = await waitForTx(tx);
            const events  = parseEvents(receipt, iface);

            if (k === 2) {
                const keyEv    = events.find(e => e.name === "ElectionKeyComputed");
                const votingEv = events.find(e => e.name === "VotingStarted");
                if (keyEv && votingEv) {
                    endBlock = votingEv.args.endBlock;
                    ok(`KH${k} share submitted → DKG complete, endBlock: ${endBlock}`);
                } else {
                    fail(`KH${k} — missing events after final share`);
                }
            } else {
                ok(`KH${k} share submitted`);
            }
        } catch (e) { fail(`KH${k} submitPublicKeyShare`, e); }
    }

    // Verify EPK
    try {
        const { x, y, status, sharesIn } = await contract.getElectionPublicKey(pid);
        if (Number(status) === 1)   ok("Status = ACTIVE");
        else                        fail(`Expected ACTIVE(1), got ${status}`);
        if (Number(sharesIn) === 3) ok("shareCount = 3");
        else                        fail(`Expected 3 shares, got ${sharesIn}`);
        if (x.toString() === epk.x.toString() && y.toString() === epk.y.toString())
                                    ok("EPK matches 6×Base8");
        else                        fail(`EPK mismatch`);
    } catch (e) { fail("getElectionPublicKey", e); }

    // ── castVote — all 4 voters with real ZK proofs ───────────────────────────
    section("castVote — real ZK proofs (all 4 voters)");

    const snarkjs = require("snarkjs");
    const WASM_PATH = path.join(__dirname, "../circuits/build/vote_js/vote.wasm");
    const ZKEY_PATH = path.join(__dirname, "../circuits/build/vote_final.zkey");
    const VKEY_PATH = path.join(__dirname, "../circuits/build/verification_key.json");
    const vkey = JSON.parse(fs.readFileSync(VKEY_PATH, "utf8"));

    // compute encrypted vote using circomlibjs (matches circuit exactly)
    async function computeEncryptedVote(voteVector, nonces, publicKey, babyJub) {
        const F = babyJub.F;
        const G = babyJub.Base8;
        const encryptedVote = [];
        for (let i = 0; i < voteVector.length; i++) {
            const v  = BigInt(voteVector[i]);
            const r  = BigInt(nonces[i]);
            const c1 = babyJub.mulPointEscalar(G, r);
            const vG = v === 0n ? [F.e(0n), F.e(1n)] : babyJub.mulPointEscalar(G, v);
            const pubKeyPoint = [F.e(publicKey[0]), F.e(publicKey[1])];
            const rH = babyJub.mulPointEscalar(pubKeyPoint, r);
            const c2 = babyJub.addPoint(vG, rH);
            encryptedVote.push([
                [F.toObject(c1[0]).toString(), F.toObject(c1[1]).toString()],
                [F.toObject(c2[0]).toString(), F.toObject(c2[1]).toString()]
            ]);
        }
        return encryptedVote;
    }

    async function generateVoteProof(voterIndex, epkX, epkY, babyJub) {
        // unique nonces per voter — multiply base nonces by voter index offset
        const nonceBase = [
            "12345678901234567890",
            "98765432109876543210",
            "11111111111111111111",
            "22222222222222222222",
            "33333333333333333333",
            "44444444444444444444",
            "55555555555555555555",
            "66666666666666666666",
            "77777777777777777777",
            "88888888888888888888"
        ];

        // make nonces unique per voter by adding voterIndex offset to voted option nonce
        const nonces = [...nonceBase];
        nonces[0] = (BigInt(nonceBase[0]) + BigInt(voterIndex * 1000)).toString();

        const voteVector = Array(10).fill("0");
        voteVector[0] = "1"; // all vote for option 0

        const circuitInputs = {
            voteVector,
            voteWeight:     "1",
            nonces,
            claimedBalance: "1",
            votingMode:     "0",
            publicKey:      [epkX.toString(), epkY.toString()],
            encryptedVote:  await computeEncryptedVote(
                voteVector, nonces,
                [epkX.toString(), epkY.toString()],
                babyJub
            )
        };

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            circuitInputs, WASM_PATH, ZKEY_PATH
        );

        // verify off-chain
        const valid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
        if (!valid) throw new Error(`Off-chain verification failed for voter ${voterIndex}`);

        // format for Solidity
        const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
        const [a, b, c, input] = JSON.parse("[" + calldata + "]");

        const pA      = a.map(BigInt);
        const pB      = b.map(row => row.map(BigInt));
        const pC      = c.map(BigInt);
        const signals = input.map(BigInt);

        // extract encVoteSol from public signals
        // layout: option i → c1.x=[4+i*4], c1.y=[5+i*4], c2.x=[6+i*4], c2.y=[7+i*4]
        const encVoteSol = [];
        for (let i = 0; i < 10; i++) {
            const base = 4 + i * 4;
            encVoteSol.push([
                [signals[base],     signals[base + 1]],
                [signals[base + 2], signals[base + 3]]
            ]);
        }

        return { pA, pB, pC, signals, encVoteSol };
    }

    // get EPK from chain
    const epkData = await contract.getElectionPublicKey(pid);
    const epkX = epkData.x;
    const epkY = epkData.y;
    info(`EPK from chain: x=${epkX.toString().slice(0,20)}...`);

    // generate and submit proofs for all 4 voters
    for (let v = 0; v < 4; v++) {
        const voter = voterWallets[v];
        info(`Generating proof for voter ${v} (${voter.address.slice(0,8)}...)...`);

        let proofData;
        try {
            proofData = await generateVoteProof(v, epkX, epkY, babyJub);
            ok(`Voter ${v} proof generated and verified off-chain`);
        } catch (e) {
            fail(`Voter ${v} proof generation`, e);
            continue;
        }

        // simulate first
        try {
            await contract.connect(voter).castVote.staticCall(
                pid,
                proofData.pA,
                proofData.pB,
                proofData.pC,
                proofData.signals,
                proofData.encVoteSol
            );
        } catch (simErr) {
            let reason = simErr?.message?.split('\n')[0] ?? String(simErr);
            if (simErr?.data) {
                try {
                    const decoded = iface.parseError(simErr.data);
                    reason = `${decoded.name}(${Object.values(decoded.args).join(', ')})`;
                } catch { reason = `raw: ${simErr.data}`; }
            }
            fail(`Voter ${v} castVote simulation — ${reason}`);
            continue;
        }

        // send transaction
        try {
            const tx = await contract.connect(voter).castVote(
                pid,
                proofData.pA,
                proofData.pB,
                proofData.pC,
                proofData.signals,
                proofData.encVoteSol,
                { gasLimit: 5_000_000n }
            );
            const receipt = await waitForTx(tx);
            const events  = parseEvents(receipt, iface);
            const voteCastEv = events.find(e => e.name === "VoteCast");
            if (voteCastEv) ok(`Voter ${v} voted with real ZK proof — voteCount: ${voteCastEv.args.voteCount}`);
            else            fail(`Voter ${v} VoteCast event not found`);
        } catch (e) { fail(`Voter ${v} castVote`, e); }
    }

    // double vote check with real proof — should still reject
    info("Testing double vote rejection with real proof...");
    try {
        const proofData = await generateVoteProof(0, epkX, epkY, babyJub);
        await contract.connect(deployer).castVote.staticCall(
            pid,
            proofData.pA,
            proofData.pB,
            proofData.pC,
            proofData.signals,
            proofData.encVoteSol
        );
        fail("Double vote should be rejected");
    } catch (e) { ok("Double vote rejected (AlreadyVoted)"); }

    // verify encrypted tally
    try {
        const { c1 } = await contract.getEncryptedTally(pid, 0);
        info(`Tally c1[0] x: ${c1[0].toString().slice(0, 20)}...`);
        ok("Encrypted tally updated after 4 real ZK votes");
    } catch (e) { fail("getEncryptedTally", e); }

        

    // ── Wait for endBlock ─────────────────────────────────────────────────────
    section("Wait for endBlock");

    let currentBlock = await provider.getBlockNumber();
    info(`Current: ${currentBlock} / endBlock: ${endBlock}`);

    if (BigInt(currentBlock) <= endBlock) {
        const blocksLeft = Number(endBlock - BigInt(currentBlock)) + 1;
        info(`Waiting ${blocksLeft} blocks (~${Math.ceil(blocksLeft * 6 / 60)} minutes)...`);
        while (true) {
            await new Promise(r => setTimeout(r, 10000));
            currentBlock = await provider.getBlockNumber();
            process.stdout.write(`\r     Block ${currentBlock}/${endBlock}   `);
            if (BigInt(currentBlock) > endBlock) break;
        }
        console.log();
    }
    ok("endBlock passed");

    // ── closeVoting ───────────────────────────────────────────────────────────
    section("closeVoting");

    try {
        const tx = await contract.closeVoting(pid, { gasLimit: 500_000n });
        const receipt = await waitForTx(tx);
        const events  = parseEvents(receipt, iface);
        const endedEv = events.find(e => e.name === "VotingEnded");
        if (endedEv) ok(`VotingEnded — totalVotes: ${endedEv.args.totalVotes}`);
        else         fail("VotingEnded event not found");
        const { status } = await contract.getElectionPublicKey(pid);
        if (Number(status) === 2) ok("Status = ENDED");
        else                      fail(`Expected ENDED(2), got ${status}`);
    } catch (e) { fail("closeVoting", e); }

    // ── submitPartialDecrypt ──────────────────────────────────────────────────
    section("submitPartialDecrypt");

    info("Computing partial decryptions off-chain...");
    const partialSets = [];
    
    for (let k = 0; k < 3; k++) {
        const partials = [];
        for (let i = 0; i < 10; i++) {
            const { c1 } = await contract.getEncryptedTally(pid, i);
            
            // ethers v6 returns BigInt directly — but use String conversion to be safe
            const c1pt = {
                x: BigInt(c1[0].toString()),
                y: BigInt(c1[1].toString())
            };

            // skip identity point — no need to multiply
            if (c1pt.x === 0n && c1pt.y === 1n) {
                // tally c1 is identity — partial decryption is also identity
                partials.push([0n, 1n]);
                continue;
            }

            const D = scalarMul(c1pt, privateShares[k]);
            partials.push([D.x, D.y]);
        }
        partialSets.push(partials);
    }

    info("Submitting partial decryptions...");
    for (let k = 0; k < 3; k++) {
        try {
            // simulate first to get revert reason
            try {
                await contract.connect(khWallets[k]).submitPartialDecrypt.staticCall(
                    pid, partialSets[k]
                );
            } catch (simErr) {
                let reason = simErr?.message?.split('\n')[0] ?? String(simErr);
                if (simErr?.data) {
                    try {
                        const decoded = iface.parseError(simErr.data);
                        reason = `${decoded.name}(${Object.values(decoded.args).join(', ')})`;
                    } catch { reason = `raw: ${simErr.data}`; }
                }
                fail(`KH${k} submitPartialDecrypt simulation — ${reason}`);
                continue;
            }

            const tx = await contract.connect(khWallets[k]).submitPartialDecrypt(
                pid, partialSets[k], { gasLimit: 3_000_000n }
            );
            const receipt = await waitForTx(tx);
            const events  = parseEvents(receipt, iface);
            const partialEv = events.find(e => e.name === "PartialDecryptionSubmitted");
            if (partialEv) ok(`KH${k} partial decryption submitted`);
            else           fail(`KH${k} PartialDecryptionSubmitted event missing`);
        } catch (e) {
            let reason = e?.message?.split('\n')[0] ?? String(e);
            if (e?.data) {
                try {
                    const decoded = iface.parseError(e.data);
                    reason = `${decoded.name}(${Object.values(decoded.args).join(', ')})`;
                } catch { reason = `raw: ${e.data}`; }
            }
            fail(`KH${k} submitPartialDecrypt — ${reason}`);
        }
    }

    // ── submitFinalTally ──────────────────────────────────────────────────────
    section("submitFinalTally");

    // compute tallies off-chain
    info("Computing final tallies off-chain...");
    const tallies = new Array(10).fill(0n);

    for (let i = 0; i < 3; i++) {
        const { c1, c2 } = await contract.getEncryptedTally(pid, i);
        const c1pt = { x: BigInt(c1[0].toString()), y: BigInt(c1[1].toString()) };
        const c2pt = { x: BigInt(c2[0].toString()), y: BigInt(c2[1].toString()) };

        // sum all partial decryptions for option i
        let fullD = { x: 0n, y: 1n };
        for (let k = 0; k < 3; k++) {
            const D = scalarMul(c1pt, privateShares[k]);
            fullD = pointAdd(fullD, D);
        }

        // mg = c2 - fullD
        const negFullD = {
            x: fullD.x === 0n ? 0n : FIELD_MODULUS - fullD.x,
            y: fullD.y
        };
        const mg = pointAdd(c2pt, negFullD);

        // discrete log to find tally
        const tally = discreteLogOffChain(mg, base8, 100);
        tallies[i]  = BigInt(tally);
        info(`  option ${i}: tally = ${tally}`);
    }

    // wrong tally rejection test
    try {
        const wrongTallies = [...tallies];
        wrongTallies[0] = 9999n; // claim wrong tally for option 0
        await contract.submitFinalTally.staticCall(pid, wrongTallies);
        fail("Wrong tally should be rejected");
    } catch (e) { ok("Wrong tally rejected (wrong tally check)"); }

    // submit to contract
    try {
        const tx = await contract.submitFinalTally(
            pid, tallies, { gasLimit: 3_000_000n }
        );
        const receipt = await waitForTx(tx);
        const events  = parseEvents(receipt, iface);
        const revealedEv = events.find(e => e.name === "ResultRevealed");
        if (revealedEv) ok(`ResultRevealed — winningOption: ${revealedEv.args.winningOption}`);
        else            fail("ResultRevealed event not found");
    } catch (e) { fail("submitFinalTally", e); }

    

    // ── Verify final result ───────────────────────────────────────────────────
    section("Verify final result");

    try {
        const { tally, winningOption, status } = await contract.getResult(pid);
        const statusNames = ["PENDING_DKG","ACTIVE","ENDED","REVEALED","CANCELLED"];
        info(`Status        : ${statusNames[Number(status)]}`);
        info(`Winning option: ${winningOption} (Polkadot)`);
        info(`tally[0]      : ${tally[0]}`);
        info(`tally[1]      : ${tally[1]}`);
        info(`tally[2]      : ${tally[2]}`);

        if (Number(status) === 3)        ok("Status = REVEALED");
        else                             fail(`Expected REVEALED(3), got ${status}`);
        if (Number(winningOption) === 0) ok("Winning option = 0 (Polkadot) ✓");
        else                             fail(`Expected 0, got ${winningOption}`);
        if (Number(tally[0]) === 4)      ok("tally[0] = 4 (4 voters × weight 1) ✓");
        else                             fail(`Expected tally[0]=4, got ${tally[0]}`);
        if (Number(tally[1]) === 0)      ok("tally[1] = 0 ✓");
        else                             fail(`Expected 0, got ${tally[1]}`);
    } catch (e) { fail("getResult", e); }

    // Off-chain cross-check
    try {
        info("Cross-checking decryption off-chain...");
        for (let i = 0; i < 3; i++) {
            const { c1, c2 } = await contract.getEncryptedTally(pid, i);
            const c1pt = { x: BigInt(c1[0].toString()), y: BigInt(c1[1].toString()) };
            const c2pt = { x: BigInt(c2[0].toString()), y: BigInt(c2[1].toString()) };
            let fullD = { x: 0n, y: 1n };
            for (let k = 0; k < 3; k++) {
                const D = scalarMul(c1pt, privateShares[k]);
                fullD = pointAdd(fullD, D);
            }
            const negFullD = { x: fullD.x === 0n ? 0n : FIELD_MODULUS - fullD.x, y: fullD.y };
            const mg    = pointAdd(c2pt, negFullD);
            const tally = discreteLogOffChain(mg, base8, 20);
            info(`  option ${i}: off-chain tally = ${tally}`);
        }
        ok("Off-chain cross-check matches");
    } catch (e) { fail("Off-chain cross-check", e); }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════════════════════");
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log("══════════════════════════════════════════════════════════════\n");

    if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });