import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Grid,
  CircularProgress,
} from '@mui/material';
import { useVoting } from '../context/VotingContext';
import ProposalStatusTimeline from '../components/ProposalStatusTimeline';
import VoteForm from '../components/VoteForm';
import { formatUtils } from '../utils/contractUtils';

const monoFont = "JetBrains Mono";

const STATUS_COLOR = {
  ACTIVE:      '#00f5d4',
  PENDING_DKG: '#ffb800',
  ENDED:       '#94a3b8',
  REVEALED:    '#39ff14',
  CANCELLED:   '#ff3c3c',
};

const dataBox = {
  p: 1.5,
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(226,232,240,0.06)',
  borderRadius: '2px',
  height: '100%',
};

const SectionLabel = ({ children }) => (
  <Typography
    sx={{
      fontFamily: monoFont,
      fontSize: '1rem',
      color: 'rgba(255, 255, 255, 1)',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      mb: 2,
    }}
  >
    {children}
  </Typography>
);

const ProposalDetail = () => {
  const { id } = useParams();
  const { proposals, initializeProposals, userAddress, userVotes } = useVoting();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('results');

  useEffect(() => {
    initializeProposals();
  }, [initializeProposals]);

  useEffect(() => {
    if (proposals.length > 0) {
      setProposal(proposals.find((p) => p.id === id) ?? null);
      setLoading(false);
    }
  }, [proposals, id]);

  if (loading || !proposal) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={20} sx={{ color: 'rgba(0,245,212,0.4)' }} />
      </Box>
    );
  }

  const accentColor = STATUS_COLOR[proposal.status] ?? '#94a3b8';
  const hasVoted = userVotes.includes(proposal.id);

  // Unicode bar helper (20 chars wide)
  const makeBar = (pct, winner = false) => {
    const filled = Math.round((pct / 100) * 20);
    const color  = winner ? '#39ff14' : '#00f5d4';
    return { bar: '█'.repeat(filled) + '░'.repeat(20 - filled), color };
  };

  const TABS = ['results', 'details'];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          mb: 4,
          pb: 3,
          borderBottom: '1px solid rgba(226,232,240,0.06)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography
            sx={{
              fontFamily: monoFont,
              fontWeight: 700,
              fontSize: '1.8rem',
              color: '#00f5d4',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {proposal.id}
          </Typography>

          <Typography
            sx={{
              fontFamily: monoFont,
              fontSize: '1.0rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: accentColor,
              textShadow: `0 0 8px ${accentColor}80`,
              border: `1px solid ${accentColor}40`,
              px: 1,
              py: 0.25,
              lineHeight: 1.6,
              flexShrink: 0,
              animation:
                proposal.status === 'ACTIVE' || proposal.status === 'PENDING_DKG'
                  ? 'statusPulse 2.5s ease-in-out infinite'
                  : 'none',
              '@keyframes statusPulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          >
            [{proposal.status}]
          </Typography>
        </Box>

        <Typography
          sx={{
            fontFamily: monoFont,
            fontSize: '1.2rem',
            color: '#00f5d4',
            lineHeight: 1.65,
            letterSpacing: '0.02em',
          }}
        >
          {proposal.description}
        </Typography>
      </Box>

      {/* ── Status timeline ─────────────────────────────────────────────────── */}
      <ProposalStatusTimeline proposal={proposal} />

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <Grid container spacing={1.5} sx={{ mb: 4 }}>
        {[
          {
            label: 'voting_mode',
            value: proposal.votingMode,
            sub: proposal.votingMode === 'quadratic' ? 'vote power = sqrt(tokens)' : '1 token = 1 vote',
          },
          {
            label: 'eligibility_threshold',
            value: `${proposal.eligibilityThreshold}`,
            sub: 'minimum tokens required',
          },
          {
            label: 'min_voter_threshold',
            value: `${proposal.minVoterThreshold}`,
            sub: 'for proposal validity',
          },
          {
            label: 'current_participation',
            value: `${proposal.totalParticipation}`,
            sub: `${Math.round((proposal.totalParticipation / proposal.minVoterThreshold) * 100)}% of required`,
          },
        ].map(({ label, value, sub }) => (
          <Grid item xs={12} sm={6} md={3} key={label}>
            <Box sx={dataBox}>
              <Typography
                sx={{
                  fontFamily: monoFont,
                  fontSize: '0.62rem',
                  color: '#00f5d4',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  mb: 0.75,
                }}
              >
                {label}
              </Typography>
              <Typography
                sx={{
                  fontFamily: monoFont,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#e2e8f0',
                  mb: 0.25,
                }}
              >
                {value}
              </Typography>
              <Typography
                sx={{
                  fontFamily: monoFont,
                  fontSize: '0.65rem',
                  color: 'rgb(155, 155, 155)',
                  letterSpacing: '0.04em',
                }}
              >
                {sub}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          borderBottom: '1px solid rgba(226,232,240,0.06)',
          mb: 3,
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <Box
              key={tab}
              onClick={() => setActiveTab(tab)}
              sx={{
                fontFamily: monoFont,
                fontSize: '1rem',
                letterSpacing: '0.08em',
                textTransform: 'lowercase',
                color: active ? '#00f5d4' : 'rgba(226,232,240,0.3)',
                borderBottom: active ? '1px solid #00f5d4' : '1px solid transparent',
                px: 2.5,
                py: 1.25,
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.15s',
                '&:hover': active ? {} : { color: 'rgba(226,232,240,0.55)' },
              }}
            >
              {active ? `> ${tab}` : `  ${tab}`}
            </Box>
          );
        })}
      </Box>

      {/* ── Results tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'results' && (
        <Box
          sx={{
            background: '#0d1117',
            border: '1px solid rgba(226,232,240,0.08)',
            borderRadius: '2px',
            p: 3,
            mb: 4,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
          }}
        >
          <SectionLabel>Vote Distribution </SectionLabel>

          {proposal.status === 'ENDED' ? (
            <Box sx={{ borderLeft: '2px solid #94a3b8', pl: 1.5 }}>
              <Typography
                sx={{
                  fontFamily: monoFont,
                  fontSize: '0.75rem',
                  color: '#00f5d4',
                  letterSpacing: '0.04em',
                }}
              >
                &gt; voting closed — awaiting keyholder decryption
              </Typography>
            </Box>
          ) : (
            <>
              {proposal.status === 'ACTIVE' && (
                <Typography
                  sx={{
                    fontFamily: monoFont,
                    fontSize: '1rem',
                    color: 'rgba(226,232,240,0.2)',
                    letterSpacing: '0.04em',
                    mb: 2.5,
                  }}
                >
                  live vote count — encrypted ballots cannot be attributed to voters
                </Typography>
              )}

              {proposal.options.map((option, idx) => {
                const count = proposal.voteWeight[option] ?? 0;
                const pct =
                  proposal.totalParticipation > 0
                    ? (count / proposal.totalParticipation) * 100
                    : 0;
                const isWinner =
                  proposal.status === 'REVEALED' && option === proposal.winner;
                const { bar, color } = makeBar(pct, isWinner);

                return (
                  <Box key={idx} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography
                        sx={{
                          fontFamily: monoFont,
                          fontSize: '1.0rem',
                          mb: 1,
                          color: isWinner ? '#39ff14' : 'rgba(255, 255, 255, 1)',
                          fontWeight: isWinner ? 700 : 400,
                          textShadow: isWinner ? '0 0 8px rgba(57,255,20,0.4)' : 'none',
                        }}
                      >
                        {option}
                        {isWinner && (
                          <Box
                            component="span"
                            sx={{
                              fontFamily: monoFont,
                              fontSize: '0.65rem',
                              color: '#39ff14',
                              ml: 1,
                              letterSpacing: '0.1em',
                            }}
                          >
                            [WINNER]
                          </Box>
                        )}
                      </Typography>
                      <Typography
                        sx={{
                          fontFamily: monoFont,
                          fontSize: '0.72rem',
                          color: 'rgba(226,232,240,0.35)',
                        }}
                      >
                        {count} / {pct.toFixed(1)}%
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        fontFamily: monoFont,
                        fontSize: '0.72rem',
                        color,
                        userSelect: 'none',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {bar}
                    </Typography>
                  </Box>
                );
              })}

              {proposal.status === 'REVEALED' && (
                <Box sx={{ borderLeft: '2px solid rgba(57,255,20,0.3)', pl: 1.5, mt: 3 }}>
                  <Typography
                    sx={{
                      fontFamily: monoFont,
                      fontSize: '0.72rem',
                      color: '#39ff14',
                      textShadow: '0 0 8px rgba(57,255,20,0.4)',
                      letterSpacing: '0.06em',
                    }}
                  >
                    &gt; results verified on-chain — winner: {proposal.winner}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>
      )}

      {/* ── Details tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'details' && (
        <Box
          sx={{
            background: '#0d1117',
            border: '1px solid rgba(226,232,240,0.08)',
            borderRadius: '2px',
            p: 3,
            mb: 4,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
          }}
        >
          <SectionLabel>Proposal Details</SectionLabel>

          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6}>
              <Box sx={dataBox}>
                <Typography sx={{ fontFamily: monoFont, fontSize: '0.62rem', color: 'rgb(255, 255, 255)', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>start block</Typography>
                <Typography sx={{ fontFamily: monoFont, fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255, 255, 255, 1)' }}>#{proposal.startBlock}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={dataBox}>
                <Typography sx={{ fontFamily: monoFont, fontSize: '0.62rem', color: 'rgba(255, 255, 255, 1)', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>end block</Typography>
                <Typography sx={{ fontFamily: monoFont, fontSize: '0.85rem', fontWeight: 700, color: '#ff3c3c' }}>#{proposal.endBlock}</Typography>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ ...dataBox, height: 'auto' }}>
                <Typography sx={{ fontFamily: monoFont, fontSize: '0.62rem', color: 'rgba(255, 255, 255, 1)', letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1 }}>voting options</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {proposal.options.map((option, idx) => (
                    <Typography
                      key={idx}
                      sx={{
                        fontFamily: monoFont,
                        fontSize: '0.72rem',
                        color: 'rgba(255, 255, 255,1)',
                        border: '1px solid rgba(226,232,240,0.1)',
                        px: 1,
                        py: 0.25,
                        lineHeight: 1.6,
                      }}
                    >
                       {option}
                    </Typography>
                  ))}
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* ── Vote form (ACTIVE only) ──────────────────────────────────────────── */}
      {proposal.status === 'ACTIVE' && userAddress && (
        <Box
          sx={{
            background: '#0d1117',
            fontSize:'1.0rem',
            border: '1px solid rgba(226,232,240,0.08)',
            borderLeft: '3px solid rgba(0,245,212,0.4)',
            borderRadius: '2px',
            p: 3,
            mb: 4,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
          }}
        >
          <SectionLabel>/* cast vote */</SectionLabel>

          {hasVoted ? (
            <Box sx={{ borderLeft: '2px solid #39ff14', pl: 1.5 }}>
              <Typography
                sx={{
                  fontFamily: monoFont,
                  fontSize: '0.75rem',
                  color: '#39ff14',
                  letterSpacing: '0.04em',
                }}
              >
                &gt; vote recorded — encrypted ballot stored on-chain
              </Typography>
            </Box>
          ) : (
            <VoteForm
              proposal={proposal}
              onVoteSuccess={() => console.log('Vote submitted successfully')}
            />
          )}
        </Box>
      )}

      {/* ── Status notices ──────────────────────────────────────────────────── */}
      {proposal.status === 'ENDED' && (
        <Box sx={{ borderLeft: '2px solid #94a3b8', pl: 1.5, mb: 4 }}>
          <Typography
            sx={{
              fontFamily: monoFont,
              fontSize: '0.75rem',
              color: '#94a3b8',
              letterSpacing: '0.04em',
            }}
          >
            &gt; voting ended — results awaiting keyholder decryption
          </Typography>
        </Box>
      )}

      {proposal.status === 'REVEALED' && (
        <Box sx={{ borderLeft: '2px solid #39ff14', pl: 1.5, mb: 4 }}>
          <Typography
            sx={{
              fontFamily: monoFont,
              fontSize: '0.75rem',
              color: '#39ff14',
              textShadow: '0 0 8px rgba(57,255,20,0.4)',
              letterSpacing: '0.04em',
            }}
          >
            &gt; results revealed — winning option highlighted above
          </Typography>
        </Box>
      )}

      {!userAddress && proposal.status === 'ACTIVE' && (
        <Box sx={{ borderLeft: '2px solid rgba(0,245,212,0.3)', pl: 1.5, mb: 4 }}>
          <Typography
            sx={{
              fontFamily: monoFont,
              fontSize: '0.75rem',
              color: 'rgba(0,245,212,0.6)',
              letterSpacing: '0.04em',
            }}
          >
            &gt; connect your wallet to vote on this proposal
          </Typography>
        </Box>
      )}
    </Container>
  );
};

export default ProposalDetail;