import { describe, it, expect } from 'vitest';
import { buatChunkTeks, hitungEstimasiWaktu, validasiUkuranChunk } from '../utils/chunk.js';

describe('Chunk Utils', () => {
  describe('buatChunkTeks', () => {
    it('should create chunks from text', () => {
      const teks = 'Ini adalah kalimat pertama. Ini adalah kalimat kedua. Ini adalah kalimat ketiga.';
      const chunks = buatChunkTeks(teks, 30);
      
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].urutan).toBe(0);
      expect(chunks[0].total).toBe(chunks.length);
    });

    it('should handle empty text', () => {
      const chunks = buatChunkTeks('', 100);
      expect(chunks).toHaveLength(0);
    });

    it('should handle single sentence', () => {
      const teks = 'Ini adalah satu kalimat saja.';
      const chunks = buatChunkTeks(teks, 100);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].teks).toBe('Ini adalah satu kalimat saja');
    });

    it('should split long sentences when needed', () => {
      const teksLong = 'A'.repeat(1000);
      const chunks = buatChunkTeks(teksLong, 100);
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.teks.length).toBeLessThanOrEqual(100);
      });
    });

    it('should maintain chunk sequence', () => {
      const teks = 'Kalimat pertama. Kalimat kedua. Kalimat ketiga. Kalimat keempat.';
      const chunks = buatChunkTeks(teks, 25);
      
      chunks.forEach((chunk, index) => {
        expect(chunk.urutan).toBe(index);
        expect(chunk.total).toBe(chunks.length);
        expect(chunk.id).toContain('chunk_');
      });
    });
  });

  describe('hitungEstimasiWaktu', () => {
    it('should calculate time estimation correctly', () => {
      const estimasi = hitungEstimasiWaktu(10, 2, 1000);
      expect(estimasi).toBe(5000); // 10 chunks / 2 keys * 1000ms
    });

    it('should handle zero API keys', () => {
      const estimasi = hitungEstimasiWaktu(10, 0);
      expect(estimasi).toBe(0);
    });

    it('should handle more keys than chunks', () => {
      const estimasi = hitungEstimasiWaktu(2, 5, 1000);
      expect(estimasi).toBe(1000); // 1 chunk per key max
    });
  });

  describe('validasiUkuranChunk', () => {
    it('should validate chunk sizes correctly', () => {
      expect(validasiUkuranChunk(500)).toBe(true);
      expect(validasiUkuranChunk(1000)).toBe(true);
      expect(validasiUkuranChunk(10000)).toBe(true);
      
      expect(validasiUkuranChunk(0)).toBe(false);
      expect(validasiUkuranChunk(-1)).toBe(false);
      expect(validasiUkuranChunk(10001)).toBe(false);
    });
  });
}); 