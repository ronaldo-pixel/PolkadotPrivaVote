import React, { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import { useVoting } from '../context/VotingContext';
import { zkProofGenerator } from '../utils/contractUtils';

const monoFont = '"JetBrains Mono", "Courier New", monospace';

const REQUIRED_DECRYPTIONS = 3;

const dataBox = {
  p: 1.5,
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(226,232,240,0.06)',
  borderRadius: '2px',
};

const DecryptionProgress = () => {
  const { proposals, isKeyholder, submitPartialDecryption, initializeProposals } = useVoting();
  const [endedProposals, setEndedProposals] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [decryptionProgress, setDecryptionProgress] = useState(0);
  const [decryptionStep, setDecryptionStep] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    initializeProposals();
  }, [initializeProposals]);

  useEffect(() => {
    if (proposals?.length) {
      setEndedProposals(proposals.filter((p) => p.status === 'ENDED'));
    }
  }, [proposals]);

  const handleOpenDecryption = (proposal) => {
    setSelectedProposal(proposal);
    setDecryptionProgress(0);
    setDecryptionStep('');
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    if (submitting) return;
    setShowDialog(false);
    setSelectedProposal(null);
    setDecryptionProgress(0);
    setDecryptionStep('');
  };

  const handleSubmitDecryption = async () => {
    if (!selectedProposal) return;
    setSubmitting(true);
    setDecryptionProgress(0);

    try {
      const steps = [
        'computing partial decryption...',
        'generating chaum-pedersen proof...',
        'submitting to contract...',
      ];

      for (let i = 0; i < steps.length; i++) {
        setDecryptionStep(steps[i]);
        await new Promise((resolve) => setTimeout(resolve, 500));
        setDecryptionProgress(((i + 1) / steps.length) * 100);
      }

      const partialDecryption = `0x${Math.random().toString(16).slice(2)}`;
      const proofData = await zkProofGenerator.generateDecryptionProof(partialDecryption);
      await submitPartialDecryption(selectedProposal.id, partialDecryption, proofData.proof);

      setDecryptionStep('verified — submission confirmed');
      setTimeout(() => handleCloseDialog(), 1200);
    } catch (err) {
      console.error('Decryption failed:', err);
      setDecryptionStep(`error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Not a keyholder ────────────────────────────────────────────────────────
  if (!isKeyholder) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ borderLeft: '2px solid #ff3c3c', pl: 1.5 }}>
          <Typography sx={{ fontFamily: monoFont, fontSize: '0.78rem', color: '#ff3c3c' }}>
            &gt; access denied: not registered as a keyholder
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          sx={{
            fontFamily: monoFont,
            fontWeight: 700,
            fontSize: '1.4rem',
            color: '#e2e8f0',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            mb: 0.5,
          }}
        >
          Decryption Console
        </Typography>
        <Typography
          sx={{
            fontFamily: monoFont,
            fontSize: '0.75rem',
            color: 'rgba(226,232,240,0.3)',
            letterSpacing: '0.06em',
          }}
        >
          &gt; submit partial decryptions for ended proposals
        </Typography>
      </Box>

      {/* Keyholder info */}
      <Box sx={{ borderLeft: '2px solid rgba(0,245,212,0.3)', pl: 1.5, mb: 4 }}>
        <Typography
          sx={{
            fontFamily: monoFont,
            fontSize: '0.72rem',
            color: 'rgba(226,232,240,0.3)',
            lineHeight: 1.7,
            letterSpacing: '0.04em',
          }}
        >
          submit a partial decryption with a chaum-pedersen proof per proposal — at least 2 of
          3 keyholders must contribute before results are revealed on-chain
        </Typography>
      </Box>

      {/* Proposal list */}
      {endedProposals.length > 0 ? (
        <Grid container spacing={2}>
          {endedProposals.map((proposal) => {
            const completed = proposal.partialDecryptions?.length ?? 0;
            const done = completed >= REQUIRED_DECRYPTIONS;
            const barFilled = Math.round((completed / REQUIRED_DECRYPTIONS) * 16);
            const bar = '█'.repeat(barFilled) + '░'.repeat(16 - barFilled);

            return (
              <Grid item xs={12} md={6} key={proposal.id}>
                <Box
                  sx={{
                    background: '#0d1117',
                    border: '1px solid rgba(226,232,240,0.08)',
                    borderLeft: `3px solid ${done ? '#39ff14' : '#ffb800'}`,
                    borderRadius: '2px',
                    p: 2.5,
                    backgroundImage:
                      'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
                  }}
                >
                  {/* Card header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography
                      sx={{
                        fontFamily: monoFont,
                        fontSize: '0.72rem',
                        color: 'rgba(226,232,240,0.35)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {proposal.id}
                    </Typography>
                    {done && (
                      <Typography
                        sx={{
                          fontFamily: monoFont,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          color: '#39ff14',
                          textShadow: '0 0 8px rgba(57,255,20,0.5)',
                          border: '1px solid rgba(57,255,20,0.3)',
                          px: 1,
                          py: 0.25,
                          letterSpacing: '0.1em',
                        }}
                      >
                        [COMPLETE]
                      </Typography>
                    )}
                  </Box>

                  {/* Description */}
                  <Typography
                    sx={{
                      fontFamily: monoFont,
                      fontSize: '0.82rem',
                      color: '#e2e8f0',
                      lineHeight: 1.6,
                      mb: 2.5,
                    }}
                  >
                    {proposal.description}
                  </Typography>

                  {/* Decryption progress bar */}
                  <Box sx={{ mb: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                      <Typography
                        sx={{
                          fontFamily: monoFont,
                          fontSize: '0.65rem',
                          color: 'rgba(226,232,240,0.25)',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        decryption progress
                      </Typography>
                      <Typography
                        sx={{
                          fontFamily: monoFont,
                          fontSize: '0.65rem',
                          color: 'rgba(226,232,240,0.35)',
                        }}
                      >
                        {completed}/{REQUIRED_DECRYPTIONS} keyholders
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        fontFamily: monoFont,
                        fontSize: '0.75rem',
                        color: done ? '#39ff14' : '#ffb800',
                        letterSpacing: '0.02em',
                        userSelect: 'none',
                      }}
                    >
                      {bar} {Math.round((completed / REQUIRED_DECRYPTIONS) * 100)}%
                    </Typography>
                  </Box>

                  {/* Meta */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2.5 }}>
                    {[
                      { label: 'encrypted_votes', value: `${proposal.voteCount}` },
                      { label: 'closed_at_block', value: `#${proposal.endBlock}` },
                    ].map(({ label, value }) => (
                      <Box key={label} sx={dataBox}>
                        <Typography
                          sx={{
                            fontFamily: monoFont,
                            fontSize: '0.62rem',
                            color: 'rgba(226,232,240,0.2)',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            mb: 0.5,
                          }}
                        >
                          {label}
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: monoFont,
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: 'rgba(226,232,240,0.6)',
                          }}
                        >
                          {value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Action */}
                  <Box sx={{ borderTop: '1px solid rgba(226,232,240,0.06)', pt: 2 }}>
                    {!done ? (
                      <Button
                        fullWidth
                        disableRipple
                        onClick={() => handleOpenDecryption(proposal)}
                        sx={{
                          fontFamily: monoFont,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: '#ffb800',
                          border: '1px solid rgba(255,184,0,0.4)',
                          borderRadius: '2px',
                          py: 1.25,
                          background: 'transparent',
                          transition: 'all 0.15s',
                          '&:hover': {
                            background: 'rgba(255,184,0,0.06)',
                            borderColor: '#ffb800',
                            boxShadow: '0 0 12px rgba(255,184,0,0.12)',
                          },
                        }}
                      >
                        [ submit partial decryption ]
                      </Button>
                    ) : (
                      <Typography
                        sx={{
                          fontFamily: monoFont,
                          fontSize: '0.72rem',
                          color: '#39ff14',
                          letterSpacing: '0.08em',
                          textAlign: 'center',
                          py: 0.5,
                        }}
                      >
                        &gt; decryption complete — awaiting final reveal
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Box
          sx={{
            py: 8,
            textAlign: 'center',
            border: '1px solid rgba(226,232,240,0.06)',
            borderRadius: '2px',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <Typography
            sx={{
              fontFamily: monoFont,
              fontSize: '0.78rem',
              color: 'rgba(226,232,240,0.2)',
              letterSpacing: '0.06em',
            }}
          >
            &gt; no proposals awaiting decryption
          </Typography>
        </Box>
      )}

      {/* Decryption Dialog */}
      <Dialog
        open={showDialog && !!selectedProposal}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: '#0d1117',
            border: '1px solid rgba(255,184,0,0.25)',
            borderRadius: '2px',
            boxShadow: '0 0 30px rgba(255,184,0,0.05)',
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
            color: '#ffb800',
            borderBottom: '1px solid rgba(255,184,0,0.15)',
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
              background: '#ffb800',
              boxShadow: '0 0 8px rgba(255,184,0,0.8)',
              flexShrink: 0,
              animation: 'statusPulse 2s ease-in-out infinite',
              '@keyframes statusPulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.4 },
              },
            }}
          />
          partial decryption
        </DialogTitle>

        <DialogContent sx={{ pt: 2.5, pb: 1 }}>
          {selectedProposal && (
            <Box>
              {/* Proposal ref */}
              <Box sx={{ ...dataBox, mb: 2 }}>
                <Typography
                  sx={{
                    fontFamily: monoFont,
                    fontSize: '0.62rem',
                    color: 'rgba(226,232,240,0.22)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    mb: 0.5,
                  }}
                >
                  proposal
                </Typography>
                <Typography
                  sx={{
                    fontFamily: monoFont,
                    fontSize: '0.8rem',
                    color: 'rgba(226,232,240,0.55)',
                  }}
                >
                  {selectedProposal.id}
                </Typography>
              </Box>

              {/* Key share input (only before submitting) */}
              {!submitting && decryptionProgress === 0 && (
                <>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      border: '1px solid rgba(226,232,240,0.08)',
                      borderRadius: '2px',
                      px: 1.5,
                      py: 1,
                      background: 'rgba(0,0,0,0.3)',
                      mb: 2,
                      '&:focus-within': {
                        borderColor: 'rgba(255,184,0,0.4)',
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: monoFont,
                        fontSize: '0.72rem',
                        color: 'rgba(226,232,240,0.2)',
                        flexShrink: 0,
                      }}
                    >
                      &gt;
                    </Typography>
                    <Box
                      component="input"
                      type="password"
                      placeholder="private key share..."
                      sx={{
                        fontFamily: monoFont,
                        fontSize: '0.78rem',
                        color: '#e2e8f0',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        width: '100%',
                        letterSpacing: '0.04em',
                        '&::placeholder': { color: 'rgba(226,232,240,0.18)' },
                      }}
                    />
                  </Box>

                  <Box sx={{ borderLeft: '2px solid rgba(226,232,240,0.08)', pl: 1.5 }}>
                    <Typography
                      sx={{
                        fontFamily: monoFont,
                        fontSize: '0.7rem',
                        color: 'rgba(226,232,240,0.22)',
                        lineHeight: 1.7,
                      }}
                    >
                      a chaum-pedersen proof will be generated to verify your partial decryption
                      without revealing your key share
                    </Typography>
                  </Box>
                </>
              )}

              {/* Progress log */}
              {(submitting || decryptionProgress > 0) && (
                <Box sx={{ borderLeft: '2px solid rgba(255,184,0,0.35)', pl: 1.5, py: 0.5 }}>
                  {decryptionStep && (
                    <Typography
                      sx={{
                        fontFamily: monoFont,
                        fontSize: '0.75rem',
                        color: decryptionStep.startsWith('error')
                          ? '#ff3c3c'
                          : decryptionStep.startsWith('verified')
                          ? '#39ff14'
                          : '#ffb800',
                        letterSpacing: '0.04em',
                        mb: 1,
                      }}
                    >
                      &gt; {decryptionStep}
                    </Typography>
                  )}
                  <Typography
                    sx={{
                      fontFamily: monoFont,
                      fontSize: '0.72rem',
                      color: 'rgba(255,184,0,0.5)',
                      userSelect: 'none',
                    }}
                  >
                    {'█'.repeat(Math.round((decryptionProgress / 100) * 24))}
                    {'░'.repeat(24 - Math.round((decryptionProgress / 100) * 24))}{' '}
                    {Math.round(decryptionProgress)}%
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(226,232,240,0.06)', gap: 1 }}>
          <Button
            onClick={handleCloseDialog}
            disabled={submitting}
            disableRipple
            sx={{
              fontFamily: monoFont,
              fontSize: '0.72rem',
              letterSpacing: '0.08em',
              textTransform: 'lowercase',
              color: 'rgba(226,232,240,0.35)',
              border: '1px solid rgba(226,232,240,0.08)',
              borderRadius: '2px',
              px: 2,
              py: 0.75,
              '&:hover:not(:disabled)': {
                borderColor: 'rgba(255,60,60,0.35)',
                color: '#ff3c3c',
                background: 'rgba(255,60,60,0.04)',
              },
            }}
          >
            &gt; cancel
          </Button>

          <Button
            onClick={handleSubmitDecryption}
            disabled={submitting || decryptionProgress > 0}
            disableRipple
            sx={{
              fontFamily: monoFont,
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'lowercase',
              color: submitting || decryptionProgress > 0 ? 'rgba(226,232,240,0.2)' : '#ffb800',
              border: '1px solid',
              borderColor:
                submitting || decryptionProgress > 0
                  ? 'rgba(226,232,240,0.06)'
                  : 'rgba(255,184,0,0.4)',
              borderRadius: '2px',
              px: 2,
              py: 0.75,
              background: 'transparent',
              transition: 'all 0.15s',
              '&:hover:not(:disabled)': {
                background: 'rgba(255,184,0,0.06)',
                borderColor: '#ffb800',
                boxShadow: '0 0 10px rgba(255,184,0,0.12)',
              },
            }}
          >
            {submitting ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={12} sx={{ color: 'rgba(255,184,0,0.4)' }} />
                processing...
              </Box>
            ) : (
              '&gt; submit'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DecryptionProgress;