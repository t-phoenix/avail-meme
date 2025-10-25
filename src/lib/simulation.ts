import { parseUnits, formatUnits, createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import type { 
  BridgeAndExecuteParams, 
  BridgeAndExecuteSimulationResult,
  SUPPORTED_TOKENS,
  SUPPORTED_CHAINS_IDS 
} from '@avail-project/nexus-core';
import { sdk } from './nexus';
import { BASE_CHAIN_ID, TO_TOKENS } from './chains';

interface SimulateSwapParams {
  fromAmount: string;
  fromToken: string;
  fromChain: number;
  toToken: string;
  userAddress: `0x${string}`;
}

// Uniswap V3 contracts on Base
const UNISWAP_V3_QUOTER_V2 = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';
const UNISWAP_V3_ROUTER = '0x2626664c2603336E57B271c5C0b26F421741e481';
const WETH_BASE = '0x4200000000000000000000000000000000000006';

// Token addresses on Base
const TOKEN_ADDRESSES = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  WETH: WETH_BASE,
  USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
} as const;

const FEE_TIERS = [500, 3000, 10000]; // 0.05%, 0.3%, 1%
const SUPPORTED_TOKENS = ['ETH', 'USDC', 'USDT'];
const SUPPORTED_CHAINS = [1, 10, 137, 42161, 43114, 8453, 534352, 50104, 8217, 56, 999];

const basePublicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org', {
    timeout: 10_000,
    retryCount: 3,
  }),
});

