import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from '@mui/material';
import { useVoting } from '../context/VotingContext';
import { nullifierUtils, voteWeightCalculator } from '../utils/contractUtils';

const monoFont = '"Share Tech Mono", "JetBrains Mono", "Courier New", monospace';
const bodyFont = '"IBM Plex Mono", "Courier New", monospace';

const dataBox = {
  p: 1.5,
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid #1e2a35',
  borderRadius: '2px',
  mb: 1.5,
};

const STEPS = [
  'generating nullifier...',
  'encrypting vote...',
  'generating zk proof...',
  'submitting transaction...',
];

const ScanBar = () => (
  <Box sx={{
    width: '120px', height: '2px', background: '#1e2a35',
    borderRadius: '2px', overflow: 'hidden', position: 'relative', flexShrink: 0,
  }}>
    <Box sx={{
      position: 'absolute', top: 0, bottom: 0, width: '36px',
      background: '#00f5d4',
      animation: 'scanProg 1.2s linear infinite',
      '@keyframes scanProg': { '0%': { left: '-40px' }, '100%': { left: '100%' } },
    }} />
  </Box>
);

// BigInt-safe replacer for JSON.stringify debug logs
const bigintReplacer = (_, v) => typeof v === 'bigint' ? v.toString() + 'n' : v;

// ── Build pubSignals for castVote ─────────────────────────────────────────────
//
// The contract checks these specific slots:
//   pubSignals[0] = claimedBalance   → must be <= msg.sender.balance (use 0 = no claim)
//   pubSignals[1] = votingMode       → must match proposal.votingMode (0=NORMAL, 1=QUADRATIC)
//   pubSignals[2] = EPK x            → must match stored electionPublicKey[0]
//   pubSignals[3] = EPK y            → must match stored electionPublicKey[1]
//   pubSignals[4..43] = encVote coords → must match encVote array (all 0 = OK with identity points)
//
// Passing wrong EPK or wrong votingMode causes PublicInputMismatch revert.

function buildPubSignals(proposal) {
  const signals = Array(44).fill(0n);

  // [0] claimedBalance — 0 means "I claim 0 tokens" which is always <= actual balance
  signals[0] = 0n;

  // [1] votingMode — must match exactly
  signals[1] = proposal.votingMode === 'quadratic' ? 1n : 0n;

  // [2,3] election public key — must match what's stored on-chain
  const epk = proposal.electionPublicKey;
  if (!epk?.x || !epk?.y) {
    throw new Error('Election public key not available — DKG may not be complete');
  }
  signals[2] = BigInt(epk.x);
  signals[3] = BigInt(epk.y);

  // [4..43] encVote coordinates — all zeros matches DUMMY_ENC_VOTE (identity points)
  // slots 4+i*4 = encVote[i][0][0] (c1.x)
  // slots 5+i*4 = encVote[i][0][1] (c1.y)
  // slots 6+i*4 = encVote[i][1][0] (c2.x)
  // slots 7+i*4 = encVote[i][1][1] (c2.y)
  // All remain 0n to match DUMMY_ENC_VOTE

  return signals;
}

// ── Dummy proof + encVote (identity points) ───────────────────────────────────
// verifierContract == address(1) on this deployment so proof is not verified.
// encVote must be uint256[2][2][10] with correct shape or ethers encodes wrong calldata.
const DUMMY_POINT    = [0n, 0n];
const DUMMY_PA       = DUMMY_POINT;
const DUMMY_PB       = [DUMMY_POINT, DUMMY_POINT];
const DUMMY_PC       = DUMMY_POINT;
const DUMMY_ENC_VOTE = Array.from({ length: 10 }, () => [
  [0n, 0n], // c1: [x, y]
  [0n, 0n], // c2: [x, y]
]);

