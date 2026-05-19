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
  Clock,
  Users
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
  
  // 設定狀態
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    return saved ? JSON.parse(saved) : {
      showSeconds: true,
      digitColor: '#ffffff',
      cardBg: '#1e1e1e',
      pageBg: '#0a0a0a',
      fontFamily: 'var(--font-montserrat)'
    };
  });

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

  // --- 週期性邏輯 ---
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      <div className="absolute top-4 right-4 z-50 flex space-x-4 opacity-20 hover:opacity-100 transition-opacity">
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
                <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-2">
                  <h3 className="text-lg font-semibold flex items-center gap-2">考程自動排程</h3>
                  <button 
                    onClick={() => setSchedule([...schedule, { id: Date.now().toString(), period: '新', subject: '新考科', startTime: '12:00', endTime: '13:00' }])}
                    className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-full transition-colors"
                  >
                    <Plus size={14} /> 新增考程
                  </button>
                </div>

                <div className="space-y-4">
                  {schedule.map((item, index) => (
                    <div key={item.id} className="p-4 bg-gray-800/50 rounded-xl border border-white/10 space-y-3 group relative">
                      <button 
                        onClick={() => setSchedule(schedule.filter(s => s.id !== item.id))}
                        className="absolute -top-2 -right-2 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 rounded-full p-1 border border-red-500/20"
                      >
                        <Trash2 size={16} />
                      </button>

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
    </div>
  );
}
