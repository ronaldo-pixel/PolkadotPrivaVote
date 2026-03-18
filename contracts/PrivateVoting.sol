// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[44] calldata input
    ) external view returns (bool);
}

contract PrivateVoting {

    // ========= Constants =========================================================

    uint256 private constant NUM_KEYHOLDERS  = 3;
    uint256 private constant MIN_VOTERS      = 10;
    uint256 private constant MIN_OPTIONS     = 2;
    uint256 private constant MAX_OPTIONS     = 10;
    uint256 private constant TIMEOUT_BLOCKS  = 50000;

    // BabyJubJub curve parameters
    // NOTE: GX/GY here are the Base8 point used in the Circom circuit —
    //       NOT the EIP-2494 prime-order generator. Must match vote.circom exactly.
    uint256 private constant BABYJUB_MODULUS =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 private constant BABYJUB_A       = 168700;
    uint256 private constant BABYJUB_D       = 168696;
    uint256 private constant BABYJUB_GX      =
        5299619240641551281634865583518297030282874472190772894086521144482721001553;
    uint256 private constant BABYJUB_GY      =
        16950150798460657717958625567821834550301663161624707787222815936182638968203;
    uint256 private constant BABYJUB_ORDER   =
        2736030358979909402780800718157159386076813972158567259200215660948447373041;

    // ========= Enums =============================================================

    enum ProposalStatus { PENDING_DKG, ACTIVE, ENDED, REVEALED, CANCELLED }
    enum VotingMode     { NORMAL, QUADRATIC }

    // ========= Structs ===========================================================

    struct ElGamalCiphertext {
        uint256[2] c1;   // [x, y]
        uint256[2] c2;   // [x, y]
    }

    struct Proposal {
        uint256 id;
        address creator;
        string description;
        string[] options;
        VotingMode votingMode;
        uint256 createdAtBlock;
        uint256 duration;
        uint256 startBlock;
        uint256 endBlock;
        uint256 eligibilityThreshold;
        uint256 minVoterThreshold;
        ProposalStatus status;
        address tokenContract;
        uint256[2] electionPublicKey;
        uint256[2][NUM_KEYHOLDERS] publicKeyShares;
        ElGamalCiphertext[MAX_OPTIONS] encryptedTally;
        uint256 voteCount;
        uint256[2][MAX_OPTIONS][NUM_KEYHOLDERS] partialDecryptions;
        uint256 partialCount;
        uint256[MAX_OPTIONS] finalResult;
        uint256 winningOption;
        uint256 endedAtBlock;
    }

    // ========= State =============================================================

    address[NUM_KEYHOLDERS] public keyholders;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // Tracks which keyholders have submitted a DKG share for a given proposal.
    // proposalId => keyholder index => submitted
    mapping(uint256 => mapping(uint256 => bool)) private _shareSubmitted;

    uint256 public proposalCount;
    address public verifierContract;

    // ========= Events ============================================================

    event ProposalCreated(uint256 indexed proposalId);

    event PublicKeyShareSubmitted(
        uint256 indexed proposalId,
        address indexed keyholder,
        uint256 keyholderIndex,
        uint256 shareX,
        uint256 shareY
    );

    event ElectionKeyComputed(
        uint256 indexed proposalId,
        uint256 keyX,
        uint256 keyY
    );

    event VotingStarted(
        uint256 indexed proposalId,
        uint256 startBlock,
        uint256 endBlock
    );

    // ========= Errors ============================================================

    error NotKeyholder();
    error ProposalNotFound(uint256 proposalId);
    error WrongStatus(uint256 proposalId, ProposalStatus expected, ProposalStatus actual);
    error AlreadySubmittedShare(uint256 proposalId, address keyholder);
    error InvalidPoint();          // off-curve or identity (0,1)

    // ========= Constructor =======================================================

    constructor(
        address keyholder0,
        address keyholder1,
        address keyholder2,
        address verifier
    ) {
        keyholders[0] = keyholder0;
        keyholders[1] = keyholder1;
        keyholders[2] = keyholder2;
        verifierContract = verifier;
    }

    // ========= Modifiers =========================================================

    modifier proposalExists(uint256 proposalId) {
        if (proposalId >= proposalCount) revert ProposalNotFound(proposalId);
        _;
    }

    modifier onlyKeyholder() {
        if (_keyholderIndex(msg.sender) == type(uint256).max) revert NotKeyholder();
        _;
    }

    // ========= Create Proposal ===================================================

    function createProposal(
        string memory description,
        string[] memory options,
        VotingMode votingMode,
        uint256 duration,
        uint256 eligibilityThreshold,
        uint256 minVoterThreshold,
        address tokenContract
    ) external returns (uint256 proposalId) {
        require(options.length >= MIN_OPTIONS && options.length <= MAX_OPTIONS, "invalid option count");
        require(duration > 0, "duration must be positive");
        require(minVoterThreshold >= MIN_VOTERS, "min voter threshold too low");
        require(tokenContract != address(0), "invalid token contract");

        proposalId = proposalCount++;

        Proposal storage proposal = proposals[proposalId];
        proposal.id                   = proposalId;
        proposal.creator              = msg.sender;
        proposal.description          = description;
        proposal.options              = options;
        proposal.votingMode           = votingMode;
        proposal.createdAtBlock       = block.number;
        proposal.duration             = duration;
        proposal.eligibilityThreshold = eligibilityThreshold;
        proposal.minVoterThreshold    = minVoterThreshold;
        proposal.status               = ProposalStatus.PENDING_DKG;
        proposal.tokenContract        = tokenContract;

        // Initialize encryptedTally with the BabyJubJub identity point (0, 1)
        for (uint256 i = 0; i < MAX_OPTIONS; i++) {
            proposal.encryptedTally[i] = ElGamalCiphertext(
                [uint256(0), uint256(1)],
                [uint256(0), uint256(1)]
            );
        }

        emit ProposalCreated(proposalId);
    }

    // ========= DKG: Get Election Public Key ======================================

    /**
     * @notice Returns the combined election public key for a proposal.
     *
     * Returns (0, 0) if the DKG phase is not yet complete (not all keyholders
     * have submitted their shares).  Once the proposal is ACTIVE or beyond,
     * the returned key is the one used for ElGamal vote encryption.
     *
     * @param proposalId   The proposal to query.
     * @return x           X-coordinate of the election public key.
     * @return y           Y-coordinate of the election public key.
     * @return status      Current proposal status.
     * @return sharesIn    How many keyholder shares have been submitted so far.
     */
    function getElectionPublicKey(uint256 proposalId)
        external
        view
        proposalExists(proposalId)
        returns (
            uint256 x,
            uint256 y,
            ProposalStatus status,
            uint256 sharesIn
        )
    {
        Proposal storage p = proposals[proposalId];
        x      = p.electionPublicKey[0];
        y      = p.electionPublicKey[1];
        status = p.status;

        // Count how many keyholder shares have been submitted
        for (uint256 i = 0; i < NUM_KEYHOLDERS; i++) {
            if (_shareSubmitted[proposalId][i]) sharesIn++;
        }
    }

    /**
     * @notice Returns the individual public key share submitted by a specific
     *         keyholder, and whether they have submitted yet.
     *
     * @param proposalId      The proposal to query.
     * @param keyholderIndex  0-based index into the keyholders array.
     * @return x              X-coordinate (0 if not yet submitted).
     * @return y              Y-coordinate (0 if not yet submitted).
     * @return submitted      True if this keyholder has submitted their share.
     */
    function getPublicKeyShare(uint256 proposalId, uint256 keyholderIndex)
        external
        view
        proposalExists(proposalId)
        returns (uint256 x, uint256 y, bool submitted)
    {
        require(keyholderIndex < NUM_KEYHOLDERS, "invalid keyholder index");
        submitted = _shareSubmitted[proposalId][keyholderIndex];
        if (submitted) {
            x = proposals[proposalId].publicKeyShares[keyholderIndex][0];
            y = proposals[proposalId].publicKeyShares[keyholderIndex][1];
        }
    }

    /**
     * @notice Returns the DKG submission status for all keyholders on a proposal.
     *
     * @param proposalId  The proposal to query.
     * @return addresses  The keyholder addresses in order.
     * @return submitted  Whether each keyholder has submitted their share.
     */
    function getDKGStatus(uint256 proposalId)
        external
        view
        proposalExists(proposalId)
        returns (
            address[NUM_KEYHOLDERS] memory addresses,
            bool[NUM_KEYHOLDERS] memory submitted
        )
    {
        for (uint256 i = 0; i < NUM_KEYHOLDERS; i++) {
            addresses[i] = keyholders[i];
            submitted[i] = _shareSubmitted[proposalId][i];
        }
    }

    // ========= DKG: Submit Public Key Share ======================================

    /**
     * @notice Submit your BabyJubJub public key share for the DKG phase.
     *
     * Off-chain: each keyholder generates a random private scalar and computes
     *   publicShare = privateShare × Base8   (on BabyJubJub, using circomlibjs)
     * then calls this function with the resulting (x, y) coordinates.
     *
     * The contract:
     *   1. Verifies the caller is a registered keyholder
     *   2. Verifies the proposal is in PENDING_DKG status
     *   3. Rejects duplicate submissions from the same keyholder
     *   4. Validates the point is on the BabyJubJub curve
     *   5. Rejects the identity point (0, 1) — contributes nothing to the key
     *   6. Stores the share
     *   7. If all NUM_KEYHOLDERS shares are now in, combines them into the
     *      election public key and transitions the proposal to ACTIVE
     *
     * @param proposalId  The proposal this share is for.
     * @param shareX      X-coordinate of publicShare (= privateShare × Base8).
     * @param shareY      Y-coordinate of publicShare.
     */
    function submitPublicKeyShare(
        uint256 proposalId,
        uint256 shareX,
        uint256 shareY
    ) external proposalExists(proposalId) onlyKeyholder {
        Proposal storage p = proposals[proposalId];

        // ── Check 1: proposal must be in DKG phase ────────────────────────────
        if (p.status != ProposalStatus.PENDING_DKG) {
            revert WrongStatus(proposalId, ProposalStatus.PENDING_DKG, p.status);
        }

        // ── Check 2: this keyholder must not have already submitted ───────────
        uint256 idx = _keyholderIndex(msg.sender);
        if (_shareSubmitted[proposalId][idx]) {
            revert AlreadySubmittedShare(proposalId, msg.sender);
        }

        // ── Check 3: validate the point is on the BabyJubJub curve ───────────
        // Rejects (0,1) identity and any off-curve coordinates.
        if (!_isOnCurve(shareX, shareY)) revert InvalidPoint();

        // ── Store the share ───────────────────────────────────────────────────
        _shareSubmitted[proposalId][idx]       = true;
        p.publicKeyShares[idx][0]              = shareX;
        p.publicKeyShares[idx][1]              = shareY;

        emit PublicKeyShareSubmitted(proposalId, msg.sender, idx, shareX, shareY);

        // ── Check if all keyholders have submitted ────────────────────────────
        uint256 count = 0;
        for (uint256 i = 0; i < NUM_KEYHOLDERS; i++) {
            if (_shareSubmitted[proposalId][i]) count++;
        }

        if (count == NUM_KEYHOLDERS) {
            _finalizeElectionKey(proposalId);
        }
    }

    // ========= Internal: Combine Shares → Election Key ==========================

    /**
     * @dev Sums all keyholder public shares using BabyJubJub point addition:
     *        electionPublicKey = P[0] + P[1] + P[2]
     *
     *      Then sets startBlock/endBlock from the proposal duration and
     *      transitions status to ACTIVE.
     *
     *      Split into two functions (_finalizeElectionKey + _sumShares) to
     *      keep each function's local variable count below the 16-slot EVM
     *      stack limit (same technique used in BabyJubJub.sol).
     */
    function _finalizeElectionKey(uint256 proposalId) internal {
        Proposal storage p = proposals[proposalId];

        // Sum all public shares: start from identity (0, 1)
        uint256[2] memory combined = _sumShares(p);

        p.electionPublicKey[0] = combined[0];
        p.electionPublicKey[1] = combined[1];

        // Set voting window
        p.startBlock = block.number;
        p.endBlock   = block.number + p.duration;
        p.status     = ProposalStatus.ACTIVE;

        emit ElectionKeyComputed(proposalId, combined[0], combined[1]);
        emit VotingStarted(proposalId, p.startBlock, p.endBlock);
    }

    function _sumShares(Proposal storage p) internal view returns (uint256[2] memory) {
        // Identity element for twisted-Edwards addition
        uint256[2] memory acc = [uint256(0), uint256(1)];

        for (uint256 i = 0; i < NUM_KEYHOLDERS; i++) {
            uint256[2] memory share = p.publicKeyShares[i];
            acc = _pointAdd(acc, share);
        }

        return acc;
    }

    // ========= Internal: BabyJubJub Curve Arithmetic ============================

    /**
     * @dev Returns true iff (x, y) satisfies a*x^2 + y^2 = 1 + d*x^2*y^2 (mod p).
     *      Explicitly rejects the identity point (0, 1).
     *
     *      Uses the contract's own BABYJUB_* constants (Base8 point) rather than
     *      importing BabyJubJub.sol, to stay consistent with the circuit's BASE8.
     */
    function _isOnCurve(uint256 x, uint256 y) internal pure returns (bool) {
        // Reject identity point explicitly
        if (x == 0 && y == 1) return false;

        // Reject out-of-field coordinates
        if (x >= BABYJUB_MODULUS || y >= BABYJUB_MODULUS) return false;

        uint256 p  = BABYJUB_MODULUS;
        uint256 x2 = mulmod(x, x, p);
        uint256 y2 = mulmod(y, y, p);

        // lhs = a*x^2 + y^2  (mod p)
        uint256 lhs = addmod(mulmod(BABYJUB_A, x2, p), y2, p);

        // rhs = 1 + d*x^2*y^2  (mod p)
        uint256 rhs = addmod(1, mulmod(BABYJUB_D, mulmod(x2, y2, p), p), p);

        return lhs == rhs;
    }

    /**
     * @dev Complete twisted-Edwards point addition on BabyJubJub.
     *
     *   x3 = (x1*y2 + y1*x2) / (1 + d*x1*x2*y1*y2)
     *   y3 = (y1*y2 - a*x1*x2) / (1 - d*x1*x2*y1*y2)
     *
     *      Split into _pointAddX / _pointAddY helpers to avoid stack-too-deep.
     *      The shared intermediate `dx1x2y1y2` is recomputed in each helper
     *      (one extra mulmod) rather than passed as a parameter, which would
     *      push the caller's stack over the limit.
     */
    function _pointAdd(
        uint256[2] memory pt1,
        uint256[2] memory pt2
    ) internal pure returns (uint256[2] memory result) {
        result[0] = _pointAddX(pt1, pt2);
        result[1] = _pointAddY(pt1, pt2);
    }

    function _pointAddX(
        uint256[2] memory pt1,
        uint256[2] memory pt2
    ) internal pure returns (uint256) {
        uint256 p         = BABYJUB_MODULUS;
        uint256 x1x2      = mulmod(pt1[0], pt2[0], p);
        uint256 y1y2      = mulmod(pt1[1], pt2[1], p);
        uint256 dx1x2y1y2 = mulmod(BABYJUB_D, mulmod(x1x2, y1y2, p), p);

        uint256 num = addmod(mulmod(pt1[0], pt2[1], p), mulmod(pt1[1], pt2[0], p), p);
        uint256 den = addmod(1, dx1x2y1y2, p);
        return mulmod(num, _modInverse(den, p), p);
    }

    function _pointAddY(
        uint256[2] memory pt1,
        uint256[2] memory pt2
    ) internal pure returns (uint256) {
        uint256 p         = BABYJUB_MODULUS;
        uint256 x1x2      = mulmod(pt1[0], pt2[0], p);
        uint256 y1y2      = mulmod(pt1[1], pt2[1], p);
        uint256 dx1x2y1y2 = mulmod(BABYJUB_D, mulmod(x1x2, y1y2, p), p);

        uint256 num = addmod(y1y2, p - mulmod(BABYJUB_A, x1x2, p), p);
        uint256 den = addmod(1, p - dx1x2y1y2, p);
        return mulmod(num, _modInverse(den, p), p);
    }

    /**
     * @dev Modular inverse via iterative extended Euclidean algorithm.
     *
     *      Keeps only 4 persistent uint256 locals (t, newt, r, newr).
     *      Bezout coefficients are kept in [0, m) — negative values represented
     *      as their modular equivalent — so no sign flag is needed.
     *
     *      No precompile calls: precompiles 0x01-0x09 are not available on PolkaVM.
     */
    function _modInverse(uint256 a, uint256 m) internal pure returns (uint256) {
        require(a != 0, "PrivateVoting: inverse of zero");
        a = a % m;
        require(a != 0, "PrivateVoting: inverse of zero mod m");
        if (a == 1) return 1;

        uint256 t    = 0;
        uint256 newt = 1;
        uint256 r    = m;
        uint256 newr = a;

        while (newr != 0) {
            uint256 q    = r / newr;
            uint256 tmp  = newt;
            uint256 qmod = mulmod(q, newt, m);
            newt = t >= qmod ? t - qmod : m - qmod + t;
            t    = tmp;
            tmp  = newr;
            newr = r - q * newr;
            r    = tmp;
        }

        return t;
    }

    // ========= Internal: Keyholder Lookup ========================================

    /**
     * @dev Returns the 0-based index of `addr` in the keyholders array,
     *      or type(uint256).max if not found.
     */
    function _keyholderIndex(address addr) internal view returns (uint256) {
        for (uint256 i = 0; i < NUM_KEYHOLDERS; i++) {
            if (keyholders[i] == addr) return i;
        }
        return type(uint256).max;
    }
}
