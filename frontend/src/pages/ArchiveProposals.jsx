import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  InputAdornment,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useVoting } from '../context/VotingContext';
import ProposalCard from '../components/ProposalCard';

const ArchiveProposals = () => {
  const { proposals, getArchivedProposals, initializeProposals } = useVoting();
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
    displayProposals = displayProposals.filter(
      (p) =>
        p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Archive
        </Typography>
        <Typography color="text.secondary">
          View completed and revealed proposals
        </Typography>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <ToggleButtonGroup
          value={filterStatus}
          exclusive
          onChange={(e, newStatus) => {
            if (newStatus !== null) setFilterStatus(newStatus);
          }}
          size="small"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="revealed">Revealed</ToggleButton>
          <ToggleButton value="cancelled">Cancelled</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          size="small"
          placeholder="Search proposals..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, maxWidth: 300 }}
        />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : displayProposals.length > 0 ? (
        <Grid container spacing={3}>
          {displayProposals.map((proposal) => (
            <Grid item xs={12} md={6} lg={4} key={proposal.id}>
              <ProposalCard proposal={proposal} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary">
              {searchTerm ? 'No proposals match your search.' : 'No archived proposals yet.'}
            </Typography>
          </CardContent>
        </Card>
      )}

      {displayProposals.some((p) => p.status === 'REVEALED') && (
        <Card sx={{ mt: 4, bgcolor: 'success.light' }}>
          <CardContent>
            <Typography variant="body2">
              ✓ Results Revealed: All votes have been decrypted and results are final.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Container>
  );
};

export default ArchiveProposals;
