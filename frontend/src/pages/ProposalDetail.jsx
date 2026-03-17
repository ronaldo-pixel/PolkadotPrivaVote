import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  Chip,
  Grid,
  Card,
  CardContent,
  Alert,
  Divider,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import { useVoting } from '../context/VotingContext';
import ProposalStatusTimeline from '../components/ProposalStatusTimeline';
import VoteForm from '../components/VoteForm';
import { proposalStatusUtils, formatUtils, formatUtils as formatUt } from '../utils/contractUtils';

const ProposalDetail = () => {
  const { id } = useParams();
  const { proposals, getProposalDetail, initializeProposals, userAddress, userVotes } =
    useVoting();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    initializeProposals();
  }, [initializeProposals]);

  useEffect(() => {
    if (proposals.length > 0) {
      const prop = proposals.find((p) => p.id === id);
      setProposal(prop);
      setLoading(false);
    }
  }, [proposals, id]);

  if (loading || !proposal) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const statusColor = proposalStatusUtils.getStatusColor(proposal.status);
  const hasVoted = userVotes.includes(proposal.id);
  const participationRate = proposal.totalParticipation / proposal.minVoterThreshold;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              {proposal.id}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Created by: {formatUtils.formatAddress(proposal.creator)}
            </Typography>
          </Box>
          <Chip
            label={proposalStatusUtils.getStatusLabel(proposal.status)}
            sx={{
              bgcolor: statusColor,
              color: 'white',
              fontWeight: 600,
              fontSize: '1rem',
              p: 2,
            }}
          />
        </Box>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {proposal.description}
        </Typography>
      </Box>

      <ProposalStatusTimeline proposal={proposal} />

      <Grid container spacing={3} sx={{ mb: 4, mt: 1 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Voting Mode
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {proposal.votingMode === 'quadratic' ? 'Quadratic' : 'Normal'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {proposal.votingMode === 'quadratic'
                  ? 'Vote power = √(tokens)'
                  : '1 token = 1 vote'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Eligibility Threshold
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {proposal.eligibilityThreshold}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Minimum tokens required
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Minimum Votes Required
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {proposal.minVoterThreshold}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                For proposal validity
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Current Participation
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {proposal.totalParticipation}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatUt.formatPercentage(proposal.totalParticipation, proposal.minVoterThreshold)}
                {' '}of required
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Results" />
          <Tab label="Details" />
        </Tabs>
      </Box>

      {tabValue === 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Vote Distribution
            </Typography>

            {proposal.status === 'REVEALED' ? (
              <>
                {proposal.options.map((option, idx) => {
                  const count = proposal.voteWeight[option] || 0;
                  const percentage =
                    proposal.totalParticipation > 0
                      ? (count / proposal.totalParticipation) * 100
                      : 0;

                  return (
                    <Box key={idx} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">
                          {option}
                          {option === proposal.winner && '🏆'}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {count} votes ({percentage.toFixed(1)}%)
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          height: 8,
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            height: '100%',
                            bgcolor: option === proposal.winner ? 'success.main' : 'primary.main',
                            width: `${percentage}%`,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </>
            ) : proposal.status === 'ENDED' ? (
              <Alert severity="info">
                Voting has ended. Results will be revealed once keyholders complete the
                decryption process.
              </Alert>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Real-time vote count (encrypted votes cannot be attributed to voters)
                </Typography>
                {proposal.options.map((option, idx) => {
                  const count = proposal.voteWeight[option] || 0;
                  const percentage =
                    proposal.totalParticipation > 0
                      ? (count / proposal.totalParticipation) * 100
                      : 0;

                  return (
                    <Box key={idx} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">{option}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {count} ({percentage.toFixed(1)}%)
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          height: 8,
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            height: '100%',
                            bgcolor: 'primary.main',
                            width: `${percentage}%`,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tabValue === 1 && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  Start Block
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  #{proposal.startBlock}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  End Block
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  #{proposal.endBlock}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Divider />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Voting Options
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {proposal.options.map((option, idx) => (
                    <Chip key={idx} label={option} />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {proposal.status === 'ACTIVE' && userAddress && (
        <Card sx={{ mb: 4, bgcolor: 'primary.light' }}>
          <CardContent>
            {hasVoted ? (
              <Alert severity="success">
                ✓ You have already voted on this proposal. Your encrypted vote has been recorded.
              </Alert>
            ) : (
              <>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Cast Your Vote
                </Typography>
                <VoteForm
                  proposal={proposal}
                  onVoteSuccess={() => {
                    console.log('Vote submitted successfully');
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {proposal.status === 'ENDED' && (
        <Alert severity="warning" sx={{ mb: 4 }}>
          Voting has ended. The results are awaiting decryption by keyholders. This may take some
          time.
        </Alert>
      )}

      {proposal.status === 'REVEALED' && (
        <Alert severity="success" sx={{ mb: 4 }}>
          ✓ Results have been revealed. The winning option is highlighted in green above.
        </Alert>
      )}

      {!userAddress && proposal.status === 'ACTIVE' && (
        <Alert severity="info">Please connect your wallet to vote on this proposal.</Alert>
      )}
    </Container>
  );
};

export default ProposalDetail;
