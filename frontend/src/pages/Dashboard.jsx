import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Button,
  Grid,
  Typography,
  Box,
} from '@mui/material';
import { useVoting } from '../context/VotingContext';
import ProposalCard from '../components/ProposalCard';
import { formatUtils } from '../utils/contractUtils';

const monoFont = '"Share Tech Mono", "JetBrains Mono", "Courier New", monospace';
const bodyFont = '"IBM Plex Mono", "Courier New", monospace';

const StatBlock = ({ value, label, color = '#00f5d4', onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      background: '#0d1117',
      border: '1px solid #1e2a35',
      borderRadius: '2px',
      padding: '1rem 1.25rem',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 0.15s',
      '&:hover': onClick ? { borderColor: 'rgba(0,245,212,0.35)' } : {},
    }}
  >
    <Box component="span" sx={{
      fontFamily: monoFont,
      fontSize: '1.75rem',
      color,
      display: 'block',
      letterSpacing: '0.04em',
      lineHeight: 1,
    }}>
      {value}
    </Box>
    <Box component="span" sx={{
      fontFamily: monoFont,
      fontSize: '0.55rem',
      letterSpacing: '0.15em',
      color: '#ffffff',
      textTransform: 'uppercase',
      marginTop: '6px',
      display: 'block',
    }}>
      {label}
    </Box>
    {onClick && (
      <Box sx={{
        fontFamily: monoFont,
        fontSize: '0.58rem',
        letterSpacing: '0.1em',
        color: '#334155',
        mt: '8px',
        transition: 'color 0.15s',
        '.MuiBox-root:hover &': { color: '#00f5d4' },
      }}>
        {'> view all'}
      </Box>
    )}
  </Box>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    userAddress,
    isKeyholder,
    userProposals,
    userVotes,
    proposals,
    initializeProposals,
    getNullifierStatus,
  } = useVoting();

  useEffect(() => {
    initializeProposals();
  }, [initializeProposals]);

  const activeProposals = proposals.filter(
    (p) => p.status === 'ACTIVE' || p.status === 'PENDING_DKG'
  );
  const userCreatedProposals = proposals.filter((p) =>
    userProposals.includes(p.id)
  );
  const userEligibleProposals = proposals.filter(
    (p) => p.status === 'ACTIVE' && !userVotes.includes(p.id)
  );
  const nullifierStatus = getNullifierStatus();
  const nullifierPct = Math.min(
    Math.round((nullifierStatus.usedCount / nullifierStatus.totalAllocation) * 100),
    100
  );
  const nullBarFilled = Math.round(nullifierPct / 100 * 16);
  const nullBar = '█'.repeat(nullBarFilled) + '░'.repeat(16 - nullBarFilled);

  if (!userAddress) {
    return (
      <Box sx={{
        fontFamily: bodyFont,
        background: '#080c10',
        minHeight: '100vh',
        borderLeft: '2px solid rgba(0,245,212,0.12)',
      }}>
        <Box sx={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 2rem' }}>
          <Box sx={{ fontFamily: monoFont, fontSize: '0.65rem', color: '#ffffff', letterSpacing: '0.12em', mb: '1.75rem' }}>
            {'> /dashboard'}
          </Box>

          <Typography sx={{ fontFamily: monoFont, fontWeight: 400, fontSize: '1.6rem', color: '#e2e8f0', letterSpacing: '0.06em', textTransform: 'uppercase', mb: '0.3rem' }}>
            SYSTEM STATUS
            <Box component="span" sx={{
              display: 'inline-block', width: '6px', height: '0.8em',
              background: '#00f5d4', ml: '3px', verticalAlign: 'middle',
              animation: 'blink 1s step-end infinite',
              '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
            }} />
          </Typography>
          <Box sx={{ fontFamily: bodyFont, fontSize: '0.6rem', color: '#1e2a35', overflow: 'hidden', whiteSpace: 'nowrap', userSelect: 'none', my: '1rem' }}>
            {'─'.repeat(120)}
          </Box>

          <Box sx={{ borderLeft: '2px solid #ffb800', pl: 1.5, py: 0.5 }}>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.78rem', color: '#ffb800', letterSpacing: '0.04em', lineHeight: 1.7 }}>
              &gt; wallet not connected<br />
              &gt; connect your wallet to access the dashboard
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      fontFamily: bodyFont,
      background: '#080c10',
      minHeight: '100vh',
      borderLeft: '2px solid rgba(0,245,212,0.12)',
    }}>
      <Container maxWidth="lg" sx={{ py: '2.5rem' }}>

        <Box sx={{ fontFamily: monoFont, fontSize: '0.65rem', color: '#ffffff', letterSpacing: '0.12em', mb: '1.75rem' }}>
          {'> /dashboard'}
          
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <Box >
            <Typography sx={{ fontFamily: monoFont, fontWeight: 400, fontSize: '1.6rem', color: '#e2e8f0', letterSpacing: '0.06em', textTransform: 'uppercase', mb: '0.3rem' }}>
              SYSTEM STATUS
              <Box component="span" sx={{display: 'inline-block',width: '6px',height: '0.8em',background: '#00f5d4',ml: '6px',verticalAlign: 'middle',animation: 'blink 1s step-end infinite','@keyframes blink': {'0%,100%': { opacity: 1 },'50%': { opacity: 0 }},}} />
            </Typography>
            <Box >
              
             
              {isKeyholder && (
                <Typography sx={{
                  fontFamily: monoFont,
                  fontSize: '0.6rem',
                  letterSpacing: '0.14em',
                  color: '#39ff14',
                  border: '1px solid rgba(57,255,20,0.35)',
                  borderRadius: '2px',
                  px: 0.75,
                  py: 0.25,
                  animation: 'glowPulse 2s ease-in-out infinite',
                  '@keyframes glowPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
                }}>
                  [KEYHOLDER]
                </Typography>
              )}
            </Box>
          </Box>

          <Button
            disableRipple
            onClick={() => navigate('/create-proposal')}
            sx={{
              fontFamily: monoFont,
              fontSize: '0.65rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#00f5d4',
              background: 'transparent',
              border: '1px solid rgba(0,245,212,0.4)',
              borderRadius: '2px',
              px: 2,
              py: 0.75,
              whiteSpace: 'nowrap',
              transition: 'background 0.15s, box-shadow 0.15s',
              '&:hover': {
                background: 'rgba(0,245,212,0.07)',
                boxShadow: '0 0 8px rgba(0,245,212,0.5)',
              },
            }}
          >
            [+] NEW PROPOSAL
          </Button>
        </Box>

        <Box sx={{ fontFamily: bodyFont, fontSize: '0.6rem', color: '#1e2a35', overflow: 'hidden', whiteSpace: 'nowrap', userSelect: 'none', mb: '2rem' }}>
          {'─'.repeat(120)}
        </Box>

        <Grid container alignItems="stretch" spacing={1.5} sx={{ mb: '2.5rem' }}>
          <Grid item xs={12} sm={6} sx={{ display: 'flex' }}>
            <StatBlock
              value={activeProposals.length}
              label="active proposals"
              color="#00f5d4"
              onClick={() => navigate('/proposals')}
            />
          </Grid>
          <Grid item xs={12} sm={6} sx={{ display: 'flex' }}>
            <StatBlock
              value={userCreatedProposals.length}
              label="proposals created"
              color="#00f5d4"
              onClick={() => navigate('/archive')}
            />
          </Grid>
          <Grid item xs={12} sm={6} sx={{ display: 'flex' }}> 
            <StatBlock
              value={userVotes.length}
              label="votes cast"
              color="#39ff14"
            />
          </Grid>
        </Grid>

       

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <Typography sx={{ fontFamily: monoFont, fontWeight: 400, fontSize: '0.9rem', color: '#e2e8f0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            ELIGIBLE TO VOTE
            <Box component="span" sx={{ fontFamily: bodyFont, fontSize: '0.9rem', color: '#ffffff', letterSpacing: '0.08em', ml: 1.5, textTransform: 'none' }}>
              {userEligibleProposals.length} RESULT{userEligibleProposals.length !== 1 ? 'S' : ''}
            </Box>
          </Typography>
        </Box>

        {userEligibleProposals.length > 0 ? (
          <Grid container spacing={1.5} sx={{ mb: '2.5rem' }}>
            {userEligibleProposals.slice(0, 3).map((proposal, i) => (
              <Grid item xs={12} md={6} key={proposal.id}>
                <ProposalCard proposal={proposal} showVoteButton={true} index={i} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{
            background: '#0d1117',
            border: '1px dashed #1e2a35',
            borderRadius: '2px',
            padding: '2rem',
            textAlign: 'center',
            mb: '2.5rem',
          }}>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ffffff', letterSpacing: '0.06em' }}>
              &gt; no active proposals available for voting
            </Typography>
          </Box>
        )}

        {isKeyholder && (
          <>
            <Box sx={{ fontFamily: bodyFont, fontSize: '0.65rem', color: '#ffffff', letterSpacing: '0.08em', mb: '1rem' }}>
              {'/* ── KEYHOLDER ── */'}
            </Box>

            <Box sx={{
              background: '#0d1117',
              border: '1px solid rgba(57,255,20,0.2)',
              borderLeft: '3px solid #39ff14',
              borderRadius: '2px',
              padding: '1.25rem 1.5rem',
              mb: '2.5rem',
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(57,255,20,0.008) 3px, rgba(57,255,20,0.008) 4px)',
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <Box>
                  <Typography sx={{ fontFamily: monoFont, fontWeight: 400, fontSize: '0.85rem', color: '#39ff14', letterSpacing: '0.08em', textTransform: 'uppercase', mb: '0.4rem' }}>
                    [KEYHOLDER] ACTION REQUIRED
                  </Typography>
                  <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ffffff', lineHeight: 1.7, letterSpacing: '0.03em', maxWidth: '520px' }}>
                    &gt; you are a registered keyholder. when proposals end, submit your partial decryption key to reveal final voting results.
                  </Typography>
                </Box>
                <Button
                  disableRipple
                  onClick={() => navigate('/decryption')}
                  sx={{
                    fontFamily: monoFont,
                    fontSize: '0.65rem',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#39ff14',
                    background: 'transparent',
                    border: '1px solid rgba(57,255,20,0.4)',
                    borderRadius: '2px',
                    px: 2,
                    py: 0.75,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'background 0.15s, box-shadow 0.15s',
                    '&:hover': {
                      background: 'rgba(57,255,20,0.06)',
                      boxShadow: '0 0 8px rgba(57,255,20,0.4)',
                    },
                  }}
                >
                  [ DECRYPTION PANEL ]
                </Button>
              </Box>
            </Box>
          </>
        )}

        <Box sx={{ fontFamily: bodyFont, fontSize: '0.6rem', color: '#1e2a35', overflow: 'hidden', whiteSpace: 'nowrap', userSelect: 'none' }}>
          {'─'.repeat(120)}
        </Box>
        <Box sx={{ fontFamily: bodyFont, fontSize: '0.62rem', color: '#ffffff', letterSpacing: '0.07em', mt: '0.5rem' }}>
          {'> '}{proposals.length}{' proposals on-chain · system nominal'}
        </Box>

      </Container>
    </Box>
  );
};

export default Dashboard;