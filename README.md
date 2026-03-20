# PrivaVote — Private DAO Voting on Polkadot

Private governance for Polkadot DAOs. Votes are encrypted on-chain using ElGamal homomorphic encryption, voter eligibility is proven with Groth16 ZK proofs, and the final tally is revealed only after all keyholders submit their partial decryptions. Individual votes are never exposed on-chain.

Built on Polkadot Asset Hub using native PVM bytecode (resolc) and BN254 precompiles.

---

## Prerequisites

- Node.js 22+
- Rust + cargo (for polkatool if needed)
- circom 2.0
- snarkjs
- solc 0.8.28
- resolc native binary
```bash
npm install
npm install -g snarkjs
```

---

## 1. Compile ZK Circuit
```bash
# compile circuit
circom circuits/vote.circom \
  --r1cs --wasm --sym \
  --output circuits/build \
  -l node_modules

# powers of tau (phase 1)
snarkjs powersoftau new bn128 17 pot17_0000.ptau -v
snarkjs powersoftau contribute pot17_0000.ptau pot17_0001.ptau \
  --name="contributor1" -e="random entropy here"
snarkjs powersoftau prepare phase2 pot17_0001.ptau \
  powersOfTau28_hez_final_17.ptau -v

# groth16 setup (phase 2)
snarkjs groth16 setup \
  circuits/build/vote.r1cs \
  powersOfTau28_hez_final_17.ptau \
  circuits/build/vote_0000.zkey

snarkjs zkey contribute \
  circuits/build/vote_0000.zkey \
  circuits/build/vote_final.zkey \
  --name="contributor1" -v -e="random entropy here"

# export verification key
snarkjs zkey export verificationkey \
  circuits/build/vote_final.zkey \
  circuits/build/verification_key.json
```

---

## 2. Generate Solidity Verifier
```bash
snarkjs zkey export solidityverifier \
  circuits/build/vote_final.zkey \
  contracts/Verifier.sol
```

---

## 3. Compile Contracts

Install solc 0.8.28 and download the resolc native binary:
```bash
# install solc
sudo add-apt-repository ppa:ethereum/ethereum
sudo apt-get update && sudo apt-get install solc

# download resolc native binary
wget https://github.com/paritytech/revive/releases/latest/download/resolc-x86_64-unknown-linux-musl -O resolc-native
chmod +x resolc-native
```

Compile contracts to PVM bytecode:
```bash
# compile PrivateVoting to PVM
./resolc-native \
  --combined-json bin,abi \
  --solc $(which solc) \
  contracts/PrivateVoting.sol \
  -o build/ \
  --overwrite

# rename output
mv build/combined.json build/PrivateVoting.json

# compile Verifier to PVM
./resolc-native \
  --combined-json bin,abi \
  --solc $(which solc) \
  contracts/Verifier.sol \
  -o build/ \
  --overwrite

mv build/combined.json build/Verifier.json
```

---

## 4. Configure Environment

Create a `.env` file:
```env
PASEO_RPC_URL=https://eth-rpc-testnet.polkadot.io/
PASEO_PK=0x_YOUR_DEPLOYER_PRIVATE_KEY

KEYHOLDER_0_PRIV=0x_KEYHOLDER_0_PRIVATE_KEY
KEYHOLDER_1_PRIV=0x_KEYHOLDER_1_PRIVATE_KEY
KEYHOLDER_2_PRIV=0x_KEYHOLDER_2_PRIVATE_KEY

VERIFIER_ADDRESS=        # filled after step 5
PRIVATE_VOTING_ADDRESS=  # filled after step 6
```

Get testnet tokens from the faucet:
https://faucet.polkadot.io/?parachain=1111

---

## 5. Deploy Verifier
```bash
node scripts/deployVerifier.js
```

Copy the printed address into `.env` as `VERIFIER_ADDRESS`.

---

## 6. Deploy PrivateVoting
```bash
node scripts/deployPrivateVoting.js
```

Copy the printed address into `.env` as `PRIVATE_VOTING_ADDRESS`.

---

## 7. Run Tests

End-to-end test with dummy proofs (fast):
```bash
node test/testprivate.js
```

Verifier-only test with real ZK proof:
```bash
node scripts/testVerifier.js
```

The end-to-end test covers:
- createProposal
- DKG key share submission
- castVote with real ZK proofs (4 voters)
- closeVoting
- submitPartialDecrypt
- submitFinalTally with on-chain verification
- getResult

---

## Network

| Parameter | Value |
|-----------|-------|
| Network | Passet Hub Testnet |
| Chain ID | 420420422 |
| RPC | https://eth-rpc-testnet.polkadot.io/ |
| Explorer | https://blockscout-passet-hub.parity-testnet.parity.io |
| Faucet | https://faucet.polkadot.io/ |

---

## Project Structure
```
circuits/
  vote.circom              — ZK circuit
  build/
    vote.wasm              — compiled circuit
    vote_final.zkey        — proving key
    verification_key.json  — verification key

contracts/
  PrivateVoting.sol        — main contract
  Verifier.sol             — Groth16 verifier (generated)

build/
  PrivateVoting.json       — PVM bytecode + ABI
  Verifier.json            — PVM bytecode + ABI
  deployedAddress.json     — deployed addresses

scripts/
  deployVerifier.js        — deploy Verifier.sol
  deployPrivateVoting.js   — deploy PrivateVoting.sol
  testVerifier.js          — ZK proof end-to-end test

test/
  testprivate.js           — full contract test
```
