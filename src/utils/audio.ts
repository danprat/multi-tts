import { writeFile } from 'fs/promises';
import mime from 'mime';
import { Buffer } from 'node:buffer';
import { OpsiKonversiWav } from '../types/index.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Dynamic import untuk FFmpeg dengan better error handling
async function getFfmpeg() {
  try {
    const ffmpegModule = await import('fluent-ffmpeg');
    return ffmpegModule.default;
  } catch (error) {
    console.warn('⚠️  fluent-ffmpeg module tidak ditemukan');
    return null;
  }
}

/**
 * Menyimpan file binary audio ke sistem
 */
export const simpanFileAudio = async (namaFile: string, content: Buffer): Promise<boolean> => {
  try {
    await writeFile(namaFile, content);
    return true;
  } catch (error) {
    console.error(`Error writing file ${namaFile}:`, error);
    return false;
  }
};

/**
 * Konversi data audio raw ke format WAV
 */
export const konversiKeWav = (dataRaw: string, mimeType: string): Buffer => {
  const opsi = parseMimeType(mimeType);
  const headerWav = buatHeaderWav(dataRaw.length, opsi);
  const buffer = Buffer.from(dataRaw, 'base64');

  return Buffer.concat([headerWav, buffer]);
};

/**
 * Parse MIME type untuk mendapatkan konfigurasi audio
 */
const parseMimeType = (mimeType: string): OpsiKonversiWav => {
  const [jenisFile, ...params] = mimeType.split(';').map(s => s.trim());
  const [_, format] = jenisFile.split('/');

  const opsi: Partial<OpsiKonversiWav> = {
    jumlahChannel: 1,
    sampleRate: 24000, // Default untuk Google GenAI
    bitsPerSample: 16   // Default untuk L16 format
  };

  // Handle L16 format dari Google GenAI
  if (format && format.startsWith('L')) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) {
      opsi.bitsPerSample = bits;
    }
  }

  // Parse parameters
  for (const param of params) {
    const [key, value] = param.split('=').map(s => s.trim());
    if (key === 'rate') {
      opsi.sampleRate = parseInt(value, 10);
    } else if (key === 'codec' && value === 'pcm') {
      // PCM codec confirmation
      opsi.bitsPerSample = opsi.bitsPerSample || 16;
    }
  }

  return opsi as OpsiKonversiWav;
};

/**
 * Membuat header WAV untuk file audio
 */
const buatHeaderWav = (panjangData: number, opsi: OpsiKonversiWav): Buffer => {
  const { jumlahChannel, sampleRate, bitsPerSample } = opsi;

  const byteRate = sampleRate * jumlahChannel * bitsPerSample / 8;
  const blockAlign = jumlahChannel * bitsPerSample / 8;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);                      // ChunkID
  buffer.writeUInt32LE(36 + panjangData, 4);    // ChunkSize
  buffer.write('WAVE', 8);                      // Format
  buffer.write('fmt ', 12);                     // Subchunk1ID
  buffer.writeUInt32LE(16, 16);                 // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20);                  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(jumlahChannel, 22);      // NumChannels
  buffer.writeUInt32LE(sampleRate, 24);         // SampleRate
  buffer.writeUInt32LE(byteRate, 28);           // ByteRate
  buffer.writeUInt16LE(blockAlign, 32);         // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);      // BitsPerSample
  buffer.write('data', 36);                     // Subchunk2ID
  buffer.writeUInt32LE(panjangData, 40);        // Subchunk2Size

  return buffer;
};

/**
 * Mendapatkan ekstensi file berdasarkan MIME type
 */
export const dapatkanEkstensiFile = (mimeType: string): string => {
  const ekstensi = mime.getExtension(mimeType);
  return ekstensi || 'wav';
};

/**
 * Generate nama file unik untuk audio output
 */
export const generateNamaFileAudio = (urutan: number, ekstensi: string = 'wav'): string => {
  const timestamp = Date.now();
  return `audio_chunk_${urutan.toString().padStart(3, '0')}_${timestamp}.${ekstensi}`;
};

/**
 * Validasi format audio yang didukung (by MIME type)
 */
export const validasiFormatAudioMime = (mimeType: string): boolean => {
  const formatDidukung = [
    'audio/wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/ogg',
    'audio/webm',
    'audio/L16', // Support untuk Google GenAI L16 PCM format
    'audio/pcm'  // Support untuk PCM format
  ];
  
  return formatDidukung.some(format => mimeType.includes(format));
};

/**
 * Validasi format file audio (by file path)
 */
export function validasiFormatAudio(filePath: string): boolean {
  const validFormats = ['.wav', '.mp3', '.ogg', '.m4a', '.flac'];
  const ext = path.extname(filePath).toLowerCase();
  return validFormats.includes(ext);
}

/**
 * Dapatkan MIME type dari file audio
 */
