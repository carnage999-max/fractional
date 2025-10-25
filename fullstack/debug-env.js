// Debug script to check environment variables
console.log("=== Environment Variable Debug ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:", process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID);
console.log("NEXT_PUBLIC_WC_RELAY_URL:", process.env.NEXT_PUBLIC_WC_RELAY_URL);
console.log("NEXT_PUBLIC_HEDERA_NETWORK:", process.env.NEXT_PUBLIC_HEDERA_NETWORK);

// Check if .env.local exists and is readable
const fs = require('fs');
const path = require('path');

try {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log("\n=== .env.local file exists and contains ===");
    const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    lines.forEach(line => {
        if (line.includes('NEXT_PUBLIC_')) {
            console.log(line);
        }
    });
} catch (error) {
    console.error("\n❌ Error reading .env.local:", error.message);
}

console.log("=== End Debug ===");