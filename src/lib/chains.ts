// Chain configuration with native currencies
// Chain IDs must match Nexus SDK supported chains
export const CHAINS = [
  { id: 1, name: 'Ethereum', nativeCurrency: 'ETH' },
  { id: 10, name: 'Optimism', nativeCurrency: 'ETH' },
  { id: 137, name: 'Polygon', nativeCurrency: 'MATIC' },
  { id: 42161, name: 'Arbitrum', nativeCurrency: 'ETH' },
  { id: 43114, name: 'Avalanche', nativeCurrency: 'AVAX' },
  { id: 8453, name: 'Base', nativeCurrency: 'ETH' },
  { id: 534352, name: 'Scroll', nativeCurrency: 'ETH' }, // Fixed: was 534351
  { id: 50104, name: 'Sophon', nativeCurrency: 'SOPH' },
  { id: 8217, name: 'Kaia', nativeCurrency: 'KAIA' },
  { id: 56, name: 'BNB Chain', nativeCurrency: 'BNB' },
  { id: 999, name: 'HyperEVM', nativeCurrency: 'HYPE' }, // Fixed: was 9000000
];

// Fixed list of tokens to swap from
export const FROM_TOKENS = ['ETH', 'USDC', 'USDT'];

// Fixed list of tokens to swap to (on Base)
export const TO_TOKENS = [
  {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
    address: '0x4200000000000000000000000000000000000006', // WETH on Base (Uniswap requires WETH, not native ETH)
  },
  {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  },
  {
    name: 'Tether USD',
    symbol: 'USDT',
    decimals: 6,
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  },
  {
    name: 'SPX6900',
    symbol: 'SPX',
    decimals: 8,
    address: '0x50da645f148798f68ef2d7db7c1cb22a6819bb2c', // Placeholder - update with actual Base DOGE address
  },
  {
    name: 'Virtual Protocol',
    symbol: 'VIRTUAL',
    decimals: 18,
    address: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b',
  },
  {
    name: 'Mog Coin',
    symbol: 'MOG',
    decimals: 18,
    address: '0x2da56acb9ea78330f947bd57c54119debda7af71',
  },
];

// Base chain ID - fixed destination for swaps
export const BASE_CHAIN_ID = 8453;

