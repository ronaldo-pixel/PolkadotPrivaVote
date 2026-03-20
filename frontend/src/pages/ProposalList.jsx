import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVoting } from '../context/VotingContext';
import ProposalCard from '../components/ProposalCard';

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=IBM+Plex+Mono:wght@400;500&display=swap');

  :root {
    --bg-base:        #080c10;
    --bg-surface:     #0d1117;
    --bg-card:        #0d1117;
    --cyan:           #00f5d4;
    --cyan-dim:       rgba(0, 245, 212, 0.15);
    --cyan-glow:      0 0 8px rgba(0, 245, 212, 0.7);
    --amber:          #ffb800;
    --amber-glow:     0 0 8px rgba(255, 184, 0, 0.7);
    --green-phos:     #39ff14;
    --green-glow:     0 0 8px rgba(57, 255, 20, 0.7);
    --red-err:        #ff3c3c;
    --text-primary:   #e2e8f0;
    --text-secondary: #64748b;
    --border-base:    #1e2a35;
    --font-mono:      'IBM Plex Mono', 'Courier New', monospace;
    --font-head:      'Share Tech Mono', 'JetBrains Mono', monospace;
  }

  body::before {
    content: '';
    pointer-events: none;
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(0,0,0,0.04) 3px,
      rgba(0,0,0,0.04) 4px
    );
  }

  @keyframes scanIn {
    from { opacity: 0; transform: translateY(8px); clip-path: inset(100% 0 0 0); }
    to   { opacity: 1; transform: translateY(0);   clip-path: inset(0% 0 0 0); }
  }

  @keyframes glowPulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.45; }
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }

  @keyframes scanSweep {
    0%   { background-position: -200% center; }
    100% { background-position: 300% center; }
  }

  @keyframes glitch {
    0%  { transform: translateX(0); }
    20% { transform: translateX(-2px); }
    40% { transform: translateX(2px); }
    60% { transform: translateX(-1px); }
    80% { transform: translateX(1px); }
    100%{ transform: translateX(0); }
  }
`;

if (typeof document !== 'undefined') {
  const existing = document.getElementById('cmd-theme-styles');
  if (!existing) {
    const style = document.createElement('style');
    style.id = 'cmd-theme-styles';
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
  }
}

const STATUS_CONFIG = {
  ACTIVE:      { color: 'var(--cyan)',       glow: 'var(--cyan-glow)',   label: 'ACTIVE' },
  PENDING_DKG: { color: 'var(--amber)',      glow: 'var(--amber-glow)',  label: 'PENDING_DKG' },
  ENDED:       { color: '#64748b',           glow: 'none',               label: 'ENDED' },
  REVEALED:    { color: 'var(--green-phos)', glow: 'var(--green-glow)',  label: 'REVEALED' },
  CANCELLED:   { color: 'var(--red-err)',    glow: '0 0 8px rgba(255,60,60,0.7)', label: 'CANCELLED' },
};

const TerminalProposalCard = ({ proposal, onVote, index }) => {
  const [hovered, setHovered] = useState(false);
  const [typewriterDone, setTypewriterDone] = useState(false);
  const [typewriterText, setTypewriterText] = useState('');
  const TYPEWRITER_MSG = 'generating keys...';

  const cfg = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.ACTIVE;

  useEffect(() => {
    if (proposal.status !== 'PENDING_DKG') return;
    let i = 0;
    const iv = setInterval(() => {
      setTypewriterText(TYPEWRITER_MSG.slice(0, i + 1));
      i++;
      if (i >= TYPEWRITER_MSG.length) { clearInterval(iv); setTypewriterDone(true); }
    }, 80);
    return () => clearInterval(iv);
  }, [proposal.status]);

  const cardStyle = {
    fontFamily: 'var(--font-mono)',
    background: 'var(--bg-card)',
    borderLeft: `3px solid ${cfg.color}`,
    borderTop: '1px solid var(--border-base)',
    borderRight: '1px solid var(--border-base)',
    borderBottom: '1px solid var(--border-base)',
    borderRadius: '2px',
    padding: '1.25rem 1.25rem 1rem',
    position: 'relative',
    cursor: 'pointer',
    transition: 'border-color 0.15s, transform 0.1s',
    animation: `scanIn 0.35s ease ${index * 80}ms both`,
    transform: hovered ? 'translateX(2px)' : 'none',
  };

  const badgeStyle = {
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    fontFamily: 'var(--font-head)',
    fontSize: '0.65rem',
    letterSpacing: '0.15em',
    color: cfg.color,
    boxShadow: cfg.glow !== 'none' ? cfg.glow : undefined,
    border: `1px solid ${cfg.color}`,
    padding: '2px 6px',
    borderRadius: '2px',
    animation: ['ACTIVE', 'PENDING_DKG'].includes(proposal.status)
      ? 'glowPulse 2s ease-in-out infinite' : 'none',
  };

  const truncId = `#${String(proposal.id).padStart(4, '0')}`;

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onVote(proposal.id)}
    >
      {hovered && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,245,212,0.04) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'scanSweep 1.2s linear infinite',
          borderRadius: '2px',
        }} />
      )}

      <span style={badgeStyle}>[{cfg.label}]</span>

      <div style={{
        fontFamily: 'var(--font-head)',
        fontSize: '0.7rem',
        color: cfg.color,
        letterSpacing: '0.12em',
        marginBottom: '0.35rem',
      }}>
        PROPOSAL {truncId}
      </div>

      <div style={{
        fontFamily: 'var(--font-head)',
        fontSize: '1rem',
        color: 'var(--text-primary)',
        marginBottom: '0.6rem',
        paddingRight: '5rem',
        lineHeight: 1.4,
        animation: hovered ? 'glitch 0.15s ease' : 'none',
      }}>
        {proposal.description
          ? proposal.description.slice(0, 60) + (proposal.description.length > 60 ? '...' : '')
          : 'No description provided.'}
      </div>

      <div style={{
        fontSize: '0.78rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        marginBottom: '0.85rem',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {proposal.options?.length
          ? proposal.options.slice(0, 3).map((o, i) => `[${i + 1}] ${o}`).join('  ')
          : 'no options'}
        {proposal.options?.length > 3 ? `  +${proposal.options.length - 3} more` : ''}
      </div>

      {proposal.status === 'PENDING_DKG' && (
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--amber)',
          marginBottom: '0.75rem',
          fontFamily: 'var(--font-mono)',
        }}>
          &gt; {typewriterText}
          <span style={{
            display: 'inline-block',
            width: '6px',
            height: '0.75em',
            background: 'var(--amber)',
            marginLeft: '2px',
            verticalAlign: 'middle',
            animation: typewriterDone ? 'blink 1s step-end infinite' : 'none',
          }} />
        </div>
      )}

      {proposal.status === 'REVEALED' && proposal.winner && (
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--green-phos)',
          marginBottom: '0.75rem',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.06em',
        }}>
          &gt; winner: {proposal.winner}
        </div>
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid var(--border-base)',
        paddingTop: '0.65rem',
        marginTop: '0.25rem',
      }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
          {proposal.options?.length ? `${proposal.options.length} OPTIONS` : 'NO OPTIONS'}
          {proposal.voteCount > 0 && (
            <span style={{ marginLeft: '0.75rem' }}>
              {proposal.voteCount} VOTES
            </span>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onVote(proposal.id); }}
          style={{
            fontFamily: 'var(--font-head)',
            fontSize: '0.65rem',
            letterSpacing: '0.12em',
            color: cfg.color,
            background: 'transparent',
            border: `1px solid ${cfg.color}`,
            borderRadius: '2px',
            padding: '3px 10px',
            cursor: 'pointer',
            transition: 'background 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(0,245,212,0.08)';
            e.currentTarget.style.boxShadow = cfg.glow !== 'none' ? cfg.glow : 'none';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          [ VIEW ]
        </button>
      </div>
    </div>
  );
};

