import type { Hono } from "hono";


// ATXP: requirePayment only fires inside an ATXP context (set by atxpHono middleware).
// For raw x402 requests, the existing @x402/hono middleware handles the gate.
// If neither protocol is active (ATXP_CONNECTION unset), tryRequirePayment is a no-op.
async function tryRequirePayment(price: number): Promise<void> {
  if (!process.env.ATXP_CONNECTION) return;
  try {
    const { requirePayment } = await import("@atxp/server");
    const BigNumber = (await import("bignumber.js")).default;
    await requirePayment({ price: BigNumber(price) });
  } catch (e: any) {
    if (e?.code === -30402) throw e;
  }
}

// In-memory cache with TTL
interface CacheEntry {
  data: any;
  timestamp: number;
}

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const cache = new Map<string, CacheEntry>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data as T;
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Protocol name normalization
const PROTOCOL_ALIASES: Record<string, string> = {
  aave: "aave",
  "aave-v2": "aave-v2",
  "aave-v3": "aave-v3",
  compound: "compound",
  "compound-v3": "compound-v3",
  morpho: "morpho",
  venus: "venus",
  spark: "spark",
  radiant: "radiant",
  benqi: "benqi",
  maker: "maker",
  liquity: "liquity",
};

function normalizeProtocol(protocol: string): string {
  return PROTOCOL_ALIASES[protocol.toLowerCase()] || protocol.toLowerCase();
}

interface LendingPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  apyBaseBorrow: number | null;
  apyRewardBorrow: number | null;
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  ltv: number | null;
}

interface LiquidationLevel {
  protocol: string;
  chain: string;
  asset: string;
  pool_symbol: string;
  total_supplied_usd: number;
  total_borrowed_usd: number;
  utilization_rate: number;
  ltv: number | null;
  borrow_apy: number;
  borrow_apy_base: number | null;
  borrow_apy_reward: number | null;
  supply_apy: number;
  liquidation_pressure: "critical" | "high" | "moderate" | "low";
  estimated_at_risk_usd: number;
  distance_to_stress_percent: number;
}

function calcLiquidationPressure(utilizationRate: number, borrowApy: number): "critical" | "high" | "moderate" | "low" {
  // High utilization + high borrow APY = liquidation pressure
  if (utilizationRate > 0.9 || borrowApy > 50) return "critical";
  if (utilizationRate > 0.8 || borrowApy > 25) return "high";
  if (utilizationRate > 0.65 || borrowApy > 10) return "moderate";
  return "low";
}

function estimateAtRiskValue(totalBorrowUsd: number, utilizationRate: number, ltv: number | null): number {
  // Estimate positions at risk based on utilization and LTV
  const effectiveLtv = ltv || 0.75;
  const safeThreshold = effectiveLtv * 0.85; // 85% of max LTV is "safe"
  if (utilizationRate < safeThreshold) return 0;
  // Proportional risk: more borrowed relative to capacity = more at risk
  const riskFraction = Math.min((utilizationRate - safeThreshold) / (1 - safeThreshold), 1);
  return totalBorrowUsd * riskFraction;
}

async function fetchLendBorrowPools(): Promise<LendingPool[]> {
  const cached = getCached<LendingPool[]>("lend_borrow_pools");
  if (cached) return cached;

  const resp = await fetch("https://yields.llama.fi/lendBorrow");
  if (!resp.ok) {
    throw new Error(`DeFiLlama lendBorrow API error: ${resp.status} ${resp.statusText}`);
  }

  const json = (await resp.json()) as { data: LendingPool[] };
  const pools = json.data || [];
  setCache("lend_borrow_pools", pools);
  return pools;
}

function extractPrimaryAsset(symbol: string): string {
  // "USDC" -> "USDC", "WETH-USDC" -> "WETH"
  const parts = symbol.split(/[-\/]/);
  return parts[0]?.trim().toUpperCase() || symbol.toUpperCase();
}

