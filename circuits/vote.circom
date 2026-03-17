pragma circom 2.0.0;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/babyjub.circom";
include "circomlib/circuits/escalarmulfix.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/escalarmulany.circom";

/*
  VoteProof(maxOptions)
  ---------------------
  Proves 5 things:
    1. voteVector has exactly one non-zero element
    2. That element equals voteWeight
    3. Normal mode:  voteWeight == claimedBalance
    4. Quadratic:    voteWeight² <= claimedBalance < (voteWeight+1)²
    5. encryptedVote correctly commits to voteVector
*/

template VoteProof(maxOptions) {

    // BabyJubJub generator point Base8
    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    // ─────────────────────────────────────────────────────────
    // PRIVATE INPUTS
    // ─────────────────────────────────────────────────────────
    signal input voteVector[maxOptions];        // e.g. [0, 42, 0, 0, ...] padded to maxOptions
    signal input voteWeight;                    // the weight placed in the vector
    signal input nonces[maxOptions];             // fresh random ElGamal nonce per option


    // ─────────────────────────────────────────────────────────
    // PUBLIC INPUTS
    // ─────────────────────────────────────────────────────────
    signal input claimedBalance;                 // contract checks: <= balanceOf(msg.sender)
    signal input votingMode;                     // 0 = normal, 1 = quadratic
    signal input publicKey[2];                   // contract checks: matches proposal.electionPublicKey
    signal input encryptedVote[maxOptions][2][2];// contract uses: to update homomorphic tally
                                                 // [option][c1/c2][x/y]

    // ═════════════════════════════════════════════════════════
    // CONSTRAINT 1 + 2: voteVector has exactly one non-zero
    //                   element and it equals voteWeight
    // ═════════════════════════════════════════════════════════

    signal runningSum[maxOptions + 1];
    runningSum[0] <== 0;
    for (var i = 0; i < maxOptions; i++) {
        runningSum[i + 1] <== runningSum[i] + voteVector[i];
    }
    runningSum[maxOptions] === voteWeight;

    signal elementCheck[maxOptions];
    for (var i = 0; i < maxOptions; i++) {
        elementCheck[i] <== voteVector[i] * (voteVector[i] - voteWeight);
        elementCheck[i] === 0;
    }

    component weightPositive = LessThan(64);
    weightPositive.in[0] <== 0;
    weightPositive.in[1] <== voteWeight;

    weightPositive.out === 1;
    // ═════════════════════════════════════════════════════════
    // CONSTRAINT 3 + 4: voteWeight is valid for votingMode
    // ═════════════════════════════════════════════════════════

    signal modeCheck <== votingMode * (votingMode - 1);
    modeCheck === 0;

    signal normalCheck <== (1 - votingMode) * (voteWeight - claimedBalance);
    normalCheck === 0;

    component lowerBound = LessEqThan(64);
    lowerBound.in[0] <== voteWeight * voteWeight;
    lowerBound.in[1] <== claimedBalance;

    component upperBound = LessThan(64);
    upperBound.in[0] <== claimedBalance;
    upperBound.in[1] <== (voteWeight + 1) * (voteWeight + 1);

    signal quadLower <== votingMode * (lowerBound.out - 1);
    signal quadUpper <== votingMode * (upperBound.out - 1);
    quadLower === 0;
    quadUpper === 0;


    // ═════════════════════════════════════════════════════════
    // CONSTRAINT 5: encryptedVote is valid ElGamal encryption
    //               of voteVector over BabyJubJub
    //
    // For each option i:
    //   c1 = nonces[i] * G
    //   c2 = voteVector[i] * G + nonces[i] * publicKey
    //
    // This proves the ciphertext is mathematically correct
    // and supports homomorphic addition on-chain:
    //   tally.c1 += vote.c1   (point addition)
    //   tally.c2 += vote.c2   (point addition)
    // ═════════════════════════════════════════════════════════

    component nonceBits[maxOptions];
    component voteBits[maxOptions];
    component rG[maxOptions];
    component vG[maxOptions];
    component rH[maxOptions];
    component c2Add[maxOptions];

    for (var i = 0; i < maxOptions; i++) {

        // decompose scalars into bits
        nonceBits[i] = Num2Bits(253);
        nonceBits[i].in <== nonces[i];

        voteBits[i] = Num2Bits(253);
        voteBits[i].in <== voteVector[i];

        // c1 = nonces[i] * G
        rG[i] = EscalarMulFix(253, BASE8);
        rG[i].e <== nonceBits[i].out;

        encryptedVote[i][0][0] === rG[i].out[0];
        encryptedVote[i][0][1] === rG[i].out[1];

        // voteVector[i] * G
        vG[i] = EscalarMulFix(253, BASE8);
        vG[i].e <== voteBits[i].out;

        // nonces[i] * publicKey
        rH[i] = EscalarMulAny(253);
        rH[i].e <== nonceBits[i].out;
        rH[i].p[0] <== publicKey[0];
        rH[i].p[1] <== publicKey[1];

        // c2 = voteVector[i]*G + nonces[i]*publicKey
        c2Add[i] = BabyAdd();
        c2Add[i].x1 <== vG[i].out[0];
        c2Add[i].y1 <== vG[i].out[1];
        c2Add[i].x2 <== rH[i].out[0];
        c2Add[i].y2 <== rH[i].out[1];

        encryptedVote[i][1][0] === c2Add[i].xout;
        encryptedVote[i][1][1] === c2Add[i].yout;
    }
    
}

component main {
    public [
        claimedBalance,
        votingMode,
        publicKey,
        encryptedVote
    ]
} = VoteProof(10);

