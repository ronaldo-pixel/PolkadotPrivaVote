// scripts/testVerifier.js
require("dotenv").config();
const { ethers } = require("hardhat");
const snarkjs = require("snarkjs");
const { buildBabyjub } = require("circomlibjs");

async function computeEncryptedVote(voteVector, nonces, publicKey, babyJub) {
    const F = babyJub.F;
    const G = babyJub.Base8;
    const encryptedVote = [];

    for (let i = 0; i < voteVector.length; i++) {
        // just pass BigInt directly — no conversion needed
        const v = BigInt(voteVector[i]);
        const r = BigInt(nonces[i]);

        // c1 = r * G
        const c1 = babyJub.mulPointEscalar(G, r);

        // vote * G
        const vG = babyJub.mulPointEscalar(G, v);

        // r * publicKey
        // publicKey coords need F.e() because they are field elements
        const pubKeyPoint = [
            F.e(publicKey[0]),
            F.e(publicKey[1])
        ];
        const rH = babyJub.mulPointEscalar(pubKeyPoint, r);

        // c2 = vG + rH
        const c2 = babyJub.addPoint(vG, rH);

        encryptedVote.push([
            [F.toObject(c1[0]).toString(), F.toObject(c1[1]).toString()],
            [F.toObject(c2[0]).toString(), F.toObject(c2[1]).toString()]
        ]);
    }

    return encryptedVote;
}


function leInt2Buff(n) {
    const buff = new Uint8Array(32);
    let tmp = n;
    for (let i = 0; i < 32; i++) {
        buff[i] = Number(tmp & 0xffn);
        tmp >>= 8n;
    }
    return buff;
}

async function main() {

    const VERIFIER_ADDRESS = "0xE481A13ABb6F67dd71F9963E17e55d61F0483C80"; // paste deployed address here

    // ─────────────────────────────────────────────
    // Setup BabyJubJub
    // ─────────────────────────────────────────────
    console.log("Loading BabyJubJub...");
    const babyJub = await buildBabyjub();

    // Using generator point as public key for testing
    // In production this comes from DKG
    const publicKey = [
        "5299619240641551281634865583518297030282874472190772894086521144482721001553",
        "16950150798460657717958625567821834550301663161624707787222815936182638968203"
    ];

    // ─────────────────────────────────────────────
    // Test parameters
    // ─────────────────────────────────────────────
    const voteVector = ["0","50","0","0","0","0","0","0","0","0"];
    const voteWeight = "50";
    const claimedBalance = "50";
    const votingMode = "0";       // normal

    // Different nonce per option — must be non-zero
    const nonces = [
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

    // ─────────────────────────────────────────────
    // Compute real encrypted vote
    // ─────────────────────────────────────────────
    console.log("Computing real ElGamal encryption...");
    const encryptedVote = await computeEncryptedVote(
        voteVector,
        nonces,
        publicKey,
        babyJub
    );

    console.log("Sample c1 for option 1:", encryptedVote[1][0]);
    console.log("Sample c2 for option 1:", encryptedVote[1][1]);

    // ─────────────────────────────────────────────
    // Build circuit inputs
    // ─────────────────────────────────────────────
    const inputs = {
        // Private
        voteVector,
        voteWeight,
        nonces,

        // Public
        claimedBalance,
        votingMode,
        publicKey,
        encryptedVote   // now correctly computed
    };

    // ─────────────────────────────────────────────
    // Generate proof
    // ─────────────────────────────────────────────
    console.log("\nGenerating proof (takes 5-15 seconds)...");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        inputs,
        "circuits/build/vote_js/vote.wasm",
        "circuits/build/vote_final.zkey"
    );
    console.log("Proof generated ✓");
    console.log("Public signals count:", publicSignals.length);

    const tamperedSignals = [...publicSignals];  // copy
    tamperedSignals[0] = "99999";

    // ─────────────────────────────────────────────
    // Verify off-chain first (fast check before hitting chain)
    // ─────────────────────────────────────────────
    console.log("\nVerifying off-chain first...");
    const vkey = require("../circuits/build/verification_key.json");
    const offChainValid = await snarkjs.groth16.verify(
        vkey,
        publicSignals,
        proof
    );
    console.log("Off-chain valid:", offChainValid);

    const tamperedResult = await snarkjs.groth16.verify(vkey, tamperedSignals, proof);
    console.log("Off chain With tampered signals:", tamperedResult);

    // ─────────────────────────────────────────────
    // Format for Solidity
    // ─────────────────────────────────────────────
    const calldata = await snarkjs.groth16.exportSolidityCallData(
        proof,
        publicSignals
    );

    const calldataArray = JSON.parse("[" + calldata + "]");
    const a     = calldataArray[0];
    const b     = calldataArray[1];
    const c     = calldataArray[2];
    const input = calldataArray[3];

    console.log("\nCalldata formatted:");
    console.log("  a:", a);
    console.log("  b:", b);
    console.log("  c:", c);
    console.log("  input count:", input.length);

    // ─────────────────────────────────────────────
    // Call deployed verifier on chain
    // ─────────────────────────────────────────────
    const [signer] = await ethers.getSigners();
    console.log("\nSigner address:", await signer.getAddress());

    const verifier = await ethers.getContractAt(
        "Groth16Verifier",
        VERIFIER_ADDRESS,
        signer
    );

    console.log("\nCalling verifyProof on Passet Hub...");
    const result = await verifier.verifyProof(a, b, c, input);
    console.log("On-chain result:", result);

}

main().catch(console.error);