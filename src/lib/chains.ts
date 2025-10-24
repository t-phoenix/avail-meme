// Chain configuration with native currencies
export const CHAINS = [
  { id: 1, name: 'Ethereum', nativeCurrency: 'ETH' },
  { id: 10, name: 'Optimism', nativeCurrency: 'ETH' },
  { id: 137, name: 'Polygon', nativeCurrency: 'MATIC' },
  { id: 42161, name: 'Arbitrum', nativeCurrency: 'ETH' },
  { id: 43114, name: 'Avalanche', nativeCurrency: 'AVAX' },
  { id: 8453, name: 'Base', nativeCurrency: 'ETH' },
  { id: 534351, name: 'Scroll', nativeCurrency: 'ETH' },
  { id: 50104, name: 'Sophon', nativeCurrency: 'SOPH' },
  { id: 8217, name: 'Kaia', nativeCurrency: 'KAIA' },
  { id: 56, name: 'BNB Chain', nativeCurrency: 'BNB' },
  { id: 9000000, name: 'HyperEVM', nativeCurrency: 'HYPE' },
];

// Fixed list of tokens to swap from
export const FROM_TOKENS = ['ETH', 'USDC', 'USDT'];

// Fixed list of tokens to swap to (on Base)
export const TO_TOKENS = ['ETH', 'USDC', 'USDT', 'DOGE', 'PEPE', 'BRETT'];

// Base chain ID - fixed destination for swaps
export const BASE_CHAIN_ID = 8453;

