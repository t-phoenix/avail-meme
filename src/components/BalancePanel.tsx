import { useState } from 'react';
import { isInitialized } from '../lib/nexus';
import InitButton from './init-button';
import FetchUnifiedBalanceButton from './fetch-unified-balance-button';
import '../styles/BalancePanel.css';

interface TokenBalance {
  chain: string;
  chainId: number;
  chainLogo?: string;
  symbol: string;
  balance: string;
  decimals: number;
  contractAddress: string;
  isNative: boolean;
  icon?: string;
  balanceInFiat?: number;
}

export default function BalancePanel() {
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rawBalanceData, setRawBalanceData] = useState<any>(null);
  const [nexusInitialized, setNexusInitialized] = useState(isInitialized());
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleBalanceFetch = (result: any) => {
    setIsLoading(true);
    try {
      console.log('Raw Balance Data:', result);
      setRawBalanceData(result);

      // Parse the unified balances result
      const parsedTokens: TokenBalance[] = [];

      if (Array.isArray(result)) {
        // Iterate through each abstracted token
        result.forEach((abstractedToken: any) => {
          const { symbol, icon, breakdown } = abstractedToken;
          
          // Iterate through the breakdown to get chain-specific balances
          if (Array.isArray(breakdown)) {
            breakdown.forEach((chainBalance: any) => {
              const { balance, chain, contractAddress, decimals, balanceInFiat } = chainBalance;
              
              // Skip tokens with zero balance
              if (parseFloat(balance) === 0) {
                return;
              }
              
              // Check if this is a native token (contractAddress is all zeros)
              const isNative = contractAddress === '0x0000000000000000000000000000000000000000';
              
              parsedTokens.push({
                chain: chain.name,
                chainId: chain.id,
                chainLogo: chain.logo,
                symbol: symbol,
                balance: balance,
                decimals: decimals,
                contractAddress: contractAddress,
                isNative: isNative,
                icon: icon,
                balanceInFiat: balanceInFiat,
              });
            });
          }
        });
      }

      setTokens(parsedTokens);
    } catch (error) {
      console.error('Error parsing balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBalance = (balance: string): string => {
    try {
      const value = parseFloat(balance);
      // If the balance is 0, just return "0"
      if (value === 0) return '0';
      
      // For values >= 1, show up to 2 decimal places
      if (value >= 1) {
        return value.toFixed(2).replace(/\.?0+$/, '');
      }
      
      // For small values (< 1), use 2 significant digits
      // This will show 0.0004 as 0.0004, 0.19958 as 0.20, etc.
      return value.toPrecision(2);
    } catch {
      return balance;
    }
  };

  const getChainIcon = (chain: string): string => {
    const icons: { [key: string]: string } = {
      ethereum: '⟠',
      eth: '⟠',
      polygon: '◆',
      matic: '◆',
      optimism: '🔴',
      arbitrum: '🔵',
      base: '🔷',
      avail: '🟣',
    };
    return icons[chain.toLowerCase()] || '🔗';
  };

  const copyToClipboard = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  return (
    <div className="balance-panel">
      <div className="balance-panel-content">
        {/* Header */}
        <div className="panel-header">
          <h2>Unified Balance</h2>
        </div>

        {/* Control Buttons */}
        <div className="control-buttons">
          <InitButton 
            className="control-button init-button"
            onReady={() => {
              console.log('Nexus initialized successfully');
              setNexusInitialized(true);
            }}
          />
          <FetchUnifiedBalanceButton 
            className="control-button fetch-button"
            onResult={handleBalanceFetch}
          />
        </div>

        {/* Status */}
        <div className="status-section">
          <div className="status-item">
            <span className="status-label">Nexus Status:</span>
            <span className={`status-value ${nexusInitialized ? 'connected' : 'disconnected'}`}>
              {nexusInitialized ? '✓ Initialized' : '✗ Not Initialized'}
            </span>
          </div>
        </div>

        {/* Token List */}
        <div className="token-list">
          <h3>Tokens by Chain</h3>
          
          {isLoading ? (
            <div className="loading">Loading balances...</div>
          ) : tokens.length === 0 ? (
            <div className="no-tokens">
              <p>No tokens found</p>
              <p className="hint">
                {!nexusInitialized 
                  ? 'Please initialize Nexus first' 
                  : 'Click "Fetch Unified Balances" to load your tokens'}
              </p>
            </div>
          ) : (
            <div className="tokens-container">
              {tokens.map((token, index) => (
                <div key={index} className="token-item">
                  <div className="token-left">
                    {token.icon ? (
                      <img src={token.icon} alt={token.symbol} className="token-icon-img" />
                    ) : (
                      <div className="token-icon">{getChainIcon(token.chain)}</div>
                    )}
                    <div className="token-info">
                      <div className="token-name">
                        <span>{token.symbol}</span>
                      </div>
                      <div className="chain-badge">
                        {token.chainLogo && (
                          <img src={token.chainLogo} alt={token.chain} className="chain-logo" />
                        )}
                        {token.chain}
                      </div>
                      {token.isNative ? (
                        <div className="token-address">Native Token</div>
                      ) : (
                        <div 
                          className="token-address clickable"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(token.contractAddress);
                          }}
                          title="Click to copy address"
                        >
                          {copiedAddress === token.contractAddress ? (
                            <>
                              <span className="copy-icon">✓</span>
                              Copied!
                            </>
                          ) : (
                            <>
                              <span className="copy-icon">📋</span>
                              {`${token.contractAddress.slice(0, 6)}...${token.contractAddress.slice(-4)}`}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="token-right">
                    <div className="token-balance">
                      {formatBalance(token.balance)} {token.symbol}
                    </div>
                    <div className="token-fiat">
                      {token.balanceInFiat !== undefined && token.balanceInFiat > 0 
                        ? `≈ $${token.balanceInFiat.toFixed(2)}`
                        : ' '}
                    </div>
                    <div className="token-decimals-right">
                      {token.decimals} decimals
                    </div>
                    {/* <div className="token-raw">
                      Raw: {token.balance}
                    </div> */}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Raw Data Display (for debugging) */}
        {rawBalanceData && (
          <details className="raw-data-section">
            <summary>View Raw Balance Data</summary>
            <pre>{JSON.stringify(rawBalanceData, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

