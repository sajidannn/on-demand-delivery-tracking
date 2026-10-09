export interface FeeConfig {
  base: number;
  perKm: number;
  min: number;
  round: number;
}

export function calculateFee(distanceM: number, config: FeeConfig): number {
  if (distanceM <= 0) {
    throw new Error('Distance must be strictly greater than 0');
  }

  const distanceKm = distanceM / 1000;
  let rawFee = config.base + distanceKm * config.perKm;

  if (rawFee < config.min) {
    rawFee = config.min;
  }

  return Math.ceil(rawFee / config.round) * config.round;
}
