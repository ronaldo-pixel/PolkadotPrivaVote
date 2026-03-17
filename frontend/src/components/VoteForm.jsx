import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from '@mui/material';
import { useVoting } from '../context/VotingContext';
import {
  nullifierUtils,
  zkProofGenerator,
  encryptionUtils,
  voteWeightCalculator,
} from '../utils/contractUtils';

const VoteForm = ({ proposal, onVoteSuccess }) => {
  const { submitVote, userAddress, checkEligibility } = useVoting();
  const [selectedOption, setSelectedOption] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  const [eligible, setEligible] = useState(true);

  React.useEffect(() => {
    setEligible(checkEligibility(proposal.id));
  }, [proposal.id, checkEligibility, userAddress]);

  const handleSubmitVote = async () => {
    if (!selectedOption || !userAddress) {
      setError('select an option and connect your wallet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setLoadingStep('generating nullifier...');
      const userSecret = `${userAddress}${proposal.id}secret`;
      const nullifier = nullifierUtils.generateNullifier(userSecret, proposal.id);

      const optionIndex = proposal.options.indexOf(selectedOption);

      setLoadingStep('encrypting vote...');
      const { encryptedVote } = encryptionUtils.encryptVote(optionIndex, 'publicKey');

      setLoadingStep('generating ZK proof...');
      const proofData = await zkProofGenerator.generateVoteProof(nullifier, optionIndex, encryptedVote);

      setLoadingStep('submitting transaction...');
      const weight = voteWeightCalculator.calculateWeight(proposal.votingMode, 1);

      await submitVote(
        proposal.id,
        optionIndex,
        encryptedVote,
        proofData.proof,
        nullifier
      );

      setConfirmationData({
        nullifier,
        option: selectedOption,
        weight,
        votingMode: proposal.votingMode,
        timestamp: new Date().toLocaleString(),
      });

      setShowConfirmation(true);
      setSelectedOption('');
      if (onVoteSuccess) setTimeout(() => onVoteSuccess(), 2000);
    } catch (err) {
      setError(err.message || 'failed to submit vote — please try again');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // ─── Shared token ─────────────────────────────────────────────────────────
  const monoFont = '"JetBrains Mono", "Courier New", monospace';
  const dataBox = {
    p: 1.5,
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(226,232,240,0.06)',
    borderRadius: '2px',
    mb: 1.5,
  };
  // ─────────────────────────────────────────────────────────────────────────

  if (!eligible) {
    return (
      <Box sx={{ borderLeft: '2px solid #ff3c3c', pl: 1.5, py: 0.5 }}>
        <Typography sx={{ fontFamily: monoFont, fontSize: '0.78rem', color: '#ff3c3c' }}>
          &gt; error: not eligible — insufficient tokens or already voted
        </Typography>
      </Box>
    );
  }

  return (
    <>
      {/* Section label */}
      <Typography
        sx={{
          fontFamily: monoFont,
          fontSize: '0.68rem',
          color: 'rgba(226,232,240,0.3)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          mb: 2,
        }}
      >
        /* select option */
      </Typography>

      {/* Option list */}
      <Box sx={{ mb: 3 }}>
        {proposal.options.map((option, idx) => {
          const isSelected = selectedOption === option;
          return (
            <Box
              key={idx}
              onClick={() => !loading && setSelectedOption(option)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.5,
                mb: 1,
                border: '1px solid',
                borderColor: isSelected ? 'rgba(0,245,212,0.5)' : 'rgba(226,232,240,0.07)',
                borderRadius: '2px',
                background: isSelected ? 'rgba(0,245,212,0.05)' : 'transparent',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                '&:hover': loading
                  ? {}
                  : {
                      borderColor: 'rgba(0,245,212,0.3)',
                      background: 'rgba(0,245,212,0.03)',
                    },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography
                  sx={{
                    fontFamily: monoFont,
                    fontSize: '0.72rem',
                    color: isSelected ? '#00f5d4' : 'rgba(226,232,240,0.25)',
                    width: 20,
                    flexShrink: 0,
                  }}
                >
                  [{idx + 1}]
                </Typography>
                <Typography
                  sx={{
                    fontFamily: monoFont,
                    fontSize: '0.82rem',
                    color: isSelected ? '#e2e8f0' : 'rgba(226,232,240,0.55)',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {option}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography
                  sx={{
                    fontFamily: monoFont,
                    fontSize: '0.68rem',
                    color: 'rgba(226,232,240,0.2)',
                  }}
                >
                  {proposal.voteWeight?.[option] ?? 0} votes
                </Typography>
                {isSelected && (
                  <Typography
                    sx={{
                      fontFamily: monoFont,
                      fontSize: '0.72rem',
                      color: '#00f5d4',
                      textShadow: '0 0 8px rgba(0,245,212,0.6)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    ◀ SELECTED
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Error */}
      {error && (
        <Box sx={{ borderLeft: '2px solid #ff3c3c', pl: 1.5, mb: 2 }}>
          <Typography sx={{ fontFamily: monoFont, fontSize: '0.75rem', color: '#ff3c3c' }}>
            &gt; error: {error}
          </Typography>
        </Box>
      )}

      {/* Loading steps */}
      {loading && loadingStep && (
        <Box sx={{ borderLeft: '2px solid rgba(0,245,212,0.4)', pl: 1.5, mb: 2 }}>
          <Typography
            sx={{
              fontFamily: monoFont,
              fontSize: '0.75rem',
              color: 'rgba(0,245,212,0.7)',
              letterSpacing: '0.04em',
            }}
          >
            &gt; {loadingStep}
          </Typography>
        </Box>
      )}

      {/* Submit */}
      <Button
        fullWidth
        disableRipple
        onClick={handleSubmitVote}
        disabled={!selectedOption || loading}
        sx={{
          fontFamily: monoFont,
          fontSize: '0.8rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: !selectedOption || loading ? 'rgba(226,232,240,0.2)' : '#00f5d4',
          background: 'transparent',
          border: '1px solid',
          borderColor: !selectedOption || loading ? 'rgba(226,232,240,0.08)' : 'rgba(0,245,212,0.45)',
          borderRadius: '2px',
          py: 1.5,
          transition: 'all 0.15s',
          '&:hover:not(:disabled)': {
            background: 'rgba(0,245,212,0.06)',
            borderColor: '#00f5d4',
            boxShadow: '0 0 14px rgba(0,245,212,0.15)',
          },
          '&:disabled': { cursor: 'not-allowed' },
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CircularProgress size={14} sx={{ color: 'rgba(0,245,212,0.5)' }} />
            processing...
          </Box>
        ) : (
          '[ submit encrypted vote ]'
        )}
      </Button>

      {/* Privacy note */}
      <Box sx={{ borderLeft: '2px solid rgba(226,232,240,0.08)', pl: 1.5, mt: 2 }}>
        <Typography
          sx={{
            fontFamily: monoFont,
            fontSize: '0.7rem',
            color: 'rgba(226,232,240,0.25)',
            lineHeight: 1.7,
          }}
        >
          vote encrypted with election public key — ZK proof verifies eligibility and
          correctness without revealing your choice
        </Typography>
      </Box>

      {/* Success Dialog */}
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
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
          },
        }}
      >
        <DialogTitle
          sx={{
            fontFamily: monoFont,
            fontSize: '0.82rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#39ff14',
            textShadow: '0 0 10px rgba(57,255,20,0.4)',
            borderBottom: '1px solid rgba(57,255,20,0.15)',
            py: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#39ff14',
              boxShadow: '0 0 8px rgba(57,255,20,0.8)',
              flexShrink: 0,
            }}
          />
          vote confirmed
        </DialogTitle>

        <DialogContent sx={{ pt: 2.5, pb: 1 }}>
          {/* Voted option */}
          <Box sx={dataBox}>
            <Typography
              sx={{
                fontFamily: monoFont,
                fontSize: '0.65rem',
                color: 'rgba(226,232,240,0.25)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                mb: 0.5,
              }}
            >
              selected option
            </Typography>
            <Typography
              sx={{
                fontFamily: monoFont,
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#e2e8f0',
              }}
            >
              &gt; {confirmationData?.option}
            </Typography>
          </Box>

          {/* Weight (quadratic only) */}
          {confirmationData?.votingMode === 'quadratic' && (
            <Box sx={dataBox}>
              <Typography
                sx={{
                  fontFamily: monoFont,
                  fontSize: '0.65rem',
                  color: 'rgba(226,232,240,0.25)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  mb: 0.5,
                }}
              >
                vote weight (quadratic)
              </Typography>
              <Typography
                sx={{
                  fontFamily: monoFont,
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#00f5d4',
                }}
              >
                {confirmationData?.weight?.toFixed(2)} votes
              </Typography>
            </Box>
          )}

          {/* Timestamp */}
          <Box sx={dataBox}>
            <Typography
              sx={{
                fontFamily: monoFont,
                fontSize: '0.65rem',
                color: 'rgba(226,232,240,0.25)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                mb: 0.5,
              }}
            >
              timestamp
            </Typography>
            <Typography sx={{ fontFamily: monoFont, fontSize: '0.78rem', color: 'rgba(226,232,240,0.55)' }}>
              {confirmationData?.timestamp}
            </Typography>
          </Box>

          {/* Nullifier */}
          <Box sx={dataBox}>
            <Typography
              sx={{
                fontFamily: monoFont,
                fontSize: '0.65rem',
                color: 'rgba(226,232,240,0.25)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                mb: 0.5,
              }}
            >
              nullifier
            </Typography>
            <Typography
              sx={{
                fontFamily: monoFont,
                fontSize: '0.7rem',
                color: 'rgba(226,232,240,0.35)',
                wordBreak: 'break-all',
                lineHeight: 1.6,
              }}
            >
              {confirmationData?.nullifier}
            </Typography>
          </Box>

          {/* Final note */}
          <Box sx={{ borderLeft: '2px solid rgba(226,232,240,0.08)', pl: 1.5, mt: 1 }}>
            <Typography
              sx={{
                fontFamily: monoFont,
                fontSize: '0.7rem',
                color: 'rgba(226,232,240,0.25)',
                lineHeight: 1.65,
              }}
            >
              vote stored on-chain — cannot be changed or reversed
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(226,232,240,0.06)' }}>
          <Button
            onClick={() => setShowConfirmation(false)}
            disableRipple
            sx={{
              fontFamily: monoFont,
              fontSize: '0.75rem',
              letterSpacing: '0.08em',
              textTransform: 'lowercase',
              color: 'rgba(226,232,240,0.45)',
              border: '1px solid rgba(226,232,240,0.1)',
              borderRadius: '2px',
              px: 2,
              py: 0.75,
              '&:hover': {
                borderColor: 'rgba(0,245,212,0.35)',
                color: '#00f5d4',
                background: 'rgba(0,245,212,0.04)',
              },
            }}
          >
            &gt; close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default VoteForm;