// QuoterV2 ABI for quoteExactInputSingle
const QUOTER_ABI = [{
  inputs: [{
    components: [
      { internalType: 'address', name: 'tokenIn', type: 'address' },
      { internalType: 'address', name: 'tokenOut', type: 'address' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
      { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
    ],
    internalType: 'struct IQuoterV2.QuoteExactInputSingleParams',
    name: 'params',
    type: 'tuple',
  }],
  name: 'quoteExactInputSingle',
  outputs: [
    { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
    { internalType: 'uint160', name: 'sqrtPriceX96After', type: 'uint160' },
    { internalType: 'uint32', name: 'initializedTicksCrossed', type: 'uint32' },
    { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
  ],
  stateMutability: 'nonpayable',
  type: 'function',
}] as const;

const getTokenDecimals = (token: string) => (token === 'USDC' || token === 'USDT' ? 6 : 18);

const getTokenAddress = (token: string): string => {
  return TOKEN_ADDRESSES[token as keyof typeof TOKEN_ADDRESSES] || TOKEN_ADDRESSES.ETH;
};

/**
 * Get quote from Uniswap V3 for the expected output amount
 */
export async function getUniswapQuote(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  feeTier?: number;
}): Promise<{ amountOut: bigint; success: boolean; error?: string; feeTierUsed?: number }> {
  const { tokenIn, tokenOut, amountIn, feeTier } = params;

  if (tokenIn.toLowerCase() === TOKEN_ADDRESSES.ETH.toLowerCase() || 
      tokenOut.toLowerCase() === TOKEN_ADDRESSES.ETH.toLowerCase()) {
    return {
      amountOut: BigInt(0),
      success: false,
      error: 'Invalid token address - use WETH instead of ETH placeholder'
    };
  }

  const feetiersToTry = feeTier ? [feeTier] : FEE_TIERS;

  for (const fee of feetiersToTry) {
    try {
      const result = await basePublicClient.readContract({
        address: UNISWAP_V3_QUOTER_V2 as `0x${string}`,
        abi: QUOTER_ABI,
        functionName: 'quoteExactInputSingle',
        args: [{
          tokenIn: tokenIn as `0x${string}`,
          tokenOut: tokenOut as `0x${string}`,
          amountIn,
          fee,
          sqrtPriceLimitX96: BigInt(0),
        }],
      }) as readonly [bigint, bigint, number, bigint];

      return { amountOut: result[0], success: true, feeTierUsed: fee };
    } catch (error) {
      if (fee === feetiersToTry[feetiersToTry.length - 1]) {
        return { 
          amountOut: BigInt(0), 
          success: false, 
          error: error instanceof Error ? error.message : 'No liquidity pool found' 
        };
      }
    }
  }

  return { amountOut: BigInt(0), success: false, error: 'No liquidity pool found' };
}

// Uniswap V3 Router ABI
const ROUTER_ABI = [{
  inputs: [{
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
  }],
  name: 'exactInputSingle',
  outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
  stateMutability: 'payable',
  type: 'function',
}];

export async function simulateBridgeAndExecute(
  params: SimulateSwapParams
): Promise<BridgeAndExecuteSimulationResult | null> {
  const { fromAmount, fromToken, fromChain, toToken, userAddress } = params;

  if (!SUPPORTED_TOKENS.includes(fromToken)) {
    console.error(`Token ${fromToken} not supported`);
    return null;
  }
  
  if (!SUPPORTED_CHAINS.includes(fromChain)) {
    console.error(`Chain ${fromChain} not supported`);
    return null;
  }

  try {
    const toTokenData = TO_TOKENS.find(t => t.symbol === toToken);
    if (!toTokenData) {
      console.error(`Token ${toToken} not found`);
      return null;
    }

    const amountInWei = parseUnits(fromAmount, getTokenDecimals(fromToken));
    const bridgedTokenAddress = getTokenAddress(fromToken);

    const bridgeParams: BridgeAndExecuteParams = {
      token: fromToken as any,
      amount: amountInWei.toString(),
      toChainId: BASE_CHAIN_ID,
      sourceChains: [fromChain],
      recipient: userAddress,
      execute: {
        contractAddress: UNISWAP_V3_ROUTER,
        contractAbi: ROUTER_ABI,
        functionName: 'exactInputSingle',
        buildFunctionParams: (
          token: SUPPORTED_TOKENS,
          amount: string,
          _chainId: SUPPORTED_CHAINS_IDS,
          userAddress: `0x${string}`
        ) => {
          const amountWei = parseUnits(amount, getTokenDecimals(token));
          const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
          const amountOutMinimum = (amountWei * BigInt(95)) / BigInt(100); // 5% slippage
          
          return {
            functionParams: [{
              tokenIn: bridgedTokenAddress,
              tokenOut: toTokenData.address,
              fee: 10000, // 1% fee tier for memecoins
              recipient: userAddress,
              deadline,
              amountIn: amountWei,
              amountOutMinimum,
              sqrtPriceLimitX96: 0,
            }],
          };
        },
        tokenApproval: {
          token: fromToken as any,
          amount: amountInWei.toString(),
        },
      },
      waitForReceipt: true,
    } as BridgeAndExecuteParams;

    const simulation = await sdk.simulateBridgeAndExecute(bridgeParams);
    console.log('Simulation complete:', simulation.success ? '✅' : '❌');
    return simulation;
  } catch (error) {
    console.error('Simulation failed:', error);
    return null;
  }
}

export function getFormattedReceiveAmount(
  simulation: BridgeAndExecuteSimulationResult | null,
  toToken: string
): string {
  if (!simulation?.metadata?.bridgeReceiveAmount) return '';

  const toTokenData = TO_TOKENS.find(t => t.symbol === toToken);
  return formatUnits(
    BigInt(simulation.metadata.bridgeReceiveAmount),
    toTokenData?.decimals || 18
  );
}

/**
 * Get a quick quote for swapping on Base
 */
export async function getSwapQuoteOnBase(params: {
  fromToken: 'ETH' | 'USDC' | 'USDT';
  fromAmount: string;
  toToken: string;
  feeTier?: number;
}): Promise<{ outputAmount: string; success: boolean; error?: string; feeTierUsed?: number }> {
  const { fromToken, fromAmount, toToken, feeTier } = params;

  try {
    const tokenInAddress = fromToken === 'ETH' ? TOKEN_ADDRESSES.WETH : getTokenAddress(fromToken);
    const toTokenData = TO_TOKENS.find(t => t.symbol === toToken);
    
    if (!toTokenData) {
      return { outputAmount: '0', success: false, error: 'Token not found' };
    }

    const amountInWei = parseUnits(fromAmount, getTokenDecimals(fromToken));
    const quote = await getUniswapQuote({
      tokenIn: tokenInAddress,
      tokenOut: toTokenData.address,
      amountIn: amountInWei,
      feeTier,
    });

    if (!quote.success) {
      return { outputAmount: '0', success: false, error: quote.error };
    }

    const outputAmount = formatUnits(quote.amountOut, toTokenData.decimals);
    return { outputAmount, success: true, feeTierUsed: quote.feeTierUsed };
  } catch (error) {
    return { 
      outputAmount: '0', 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
