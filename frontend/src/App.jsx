import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { VotingProvider } from './context/VotingContext';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import ProposalList from './pages/ProposalList';
import ProposalCreate from './pages/ProposalCreate';
import ProposalDetail from './pages/ProposalDetail';
import ArchiveProposals from './pages/ArchiveProposals';
import DecryptionProgress from './pages/DecryptionProgress';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#556CD6',
    },
    secondary: {
      main: '#19857b',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <VotingProvider>
        <Router>
          <Navigation />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/proposals" element={<ProposalList />} />
            <Route path="/proposal/:id" element={<ProposalDetail />} />
            <Route path="/create-proposal" element={<ProposalCreate />} />
            <Route path="/archive" element={<ArchiveProposals />} />
            <Route path="/decryption" element={<DecryptionProgress />} />
          </Routes>
        </Router>
      </VotingProvider>
    </ThemeProvider>
  );
}

export default App;
