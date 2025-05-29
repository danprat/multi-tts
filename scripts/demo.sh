#!/bin/bash

echo "🎵 TTS Multi-API Demo Script"
echo "================================="
echo ""

# Fungsi untuk demo text chunking
demo_chunking() {
    echo "📦 Demo: Text Chunking"
    echo "-----------------------"
    echo "Testing dengan chunk size 300 karakter..."
    echo ""
    
    npm run dev -- convert \
        --text "Halo, ini adalah demo aplikasi TTS Multi-API. Aplikasi ini dapat memproses teks panjang dengan membaginya menjadi chunks kecil dan memproses secara paralel menggunakan multiple API keys untuk efisiensi maksimal. Setiap chunk akan diproses secara independen sehingga jika ada yang gagal, chunk lain tetap bisa berhasil diproses." \
        --chunk-size 300 \
        --parallel 2 \
        --keys "demo-key-1,demo-key-2" \
        --output ./demo-output
    
    echo ""
    echo "✅ Demo chunking selesai!"
    echo ""
}

# Fungsi untuk demo multiple API keys
demo_multi_keys() {
    echo "🔑 Demo: Multiple API Keys"
    echo "---------------------------"
    echo "Testing dengan 4 API keys..."
    echo ""
    
    npm run dev -- status --keys "key1,key2,key3,key4"
    
    echo ""
    echo "✅ Demo multi-keys selesai!"
    echo ""
}

# Fungsi untuk demo file processing
demo_file_processing() {
    echo "📄 Demo: File Processing"
    echo "-------------------------"
    echo "Processing file examples/sample-text.txt..."
    echo ""
    
    npm run dev -- convert \
        --file examples/sample-text.txt \
        --chunk-size 400 \
        --parallel 3 \
        --voice "Nova" \
        --temperature 0.7 \
        --keys "demo-key-1,demo-key-2,demo-key-3" \
        --output ./demo-output/from-file
        
    echo ""
    echo "✅ Demo file processing selesai!"
    echo ""
}

# Main menu
echo "Pilih demo yang ingin dijalankan:"
echo "1) Text Chunking"
echo "2) Multiple API Keys Status"
echo "3) File Processing"
echo "4) All Demos"
echo ""

read -p "Masukkan pilihan (1-4): " choice

case $choice in
    1)
        demo_chunking
        ;;
    2)
        demo_multi_keys
        ;;
    3)
        demo_file_processing
        ;;
    4)
        demo_chunking
        demo_multi_keys
        demo_file_processing
        ;;
    *)
        echo "❌ Pilihan tidak valid!"
        exit 1
        ;;
esac

echo "🎉 Demo selesai! Check folder demo-output untuk hasil (jika menggunakan API key valid)"
echo ""
echo "📝 Untuk menggunakan dengan API key real:"
echo "export GEMINI_API_KEYS=\"your-real-key-1,your-real-key-2\""
echo "npm run dev -- convert --text \"Your text here\"" 