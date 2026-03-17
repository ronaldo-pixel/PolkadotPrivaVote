import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Button,
  Menu,
  MenuItem,
  Box,
  Typography,
} from '@mui/material';
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

  const navLinks = [
    { label: 'dashboard', path: '/' },
    { label: 'proposals', path: '/proposals' },
    { label: 'create', path: '/create-proposal' },
    { label: 'archive', path: '/archive' },
    ...(isKeyholder ? [{ label: 'decrypt', path: '/decryption' }] : []),
  ];

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: '#0a0a0a',
        borderBottom: '1px solid rgba(0, 245, 212, 0.15)',
        backgroundImage:
          'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.015) 3px, rgba(0,245,212,0.015) 4px)',
      }}
    >
      <Toolbar
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          py: 1,
          px: { xs: 2, md: 4 },
          minHeight: '56px !important',
        }}
      >
        {/* Logo */}
        <Box
          onClick={() => navigate('/')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", "Courier New", monospace',
              fontWeight: 700,
              fontSize: '0.8rem',
              color: 'rgba(0,245,212,0.4)',
              letterSpacing: '0.05em',
            }}
          >
            
          </Typography>
          <Typography
            sx={{
              fontFamily: '"JetBrains Mono", "Courier New", monospace',
              fontWeight: 700,
              fontSize: '1rem',
              color: '#00f5d4',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              '&:hover': {
                textShadow: '0 0 12px rgba(0,245,212,0.8)',
              },
              transition: 'text-shadow 0.2s',
            }}
          >
            PrivaVote
          </Typography>
        </Box>

        {/* Nav Links */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            borderLeft: '1px solid rgba(0,245,212,0.1)',
            borderRight: '1px solid rgba(0,245,212,0.1)',
          }}
        >
          {navLinks.map(({ label, path }) => {
            const active = isActive(path);
            return (
              <Button
                key={path}
                onClick={() => navigate(path)}
                disableRipple
                sx={{
                  fontFamily: '"JetBrains Mono", "Courier New", monospace',
                  fontSize: '0.78rem',
                  fontWeight: active ? 700 : 400,
                  textTransform: 'lowercase',
                  letterSpacing: '0.08em',
                  color: active ? '#00f5d4' : 'rgba(226,232,240,0.45)',
                  background: active ? 'rgba(0,245,212,0.05)' : 'transparent',
                  borderRadius: 0,
                  borderBottom: active ? '1px solid #00f5d4' : '1px solid transparent',
                  borderRight: '1px solid rgba(0,245,212,0.08)',
                  px: 2.5,
                  py: 1.75,
                  minWidth: 0,
                  transition: 'all 0.15s',
                  '&:hover': {
                    color: '#00f5d4',
                    background: 'rgba(0,245,212,0.04)',
                    borderBottom: '1px solid rgba(0,245,212,0.4)',
                  },
                  '&:last-child': {
                    borderRight: 'none',
                  },
                }}
              >
                {active ? `> ${label}` : `  ${label}`}
              </Button>
            );
          })}
        </Box>

        {/* Wallet */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isKeyholder && userAddress && (
            <Typography
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.7rem',
                color: '#39ff14',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                textShadow: '0 0 8px rgba(57,255,20,0.5)',
                mr: 1,
              }}
            >
              [KEYHOLDER]
            </Typography>
          )}

          <Button
            onClick={handleMenuOpen}
            disableRipple
            sx={{
              fontFamily: '"JetBrains Mono", "Courier New", monospace',
              fontSize: '0.78rem',
              fontWeight: 600,
              textTransform: 'lowercase',
              letterSpacing: '0.06em',
              color: userAddress ? '#e2e8f0' : '#00f5d4',
              background: 'transparent',
              border: '1px solid',
              borderColor: userAddress ? 'rgba(226,232,240,0.15)' : 'rgba(0,245,212,0.4)',
              borderRadius: '2px',
              px: 2,
              py: 0.75,
              transition: 'all 0.15s',
              '&:hover': {
                borderColor: '#00f5d4',
                color: '#00f5d4',
                background: 'rgba(0,245,212,0.05)',
                boxShadow: '0 0 10px rgba(0,245,212,0.15)',
              },
            }}
          >
            {userAddress ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#39ff14',
                    boxShadow: '0 0 6px rgba(57,255,20,0.8)',
                    flexShrink: 0,
                  }}
                />
                <Typography
                  component="span"
                  sx={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '0.75rem',
                    color: 'rgba(226,232,240,0.7)',
                    mr: 0.5,
                  }}
                >
                  $
                </Typography>
                {formatUtils.formatAddress(userAddress)}
              </Box>
            ) : (
              '[ connect wallet ]'
            )}
          </Button>
        </Box>

        {/* Dropdown Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          PaperProps={{
            sx: {
              background: '#0d1117',
              border: '1px solid rgba(0,245,212,0.2)',
              borderRadius: '2px',
              boxShadow: '0 0 24px rgba(0,245,212,0.08)',
              mt: 0.5,
              minWidth: 200,
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {!userAddress ? (
            <MenuItem
              onClick={handleConnect}
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.8rem',
                color: '#00f5d4',
                letterSpacing: '0.06em',
                py: 1.5,
                '&:hover': {
                  background: 'rgba(0,245,212,0.07)',
                },
              }}
            >
              &gt; connect_wallet()
            </MenuItem>
          ) : (
            <>
              <MenuItem
                disabled
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.72rem',
                  color: 'rgba(226,232,240,0.35)',
                  letterSpacing: '0.04em',
                  py: 1,
                  borderBottom: '1px solid rgba(0,245,212,0.08)',
                  opacity: '1 !important',
                }}
              >
                {formatUtils.formatAddress(userAddress)}
              </MenuItem>

              {isKeyholder && (
                <MenuItem
                  disabled
                  sx={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '0.72rem',
                    color: '#39ff14',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    py: 1,
                    borderBottom: '1px solid rgba(0,245,212,0.08)',
                    opacity: '1 !important',
                  }}
                >
                  role: keyholder
                </MenuItem>
              )}

              <MenuItem
                onClick={handleDisconnect}
                sx={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.8rem',
                  color: 'rgba(226,232,240,0.55)',
                  letterSpacing: '0.06em',
                  py: 1.5,
                  '&:hover': {
                    background: 'rgba(255,60,60,0.07)',
                    color: '#ff3c3c',
                  },
                }}
              >
                &gt; disconnect()
              </MenuItem>
            </>
          )}
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navigation;