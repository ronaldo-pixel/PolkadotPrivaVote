pragma solidity ^0.8.20;

interface IVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory input
    ) external view returns (bool);
}

interface IChaumPedersen {
    function verify(
        uint256 generatorG,
        uint256 c1,
        uint256 publicKeyShare,
        uint256 partialDecryption,
        uint256 commitmentA,
        uint256 commitmentB,
        uint256 challenge,
        uint256 response
    ) external pure returns (bool);
}

contract PrivateVoting {
    // ========= Constants ==========
    uint256 private constant NUM_KEYHOLDERS  = 3;
    uint256 private constant THRESHOLD       = 2;
    uint256 private constant MIN_VOTERS      = 10;
    uint256 private constant MIN_OPTIONS     = 2;
    uint256 private constant MAX_OPTIONS     = 10;
    uint256 private constant TIMEOUT_BLOCKS  = 50000;
    uint256 private constant BABYJUB_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 private constant BABYJUB_A       = 168700;
    uint256 private constant BABYJUB_D       = 168696;

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
        uint256 startBlock;
        uint256 endBlock;
        uint256 eligibilityThreshold;
        uint256 minVoterThreshold;
        ProposalStatus status;
        address tokenContract;
        uint256[2] electionPublicKey;      // BabyJubJub point [x, y]
        uint256[2][3] publicKeyShares;     // [keyholder][x or y]
        bool[3] keyholderSubmittedPublicKey;
        ElGamalCiphertext[] encryptedTally;
        uint256 voteCount;
        uint256[2][][] partialDecryptions; // [keyholder][option][x or y]
        bool[3] keyholderSubmittedDecryption;
        uint256 partialCount;
        uint256[] finalResult;
        uint256 winningOption;
        uint256 endedAtBlock;
    }

    address[3] public keyholders;

    mapping(uint256 => Proposal) public proposals;

    // replaces usedNullifiers — tracks who voted on each proposal
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    uint256 public proposalCount;

    address public verifierContract;
    address public chaumPedersenContract;

}