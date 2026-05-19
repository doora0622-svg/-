import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { promisify } from 'util';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';

// --- Environment & Path Setup ---
const isProd = process.env.NODE_ENV === 'production';

// Directory paths - Using process.cwd() is safe in this environment
const ROOT_DIR = path.resolve(process.cwd());
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const UPLOADS_DIR = path.resolve(ROOT_DIR, 'uploads');

// Ensure essential directories exist at startup
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Determine where presentations are stored
// In production, we prefer DATA_DIR for persistence, but might need to look in DIST_DIR for initial assets
const PRESENTATIONS_BASE_DIR = path.join(DATA_DIR, 'presentations');
const METADATA_FILE = path.join(DATA_DIR, 'presentations.json');

if (!fs.existsSync(PRESENTATIONS_BASE_DIR)) fs.mkdirSync(PRESENTATIONS_BASE_DIR, { recursive: true });

// Initial migration: If data/ doesn't have metadata but public/ (or dist/ in prod) does, copy it
const initialMetadataSource = isProd 
  ? path.join(DIST_DIR, 'presentations.json')
  : path.join(ROOT_DIR, 'public', 'presentations.json');

if (!fs.existsSync(METADATA_FILE) && fs.existsSync(initialMetadataSource)) {
  try {
    fs.copyFileSync(initialMetadataSource, METADATA_FILE);
    console.log('[Startup] Migrated initial presentations.json to data directory');
  } catch (e) {
    console.error('Failed to migrate metadata:', e);
  }
}

if (!fs.existsSync(METADATA_FILE)) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify([]));
}

console.log(`[Startup] Environment: ${isProd ? 'Production' : 'Development'}`);
console.log(`[Startup] ROOT: ${ROOT_DIR}`);
console.log(`[Startup] DATA: ${DATA_DIR}`);

