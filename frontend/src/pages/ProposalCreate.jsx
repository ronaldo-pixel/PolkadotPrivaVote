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

const monoFont = "JetBrains Mono";
const bodyFont = "IBM Plex Mono";

const STEPS = ['details', 'options', 'parameters', 'review'];

const STEP_ACCENT = {
  0: '#00f5d4',
  1: '#ffb800',
  2: '#00f5d4',
  3: '#39ff14',
};

const dataBox = {
  p: 1.5,
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid #1e2a35',
  borderRadius: '2px',
  height: '100%',
};

const BlinkCursor = ({ color = '#00f5d4' }) => (
  <Box component="span" sx={{
    display: 'inline-block', width: '6px', height: '0.99em',
    background: color, ml: '3px', verticalAlign: 'middle',
    animation: 'blink 1s step-end infinite',
    '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
  }} />
);

const FieldLabel = ({ children }) => (
  <Typography sx={{
    fontFamily: monoFont,
    fontSize: '0.75rem',
    color: '#ffffff',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    mb: '0.4rem',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  }}>
    <Box component="span" sx={{ color: '#00f5d4' }}>&gt;</Box>
    {children}
  </Typography>
);

const TerminalField = ({ label, error, children }) => (
  <Box sx={{ mb: 2 }}>
    <FieldLabel>{label}</FieldLabel>
    <Box sx={{
      border: '1px solid',
      borderColor: error ? 'rgba(255,60,60,0.5)' : '#1e2a35',
      borderRadius: '2px',
      background: '#080c10',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      '&:focus-within': {
        borderColor: error ? 'rgba(255,60,60,0.5)' : '#00f5d4',
        boxShadow: error ? 'none' : '0 0 0 2px rgba(0,245,212,0.15)',
      },
    }}>
      {children}
    </Box>
    {error && (
      <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ff3c3c', mt: '4px', letterSpacing: '0.04em' }}>
        &gt; {error}
      </Typography>
    )}
  </Box>
);

const inputSx = {
  fontFamily: bodyFont,
  fontSize: '0.82rem',
  color: '#e2e8f0',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  width: '100%',
  letterSpacing: '0.03em',
  padding: '0.7rem 1rem',
  display: 'block',
  '&::placeholder': { color: '#b1b1b1' },
};

