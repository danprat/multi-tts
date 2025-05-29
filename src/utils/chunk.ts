import { ChunkTeks } from '../types/index.js';

/**
 * Membagi teks menjadi chunks berdasarkan ukuran karakter dengan mempertahankan kalimat utuh
 */
export const buatChunkTeks = (teks: string, ukuranChunk: number): ChunkTeks[] => {
  if (!teks.trim()) return [];
  if (ukuranChunk <= 0) return [];

  const teksBersih = teks.trim();
  const chunks: ChunkTeks[] = [];
  
  // Split berdasarkan kalimat dengan tetap mempertahankan tanda baca
  const kalimatRegex = /[.!?]+\s*/g;
  const kalimatArray: string[] = [];
  
  let lastIndex = 0;
  let match;
  
  while ((match = kalimatRegex.exec(teksBersih)) !== null) {
    const kalimatLengkap = teksBersih.substring(lastIndex, match.index + match[0].length).trim();
    if (kalimatLengkap) {
      kalimatArray.push(kalimatLengkap);
    }
    lastIndex = match.index + match[0].length;
  }
  
  // Tambahkan sisa teks jika ada (tanpa tanda akhir kalimat)
  if (lastIndex < teksBersih.length) {
    const sisaTeks = teksBersih.substring(lastIndex).trim();
    if (sisaTeks) {
      kalimatArray.push(sisaTeks);
    }
  }
  
  // Jika tidak ada kalimat yang ditemukan, treat sebagai satu chunk
  if (kalimatArray.length === 0) {
    kalimatArray.push(teksBersih);
  }
  
  let chunkSaatIni = '';
  let urutanChunk = 0;
  
  for (const kalimat of kalimatArray) {
    const kalimatBersih = kalimat.trim();
    if (!kalimatBersih) continue;
    
    // Cek apakah menambahkan kalimat ini akan melebihi ukuran chunk
    const chunkBaruPotensial = chunkSaatIni ? `${chunkSaatIni} ${kalimatBersih}` : kalimatBersih;
    
    if (chunkBaruPotensial.length > ukuranChunk) {
      // Simpan chunk saat ini jika tidak kosong
      if (chunkSaatIni.trim()) {
        chunks.push(buatObjekChunk(chunkSaatIni.trim(), urutanChunk, 0));
        urutanChunk++;
      }
      
      // Jika kalimat tunggal terlalu panjang, split dengan algoritma yang lebih pintar
      if (kalimatBersih.length > ukuranChunk) {
        const subChunks = splitKalimatPanjang(kalimatBersih, ukuranChunk);
        subChunks.forEach(subChunk => {
          chunks.push(buatObjekChunk(subChunk.trim(), urutanChunk, 0));
          urutanChunk++;
        });
        chunkSaatIni = '';
      } else {
        chunkSaatIni = kalimatBersih;
      }
    } else {
      chunkSaatIni = chunkBaruPotensial;
    }
  }
  
  // Simpan chunk terakhir jika ada
  if (chunkSaatIni.trim()) {
    chunks.push(buatObjekChunk(chunkSaatIni.trim(), urutanChunk, 0));
  }
  
  // Update total di semua chunks
  return chunks.map(chunk => ({ ...chunk, total: chunks.length }));
};

/**
 * Split kalimat panjang dengan mempertahankan kata utuh
 */
const splitKalimatPanjang = (kalimat: string, ukuranMaksimal: number): string[] => {
  const hasil: string[] = [];
  const kata = kalimat.split(/\s+/);
  
  let chunkSaatIni = '';
  
  for (const kataSaatIni of kata) {
    const chunkBaruPotensial = chunkSaatIni ? `${chunkSaatIni} ${kataSaatIni}` : kataSaatIni;
    
    if (chunkBaruPotensial.length > ukuranMaksimal) {
      // Simpan chunk saat ini jika tidak kosong
      if (chunkSaatIni.trim()) {
        hasil.push(chunkSaatIni.trim());
      }
      
      // Jika kata tunggal terlalu panjang, paksa split
      if (kataSaatIni.length > ukuranMaksimal) {
        const subKata = paksaSplitTeks(kataSaatIni, ukuranMaksimal);
        hasil.push(...subKata);
        chunkSaatIni = '';
      } else {
        chunkSaatIni = kataSaatIni;
      }
    } else {
      chunkSaatIni = chunkBaruPotensial;
    }
  }
  
  // Simpan chunk terakhir
  if (chunkSaatIni.trim()) {
    hasil.push(chunkSaatIni.trim());
  }
  
  return hasil;
};

/**
 * Helper function untuk split paksa teks yang terlalu panjang
 */
const paksaSplitTeks = (teks: string, ukuranMaksimal: number): string[] => {
  const hasil: string[] = [];
  let indeksMulai = 0;
  
  while (indeksMulai < teks.length) {
    const akhir = Math.min(indeksMulai + ukuranMaksimal, teks.length);
    hasil.push(teks.substring(indeksMulai, akhir));
    indeksMulai = akhir;
  }
  
  return hasil;
};

/**
 * Helper function untuk membuat objek chunk
 */
const buatObjekChunk = (teks: string, urutan: number, total: number): ChunkTeks => ({
  id: `chunk_${urutan}_${Date.now()}`,
  teks,
  urutan,
  total
});

/**
 * Menghitung estimasi waktu berdasarkan jumlah chunk dan API keys
 */
export const hitungEstimasiWaktu = (
  jumlahChunk: number, 
  jumlahApiKey: number, 
  waktuPerChunk: number = 3000
): number => {
  if (jumlahApiKey === 0) return 0;
  
  const chunkPerKey = Math.ceil(jumlahChunk / jumlahApiKey);
  return chunkPerKey * waktuPerChunk;
};

/**
 * Validate ukuran chunk
 */
export const validasiUkuranChunk = (ukuran: number): boolean => {
  return ukuran > 0 && ukuran <= 10000; // Maksimal 10k karakter per chunk
}; 