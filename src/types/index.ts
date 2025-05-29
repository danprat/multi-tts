export interface ConfigTts {
  temperatur: number;
  namaVoice: string;
  ukuranChunk: number;
  maksimalParalel: number;
}

export interface ApiKey {
  id: string;
  key: string;
  sehat: boolean;
  sedangDigunakan: boolean;
}

export interface ChunkTeks {
  id: string;
  teks: string;
  urutan: number;
  total: number;
}

export interface HasilAudio {
  chunkId: string;
  urutan: number;
  namaFile: string;
  ukuranFile: number;
  berhasil: boolean;
  error?: string;
}

export interface OpsiKonversiWav {
  jumlahChannel: number;
  sampleRate: number;
  bitsPerSample: number;
}

export interface StatusProses {
  total: number;
  selesai: number;
  gagal: number;
  sedangProses: number;
}

export type FunctionPembuatChunk = (teks: string, ukuran: number) => ChunkTeks[];
export type FunctionProsesTts = (chunk: ChunkTeks, apiKey: ApiKey, config: ConfigTts) => Promise<HasilAudio>;
export type FunctionManajemenKey = (keys: ApiKey[]) => ApiKey[]; 