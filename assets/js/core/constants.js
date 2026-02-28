// Dev mode flag - Set to true for faster testing (10 sec days, 25k spheres, 10 gemhearts)
export const DEV_MODE = true; // Change to true for dev/testing

// Helper function to get DAY_MS based on DEV_MODE
export function getDAY_MS() {
    return DEV_MODE ? 10000 : 3600000;
}

// Espionage suspicion levels
export const SUSPICION_LEVELS = {
    UNKNOWN: 'unknown',
    KNOWN: 'known',
    SUSPICIOUS: 'suspicious',
    HOSTILE: 'hostile'
};

export const SUSPICION_THRESHOLDS = {
    unknown: 0,
    known: 25,
    suspicious: 60,
    hostile: 90
};

// Game constants
export const CONSTANTS = {
    get DAY_MS() {
        return getDAY_MS();
    },
    UI_UPDATE_RATE: 1000,
    DAYS_PER_YEAR: 168, // 7 months * 24 days
    DAYS_PER_MONTH: 24,
};

export const NPC_PRINCES = {
    sadeas: { name: "Sadeas", maxLand: 25, agents: 15, spheres: 15000, gemhearts: 2, provisions: 200, shardbearers: 2, power: 150, bridgecrews: 40, spearmen: 50, archers: 30, chulls: 5, fabrials: ["Gravity-Spanning Rig"], championLevel: 5, championHP: 6, championMaxHP: 8, championFabrials: ["Thrill Amplifier", "Half-Shard"] },
    vargo: { name: "Taravangian", maxLand: 25, agents: 50, spheres: 5000, gemhearts: 10, provisions: 500, shardbearers: 0, power: 40, bridgecrews: 10, spearmen: 10, archers: 5, chulls: 2, fabrials: ["Heatrial", "Ledger"], championLevel: 2, championHP: 4, championMaxHP: 5, championFabrials: ["Regeneration Plate"] },
    sebarial: { name: "Sebarial", maxLand: 25, agents: 10, spheres: 80000, gemhearts: 5, provisions: 1000, shardbearers: 0, power: 20, bridgecrews: 5, spearmen: 5, archers: 0, chulls: 50, fabrials: ["Ledger"], championLevel: 1, championHP: 3, championMaxHP: 4, championFabrials: [] },
    dalinar: { name: "Dalinar", maxLand: 25, agents: 20, spheres: 5000, gemhearts: 0, provisions: 100, shardbearers: 1, power: 120, bridgecrews: 20, spearmen: 40, archers: 20, chulls: 10, fabrials: ["Gravity-Spanning Rig", "Heatrial"], championLevel: 6, championHP: 9, championMaxHP: 9, championFabrials: ["Regeneration Plate", "Thrill Amplifier", "Half-Shard"] }
};

export const UNIT_STATS = {
    bridgecrews: { power: 0.1, survival: 0.25, carry: 0, speed: 0.01, cost: 5, provision: 1 },
    spearmen: { power: 1, survival: 0.75, carry: 0, speed: 0, cost: 10, provision: 1 },
    archers: { power: 1, survival: 0.9, carry: 0, speed: 0, protection: 0.06, cost: 15, provision: 1 }, // 6% * sqrt(count), cap 90%
    chulls: { power: 0.5, survival: 0.8, carry: 10, speed: -0.025, cost: 50, provision: 3 },
    shardbearers: { power: 0, survival: 0.99, carry: 0, speed: 0, multiplier: 2.0, cost: 0, gemheartCost: 1, provision: 3 },
    noble: { power: 0, survival: 0.5, cost: 50, spy: 1, provision: 2 },
    spy: { power: 0, survival: 0.7, cost: 150, spy: 2, provision: 2 },
    ghostblood: { power: 0, survival: 0.9, cost: 600, spy: 5, provision: 3 }
};

export const BUILDING_DATA = {
    soulcaster: { baseCost: 150, cap: 50, income: 0, powerMod: 0, survivalMod: 0, scale: 'exponential', landCost: 1 },
    market: { baseCost: 250, cap: 0, income: 400, powerMod: 0, survivalMod: 0, scale: 'exponential', landCost: 1 },
    training_camp: { baseCost: 7000, cap: 0, income: 0, powerMod: 0.1, survivalMod: 0, scale: 'linear', landCost: 5 },
    monastery: { baseCost: 7000, cap: 0, income: 0, powerMod: 0, survivalMod: 0.05, scale: 'linear', upkeep: 50, landCost: 5 },
    spy_network: { baseCost: 5000, cap: 0, income: 0, powerMod: 0, survivalMod: 0, max: 1, upkeep: 75, landCost: 5 },
    research_library: { baseCost: 10000, cap: 0, income: 0, powerMod: 0, survivalMod: 0, max: 1, landCost: 5 },
    shelter: { baseCost: 100, cap: 10, income: 0, powerMod: 0, survivalMod: 0, landCost: 0 },
    stormshelter: { baseCost: 500, cap: 0, income: 0, powerMod: 0, survivalMod: 0, upkeep: 25, landCost: 1 },
    whisper_tower: { baseCost: 0, ghostbloodCost: 10, cap: 0, income: 0, powerMod: 0, survivalMod: 0, max: 1, special: 'detection_and_spy_power', landCost: 5 }
};

export const FABRIAL_DATA = {
    heatrial: { cost: 3, name: "Heatrial System" },
    ledger: { cost: 3, name: "Synchronized Ledger" },
    gravity_lift: { cost: 5, name: "Gravity-Spanning Rig" },
    regen_plate: { cost: 1, name: "Regeneration Plate", arena: true },
    thrill_amp: { cost: 2, name: "Thrill Amplifier", arena: true },
    half_shard: { cost: 4, name: "Half-Shard", arena: true }
};
