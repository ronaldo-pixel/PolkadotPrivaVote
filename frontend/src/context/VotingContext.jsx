import React, { createContext, useState, useCallback } from 'react';

export const VotingContext = createContext();

export const VotingProvider = ({ children }) => {
  // User state
  const [userAddress, setUserAddress] = useState(null);
  const [isKeyholder, setIsKeyholder] = useState(false);
  const [userEligibility, setUserEligibility] = useState({});
  const [userVotes, setUserVotes] = useState([]);
  const [userProposals, setUserProposals] = useState([]);

  // Proposals state
  const [proposals, setProposals] = useState([]);
  const [proposalDetail, setProposalDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Nullifiers (for privacy)
  const [usedNullifiers, setUsedNullifiers] = useState(new Set());

  // Mock data for proposals
  const mockProposals = [
    {
      id: 'PROP-001',
      creator: '0x1234567890123456789012345678901234567890',
      description: 'Should we increase the treasury allocation?',
      options: ['Yes', 'No', 'Abstain'],
      votingMode: 'normal', // normal or quadratic
      startBlock: 100,
      endBlock: 200,
      status: 'ACTIVE', // PENDING_DKG, ACTIVE, ENDED, REVEALED, CANCELLED
      eligibilityThreshold: 1000, // tokens
      minVoterThreshold: 10, // minimum votes needed
      voteCount: 25,
      voteWeight: { 'Yes': 15, 'No': 8, 'Abstain': 2 },
      totalParticipation: 25,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      votes: [] // encrypted votes
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
      voteWeight: { 'Approve': 0, 'Reject': 0 },
      totalParticipation: 0,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      votes: []
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
      votes: []
    }
  ];

  // Load initial proposals
  const initializeProposals = useCallback(() => {
    setProposals(mockProposals);
  }, []);

  // Get proposal detail
  const getProposalDetail = useCallback((proposalId) => {
    const proposal = proposals.find(p => p.id === proposalId);
    setProposalDetail(proposal);
    return proposal;
  }, [proposals]);

  // Get active proposals (PENDING_DKG or ACTIVE)
  const getActiveProposals = useCallback(() => {
    return proposals.filter(p => p.status === 'PENDING_DKG' || p.status === 'ACTIVE');
  }, [proposals]);

  // Get archived proposals (REVEALED or CANCELLED)
  const getArchivedProposals = useCallback(() => {
    return proposals.filter(p => p.status === 'REVEALED' || p.status === 'CANCELLED');
  }, [proposals]);

  // Get ended proposals (ENDED status)
  const getEndedProposals = useCallback(() => {
    return proposals.filter(p => p.status === 'ENDED');
  }, [proposals]);

  // Create proposal
  const createProposal = useCallback((proposalData) => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulate API call
      const newProposal = {
        id: `PROP-${String(proposals.length + 1).padStart(3, '0')}`,
        creator: userAddress,
        ...proposalData,
        status: 'PENDING_DKG',
        voteCount: 0,
        voteWeight: Object.fromEntries(proposalData.options.map(opt => [opt, 0])),
        totalParticipation: 0,
        createdAt: new Date(),
        votes: []
      };

      setProposals([...proposals, newProposal]);
      setUserProposals([...userProposals, newProposal.id]);
      setLoading(false);
      return newProposal;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [proposals, userProposals, userAddress]);

  // Submit vote
  const submitVote = useCallback((proposalId, optionIndex, encryptedVote, zkProof, nullifier) => {
    setLoading(true);
    setError(null);

    try {
      // Check if nullifier already used
      if (usedNullifiers.has(nullifier)) {
        throw new Error('This vote has already been cast');
      }

      // Find and update proposal
      const updatedProposals = proposals.map(p => {
        if (p.id === proposalId) {
          const option = p.options[optionIndex];
          return {
            ...p,
            voteCount: p.voteCount + 1,
            totalParticipation: p.totalParticipation + 1,
            voteWeight: {
              ...p.voteWeight,
              [option]: (p.voteWeight[option] || 0) + 1
            },
            votes: [...(p.votes || []), { encryptedVote, zkProof, nullifier, optionIndex }]
          };
        }
        return p;
      });

      setProposals(updatedProposals);
      setUsedNullifiers(new Set([...usedNullifiers, nullifier]));
      
      // Mark as voted
      if (!userVotes.includes(proposalId)) {
        setUserVotes([...userVotes, proposalId]);
      }

      setLoading(false);
      return { success: true, nullifier };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [proposals, userVotes, usedNullifiers]);

  // Submit partial decryption
  const submitPartialDecryption = useCallback((proposalId, partialDecryption, proof) => {
    setLoading(true);
    setError(null);

    try {
      const updatedProposals = proposals.map(p => {
        if (p.id === proposalId) {
          return {
            ...p,
            partialDecryptions: [...(p.partialDecryptions || []), { partialDecryption, proof }]
          };
        }
        return p;
      });

      setProposals(updatedProposals);
      setLoading(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [proposals]);

  // Check user eligibility
  const checkEligibility = useCallback((proposalId) => {
    if (!userAddress) return false;
    // Mock eligibility check - in real app would check token balance
    return Math.random() > 0.3; // 70% eligible
  }, [userAddress]);

  // Simulate connecting wallet
  const connectWallet = useCallback((address) => {
    setUserAddress(address);
    setIsKeyholder(Math.random() > 0.8); // 20% chance of being keyholder
  }, []);

  // Get nullifier status
  const getNullifierStatus = useCallback(() => {
    return {
      usedCount: usedNullifiers.size,
      availableCount: 100 - usedNullifiers.size,
      totalAllocation: 100
    };
  }, [usedNullifiers]);

  const value = {
    // User state
    userAddress,
    isKeyholder,
    userEligibility,
    userVotes,
    userProposals,
    connectWallet,

    // Proposals
    proposals,
    proposalDetail,
    loading,
    error,

    // Proposal methods
    initializeProposals,
    getProposalDetail,
    getActiveProposals,
    getArchivedProposals,
    getEndedProposals,
    createProposal,

    // Voting
    submitVote,
    submitPartialDecryption,
    checkEligibility,

    // Nullifiers
    usedNullifiers,
    getNullifierStatus
  };

  return (
    <VotingContext.Provider value={value}>
      {children}
    </VotingContext.Provider>
  );
};

export const useVoting = () => {
  const context = React.useContext(VotingContext);
  if (!context) {
    throw new Error('useVoting must be used within VotingProvider');
  }
  return context;
};
