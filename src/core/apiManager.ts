import { ApiKey } from '../types/index.js';

/**
 * Mengelola API keys dan status kesehatan
 */
export class ApiManager {
  private apiKeys: ApiKey[] = [];
  private lastHealthCheck = 0;
  private healthCheckInterval = 60000; // 1 menit

  /**
   * Menambah API key baru
   */
  tambahApiKey(key: string): void {
    const keyDisplayName = this.createDisplayName(key);
    const apiKey: ApiKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      key,
      sehat: true,
      sedangDigunakan: false,
      totalHits: 0,
      lastUsed: undefined,
      keyDisplayName
    };
    
    this.apiKeys.push(apiKey);
  }

  /**
   * Membuat display name untuk API key (AIza...xyz)
   */
  private createDisplayName(key: string): string {
    if (key.length <= 8) return key;
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }

  /**
   * Mendapatkan API key yang tersedia untuk digunakan
   */
  dapatkanApiKeyTersedia(): ApiKey | null {
    this.lakukanHealthCheckJikaDiperlukan();
    
    const keyTersedia = this.apiKeys.find(key => 
      key.sehat && !key.sedangDigunakan
    );
    
    if (keyTersedia) {
      keyTersedia.sedangDigunakan = true;
    }
    
    return keyTersedia || null;
  }

  /**
   * Mengembalikan API key setelah selesai digunakan dengan tracking hit
   */
  kembalikanApiKey(keyId: string, berhasil: boolean = true): void {
    const key = this.apiKeys.find(k => k.id === keyId);
    if (key) {
      key.sedangDigunakan = false;
      if (berhasil) {
        key.totalHits = (key.totalHits || 0) + 1;
        key.lastUsed = new Date();
      }
    }
  }

  /**
   * Menandai API key sebagai bermasalah
   */
  tandaiKeyBermasalah(keyId: string): void {
    const key = this.apiKeys.find(k => k.id === keyId);
    if (key) {
      key.sehat = false;
      key.sedangDigunakan = false;
    }
  }

  /**
   * Mendapatkan jumlah API keys yang sehat
   */
  dapatkanJumlahKeySehat(): number {
    return this.apiKeys.filter(key => key.sehat).length;
  }

  /**
   * Mendapatkan maksimal proses paralel berdasarkan jumlah key sehat
   */
  dapatkanMaksimalParalel(): number {
    return this.dapatkanJumlahKeySehat();
  }

  /**
   * Health check periodik (simulasi)
   */
  private lakukanHealthCheckJikaDiperlukan(): void {
    const sekarang = Date.now();
    if (sekarang - this.lastHealthCheck > this.healthCheckInterval) {
      this.lakukanHealthCheck();
      this.lastHealthCheck = sekarang;
    }
  }

  /**
   * Simulasi health check - di real app bisa hit endpoint test
   */
  private lakukanHealthCheck(): void {
    // Reset status key yang mungkin sudah recovery
    this.apiKeys.forEach(key => {
      if (!key.sehat && Math.random() > 0.7) { // 30% chance recovery
        key.sehat = true;
      }
    });
  }

  /**
   * Mendapatkan status semua API keys
   */
  dapatkanStatusKeys(): ApiKey[] {
    return this.apiKeys.map(key => ({ ...key }));
  }

  /**
   * Reset semua API keys
   */
  resetApiKeys(): void {
    this.apiKeys = [];
  }

  /**
   * Mendapatkan statistik API keys
   */
  dapatkanStatistik() {
    const total = this.apiKeys.length;
    const sehat = this.apiKeys.filter(k => k.sehat).length;
    const sedangDigunakan = this.apiKeys.filter(k => k.sedangDigunakan).length;
    
    return {
      total,
      sehat,
      bermasalah: total - sehat,
      sedangDigunakan,
      tersedia: sehat - sedangDigunakan
    };
  }
} 