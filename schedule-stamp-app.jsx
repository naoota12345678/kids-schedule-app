import { useState, useRef } from "react";

// ── Stamps ─────────────────────────────────────────────────────────────────
const STAMPS = [
  { id: "school",   label: "学校",         emoji: "🏫", color: "#FFD6E0", border: "#e8829a" },
  { id: "study",    label: "勉強",         emoji: "📚", color: "#C8F5E0", border: "#4caf82", maxH: 3 },
  { id: "game",     label: "ゲーム",       emoji: "🎮", color: "#D4C8FF", border: "#8b72e8", maxH: 3 },
  { id: "bath",     label: "お風呂",       emoji: "🛁", color: "#FFE5C8", border: "#e8923a" },
  { id: "laundry",  label: "洗濯物",       emoji: "👕", color: "#C8EDFF", border: "#2e9ad0" },
  { id: "chores",   label: "お手伝い",     emoji: "🧹", color: "#DFFFD6", border: "#5db845" },
  { id: "meeting",  label: "ミーティング", emoji: "📋", color: "#FFF5C0", border: "#c9a800" },
  { id: "free",     label: "自由",         emoji: "✨", color: "#F0D8FF", border: "#a855d4" },
  { id: "sleep",    label: "ねる",         emoji: "😴", color: "#D0EEFF", border: "#3b8bc4" },
];
const MEAL_STAMP = { id: "meal", label: "ごはん", emoji: "🍱", color: "#FFE5B0", border: "#d4900a" };
const ERASER     = { id: "erase", label: "けす",  emoji: "🧽", color: "#F0F0F0", border: "#aaa" };
const ALL_STAMPS = [...STAMPS, ERASER];
const getS = (id) => id === "meal" ? MEAL_STAMP : ALL_STAMPS.find(s => s.id === id);

// ── Time slots 6:00–24:00 in 10-min steps ─────────────────────────────────
const SLOTS = [];
for (let h = 6; h < 24; h++)
  for (let m = 0; m < 60; m += 10)
    SLOTS.push({ hour: h, min: m });
const GAME_CUT = SLOTS.findIndex(s => s.hour === 21 && s.min === 0);
const fmt      = (h, m) => `${h}:${String(m).padStart(2, "0")}`;
const endSlot  = (idx)  => { const n = SLOTS[idx+1]; return n ? fmt(n.hour, n.min) : "24:00"; };
const parseTime = (str) => { const [h,m] = str.split(":").map(Number); return isNaN(h) ? null : {h,m}; };
const timeToIdx = (h,m) => SLOTS.findIndex(s => s.hour===h && s.min===m);

const TIME_OPTIONS = [];
for (let h = 6; h < 24; h++)
  for (let m = 0; m < 60; m += 10)
    TIME_OPTIONS.push(fmt(h, m));

// ── Date helpers ───────────────────────────────────────────────────────────
const toKey    = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const todayKey = toKey(new Date());
const WD       = ["日","月","火","水","木","金","土"];
const fmtDate  = (d) => `${d.getMonth()+1}月${d.getDate()}日（${WD[d.getDay()]}）`;
const addDays  = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const keyToDate= (k) => { const [y,m,d]=k.split("-").map(Number); return new Date(y,m-1,d); };

// ── Default meals ──────────────────────────────────────────────────────────
const DEFAULT_MEALS = [
  { label:"朝", start:"7:00",  end:"7:30"  },
  { label:"昼", start:"12:00", end:"12:30" },
  { label:"夜", start:"18:00", end:"18:30" },
];
const DEFAULT_PIN = "1234";

function buildMealSlots(meals) {
  const s = new Set();
  for (const m of meals) {
    const st = parseTime(m.start), en = parseTime(m.end);
    if (!st||!en) continue;
    let i = timeToIdx(st.h, st.m);
    const end = timeToIdx(en.h, en.m);
    if (i<0) continue;
    const lim = end<0 ? SLOTS.length : end;
    while (i<lim) { s.add(i); i++; }
  }
  return s;
}

function getBlockInfo(schedule, mealSlots, idx) {
  const isMeal = mealSlots.has(idx);
  const id = isMeal ? "meal" : schedule[idx];
  if (!id) return null;
  const inBlock = (i) => isMeal ? mealSlots.has(i) : (!mealSlots.has(i) && schedule[i]===id);
  let start=idx, end=idx;
  while (start>0 && inBlock(start-1)) start--;
  while (end<SLOTS.length-1 && inBlock(end+1)) end++;
  return { isStart: start===idx, startLabel: fmt(SLOTS[start].hour,SLOTS[start].min), endLabel: endSlot(end) };
}

