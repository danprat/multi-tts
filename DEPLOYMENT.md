# Deployment Guide - Vercel

## 🚀 Deploy ke Vercel

### Prerequisites
- Account [Vercel](https://vercel.com)
- Repository di GitHub
- Node.js ≥ 18.0.0

### 1. Install Vercel CLI (Opsional)
```bash
npm install -g vercel
```

### 2. Deploy via GitHub (Recommended)

1. **Connect Repository**:
   - Login ke [Vercel Dashboard](https://vercel.com/dashboard)
   - Klik "New Project"
   - Import repository GitHub: `danprat/multi-tts`

2. **Configure Build Settings**:
   - **Framework Preset**: Other
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Environment Variables** (Optional):
   - `NODE_ENV`: `production`
   - Tambahkan environment variables lain jika diperlukan

4. **Deploy**:
   - Klik "Deploy"
   - Tunggu proses build selesai

### 3. Deploy via CLI

```bash
# Clone repository
git clone https://github.com/danprat/multi-tts.git
cd multi-tts

# Install dependencies
npm install

# Build project
npm run build

# Deploy to Vercel
vercel

# Follow the prompts:
# ? Set up and deploy "multi-tts"? [Y/n] y
# ? Which scope do you want to deploy to? [Your Account]
# ? Link to existing project? [y/N] n
# ? What's your project's name? tts-multi-api
# ? In which directory is your code located? ./
```

### 4. Domain Configuration

Setelah deploy, Vercel akan memberikan URL seperti:
- `https://tts-multi-api.vercel.app`
- `https://tts-multi-api-git-main.vercel.app`

Untuk custom domain:
1. Go to Project Settings > Domains
2. Add your domain
3. Configure DNS records

### 5. Limitations di Vercel

#### ⚠️ Important Notes:
1. **Serverless Functions**:
   - Max execution time: 10s (Hobby), 15s-900s (Pro)
   - Memory limit: 1024MB (Hobby), up to 3008MB (Pro)

2. **File Storage**:
   - Vercel is stateless - generated files tidak persistent
   - Audio files akan hilang setelah function selesai
   - Recommend: gunakan external storage (AWS S3, Cloudinary, dll)

3. **WebSocket**:
   - Vercel mendukung WebSocket tapi dengan limitations
   - Consider menggunakan Vercel's real-time features atau external service

#### 🛠️ Solutions untuk Limitations:

**File Storage**:
```javascript
// Option 1: Return base64 audio langsung ke client
// Option 2: Upload ke cloud storage (S3, Cloudinary)
// Option 3: Stream audio langsung tanpa save ke disk
```

**Long Running Tasks**:
```javascript
// Break down menjadi smaller chunks
// Use Vercel Edge Functions untuk lightweight processing
// Consider background jobs dengan Vercel Cron
```

### 6. Production Optimizations

1. **Update server.ts untuk serverless**:
```typescript
// Modify untuk handle serverless environment
if (process.env.VERCEL) {
  // Disable file system operations
  // Use memory storage atau external storage
}
```

2. **Environment Variables**:
```bash
# Set via Vercel Dashboard
NODE_ENV=production
PORT=3000
```

3. **Build Optimization**:
```json
// Dalam tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist"
  }
}
```

### 7. Monitoring & Logs

- **Vercel Dashboard**: Real-time logs dan analytics
- **Function Logs**: Debug serverless functions
- **Performance**: Monitor response times

### 8. Alternative Deployment Options

Jika Vercel limitations terlalu restrictive:

1. **Railway**: Better untuk full-stack apps
2. **Render**: Persistent storage, longer timeouts
3. **Heroku**: Traditional PaaS
4. **DigitalOcean App Platform**: More control
5. **AWS ECS/Lambda**: Enterprise-grade

### 9. Quick Deploy Commands

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Check deployment
vercel ls
```

### 10. Troubleshooting

**Build Errors**:
```bash
# Check build locally
npm run build
node dist/web/server.js
```

**Function Timeout**:
- Reduce chunk size
- Optimize processing logic
- Use streaming responses

**Memory Issues**:
- Process smaller batches
- Clear buffers properly
- Monitor memory usage

---

## 🔗 Useful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Node.js on Vercel](https://vercel.com/docs/functions/serverless-functions/runtimes/node-js)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Limits & Pricing](https://vercel.com/pricing) 