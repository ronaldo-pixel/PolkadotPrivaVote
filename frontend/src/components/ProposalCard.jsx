import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import { proposalStatusUtils, formatUtils } from '../utils/contractUtils';

const STATUS_CONFIG = {
  ACTIVE:      { color: '#00f5d4', label: 'ACTIVE' },
  PENDING_DKG: { color: '#ffb800', label: 'PENDING_DKG' },
  ENDED:       { color: '#94a3b8', label: 'ENDED' },
  REVEALED:    { color: '#39ff14', label: 'REVEALED' },
  CANCELLED:   { color: '#ff3c3c', label: 'CANCELLED' },
};

const ProposalCard = ({ proposal, showVoteButton = false, onVote = null }) => {
  const navigate = useNavigate();

  const statusCfg = STATUS_CONFIG[proposal.status] ?? { color: '#94a3b8', label: proposal.status };
  const participationPct = Math.min(
    Math.round((proposal.totalParticipation / proposal.minVoterThreshold) * 100),
    100
  );

  // Unicode block bar (16 chars wide)
  const barFilled = Math.round(participationPct / 100 * 16);
  const bar = '█'.repeat(barFilled) + '░'.repeat(16 - barFilled);

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0d1117',
        border: '1px solid rgba(226,232,240,0.08)',
        borderLeft: `3px solid ${statusCfg.color}`,
        borderRadius: '2px',
        position: 'relative',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
        '&:hover': {
          boxShadow: `0 0 20px ${statusCfg.color}18`,
          borderColor: statusCfg.color,
          borderLeftColor: statusCfg.color,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 2.5, pb: 1.5 }}>

        {/* Top row: ID + status badge */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", "Courier New", monospace',
              fontWeight: 700,
              fontSize: '0.72rem',
              color: 'rgba(226,232,240,0.35)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            PROPOSAL #{proposal.id}
          </Typography>

          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: statusCfg.color,
              textShadow: `0 0 8px ${statusCfg.color}80`,
              border: `1px solid ${statusCfg.color}40`,
              px: 1,
              py: 0.25,
              lineHeight: 1.6,
              animation:
                proposal.status === 'ACTIVE' || proposal.status === 'PENDING_DKG'
                  ? 'statusPulse 2.5s ease-in-out infinite'
                  : 'none',
              '@keyframes statusPulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.55 },
              },
            }}
          >
            [{statusCfg.label}]
          </Typography>
        </Box>

        {/* Creator address */}
        <Typography
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.72rem',
            color: 'rgba(226,232,240,0.3)',
            mb: 1.5,
            letterSpacing: '0.04em',
          }}
        >
          $ {formatUtils.formatAddress(proposal.creator)}
        </Typography>

        {/* Description */}
        <Typography
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.82rem',
            color: '#e2e8f0',
            lineHeight: 1.65,
            mb: 2,
          }}
        >
          {proposal.description}
        </Typography>

        {/* Options */}
        <Box sx={{ mb: 2 }}>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.68rem',
              color: 'rgba(226,232,240,0.3)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              mb: 0.75,
            }}
          >
            options
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {proposal.options.slice(0, 3).map((option, idx) => (
              <Typography
                key={idx}
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.72rem',
                  color: 'rgba(226,232,240,0.55)',
                  border: '1px solid rgba(226,232,240,0.1)',
                  px: 1,
                  py: 0.25,
                  lineHeight: 1.6,
                  letterSpacing: '0.04em',
                }}
              >
                [{idx + 1}] {option}
              </Typography>
            ))}
            {proposal.options.length > 3 && (
              <Typography
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.72rem',
                  color: '#00f5d4',
                  border: '1px solid rgba(0,245,212,0.25)',
                  px: 1,
                  py: 0.25,
                  lineHeight: 1.6,
                }}
              >
                +{proposal.options.length - 3}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Voting mode */}
        <Typography
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.72rem',
            color: 'rgba(226,232,240,0.3)',
            letterSpacing: '0.08em',
            mb: 2,
          }}
        >
          mode:{' '}
          <Box component="span" sx={{ color: 'rgba(226,232,240,0.6)' }}>
            {proposal.votingMode === 'quadratic' ? 'quadratic' : 'normal'}
          </Box>
        </Typography>

        {/* Participation bar */}
        {proposal.status !== 'REVEALED' && proposal.status !== 'CANCELLED' && (
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.68rem',
                  color: 'rgba(226,232,240,0.3)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                participation
              </Typography>
              <Typography
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.68rem',
                  color: 'rgba(226,232,240,0.45)',
                }}
              >
                {proposal.totalParticipation}/{proposal.minVoterThreshold}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.72rem',
                color: participationPct >= 100 ? '#39ff14' : '#00f5d4',
                letterSpacing: '0.02em',
                userSelect: 'none',
              }}
            >
              {bar} {participationPct}%
            </Typography>
          </Box>
        )}

        {/* Revealed winner */}
        {proposal.status === 'REVEALED' && (
          <Box
            sx={{
              mt: 1,
              p: 1.5,
              border: '1px solid rgba(57,255,20,0.25)',
              background: 'rgba(57,255,20,0.04)',
            }}
          >
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.68rem',
                color: '#39ff14',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                mb: 0.5,
                textShadow: '0 0 8px rgba(57,255,20,0.5)',
              }}
            >
              &gt; winner
            </Typography>
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.82rem',
                color: '#e2e8f0',
                fontWeight: 700,
                mb: 0.25,
              }}
            >
              {proposal.winner}
            </Typography>
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.7rem',
                color: 'rgba(226,232,240,0.35)',
              }}
            >
              total votes: {proposal.totalParticipation}
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Actions */}
      <CardActions
        sx={{
          borderTop: '1px solid rgba(226,232,240,0.06)',
          px: 2.5,
          py: 1.5,
          gap: 1,
        }}
      >
        <Button
          size="small"
          disableRipple
          onClick={() => navigate(`/proposal/${proposal.id}`)}
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'lowercase',
            color: 'rgba(226,232,240,0.45)',
            border: '1px solid rgba(226,232,240,0.1)',
            borderRadius: '2px',
            px: 1.5,
            py: 0.5,
            transition: 'all 0.15s',
            '&:hover': {
              color: '#00f5d4',
              borderColor: 'rgba(0,245,212,0.4)',
              background: 'rgba(0,245,212,0.04)',
            },
          }}
        >
          &gt; view
        </Button>

        {showVoteButton && proposal.status === 'ACTIVE' && onVote && (
          <Button
            size="small"
            disableRipple
            onClick={() => onVote(proposal.id)}
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'lowercase',
              color: '#00f5d4',
              border: '1px solid rgba(0,245,212,0.45)',
              borderRadius: '2px',
              px: 1.5,
              py: 0.5,
              background: 'rgba(0,245,212,0.05)',
              transition: 'all 0.15s',
              '&:hover': {
                background: 'rgba(0,245,212,0.1)',
                borderColor: '#00f5d4',
                boxShadow: '0 0 10px rgba(0,245,212,0.2)',
              },
            }}
          >
            &gt; cast vote
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

export default ProposalCard;