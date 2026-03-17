import React, { useState } from 'react';
import {
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  RadioGroup,
  Radio,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useVoting } from '../context/VotingContext';
import { nullifierUtils, zkProofGenerator, encryptionUtils, voteWeightCalculator } from '../utils/contractUtils';

const VoteForm = ({ proposal, onVoteSuccess }) => {
  const { submitVote, userAddress, checkEligibility } = useVoting();
  const [selectedOption, setSelectedOption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState(null);
  const [eligible, setEligible] = useState(true);

  React.useEffect(() => {
    const checkElig = checkEligibility(proposal.id);
    setEligible(checkElig);
  }, [proposal.id, checkEligibility, userAddress]);

  const handleSubmitVote = async () => {
    if (!selectedOption || !userAddress) {
      setError('Please select an option and connect your wallet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Generate nullifier (deterministic, unique to voter + proposal)
      const userSecret = `${userAddress}${proposal.id}secret`;
      const nullifier = nullifierUtils.generateNullifier(userSecret, proposal.id);

      // 2. Get option index
      const optionIndex = proposal.options.indexOf(selectedOption);

      // 3. Encrypt vote (in real app, would use public key)
      const { encryptedVote } = encryptionUtils.encryptVote(optionIndex, 'publicKey');

      // 4. Generate ZK proof
      const proofData = await zkProofGenerator.generateVoteProof(nullifier, optionIndex, encryptedVote);

      // 5. Calculate vote weight
      const weight = voteWeightCalculator.calculateWeight(proposal.votingMode, 1);

      // 6. Submit vote
      const result = await submitVote(
        proposal.id,
        optionIndex,
        encryptedVote,
        proofData.proof,
        nullifier
      );

      // Show confirmation
      setConfirmationData({
        nullifier,
        option: selectedOption,
        weight,
        votingMode: proposal.votingMode,
        timestamp: new Date().toLocaleString(),
      });

      setShowConfirmation(true);
      setSelectedOption('');

      if (onVoteSuccess) {
        setTimeout(() => onVoteSuccess(), 2000);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit vote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!eligible) {
    return (
      <Alert severity="error">
        You are not eligible to vote on this proposal. You may not have sufficient tokens or
        already voted.
      </Alert>
    );
  }

  return (
    <>
      <FormControl component="fieldset" fullWidth sx={{ mt: 2 }}>
        <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
          Select Your Vote
        </FormLabel>
        <RadioGroup
          value={selectedOption}
          onChange={(e) => setSelectedOption(e.target.value)}
        >
          {proposal.options.map((option, idx) => (
            <Box key={idx} sx={{ mb: 1.5, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              <FormControlLabel
                value={option}
                control={<Radio />}
                label={
                  <Box sx={{ ml: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {option}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {proposal.voteWeight[option] || 0} votes
                    </Typography>
                  </Box>
                }
              />
            </Box>
          ))}
        </RadioGroup>
      </FormControl>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          onClick={handleSubmitVote}
          disabled={!selectedOption || loading}
          fullWidth
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1 }} />
              Processing...
            </>
          ) : (
            'Submit Vote'
          )}
        </Button>
      </Box>

      <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          📍 Privacy Note: Your vote will be encrypted and a zero-knowledge proof will be
          generated to prove your vote validity without revealing who you voted for.
        </Typography>
      </Box>

      <Dialog
        open={showConfirmation && !!confirmationData}
        onClose={() => setShowConfirmation(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon sx={{ color: 'success.main' }} />
          Vote Submitted Successfully
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Selected Option
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                {confirmationData?.option}
              </Typography>
            </Box>

            {confirmationData?.votingMode === 'quadratic' && (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Vote Weight (Quadratic)
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {confirmationData?.weight.toFixed(2)}
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Timestamp
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {confirmationData?.timestamp}
            </Typography>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Nullifier (for proof verification)
            </Typography>
            <Typography
              variant="body2"
              sx={{
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                bgcolor: 'background.paper',
                p: 1,
                borderRadius: 1,
              }}
            >
              {confirmationData?.nullifier}
            </Typography>

            <Box sx={{ mt: 3, p: 1.5, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="caption">
                ✓ Your vote has been encrypted and stored on-chain. You cannot change your vote
                once submitted.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmation(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default VoteForm;
