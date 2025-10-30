#!/bin/bash

# Token Association Fix Verification Script
# Run this after deploying to verify the fixes are working

echo "🔍 Token Association Fix Verification"
echo "======================================"
echo ""

# Check if the updated files exist
echo "✓ Checking for updated files..."
FILES=(
  "fullstack/lib/hedera.ts"
  "fullstack/app/asset/[id]/page.tsx"
  "fullstack/app/api/rpc/compose/token-associate/route.ts"
  "fullstack/app/api/rpc/check-token-association/route.ts"
  "fullstack/app/create/page.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file exists"
  else
    echo "  ✗ $file MISSING"
  fi
done

echo ""
echo "✓ Checking for new functions in hedera.ts..."
if grep -q "checkTokenAssociations" fullstack/lib/hedera.ts; then
  echo "  ✓ checkTokenAssociations function found"
else
  echo "  ✗ checkTokenAssociations function NOT FOUND"
fi

if grep -q "composeTokenAssociation" fullstack/lib/hedera.ts; then
  echo "  ✓ composeTokenAssociation function found"
else
  echo "  ✗ composeTokenAssociation function NOT FOUND"
fi

if grep -q "composeNftTransfer" fullstack/lib/hedera.ts; then
  echo "  ✓ composeNftTransfer function found"
else
  echo "  ✗ composeNftTransfer function NOT FOUND"
fi

echo ""
echo "✓ Checking for association logic in buy flow..."
if grep -q "check-token-association" fullstack/app/asset/[id]/page.tsx; then
  echo "  ✓ Association check integrated"
else
  echo "  ✗ Association check NOT integrated"
fi

echo ""
echo "✓ Checking for new API endpoint..."
if [ -f "fullstack/app/api/rpc/check-token-association/route.ts" ]; then
  echo "  ✓ check-token-association endpoint created"
else
  echo "  ✗ check-token-association endpoint NOT FOUND"
fi

echo ""
echo "======================================"
echo "📝 Manual Testing Steps:"
echo ""
echo "1. Start the development server:"
echo "   cd fullstack && npm run dev"
echo ""
echo "2. Connect HashPack wallet (Account: 0.0.7123252)"
echo ""
echo "3. Test Share Purchase:"
echo "   - Navigate to an existing asset page"
echo "   - Click 'Buy Shares'"
echo "   - Watch for 'Associating token...' message (first time)"
echo "   - Sign association transaction in HashPack"
echo "   - Sign transfer transaction"
echo "   - Verify success message"
echo ""
echo "4. Test Subsequent Purchase:"
echo "   - Buy shares from same asset again"
echo "   - Should skip association step"
echo "   - Only prompts for transfer signature"
echo ""
echo "5. Check Browser Console:"
echo "   - Look for [AssetDetail] and [HWC] log messages"
echo "   - Verify no INVALID_SIGNATURE errors"
echo ""
echo "6. Check Server Logs:"
echo "   - Look for [checkTokenAssociations] and [token-associate] messages"
echo "   - Verify token association status is correct"
echo ""
echo "======================================"
echo "🐛 Debugging Tips:"
echo ""
echo "If association still fails:"
echo "  1. Clear browser cache and reload"
echo "  2. Check HashPack extension is unlocked"
echo "  3. Verify operator account has HBAR for fees"
echo "  4. Check network connectivity to Hedera testnet"
echo "  5. Review browser console for detailed error logs"
echo ""
echo "If token already associated error:"
echo "  - This is expected behavior after first association"
echo "  - System should detect and skip association step"
echo ""
