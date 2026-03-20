"use strict";

require("dotenv").config();
const { ethers } = require("ethers");
const { buildBabyjub } = require("circomlibjs");

// ── CONFIG ─────────────────────────────────────────
const RPC_URL          = process.env.PASEO_RPC_URL;
const CONTRACT_ADDRESS = process.env.PRIVATE_VOTING_ADDRESS;

// keyholders (3 wallets)
const KH_KEYS = [
  process.env.KEYHOLDER_0_PRIV,
  process.env.KEYHOLDER_1_PRIV,
  process.env.KEYHOLDER_2_PRIV,
];

// ── ABI (only needed function) ─────────────────────
const ABI = [
  "function submitPublicKeyShare(uint256 proposalId, uint256 shareX, uint256 shareY) external"
];

// ── BabyJub math (same as your test) ───────────────
const FIELD_MODULUS = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
const BABYJUB_A = 168700n;
const BABYJUB_D = 168696n;
const SUBGROUP_ORDER = BigInt("2736030358979909402780800718157159386076813972158567259200215660948447373041");

function modpow(base, exp, mod) {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return result;
}
function modInverse(a, m) {
  return modpow(a, m - 2n, m);
}

function pointAdd(p1, p2) {
  const p = FIELD_MODULUS;

  const x1x2 = p1.x * p2.x % p;
  const y1y2 = p1.y * p2.y % p;
  const dx1x2y1y2 = BABYJUB_D * x1x2 % p * y1y2 % p;

  const numX = (p1.x * p2.y + p1.y * p2.x) % p;
  const numY = (y1y2 - BABYJUB_A * x1x2 % p + p) % p;

  const denX = (1n + dx1x2y1y2) % p;
  const denY = (1n - dx1x2y1y2 + p) % p;

  return {
    x: numX * modInverse(denX, p) % p,
    y: numY * modInverse(denY, p) % p
  };
}

function scalarMul(pt, scalar) {
  scalar = BigInt(scalar) % SUBGROUP_ORDER;

  let result = { x: 0n, y: 1n };
  let current = pt;

  for (let i = 0; i < 254; i++) {
    if ((scalar >> BigInt(i)) & 1n) {
      result = pointAdd(result, current);
    }
    current = pointAdd(current, current);
  }
  return result;
}

// ── MAIN ───────────────────────────────────────────
async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // load keyholders
  const wallets = KH_KEYS.map(pk => new ethers.Wallet(pk, provider));

  console.log("Submitting DKG for proposalId = 0\n");

  // BabyJub base point
  const babyJub = await buildBabyjub();
  const base8 = {
    x: babyJub.F.toObject(babyJub.Base8[0]),
    y: babyJub.F.toObject(babyJub.Base8[1]),
  };

  // simple private shares (must match your backend logic)
  const privateShares = [1n, 2n, 3n];

  for (let i = 0; i < 3; i++) {
    try {
      const wallet = wallets[i];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

      // compute public share = s * G
      const pub = scalarMul(base8, privateShares[i]);

      console.log(`KH${i} submitting...`);

      const tx = await contract.submitPublicKeyShare(
        0, // proposalId
        pub.x,
        pub.y,
        { gasLimit: 1000000n }
      );

      console.log(`Tx sent: ${tx.hash}`);
      await tx.wait();

      console.log(`✓ KH${i} submitted`);
    } catch (err) {
      console.log(`✗ KH${i} failed:`, err.message);
    }
  }

  console.log("\nDone.");
}

main().catch(console.error);