#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { mkdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { ApiManager } from './core/apiManager.js';
import { buatChunkTeks, hitungEstimasiWaktu, validasiUkuranChunk } from './utils/chunk.js';
import { prosesBatchTts } from './core/ttsProcessor.js';
import { ConfigTts } from './types/index.js';

const program = new Command();

/**
 * Main TTS Application Class
 */
class TtsMultiApiApp {
  private apiManager: ApiManager;
  private config: ConfigTts;

  constructor() {
    this.apiManager = new ApiManager();
    this.config = {
      temperatur: 1,
      namaVoice: 'Zephyr',
      ukuranChunk: 1000,
      maksimalParalel: 4
    };
  }

  /**
   * Setup API keys dari environment atau input
   */
  async setupApiKeys(keys?: string[]): Promise<void> {
    const spinner = ora('Setup API keys...').start();
    
    try {
      // Ambil dari parameter atau environment
      const apiKeys = keys || process.env.GEMINI_API_KEYS?.split(',') || [];
      
      if (apiKeys.length === 0) {
        spinner.fail('Tidak ada API keys yang ditemukan!');
        console.log(chalk.yellow('Gunakan: --keys "key1,key2,key3" atau set GEMINI_API_KEYS environment variable'));
        process.exit(1);
      }

      // Tambahkan semua keys ke manager
      apiKeys.forEach(key => {
        if (key.trim()) {
          this.apiManager.tambahApiKey(key.trim());
        }
      });

      const stats = this.apiManager.dapatkanStatistik();
      spinner.succeed(`Setup ${stats.total} API keys berhasil`);
      
      console.log(chalk.green(`✓ Total keys: ${stats.total}`));
      console.log(chalk.green(`✓ Keys sehat: ${stats.sehat}`));
      
    } catch (error) {
      spinner.fail('Gagal setup API keys');
      throw error;
    }
  }

  /**
   * Proses text ke speech dengan chunking dan parallel processing
   */
  async prosesTextKeAudio(
    inputText: string,
    outputDir: string = './output',
    options: Partial<ConfigTts> = {}
  ): Promise<void> {
    // Update config dengan options
    this.config = { ...this.config, ...options };
    
    // Validasi
    if (!validasiUkuranChunk(this.config.ukuranChunk)) {
      throw new Error('Ukuran chunk tidak valid (1-10000 karakter)');
    }

    // Pastikan output directory ada
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    console.log(chalk.blue('🎵 Memulai Text-to-Speech Processing...'));
    console.log(chalk.gray(`📝 Input: ${inputText.length} karakter`));
    console.log(chalk.gray(`📦 Ukuran chunk: ${this.config.ukuranChunk} karakter`));

    // Buat chunks
    const spinner = ora('Membuat chunks teks...').start();
    const chunks = buatChunkTeks(inputText, this.config.ukuranChunk);
    spinner.succeed(`Teks dibagi menjadi ${chunks.length} chunks`);

    // Hitung estimasi waktu
    const stats = this.apiManager.dapatkanStatistik();
    const estimasi = hitungEstimasiWaktu(chunks.length, stats.sehat);
    console.log(chalk.yellow(`⏱️  Estimasi waktu: ${Math.round(estimasi / 1000)} detik`));

    // Setup progress tracking
    let prosesSelesai = 0;
    const progressSpinner = ora('Memproses audio chunks...').start();
    
    const onProgress = (progress: { selesai: number; total: number }) => {
      prosesSelesai = progress.selesai;
      const persen = Math.round((progress.selesai / progress.total) * 100);
      progressSpinner.text = `Memproses chunks: ${progress.selesai}/${progress.total} (${persen}%)`;
    };

    try {
      // Proses dengan batch TTS
      const apiKeys = this.apiManager.dapatkanStatusKeys().filter(k => k.sehat);
      
      if (apiKeys.length === 0) {
        throw new Error('Tidak ada API key yang sehat tersedia');
      }

      const hasil = await prosesBatchTts(
        chunks,
        apiKeys,
        this.config,
        outputDir,
        onProgress
      );

      progressSpinner.succeed(`Selesai! ${hasil.length} file audio dihasilkan`);

      // Tampilkan ringkasan
      this.tampilkanRingkasan(hasil, outputDir);

    } catch (error) {
      progressSpinner.fail('Gagal memproses audio');
      throw error;
    }
  }