const EmptyState = ({ userAddress, onCreate, filterStatus }) => {
  const [line, setLine] = useState(0);
  const lines = [
    '> scanning blockchain...',
    `> no ${filterStatus === 'all' ? '' : filterStatus + ' '}proposals found.`,
    '> terminal ready.',
  ];

  useEffect(() => {
    if (line >= lines.length) return;
    const t = setTimeout(() => setLine(l => l + 1), 800);
    return () => clearTimeout(t);
  }, [line]);

  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      background: 'var(--bg-card)',
      border: '1px dashed var(--border-base)',
      borderRadius: '2px',
      padding: '3rem 2rem',
      textAlign: 'center',
    }}>
      <div style={{ marginBottom: '1.5rem' }}>
        {lines.slice(0, line).map((l, i) => (
          <div key={i} style={{
            fontSize: '0.8rem',
            color: i === line - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
            marginBottom: '0.35rem',
            textAlign: 'left',
            maxWidth: '360px',
            margin: '0 auto 0.35rem',
          }}>
            {l}
          </div>
        ))}
      </div>
      <div style={{
        color: 'var(--text-secondary)',
        fontSize: '0.75rem',
        marginBottom: '1.5rem',
        letterSpacing: '0.08em',
      }}>
        NO RESULTS ─────────── CHECK BACK SOON
      </div>
      {userAddress && filterStatus === 'all' && (
        <button
          onClick={onCreate}
          style={{
            fontFamily: 'var(--font-head)',
            fontSize: '0.7rem',
            letterSpacing: '0.15em',
            color: 'var(--cyan)',
            background: 'transparent',
            border: '1px solid var(--cyan)',
            borderRadius: '2px',
            padding: '6px 16px',
            cursor: 'pointer',
          }}
        >
          [ + CREATE PROPOSAL ]
        </button>
      )}
    </div>
  );
};

