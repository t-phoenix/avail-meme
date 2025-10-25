import { useState, useEffect } from 'react';
import { isInitialized } from '../lib/nexus';
import { CHAINS, FROM_TOKENS, TO_TOKENS } from '../lib/chains';
import type { TokenBalance } from '../App';
import { useAccount } from 'wagmi';
import type { BridgeAndExecuteSimulationResult } from '@avail-project/nexus-core';
import { simulateBridgeAndExecute, getSwapQuoteOnBase } from '../lib/simulation';
import '../styles/SwapComponent.css';

interface SwapComponentProps {
  selectedToken: TokenBalance | null;
  unifiedBalances: TokenBalance[];
}

const SUPPORTED_INPUT_TOKENS = ['ETH', 'USDC', 'USDT'];

const formatBalance = (balance: string): string => {
  const value = parseFloat(balance);
  if (value === 0) return '0';
  if (value >= 1) return value.toFixed(2).replace(/\.?0+$/, '');
  return value.toPrecision(2);
};

export default function SwapComponent({ selectedToken, unifiedBalances }: SwapComponentProps) {
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromChain, setFromChain] = useState(1);
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('ETH');
  const [simulationResult, setSimulationResult] = useState<BridgeAndExecuteSimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const { isConnected, address } = useAccount();

  const getCurrentBalance = () => 
    unifiedBalances.find(b => b.chainId === fromChain && b.symbol === fromToken) || null;

  // Update form when token card is clicked
  useEffect(() => {
    if (selectedToken) {
      setFromChain(selectedToken.chainId);
      setFromToken(selectedToken.symbol);
    }
  }, [selectedToken]);

  // Fetch Uniswap quote
  useEffect(() => {
    const fetchQuote = async () => {
      if (!fromAmount || parseFloat(fromAmount) <= 0) {
        setToAmount('');
        setQuoteError(null);
        return;
      }

      if (!SUPPORTED_INPUT_TOKENS.includes(fromToken)) {
        setToAmount('');
        setQuoteError('Unsupported input token');
        return;
      }

      if (fromToken === toToken) {
        setToAmount(fromAmount);
        setQuoteError(null);
        return;
      }

      setIsFetchingQuote(true);
      setQuoteError(null);

      try {
        const quote = await getSwapQuoteOnBase({
          fromToken: fromToken as 'ETH' | 'USDC' | 'USDT',
          fromAmount,
          toToken,
        });

        if (quote.success) {
          setToAmount(quote.outputAmount);
          setQuoteError(null);
        } else {
          setToAmount('');
          setQuoteError(quote.error || 'Failed to get quote');
        }
      } catch (error) {
        console.error('Error fetching quote:', error);
        setToAmount('');
        setQuoteError('Error fetching quote');
      } finally {
        setIsFetchingQuote(false);
      }
    };

    const timeoutId = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timeoutId);
  }, [fromAmount, fromToken, toToken]);

  // Run simulation for bridge costs
  useEffect(() => {
    const runSimulation = async () => {
      if (!isInitialized() || !address || !fromAmount || parseFloat(fromAmount) <= 0) {
        setSimulationResult(null);
        return;
      }

      setIsSimulating(true);
      try {
        const simulation = await simulateBridgeAndExecute({
          fromAmount,
          fromToken,
          fromChain,
          toToken,
          userAddress: address,
        });
        setSimulationResult(simulation);
      } catch (error) {
        console.error('Simulation error:', error);
        setSimulationResult(null);
      } finally {
        setIsSimulating(false);
      }
    };

    runSimulation();
  }, [fromAmount, fromToken, toToken, fromChain, address]);

  const handleSwap = () => {
    if (!isInitialized()) {
      alert('Please connect your wallet first');
      return;
    }
    
    if (simulationResult?.success) {
      alert(`Ready to swap!\n\nYou will receive approximately ${toAmount} ${toToken} on Base.`);
    } else {
      alert('Please wait for simulation to complete');
    }
  };

  const handleMaxClick = () => {
    const balance = getCurrentBalance();
    if (balance) setFromAmount(balance.balance);
  };

  const renderBalanceInfo = () => {
    if (!isConnected) return <span className="balance-text error-text">Connect wallet to see balance</span>;
    if (!isInitialized()) return <span className="balance-text error-text">Initialize Nexus to see balance</span>;
    if (unifiedBalances.length === 0) return <span className="balance-text error-text">Fetch balances to see balance</span>;
    
    const balance = getCurrentBalance();
    return balance ? (
      <>
        <span className="balance-text">Balance: {formatBalance(balance.balance)} {fromToken}</span>
        <button className="max-button" onClick={handleMaxClick}>Max</button>
      </>
    ) : (
      <span className="balance-text">Balance: 0 {fromToken}</span>
    );
  };

  const getButtonText = () => {
    if (!isInitialized()) return 'Connect Wallet to Swap';
    if (isSimulating) return '⏳ Simulating...';
    if (!simulationResult?.success && fromAmount) return '⚠️ Simulation Failed';
    if (simulationResult?.success) return `Swap to ${toAmount} ${toToken}`;
    return 'Enter Amount to Swap';
  };

  const getEstimatedCost = () => {
    if (typeof simulationResult?.totalEstimatedCost === 'string') {
      return simulationResult.totalEstimatedCost;
    }
    if (typeof simulationResult?.totalEstimatedCost === 'object' && simulationResult.totalEstimatedCost?.total) {
      return simulationResult.totalEstimatedCost.total;
    }
    return 'N/A';
  };

  return (
    <div className="swap-container">
      <div className="swap-header">
        <h2>Swap to Base</h2>
        <span className="network-badge">Base-MEME Bridge</span>
      </div>

      {/* From Section */}
      <div className="swap-section">
        <label className="swap-label">From</label>
        
        <div className="selector-row">
          <div className="chain-selector">
            <label className="selector-sublabel">Network</label>
            <select value={fromChain} onChange={(e) => setFromChain(Number(e.target.value))} className="chain-dropdown">
              {CHAINS.map(chain => (
                <option key={chain.id} value={chain.id}>{chain.name}</option>
              ))}
            </select>
          </div>

          <div className="token-selector">
            <label className="selector-sublabel">Asset</label>
            <select value={fromToken} onChange={(e) => setFromToken(e.target.value)} className="token-dropdown">
              {FROM_TOKENS.map(token => (
                <option key={token} value={token}>{token}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="amount-input-container">
          <input
            type="number"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
            placeholder="0.0"
            className="amount-input"
          />
          <div className="token-symbol-container">
            <span className="token-symbol">{fromToken}</span>
          </div>
        </div>

        <div className="balance-row">{renderBalanceInfo()}</div>
      </div>

      {/* To Section */}
      <div className="swap-section">
        <label className="swap-label">To (on Base)</label>
        
        <div className="token-selector">
          <label className="selector-sublabel">Asset</label>
          <select value={toToken} onChange={(e) => setToToken(e.target.value)} className="token-dropdown">
            {TO_TOKENS.map(token => (
              <option key={token.symbol} value={token.symbol}>{token.symbol}</option>
            ))}
          </select>
        </div>
        
        <div className="amount-input-container">
          <input
            type="number"
            value={toAmount}
            readOnly
            placeholder={isFetchingQuote ? "Fetching quote..." : quoteError ? "No pool found" : "0.0"}
            className="amount-input"
            style={{ cursor: 'not-allowed' }}
          />
          <div className="token-symbol-container">
            <span className="token-symbol">{toToken}</span>
          </div>
        </div>

        <div className="balance-row">
          {isFetchingQuote ? (
            <span className="balance-text">💱 Fetching quote...</span>
          ) : quoteError ? (
            <span className="balance-text error-text">⚠️ {quoteError}</span>
          ) : toAmount ? (
            <span className="balance-text">✅ Quote from Uniswap</span>
          ) : (
            <span className="balance-text">Enter amount above</span>
          )}
        </div>
      </div>

      {/* Rate Info */}
      <div className="rate-info">
        <div className="rate-row">
          <span>Status</span>
          <span className="rate-value">
            {isSimulating ? '🔄 Simulating...' : simulationResult?.success ? '✅ Ready' : '⏸️ Enter amount'}
          </span>
        </div>
        {simulationResult ? (
          <>
            <div className="rate-row">
              <span>Total Est. Cost</span>
              <span className="rate-value">{getEstimatedCost()}</span>
            </div>
            <div className="rate-row">
              <span>Approval Required</span>
              <span className="rate-value">{simulationResult.metadata?.approvalRequired ? '✓ Yes' : '✗ No'}</span>
            </div>
            <div className="rate-row">
              <span>Steps</span>
              <span className="rate-value">{simulationResult.steps?.length || 0}</span>
            </div>
          </>
        ) : !isSimulating && (
          <>
            <div className="rate-row">
              <span>Bridge Fee</span>
              <span className="rate-value">~0.1%</span>
            </div>
            <div className="rate-row">
              <span>Est. Time</span>
              <span className="rate-value">~2 minutes</span>
            </div>
          </>
        )}
      </div>

      {/* Swap Button */}
      <button 
        className="swap-button"
        onClick={handleSwap}
        disabled={!isInitialized() || !fromAmount || isSimulating || !simulationResult?.success}
      >
        {getButtonText()}
      </button>
    </div>
  );
}


