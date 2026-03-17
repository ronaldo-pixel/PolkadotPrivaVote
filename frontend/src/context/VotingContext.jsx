import React, { createContext, useState, useCallback } from 'react';

export const VotingContext = createContext();

// ─── Static mock data ────────────────────────────────────────────────────────
const MOCK_PROPOSALS = [
  {
    id: 'PROP-001',
    creator: '0x1234567890123456789012345678901234567890',
    description: 'Should we increase the treasury allocation?',
    options: ['Yes', 'No', 'Abstain'],
    votingMode: 'normal',
    startBlock: 100,
    endBlock: 200,
    status: 'ACTIVE',
    eligibilityThreshold: 1000,
    minVoterThreshold: 10,
    voteCount: 25,
    voteWeight: { Yes: 15, No: 8, Abstain: 2 },
    totalParticipation: 25,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    votes: [],
  },
  {
    id: 'PROP-002',
    creator: '0x9876543210987654321098765432109876543210',
    description: 'Proposal for new governance framework',
    options: ['Approve', 'Reject'],
    votingMode: 'quadratic',
    startBlock: 50,
    endBlock: 150,
    status: 'PENDING_DKG',
    eligibilityThreshold: 500,
    minVoterThreshold: 5,
    voteCount: 0,
    voteWeight: { Approve: 0, Reject: 0 },
    totalParticipation: 0,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    votes: [],
  },
  {
    id: 'PROP-003',
    creator: '0x1111111111111111111111111111111111111111',
    description: 'Community fund distribution',
    options: ['Option A', 'Option B', 'Option C'],
    votingMode: 'normal',
    startBlock: 1,
    endBlock: 50,
    status: 'REVEALED',
    eligibilityThreshold: 100,
    minVoterThreshold: 3,
    voteCount: 45,
    voteWeight: { 'Option A': 20, 'Option B': 15, 'Option C': 10 },
    totalParticipation: 45,
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    winner: 'Option A',
    votes: [],
  },
];
// ─────────────────────────────────────────────────────────────────────────────

export const VotingProvider = ({ children }) => {
  const [userAddress, setUserAddress]       = useState(null);
  const [isKeyholder, setIsKeyholder]       = useState(false);
  const [userEligibility, setUserEligibility] = useState({});
  const [userVotes, setUserVotes]           = useState([]);
  const [userProposals, setUserProposals]   = useState([]);

  const [proposals, setProposals]           = useState(MOCK_PROPOSALS);
  const [proposalDetail, setProposalDetail] = useState(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState(null);

  const [usedNullifiers, setUsedNullifiers] = useState(new Set());

  // ── Proposal queries ───────────────────────────────────────────────────────

  const initializeProposals = useCallback(() => {
    setProposals(MOCK_PROPOSALS);
  }, []);

  const getProposalDetail = useCallback((proposalId) => {
    const proposal = proposals.find((p) => p.id === proposalId);
    setProposalDetail(proposal);
    return proposal;
  }, [proposals]);

  const getActiveProposals = useCallback(() =>
    proposals.filter((p) => p.status === 'PENDING_DKG' || p.status === 'ACTIVE'),
  [proposals]);

  const getArchivedProposals = useCallback(() =>
    proposals.filter((p) => p.status === 'REVEALED' || p.status === 'CANCELLED'),
  [proposals]);

  const getEndedProposals = useCallback(() =>
    proposals.filter((p) => p.status === 'ENDED'),
  [proposals]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createProposal = useCallback((proposalData) => {
    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      try {
        const newProposal = {
          id: `PROP-${String(proposals.length + 1).padStart(3, '0')}`,
          creator: userAddress,
          ...proposalData,
          status: 'PENDING_DKG',
          voteCount: 0,
          voteWeight: Object.fromEntries(proposalData.options.map((opt) => [opt, 0])),
          totalParticipation: 0,
          createdAt: new Date(),
          votes: [],
        };

        setProposals((prev) => [...prev, newProposal]);
        setUserProposals((prev) => [...prev, newProposal.id]);
        setLoading(false);
        resolve(newProposal);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        reject(err);
      }
    });
  }, [proposals, userAddress]);

  const submitVote = useCallback(
    (proposalId, optionIndex, encryptedVote, zkProof, nullifier) => {
      setLoading(true);
      setError(null);

      try {
        if (usedNullifiers.has(nullifier)) {
          throw new Error('this vote has already been cast');
        }

        setProposals((prev) =>
          prev.map((p) => {
            if (p.id !== proposalId) return p;
            const option = p.options[optionIndex];
            return {
              ...p,
              voteCount: p.voteCount + 1,
              totalParticipation: p.totalParticipation + 1,
              voteWeight: { ...p.voteWeight, [option]: (p.voteWeight[option] || 0) + 1 },
              votes: [...(p.votes || []), { encryptedVote, zkProof, nullifier, optionIndex }],
            };
          })
        );

        setUsedNullifiers((prev) => new Set([...prev, nullifier]));
        setUserVotes((prev) => (prev.includes(proposalId) ? prev : [...prev, proposalId]));
        setLoading(false);
        return { success: true, nullifier };
      } catch (err) {
        setError(err.message);
        setLoading(false);
        throw err;
      }
    },
    [usedNullifiers]
  );

  const submitPartialDecryption = useCallback(
    (proposalId, partialDecryption, proof) => {
      setLoading(true);
      setError(null);

      try {
        setProposals((prev) =>
          prev.map((p) =>
            p.id !== proposalId
              ? p
              : {
                  ...p,
                  partialDecryptions: [
                    ...(p.partialDecryptions || []),
                    { partialDecryption, proof },
                  ],
                }
          )
        );
        setLoading(false);
        return { success: true };
      } catch (err) {
        setError(err.message);
        setLoading(false);
        throw err;
      }
    },
    []
  );

  // ── User helpers ───────────────────────────────────────────────────────────

  const checkEligibility = useCallback(
    (_proposalId) => {
      if (!userAddress) return false;
      return Math.random() > 0.3;
    },
    [userAddress]
  );

  const connectWallet = useCallback((address) => {
    setUserAddress(address);
    setIsKeyholder(Math.random() > 0.8);
  }, []);

  const getNullifierStatus = useCallback(
    () => ({
      usedCount: usedNullifiers.size,
      availableCount: 100 - usedNullifiers.size,
      totalAllocation: 100,
    }),
    [usedNullifiers]
  );

  // ── Context value ──────────────────────────────────────────────────────────

  const value = {
    userAddress,
    isKeyholder,
    userEligibility,
    userVotes,
    userProposals,
    connectWallet,

    proposals,
    proposalDetail,
    loading,
    error,

    initializeProposals,
    getProposalDetail,
    getActiveProposals,
    getArchivedProposals,
    getEndedProposals,
    createProposal,

    submitVote,
    submitPartialDecryption,
    checkEligibility,

    usedNullifiers,
    getNullifierStatus,
  };

  return <VotingContext.Provider value={value}>{children}</VotingContext.Provider>;
};

export const useVoting = () => {
  const context = React.useContext(VotingContext);
  if (!context) throw new Error('useVoting must be used within VotingProvider');
  return context;
};