// ── Tabs ───────────────────────────────────────────────────────────────────
const TABS = [
  { id:"schedule", label:"予定",   emoji:"📅" },
  { id:"check",    label:"チェック",emoji:"✅" },
  { id:"memo",     label:"メモ",   emoji:"📝" },
];

// ─────────────────────────────────────────────────────────────────────────
export default function App() {
  const [mode,         setMode]         = useState("child"); // child | parent
  const [pin,          setPin]          = useState(DEFAULT_PIN);
  const [showPin,      setShowPin]      = useState(false);
  const [pinInput,     setPinInput]     = useState("");
  const [pinError,     setPinError]     = useState(false);
  const [showPinChange,setShowPinChange]= useState(false);
  const [newPin,       setNewPin]       = useState("");
  const [tab,          setTab]          = useState("schedule");

  // Per-day data
  const [schedules,     setSchedules]     = useState({});
  const [mealOverrides, setMealOverrides] = useState({});
  const [defaultMeals,  setDefaultMeals]  = useState(DEFAULT_MEALS);
  const [dayData,       setDayData]       = useState({});
  // Memos: global list [{id, text, done, addedToSchedule}]
  const [memos,         setMemos]         = useState([]);
  const [memoInput,     setMemoInput]     = useState("");

  const [selectedKey,  setSelectedKey]  = useState(todayKey);
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewMonth,    setViewMonth]    = useState({ y:new Date().getFullYear(), m:new Date().getMonth() });
  const [showMealSet,  setShowMealSet]  = useState(false);
  const [selected,     setSelected]     = useState("study");
  const [toast,        setToast]        = useState("");
  // For memo→schedule
  const [addingMemo,   setAddingMemo]   = useState(null); // memo id being scheduled
  const [memoStamp,    setMemoStamp]    = useState("study");

  const isDrag  = useRef(false);
  const lastIdx = useRef(null);
  const tmr     = useRef(null);

  const isToday = selectedKey === todayKey;
  const canEdit = mode === "parent" || isToday;
  const schedule  = schedules[selectedKey] || {};
  const meals     = mealOverrides[selectedKey] || defaultMeals;
  const mealSlots = buildMealSlots(meals);
  const dData     = dayData[selectedKey] || { done:{laundry:false,chores:false}, todos:[] };

  const showToast = (msg) => {
    setToast(msg); clearTimeout(tmr.current);
    tmr.current = setTimeout(()=>setToast(""), 2300);
  };
  const countSlots = (sc,id) => Object.values(sc).filter(v=>v===id).length;

  // ── PIN ──────────────────────────────────────────────────────────────────
  const enterPin = (digit) => {
    const next = pinInput + digit;
    setPinInput(next); setPinError(false);
    if (next.length===4) {
      if (next===pin) { setMode("parent"); setShowPin(false); setPinInput(""); showToast("👩 親モードです"); }
      else { setPinError(true); setTimeout(()=>setPinInput(""),600); }
    }
  };

  // ── Schedule painting ────────────────────────────────────────────────────
  const paint = (idx, sc) => {
    if (lastIdx.current===idx) return sc;
    lastIdx.current = idx;
    if (!canEdit) { showToast("✏️ 今日のスケジュールだけ変えられるよ！"); return sc; }
    if (mealSlots.has(idx)) { showToast("🍱 ごはんの時間は変えられないよ！"); return sc; }
    if (selected==="erase") { const n={...sc}; delete n[idx]; return n; }
    if (selected==="game" && idx>=GAME_CUT) { showToast("🎮 ゲームは21時まで！"); return sc; }
    const stamp = getS(selected);
    if (stamp?.maxH && sc[idx]!==selected && countSlots(sc,selected)>=stamp.maxH*6) {
      showToast(`${stamp.emoji} ${stamp.label}は1日${stamp.maxH}時間まで！`); return sc;
    }
    return { ...sc, [idx]: selected };
  };
  const onPtrDown  = (idx,e) => { e.preventDefault(); isDrag.current=true; lastIdx.current=null; setSchedules(s=>({...s,[selectedKey]:paint(idx,s[selectedKey]||{})})); };
  const onPtrEnter = (idx)   => { if(isDrag.current) setSchedules(s=>({...s,[selectedKey]:paint(idx,s[selectedKey]||{})})); };
  const onPtrUp    = ()      => { isDrag.current=false; lastIdx.current=null; };

  // ── Day data ─────────────────────────────────────────────────────────────
  const updDayData = (fn) => setDayData(p=>({...p,[selectedKey]:fn(p[selectedKey]||{done:{laundry:false,chores:false},todos:[]})}));
  const [todoInput, setTodoInput] = useState("");
  const addTodo  = () => { const t=todoInput.trim(); if(!t)return; updDayData(d=>({...d,todos:[...d.todos,{id:Date.now(),text:t,done:false}]})); setTodoInput(""); };
  const togTodo  = (id) => updDayData(d=>({...d,todos:d.todos.map(t=>t.id===id?{...t,done:!t.done}:t)}));
  const delTodo  = (id) => updDayData(d=>({...d,todos:d.todos.filter(t=>t.id!==id)}));

  // ── Meals ─────────────────────────────────────────────────────────────────
  const updateMeal = (i,field,val) => {
    const cur = mealOverrides[selectedKey]||defaultMeals;
    setMealOverrides(p=>({...p,[selectedKey]:cur.map((m,idx)=>idx===i?{...m,[field]:val}:m)}));
  };

  // ── Memos ─────────────────────────────────────────────────────────────────
  const addMemo = () => {
    const t=memoInput.trim(); if(!t)return;
    setMemos(p=>[...p,{id:Date.now(),text:t,done:false,scheduled:false}]);
    setMemoInput("");
  };
  const togMemo   = (id) => setMemos(p=>p.map(m=>m.id===id?{...m,done:!m.done}:m));
  const delMemo   = (id) => setMemos(p=>p.filter(m=>m.id!==id));
  // Add memo to todo list of selected day
  const memoToTodo = (memo) => {
    updDayData(d=>({...d,todos:[...d.todos,{id:Date.now(),text:memo.text,done:false}]}));
    setMemos(p=>p.map(m=>m.id===memo.id?{...m,scheduled:true}:m));
    showToast(`📝→✅ やらなきゃリストに追加したよ！`);
  };

  // ── Calendar ──────────────────────────────────────────────────────────────
  const calDays = () => {
    const {y,m} = viewMonth;
    const first = new Date(y,m,1), last=new Date(y,m+1,0);
    const days=[];
    for(let i=0;i<first.getDay();i++) days.push(null);
    for(let d=1;d<=last.getDate();d++) days.push(new Date(y,m,d));
    return days;
  };

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary = [...STAMPS,MEAL_STAMP]
    .map(s=>({...s,mins:s.id==="meal"?mealSlots.size*10:countSlots(schedule,s.id)*10}))
    .filter(s=>s.mins>0);

  const undone = memos.filter(m=>!m.done && !m.scheduled);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ minHeight:"100vh", background:"#F4F2FF", fontFamily:"'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif", userSelect:"none", paddingBottom:80 }}
      onPointerUp={onPtrUp} onPointerLeave={onPtrUp}
    >

      {/* ── HEADER ── */}
      <div style={{ background:"white", borderBottom:"3px solid #E0D8FF", padding:"10px 14px", position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 14px rgba(100,70,220,.09)" }}>
        <div style={{ maxWidth:520, margin:"0 auto" }}>
          {/* Top row */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ fontSize:18, fontWeight:900, color:"#5b3fc4" }}>📅 きょうの予定</div>
              {mode==="parent" && (
                <div style={{ background:"#d4c8ff", border:"2px solid #7c5cfc", borderRadius:8, padding:"2px 8px", fontSize:10, fontWeight:800, color:"#4a2cb0" }}>
                  👩 親モード
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {mode==="parent" && (
                <>
                  <button onClick={()=>{setShowMealSet(v=>!v);setShowCalendar(false);}} style={{ background:showMealSet?"#FFE5B0":"#fff8ee", border:"2px solid #d4900a", borderRadius:9, padding:"5px 10px", fontSize:11, fontWeight:700, color:"#d4900a", cursor:"pointer" }}>🍱 ごはん</button>
                  <button onClick={()=>{setMode("child");showToast("👦 子どもモードに戻りました");}} style={{ background:"#fff0f5", border:"2px solid #ffb3c8", borderRadius:9, padding:"5px 10px", fontSize:11, fontWeight:700, color:"#d44", cursor:"pointer" }}>ログアウト</button>
                </>
              )}
              <button onClick={()=>{setShowCalendar(v=>!v);setShowMealSet(false);}} style={{ background:showCalendar?"#d4c8ff":"#f4f2ff", border:"2px solid #7c5cfc", borderRadius:9, padding:"5px 10px", fontSize:11, fontWeight:700, color:"#7c5cfc", cursor:"pointer" }}>📆</button>
              <button onClick={()=>setSchedules(s=>({...s,[selectedKey]:{}}))} style={{ background:"#fff0f5", border:"2px solid #ffb3c8", borderRadius:9, padding:"5px 10px", fontSize:11, fontWeight:700, color:"#d44", cursor:"pointer" }}>🗑</button>
            </div>
          </div>

          {/* Date row */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <button onClick={()=>setSelectedKey(k=>toKey(addDays(keyToDate(k),-1)))} style={{ background:"#f4f2ff", border:"2px solid #e0d8ff", borderRadius:8, padding:"3px 10px", fontSize:16, cursor:"pointer", color:"#7c5cfc" }}>‹</button>
            <div style={{ flex:1, textAlign:"center", fontSize:14, fontWeight:900, color:isToday?"#5b3fc4":"#888" }}>
              {isToday ? `今日 ${fmtDate(new Date())}` : fmtDate(keyToDate(selectedKey))}
            </div>
            <button onClick={()=>setSelectedKey(k=>toKey(addDays(keyToDate(k),1)))} style={{ background:"#f4f2ff", border:"2px solid #e0d8ff", borderRadius:8, padding:"3px 10px", fontSize:16, cursor:"pointer", color:"#7c5cfc" }}>›</button>
            {!isToday && <button onClick={()=>setSelectedKey(todayKey)} style={{ background:"#e8f5e9", border:"2px solid #4caf82", borderRadius:8, padding:"3px 8px", fontSize:10, fontWeight:700, color:"#2a7a52", cursor:"pointer" }}>今日</button>}
          </div>

          {/* Calendar */}
          {showCalendar && (
            <div style={{ background:"#faf8ff", border:"2px solid #e0d8ff", borderRadius:14, padding:"12px", marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <button onClick={()=>setViewMonth(v=>{const d=new Date(v.y,v.m-1);return{y:d.getFullYear(),m:d.getMonth()};})} style={{ background:"#f4f2ff", border:"2px solid #e0d8ff", borderRadius:8, padding:"3px 10px", cursor:"pointer", color:"#7c5cfc", fontWeight:700 }}>‹</button>
                <div style={{ fontWeight:800, color:"#5b3fc4", fontSize:14 }}>{viewMonth.y}年{viewMonth.m+1}月</div>
                <button onClick={()=>setViewMonth(v=>{const d=new Date(v.y,v.m+1);return{y:d.getFullYear(),m:d.getMonth()};})} style={{ background:"#f4f2ff", border:"2px solid #e0d8ff", borderRadius:8, padding:"3px 10px", cursor:"pointer", color:"#7c5cfc", fontWeight:700 }}>›</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, textAlign:"center" }}>
                {WD.map(w=><div key={w} style={{ fontSize:10, color:"#aaa", fontWeight:700, paddingBottom:4 }}>{w}</div>)}
                {calDays().map((d,i)=>{
                  if(!d) return <div key={i}/>;
                  const k=toKey(d), isSel=k===selectedKey, isTod=k===todayKey;
                  const has=!!(schedules[k]&&Object.keys(schedules[k]).length>0);
                  return (
                    <button key={i} onClick={()=>{setSelectedKey(k);setShowCalendar(false);}}
                      style={{ background:isSel?"#7c5cfc":isTod?"#e8e0ff":"white", border:`2px solid ${isSel?"#7c5cfc":isTod?"#a88ff0":"#e8e0ff"}`, borderRadius:8, padding:"6px 0", fontSize:12, fontWeight:isTod?900:600, color:isSel?"white":isTod?"#5b3fc4":"#555", cursor:"pointer", position:"relative" }}>
                      {d.getDate()}
                      {has&&<span style={{ position:"absolute", bottom:2, left:"50%", transform:"translateX(-50%)", width:4, height:4, borderRadius:"50%", background:isSel?"white":"#7c5cfc", display:"block" }}/>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Meal settings */}
          {showMealSet && mode==="parent" && (
            <div style={{ background:"#fffbf0", border:"2px solid #f5d78a", borderRadius:14, padding:"12px 14px", marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:800, color:"#b87400", marginBottom:8 }}>🍱 ごはんの時間（この日）</div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {meals.map((meal,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:"#b87400", minWidth:24 }}>{meal.label}</span>
                    <select value={meal.start} onChange={e=>updateMeal(i,"start",e.target.value)} style={{ border:"2px solid #f5d78a", borderRadius:8, padding:"4px 6px", fontSize:12, fontFamily:"inherit", background:"white" }}>
                      {TIME_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                    <span style={{ color:"#aaa", fontSize:12 }}>〜</span>
                    <select value={meal.end} onChange={e=>updateMeal(i,"end",e.target.value)} style={{ border:"2px solid #f5d78a", borderRadius:8, padding:"4px 6px", fontSize:12, fontFamily:"inherit", background:"white" }}>
                      {TIME_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
                <button onClick={()=>{const cur=mealOverrides[selectedKey]||defaultMeals;setDefaultMeals(cur);showToast("✅ デフォルト更新");}} style={{ background:"#fff3cc", border:"2px solid #c9a800", borderRadius:8, padding:"5px 12px", fontSize:11, fontWeight:700, color:"#c9a800", cursor:"pointer" }}>デフォルトに設定</button>
                <button onClick={()=>setShowPinChange(v=>!v)} style={{ background:"#f0eeff", border:"2px solid #a88ff0", borderRadius:8, padding:"5px 12px", fontSize:11, fontWeight:700, color:"#7c5cfc", cursor:"pointer" }}>🔑 PIN変更</button>
              </div>
              {showPinChange && (
                <div style={{ marginTop:10, display:"flex", gap:8, alignItems:"center" }}>
                  <input type="password" maxLength={4} placeholder="新しいPIN(4桁)" value={newPin} onChange={e=>setNewPin(e.target.value.slice(0,4))}
                    style={{ border:"2px solid #e0d8ff", borderRadius:8, padding:"5px 10px", fontSize:13, fontFamily:"inherit", width:140 }}/>
                  <button onClick={()=>{if(newPin.length===4){setPin(newPin);setNewPin("");setShowPinChange(false);showToast("✅ PIN変更しました！");}else showToast("4桁で入力してください");}}
                    style={{ background:"#7c5cfc", border:"none", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:800, color:"white", cursor:"pointer" }}>変更</button>
                </div>
              )}
            </div>
          )}

          {/* Stamp palette — schedule tab only */}
          {tab==="schedule" && canEdit && (
            <div style={{ display:"flex", gap:5, overflowX:"auto", paddingBottom:2 }}>
              {ALL_STAMPS.map(s=>(
                <button key={s.id} onPointerDown={e=>{e.stopPropagation();setSelected(s.id);}}
                  style={{ flexShrink:0, background:selected===s.id?s.color:"white", border:`2.5px solid ${selected===s.id?s.border:"#e4e0f0"}`, borderRadius:11, padding:"5px 8px", cursor:"pointer", fontSize:10, fontWeight:700, color:selected===s.id?s.border:"#aaa", display:"flex", flexDirection:"column", alignItems:"center", gap:1, minWidth:46, transform:selected===s.id?"scale(1.1)":"scale(1)", transition:"all .12s", boxShadow:selected===s.id?`0 3px 8px ${s.color}99`:"none" }}>
                  <span style={{ fontSize:17 }}>{s.emoji}</span>
                  <span style={{ lineHeight:1.2 }}>{s.label}</span>
                </button>
              ))}
            </div>
          )}
          {tab==="schedule" && !canEdit && (
            <div style={{ textAlign:"center", fontSize:11, color:"#aaa", padding:"4px 0" }}>📖 今日のスケジュールだけ編集できるよ</div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:10, left:"50%", transform:"translateX(-50%)", background:"#fff3cd", border:"2px solid #ffc107", borderRadius:12, padding:"9px 20px", fontWeight:700, fontSize:13, color:"#856404", zIndex:999, boxShadow:"0 4px 16px rgba(0,0,0,.12)", animation:"pop .2s ease", whiteSpace:"nowrap" }}>
          {toast}
        </div>
      )}

      {/* ── CONTENT ── */}
      <div style={{ maxWidth:520, margin:"0 auto", padding:"10px 12px 16px" }}>

        {/* ── TAB: SCHEDULE ── */}
        {tab==="schedule" && (
          <>
            <div style={{ background:"white", borderRadius:18, overflow:"hidden", border:"2px solid #E0D8FF", boxShadow:"0 4px 20px rgba(100,80,200,.07)", marginBottom:12 }}>
              {SLOTS.map((slot,idx)=>{
                const isMeal  = mealSlots.has(idx);
                const stampId = isMeal?"meal":schedule[idx];
                const stamp   = stampId?getS(stampId):null;
                const info    = stamp?getBlockInfo(schedule,mealSlots,idx):null;
                const isHour  = slot.min===0;
                const isCut   = idx===GAME_CUT;
                return (
                  <div key={idx}>
                    {isCut && <div style={{ padding:"4px 12px", background:"#fff8ee", borderTop:"2px dashed #ffb347", borderBottom:"2px dashed #ffb347", textAlign:"center", fontSize:11, fontWeight:800, color:"#c47800" }}>🌙 21:00 ゲームおわり！</div>}
                    <div
                      onPointerDown={e=>canEdit&&onPtrDown(idx,e)}
                      onPointerEnter={()=>canEdit&&onPtrEnter(idx)}
                      style={{ display:"flex", alignItems:"stretch", borderBottom:isHour?"1px solid #ddd8ff":"1px solid #f0eeff", background:stamp?(isMeal?MEAL_STAMP.color+"dd":stamp.color+"bb"):"transparent", cursor:isMeal?"not-allowed":canEdit?"crosshair":"default", touchAction:"pan-y", minHeight:isHour?30:22 }}>
                      <div style={{ width:42, flexShrink:0, paddingLeft:8, display:"flex", alignItems:"center", fontSize:isHour?11:9, fontWeight:isHour?800:400, color:isHour?"#5b3fc4":"#ccc", fontVariantNumeric:"tabular-nums" }}>
                        {isHour?fmt(slot.hour,slot.min):`▪ ${String(slot.min).padStart(2,"0")}`}
                      </div>
                      <div style={{ flex:1, display:"flex", alignItems:"center", paddingLeft:6, gap:5 }}>
                        {stamp&&info?.isStart&&(
                          <>
                            <span style={{ fontSize:14 }}>{stamp.emoji}</span>
                            <span style={{ fontSize:11, fontWeight:800, color:stamp.border }}>{stamp.label}</span>
                            <span style={{ fontSize:10, color:stamp.border+"99", fontVariantNumeric:"tabular-nums" }}>{info.startLabel} → {info.endLabel}</span>
                            {isMeal&&<span style={{ fontSize:10 }}>🔒</span>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {summary.length>0&&(
              <div style={{ background:"white", borderRadius:16, padding:"14px 16px", border:"2px solid #E0D8FF" }}>
                <div style={{ fontWeight:800, color:"#5b3fc4", fontSize:13, marginBottom:8 }}>📊 まとめ</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {summary.map(s=>(
                    <div key={s.id} style={{ background:s.color, border:`2px solid ${s.border}44`, borderRadius:9, padding:"5px 11px", fontSize:12, fontWeight:700, color:s.border, display:"flex", alignItems:"center", gap:3 }}>
                      {s.emoji} {s.label} <span style={{ opacity:.75 }}>{s.mins>=60?`${Math.floor(s.mins/60)}時間${s.mins%60>0?s.mins%60+"分":""}`:s.mins+"分"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {canEdit&&<div style={{ textAlign:"center", fontSize:11, color:"#ccc", marginTop:12 }}>ドラッグで一気に塗れるよ 🎨</div>}
          </>
        )}

        {/* ── TAB: CHECK ── */}
        {tab==="check" && (
          <>
            <div style={{ background:"white", borderRadius:16, padding:"14px 16px", marginBottom:12, border:"2px solid #E0D8FF" }}>
              <div style={{ fontWeight:800, color:"#5b3fc4", fontSize:14, marginBottom:12 }}>✅ やること チェック</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <TaskCheck emoji="👕" label="洗濯物"   desc="干した？取り込んだ？"   color="#C8EDFF" border="#2e9ad0" checked={dData.done.laundry} onToggle={()=>updDayData(d=>({...d,done:{...d.done,laundry:!d.done.laundry}}))} disabled={!canEdit}/>
                <TaskCheck emoji="🧹" label="お手伝い" desc="今日のお手伝いやった？" color="#DFFFD6" border="#5db845" checked={dData.done.chores}  onToggle={()=>updDayData(d=>({...d,done:{...d.done,chores:!d.done.chores}}))}  disabled={!canEdit}/>
              </div>
            </div>
            <div style={{ background:"white", borderRadius:16, padding:"14px 16px", border:"2px solid #E0D8FF" }}>
              <div style={{ fontWeight:800, color:"#5b3fc4", fontSize:14, marginBottom:10 }}>📋 やらなきゃリスト</div>
              {canEdit&&(
                <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                  <input value={todoInput} onChange={e=>setTodoInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTodo()} placeholder="例：英語の宿題・ピアノ…"
                    style={{ flex:1, border:"2px solid #E0D8FF", borderRadius:10, padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none", color:"#444" }}
                    onFocus={e=>e.target.style.borderColor="#8b72e8"} onBlur={e=>e.target.style.borderColor="#E0D8FF"}/>
                  <button onClick={addTodo} style={{ background:"#7c5cfc", border:"none", borderRadius:10, padding:"8px 16px", color:"white", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>＋</button>
                </div>
              )}
              {dData.todos.length===0
                ?<div style={{ textAlign:"center", color:"#ccc", fontSize:12, padding:"8px 0" }}>まだなにもないよ！</div>
                :<div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {dData.todos.map(t=>(
                    <div key={t.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:t.done?"#f3fff3":"#faf8ff", borderRadius:10, border:`2px solid ${t.done?"#4caf8244":"#e0d8ff"}` }}>
                      <button onClick={()=>canEdit&&togTodo(t.id)} style={{ width:26, height:26, borderRadius:8, border:`2.5px solid ${t.done?"#4caf82":"#c0b8e8"}`, background:t.done?"#4caf82":"white", cursor:canEdit?"pointer":"default", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"white", fontWeight:800 }}>
                        {t.done?"✓":""}
                      </button>
                      <span style={{ flex:1, fontSize:13, color:t.done?"#aaa":"#444", textDecoration:t.done?"line-through":"none", fontWeight:t.done?400:600 }}>{t.text}</span>
                      {canEdit&&<button onClick={()=>delTodo(t.id)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:"#ddd", padding:"0 2px" }}>×</button>}
                    </div>
                  ))}
                </div>
              }
            </div>
          </>
        )}

        {/* ── TAB: MEMO ── */}
        {tab==="memo" && (
          <div style={{ background:"white", borderRadius:16, padding:"14px 16px", border:"2px solid #E0D8FF" }}>
            <div style={{ fontWeight:800, color:"#5b3fc4", fontSize:14, marginBottom:6 }}>📝 わすれないようにメモ</div>
            <div style={{ fontSize:11, color:"#aaa", marginBottom:12 }}>やっておいてと言われたこと・あとでやること・思いついたことなど</div>

            {/* Input */}
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              <textarea
                value={memoInput}
                onChange={e=>setMemoInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),addMemo())}
                placeholder="例：お母さんに頼まれたこと、買い物メモ…"
                rows={2}
                style={{ flex:1, border:"2px solid #E0D8FF", borderRadius:10, padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none", color:"#444", resize:"none" }}
                onFocus={e=>e.target.style.borderColor="#8b72e8"} onBlur={e=>e.target.style.borderColor="#E0D8FF"}
              />
              <button onClick={addMemo} style={{ background:"#7c5cfc", border:"none", borderRadius:10, padding:"8px 14px", color:"white", fontWeight:800, fontSize:16, cursor:"pointer", fontFamily:"inherit", alignSelf:"stretch" }}>＋</button>
            </div>

            {memos.length===0
              ?<div style={{ textAlign:"center", color:"#ddd", fontSize:13, padding:"20px 0" }}>メモはまだないよ✨</div>
              :<div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {memos.map(memo=>(
                  <div key={memo.id} style={{ background:memo.done?"#f5f5f5":memo.scheduled?"#f0fff4":"#faf8ff", borderRadius:12, border:`2px solid ${memo.done?"#ddd":memo.scheduled?"#4caf8244":"#e0d8ff"}`, padding:"10px 12px" }}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                      <button onClick={()=>togMemo(memo.id)} style={{ width:26, height:26, borderRadius:8, border:`2.5px solid ${memo.done?"#4caf82":"#c0b8e8"}`, background:memo.done?"#4caf82":"white", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"white", fontWeight:800, marginTop:1 }}>
                        {memo.done?"✓":""}
                      </button>
                      <span style={{ flex:1, fontSize:13, color:memo.done?"#aaa":"#444", textDecoration:memo.done?"line-through":"none", lineHeight:1.5, fontWeight:600 }}>
                        {memo.text}
                      </span>
                      <button onClick={()=>delMemo(memo.id)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:"#ddd", padding:"0 2px", flexShrink:0 }}>×</button>
                    </div>
                    {/* Add to todo / schedule */}
                    {!memo.done && (
                      <div style={{ display:"flex", gap:6, marginTop:8, paddingLeft:34 }}>
                        {!memo.scheduled
                          ?<button onClick={()=>memoToTodo(memo)} style={{ background:"#e8f5e9", border:"2px solid #4caf82", borderRadius:8, padding:"4px 12px", fontSize:11, fontWeight:700, color:"#2a7a52", cursor:"pointer" }}>
                            ➕ やらなきゃリストに追加
                          </button>
                          :<span style={{ fontSize:11, color:"#4caf82", fontWeight:700 }}>✅ リストに追加済み</span>
                        }
                      </div>
                    )}
                  </div>
                ))}
              </div>
            }
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"white", borderTop:"3px solid #E0D8FF", display:"flex", zIndex:200, boxShadow:"0 -2px 14px rgba(100,70,220,.09)" }}>
        <div style={{ maxWidth:520, margin:"0 auto", display:"flex", flex:1 }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ flex:1, background:"none", border:"none", padding:"10px 0", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, borderTop:`3px solid ${tab===t.id?"#7c5cfc":"transparent"}`, transition:"all .15s", position:"relative" }}>
              <span style={{ fontSize:20 }}>{t.emoji}</span>
              <span style={{ fontSize:10, fontWeight:800, color:tab===t.id?"#7c5cfc":"#aaa" }}>{t.label}</span>
              {/* Badge for unread memos */}
              {t.id==="memo" && undone.length>0 && (
                <span style={{ position:"absolute", top:6, right:"calc(50% - 18px)", background:"#ff6b6b", color:"white", borderRadius:"50%", width:16, height:16, fontSize:9, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center" }}>{undone.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── PARENT FLOAT BUTTON ── */}
      {mode==="child" && !showPin && (
        <button
          onClick={()=>{setShowPin(true);setPinInput("");setPinError(false);}}
          style={{ position:"fixed", bottom:72, right:16, width:48, height:48, borderRadius:"50%", background:"linear-gradient(135deg,#7c5cfc,#a855d4)", border:"none", boxShadow:"0 4px 16px rgba(120,70,220,.4)", color:"white", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 }}
          title="親ログイン"
        >👩</button>
      )}

      {/* ── PIN MODAL ── */}
      {showPin && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:500 }} onClick={()=>setShowPin(false)}>
          <div style={{ background:"white", borderRadius:"24px 24px 0 0", padding:"28px 24px 40px", width:"min(400px,100%)", boxShadow:"0 -8px 32px rgba(0,0,0,.2)" }} onClick={e=>e.stopPropagation()}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:28, marginBottom:6 }}>🔐</div>
              <div style={{ fontSize:16, fontWeight:900, color:"#5b3fc4" }}>親のPINを入力</div>
              <div style={{ fontSize:11, color:"#aaa", marginTop:4 }}>初期PIN: 1234</div>
            </div>
            <div style={{ display:"flex", justifyContent:"center", gap:14, marginBottom:24 }}>
              {[0,1,2,3].map(i=>(
                <div key={i} style={{ width:18, height:18, borderRadius:"50%", background:pinError?"#ff6b6b":i<pinInput.length?"#7c5cfc":"#e8e0ff", transition:"background .2s" }}/>
              ))}
            </div>
            {pinError&&<div style={{ textAlign:"center", color:"#ff6b6b", fontSize:13, fontWeight:700, marginBottom:12 }}>PINが違います</div>}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, maxWidth:260, margin:"0 auto" }}>
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d,i)=>(
                <button key={i} onClick={()=>d==="⌫"?setPinInput(p=>p.slice(0,-1)):d!==""?enterPin(d):null}
                  style={{ background:d===""?"transparent":d==="⌫"?"#fff0f5":"#f4f2ff", border:d===""?"none":`2px solid ${d==="⌫"?"#ffb3c8":"#e0d8ff"}`, borderRadius:14, padding:"14px 0", fontSize:22, fontWeight:700, color:d==="⌫"?"#d44":"#5b3fc4", cursor:d===""?"default":"pointer" }}>
                  {d}
                </button>
              ))}
            </div>
            <div style={{ textAlign:"center", marginTop:16 }}>
              <button onClick={()=>setShowPin(false)} style={{ background:"none", border:"none", color:"#aaa", fontSize:13, cursor:"pointer" }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pop { from{opacity:0;transform:translateX(-50%) scale(.85)} to{opacity:1;transform:translateX(-50%) scale(1)} }
        * { box-sizing: border-box; }
        button { font-family: inherit; }
        ::-webkit-scrollbar { height:4px; }
        ::-webkit-scrollbar-thumb { background:#D4C8FF; border-radius:4px; }
      `}</style>
    </div>
  );
}

function TaskCheck({ emoji, label, desc, color, border, checked, onToggle, disabled }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:12, background:checked?color+"88":"#faf8ff", border:`2.5px solid ${checked?border:"#e0d8ff"}`, transition:"all .15s" }}>
      <span style={{ fontSize:22 }}>{emoji}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:800, color:checked?border:"#555" }}>{label}</div>
        <div style={{ fontSize:11, color:"#aaa" }}>{desc}</div>
      </div>
      <button onClick={()=>!disabled&&onToggle()} style={{ background:checked?border:"white", border:`2.5px solid ${checked?border:"#ccc"}`, borderRadius:10, padding:"6px 14px", fontSize:13, fontWeight:800, color:checked?"white":"#aaa", cursor:disabled?"default":"pointer", transition:"all .15s", flexShrink:0, opacity:disabled?.6:1 }}>
        {checked?"✓ やった！":"やった？"}
      </button>
    </div>
  );
}
