import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import multer from 'multer';
import { Server } from 'socket.io';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { ApiManager } from '../core/apiManager.js';
import { buatChunkTeks, hitungEstimasiWaktu, validasiUkuranChunk } from '../utils/chunk.js';
import { prosesBatchTts } from '../core/ttsProcessor.js';
import { konversiKeMP3, konversiBatchKeMP3, cekFFmpegTersedia, setupFFmpeg, tampilkanPanduanInstallFFmpeg, cekCodecTersedia, autoMergeIfComplete, mergeAudioChunks, generateMergedFileName } from '../utils/audio.js';
import { ConfigTts, ApiKey, ChunkTeks } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Global API Manager
const apiManager = new ApiManager();

// Check FFmpeg availability on startup
let ffmpegAvailable = false;
let supportedCodecs = { mp3: false, ogg: false, aac: false };

(async () => {
  // Setup FFmpeg paths first
  await setupFFmpeg();
  
  // Then check availability
  ffmpegAvailable = await cekFFmpegTersedia();
  
  if (ffmpegAvailable) {
    // Check available codecs
    supportedCodecs = await cekCodecTersedia();
    console.log('🎵 FFmpeg tersedia dengan codec:', supportedCodecs);
  } else {
    console.log('⚠️  FFmpeg tidak tersedia - hanya format WAV yang didukung');
    tampilkanPanduanInstallFFmpeg();
  }
})();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      mediaSrc: ["'self'", "data:"],
    },
  },
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve audio files untuk preview dan download
app.use('/audio', express.static(path.join(process.cwd(), 'output')));

// Multer untuk file upload
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Hanya file text yang diizinkan!'));
    }
  }
});

// API Routes

/**
 * POST /api/setup-keys - Setup API keys
 */
app.post('/api/setup-keys', async (req, res) => {
  try {
    const { keys } = req.body;
    
    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'API keys harus berupa array dan tidak boleh kosong'
      });
    }

    // Reset dan tambahkan keys baru
    apiManager.resetApiKeys();
    keys.forEach(key => {
      if (key.trim()) {
        apiManager.tambahApiKey(key.trim());
      }
    });

    // Test API keys untuk mendapatkan status yang akurat
    const statusKeys = apiManager.dapatkanStatusKeys();
    const healthyCount = statusKeys.filter(k => k.sehat).length;
    
    res.json({
      success: true,
      total: keys.length,
      healthy: healthyCount,
      message: `${healthyCount}/${keys.length} API keys aktif`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Setup API keys gagal'
    });
  }
});

/**
 * GET /api/keys-status - Get status semua API keys
 */
app.get('/api/keys-status', (req, res) => {
  try {
    const statusKeys = apiManager.dapatkanStatusKeys();
    const stats = {
      total: statusKeys.length,
      healthy: statusKeys.filter(k => k.sehat).length,
      error: statusKeys.filter(k => !k.sehat).length,
      rateLimit: 0 // TODO: implement rate limit tracking
    };
    
    const keys = statusKeys.map(key => ({
      id: key.id.substring(0, 8) + '***',
      status: key.sehat ? 'healthy' : 'error'
    }));
    
    res.json({
      success: true,
      stats,
      keys
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error mendapatkan status keys'
    });
  }
});

/**
 * POST /api/convert - Convert text ke audio
 */
app.post('/api/convert', async (req, res) => {
  try {
    const { 
      text, 
      sessionId,
      chunkSize = 1000, 
      maxParallel = 4, 
      voice = 'zephyr', 
      temperature = 1,
      outputFormat = 'wav'
    } = req.body;

    console.log('🎤 Konversi dimulai dengan config:', {
      voice,
      chunkSize,
      maxParallel,
      temperature,
      outputFormat,
      textLength: text?.length
    });

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Text harus diisi dan berupa string'
      });
    }

    if (!validasiUkuranChunk(chunkSize)) {
      return res.status(400).json({
        success: false,
        error: 'Ukuran chunk tidak valid (1-10000 karakter)'
      });
    }

    const statusKeys = apiManager.dapatkanStatusKeys();
    const healthyCount = statusKeys.filter(k => k.sehat).length;
    
    if (healthyCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tidak ada API key yang sehat tersedia'
      });
    }

    // Validate output format
    if (outputFormat === 'mp3' && !ffmpegAvailable) {
      return res.status(400).json({
        success: false,
        error: 'MP3 format tidak tersedia - FFmpeg tidak ditemukan'
      });
    }

    const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Send initial response
    res.json({
      success: true,
      sessionId: finalSessionId,
      message: 'Konversi dimulai'
    });

    // Start async processing
    const config: ConfigTts = {
      ukuranChunk: chunkSize,
      maksimalParalel: Math.min(maxParallel, healthyCount),
      namaVoice: voice,
      temperatur: temperature
    };

    // Process asynchronously
    prosesTextAsync(finalSessionId, text, config, outputFormat);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error memulai konversi'
    });
  }
});

