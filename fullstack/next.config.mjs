/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	typescript: {
		ignoreBuildErrors: true,
	},
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "ipfs.io" },
			{ protocol: "https", hostname: "gateway.pinata.cloud" },
			{ protocol: "https", hostname: "cloudflare-ipfs.com" },
		],
	},
	webpack: (config) => {
		config.ignoreWarnings = config.ignoreWarnings || [];
		config.ignoreWarnings.push({
			message: /Critical dependency: require function is used/,
			module: /@hashgraph\/hedera-wallet-connect/,
		});
		return config;
	},
};

export default nextConfig;
