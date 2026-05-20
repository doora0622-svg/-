/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Settings, 
  Maximize, 
  Minimize, 
  Plus, 
  Trash2, 
  X, 
  ChevronLeft, 
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Clock,
  Users,
  Shield,
  ShieldAlert,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- 常數定義 ---
const STORAGE_KEY_SCHEDULE = 'proctor_clock_schedule';
const STORAGE_KEY_SETTINGS = 'proctor_clock_settings';
const STORAGE_KEY_ATTENDANCE = 'proctor_clock_attendance';

interface ScheduleItem {
  id: string;
  period: string;
  subject: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

interface AppSettings {
  showSeconds: boolean;
  digitColor: string;
  cardBg: string;
  pageBg: string;
  fontFamily: string;
  enableWakeLock?: boolean;
}

// --- 輔助函數 ---
const formatDigit = (num: number) => num.toString().padStart(2, '0');

// --- 數位數字組件 ---
const DigitUnit = ({ value, color, bg, font }: { value: string, color: string, bg: string, font: string }) => {
  return (
    <div className="digit-card text-[12vw] md:text-[10vw] leading-none font-bold" style={{ color, backgroundColor: bg, fontFamily: font }}>
      {value}
    </div>
  );
};

export default function App() {
  // --- 狀態宣告 ---
  const [time, setTime] = useState(new Date());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockError, setWakeLockErrorState] = useState<'permission' | 'not-supported' | 'error' | null>(null);
  const wakeLockErrorRef = useRef<'permission' | 'not-supported' | 'error' | null>(null);
  const wakeLockRef = useRef<any>(null);

  const setWakeLockError = useCallback((val: 'permission' | 'not-supported' | 'error' | null) => {
    wakeLockErrorRef.current = val;
    setWakeLockErrorState(val);
  }, []);
  
