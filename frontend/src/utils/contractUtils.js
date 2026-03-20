import { ethers } from 'ethers';

// ─── Format utilities ──────────────────────────────────────────────────────────

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
//
// PREVIOUS BUG:
//   userSecret = address + proposalId as a plain string e.g. "0x4a94...bef0"
//   ethers.toUtf8Bytes("0x4a94...bef0") = 42 bytes  (the string is 42 chars)
//   ethers.zeroPadBytes(<42 bytes>, 32) → BUFFER_OVERRUN
//   because zeroPadBytes cannot truncate — it only pads UP to the target length.
//
// FIX:
//   Hash the secret string directly with keccak256 (produces exactly 32 bytes),
//   then pack with the proposalId uint256 and hash again.
//   This is equivalent to:  keccak256(abi.encodePacked(keccak256(secret), proposalId))
//   — a standard nullifier construction that is always safe regardless of secret length.

export const nullifierUtils = {
  generate(userSecret, proposalId) {
    if (!userSecret || proposalId === undefined || proposalId === null) {
      throw new Error('nullifier requires a user secret and proposal ID');
    }

    // Step 1: hash the secret string → always 32 bytes, regardless of input length
    const secretHash = ethers.keccak256(ethers.toUtf8Bytes(String(userSecret)));

    // Step 2: pack (bytes32 secretHash, uint256 proposalId) and hash again
    // secretHash is already a 0x-prefixed 32-byte hex string — use it directly
    const encoded = ethers.solidityPacked(
      ['bytes32', 'uint256'],
      [secretHash, BigInt(proposalId)]
    );

    return ethers.keccak256(encoded);
  },

  validate(nullifier) {
    return /^0x[0-9a-fA-F]{64}$/.test(nullifier);
  },
};

// ─── Encryption utilities ──────────────────────────────────────────────────────

export const encryptionUtils = {
  encryptVote(optionIndex, electionPublicKey) {
    if (!electionPublicKey?.x || !electionPublicKey?.y) {
      throw new Error(
        'encryptVote: election public key not available. ' +
        'DKG must complete before votes can be encrypted.'
      );
    }
    throw new Error(
      'encryptVote: real ElGamal encryption not implemented. ' +
      'Install circomlibjs and replace this stub.'
    );
  },

  buildEncVoteArray(encryptedOptions) {
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

export const zkProofUtils = {
  async generateVoteProof(circuitInput) {
    throw new Error(
      'generateVoteProof: snarkjs integration not implemented. ' +
      'Provide vote.wasm and vote_final.zkey and replace this stub.'
    );
  },

  formatProofForContract(proof, publicSignals) {
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
    throw new Error('generatePartialDecryptionProof: not implemented');
  },
};

// ─── Legacy contractMethods shim ──────────────────────────────────────────────

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