// --- Firebase Admin 初始化 (服務端唯一) ---
const serviceAccount = {
  "type": "service_account",
  "project_id": "ppt-show-8a773",
  "private_key_id": "3c2ba00fb2c391862aaf043328e4da3ec457b713",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDubdwenmaU6D6o\nk4SS4/2I1twZWVc5x6eWg0P44nXHiKwdmWPMYWlH5P0yMpVQcqCi2mTv0S4ZLfcU\nK4Hc7XhLGM66fDgxp8YurpKVqUCno57j8GtC2SQvYHCBFKMDNRwKyDPWl285VfuI\naK9EKrfkc/uvWhz6RHSyLqgpBhknUg6vMoGZxOQCsbzJbkVXTVMYfQr0XrvwPPwR\nJ4e+i0fHnqboN35hXNUzdU0TIA4PO/cneyyCCAkHApuE9BOmzmLjYVihcCbCOlRw\nkiljk/vYgVTG7KtaSDa6ALzTOZxpTGZzTkKCxmAUNWJyeU8oSc2Pg+c/RVNORJHp\nG6QDI7rLAgMBAAECggEAATAV7Scf3rULft6BRhQRsslTPmMWDqkiehr8TzSdnpld\nNiaJ+z4u/pcy9bmPyd9QUo9g+lrh7mkutnCDDJ04QLOGcCJnS0QJNjlTbKBzvIIR\nrBQKDMK1LfE+jj4Sk9UDZ0BZFcQaX0BA6QyQdvf5g49aXSTHSS3nIO4fk1i+7lW1\nW3g7WHbV37SVlFQDbo//LRkaDeGpgMG+4WAF2ORDhKKUZu2VtV84muNL+Sg6SnhE\n6OAaxmcid7CdOub3sjWwDuOHRkrMIouqSjVtxuq8SF2zk+jWmBTIfr3xs5yBeRXp\nnQ+JZekzAiOcs5MDlxVxCfrXT3f6CLnvQlvcQcW/yBQKBgQD/h9D1Wvi4rS1GLUPm\nc+ucA4LDMnDNaEGlZWCuU9RhijFyW5eyw/HzB2tY1rDmd1+tXag92gDcb52DgirI\n2unsNxt9uM0+1QqK12mUTI8gf/nftJLnamLnzc7SC8fYl9NiTkou1oBCuewdiRB3\nmTyGPPSq9OUx8JoYRY+fXYZXxwKBgQDu3gATWCNUEuds4LL80cvFHvPjaMR3amJW\Ly9ZSbJEBBzPAXYh5ZuDmw/xhyfYPzaNGvbhtpqufj2PkbmImWkna+k002jxEQTK\n3429MtgCE+9kIIehgELx/X4EN8veA1opjGx3hnVJ7Fnk6yQ3Z9L6gb44Hiw+Yfst\nXUBtUc5s3QKBgEEQJO2EN1ZWifOXbPWNyI0V+8KV4lD63dQuRvq8T5RyanqyxaJ3\n7/AwkG2zZKGZ/ZuYAFGXY6a9KL8mcpxn2S4TLgXJ+0CnYCLQDIr9H2hoDYifYtRX\nq01YgvPKmh0VM3aRdqQMa+YRjwRKNQ4uz1Fize2Fo6IeoC3T8GjkmGNbAoGAPe6R\nVnKjtkiweCpKPgKnMpSz52JijhOnK3FQdXYGIlxum71lQ6SkjZrGp3jDe+3n1u4G\n1L7jnBpfG7mMwH4GJZJ1BJ1LuDURaQhNV6C3INLKXsuQXu9CbDutUKqm0QlNdzhR\nZywVfPUq2Y+d9D+XFBxPlX09O29sEHb9HVr4ioECgYEA4tx4Szumn5Suer7y9IAp\n+7/1cj6rykEe2ScUMqriIHqAg1WKX/IxxWI5XohtX/LM2sjpkMdDog44Mukz2/Lp\nwHWPNsy2H0k9oaKUFXKNBz7i3CEKfuk/zK59ZD57Zatf6HmceHyJrTF1qZpsm/06\nIGTTLpt9MnDXegJlKZ86sQU=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@ppt-show-8a773.iam.gserviceaccount.com",
  "client_id": "114471844743198705750",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40ppt-show-8a773.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
    databaseURL: "https://ppt-show-8a773-default-rtdb.asia-southeast1.firebasedatabase.app"
  });
  console.log('--- [Firebase] Admin 初始化成功 ---');
} catch (err) {
  console.error('--- [Firebase] Admin 初始化失敗:', err);
}

