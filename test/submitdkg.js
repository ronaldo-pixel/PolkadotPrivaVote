"use strict";

require("dotenv").config();
const { ethers } = require("ethers");

// ── CONFIG ─────────────────────────────────────────
const RPC_URL          = process.env.PASEO_RPC_URL;
const CONTRACT_ADDRESS = process.env.PRIVATE_VOTING_ADDRESS;
const PROPOSAL_ID = 4;

// keyholders
const KH_KEYS = [
  process.env.KEYHOLDER_0_PRIV,
  process.env.KEYHOLDER_1_PRIV,
  process.env.KEYHOLDER_2_PRIV,
];

// ── ABI ────────────────────────────────────────────
const ABI = [
  "function submitPublicKeyShare(uint256 proposalId, uint256 shareX, uint256 shareY) external",
  "function getProposalView(uint256 proposalId) view returns (uint256,address,uint8,uint256,uint256,uint256,uint256,uint256,uint256,uint8,uint256,uint256,uint256,uint256,uint256)",
  "function keyholders(uint256) view returns (address)",
  "function getPublicKeyShare(uint256,uint256) view returns (uint256,uint256,bool)"
];

// ── BabyJub constants (MATCH CONTRACT) ─────────────
const FIELD_MODULUS = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
const BABYJUB_A = 168700n;
const BABYJUB_D = 168696n;
const SUBGROUP_ORDER = BigInt("2736030358979909402780800718157159386076813972158567259200215660948447373041");

const BASE8 = {
  x: 5299619240641551281634865583518297030282874472190772894086521144482721001553n,
  y: 16950150798460657717958625567821834550301663161624707787222815936182638968203n
};

// ── Math ───────────────────────────────────────────
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
  const wallets = KH_KEYS.map(pk => new ethers.Wallet(pk, provider));

  console.log("=== DKG Submission ===\n");

  const contractRead = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  // ── Check proposal ───────────────────────────────
  const p = await contractRead.getProposalView(PROPOSAL_ID);

  console.log("Status:", Number(p[9]));
  console.log("ShareCount:", Number(p[13]));

  if (Number(p[9]) !== 0) {
    throw new Error("❌ Proposal is NOT in PENDING_DKG");
  }

  const privateShares = [1n, 2n, 3n];

  for (let i = 0; i < 3; i++) {
    try {
      const wallet = wallets[i];
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

      // ✅ Skip if already submitted
      const share = await contractRead.getPublicKeyShare(PROPOSAL_ID, i);
      if (share[2]) {
        console.log(`KH${i} already submitted ✅`);
        continue;
      }

      const pub = scalarMul(BASE8, privateShares[i]);

      console.log(`\nKH${i} submitting...`);

      const nonce = await wallet.getNonce();

      const tx = await contract.submitPublicKeyShare(
        PROPOSAL_ID,
        pub.x,
        pub.y,
        {
          gasLimit: 1000000n,
          nonce: nonce
        }
      );

      console.log(`Tx sent: ${tx.hash}`);
      await tx.wait();

      console.log(`✓ KH${i} submitted`);

      // ✅ small delay to avoid RPC duplication issues
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      console.log(`✗ KH${i} failed:`, err.message);
    }
  }

  console.log("\n✅ Done.");
}

main().catch(console.error);