import React, { useState } from 'react'
import { Wallet, ChevronDown, ExternalLink, Copy, Check, AlertCircle } from 'lucide-react'
import { useWallet } from '../hooks/useWallet'

interface WalletConnectProps {
  className?: string
}

const WalletConnect: React.FC<WalletConnectProps> = ({ className = '' }) => {
  const {
    address,
    isConnected,
    isConnecting,
    balance,
    balanceSymbol,
    chain,
    isOnCoreNetwork,
    connectWallet,
    disconnectWallet,
    switchToCore,
    connectors,
    connectError,
  } = useWallet()

  const [showDropdown, setShowDropdown] = useState(false)
  const [showConnectors, setShowConnectors] = useState(false)
  const [copied, setCopied] = useState(false)

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const openExplorer = () => {
    if (address && chain?.blockExplorers?.default?.url) {
      window.open(`${chain.blockExplorers.default.url}/address/${address}`, '_blank')
    }
  }

  if (!isConnected) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowConnectors(!showConnectors)}
          disabled={isConnecting}
          className="bg-[#d8e9ea] text-black px-4 py-2 rounded-lg font-medium hover:bg-[#b8d4d6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Wallet size={16} />
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>

        {/* Connector Selection Modal */}
        {showConnectors && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white text-lg font-semibold">Connect Wallet</h3>
                <button
                  onClick={() => setShowConnectors(false)}
                  className="text-[#a0a0a0] hover:text-white"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                {connectors.map((connector) => (
                  <button
                    key={connector.id}
                    onClick={() => {
                      connectWallet(connector.id)
                      setShowConnectors(false)
                    }}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 text-left hover:border-[#d8e9ea] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-[#d8e9ea] to-[#b8d4d6] rounded-lg flex items-center justify-center">
                        <Wallet size={16} className="text-black" />
                      </div>
                      <div>
                        <div className="text-white font-medium">{connector.name}</div>
                        <div className="text-[#a0a0a0] text-sm">
                          {connector.ready ? 'Ready' : 'Not installed'}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {connectError && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle size={16} />
                    {connectError.message}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Network Warning */}
      {!isOnCoreNetwork && (
        <div className="absolute -top-12 right-0 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 mb-2">
          <div className="flex items-center gap-2 text-yellow-400 text-xs">
            <AlertCircle size={12} />
            Wrong Network
            <button
              onClick={() => switchToCore()}
              className="text-yellow-300 underline hover:no-underline"
            >
              Switch to Core
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="bg-[#2a2a2a] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#3a3a3a] transition-colors flex items-center gap-2"
      >
        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
        <span>{formatAddress(address!)}</span>
        <ChevronDown size={14} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute top-full right-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 min-w-[280px] z-50 shadow-xl">
          {/* Account Info */}
          <div className="mb-4">
            <div className="text-[#a0a0a0] text-xs mb-1">Account</div>
            <div className="flex items-center gap-2">
              <span className="text-white font-mono text-sm">{formatAddress(address!)}</span>
              <button
                onClick={copyAddress}
                className="text-[#a0a0a0] hover:text-[#d8e9ea] transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              <button
                onClick={openExplorer}
                className="text-[#a0a0a0] hover:text-[#d8e9ea] transition-colors"
              >
                <ExternalLink size={14} />
              </button>
            </div>
          </div>

          {/* Balance */}
          <div className="mb-4">
            <div className="text-[#a0a0a0] text-xs mb-1">Balance</div>
            <div className="text-white font-semibold">
              {balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balanceSymbol}` : '0.0000 SOL'}
            </div>
          </div>

          {/* Network */}
          <div className="mb-4">
            <div className="text-[#a0a0a0] text-xs mb-1">Network</div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isOnCoreNetwork ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-white text-sm">{chain?.name || 'Unknown'}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2 border-t border-[#2a2a2a]">
            {!isOnCoreNetwork && (
              <button
                onClick={() => switchToCore()}
                className="w-full bg-[#d8e9ea] text-black px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#b8d4d6] transition-colors"
              >
                Switch to Core Network
              </button>
            )}
            <button
              onClick={() => {
                disconnectWallet()
                setShowDropdown(false)
              }}
              className="w-full bg-[#2a2a2a] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#3a3a3a] transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WalletConnect
