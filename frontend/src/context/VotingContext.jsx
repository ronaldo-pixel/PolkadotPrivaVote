import React, { createContext, useState, useCallback, useRef, useEffect } from 'react';
import { ethers } from 'ethers';

export const VotingContext = createContext();

// ── ABI ───────────────────────────────────────────────────────────────────────

const CONTRACT_ABI = [
  'function proposalCount() external view returns (uint256)',
  'function keyholders(uint256) external view returns (address)',
  'function hasVoted(uint256 proposalId, address voter) external view returns (bool)',
  'function verifierContract() external view returns (address)',

  'function proposals(uint256) external view returns (' +
    'uint256 id,' +
    'address creator,' +
    'string description,' +
    'uint8 votingMode,' +
    'uint256 createdAtBlock,' +
    'uint256 duration,' +
    'uint256 startBlock,' +
    'uint256 endBlock,' +
    'uint256 eligibilityThreshold,' +
    'uint256 minVoterThreshold,' +
    'uint8 status,' +
    'uint256 voteCount,' +
    'uint256 partialCount,' +
    'uint256 winningOption,' +
    'uint256 endedAtBlock' +
  ')',

  'function getElectionPublicKey(uint256 proposalId) external view returns (uint256 x, uint256 y, uint8 status, uint256 sharesIn)',
  'function getPublicKeyShare(uint256 proposalId, uint256 keyholderIndex) external view returns (uint256 x, uint256 y, bool submitted)',
  'function getDKGStatus(uint256 proposalId) external view returns (address[3] addresses, bool[3] submitted)',
  'function getResult(uint256 proposalId) external view returns (uint256[10] tally, uint256 winningOption, uint8 status)',
  'function getEncryptedTally(uint256 proposalId, uint256 optionIndex) external view returns (uint256[2] c1, uint256[2] c2)',

  'function createProposal(string description, string[] options, uint8 votingMode, uint256 duration, uint256 eligibilityThreshold, uint256 minVoterThreshold) external returns (uint256 proposalId)',
  'function submitPublicKeyShare(uint256 proposalId, uint256 shareX, uint256 shareY) external',
  'function castVote(uint256 proposalId, uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256[44] pubSignals, uint256[2][2][10] encVote) external',
  'function closeVoting(uint256 proposalId) external',
  'function submitPartialDecrypt(uint256 proposalId, uint256[2][10] partials) external',
  'function finalizeResult(uint256 proposalId, uint256 maxTally) external',

  'event ProposalCreated(uint256 indexed proposalId)',
  'event PublicKeyShareSubmitted(uint256 indexed proposalId, address indexed keyholder, uint256 keyholderIndex, uint256 shareX, uint256 shareY)',
  'event ElectionKeyComputed(uint256 indexed proposalId, uint256 keyX, uint256 keyY)',
  'event VotingStarted(uint256 indexed proposalId, uint256 startBlock, uint256 endBlock)',
  'event VoteCast(uint256 indexed proposalId, address indexed voter, uint256 voteCount)',
  'event VotingEnded(uint256 indexed proposalId, uint256 totalVotes)',
  'event PartialDecryptionSubmitted(uint256 indexed proposalId, address indexed keyholder, uint256 keyholderIndex)',
  'event ResultRevealed(uint256 indexed proposalId, uint256 winningOption)',
];

// ── Polkadot Asset Hub EVM chain config ───────────────────────────────────────

const POLKADOT_TESTNET = {
  chainId: '0x190F7B1', // 420420417 in hex
  chainName: 'Polkadot Asset Hub Testnet',
  nativeCurrency: {
    name: 'PAS',
    symbol: 'PAS',
    decimals: 18,
  },
  rpcUrls: ['https://eth-rpc-testnet.polkadot.io/'],
  blockExplorerUrls: ['https://assethub-westend.subscan.io'],
};

const REQUIRED_CHAIN_ID = 420420417;

const STATUS_MAP = { 0: 'PENDING_DKG', 1: 'ACTIVE', 2: 'ENDED', 3: 'REVEALED', 4: 'CANCELLED' };
const MODE_MAP   = { 0: 'normal', 1: 'quadratic' };

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

// ── Talisman wallet detection ─────────────────────────────────────────────────

