# DeFi Liquidation Oracle API

[![MCP Server](https://img.shields.io/badge/MCP-server-blue)](https://liquidation-oracle.api.klymax402.com/mcp)
[![x402](https://img.shields.io/badge/payments-x402-6E56CF)](https://x402.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

DeFi liquidation levels from Aave, Compound, Morpho -- at-risk positions, price triggers, aggregate exposure. Pay-per-call via [x402](https://x402.org) (USDC on Base L2) -- no API key, no signup, no rate-limit wall.

Part of the [klymax402](https://klymax402.com) marketplace -- 100 x402 micropayment APIs for AI agents, one wallet, USDC on Base.

## Quickstart -- MCP

Add to your MCP client config (Claude Desktop, Cursor, ElizaOS, etc.):

```json
{
  "mcpServers": {
    "liquidation-oracle": {
      "url": "https://liquidation-oracle.api.klymax402.com/mcp"
    }
  }
}
```

## Quickstart -- HTTP (x402)

```bash
curl "https://liquidation-oracle.api.klymax402.com/api/levels"
# -> 402 Payment Required, with an x402 payment challenge in the response body
```

Any x402-aware client ([`@x402/fetch`](https://www.npmjs.com/package/@x402/fetch), [`x402-agent-tools`](https://www.npmjs.com/package/x402-agent-tools), ATXP) handles the 402 -> sign -> retry cycle automatically.

## Tools

| Tool | Method | Path | Price | Description |
|---|---|---|---|---|
| `defi_get_liquidation_levels` | GET | `/api/levels` | $0.008 | Get liquidation risk levels for DeFi lending protocols |

### `defi_get_liquidation_levels`

Use this when you need to check liquidation risk levels in DeFi lending protocols. Returns at-risk positions and liquidation triggers in JSON.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `protocol` | string | no | Filter by protocol (e.g. aave, compound, morpho, venus). Use 'all' or omit for all protocols. |
| `asset` | string | no | Filter by collateral asset symbol (e.g. ETH, WBTC, stETH). Optional — returns all assets if omitted. |
| `minValueUsd` | number | no | Minimum at-risk value in USD to include (default: 10000) |
| `limit` | number | no | Number of results to return (default: 20, max: 100) |

**Returns**

- `positions` -- array of at-risk positions with owner, protocol, collateral asset, collateral value USD
- `liquidationPrice` -- price at which the position gets liquidated
- `currentPrice` -- current market price of the collateral
- `distancePercent` -- how far current price is from liquidation (%)
- `aggregateAtRisk` -- total USD value at risk per protocol
- `protocol` -- lending protocol name (Aave, Compound, Morpho, Venus)

Example response:

```json
{"positions":[{"protocol":"Aave V3","collateral":"WETH","collateralUsd":245000,"liquidationPrice":2850.00,"currentPrice":3100.00,"distancePercent":8.06}],"aggregateAtRisk":{"Aave V3":12500000},"totalPositions":42}
```

**When to use**: large market moves to identify cascade liquidation risk. Essential for liquidation bot operators and risk monitoring.

**Not for**: yields (use `defi_find_best_yields`), swap quotes (use `dex_get_swap_quote`), wallet balance (use `wallet_get_portfolio`).

## Example agent prompts

- "Check liquidation risk levels in DeFi lending protocols"

## Payment

- Protocol: [x402](https://x402.org) -- HTTP-native pay-per-call, no signup, no API key
- Network: Base L2 (`eip155:8453`)
- Asset: USDC
- Facilitator: Coinbase CDP (primary), PayAI (fallback)
- Also reachable via [ATXP](https://atxp.ai) (OAuth-wrapped x402, RFC 9728 protected-resource metadata)

## Part of klymax402

100 x402 micropayment APIs for AI agents -- one wallet, USDC on Base, zero signup.

- Catalog: https://klymax402.com/llms.txt
- Full API reference: https://klymax402.com/llms-full.txt
- Live stats: https://klymax402.com/stats

## License

MIT
