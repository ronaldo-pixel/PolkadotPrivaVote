# Smart Contract Integration Guide

## Overview

The frontend currently uses **mocked** smart contract interactions. This guide explains how to integrate real smart contract calls.

---

## File to Modify

**`src/utils/contractUtils.js`** - Contains all mock contract interactions

Currently organized into:
- `contractMethods` - Smart contract function calls
- `zkProofGenerator` - Zero-knowledge proof generation
- `encryptionUtils` - Vote encryption/decryption
- `nullifierUtils` - Nullifier management
- `voteWeightCalculator` - Vote weight calculations
- `proposalStatusUtils` - Proposal status helpers
- `formatUtils` - Formatting utilities

---

## Integration Steps

### Step 1: Set Up Contract ABIs

```javascript
// src/utils/contracts/VotingContract.json
// Copy your smart contract ABI here
export const VOTING_ABI = [
  {
    "type": "function",
    "name": "createProposal",
    "inputs": [...],
    "outputs": [...]
  },
  // ... more functions
];

export const VERIFIER_ABI = [
  // Verifier contract ABI
];
```

### Step 2: Initialize Ethers Provider

```javascript
// src/utils/web3.js
import { ethers } from 'ethers';

export const getProvider = () => {
  return new ethers.BrowserProvider(window.ethereum);
};

export const getSigner = async () => {
  const provider = getProvider();
  return provider.getSigner();
};

export const getContract = async (contractAddress, abi) => {
  const signer = await getSigner();
  return new ethers.Contract(contractAddress, abi, signer);
};
```

### Step 3: Replace Mock Functions

Replace mock, update to use real contracts:

```javascript
// OLD (Mock)
export const contractMethods = {
  async createProposal(proposalData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          proposalId: `PROP-${Date.now()}`,
          transactionHash: `0x${Math.random().toString(16).slice(2)}`
        });
      }, 1000);
    });
  }
};

// NEW (Real)
import { getContract } from './web3';
import { VOTING_ABI } from './contracts/VotingContract.json';

export const contractMethods = {
  async createProposal(proposalData) {
    try {
      const contract = await getContract(
        process.env.VITE_CONTRACT_ADDRESS,
        VOTING_ABI
      );
      
      const tx = await contract.createProposal(
        proposalData.description,
        proposalData.options,
        proposalData.votingMode === 'quadratic' ? 1 : 0,
        proposalData.startBlock,
        proposalData.endBlock,
        proposalData.eligibilityThreshold,
        proposalData.minVoterThreshold
      );
      
      const receipt = await tx.wait();
      
      // Extract proposal ID from event logs
      const event = receipt.events?.find(e => e.event === 'ProposalCreated');
      const proposalId = event?.args?.proposalId;
      
      return {
        success: true,
        proposalId: proposalId.toString(),
        transactionHash: receipt.transactionHash
      };
    } catch (error) {
      console.error('Proposal creation failed:', error);
      throw error;
    }
  },
  
  async getProposal(proposalId) {
    const contract = await getContract(
      process.env.VITE_CONTRACT_ADDRESS,
      VOTING_ABI
    );
    
    const proposal = await contract.proposals(proposalId);
    
    return {
      id: proposalId,
      description: proposal.description,
      status: proposal.status,
      voteCount: proposal.voteCount.toString(),
      // ... map other fields
    };
  }
  
  // ... implement other methods similarly
};
```

---

## Key Integration Points

### 1. Proposal Creation
```javascript
// In src/pages/ProposalCreate.jsx
const newProposal = await createProposal(proposalData);

// This calls VotingContext's createProposal
// Which calls contractMethods.createProposal()
```

**Contract Function Expected:**
```solidity
function createProposal(
  string calldata description,
  string[] calldata options,
  uint8 votingMode, // 0=normal, 1=quadratic
  uint256 startBlock,
  uint256 endBlock,
  uint256 eligibilityThreshold,
  uint256 minVoterThreshold
) external returns (uint256 proposalId)
```

