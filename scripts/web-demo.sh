#!/bin/bash

# TTS Multi-API Web Demo Script
# Perbaikan FFmpeg integration dan MCP documentation

echo "🎵 TTS Multi-API Web Demo - FFmpeg Enhanced"
echo "=============================================="

# Cek dependencies
echo "📦 Checking dependencies..."

# Check node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js tidak ditemukan. Install Node.js terlebih dahulu."
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm tidak ditemukan. Install Node.js dengan npm."
    exit 1
fi

# Check FFmpeg
if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg ditemukan: $(ffmpeg -version | head -1)"
else
    echo "⚠️  FFmpeg tidak ditemukan"
    echo "📋 Untuk mendapatkan dukungan format MP3 dan OGG, install FFmpeg:"
    echo "   macOS: brew install ffmpeg"
    echo "   Ubuntu/Debian: sudo apt install ffmpeg"
    echo "   Windows: choco install ffmpeg atau download dari https://ffmpeg.org"
    echo ""
    echo "🔧 Aplikasi akan tetap berjalan dengan dukungan format WAV saja."
    read -p "🤔 Lanjutkan tanpa FFmpeg? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Demo dibatalkan. Install FFmpeg terlebih dahulu."
        exit 1
    fi
fi

# Install dependencies jika belum ada
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

# Build project jika perlu
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    echo "🔨 Building project..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed"
        exit 1
    fi
fi

# Create output directory
mkdir -p output

# Check if port 3000 is available
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port 3000 sudah digunakan. Menghentikan proses yang ada..."
    pkill -f "tsx.*server" || true
    sleep 2
fi

echo ""
echo "🚀 Starting TTS Multi-API Web Server..."
echo "📱 Web interface: http://localhost:3000"
echo "🔧 API endpoints: http://localhost:3000/api"
echo ""
echo "📋 Fitur yang tersedia:"
echo "   ✅ Text-to-Speech dengan multiple API keys"
echo "   ✅ Parallel processing untuk performa optimal"
echo "   ✅ Upload file text (.txt)"
echo "   ✅ Chunking otomatis untuk text panjang"
echo "   ✅ Real-time progress monitoring"
echo "   ✅ Download individual atau batch (ZIP)"

if command -v ffmpeg &> /dev/null; then
    echo "   ✅ Audio format: WAV, MP3, OGG"
    echo "   ✅ Audio conversion dengan FFmpeg"
else
    echo "   ⚠️  Audio format: WAV saja (install FFmpeg untuk MP3/OGG)"
fi

echo ""
echo "🔑 Setup API Keys:"
echo "   1. Buka http://localhost:3000"
echo "   2. Masukkan OpenAI API keys di bagian Setup"
echo "   3. Masukkan text yang ingin dikonversi"
echo "   4. Pilih format output dan konfigurasi"
echo "   5. Klik Convert untuk memulai"
echo ""
echo "⏹️  Tekan Ctrl+C untuk menghentikan server"
echo "=============================================="

# Auto-open browser (optional)
sleep 2
if command -v open &> /dev/null; then
    echo "🌐 Opening browser..."
    open http://localhost:3000
elif command -v xdg-open &> /dev/null; then
    echo "🌐 Opening browser..."
    xdg-open http://localhost:3000 &
elif command -v start &> /dev/null; then
    echo "🌐 Opening browser..."
    start http://localhost:3000
fi

# Start server
npm run dev:web 