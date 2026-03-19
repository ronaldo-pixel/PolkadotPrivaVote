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

const monoFont = '"Share Tech Mono", "JetBrains Mono", "Courier New", monospace';
const bodyFont = '"IBM Plex Mono", "Courier New", monospace';

const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userAddress, connectWallet, disconnectWallet, isKeyholder, keyholderIndex } = useVoting();

  const [anchorEl,   setAnchorEl]   = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connectErr, setConnectErr] = useState(null);

  const handleMenuOpen  = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = ()  => setAnchorEl(null);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectErr(null);
    handleMenuClose();
    try {
      await connectWallet();
    } catch (err) {
      setConnectErr(err.message ?? 'connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    handleMenuClose();
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { label: 'dashboard', path: '/' },
    { label: 'proposals', path: '/proposals' },
    { label: 'create',    path: '/create-proposal' },
    { label: 'archive',   path: '/archive' },
    ...(isKeyholder ? [{ label: 'decrypt', path: '/decryption' }] : []),
  ];

  const menuItemsSx = {
    fontFamily: monoFont,
    fontSize: '0.68rem',
    color: '#64748b',
    letterSpacing: '0.08em',
    py: 1.25,
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: '#080c10',
        borderBottom: '1px solid #1e2a35',
        backgroundImage: 'none',
        boxShadow: 'none',
      }}
    >
      <Toolbar
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          py: 0,
          px: { xs: 2, md: 3 },
          minHeight: '52px !important',
        }}
      >
        {/* Logo */}
        <Box
          onClick={() => navigate('/')}
          sx={{
            display: 'flex', alignItems: 'center', gap: '6px',
            cursor: 'pointer', userSelect: 'none', flexShrink: 0,
          }}
        >
          <Typography sx={{ fontFamily: monoFont, fontSize: '0.65rem', color: '#334155', letterSpacing: '0.08em' }}>
            &gt;
          </Typography>
          <Typography sx={{
            fontFamily: monoFont, fontWeight: 400, fontSize: '0.85rem',
            color: '#00f5d4', letterSpacing: '0.1em', textTransform: 'uppercase',
            transition: 'text-shadow 0.2s',
            '&:hover': { textShadow: '0 0 10px rgba(0,245,212,0.7)' },
          }}>
            PRIVAVOTE
          </Typography>
        </Box>

        {/* Nav links */}
        <Box sx={{
          display: 'flex', alignItems: 'stretch',
          borderLeft: '1px solid #1e2a35', borderRight: '1px solid #1e2a35',
          height: '52px',
        }}>
          {navLinks.map(({ label, path }) => {
            const active = isActive(path);
            return (
              <Button
                key={path}
                onClick={() => navigate(path)}
                disableRipple
                sx={{
                  fontFamily: monoFont,
                  fontSize: '0.62rem',
                  fontWeight: 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: active ? '#00f5d4' : '#64748b',
                  background: 'transparent',
                  borderRadius: 0,
                  borderBottom: active ? '2px solid #00f5d4' : '2px solid transparent',
                  borderRight: '1px solid #1e2a35',
                  px: 2, py: 0, minWidth: 0, height: '100%',
                  transition: 'color 0.15s, border-color 0.15s',
                  '&:hover': {
                    color: '#e2e8f0',
                    background: 'transparent',
                    borderBottom: active ? '2px solid #00f5d4' : '2px solid rgba(0,245,212,0.2)',
                  },
                  '&:last-child': { borderRight: 'none' },
                }}
              >
                {active ? `[${label}]` : label}
              </Button>
            );
          })}
        </Box>

        {/* Wallet area */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          {isKeyholder && userAddress && (
            <Typography sx={{
              fontFamily: monoFont, fontSize: '0.58rem', color: '#39ff14',
              letterSpacing: '0.14em', border: '1px solid rgba(57,255,20,0.35)',
              borderRadius: '2px', px: 0.75, py: 0.25,
              animation: 'glowPulse 2s ease-in-out infinite',
              '@keyframes glowPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
            }}>
              [KEYHOLDER]
            </Typography>
          )}

          {connectErr && (
            <Typography sx={{
              fontFamily: bodyFont, fontSize: '0.6rem', color: '#ff3c3c',
              letterSpacing: '0.04em', maxWidth: '160px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              &gt; {connectErr}
            </Typography>
          )}

          {/* Single-click connect when not connected, dropdown when connected */}
          <Button
            onClick={userAddress ? handleMenuOpen : handleConnect}
            disableRipple
            sx={{
              fontFamily: monoFont, fontSize: '0.62rem', fontWeight: 400,
              textTransform: 'uppercase', letterSpacing: '0.12em',
              color: userAddress ? '#e2e8f0' : '#00f5d4',
              background: 'transparent', border: '1px solid',
              borderColor: userAddress ? '#2e3e4d' : 'rgba(0,245,212,0.4)',
              borderRadius: '2px', px: 1.5, py: 0.6,
              transition: 'all 0.15s',
              '&:hover': {
                borderColor: '#00f5d4', color: '#00f5d4',
                background: 'rgba(0,245,212,0.05)',
                boxShadow: '0 0 8px rgba(0,245,212,0.3)',
              },
            }}
          >
            {connecting ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{
                  width: '48px', height: '2px', background: '#1e2a35',
                  borderRadius: '2px', overflow: 'hidden', position: 'relative',
                }}>
                  <Box sx={{
                    position: 'absolute', top: 0, bottom: 0, width: '16px',
                    background: '#00f5d4',
                    animation: 'scanProg 1s linear infinite',
                    '@keyframes scanProg': { '0%': { left: '-20px' }, '100%': { left: '100%' } },
                  }} />
                </Box>
                connecting...
              </Box>
            ) : userAddress ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Box sx={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#39ff14', boxShadow: '0 0 5px rgba(57,255,20,0.8)',
                  flexShrink: 0,
                }} />
                <Typography component="span" sx={{ fontFamily: bodyFont, fontSize: '0.62rem', color: '#334155', mr: '2px' }}>
                  $
                </Typography>
                <Typography component="span" sx={{ fontFamily: bodyFont, fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.04em' }}>
                  {formatUtils.formatAddress(userAddress)}
                </Typography>
              </Box>
            ) : (
              '[ CONNECT WALLET ]'
            )}
          </Button>
        </Box>

        {/* Dropdown — only shown when connected */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          PaperProps={{
            sx: {
              background: '#0d1117',
              border: '1px solid #1e2a35',
              borderRadius: '2px',
              boxShadow: '0 0 20px rgba(0,0,0,0.6)',
              mt: '4px',
              minWidth: 240,
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,212,0.012) 3px, rgba(0,245,212,0.012) 4px)',
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {[
            <MenuItem
              key="address"
              disabled
              sx={{
                fontFamily: bodyFont, fontSize: '0.68rem',
                color: '#64748b', letterSpacing: '0.06em',
                py: 1, borderBottom: '1px solid #1e2a35',
                opacity: '1 !important',
                display: 'flex', flexDirection: 'column',
                alignItems: 'flex-start', gap: '2px',
              }}
            >
              <Typography sx={{ fontFamily: monoFont, fontSize: '0.55rem', color: '#334155', letterSpacing: '0.12em' }}>
                CONNECTED
              </Typography>
              <Typography sx={{ fontFamily: bodyFont, fontSize: '0.68rem', color: '#64748b', letterSpacing: '0.04em', wordBreak: 'break-all' }}>
                $ {userAddress}
              </Typography>
            </MenuItem>,

            isKeyholder && (
              <MenuItem
                key="keyholder"
                disabled
                sx={{
                  fontFamily: monoFont, fontSize: '0.65rem',
                  color: '#39ff14', letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  py: 0.75, borderBottom: '1px solid #1e2a35',
                  opacity: '1 !important',
                }}
              >
                role: [KEYHOLDER]{keyholderIndex !== null ? ` — idx ${keyholderIndex}` : ''}
              </MenuItem>
            ),

            <MenuItem
              key="switch"
              onClick={handleConnect}
              sx={{
                ...menuItemsSx,
                '&:hover': { background: 'rgba(0,245,212,0.05)', color: '#00f5d4' },
              }}
            >
              &gt; switch_account()
            </MenuItem>,

            <MenuItem
              key="disconnect"
              onClick={handleDisconnect}
              sx={{
                ...menuItemsSx,
                borderTop: '1px solid #1e2a35',
                '&:hover': { background: 'rgba(255,60,60,0.06)', color: '#ff3c3c' },
              }}
            >
              &gt; disconnect()
            </MenuItem>,
          ].filter(Boolean)}
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navigation;