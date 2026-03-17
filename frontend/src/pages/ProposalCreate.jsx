import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useVoting } from '../context/VotingContext';

const ProposalCreate = () => {
  const navigate = useNavigate();
  const { createProposal, userAddress, loading } = useVoting();
  const [activeStep, setActiveStep] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [createdProposal, setCreatedProposal] = useState(null);

  // Form state
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [votingMode, setVotingMode] = useState('normal');
  const [startBlock, setStartBlock] = useState('');
  const [endBlock, setEndBlock] = useState('');
  const [eligibilityThreshold, setEligibilityThreshold] = useState('');
  const [minVoterThreshold, setMinVoterThreshold] = useState('');
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!description.trim()) newErrors.description = 'Description is required';
    if (options.some((opt) => !opt.trim()))
      newErrors.options = 'All options must be filled';
    if (options.length < 2) newErrors.options = 'At least 2 options required';
    if (options.length > 10) newErrors.options = 'Maximum 10 options allowed';
    if (!startBlock) newErrors.startBlock = 'Start block is required';
    if (!endBlock) newErrors.endBlock = 'End block is required';
    if (parseInt(startBlock) >= parseInt(endBlock))
      newErrors.endBlock = 'End block must be after start block';
    if (!eligibilityThreshold) newErrors.eligibilityThreshold = 'Eligibility threshold required';
    if (!minVoterThreshold) newErrors.minVoterThreshold = 'Minimum voter threshold required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleNext = () => {
    if (activeStep === 0) {
      // Validate basic info
      if (!description.trim() || options.some((opt) => !opt.trim()) || options.length < 2) {
        setErrors({
          description: !description.trim() ? 'Description required' : '',
          options:
            options.length < 2 || options.some((opt) => !opt.trim())
              ? 'All options required (min 2)'
              : '',
        });
        return;
      }
    } else if (activeStep === 1) {
      // Validate timing
      if (!startBlock || !endBlock || parseInt(startBlock) >= parseInt(endBlock)) {
        setErrors({
          startBlock: !startBlock ? 'Start block required' : '',
          endBlock: !endBlock || parseInt(startBlock) >= parseInt(endBlock)
            ? 'Invalid block range'
            : '',
        });
        return;
      }
    } else if (activeStep === 2) {
      // Validate thresholds
      if (!eligibilityThreshold || !minVoterThreshold) {
        setErrors({
          eligibilityThreshold: !eligibilityThreshold ? 'Required' : '',
          minVoterThreshold: !minVoterThreshold ? 'Required' : '',
        });
        return;
      }
    }

    setErrors({});
    setActiveStep(activeStep + 1);
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const proposalData = {
        description,
        options,
        votingMode,
        startBlock: parseInt(startBlock),
        endBlock: parseInt(endBlock),
        eligibilityThreshold: parseInt(eligibilityThreshold),
        minVoterThreshold: parseInt(minVoterThreshold),
      };

      const newProposal = await createProposal(proposalData);
      setCreatedProposal(newProposal);
      setShowConfirmation(true);
    } catch (err) {
      setErrors({ submit: err.message });
    }
  };

  const handleCloseConfirmation = () => {
    setShowConfirmation(false);
    navigate(`/proposal/${createdProposal.id}`);
  };

  if (!userAddress) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">Please connect your wallet to create a proposal.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Create New Proposal
        </Typography>
        <Typography color="text.secondary">
          Define your proposal and set voting parameters
        </Typography>
      </Box>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        <Step>
          <StepLabel>Proposal Details</StepLabel>
        </Step>
        <Step>
          <StepLabel>Voting Timeline</StepLabel>
        </Step>
        <Step>
          <StepLabel>Thresholds</StepLabel>
        </Step>
        <Step>
          <StepLabel>Review</StepLabel>
        </Step>
      </Stepper>

      <Card>
        <CardContent>
          {activeStep === 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                What is your proposal about?
              </Typography>

              <TextField
                fullWidth
                label="Proposal Description"
                multiline
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                error={!!errors.description}
                helperText={errors.description}
                placeholder="Describe your proposal clearly..."
                sx={{ mb: 3 }}
              />

              <Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    Voting Options ({options.length})
                  </Typography>
                  {options.length < 10 && (
                    <Button
                      startIcon={<AddIcon />}
                      size="small"
                      variant="outlined"
                      onClick={handleAddOption}
                    >
                      Add Option
                    </Button>
                  )}
                </Box>

                {errors.options && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {errors.options}
                  </Alert>
                )}

                {options.map((option, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      gap: 1,
                      mb: 1.5,
                      alignItems: 'flex-end',
                    }}
                  >
                    <TextField
                      label={`Option ${idx + 1}`}
                      value={option}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder="Enter voting option..."
                      fullWidth
                    />
                    {options.length > 2 && (
                      <IconButton
                        onClick={() => handleRemoveOption(idx)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Box>

              <FormControl sx={{ mt: 3, mb: 2 }} fullWidth>
                <FormLabel>Voting Mode</FormLabel>
                <RadioGroup
                  value={votingMode}
                  onChange={(e) => setVotingMode(e.target.value)}
                  row
                >
                  <FormControlLabel
                    value="normal"
                    control={<Radio />}
                    label="Normal (1 token = 1 vote)"
                  />
                  <FormControlLabel
                    value="quadratic"
                    control={<Radio />}
                    label="Quadratic (vote power = √tokens)"
                  />
                </RadioGroup>
              </FormControl>
            </Box>
          )}

          {activeStep === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                When should voting occur?
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Start Block"
                    type="number"
                    value={startBlock}
                    onChange={(e) => setStartBlock(e.target.value)}
                    error={!!errors.startBlock}
                    helperText={errors.startBlock || 'Block when voting begins'}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="End Block"
                    type="number"
                    value={endBlock}
                    onChange={(e) => setEndBlock(e.target.value)}
                    error={!!errors.endBlock}
                    helperText={errors.endBlock || 'Block when voting ends'}
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                <Typography variant="caption">
                  ℹ️ Voting duration: {startBlock && endBlock
                    ? parseInt(endBlock) - parseInt(startBlock)
                    : 0}{' '}
                  blocks
                </Typography>
              </Box>
            </Box>
          )}

          {activeStep === 2 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Set participation thresholds
              </Typography>

              <TextField
                fullWidth
                label="Eligibility Threshold (tokens)"
                type="number"
                value={eligibilityThreshold}
                onChange={(e) => setEligibilityThreshold(e.target.value)}
                error={!!errors.eligibilityThreshold}
                helperText={errors.eligibilityThreshold || 'Minimum tokens to vote'}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Minimum Voter Threshold"
                type="number"
                value={minVoterThreshold}
                onChange={(e) => setMinVoterThreshold(e.target.value)}
                error={!!errors.minVoterThreshold}
                helperText={errors.minVoterThreshold || 'Minimum votes for valid proposal'}
                sx={{ mb: 2 }}
              />

              <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="caption">
                  If participation falls below this threshold, the proposal may be cancelled.
                </Typography>
              </Box>
            </Box>
          )}

          {activeStep === 3 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Review Proposal
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {description}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Voting Mode
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                      {votingMode === 'quadratic' ? 'Quadratic' : 'Normal'}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Options
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                      {options.length} options
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Voting Options:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {options.map((opt, idx) => (
                        <Chip key={idx} label={opt} />
                      ))}
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Block Range
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                      {startBlock} - {endBlock}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Thresholds
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                      {eligibilityThreshold} tokens, {minVoterThreshold} votes
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {errors.submit && (
                <Alert severity="error" sx={{ mt: 3 }}>
                  {errors.submit}
                </Alert>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', gap: 2 }}>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0 || loading}
        >
          Back
        </Button>
        {activeStep < 3 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={loading}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Creating...
              </>
            ) : (
              'Create Proposal'
            )}
          </Button>
        )}
      </Box>

      <Dialog
        open={showConfirmation && !!createdProposal}
        onClose={handleCloseConfirmation}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon sx={{ color: 'success.main' }} />
          Proposal Created Successfully
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Your proposal has been created and is now awaiting DKG setup from keyholders.
            </Typography>

            <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Proposal ID
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  mt: 0.5,
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                }}
              >
                {createdProposal?.id}
              </Typography>
            </Box>

            <Typography variant="caption" color="text.secondary">
              Status: PENDING_DKG - Waiting for keyholders to generate the encryption public key
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirmation} variant="contained">
            View Proposal
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProposalCreate;
