import { ethers } from 'ethers';

// ─── Format utilities ──────────────────────────────────────────────────────────
// Used across all pages for display formatting. No contract dependency.

export const formatUtils = {
  formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  },

  formatBlockNumber(block) {
    if (!block && block !== 0) return '—';
    return `#${Number(block).toLocaleString()}`;
  },

  formatBlockRange(startBlock, endBlock) {
    if (!startBlock || !endBlock) return '—';
    return `${Number(startBlock).toLocaleString()} → ${Number(endBlock).toLocaleString()}`;
  },

  formatDuration(durationBlocks, secondsPerBlock = 6) {
    if (!durationBlocks) return '—';
    const totalSeconds = Number(durationBlocks) * secondsPerBlock;
    const days    = Math.floor(totalSeconds / 86400);
    const hours   = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (days > 0)   return `${days}d ${hours}h`;
    if (hours > 0)  return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  },

  formatDate(date) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  formatPercentage(value, total) {
    if (!total || total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  },

  formatTokenAmount(amount) {
    if (amount === null || amount === undefined) return '—';
    return Number(amount).toLocaleString();
  },
};

// ─── Proposal status utilities ─────────────────────────────────────────────────
// Maps on-chain enum integers / string labels to display values.
// Color values match the CMD terminal design system tokens.

export const proposalStatusUtils = {
  STATUS_COLORS: {
    PENDING_DKG: '#ffb800',
    ACTIVE:      '#00f5d4',
    ENDED:       '#64748b',
    REVEALED:    '#39ff14',
    CANCELLED:   '#ff3c3c',
  },

  STATUS_LABELS: {
    PENDING_DKG: 'PENDING_DKG',
    ACTIVE:      'ACTIVE',
    ENDED:       'ENDED',
    REVEALED:    'REVEALED',
    CANCELLED:   'CANCELLED',
  },

  getStatusColor(status) {
    return this.STATUS_COLORS[status] ?? '#64748b';
  },

  getStatusLabel(status) {
    return this.STATUS_LABELS[status] ?? status;
  },

  isLive(status) {
    return status === 'ACTIVE' || status === 'PENDING_DKG';
  },

  isFinished(status) {
    return status === 'REVEALED' || status === 'CANCELLED';
  },

  canCloseVoting(proposal, currentBlock) {
    return (
      proposal.status === 'ACTIVE' &&
      currentBlock > proposal.endBlock
    );
  },

  canFinalizeResult(proposal) {
    return (
      proposal.status === 'ENDED' &&
      proposal.partialCount >= 3
    );
  },
};

// ─── Vote weight calculation ───────────────────────────────────────────────────
// Mirrors the contract's weight logic for off-chain display.
// NORMAL: weight = tokenBalance
// QUADRATIC: weight = sqrt(tokenBalance)

export const voteWeightCalculator = {
  calculate(votingMode, tokenBalance) {
    if (!tokenBalance || tokenBalance <= 0) return 0;
    if (votingMode === 'quadratic') {
      return Math.floor(Math.sqrt(Number(tokenBalance)) * 100) / 100;
    }
    return Number(tokenBalance);
  },

  formatWeight(votingMode, tokenBalance) {
    const weight = this.calculate(votingMode, tokenBalance);
    if (votingMode === 'quadratic') {
      return `√${Number(tokenBalance).toLocaleString()} = ${weight.toFixed(2)}`;
    }
    return `${Number(tokenBalance).toLocaleString()} tokens`;
  },
};

// ─── Nullifier utilities ───────────────────────────────────────────────────────
// Real nullifier generation using keccak256 via ethers.
// The nullifier is a deterministic commitment: hash(userSecret + proposalId).
// It is submitted with a ZK proof to prevent double voting without revealing identity.

export const nullifierUtils = {
  generate(userSecret, proposalId) {
    if (!userSecret || proposalId === undefined || proposalId === null) {
      throw new Error('nullifier requires a user secret and proposal ID');
    }
    const encoded = ethers.solidityPacked(
      ['bytes32', 'uint256'],
      [
        ethers.zeroPadBytes(ethers.toUtf8Bytes(String(userSecret)), 32),
        BigInt(proposalId),
      ]
    );
    return ethers.keccak256(encoded);
  },

  validate(nullifier) {
    return /^0x[0-9a-fA-F]{64}$/.test(nullifier);
  },
};

// ─── Encryption utilities ──────────────────────────────────────────────────────
// ElGamal encryption over BabyJubJub is required to encrypt votes.
//
// PRODUCTION: integrate circomlibjs (https://github.com/iden3/circomlibjs)
//   import { buildBabyjub } from 'circomlibjs';
//   const babyjub = await buildBabyjub();
//   const encryptedVote = babyjub.mulPointEscalar(publicKey, voteScalar);
//
// The functions below are structurally correct stubs that document the expected
// input/output shapes. They throw in production if called without a real
// circomlibjs integration, preventing silent mock data from reaching the contract.

