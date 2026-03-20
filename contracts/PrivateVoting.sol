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

    // =========================================================================
    // Constants
    // =========================================================================

    uint256 private constant NUM_KEYHOLDERS = 3;
    uint256 private constant MIN_VOTERS     = 1;
    uint256 private constant MIN_OPTIONS    = 2;
    uint256 private constant MAX_OPTIONS    = 10;
    uint256 private constant TIMEOUT_BLOCKS = 50000;

    // BabyJubJub — Base8 point used in vote.circom (not EIP-2494 generator)
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

    // =========================================================================
    // Enums & Structs
    // =========================================================================

    enum ProposalStatus { PENDING_DKG, ACTIVE, ENDED, REVEALED, CANCELLED }
    enum VotingMode     { NORMAL, QUADRATIC }

    struct ElGamalCiphertext {
        uint256[2] c1;  // [x, y]
        uint256[2] c2;  // [x, y]
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
        uint256[2] electionPublicKey;
        uint256[2][NUM_KEYHOLDERS] publicKeyShares;
        ElGamalCiphertext[MAX_OPTIONS] encryptedTally;
        uint256 voteCount;
        uint256[2][MAX_OPTIONS][NUM_KEYHOLDERS] partialDecryptions;
        uint256[MAX_OPTIONS] finalResult;
        uint256 winningOption;
        uint256 endedAtBlock;
        uint256 shareCount;    
        uint256 partialCount;
    }

    // =========================================================================
    // State
    // =========================================================================

    address[NUM_KEYHOLDERS] public keyholders;
    mapping(uint256 => Proposal)                        public  proposals;
    mapping(uint256 => mapping(address => bool))        public  hasVoted;
    mapping(uint256 => mapping(uint256 => bool))        private _shareSubmitted;
    mapping(uint256 => mapping(uint256 => bool))        private _partialSubmitted;

    uint256 public proposalCount;
    address public verifierContract;
    

    // =========================================================================
    // Events
    // =========================================================================

    event ProposalCreated(uint256 indexed proposalId);
    event PublicKeyShareSubmitted(
        uint256 indexed proposalId,
        address indexed keyholder,
        uint256 keyholderIndex,
        uint256 shareX,
        uint256 shareY
    );
    event ElectionKeyComputed(uint256 indexed proposalId, uint256 keyX, uint256 keyY);
    event VotingStarted(uint256 indexed proposalId, uint256 startBlock, uint256 endBlock);
    event VoteCast(uint256 indexed proposalId, address indexed voter, uint256 voteCount);
    event VotingEnded(uint256 indexed proposalId, uint256 totalVotes);
    event PartialDecryptionSubmitted(
        uint256 indexed proposalId,
        address indexed keyholder,
        uint256 keyholderIndex
    );
    event ResultRevealed(uint256 indexed proposalId, uint256 winningOption);

    // =========================================================================
    // Errors
    // =========================================================================

    error NotKeyholder();
    error ProposalNotFound(uint256 proposalId);
    error WrongStatus(uint256 proposalId, ProposalStatus expected, ProposalStatus actual);
    error AlreadySubmittedShare(uint256 proposalId, address keyholder);
    error AlreadySubmittedPartial(uint256 proposalId, address keyholder);
    error AlreadyVoted(uint256 proposalId, address voter);
    error InvalidPoint();
    error InvalidProof();
    error PublicInputMismatch(string field);
    error VotingNotOpen(uint256 proposalId);
    error InsufficientBalance(address voter, uint256 balance, uint256 required);
    error NotEnoughVoters(uint256 actual, uint256 required);
    error InvalidOptionCount(uint256 provided, uint256 min, uint256 max);
    error DurationMustBePositive();
    error MinVoterThresholdTooLow(uint256 provided, uint256 min);
    error VotingWindowStillOpen(uint256 proposalId, uint256 currentBlock, uint256 endBlock);

    error C1XMismatch(uint256 option, uint256 expected, uint256 got);
    error C1YMismatch(uint256 option, uint256 expected, uint256 got);
    error C2XMismatch(uint256 option, uint256 expected, uint256 got);
    error C2YMismatch(uint256 option, uint256 expected, uint256 got);

    error InvalidKeyholderIndex(uint256 provided, uint256 max);
    error ModExpFailed();
    error InverseOfZero();
    error WrongTally(uint256 option, uint256 expectedX, uint256 expectedY, uint256 gotX, uint256 gotY);


    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier proposalExists(uint256 proposalId) {
        if (proposalId >= proposalCount) revert ProposalNotFound(proposalId);
        _;
    }

    modifier onlyKeyholder() {
        if (_keyholderIndex(msg.sender) == type(uint256).max) revert NotKeyholder();
        _;
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(
        address keyholder0,
        address keyholder1,
        address keyholder2,
        address verifier
    ) {
        keyholders[0]    = keyholder0;
        keyholders[1]    = keyholder1;
        keyholders[2]    = keyholder2;
        verifierContract = verifier;
        
    }

    // =========================================================================
    // createProposal
    // =========================================================================

    function createProposal(
        string memory description,
        string[] memory options,
        VotingMode votingMode,
        uint256 duration,
        uint256 eligibilityThreshold,
        uint256 minVoterThreshold
    ) external returns (uint256 proposalId) {
        if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS)
            revert InvalidOptionCount(options.length, MIN_OPTIONS, MAX_OPTIONS);
        if (duration == 0)
            revert DurationMustBePositive();
        if (minVoterThreshold < MIN_VOTERS)
            revert MinVoterThresholdTooLow(minVoterThreshold, MIN_VOTERS);

        proposalId = proposalCount++;

        Proposal storage p = proposals[proposalId];
        p.id                   = proposalId;
        p.creator              = msg.sender;
        p.description          = description;
        p.options              = options;
        p.votingMode           = votingMode;
        p.createdAtBlock       = block.number;
        p.duration             = duration;
        p.eligibilityThreshold = eligibilityThreshold;
        p.minVoterThreshold    = minVoterThreshold;
        p.status               = ProposalStatus.PENDING_DKG;

        // Tally initialised to BabyJubJub identity (0,1) for homomorphic addition
        for (uint256 i = 0; i < MAX_OPTIONS; i++) {
            p.encryptedTally[i] = ElGamalCiphertext(
                [uint256(0), uint256(1)],
                [uint256(0), uint256(1)]
            );
        }

        emit ProposalCreated(proposalId);
    }

    // =========================================================================
    // DKG — view helpers
    // =========================================================================

    function getElectionPublicKey(uint256 proposalId)
        external view proposalExists(proposalId)
        returns (uint256 x, uint256 y, ProposalStatus status, uint256 sharesIn)
    {
        Proposal storage p = proposals[proposalId];
        x      = p.electionPublicKey[0];
        y      = p.electionPublicKey[1];
        status = p.status;
        sharesIn = p.shareCount;
    }

    function getPublicKeyShare(uint256 proposalId, uint256 keyholderIndex)
        external view proposalExists(proposalId)
        returns (uint256 x, uint256 y, bool submitted)
    {
        if (keyholderIndex >= NUM_KEYHOLDERS)   
            revert InvalidKeyholderIndex(keyholderIndex, NUM_KEYHOLDERS - 1);           
        submitted = _shareSubmitted[proposalId][keyholderIndex];
        if (submitted) {
            x = proposals[proposalId].publicKeyShares[keyholderIndex][0];
            y = proposals[proposalId].publicKeyShares[keyholderIndex][1];
        }
    }

    function getDKGStatus(uint256 proposalId)
        external view proposalExists(proposalId)
        returns (address[NUM_KEYHOLDERS] memory addresses, bool[NUM_KEYHOLDERS] memory submitted)
    {
        for (uint256 i = 0; i < NUM_KEYHOLDERS; i++) {
            addresses[i] = keyholders[i];
            submitted[i] = _shareSubmitted[proposalId][i];
        }
    }

    // =========================================================================
    // DKG — submitPublicKeyShare
    // =========================================================================

    function submitPublicKeyShare(
        uint256 proposalId,
        uint256 shareX,
        uint256 shareY
    ) external proposalExists(proposalId) onlyKeyholder {
        Proposal storage p = proposals[proposalId];

        if (p.status != ProposalStatus.PENDING_DKG)
            revert WrongStatus(proposalId, ProposalStatus.PENDING_DKG, p.status);

        uint256 idx = _keyholderIndex(msg.sender);
        if (_shareSubmitted[proposalId][idx])
            revert AlreadySubmittedShare(proposalId, msg.sender);

        if (!_isOnCurve(shareX, shareY)) revert InvalidPoint();

        _shareSubmitted[proposalId][idx]    = true;
        p.publicKeyShares[idx][0]           = shareX;
        p.publicKeyShares[idx][1]           = shareY;

        emit PublicKeyShareSubmitted(proposalId, msg.sender, idx, shareX, shareY);

        p.shareCount++;
        if (p.shareCount == NUM_KEYHOLDERS) _finalizeElectionKey(proposalId);
    }

    // =========================================================================
    // castVote
    // =========================================================================

    /**
     * @notice Submit a ZK-proven encrypted vote.
     *
     * The caller provides:
     *   - A Groth16 proof (pA, pB, pC) generated off-chain by snarkjs
     *   - The 44 public signals matching the circuit's public inputs
     *   - The encrypted vote ciphertexts (one per option, matching the proof)
     *
     * Public signals layout (matches vote.circom VoteProof(10)):
     *   [0]     claimedBalance
     *   [1]     votingMode       (0=NORMAL, 1=QUADRATIC)
     *   [2,3]   publicKey        (x, y of election public key)
     *   [4..43] encryptedVote    (10 options × 2 points × 2 coords)
     *             option i: c1.x=[4+i*4], c1.y=[5+i*4], c2.x=[6+i*4], c2.y=[7+i*4]
     *
     * The contract checks:
     *   1. Proposal is ACTIVE and within voting window
     *   2. Voter has not already voted
     *   3. Voter's token balance >= eligibilityThreshold
     *   4. publicKey signals match the stored electionPublicKey
     *   5. votingMode signal matches the proposal's votingMode
     *   6. claimedBalance <= voter's actual on-chain token balance
     *   7. Groth16 proof is valid
     *
     * Then accumulates encrypted votes homomorphically:
     *   tally.c1 += vote.c1   (point addition per option)
     *   tally.c2 += vote.c2
     */
    function castVote(
        uint256 proposalId,
        uint256[2]    calldata pA,
        uint256[2][2] calldata pB,
        uint256[2]    calldata pC,
        uint256[44]   calldata pubSignals,
        uint256[2][2][MAX_OPTIONS] calldata encVote
        // encVote[option][c1/c2][x/y]
    ) external proposalExists(proposalId) {
        Proposal storage p = proposals[proposalId];

        // ── 1. Status and timing ──────────────────────────────────────────────
        if (p.status == ProposalStatus.ACTIVE && block.number > p.endBlock) {
            closeVoting(proposalId);  // transitions to ENDED or CANCELLED
        }
        if (p.status != ProposalStatus.ACTIVE) revert VotingNotOpen(proposalId);
        if (block.number < p.startBlock) revert VotingNotOpen(proposalId);

        // ── 2. One vote per address ───────────────────────────────────────────
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted(proposalId, msg.sender);

        // ── 3. Token eligibility ──────────────────────────────────────────────
        if (p.eligibilityThreshold > 0) {
            
            if (msg.sender.balance < p.eligibilityThreshold)
                revert InsufficientBalance(msg.sender, msg.sender.balance, p.eligibilityThreshold);
        }

        // ── 4. Public signal: election public key must match stored EPK ───────
        if (pubSignals[2] != p.electionPublicKey[0] ||
            pubSignals[3] != p.electionPublicKey[1])
            revert PublicInputMismatch("publicKey");

        // ── 5. Public signal: votingMode must match proposal ──────────────────
        uint256 expectedMode = (p.votingMode == VotingMode.NORMAL) ? 0 : 1;
        if (pubSignals[1] != expectedMode)
            revert PublicInputMismatch("votingMode");

        // ── 6. claimedBalance <= actual on-chain balance ──────────────────────
        //    The circuit proves the vote weight is consistent with claimedBalance.
        //    We bind that claim to the real balance so a voter cannot lie about
        //    their weight. We read balanceOf here rather than in the circuit
        //    (circuits cannot read chain state).
        uint256 claimedBalance = pubSignals[0];
        uint256 actualBalance  = msg.sender.balance;
        if (claimedBalance > actualBalance)
            revert InsufficientBalance(msg.sender, actualBalance, claimedBalance);

        // ── 7. Verify the encVote points match the public signals ─────────────
        //    pubSignals[4+i*4 .. 4+i*4+3] = encVote[i][0][0], [0][1], [1][0], [1][1]
        //    This prevents a voter from submitting a valid proof for one ciphertext
        //    but accumulating a different ciphertext into the tally.
        _checkEncVoteMatchesSignals(pubSignals, encVote);

        // ── 8. ZK proof verification ──────────────────────────────────────────
        //    NOTE: On PolkaVM, Groth16Verifier.verifyProof() uses BN128 precompiles
        //    (0x06, 0x07, 0x08) which are not available. The verifierContract is
        //    currently a placeholder (address(1)). When a PolkaVM-compatible ZK
        //    verifier exists, replace the placeholder and remove this guard.
        if (verifierContract != address(1)) {
            bool valid = IVerifier(verifierContract).verifyProof(pA, pB, pC, pubSignals);
            if (!valid) revert InvalidProof();
        }

        // ── 9. Accumulate encrypted tally (homomorphic ElGamal addition) ──────
        //    For each option: tally.c1 += vote.c1, tally.c2 += vote.c2
        //    Point addition on BabyJubJub is additive homomorphic over ElGamal.
        uint256 optionCount = p.options.length;
        for (uint256 i = 0; i < optionCount; i++) {
            // Copy calldata slice to memory — Solidity cannot implicitly convert
            // a calldata sub-array index to a memory parameter.
            uint256[2][2] memory voteSlice;
            voteSlice[0][0] = encVote[i][0][0];
            voteSlice[0][1] = encVote[i][0][1];
            voteSlice[1][0] = encVote[i][1][0];
            voteSlice[1][1] = encVote[i][1][1];
            _accumulateCiphertext(p, i, voteSlice);
        }

        // ── 10. Record vote ───────────────────────────────────────────────────
        hasVoted[proposalId][msg.sender] = true;
        p.voteCount++;

        emit VoteCast(proposalId, msg.sender, p.voteCount);
    }

    // =========================================================================
    // closeVoting
    // =========================================================================

    /**
     * @notice Transitions a proposal from ACTIVE to ENDED.
     *
     * Can be called by anyone once block.number > endBlock.
     * After this, keyholders can begin submitting partial decryptions.
     * If minVoterThreshold is not met, the proposal is CANCELLED instead.
     */
    function closeVoting(uint256 proposalId) public proposalExists(proposalId) {
        Proposal storage p = proposals[proposalId];

        if (p.status != ProposalStatus.ACTIVE)
            revert WrongStatus(proposalId, ProposalStatus.ACTIVE, p.status);
        if (block.number <= p.endBlock)
            revert VotingWindowStillOpen(proposalId, block.number, p.endBlock);

        if (p.voteCount < p.minVoterThreshold) {
            p.status      = ProposalStatus.CANCELLED;
            p.endedAtBlock = block.number;
            emit VotingEnded(proposalId, p.voteCount);
            return;
        }

        p.status       = ProposalStatus.ENDED;
        p.endedAtBlock = block.number;
        emit VotingEnded(proposalId, p.voteCount);
    }

    // =========================================================================
    // submitPartialDecrypt
    // =========================================================================

    /**
     * @notice Each keyholder submits their partial decryption shares after voting ends.
     *
     * For each vote option i, the keyholder computes off-chain:
     *   D_i = encryptedTally[i].c1 ^ x_k     (scalar multiplication)
     *         where x_k is the keyholder's private share
     *
     * This is the threshold decryption step. Once all NUM_KEYHOLDERS keyholders
     * have submitted, finalizeResult() can reconstruct the plaintext tally.
     *
     * @param proposalId        The proposal to decrypt.
     * @param partials          partials[option][x/y] — one BabyJubJub point per option.
     *                          Each point = encryptedTally[option].c1 ^ privateShare.
     */
    function submitPartialDecrypt(
        uint256 proposalId,
        uint256[2][MAX_OPTIONS] calldata partials
    ) external proposalExists(proposalId) onlyKeyholder {
        Proposal storage p = proposals[proposalId];

        if (p.status != ProposalStatus.ENDED)
            revert WrongStatus(proposalId, ProposalStatus.ENDED, p.status);

        uint256 idx = _keyholderIndex(msg.sender);
        if (_partialSubmitted[proposalId][idx])
            revert AlreadySubmittedPartial(proposalId, msg.sender);

        // Validate each partial decryption point is on the curve
        for (uint256 i = 0; i < MAX_OPTIONS; i++) {
            bool isIdentity = (partials[i][0] == 0 && partials[i][1] == 1);
            if (!isIdentity && !_isOnCurve(partials[i][0], partials[i][1]))
                revert InvalidPoint();
            p.partialDecryptions[idx][i][0] = partials[i][0];
            p.partialDecryptions[idx][i][1] = partials[i][1];
        }

        _partialSubmitted[proposalId][idx] = true;

        emit PartialDecryptionSubmitted(proposalId, msg.sender, idx);

        p.partialCount++;
    }

    // =========================================================================
    // submitFinalTally
    // =========================================================================

    // instead of computing discrete log on-chain in _finalizeResult
    // just store the decrypted POINT (mg) and let anyone submit the result

    // add a separate function:
    function submitFinalTally(
        uint256 proposalId,
        uint256[MAX_OPTIONS] calldata tallies
    ) external proposalExists(proposalId) {
        Proposal storage p = proposals[proposalId];
        if (p.status != ProposalStatus.ENDED)
            revert WrongStatus(proposalId, ProposalStatus.ENDED, p.status);
        if (p.partialCount != NUM_KEYHOLDERS)
            revert NotEnoughVoters(p.partialCount, NUM_KEYHOLDERS);

        uint256 optionCount = p.options.length;
        uint256 winningOpt = 0;
        uint256 winningTally = 0;

        for (uint256 i = 0; i < optionCount; i++) {
            // verify: tallies[i] * G == mg (computed from partial decryptions)
            uint256[2] memory c1x = _sumPartials(p, i);
            uint256[2] memory neg_c1x = [
                c1x[0] == 0 ? 0 : BABYJUB_MODULUS - c1x[0],
                c1x[1]
            ];
            uint256[2] memory mg = _pointAdd(
                [p.encryptedTally[i].c2[0], p.encryptedTally[i].c2[1]],
                neg_c1x
            );

            // verify tallies[i] * G == mg
            uint256[2] memory check = _pointMulScalar(tallies[i]);
            require(check[0] == mg[0] && check[1] == mg[1], "wrong tally");

            p.finalResult[i] = tallies[i];
            if (tallies[i] > winningTally) {
                winningTally = tallies[i];
                winningOpt = i;
            }
        }

        p.winningOption = winningOpt;
        p.status = ProposalStatus.REVEALED;
        emit ResultRevealed(proposalId, winningOpt);
    }

    function _pointMulScalar(uint256 scalar)
        internal view returns (uint256[2] memory result)
    {
        result = [uint256(0), uint256(1)]; // identity
        uint256[2] memory addend = [BABYJUB_GX, BABYJUB_GY];

        while (scalar > 0) {
            if (scalar & 1 == 1) result = _pointAdd(result, addend);
            addend = _pointAdd(addend, addend);
            scalar >>= 1;
        }
    }

    function _sumPartials(
        Proposal storage p,
        uint256 optionIndex
    ) internal view returns (uint256[2] memory) {
        uint256[2] memory acc = [uint256(0), uint256(1)]; // identity

        for (uint256 k = 0; k < NUM_KEYHOLDERS; k++) {
            uint256[2] memory partialPt = [
                p.partialDecryptions[k][optionIndex][0],
                p.partialDecryptions[k][optionIndex][1]
            ];
            acc = _pointAdd(acc, partialPt);
        }

        return acc;
    }


    // =========================================================================
    // View: get results
    // =========================================================================

    /**
     * @notice Returns the final vote tally and winner after REVEALED status.
     */
    function getResult(uint256 proposalId)
        external view proposalExists(proposalId)
        returns (
            uint256[MAX_OPTIONS] memory tally,
            uint256 winningOption,
            ProposalStatus status
        )
    {
        Proposal storage p = proposals[proposalId];
        tally         = p.finalResult;
        winningOption = p.winningOption;
        status        = p.status;
    }

    /**
     * @notice Returns the current encrypted tally for a single option.
     *         Useful for off-chain partial decryption computation.
     */
    function getEncryptedTally(uint256 proposalId, uint256 optionIndex)
        external view proposalExists(proposalId)
        returns (uint256[2] memory c1, uint256[2] memory c2)
    {
        ElGamalCiphertext storage ct = proposals[proposalId].encryptedTally[optionIndex];
        c1 = ct.c1;
        c2 = ct.c2;
    }

    // =========================================================================
    // Internal: castVote helpers
    // =========================================================================

    /**
     * @dev Verifies that encVote[i][c][xy] == pubSignals[4 + i*4 + c*2 + xy]
     *      for all options i, components c (0=c1,1=c2), coordinates xy (0=x,1=y).
     *      Split into two loops to avoid stack-too-deep.
     */
    function _checkEncVoteMatchesSignals(
        uint256[44] calldata pubSignals,
        uint256[2][2][MAX_OPTIONS] calldata encVote
    ) internal pure {
        _checkC1Signals(pubSignals, encVote);
        _checkC2Signals(pubSignals, encVote);
    }

    function _checkC1Signals(
        uint256[44] calldata pubSignals,
        uint256[2][2][MAX_OPTIONS] calldata encVote
    ) internal pure {
        for (uint256 i = 0; i < MAX_OPTIONS; i++) {
            uint256 base = 4 + i * 4;
            if (encVote[i][0][0] != pubSignals[base])
                revert C1XMismatch(i, pubSignals[base], encVote[i][0][0]);
            if (encVote[i][0][1] != pubSignals[base + 1])
                revert C1YMismatch(i, pubSignals[base + 1], encVote[i][0][1]);
        }
    }

    function _checkC2Signals(
        uint256[44] calldata pubSignals,
        uint256[2][2][MAX_OPTIONS] calldata encVote
    ) internal pure {
        for (uint256 i = 0; i < MAX_OPTIONS; i++) {
            uint256 base = 4 + i * 4;
            if (encVote[i][1][0] != pubSignals[base + 2])
                revert C2XMismatch(i, pubSignals[base + 2], encVote[i][1][0]);
            if (encVote[i][1][1] != pubSignals[base + 3])
                revert C2YMismatch(i, pubSignals[base + 3], encVote[i][1][1]);
        }
    }

    /**
     * @dev Homomorphic tally accumulation for one option.
     *      tally.c1 += vote.c1  (point add)
     *      tally.c2 += vote.c2  (point add)
     */
    function _accumulateCiphertext(
        Proposal storage p,
        uint256 optionIndex,
        uint256[2][2] memory vote   // vote[c1/c2][x/y]
    ) internal {
        uint256[2] memory votec1 = [vote[0][0], vote[0][1]];
        uint256[2] memory votec2 = [vote[1][0], vote[1][1]];

        uint256[2] memory newc1 = _pointAdd(
            [p.encryptedTally[optionIndex].c1[0], p.encryptedTally[optionIndex].c1[1]],
            votec1
        );
        uint256[2] memory newc2 = _pointAdd(
            [p.encryptedTally[optionIndex].c2[0], p.encryptedTally[optionIndex].c2[1]],
            votec2
        );

        p.encryptedTally[optionIndex].c1[0] = newc1[0];
        p.encryptedTally[optionIndex].c1[1] = newc1[1];
        p.encryptedTally[optionIndex].c2[0] = newc2[0];
        p.encryptedTally[optionIndex].c2[1] = newc2[1];
    }

    

    

    // =========================================================================
    // Internal: BabyJubJub curve arithmetic
    // =========================================================================

    function _isOnCurve(uint256 x, uint256 y) internal pure returns (bool) {
        if (x == 0 && y == 1) return false;
        if (x >= BABYJUB_MODULUS || y >= BABYJUB_MODULUS) return false;

        uint256 p  = BABYJUB_MODULUS;
        uint256 x2 = mulmod(x, x, p);
        uint256 y2 = mulmod(y, y, p);
        uint256 lhs = addmod(mulmod(BABYJUB_A, x2, p), y2, p);
        uint256 rhs = addmod(1, mulmod(BABYJUB_D, mulmod(x2, y2, p), p), p);
        return lhs == rhs;
    }

    function _pointAdd(
        uint256[2] memory pt1,
        uint256[2] memory pt2
    ) internal view returns (uint256[2] memory result) {
        result[0] = _pointAddX(pt1, pt2);
        result[1] = _pointAddY(pt1, pt2);
    }

    function _pointAddX(
        uint256[2] memory pt1,
        uint256[2] memory pt2
    ) internal view returns (uint256) {
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
    ) internal view returns (uint256) {
        uint256 p         = BABYJUB_MODULUS;
        uint256 x1x2      = mulmod(pt1[0], pt2[0], p);
        uint256 y1y2      = mulmod(pt1[1], pt2[1], p);
        uint256 dx1x2y1y2 = mulmod(BABYJUB_D, mulmod(x1x2, y1y2, p), p);
        uint256 num = addmod(y1y2, p - mulmod(BABYJUB_A, x1x2, p), p);
        uint256 den = addmod(1, p - dx1x2y1y2, p);
        return mulmod(num, _modInverse(den, p), p);
    }

    function _modInverse(uint256 a, uint256 m) internal view returns (uint256) {
        if (a == 0) revert InverseOfZero();
        a = a % m;
        if (a == 0) revert InverseOfZero();
        if (a == 1) return 1;

        bytes memory input = abi.encodePacked(
            uint256(32),   // base length
            uint256(32),   // exp length
            uint256(32),   // mod length
            a,
            m - 2,         // Fermat: a^(p-2) mod p = a^-1
            m
        );
        (bool ok, bytes memory result) = address(5).staticcall(input);
        require(ok, "modexp failed");
        return abi.decode(result, (uint256));
    }


    function _keyholderIndex(address addr) internal view returns (uint256) {
        for (uint256 i = 0; i < NUM_KEYHOLDERS; i++) {
            if (keyholders[i] == addr) return i;
        }
        return type(uint256).max;
    }

    // =========================================================================
    // Internal: DKG finalization
    // =========================================================================

    function _finalizeElectionKey(uint256 proposalId) private {
        Proposal storage p = proposals[proposalId];
        uint256[2] memory combined = _sumShares(p);
        p.electionPublicKey[0] = combined[0];
        p.electionPublicKey[1] = combined[1];
        p.startBlock           = block.number;
        p.endBlock             = block.number + p.duration;
        p.status               = ProposalStatus.ACTIVE;
        emit ElectionKeyComputed(proposalId, combined[0], combined[1]);
        emit VotingStarted(proposalId, p.startBlock, p.endBlock);
    }

    function _sumShares(Proposal storage p) internal view returns (uint256[2] memory) {
        uint256[2] memory acc = [uint256(0), uint256(1)];
        for (uint256 i = 0; i < NUM_KEYHOLDERS; i++) {
            acc = _pointAdd(acc, [p.publicKeyShares[i][0], p.publicKeyShares[i][1]]);
        }
        return acc;
    }
}