const ProposalCreate = () => {
  const navigate = useNavigate();
  const { createProposal, userAddress, loading } = useVoting();

  const [activeStep, setActiveStep] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [createdProposal, setCreatedProposal] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [votingMode, setVotingMode] = useState('normal');
  const [options, setOptions] = useState(['', '', '']);
  const [minVoterThreshold, setMinVoterThreshold] = useState('');
  const [eligibilityThreshold, setEligibilityThreshold] = useState('');
  const [errors, setErrors] = useState({});

  const handleAddOption = () => {
    if (options.length < 10) setOptions([...options, '']);
  };

  const handleRemoveOption = (idx) => {
    if (options.length > 3) setOptions(options.filter((_, i) => i !== idx));
  };

  const handleOptionChange = (idx, val) => {
    const next = [...options];
    next[idx] = val;
    setOptions(next);
  };

  const validateStep = (step) => {
    const e = {};
    if (step === 0) {
      if (!title.trim()) e.title = 'title is required';
      if (!description.trim()) e.description = 'description is required';
      if (!duration || parseInt(duration) <= 0) e.duration = 'duration must be a positive number of blocks';
    }
    if (step === 1) {
      if (options.length < 3) e.options = 'minimum 3 options required';
      if (options.length > 10) e.options = 'maximum 10 options allowed';
      if (options.some(o => !o.trim())) e.options = 'all options must be filled in';
    }
    if (step === 2) {
      if (!minVoterThreshold || parseInt(minVoterThreshold) < 10) e.minVoterThreshold = 'minimum 10 votes required (contract enforced)';
      if (eligibilityThreshold === '' || parseInt(eligibilityThreshold) < 0) e.eligibilityThreshold = 'enter a valid token balance (0 = no minimum)';
    }
    return e;
  };

  const handleNext = () => {
    const e = validateStep(activeStep);
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setActiveStep(s => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setActiveStep(s => s - 1);
  };

  const handleSubmit = async () => {
    const allErrors = { ...validateStep(0), ...validateStep(1), ...validateStep(2) };
    if (Object.keys(allErrors).length > 0) { setErrors(allErrors); return; }
    try {
      const newProposal = await createProposal({
        title,
        description,
        options,
        votingMode,
        duration: parseInt(duration),
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
      <Box sx={{ fontFamily: bodyFont, background: '#080c10', minHeight: '100vh', borderLeft: '2px solid rgba(0,245,212,0.12)' }}>
        <Box sx={{ maxWidth: '900px', margin: '0 auto', padding: '2.5rem 2rem' }}>
          <Box sx={{ fontFamily: monoFont, fontSize: '0.75rem', color: '#ffffff', letterSpacing: '0.12em', mb: '1.75rem' }}>
            {'> /proposals/create'}<BlinkCursor />
          </Box>
          <Box sx={{ borderLeft: '2px solid #ffb800', pl: 1.5, py: 0.5 }}>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.78rem', color: '#ffb800', letterSpacing: '0.04em' }}>
              &gt; connect your wallet to create a proposal
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  const accent = STEP_ACCENT[activeStep];

  return (
    <Box sx={{ fontFamily: bodyFont, background: '#080c10', minHeight: '100vh', borderLeft: '2px solid rgba(0,245,212,0.12)' }}>
      <Container maxWidth="md" sx={{ py: '2.5rem' }}>

        

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <Box>
            <Typography sx={{ fontFamily: monoFont, fontWeight: 400, fontSize: '1.7rem', color: '#e2e8f0', letterSpacing: '0.06em', textTransform: 'uppercase', mb: '0.3rem' }}>
              CREATE PROPOSAL<BlinkCursor />
            </Typography>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ffffff', letterSpacing: '0.08em' }}>
              STEP {activeStep + 1} OF {STEPS.length} ──{'>'} {STEPS[activeStep].toUpperCase()}
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
                  fontSize: '0.75rem',
                  fontWeight: 400,
                  color: isActive ? accent : isPast ? '#ffffff' : '#ffffff',
                  textShadow: isActive ? `0 0 8px ${accent}80` : 'none',
                  letterSpacing: '0.1em',
                  whiteSpace: 'nowrap',
                }}>
                  {isPast ? `[✓: ${label.toUpperCase()}]` : isActive ? `[▶ ${label.toUpperCase()}]` : `[: ${label.toUpperCase()}]`}
                </Typography>
                {idx < STEPS.length - 1 && (
                  <Typography component="span" sx={{
                    fontFamily: monoFont, fontSize: '0.75rem',
                    color: isPast ? '#2e3e4d' : '#1e2a35',
                    mx: '4px', userSelect: 'none',
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
          borderTop: `2px solid ${accent}`,
          borderRadius: '2px',
          p: 3,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(0,245,212,0.025) 50%, transparent)',
            backgroundSize: '200% 100%',
            animation: 'scanSweepSlow 8s linear infinite',
          },
          '@keyframes scanSweepSlow': {
            '0%': { backgroundPosition: '-100% center' },
            '100%': { backgroundPosition: '200% center' },
          },
        }}>

          {activeStep === 0 && (
            <Box>
              <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ffffff', letterSpacing: '0.12em', mb: '1.75rem' }}>
                
              </Typography>

              <TerminalField label="title" error={errors.title}>
                <Box component="input" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="short, clear proposal title..." sx={inputSx} />
              </TerminalField>

              <TerminalField label="description" error={errors.description}>
                <Box component="textarea" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="describe the proposal, its intent and expected outcomes..."
                  rows={5} sx={{ ...inputSx, resize: 'vertical', lineHeight: 1.65 }} />
              </TerminalField>

              <TerminalField label="duration (blocks)" error={errors.duration}>
                <Box component="input" type="number" value={duration} onChange={e => setDuration(e.target.value)}
                  placeholder="e.g. 50000  (~7 days at 6s/block)" sx={inputSx} />
              </TerminalField>
              {duration && parseInt(duration) > 0 && (
                <Box sx={{ mt: '-1rem', mb: '1.5rem', pl: '0.2rem' }}>
                  <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#334155', letterSpacing: '0.04em' }}>
                    {'>'}&nbsp;
                    <Box component="span" sx={{ color: '#00f5d4' }}>
                      ~{(parseInt(duration) / 7200).toFixed(1)} days
                    </Box>
                    {' '}at 6s/block
                  </Typography>
                </Box>
              )}

              <Box>
                <FieldLabel>voting_mode</FieldLabel>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {[
                    { value: 'normal',    label: 'NORMAL',    sub: '1 token = 1 vote',       note: 'straightforward majority' },
                    { value: 'quadratic', label: 'QUADRATIC', sub: 'weight = √(tokens)',      note: 'reduces whale dominance' },
                  ].map(({ value, label, sub, note }) => {
                    const sel = votingMode === value;
                    return (
                      <Box key={value} onClick={() => setVotingMode(value)} sx={{
                        flex: 1, p: 1.5,
                        border: '1px solid', borderColor: sel ? 'rgba(0,245,212,0.45)' : '#1e2a35',
                        borderRadius: '2px', background: sel ? 'rgba(0,245,212,0.05)' : 'transparent',
                        cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s',
                        '&:hover': sel ? {} : { borderColor: 'rgba(0,245,212,0.2)', background: 'rgba(0,245,212,0.02)' },
                      }}>
                        <Typography sx={{ fontFamily: monoFont, fontSize: '0.72rem', color: sel ? '#00f5d4' : '#ffffff', mb: '0.2rem', letterSpacing: '0.08em' }}>
                          {sel ? '[▶]' : '[·]'} {label}
                        </Typography>
                        <Typography sx={{ fontFamily: bodyFont, fontSize: '0.68rem', color: sel ? '#e2e8f0' : '#ffffff', mb: '0.15rem', letterSpacing: '0.03em' }}>
                          {sub}
                        </Typography>
                        <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ffffff', letterSpacing: '0.03em' }}>
                          {note}
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
              <Typography sx={{ fontFamily: bodyFont, fontSize: '1.1rem', color: '#ffffff', letterSpacing: '0.12em', mb: '0.4rem' }}>
                {' voting options '}
              </Typography>
              <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ffffff', letterSpacing: '0.04em', mb: '1.75rem' }}>
                &gt; min 3 · max 10 · all fields required
              </Typography>

              {errors.options && (
                <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ff3c3c', mb: 1.5, letterSpacing: '0.04em' }}>
                  &gt; {errors.options}
                </Typography>
              )}

              {options.map((option, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1, mb: '0.65rem', alignItems: 'stretch' }}>
                  <Box sx={{
                    fontFamily: monoFont, fontSize: '0.68rem',
                    color: option.trim() ? '#00f5d4' : '#334155',
                    width: 32, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid', borderColor: option.trim() ? 'rgba(0,245,212,0.25)' : '#1e2a35',
                    borderRadius: '2px', background: 'rgba(0,0,0,0.3)',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}>
                    {idx + 1}
                  </Box>
                  <Box sx={{
                    flex: 1, border: '1px solid #1e2a35', borderRadius: '2px', background: '#080c10',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    '&:focus-within': { borderColor: '#00f5d4', boxShadow: '0 0 0 2px rgba(0,245,212,0.15)' },
                  }}>
                    <Box component="input" value={option} onChange={e => handleOptionChange(idx, e.target.value)}
                      placeholder={`option ${idx + 1}...`} sx={{ ...inputSx, py: '0.6rem' }} />
                  </Box>
                  {options.length > 3 && (
                    <Box onClick={() => handleRemoveOption(idx)} sx={{
                      fontFamily: monoFont, fontSize: '0.75rem',
                      color: '#ff3c3c', border: '1px solid rgba(255,60,60,0.15)',
                      borderRadius: '2px', px: 0.75,
                      display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0, userSelect: 'none',
                      transition: 'all 0.15s',
                      '&:hover': { color: '#ff3c3c', borderColor: 'rgba(255,60,60,0.4)', background: 'rgba(255,60,60,0.04)' },
                    }}>
                      X
                    </Box>
                  )}
                </Box>
              ))}

              {options.length < 10 && (
                <Box onClick={handleAddOption} sx={{
                  mt: '0.75rem',
                  fontFamily: monoFont, fontSize: '0.75rem', letterSpacing: '0.1em',
                  color: 'rgba(0,245,212,0.5)', border: '1px dashed rgba(0,245,212,0.2)',
                  borderRadius: '2px', py: '0.65rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s',
                  '&:hover': { color: '#00f5d4', borderColor: 'rgba(0,245,212,0.4)', background: 'rgba(0,245,212,0.03)' },
                }}>
                  [+ ADD OPTION]
                  <Box component="span" sx={{ color: '#334155', fontSize: '0.58rem', letterSpacing: '0.06em' }}>
                    {options.length}/10
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {activeStep === 2 && (
            <Box>
              <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ffffff', letterSpacing: '0.12em', mb: '1.75rem' }}>
                {'participation parameters '}
              </Typography>

              <TerminalField label="min_voter_threshold" error={errors.minVoterThreshold}>
                <Box component="input" type="number" value={minVoterThreshold}
                  onChange={e => setMinVoterThreshold(e.target.value)}
                  placeholder="minimum votes for a valid result  (contract minimum: 10)..." sx={inputSx} />
              </TerminalField>
              <Box sx={{ mt: '-1rem', mb: '1.5rem', pl: '0.2rem' }}>
                <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#00f5d4', letterSpacing: '0.04em', lineHeight: 1.7 }}>
                  &gt; if participation falls below this threshold the proposal is cancelled
                  {minVoterThreshold && (
                    <Box component="span" sx={{ display: 'block', color: parseInt(minVoterThreshold) >= 10 ? '#00f5d4' : '#ff3c3c', mt: '2px' }}>
                      {'>'} quorum set to {minVoterThreshold} votes{parseInt(minVoterThreshold) < 10 ? ' — below minimum of 10' : ''}
                    </Box>
                  )}
                </Typography>
              </Box>

              <TerminalField label="balance_min_req (tokens)" error={errors.eligibilityThreshold}>
                <Box component="input" type="number" value={eligibilityThreshold}
                  onChange={e => setEligibilityThreshold(e.target.value)}
                  placeholder="minimum token balance to vote  (0 = no minimum)..." sx={inputSx} />
              </TerminalField>
              <Box sx={{ mt: '-1rem', mb: '1.5rem', pl: '0.2rem' }}>
                <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#00f5d4', letterSpacing: '0.04em', lineHeight: 1.7 }}>
                  &gt; voters with fewer tokens than this threshold cannot participate
                  {eligibilityThreshold !== '' && (
                    <Box component="span" sx={{ display: 'block', color: '#ffffff', mt: '2px' }}>
                      {'>'} {parseInt(eligibilityThreshold) === 0 ? 'open to all token holders' : `${parseInt(eligibilityThreshold).toLocaleString()} token minimum`}
                    </Box>
                  )}
                </Typography>
              </Box>

              <Box sx={{ borderLeft: '2px solid #1e2a35', pl: 1.5, py: 0.75 }}>
                <Typography sx={{ fontFamily: bodyFont, fontSize: '0.68rem', color: '#00f5d4', lineHeight: 1.8, letterSpacing: '0.04em' }}>
                  &gt; vote weight is computed on-chain from the voter's token balance at cast time
                </Typography>
              </Box>
            </Box>
          )}

          {activeStep === 3 && (
            <Box>
              <Typography sx={{ fontFamily: bodyFont,textTransform:'capitalize',fontSize: '0.75rem', color: '#ffffff', letterSpacing: '0.12em', mb: '1.75rem' }}>
                {'review and confirm'}
              </Typography>

              <Grid container spacing={1.5}>
                <Grid item xs={12}>
                  <Box sx={dataBox}>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#ffffff', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>TITLE</Typography>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.85rem', color: '#e2e8f0', letterSpacing: '0.04em' }}>{title}</Typography>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Box sx={dataBox}>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#ffffff', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>DESCRIPTION</Typography>
                    <Typography sx={{ fontFamily: bodyFont, fontSize: '0.78rem', color: '#e2e8f0', lineHeight: 1.65 }}>{description}</Typography>
                  </Box>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Box sx={dataBox}>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#ffffff', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>DURATION</Typography>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.95rem', color: '#00f5d4', letterSpacing: '0.04em' }}>{parseInt(duration).toLocaleString()}</Typography>
                    <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#334155', mt: '4px' }}>~{(parseInt(duration) / 7200).toFixed(1)} days</Typography>
                  </Box>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Box sx={dataBox}>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#ffffff', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>MODE</Typography>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.95rem', color: '#00f5d4', letterSpacing: '0.06em' }}>{votingMode.toUpperCase()}</Typography>
                  </Box>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Box sx={dataBox}>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#ffffff', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>MIN VOTES</Typography>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.95rem', color: '#e2e8f0', letterSpacing: '0.04em' }}>{parseInt(minVoterThreshold).toLocaleString()}</Typography>
                  </Box>
                </Grid>

                <Grid item xs={6} sm={3}>
                  <Box sx={dataBox}>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#ffffff', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>BAL REQ</Typography>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.95rem', color: '#e2e8f0', letterSpacing: '0.04em' }}>
                      {parseInt(eligibilityThreshold) === 0 ? 'none' : `${parseInt(eligibilityThreshold).toLocaleString()}`}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Box sx={dataBox}>
                    <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#ffffff', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.75rem' }}>
                      OPTIONS ({options.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {options.map((opt, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Typography sx={{ fontFamily: monoFont, fontSize: '0.75rem', color: '#334155', minWidth: 24, flexShrink: 0 }}>
                            [{idx + 1}]
                          </Typography>
                          <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ffffff' }}>
                            {opt}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Grid>
              </Grid>

              {errors.submit && (
                <Box sx={{ borderLeft: '2px solid #ff3c3c', pl: 1.5, mt: 2, py: 0.5 }}>
                  <Typography sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ff3c3c', letterSpacing: '0.04em' }}>
                    &gt; error: {errors.submit}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={handleBack} disabled={activeStep === 0 || loading} disableRipple sx={{
            fontFamily: monoFont, fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase',
            color: activeStep === 0 || loading ? '#334155' : '#ffffff',
            border: '1px solid', borderColor: activeStep === 0 || loading ? '#1e2a35' : '#2e3e4d',
            borderRadius: '2px', px: 2, py: 0.75, transition: 'all 0.15s',
            '&:hover:not(:disabled)': { borderColor: '#ffffff', color: '#e2e8f0', background: 'transparent' },
          }}>
            [{'<'} BACK]
          </Button>

          <Typography sx={{ fontFamily: bodyFont, fontSize: '0.6rem', color: '#334155', letterSpacing: '0.08em' }}>
            {activeStep + 1} / {STEPS.length}
          </Typography>

          {activeStep < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={loading} disableRipple sx={{
              fontFamily: monoFont, fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase',
              color: accent, border: `1px solid ${accent}66`, borderRadius: '2px', px: 2, py: 0.75,
              background: 'transparent', transition: 'background 0.15s, box-shadow 0.15s',
              '&:hover:not(:disabled)': { background: `${accent}12`, boxShadow: `0 0 8px ${accent}80` },
            }}>
              [NEXT {'>'}]
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} disableRipple sx={{
              fontFamily: monoFont, fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase',
              color: loading ? '#334155' : '#39ff14',
              border: '1px solid', borderColor: loading ? '#1e2a35' : 'rgba(57,255,20,0.4)',
              borderRadius: '2px', px: 2.5, py: 0.75, background: 'transparent',
              transition: 'background 0.15s, box-shadow 0.15s',
              '&:hover:not(:disabled)': { background: 'rgba(57,255,20,0.06)', boxShadow: '0 0 8px rgba(57,255,20,0.5)' },
            }}>
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: '80px', height: '2px', color:'#00f5d4',background: '#1e2a35', borderRadius: '2px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                    <Box sx={{
                      position: 'absolute', top: 0, bottom: 0, width: '30px', background: '#00f5d4',color: '#00f5d4',
                      animation: 'scanProgress 1.2s linear infinite',
                      '@keyframes scanProgress': { '0%': { left: '-40px' }, '100%': { left: '100%' } },
                    }} />
                  </Box>
                  creating...
                </Box>
              ) : '[ CREATE PROPOSAL ]'}
            </Button>
          )}
        </Box>

        <Box sx={{ fontFamily: bodyFont, fontSize: '0.6rem', color: '#1e2a35', overflow: 'hidden', whiteSpace: 'nowrap', userSelect: 'none', mt: '2rem' }}>
          {'─'.repeat(120)}
        </Box>
        <Box sx={{ fontFamily: bodyFont, fontSize: '0.75rem', color: '#ffffff', letterSpacing: '0.07em', mt: '0.5rem' }}>
          {'> step '}{activeStep + 1}{' of '}{STEPS.length}{' · system nominal'}
        </Box>

        <Dialog
          open={showConfirmation && !!createdProposal}
          onClose={handleCloseConfirmation}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              background: '#0d1117', border: '1px solid rgba(57,255,20,0.3)', borderRadius: '2px',
              boxShadow: '0 0 30px rgba(57,255,20,0.05)',
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
            },
          }}
        >
          <DialogTitle sx={{
            fontFamily: monoFont, fontSize: '0.95rem', fontWeight: 400, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#39ff14', textShadow: '0 0 10px rgba(57,255,20,0.4)',
            borderBottom: '1px solid rgba(57,255,20,0.15)', py: 2,
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}>
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%', background: '#39ff14',
              boxShadow: '0 0 8px rgba(57,255,20,0.8)', flexShrink: 0,
              animation: 'glowPulse 2s ease-in-out infinite',
              '@keyframes glowPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
            }} />
            PROPOSAL CREATED
          </DialogTitle>

          <DialogContent sx={{ pt: 2.5, pb: 1 }}>
            <Typography sx={{ fontFamily: bodyFont, fontSize: '0.72rem', color: '#ffffff', mb: 2, lineHeight: 1.7, letterSpacing: '0.04em' }}>
              &gt; awaiting dkg setup — keyholders will generate the election public key before voting opens
            </Typography>

            <Box sx={{ ...dataBox, mb: 1.5 }}>
              <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#ffffff', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>PROPOSAL_ID</Typography>
              <Typography sx={{ fontFamily: bodyFont, fontSize: '0.95rem', color: '#00f5d4', wordBreak: 'break-all', letterSpacing: '0.04em' }}>{createdProposal?.id}</Typography>
            </Box>

            <Box sx={{ ...dataBox, mb: 1.5 }}>
              <Typography sx={{ fontFamily: monoFont, fontSize: '0.58rem', color: '#ffffff', letterSpacing: '0.15em', textTransform: 'uppercase', mb: '0.4rem' }}>TITLE</Typography>
              <Typography sx={{ fontFamily: monoFont, fontSize: '0.78rem', color: '#e2e8f0', letterSpacing: '0.04em' }}>{title}</Typography>
            </Box>

            <Box sx={{ borderLeft: '2px solid rgba(255,255,255,1)', pl: 1.5 }}>
              <Typography sx={{ fontFamily: monoFont, fontSize: '0.7rem', color: '#ffb800', letterSpacing: '0.08em', animation: 'glowPulse 2s ease-in-out infinite' }}>
                STATUS: PENDING_DKG
              </Typography>
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #1e2a35' }}>
            <Button onClick={handleCloseConfirmation} disableRipple sx={{
              fontFamily: monoFont, fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#00f5d4', border: '1px solid rgba(0,245,212,0.4)', borderRadius: '2px',
              px: 2, py: 0.75, background: 'transparent',
              transition: 'background 0.15s, box-shadow 0.15s',
              '&:hover': { background: 'rgba(0,245,212,0.07)', boxShadow: '0 0 8px rgba(0,245,212,0.5)' },
            }}>
              {'> VIEW PROPOSAL'}
            </Button>
          </DialogActions>
        </Dialog>

      </Container>
    </Box>
  );
};

export default ProposalCreate;