export const encryptionUtils = {
  encryptVote(optionIndex, electionPublicKey) {
    if (!electionPublicKey?.x || !electionPublicKey?.y) {
      throw new Error(
        'encryptVote: election public key not available. ' +
        'DKG must complete before votes can be encrypted.'
      );
    }
    // TODO: replace with real ElGamal encryption using circomlibjs
    // const babyjub = await buildBabyjub();
    // const r = babyjub.F.random();           // ephemeral scalar
    // const c1 = babyjub.mulPointEscalar(babyjub.Base8, r);
    // const c2 = babyjub.addPoint(
    //   babyjub.mulPointEscalar(babyjub.Base8, voteScalar),
    //   babyjub.mulPointEscalar([epkX, epkY], r)
    // );
    // return { c1, c2, r };
    throw new Error(
      'encryptVote: real ElGamal encryption not implemented. ' +
      'Install circomlibjs and replace this stub.'
    );
  },

  buildEncVoteArray(encryptedOptions) {
    // Packs the 10-option enc vote array expected by castVote:
    // uint256[2][2][10] encVote  →  encVote[option][c1/c2][x/y]
    if (!Array.isArray(encryptedOptions) || encryptedOptions.length !== 10) {
      throw new Error('buildEncVoteArray: exactly 10 option ciphertexts required');
    }
    return encryptedOptions.map(({ c1, c2 }) => [
      [BigInt(c1[0]), BigInt(c1[1])],
      [BigInt(c2[0]), BigInt(c2[1])],
    ]);
  },
};

// ─── ZK proof utilities ────────────────────────────────────────────────────────
// Groth16 proof generation for vote.circom is done off-chain by snarkjs.
//
// PRODUCTION setup:
//   import { groth16 } from 'snarkjs';
//   const { proof, publicSignals } = await groth16.fullProve(
//     input,           // { claimedBalance, votingMode, publicKey, encryptedVote }
//     'vote.wasm',     // compiled circuit
//     'vote_final.zkey' // proving key
//   );
//
// The proof is then passed directly to castVote as (pA, pB, pC, pubSignals).

export const zkProofUtils = {
  async generateVoteProof(circuitInput) {
    // circuitInput shape:
    // {
    //   claimedBalance: bigint,
    //   votingMode:     0 | 1,
    //   publicKey:      [bigint, bigint],    // election public key [x, y]
    //   encryptedVote:  bigint[10][2][2],    // [option][c1/c2][x/y]
    // }
    //
    // TODO: replace with:
    // const { proof, publicSignals } = await groth16.fullProve(
    //   circuitInput, '/vote.wasm', '/vote_final.zkey'
    // );
    // return formatProofForContract(proof, publicSignals);
    throw new Error(
      'generateVoteProof: snarkjs integration not implemented. ' +
      'Provide vote.wasm and vote_final.zkey and replace this stub.'
    );
  },

  formatProofForContract(proof, publicSignals) {
    // Converts snarkjs proof output into the arrays castVote expects:
    // pA: uint256[2], pB: uint256[2][2], pC: uint256[2], pubSignals: uint256[44]
    return {
      pA: proof.pi_a.slice(0, 2).map(BigInt),
      pB: [
        proof.pi_b[0].slice(0, 2).map(BigInt),
        proof.pi_b[1].slice(0, 2).map(BigInt),
      ],
      pC: proof.pi_c.slice(0, 2).map(BigInt),
      pubSignals: publicSignals.map(BigInt),
    };
  },

  async generatePartialDecryptionProof(partialDecryption) {
    // TODO: integrate decryption proof circuit if required
    throw new Error('generatePartialDecryptionProof: not implemented');
  },
};

// ─── Re-export contractMethods as a thin adapter ───────────────────────────────
// Any legacy import of contractMethods is redirected to VotingContext methods.
// These throw with a clear message so call sites are easy to find and migrate.

export const contractMethods = {
  createProposal() {
    throw new Error('contractMethods.createProposal is removed. Use createProposal() from useVoting().');
  },
  getProposal() {
    throw new Error('contractMethods.getProposal is removed. Use getProposalDetail() from useVoting().');
  },
  submitEncryptedVote() {
    throw new Error('contractMethods.submitEncryptedVote is removed. Use submitVote() from useVoting().');
  },
  submitPartialDecryption() {
    throw new Error('contractMethods.submitPartialDecryption is removed. Use submitPartialDecryption() from useVoting().');
  },
  checkEligibility() {
    throw new Error('contractMethods.checkEligibility is removed. Use checkEligibility() from useVoting().');
  },
};