function getPresentations() {
  try {
    return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function savePresentations(data: any) {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const upload = multer({ dest: 'uploads/' });

  // --- API 路由 ---

  // 1. 取得所有簡報列表
  app.get('/api/presentations', (req, res) => {
    res.json(getPresentations());
  });

  // 2. 重新命名簡報
  app.put('/api/presentations/:id', (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    let list = getPresentations();
    const index = list.findIndex((p: any) => p.id === id);
    if (index !== -1) {
      list[index].name = name;
      savePresentations(list);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '找不到簡報' });
    }
  });

  // 3. 刪除簡報
  app.delete('/api/presentations/:id', (req, res) => {
    const { id } = req.params;
    let list = getPresentations();
    const index = list.findIndex((p: any) => p.id === id);
    if (index !== -1) {
      list.splice(index, 1);
      savePresentations(list);
      const dirPath = path.join(PRESENTATIONS_BASE_DIR, id);
      if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
      res.json({ success: true });
    } else {
      res.status(404).json({ error: '找不到簡報' });
    }
  });

  // 4. 重排投影片 (針對特定簡報)
  app.post('/api/presentations/:id/reorder', async (req, res) => {
    try {
      const { id } = req.params;
      const { newOrder } = req.body;
      const slidesDir = path.join(PRESENTATIONS_BASE_DIR, id);
      
      if (!fs.existsSync(slidesDir)) return res.status(404).json({ error: '目錄不存在' });

      const tempDir = path.join(UPLOADS_DIR, `reorder_${id}_${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      newOrder.forEach((oldIndex: number, newIndex: number) => {
        const oldFile = `slide_${oldIndex}.jpg`;
        const oldPath = path.join(slidesDir, oldFile);
        if (fs.existsSync(oldPath)) {
          fs.copyFileSync(oldPath, path.join(tempDir, `temp_${newIndex + 1}.jpg`));
        }
      });

      const currentFiles = fs.readdirSync(slidesDir).filter(f => f.startsWith('slide_'));
      currentFiles.forEach(f => fs.unlinkSync(path.join(slidesDir, f)));

      const tempFiles = fs.readdirSync(tempDir);
      tempFiles.forEach(f => {
        const index = f.match(/\d+/)?.[0];
        fs.renameSync(path.join(tempDir, f), path.join(slidesDir, `slide_${index}.jpg`));
      });

      fs.rmSync(tempDir, { recursive: true, force: true });

      // 更新 Metadata 中的總頁數與投影片詳細資料
      let list = getPresentations();
      const pIndex = list.findIndex((p: any) => p.id === id);
      if (pIndex !== -1) {
        const oldSlidesData = list[pIndex].slidesData || {};
        const newSlidesData: any = {};
        
        newOrder.forEach((oldIndex: number, newIndex: number) => {
          if (oldSlidesData[oldIndex]) {
            newSlidesData[newIndex + 1] = oldSlidesData[oldIndex];
          }
        });
        
        list[pIndex].totalPages = newOrder.length;
        list[pIndex].slidesData = newSlidesData;
        savePresentations(list);
      }

      res.json({ success: true, totalPages: newOrder.length });
    } catch (err: any) {
      console.error('重排錯誤:', err);
      res.status(500).json({ error: '重排失敗' });
    }
  });

  // 4.1 更新投影片詳細資料 (L/Y/M/Tips)
  app.put('/api/presentations/:id/slides/:index/metadata', (req, res) => {
    const { id, index } = req.params;
    const metadata = req.body; // { link, youtube, media, tips }
    
    let list = getPresentations();
    const pIndex = list.findIndex((p: any) => p.id === id);
    if (pIndex === -1) return res.status(404).json({ error: '找不到簡報' });
    
    if (!list[pIndex].slidesData) list[pIndex].slidesData = {};
    list[pIndex].slidesData[index] = metadata;
    
    savePresentations(list);
    res.json({ success: true });
  });

  // 4.2 上傳影音檔案 (M 功能)
  app.post('/api/upload-media', upload.single('file'), (req: any, res) => {
    if (req.file) {
      res.json({ success: true, url: `/uploads/${req.file.filename}` });
    } else {
      res.status(400).json({ error: '上傳失敗' });
    }
  });

  // 4.5 增加投影片到現有簡報
  app.post('/api/presentations/:id/slides', upload.array('files'), async (req: any, res) => {
    try {
      const { id } = req.params;
      if (!req.files || req.files.length === 0) return res.status(400).json({ error: '找不到檔案' });
      
      const slidesDir = path.join(PRESENTATIONS_BASE_DIR, id);
      if (!fs.existsSync(slidesDir)) return res.status(404).json({ error: '找不到目錄' });

      // 取得現有最大索引
      const currentFiles = fs.readdirSync(slidesDir).filter(f => f.startsWith('slide_'));
      let maxIndex = 0;
      currentFiles.forEach(f => {
        const match = f.match(/slide_(\d+)\.jpg/);
        if (match) maxIndex = Math.max(maxIndex, parseInt(match[1]));
      });

      // 處理上傳
      const images = req.files.filter((f: any) => /\.(jpg|jpeg|png|bmp|webp|gif|tiff)$/i.test(f.originalname))
        .sort((a: any, b: any) => a.originalname.localeCompare(b.originalname, undefined, { numeric: true, sensitivity: 'base' }));

      images.forEach((file: any, i: number) => {
        fs.renameSync(file.path, path.join(slidesDir, `slide_${maxIndex + i + 1}.jpg`));
      });

      // 更新 Metadata
      let list = getPresentations();
      const pIndex = list.findIndex((p: any) => p.id === id);
      const newTotal = fs.readdirSync(slidesDir).filter(f => f.startsWith('slide_')).length;
      if (pIndex !== -1) {
        list[pIndex].totalPages = newTotal;
        savePresentations(list);
      }

      res.json({ success: true, totalPages: newTotal });
    } catch (err: any) {
      res.status(500).json({ error: '追加失敗' });
    }
  });

  // 5. 上傳新簡報
  app.post('/api/presentations', upload.array('files'), async (req: any, res) => {
    try {
      if (!req.files || req.files.length === 0) return res.status(400).json({ error: '找不到檔案' });
      
      const presentationId = 'p' + Date.now();
      const slidesDir = path.join(PRESENTATIONS_BASE_DIR, presentationId);
      fs.mkdirSync(slidesDir, { recursive: true });

      const firstFile = req.files[0];
      const originalName = Buffer.from(firstFile.originalname, 'latin1').toString('utf8');
      const name = req.body.name || originalName.split('.')[0];
      const isPPTX = originalName.toLowerCase().endsWith('.pptx');

      if (isPPTX) {
        const libre = (await import('libreoffice-convert')).default;
        const poppler = (await import('pdf-poppler')).default;
        const libreConvert = promisify(libre.convert);

        const filePath = firstFile.path;
        const pdfPath = path.join('uploads', `${firstFile.filename}.pdf`);
        
        const pdfBuffer = await libreConvert(fs.readFileSync(filePath), '.pdf', undefined);
        fs.writeFileSync(pdfPath, pdfBuffer);

        await poppler.convert(pdfPath, { format: 'jpeg', out_dir: slidesDir, out_prefix: 'slide', scale: 1920 });

        const generated = fs.readdirSync(slidesDir)
          .filter(f => f.startsWith('slide-'))
          .sort((a,b) => parseInt(a.match(/\d+/)?.[0] || '0') - parseInt(b.match(/\d+/)?.[0] || '0'));

        generated.forEach((file, i) => fs.renameSync(path.join(slidesDir, file), path.join(slidesDir, `slide_${i + 1}.jpg`)));
        
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      } else {
        const images = req.files.filter((f: any) => /\.(jpg|jpeg|png|bmp|webp|gif|tiff)$/i.test(f.originalname))
          .sort((a: any, b: any) => a.originalname.localeCompare(b.originalname, undefined, { numeric: true, sensitivity: 'base' }));

        images.forEach((file: any, i: number) => {
          fs.renameSync(file.path, path.join(slidesDir, `slide_${i + 1}.jpg`));
        });
      }

      const totalSlides = fs.readdirSync(slidesDir).filter(f => f.startsWith('slide_')).length;
      
      const newPresentation = {
        id: presentationId,
        name: name,
        totalPages: totalSlides,
        createdAt: Date.now()
      };

      const list = getPresentations();
      list.push(newPresentation);
      savePresentations(list);

      res.json({ success: true, presentation: newPresentation });
    } catch (err: any) {
      console.error('上傳處理異常:', err);
      res.status(500).json({ error: '處理失敗', details: err.message });
    }
  });

  // 5.1 取得完整系統備份格式 (包含 Metadata 與 Base64 圖片)
  app.get('/api/admin/export', (req, res) => {
    try {
      const presentations = getPresentations();
      const fullData = presentations.map((p: any) => {
        const slidesDir = path.join(PRESENTATIONS_BASE_DIR, p.id);
        const images: string[] = [];
        if (fs.existsSync(slidesDir)) {
          console.log(`[Export] Reading images for ${p.id}...`);
          const files = fs.readdirSync(slidesDir)
            .filter(f => f.startsWith('slide_') && f.endsWith('.jpg'))
            .sort((a,b) => parseInt(a.match(/\d+/)?.[0] || '0') - parseInt(b.match(/\d+/)?.[0] || '0'));
          
          files.forEach(f => {
            const fullPath = path.join(slidesDir, f);
            const base64 = fs.readFileSync(fullPath).toString('base64');
            images.push(`data:image/jpeg;base64,${base64}`);
          });
        }
        return { ...p, backupImages: images };
      });
      res.json(fullData);
    } catch (err: any) {
      console.error('[Export] Error:', err);
      res.status(500).json({ error: '匯出備份失敗', details: err.message });
    }
  });

  // 6. 還原資料庫 (從備份檔，支援還原實體檔案)
  app.post('/api/admin/restore', (req, res) => {
    try {
      const { data, mode } = req.body; // mode: 'overwrite' or 'merge'
      console.log(`[Admin] Restore initiated. Mode: ${mode}, Items: ${Array.isArray(data) ? data.length : 'invalid'}`);
      
      if (!Array.isArray(data)) {
        console.error('[Admin] Restore failed: Data is not an array.');
        return res.status(400).json({ error: '無效的備份資料格式' });
      }

      let currentList = getPresentations();
      
      if (mode === 'overwrite') {
        currentList = []; // 重置
      }

      data.forEach((backupItem: any) => {
        // 1. 處理 Metadata
        const pIndex = currentList.findIndex((p: any) => p.id === backupItem.id);
        const cleanItem = { ...backupItem };
        const backupImages = cleanItem.backupImages;
        delete cleanItem.backupImages; // 移除 Base64 以免存入 JSON

        if (pIndex !== -1) {
          currentList[pIndex] = cleanItem;
        } else {
          currentList.push(cleanItem);
        }

        // 2. 處理實體檔案 (如果備份中有資料)
        if (backupImages && Array.isArray(backupImages)) {
          const slidesDir = path.join(PRESENTATIONS_BASE_DIR, backupItem.id);
          if (!fs.existsSync(slidesDir)) fs.mkdirSync(slidesDir, { recursive: true });
          
          backupImages.forEach((base64: string, i: number) => {
            const match = base64.match(/^data:image\/\w+;base64,(.+)$/);
            if (match) {
              const buffer = Buffer.from(match[1], 'base64');
              fs.writeFileSync(path.join(slidesDir, `slide_${i + 1}.jpg`), buffer);
            }
          });
          console.log(`[Admin] Restored folder and ${backupImages.length} images for ${backupItem.id}`);
        }
      });

      savePresentations(currentList);
      console.log(`[Admin] Restore successful. Total items now: ${currentList.length}`);
      res.json({ success: true, count: currentList.length });
    } catch (err: any) {
      console.error('[Admin] Restore exception:', err);
      res.status(500).json({ error: '還原失敗', details: err.message });
    }
  });

  // 取得熱點 (暫時維持舊邏輯或未來可擴充為依簡報而定)
  app.get('/api/links', (req, res) => {
    const linksPath = path.join(DATA_DIR, 'links.json');
    if (fs.existsSync(linksPath)) {
      res.json(JSON.parse(fs.readFileSync(linksPath, 'utf-8')));
    } else res.json({});
  });

  app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

  // 靜態資源：支援多個簡報目錄
  app.use('/presentations', express.static(PRESENTATIONS_BASE_DIR));

  // 404 API 處理 (防止掉入 HTML 回傳)
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API route not found', url: req.originalUrl });
  });

  // 2. Vite 中間件或靜態檔案服務
  if (!isProd) {
    console.log('--- [開發模式] 啟動 Vite 中間件 ---');
    const vite = await createViteServer({
      server: { middlewareMode: true, watch: { usePolling: true } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const indexHtml = path.join(DIST_DIR, 'index.html');
    
    console.log(`[Production] Serving from: ${DIST_DIR}`);
    console.log(`[Production] Index exists: ${fs.existsSync(indexHtml)}`);
    
    if (fs.existsSync(indexHtml)) {
      app.use(express.static(DIST_DIR));
      app.get('*', (req, res) => {
        // SPA Fallback
        res.sendFile(indexHtml);
      });
    } else {
      console.error('CRITICAL: index.html not found in dist/!');
      app.get('*', (req, res) => res.status(500).send('Application build missing.'));
    }
  }

  // 3. 監聽
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 [伺服器已運行] http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('🔥 [系統] 啟動崩潰:', err);
});
