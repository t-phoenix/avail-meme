import { useAccount } from 'wagmi';
import { initializeWithProvider, isInitialized, getUnifiedBalances } from '../lib/nexus.ts';
 
export default function InitButton({
  className,
  onReady,
  onBalanceFetched,
}: { 
  className?: string; 
  onReady?: () => void;
  onBalanceFetched?: (result: any) => void;
}) {
  const { connector } = useAccount();
  
  const onClick = async () => {
    try {
      // Get the provider from the connected wallet
      const provider = await connector?.getProvider();
      if (!provider) throw new Error('No provider found');
      
      // We're calling our wrapper function from the lib/nexus.ts file here.
      await initializeWithProvider(provider);
      onReady?.();
      
      // Automatically fetch unified balances after initialization
      const balances = await getUnifiedBalances();
      onBalanceFetched?.(balances);
      
      console.log('Nexus initialized and balances fetched:', balances);
      alert('Nexus initialized and balances fetched successfully!');
    } catch (e: any) {
      alert(e?.message ?? 'Init failed');
    }
  };
  return <button className={className} onClick={onClick} disabled={isInitialized()}>Initialize Nexus & Get Balance</button>;
}