const ProposalList = () => {
  const navigate = useNavigate();
  const { proposals, initializeProposals, userAddress } = useVoting();
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeProposals().finally(() => setLoading(false));
  }, [initializeProposals]);

  const filterTabs = [
    { value: 'all',       label: 'ALL' },
    { value: 'pending',   label: 'PENDING DKG' },
    { value: 'active',    label: 'VOTING OPEN' },
    { value: 'ended',     label: 'ENDED' },
    { value: 'revealed',  label: 'REVEALED' },
    { value: 'cancelled', label: 'CANCELLED' },
  ];

  const STATUS_FILTER_MAP = {
    all:       () => true,
    pending:   p => p.status === 'PENDING_DKG',
    active:    p => p.status === 'ACTIVE',
    ended:     p => p.status === 'ENDED',
    revealed:  p => p.status === 'REVEALED',
    cancelled: p => p.status === 'CANCELLED',
  };

  const displayProposals = proposals.filter(STATUS_FILTER_MAP[filterStatus] ?? (() => true));

  const handleVote = (proposalId) => navigate(`/proposal/${proposalId}`);

  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      background: 'var(--bg-base)',
      minHeight: '100vh',
      borderLeft: '2px solid rgba(0, 245, 212, 0.12)',
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2.5rem 2rem' }}>

        <div style={{
          fontFamily: 'var(--font-head)',
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          letterSpacing: '0.12em',
          marginBottom: '2rem',
        }}>
          &gt; /proposals
          <span style={{
            display: 'inline-block',
            width: '6px',
            height: '0.8em',
            background: 'var(--cyan)',
            marginLeft: '3px',
            verticalAlign: 'middle',
            animation: 'blink 1s step-end infinite',
          }} />
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-head)',
              fontSize: '1.75rem',
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '0.06em',
            }}>
              PROPOSALS
            </h1>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              marginTop: '0.35rem',
              letterSpacing: '0.08em',
            }}>
              {displayProposals.length} RESULT{displayProposals.length !== 1 ? 'S' : ''}
              {' '}of {proposals.length} TOTAL ── ON-CHAIN GOVERNANCE
            </div>
          </div>

          {userAddress && (
            <button
              onClick={() => navigate('/create-proposal')}
              style={{
                fontFamily: 'var(--font-head)',
                fontSize: '0.7rem',
                letterSpacing: '0.15em',
                color: 'var(--cyan)',
                background: 'transparent',
                border: '1px solid var(--cyan)',
                borderRadius: '2px',
                padding: '8px 16px',
                cursor: 'pointer',
                transition: 'background 0.15s, box-shadow 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0,245,212,0.07)';
                e.currentTarget.style.boxShadow = 'var(--cyan-glow)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              [+] NEW PROPOSAL
            </button>
          )}
        </div>

        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--border-base)',
          letterSpacing: '0.02em',
          marginBottom: '1.75rem',
          userSelect: 'none',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}>
          {'─'.repeat(120)}
        </div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0',
          marginBottom: '2rem',
          borderBottom: '1px solid var(--border-base)',
        }}>
          {filterTabs.map(tab => {
            const isActive = filterStatus === tab.value;
            const count = tab.value === 'all'
              ? proposals.length
              : proposals.filter(STATUS_FILTER_MAP[tab.value]).length;
            return (
              <button
                key={tab.value}
                onClick={() => setFilterStatus(tab.value)}
                style={{
                  fontFamily: 'var(--font-head)',
                  fontSize: '0.62rem',
                  letterSpacing: '0.12em',
                  color: isActive ? 'var(--cyan)' : count === 0 ? 'var(--border-base)' : 'var(--text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--cyan)' : '2px solid transparent',
                  marginBottom: '-1px',
                  padding: '8px 14px',
                  cursor: count === 0 && !isActive ? 'default' : 'pointer',
                  transition: 'color 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                [{tab.label}]{count > 0 ? ` ${count}` : ''}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '5rem 0',
            gap: '1rem',
          }}>
            <div style={{
              width: '240px',
              height: '3px',
              background: 'var(--border-base)',
              borderRadius: '2px',
              overflow: 'hidden',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                top: 0, left: 0, bottom: 0,
                width: '60px',
                background: 'var(--cyan)',
                animation: 'scanSweep 1.2s linear infinite',
                backgroundSize: '200%',
              }} />
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              letterSpacing: '0.1em',
            }}>
              &gt; loading proposals...
            </div>
          </div>
        ) : displayProposals.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.25rem',
          }}>
            {displayProposals.map((proposal, i) => (
              <TerminalProposalCard
                key={proposal.id}
                proposal={proposal}
                onVote={handleVote}
                index={i}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            userAddress={userAddress}
            onCreate={() => navigate('/create-proposal')}
            filterStatus={filterStatus}
          />
        )}

        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--border-base)',
          marginTop: '3rem',
          userSelect: 'none',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}>
          {'─'.repeat(120)}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--text-secondary)',
          marginTop: '0.5rem',
          letterSpacing: '0.08em',
        }}>
          &gt; {displayProposals.length} of {proposals.length} proposal{proposals.length !== 1 ? 's' : ''} displayed
          &nbsp;·&nbsp; system nominal
        </div>
      </div>
    </div>
  );
};

export default ProposalList;