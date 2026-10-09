import { describe, expect, it } from 'vitest';
import { calculateFee, FeeConfig } from './fee-calculator.js';

describe('FeeCalculator', () => {
  const config: FeeConfig = {
    base: 5000,
    perKm: 2500,
    min: 10000,
    round: 500,
  };

  it('1: Jarak pendek, kena harga minimum (1.5 km)', () => {
    // 5000 + (1.5 * 2500) = 8750 -> min 10000 -> ceil(10000/500)*500 = 10000
    expect(calculateFee(1500, config)).toBe(10000);
  });

  it('2: Jarak sedang, pembulatan ke atas (2.1 km)', () => {
    // 5000 + (2.1 * 2500) = 10250 -> min ok -> ceil(10250/500)*500 = 10500
    expect(calculateFee(2100, config)).toBe(10500);
  });

  it('3: Pas pembulatan (2.2 km)', () => {
    // 5000 + (2.2 * 2500) = 10500 -> min ok -> ceil(10500/500)*500 = 10500
    expect(calculateFee(2200, config)).toBe(10500);
  });

  it('4: Jarak sedang, pembulatan jauh (2.3 km)', () => {
    // 5000 + (2.3 * 2500) = 10750 -> min ok -> ceil(10750/500)*500 = 11000
    expect(calculateFee(2300, config)).toBe(11000);
  });

  it('5: Jarak jauh (10 km)', () => {
    // 5000 + (10 * 2500) = 30000 -> min ok -> ceil(30000/500)*500 = 30000
    expect(calculateFee(10000, config)).toBe(30000);
  });

  it('6: Menolak jarak nol atau negatif', () => {
    expect(() => calculateFee(0, config)).toThrow('Distance must be strictly greater than 0');
    expect(() => calculateFee(-100, config)).toThrow('Distance must be strictly greater than 0');
  });
});
