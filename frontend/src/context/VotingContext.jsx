import React, { createContext, useState, useCallback, useRef, useEffect } from 'react';
import { ethers } from 'ethers';

export const VotingContext = createContext();

const CONTRACT_ABI = [
  'function proposalCount() external view returns (uint256)',
  'function keyholders(uint256) external view returns (address)',
  'function hasVoted(uint256 proposalId, address voter) external view returns (bool)',
  'function verifierContract() external view returns (address)',

  'function getProposalView(uint256 proposalId) external view returns (' +
    'uint256 id,' +
    'address creator,' +
    'uint8 votingMode,' +
    'uint256 createdAtBlock,' +
    'uint256 duration,' +
    'uint256 startBlock,' +
    'uint256 endBlock,' +
    'uint256 eligibilityThreshold,' +
    'uint256 minVoterThreshold,' +
    'uint8 status,' +
    'uint256 voteCount,' +
    'uint256 winningOption,' +
    'uint256 endedAtBlock,' +
    'uint256 shareCount,' +
    'uint256 partialCount' +
  ')',

  'function getProposalDescription(uint256 proposalId) external view returns (string)',

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
  'function submitFinalTally(uint256 proposalId, uint256[10] tallies) external',

  'event ProposalCreated(uint256 indexed proposalId)',
  'event PublicKeyShareSubmitted(uint256 indexed proposalId, address indexed keyholder, uint256 keyholderIndex, uint256 shareX, uint256 shareY)',
  'event ElectionKeyComputed(uint256 indexed proposalId, uint256 keyX, uint256 keyY)',
  'event VotingStarted(uint256 indexed proposalId, uint256 startBlock, uint256 endBlock)',
  'event VoteCast(uint256 indexed proposalId, address indexed voter, uint256 voteCount)',
  'event VotingEnded(uint256 indexed proposalId, uint256 totalVotes)',
  'event PartialDecryptionSubmitted(uint256 indexed proposalId, address indexed keyholder, uint256 keyholderIndex)',
  'event ResultRevealed(uint256 indexed proposalId, uint256 winningOption)',
];

const POLKADOT_TESTNET = {
  chainId:           '0x190F7B1',
  chainName:         'Polkadot Asset Hub Testnet',
  nativeCurrency:    { name: 'PAS', symbol: 'PAS', decimals: 18 },
  rpcUrls:           ['https://eth-rpc-testnet.polkadot.io/'],
  blockExplorerUrls: ['https://assethub-westend.subscan.io'],
};

const REQUIRED_CHAIN_ID = 420420417;
const STATUS_MAP = { 0: 'PENDING_DKG', 1: 'ACTIVE', 2: 'ENDED', 3: 'REVEALED', 4: 'CANCELLED' };
const MODE_MAP   = { 0: 'normal', 1: 'quadratic' };
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

// ── Debug logger ──────────────────────────────────────────────────────────────
const DBG = (...args) => console.log('[VotingContext]', ...args);
const ERR = (...args) => console.error('[VotingContext ERROR]', ...args);

function getWalletProvider() {
  if (typeof window === 'undefined') return null;
  if (window.talisman?.ethereum)    return window.talisman.ethereum;
  if (window.ethereum?.isTalisman)  return window.ethereum;
  if (window.ethereum?.providers) {
    const talisman = window.ethereum.providers.find(p => p.isTalisman);
    if (talisman) return talisman;
  }
  if (window.ethereum) return window.ethereum;
  return null;
}

async function waitForProvider(timeoutMs = 1000) {
  const p = getWalletProvider();
  if (p) return p;
  return new Promise((resolve) => {
    const start    = Date.now();
    const interval = setInterval(() => {
      const found = getWalletProvider();
      if (found || Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        resolve(found ?? null);
      }
    }, 100);
  });
}

async function ensureCorrectChain(rawProvider) {
  const chainIdHex     = await rawProvider.request({ method: 'eth_chainId' });
  const currentChainId = parseInt(chainIdHex, 16);
  DBG(`ensureCorrectChain — current: ${currentChainId}, required: ${REQUIRED_CHAIN_ID}`);
  if (currentChainId === REQUIRED_CHAIN_ID) return;
  try {
    await rawProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: POLKADOT_TESTNET.chainId }],
    });
  } catch (switchErr) {
    const code    = switchErr.code;
    const message = switchErr.message ?? '';
    const isUnknown =
      code === 4902 || code === -32603 ||
      message.includes('Unrecognized') ||
      message.includes('chain') ||
      message.includes('network');
    if (isUnknown) {
      await rawProvider.request({ method: 'wallet_addEthereumChain', params: [POLKADOT_TESTNET] });
    } else {
      throw switchErr;
    }
  }
}

