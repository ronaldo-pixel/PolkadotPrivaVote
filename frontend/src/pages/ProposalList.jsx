import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Button,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useVoting } from '../context/VotingContext';
import ProposalCard from '../components/ProposalCard';

const ProposalList = () => {
  const navigate = useNavigate();
  const { proposals, getActiveProposals, initializeProposals, userAddress } = useVoting();
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeProposals();
    setLoading(false);
  }, [initializeProposals]);

  let displayProposals = getActiveProposals();

  if (filterStatus === 'pending') {
    displayProposals = displayProposals.filter((p) => p.status === 'PENDING_DKG');
  } else if (filterStatus === 'active') {
    displayProposals = displayProposals.filter((p) => p.status === 'ACTIVE');
  }

  const handleVote = (proposalId) => {
    navigate(`/proposal/${proposalId}`);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Active Proposals
        </Typography>
        {userAddress && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/create-proposal')}
          >
            Create Proposal
          </Button>
        )}
      </Box>

      <Box sx={{ mb: 3 }}>
        <ToggleButtonGroup
          value={filterStatus}
          exclusive
          onChange={(e, newStatus) => {
            if (newStatus !== null) setFilterStatus(newStatus);
          }}
          size="small"
        >
          <ToggleButton value="all">All Active</ToggleButton>
          <ToggleButton value="pending">Pending DKG</ToggleButton>
          <ToggleButton value="active">Voting Open</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : displayProposals.length > 0 ? (
        <Grid container spacing={3}>
          {displayProposals.map((proposal) => (
            <Grid item xs={12} md={6} lg={4} key={proposal.id}>
              <ProposalCard
                proposal={proposal}
                showVoteButton={userAddress !== null}
                onVote={handleVote}
              />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary">No active proposals at the moment.</Typography>
        </Box>
      )}
    </Container>
  );
};

export default ProposalList;
