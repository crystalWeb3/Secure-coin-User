import { ethers } from 'ethers';
import { getPaymentContract, getUSDTContract, CONTRACT_ADDRESSES } from './contracts';

export async function testContractIntegration() {
  try {
    console.log('Testing Smart Contract Integration...');
    
    // Test 1: Check if contracts can be instantiated
    const paymentContract = getPaymentContract();
    const usdtContract = getUSDTContract();
    
    if (!paymentContract || !usdtContract) {
      console.error('Failed to instantiate contracts - MetaMask not available');
      return false;
    }
    
    console.log('Contracts instantiated successfully');
    
    // Test 2: Check contract addresses
    console.log('Contract Addresses:');
    console.log('- Payment Contract:', CONTRACT_ADDRESSES.paymentContract);
    console.log('- USDT Token:', CONTRACT_ADDRESSES.usdtToken);
    console.log('- Admin:', CONTRACT_ADDRESSES.admin);
    
    // Test 3: Try to read contract data (if wallet is connected)
    try {
      const admin = await paymentContract.getAdmin();
      const usdtToken = await paymentContract.getUSDTToken();
      const totalDepositedBNB = await paymentContract.getTotalDepositedBNB();
      
      console.log('Contract data read successfully:');
      console.log('- Admin:', admin);
      console.log('- USDT Token:', usdtToken);
      console.log('- Total Deposited BNB:', ethers.utils.formatEther(totalDepositedBNB));
      
      // Test 4: Check USDT token info
      const usdtSymbol = await usdtContract.symbol();
      const usdtDecimals = await usdtContract.decimals();
      const usdtBalance = await usdtContract.balanceOf(CONTRACT_ADDRESSES.paymentContract);
      
      console.log('USDT Token info:');
      console.log('- Symbol:', usdtSymbol);
      console.log('- Decimals:', usdtDecimals);
      console.log('- Contract USDT Balance:', ethers.utils.formatUnits(usdtBalance, usdtDecimals));
      
      return true;
      
    } catch (error) {
      console.log(' Could not read contract data (wallet not connected):', (error as Error).message);
      console.log('Connect your wallet to test full functionality');
      return false;
    }
    
  } catch (error) {
    console.error('Contract integration test failed:', error);
    return false;
  }
}

export async function testUserApproval(userAddress: string) {
  try {
    console.log('Testing User Approval...');
    
    const usdtContract = getUSDTContract();
    if (!usdtContract) {
      console.error('USDT contract not available');
      return false;
    }
    
    // Check current allowance
    const allowance = await usdtContract.allowance(userAddress, CONTRACT_ADDRESSES.paymentContract);
    console.log('📊 Current USDT Allowance:', ethers.utils.formatUnits(allowance, 6));
    
    return true;
    
  } catch (error) {
    console.error('Approval test failed:', error);
    return false;
  }
} 