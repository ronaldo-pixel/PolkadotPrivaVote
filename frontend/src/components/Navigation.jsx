import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Button,
  Menu,
  MenuItem,
  Box,
  Avatar,
  Typography,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { useVoting } from '../context/VotingContext';
import { formatUtils } from '../utils/contractUtils';

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userAddress, connectWallet, isKeyholder } = useVoting();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleConnect = async () => {
    const mockAddress = `0x${Math.random().toString(16).slice(2).padEnd(40, '0')}`;
    connectWallet(mockAddress);
    handleMenuClose();
  };

  const handleDisconnect = () => {
    connectWallet(null);
    handleMenuClose();
  };

  const isActive = (path) => location.pathname === path;

  // Retro terminal style button
  const terminalButtonStyle = (active) => ({
    fontFamily: 'Roboto Mono, Courier New, monospace',
    fontWeight: 700,
    border: '1px solid #00ff00',
    background: 'transparent',
    color: active ? '#ffcc00' : '#00ff00',
    textTransform: 'uppercase',
    '&:hover': {
      color: '#ffcc00',
      borderColor: '#ffcc00',
    },
  });

  return (
    <AppBar
      position="sticky"
      sx={{
        mb: 3,
        backgroundColor: '#000',
        borderBottom: '1px solid #00ff00',
      }}
    >
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalanceIcon sx={{ color: '#00ff00', fontSize: 28 }} />
          <Typography
            variant="h6"
            sx={{
              cursor: 'pointer',
              fontFamily: 'Roboto Mono, Courier New, monospace',
              fontWeight: 700,
              color: '#00ff00',
            }}
            onClick={() => navigate('/')}
          >
            PolkadotPrivaVote
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button onClick={() => navigate('/')} sx={terminalButtonStyle(isActive('/'))}>
            Dashboard
          </Button>
          <Button onClick={() => navigate('/proposals')} sx={terminalButtonStyle(isActive('/proposals'))}>
            Active Proposals
          </Button>
          <Button onClick={() => navigate('/create-proposal')} sx={terminalButtonStyle(isActive('/create-proposal'))}>
            Create Proposal
          </Button>
          <Button onClick={() => navigate('/archive')} sx={terminalButtonStyle(isActive('/archive'))}>
            Archive
          </Button>
          {isKeyholder && (
            <Button onClick={() => navigate('/decryption')} sx={terminalButtonStyle(isActive('/decryption'))}>
              Decryption
            </Button>
          )}

          <Button onClick={handleMenuOpen} sx={terminalButtonStyle(false)}>
            {userAddress ? (
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  fontFamily: 'Roboto Mono, Courier New, monospace',
                  bgcolor: '#000',
                  color: '#00ff00',
                  border: '1px solid #00ff00',
                  fontWeight: 700,
                }}
              >
                {formatUtils.formatAddress(userAddress).slice(0, 2)}
              </Avatar>
            ) : (
              'Connect'
            )}
          </Button>
        </Box>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose} PaperProps={{
          sx: {
            backgroundColor: '#000',
            border: '1px solid #00ff00',
            fontFamily: 'Roboto Mono, Courier New, monospace',
            color: '#00ff00',
          }
        }}>
          {!userAddress ? (
            <MenuItem
              onClick={handleConnect}
              sx={{
                '&:hover': { backgroundColor: '#001100', color: '#ffcc00' },
              }}
            >
              Connect Wallet
            </MenuItem>
          ) : (
            <>
              <MenuItem disabled sx={{ cursor: 'default', color: '#ffcc00' }}>
                <Typography variant="body2">{formatUtils.formatAddress(userAddress)}</Typography>
              </MenuItem>
              {isKeyholder && (
                <MenuItem disabled sx={{ cursor: 'default', color: '#00ff00' }}>
                  <Typography variant="body2">🔑 Keyholder</Typography>
                </MenuItem>
              )}
              <MenuItem
                onClick={handleDisconnect}
                sx={{ '&:hover': { backgroundColor: '#001100', color: '#ffcc00' } }}
              >
                Disconnect
              </MenuItem>
            </>
          )}
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navigation;