/**
 * Waits for a wallet provider to be injected.
 * Talisman injects window.ethereum asynchronously — if we check too early
 * it may not be present yet. This waits up to 1000ms before giving up.
 *
 * Priority order:
 *   1. window.talisman  — Talisman's own provider (preferred, avoids MetaMask conflicts)
 *   2. window.ethereum with isTalisman flag
 *   3. window.ethereum  — fallback (MetaMask or any EIP-1193 wallet)
 */
function getWalletProvider() {
  if (typeof window === 'undefined') return null;

  // Talisman exposes its EVM provider at window.talisman.ethereum
  if (window.talisman?.ethereum) return window.talisman.ethereum;

  // Some Talisman versions inject isTalisman on window.ethereum
  if (window.ethereum?.isTalisman) return window.ethereum;

  // EIP-6963: multiple wallet providers — find Talisman if present
  if (window.ethereum?.providers) {
    const talisman = window.ethereum.providers.find(p => p.isTalisman);
    if (talisman) return talisman;
  }

  // Generic fallback
  if (window.ethereum) return window.ethereum;

  return null;
}

/**
 * Waits for the wallet to be injected (up to `timeoutMs`).
 * Talisman fires the eip6963:announceProvider event, but the simplest
 * cross-wallet approach is polling with a short timeout.
 */
async function waitForProvider(timeoutMs = 1000) {
  const provider = getWalletProvider();
  if (provider) return provider;

  return new Promise((resolve) => {
    const start    = Date.now();
    const interval = setInterval(() => {
      const p = getWalletProvider();
      if (p || Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        resolve(p ?? null);
      }
    }, 100);
  });
}

// ── Chain switching ───────────────────────────────────────────────────────────

/**
 * Asks Talisman (or MetaMask) to switch to the Polkadot Asset Hub testnet.
 * If the network is not yet added to the wallet, adds it first via wallet_addEthereumChain.
 */
async function ensureCorrectChain(provider) {
  const chainIdHex    = await provider.request({ method: 'eth_chainId' });
  const currentChainId = parseInt(chainIdHex, 16);

  if (currentChainId === REQUIRED_CHAIN_ID) return; // already on correct chain

  // Try to switch first. If the network is not yet in Talisman, this will fail
  // with 4902 (MetaMask standard) or -32603 / a message about unknown chain.
  // In all failure cases, attempt wallet_addEthereumChain to register the network.
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLKADOT_TESTNET.chainId }],
    });
  } catch (switchErr) {
    const code    = switchErr.code;
    const message = switchErr.message ?? '';
    const isUnknownChain =
      code === 4902 ||
      code === -32603 ||
      message.includes('Unrecognized chain') ||
      message.includes('wallet_addEthereumChain') ||
      message.includes('chain') ||
      message.includes('network');

    if (isUnknownChain) {
      // Add the network to Talisman, then switch to it
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [POLKADOT_TESTNET],
      });
    } else {
      // User rejected the switch — propagate
      throw switchErr;
    }
  }
}

// ── Proposal decoder ──────────────────────────────────────────────────────────

