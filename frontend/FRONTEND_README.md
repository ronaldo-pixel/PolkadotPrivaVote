# PolkadotPrivaVote Frontend

A comprehensive React-based frontend for a privacy-preserving DAO voting application using encrypted ballots and zero-knowledge proofs.

## Features

### 1. **Proposal Creation Page** (`/create-proposal`)
- Multi-step form for creating proposals:
  - Step 1: Proposal details (description, voting options, voting mode)
  - Step 2: Voting timeline (start/end blocks)
  - Step 3: Participation thresholds
  - Step 4: Review and confirmation
- Support for 2-10 voting options
- Two voting modes:
  - **Normal**: 1 token = 1 vote
  - **Quadratic**: Vote power = √(tokens)
- Confirmation dialog with generated Proposal ID

### 2. **Active Proposals Page** (`/proposals`)
- Display proposals in `PENDING_DKG` or `ACTIVE` states
- Filter by status (All, Pending DKG, Voting Open)
- Key proposal information:
  - Description, options, voting mode
  - Start/end blocks, current participation
  - Progress visualization
- View details or navigate directly to voting

### 3. **Proposal Detail Page** (`/proposal/:id`)
- Complete proposal information display
- **Status Timeline Component**: Visualizes proposal lifecycle (PENDING_DKG → ACTIVE → ENDED → REVEALED)
- **Real-time Vote Results** (encrypted vote counts for ACTIVE proposals)
- **Integrated Voting Form** for eligible voters (ACTIVE proposals only)
- Status-specific UI:
  - **ACTIVE**: Show voting form and real-time vote count
  - **ENDED**: Display vote count with decryption status
  - **REVEALED**: Show final results with winning option highlighted

### 4. **Voting Interface** (embedded in Proposal Detail)
- **Vote Form Component**:
  - Radio button selection for voting options
  - Vote weight calculation (normal or quadratic)
  - Encrypted vote generation with ZK proof
  - Nullifier generation for unique vote tracking
  - Privacy-preserving submission
- **Confirmation Dialog** displaying:
  - Selected option
  - Vote weight (for quadratic voting)
  - Timestamp
  - Nullifier for verification

### 5. **Proposal Status Timeline Component**
- Visual representation of proposal lifecycle
- Step indicators: Pending DKG → Active Voting → Ended → Revealed
- Block progress tracking
- Status-specific alerts:
  - PENDING_DKG: Awaiting key setup
  - ACTIVE: Voting is open
  - ENDED: Awaiting decryption
  - CANCELLED: Low participation indicator

### 6. **Decryption Progress Page** (`/decryption`) - Keyholders Only
- Dashboard for registered keyholders
- List of ENDED proposals awaiting decryption
- Partial decryption submission interface:
  - Submit encrypted key share
  - Generate ZK proof for partial decryption
  - Progress tracking
- Track count of completed partial decryptions vs. required

### 7. **Archive / Proposal History Page** (`/archive`)
- Display REVEALED or CANCELLED proposals
- Search and filter capabilities
- Results display:
  - Final vote counts
  - Winning option
  - Participation metrics
  - Winner indicator (🏆)

### 8. **User Dashboard** (`/`)
- Account connection status with address display
- Keyholder badge (if applicable)
- Key statistics:
  - Active proposals count
  - Proposals created by user
  - Proposals voted in (without revealing choices)
  - Nullifier usage status (allocation vs. used)