### 2. Vote Submission
```javascript
// In src/components/VoteForm.jsx
await submitVote(
  proposalId,
  optionIndex,
  encryptedVote,
  zkProof,
  nullifier
);

// Contract should:
// 1. Verify ZK proof
// 2. Check nullifier hasn't been used
// 3. Store encrypted vote
// 4. Record nullifier to prevent replay
```

**Contract Function Expected:**
```solidity
function submitEncryptedVote(
  uint256 proposalId,
  bytes memory encryptedVote,
  bytes memory zkProof,
  bytes32 nullifier
) external
```

### 3. Partial Decryption
```javascript
// In src/pages/DecryptionProgress.jsx
await submitPartialDecryption(
  proposalId,
  partialDecryption,
  proof
);

// Contract should:
// 1. Verify ZK proof
// 2. Store partial decryption
// 3. Check if all keyholders have submitted
// 4. Trigger vote decryption if all ready
```

**Contract Function Expected:**
```solidity
function submitPartialDecryption(
  uint256 proposalId,
  bytes memory partialDecryption,
  bytes memory proof
) external onlyKeyholder
```

---

## Environment Variables

Update `.env` file:

```env
# Smart Contract Addresses
VITE_CONTRACT_ADDRESS=0x...
VITE_VERIFIER_ADDRESS=0x...

# Network
VITE_CHAIN_ID=137
VITE_RPC_URL=https://polygon-rpc.com

# Feature Flags
VITE_USE_REAL_CONTRACTS=true
VITE_ENABLE_MOCK_DATA=false
```

---

## Feature Flag Pattern

Implement feature flags to test both mock and real:

```javascript
// src/utils/contractUtils.js
const USE_REAL = process.env.VITE_USE_REAL_CONTRACTS === 'true';

export const contractMethods = {
  async createProposal(proposalData) {
    if (USE_REAL) {
      return createProposalReal(proposalData);
    } else {
      return createProposalMock(proposalData);
    }
  }
};
```

---

## Testing Integration

### Unit Tests

```javascript
// tests/utils/contractUtils.test.js
import { contractMethods } from '../../src/utils/contractUtils';

describe('contractMethods', () => {
  it('creates proposal with correct parameters', async () => {
    const proposalData = {
      description: 'Test proposal',
      options: ['Yes', 'No'],
      votingMode: 'normal',
      startBlock: 100,
      endBlock: 200,
      eligibilityThreshold: 1000,
      minVoterThreshold: 10
    };
    
    const result = await contractMethods.createProposal(proposalData);
    
    expect(result.success).toBe(true);
    expect(result.proposalId).toBeDefined();
  });
});
```

### Integration Tests

```javascript
// tests/integration/voting.test.js
describe('Voting Flow', () => {
  it('creates proposal and submits vote', async () => {
    // 1. Create proposal
    const proposal = await createProposal({...});
    
    // 2. Vote on proposal
    const vote = await submitVote(proposal.id, 0, {...});
    
    // 3. Verify vote was recorded
    const result = await getProposal(proposal.id);
    expect(result.voteCount).toBe(1);
  });
});
```

---

## Wallet Integration

### Polkadot Extension

```javascript
// src/utils/wallet.js
import { web3Enable, web3Accounts } from '@polkadot/extension-dapp';

export const connectWallet = async () => {
  const extensions = await web3Enable('PolkadotPrivaVote');
  
  if (!extensions.length) {
    throw new Error('No Polkadot extension found');
  }
  
  const allAccounts = await web3Accounts();
  return allAccounts;
};
```

### Ethers.js with MetaMask

```javascript
// Already partially set up for Ethereum
const accounts = await window.ethereum.request({
  method: 'eth_requestAccounts'
});

const signer = new ethers.BrowserProvider(window.ethereum).getSigner();
```

---

## Error Handling

```javascript
export const contractMethods = {
  async createProposal(proposalData) {
    try {
      // Contract call
    } catch (error) {
      if (error.code === 'ACTION_REJECTED') {
        throw new Error('Transaction rejected by user');
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error('Insufficient balance for transaction');
      } else if (error.message.includes('requirement')) {
        throw new Error('You don\'t meet eligibility requirements');
      }
      throw error;
    }
  }
};
```