/**
 * POST /api/upload - Upload file text
 */
app.post('/api/upload', upload.single('textFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File tidak ditemukan'
      });
    }

    const fs = await import('fs/promises');
    const text = await fs.readFile(req.file.path, 'utf-8');
    
    // Cleanup uploaded file
    await fs.unlink(req.file.path);

    res.json({
      success: true,
      text,
      length: text.length,
      message: 'File berhasil diupload dan dibaca'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error membaca file',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/convert-mp3/:sessionId - Convert WAV files ke MP3
 */
app.post('/api/convert-mp3/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const outputDir = path.join(process.cwd(), 'output', sessionId);
    
    const fs = await import('fs');
    if (!fs.existsSync(outputDir)) {
      return res.status(404).json({
        success: false,
        message: 'Session tidak ditemukan'
      });
    }

    if (!ffmpegAvailable) {
      return res.status(400).json({
        success: false,
        message: 'FFmpeg tidak tersedia untuk konversi MP3'
      });
    }

    // Find all WAV files
    const files = fs.readdirSync(outputDir);
    const wavFiles = files.filter(f => f.endsWith('.wav')).map(f => path.join(outputDir, f));

    if (wavFiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tidak ada file WAV yang ditemukan'
      });
    }

    // Start conversion
    res.json({
      success: true,
      message: 'Konversi MP3 dimulai',
      totalFiles: wavFiles.length
    });

    // Convert asynchronously dengan WebSocket progress
    konversiMP3Async(sessionId, wavFiles);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error memulai konversi MP3',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/download/:filePath - Download individual audio file with flexible path handling
 */
app.get('/api/download/:filePath', async (req, res) => {
  try {
    const { filePath } = req.params;
    const decodedPath = decodeURIComponent(filePath);
    
    // Handle different path formats
    let finalPath;
    if (decodedPath.includes('/')) {
      // Path already includes session/filename structure
      finalPath = path.join(process.cwd(), 'output', decodedPath);
    } else {
      // Just filename, need to find in recent sessions
      const outputDir = path.join(process.cwd(), 'output');
      const fs = await import('fs');
      
      // Find file in any session directory
      const sessions = fs.readdirSync(outputDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      let foundPath = null;
      for (const session of sessions) {
        const testPath = path.join(outputDir, session, decodedPath);
        if (fs.existsSync(testPath)) {
          foundPath = testPath;
          break;
        }
      }
      
      if (!foundPath) {
        return res.status(404).json({
          success: false,
          error: 'File tidak ditemukan'
        });
      }
      
      finalPath = foundPath;
    }
    
    const fs = await import('fs');
    if (!fs.existsSync(finalPath)) {
      return res.status(404).json({
        success: false,
        error: 'File tidak ditemukan'
      });
    }

    // Detect file type
    const ext = path.extname(finalPath).toLowerCase();
    const contentType = ext === '.mp3' ? 'audio/mpeg' : 
                       ext === '.ogg' ? 'audio/ogg' : 'audio/wav';

    // Set headers untuk download
    const filename = path.basename(finalPath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    
    // Stream file
    const fileStream = fs.createReadStream(finalPath);
    fileStream.pipe(res);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Download gagal'
    });
  }
});

/**
 * GET /api/download-all/:sessionId - Download semua audio files sebagai ZIP
 */
app.get('/api/download-all/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { format = 'wav' } = req.query;
    const outputDir = path.join(process.cwd(), 'output', sessionId);
    
    const fs = await import('fs');
    if (!fs.existsSync(outputDir)) {
      return res.status(404).json({
        success: false,
        message: 'Session tidak ditemukan'
      });
    }

    // Import archiver untuk membuat ZIP
    const archiver = await import('archiver');
    const archive = archiver.default('zip', { zlib: { level: 9 } });

    // Set headers untuk download ZIP
    res.setHeader('Content-Disposition', `attachment; filename="audio_${sessionId}_${format}.zip"`);
    res.setHeader('Content-Type', 'application/zip');

    // Pipe archive ke response
    archive.pipe(res);

    // Add audio files sesuai format yang diminta
    const files = fs.readdirSync(outputDir);
    const audioFiles = files.filter(file => {
      if (format === 'mp3') {
        return file.endsWith('.mp3');
      } else {
        return file.endsWith('.wav') || file.endsWith('.mp3');
      }
    });

    audioFiles.forEach(file => {
      archive.file(path.join(outputDir, file), { name: file });
    });

    // Finalize archive
    await archive.finalize();

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating ZIP file',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/system-info - Get system capabilities
 */
app.get('/api/system-info', (req, res) => {
  const supportedFormats = ['wav'];
  
  if (ffmpegAvailable) {
    if (supportedCodecs.mp3) supportedFormats.push('mp3');
    if (supportedCodecs.ogg) supportedFormats.push('ogg');
  }
  
  res.json({
    success: true,
    formatCapabilities: {
      ffmpegAvailable: ffmpegAvailable,
      supportedFormats: supportedFormats,
      defaultFormat: 'wav',
      codecs: supportedCodecs
    },
    systemInfo: {
      maxFileSize: '10MB',
      maxChunkSize: 10000,
      maxParallelProcessing: 10
    }
  });
});

/**
 * POST /api/retry-chunks - Retry chunks yang error dengan API key berbeda
 */
app.post('/api/retry-chunks', async (req, res) => {
  try {
    const { 
      sessionId, 
      failedChunks, 
      config = {} 
    } = req.body;

    if (!sessionId || !failedChunks || !Array.isArray(failedChunks)) {
      return res.status(400).json({
        success: false,
        error: 'SessionId dan failedChunks harus diisi'
      });
    }

    const statusKeys = apiManager.dapatkanStatusKeys();
    const healthyKeys = statusKeys.filter(k => k.sehat);
    
    if (healthyKeys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tidak ada API key yang sehat tersedia untuk retry'
      });
    }

    // Rotate API keys untuk retry (gunakan key yang berbeda)
    const rotatedKeys = [...healthyKeys.slice(1), healthyKeys[0]];

    res.json({
      success: true,
      message: `Memulai retry ${failedChunks.length} chunks dengan API key berbeda`,
      sessionId: sessionId
    });

    // Process retry asynchronously
    prosesRetryAsync(sessionId, failedChunks, rotatedKeys, config);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error memulai retry'
    });
  }
});

