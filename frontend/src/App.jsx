import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { VotingProvider } from './context/VotingContext';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import ProposalList from './pages/ProposalList';
import ProposalCreate from './pages/ProposalCreate';
import ProposalDetail from './pages/ProposalDetail';
import ArchiveProposals from './pages/ArchiveProposals';
import './App.css';

/* ─────────────────────────────────────────────
   MUI THEME — CMD Terminal Override
   All MUI components are stripped of default
   blues and rounded corners, forced into the
   monospaced dark terminal aesthetic.
───────────────────────────────────────────── */
const terminalTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#080c10',
      paper:   '#0d1117',
    },
    primary: {
      main:        '#00f5d4',
      dark:        '#00c9ad',
      light:       '#4dfce8',
      contrastText: '#080c10',
    },
    secondary: {
      main:        '#ffb800',
      contrastText: '#080c10',
    },
    success: {
      main: '#39ff14',
    },
    error: {
      main: '#ff3c3c',
    },
    warning: {
      main: '#ffb800',
    },
    text: {
      primary:   '#e2e8f0',
      secondary: '#64748b',
      disabled:  '#334155',
    },
    divider: '#1e2a35',
  },

  typography: {
    fontFamily: "JetBrains Mono",
    h1: { fontFamily: "JetBrains Mono", letterSpacing: '0.06em' },
    h2: { fontFamily: "JetBrains Mono", letterSpacing: '0.06em' },
    h3: { fontFamily: "JetBrains Mono", letterSpacing: '0.05em' },
    h4: { fontFamily: "JetBrains Mono", letterSpacing: '0.04em' },
    h5: { fontFamily: "JetBrains Mono" },
    h6: { fontFamily: "JetBrains Mono" },
    button: {
      fontFamily: "JetBrains Mono",
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    },
    caption: { fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em' },
    overline: { fontFamily: "JetBrains Mono", letterSpacing: '0.15em' },
  },

  shape: {
    borderRadius: 2, // near-zero — terminal aesthetic
  },

  components: {
    /* ── CssBaseline ── */
    MuiCssBaseline: {
      styleOverrides: {
        '*': { boxSizing: 'border-box' },
        body: {
          background: '#080c10',
          color: '#e2e8f0',
          fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
          WebkitFontSmoothing: 'antialiased',
        },
        /* Scanline overlay */
        'body::before': {
          content: '""',
          pointerEvents: 'none',
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)',
        },
        /* Scrollbar */
        '::-webkit-scrollbar': { width: '6px', height: '6px' },
        '::-webkit-scrollbar-track': { background: '#080c10' },
        '::-webkit-scrollbar-thumb': { background: '#1e2a35', borderRadius: '0' },
        '::-webkit-scrollbar-thumb:hover': { background: '#00f5d4' },
      },
    },

    /* ── Button ── */
    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: false },
      styleOverrides: {
        root: {
          fontFamily: "JetBrains Mono",
          letterSpacing: '0.12em',
          borderRadius: '2px',
          textTransform: 'uppercase',
          transition: 'all 0.15s ease',
        },
        contained: {
          background: 'transparent',
          color: '#00f5d4',
          border: '1px solid #00f5d4',
          boxShadow: 'none',
          '&:hover': {
            background: 'rgba(0, 245, 212, 0.07)',
            boxShadow: '0 0 8px rgba(0,245,212,0.5)',
            transform: 'none',
          },
        },
        outlined: {
          borderColor: '#1e2a35',
          color: '#64748b',
          borderRadius: '2px',
          '&:hover': {
            borderColor: '#00f5d4',
            color: '#00f5d4',
            background: 'rgba(0,245,212,0.04)',
          },
        },
        text: {
          color: '#64748b',
          '&:hover': { color: '#00f5d4', background: 'transparent' },
        },
      },
    },

    /* ── Card ── */
    MuiCard: {
      styleOverrides: {
        root: {
          background: '#0d1117',
          border: '1px solid #1e2a35',
          borderRadius: '2px',
          boxShadow: 'none',
          transition: 'border-color 0.15s',
          '&:hover': {
            borderColor: 'rgba(0,245,212,0.35)',
          },
        },
      },
    },

    MuiCardContent: {
      styleOverrides: {
        root: { padding: '1.25rem', '&:last-child': { paddingBottom: '1.25rem' } },
      },
    },

    /* ── Paper ── */
    MuiPaper: {
      styleOverrides: {
        root: {
          background: '#0d1117',
          border: '1px solid #1e2a35',
          borderRadius: '2px',
          boxShadow: 'none',
          backgroundImage: 'none',
        },
        elevation1: { boxShadow: 'none' },
        elevation2: { boxShadow: 'none' },
        elevation3: { boxShadow: 'none' },
      },
    },

    /* ── TextField / Input ── */
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          fontFamily: "'IBM Plex Mono', monospace",
          borderRadius: '2px',
          background: '#080c10',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#1e2a35',
            borderRadius: '2px',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#00f5d4',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#00f5d4',
            borderWidth: '1px',
            boxShadow: '0 0 0 2px rgba(0,245,212,0.15)',
          },
        },
        input: {
          color: '#e2e8f0',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.85rem',
          '&::placeholder': { color: '#334155', opacity: 1 },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: "JetBrains Mono",
          fontSize: '0.75rem',
          letterSpacing: '0.1em',
          color: '#64748b',
          textTransform: 'uppercase',
          '&.Mui-focused': { color: '#00f5d4' },
        },
      },
    },

    /* ── Select ── */
    MuiSelect: {
      styleOverrides: {
        icon: { color: '#64748b' },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: '#0d1117',
          border: '1px solid #1e2a35',
          borderRadius: '2px',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.8rem',
          color: '#e2e8f0',
          '&:hover': { background: 'rgba(0,245,212,0.06)', color: '#00f5d4' },
          '&.Mui-selected': {
            background: 'rgba(0,245,212,0.08)',
            color: '#00f5d4',
          },
        },
      },
    },

    /* ── ToggleButtonGroup ── */
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          gap: '0',
          borderBottom: '1px solid #1e2a35',
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          fontFamily: "JetBrains Mono",
          fontSize: '0.62rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#64748b',
          background: 'transparent',
          border: 'none !important',
          borderRadius: '0 !important',
          borderBottom: '2px solid transparent !important',
          marginBottom: '-1px',
          padding: '7px 14px',
          transition: 'color 0.15s',
          '&:hover': {
            background: 'transparent',
            color: '#e2e8f0',
          },
          '&.Mui-selected': {
            background: 'transparent !important',
            color: '#00f5d4 !important',
            borderBottom: '2px solid #00f5d4 !important',
          },
        },
      },
    },

    /* ── Chip ── */
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: "JetBrains Mono",
          fontSize: '0.6rem',
          letterSpacing: '0.12em',
          borderRadius: '2px',
          height: '22px',
          background: 'transparent',
          border: '1px solid #1e2a35',
          color: '#64748b',
        },
        colorPrimary: {
          borderColor: '#00f5d4',
          color: '#00f5d4',
        },
        colorSecondary: {
          borderColor: '#ffb800',
          color: '#ffb800',
        },
        colorSuccess: {
          borderColor: '#39ff14',
          color: '#39ff14',
        },
        colorError: {
          borderColor: '#ff3c3c',
          color: '#ff3c3c',
        },
      },
    },

    /* ── Dialog ── */
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: '#0d1117',
          border: '1px solid #1e2a35',
          borderRadius: '2px',
          boxShadow: '0 0 40px rgba(0,245,212,0.08)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: "JetBrains Mono",
          letterSpacing: '0.06em',
          color: '#e2e8f0',
          borderBottom: '1px solid #1e2a35',
          paddingBottom: '1rem',
        },
      },
    },

    /* ── Tooltip ── */
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: '#0d1117',
          border: '1px solid #1e2a35',
          borderRadius: '2px',
          color: '#e2e8f0',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.7rem',
          letterSpacing: '0.05em',
        },
        arrow: { color: '#1e2a35' },
      },
    },

    /* ── Stepper ── */
    MuiStepLabel: {
      styleOverrides: {
        label: {
          fontFamily: "JetBrains Mono",
          fontSize: '0.65rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#64748b',
          '&.Mui-active': { color: '#00f5d4' },
          '&.Mui-completed': { color: '#39ff14' },
        },
      },
    },
    MuiStepIcon: {
      styleOverrides: {
        root: {
          color: '#1e2a35',
          '&.Mui-active': { color: '#00f5d4' },
          '&.Mui-completed': { color: '#39ff14' },
        },
      },
    },
    MuiStepConnector: {
      styleOverrides: {
        line: { borderColor: '#1e2a35' },
      },
    },

    /* ── LinearProgress ── */
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          background: '#1e2a35',
          borderRadius: '2px',
          height: '3px',
        },
        bar: { background: '#00f5d4', borderRadius: '2px' },
      },
    },

    /* ── CircularProgress ── */
    MuiCircularProgress: {
      styleOverrides: {
        root: { color: '#00f5d4' },
      },
    },

    /* ── Divider ── */
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: '#1e2a35' },
      },
    },

    /* ── Alert ── */
    MuiAlert: {
      styleOverrides: {
        root: {
          background: '#0d1117',
          border: '1px solid',
          borderRadius: '2px',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.75rem',
          letterSpacing: '0.04em',
        },
        standardInfo:    { borderColor: '#00f5d4', color: '#00f5d4' },
        standardSuccess: { borderColor: '#39ff14', color: '#39ff14' },
        standardWarning: { borderColor: '#ffb800', color: '#ffb800' },
        standardError:   { borderColor: '#ff3c3c', color: '#ff3c3c' },
      },
    },

    /* ── AppBar / Toolbar ── */
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: '#080c10',
          borderBottom: '1px solid #1e2a35',
          boxShadow: 'none',
          backgroundImage: 'none',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: { minHeight: '52px !important' },
      },
    },

    /* ── Tab ── */
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: "JetBrains Mono",
          fontSize: '0.62rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#64748b',
          minHeight: '40px',
          '&.Mui-selected': { color: '#00f5d4' },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { background: '#00f5d4', height: '2px' },
      },
    },

    /* ── Typography ── */
    MuiTypography: {
      styleOverrides: {
        root: {
          fontFamily: "'IBM Plex Mono', monospace",
        },
      },
    },

    /* ── Container ── */
    MuiContainer: {
      styleOverrides: {
        root: { paddingLeft: '1.5rem', paddingRight: '1.5rem' },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={terminalTheme}>
      <CssBaseline />
      <VotingProvider>
        <Router>
          <Navigation />
          <Routes>
            <Route path="/"               element={<Dashboard />} />
            <Route path="/proposals"      element={<ProposalList />} />
            <Route path="/proposal/:id"   element={<ProposalDetail />} />
            <Route path="/create-proposal"element={<ProposalCreate />} />
            <Route path="/archive"        element={<ArchiveProposals />} />
          </Routes>
        </Router>
      </VotingProvider>
    </ThemeProvider>
  );
}

export default App;