export function dapatkanMimeType(filePath: string): string {
  const mimeType = mime.getType(filePath);
  return mimeType || 'audio/wav';
}

/**
 * Cek apakah ffmpeg binary tersedia di sistem
 */
export async function cekFFmpegTersedia(): Promise<boolean> {
  try {
    // Method 1: Cek menggunakan fluent-ffmpeg
    const ffmpeg = await getFfmpeg();
    if (!ffmpeg) return false;

    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err: any, formats: any) => {
        if (err) {
          console.warn('⚠️  FFmpeg tidak tersedia via fluent-ffmpeg:', err.message);
          resolve(false);
        } else {
          console.log('✅ FFmpeg tersedia dan dapat digunakan');
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.warn('⚠️  Error checking FFmpeg:', error);
    
    // Method 2: Fallback ke command line check
    try {
      await execAsync('ffmpeg -version');
      console.log('✅ FFmpeg binary ditemukan di sistem');
      return true;
    } catch (cmdError) {
      console.warn('⚠️  FFmpeg binary tidak ditemukan di sistem');
      return false;
    }
  }
}

/**
 * Setup FFmpeg paths and configuration
 */
export async function setupFFmpeg(): Promise<void> {
  try {
    const ffmpeg = await getFfmpeg();
    if (!ffmpeg) return;

    // Coba cari FFmpeg di lokasi umum untuk macOS
    const commonPaths = [
      '/opt/homebrew/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/usr/bin/ffmpeg',
      'ffmpeg' // System PATH
    ];

    // Set path FFmpeg jika ditemukan
    for (const ffmpegPath of commonPaths) {
      try {
        ffmpeg.setFfmpegPath(ffmpegPath);
        console.log(`🔧 FFmpeg path set to: ${ffmpegPath}`);
        break;
      } catch (error) {
        continue;
      }
    }
  } catch (error) {
    console.warn('⚠️  Could not setup FFmpeg path:', error);
  }
}

/**
 * Konversi audio format dengan ffmpeg - versi yang diperbaiki
 */
export async function konversiKeMP3(inputPath: string, outputPath?: string): Promise<string> {
  const ffmpeg = await getFfmpeg();
  if (!ffmpeg) {
    throw new Error('FFmpeg tidak tersedia');
  }

  const finalOutputPath = outputPath || (() => {
    const dir = path.dirname(inputPath);
    const name = path.basename(inputPath, path.extname(inputPath));
    return path.join(dir, `${name}.mp3`);
  })();

  return new Promise((resolve, reject) => {
    // Setup FFmpeg command sesuai dokumentasi
    const command = ffmpeg(inputPath)
      .audioCodec('libmp3lame')  // Explicitly set MP3 codec
      .audioBitrate(128)
      .audioChannels(2)
      .audioFrequency(44100)     // Standard frequency
      .format('mp3')
      .outputOptions('-avoid_negative_ts make_zero');  // Handle timestamp issues

    // Event handlers sesuai dokumentasi
    command
      .on('start', (commandLine: string) => {
        console.log('🎵 Spawned FFmpeg with command:', commandLine);
      })
      .on('progress', (progress: any) => {
        if (progress.percent) {
          console.log('📊 Processing:', Math.round(progress.percent) + '% done');
        }
      })
      .on('stderr', (stderrLine: string) => {
        // Log stderr untuk debugging (optional)
        if (stderrLine.includes('error') || stderrLine.includes('Error')) {
          console.warn('FFmpeg stderr:', stderrLine);
        }
      })
      .on('end', () => {
        console.log('✅ Transcoding succeeded!');
        resolve(finalOutputPath);
      })
      .on('error', (err: any, stdout: any, stderr: any) => {
        console.error('❌ FFmpeg error:', err.message);
        if (stderr) {
          console.error('FFmpeg stderr:', stderr);
        }
        
        // Handle specific error cases
        if (err.message.includes('Cannot find ffmpeg')) {
          reject(new Error('FFmpeg binary tidak ditemukan. Install dengan: brew install ffmpeg'));
        } else if (err.message.includes('Invalid argument')) {
          reject(new Error('Format file input tidak didukung'));
        } else {
          reject(new Error(`Konversi MP3 gagal: ${err.message}`));
        }
      })
      .save(finalOutputPath);
  });
}

/**
 * Konversi ke format OGG (alternative open format)
 */
export async function konversiKeOGG(inputPath: string, outputPath?: string): Promise<string> {
  const ffmpeg = await getFfmpeg();
  if (!ffmpeg) {
    throw new Error('FFmpeg tidak tersedia');
  }

  const finalOutputPath = outputPath || (() => {
    const dir = path.dirname(inputPath);
    const name = path.basename(inputPath, path.extname(inputPath));
    return path.join(dir, `${name}.ogg`);
  })();

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libvorbis')   // OGG Vorbis codec
      .audioBitrate(128)
      .audioChannels(2)
      .audioFrequency(44100)
      .format('ogg')
      .on('start', (commandLine: string) => {
        console.log('🎵 Converting to OGG:', commandLine);
      })
      .on('progress', (progress: any) => {
        if (progress.percent) {
          console.log('📊 OGG Processing:', Math.round(progress.percent) + '% done');
        }
      })
      .on('end', () => {
        console.log('✅ OGG conversion succeeded!');
        resolve(finalOutputPath);
      })
      .on('error', (err: any) => {
        console.error('❌ OGG conversion error:', err.message);
        reject(new Error(`Konversi OGG gagal: ${err.message}`));
      })
      .save(finalOutputPath);
  });
}

