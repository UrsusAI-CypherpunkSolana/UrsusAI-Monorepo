#!/bin/bash

echo "🚀 Setting up Test USDC Token..."
echo ""

# Check if spl-token is installed
if ! command -v spl-token &> /dev/null; then
    echo "❌ spl-token CLI not found!"
    echo "Install it with: cargo install spl-token-cli"
    exit 1
fi

# Check Solana cluster
CLUSTER=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo "📡 Current cluster: $CLUSTER"

if [[ ! "$CLUSTER" =~ "testnet" ]]; then
    echo "⚠️  Not on testnet! Switching to testnet..."
    solana config set --url https://api.testnet.solana.com
fi

# Check SOL balance
BALANCE=$(solana balance | awk '{print $1}')
echo "💰 SOL Balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 0.5" | bc -l) )); then
    echo "⚠️  Low SOL balance! Requesting airdrop..."
    solana airdrop 2
    sleep 5
fi

echo ""
echo "📝 Creating Test USDC Token..."

# Create token with 6 decimals (like real USDC)
TOKEN_MINT=$(spl-token create-token --decimals 6 | grep "Creating token" | awk '{print $3}')

if [ -z "$TOKEN_MINT" ]; then
    echo "❌ Failed to create token!"
    exit 1
fi

echo "✅ Token created: $TOKEN_MINT"

# Create token account
echo ""
echo "📦 Creating token account..."
spl-token create-account $TOKEN_MINT

# Mint 10,000 test USDC
echo ""
echo "💵 Minting 10,000 test USDC..."
spl-token mint $TOKEN_MINT 10000

# Show balance
echo ""
echo "💰 Token Balance:"
spl-token balance $TOKEN_MINT

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update USDC_MINT_TESTNET in ursus-frontend/src/services/x402Service.ts"
echo "   Replace with: $TOKEN_MINT"
echo ""
echo "2. Update USDC_MINT_TESTNET in ursus-frontend/src/components/X402PaymentPanel.tsx"
echo "   Replace with: $TOKEN_MINT"
echo ""
echo "3. Restart frontend: npm run dev"
echo ""
echo "🎉 Now you can make X402 payments with USDC!"

