# Avail Meme 🚀

**Buy memecoins on Base from any chain** — powered by Avail Nexus for seamless cross-chain swaps. **Built for ETH Online 2025**.

## What It Does

Avail Meme enables users to purchase memecoins on Base (Ethereum L2) using tokens from any supported chain (Ethereum, Arbitrum, Optimism, Polygon). Instead of manually bridging assets and then swapping, users can execute cross-chain swaps in a single transaction using the Avail Nexus SDK.

**Key Features:**
- 🌐 **Multi-chain Support** — Connect wallets from Ethereum, Arbitrum, Optimism, Polygon, and Base
- 💰 **Unified Balance View** — See all your token balances across chains in one place
- 🔄 **Cross-chain Swaps** — Bridge and swap in a single transaction
- 💱 **Live Quotes** — Get real-time swap quotes before executing transactions
- 🎯 **One-Click Trading** — Select a token, enter amount, and swap instantly

## Tech Stack

### Frontend
- **React 19** + **TypeScript** — Modern UI framework with type safety
- **Vite** — Lightning-fast build tool
- **Tailwind CSS** — Utility-first styling

### Web3 Infrastructure
- **Wagmi v2** — React hooks for Ethereum wallet interactions
- **RainbowKit** — Beautiful wallet connection UI
- **Viem** — Low-level Ethereum primitives
- **TanStack React Query** — Async state management

### Cross-chain
- **Avail Nexus Core SDK** — Unified cross-chain execution layer for bridging and swaps. Using `nexus-core/simulateBridgeAndExecute` and `BridgeAndExecute`.
- **Uniswap V3 Router** - find the best swap prices for memecoins on Base chain.

## Getting Started

### Prerequisites
- Node.js 18+ and pnpm installed
- A Web3 wallet (MetaMask, Coinbase Wallet, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/t-phoenix/avail-meme.git
cd avail-meme

# Install dependencies
pnpm install

# Run development server
pnpm dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
pnpm build
pnpm preview
```

## How It Works

1. **Connect Wallet** — Use RainbowKit to connect your Web3 wallet
2. **Initialize Nexus** — One-time SDK initialization per session
3. **View Balances** — See unified balances across all supported chains
4. **Select Token** — Choose source chain and token to swap
5. **Get Quote** — Enter amount and get a real-time swap quote
6. **Execute Swap** — Bridge and swap in a single cross-chain transaction
7. **Track Status** — Monitor transaction status across chains

## Project Structure

```
src/
├── components/          # React components
│   ├── SwapComponent.tsx    # Main swap interface
│   ├── BalancePanel.tsx     # Unified balance view
│   └── connect-button.tsx   # Wallet connection
├── lib/                 # Core utilities
│   ├── nexus.ts            # Avail Nexus SDK wrapper
│   ├── simulation.ts       # Bridge & swap simulation
│   ├── chains.ts           # Chain and token configs
│   └── wagmi.ts            # Wagmi configuration
└── styles/              # Component styles
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

Built with ❤️ using:
- [Avail Nexus](https://www.availproject.org/) — Unified execution layer
- [RainbowKit](https://rainbowkit.com/) — Wallet connection
- [Wagmi](https://wagmi.sh/) — React hooks for Ethereum
- [Viem](https://viem.sh/) — TypeScript interface for Ethereum
- [Tailwind CSS](https://tailwindcss.com/) — Styling framework
- [Vite](https://vitejs.dev/) — Build tool

## License

MIT