- Quick access to eligible voting proposals
- Keyholder action panel (if applicable)

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Navigation.jsx              # Main navigation bar
│   │   ├── ProposalCard.jsx            # Proposal card component
│   │   ├── ProposalStatusTimeline.jsx # Lifecycle visualizer
│   │   └── VoteForm.jsx               # Voting interface
│   ├── context/
│   │   └── VotingContext.jsx          # Global state management
│   ├── pages/
│   │   ├── Dashboard.jsx              # Main dashboard
│   │   ├── ProposalList.jsx           # Active proposals
│   │   ├── ProposalDetail.jsx         # Individual proposal view
│   │   ├── ProposalCreate.jsx         # Create new proposal
│   │   ├── ArchiveProposals.jsx       # Completed proposals
│   │   └── DecryptionProgress.jsx     # Keyholder decryption panel
│   ├── utils/
│   │   └── contractUtils.js           # Contract interactions & utilities
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── package.json
├── vite.config.js
└── README.md
```

## Tech Stack

- **React 19.2.4** - UI framework
- **React Router 6** - Client-side routing
- **Material-UI (MUI)** - Component library
- **Emotion** - CSS-in-JS styling
- **Ethers.js 6.16** - Blockchain interactions
- **snarkjs 0.7.6** - ZK proof generation
- **Vite** - Build tool
- **Polkadot Extension** - Wallet integration (optional)

## Installation & Setup

### Prerequisites
- Node.js (v16+)
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Development Server

```bash
npm run dev
```

Server will start at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## Key Components & Features

### VotingContext (Global State Management)
Manages:
- User state (wallet address, keyholder status)
- Proposal management (creation, retrieval, updates)
- Vote submission
- Nullifier tracking
- User eligibility

### Contract Utilities
Simulates smart contract interactions:
- Proposal creation and retrieval
- Encrypted vote submission
- Partial decryption submission
- Eligibility verification

### ZK Proof Generation (Mocked)
- Vote proof generation (proves valid vote without revealing choice)
- Decryption proof generation (proves correct partial decryption)
- Nullifier generation (prevents double voting without identifying voter)

### Encryption Utilities
- Vote encryption (ElGamal in real app)
- Nullifier management
- Privacy preservation

## State Management

Uses **React Context API** for global state:
- `VotingContext` provides:
  - User information
  - Proposals array
  - Methods for creating proposals
  - Methods for casting votes
  - Nullifier tracking

## API Integration Notes

All smart contract interactions are **mocked** with realistic delays:
- Create proposal: 1000ms
- Submit vote: 1500ms
- ZK proof generation: 2000ms (vote), 3000ms (decryption)
- Decryption submission: 1000ms

**In production**, replace mocked functions in `utils/contractUtils.js` with actual contract calls using ethers.js.

## Security Features (Client-Side)

1. **Vote Encryption**
   - Votes encrypted before submission
   - Only auditable as encrypted data
   - Decryption requires keyholder cooperation

2. **Zero-Knowledge Proofs**
   - Vote proofs verify validity without revealing choice
   - Decryption proofs verify correctness without revealing key shares
   - Privacy-preserving vote verification

3. **Nullifier System**
   - Prevents double voting
   - Doesn't reveal voter identity
   - Tracks vote participation without identifying voters

4. **Eligibility Verification**
   - Client-side eligibility checks
   - Server-side verification required in production

## Customization

### Theme Customization
Modify the Material-UI theme in `App.jsx`:
```javascript
const theme = createTheme({
  palette: {
    primary: { main: '#556CD6' },
    secondary: { main: '#19857b' }
  }
});
```

### Add New Routes
1. Create new page component in `pages/`
2. Add route in `App.jsx`:
```javascript
<Route path="/new-page" element={<NewPage />} />
```

### Connect to Real Smart Contracts
1. Replace mock functions in `utils/contractUtils.js`
2. Use ethers.js with contract ABI
3. Connect wallet via Polkadot extension

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Optimizations

- Lazy loading with React Router
- Component memoization where needed
- Efficient state updates
- Responsive images and layouts
- CSS animations for smooth UX

## Accessibility

- ARIA labels on form inputs
- Keyboard navigation support
- Color contrast compliance
- Responsive design for mobile

## Future Enhancements

- [ ] Real smart contract integration
- [ ] Advanced querying and filtering
- [ ] Proposal notifications
- [ ] Vote history/audit trail
- [ ] Enhanced analytics dashboard
- [ ] Multi-language support
- [ ] Dark mode theme
- [ ] Advanced user profiles
- [ ] Proposal templates
- [ ] Delegate voting support

## Troubleshooting

### Dependencies not installing
```bash
rm -rf node_modules package-lock.json
npm install
```

### Port 5173 already in use
```bash
npm run dev -- --port 3000
```

### Build errors
Ensure all imports use correct paths and check for circular dependencies.

## Contributing

1. Follow existing code style
2. Keep components modular and reusable
3. Add comments for complex logic
4. Test responsive design
5. Update README for new features

## License

MIT

## Support

For issues or questions, please refer to the main project documentation.
