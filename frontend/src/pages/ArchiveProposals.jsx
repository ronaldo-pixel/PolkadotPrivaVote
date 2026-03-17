import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { useVoting } from '../context/VotingContext';
import ProposalCard from '../components/ProposalCard';

const FILTERS = ['all', 'revealed', 'cancelled'];

const monoFont = '"JetBrains Mono", "Courier New", monospace';

const ArchiveProposals = () => {
  const { getArchivedProposals, initializeProposals } = useVoting();
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeProposals();
    setLoading(false);
  }, [initializeProposals]);

  let displayProposals = getArchivedProposals();

  if (filterStatus === 'revealed') {
    displayProposals = displayProposals.filter((p) => p.status === 'REVEALED');
  } else if (filterStatus === 'cancelled') {
    displayProposals = displayProposals.filter((p) => p.status === 'CANCELLED');
  }

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    displayProposals = displayProposals.filter(
      (p) =>
        p.id.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term)
    );
  }

  const hasRevealed = displayProposals.some((p) => p.status === 'REVEALED');

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
          Archive
        </Typography>
        <Typography
          sx={{
            fontFamily: monoFont,
            fontSize: '0.75rem',
            color: 'rgba(226,232,240,0.3)',
            letterSpacing: '0.06em',
          }}
        >
          &gt; completed and revealed proposals
        </Typography>
      </Box>

      {/* Filters & Search */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* Filter tabs */}
        <Box sx={{ display: 'flex', gap: 0, border: '1px solid rgba(226,232,240,0.08)', borderRadius: '2px' }}>
          {FILTERS.map((f) => {
            const active = filterStatus === f;
            return (
              <Box
                key={f}
                onClick={() => setFilterStatus(f)}
                sx={{
                  fontFamily: monoFont,
                  fontSize: '0.72rem',
                  letterSpacing: '0.08em',
                  textTransform: 'lowercase',
                  color: active ? '#00f5d4' : 'rgba(226,232,240,0.35)',
                  background: active ? 'rgba(0,245,212,0.06)' : 'transparent',
                  borderBottom: active ? '1px solid #00f5d4' : '1px solid transparent',
                  borderRight: '1px solid rgba(226,232,240,0.06)',
                  px: 2,
                  py: 1,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s',
                  '&:last-child': { borderRight: 'none' },
                  '&:hover': active
                    ? {}
                    : { color: 'rgba(226,232,240,0.6)', background: 'rgba(226,232,240,0.02)' },
                }}
              >
                {active ? `> ${f}` : `  ${f}`}
              </Box>
            );
          })}
        </Box>

        {/* Search */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            border: '1px solid rgba(226,232,240,0.08)',
            borderRadius: '2px',
            px: 1.5,
            py: 0.75,
            background: 'rgba(0,0,0,0.3)',
            transition: 'border-color 0.15s',
            '&:focus-within': {
              borderColor: 'rgba(0,245,212,0.4)',
            },
          }}
        >
          <Typography
            sx={{
              fontFamily: monoFont,
              fontSize: '0.72rem',
              color: 'rgba(226,232,240,0.2)',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            /
          </Typography>
          <Box
            component="input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="search proposals..."
            sx={{
              fontFamily: monoFont,
              fontSize: '0.78rem',
              color: '#e2e8f0',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: 220,
              letterSpacing: '0.04em',
              '&::placeholder': {
                color: 'rgba(226,232,240,0.18)',
              },
            }}
          />
        </Box>
      </Box>

      {/* Results count */}
      {!loading && (
        <Typography
          sx={{
            fontFamily: monoFont,
            fontSize: '0.68rem',
            color: 'rgba(226,232,240,0.2)',
            letterSpacing: '0.08em',
            mb: 2.5,
          }}
        >
          {displayProposals.length} result{displayProposals.length !== 1 ? 's' : ''}
          {searchTerm ? ` matching "${searchTerm}"` : ''}
        </Typography>
      )}

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={20} sx={{ color: 'rgba(0,245,212,0.4)' }} />
        </Box>
      ) : displayProposals.length > 0 ? (
        <Grid container spacing={2}>
          {displayProposals.map((proposal) => (
            <Grid item xs={12} md={6} lg={4} key={proposal.id}>
              <ProposalCard proposal={proposal} />
            </Grid>
          ))}
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
            {searchTerm ? `> no results for "${searchTerm}"` : '> no archived proposals yet'}
          </Typography>
        </Box>
      )}

      {/* Revealed notice */}
      {hasRevealed && (
        <Box
          sx={{
            mt: 4,
            borderLeft: '2px solid #39ff14',
            pl: 1.5,
            py: 0.5,
          }}
        >
          <Typography
            sx={{
              fontFamily: monoFont,
              fontSize: '0.72rem',
              color: '#39ff14',
              letterSpacing: '0.06em',
              textShadow: '0 0 8px rgba(57,255,20,0.4)',
            }}
          >
            &gt; results verified on-chain — all votes decrypted and final
          </Typography>
        </Box>
      )}
    </Container>
  );
};

export default ArchiveProposals;