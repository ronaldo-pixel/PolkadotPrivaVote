# Quick Start Guide - PolkadotPrivaVote Frontend

## 5-Minute Setup

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

Open your browser to `http://localhost:5173`

### 3. Connect Wallet (Mock)
Click "Connect" in the top-right navigation bar to simulate wallet connection.

---

## Exploring the Application

### First Time Users
1. **Start at Dashboard** (`/`)
   - View your stats and eligible proposals
   - Understand the interface

2. **View Active Proposals** (`/proposals`)
   - See all active voting proposals
   - Click to view details and vote

3. **Create a Proposal** (`/create-proposal`)
   - Follow the 4-step wizard
   - Review before submitting

### Voting Flow
1. Navigate to active proposal
2. Click "Vote" or view proposal details
3. Select an option
4. Review vote weight calculation
5. Submit encrypted vote
6. Confirm with nullifier

### Keyholder View
Connect as a keyholder to access:
- Decryption panel (`/decryption`)
- Partial decryption submission
- Progress tracking

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         Material-UI Components          │
│    (Theme, Cards, Forms, Dialogs)       │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│           React Pages/Components        │
│  - Dashboard, ProposalList, VoteForm    │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│       VotingContext (State)             │
│   - User, Proposals, Votes, Nullifiers  │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│    Utility Layer (Mocked)               │
│  - Contract interactions                │
│  - ZK proof generation                  │
│  - Encryption utilities                 │
│  - Nullifier generation                 │
└─────────────────────────────────────────┘
```

---

## Component Hierarchy

```
App (Main)
├── Navigation
├── Dashboard (/)
├── ProposalList (/proposals)
├── ProposalCreate (/create-proposal)
│   └── Multi-step Form
├── ProposalDetail (/proposal/:id)
│   ├── ProposalStatusTimeline
│   ├── Vote Results Chart
│   └── VoteForm (if ACTIVE)
├── ArchiveProposals (/archive)
│   └── ProposalCard (iterated)
└── DecryptionProgress (/decryption)
    └── DecryptionDialog (if Keyholder)
```

---

## Mock Data

The application comes with 3 pre-loaded proposals:
- **PROP-001**: ACTIVE proposal (normal voting)
- **PROP-002**: PENDING_DKG proposal (quadratic voting)
- **PROP-003**: REVEALED proposal (completed)

To add more, edit `VotingContext.jsx` in the `mockProposals` array.

---

## Key Features Walkthrough

### Feature 1: Privacy-Preserving Voting
- Raw votes are encrypted
- Zero-knowledge proofs verify validity
- Vote counts shown without identifying voters
- Nullifiers prevent double voting

### Feature 2: Multi-Step Proposal Creation
Step 1: Define proposal & options
Step 2: Set voting timeline
Step 3: Configure participation thresholds
Step 4: Review & submit

### Feature 3: Real-Time Vote Tracking
- Real-time vote count updates
- Participation progress bars
- Status indicators
- Block progress tracking

### Feature 4: Keyholder Decryption
- Dedicated decryption panel
- Partial decryption submission
- Progress tracking
- ZK proof generation

---

## Common Tasks

### Change Theme Colors
Edit `App.jsx`:
```javascript
palette: {
  primary: { main: '#YOUR_COLOR' },
  secondary: { main: '#YOUR_COLOR' }
}
```

### Add a New Page
1. Create file in `src/pages/NewPage.jsx`
2. Add route in `App.jsx`
3. Create navigation link in `Navigation.jsx`

### Mock Different User Scenarios
Edit wallet connection in `Navigation.jsx` to simulate:
- Regular voter
- Keyholder
- Proposal creator

### Modify Mock Data
Edit `VotingContext.jsx`:
- `mockProposals` array for proposal data
- `contractMethods` for API responses
- `zkProofGenerator` for proof generation

---

## Performance Tips

- Use React DevTools to identify unnecessary renders
- Check Network tab for API calls
- Monitor bundle size with `npm run build`
- Use Chrome DevTools Performance tab

---

## Debugging

### Enable Console Logging
Add to any component:
```javascript
useEffect(() => {
  console.log('Component mounted', proposals);
}, [proposals]);
```

### Check State
Open React DevTools → Components tab → Select component → Props/State

### Navigate Without Router
For testing:
```javascript
navigate('/proposals');
```

---

## Testing Proposal Lifecycle

**Scenario: Complete Voting Cycle**

1. **Create Proposal** (PENDING_DKG state)
   - Go to `/create-proposal`
   - Fill form and submit
   - Confirm proposal created

2. **Monitor Activity** (ACTIVE state)
   - View at `/proposals`
   - See vote counts update in real-time
   - Cast votes

3. **Voting Ends** (ENDED state)
   - View proposal details
   - See "Awaiting Decryption" message
   - (Keyholders submit decryptions)

4. **Results Revealed** (REVEALED state)
   - See final vote counts
   - Identify winning option
   - View in archive

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Page not found | Check URL path matches route in App.jsx |
| State not updating | Force refresh (Ctrl+Shift+R) |
| Styles not applying | Check MUI theme and CSS imports |
| Wallet not connecting | Click "Connect" button in navbar |
| Votes not submitting | Check browser console for errors |

---

## Next Steps

1. **Connect to Real Smart Contracts**
   - Replace mock functions in `utils/contractUtils.js`
   - Use ethers.js with contract ABI
   - Store contract address in `.env`

2. **Set Up Backend API**
   - Update `VITE_API_URL` in `.env`
   - Replace mock HTTP delays with real API calls
   - Implement error handling

3. **Deploy to Production**
   - Run `npm run build`
   - Deploy `dist/` folder
   - Configure backend endpoints

4. **Add Features**
   - Advanced filtering
   - User preferences
   - Proposal notifications
   - Vote analytics

---

## Resources

- [React Documentation](https://react.dev)
- [Material-UI Docs](https://mui.com)
- [React Router Docs](https://reactrouter.com)
- [Ethers.js Docs](https://docs.ethers.org)
- [snarkjs Documentation](https://github.com/iden3/snarkjs)

---

## Getting Help

Check the following when stuck:
1. Browser console (F12) for errors
2. React DevTools for state issues
3. Network tab for API problems
4. Component props using React DevTools

---

**Happy voting! 🗳️**