/**
 * POST /api/merge-audio - Merge audio chunks menjadi satu file
 */
app.post('/api/merge-audio', async (req, res) => {
  try {
    const { 
      sessionId, 
      outputFormat = 'wav',
      filename 
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'SessionId harus diisi'
      });
    }

    if (!ffmpegAvailable) {
      return res.status(400).json({
        success: false,
        error: 'FFmpeg tidak tersedia - merge audio memerlukan FFmpeg'
      });
    }

    const outputDir = path.join(process.cwd(), 'output', sessionId);
    const fs = await import('fs');
    
    if (!fs.existsSync(outputDir)) {
      return res.status(404).json({
        success: false,
        error: 'Session tidak ditemukan'
      });
    }

    // Find all audio files in session directory
    const files = fs.readdirSync(outputDir);
    const audioFiles = files
      .filter(f => f.match(/audio_chunk_\d+/))
      .map(f => path.join(outputDir, f))
      .sort((a, b) => {
        const getChunkNumber = (filepath: string) => {
          const filename = path.basename(filepath);
          const match = filename.match(/chunk_(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        };
        return getChunkNumber(a) - getChunkNumber(b);
      });

    if (audioFiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tidak ada audio chunks yang ditemukan'
      });
    }

    // Generate merged file name
    const mergedFileName = filename || generateMergedFileName(sessionId, outputFormat as 'wav' | 'mp3');
    const mergedFilePath = path.join(outputDir, mergedFileName);

    // Send immediate response
    res.json({
      success: true,
      message: `Memulai merge ${audioFiles.length} audio chunks`,
      sessionId: sessionId,
      mergedFileName: mergedFileName
    });

    // Process merge asynchronously
    mergeAudioAsync(sessionId, audioFiles, mergedFilePath, outputFormat as 'wav' | 'mp3');

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error memulai merge'
    });
  }
});