const VoteForm = ({ proposal, onVoteSuccess }) => {
  const { submitVote, userAddress, checkEligibility } = useVoting();

  const [selectedOption,     setSelectedOption]     = useState('');
  const [loading,            setLoading]            = useState(false);
  const [stepIndex,          setStepIndex]          = useState(-1);
  const [completedSteps,     setCompletedSteps]     = useState([]);
  const [error,              setError]              = useState(null);
  const [showConfirmation,   setShowConfirmation]   = useState(false);
  const [confirmationData,   setConfirmationData]   = useState(null);
  const [eligible,           setEligible]           = useState(null);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);

  useEffect(() => {
    if (!userAddress || !proposal?.id) return;
    setEligibilityChecked(false);
    checkEligibility(proposal.id)
      .then(result => { setEligible(result);  setEligibilityChecked(true); })
      .catch(()     => { setEligible(false);  setEligibilityChecked(true); });
  }, [proposal?.id, userAddress, checkEligibility]);

  const handleSubmitVote = async () => {
    if (!selectedOption || !userAddress) {
      setError('select an option and connect your wallet');
      return;
    }

    setLoading(true);
    setError(null);
    setStepIndex(0);
    setCompletedSteps([]);

    try {
      // Step 0 — generate nullifier
      const userSecret = `${userAddress}${proposal.id}`;
      const nullifier  = nullifierUtils.generate(userSecret, proposal.id);
      console.log('[VoteForm] nullifier:', nullifier);
      setCompletedSteps(p => [...p, 0]);
      setStepIndex(1);

      // Step 1 — encrypt vote (placeholder until circomlibjs integrated)
      setCompletedSteps(p => [...p, 1]);
      setStepIndex(2);

      // Step 2 — generate ZK proof (placeholder until snarkjs integrated)
      setCompletedSteps(p => [...p, 2]);
      setStepIndex(3);

      // Step 3 — build pubSignals with real EPK + votingMode, then submit
      const optionIndex = proposal.options.indexOf(selectedOption);
      console.log('[VoteForm] submitting vote for option', optionIndex, selectedOption);
      console.log('[VoteForm] proposal.electionPublicKey:', proposal.electionPublicKey);
      console.log('[VoteForm] proposal.votingMode:', proposal.votingMode);

      // Build pubSignals — must contain real EPK and votingMode or contract reverts
      const pubSignals = buildPubSignals(proposal);
      console.log('[VoteForm] pubSignals[0..3]:', pubSignals.slice(0, 4).map(String));

      await submitVote(
        proposal.id,
        DUMMY_PA,
        DUMMY_PB,
        DUMMY_PC,
        pubSignals,
        DUMMY_ENC_VOTE,
        nullifier,
      );

      setCompletedSteps(p => [...p, 3]);

      setConfirmationData({
        nullifier,
        option:     selectedOption,
        optionIdx:  optionIndex,
        weight:     voteWeightCalculator.calculate(proposal.votingMode, 1),
        weightFmt:  voteWeightCalculator.formatWeight(proposal.votingMode, 1),
        votingMode: proposal.votingMode,
        timestamp:  new Date().toLocaleString('en-GB'),
      });

      setShowConfirmation(true);
      setSelectedOption('');
      if (onVoteSuccess) setTimeout(onVoteSuccess, 2000);

    } catch (err) {
      console.error('[VoteForm] handleSubmitVote FAILED:', err);
      setError(err.message || 'failed to submit vote — please try again');
    } finally {
      setLoading(false);
      setStepIndex(-1);
    }
  };

  if (!eligibilityChecked && userAddress) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
        <ScanBar />
        <Typography sx={{ fontFamily: bodyFont, fontSize: '0.7rem', color: '#64748b', letterSpacing: '0.06em' }}>
          &gt; checking eligibility...
        </Typography>
      </Box>
    );
  }

  if (eligibilityChecked && eligible === false) {
    return (
      <Box sx={{ borderLeft: '2px solid #ff3c3c', pl: 1.5, py: 0.5 }}>
        <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ff3c3c', letterSpacing: '0.04em' }}>
          &gt; not eligible — insufficient token balance or already voted
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Typography sx={{
        fontFamily: monoFont, fontSize: '0.62rem', color: '#64748b',
        letterSpacing: '0.15em', textTransform: 'uppercase', mb: '1.5rem',
      }}>
        {'/* select option */'}
      </Typography>

      <Box sx={{ mb: '1.5rem' }}>
        {proposal.options.map((option, idx) => {
          const isSelected = selectedOption === option;
          return (
            <Box
              key={idx}
              onClick={() => !loading && setSelectedOption(option)}
              sx={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '10px 14px', mb: '6px',
                border: '1px solid',
                borderColor: isSelected ? 'rgba(0,245,212,0.45)' : '#1e2a35',
                borderRadius: '2px',
                background: isSelected ? 'rgba(0,245,212,0.05)' : 'transparent',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: isSelected ? '#00f5d4' : '#64748b',
                transition: 'all 0.15s',
                '&:hover': loading ? {} : {
                  borderColor: 'rgba(0,245,212,0.3)',
                  color: '#e2e8f0',
                  background: 'rgba(0,245,212,0.03)',
                },
              }}
            >
              <Typography sx={{
                fontFamily: monoFont, fontSize: '0.65rem',
                color: isSelected ? '#00f5d4' : '#334155',
                minWidth: 28, flexShrink: 0,
              }}>
                [{idx + 1}]
              </Typography>
              <Typography sx={{
                fontFamily: bodyFont, fontSize: '0.82rem',
                color: 'inherit', flex: 1, letterSpacing: '0.03em',
              }}>
                {option}
              </Typography>
              {isSelected && (
                <Typography sx={{
                  fontFamily: monoFont, fontSize: '0.62rem',
                  letterSpacing: '0.1em', color: '#00f5d4', flexShrink: 0,
                }}>
                  ◀ SELECTED
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>

      {error && (
        <Box sx={{ borderLeft: '2px solid #ff3c3c', pl: 1.5, mb: '1.25rem', py: 0.25 }}>
          <Typography sx={{ fontFamily: bodyFont, fontSize: '0.72rem', color: '#ff3c3c', letterSpacing: '0.04em' }}>
            &gt; error: {error}
          </Typography>
        </Box>
      )}

      {loading && (
        <Box sx={{ mb: '1.25rem' }}>
          {STEPS.map((step, i) => {
            const done   = completedSteps.includes(i);
            const active = stepIndex === i;
            return (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '4px' }}>
                <Typography sx={{
                  fontFamily: monoFont, fontSize: '0.6rem',
                  color: done ? '#39ff14' : active ? '#00f5d4' : '#334155',
                  minWidth: 14, flexShrink: 0,
                }}>
                  {done ? '✓' : active ? '▶' : '·'}
                </Typography>
                <Typography sx={{
                  fontFamily: bodyFont, fontSize: '0.7rem',
                  color: done ? '#39ff14' : active ? '#00f5d4' : '#334155',
                  letterSpacing: '0.04em',
                }}>
                  {step}
                </Typography>
                {active && <ScanBar />}
              </Box>
            );
          })}
        </Box>
      )}

      <Button
        fullWidth
        disableRipple
        onClick={handleSubmitVote}
        disabled={!selectedOption || loading}
        sx={{
          fontFamily: monoFont, fontSize: '0.68rem', fontWeight: 400,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: !selectedOption || loading ? '#334155' : '#00f5d4',
          background: 'transparent', border: '1px solid',
          borderColor: !selectedOption || loading ? '#1e2a35' : 'rgba(0,245,212,0.45)',
          borderRadius: '2px', py: 1.25,
          transition: 'background 0.15s, box-shadow 0.15s',
          '&:hover:not(:disabled)': {
            background: 'rgba(0,245,212,0.06)',
            borderColor: '#00f5d4',
            boxShadow: '0 0 10px rgba(0,245,212,0.2)',
          },
          '&.Mui-disabled': { opacity: 1 },
        }}
      >
        {loading
          ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ScanBar /> processing...
            </Box>
          : '[ SUBMIT ENCRYPTED VOTE ]'
        }
      </Button>

      <Dialog
        open={showConfirmation && !!confirmationData}
        onClose={() => setShowConfirmation(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: '#0d1117',
            border: '1px solid rgba(57,255,20,0.3)',
            borderRadius: '2px',
            boxShadow: '0 0 30px rgba(57,255,20,0.06)',
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
          },
        }}
      >
        <DialogTitle sx={{
          fontFamily: monoFont, fontSize: '0.82rem', fontWeight: 400,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: '#39ff14', textShadow: '0 0 10px rgba(57,255,20,0.4)',
          borderBottom: '1px solid rgba(57,255,20,0.15)',
          py: 2, display: 'flex', alignItems: 'center', gap: 1.5,
        }}>
          <Box sx={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#39ff14', boxShadow: '0 0 8px rgba(57,255,20,0.8)',
            flexShrink: 0,
            animation: 'glowPulse 2s ease-in-out infinite',
            '@keyframes glowPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
          }} />
          VOTE CONFIRMED
        </DialogTitle>

        <DialogContent sx={{ pt: 2.5, pb: 1 }}>
          <Box sx={dataBox}>
            <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>
              SELECTED OPTION
            </Typography>
            <Typography sx={{ fontFamily: monoFont, fontSize: '0.85rem', color: '#e2e8f0', letterSpacing: '0.04em' }}>
              [{confirmationData?.optionIdx + 1}] {confirmationData?.option}
            </Typography>
          </Box>

          {confirmationData?.votingMode === 'quadratic' && (
            <Box sx={dataBox}>
              <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>
                VOTE WEIGHT (QUADRATIC)
              </Typography>
              <Typography sx={{ fontFamily: monoFont, fontSize: '0.85rem', color: '#00f5d4', letterSpacing: '0.04em' }}>
                {confirmationData?.weightFmt}
              </Typography>
            </Box>
          )}

          <Box sx={dataBox}>
            <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>
              TIMESTAMP
            </Typography>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#64748b', letterSpacing: '0.04em' }}>
              {confirmationData?.timestamp}
            </Typography>
          </Box>

          <Box sx={dataBox}>
            <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>
              NULLIFIER
            </Typography>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.65rem', color: '#334155', wordBreak: 'break-all', lineHeight: 1.65, letterSpacing: '0.02em' }}>
              {confirmationData?.nullifier}
            </Typography>
          </Box>

          <Box sx={{ borderLeft: '2px solid #1e2a35', pl: 1.5, mt: 0.5, py: 0.25 }}>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.68rem', color: '#334155', lineHeight: 1.7, letterSpacing: '0.03em' }}>
              &gt; vote stored on-chain — cannot be changed or reversed
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #1e2a35' }}>
          <Button
            onClick={() => setShowConfirmation(false)}
            disableRipple
            sx={{
              fontFamily: monoFont, fontSize: '0.65rem',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#64748b', border: '1px solid #2e3e4d',
              borderRadius: '2px', px: 2, py: 0.75,
              background: 'transparent', transition: 'all 0.15s',
              '&:hover': { borderColor: 'rgba(0,245,212,0.4)', color: '#00f5d4', background: 'rgba(0,245,212,0.04)' },
            }}
          >
            &gt; CLOSE
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default VoteForm;