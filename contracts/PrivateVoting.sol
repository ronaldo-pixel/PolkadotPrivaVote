pragma solidity ^0.8.20;

interface IVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[44] calldata input  // ← must match Verifier.sol exactly
    ) external view returns (bool);
}



contract PrivateVoting {
    // ========= Constants ==========
    uint256 private constant NUM_KEYHOLDERS  = 3;
    uint256 private constant MIN_VOTERS      = 10;
    uint256 private constant MIN_OPTIONS     = 2;
    uint256 private constant MAX_OPTIONS     = 10;
    uint256 private constant TIMEOUT_BLOCKS  = 50000;
    uint256 private constant BABYJUB_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 private constant BABYJUB_A       = 168700;
    uint256 private constant BABYJUB_D       = 168696;
    uint256 private constant BABYJUB_GX = 5299619240641551281634865583518297030282874472190772894086521144482721001553;
    uint256 private constant BABYJUB_GY = 16950150798460657717958625567821834550301663161624707787222815936182638968203;
    uint256 private constant BABYJUB_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041;

    // ================== ENUMS ==================
    enum ProposalStatus { PENDING_DKG, ACTIVE, ENDED, REVEALED, CANCELLED }
    enum VotingMode { NORMAL, QUADRATIC }

    struct ElGamalCiphertext {
        uint256[2] c1;   // [x, y] of c1 point
        uint256[2] c2;   // [x, y] of c2 point
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

    // ================== STATE VARIABLES ==================
    address[NUM_KEYHOLDERS] public keyholders;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    uint256 public proposalCount;
    address public verifierContract;

    // ================== CONSTRUCTOR ==================
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

    // ================== EVENTS ==================
    event ProposalCreated(uint256 indexed proposalId);


    

    // ================== FUNCTIONS ==================
    function createProposal(
        string memory description,
        string[] memory options,
        VotingMode votingMode,
        uint256 duration,
        uint256 eligibilityThreshold,
        uint256 minVoterThreshold,
        address tokenContract
    ) external returns (uint256 proposalId) {

        // validations
        require(options.length >= MIN_OPTIONS && options.length <= MAX_OPTIONS, "invalid option count");
        require(duration > 0, "duration must be positive");
        require(minVoterThreshold >= MIN_VOTERS, "min voter threshold too low");
        require(tokenContract != address(0), "invalid token contract");

        // assign id
        proposalId = proposalCount++;

        // get storage reference
        Proposal storage proposal = proposals[proposalId];

        // fill fields
        proposal.id                  = proposalId;
        proposal.creator             = msg.sender;
        proposal.description         = description;
        proposal.options             = options;
        proposal.votingMode          = votingMode;
        proposal.createdAtBlock      = block.number;
        proposal.duration            = duration;
        proposal.eligibilityThreshold = eligibilityThreshold;
        proposal.minVoterThreshold   = minVoterThreshold;
        proposal.status              = ProposalStatus.PENDING_DKG;
        proposal.tokenContract       = tokenContract;

        // initialize encryptedTally with BabyJubJub identity point (0, 1)
        for (uint256 i = 0; i < MAX_OPTIONS; i++) {
            proposal.encryptedTally[i] = ElGamalCiphertext(
                [uint256(0), uint256(1)],
                [uint256(0), uint256(1)]
            );
        }

        emit ProposalCreated(
            proposalId
        );
    }

}