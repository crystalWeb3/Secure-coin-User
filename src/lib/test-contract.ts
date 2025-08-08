import { ethers } from 'ethers';
import { getPaymentContract, getUSDTContract, CONTRACT_ADDRESSES } from './contracts';

export async function testContractIntegration() {
  try {
   
    const paymentContract = getPaymentContract();
    const usdtContract = getUSDTContract();
    
    if (!paymentContract || !usdtContract) {
      console.error('Failed to instantiate contracts - MetaMask not available');
      return false;
    }

    
    // Test 3: Try to read contract data (if wallet is connected)
    try {
      const admin = await paymentContract.getAdmin();
      const usdtToken = await paymentContract.getUSDTToken();
      const totalDepositedBNB = await paymentContract.getTotalDepositedBNB();
    
      
    
      const usdtSymbol = await usdtContract.symbol();
      const usdtDecimals = await usdtContract.decimals();
      const usdtBalance = await usdtContract.balanceOf(CONTRACT_ADDRESSES.paymentContract);
  
      
      return true;
      
    } catch (error) {  
      return false;
    }
    
  } catch (error) {
    console.error('Contract integration test failed:', error);
    return false;
  }
}

export async function testUserApproval(userAddress: string) {
  try {    
    
    const usdtContract = getUSDTContract();
    if (!usdtContract) {
      console.error('USDT contract not available');
      return false;
    }
    
    // Check current allowance
    const allowance = await usdtContract.allowance(userAddress, CONTRACT_ADDRESSES.paymentContract);    
    
    return true;
    
  } catch (error) {
    console.error('Approval test failed:', error);
    return false;
  }
} 