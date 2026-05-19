import React, { Component, useState, useEffect, useRef, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Pen, 
  Highlighter, 
  Square, 
  Trash2, 
  Download, 
  Grid, 
  X, 
  Upload, 
  MousePointer, 
  Eye, 
  GripHorizontal,
  Minus,
  MoveUpRight,
  RotateCw,
  Maximize,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  ChevronDown,
  Type,
  Layers,
  Search,
  Play,
  Users,
  Clock,
  Share2,
  QrCode,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getDatabase, ref, onValue, set, off, update, push, onDisconnect, get } from 'firebase/database';
import { cn } from './lib/utils';

// Drag & Drop
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * 🎨 Firebase 配置區塊 - 已直接寫入
 */
const firebaseConfig = {
  apiKey: "AIzaSyB-1AWhymwrvpFjPv3bqx0fkIv3DHqcVdc",
  authDomain: "ppt-show-8a773.firebaseapp.com",
  databaseURL: "https://ppt-show-8a773-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ppt-show-8a773",
  storageBucket: "ppt-show-8a773.firebasestorage.app",
  messagingSenderId: "111847153867",
  appId: "1:111847153867:web:8f8658ecd465406df33b4e",
  measurementId: "G-Z1E741YBKR"
};

let app: any;
let rtdb: any;
try {
  app = initializeApp(firebaseConfig);
  rtdb = getDatabase(app);
} catch (err) {
  console.error('Firebase initialization failed:', err);
}

// 安全初始化 Analytics
if (app) {
  isSupported().then(supported => {
    if (supported) {
      getAnalytics(app);
    }
  }).catch(err => console.error('Analytics not supported:', err));
}

// --- 類型定義 ---
interface DrawingStroke {
  id: string;
  type: 'pen' | 'highlighter' | 'rect' | 'line' | 'arrow';
  points?: { x: number, y: number }[];
  startPoint?: { x: number, y: number };
  endPoint?: { x: number, y: number };
  color: string;
  width: number;
}

interface Hotspot {
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
  label: string;
}

interface HotspotsConfig {
  [page: string]: Hotspot[];
}

interface GridItem {
  id: string;
  originalIndex: number;
}

interface SlideMetadata {
  link?: string;
  youtube?: string;
  media?: string;
  tips?: string;
}

interface SortableSlideProps {
  item: GridItem;
  isCurrent: boolean;
  onNavigate: () => void | Promise<void>;
  onDoubleClick: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onEditMetadata?: () => void;
  timestamp: number;
  role: string;
  currentPresentationId: string;
  getSlideUrl: (pId: string, page: number, ts?: number) => string;
}

interface SortablePresentationCardProps {
  p: any;
  idx: number;
  currentPresentationId: string;
  editingId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  setEditingId: (id: string | null) => void;
  renamePresentation: (id: string, name: string) => void;
  openSlideEditor: (presentation: any) => void;
  selectPresentation: (presentation: any) => void;
  deletePresentation: (id: string) => void;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  getSlideUrl: (pId: string, page: number, ts?: number) => string;
}

