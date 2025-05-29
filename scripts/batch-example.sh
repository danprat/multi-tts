#!/bin/bash

echo "📚 TTS Multi-API Batch Processing Example"
echo "=========================================="
echo ""

# Setup directories
INPUT_DIR="./input-texts"
OUTPUT_DIR="./batch-output"

# Buat directories jika belum ada
mkdir -p "$INPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Contoh create sample files untuk batch processing
create_sample_files() {
    echo "📝 Membuat sample files untuk batch processing..."
    
    # Chapter 1
    cat > "$INPUT_DIR/chapter-1.txt" << EOF
Bab 1: Pengenalan Text-to-Speech

Text-to-Speech (TTS) adalah teknologi yang mengkonversi teks tertulis menjadi ucapan yang dapat didengar. Teknologi ini telah berkembang pesat dalam beberapa tahun terakhir berkat kemajuan dalam bidang artificial intelligence dan machine learning.

Aplikasi TTS Multi-API yang kami kembangkan menggunakan pendekatan inovatif dengan memanfaatkan multiple API keys untuk processing paralel. Hal ini memungkinkan throughput yang jauh lebih tinggi dibandingkan dengan pendekatan tradisional yang hanya menggunakan satu API key.
EOF

    # Chapter 2
    cat > "$INPUT_DIR/chapter-2.txt" << EOF
Bab 2: Arsitektur Parallel Processing

Parallel processing dalam konteks TTS memungkinkan kita untuk memproses multiple chunks teks secara bersamaan. Dengan membagi teks panjang menjadi bagian-bagian kecil dan mendistribusikannya ke berbagai API keys, kita dapat mengurangi waktu total processing secara signifikan.

Sistem kami mengimplementasikan smart chunking yang mempertimbangkan struktur kalimat, sehingga hasil audio tetap natural meskipun diproses secara terpisah. Auto recovery system juga memastikan bahwa jika ada API key yang mengalami masalah, chunk akan dialihkan ke API key lain yang tersedia.
EOF

    # Chapter 3
    cat > "$INPUT_DIR/chapter-3.txt" << EOF
Bab 3: Optimisasi dan Performance

Untuk mencapai performance optimal, beberapa strategi dapat diterapkan. Pertama adalah penggunaan ukuran chunk yang tepat - terlalu kecil akan menyebabkan overhead, terlalu besar akan mengurangi efektivitas parallel processing.

Kedua adalah load balancing yang cerdas antar API keys. Sistem monitoring real-time memungkinkan kita untuk mendeteksi API key yang mengalami rate limiting atau masalah lainnya, dan secara otomatis mendistribusikan load ke API key yang sehat.

Temperature setting juga berperan penting dalam konsistensi output audio. Setting yang terlalu tinggi akan menghasilkan variasi yang berlebihan, sementara setting yang terlalu rendah mungkin terdengar monoton.
EOF

    echo "✅ Sample files berhasil dibuat di $INPUT_DIR"
    echo ""
}

# Fungsi untuk batch processing semua file
batch_process() {
    echo "🚀 Memulai batch processing..."
    echo ""
    
    # Check jika ada file di input directory
    if [ ! "$(ls -A $INPUT_DIR 2>/dev/null)" ]; then
        echo "📁 Input directory kosong, membuat sample files..."
        create_sample_files
    fi
    
    # Process setiap file .txt di input directory
    for file in "$INPUT_DIR"/*.txt; do
        if [ -f "$file" ]; then
            filename=$(basename "$file" .txt)
            echo "📄 Processing: $filename"
            
            npm run dev -- convert \
                --file "$file" \
                --output "$OUTPUT_DIR/$filename" \
                --chunk-size 800 \
                --parallel 3 \
                --voice "Zephyr" \
                --temperature 0.8 \
                --keys "batch-key-1,batch-key-2,batch-key-3"
                
            echo "✅ Selesai: $filename"
            echo ""
        fi
    done
    
    echo "🎉 Batch processing selesai!"
    echo "📁 Check hasil di: $OUTPUT_DIR"
    echo ""
}

# Fungsi untuk cleanup
cleanup() {
    echo "🧹 Cleanup sample files..."
    rm -rf "$INPUT_DIR"
    rm -rf "$OUTPUT_DIR"
    echo "✅ Cleanup selesai!"
}

# Main menu
echo "Pilih action:"
echo "1) Create sample files"
echo "2) Run batch processing"
echo "3) Both (create + process)"
echo "4) Cleanup"
echo ""

read -p "Masukkan pilihan (1-4): " choice

case $choice in
    1)
        create_sample_files
        ;;
    2)
        batch_process
        ;;
    3)
        create_sample_files
        batch_process
        ;;
    4)
        cleanup
        ;;
    *)
        echo "❌ Pilihan tidak valid!"
        exit 1
        ;;
esac

echo ""
echo "💡 Tips untuk production:"
echo "- Gunakan API keys yang valid: export GEMINI_API_KEYS=\"key1,key2,key3\""
echo "- Adjust chunk-size berdasarkan panjang rata-rata kalimat"
echo "- Monitor CPU/memory usage untuk parallel count optimal"
echo "- Gunakan SSD untuk output directory agar I/O cepat" 