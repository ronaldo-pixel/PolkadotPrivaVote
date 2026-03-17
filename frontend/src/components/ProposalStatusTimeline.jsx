import React from 'react';
import { Box, Typography } from '@mui/material';
import { proposalStatusUtils } from '../utils/contractUtils';

const STATUS_MAP = {
  PENDING_DKG: 0,
  ACTIVE: 1,
  ENDED: 2,
  REVEALED: 3,
  CANCELLED: -1,
};

const STEPS = [
  { key: 'PENDING_DKG', label: 'PENDING_DKG' },
  { key: 'ACTIVE',      label: 'ACTIVE' },
  { key: 'ENDED',       label: 'ENDED' },
  { key: 'REVEALED',    label: 'REVEALED' },
];

const STATUS_COLOR = {
  PENDING_DKG: '#ffb800',
  ACTIVE:      '#00f5d4',
  ENDED:       '#94a3b8',
  REVEALED:    '#39ff14',
  CANCELLED:   '#ff3c3c',
};

const ProposalStatusTimeline = ({ proposal, currentBlock = 150 }) => {
  const currentStep = STATUS_MAP[proposal.status] ?? -1;
  const isCancelled = proposal.status === 'CANCELLED';
  const isRevealed = proposal.status === 'REVEALED';
  const accentColor = STATUS_COLOR[proposal.status] ?? '#94a3b8';

  const blockProgress = Math.min(
    Math.round((currentBlock / proposal.endBlock) * 100),
    100
  );
  const barFilled = Math.round((blockProgress / 100) * 24);
  const blockBar = '█'.repeat(barFilled) + '░'.repeat(24 - barFilled);

  return (
    <Box
      sx={{
        my: 3,
        p: 2.5,
        background: '#0d1117',
        border: '1px solid rgba(226,232,240,0.08)',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: '2px',
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
        position: 'relative',
        overflow: 'hidden',
        // Slow horizontal scanline sweep
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '60%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(0,245,212,0.03), transparent)',
          animation: 'scanSweep 5s linear infinite',
          pointerEvents: 'none',
        },
        '@keyframes scanSweep': {
          '0%':   { left: '-60%' },
          '100%': { left: '160%' },
        },
      }}
    >
      {/* Section header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Typography
          sx={{
            fontFamily: '"JetBrains Mono", "Courier New", monospace',
            fontSize: '0.68rem',
            color: 'rgba(226,232,240,0.3)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          /* proposal lifecycle */
        </Typography>
        <Typography
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: accentColor,
            textShadow: `0 0 8px ${accentColor}80`,
            border: `1px solid ${accentColor}40`,
            px: 1,
            py: 0.25,
            lineHeight: 1.6,
            animation: !isCancelled && !isRevealed
              ? 'statusPulse 2.5s ease-in-out infinite'
              : 'none',
            '@keyframes statusPulse': {
              '0%, 100%': { opacity: 1 },
              '50%':       { opacity: 0.5 },
            },
          }}
        >
          [{proposal.status}]
        </Typography>
      </Box>

      {/* Pipeline */}
      {isCancelled ? (
        <Box sx={{ mb: 2.5 }}>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.8rem',
              color: 'rgba(226,232,240,0.25)',
              letterSpacing: '0.04em',
            }}
          >
            [PENDING_DKG] ──▶ [ACTIVE] ──▶ [ENDED]
          </Typography>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.8rem',
              color: '#ff3c3c',
              letterSpacing: '0.04em',
              mt: 0.5,
              ml: 2,
            }}
          >
            └──▶ [CANCELLED]
          </Typography>
        </Box>
      ) : (
        <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0 }}>
          {STEPS.map((step, idx) => {
            const isPast    = idx < currentStep;
            const isActive  = idx === currentStep;
            const isFuture  = idx > currentStep;
            const stepColor = isActive ? STATUS_COLOR[step.key] : isPast ? 'rgba(226,232,240,0.3)' : 'rgba(226,232,240,0.12)';

            return (
              <React.Fragment key={step.key}>
                <Typography
                  component="span"
                  sx={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 700 : 400,
                    color: stepColor,
                    textShadow: isActive ? `0 0 10px ${STATUS_COLOR[step.key]}80` : 'none',
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isPast ? `✓ ${step.label}` : isActive ? `▶ ${step.label}` : `· ${step.label}`}
                </Typography>
                {idx < STEPS.length - 1 && (
                  <Typography
                    component="span"
                    sx={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.78rem',
                      color: isPast ? 'rgba(226,232,240,0.2)' : 'rgba(226,232,240,0.08)',
                      mx: 0.75,
                      userSelect: 'none',
                    }}
                  >
                    ──▶
                  </Typography>
                )}
              </React.Fragment>
            );
          })}
        </Box>
      )}

      {/* Block progress */}
      {!isRevealed && !isCancelled && (
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.68rem',
                color: 'rgba(226,232,240,0.3)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              block progress
            </Typography>
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.68rem',
                color: 'rgba(226,232,240,0.4)',
              }}
            >
              {currentBlock} / {proposal.endBlock}
            </Typography>
          </Box>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.75rem',
              color: blockProgress >= 100 ? '#39ff14' : '#00f5d4',
              letterSpacing: '0.02em',
              userSelect: 'none',
            }}
          >
            {blockBar} {blockProgress}%
          </Typography>
        </Box>
      )}

      {/* Block range */}
      {!isRevealed && !isCancelled && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
          {[
            { label: 'start_block', value: `#${proposal.startBlock}`, color: 'rgba(226,232,240,0.55)' },
            { label: 'end_block',   value: `#${proposal.endBlock}`,   color: '#ff3c3c' },
          ].map(({ label, value, color }) => (
            <Box
              key={label}
              sx={{
                p: 1.5,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(226,232,240,0.06)',
                borderRadius: '2px',
              }}
            >
              <Typography
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.65rem',
                  color: 'rgba(226,232,240,0.25)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  mb: 0.5,
                }}
              >
                {label}
              </Typography>
              <Typography
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color,
                  letterSpacing: '0.04em',
                }}
              >
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Status message */}
      {isCancelled && (
        <Box sx={{ borderLeft: '2px solid #ff3c3c', pl: 1.5 }}>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.75rem',
              color: '#ff3c3c',
              letterSpacing: '0.04em',
            }}
          >
            &gt; cancelled: insufficient participation
          </Typography>
        </Box>
      )}

      {proposal.status === 'PENDING_DKG' && (
        <Box sx={{ borderLeft: '2px solid #ffb800', pl: 1.5 }}>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.75rem',
              color: '#ffb800',
              letterSpacing: '0.04em',
            }}
          >
            &gt; dkg ceremony in progress — awaiting keyholder submissions...
          </Typography>
        </Box>
      )}

      {proposal.status === 'ACTIVE' && (
        <Box sx={{ borderLeft: '2px solid #00f5d4', pl: 1.5 }}>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.75rem',
              color: '#00f5d4',
              letterSpacing: '0.04em',
            }}
          >
            &gt; voting open — encrypted ballots accepted
          </Typography>
        </Box>
      )}

      {proposal.status === 'ENDED' && (
        <Box sx={{ borderLeft: '2px solid #94a3b8', pl: 1.5 }}>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.75rem',
              color: '#94a3b8',
              letterSpacing: '0.04em',
            }}
          >
            &gt; voting closed — awaiting partial decryptions from keyholders
          </Typography>
        </Box>
      )}

      {proposal.status === 'REVEALED' && (
        <Box sx={{ borderLeft: '2px solid #39ff14', pl: 1.5 }}>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.75rem',
              color: '#39ff14',
              textShadow: '0 0 8px rgba(57,255,20,0.4)',
              letterSpacing: '0.04em',
            }}
          >
            &gt; results decrypted and verified on-chain
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ProposalStatusTimeline;