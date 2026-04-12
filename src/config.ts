import type { ApiConfig } from "./shared";

export const API_CONFIG: ApiConfig = {
  name: "liquidation-oracle",
  slug: "liquidation-oracle",
  description: "Real-time liquidation levels from DeFi lending protocols.",
  version: "1.0.0",
  routes: [
    {
      method: "GET",
      path: "/api/levels",
      price: "$0.003",
      description: "Get liquidation risk levels for DeFi lending protocols",
      toolName: "defi_get_liquidation_levels",
      toolDescription: "Use this when you need to check liquidation risk in DeFi lending. Returns at-risk positions, closest liquidation prices, aggregate liquidatable value by protocol and asset. Powered by DeFiLlama. Do NOT use for yields — use defi_find_best_yields. Do NOT use for swap quotes — use dex_get_swap_quote.",
      inputSchema: {
        type: "object",
        properties: {
          protocol: {
            type: "string",
            description: "Filter by protocol (e.g. aave, compound, morpho, venus). Use 'all' or omit for all protocols.",
          },
          asset: {
            type: "string",
            description: "Filter by collateral asset symbol (e.g. ETH, WBTC, stETH). Optional — returns all assets if omitted.",
          },
          minValueUsd: {
            type: "number",
            description: "Minimum at-risk value in USD to include (default: 10000)",
          },
          limit: {
            type: "number",
            description: "Number of results to return (default: 20, max: 100)",
          },
        },
        required: [],
      },
    },
  ],
};
