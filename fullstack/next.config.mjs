/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	// Generate unique build ID for each build to bust CloudFront cache
	generateBuildId: async () => {
		return `build-${Date.now()}-${Math.random().toString(36).substring(7)}`;
	},
	typescript: {
		ignoreBuildErrors: true,
	},
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "ipfs.io" },
			{ protocol: "https", hostname: "gateway.pinata.cloud" },
			{ protocol: "https", hostname: "cloudflare-ipfs.com" },
			{ protocol: "https", hostname: "*" },
		],
	},
	webpack: (config, { isServer }) => {
		config.ignoreWarnings = config.ignoreWarnings || [];
		config.ignoreWarnings.push({
			message: /Critical dependency: require function is used/,
			module: /@hashgraph\/hedera-wallet-connect/,
		});
		
		// Enable runtime chunk for better chunk loading resilience
		if (!isServer) {
			config.optimization = {
				...config.optimization,
				runtimeChunk: 'single',
			};
		}
		
		return config;
	},
};

// Add headers to reduce caching of HTML pages (so clients don't hold stale HTML that references old chunk names)
// while keeping long-term caching for immutable _next static assets.
nextConfig.headers = async () => {
	return [
		// Serve _next static assets (chunks, runtime) with long immutable caching
		{
			source: '/_next/static/:path*',
			headers: [
				{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
			],
		},
		// For all other frontend routes (not starting with _next), reduce caching so HTML is always revalidated.
		// This prevents stale HTML from referencing outdated chunk filenames.
		{
			// negative lookahead to exclude _next paths
			source: '/((?!_next/).*)',
			headers: [
				{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
			],
		},
	];
};

export default nextConfig;
