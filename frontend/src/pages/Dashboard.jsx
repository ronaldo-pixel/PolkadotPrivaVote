import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Button,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useVoting } from '../context/VotingContext';
import ProposalCard from '../components/ProposalCard';
import { formatUtils } from '../utils/contractUtils';

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

  if (!userAddress) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            bgcolor: 'background.paper',
            borderRadius: 2,
          }}
        >
          <Typography variant="h5" sx={{ mb: 2 }}>
            Welcome to PolkadotPrivaVote
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            A privacy-preserving DAO voting platform with encrypted ballots and zero-knowledge
            proofs.
          </Typography>
          <Alert severity="info" sx={{ maxWidth: 500, mx: 'auto' }}>
            Please connect your wallet to participate in voting and view your dashboard.
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
          Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip
            label={`Connected: ${formatUtils.formatAddress(userAddress)}`}
            color="primary"
            icon={<Typography>👤</Typography>}
          />
          {isKeyholder && (
            <Chip
              label="Keyholder"
              sx={{ bgcolor: '#FFC107', color: 'black' }}
              icon={<Typography>🔑</Typography>}
            />
          )}
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Active Proposals
              </Typography>
              <Typography variant="h5">{activeProposals.length}</Typography>
              <Button
                size="small"
                onClick={() => navigate('/proposals')}
                sx={{ mt: 1 }}
              >
                View All
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Created by You
              </Typography>
              <Typography variant="h5">{userCreatedProposals.length}</Typography>
              <Button
                size="small"
                onClick={() => navigate('/archive')}
                sx={{ mt: 1 }}
              >
                View
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Voted In
              </Typography>
              <Typography variant="h5">{userVotes.length}</Typography>
              <Typography variant="caption" color="text.secondary">
                Without revealing choices
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Nullifiers Used
              </Typography>
              <Typography variant="h5">
                {nullifierStatus.usedCount} / {nullifierStatus.totalAllocation}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(nullifierStatus.usedCount / nullifierStatus.totalAllocation) * 100}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Eligible to Vote
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => navigate('/create-proposal')}
          >
            Create Proposal
          </Button>
        </Box>
        {userEligibleProposals.length > 0 ? (
          <Grid container spacing={2}>
            {userEligibleProposals.slice(0, 3).map((proposal) => (
              <Grid item xs={12} md={6} key={proposal.id}>
                <ProposalCard proposal={proposal} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Card>
            <CardContent>
              <Typography color="text.secondary">
                No active proposals available for voting right now.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>

      {isKeyholder && (
        <Box sx={{ mb: 4 }}>
          <Card sx={{ bgcolor: 'info.light' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                🔐 Keyholder Action Required
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                You are registered as a keyholder. Check the decryption panel for ended
                proposals requiring your partial decryption.
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/decryption')}
              >
                Go to Decryption Panel
              </Button>
            </CardContent>
          </Card>
        </Box>
      )}
    </Container>
  );
};

export default Dashboard;
