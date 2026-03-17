import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardActions,
  Button,
  Typography,
  Box,
  Chip,
  LinearProgress,
} from '@mui/material';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import { proposalStatusUtils, formatUtils } from '../utils/contractUtils';

const ProposalCard = ({ proposal, showVoteButton = false, onVote = null }) => {
  const navigate = useNavigate();
  const statusColor = proposalStatusUtils.getStatusColor(proposal.status) || '#00ff00';
  const participationRate = proposal.totalParticipation / proposal.minVoterThreshold;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#101010',
        color: '#00ff00',
        border: '1px solid #003300',
        borderRadius: 0,
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        {/* Header: ID and Status */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, fontFamily: 'Courier New, monospace', fontWeight: 700 }}
          >
            {proposal.id}
          </Typography>
          <Chip
            label={proposalStatusUtils.getStatusLabel(proposal.status)}
            size="small"
            sx={{
              bgcolor: statusColor,
              color: '#000',
              fontWeight: 700,
              borderRadius: 0,
              border: '1px solid #003300',
            }}
          />
        </Box>

        {/* Creator */}
        <Typography
          variant="body2"
          sx={{ mb: 1.5, color: '#00ff00', fontFamily: 'Courier New, monospace' }}
        >
          Created by: {formatUtils.formatAddress(proposal.creator)}
        </Typography>

        {/* Description */}
        <Typography
          variant="body1"
          sx={{ mb: 2, fontWeight: 500, fontFamily: 'Courier New, monospace' }}
        >
          {proposal.description}
        </Typography>

        {/* Options */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: '#00ff00' }}>
            Options: {proposal.options.length}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
            {proposal.options.slice(0, 3).map((option, idx) => (
              <Chip
                key={idx}
                label={option}
                size="small"
                sx={{
                  border: '1px solid #003300',
                  backgroundColor: '#001100',
                  color: '#00ff00',
                  borderRadius: 0,
                  fontFamily: 'Courier New, monospace',
                }}
              />
            ))}
            {proposal.options.length > 3 && (
              <Chip
                label={`+${proposal.options.length - 3}`}
                size="small"
                sx={{
                  border: '1px solid #003300',
                  backgroundColor: '#001100',
                  color: '#00ff00',
                  borderRadius: 0,
                  fontFamily: 'Courier New, monospace',
                }}
              />
            )}
          </Box>
        </Box>

        {/* Voting Mode */}
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" sx={{ color: '#00ff00', fontFamily: 'Courier New, monospace' }}>
            Voting Mode: {proposal.votingMode === 'quadratic' ? 'Quadratic' : 'Normal'}
          </Typography>
        </Box>

        {/* Participation */}
        {proposal.status !== 'REVEALED' && proposal.status !== 'CANCELLED' && (
          <>
            <Typography
              variant="caption"
              sx={{ display: 'block', mb: 0.5, color: '#00ff00', fontFamily: 'Courier New, monospace' }}
            >
              Participation: {proposal.totalParticipation} / {proposal.minVoterThreshold}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(participationRate * 100, 100)}
              sx={{
                mb: 1.5,
                height: 8,
                borderRadius: 0,
                backgroundColor: '#001100',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#00ff00',
                },
              }}
            />
          </>
        )}

        {/* Revealed Winner */}
        {proposal.status === 'REVEALED' && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              bgcolor: '#001100',
              border: '1px solid #003300',
              borderRadius: 0,
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: '#ffcc00', fontFamily: 'Courier New, monospace' }}
            >
              🏆 Winner: {proposal.winner}
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: '#00ff00', fontFamily: 'Courier New, monospace' }}
            >
              Final participation: {proposal.totalParticipation} votes
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ borderTop: '1px solid #003300' }}>
        <Button
          size="small"
          sx={{
            borderRadius: 0,
            border: '1px solid #003300',
            color: '#00ff00',
            fontFamily: 'Courier New, monospace',
          }}
          onClick={() => navigate(`/proposal/${proposal.id}`)}
        >
          View Details
        </Button>
        {showVoteButton && proposal.status === 'ACTIVE' && onVote && (
          <Button
            size="small"
            variant="outlined"
            sx={{
              borderRadius: 0,
              border: '1px solid #ffcc00',
              color: '#ffcc00',
              fontFamily: 'Courier New, monospace',
            }}
            startIcon={<ThumbUpIcon sx={{ color: '#ffcc00' }} />}
            onClick={() => onVote(proposal.id)}
          >
            Vote
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

export default ProposalCard;