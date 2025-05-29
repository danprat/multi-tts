# 🎙️ Multi TTS - Text-to-Speech dengan Multiple API

Aplikasi Text-to-Speech yang canggih dengan dukungan multiple API key, chunking otomatis, retry mechanism, dan merge audio untuk hasil yang optimal.

![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## ✨ Fitur Utama

### 🚀 **Konversi TTS Canggih**
- **Multiple API Support**: Gunakan beberapa API key secara bersamaan untuk performa optimal
- **Smart Chunking**: Membagi teks menjadi chunks dengan mempertahankan kalimat utuh
- **Parallel Processing**: Proses multiple chunks secara bersamaan
- **Auto Retry**: Retry otomatis untuk chunks yang gagal dengan API key berbeda

### 🔧 **Audio Processing**
- **Format Support**: WAV (default), MP3, OGG (dengan FFmpeg)
- **Auto Merge**: Gabung audio chunks secara otomatis menjadi satu file
- **Manual Merge**: Tombol merge manual jika auto merge gagal
- **High Quality**: Output audio berkualitas tinggi 24kHz

### 🌐 **Web Interface**
- **Real-time Progress**: Progress bar dan status update secara real-time
- **Drag & Drop**: Upload file teks dengan drag & drop
- **Download Individual**: Download file audio per chunk
- **Download All**: Download semua file sebagai ZIP

### 🛡️ **Robust Error Handling**
- **Smart Error Detection**: Deteksi dan filter chunk kosong
- **Retry Mechanism**: Retry chunks gagal dengan API key berbeda
- **Error Display**: Tampilkan chunks yang gagal dengan detail error
- **Fallback Options**: Opsi fallback jika auto merge gagal

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm atau yarn
- FFmpeg (opsional, untuk format MP3/OGG)

### Installation

1. **Clone repository**
```bash
git clone https://github.com/danprat/multi-tts.git
cd multi-tts
```

2. **Install dependencies**
```bash
npm install
```

3. **Build project**
```bash
npm run build
```

4. **Start server**
```bash
npm start
```

5. **Akses aplikasi**
   - Buka browser ke `http://localhost:3001`

## ⚙️ Konfigurasi

### API Keys Setup
1. Buka aplikasi di browser
2. Masukkan API keys Google Gemini (satu per baris)
3. Klik "Setup Keys"
4. Status keys akan ditampilkan (sehat/error)

### FFmpeg Installation (Opsional)

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
- Download dari [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)
- Extract dan tambahkan ke PATH

## 📖 Cara Penggunaan

### 1. **Setup API Keys**
- Masukkan satu atau lebih API key Google Gemini
- Aplikasi akan menggunakan multiple keys untuk parallel processing

### 2. **Input Teks**
- **Manual**: Ketik atau paste teks di text area
- **File Upload**: Upload file .txt via drag & drop atau browse

### 3. **Konfigurasi**
- **Chunk Size**: Ukuran potongan teks (default: 1000 karakter)
- **Max Parallel**: Jumlah maksimal proses paralel (default: 4)
- **Voice**: Pilih voice model (zephyr, aoede, dll)
- **Temperature**: Kontrol variasi suara (0.0-2.0)
- **Output Format**: WAV, MP3, atau OGG

### 4. **Konversi**
- Klik "Convert to Speech"
- Monitor progress secara real-time
- Download hasil audio

### 5. **Merge Audio (Opsional)**
- Auto merge jika semua chunks berhasil
- Manual merge jika ada chunks yang gagal
- Download file merged sebagai satu audio kontinyu

## 🔧 Technical Details

### Architecture
```
src/
├── core/           # Core logic (API manager, TTS processor)
├── utils/          # Utilities (audio, chunking)
├── types/          # TypeScript type definitions
├── web/            # Web server dan public files
└── tests/          # Unit tests
```

### Key Features Implementation

**Smart Chunking**
```typescript
// Membagi teks berdasarkan kalimat utuh
export const buatChunkTeks = (teks: string, ukuranChunk: number) => {
  // Split berdasarkan kalimat dengan mempertahankan tanda baca
  // Ensure kalimat tidak terpotong di tengah
}
```

**Retry Mechanism**
```typescript
// Filter chunk kosong dan retry dengan API key berbeda
const validChunks = failedChunks.filter(fc => {
  const teks = fc.teks || fc.text || '';
  return teks.trim().length > 0;
});
```

**Auto Merge**
```typescript
// Merge audio chunks berdasarkan urutan
if (gagal.length === 0 && berhasil.length > 1 && ffmpegAvailable) {
  const autoMergeResult = await autoMergeIfComplete(hasil, outputDir, sessionId);
}
```

## 🐛 Troubleshooting

### Common Issues

**1. API Key Error**
- Pastikan API key Google Gemini valid
- Cek quota dan billing di Google Cloud Console
- Rate limit: API gratis memiliki limit 15 requests/day

**2. FFmpeg Not Found**
- Install FFmpeg untuk format MP3/OGG
- Pastikan FFmpeg ada di PATH
- Restart aplikasi setelah install FFmpeg

**3. Chunk Gagal**
- Gunakan fitur retry dengan API key berbeda
- Cek koneksi internet
- Reduce chunk size jika teks terlalu panjang

**4. Merge Gagal**
- Pastikan FFmpeg terinstall
- Cek space disk tersedia
- Manual download individual files sebagai alternatif

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 Changelog

### v1.0.0 (Latest)
- ✅ **Fixed**: Chunk retry dengan teks kosong
- ✅ **Fixed**: Tombol merge tidak muncul
- ✅ **Fixed**: Potongan chunk bukan kalimat utuh
- ✅ **Added**: Smart chunking dengan kalimat utuh
- ✅ **Added**: Better error handling untuk retry
- ✅ **Added**: Improved merge button logic
- ✅ **Added**: Auto merge dan manual merge
- ✅ **Added**: Real-time progress tracking
- ✅ **Added**: Multiple API key support

## 🔗 Links

- **GitHub Repository**: [https://github.com/danprat/multi-tts](https://github.com/danprat/multi-tts)
- **Google Gemini API**: [https://ai.google.dev/gemini-api](https://ai.google.dev/gemini-api)
- **FFmpeg**: [https://ffmpeg.org](https://ffmpeg.org)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Gemini API untuk TTS service
- FFmpeg untuk audio processing
- Socket.IO untuk real-time communication
- TypeScript community untuk tools dan support

---

**Dibuat dengan ❤️ untuk kemudahan konversi text-to-speech**