// ── decodeProposal ────────────────────────────────────────────────────────────

async function decodeProposal(contract, provider, proposalId) {
  DBG(`decodeProposal(${proposalId}) — start`);

  // ── Step 1: getProposalView ────────────────────────────────────────────────
  DBG(`decodeProposal(${proposalId}) — calling getProposalView...`);
  let v;
  try {
    // Log raw bytes BEFORE ethers decodes them so we can see what PolkaVM returns
    const iface    = contract.interface;
    const calldata = iface.encodeFunctionData('getProposalView', [proposalId]);
    DBG(`decodeProposal(${proposalId}) — getProposalView calldata: ${calldata}`);

    const rawHex = await provider.call({ to: CONTRACT_ADDRESS, data: calldata });
    DBG(`decodeProposal(${proposalId}) — getProposalView raw response (${rawHex?.length} chars): ${rawHex}`);

    // Now let ethers decode it (this is where BUFFER_OVERRUN fires if still broken)
    v = await contract.getProposalView(proposalId);
    DBG(`decodeProposal(${proposalId}) — getProposalView decoded OK:`, {
      id:             v.id?.toString(),
      creator:        v.creator,
      votingMode:     v.votingMode?.toString(),
      createdAtBlock: v.createdAtBlock?.toString(),
      status:         v.status?.toString(),
      voteCount:      v.voteCount?.toString(),
      shareCount:     v.shareCount?.toString(),
      partialCount:   v.partialCount?.toString(),
    });
  } catch (err) {
    ERR(`decodeProposal(${proposalId}) — getProposalView FAILED:`, err.message);
    ERR(`decodeProposal(${proposalId}) — full error:`, err);
    throw err;
  }

  // ── Step 2: getProposalDescription ────────────────────────────────────────
  DBG(`decodeProposal(${proposalId}) — calling getProposalDescription...`);
  let description = '';
  try {
    const iface    = contract.interface;
    const calldata = iface.encodeFunctionData('getProposalDescription', [proposalId]);
    const rawHex   = await provider.call({ to: CONTRACT_ADDRESS, data: calldata });
    DBG(`decodeProposal(${proposalId}) — getProposalDescription raw (${rawHex?.length} chars): ${rawHex}`);

    description = await contract.getProposalDescription(proposalId);
    DBG(`decodeProposal(${proposalId}) — description: "${description}"`);
  } catch (err) {
    ERR(`decodeProposal(${proposalId}) — getProposalDescription FAILED:`, err.message);
  }

  // ── Step 3: options from createProposal calldata ──────────────────────────
  DBG(`decodeProposal(${proposalId}) — fetching options from ProposalCreated logs...`);
  let options = [];
  try {
    const filter = contract.filters.ProposalCreated(proposalId);
    const logs   = await contract.queryFilter(filter, 0, 'latest');
    DBG(`decodeProposal(${proposalId}) — ProposalCreated logs found: ${logs.length}`);

    if (logs.length > 0) {
      const txHash = logs[0].transactionHash;
      DBG(`decodeProposal(${proposalId}) — fetching tx ${txHash}...`);
      const tx = await provider.getTransaction(txHash);
      DBG(`decodeProposal(${proposalId}) — tx.data selector: ${tx?.data?.slice(0, 10)}`);

      if (tx?.data) {
        const createSel = contract.interface.getFunction('createProposal').selector;
        DBG(`decodeProposal(${proposalId}) — createProposal selector: ${createSel}`);

        if (tx.data.slice(0, 10).toLowerCase() === createSel.toLowerCase()) {
          const decoded = contract.interface.decodeFunctionData('createProposal', tx.data);
          options = Array.from(decoded.options);
          DBG(`decodeProposal(${proposalId}) — options decoded: ${JSON.stringify(options)}`);
        } else {
          ERR(`decodeProposal(${proposalId}) — selector MISMATCH — expected ${createSel}, got ${tx.data.slice(0, 10)}`);
        }
      }
    }
  } catch (err) {
    ERR(`decodeProposal(${proposalId}) — options fetch FAILED:`, err.message);
  }

  // ── Step 4: final result if REVEALED ──────────────────────────────────────
  let finalResult = null;
  let winner      = null;
  if (Number(v.status) === 3) {
    DBG(`decodeProposal(${proposalId}) — status=REVEALED, fetching getResult...`);
    try {
      const res   = await contract.getResult(proposalId);
      finalResult = Array.from(res.tally).map(t => Number(t));
      winner      = options[Number(res.winningOption)] ?? null;
      DBG(`decodeProposal(${proposalId}) — getResult: tally=${JSON.stringify(finalResult)}, winner="${winner}"`);
    } catch (err) {
      ERR(`decodeProposal(${proposalId}) — getResult FAILED:`, err.message);
    }
  }

  const result = {
    id:                   v.id.toString(),
    creator:              v.creator,
    description,
    options,
    votingMode:           MODE_MAP[Number(v.votingMode)] ?? 'normal',
    createdAtBlock:       Number(v.createdAtBlock),
    duration:             Number(v.duration),
    startBlock:           Number(v.startBlock),
    endBlock:             Number(v.endBlock),
    eligibilityThreshold: Number(v.eligibilityThreshold),
    minVoterThreshold:    Number(v.minVoterThreshold),
    status:               STATUS_MAP[Number(v.status)] ?? 'PENDING_DKG',
    voteCount:            Number(v.voteCount),
    totalParticipation:   Number(v.voteCount),
    shareCount:           Number(v.shareCount),
    partialCount:         Number(v.partialCount),
    winningOption:        Number(v.winningOption),
    endedAtBlock:         Number(v.endedAtBlock),
    finalResult,
    winner,
  };

  DBG(`decodeProposal(${proposalId}) — complete:`, result);
  return result;
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
  const [walletType,     setWalletType]     = useState(null);
  const [chainId,        setChainId]        = useState(null);
  const [usedNullifiers, setUsedNullifiers] = useState(new Set());

  const contractRef    = useRef(null);
  const providerRef    = useRef(null);
  const rawProviderRef = useRef(null);

  const detectWalletType = (rawProvider) => {
    if (!rawProvider)           return 'unknown';
    if (rawProvider.isTalisman) return 'talisman';
    if (rawProvider.isMetaMask) return 'metamask';
    return 'unknown';
  };

  const resolveKeyholder = useCallback(async (address, contract) => {
    if (!CONTRACT_ADDRESS || !address) return;
    DBG(`resolveKeyholder — checking address ${address}`);
    try {
      const kh  = await Promise.all([
        contract.keyholders(0),
        contract.keyholders(1),
        contract.keyholders(2),
      ]);
      DBG(`resolveKeyholder — keyholders: ${JSON.stringify(kh)}`);
      const idx = kh.findIndex(k => k.toLowerCase() === address.toLowerCase());
      DBG(`resolveKeyholder — index: ${idx}`);
      setIsKeyholder(idx !== -1);
      setKeyholderIndex(idx !== -1 ? idx : null);
    } catch (err) {
      ERR('resolveKeyholder FAILED:', err.message);
      setIsKeyholder(false);
      setKeyholderIndex(null);
    }
  }, []);

  const getReadContract = useCallback(() => {
    if (contractRef.current) return contractRef.current;
    const raw = rawProviderRef.current;
    if (!raw || !CONTRACT_ADDRESS) {
      ERR('getReadContract — no provider or contract address');
      return null;
    }
    const p = new ethers.BrowserProvider(raw);
    providerRef.current = p;
    const c = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, p);
    contractRef.current = c;
    DBG('getReadContract — created new read contract');
    return c;
  }, []);

  const getWriteContract = useCallback(async () => {
    const raw = rawProviderRef.current;
    if (!raw || !CONTRACT_ADDRESS) throw new Error('Wallet not connected or contract address missing');
    const provider = new ethers.BrowserProvider(raw);
    const signer   = await provider.getSigner();
    DBG('getWriteContract — signer:', await signer.getAddress());
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  }, []);

  // ── Wallet event listeners + auto-restore ─────────────────────────────────

  useEffect(() => {
    const setupListeners = (rawProvider) => {
      rawProviderRef.current = rawProvider;
      DBG('setupListeners — wallet type:', detectWalletType(rawProvider));

      const onAccountsChanged = (accounts) => {
        DBG('accountsChanged:', accounts);
        if (!accounts || accounts.length === 0) {
          setUserAddress(null);
          setIsKeyholder(false);
          setKeyholderIndex(null);
          contractRef.current    = null;
          providerRef.current    = null;
          rawProviderRef.current = null;
        } else {
          const address  = accounts[0];
          const ethersP  = new ethers.BrowserProvider(rawProvider);
          providerRef.current = ethersP;
          const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethersP);
          contractRef.current = contract;
          setUserAddress(address);
          resolveKeyholder(address, contract);
        }
      };

      const onChainChanged = (newChainId) => {
        DBG('chainChanged:', newChainId, '→', parseInt(newChainId, 16));
        setChainId(parseInt(newChainId, 16));
        window.location.reload();
      };

      rawProvider.on('accountsChanged', onAccountsChanged);
      rawProvider.on('chainChanged',    onChainChanged);

      rawProvider.request({ method: 'eth_accounts' }).then((accounts) => {
        DBG('eth_accounts (auto-restore):', accounts);
        if (accounts && accounts.length > 0) {
          const address  = accounts[0];
          const ethersP  = new ethers.BrowserProvider(rawProvider);
          providerRef.current = ethersP;
          const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethersP);
          contractRef.current = contract;
          setUserAddress(address);
          setWalletType(detectWalletType(rawProvider));
          resolveKeyholder(address, contract);
        }
      }).catch((err) => ERR('eth_accounts FAILED:', err.message));

      rawProvider.request({ method: 'eth_chainId' }).then(hex => {
        DBG('eth_chainId:', hex, '→', parseInt(hex, 16));
        setChainId(parseInt(hex, 16));
      }).catch((err) => ERR('eth_chainId FAILED:', err.message));

      return () => {
        rawProvider.removeListener('accountsChanged', onAccountsChanged);
        rawProvider.removeListener('chainChanged',    onChainChanged);
      };
    };

    waitForProvider(1500).then(p => {
      if (p) {
        DBG('Provider found:', p.constructor?.name ?? typeof p);
        setupListeners(p);
      } else {
        ERR('No wallet provider found after 1500ms');
      }
    });
  }, [resolveKeyholder]);

  // ── connectWallet ─────────────────────────────────────────────────────────

  const connectWallet = useCallback(async () => {
    DBG('connectWallet — start');
    setLoading(true);
    setError(null);
    try {
      const rawProvider = await waitForProvider(2000);
      if (!rawProvider) throw new Error('No wallet found. Install Talisman from https://talisman.xyz');

      rawProviderRef.current = rawProvider;
      const wt = detectWalletType(rawProvider);
      setWalletType(wt);
      DBG('connectWallet — wallet type:', wt);

      const accounts = await rawProvider.request({ method: 'eth_requestAccounts' });
      DBG('connectWallet — accounts:', accounts);
      if (!accounts || accounts.length === 0) throw new Error('No accounts returned from wallet');

      await ensureCorrectChain(rawProvider);

      const address  = accounts[0];
      const ethersP  = new ethers.BrowserProvider(rawProvider);
      providerRef.current = ethersP;
      setUserAddress(address);
      DBG('connectWallet — address:', address);

      if (CONTRACT_ADDRESS) {
        DBG('connectWallet — CONTRACT_ADDRESS:', CONTRACT_ADDRESS);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethersP);
        contractRef.current = contract;
        await resolveKeyholder(address, contract);
      } else {
        ERR('connectWallet — CONTRACT_ADDRESS is not set!');
      }

      const chainHex = await rawProvider.request({ method: 'eth_chainId' });
      const cid = parseInt(chainHex, 16);
      setChainId(cid);
      DBG('connectWallet — chainId:', cid);

      setLoading(false);
      DBG('connectWallet — success');
      return address;
    } catch (err) {
      ERR('connectWallet FAILED:', err.message, err);
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
    DBG('disconnectWallet');
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
    DBG('initializeProposals — start');
    setLoading(true);
    setError(null);
    try {
      const contract = getReadContract();
      if (!contract) {
        ERR('initializeProposals — no contract');
        setLoading(false);
        return;
      }

      const count = Number(await contract.proposalCount());
      DBG('initializeProposals — proposalCount:', count);
      if (count === 0) { setProposals([]); setLoading(false); return; }

      const provider = providerRef.current;
      DBG(`initializeProposals — fetching ${count} proposals...`);

      const fetched = await Promise.allSettled(
        Array.from({ length: count }, (_, i) => decodeProposal(contract, provider, i))
      );

      fetched.forEach((r, i) => {
        if (r.status === 'rejected') {
          ERR(`initializeProposals — proposal ${i} FAILED:`, r.reason?.message ?? r.reason);
        }
      });

      const valid = fetched
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);

      DBG(`initializeProposals — decoded ${valid.length}/${count} proposals successfully`);
      setProposals(valid);

      if (userAddress) {
        const votedFlags = await Promise.allSettled(
          valid.map(p => contract.hasVoted(p.id, userAddress))
        );
        const voted = valid
          .filter((_, i) => votedFlags[i].status === 'fulfilled' && votedFlags[i].value)
          .map(p => p.id);
        DBG('initializeProposals — voted proposal IDs:', voted);
        setUserVotes(voted);
      }

      setLoading(false);
      DBG('initializeProposals — done');
    } catch (err) {
      ERR('initializeProposals FAILED:', err.message, err);
      setError(err.message);
      setLoading(false);
    }
  }, [getReadContract, userAddress]);

  // ── getProposalDetail ─────────────────────────────────────────────────────

  const getProposalDetail = useCallback(async (proposalId) => {
    DBG(`getProposalDetail(${proposalId}) — start`);
    setLoading(true);
    setError(null);
    try {
      const contract = getReadContract();
      if (!contract) throw new Error('Contract not available — connect wallet first');
      const provider = providerRef.current;
      const detail   = await decodeProposal(contract, provider, Number(proposalId));

      const dkg = await contract.getDKGStatus(proposalId).catch((e) => {
        ERR(`getProposalDetail — getDKGStatus FAILED:`, e.message);
        return null;
      });
      if (dkg) {
        detail.dkgAddresses = Array.from(dkg.addresses);
        detail.dkgSubmitted = Array.from(dkg.submitted);
        DBG(`getProposalDetail(${proposalId}) — DKG:`, detail.dkgAddresses, detail.dkgSubmitted);
      }

      const epk = await contract.getElectionPublicKey(proposalId).catch((e) => {
        ERR(`getProposalDetail — getElectionPublicKey FAILED:`, e.message);
        return null;
      });
      if (epk) {
        detail.electionPublicKey = { x: epk.x.toString(), y: epk.y.toString() };
        detail.dkgSharesIn       = Number(epk.sharesIn);
        DBG(`getProposalDetail(${proposalId}) — EPK: x=${detail.electionPublicKey.x.slice(0, 10)}…`);
      }

      setProposalDetail(detail);
      setLoading(false);
      DBG(`getProposalDetail(${proposalId}) — done`);
      return detail;
    } catch (err) {
      ERR(`getProposalDetail(${proposalId}) FAILED:`, err.message, err);
      setError(err.message);
      setLoading(false);
      return null;
    }
  }, [getReadContract]);

  const getActiveProposals   = useCallback(() => proposals.filter(p => p.status === 'PENDING_DKG' || p.status === 'ACTIVE'),    [proposals]);
  const getArchivedProposals = useCallback(() => proposals.filter(p => p.status === 'REVEALED'    || p.status === 'CANCELLED'),  [proposals]);
  const getEndedProposals    = useCallback(() => proposals.filter(p => p.status === 'ENDED'),                                     [proposals]);

  // ── createProposal ────────────────────────────────────────────────────────

  const createProposal = useCallback(async ({
    description, options, votingMode, duration,
    eligibilityThreshold, minVoterThreshold,
  }) => {
    DBG('createProposal — start', { description, options, votingMode, duration, eligibilityThreshold, minVoterThreshold });
    setLoading(true);
    setError(null);
    try {
      const contract = await getWriteContract();
      const modeEnum = votingMode === 'quadratic' ? 1 : 0;

      DBG('createProposal — sending tx...');
      const tx      = await contract.createProposal(
        description, options, modeEnum, duration, eligibilityThreshold, minVoterThreshold,
      );
      DBG('createProposal — tx hash:', tx.hash);
      const receipt = await tx.wait();
      DBG('createProposal — receipt status:', receipt.status, 'logs:', receipt.logs.length);

      const createdLog = receipt.logs
        .map(l => { try { return contract.interface.parseLog(l); } catch { return null; } })
        .find(l => l?.name === 'ProposalCreated');

      const newId = createdLog ? Number(createdLog.args.proposalId) : null;
      DBG('createProposal — new proposalId:', newId);

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
      ERR('createProposal FAILED:', err.message, err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [getWriteContract]);

  // ── submitPublicKeyShare ──────────────────────────────────────────────────

  const submitPublicKeyShare = useCallback(async (proposalId, shareX, shareY) => {
    DBG(`submitPublicKeyShare(${proposalId}) — shareX: ${shareX?.toString().slice(0,10)}…`);
    setLoading(true);
    setError(null);
    try {
      const contract = await getWriteContract();
      const tx = await contract.submitPublicKeyShare(proposalId, shareX, shareY);
      DBG(`submitPublicKeyShare — tx hash: ${tx.hash}`);
      await tx.wait();
      DBG(`submitPublicKeyShare — confirmed, refreshing detail...`);
      await getProposalDetail(proposalId);
      setLoading(false);
      return { success: true };
    } catch (err) {
      ERR(`submitPublicKeyShare FAILED:`, err.message, err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [getWriteContract, getProposalDetail]);

  // ── submitVote ────────────────────────────────────────────────────────────

  const submitVote = useCallback(async (proposalId, pA, pB, pC, pubSignals, encVote, nullifier) => {
    DBG(`submitVote(${proposalId}) — nullifier: ${nullifier}`);
    setLoading(true);
    setError(null);
    try {
      if (usedNullifiers.has(nullifier)) throw new Error('Nullifier already used — vote already cast');

      const contract = await getWriteContract();
      DBG(`submitVote — sending castVote tx...`);
      const tx = await contract.castVote(proposalId, pA, pB, pC, pubSignals, encVote);
      DBG(`submitVote — tx hash: ${tx.hash}`);
      await tx.wait();
      DBG(`submitVote — confirmed`);

      const pid = proposalId.toString();
      setUsedNullifiers(prev => new Set([...prev, nullifier]));
      setUserVotes(prev => prev.includes(pid) ? prev : [...prev, pid]);

      try {
        DBG(`submitVote — refreshing proposal ${pid}...`);
        const refreshed = await decodeProposal(getReadContract(), providerRef.current, Number(pid));
        if (refreshed) {
          setProposals(prev => prev.map(p => p.id === pid ? refreshed : p));
          setProposalDetail(prev => (prev?.id === pid) ? { ...prev, ...refreshed } : prev);
          DBG(`submitVote — proposal ${pid} refreshed, new voteCount: ${refreshed.voteCount}`);
        }
      } catch (refreshErr) {
        ERR(`submitVote — refresh FAILED, using optimistic update:`, refreshErr.message);
        setProposals(prev => prev.map(p =>
          p.id === pid
            ? { ...p, voteCount: p.voteCount + 1, totalParticipation: p.totalParticipation + 1 }
            : p
        ));
      }

      setLoading(false);
      return { success: true, nullifier };
    } catch (err) {
      ERR(`submitVote FAILED:`, err.message, err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [getWriteContract, getReadContract, usedNullifiers]);

  // ── closeVoting ───────────────────────────────────────────────────────────

  const closeVoting = useCallback(async (proposalId) => {
    DBG(`closeVoting(${proposalId})`);
    setLoading(true);
    setError(null);
    try {
      const contract = await getWriteContract();
      const tx = await contract.closeVoting(proposalId);
      DBG(`closeVoting — tx hash: ${tx.hash}`);
      await tx.wait();
      DBG(`closeVoting — confirmed, refreshing all proposals...`);
      await initializeProposals();
      setLoading(false);
      return { success: true };
    } catch (err) {
      ERR(`closeVoting FAILED:`, err.message, err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [getWriteContract, initializeProposals]);

  // ── submitPartialDecryption ───────────────────────────────────────────────

  const submitPartialDecryption = useCallback(async (proposalId, partials) => {
    DBG(`submitPartialDecryption(${proposalId})`);
    setLoading(true);
    setError(null);
    try {
      const contract = await getWriteContract();
      const tx = await contract.submitPartialDecrypt(proposalId, partials);
      DBG(`submitPartialDecryption — tx hash: ${tx.hash}`);
      await tx.wait();
      DBG(`submitPartialDecryption — confirmed`);
      await getProposalDetail(proposalId);
      setLoading(false);
      return { success: true };
    } catch (err) {
      ERR(`submitPartialDecryption FAILED:`, err.message, err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [getWriteContract, getProposalDetail]);

  // ── submitFinalTally ──────────────────────────────────────────────────────

  const submitFinalTally = useCallback(async (proposalId, tallies) => {
    DBG(`submitFinalTally(${proposalId}) — tallies: ${JSON.stringify(tallies)}`);
    setLoading(true);
    setError(null);
    try {
      if (!Array.isArray(tallies) || tallies.length !== 10) {
        throw new Error('tallies must be an array of exactly 10 uint256 values');
      }
      const contract = await getWriteContract();
      const tx = await contract.submitFinalTally(proposalId, tallies.map(BigInt));
      DBG(`submitFinalTally — tx hash: ${tx.hash}`);
      await tx.wait();
      DBG(`submitFinalTally — confirmed`);
      await initializeProposals();
      setLoading(false);
      return { success: true };
    } catch (err) {
      ERR(`submitFinalTally FAILED:`, err.message, err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [getWriteContract, initializeProposals]);

  // ── checkEligibility ─────────────────────────────────────────────────────

  const checkEligibility = useCallback(async (proposalId) => {
    DBG(`checkEligibility(${proposalId}) for ${userAddress}`);
    if (!userAddress) return false;
    try {
      const contract = getReadContract();
      if (!contract) return false;
      const v = await contract.getProposalView(proposalId);
      DBG(`checkEligibility — threshold: ${v.eligibilityThreshold?.toString()}`);
      if (Number(v.eligibilityThreshold) === 0) return true;
      const provider = providerRef.current;
      if (!provider) return false;
      const balance = await provider.getBalance(userAddress);
      DBG(`checkEligibility — balance: ${balance}, threshold: ${v.eligibilityThreshold}`);
      return balance >= v.eligibilityThreshold;
    } catch (err) {
      ERR('checkEligibility FAILED:', err.message);
      return false;
    }
  }, [userAddress, getReadContract]);

  // ── getDKGStatus ──────────────────────────────────────────────────────────

  const getDKGStatus = useCallback(async (proposalId) => {
    DBG(`getDKGStatus(${proposalId})`);
    try {
      const contract = getReadContract();
      if (!contract) return null;
      const res = await contract.getDKGStatus(proposalId);
      const result = { addresses: Array.from(res.addresses), submitted: Array.from(res.submitted) };
      DBG(`getDKGStatus — result:`, result);
      return result;
    } catch (err) {
      ERR('getDKGStatus FAILED:', err.message);
      return null;
    }
  }, [getReadContract]);

  // ── getEncryptedTally ─────────────────────────────────────────────────────

  const getEncryptedTally = useCallback(async (proposalId, optionIndex) => {
    DBG(`getEncryptedTally(${proposalId}, ${optionIndex})`);
    try {
      const contract = getReadContract();
      if (!contract) return null;
      const res = await contract.getEncryptedTally(proposalId, optionIndex);
      return { c1: res.c1, c2: res.c2 };
    } catch (err) {
      ERR('getEncryptedTally FAILED:', err.message);
      return null;
    }
  }, [getReadContract]);

  // ── getNullifierStatus ────────────────────────────────────────────────────

  const getNullifierStatus = useCallback(() => ({
    usedCount:       usedNullifiers.size,
    availableCount:  100 - usedNullifiers.size,
    totalAllocation: 100,
  }), [usedNullifiers]);

  const isOnCorrectChain = chainId === REQUIRED_CHAIN_ID;

  const value = {
    userAddress,
    isKeyholder,
    keyholderIndex,
    walletType,
    chainId,
    isOnCorrectChain,
    userVotes,
    userProposals,
    proposals,
    proposalDetail,
    loading,
    error,
    connectWallet,
    disconnectWallet,
    initializeProposals,
    getProposalDetail,
    getActiveProposals,
    getArchivedProposals,
    getEndedProposals,
    createProposal,
    submitPublicKeyShare,
    submitVote,
    closeVoting,
    submitPartialDecryption,
    submitFinalTally,
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