/**
 * Async function untuk memproses text dengan real-time updates via WebSocket
 */
async function prosesTextAsync(sessionId: string, text: string, config: ConfigTts, outputFormat: string = 'wav') {
  const startTime = Date.now();
  
  try {
    // Emit start event
    io.emit('progress', { 
      sessionId, 
      overall: 0,
      chunk: 0,
      message: 'Memulai konversi...',
      stats: { completed: 0, total: 0, elapsed: 0 }
    });

    // Buat chunks
    const chunks = buatChunkTeks(text, config.ukuranChunk);
    io.emit('progress', { 
      sessionId, 
      overall: 5,
      chunk: 0,
      message: `Membuat ${chunks.length} chunks...`,
      stats: { completed: 0, total: chunks.length, elapsed: Date.now() - startTime }
    });

    // Setup progress tracking
    let prosesSelesai = 0;
    const onProgress = (progress: { selesai: number; total: number }) => {
      prosesSelesai = progress.selesai;
      const overallPercent = Math.round((progress.selesai / progress.total) * (outputFormat === 'mp3' ? 70 : 95));
      
      io.emit('progress', { 
        sessionId, 
        overall: overallPercent,
        chunk: Math.round((progress.selesai % 1) * 100),
        message: `Mengkonversi chunk ${progress.selesai}/${progress.total}...`,
        stats: { 
          completed: progress.selesai, 
          total: progress.total, 
          elapsed: Date.now() - startTime 
        }
      });
    };

    // Process dengan batch TTS
    const apiKeys = apiManager.dapatkanStatusKeys().filter(k => k.sehat);
    const outputDir = `./output/${sessionId}`;
    
    const hasil = await prosesBatchTts(
      chunks,
      apiKeys,
      config,
      outputDir,
      onProgress
    );

    const berhasil = hasil.filter(h => h.berhasil);
    const gagal = hasil.filter(h => !h.berhasil);

    // Send error details untuk failed chunks
    if (gagal.length > 0) {
      io.emit('chunks-failed', {
        sessionId,
        failedChunks: gagal.map(chunk => ({
          chunkId: chunk.chunkId,
          urutan: chunk.urutan,
          error: chunk.error,
          teks: chunks.find(c => c.id === chunk.chunkId)?.teks || '',
          canRetry: true
        }))
      });
    }

    // Konversi ke MP3 jika diminta
    if (outputFormat === 'mp3' && ffmpegAvailable && berhasil.length > 0) {
      io.emit('progress', { 
        sessionId, 
        overall: 70,
        chunk: 0,
        message: 'Mengkonversi ke MP3...',
        stats: { 
          completed: berhasil.length, 
          total: berhasil.length, 
          elapsed: Date.now() - startTime 
        }
      });
      
      const wavFiles = berhasil.map(h => h.namaFile);
      const mp3Results = await konversiBatchKeMP3(wavFiles, undefined, (completed, total) => {
        const overallPercent = 70 + Math.round((completed / total) * 25);
        io.emit('progress', {
          sessionId,
          overall: overallPercent,
          chunk: Math.round((completed / total) * 100),
          message: `Konversi MP3 ${completed}/${total}...`,
          stats: { 
            completed, 
            total, 
            elapsed: Date.now() - startTime 
          }
        });
      });

      // Update hasil dengan MP3 files
      berhasil.forEach((h, index) => {
        const mp3Result = mp3Results[index];
        if (mp3Result && mp3Result.success) {
          h.namaFile = mp3Result.mp3;
        }
      });
    }

    // Final progress update
    io.emit('progress', { 
      sessionId, 
      overall: 100,
      chunk: 100,
      message: 'Konversi selesai!',
      stats: { 
        completed: berhasil.length, 
        total: chunks.length, 
        elapsed: Date.now() - startTime 
      }
    });

    // Auto merge jika semua chunk berhasil dan FFmpeg tersedia
    let mergedFileInfo = null;
    if (gagal.length === 0 && berhasil.length > 1 && ffmpegAvailable) {
      io.emit('progress', { 
        sessionId, 
        overall: 100,
        chunk: 100,
        message: 'Memulai auto merge audio chunks...',
        stats: { 
          completed: berhasil.length, 
          total: chunks.length, 
          elapsed: Date.now() - startTime 
        }
      });

      try {
        const autoMergeResult = await autoMergeIfComplete(
          hasil, 
          outputDir, 
          sessionId, 
          outputFormat as 'wav' | 'mp3'
        );

        if (autoMergeResult.success && autoMergeResult.mergedFile) {
          const fs = require('fs');
          const stats = fs.statSync(autoMergeResult.mergedFile);
          const filename = path.basename(autoMergeResult.mergedFile);

          mergedFileInfo = {
            filename: filename,
            path: path.relative('./output', autoMergeResult.mergedFile),
            size: stats.size,
            format: outputFormat
          };

          io.emit('auto-merge-complete', {
            sessionId,
            mergedFile: mergedFileInfo,
            message: '✅ Auto merge berhasil! File audio telah digabung menjadi satu'
          });

          console.log(`🔗 Auto merge berhasil: ${autoMergeResult.mergedFile}`);
        }
      } catch (error) {
        console.warn('⚠️  Auto merge gagal:', error);
        io.emit('auto-merge-error', {
          sessionId,
          error: error instanceof Error ? error.message : 'Auto merge gagal'
        });
      }
    }

    // Prepare file info for frontend
    const files = berhasil.map(h => {
      const fs = require('fs');
      const stats = fs.statSync(h.namaFile);
      
      return {
        filename: path.basename(h.namaFile),
        path: path.basename(h.namaFile), // Simplified path for download
        size: stats.size,
        chunkIndex: h.urutan,
        apiKeyUsed: h.apiKeyUsed ? {
          displayName: h.apiKeyUsed.displayName,
          hitCount: h.apiKeyUsed.hitCount
        } : null
      };
    });

    // Send completion event
    io.emit('conversion-complete', {
      sessionId,
      files,
      mergedFile: mergedFileInfo, // Include merged file info if available
      stats: {
        totalChunks: chunks.length,
        successful: berhasil.length,
        failed: gagal.length,
        totalTime: Date.now() - startTime,
        outputFormat,
        autoMerged: mergedFileInfo !== null
      },
      failedChunks: gagal.length > 0 ? gagal.map(chunk => ({
        chunkId: chunk.chunkId,
        urutan: chunk.urutan,
        error: chunk.error,
        apiKeyUsed: chunk.apiKeyUsed ? {
          displayName: chunk.apiKeyUsed.displayName,
          hitCount: chunk.apiKeyUsed.hitCount
        } : null
      })) : undefined
    });

  } catch (error) {
    io.emit('conversion-error', {
      sessionId,
      error: error instanceof Error ? error.message : 'Konversi gagal'
    });
  }
}

