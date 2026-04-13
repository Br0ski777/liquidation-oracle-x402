import type { ApiConfig } from "./shared";

export const API_CONFIG: ApiConfig = {
  name: "liquidation-oracle",
  slug: "liquidation-oracle",
  description: "DeFi liquidation levels from Aave, Compound, Morpho -- at-risk positions, price triggers, aggregate exposure.",
  version: "1.0.0",
  routes: [
    {
      method: "GET",
      path: "/api/levels",
      price: "$0.003",
      description: "Get liquidation risk levels for DeFi lending protocols",
      toolName: "defi_get_liquidation_levels",
      toolDescription: `Use this when you need to check liquidation risk levels in DeFi lending protocols. Returns at-risk positions and liquidation triggers in JSON.

1. positions: array of at-risk positions with owner, protocol, collateral asset, collateral value USD
2. liquidationPrice: price at which the position gets liquidated
3. currentPrice: current market price of the collateral
4. distancePercent: how far current price is from liquidation (%)
5. aggregateAtRisk: total USD value at risk per protocol
6. protocol: lending protocol name (Aave, Compound, Morpho, Venus)

Example output: {"positions":[{"protocol":"Aave V3","collateral":"WETH","collateralUsd":245000,"liquidationPrice":2850.00,"currentPrice":3100.00,"distancePercent":8.06}],"aggregateAtRisk":{"Aave V3":12500000},"totalPositions":42}

Use this BEFORE large market moves to identify cascade liquidation risk. Essential for liquidation bot operators and risk monitoring.

Do NOT use for yields -- use defi_find_best_yields instead. Do NOT use for swap quotes -- use dex_get_swap_quote instead. Do NOT use for wallet balance -- use wallet_get_portfolio instead.`,
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
      outputSchema: {
          "type": "object",
          "properties": {
            "protocol": {
              "type": "string",
              "description": "Protocol filter"
            },
            "asset": {
              "type": "string",
              "description": "Asset filter"
            },
            "results": {
              "type": "number",
              "description": "Number of results"
            },
            "total_pools_analyzed": {
              "type": "number"
            },
            "aggregate": {
              "type": "object",
              "properties": {
                "total_estimated_at_risk_usd": {
                  "type": "number"
                },
                "critical_pools": {
                  "type": "number"
                },
                "high_risk_pools": {
                  "type": "number"
                }
              }
            },
            "levels": {
              "type": "array",
              "items": {
                "type": "object"
              }
            }
          },
          "required": [
            "results",
            "aggregate",
            "levels"
          ]
        },
    },
  ],
};
