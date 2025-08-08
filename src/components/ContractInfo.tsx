'use client';

import { useState, useEffect } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { getPaymentContract, getUSDTContract, CONTRACT_ADDRESSES } from '../lib/contracts';
import { ethers } from 'ethers';

interface ContractInfoProps {
  isWalletConnected: boolean;
}

export default function ContractInfo({ isWalletConnected }: ContractInfoProps) {
  const [contractData, setContractData] = useState({
    totalDepositedBNB: '0',
    adminAddress: '',
    usdtTokenAddress: '',
    usdtBalance: '0',
    usdtSymbol: '',
    usdtDecimals: 6
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isWalletConnected) {
      loadContractData();
    }
  }, [isWalletConnected]);

  const loadContractData = async () => {
    setIsLoading(true);
    try {
      const paymentContract = getPaymentContract();
      const usdtContract = getUSDTContract();

      if (paymentContract && usdtContract) {
        const [
          totalDepositedBNB,
          adminAddress,
          usdtTokenAddress,
          usdtBalance,
          usdtSymbol,
          usdtDecimals
        ] = await Promise.all([
          paymentContract.getTotalDepositedBNB(),
          paymentContract.getAdmin(),
          paymentContract.getUSDTToken(),
          usdtContract.balanceOf(CONTRACT_ADDRESSES.paymentContract),
          usdtContract.symbol(),
          usdtContract.decimals()
        ]);

        setContractData({
          totalDepositedBNB: ethers.utils.formatEther(totalDepositedBNB),
          adminAddress,
          usdtTokenAddress,
          usdtBalance: ethers.utils.formatUnits(usdtBalance, usdtDecimals),
          usdtSymbol,
          usdtDecimals
        });
      }
    } catch (error) {
      console.error('Error loading contract data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <InformationCircleIcon className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Contract Information</h3>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contract Address
              </label>
              <p className="text-sm text-gray-900 font-mono">
                {formatAddress(CONTRACT_ADDRESSES.paymentContract)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Address
              </label>
              <p className="text-sm text-gray-900 font-mono">
                {formatAddress(contractData.adminAddress)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                USDT Token Address
              </label>
              <p className="text-sm text-gray-900 font-mono">
                {formatAddress(CONTRACT_ADDRESSES.usdtToken)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Deposited BNB
              </label>
              <p className="text-sm text-gray-900">
                {parseFloat(contractData.totalDepositedBNB).toFixed(4)} BNB
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contract USDT Balance
              </label>
              <p className="text-sm text-gray-900">
                {parseFloat(contractData.usdtBalance).toFixed(2)} {contractData.usdtSymbol}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Network
              </label>
              <p className="text-sm text-gray-900">BSC Testnet</p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={loadContractData}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Refresh Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 