  // 設定狀態
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    const defaults = {
      showSeconds: true,
      digitColor: '#ffffff',
      cardBg: '#1e1e1e',
      pageBg: '#0a0a0a',
      fontFamily: 'var(--font-montserrat)',
      enableWakeLock: true
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaults, ...parsed };
      } catch (err) {
        return defaults;
      }
    }
    return defaults;
  });

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // 考程狀態
  const [schedule, setSchedule] = useState<ScheduleItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SCHEDULE);
    return saved ? JSON.parse(saved) : [
      { id: '1', period: '一', subject: '國文', startTime: '08:40', endTime: '10:00' },
      { id: '2', period: '二', subject: '數學', startTime: '10:20', endTime: '11:40' }
    ];
  });

  // 人數狀態
  const [attendance, setAttendance] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
    return saved ? JSON.parse(saved) : { total: 25, absent: 0 };
  });

  const [activeCounter, setActiveCounter] = useState<'total' | 'absent' | null>(null);
  const counterTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Screen Wake Lock 螢幕不休眠鎖定 ---
  const requestWakeLock = useCallback(async (isManual = false) => {
    // 若設定中並未啟用防休眠鎖，且不是點擊手動嘗試，則不自動發起
    if (!isManual && settingsRef.current.enableWakeLock === false) {
      return;
    }

    if (!('wakeLock' in navigator)) {
      setWakeLockError('not-supported');
      return;
    }
    
    // 如果已知在當前環境無權限（如 iframe 中）或不支援，且不是用戶點擊手動操作，則不發起請求避免反覆報錯
    if (!isManual && (wakeLockErrorRef.current === 'permission' || wakeLockErrorRef.current === 'not-supported')) {
      return;
    }

    // 如果已經啟用鎖定，先不重複請求
    if (wakeLockRef.current) return;

    try {
      const lock = await (navigator as any).wakeLock.request('screen');
      wakeLockRef.current = lock;
      setWakeLockActive(true);
      setWakeLockError(null);

      // 監聽釋放事件 (例如系統或瀏覽器強行釋放鎖定時)
      lock.addEventListener('release', () => {
        wakeLockRef.current = null;
        setWakeLockActive(false);
        console.log('Wake Lock was released by the system.');
      });
      console.log('Wake Lock has been successfully acquired.');
    } catch (err: any) {
      setWakeLockActive(false);
      const isPermError = err.name === 'SecurityError' || err.message?.includes('permissions policy') || err.message?.includes('disallowed');
      if (isPermError) {
        setWakeLockError('permission');
        console.log('Wake lock is disallowed in this sandbox context. Open in a new tab to enable it fully.');
      } else {
        setWakeLockError('error');
        console.log(`Failed to acquire Wake Lock: ${err.message}`);
      }
    }
  }, [setWakeLockError]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setWakeLockActive(false);
        console.log('Wake Lock has been manually released.');
      } catch (err: any) {
        console.log(`Error releasing Wake Lock: ${err.message}`);
      }
    }
  }, []);

  const handleWakeLockToggle = useCallback(() => {
    if (wakeLockActive) {
      releaseWakeLock();
    } else {
      requestWakeLock(true); // manual attempt
    }
  }, [wakeLockActive, requestWakeLock, releaseWakeLock]);

  // --- 週期性與事件邏輯 ---
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    // 初始化自動請求防休眠
    requestWakeLock();

    // 處理頁面可見度改變 (切換分頁或鎖屏後回來自動重取)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };

    // 由於行動裝置 iOS/Safari 等常有硬性手勢互動限制，添加用戶點擊互動即嘗試重新喚醒 Wake Lock
    const handleUserInteraction = () => {
      requestWakeLock();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      releaseWakeLock();
    };
  }, [requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    // Apply dynamic body background
    document.documentElement.style.setProperty('--bg-color', settings.pageBg);
    document.documentElement.style.setProperty('--card-bg', settings.cardBg);
    document.documentElement.style.setProperty('--text-color', settings.digitColor);
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(attendance));
  }, [attendance]);

  // --- 全螢幕控制 ---
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  // --- 計數器控制 ---
  const startCounterTimeout = useCallback(() => {
    if (counterTimerRef.current) clearTimeout(counterTimerRef.current);
    counterTimerRef.current = setTimeout(() => {
      setActiveCounter(null);
    }, 3000);
  }, []);

  const handleCounterClick = (type: 'total' | 'absent') => {
    setActiveCounter(type);
    startCounterTimeout();
  };

  const adjustAttendance = (type: 'total' | 'absent', delta: number) => {
    setAttendance(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type] + delta)
    }));
    startCounterTimeout();
  };

  // --- 考程重新排列與排序功能 ---
  const moveScheduleItem = useCallback((index: number, direction: 'up' | 'down') => {
    setSchedule(prev => {
      const newSched = [...prev];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= newSched.length) return prev;
      
      // Swap
      const temp = newSched[index];
      newSched[index] = newSched[targetIdx];
      newSched[targetIdx] = temp;
      return newSched;
    });
  }, []);

  const sortScheduleChronologically = useCallback(() => {
    setSchedule(prev => {
      const sorted = [...prev].sort((a, b) => {
        if (a.startTime < b.startTime) return -1;
        if (a.startTime > b.startTime) return 1;
        return 0;
      });
      return sorted;
    });
  }, []);

  // --- 考程邏輯：比對當前時間 ---
  const currentExam = schedule.find(item => {
    const now = `${formatDigit(time.getHours())}:${formatDigit(time.getMinutes())}`;
    return now >= item.startTime && now <= item.endTime;
  });

  // --- 時鐘數字解析 ---
  const hours = formatDigit(time.getHours() % 12 || 12);
  const minutes = formatDigit(time.getMinutes());
  const seconds = formatDigit(time.getSeconds());

  return (
    <div className="flex flex-col h-screen w-full transition-colors duration-500 overflow-hidden relative" style={{ backgroundColor: settings.pageBg }}>
      
      {/* 頂部按鈕：設定與全螢幕 */}
      <div className="absolute top-4 right-4 z-50 flex items-center space-x-4 opacity-25 hover:opacity-100 transition-opacity">
        <div 
          onClick={handleWakeLockToggle}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer backdrop-blur-md border transition-all ${
            wakeLockActive 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : wakeLockError === 'permission'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                : wakeLockError === 'not-supported'
                  ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
          }`}
          title={
            wakeLockActive 
              ? "防螢幕休眠鎖定中，設備將維持在亮屏狀態" 
              : wakeLockError === 'permission'
                ? "目前處於內嵌預覽視窗，權限受限。請點擊右上角「在新分頁開啟」以順利啟用防休眠功能"
                : wakeLockError === 'not-supported'
                  ? "此設備瀏覽器不支援螢幕喚醒鎖定 API"
                  : "防螢幕休眠未啟用，點擊啟用防休眠保護"
          }
        >
          {wakeLockActive ? (
            <Shield size={14} className="animate-pulse text-emerald-400" />
          ) : (
            <ShieldAlert size={14} className={wakeLockError === 'permission' ? "text-rose-400" : "text-amber-400"} />
          )}
          <span className="hidden sm:inline">
            {wakeLockActive 
              ? '防休眠保護中' 
              : wakeLockError === 'permission'
                ? '防休眠受限 (請點右上在新分頁開啟)'
                : wakeLockError === 'not-supported'
                  ? '不支援防休眠'
                  : '未啟用防休眠'}
          </span>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 hover:bg-white/10 rounded-full cursor-pointer text-white">
          <Settings size={28} />
        </button>
        <button onClick={toggleFullScreen} className="p-2 hover:bg-white/10 rounded-full cursor-pointer text-white">
          {isFullScreen ? <Minimize size={28} /> : <Maximize size={28} />}
        </button>
      </div>

      {/* 區塊 1/3：數位時鐘 */}
      <div className="h-1/3 flex items-center justify-center pt-4">
        <div className="flex items-center space-x-1 md:space-x-2">
          <div className="flex">
            <DigitUnit value={hours[0]} color={settings.digitColor} bg={settings.cardBg} font={settings.fontFamily} />
            <DigitUnit value={hours[1]} color={settings.digitColor} bg={settings.cardBg} font={settings.fontFamily} />
          </div>
          
          <div className="text-[8vw] text-white opacity-30 font-light">:</div>
          
          <div className="flex">
            <DigitUnit value={minutes[0]} color={settings.digitColor} bg={settings.cardBg} font={settings.fontFamily} />
            <DigitUnit value={minutes[1]} color={settings.digitColor} bg={settings.cardBg} font={settings.fontFamily} />
          </div>
          
          {settings.showSeconds && (
            <>
              <div className="text-[8vw] text-white opacity-30 font-light">:</div>
              <div className="flex">
                <DigitUnit value={seconds[0]} color={settings.digitColor} bg={settings.cardBg} font={settings.fontFamily} />
                <DigitUnit value={seconds[1]} color={settings.digitColor} bg={settings.cardBg} font={settings.fontFamily} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 區塊 2/3：考程自動顯示 */}
      <div className="h-1/3 flex items-center justify-center px-10">
        <AnimatePresence mode="wait">
          {currentExam ? (
            <motion.div 
              key={currentExam.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-2xl md:text-3xl font-bold text-blue-400 tracking-wider text-center flex flex-nowrap justify-center gap-4 whitespace-nowrap"
            >
              <span className="bg-blue-900/30 px-3 py-1 rounded-lg border border-blue-500/30">第 {currentExam.period} 節</span>
              <span className="bg-blue-900/30 px-3 py-1 rounded-lg border border-blue-500/30">{currentExam.subject}</span>
              <span className="bg-blue-900/30 px-3 py-1 rounded-lg border border-blue-500/30">{currentExam.startTime} ~ {currentExam.endTime}</span>
            </motion.div>
          ) : (
            <motion.div 
              key="no-exam"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              className="text-2xl italic text-gray-500"
            >
              目前無進行中之考試項目
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 區塊 3/3：點名計算器 */}
      <div className="h-1/3 flex flex-col items-center justify-center relative">
        <div className="flex flex-row items-center justify-center gap-6 md:gap-12 text-xl md:text-3xl font-medium text-gray-300">
          <div className="flex items-center space-x-2">
            <span>全班人數：</span>
            <button 
              onClick={() => handleCounterClick('total')}
              className={`font-black text-3xl md:text-4xl px-3 py-0.5 rounded-lg transition-all ${activeCounter === 'total' ? 'bg-white/20 scale-110' : 'hover:bg-white/5'}`}
              style={{ color: settings.digitColor }}
            >
              {attendance.total}
            </button>
            <span className="text-gray-500">人。</span>
          </div>

          <div className="flex items-center space-x-2">
            <span>缺考人數：</span>
            <button 
              onClick={() => handleCounterClick('absent')}
              className={`font-black text-3xl md:text-4xl px-3 py-0.5 rounded-lg transition-all ${activeCounter === 'absent' ? 'bg-red-500/20 scale-110' : 'hover:bg-white/5'}`}
              style={{ color: settings.digitColor === '#ffffff' ? '#ff5555' : settings.digitColor }}
            >
              {attendance.absent}
            </button>
            <span className="text-gray-500">人。</span>
          </div>
        </div>

        {/* 懸浮數值調整器 */}
        <AnimatePresence>
          {activeCounter && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute bottom-24 bg-gray-800 border border-gray-700 p-6 rounded-2xl shadow-2xl flex items-center space-x-8 z-40"
              onMouseEnter={() => { if (counterTimerRef.current) clearTimeout(counterTimerRef.current); }}
              onMouseLeave={startCounterTimeout}
            >
              <button 
                onClick={() => adjustAttendance(activeCounter, -1)}
                className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center hover:bg-red-500 transition-colors"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ChevronLeft size={32} />
              </button>
              
              <div className="flex flex-col items-center">
                <span className="text-sm text-gray-400 mb-2">{activeCounter === 'total' ? '全班人數' : '缺考人數'}</span>
                <span className="text-5xl font-black">{attendance[activeCounter]}</span>
              </div>

              <button 
                onClick={() => adjustAttendance(activeCounter, 1)}
                className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center hover:bg-green-500 transition-colors"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <ChevronRight size={32} />
              </button>

              <div className="w-48 ml-4 flex flex-col items-center gap-4">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={attendance[activeCounter]} 
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setAttendance(prev => ({ ...prev, [activeCounter]: val }));
                    startCounterTimeout();
                  }}
                  className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <button 
                  onClick={() => setActiveCounter(null)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full text-lg font-bold transition-colors w-full"
                >
                  確定
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- 設定面板彈窗 --- */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute right-0 top-0 h-full w-full md:w-[450px] bg-gray-900 shadow-2xl overflow-y-auto z-[100] border-l border-white/10"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <Settings className="text-blue-500" /> 客製化設定面板
                </h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X />
                </button>
              </div>

              {/* 外觀設定 */}
              <section className="mb-10 p-6 bg-white/5 rounded-2xl">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 border-b border-white/10 pb-2">樣式與色彩</h3>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span>顯示秒數</span>
                    <input 
                      type="checkbox" 
                      checked={settings.showSeconds}
                      onChange={(e) => setSettings({...settings, showSeconds: e.target.checked})}
                      className="w-6 h-6 rounded accent-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <div className="flex flex-col">
                      <span>啟用防螢幕休眠</span>
                      <span className="text-xs text-zinc-400">保持設備在監考期間開啟亮屏</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={settings.enableWakeLock !== false}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setSettings({...settings, enableWakeLock: enabled});
                        if (!enabled) {
                          releaseWakeLock();
                        } else {
                          // Try activating
                          setTimeout(() => requestWakeLock(true), 50);
                        }
                      }}
                      className="w-6 h-6 rounded accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-2 uppercase tracking-widest">數字顏色</label>
                        <input type="color" value={settings.digitColor} onChange={(e) => setSettings({...settings, digitColor: e.target.value})} className="w-full h-10 bg-transparent rounded cursor-pointer" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-2 uppercase tracking-widest">卡片背景</label>
                        <input type="color" value={settings.cardBg} onChange={(e) => setSettings({...settings, cardBg: e.target.value})} className="w-full h-10 bg-transparent rounded cursor-pointer" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2 uppercase tracking-widest">網頁主背景</label>
                    <input type="color" value={settings.pageBg} onChange={(e) => setSettings({...settings, pageBg: e.target.value})} className="w-full h-10 bg-transparent rounded cursor-pointer" />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-2 uppercase tracking-widest">顯示字體</label>
                    <select 
                      value={settings.fontFamily}
                      onChange={(e) => setSettings({...settings, fontFamily: e.target.value})}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="var(--font-montserrat)">Montserrat (極簡粗體)</option>
                      <option value="'Roboto', sans-serif">Roboto (標準無襯線)</option>
                      <option value="var(--font-mono)">Roboto Mono (等寬字體)</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* 考程管理 */}
              <section className="mb-10 p-6 bg-white/5 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-white/10 pb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">考程自動排程</h3>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button 
                    onClick={sortScheduleChronologically}
                    className="flex items-center gap-1 text-xs bg-zinc-800 hover:bg-zinc-700 hover:text-blue-400 border border-white/10 px-3 py-1.5 rounded-full transition-all cursor-pointer"
                    title="依開始時間先後順序自動排列考程"
                  >
                    <ArrowUpDown size={12} />
                    <span>依時間排序</span>
                  </button>
                  <button 
                    onClick={() => setSchedule([...schedule, { id: Date.now().toString(), period: '新', subject: '新考科', startTime: '12:00', endTime: '13:00' }])}
                    className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>新增考程</span>
                  </button>
                </div>
              </div>

                <div className="space-y-4">
                  {schedule.map((item, index) => (
                    <div key={item.id} className="p-4 bg-gray-800/50 rounded-xl border border-white/10 space-y-3 group relative">
                      {/* 右上角操作按鈕 tray (重新排列、刪除功能鍵) */}
                      <div className="absolute top-2 right-2 flex items-center space-x-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button 
                          disabled={index === 0}
                          onClick={() => moveScheduleItem(index, 'up')}
                          className="text-gray-400 hover:text-blue-400 disabled:text-gray-600 disabled:opacity-30 bg-gray-900/80 rounded p-1 border border-white/5 transition-colors cursor-pointer"
                          title="上移"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button 
                          disabled={index === schedule.length - 1}
                          onClick={() => moveScheduleItem(index, 'down')}
                          className="text-gray-400 hover:text-blue-400 disabled:text-gray-600 disabled:opacity-30 bg-gray-900/80 rounded p-1 border border-white/5 transition-colors cursor-pointer"
                          title="下移"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button 
                          onClick={() => setSchedule(schedule.filter(s => s.id !== item.id))}
                          className="text-red-400 hover:text-red-300 bg-gray-900/80 rounded p-1 border border-red-500/10 transition-colors cursor-pointer"
                          title="刪除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={item.period} 
                          onChange={(e) => {
                            const newSched = [...schedule];
                            newSched[index].period = e.target.value;
                            setSchedule(newSched);
                          }}
                          className="w-1/4 bg-gray-700 border border-gray-600 rounded p-1 text-sm text-center"
                          placeholder="第 X 節"
                        />
                        <input 
                          type="text" 
                          value={item.subject} 
                          onChange={(e) => {
                            const newSched = [...schedule];
                            newSched[index].subject = e.target.value;
                            setSchedule(newSched);
                          }}
                          className="w-3/4 bg-gray-700 border border-gray-600 rounded p-1 text-sm"
                          placeholder="考科名稱"
                        />
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock size={12} />
                        <input 
                          type="time" 
                          value={item.startTime} 
                          onChange={(e) => {
                            const newSched = [...schedule];
                            newSched[index].startTime = e.target.value;
                            setSchedule(newSched);
                          }}
                          className="bg-gray-700 border border-gray-600 rounded p-1"
                        />
                        <span>~</span>
                        <input 
                          type="time" 
                          value={item.endTime} 
                          onChange={(e) => {
                            const newSched = [...schedule];
                            newSched[index].endTime = e.target.value;
                            setSchedule(newSched);
                          }}
                          className="bg-gray-700 border border-gray-600 rounded p-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="mt-8 mb-4">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl text-xl font-bold shadow-lg transition-all active:scale-95"
                >
                  儲存並離開
                </button>
              </div>

              <div className="text-center text-xs text-gray-500 mt-6">
                PROCTOR CLOCK v1.0 • 資料已儲存於瀏覽器 LocalStorage
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 畫面右下防休眠提醒與新分頁導引 */}
      {settings.enableWakeLock !== false && (
        <div className="absolute bottom-4 right-4 z-40 max-w-xs md:max-w-sm bg-gray-900/90 backdrop-blur-md border border-white/15 rounded-2xl p-4 shadow-2xl text-white transition-all duration-300 hover:border-white/20">
          <div className="flex items-start gap-3">
            {wakeLockActive ? (
              <div className="bg-emerald-500/20 p-2 rounded-xl text-emerald-400 shrink-0">
                <Shield size={20} className="animate-pulse" />
              </div>
            ) : wakeLockError === 'permission' ? (
              <div className="bg-rose-500/20 p-2 rounded-xl text-rose-400 shrink-0">
                <ShieldAlert size={20} className="animate-bounce" />
              </div>
            ) : (
              <div className="bg-amber-500/20 p-2 rounded-xl text-amber-400 shrink-0">
                <ShieldAlert size={20} />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h4 className="text-xs md:text-sm font-bold flex items-center gap-1.5 text-gray-100">
                <span>防休眠狀態：</span>
                {wakeLockActive ? (
                  <span className="text-emerald-400 font-extrabold">防護中</span>
                ) : wakeLockError === 'permission' ? (
                  <span className="text-rose-400 font-extrabold">權限受限</span>
                ) : wakeLockError === 'not-supported' ? (
                  <span className="text-gray-400">不支援此設備</span>
                ) : (
                  <span className="text-amber-400">未啟用</span>
                )}
              </h4>
              
              <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">
                {wakeLockActive ? (
                  "考場守護功能已啟動！本設備在考試期間將會維持在亮屏狀態，不會進入休眠或螢幕保護模式。"
                ) : wakeLockError === 'permission' ? (
                  "目前正處於「內嵌預覽視窗」，系統不允許在內嵌框架中使用防休眠鎖定功能。請點擊下方按鈕或右上角「在新分頁開啟」，在新頁面即可啟用防休眠機制！"
                ) : wakeLockError === 'not-supported' ? (
                  "您當前的瀏覽器不支援 Screen Wake Lock。建議使用新版 Chrome、Safari、Safari iOS 或 Edge 瀏覽器以維持螢幕高亮亮屏。"
                ) : (
                  "防休眠鎖定尚未啟用，螢幕可能會因閒置進入省電模式。若需開啟，請點擊上方安全盾牌啟用。"
                )}
              </p>

              {/* 引導按鈕：如果是權限錯誤，則按此彈出新分頁 */}
              {wakeLockError === 'permission' && (
                <button
                  onClick={() => {
                    window.open(window.location.href, '_blank');
                  }}
                  className="mt-3 flex items-center justify-center gap-2 w-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white py-2 px-3 rounded-lg text-xs font-bold transition-all shadow-md hover:scale-[1.02] cursor-pointer"
                >
                  <ExternalLink size={14} />
                  <span>在新分頁開啟 (立即啟用防休眠)</span>
                </button>
              )}

              {/* 如果是未啟用 (手動啟用按鈕) */}
              {!wakeLockActive && !wakeLockError && (
                <button
                  onClick={() => requestWakeLock(true)}
                  className="mt-3 flex items-center justify-center gap-2 w-full bg-amber-600 hover:bg-amber-500 text-white py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <span>嘗試啟用防休眠</span>
                </button>
              )}

              {/* 關閉/選擇不啟用按鈕 */}
              <button
                onClick={() => {
                  setSettings(prev => ({ ...prev, enableWakeLock: false }));
                  releaseWakeLock();
                }}
                className="mt-2.5 text-center block w-full text-[10px] text-gray-400 hover:text-rose-300 transition-colors underline cursor-pointer"
              >
                強度關閉：不啟用防休眠並關閉此提醒
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
