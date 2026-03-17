import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useVoting } from '../context/VotingContext';

const monoFont = '"Share Tech Mono", "JetBrains Mono", "Courier New", monospace';
const bodyFont = '"IBM Plex Mono", "Courier New", monospace';

const STEPS = ['details', 'timeline', 'thresholds', 'review'];

const dataBox = {
  p: 1.5,
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid #1e2a35',
  borderRadius: '2px',
  height: '100%',
};

const TerminalInput = ({ label, value, onChange, type = 'text', placeholder = '', multiline = false, error = '' }) => (
  <Box sx={{ mb: 2 }}>
    <Typography sx={{
      fontFamily: monoFont,
      fontSize: '0.65rem',
      color: '#ffffff',
      letterSpacing: '0.15em',
      textTransform: 'uppercase',
      mb: 0.75,
      '&::before': { content: '"&gt; "', color: '#00f5d4' },
    }}>
      {label}
    </Typography>
    <Box sx={{
      display: 'flex',
      alignItems: multiline ? 'flex-start' : 'center',
      gap: 1,
      border: '1px solid',
      borderColor: error ? 'rgba(255,60,60,0.5)' : '#1e2a35',
      borderRadius: '2px',
      px: 1.5,
      py: multiline ? 1.25 : 0.9,
      background: '#080c10',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      '&:focus-within': {
        borderColor: error ? 'rgba(255,60,60,0.5)' : '#00f5d4',
        boxShadow: error ? 'none' : '0 0 0 2px rgba(0,245,212,0.15)',
      },
    }}>
      <Typography sx={{
        fontFamily: monoFont,
        fontSize: '0.72rem',
        color: 'rgba(226,232,240,0.2)',
        flexShrink: 0,
        mt: multiline ? 0.1 : 0,
      }}>
        &gt;
      </Typography>
      <Box
        component={multiline ? 'textarea' : 'input'}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={multiline ? 4 : undefined}
        sx={{
          fontFamily: bodyFont,
          fontSize: '0.82rem',
          color: '#e2e8f0',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          width: '100%',
          resize: multiline ? 'vertical' : 'none',
          letterSpacing: '0.03em',
          lineHeight: 1.65,
          '&::placeholder': { color: '#334155' },
        }}
      />
    </Box>
    {error && (
      <Typography sx={{
        fontFamily: bodyFont,
        fontSize: '0.68rem',
        color: '#ff3c3c',
        mt: 0.5,
        letterSpacing: '0.04em',
      }}>
        &gt; {error}
      </Typography>
    )}
  </Box>
);