// --- Sortable Item 組件 (投影片) ---
const SortableSlide: React.FC<SortableSlideProps> = ({ 
  item, 
  isCurrent, 
  onNavigate, 
  onDoubleClick, 
  onDelete,
  onEditMetadata,
  timestamp,
  role,
  currentPresentationId,
  getSlideUrl
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id, disabled: role !== 'presenter' });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "group relative aspect-video bg-zinc-900 rounded-xl overflow-hidden border-2 transition-all cursor-pointer",
        isCurrent ? "border-emerald-500 ring-4 ring-emerald-500/20 shadow-xl shadow-emerald-500/10" : "border-zinc-800 hover:border-emerald-500/50"
      )}
      onClick={onNavigate}
      onDoubleClick={onDoubleClick}
    >
      <img 
        src={getSlideUrl(currentPresentationId, item.originalIndex, timestamp)} 
        alt={`Page ${item.originalIndex}`}
        className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity"
        draggable={false}
      />
      
      {/* 頂部操作區 - 僅講師可見 */}
      {role === 'presenter' && (
        <div className="absolute top-2 left-2 right-2 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
          {/* 拖動把手 */}
          <div 
            {...attributes} 
            {...listeners}
            className="p-1.5 bg-emerald-500/80 backdrop-blur-md rounded-lg text-white shadow-lg cursor-grab active:cursor-grabbing"
            title="拖曳移動"
          >
            <GripHorizontal className="w-4 h-4" />
          </div>

          <div className="flex gap-1">
            {/* 附加功能鍵 */}
            {onEditMetadata && (
              <button 
                onClick={(e) => { e.stopPropagation(); onEditMetadata(); }}
                className="p-1.5 bg-blue-500/80 backdrop-blur-md rounded-lg text-white shadow-lg hover:bg-blue-600 transition-colors"
                title="編輯附加功能(L/Y/M/Tips)"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}

            {/* 刪除按鈕 */}
            {onDelete && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-1.5 bg-rose-500/80 backdrop-blur-md rounded-lg text-white shadow-lg hover:bg-rose-600 transition-colors"
                title="點擊刪除此投影片"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 頁碼標記 */}
      <div className="absolute bottom-2 right-2 px-2 py-1 bg-emerald-500 text-white shadow-lg rounded text-[10px] font-black font-mono">
        #{item.originalIndex}
      </div>

      {isCurrent && (
        <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none flex items-center justify-center">
          <div className="bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">
            目前播放中
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sortable Item 組件 (簡報) ---
const SortablePresentationCard: React.FC<SortablePresentationCardProps> = ({
  p,
  idx,
  currentPresentationId,
  editingId,
  editingName,
  setEditingName,
  setEditingId,
  renamePresentation,
  openSlideEditor,
  selectPresentation,
  deletePresentation,
  deleteConfirmId,
  setDeleteConfirmId,
  getSlideUrl
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: p.id || `p-${idx}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 hover:bg-zinc-800/80 transition-all cursor-default flex flex-col gap-3",
        currentPresentationId === p.id && "border-emerald-500/50 bg-emerald-500/5"
      )}
    >
      {/* 拖動把手 (左上角) */}
      <div 
        {...attributes} 
        {...listeners}
        className="absolute -top-1.5 -left-1.5 p-1 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all cursor-grab active:cursor-grabbing z-20 shadow-xl"
        title="拖曳調整順序"
      >
        <GripHorizontal className="w-3.5 h-3.5" />
      </div>

      <div className="flex justify-between items-start">
        <div className="flex-1">
          {editingId === p.id ? (
            <input 
              autoFocus
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => renamePresentation(p.id, editingName)}
              onKeyDown={(e) => e.key === 'Enter' && renamePresentation(p.id, editingName)}
              className="bg-zinc-800 text-white font-bold p-1 rounded outline-none border border-emerald-500 w-full text-sm"
            />
          ) : (
            <h4 className="font-bold text-sm group-hover:text-emerald-400 transition-colors line-clamp-1">{p.name}</h4>
          )}
          <p className="text-emerald-500/60 text-[10px] mt-0.5 uppercase font-mono tracking-widest">{p.totalPages} 頁 ✦ {new Date(p.createdAt).toLocaleDateString()}</p>
        </div>
        {currentPresentationId === p.id && (
          <div className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-black rounded uppercase border border-emerald-500/30">
            播放中
          </div>
        )}
      </div>

      <div className="aspect-video bg-zinc-950 rounded-lg overflow-hidden border border-white/5 relative group/preview">
        <img 
          src={getSlideUrl(p.id, 1)} 
          alt="preview"
          className="w-full h-full object-contain opacity-60 group-hover:opacity-100 transition-opacity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-end p-2 pb-6">
           <button 
            onClick={() => selectPresentation(p)}
            className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] w-full transition-all active:scale-90 border border-white/20 flex items-center justify-center gap-1.5 group/btn"
           >
            <Play className="w-3 h-3 fill-current" />
            選擇簡報
           </button>
        </div>

        <AnimatePresence>
          {deleteConfirmId === p.id && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-red-600/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-2 text-center"
            >
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mb-2">
                <Trash2 className="w-4 h-4 text-white" />
              </div>
              <p className="text-white text-[11px] font-bold mb-3 leading-tight">確定要刪除嗎？</p>
              <div className="flex flex-col gap-1.5 w-full px-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); deletePresentation(p.id); }}
                  className="w-full bg-white text-red-600 font-black text-[10px] py-1.5 rounded-md shadow-lg active:scale-95"
                >
                  確定刪除
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                  className="w-full bg-black/20 text-white font-bold text-[10px] py-1.5 rounded-md hover:bg-black/30 active:scale-95"
                >
                  取消
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => openSlideEditor(p)}
          className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-colors"
          title="修改投影片"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={() => { setEditingId(p.id); setEditingName(p.name); }}
          className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors"
          title="重新命名"
        >
          <Type className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={() => setDeleteConfirmId(p.id)}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            deleteConfirmId === p.id ? "bg-white text-red-600" : "hover:bg-red-500/10 text-zinc-500 hover:text-red-400"
          )}
          title="刪除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// --- 錯誤邊界組件 ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mb-6">
            <X className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-4">糟糕！程式發生了碰撞</h1>
          <p className="text-zinc-400 mb-8 max-w-md">
            這通常是因為 Firebase 連線或某些資料讀取失敗導致的。
            您可以嘗試重新整理頁面。
          </p>
          <div className="bg-zinc-900 p-4 rounded-xl text-left font-mono text-xs text-rose-300 w-full max-w-2xl overflow-auto mb-8">
            {this.state.error?.toString()}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white text-zinc-950 rounded-full font-bold hover:scale-105 transition-transform"
          >
            重新整理頁面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [role, setRole] = useState<'presenter' | 'audience'>('presenter');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPresentationId, setCurrentPresentationId] = useState<string>('');
  const [presentations, setPresentations] = useState<any[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // 簡報內頁編輯狀態
  const [editingPresentation, setEditingPresentation] = useState<any | null>(null);
  const [tempSlides, setTempSlides] = useState<any[]>([]);
  const slideEditInputRef = useRef<HTMLInputElement>(null);
  
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<'presenter' | 'settings' | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [isGridOpen, setIsGridOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  const [slideTimestamp, setSlideTimestamp] = useState(Date.now());
  
  // 取得投影圖片路徑
  const getSlideUrl = (pId: string, page: number, ts?: number) => {
    const p = presentations.find(prod => prod.id === pId);
    // 如果資料中有 images 陣列且對應頁碼有值，優先使用 (支援 Cloudinary 等外部 URL)
    if (p?.images && Array.isArray(p.images) && p.images[page - 1]) {
      return p.images[page - 1];
    }
    // 否則使用本地路徑
    return `/presentations/${pId}/slide_${page}.jpg${ts ? `?t=${ts}` : ''}`;
  };
  // 當視窗重新獲得對焦時，確保資料狀態正確（避免切換頁面後消失的問題）
  useEffect(() => {
    const handleFocus = () => {
      // 觸發重新渲染以查核當前頁面資料
      setSlideTimestamp(Date.now());
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const [audienceCount, setAudienceCount] = useState(0);
  const [audienceList, setAudienceList] = useState<{ id: string, name: string }[]>([]);
  const [showAudienceList, setShowAudienceList] = useState(false);
  const [userName, setUserName] = useState(() => localStorage.getItem('audience_name') || '');
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // --- 觀眾 2 小時自動斷連 (session 逾時) ---
  useEffect(() => {
    // 只有非簡報者 (觀眾) 會自動斷連
    if (role !== 'presenter') {
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      const timer = setTimeout(() => {
        setIsSessionExpired(true);
      }, TWO_HOURS);
      return () => clearTimeout(timer);
    }
  }, [role]);

  // --- 判斷是否需要輸入名稱 ---
  useEffect(() => {
    if (role === 'audience' && !userName && !isSessionExpired) {
      setIsNameModalOpen(true);
    }
  }, [role, userName, isSessionExpired]);

  // --- 觀眾連線數監聽 (Presence) ---
  useEffect(() => {
    if (isSessionExpired || !rtdb) return;
    if (role === 'audience' && !userName) return;

    try {
      // 建立一個專屬於此 session 的連線節點
      const connectionsRef = ref(rtdb, 'connections');
      const myConnectionRef = push(connectionsRef);

      // 當連線中斷時自動刪除此節點
      onDisconnect(myConnectionRef).remove();
      
      // 設定此節點的值 (包含名稱)
      set(myConnectionRef, {
        name: role === 'presenter' ? '講師' : (userName || '匿名觀眾'),
        joinedAt: Date.now(),
        role: role
      });

      // 監聽所有連線節點的變化
      const unsubscribe = onValue(connectionsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const list = Object.entries(data).map(([id, val]: [string, any]) => ({
            id,
            name: val.name || '匿名'
          }));
          setAudienceList(list);
          setAudienceCount(list.length);
        } else {
          setAudienceList([]);
          setAudienceCount(0);
        }
      });

      return () => {
        off(connectionsRef, 'value', unsubscribe);
        set(myConnectionRef, null);
      };
    } catch (err) {
      console.error('Firebase Presence Error:', err);
    }
  }, [isSessionExpired, role, userName]);

  const [gridItems, setGridItems] = useState<GridItem[]>([]);
  const [imagesLoaded, setImagesLoaded] = useState<Record<number, boolean>>({});

  const [isAppShrunk, setIsAppShrunk] = useState(false);
  const [editingMetadataSlide, setEditingMetadataSlide] = useState<{ id: string, index: number } | null>(null);
  const [metadataInputs, setMetadataInputs] = useState<SlideMetadata>({});
  const [showTips, setShowTips] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  
  const [toast, setToast] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  // --- 附加功能 ---
  const handleExternalLink = (url: string) => {
    if (!url) return;

    // 檢查是否為本地路徑 (Windows 路徑格式)
    const isLocalPath = /^[a-zA-Z]:\\|^\\/.test(url);

    if (isLocalPath) {
      // 1. 自動複製作為最優先行為
      navigator.clipboard.writeText(url).then(() => {
        showToast('路徑已複製！請使用 Win+R 貼上開啟');
      }).catch(err => {
        console.error('Copy failed', err);
        showToast('無法自動複製，請手動複製路徑');
      });

      // 2. 嘗試直接開啟 (通常會被瀏覽器攔截，但作為額外嘗試)
      const formattedPath = url.replace(/\\/g, '/');
      const fileUrl = encodeURI(`file:///${formattedPath}`);
      window.open(fileUrl, '_blank');
      
      console.log('Local path requested:', url);
    } else {
      const finalUrl = url.startsWith('http') ? url : `https://${url}`;
      window.open(finalUrl, '_blank');
    }
    
    setIsAppShrunk(true);
  };

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const docEl = document.documentElement as any;
    const doc = document as any;

    if (!isFullscreen) {
      const requestFs = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
      if (requestFs) {
        requestFs.call(docEl).then(() => {
          if (window.screen.orientation && (window.screen.orientation as any).lock) {
            (window.screen.orientation as any).lock('landscape').catch(() => {});
          }
        }).catch((err: any) => {
          console.error('Fullscreen failed:', err);
          showToast('無法進入全螢幕');
        });
      } else {
        // iOS Safari 備用方案: 提示用戶使用「加入主畫面」
        showToast('iPhone 瀏覽器支援有限，建議點擊下方分享並「加入主畫面」以獲得全螢幕體驗');
      }
    } else {
      const exitFs = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
      if (exitFs) {
        exitFs.call(doc).catch((err: any) => console.error(err));
      }
    }
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 瀏覽選定後，記錄檔名（完整路徑受瀏覽器安全性限制，建議手動輸入或貼上）
    setMetadataInputs(prev => ({ ...prev, media: file.name }));
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const saveMetadata = async () => {
    if (!editingMetadataSlide) return;
    try {
      const res = await fetch(`/api/presentations/${editingPresentation.id}/slides/${editingMetadataSlide.index}/metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadataInputs)
      });
      if (res.ok) {
        fetchPresentations();
        setEditingMetadataSlide(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const currentMetadata: SlideMetadata = presentations.find(p => p.id === currentPresentationId)?.slidesData?.[currentPage] || {};

  // 幻燈片預載功能
  useEffect(() => {
    if (totalPages <= 0) return;
    
    // 預載目前頁面、下一頁、前一頁
    const pagesToLoad = [currentPage, currentPage + 1, currentPage - 1]
      .filter(p => p >= 1 && p <= totalPages);
      
    pagesToLoad.forEach(page => {
      const img = new Image();
      img.src = getSlideUrl(currentPresentationId, page, slideTimestamp);
      img.onload = () => {
        setImagesLoaded(prev => ({ ...prev, [page]: true }));
      };
    });
  }, [currentPage, totalPages, slideTimestamp, currentPresentationId]);
  
  // UI 隱藏狀態
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isFooterVisible, setIsFooterVisible] = useState(true);

  // 自動隱藏計時器
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isFooterVisible) {
      timer = setTimeout(() => setIsFooterVisible(false), 2000);
    }
    return () => clearTimeout(timer);
  }, [isFooterVisible]);
  
  const headerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sidebarTimerRef = useRef<NodeJS.Timeout | null>(null);
  const footerTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [tool, setTool] = useState<'pen' | 'highlighter' | 'rect' | 'line' | 'arrow' | 'pan'>('pen');
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [isUploading, setIsUploading] = useState(false);
  const [hotspots, setHotspots] = useState<HotspotsConfig>({});
  
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // 自動縮放至適合螢幕
  const autoFit = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    
    if (containerW < 100 || containerH < 100) return;

    const contentW = 1920;
    const contentH = 1080;
    
    const scaleX = containerW / contentW;
    const scaleY = containerH / contentH;
    const newScale = Math.min(scaleX, scaleY) * 0.96;
    
    setScale(newScale);
    // 置中計算：
    // 使用 translate(X, Y) scale(S)
    // X = (ContainerW - ContentW * Scale) / 2
    setOffset({ 
      x: (containerW - contentW * newScale) / 2, 
      y: (containerH - contentH * newScale) / 2 
    });
  }, []);

  // 監聽視窗與容器大小變化
  useEffect(() => {
    autoFit();
    // 額外延遲執行一次，確保容器尺寸已完全計算
    const timer = setTimeout(autoFit, 500);
    
    const observer = new ResizeObserver(() => {
      // 使用 requestAnimationFrame 避開邊界閃動
      requestAnimationFrame(autoFit);
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    const handleFsChange = () => {
      // 多次嘗試以應對瀏覽器動畫期間的尺寸回報不穩定
      autoFit();
      setTimeout(autoFit, 100);
      setTimeout(autoFit, 300);
      setTimeout(autoFit, 1000);
    };

    window.addEventListener('resize', autoFit);
    window.addEventListener('fullscreenchange', handleFsChange);
    
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', autoFit);
      window.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, [autoFit]);

  // 當投影片載入成功時自動縮放
  useEffect(() => {
    if (totalPages > 0) {
      autoFit();
    }
  }, [totalPages, autoFit]);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);

  // 監聽遠端筆跡 (同步所有人的畫面)
  useEffect(() => {
    if (!rtdb) return;
    const strokesRef = ref(rtdb, `presentation/strokes/page_${currentPage}`);
    const unsubscribe = onValue(strokesRef, (snapshot) => {
      // 如果不是講師在繪圖，就同步遠端狀態
      if (role === 'audience' || (role === 'presenter' && !isDraggingRef.current)) {
        const data = snapshot.val();
        if (data) {
          // RTDB 可能會存成物件或陣列
          setStrokes(Array.isArray(data) ? data : Object.values(data));
        } else {
          setStrokes([]);
        }
      }
    });

    return () => off(strokesRef, 'value', unsubscribe);
  }, [currentPage, role]);

  // 切換頁面時基本重置
  useEffect(() => {
    setStrokes([]);
    setCurrentStroke(null);
    setIsDragging(false);
    isDraggingRef.current = false;
  }, [currentPage]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showMiniQR, setShowMiniQR] = useState(false);
  const [showFullScreenQR, setShowFullScreenQR] = useState(false);
  const qClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleQClick = () => {
    if (qClickTimeoutRef.current) {
      // Double click detected
      clearTimeout(qClickTimeoutRef.current);
      qClickTimeoutRef.current = null;
      setShowFullScreenQR(true);
      setShowMiniQR(false);
    } else {
      qClickTimeoutRef.current = setTimeout(() => {
        setShowMiniQR(prev => !prev);
        qClickTimeoutRef.current = null;
      }, 300);
    }
  };

  // DND Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // 初始化角色與基礎資料
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userRole = params.get('role') === 'presenter' ? 'presenter' : 'audience';
    setRole(userRole);
    
    // 檢查是否已經點擊過「登入」進入系統，避免切換模式時重複跳出
    const hasEntered = sessionStorage.getItem('has_entered_system');
    if (!hasEntered) {
      setShowWelcome(true);
      if (userRole === 'presenter') {
        setShowMiniQR(true); 
      }
    }

    fetch('/api/links')
      .then(res => res.json())
      .then(data => setHotspots(data))
      .catch(() => console.log('No hotspots found'));
  }, []);

  // 監聽 RTDB 簡報狀態
  useEffect(() => {
    if (!rtdb) return;
    const presentationRef = ref(rtdb, 'presentation');
    const unsubscribe = onValue(presentationRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTotalPages(data.total_pages || 0);
        setCurrentPresentationId(data.current_presentation_id || '');
        
        if (role === 'audience' && isFollowing) {
          setCurrentPage(data.current_page || 1);
        } else if (role === 'presenter') {
          setCurrentPage(data.current_page || 1);
        }
      }
    });

    return () => off(presentationRef, 'value', unsubscribe);
  }, [role, isFollowing]);

  useEffect(() => {
    if (isSettingsOpen) {
      fetchPresentations();
    }
  }, [isSettingsOpen]);

  const fetchPresentations = async () => {
    try {
      // 加入 cache-buster timestamp 防止快取
      const res = await fetch(`/api/presentations?t=${Date.now()}`);
      const data = await res.json();
      setPresentations(data);
    } catch (err) {
      console.error('Fetch presentations failed:', err);
    }
  };

  const selectPresentation = async (presentation: any) => {
    try {
      if (role !== 'presenter' || !rtdb) return;
      
      // 更新全域狀態
      await set(ref(rtdb, 'presentation'), {
        current_presentation_id: presentation.id,
        current_page: 1,
        total_pages: presentation.totalPages,
        last_updated: Date.now()
      });
      
      setCurrentPresentationId(presentation.id);
      setCurrentPage(1);
      setTotalPages(presentation.totalPages);
      setSlideTimestamp(Date.now());
      setIsSettingsOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const deletePresentation = async (id: string) => {
    try {
      await fetch(`/api/presentations/${id}`, { method: 'DELETE' });
      
      // 同步刪除 Firebase 中的節點 (保持一致性)
      if (rtdb) {
        const snapshot = await get(ref(rtdb, 'presentations'));
        const currentList = snapshot.val() || [];
        if (Array.isArray(currentList)) {
          const newList = currentList.filter((p: any) => p.id !== id);
          await set(ref(rtdb, 'presentations'), newList);
        }
      }

      setDeleteConfirmId(null);
      fetchPresentations();
    } catch (err) {
      console.error(err);
    }
  };

  const renamePresentation = async (id: string, newName: string) => {
    try {
      await fetch(`/api/presentations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      setEditingId(null);
      fetchPresentations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadNew = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);
    const formData = new FormData();
    const files = Array.from(fileList);
    files.forEach(f => formData.append('files', f as File));
    
    try {
      const res = await fetch('/api/presentations', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        fetchPresentations();
        console.log('匯入簡報成功');
      }
    } catch (err) {
      console.error('處理失敗');
    } finally {
      setIsUploading(false);
    }
  };

  // --- 備份管理 ---
  const handleExportBackup = async () => {
    try {
      showToast('正在讀取系統全量資料 (包含投影片圖片)...');
      
      const res = await fetch('/api/admin/export');
      if (!res.ok) throw new Error('伺服器匯出失敗');
      
      const fullData = await res.json();
      
      const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `presentation_backup_full_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      // 同時同步到 Firebase 作為雲端存檔 (如果需要)
      if (rtdb) {
        // 同步前移除大型 Base64 字串，RTDB 僅存 Metadata，確保雲端查詢效能
        const metadataOnly = fullData.map((p: any) => {
          const clean = { ...p };
          delete clean.backupImages;
          return clean;
        });
        await set(ref(rtdb, 'presentations'), metadataOnly);
      }
      
      showToast('全量備份檔 (含圖片) 已成功下載');
    } catch (err) {
      console.error(err);
      alert('備份失敗，請檢查伺服器連線。');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!Array.isArray(json)) throw new Error('備份檔格式不符');

        const confirmRestore = window.confirm(`⚠️ 完整還原警告：這將會【覆蓋目前所有雲端與本地資料】！\n備份檔包含 ${json.length} 個簡報與其圖片。\n確定要還原裝載嗎？`);
        if (!confirmRestore) return;

        showToast('正在解碼並還原資料庫與實體投影片檔案，請稍候...');

        // 1. 同步到伺服器 (包含 Base64 圖片)
        const res = await fetch('/api/admin/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: json, mode: 'overwrite' })
        });

        const result = await res.json();
        if (result.success) {
          // 2. 同步到 Firebase RTDB (移除 Base64 以免超量)
          if (rtdb) {
            const metadataOnly = json.map((p: any) => {
              const clean = { ...p };
              delete clean.backupImages;
              return clean;
            });
            await set(ref(rtdb, 'presentations'), metadataOnly);
          }

          alert(`資料庫與實體檔案裝載成功！已全面恢復 ${json.length} 個簡報專案。\n系統將自動重啟。`);
          window.location.reload(); 
        } else {
          throw new Error('伺服器裝載失敗');
        }
      } catch (err) {
        console.error('還原報錯:', err);
        alert('備份檔案格式錯誤或連線逾時，請重試。');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const handlePresentationDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activeId = active.id;
      const overId = over.id;

      setPresentations((items) => {
        const oldIndex = items.findIndex((item) => (item.id || `p-${items.indexOf(item)}`) === activeId);
        const newIndex = items.findIndex((item) => (item.id || `p-${items.indexOf(item)}`) === overId);
        const newList = arrayMove(items, oldIndex, newIndex);
        
        // 異步同步到雲端與本地
        (async () => {
          try {
            if (rtdb) {
              await set(ref(rtdb, 'presentations'), newList);
            }
            await fetch('/api/admin/restore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: newList, mode: 'overwrite' })
            });
          } catch (err) {
            console.error('Sync reorder failed:', err);
          }
        })();

        return newList;
      });
    }
  };

  // --- 內頁詳情編輯 (加/刪/改 投影片) ---
  const openSlideEditor = (presentation: any) => {
    setEditingPresentation(presentation);
    // 建立臨時幻燈片索引列表
    const slides = Array.from({ length: presentation.totalPages }, (_, i) => ({
      id: `${presentation.id}-slide-${i + 1}`,
      originalIndex: i + 1
    }));
    setTempSlides(slides);
  };

  const saveSlideChanges = async (id: string, newSlideItems: any[]) => {
    try {
      const newOrder = newSlideItems.map(s => s.originalIndex);
      const res = await fetch(`/api/presentations/${id}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOrder })
      });
      const data = await res.json();
      if (data.success) {
        // 如果正在播放此簡報，更新快照
        if (id === currentPresentationId && rtdb) {
          setTotalPages(data.totalPages);
          setSlideTimestamp(Date.now());
          await update(ref(rtdb, 'presentation'), { total_pages: data.totalPages, last_updated: Date.now() });
        }
        fetchPresentations();
        // 重新整理編輯狀態的索引
        const updatedSlides = Array.from({ length: (data.totalPages || 0) }, (_, i) => ({
          id: `${id}-slide-${i + 1}`,
          originalIndex: i + 1
        }));
        setTempSlides(updatedSlides);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSlide = async (presentationId: string, itemToDelete: any) => {
    const newSlides = tempSlides.filter(s => s.id !== itemToDelete.id);
    await saveSlideChanges(presentationId, newSlides);
  };

  const handleAddSlidesToExisting = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingPresentation) return;
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    Array.from(fileList).forEach(f => formData.append('files', f as File));
    
    try {
      const res = await fetch(`/api/presentations/${editingPresentation.id}/slides`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        if (editingPresentation.id === currentPresentationId) {
          setTotalPages(data.totalPages);
          setSlideTimestamp(Date.now());
          await update(ref(rtdb, 'presentation'), { total_pages: data.totalPages, last_updated: Date.now() });
        }
        fetchPresentations();
        // 重新載入列表
        const updatedSlides = Array.from({ length: data.totalPages }, (_, i) => ({
          id: `${editingPresentation.id}-slide-${i + 1}`,
          originalIndex: i + 1
        }));
        setTempSlides(updatedSlides);
      }
    } catch (err) {
      console.error('追加失敗');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSlideDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && editingPresentation) {
      const oldIndex = tempSlides.findIndex((s) => s.id === active.id);
      const newIndex = tempSlides.findIndex((s) => s.id === over?.id);
      const newItems = arrayMove(tempSlides, oldIndex, newIndex);
      setTempSlides(newItems);
      saveSlideChanges(editingPresentation.id, newItems);
    }
  };

  // 更新 Grid Items
  useEffect(() => {
    setGridItems(Array.from({ length: totalPages }, (_, i) => ({
      id: `slide-${i + 1}`,
      originalIndex: i + 1
    })));
  }, [totalPages]);

  // 移除元件內的全域滑鼠偵測，改用底部圓圈手動點選切換
  useEffect(() => {
    // 監聽 Esc 鍵關閉所有面板
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHeaderVisible(false);
        setIsSidebarVisible(false);
        setIsFooterVisible(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      [headerTimerRef, sidebarTimerRef, footerTimerRef].forEach(ref => {
        if (ref.current) clearTimeout(ref.current);
      });
    };
  }, []);

  // --- 繪圖工具輔助 ---
  const drawArrowHead = (ctx: CanvasRenderingContext2D, from: { x: number, y: number }, to: { x: number, y: number }, width: number) => {
    const headLength = width * 4;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - headLength * Math.cos(angle - Math.PI / 6), to.y - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(to.x - headLength * Math.cos(angle + Math.PI / 6), to.y - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  };

  // 繪圖渲染 - 改用 requestAnimationFrame 提升效能，並移除背景繪製以防止閃動
  const drawFinishedStrokes = useCallback((ctx: CanvasRenderingContext2D) => {
    [...strokes, currentStroke].forEach(stroke => {
      if (!stroke) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.globalAlpha = stroke.type === 'highlighter' ? 0.4 : 1.0;

      if (stroke.type === 'rect') {
        if (stroke.startPoint && stroke.endPoint) {
          ctx.strokeRect(
            stroke.startPoint.x, 
            stroke.startPoint.y, 
            stroke.endPoint.x - stroke.startPoint.x, 
            stroke.endPoint.y - stroke.startPoint.y
          );
        }
      } else if (stroke.type === 'line' || stroke.type === 'arrow') {
        if (stroke.startPoint && stroke.endPoint) {
          ctx.moveTo(stroke.startPoint.x, stroke.startPoint.y);
          ctx.lineTo(stroke.endPoint.x, stroke.endPoint.y);
          ctx.stroke();
          if (stroke.type === 'arrow') {
            drawArrowHead(ctx, stroke.startPoint, stroke.endPoint, stroke.width);
          }
        }
      } else if (stroke.points && stroke.points.length > 0) {
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    });
  }, [strokes, currentStroke]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;
    const render = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 注意：畫布已經被 CSS transform 縮放與平移，
      // 所以內部的渲染應該維持原始解析度 (1920x1080)
      drawFinishedStrokes(ctx);
      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [drawFinishedStrokes, offset, scale]);

  // 工具 handlers
  const getMousePos = (e: React.PointerEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // 防止除以零
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };

    // 因為 Canvas 已經應用了 transform (scale)
    // 且 canvas 寬高固定為 1920x1080
    // getBoundingClientRect().left 是元件在螢幕上的實際左側座標
    const localX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const localY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    return { x: localX, y: localY };
  };

  const resetView = () => {
    autoFit();
  };

  const handleMouseDown = (e: React.PointerEvent) => {
    if (role !== 'presenter' && tool !== 'pan') return;
    const pos = getMousePos(e);
    setLastMousePos({ x: e.clientX, y: e.clientY });

    if (tool === 'pan' || e.button === 1 || e.altKey) {
      setIsDragging(true);
      isDraggingRef.current = true;
      (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
      return;
    }

    setIsDragging(true);
    isDraggingRef.current = true;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    setCurrentStroke({
      id: Date.now().toString(),
      type: tool as 'pen' | 'highlighter' | 'rect' | 'line' | 'arrow',
      color: strokeColor,
      width: strokeWidth,
      points: [pos],
      startPoint: pos,
      endPoint: pos
    });
  };

  const handleMouseMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const isPanning = tool === 'pan' || (e.pointerType === 'mouse' && (e.buttons & 4 || e.altKey));
    if (isPanning) {
      // 由於現在 transform 是 translate(...) scale(...)
      // 位移量的計算必須要除以縮放率才能對應到內部的位移
      setOffset(prev => ({ 
        x: prev.x + (e.clientX - lastMousePos.x), 
        y: prev.y + (e.clientY - lastMousePos.y) 
      }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }
    
    // 繪圖邏輯
    const pos = getMousePos(e);
    if (currentStroke) {
      if (['rect', 'line', 'arrow'].includes(currentStroke.type)) {
        setCurrentStroke({ ...currentStroke, endPoint: pos });
      } else {
        // 優化：只有當點位移夠大才紀錄，避免陣列過大
        const lastPoint = currentStroke.points?.[currentStroke.points.length - 1];
        if (!lastPoint || Math.hypot(pos.x - lastPoint.x, pos.y - lastPoint.y) > 2) {
          setCurrentStroke({ ...currentStroke, points: [...(currentStroke.points || []), pos] });
        }
      }
    }
  };

  const handleMouseUp = async (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    setIsDragging(false);
    isDraggingRef.current = false;
    (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    if (currentStroke) {
      // 使用更安全的方法來計算新的筆跡陣列
      setStrokes(prev => {
        const next = [...prev, currentStroke];
        // 講師同步到雲端
        if (role === 'presenter' && rtdb) {
          set(ref(rtdb, `presentation/strokes/page_${currentPage}`), next)
            .catch(err => console.error('同步筆跡失敗:', err));
        }
        return next;
      });
      setCurrentStroke(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (role !== 'presenter') return;
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.1, Math.min(5, scale * delta));
    
    // 取得相對於容器的滑鼠位置
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // 根據公式：P_screen = Offset + Scale * P_local
    // P_local = (mx - offset.x) / scale
    // 保持 P_screen 不變：offset.x + scale * P_local = nextOffset.x + nextScale * P_local
    const plx = (mx - offset.x) / scale;
    const ply = (my - offset.y) / scale;
    
    const nextOffsetX = offset.x + (scale - newScale) * plx;
    const nextOffsetY = offset.y + (scale - newScale) * ply;
    
    setOffset({ x: nextOffsetX, y: nextOffsetY });
    setScale(newScale);
  };

  const changePage = async (page: number) => {
    if (page < 1 || page > totalPages) return;
    setStrokes([]);
    // 不要直接歸零，而是呼叫自動適應使其填滿視窗
    setCurrentPage(page);
    setTimeout(autoFit, 50); // 給予 DOM 渲染更新的時間
    if (role === 'presenter' && rtdb) await set(ref(rtdb, 'presentation/current_page'), page);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = gridItems.findIndex((item: GridItem) => item.id === active.id);
      const newIndex = gridItems.findIndex((item: GridItem) => item.id === over.id);
      
      const newGridItems = arrayMove(gridItems as GridItem[], oldIndex, newIndex);
      setGridItems(newGridItems);

      // 通知後端重排
      const newOrder = newGridItems.map((item: GridItem) => item.originalIndex);
      try {
        await fetch(`/api/presentations/${currentPresentationId}/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newOrder })
        });
        // 重置 originalIndex 讓 UI 保持一致
        setGridItems(Array.from({ length: totalPages }, (_, i) => ({
          id: `slide-${i + 1}`,
          originalIndex: i + 1
        })));
        setSlideTimestamp(Date.now()); // 強制重新載入圖片
        if (currentPage > totalPages) changePage(1);
      } catch (err) {
        console.error('重排同步失敗:', err);
      }
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `slide_${currentPage}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
  };

  const handleLoginSuccess = async () => {
    if (passwordTarget === 'presenter') {
      setRole('presenter');
      // 自動載入最新簡報
      try {
        const res = await fetch('/api/presentations');
        const data = await res.json();
        if (data && data.length > 0) {
          // 找到最新的簡報 (假設列表已排序或根據實作成員)
          const latest = data[0];
          
          if (rtdb) {
            // 檢查目前 RTDB 是否已有正在播放的簡報
            const snap = await get(ref(rtdb, 'presentation'));
            const currentData = snap.val();
            
            // 如果當前沒有播放中，或是用戶剛登入想看到內容
            if (!currentData || !currentData.current_presentation_id) {
              await selectPresentation(latest);
            }
          }
        }
      } catch (err) {
        console.error('自動載入簡報失敗:', err);
      }
    } else if (passwordTarget === 'settings') {
      setIsSettingsOpen(true);
    }
    setIsPasswordModalOpen(false);
    setPasswordInput('');
    setPasswordError(false);
  };

  // 鍵盤與手勢
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'g' || e.key === 'G') setIsGridOpen(p => !p);
      if (e.key === 'ArrowRight') changePage(currentPage + 1);
      if (e.key === 'ArrowLeft') changePage(currentPage - 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);

  const getShareableUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      // 將開發網址 ais-dev 自動轉換為公開網址 ais-pre
      if (urlObj.hostname.includes('ais-dev-')) {
        urlObj.hostname = urlObj.hostname.replace('ais-dev-', 'ais-pre-');
      }
      urlObj.searchParams.set('role', 'audience');
      // 移除可能干擾的輔助參數
      urlObj.searchParams.delete('token');
      urlObj.searchParams.delete('fullscreenApplet');
      return urlObj.toString();
    } catch (e) {
      return url.replace('ais-dev-', 'ais-pre-').replace('role=presenter', 'role=audience');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // 可以加個簡單的提示，暫時用 console 確保邏輯
      alert('已複製連結到剪貼簿！');
    } catch (err) {
      console.error('複製失敗:', err);
    }
  };

  const isDevUrl = window.location.href.includes('ais-dev-');
  const audienceUrl = getShareableUrl(window.location.href);

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative">
      <AnimatePresence>
        {showWelcome && (
          <motion.div 
            key="welcome-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[5000] flex flex-col items-center justify-center bg-zinc-950 text-white p-2 sm:p-6 overflow-hidden"
          >
            {/* 背景裝飾 */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full" />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="bg-zinc-900 border border-white/10 p-5 sm:p-8 rounded-[2rem] sm:rounded-[3rem] shadow-4xl flex flex-col items-center gap-3 sm:gap-6 max-w-sm w-full relative z-10 backdrop-blur-xl"
            >
              <div className="w-10 h-10 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-2xl rotate-3 shrink-0">
                {role === 'presenter' ? <Users className="w-5 h-5 sm:w-8 sm:h-8 text-white" /> : <MousePointer className="w-5 h-5 sm:w-8 sm:h-8 text-white" />}
              </div>

              <div className="w-full grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 shrink-0">
                <button 
                  onClick={() => {
                    setRole('audience');
                    setShowWelcome(false);
                    sessionStorage.setItem('has_entered_system', 'true');
                    if (!userName) setIsNameModalOpen(true);
                    setTimeout(autoFit, 100);
                    setTimeout(autoFit, 500);
                  }} 
                  className="group w-full py-2.5 sm:py-5 bg-white text-zinc-950 rounded-xl sm:rounded-[2rem] shadow-2xl hover:scale-[1.02] transition-all active:scale-95 flex flex-col items-center gap-0 sm:gap-2 border sm:border-4 border-white/50"
                >
                  <span className="text-sm sm:text-lg font-black tracking-tight uppercase">聽眾登入</span>
                  <span className="text-[7px] sm:text-[9px] uppercase font-bold opacity-40">免密碼 / 輸入名稱</span>
                </button>

                <button 
                  onClick={() => {
                    setPasswordTarget('presenter');
                    setIsPasswordModalOpen(true);
                    setShowWelcome(false);
                    sessionStorage.setItem('has_entered_system', 'true');
                    setTimeout(autoFit, 100);
                    setTimeout(autoFit, 500);
                  }} 
                  className="group w-full py-2.5 sm:py-5 bg-zinc-800 text-white rounded-xl sm:rounded-[2rem] shadow-2xl hover:scale-[1.02] transition-all active:scale-95 border border-white/10 flex flex-col items-center gap-0 sm:gap-2 hover:bg-zinc-700"
                >
                  <span className="text-sm sm:text-lg font-black tracking-tight uppercase">講師登入</span>
                  <span className="text-[7px] sm:text-[9px] uppercase font-bold opacity-40">需要管理密碼</span>
                </button>
              </div>

              <div className="text-center space-y-1">
                <h1 className="text-base sm:text-2xl font-black tracking-tight text-white uppercase leading-none">
                  {role === 'presenter' ? '簡報同步系統' : '歡迎加入同步'}
                </h1>
                <p className="text-zinc-400 font-medium max-w-[240px] mx-auto text-[9px] sm:text-sm leading-tight">
                  即時看見講師投影片並進行標記互動。
                </p>
              </div>

              {isDevUrl && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl text-center w-full">
                  <p className="text-amber-400 text-[8px] sm:text-[10px] font-bold leading-tight">
                    ⚠️ 請務必點擊右上角「分享」按鈕，<br/>否則其他人掃描會出現 404 錯誤。
                  </p>
                </div>
              )}

              <div className="w-full flex flex-col gap-1.5 pt-2 border-t border-white/5">
                <button 
                  onClick={() => copyToClipboard(audienceUrl)}
                  className="w-full py-1.5 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg text-[8px] sm:text-xs font-bold text-zinc-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 className="w-3 h-3" /> 複製分享網址
                </button>
                <p className="text-[7px] sm:text-[8px] text-zinc-600 font-bold uppercase tracking-widest text-center opacity-50">
                  Interactive Sync v2.0
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 縮放容器 */}

      <motion.div 
        animate={{ 
          scale: isAppShrunk ? 0.3 : 1,
          x: isAppShrunk ? '30%' : '0%',
          y: isAppShrunk ? '20%' : '0%',
          borderRadius: isAppShrunk ? '40px' : '0px'
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 120 }}
        className="h-full w-full bg-zinc-950 shadow-[0_0_100px_rgba(0,0,0,1)] relative overflow-hidden select-none"
      >
        <div className="relative h-full w-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden select-none">
      {/* 左功能選單: 合併工具列與粗細拉霸 */}
      <AnimatePresence>
        {currentPresentationId && role === 'presenter' && isSidebarVisible && (
          <motion.aside 
            key="sidebar"
            initial={{ x: -100, opacity: 0 }} 
            animate={{ x: 0, opacity: 1 }} 
            exit={{ x: -100, opacity: 0 }}
            className="fixed left-4 top-5 flex items-stretch gap-2 z-[60] group h-fit"
          >
            {/* 側邊工具列 - 寬型二欄設計 */}
            <div className="w-16 bg-zinc-900/10 backdrop-blur-md border border-white/10 rounded-2xl flex flex-col items-center py-3 gap-2.5 shadow-2xl relative h-fit group/sidebar hover:bg-zinc-900/40 transition-colors duration-500">
              {/* 工具選擇區 - 二欄排列 */}
              <div className="grid grid-cols-2 gap-1.5 px-1.5">
                <button onClick={() => { setTool('pen'); setRole('presenter'); }} title="畫筆 [P]" className={cn("p-1.5 rounded-lg transition-all", tool === 'pen' ? "bg-blue-600 text-white shadow-lg" : "text-white bg-white/5 hover:bg-white/20")}><Pen className="w-3.5 h-3.5" /></button>
                <button onClick={() => { setTool('highlighter'); setRole('presenter'); }} title="螢光筆 [H]" className={cn("p-1.5 rounded-lg transition-all", tool === 'highlighter' ? "bg-emerald-600 text-white shadow-lg" : "text-white bg-white/5 hover:bg-white/20")}><Highlighter className="w-3.5 h-3.5" /></button>
                <button onClick={() => { setTool('rect'); setRole('presenter'); }} title="矩形 [R]" className={cn("p-1.5 rounded-lg transition-all", tool === 'rect' ? "bg-orange-600 text-white shadow-lg" : "text-white bg-white/5 hover:bg-white/20")}><Square className="w-3.5 h-3.5" /></button>
                <button onClick={() => { setTool('line'); setRole('presenter'); }} title="直線 [L]" className={cn("p-1.5 rounded-lg transition-all", tool === 'line' ? "bg-zinc-700 text-white shadow-lg" : "text-white bg-white/5 hover:bg-white/20")}><Minus className="w-3.5 h-3.5" /></button>
                <button onClick={() => { setTool('arrow'); setRole('presenter'); }} title="箭頭 [A]" className={cn("p-1.5 rounded-lg transition-all", tool === 'arrow' ? "bg-zinc-700 text-white shadow-lg" : "text-white bg-white/5 hover:bg-white/20")}><MoveUpRight className="w-3.5 h-3.5" /></button>
                <button onClick={() => { setTool('pan'); setRole('presenter'); }} title="拖動 [V]" className={cn("p-1.5 rounded-lg transition-all", tool === 'pan' ? "bg-zinc-700 text-white shadow-lg" : "text-white bg-white/5 hover:bg-white/20")}><MousePointer className="w-3.5 h-3.5" /></button>
              </div>
              
              <div className="w-10 h-px bg-white/10"></div>
              
              {/* 單一顏色按鈕 與 粗細預覽 */}
              <div className="flex items-center gap-2">
                <div className="relative group/color">
                  <button 
                    onClick={() => document.getElementById('main-color-picker')?.click()}
                    className={cn(
                      "w-5 h-5 rounded-full border border-white/40 transition-all hover:scale-110 shadow-lg active:scale-95"
                    )}
                    style={{ backgroundColor: strokeColor }}
                    title="點擊自定義顏色"
                  />
                  <input 
                    id="main-color-picker"
                    type="color"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                    className="absolute opacity-0 pointer-events-none w-0 h-0"
                  />
                </div>
                <div 
                  className="w-2.5 h-2.5 rounded-full border border-white/20"
                  style={{ 
                    backgroundColor: strokeColor,
                    transform: `scale(${0.5 + (strokeWidth / 40) * 1.5})`
                  }}
                />
              </div>

              <div className="w-10 h-px bg-white/10"></div>
              
              {/* 粗細拉霸 - 再縮短 */}
              <div className="flex flex-col items-center py-1 h-14 justify-center">
                <input 
                  type="range" 
                  min="1" 
                  max="40" 
                  step="1" 
                  value={strokeWidth} 
                  onChange={(e) => setStrokeWidth(parseInt(e.target.value))} 
                  className="h-10 w-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                  style={{ 
                    writingMode: 'vertical-lr' as any,
                    WebkitAppearance: 'slider-vertical' as any
                  }}
                />
              </div>

              <div className="w-10 h-px bg-white/10"></div>

              {/* 功能按鈕 - 兩排排列 */}
              <div className="grid grid-cols-2 gap-1.5 w-full px-2 pb-1">
                <button 
                  onClick={async () => { 
                    setSlideTimestamp(Date.now());
                    setTimeout(autoFit, 50);
                    setStrokes([]); 
                    setCurrentStroke(null);
                    setIsDragging(false);
                    isDraggingRef.current = false;
                    if (role === 'presenter') {
                      try {
                        await set(ref(rtdb, `presentation/strokes/page_${currentPage}`), null);
                      } catch (err) {
                        console.error('清除雲端筆跡失敗:', err);
                      }
                    }
                  }} 
                  title="重置頁面、視角與筆跡" 
                  className="aspect-square flex items-center justify-center text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded-lg transition-all"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setIsSidebarVisible(false)} 
                  className="aspect-square flex items-center justify-center text-rose-400 hover:text-rose-300 hover:bg-rose-400/10 rounded-lg transition-colors"
                  title="關閉工具列"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* 主頁面滑動導覽 - 使用高 z-index 確保點擊 */}
      {totalPages > 0 && (
        <>
          <motion.div 
            animate={{ left: isSidebarVisible && role === 'presenter' ? 80 : 0 }}
            className="fixed top-0 bottom-0 w-32 flex items-center justify-center pl-4 z-[150] pointer-events-none"
          >
            <button 
              onClick={() => changePage(currentPage - 1)}
              disabled={currentPage === 1}
              className={cn(
                "w-16 h-16 bg-zinc-900/40 hover:bg-zinc-900/60 backdrop-blur-xl text-white rounded-full transition-all pointer-events-auto border border-white/20 disabled:hidden shadow-2xl group flex items-center justify-center",
                "opacity-40 hover:opacity-100"
              )}
              title="上一頁"
            >
              <ChevronLeft className="w-8 h-8 group-hover:-translate-x-1 transition-transform" />
            </button>
          </motion.div>
          <div className="fixed right-0 top-0 bottom-0 w-32 flex flex-col items-center justify-center gap-4 pr-4 z-[150] pointer-events-none">
            {/* 迷你 QR Code */}
            <AnimatePresence mode="wait">
              {showMiniQR && (
                <motion.div 
                  key="mini-qr"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  onClick={() => setShowMiniQR(false)}
                  className="bg-white p-1.5 rounded-xl shadow-2xl border border-zinc-200 cursor-pointer hover:scale-105 transition-transform w-[100px] pointer-events-auto mb-2"
                >
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getShareableUrl(window.location.href))}`} 
                    alt="QR" 
                    className="w-full aspect-square rounded-lg"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              onClick={() => changePage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={cn(
                "w-16 h-16 bg-zinc-900/40 hover:bg-zinc-900/60 backdrop-blur-xl text-white rounded-full transition-all pointer-events-auto border border-white/20 disabled:hidden shadow-2xl group flex items-center justify-center",
                "opacity-40 hover:opacity-100"
              )}
              title="下一頁"
            >
              <ChevronRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </>
      )}



      {/* 右下方控制中心 - 包含全螢幕、重置、功能切換與主要控制 */}
      <div className="fixed right-5 bottom-5 flex flex-col items-end gap-3 z-[100]">

        <button 
          onClick={toggleFullscreen}
          title={isFullscreen ? "結束全螢幕" : "全螢幕模式"}
          className={cn(
            "w-10 h-10 sm:w-7 sm:h-7 rounded-full backdrop-blur-md border transition-all flex items-center justify-center shadow-2xl active:scale-90 group",
            isFullscreen ? "bg-white text-zinc-900 border-white" : "bg-zinc-900/40 text-zinc-300 border-white/20 hover:bg-white/10 group-hover:text-white"
          )}
        >
          {isFullscreen ? (
            <Minimize2 className="w-5 h-5 sm:w-3.5 sm:h-3.5" />
          ) : (
            <Maximize className="w-5 h-5 sm:w-3.5 sm:h-3.5" />
          )}
        </button>
        <button 
          onClick={resetView}
          title="重置視角"
          className="w-7 h-7 rounded-full bg-zinc-900/20 backdrop-blur-md border border-white/20 hover:bg-white/10 transition-all flex items-center justify-center shadow-2xl active:scale-90 group"
        >
          <div className="w-3 h-3 rounded-sm border-[1.5px] border-zinc-300 group-hover:border-white transition-colors" />
        </button>
        <div className="flex gap-2">
          {role === 'presenter' && (
            <button 
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              title="工具列"
              className={cn(
                "w-7 h-7 rounded-full backdrop-blur-md border transition-all flex items-center justify-center shadow-2xl active:scale-90",
                isSidebarVisible ? "bg-emerald-500/40 border-emerald-400" : "bg-zinc-900/20 border-white/20 hover:bg-white/10"
              )}
            >
              <div className={cn("w-1.5 h-1.5 rounded-full", isSidebarVisible ? "bg-white shadow-[0_0_8px_rgba(255,255,255,1)]" : "bg-emerald-500")} />
            </button>
          )}
          <button 
            onClick={() => setIsHeaderVisible(!isHeaderVisible)}
            title="頂部選單"
            className={cn(
              "w-7 h-7 rounded-full backdrop-blur-md border transition-all flex items-center justify-center shadow-2xl active:scale-90",
              isHeaderVisible ? "bg-blue-500/40 border-blue-400" : "bg-zinc-900/20 border-white/20 hover:bg-white/10"
            )}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", isHeaderVisible ? "bg-white shadow-[0_0_8px_rgba(255,255,255,1)]" : "bg-blue-500")} />
          </button>
          <button 
            onClick={() => setIsFooterVisible(!isFooterVisible)}
            title="播放控制"
            className={cn(
              "w-7 h-7 rounded-full backdrop-blur-md border transition-all flex items-center justify-center shadow-2xl active:scale-90",
              isFooterVisible ? "bg-purple-500/40 border-purple-400" : "bg-zinc-900/20 border-white/20 hover:bg-white/10"
            )}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", isFooterVisible ? "bg-white shadow-[0_0_8px_rgba(255,255,255,1)]" : "bg-purple-500")} />
          </button>
        </div>
      </div>

      {/* 頂部隱藏標頭 */}
      <AnimatePresence>
        {isHeaderVisible && (
          <motion.header 
            key="header"
            initial={{ y: -80, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 150 }}
            className="fixed top-0 inset-x-0 h-16 bg-zinc-900/10 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 z-50 shadow-2xl hover:bg-zinc-900/40 transition-colors duration-500"
          >
            <div className="flex items-center gap-4">
              {/* 左側保留空白或可加入其他標識 */}
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="font-extrabold text-lg hidden sm:block text-white tracking-widest uppercase">互動式簡報同步系統</span>
                <button 
                  onClick={() => role === 'presenter' && setShowAudienceList(!showAudienceList)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/5 shadow-sm group",
                    role === 'presenter' && "cursor-pointer hover:bg-white/20 active:scale-95 transition-all"
                  )}
                >
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    <span className="text-[11px] font-bold text-white/80 tabular-nums">
                      {audienceCount} <span className="opacity-60 font-medium whitespace-nowrap">人連線</span>
                    </span>
                  </div>
                </button>
              </div>
              <div className="relative">
                <AnimatePresence>
                  {showAudienceList && role === 'presenter' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      onClick={() => setShowAudienceList(false)}
                      className="absolute top-12 left-0 w-64 max-h-80 bg-zinc-950/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-3xl overflow-hidden flex flex-col z-[100] cursor-pointer"
                    >
                      <div className="p-4 border-b border-white/5 bg-white/5">
                        <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest">目前在線觀眾 ({audienceList.length})</h4>
                      </div>
                      <div className="overflow-y-auto p-2 custom-scrollbar">
                        {audienceList.length > 0 ? (
                          <div className="grid grid-cols-1 gap-1">
                            {audienceList.map((aud) => (
                              <div key={aud.id} className="px-3 py-2 rounded-lg bg-white/5 text-sm text-white/80 font-medium hover:bg-white/10 transition-colors">
                                {aud.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-zinc-500 text-xs italic">暫無觀眾</div>
                        )}
                      </div>
                      <div className="p-3 text-[10px] text-center text-zinc-600 font-medium border-t border-white/5">
                        點擊此框即可關閉
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className={cn(
                "px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-widest transition-all shadow-xl border border-white/30",
                role === 'presenter' 
                  ? "bg-emerald-500 text-white shadow-emerald-500/40" 
                  : "bg-blue-600 text-white shadow-blue-500/40"
              )}>
                {role === 'presenter' ? '講師模式' : '聽眾模式'}
              </div>
              <button 
                onClick={handleQClick}
                title="顯示 QR Code 分享網址 (按一下切換，快按兩下全螢幕)"
                className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-500 transition-all shadow-lg active:scale-90 text-white group/qr"
              >
                <QrCode className="w-5 h-5 group-hover/qr:scale-110 transition-transform" />
              </button>
              {role === 'audience' && (
                <button onClick={() => setIsFollowing(!isFollowing)} className={cn("px-3 py-1.5 rounded text-xs font-bold uppercase transition-all shadow-lg", isFollowing ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 border border-white/5")}>
                  {isFollowing ? '跟隨講師' : '自主模式'}
                </button>
              )}
              <button 
                onClick={() => {
                  if (role === 'audience') {
                    setPasswordTarget('presenter');
                    setIsPasswordModalOpen(true);
                  } else {
                    setRole('audience');
                  }
                }}
                className="px-4 py-1.5 rounded-lg border border-white/20 bg-zinc-800 text-xs font-bold text-blue-400 hover:bg-zinc-700 hover:text-blue-300 hover:border-blue-500 transition-all shadow-xl active:scale-95"
              >
                切換身分
              </button>
              {role === 'presenter' && (
                <button 
                  onClick={() => setIsSettingsOpen(true)} 
                  className="px-4 py-1.5 bg-white text-zinc-950 rounded font-bold text-xs flex items-center gap-2"
                >
                  <Upload className="w-3 h-3" />
                  設定
                </button>
              )}
              <button onClick={() => setIsGridOpen(true)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"><Grid className="w-4 h-4" /></button>
              <div className="w-px h-6 bg-zinc-800 mx-1"></div>
              <button 
                onClick={() => setIsHeaderVisible(false)} 
                className="p-2 text-zinc-500 hover:text-white"
                title="隱藏"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* 主畫布區塊 */}
      <main ref={containerRef} className="absolute inset-0 touch-none overflow-hidden bg-[#0a0a0a]">
        <div 
          className="relative shadow-2xl flex items-center justify-center bg-zinc-950 transition-transform duration-300 pointer-events-none will-change-transform"
          style={{ 
            width: '1920px', 
            height: '1080px', 
            transformOrigin: '0 0',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          {/* 背景圖片 - 使用 AnimatePresence 達成淡入淡出 */}
          <AnimatePresence mode="popLayout">
            {totalPages > 0 ? (
              <motion.img 
                key={`slide-${currentPresentationId}-${currentPage}-${slideTimestamp}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                src={getSlideUrl(currentPresentationId, currentPage, slideTimestamp)}
                alt={`Slide ${currentPage}`}
                className="absolute inset-0 w-full h-full object-contain select-none"
                style={{ imageRendering: 'auto' }}
              />
            ) : (
              <div key="no-slides" className="absolute inset-0 flex items-center justify-center border border-white/5">
                <p className="text-zinc-600 font-medium">等待投影片上傳...</p>
              </div>
            )}
          </AnimatePresence>

          {/* 繪圖層 */}
          <canvas
            ref={canvasRef} 
            width={1920} 
            height={1080}
            className={cn(
              "absolute inset-0 z-10 w-full h-full pointer-events-auto", 
              tool === 'pan' ? "cursor-grab" : "cursor-crosshair"
            )}
            onPointerDown={handleMouseDown} 
            onPointerMove={handleMouseMove} 
            onPointerUp={handleMouseUp} 
            onWheel={handleWheel}
          />

          {/* 熱區 */}
          {hotspots[currentPage]?.map((spot, idx) => (
            <button key={`spot-${currentPage}-${idx}`} className="absolute border border-dashed border-blue-400/30 bg-blue-500/5 hover:bg-blue-500/20 z-20 pointer-events-auto"
              style={{ 
                left: `${spot.x}%`, 
                top: `${spot.y}%`, 
                width: `${spot.width}%`, 
                height: `${spot.height}%`
              }}
              onClick={() => handleExternalLink(spot.url)}
            />
          ))}
        </div>

        {/* 頁碼 HUD */}
        <div className="absolute top-8 right-6 text-7xl font-light text-zinc-100/10 pointer-events-none z-0">
          {currentPage.toString().padStart(2, '0')}/{totalPages.toString().padStart(2, '0')}
        </div>
      </main>



      {/* 底部功能列 */}
      <AnimatePresence>
        {isFooterVisible && (
          <motion.footer 
            key="footer"
            initial={{ y: 100, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 150 }}
            className="fixed bottom-6 inset-x-0 mx-auto w-fit min-w-[360px] h-16 bg-zinc-900/10 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center px-8 justify-between z-50 shadow-2xl hover:bg-zinc-900/40 transition-colors duration-500"
          >
            <div className="flex items-center gap-6 text-white">
              <button onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1} className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-20 transition-all active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black font-mono tracking-tighter">{currentPage}</span>
                <span className="text-[10px] text-zinc-500 font-bold opacity-60">/</span>
                <span className="text-xs text-zinc-400 font-bold">{totalPages}</span>
              </div>
              <button onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-20 transition-all active:scale-90"><ChevronRight className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={downloadCanvas} title="下載目前頁面內容" className="p-2 text-zinc-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><Download className="w-5 h-5" /></button>
              <div className="w-px h-6 bg-white/10 mx-1"></div>
              <button 
                onClick={() => setIsFooterVisible(false)} 
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" 
                title="隱藏"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>

      {/* 全螢幕 QR Code */}
      <AnimatePresence>
        {showFullScreenQR && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFullScreenQR(false)}
            className="fixed inset-0 z-[300] bg-zinc-950/95 backdrop-blur-3xl flex flex-col items-center justify-center p-10 cursor-pointer"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="bg-white p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[3rem] shadow-4xl relative flex flex-col items-center gap-4 max-h-[85vh] w-fit"
            >
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(getShareableUrl(window.location.href))}`} 
                alt="Full QR" 
                className="w-auto h-auto max-w-[70vw] max-h-[45vh] sm:max-h-[55vh] object-contain rounded-lg"
              />
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullScreenQR(false);
                }}
                className="w-full py-2.5 sm:py-3.5 bg-zinc-900 text-white text-sm sm:text-base font-black rounded-xl shadow-2xl hover:bg-zinc-800 transition-all active:scale-95 flex items-center justify-center gap-2 border border-white/10 shrink-0"
              >
                <X className="w-4 h-4" />
                離開此畫面
              </button>
            </motion.div>
            <div className="mt-8 text-center shrink-0">
              <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight uppercase">掃描加入互動</h2>
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">點擊背景關閉此視窗</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 密碼驗證 Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <motion.div 
            key="password-modal"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full flex flex-col gap-6"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-blue-600/20 text-blue-500 rounded-2xl flex items-center justify-center mb-2">
                  <RotateCw className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold font-sans">身分驗證</h3>
                <p className="text-zinc-400 text-sm text-center">請輸入管理密碼以切換為講師身分</p>
              </div>

              <div className="flex flex-col gap-2">
                <input 
                  type="password"
                  autoFocus
                  placeholder="輸入管理密碼..."
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (passwordInput === 'admin123') {
                        handleLoginSuccess();
                      } else {
                        setPasswordError(true);
                      }
                    } else if (e.key === 'Escape') {
                      setIsPasswordModalOpen(false);
                      setPasswordInput('');
                    }
                  }}
                  className={cn(
                    "w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-blue-500/50",
                    passwordError && "border-red-500 focus:ring-red-500/50"
                  )}
                />
                {passwordError && (
                  <p className="text-red-500 text-[10px] font-bold px-1 mt-1">密碼錯誤，請再試一次</p>
                )}
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setPasswordInput('');
                    setPasswordError(false);
                  }}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-all text-sm"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    if (passwordInput === 'admin123') {
                      handleLoginSuccess();
                    } else {
                      setPasswordError(true);
                    }
                  }}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all text-sm"
                >
                  確認
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 簡報管理中心 */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div key="settings-modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] bg-zinc-950/98 backdrop-blur-3xl p-8 overflow-hidden flex flex-col">
            <div className="w-full h-full flex flex-col max-w-[1600px] mx-auto">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-2xl shadow-emerald-600/20">
                    <Grid className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-white">簡報管理中心</h2>
                    <p className="text-zinc-500 text-[10px] mt-0.5 font-medium">✦ 點選簡報以切換播放，或點擊「+」上傳新簡報</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative group">
                    <input 
                      type="text" 
                      placeholder="搜尋簡報..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500/50 transition-all w-72"
                    />
                    <Search className="absolute right-3 top-2.5 w-4 h-4 text-zinc-600 group-focus-within:text-emerald-500 transition-colors" />
                  </div>
                  
                  <div className="flex items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
                    <button 
                      onClick={handleExportBackup}
                      className="p-1.5 hover:bg-emerald-500/10 text-zinc-400 hover:text-emerald-400 rounded-lg transition-all flex items-center gap-1.5"
                      title="匯出資料庫備份 (JSON)"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-[10px] font-bold px-1 hidden sm:inline">匯出備份</span>
                    </button>
                    <div className="w-[1px] h-4 bg-zinc-800 mx-0.5" />
                    <label className="p-1.5 hover:bg-blue-500/10 text-zinc-400 hover:text-blue-400 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer" title="從備份檔還原/裝載雲端">
                      <Upload className="w-4 h-4" />
                      <span className="text-[10px] font-bold px-1 hidden sm:inline">還原裝載</span>
                      <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                    </label>
                  </div>

                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="p-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg active:scale-95"
                    title="新增簡報"
                  >
                    <Plus className="w-5 h-5 text-white" />
                  </button>
                  <button onClick={() => setIsSettingsOpen(false)} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 簡報列表 */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handlePresentationDragEnd}
                >
                  <SortableContext 
                    items={presentations
                      .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((p, idx) => p.id || `p-${idx}`)
                    }
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pb-12">
                      {presentations
                        .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((p, idx) => (
                        <SortablePresentationCard 
                          key={p.id || `p-${idx}`}
                          p={p}
                          idx={idx}
                          currentPresentationId={currentPresentationId}
                          editingId={editingId}
                          editingName={editingName}
                          setEditingName={setEditingName}
                          setEditingId={setEditingId}
                          renamePresentation={renamePresentation}
                          openSlideEditor={openSlideEditor}
                          selectPresentation={selectPresentation}
                          deletePresentation={deletePresentation}
                          deleteConfirmId={deleteConfirmId}
                          setDeleteConfirmId={setDeleteConfirmId}
                          getSlideUrl={getSlideUrl}
                        />
                      ))}
                      
                      {/* 新增按鈕內聯 */}
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="group border-2 border-dashed border-zinc-800 rounded-xl aspect-video flex flex-col items-center justify-center gap-3 hover:border-zinc-700 hover:bg-zinc-900/30 transition-all opacity-60 hover:opacity-100"
                      >
                        <div className="w-8 h-8 bg-zinc-900 text-zinc-500 rounded-full flex items-center justify-center group-hover:bg-emerald-600/20 group-hover:text-emerald-500 transition-all">
                          <Plus className="w-4 h-4" />
                        </div>
                        <span className="text-zinc-500 font-bold text-[10px]">新增簡報</span>
                      </button>
                    </div>
                  </SortableContext>
                </DndContext>
              </div>

              {/* 投影片內頁編輯器 */}
              <AnimatePresence>
                {editingPresentation && (
                  <motion.div 
                    key="slide-editor"
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="absolute inset-0 z-20 bg-zinc-950 flex flex-col p-8"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-4">
                        <button onClick={() => setEditingPresentation(null)} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div>
                          <h3 className="text-lg font-black flex items-center gap-2">
                            <span className="text-emerald-500">正在修改：</span>
                            {editingPresentation.name}
                          </h3>
                          <p className="text-zinc-500 text-[10px] mt-0.5">拖曳圖片可調整順序 ✦ 點擊垃圾桶可刪除投影片</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => slideEditInputRef.current?.click()}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-xl shadow-emerald-600/10"
                        >
                          <Plus className="w-4 h-4" />
                          追加投影片
                        </button>
                        <button onClick={() => setEditingPresentation(null)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-bold">
                          完成關閉
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                       <DndContext 
                        sensors={sensors} 
                        collisionDetection={closestCenter} 
                        onDragEnd={handleSlideDragEnd}
                      >
                        <SortableContext items={tempSlides.map((s, idx) => s.id || `temp-${idx}`)} strategy={rectSortingStrategy}>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                            {tempSlides.map((item, idx) => (
                              <SortableSlide 
                                key={item.id || `temp-${idx}`} 
                                item={item} 
                                isCurrent={false}
                                onNavigate={() => {}}
                                onDoubleClick={() => deleteSlide(editingPresentation.id, item)}
                                onDelete={() => deleteSlide(editingPresentation.id, item)}
                                onEditMetadata={() => {
                                  setEditingMetadataSlide({ id: item.id, index: item.originalIndex });
                                  setMetadataInputs(editingPresentation.slidesData?.[item.originalIndex] || {});
                                }}
                                timestamp={slideTimestamp}
                                role="presenter"
                                currentPresentationId={editingPresentation.id}
                                getSlideUrl={getSlideUrl}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 投影片附加功能編輯 Modal */}
      <AnimatePresence>
        {editingMetadataSlide && (
          <motion.div key="metadata-editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] shadow-2xl max-w-sm w-full flex flex-col gap-5 border-t-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">頁面附加功能</h3>
                  <p className="text-zinc-500 text-[10px] font-bold">第 {editingMetadataSlide.index} 頁 ✦ 互動設定</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Link - 超連結網站</label>
                    <button 
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setMetadataInputs(prev => ({ ...prev, link: text }));
                        } catch (e) {
                          console.error('貼上失敗');
                        }
                      }}
                      className="text-[9px] font-bold text-emerald-500 hover:text-emerald-400"
                    >
                      貼上
                    </button>
                  </div>
                  <input 
                    type="url" 
                    placeholder="https://..." 
                    value={metadataInputs.link || ''}
                    onChange={(e) => setMetadataInputs({ ...metadataInputs, link: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-2 text-xs outline-none focus:border-blue-500/50 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">YouTube - 影片連結</label>
                    <button 
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          setMetadataInputs(prev => ({ ...prev, youtube: text }));
                        } catch (e) {
                          console.error('貼上失敗');
                        }
                      }}
                      className="text-[9px] font-bold text-emerald-500 hover:text-emerald-400"
                    >
                      貼上
                    </button>
                  </div>
                  <input 
                    type="url" 
                    placeholder="https://youtube.com/..." 
                    value={metadataInputs.youtube || ''}
                    onChange={(e) => setMetadataInputs({ ...metadataInputs, youtube: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-2 text-xs outline-none focus:border-red-500/50 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">影音 - 完整播放路徑</label>
                    <div className="flex gap-3 items-center">
                      <button 
                        onClick={() => mediaInputRef.current?.click()}
                        className="text-[11px] font-black px-4 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 active:scale-95 transition-all shadow-xl flex items-center gap-1.5"
                      >
                        <Plus className="w-3 h-3" />
                        瀏覽
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            setMetadataInputs(prev => ({ ...prev, media: text }));
                          } catch (e) {
                            console.error('貼上失敗');
                          }
                        }}
                        className="text-[9px] font-bold text-emerald-500 hover:text-emerald-400"
                      >
                        貼上
                      </button>
                    </div>
                  </div>
                  <input 
                    type="text" 
                    placeholder="請輸入電腦完整路徑 (例如 C:\Media\Video.mp4)" 
                    value={metadataInputs.media || ''}
                    onChange={(e) => setMetadataInputs({ ...metadataInputs, media: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-2 text-xs outline-none focus:border-purple-500/50 transition-all font-mono"
                  />
                  <div className="px-2">
                    <p className="text-[9px] text-zinc-500 leading-tight">
                      ✦ 瀏覽器受限安全機制無法自動取得檔案完整路徑。
                      <br />
                      ✦ 請手動在前方補齊完整資料夾路徑，以便 Windows 使用預設程式開啟。
                    </p>
                  </div>
                  <input 
                    type="file" 
                    ref={mediaInputRef} 
                    onChange={handleMediaUpload} 
                    className="hidden" 
                    accept="video/*,audio/*,image/*,.pdf"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-1">Tips - 演講提示</label>
                  <textarea 
                    placeholder="輸入提示內容..." 
                    rows={2}
                    value={metadataInputs.tips || ''}
                    onChange={(e) => setMetadataInputs({ ...metadataInputs, tips: e.target.value })}
                    className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-2 text-xs outline-none focus:border-amber-500/50 transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditingMetadataSlide(null)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-all text-xs text-zinc-400">取消</button>
                <button onClick={saveMetadata} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all text-xs text-white shadow-xl shadow-emerald-600/20">儲存</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <input 
        type="file" 
        ref={slideEditInputRef} 
        onChange={handleAddSlidesToExisting} 
        className="hidden" 
        accept=".jpg, .jpeg, .png, .bmp, .webp, .gif, .tiff" 
        multiple 
      />

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleUploadNew} 
        className="hidden" 
        accept=".pptx, .jpg, .jpeg, .png, .bmp, .webp, .gif, .tiff" 
        multiple 
      />

      {/* 網格總覽 */}
      <AnimatePresence>
        {isGridOpen && (
          <motion.div key="grid-overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-zinc-950/98 backdrop-blur-3xl p-12 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              <div className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/20">
                    <Grid className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">簡報總覽 <span className="ml-2 text-zinc-500 font-normal">({totalPages} 張投影片)</span></h2>
                    <p className="text-zinc-500 text-xs mt-1">
                      {role === 'presenter' ? '✦ 快按兩下跳至該頁面，拖拉可改變投影片順序' : '✦ 快按兩下跳至該頁面'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsGridOpen(false)} className="p-4 bg-zinc-900 border border-zinc-800 rounded-full hover:bg-zinc-800 transition-all hover:scale-110">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={gridItems.map((i, idx) => i.id || `grid-${idx}`)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 pb-24">
                    {gridItems.map((item, idx) => (
                      <SortableSlide 
                        key={item.id || `grid-${idx}`}
                        item={item}
                        isCurrent={currentPage === item.originalIndex}
                        onNavigate={() => changePage(item.originalIndex)}
                        onDoubleClick={() => { changePage(item.originalIndex); setIsGridOpen(false); }}
                        onEditMetadata={role === 'presenter' ? () => {
                          const currentP = presentations.find(p => p.id === currentPresentationId);
                          if (currentP) {
                            setEditingMetadataSlide({ id: item.id, index: item.originalIndex });
                            setMetadataInputs(currentP.slidesData?.[item.originalIndex] || {});
                            setEditingPresentation(currentP); // Ensure we have reference for saveMetadata
                          }
                        } : undefined}
                        timestamp={slideTimestamp}
                        role={role}
                        currentPresentationId={currentPresentationId}
                        getSlideUrl={getSlideUrl}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 附加功能鈕 (Link/Youtube/影音/Tips) - 僅在投影片播放頁面且非編輯/網格/設定模式，且底欄隱藏時顯示 */}
      <AnimatePresence>
        {currentPresentationId && !isFooterVisible && !(isGridOpen || editingMetadataSlide || isAppShrunk || isSettingsOpen) && (
          <motion.div 
            key="floating-tools"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed right-64 bottom-5 flex flex-row-reverse items-center gap-3 z-[110] pointer-events-none"
          >
            <AnimatePresence>
              {role === 'presenter' && currentMetadata && currentMetadata.tips && (
                <motion.div key="tips-btn" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative group pointer-events-auto">
                  <button 
                    onClick={() => setShowTips(!showTips)}
                    title="演講提示 (Tips)"
                    className={cn(
                      "w-12 h-12 rounded-full backdrop-blur-2xl border-2 transition-all flex items-center justify-center shadow-2xl active:scale-95 text-xs font-black uppercase tracking-tighter shadow-amber-500/20",
                      showTips ? "bg-amber-500 text-white border-amber-400" : "bg-zinc-900/80 text-amber-500 border-amber-500/50 hover:bg-amber-500/20"
                    )}
                  >
                    Tips
                  </button>
                  {showTips && (
                    <motion.div 
                      key="tips-content"
                      initial={{ opacity: 0, scale: 0.9, y: -10 }} 
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      onClick={() => setShowTips(false)}
                      className="absolute right-0 bottom-12 w-80 bg-zinc-950/20 backdrop-blur-3xl border border-white/10 p-5 rounded-2xl text-white text-sm font-medium shadow-2xl leading-relaxed ring-1 ring-white/5 cursor-pointer hover:bg-zinc-900/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
                        <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-200/80">Speaker Tips</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto custom-scrollbar pr-2 whitespace-pre-wrap text-zinc-200">
                        {currentMetadata.tips}
                      </div>
                      <div className="mt-4 pt-2 border-t border-white/5 text-[9px] text-zinc-500 flex justify-between items-center italic">
                        <span>點擊區塊即可快速關閉</span>
                        <X className="w-2.5 h-2.5" />
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
              {role === 'presenter' && currentMetadata && currentMetadata.media && (
                <motion.button 
                  key="media-btn"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  onClick={() => {
                    try {
                      handleExternalLink(currentMetadata.media!);
                    } catch {
                      console.error('播放失敗');
                    }
                  }}
                  title="播放影音 (Media)"
                  className="w-12 h-12 rounded-full bg-zinc-900/80 backdrop-blur-2xl border-2 border-purple-500/50 text-purple-400 hover:bg-purple-500 hover:text-white transition-all flex items-center justify-center shadow-2xl active:scale-95 text-base font-black pointer-events-auto shadow-purple-500/20"
                >
                  <Play className="w-5 h-5 fill-current" />
                </motion.button>
              )}
              {currentMetadata && currentMetadata.youtube && (
                <motion.button 
                  key="youtube-btn"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  onClick={() => handleExternalLink(currentMetadata.youtube!)}
                  title="播放 YouTube (Youtube)"
                  className="px-5 h-12 rounded-full bg-zinc-900/80 backdrop-blur-2xl border-2 border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shadow-2xl active:scale-95 text-sm font-black uppercase pointer-events-auto shadow-red-500/20"
                >
                  Youtube
                </motion.button>
              )}
              {currentMetadata && currentMetadata.link && (
                <motion.button 
                  key="link-btn"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                  onClick={() => handleExternalLink(currentMetadata.link!)}
                  title="連結網站 (Link)"
                  className="px-5 h-12 rounded-full bg-zinc-900/80 backdrop-blur-2xl border-2 border-blue-500/50 text-blue-400 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center shadow-2xl active:scale-95 text-sm font-black uppercase pointer-events-auto shadow-blue-500/20"
                >
                  Link
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 回復全螢幕浮動按鈕 - 置於最外層以防縮放 */}
      <AnimatePresence>
        {isAppShrunk && (
          <motion.div 
            key="shrink-overlay"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="fixed left-8 top-1/2 -translate-y-1/2 z-[300]"
          >
            <button 
              onClick={() => setIsAppShrunk(false)}
              className="group relative flex flex-col items-center gap-4"
            >
              <div className="w-24 h-24 bg-emerald-600 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.5)] border-4 border-white/30 hover:scale-110 active:scale-95 transition-all duration-300">
                <Maximize2 className="w-10 h-10 text-white" />
              </div>
              <span className="bg-emerald-600 px-5 py-2.5 rounded-full text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl border border-white/20 whitespace-nowrap">
                回全螢幕簡報
              </span>
              
              <div className="absolute -inset-6 border-4 border-emerald-500/30 rounded-full animate-ping pointer-events-none" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audience Name Modal */}
      <AnimatePresence>
        {isNameModalOpen && !isSessionExpired && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[3000] bg-zinc-950/95 backdrop-blur-2xl flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-zinc-900 border border-white/10 p-10 rounded-[3rem] shadow-3xl max-w-md w-full flex flex-col gap-8 border-t-white/20"
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 bg-blue-500/20 rounded-3xl flex items-center justify-center border border-blue-500/30 transform rotate-12">
                  <span className="text-4xl text-blue-400 font-black">?</span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-white tracking-tight">您好！</h3>
                  <p className="text-zinc-400 font-medium">請輸入您的稱呼以加入簡報</p>
                </div>
              </div>

              <div className="space-y-4">
                <input 
                  autoFocus
                  type="text" 
                  placeholder="輸入您的名字..."
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onKeyUp={(e) => {
                    if (e.key === 'Enter' && userName.trim()) {
                      localStorage.setItem('audience_name', userName.trim());
                      setIsNameModalOpen(false);
                    }
                  }}
                  className="w-full bg-zinc-950 border-2 border-zinc-800 rounded-2xl px-6 py-4 text-white text-lg font-bold focus:border-blue-500 outline-none transition-colors placeholder:text-zinc-700"
                />
                <button 
                  disabled={!userName.trim()}
                  onClick={() => {
                    if (userName.trim()) {
                      localStorage.setItem('audience_name', userName.trim());
                      setIsNameModalOpen(false);
                    }
                  }}
                  className="w-full py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-black rounded-2xl transition-all shadow-[0_20px_50px_rgba(37,99,235,0.3)] active:scale-95 text-lg"
                >
                  開始參與
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session Expired Modal */}
      <AnimatePresence>
        {isSessionExpired && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="fixed inset-0 z-[2000] bg-zinc-950/90 backdrop-blur-3xl flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] shadow-3xl max-w-sm w-full text-center flex flex-col items-center gap-6"
            >
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                <Clock className="w-10 h-10 text-red-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white tracking-tight">連線逾時</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  為了確保系統效能，觀眾連線限制為 2 小時。請重新整理頁面以繼續參與。
                </p>
              </div>
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-white text-zinc-950 font-black rounded-2xl hover:bg-zinc-200 transition-colors shadow-xl active:scale-95"
              >
                重新整理
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000] bg-zinc-900/90 backdrop-blur-2xl border border-white/10 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
              <Play className="w-4 h-4 text-white fill-current" />
            </div>
            <p className="text-white font-bold text-sm tracking-tight">{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
