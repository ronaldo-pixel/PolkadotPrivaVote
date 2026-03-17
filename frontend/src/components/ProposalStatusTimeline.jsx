import React from 'react';
import {
  Stepper,
  Step,
  StepLabel,
  Box,
  Chip,
  Typography,
  Alert,
  LinearProgress,
} from '@mui/material';
import { proposalStatusUtils } from '../utils/contractUtils';

const ProposalStatusTimeline = ({ proposal, currentBlock = 150 }) => {
  const steps = ['Pending DKG', 'Active Voting', 'Ended', 'Revealed'];
  const statusMap = {
    'PENDING_DKG': 0,
    'ACTIVE': 1,
    'ENDED': 2,
    'REVEALED': 3,
    'CANCELLED': -1,
  };

  const currentStep = statusMap[proposal.status] || -1;
  const statusColor = proposalStatusUtils.getStatusColor(proposal.status);
  const blockProgress = Math.min((currentBlock / proposal.endBlock) * 100, 100);

  return (
    <Box sx={{ my: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Proposal Lifecycle</Typography>
        <Chip
          label={proposalStatusUtils.getStatusLabel(proposal.status)}
          sx={{
            bgcolor: statusColor,
            color: 'white',
            fontWeight: 600,
          }}
        />
      </Box>

      {proposal.status === 'CANCELLED' ? (
        <Alert severity="error">This proposal has been cancelled due to low participation.</Alert>
      ) : (
        <>
          <Stepper activeStep={currentStep} sx={{ mb: 3 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {proposal.status !== 'REVEALED' && (
            <>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Block Progress</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {currentBlock} / {proposal.endBlock}
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={blockProgress} />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mt: 2 }}>
                <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Start Block
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    #{proposal.startBlock}
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    End Block
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    #{proposal.endBlock}
                  </Typography>
                </Box>
              </Box>
            </>
          )}

          {proposal.status === 'ACTIVE' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Voting is currently active. Keyholders are setting up the public key for encryption.
            </Alert>
          )}

          {proposal.status === 'PENDING_DKG' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Waiting for DKG (Distributed Key Generation) setup. Once complete, voting will begin.
            </Alert>
          )}

          {proposal.status === 'ENDED' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Voting has ended. Awaiting decryption of votes by keyholders.
            </Alert>
          )}
        </>
      )}
    </Box>
  );
};

export default ProposalStatusTimeline;
