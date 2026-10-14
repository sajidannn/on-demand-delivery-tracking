import { describe, it, expect } from 'vitest';
import { toLatLng, toLngLat, toLatLngArray } from './geo';

describe('geo coordinate conversions', () => {
  describe('toLatLng', () => {
    it('membalik [lng, lat] menjadi [lat, lng]', () => {
      // Jakarta: lng 107.6098, lat -6.9147
      expect(toLatLng([107.6098, -6.9147])).toEqual([-6.9147, 107.6098]);
    });

    it('menjaga urutan lat/lng tidak tertukar untuk nilai positif', () => {
      const [lat, lng] = toLatLng([10, 20]);
      expect(lat).toBe(20);
      expect(lng).toBe(10);
    });

    it('menangani nilai nol dan negatif', () => {
      expect(toLatLng([0, 0])).toEqual([0, 0]);
      expect(toLatLng([-120.5, 45.25])).toEqual([45.25, -120.5]);
    });
  });

  describe('toLngLat', () => {
    it('membalik [lat, lng] menjadi [lng, lat]', () => {
      expect(toLngLat([-6.9147, 107.6098])).toEqual([107.6098, -6.9147]);
    });

    it('merupakan kebalikan (inverse) dari toLatLng', () => {
      const lngLat: [number, number] = [107.6098, -6.9147];
      expect(toLngLat(toLatLng(lngLat))).toEqual(lngLat);
    });
  });

  describe('toLatLngArray', () => {
    it('mengonversi setiap pasangan [lng, lat] menjadi [lat, lng]', () => {
      const coords: [number, number][] = [
        [107.6098, -6.9147],
        [107.6186, -6.9034],
      ];
      expect(toLatLngArray(coords)).toEqual([
        [-6.9147, 107.6098],
        [-6.9034, 107.6186],
      ]);
    });

    it('mengembalikan array kosong untuk input kosong', () => {
      expect(toLatLngArray([])).toEqual([]);
    });

    it('tidak memutasi array sumber', () => {
      const coords: [number, number][] = [[107.6098, -6.9147]];
      const result = toLatLngArray(coords);
      expect(coords).toEqual([[107.6098, -6.9147]]);
      expect(result).not.toBe(coords);
    });
  });
});