  /**
   * Tampilkan ringkasan hasil processing
   */
  private tampilkanRingkasan(hasil: any[], outputDir: string): void {
    const berhasil = hasil.filter(h => h.berhasil).length;
    const gagal = hasil.filter(h => !h.berhasil).length;
    const totalUkuran = hasil.reduce((sum, h) => sum + (h.ukuranFile || 0), 0);

    console.log(chalk.green('\n🎉 Processing selesai!'));
    console.log(chalk.white('📊 Ringkasan:'));
    console.log(chalk.green(`  ✓ Berhasil: ${berhasil} chunks`));
    
    if (gagal > 0) {
      console.log(chalk.red(`  ✗ Gagal: ${gagal} chunks`));
    }
    
    console.log(chalk.blue(`  💾 Total ukuran: ${Math.round(totalUkuran / 1024)} KB`));
    console.log(chalk.blue(`  📁 Output directory: ${outputDir}`));

    // Tampilkan error jika ada
    const errors = hasil.filter(h => !h.berhasil && h.error);
    if (errors.length > 0) {
      console.log(chalk.yellow('\n⚠️  Errors yang terjadi:'));
      errors.forEach(e => {
        console.log(chalk.red(`  - Chunk ${e.urutan}: ${e.error}`));
      });
    }
  }

  /**
   * Tampilkan status API keys
   */
  tampilkanStatusApiKeys(): void {
    const stats = this.apiManager.dapatkanStatistik();
    const keys = this.apiManager.dapatkanStatusKeys();

    console.log(chalk.blue('\n🔑 Status API Keys:'));
    console.log(chalk.white(`Total: ${stats.total} | Sehat: ${stats.sehat} | Bermasalah: ${stats.bermasalah}`));
    console.log(chalk.white(`Sedang digunakan: ${stats.sedangDigunakan} | Tersedia: ${stats.tersedia}`));

    keys.forEach((key, index) => {
      const status = key.sehat ? chalk.green('✓') : chalk.red('✗');
      const penggunaan = key.sedangDigunakan ? chalk.yellow('(digunakan)') : '';
      console.log(`  ${status} Key ${index + 1}: ${key.id} ${penggunaan}`);
    });
  }
}

/**
 * CLI Setup
 */
program
  .name('tts-multi-api')
  .description('Text-to-Speech dengan Multiple API Keys dan Parallel Processing')
  .version('1.0.0');

program
  .command('convert')
  .description('Konversi text ke audio')
  .option('-t, --text <text>', 'Text yang akan dikonversi')
  .option('-f, --file <file>', 'File text yang akan dikonversi')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-k, --keys <keys>', 'API keys (comma separated)')
  .option('-c, --chunk-size <size>', 'Ukuran chunk karakter', '1000')
  .option('-p, --parallel <count>', 'Maksimal parallel processing', '4')
  .option('-v, --voice <voice>', 'Nama voice', 'Zephyr')
  .option('-T, --temperature <temp>', 'Temperature (0-2)', '1')
  .action(async (options) => {
    try {
      const app = new TtsMultiApiApp();
      
      // Setup API keys
      const keys = options.keys ? options.keys.split(',') : undefined;
      await app.setupApiKeys(keys);

      // Dapatkan input text
      let inputText = '';
      if (options.text) {
        inputText = options.text;
      } else if (options.file) {
        if (!existsSync(options.file)) {
          console.error(chalk.red(`File tidak ditemukan: ${options.file}`));
          process.exit(1);
        }
        inputText = readFileSync(options.file, 'utf-8');
      } else {
        console.error(chalk.red('Harap berikan --text atau --file'));
        process.exit(1);
      }

      // Konfigurasi
      const config = {
        ukuranChunk: parseInt(options.chunkSize),
        maksimalParalel: parseInt(options.parallel),
        namaVoice: options.voice,
        temperatur: parseFloat(options.temperature),
      };

      // Proses
      await app.prosesTextKeAudio(inputText, options.output, config);
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Tampilkan status API keys')
  .option('-k, --keys <keys>', 'API keys (comma separated)')
  .action(async (options) => {
    try {
      const app = new TtsMultiApiApp();
      const keys = options.keys ? options.keys.split(',') : undefined;
      await app.setupApiKeys(keys);
      app.tampilkanStatusApiKeys();
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Parse dan jalankan
program.parse(); 