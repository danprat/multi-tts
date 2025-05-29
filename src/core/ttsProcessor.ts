import { GoogleGenAI } from '@google/genai';
import { ChunkTeks, ApiKey, ConfigTts, HasilAudio } from '../types/index.js';
import { simpanFileAudio, konversiKeWav, dapatkanEkstensiFile, generateNamaFileAudio, validasiFormatAudioMime } from '../utils/audio.js';

/**
 * Processor utama untuk konversi text ke speech
 */
export const prosesTtsChunk = async (
  chunk: ChunkTeks,
  apiKey: ApiKey,
  config: ConfigTts,
  outputDir: string = './output'
): Promise<HasilAudio> => {
  try {
    // Pastikan output directory ada
    const fs = await import('fs/promises');
    await fs.mkdir(outputDir, { recursive: true });

    const ai = new GoogleGenAI({
      apiKey: apiKey.key,
    });

    const modelConfig = buatKonfigurasiModel(config);
    const contents = buatContentsRequest(chunk.teks);
    
    console.log(`🔑 Menggunakan API Key: ${apiKey.keyDisplayName} (Hit #${(apiKey.totalHits || 0) + 1}) untuk chunk ${chunk.urutan}`);
    
    const response = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-preview-tts',
      config: modelConfig,
      contents,
    });

    const hasilAudio = await prosesStreamResponse(response, chunk, outputDir);
    
    return {
      chunkId: chunk.id,
      urutan: chunk.urutan,
      namaFile: hasilAudio.namaFile,
      ukuranFile: hasilAudio.ukuranFile,
      berhasil: true,
      apiKeyUsed: {
        id: apiKey.id,
        displayName: apiKey.keyDisplayName || 'Unknown',
        hitCount: (apiKey.totalHits || 0) + 1
      }
    };

  } catch (error) {
    console.error(`❌ Error processing chunk ${chunk.id} dengan API Key ${apiKey.keyDisplayName}:`, error);
    
    return {
      chunkId: chunk.id,
      urutan: chunk.urutan,
      namaFile: '',
      ukuranFile: 0,
      berhasil: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      apiKeyUsed: {
        id: apiKey.id,
        displayName: apiKey.keyDisplayName || 'Unknown',
        hitCount: (apiKey.totalHits || 0) + 1
      }
    };
  }
};

/**
 * Membuat konfigurasi model berdasarkan config TTS
 */
const buatKonfigurasiModel = (config: ConfigTts) => ({
  temperature: config.temperatur,
  responseModalities: ['audio'],
  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: config.namaVoice,
      }
    }
  },
});

/**
 * Membuat contents request untuk API
 */
const buatContentsRequest = (teks: string) => [
  {
    role: 'user',
    parts: [
      {
        text: teks,
      },
    ],
  },
];

/**
 * Memproses stream response dari API dan menyimpan audio
 */
const prosesStreamResponse = async (
  response: any,
  chunk: ChunkTeks,
  outputDir: string
): Promise<{ namaFile: string; ukuranFile: number }> => {
  let fileIndex = 0;
  let totalUkuran = 0;
  let namaFileTerakhir = '';

  for await (const responseChunk of response) {
    if (!responseChunk.candidates || !responseChunk.candidates[0].content || !responseChunk.candidates[0].content.parts) {
      continue;
    }

    if (responseChunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
      const inlineData = responseChunk.candidates[0].content.parts[0].inlineData;
      const mimeType = inlineData.mimeType || 'audio/wav';
      
      console.log(`🎵 Menerima audio chunk: ${mimeType}`);
      
      if (!validasiFormatAudioMime(mimeType)) {
        console.warn(`Format audio tidak didukung: ${mimeType}`);
        continue;
      }

      let buffer = Buffer.from(inlineData.data || '', 'base64');
      let ekstensiFile = dapatkanEkstensiFile(mimeType);

      // Konversi ke WAV jika diperlukan untuk format L16/PCM
      if (!ekstensiFile || mimeType.includes('L16') || mimeType.includes('pcm')) {
        console.log(`🔄 Konversi ${mimeType} ke WAV`);
        ekstensiFile = 'wav';
        buffer = konversiKeWav(inlineData.data || '', mimeType);
      }

      const namaFile = `${outputDir}/${generateNamaFileAudio(chunk.urutan, ekstensiFile)}`;
      const berhasilSimpan = await simpanFileAudio(namaFile, buffer);
      
      if (berhasilSimpan) {
        console.log(`✅ Audio chunk disimpan: ${namaFile} (${buffer.length} bytes)`);
        totalUkuran += buffer.length;
        namaFileTerakhir = namaFile;
        fileIndex++;
      }
    }
  }

  return {
    namaFile: namaFileTerakhir,
    ukuranFile: totalUkuran
  };
};

/**
 * Batch processing untuk multiple chunks secara paralel
 */
export const prosesBatchTts = async (
  chunks: ChunkTeks[],
  apiKeys: ApiKey[],
  config: ConfigTts,
  outputDir: string = './output',
  onProgress?: (progress: { selesai: number; total: number }) => void
): Promise<HasilAudio[]> => {
  const maksimalParalel = Math.min(config.maksimalParalel, apiKeys.length);
  const hasil: HasilAudio[] = [];
  let indeksChunk = 0;

  // Buat worker pools
  const workers = Array.from({ length: maksimalParalel }, async (_, workerIndex) => {
    const hasilWorker: HasilAudio[] = [];
    
    while (indeksChunk < chunks.length) {
      const currentChunkIndex = indeksChunk++;
      const chunk = chunks[currentChunkIndex];
      const apiKey = apiKeys[workerIndex % apiKeys.length];
      
      if (!apiKey || !apiKey.sehat) {
        continue;
      }

      const hasilChunk = await prosesTtsChunk(chunk, apiKey, config, outputDir);
      hasilWorker.push(hasilChunk);
      
      // Report progress
      if (onProgress) {
        onProgress({
          selesai: hasil.length + hasilWorker.length,
          total: chunks.length
        });
      }
    }
    
    return hasilWorker;
  });

  // Tunggu semua workers selesai
  const allResults = await Promise.all(workers);
  
  // Gabungkan hasil dari semua workers
  return allResults.flat().sort((a, b) => a.urutan - b.urutan);
}; 