export function registerRoutes(app: Hono) {
  app.get("/api/levels", async (c) => {
    await tryRequirePayment(0.003);
    const protocolParam = c.req.query("protocol");
    const assetParam = c.req.query("asset");
    const minValueParam = c.req.query("minValueUsd");
    const limitParam = c.req.query("limit");

    const minValueUsd = minValueParam ? parseFloat(minValueParam) : 10_000;
    const limit = Math.min(Math.max(limitParam ? parseInt(limitParam, 10) : 20, 1), 100);
    const filterProtocol = protocolParam && protocolParam !== "all" ? normalizeProtocol(protocolParam) : null;
    const filterAsset = assetParam ? assetParam.toUpperCase() : null;

    let pools: LendingPool[];
    try {
      pools = await fetchLendBorrowPools();
    } catch (err: any) {
      return c.json({ error: "Failed to fetch lending data", details: err.message }, 502);
    }

    // Filter and analyze pools
    const levels: LiquidationLevel[] = [];

    for (const pool of pools) {
      const project = (pool.project || "").toLowerCase();
      const asset = extractPrimaryAsset(pool.symbol || "");

      // Apply filters
      if (filterProtocol && !project.includes(filterProtocol)) continue;
      if (filterAsset && asset !== filterAsset) continue;

      const totalSupply = pool.totalSupplyUsd || 0;
      const totalBorrow = pool.totalBorrowUsd || 0;
      if (totalSupply <= 0) continue;

      const utilizationRate = totalBorrow / totalSupply;
      const borrowApy = Math.abs(pool.apyBaseBorrow || 0) + Math.abs(pool.apyRewardBorrow || 0);
      const supplyApy = pool.apy || 0;
      const pressure = calcLiquidationPressure(utilizationRate, borrowApy);
      const atRisk = estimateAtRiskValue(totalBorrow, utilizationRate, pool.ltv);

      if (atRisk < minValueUsd && pressure === "low") continue;

      const distanceToStress = Math.max(0, (0.9 - utilizationRate) * 100);

      levels.push({
        protocol: pool.project || "Unknown",
        chain: pool.chain || "Unknown",
        asset,
        pool_symbol: pool.symbol || "Unknown",
        total_supplied_usd: Math.round(totalSupply),
        total_borrowed_usd: Math.round(totalBorrow),
        utilization_rate: parseFloat((utilizationRate * 100).toFixed(2)),
        ltv: pool.ltv ? parseFloat((pool.ltv * 100).toFixed(1)) : null,
        borrow_apy: parseFloat(borrowApy.toFixed(2)),
        borrow_apy_base: pool.apyBaseBorrow ? parseFloat(pool.apyBaseBorrow.toFixed(2)) : null,
        borrow_apy_reward: pool.apyRewardBorrow ? parseFloat(pool.apyRewardBorrow.toFixed(2)) : null,
        supply_apy: parseFloat(supplyApy.toFixed(2)),
        liquidation_pressure: pressure,
        estimated_at_risk_usd: Math.round(atRisk),
        distance_to_stress_percent: parseFloat(distanceToStress.toFixed(2)),
      });
    }

    // Sort: critical first, then by at-risk value descending
    const pressureOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
    levels.sort((a, b) => {
      const pDiff = pressureOrder[a.liquidation_pressure] - pressureOrder[b.liquidation_pressure];
      if (pDiff !== 0) return pDiff;
      return b.estimated_at_risk_usd - a.estimated_at_risk_usd;
    });

    const results = levels.slice(0, limit);

    // Aggregate stats
    const totalAtRisk = levels.reduce((sum, l) => sum + l.estimated_at_risk_usd, 0);
    const criticalCount = levels.filter((l) => l.liquidation_pressure === "critical").length;
    const highCount = levels.filter((l) => l.liquidation_pressure === "high").length;

    return c.json({
      protocol: filterProtocol || "all",
      asset: filterAsset || "all",
      results: results.length,
      total_pools_analyzed: pools.length,
      aggregate: {
        total_estimated_at_risk_usd: totalAtRisk,
        critical_pools: criticalCount,
        high_risk_pools: highCount,
      },
      cached_until: new Date(Date.now() + CACHE_TTL).toISOString(),
      levels: results,
    });
  });
}
