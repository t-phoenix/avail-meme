import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, arbitrum, polygon, optimism, base, avalanche } from 'wagmi/chains';
 
export const config = getDefaultConfig({
  appName: 'Avail Meme',
  projectId: 'b0a858e336ce46bb7cc0b7162f971430', // Get this from https://cloud.walletconnect.com/
  chains: [mainnet, arbitrum, polygon, optimism, base, avalanche],
  ssr: true, // If your dApp uses server side rendering (SSR)
});