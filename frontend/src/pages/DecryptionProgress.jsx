import React, { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Alert,
  Grid,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Chip,
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useVoting } from '../context/VotingContext';
import { zkProofGenerator } from '../utils/contractUtils';

const DecryptionProgress = () => {
  const { proposals, isKeyholder, submitPartialDecryption, initializeProposals, loading } =
    useVoting();
  const [proposals_init, setProposalsInit] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [showDecryptionDialog, setShowDecryptionDialog] = useState(false);
  const [decryptionProgress, setDecryptionProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    initializeProposals();
  }, [initializeProposals]);

  useEffect(() => {
    if (proposals && proposals.length > 0) {
      const endedProposals = proposals.filter((p) => p.status === 'ENDED');
      setProposalsInit(endedProposals);
    }
  }, [proposals]);

  const handleOpenDecryption = (proposal) => {
    setSelectedProposal(proposal);
    setShowDecryptionDialog(true);
  };

  const handleSubmitDecryption = async () => {
    if (!selectedProposal) return;

    setSubmitting(true);
    setDecryptionProgress(0);

    try {
      // Simulate decryption process
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setDecryptionProgress(((i + 1) / 3) * 100);
      }

      // Generate partial decryption proof
      const partialDecryption = `0x${Math.random().toString(16).slice(2)}`;
      const proofData = await zkProofGenerator.generateDecryptionProof(partialDecryption);

      // Submit to contract
      await submitPartialDecryption(selectedProposal.id, partialDecryption, proofData.proof);

      setDecryptionProgress(100);
      setTimeout(() => {
        setShowDecryptionDialog(false);
        setSelectedProposal(null);
        setDecryptionProgress(0);
      }, 1000);
    } catch (err) {
      console.error('Decryption failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isKeyholder) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">
          You are not registered as a keyholder. Only keyholders can submit partial decryptions.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <LockOpenIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Decryption Progress
          </Typography>
          <Typography color="text.secondary">
            Manage partial decryptions for ended proposals
          </Typography>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          🔑 As a keyholder, you are responsible for contributing to the decryption of voting
          results. Each keyholder must submit a partial decryption with a zero-knowledge proof to
          verify correctness without revealing their key share.
        </Typography>
      </Alert>

      {proposals_init && proposals_init.length > 0 ? (
        <Grid container spacing={3}>
          {proposals_init.map((proposal) => {
            const completedDecryptions = proposal.partialDecryptions?.length || 0;
            const requiredDecryptions = 3; // Example: require 3 out of 5 keyholders
            const decryptionComplete = completedDecryptions >= requiredDecryptions;

            return (
              <Grid item xs={12} md={6} key={proposal.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {proposal.id}
                      </Typography>
                      {decryptionComplete && (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label="Complete"
                          color="success"
                          size="small"
                        />
                      )}
                    </Box>

                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {proposal.description}
                    </Typography>

                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Decryption Progress
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {completedDecryptions} / {requiredDecryptions}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(completedDecryptions / requiredDecryptions) * 100}
                      />
                    </Box>

                    <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Total Votes to Decrypt
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                        {proposal.voteCount} encrypted votes
                      </Typography>
                    </Box>

                    <Grid container spacing={1} sx={{ mb: 2 }}>
                      <Grid item xs={6}>
                        <Box sx={{ p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Voting Options
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                            {proposal.options.length}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Closed at Block
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                            #{proposal.endBlock}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>

                  <CardActions>
                    {!decryptionComplete ? (
                      <Button
                        variant="contained"
                        startIcon={<LockOpenIcon />}
                        onClick={() => handleOpenDecryption(proposal)}
                        fullWidth
                      >
                        Submit Partial Decryption
                      </Button>
                    ) : (
                      <Button disabled fullWidth>
                        ✓ Decryption Complete
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary">
              No proposals awaiting decryption at the moment.
            </Typography>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={showDecryptionDialog && !!selectedProposal}
        onClose={() => {
          if (!submitting) {
            setShowDecryptionDialog(false);
            setSelectedProposal(null);
            setDecryptionProgress(0);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Submit Partial Decryption</DialogTitle>
        <DialogContent>
          {selectedProposal && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Proposal
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {selectedProposal.id}
                </Typography>
              </Box>

              {decryptionProgress > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Processing Decryption
                  </Typography>
                  <LinearProgress variant="determinate" value={decryptionProgress} />
                  <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                    {Math.round(decryptionProgress)}%
                  </Typography>
                </Box>
              )}

              {decryptionProgress === 0 && (
                <>
                  <TextField
                    fullWidth
                    label="Private Key Share"
                    type="password"
                    placeholder="Your encrypted key share..."
                    disabled={submitting}
                    sx={{ mb: 2 }}
                  />

                  <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                    <Typography variant="caption">
                      ℹ️ You will generate a zero-knowledge proof to verify your partial
                      decryption is correct without revealing your key share.
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowDecryptionDialog(false);
            setSelectedProposal(null);
            setDecryptionProgress(0);
          }} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitDecryption}
            variant="contained"
            disabled={submitting || decryptionProgress > 0}
          >
            {submitting || decryptionProgress > 0 ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Processing...
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DecryptionProgress;
