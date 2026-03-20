import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Box, Typography, Grid } from '@mui/material';
import { useVoting } from '../context/VotingContext';
import ProposalStatusTimeline from '../components/ProposalStatusTimeline';
import VoteForm from '../components/VoteForm';
import { formatUtils } from '../utils/contractUtils';

const monoFont = '"Share Tech Mono", "JetBrains Mono", "Courier New", monospace';
const bodyFont = '"IBM Plex Mono", "Courier New", monospace';

const STATUS_COLOR = {
  ACTIVE:      '#00f5d4',
  PENDING_DKG: '#ffb800',
  ENDED:       '#64748b',
  REVEALED:    '#39ff14',
  CANCELLED:   '#ff3c3c',
};

const dataBox = {
  p: 1.5,
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid #1e2a35',
  borderRadius: '2px',
  height: '100%',
};

const BlinkCursor = () => (
  <Box component="span" sx={{
    display: 'inline-block', width: '6px', height: '0.8em',
    background: '#00f5d4', ml: '3px', verticalAlign: 'middle',
    animation: 'blink 1s step-end infinite',
    '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
  }} />
);

const ScanBar = () => (
  <Box sx={{
    width: '120px', height: '2px', background: '#1e2a35',
    borderRadius: '2px', overflow: 'hidden', position: 'relative', flexShrink: 0,
  }}>
    <Box sx={{
      position: 'absolute', top: 0, bottom: 0, width: '36px', background: '#00f5d4',
      animation: 'scanProg 1.2s linear infinite',
      '@keyframes scanProg': { '0%': { left: '-40px' }, '100%': { left: '100%' } },
    }} />
  </Box>
);

const SectionDivider = ({ children }) => (
  <Typography sx={{
    fontFamily: bodyFont, fontSize: '0.65rem', color: '#64748b',
    letterSpacing: '0.12em', mb: '1.5rem',
  }}>
    {`/* ── ${children} ── */`}
  </Typography>
);

const makeBar = (pct, winner = false) => {
  const filled = Math.round((pct / 100) * 20);
  return {
    bar:   '█'.repeat(filled) + '░'.repeat(20 - filled),
    color: winner ? '#39ff14' : '#00f5d4',
  };
};