/**
 * Async function untuk konversi MP3
 */
async function konversiMP3Async(sessionId: string, wavFiles: string[]) {
  try {
    const hasil = await konversiBatchKeMP3(wavFiles, undefined, (completed, total) => {
      const persen = Math.round((completed / total) * 100);
      io.emit('mp3-conversion-progress', {
        sessionId,
        completed,
        total,
        percentage: persen
      });
    });

    const berhasil = hasil.filter(h => h.success);
    const gagal = hasil.filter(h => !h.success);

    io.emit('mp3-conversion-complete', {
      sessionId,
      totalFiles: hasil.length,
      successful: berhasil.length,
      failed: gagal.length,
      files: hasil.map(h => ({
        original: path.basename(h.original),
        mp3: path.basename(h.mp3),
        success: h.success,
        error: h.error
      }))
    });

  } catch (error) {
    io.emit('mp3-conversion-error', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Async function untuk retry chunks yang gagal dengan API key berbeda
 */
async function prosesRetryAsync(
  sessionId: string, 
  failedChunks: any[], 
  apiKeys: ApiKey[], 
  retryConfig: any
) {
  const startTime = Date.now();
  
  try {
    io.emit('retry-started', {
      sessionId,
      retryCount: failedChunks.length,
      message: 'Memulai retry chunks yang gagal...'
    });

    // Buat chunk objects dari failed chunks dengan filter teks kosong
    const chunks: ChunkTeks[] = failedChunks
      .filter(fc => {
        const teks = fc.teks || fc.text || '';
        return teks.trim().length > 0; // Filter chunk kosong
      })
      .map(fc => ({
        id: fc.chunkId || `retry_${fc.urutan}_${Date.now()}`,
        teks: (fc.teks || fc.text || '').trim(),
        urutan: fc.urutan,
        total: failedChunks.length
      }));

    // Jika tidak ada chunk yang valid setelah filter
    if (chunks.length === 0) {
      io.emit('retry-error', {
        sessionId,
        error: 'Tidak ada chunk dengan teks yang valid untuk diretry'
      });
      return;
    }

    const config: ConfigTts = {
      ukuranChunk: retryConfig.chunkSize || 1000,
      maksimalParalel: Math.min(retryConfig.maxParallel || 2, apiKeys.length),
      namaVoice: retryConfig.voice || 'zephyr',
      temperatur: retryConfig.temperature || 1
    };

    // Setup progress tracking untuk retry
    let prosesSelesai = 0;
    const onProgress = (progress: { selesai: number; total: number }) => {
      prosesSelesai = progress.selesai;
      const persen = Math.round((progress.selesai / progress.total) * 100);
      
      io.emit('retry-progress', { 
        sessionId, 
        completed: progress.selesai,
        total: progress.total,
        percentage: persen,
        message: `Retry chunk ${progress.selesai}/${progress.total}...`
      });
    };

    const outputDir = `./output/${sessionId}`;
    
    const hasilRetry = await prosesBatchTts(
      chunks,
      apiKeys,
      config,
      outputDir,
      onProgress
    );

    const berhasilRetry = hasilRetry.filter(h => h.berhasil);
    const masihGagal = hasilRetry.filter(h => !h.berhasil);

    // Send retry completion
    io.emit('retry-complete', {
      sessionId,
      stats: {
        totalRetried: chunks.length,
        successful: berhasilRetry.length,
        stillFailed: masihGagal.length,
        retryTime: Date.now() - startTime
      },
      newlySuccessful: berhasilRetry.map(chunk => ({
        chunkId: chunk.chunkId,
        urutan: chunk.urutan,
        namaFile: chunk.namaFile,
        ukuranFile: chunk.ukuranFile,
        apiKeyUsed: chunk.apiKeyUsed ? {
          displayName: chunk.apiKeyUsed.displayName,
          hitCount: chunk.apiKeyUsed.hitCount
        } : null
      })),
      stillFailedChunks: masihGagal.length > 0 ? masihGagal.map(chunk => ({
        chunkId: chunk.chunkId,
        urutan: chunk.urutan,
        error: chunk.error,
        apiKeyUsed: chunk.apiKeyUsed ? {
          displayName: chunk.apiKeyUsed.displayName,
          hitCount: chunk.apiKeyUsed.hitCount
        } : null
      })) : undefined
    });

  } catch (error) {
    io.emit('retry-error', {
      sessionId,
      error: error instanceof Error ? error.message : 'Retry gagal'
    });
  }
}

/**
 * Async function untuk merge audio chunks dengan real-time updates
 */
async function mergeAudioAsync(
  sessionId: string,
  audioFiles: string[],
  outputPath: string,
  outputFormat: 'wav' | 'mp3'
) {
  const startTime = Date.now();
  
  try {
    io.emit('merge-started', {
      sessionId,
      totalFiles: audioFiles.length,
      outputFormat,
      message: `Memulai merge ${audioFiles.length} audio chunks...`
    });

    // Progress tracking untuk merge
    let lastPercent = 0;
    const progressInterval = setInterval(() => {
      // Simulate progress (FFmpeg progress akan override ini)
      lastPercent = Math.min(lastPercent + 10, 90);
      io.emit('merge-progress', {
        sessionId,
        percentage: lastPercent,
        message: `Merging audio... ${lastPercent}%`
      });
    }, 1000);

    // Merge audio chunks
    const mergedFile = await mergeAudioChunks(audioFiles, outputPath, outputFormat);
    
    clearInterval(progressInterval);

    // Get file stats
    const fs = require('fs');
    const stats = fs.statSync(mergedFile);
    const filename = path.basename(mergedFile);

    // Send completion event
    io.emit('merge-complete', {
      sessionId,
      mergedFile: {
        filename: filename,
        path: filename,
        size: stats.size,
        format: outputFormat
      },
      stats: {
        totalChunks: audioFiles.length,
        mergeTime: Date.now() - startTime,
        outputFormat
      }
    });

  } catch (error) {
    io.emit('merge-error', {
      sessionId,
      error: error instanceof Error ? error.message : 'Merge audio gagal'
    });
  }
}

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Serve main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan'
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🌐 TTS Multi-API Web Server running on port ${PORT}`);
  console.log(`📱 Open http://localhost:${PORT} in your browser`);
  console.log(`🔧 API endpoints available at http://localhost:${PORT}/api`);
}); 