/**
 * Konversi batch audio files ke format yang diminta
 */
export async function konversiBatchKeFormat(
  inputFiles: string[], 
  format: 'mp3' | 'ogg' = 'mp3',
  outputDir?: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{ original: string; converted: string; success: boolean; error?: string }[]> {
  const results = [];
  let completed = 0;

  // Setup FFmpeg paths
  await setupFFmpeg();

  for (const inputFile of inputFiles) {
    try {
      const outputPath = outputDir 
        ? path.join(outputDir, `${path.basename(inputFile, path.extname(inputFile))}.${format}`)
        : undefined;
      
      let convertedPath: string;
      
      if (format === 'mp3') {
        convertedPath = await konversiKeMP3(inputFile, outputPath);
      } else {
        convertedPath = await konversiKeOGG(inputFile, outputPath);
      }
      
      results.push({
        original: inputFile,
        converted: convertedPath,
        success: true
      });
    } catch (error) {
      results.push({
        original: inputFile,
        converted: inputFile, // Fallback ke file original
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    completed++;
    onProgress?.(completed, inputFiles.length);
  }

  return results;
}

// Backward compatibility
export async function konversiBatchKeMP3(
  inputFiles: string[], 
  outputDir?: string,
  onProgress?: (completed: number, total: number) => void
): Promise<{ original: string; mp3: string; success: boolean; error?: string }[]> {
  const results = await konversiBatchKeFormat(inputFiles, 'mp3', outputDir, onProgress);
  
  // Transform response untuk compatibility
  return results.map(result => ({
    original: result.original,
    mp3: result.converted,
    success: result.success,
    error: result.error
  }));
}

/**
 * Dapatkan informasi audio file menggunakan ffprobe
 */
export async function dapatkanInfoAudio(filePath: string): Promise<{
  format: string;
  duration?: number;
  bitrate?: number;
  size: number;
}> {
  try {
    const stats = await fs.stat(filePath);
    const ffmpeg = await getFfmpeg();
    
    if (!ffmpeg) {
      // Fallback to basic info
      const format = path.extname(filePath).slice(1).toLowerCase();
      return {
        format,
        size: stats.size
      };
    }
    
    // Try to get metadata using ffprobe
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err: any, metadata: any) => {
        if (err) {
          // Fallback to basic info
          const format = path.extname(filePath).slice(1).toLowerCase();
          resolve({
            format,
            size: stats.size
          });
        } else {
          resolve({
            format: metadata.format.format_name || path.extname(filePath).slice(1),
            duration: metadata.format.duration,
            bitrate: metadata.format.bit_rate ? parseInt(String(metadata.format.bit_rate)) : undefined,
            size: stats.size
          });
        }
      });
    });
  } catch (error) {
    throw new Error(`Gagal mendapatkan info audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Cek codec yang tersedia
 */
export async function cekCodecTersedia(): Promise<{ mp3: boolean; ogg: boolean; aac: boolean }> {
  const ffmpeg = await getFfmpeg();
  if (!ffmpeg) {
    return { mp3: false, ogg: false, aac: false };
  }

  return new Promise((resolve) => {
    ffmpeg.getAvailableCodecs((err: any, codecs: any) => {
      if (err) {
        console.warn('⚠️  Tidak dapat cek codec:', err.message);
        resolve({ mp3: false, ogg: false, aac: false });
      } else {
        resolve({
          mp3: !!codecs['libmp3lame'] || !!codecs['mp3'],
          ogg: !!codecs['libvorbis'] || !!codecs['vorbis'],
          aac: !!codecs['aac'] || !!codecs['libfdk_aac']
        });
      }
    });
  });
}

/**
 * Install FFmpeg guidance untuk user
 */
export function tampilkanPanduanInstallFFmpeg(): void {
  console.log('\n🔧 FFmpeg Installation Guide:');
  console.log('=====================================');
  console.log('macOS (Homebrew):');
  console.log('  brew install ffmpeg');
  console.log('');
  console.log('Ubuntu/Debian:');
  console.log('  sudo apt update && sudo apt install ffmpeg');
  console.log('');
  console.log('Windows:');
  console.log('  Download from: https://ffmpeg.org/download.html');
  console.log('  Or use chocolatey: choco install ffmpeg');
  console.log('');
  console.log('Verify installation:');
  console.log('  ffmpeg -version');
  console.log('=====================================\n');
}

/**
 * Cleanup audio files
 */
export async function cleanupAudioFiles(filePaths: string[]): Promise<void> {
  const promises = filePaths.map(async (filePath) => {
    try {
      await fs.unlink(filePath);
      console.log('🗑️  Deleted:', filePath);
    } catch (error) {
      console.warn('⚠️  Gagal delete file:', filePath, error);
    }
  });

  await Promise.all(promises);
}

/**
 * Merge/Join audio chunks berdasarkan urutan menjadi satu file
 */
export async function mergeAudioChunks(
  audioFiles: string[], 
  outputPath: string,
  outputFormat: 'wav' | 'mp3' = 'wav'
): Promise<string> {
  const ffmpeg = await getFfmpeg();
  if (!ffmpeg) {
    throw new Error('FFmpeg tidak tersedia - merge audio memerlukan FFmpeg');
  }

  // Sort files berdasarkan urutan chunk (berdasarkan nama file)
  const sortedFiles = audioFiles.sort((a, b) => {
    const getChunkNumber = (filepath: string) => {
      const filename = path.basename(filepath);
      const match = filename.match(/chunk_(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    return getChunkNumber(a) - getChunkNumber(b);
  });

  console.log(`🔗 Merging ${sortedFiles.length} audio chunks...`);
  console.log('📋 File order:', sortedFiles.map(f => path.basename(f)));

  return new Promise((resolve, reject) => {
    let command = ffmpeg();

    // Add input files in order
    sortedFiles.forEach(file => {
      command = command.input(file);
    });

    // Configure output based on format
    if (outputFormat === 'mp3') {
      command = command
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .audioChannels(2)
        .audioFrequency(44100)
        .format('mp3');
    } else {
      command = command
        .audioCodec('pcm_s16le')
        .audioChannels(2)
        .audioFrequency(44100)
        .format('wav');
    }

    // Use concat filter untuk seamless joining
    const filterComplex = sortedFiles.map((_, index) => `[${index}:a]`).join('') + 
                          `concat=n=${sortedFiles.length}:v=0:a=1[out]`;

    command
      .complexFilter(filterComplex)
      .outputOptions('-map [out]')
      .on('start', (commandLine: string) => {
        console.log('🎵 FFmpeg merge command:', commandLine);
      })
      .on('progress', (progress: any) => {
        if (progress.percent) {
          console.log(`📊 Merge progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log(`✅ Audio chunks merged successfully: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err: any) => {
        console.error('❌ Merge error:', err.message);
        reject(new Error(`Merge audio gagal: ${err.message}`));
      })
      .save(outputPath);
  });
}

/**
 * Generate nama file untuk merged audio
 */
export function generateMergedFileName(sessionId: string, format: 'wav' | 'mp3' = 'wav'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `merged_${sessionId}_${timestamp}.${format}`;
}

/**
 * Auto merge audio chunks jika semua berhasil
 */
export async function autoMergeIfComplete(
  audioResults: { chunkId: string; urutan: number; namaFile: string; berhasil: boolean }[],
  outputDir: string,
  sessionId: string,
  outputFormat: 'wav' | 'mp3' = 'wav'
): Promise<{ mergedFile?: string; success: boolean; error?: string }> {
  try {
    // Filter hanya yang berhasil
    const successfulChunks = audioResults.filter(result => result.berhasil && result.namaFile);
    
    if (successfulChunks.length === 0) {
      return { success: false, error: 'Tidak ada chunk audio yang berhasil' };
    }

    // Check apakah semua chunk berhasil (tidak ada yang gagal)
    const hasFailedChunks = audioResults.some(result => !result.berhasil);
    
    if (hasFailedChunks) {
      console.log('⚠️  Beberapa chunk gagal, skip auto merge');
      return { success: false, error: 'Tidak semua chunk berhasil diproses' };
    }

    // Ambil file paths dan sort by urutan
    const audioFiles = successfulChunks
      .sort((a, b) => a.urutan - b.urutan)
      .map(chunk => chunk.namaFile);

    // Generate output path
    const mergedFileName = generateMergedFileName(sessionId, outputFormat);
    const mergedFilePath = path.join(outputDir, mergedFileName);

    // Merge audio chunks
    await mergeAudioChunks(audioFiles, mergedFilePath, outputFormat);

    return { 
      mergedFile: mergedFilePath, 
      success: true 
    };

  } catch (error) {
    console.error('❌ Auto merge error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown merge error' 
    };
  }
}