---

## Gas Optimization

```javascript
// src/utils/gas.js
export const estimateAndOptimize = async (contract, method, args) => {
  try {
    const gasEstimate = await contract[method].estimateGas(...args);
    const gasPrice = await contract.provider.getGasPrice();
    
    // Add 20% buffer
    const estimatedGas = gasEstimate.mul(120).div(100);
    
    return {
      gas: estimatedGas,
      gasPrice: gasPrice,
      maxFeePerGas: gasPrice.mul(120).div(100),
      maxPriorityFeePerGas: gasPrice.mul(110).div(100)
    };
  } catch (error) {
    console.error('Gas estimation failed:', error);
    return null;
  }
};
```

---

## State Sync with Blockchain

```javascript
// VotingContext.jsx
useEffect(() => {
  const pollProposals = async () => {
    for (const proposalId of userProposals) {
      const onChainProposal = await getProposal(proposalId);
      
      // Update local state if different
      setProposals(prev => 
        prev.map(p => 
          p.id === proposalId 
            ? { ...p, status: onChainProposal.status, ... }
            : p
        )
      );
    }
  };
  
  const interval = setInterval(pollProposals, 15000); // Poll every 15s
  
  return () => clearInterval(interval);
}, [userProposals]);
```

---

## Transaction Monitoring

```javascript
// src/utils/transaction.js
export const monitorTransaction = async (transactionHash, provider) => {
  let receipt = null;
  let attempt = 0;
  const maxAttempts = 12; // 1 minute with 5s timeout
  
  while (!receipt && attempt < maxAttempts) {
    receipt = await provider.getTransactionReceipt(transactionHash);
    
    if (!receipt) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempt++;
    }
  }
  
  return receipt;
};
```

---

## Security Considerations

### Signature Verification
```javascript
// Verify votes are signed by eligible voters
export const verifyVoteSignature = async (vote, signature, signer) => {
  const messageHash = ethers.id(JSON.stringify(vote));
  const recoveredAddress = ethers.recoverAddress(messageHash, signature);
  
  return recoveredAddress.toLowerCase() === signer.toLowerCase();
};
```

### Nonce Management
```javascript
// Prevent replay attacks
export const getNextNonce = async (signer) => {
  const provider = signer.provider;
  const address = await signer.getAddress();
  return provider.getTransactionCount(address);
};
```

---

## Rollback Plan

Keep mock functions available for fallback:

```javascript
const USE_REAL = process.env.VITE_USE_REAL_CONTRACTS === 'true';

export const createProposal = async (data) => {
  try {
    if (USE_REAL) {
      return await createProposalReal(data);
    }
  } catch (error) {
    console.warn('Real contract call failed, falling back to mock');
    return createProposalMock(data);
  }
};
```

---

## Deployment Checklist

- [ ] Smart contracts deployed to testnet
- [ ] Contract ABIs added to `src/utils/contracts/`
- [ ] Contract addresses in `.env`
- [ ] Wallet connection tested (MetaMask/Polkadot)
- [ ] Mock functions replaced with real calls
- [ ] Transaction monitoring implemented
- [ ] Error handling comprehensive
- [ ] Gas optimization in place
- [ ] State sync with blockchain
- [ ] Security measures verified
- [ ] Testnet testing complete
- [ ] Ready for mainnet deployment

---

## Support

For integration issues:
1. Check contract ABI matches implementation
2. Verify contract addresses in `.env`
3. Test with testnet first
4. Check browser console for detailed errors
5. Verify wallet is connected to correct network

---

## Additional Resources

- [Ethers.js Documentation](https://docs.ethers.org)
- [Polkadot.js Documentation](https://polkadot.js.org/)
- [Smart Contract Security Best Practices](https://ethereum.org/en/developers/docs/smart-contracts/security/)
- [ZK Proof Verification Guide](https://zkrepl.dev/)