const ProposalCreate = () => {
  const navigate = useNavigate();
  const { createProposal, userAddress, loading } = useVoting();
  const [activeStep, setActiveStep] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [createdProposal, setCreatedProposal] = useState(null);

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
    if (!description.trim()) newErrors.description = 'description is required';
    if (options.some((opt) => !opt.trim())) newErrors.options = 'all options must be filled';
    if (options.length < 2) newErrors.options = 'at least 2 options required';
    if (options.length > 10) newErrors.options = 'maximum 10 options allowed';
    if (!startBlock) newErrors.startBlock = 'start block is required';
    if (!endBlock) newErrors.endBlock = 'end block is required';
    if (parseInt(startBlock) >= parseInt(endBlock)) newErrors.endBlock = 'end block must be after start block';
    if (!eligibilityThreshold) newErrors.eligibilityThreshold = 'eligibility threshold required';
    if (!minVoterThreshold) newErrors.minVoterThreshold = 'minimum voter threshold required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddOption = () => {
    if (options.length < 10) setOptions([...options, '']);
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index, value) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!description.trim() || options.some((opt) => !opt.trim()) || options.length < 2) {
        setErrors({
          description: !description.trim() ? 'description required' : '',
          options: options.length < 2 || options.some((o) => !o.trim()) ? 'all options required (min 2)' : '',
        });
        return;
      }
    } else if (activeStep === 1) {
      if (!startBlock || !endBlock || parseInt(startBlock) >= parseInt(endBlock)) {
        setErrors({
          startBlock: !startBlock ? 'start block required' : '',
          endBlock: !endBlock || parseInt(startBlock) >= parseInt(endBlock) ? 'invalid block range' : '',
        });
        return;
      }
    } else if (activeStep === 2) {
      if (!eligibilityThreshold || !minVoterThreshold) {
        setErrors({
          eligibilityThreshold: !eligibilityThreshold ? 'required' : '',
          minVoterThreshold: !minVoterThreshold ? 'required' : '',
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
    if (!validateForm()) return;
    try {
      const newProposal = await createProposal({
        description,
        options,
        votingMode,
        startBlock: parseInt(startBlock),
        endBlock: parseInt(endBlock),
        eligibilityThreshold: parseInt(eligibilityThreshold),
        minVoterThreshold: parseInt(minVoterThreshold),
      });
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
      <Box sx={{
        fontFamily: bodyFont,
        background: '#080c10',
        minHeight: '100vh',
        borderLeft: '2px solid rgba(0,245,212,0.12)',
      }}>
        <Box sx={{ maxWidth: '900px', margin: '0 auto', padding: '2.5rem 2rem' }}>
          <Box sx={{ fontFamily: monoFont, fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.12em', mb: '1.75rem' }}>
            {'> /proposals/create'}
            <Box component="span" sx={{
              display: 'inline-block', width: '6px', height: '0.8em',
              background: '#00f5d4', ml: '3px', verticalAlign: 'middle',
              animation: 'blink 1s step-end infinite',
              '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
            }} />
          </Box>
          <Box sx={{ borderLeft: '2px solid #ffb800', pl: 1.5 }}>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.78rem', color: '#ffb800', letterSpacing: '0.04em' }}>
              &gt; connect your wallet to create a proposal
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      fontFamily: bodyFont,
      background: '#080c10',
      minHeight: '100vh',
      borderLeft: '2px solid rgba(0,245,212,0.12)',
    }}>
      <Container maxWidth="md" sx={{ py: '2.5rem' }}>

        <Box sx={{ fontFamily: monoFont, fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.12em', mb: '1.75rem' }}>
          {'> /proposals/create'}
          <Box component="span" sx={{
            display: 'inline-block', width: '6px', height: '0.8em',
            background: '#00f5d4', ml: '3px', verticalAlign: 'middle',
            animation: 'blink 1s step-end infinite',
            '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
          }} />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <Box>
            <Typography sx={{ fontFamily: monoFont, fontWeight: 400, fontSize: '1.4rem', color: '#e2e8f0', letterSpacing: '0.06em', textTransform: 'uppercase', mb: '0.3rem' }}>
              CREATE PROPOSAL
            </Typography>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.08em' }}>
              STEP {activeStep + 1} OF {STEPS.length} ── {STEPS[activeStep].toUpperCase()}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ fontFamily: bodyFont, fontSize: '0.6rem', color: '#1e2a35', overflow: 'hidden', whiteSpace: 'nowrap', userSelect: 'none', mb: '1.75rem' }}>
          {'─'.repeat(120)}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: '2rem', flexWrap: 'wrap', gap: '4px' }}>
          {STEPS.map((label, idx) => {
            const isPast = idx < activeStep;
            const isActive = idx === activeStep;
            return (
              <React.Fragment key={label}>
                <Typography component="span" sx={{
                  fontFamily: monoFont,
                  fontSize: '0.65rem',
                  fontWeight: 400,
                  color: isActive ? '#00f5d4' : isPast ? '#64748b' : '#334155',
                  textShadow: isActive ? '0 0 8px rgba(0,245,212,0.5)' : 'none',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap',
                }}>
                  {isPast ? `[✓: ${label.toUpperCase()}]` : isActive ? `[▶: ${label.toUpperCase()}]` : `[·: ${label.toUpperCase()}]`}
                </Typography>
                {idx < STEPS.length - 1 && (
                  <Typography component="span" sx={{
                    fontFamily: monoFont,
                    fontSize: '0.65rem',
                    color: isPast ? '#2e3e4d' : '#1e2a35',
                    mx: '4px',
                    userSelect: 'none',
                  }}>
                    ────
                  </Typography>
                )}
              </React.Fragment>
            );
          })}
        </Box>

        <Box sx={{
          background: '#0d1117',
          border: '1px solid #1e2a35',
          borderTop: '2px solid rgba(0,245,212,0.25)',
          borderRadius: '2px',
          p: 3,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
        }}>

          {activeStep === 0 && (
            <Box>
              <Typography sx={{ fontFamily: bodyFont, fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.12em', mb: '1.5rem' }}>
                {'/* proposal details */'}
              </Typography>

              <TerminalInput
                label="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="describe your proposal clearly..."
                multiline
                error={errors.description}
              />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography sx={{ fontFamily: monoFont, fontSize: '0.65rem', color: '#fcfcfc', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  OPTIONS ({options.length})
                </Typography>
                {options.length < 10 && (
                  <Box
                    onClick={handleAddOption}
                    sx={{
                      fontFamily: monoFont,
                      fontSize: '0.65rem',
                      color: '#00f5d4',
                      border: '1px solid rgba(0,245,212,0.25)',
                      borderRadius: '2px',
                      px: 1,
                      py: 0.25,
                      cursor: 'pointer',
                      letterSpacing: '0.1em',
                      userSelect: 'none',
                      transition: 'background 0.15s, box-shadow 0.15s',
                      '&:hover': {
                        background: 'rgba(0,245,212,0.07)',
                        boxShadow: '0 0 8px rgba(0,245,212,0.4)',
                      },
                    }}
                  >
                    [+ ADD OPTION]
                  </Box>
                )}
              </Box>

              {errors.options && (
                <Typography sx={{ fontFamily: bodyFont, fontSize: '0.68rem', color: '#ff3c3c', mb: 1, letterSpacing: '0.04em' }}>
                  &gt; {errors.options}
                </Typography>
              )}

              {options.map((option, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                  <Typography sx={{ fontFamily: monoFont, fontSize: '0.72rem', color: '#334155', width: 28, flexShrink: 0 }}>
                    [{idx + 1}]
                  </Typography>
                  <Box sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid #1e2a35',
                    borderRadius: '2px',
                    px: 1.5,
                    py: 0.75,
                    background: '#080c10',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    '&:focus-within': {
                      borderColor: '#00f5d4',
                      boxShadow: '0 0 0 2px rgba(0,245,212,0.15)',
                    },
                  }}>
                    <Box
                      component="input"
                      value={option}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      placeholder={`option ${idx + 1}...`}
                      sx={{
                        fontFamily: bodyFont,
                        fontSize: '0.8rem',
                        color: '#e2e8f0',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        width: '100%',
                        letterSpacing: '0.03em',
                        '&::placeholder': { color: '#334155' },
                      }}
                    />
                  </Box>
                  {options.length > 2 && (
                    <Box
                      onClick={() => handleRemoveOption(idx)}
                      sx={{
                        fontFamily: monoFont,
                        fontSize: '0.65rem',
                        color: 'rgba(255,60,60,0.45)',
                        border: '1px solid rgba(255,60,60,0.15)',
                        borderRadius: '2px',
                        px: 0.75,
                        py: 0.25,
                        cursor: 'pointer',
                        flexShrink: 0,
                        userSelect: 'none',
                        transition: 'all 0.15s',
                        '&:hover': {
                          color: '#ff3c3c',
                          borderColor: 'rgba(255,60,60,0.4)',
                          background: 'rgba(255,60,60,0.04)',
                        },
                      }}
                    >
                      [x]
                    </Box>
                  )}
                </Box>
              ))}

              <Box sx={{ mt: 3 }}>
                <Typography sx={{ fontFamily: monoFont, fontSize: '0.65rem', color: '#ffffff', letterSpacing: '0.15em', textTransform: 'uppercase', mb: 1.5 }}>
                  VOTING_MODE
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {[
                    { value: 'normal',  color: '#ffffff',  label: 'normal',    sub: '1 token = 1 vote' },
                    { value: 'quadratic', color: '#ffffff', label: 'quadratic', sub: 'vote power = sqrt(tokens)' },
                  ].map(({ value, label, sub }) => {
                    const selected = votingMode === value;
                    return (
                      <Box
                        key={value}
                        onClick={() => setVotingMode(value)}
                        sx={{
                          flex: 1,
                          p: 1.5,
                          border: '1px solid',
                          borderColor: selected ? 'rgba(0,245,212,0.45)' : '#1e2a35',
                          borderRadius: '2px',
                          background: selected ? 'rgba(0,245,212,0.05)' : 'transparent',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'all 0.15s',
                          '&:hover': selected ? {} : {
                            borderColor: 'rgba(0,245,212,0.2)',
                            background: 'rgba(0,245,212,0.02)',
                          },
                        }}
                      >
                        <Typography sx={{ fontFamily: monoFont, fontSize: '0.75rem', color: selected ? '#00f5d4' : '#64748b', mb: 0.25, letterSpacing: '0.06em' }}>
                          {selected ? '[▶]' : '[·]'} {label}
                        </Typography>
                        <Typography sx={{ fontFamily: bodyFont, fontSize: '0.65rem', color: '#334155', letterSpacing: '0.03em' }}>
                          {sub}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          )}

          {activeStep === 1 && (
            <Box>
              <Typography sx={{ fontFamily: bodyFont, fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.12em', mb: '1.5rem' }}>
                {'/* voting timeline */'}
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TerminalInput
                    label="start_block"
                    value={startBlock}
                    onChange={(e) => setStartBlock(e.target.value)}
                    type="number"
                    placeholder="block number..."
                    error={errors.startBlock}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TerminalInput
                    label="end_block"
                    value={endBlock}
                    onChange={(e) => setEndBlock(e.target.value)}
                    type="number"
                    placeholder="block number..."
                    error={errors.endBlock}
                  />
                </Grid>
              </Grid>

              <Box sx={{ borderLeft: '2px solid #1e2a35', pl: 1.5, mt: 0.5 }}>
                <Typography sx={{ fontFamily: bodyFont, fontSize: '0.72rem', color: '#64748b' }}>
                  duration:{' '}
                  <Box component="span" sx={{ color: startBlock && endBlock ? '#00f5d4' : '#334155' }}>
                    {startBlock && endBlock ? `${parseInt(endBlock) - parseInt(startBlock)} blocks` : '--'}
                  </Box>
                </Typography>
              </Box>
            </Box>
          )}

          {activeStep === 2 && (
            <Box>
              <Typography sx={{ fontFamily: bodyFont, fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.12em', mb: '1.5rem' }}>
                {'/* participation thresholds */'}
              </Typography>

              <TerminalInput
                label="eligibility_threshold (tokens)"
                value={eligibilityThreshold}
                onChange={(e) => setEligibilityThreshold(e.target.value)}
                type="number"
                placeholder="minimum tokens to vote..."
                error={errors.eligibilityThreshold}
              />

              <TerminalInput
                label="min_voter_threshold"
                value={minVoterThreshold}
                onChange={(e) => setMinVoterThreshold(e.target.value)}
                type="number"
                placeholder="minimum votes for a valid proposal..."
                error={errors.minVoterThreshold}
              />

              <Box sx={{ borderLeft: '2px solid #1e2a35', pl: 1.5 }}>
                <Typography sx={{ fontFamily: bodyFont, fontSize: '0.7rem', color: '#334155', lineHeight: 1.7 }}>
                  if participation falls below the minimum voter threshold the proposal may be cancelled
                </Typography>
              </Box>
            </Box>
          )}

          {activeStep === 3 && (
            <Box>
              <Typography sx={{ fontFamily: bodyFont, fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.12em', mb: '1.5rem' }}>
                {'/* review and confirm */'}
              </Typography>

              <Grid container spacing={1.5}>
                <Grid item xs={12}>
                  <Box sx={dataBox}>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: 0.5 }}>
                      DESCRIPTION
                    </Typography>
                    <Typography sx={{ fontFamily: bodyFont, fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.6 }}>
                      {description}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={dataBox}>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: 0.5 }}>
                      VOTING_MODE
                    </Typography>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.82rem', color: '#00f5d4', letterSpacing: '0.06em' }}>
                      {votingMode}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={dataBox}>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: 0.5 }}>
                      BLOCK_RANGE
                    </Typography>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.82rem', color: '#e2e8f0', letterSpacing: '0.04em' }}>
                      {startBlock} {'\u2014\u2014'} {endBlock}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={dataBox}>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: 0.5 }}>
                      ELIGIBILITY_THRESHOLD
                    </Typography>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.82rem', color: '#e2e8f0', letterSpacing: '0.04em' }}>
                      {eligibilityThreshold} tokens
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={dataBox}>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: 0.5 }}>
                      MIN_VOTER_THRESHOLD
                    </Typography>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.82rem', color: '#e2e8f0', letterSpacing: '0.04em' }}>
                      {minVoterThreshold} votes
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Box sx={dataBox}>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: 1 }}>
                      OPTIONS
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {options.map((opt, idx) => (
                        <Typography
                          key={idx}
                          sx={{
                            fontFamily: bodyFont,
                            fontSize: '0.72rem',
                            color: '#64748b',
                            border: '1px solid #1e2a35',
                            borderRadius: '2px',
                            px: 1,
                            py: 0.25,
                            lineHeight: 1.6,
                          }}
                        >
                          [{idx + 1}] {opt}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                </Grid>
              </Grid>

              {errors.submit && (
                <Box sx={{ borderLeft: '2px solid #ff3c3c', pl: 1.5, mt: 2 }}>
                  <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ff3c3c', letterSpacing: '0.04em' }}>
                    &gt; error: {errors.submit}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'space-between' }}>
          <Button
            onClick={handleBack}
            disabled={activeStep === 0 || loading}
            disableRipple
            sx={{
              fontFamily: monoFont,
              fontSize: '0.65rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: activeStep === 0 || loading ? '#334155' : '#64748b',
              border: '1px solid',
              borderColor: activeStep === 0 || loading ? '#1e2a35' : '#2e3e4d',
              borderRadius: '2px',
              px: 2,
              py: 0.75,
              transition: 'all 0.15s',
              '&:hover:not(:disabled)': {
                borderColor: '#64748b',
                color: '#e2e8f0',
                background: 'transparent',
              },
            }}
          >
            [{'<'} BACK]
          </Button>

          {activeStep < 3 ? (
            <Button
              onClick={handleNext}
              disabled={loading}
              disableRipple
              sx={{
                fontFamily: monoFont,
                fontSize: '0.65rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#00f5d4',
                border: '1px solid rgba(0,245,212,0.4)',
                borderRadius: '2px',
                px: 2,
                py: 0.75,
                background: 'transparent',
                transition: 'background 0.15s, box-shadow 0.15s',
                '&:hover:not(:disabled)': {
                  background: 'rgba(0,245,212,0.07)',
                  boxShadow: '0 0 8px rgba(0,245,212,0.5)',
                },
              }}
            >
              [NEXT {'>'}]
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              disableRipple
              sx={{
                fontFamily: monoFont,
                fontSize: '0.65rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: loading ? '#334155' : '#00f5d4',
                border: '1px solid',
                borderColor: loading ? '#1e2a35' : 'rgba(0,245,212,0.4)',
                borderRadius: '2px',
                px: 2.5,
                py: 0.75,
                background: 'transparent',
                transition: 'background 0.15s, box-shadow 0.15s',
                '&:hover:not(:disabled)': {
                  background: 'rgba(0,245,212,0.07)',
                  boxShadow: '0 0 8px rgba(0,245,212,0.5)',
                },
              }}
            >
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{
                    width: '120px',
                    height: '2px',
                    background: '#1e2a35',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <Box sx={{
                      position: 'absolute',
                      top: 0, bottom: 0,
                      width: '40px',
                      background: '#00f5d4',
                      animation: 'scanProgress 1.2s linear infinite',
                      '@keyframes scanProgress': {
                        '0%': { left: '-50px' },
                        '100%': { left: '100%' },
                      },
                    }} />
                  </Box>
                  creating...
                </Box>
              ) : (
                '[ CREATE PROPOSAL ]'
              )}
            </Button>
          )}
        </Box>

        <Box sx={{ fontFamily: bodyFont, fontSize: '0.6rem', color: '#1e2a35', overflow: 'hidden', whiteSpace: 'nowrap', userSelect: 'none', mt: '2rem' }}>
          {'─'.repeat(120)}
        </Box>
        <Box sx={{ fontFamily: bodyFont, fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.07em', mt: '0.5rem' }}>
          {'> step '}{activeStep + 1}{' of '}{STEPS.length}{' · system nominal'}
        </Box>

        <Dialog
          open={showConfirmation && !!createdProposal}
          onClose={handleCloseConfirmation}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              background: '#0d1117',
              border: '1px solid rgba(57,255,20,0.3)',
              borderRadius: '2px',
              boxShadow: '0 0 30px rgba(57,255,20,0.05)',
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
            },
          }}
        >
          <DialogTitle sx={{
            fontFamily: monoFont,
            fontSize: '0.82rem',
            fontWeight: 400,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#39ff14',
            textShadow: '0 0 10px rgba(57,255,20,0.4)',
            borderBottom: '1px solid rgba(57,255,20,0.15)',
            py: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}>
            <Box sx={{
              width: 8, height: 8,
              borderRadius: '50%',
              background: '#39ff14',
              boxShadow: '0 0 8px rgba(57,255,20,0.8)',
              flexShrink: 0,
              animation: 'glowPulse 2s ease-in-out infinite',
              '@keyframes glowPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
            }} />
            PROPOSAL CREATED
          </DialogTitle>

          <DialogContent sx={{ pt: 2.5, pb: 1 }}>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.72rem', color: '#64748b', mb: 2, lineHeight: 1.7, letterSpacing: '0.04em' }}>
              awaiting dkg setup -- keyholders will generate the election public key
            </Typography>

            <Box sx={{ ...dataBox, mb: 1.5 }}>
              <Typography sx={{ fontFamily: monoFont, fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.15em', textTransform: 'uppercase', mb: 0.5 }}>
                PROPOSAL_ID
              </Typography>
              <Typography sx={{ fontFamily: bodyFont, fontSize: '0.82rem', color: '#00f5d4', wordBreak: 'break-all', letterSpacing: '0.04em' }}>
                {createdProposal?.id}
              </Typography>
            </Box>

            <Box sx={{ borderLeft: '2px solid rgba(255,184,0,0.3)', pl: 1.5 }}>
              <Typography sx={{ fontFamily: monoFont, fontSize: '0.7rem', color: '#ffb800', letterSpacing: '0.08em', animation: 'glowPulse 2s ease-in-out infinite' }}>
                STATUS: PENDING_DKG
              </Typography>
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #1e2a35' }}>
            <Button
              onClick={handleCloseConfirmation}
              disableRipple
              sx={{
                fontFamily: monoFont,
                fontSize: '0.65rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#00f5d4',
                border: '1px solid rgba(0,245,212,0.4)',
                borderRadius: '2px',
                px: 2,
                py: 0.75,
                background: 'transparent',
                transition: 'background 0.15s, box-shadow 0.15s',
                '&:hover': {
                  background: 'rgba(0,245,212,0.07)',
                  boxShadow: '0 0 8px rgba(0,245,212,0.5)',
                },
              }}
            >
              {'> VIEW PROPOSAL'}
            </Button>
          </DialogActions>
        </Dialog>

      </Container>
    </Box>
  );
};

export default ProposalCreate;