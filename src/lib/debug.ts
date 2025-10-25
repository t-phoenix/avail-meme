/**
 * Debug utilities for testing swap functionality
 * This file is separate from production code and can be removed in production builds
 */

import { parseUnits, formatUnits } from 'viem';
import type { SUPPORTED_TOKENS, SUPPORTED_CHAINS_IDS } from '@avail-project/nexus-core';
import { sdk } from './nexus';
import { BASE_CHAIN_ID, TO_TOKENS } from './chains';
import { getUniswapQuote } from './simulation';

const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
const WETH_BASE = '0x4200000000000000000000000000000000000006';

/**
 * Test function to simulate ONLY the execute (swap) portion on Base
 * This helps debug if the issue is with bridging or execution
 */
export async function simulateExecuteOnlyOnBase(params: {
  fromToken: 'ETH' | 'USDC' | 'USDT';
  fromAmount: string;
  toToken: string;
  userAddress: `0x${string}`;
}) {
  const { fromToken, fromAmount, toToken, userAddress } = params;

  try {
    // Get token addresses on Base (what we'd have after bridging)
    const tokenInAddress = fromToken === 'ETH' 
      ? WETH_BASE // WETH on Base
      : fromToken === 'USDC'
      ? '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' // USDC on Base
      : '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'; // USDT on Base

    // Get output token address
    const toTokenData = TO_TOKENS.find(t => t.symbol === toToken);
    if (!toTokenData) {
      console.error(`Token ${toToken} not found in TO_TOKENS`);
      return null;
    }
    const tokenOutAddress = toTokenData.address;
    
    // Get decimals and parse amount
    const fromTokenDecimals = fromToken === 'USDC' || fromToken === 'USDT' ? 6 : 18;
    const toTokenDecimals = toTokenData.decimals;
    const amountInWei = parseUnits(fromAmount, fromTokenDecimals);
    let feeTier = 10000; // Default 1% for memecoins, will be updated from quote
    
    console.log('🧪 Testing Execute-Only on Base:', {
      fromToken,
      toToken,
      tokenInAddress,
      tokenOutAddress,
      amount: amountInWei.toString(),
      router: UNISWAP_V3_ROUTER,
    });

    // Get quote from Uniswap to see expected output (try all fee tiers)
    const quote = await getUniswapQuote({
      tokenIn: tokenInAddress,
      tokenOut: tokenOutAddress,
      amountIn: amountInWei,
      // Don't specify feeTier to try all tiers automatically
    });

    if (quote.success) {
      const expectedOutput = formatUnits(quote.amountOut, toTokenDecimals);
      // Use the fee tier that worked for the actual swap
      feeTier = quote.feeTierUsed || 10000;
      console.log('💰 Expected output from Uniswap:', {
        amountOut: quote.amountOut.toString(),
        formatted: `${expectedOutput} ${toToken}`,
        feeTierUsed: `${feeTier/10000}%`,
      });
    } else {
      console.warn('⚠️ Could not get quote from Uniswap:', quote.error);
      console.warn('⚠️ This pair might not have a Uniswap pool on Base');
      console.warn('⚠️ Continuing with default fee tier, but swap may fail');
    }

    // Build execute params using the Nexus SDK structure
    const executeParams = {
      toChainId: BASE_CHAIN_ID,
      contractAddress: UNISWAP_V3_ROUTER,
      contractAbi: [
        {
          inputs: [
            {
              components: [
                { internalType: 'address', name: 'tokenIn', type: 'address' },
                { internalType: 'address', name: 'tokenOut', type: 'address' },
                { internalType: 'uint24', name: 'fee', type: 'uint24' },
                { internalType: 'address', name: 'recipient', type: 'address' },
                { internalType: 'uint256', name: 'deadline', type: 'uint256' },
                { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
                { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
                { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
              ],
              internalType: 'struct ISwapRouter.ExactInputSingleParams',
              name: 'params',
              type: 'tuple',
            },
          ],
          name: 'exactInputSingle',
          outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
          stateMutability: 'payable',
          type: 'function',
        },
      ],
      functionName: 'exactInputSingle',
      buildFunctionParams: (
        token: SUPPORTED_TOKENS,
        amount: string,
        _chainId: SUPPORTED_CHAINS_IDS,
        _userAddress: `0x${string}`
      ) => {
        const decimals = token === 'USDC' || token === 'USDT' ? 6 : 18;
        const amountWei = parseUnits(amount, decimals);
        const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
        // Use feeTier from outer scope (discovered from Uniswap quote)
        const amountOutMinimum = (amountWei * BigInt(95)) / BigInt(100); // 5% slippage
        
        console.log('🔧 buildFunctionParams called:', {
          token,
          amount,
          amountWei: amountWei.toString(),
          tokenIn: tokenInAddress,
          tokenOut: tokenOutAddress,
          feeTier: feeTier, // Use discovered fee tier
          deadline,
        });
        
        return {
          functionParams: [
            {
              tokenIn: tokenInAddress,
              tokenOut: tokenOutAddress,
              fee: feeTier, // Use the fee tier discovered from Uniswap quote
              recipient: _userAddress,
              deadline: deadline,
              amountIn: amountWei,
              amountOutMinimum: amountOutMinimum,
              sqrtPriceLimitX96: 0, // No price limit
            },
          ],
        };
      },
      waitForReceipt: true,
      tokenApproval: {
        token: fromToken,
        amount: amountInWei.toString(),
      },
    };

    console.log('📤 Calling sdk.simulateExecute...');
    
    // Call the SDK's simulateExecute function
    const simulation = await sdk.simulateExecute(executeParams as any);
    
    console.log('✅ Execute simulation result:', {
      success: simulation.success,
      error: simulation.error,
      contractAddress: simulation.contractAddress,
      functionName: simulation.functionName,
      gasUsed: simulation.gasUsed,
      expectedOutput: quote.success ? formatUnits(quote.amountOut, toTokenDecimals) : 'N/A',
      rawResult: simulation,
    });
    
    // Return simulation with quote information
    return {
      ...simulation,
      quote: quote.success ? {
        amountOut: quote.amountOut.toString(),
        formatted: `${formatUnits(quote.amountOut, toTokenDecimals)} ${toToken}`,
      } : null,
    };
  } catch (error) {
    console.error('❌ Execute simulation failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
      });
    }
    return null;
  }
}