async function decodeProposal(contract, provider, proposalId) {
  const raw = await contract.proposals(proposalId);

  let options = [];
  try {
    const filter = contract.filters.ProposalCreated(proposalId);
    const logs   = await contract.queryFilter(filter, 0, 'latest');
    if (logs.length > 0) {
      const tx      = await provider.getTransaction(logs[0].transactionHash);
      const decoded = contract.interface.decodeFunctionData('createProposal', tx.data);
      options = Array.from(decoded.options);
    }
  } catch {
    options = [];
  }

  let finalResult = null;
  let winner      = null;
  if (Number(raw.status) === 3) {
    try {
      const res   = await contract.getResult(proposalId);
      finalResult = Array.from(res.tally).map(t => Number(t));
      winner      = options[Number(res.winningOption)] ?? null;
    } catch {
      finalResult = null;
    }
  }

  return {
    id:                   proposalId.toString(),
    creator:              raw.creator,
    description:          raw.description,
    options,
    votingMode:           MODE_MAP[Number(raw.votingMode)] ?? 'normal',
    createdAtBlock:       Number(raw.createdAtBlock),
    duration:             Number(raw.duration),
    startBlock:           Number(raw.startBlock),
    endBlock:             Number(raw.endBlock),
    eligibilityThreshold: Number(raw.eligibilityThreshold),
    minVoterThreshold:    Number(raw.minVoterThreshold),
    status:               STATUS_MAP[Number(raw.status)] ?? 'PENDING_DKG',
    voteCount:            Number(raw.voteCount),
    totalParticipation:   Number(raw.voteCount),
    partialCount:         Number(raw.partialCount),
    winningOption:        Number(raw.winningOption),
    endedAtBlock:         Number(raw.endedAtBlock),
    finalResult,
    winner,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const VotingProvider = ({ children }) => {
  const [userAddress,    setUserAddress]    = useState(null);
  const [isKeyholder,    setIsKeyholder]    = useState(false);
  const [keyholderIndex, setKeyholderIndex] = useState(null);
  const [userVotes,      setUserVotes]      = useState([]);
  const [userProposals,  setUserProposals]  = useState([]);
  const [proposals,      setProposals]      = useState([]);
  const [proposalDetail, setProposalDetail] = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [walletType,     setWalletType]     = useState(null); // 'talisman' | 'metamask' | 'unknown'
  const [chainId,        setChainId]        = useState(null);
  const [usedNullifiers, setUsedNullifiers] = useState(new Set());

  const contractRef    = useRef(null);
  const providerRef    = useRef(null); // ethers BrowserProvider
  const rawProviderRef = useRef(null); // raw EIP-1193 provider (window.talisman.ethereum etc)

  // ── Detect wallet type ─────────────────────────────────────────────────────

  function detectWalletType(rawProvider) {
    if (!rawProvider) return 'unknown';
    if (rawProvider.isTalisman)  return 'talisman';
    if (rawProvider.isMetaMask)  return 'metamask';
    return 'unknown';
  }

  // ── Resolve keyholder status ───────────────────────────────────────────────

  const resolveKeyholder = useCallback(async (address, contract) => {
    if (!CONTRACT_ADDRESS || !address) return;
    try {
      const kh  = await Promise.all([
        contract.keyholders(0),
        contract.keyholders(1),
        contract.keyholders(2),
      ]);
      const idx = kh.findIndex(k => k.toLowerCase() === address.toLowerCase());
      setIsKeyholder(idx !== -1);
      setKeyholderIndex(idx !== -1 ? idx : null);
    } catch {
      setIsKeyholder(false);
      setKeyholderIndex(null);
    }
  }, []);

  // ── Build ethers provider + contract from a raw EIP-1193 provider ──────────

  const buildContractFromProvider = useCallback((rawProvider, signerOrProvider) => {
    if (!CONTRACT_ADDRESS) return null;
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
  }, []);

  const getReadContract = useCallback(() => {
    if (contractRef.current) return contractRef.current;
    const raw = rawProviderRef.current;
    if (!raw || !CONTRACT_ADDRESS) return null;
    const provider = new ethers.BrowserProvider(raw);
    providerRef.current = provider;
    const c = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    contractRef.current = c;
    return c;
  }, []);

  const getWriteContract = useCallback(async () => {
    const raw = rawProviderRef.current;
    if (!raw || !CONTRACT_ADDRESS) throw new Error('Wallet not connected or contract address missing');
    const provider = new ethers.BrowserProvider(raw);
    const signer   = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  }, []);

  // ── Listen for Talisman / wallet events ───────────────────────────────────

  useEffect(() => {
    let rawProvider = null;

    const setupListeners = (provider) => {
      rawProvider = provider;

      const onAccountsChanged = (accounts) => {
        if (!accounts || accounts.length === 0) {
          setUserAddress(null);
          setIsKeyholder(false);
          setKeyholderIndex(null);
          contractRef.current    = null;
          providerRef.current    = null;
          rawProviderRef.current = null;
        } else {
          const address = accounts[0];
          setUserAddress(address);
          const ethersProvider = new ethers.BrowserProvider(provider);
          providerRef.current  = ethersProvider;
          const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethersProvider);
          contractRef.current  = contract;
          resolveKeyholder(address, contract);
        }
      };

      const onChainChanged = (newChainId) => {
        const parsed = parseInt(newChainId, 16);
        setChainId(parsed);
        // Chain switch invalidates all provider state — reload
        window.location.reload();
      };

      provider.on('accountsChanged', onAccountsChanged);
      provider.on('chainChanged',    onChainChanged);

      // Check if already connected (no popup)
      provider.request({ method: 'eth_accounts' }).then((accounts) => {
        if (accounts && accounts.length > 0) {
          const address = accounts[0];
          setUserAddress(address);
          const ethersProvider = new ethers.BrowserProvider(provider);
          providerRef.current  = ethersProvider;
          rawProviderRef.current = provider;
          const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethersProvider);
          contractRef.current  = contract;
          resolveKeyholder(address, contract);
          setWalletType(detectWalletType(provider));
        }
      }).catch(() => {});

      // Read current chain
      provider.request({ method: 'eth_chainId' }).then(hex => {
        setChainId(parseInt(hex, 16));
      }).catch(() => {});

      return () => {
        provider.removeListener('accountsChanged', onAccountsChanged);
        provider.removeListener('chainChanged',    onChainChanged);
      };
    };

    // Wait for provider to be injected (Talisman may inject after DOMContentLoaded)
    waitForProvider(1500).then((provider) => {
      if (provider) setupListeners(provider);
    });
  }, [resolveKeyholder]);

  // ── connectWallet ─────────────────────────────────────────────────────────

  const connectWallet = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Wait for provider — important on first load when Talisman may not be injected yet
      const rawProvider = await waitForProvider(2000);

      if (!rawProvider) {
        throw new Error(
          'No wallet found. Install Talisman from https://talisman.xyz and reload the page.'
        );
      }

      rawProviderRef.current = rawProvider;
      const type = detectWalletType(rawProvider);
      setWalletType(type);

      // Step 1: request accounts FIRST.
      // Talisman rejects wallet_switchEthereumChain before an account is approved —
      // it returns Internal JSON-RPC error (-32603) if you switch chain before connect.
      const accounts = await rawProvider.request({ method: 'eth_requestAccounts' });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from wallet');
      }

      // Step 2: switch to / add Polkadot Asset Hub AFTER account is approved.
      // Talisman now has an active session and accepts wallet_switchEthereumChain.
      await ensureCorrectChain(rawProvider);

      const address      = accounts[0];
      const ethersProvider = new ethers.BrowserProvider(rawProvider);
      providerRef.current  = ethersProvider;

      setUserAddress(address);

      if (CONTRACT_ADDRESS) {
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethersProvider);
        contractRef.current = contract;
        await resolveKeyholder(address, contract);
      }

      const chainHex = await rawProvider.request({ method: 'eth_chainId' });
      setChainId(parseInt(chainHex, 16));

      setLoading(false);
      return address;
    } catch (err) {
      // 4001 = user rejected
      const message = err.code === 4001
        ? 'Connection rejected — please approve in your wallet'
        : (err.message ?? 'Wallet connection failed');
      setError(message);
      setLoading(false);
      throw new Error(message);
    }
  }, [resolveKeyholder]);

  // ── disconnectWallet ──────────────────────────────────────────────────────

  const disconnectWallet = useCallback(() => {
    setUserAddress(null);
    setIsKeyholder(false);
    setKeyholderIndex(null);
    setUserVotes([]);
    setUserProposals([]);
    setWalletType(null);
    setChainId(null);
    contractRef.current    = null;
    providerRef.current    = null;
    rawProviderRef.current = null;
  }, []);

  // ── initializeProposals ───────────────────────────────────────────────────

  const initializeProposals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const contract = getReadContract();
      if (!contract) { setLoading(false); return; }

      const count = Number(await contract.proposalCount());
      if (count === 0) { setProposals([]); setLoading(false); return; }

      const provider = providerRef.current;
      const fetched  = await Promise.allSettled(
        Array.from({ length: count }, (_, i) => decodeProposal(contract, provider, i))
      );
      const valid = fetched
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);

      setProposals(valid);

      if (userAddress) {
        const votedFlags = await Promise.allSettled(
          valid.map(p => contract.hasVoted(p.id, userAddress))
        );
        const voted = valid
          .filter((_, i) => votedFlags[i].status === 'fulfilled' && votedFlags[i].value)
          .map(p => p.id);
        setUserVotes(voted);
      }

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [getReadContract, userAddress]);

  // ── getProposalDetail ─────────────────────────────────────────────────────

  const getProposalDetail = useCallback(async (proposalId) => {
    setLoading(true);
    setError(null);
    try {
      const contract = getReadContract();
      if (!contract) throw new Error('Contract not available — connect wallet first');
      const provider = providerRef.current;
      const detail   = await decodeProposal(contract, provider, Number(proposalId));

      const dkg = await contract.getDKGStatus(proposalId).catch(() => null);
      if (dkg) {
        detail.dkgAddresses = Array.from(dkg.addresses);
        detail.dkgSubmitted = Array.from(dkg.submitted);
      }

      const epk = await contract.getElectionPublicKey(proposalId).catch(() => null);
      if (epk) {
        detail.electionPublicKey = { x: epk.x.toString(), y: epk.y.toString() };
        detail.dkgSharesIn = Number(epk.sharesIn);
      }

      setProposalDetail(detail);
      setLoading(false);
      return detail;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return null;
    }
  }, [getReadContract]);

  const getActiveProposals   = useCallback(() => proposals.filter(p => p.status === 'PENDING_DKG' || p.status === 'ACTIVE'),  [proposals]);
  const getArchivedProposals = useCallback(() => proposals.filter(p => p.status === 'REVEALED'    || p.status === 'CANCELLED'), [proposals]);
  const getEndedProposals    = useCallback(() => proposals.filter(p => p.status === 'ENDED'),                                    [proposals]);

  // ── createProposal ────────────────────────────────────────────────────────

  const createProposal = useCallback(async ({
    description, options, votingMode, duration,
    eligibilityThreshold, minVoterThreshold,
  }) => {
    setLoading(true);
    setError(null);
    try {
      const contract = await getWriteContract();
      const modeEnum = votingMode === 'quadratic' ? 1 : 0;
      const tx       = await contract.createProposal(
        description, options, modeEnum, duration,
        eligibilityThreshold, minVoterThreshold,
      );
      const receipt  = await tx.wait();

      const createdLog = receipt.logs
        .map(l => { try { return contract.interface.parseLog(l); } catch { return null; } })
        .find(l => l?.name === 'ProposalCreated');

      const newId    = createdLog ? Number(createdLog.args.proposalId) : null;
      const provider = providerRef.current;

      let newProposal = null;
      if (newId !== null) {
        newProposal = await decodeProposal(contract, provider, newId);
        setProposals(prev => {
          const exists = prev.find(p => p.id === newProposal.id);
          return exists
            ? prev.map(p => p.id === newProposal.id ? newProposal : p)
            : [...prev, newProposal];
        });
        setUserProposals(prev => prev.includes(newProposal.id) ? prev : [...prev, newProposal.id]);
      }

      setLoading(false);
      return newProposal ?? { id: newId?.toString() };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [getWriteContract]);

  // ── submitPublicKeyShare ──────────────────────────────────────────────────

  const submitPublicKeyShare = useCallback(async (proposalId, shareX, shareY) => {
    setLoading(true);
    setError(null);
    try {
      const contract = await getWriteContract();
      const tx = await contract.submitPublicKeyShare(proposalId, shareX, shareY);
      await tx.wait();
      await getProposalDetail(proposalId);
      setLoading(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [getWriteContract, getProposalDetail]);

  // ── submitVote ────────────────────────────────────────────────────────────

  const submitVote = useCallback(async (proposalId, pA, pB, pC, pubSignals, encVote, nullifier) => {
    setLoading(true);
    setError(null);
    try {
      if (usedNullifiers.has(nullifier)) throw new Error('Nullifier already used — vote already cast');
      const contract = await getWriteContract();
      const tx = await contract.castVote(proposalId, pA, pB, pC, pubSignals, encVote);
      await tx.wait();

      const pid = proposalId.toString();
      setUsedNullifiers(prev => new Set([...prev, nullifier]));
      setUserVotes(prev => prev.includes(pid) ? prev : [...prev, pid]);
      setProposals(prev => prev.map(p =>
        p.id === pid
          ? { ...p, voteCount: p.voteCount + 1, totalParticipation: p.totalParticipation + 1 }
          : p
      ));

      setLoading(false);
      return { success: true, nullifier };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [getWriteContract, usedNullifiers]);

  // ── closeVoting ───────────────────────────────────────────────────────────

  const closeVoting = useCallback(async (proposalId) => {
    setLoading(true);
    setError(null);
    try {
      const contract = await getWriteContract();
      const tx = await contract.closeVoting(proposalId);
      await tx.wait();
      await initializeProposals();
      setLoading(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [getWriteContract, initializeProposals]);

  // ── submitPartialDecryption ───────────────────────────────────────────────

  const submitPartialDecryption = useCallback(async (proposalId, partials) => {
    setLoading(true);
    setError(null);
    try {
      const contract = await getWriteContract();
      const tx = await contract.submitPartialDecrypt(proposalId, partials);
      await tx.wait();
      await getProposalDetail(proposalId);
      setLoading(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [getWriteContract, getProposalDetail]);

  // ── finalizeResult ────────────────────────────────────────────────────────

  const finalizeResult = useCallback(async (proposalId, maxTally) => {
    setLoading(true);
    setError(null);
    try {
      const contract = await getWriteContract();
      const tx = await contract.finalizeResult(proposalId, maxTally);
      await tx.wait();
      await initializeProposals();
      setLoading(false);
      return { success: true };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [getWriteContract, initializeProposals]);

  // ── checkEligibility ─────────────────────────────────────────────────────

  const checkEligibility = useCallback(async (proposalId) => {
    if (!userAddress) return false;
    try {
      const contract = getReadContract();
      if (!contract) return false;
      const raw = await contract.proposals(proposalId);
      console.log("Balance:", ethers.formatEther(balance));
      if (Number(raw.eligibilityThreshold) === 0) return true;
      const balance = await providerRef.current.getBalance(userAddress);
      console.log("Balance:", ethers.formatEther(balance));
      return balance >= raw.eligibilityThreshold;
    } catch {
      return false;
    }
  }, [userAddress, getReadContract]);

  // ── getDKGStatus ──────────────────────────────────────────────────────────

  const getDKGStatus = useCallback(async (proposalId) => {
    try {
      const contract = getReadContract();
      if (!contract) return null;
      const res = await contract.getDKGStatus(proposalId);
      return { addresses: Array.from(res.addresses), submitted: Array.from(res.submitted) };
    } catch {
      return null;
    }
  }, [getReadContract]);

  // ── getEncryptedTally ─────────────────────────────────────────────────────

  const getEncryptedTally = useCallback(async (proposalId, optionIndex) => {
    try {
      const contract = getReadContract();
      if (!contract) return null;
      const res = await contract.getEncryptedTally(proposalId, optionIndex);
      return { c1: res.c1, c2: res.c2 };
    } catch {
      return null;
    }
  }, [getReadContract]);

  // ── getNullifierStatus ────────────────────────────────────────────────────

  const getNullifierStatus = useCallback(() => ({
    usedCount:       usedNullifiers.size,
    availableCount:  100 - usedNullifiers.size,
    totalAllocation: 100,
  }), [usedNullifiers]);

  // ── isOnCorrectChain helper ───────────────────────────────────────────────

  const isOnCorrectChain = chainId === REQUIRED_CHAIN_ID;

  // ── Context value ─────────────────────────────────────────────────────────

  const value = {
    // Wallet state
    userAddress,
    isKeyholder,
    keyholderIndex,
    walletType,       // 'talisman' | 'metamask' | 'unknown' | null
    chainId,
    isOnCorrectChain, // true if connected to Polkadot Asset Hub testnet

    // Voting state
    userVotes,
    userProposals,
    proposals,
    proposalDetail,
    loading,
    error,

    // Wallet actions
    connectWallet,
    disconnectWallet,

    // Proposal queries
    initializeProposals,
    getProposalDetail,
    getActiveProposals,
    getArchivedProposals,
    getEndedProposals,

    // Contract writes
    createProposal,
    submitPublicKeyShare,
    submitVote,
    closeVoting,
    submitPartialDecryption,
    finalizeResult,

    // Helpers
    checkEligibility,
    getDKGStatus,
    getEncryptedTally,
    getNullifierStatus,

    usedNullifiers,
    CONTRACT_ADDRESS,
  };

  return <VotingContext.Provider value={value}>{children}</VotingContext.Provider>;
};

export const useVoting = () => {
  const context = React.useContext(VotingContext);
  if (!context) throw new Error('useVoting must be used within VotingProvider');
  return context;
};