const ProposalDetail = () => {
  const { id } = useParams();
  const { proposals, getProposalDetail, userAddress, userVotes, loading } = useVoting();
  const [proposal,  setProposal]  = useState(null);
  const [pageLoad,  setPageLoad]  = useState(true);
  const [activeTab, setActiveTab] = useState('results');

  useEffect(() => {
    getProposalDetail(id).then(detail => {
      setProposal(detail);
      setPageLoad(false);
    }).catch(() => setPageLoad(false));
  }, [id, getProposalDetail]);

  useEffect(() => {
    const found = proposals.find(p => p.id === id);
    if (found) setProposal(found);
  }, [proposals, id]);

  if (pageLoad) {
    return (
      <Box sx={{ fontFamily: bodyFont, background: '#080c10', minHeight: '100vh', borderLeft: '2px solid rgba(0,245,212,0.12)' }}>
        <Box sx={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 2rem' }}>
          <Box sx={{ fontFamily: monoFont, fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.12em', mb: '1.75rem' }}>
            {`> /proposals/${id}`}<BlinkCursor />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
            <ScanBar />
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.7rem', color: '#00f5d4', letterSpacing: '0.06em' }}>
              &gt; loading proposal...
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  if (!proposal) {
    return (
      <Box sx={{ fontFamily: bodyFont, background: '#080c10', minHeight: '100vh', borderLeft: '2px solid rgba(0,245,212,0.12)' }}>
        <Box sx={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 2rem' }}>
          <Box sx={{ borderLeft: '2px solid #ff3c3c', pl: 1.5, py: 0.5 }}>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ff3c3c', letterSpacing: '0.04em' }}>
              &gt; proposal {id} not found
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  const accentColor = STATUS_COLOR[proposal.status] ?? '#64748b';
  const hasVoted    = userVotes.includes(proposal.id);
  const TABS        = ['results', 'details'];

  const participationPct = proposal.minVoterThreshold > 0
    ? Math.min(Math.round((proposal.totalParticipation / proposal.minVoterThreshold) * 100), 100)
    : 0;
  const partBar         = '█'.repeat(Math.round(participationPct / 100 * 16)) + '░'.repeat(16 - Math.round(participationPct / 100 * 16));

  return (
    <Box sx={{ fontFamily: bodyFont, background: '#080c10', minHeight: '100vh', borderLeft: '2px solid rgba(0,245,212,0.12)' }}>
      <Container maxWidth="lg" sx={{ py: '2.5rem' }}>

        {/* Breadcrumb */}
        <Box sx={{ fontFamily: monoFont, fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.12em', mb: '1.75rem' }}>
          {`> /proposals/${proposal.id}`}<BlinkCursor />
        </Box>

        {/* Header */}
        <Box sx={{ mb: '0.75rem' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', mb: '0.5rem' }}>
            <Typography sx={{
              fontFamily: monoFont, fontWeight: 400, fontSize: '1.5rem',
              color: '#e2e8f0', letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              PROPOSAL #{proposal.id}
            </Typography>
            <Typography sx={{
              fontFamily: monoFont, fontSize: '0.68rem', fontWeight: 400,
              letterSpacing: '0.14em', color: accentColor,
              border: `1px solid ${accentColor}40`,
              borderRadius: '2px', px: 1, py: 0.25, lineHeight: 1.6, flexShrink: 0,
              animation: ['ACTIVE','PENDING_DKG'].includes(proposal.status)
                ? 'glowPulse 2.5s ease-in-out infinite' : 'none',
              '@keyframes glowPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.45 } },
            }}>
              [{proposal.status}]
            </Typography>
          </Box>

          <Typography sx={{ fontFamily: monoFont, fontSize: '0.68rem', color: '#334155', letterSpacing: '0.06em', mb: '0.75rem' }}>
            $ {formatUtils.formatAddress(proposal.creator)}
          </Typography>

          <Typography sx={{ fontFamily: bodyFont, fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.7, letterSpacing: '0.03em' }}>
            {proposal.description}
          </Typography>
        </Box>

        {/* ASCII hr */}
        <Box sx={{ fontFamily: bodyFont, fontSize: '0.6rem', color: '#1e2a35', overflow: 'hidden', whiteSpace: 'nowrap', userSelect: 'none', my: '1.5rem' }}>
          {'─'.repeat(120)}
        </Box>

        {/* Status timeline */}
        <ProposalStatusTimeline proposal={proposal} />

        {/* Stat blocks */}
        <Grid container spacing={1.5} sx={{ mb: '2rem' }}>
          {[
            {
              label: 'VOTING_MODE',
              value: proposal.votingMode.toUpperCase(),
              sub: proposal.votingMode === 'quadratic' ? 'weight = √(tokens)' : '1 token = 1 vote',
              color: '#00f5d4',
            },
            {
              label: 'BALANCE_MIN_REQ',
              value: proposal.eligibilityThreshold === 0 ? 'none' : proposal.eligibilityThreshold.toLocaleString(),
              sub: 'minimum tokens to vote',
              color: '#e2e8f0',
            },
            {
              label: 'MIN_VOTER_THRESHOLD',
              value: proposal.minVoterThreshold.toLocaleString(),
              sub: 'required for validity',
              color: '#e2e8f0',
            },
            {
              label: 'PARTICIPATION',
              value: proposal.totalParticipation.toLocaleString(),
              sub: `${participationPct}% of threshold`,
              color: participationPct >= 100 ? '#39ff14' : '#00f5d4',
            },
          ].map(({ label, value, sub, color }) => (
            <Grid item xs={6} sm={3} key={label}>
              <Box sx={dataBox}>
                <Typography sx={{ fontFamily: monoFont, fontSize: '0.55rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>
                  {label}
                </Typography>
                <Typography sx={{ fontFamily: monoFont, fontSize: '0.95rem', fontWeight: 400, color, mb: '4px', letterSpacing: '0.04em' }}>
                  {value}
                </Typography>
                <Typography sx={{ fontFamily: bodyFont, fontSize: '0.62rem', color: '#334155', letterSpacing: '0.03em' }}>
                  {sub}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Participation bar */}
        <Box sx={{ mb: '2rem' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: '4px' }}>
            <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              PARTICIPATION
            </Typography>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.62rem', color: '#334155' }}>
              {proposal.totalParticipation}/{proposal.minVoterThreshold}
            </Typography>
          </Box>
          <Typography sx={{
            fontFamily: bodyFont, fontSize: '0.75rem', userSelect: 'none',
            color: participationPct >= 100 ? '#39ff14' : '#00f5d4',
            letterSpacing: '0.02em',
            animation: participationPct >= 100 ? 'glowPulse 2s ease-in-out infinite' : 'none',
          }}>
            {partBar} {participationPct}%
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ display: 'flex', borderBottom: '1px solid #1e2a35', mb: '1.75rem' }}>
          {TABS.map(tab => {
            const active = activeTab === tab;
            return (
              <Box
                key={tab}
                onClick={() => setActiveTab(tab)}
                sx={{
                  fontFamily: monoFont, fontSize: '0.62rem', letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: active ? '#00f5d4' : '#64748b',
                  borderBottom: active ? '2px solid #00f5d4' : '2px solid transparent',
                  mb: '-1px', px: '14px', py: '7px',
                  cursor: 'pointer', userSelect: 'none', transition: 'color 0.15s',
                  '&:hover': { color: active ? '#00f5d4' : '#e2e8f0' },
                }}
              >
                {active ? `[${tab}]` : tab}
              </Box>
            );
          })}
        </Box>

        {/* Results tab */}
        {activeTab === 'results' && (
          <Box sx={{
            background: '#0d1117', border: '1px solid #1e2a35', borderRadius: '2px', p: 3, mb: '2rem',
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
          }}>
            <SectionDivider>VOTE DISTRIBUTION</SectionDivider>

            {proposal.status === 'ENDED' ? (
              <Box sx={{ borderLeft: '2px solid #64748b', pl: 1.5, py: 0.25 }}>
                <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#64748b', letterSpacing: '0.04em' }}>
                  &gt; voting closed — awaiting keyholder decryption
                </Typography>
              </Box>
            ) : proposal.status === 'PENDING_DKG' ? (
              <Box sx={{ borderLeft: '2px solid #ffb800', pl: 1.5, py: 0.25 }}>
                <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ffb800', letterSpacing: '0.04em' }}>
                  &gt; awaiting dkg setup — voting not yet open
                </Typography>
              </Box>
            ) : (
              <>
                {proposal.status === 'ACTIVE' && (
                  <Typography sx={{ fontFamily: bodyFont, fontSize: '0.72rem', color: '#334155', letterSpacing: '0.03em', mb: '1.5rem', lineHeight: 1.65 }}>
                    &gt; live vote count — ballots encrypted on-chain, cannot be attributed to voters
                  </Typography>
                )}

                {proposal.options.map((option, idx) => {
                  const count     = proposal.voteWeight?.[option] ?? (proposal.finalResult?.[idx] ?? 0);
                  const pct       = proposal.totalParticipation > 0 ? (count / proposal.totalParticipation) * 100 : 0;
                  const isWinner  = proposal.status === 'REVEALED' && option === proposal.winner;
                  const { bar, color } = makeBar(pct, isWinner);

                  return (
                    <Box key={idx} sx={{ mb: '1.25rem' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: '4px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <Typography sx={{ fontFamily: monoFont, fontSize: '0.65rem', color: '#334155' }}>
                            [{idx + 1}]
                          </Typography>
                          <Typography sx={{
                            fontFamily: bodyFont, fontSize: '0.82rem',
                            color: isWinner ? '#39ff14' : '#e2e8f0',
                            textShadow: isWinner ? '0 0 8px rgba(57,255,20,0.4)' : 'none',
                            letterSpacing: '0.03em',
                          }}>
                            {option}
                          </Typography>
                          {isWinner && (
                            <Typography sx={{
                              fontFamily: monoFont, fontSize: '0.6rem',
                              color: '#39ff14', letterSpacing: '0.1em',
                              border: '1px solid rgba(57,255,20,0.35)', borderRadius: '2px',
                              px: 0.5, py: 0.1,
                              animation: 'glowPulse 2s ease-in-out infinite',
                            }}>
                              [WINNER]
                            </Typography>
                          )}
                        </Box>
                        <Typography sx={{ fontFamily: bodyFont, fontSize: '0.65rem', color: '#334155', letterSpacing: '0.04em', flexShrink: 0 }}>
                          {count} · {pct.toFixed(1)}%
                        </Typography>
                      </Box>
                      <Typography sx={{ fontFamily: bodyFont, fontSize: '0.72rem', color, userSelect: 'none', letterSpacing: '0.02em' }}>
                        {bar}
                      </Typography>
                    </Box>
                  );
                })}

                {proposal.status === 'REVEALED' && (
                  <Box sx={{ borderLeft: '2px solid rgba(57,255,20,0.3)', pl: 1.5, mt: '1.5rem', py: 0.25 }}>
                    <Typography sx={{ fontFamily: bodyFont, fontSize: '0.72rem', color: '#39ff14', letterSpacing: '0.04em' }}>
                      &gt; results verified on-chain — winner: {proposal.winner}
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}

        {/* Details tab */}
        {activeTab === 'details' && (
          <Box sx={{
            background: '#0d1117', border: '1px solid #1e2a35', borderRadius: '2px', p: 3, mb: '2rem',
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
          }}>
            <SectionDivider>PROPOSAL DETAILS</SectionDivider>

            <Grid container spacing={1.5}>
              <Grid item xs={6} sm={3}>
                <Box sx={dataBox}>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.55rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>CREATED</Typography>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.75rem', color: '#e2e8f0', letterSpacing: '0.04em' }}>
                    {formatUtils.formatBlockNumber(proposal.createdAtBlock)}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={dataBox}>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.55rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>DURATION</Typography>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.75rem', color: '#e2e8f0', letterSpacing: '0.04em' }}>
                    {formatUtils.formatDuration(proposal.duration)}
                  </Typography>
                  <Typography sx={{ fontFamily: bodyFont, fontSize: '0.6rem', color: '#334155', mt: '3px' }}>
                    {proposal.duration.toLocaleString()} blocks
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={dataBox}>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.55rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>START BLOCK</Typography>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.75rem', color: '#e2e8f0', letterSpacing: '0.04em' }}>
                    {proposal.startBlock ? formatUtils.formatBlockNumber(proposal.startBlock) : '—'}
                  </Typography>
                  <Typography sx={{ fontFamily: bodyFont, fontSize: '0.6rem', color: '#334155', mt: '3px' }}>
                    set after dkg
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Box sx={dataBox}>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.55rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>END BLOCK</Typography>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.75rem', color: proposal.endBlock ? '#ff3c3c' : '#334155', letterSpacing: '0.04em' }}>
                    {proposal.endBlock ? formatUtils.formatBlockNumber(proposal.endBlock) : '—'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={dataBox}>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.55rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>CREATOR</Typography>
                  <Typography sx={{ fontFamily: bodyFont, fontSize: '0.72rem', color: '#64748b', letterSpacing: '0.04em', wordBreak: 'break-all' }}>
                    $ {proposal.creator}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box sx={dataBox}>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.55rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>DKG SHARES</Typography>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.75rem', color: '#e2e8f0', letterSpacing: '0.04em' }}>
                    {proposal.shareCount ?? 0}/3
                  </Typography>
                  <Typography sx={{ fontFamily: bodyFont, fontSize: '0.6rem', color: '#334155', mt: '3px' }}>
                    public key shares submitted
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ ...dataBox, height: 'auto' }}>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.55rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.75rem' }}>
                    OPTIONS ({proposal.options.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {proposal.options.map((option, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Typography sx={{ fontFamily: monoFont, fontSize: '0.62rem', color: '#334155', minWidth: 24, flexShrink: 0 }}>
                          [{idx + 1}]
                        </Typography>
                        <Typography sx={{ fontFamily: bodyFont, fontSize: '0.78rem', color: '#64748b', letterSpacing: '0.03em' }}>
                          {option}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Vote form — ACTIVE only */}
        {proposal.status === 'ACTIVE' && userAddress && (
          <Box sx={{
            background: '#0d1117', border: '1px solid #1e2a35',
            borderLeft: '3px solid rgba(0,245,212,0.4)',
            borderRadius: '2px', p: 3, mb: '2rem',
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
          }}>
            <SectionDivider>CAST VOTE</SectionDivider>
            {hasVoted ? (
              <Box sx={{ borderLeft: '2px solid #39ff14', pl: 1.5, py: 0.25 }}>
                <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#39ff14', letterSpacing: '0.04em' }}>
                  &gt; vote recorded — encrypted ballot stored on-chain
                </Typography>
              </Box>
            ) : (
              <VoteForm proposal={proposal} onVoteSuccess={() => getProposalDetail(id)} />
            )}
          </Box>
        )}

        {/* Status notices */}
        {proposal.status === 'ACTIVE' && !userAddress && (
          <Box sx={{ borderLeft: '2px solid rgba(0,245,212,0.3)', pl: 1.5, mb: '2rem', py: 0.25 }}>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: 'rgba(0,245,212,0.6)', letterSpacing: '0.04em' }}>
              &gt; connect your wallet to vote on this proposal
            </Typography>
          </Box>
        )}

        {proposal.status === 'PENDING_DKG' && (
          <Box sx={{ borderLeft: '2px solid #ffb800', pl: 1.5, mb: '2rem', py: 0.25 }}>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ffb800', letterSpacing: '0.04em' }}>
              &gt; awaiting keyholder dkg setup — voting opens once all 3 keyholders submit public key shares
            </Typography>
          </Box>
        )}

        {proposal.status === 'ENDED' && (
          <Box sx={{ borderLeft: '2px solid #64748b', pl: 1.5, mb: '2rem', py: 0.25 }}>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#64748b', letterSpacing: '0.04em' }}>
              &gt; voting ended — results awaiting keyholder partial decryptions ({proposal.partialCount}/3 submitted)
            </Typography>
          </Box>
        )}

        {proposal.status === 'CANCELLED' && (
          <Box sx={{ borderLeft: '2px solid #ff3c3c', pl: 1.5, mb: '2rem', py: 0.25 }}>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ff3c3c', letterSpacing: '0.04em' }}>
              &gt; proposal cancelled — participation fell below minimum threshold of {proposal.minVoterThreshold} votes
            </Typography>
          </Box>
        )}

        {/* Footer */}
        <Box sx={{ fontFamily: bodyFont, fontSize: '0.6rem', color: '#1e2a35', overflow: 'hidden', whiteSpace: 'nowrap', userSelect: 'none' }}>
          {'─'.repeat(120)}
        </Box>
        <Box sx={{ fontFamily: bodyFont, fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.07em', mt: '0.5rem' }}>
          &gt; proposal {proposal.id} · {proposal.status.toLowerCase()} · system nominal
        </Box>

      </Container>
    </Box>
  );
};

export default ProposalDetail;