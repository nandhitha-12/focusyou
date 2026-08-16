// ── MOBILE SIDEBAR ──
function safeGet(id) { const el = document.getElementById(id); return el || { value:"", innerHTML:"", textContent:"", style:{}, classList:{add:()=>{},remove:()=>{},toggle:()=>{}}, disabled:false, appendChild:()=>{}, remove:()=>{}, tagName:"" }; }
function safeQueryAll(sel) { const els = document.querySelectorAll(sel); return els.length ? els : { forEach: ()=>{} }; }

safeGet("menuToggle").onclick=()=>{safeGet("sidebar").classList.toggle("open");safeGet("overlay").classList.toggle("open");};
safeGet("overlay").onclick=()=>{safeGet("sidebar").classList.remove("open");safeGet("overlay").classList.remove("open");};

// ── TOAST ──
function showToast(msg,emoji="✨"){
  const c=safeGet("toastContainer"),t=document.createElement("div");
  t.className="toast";t.innerHTML=`${emoji} ${msg}`;c.appendChild(t);
  setTimeout(()=>t.remove(),4000);
}



// ── ALARM ──
let alarmAudio=null;
function playAlarm(){
  // Web Audio API beep
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const play=(freq,start,dur)=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);
      o.frequency.value=freq;o.type="sine";
      g.gain.setValueAtTime(0.4,ctx.currentTime+start);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+start+dur);
      o.start(ctx.currentTime+start);o.stop(ctx.currentTime+start+dur+0.1);
    };
    play(880,0,.2);play(880,.25,.2);play(1100,.5,.4);
  }catch(e){}
}

function triggerAlarm(msg){
  playAlarm();
  const b=safeGet("alarmBanner");
  safeGet("alarmMsg").textContent="⏰ "+msg;
  b.style.display="block";
  // Browser notification
  if(typeof Notification !== 'undefined' && Notification.permission==="granted"){
    new Notification("FocusYou ⏰",{body:msg,icon:"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐰</text></svg>"});
  }
  if(typeof FocusVoice !== 'undefined') FocusVoice.speakTimerOver();
}
function dismissAlarm(){safeGet("alarmBanner").style.display="none";}

// Request notification permission on load
if(typeof Notification !== 'undefined' && Notification.permission==="default") Notification.requestPermission();

// ── MODE SWITCH ──
function switchMode(mode,btn){
  ["pomodoro","recall","spaced","feynman","fiftytwo","sounds"].forEach(m=>{
    safeGet("mode-"+m).style.display=m===mode?"block":"none";
  });
  safeQueryAll(".mode-tab").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
}

// ══════════════════════════════════
//  POMODORO
// ══════════════════════════════════
let pomDur={focus:25*60,short:5*60,long:15*60};
let pomPhase="focus",pomLeft,pomTotal,pomRunning=false,pomInt=null;
let pomSessions=0,pomFocusSec=0;
const CIRC=653;
const pomEmojis={focus:"🎯",short:"☕",long:"🛋️"};
const pomLabels={focus:"FOCUS TIME",short:"SHORT BREAK",long:"LONG BREAK"};
const pomTips=["Close all social media tabs before starting. Out of sight, out of mind! 📵","Keep a notepad nearby — jot down distracting thoughts instead of acting on them. 📝","Drink water before each session — hydration keeps your brain sharp. 💧","After 4 sessions, reward yourself with something you enjoy! 🎁","Set a clear intention before each Pomodoro: 'I will finish X'. 🎯"];
safeGet("pomTip").textContent=pomTips[Math.floor(Math.random()*pomTips.length)];

function updatePomDur(){pomDur.focus=parseInt(safeGet("cfFocus").value)*60;pomDur.short=parseInt(safeGet("cfShort").value)*60;pomDur.long=parseInt(safeGet("cfLong").value)*60;if(!pomRunning)setPomPhase(pomPhase);}

function setPomPhase(phase,btn){
  pomPhase=phase;pomLeft=pomTotal=pomDur[phase];
  updatePomDisplay();
  if(pomRunning){clearInterval(pomInt);pomRunning=false;safeGet("pomBtn").textContent="▶ Start";}
  safeGet("pomEmoji").textContent=pomEmojis[phase];
  safeGet("pomLabel").textContent=pomLabels[phase];
  if(btn){safeQueryAll("[id^='ptab-']").forEach(b=>b.classList.remove("active"));btn.classList.add("active");}
}

function updatePomDisplay(){
  const m=Math.floor(pomLeft/60).toString().padStart(2,"0"),s=(pomLeft%60).toString().padStart(2,"0");
  safeGet("pomDisplay").textContent=`${m}:${s}`;
  safeGet("pomRing").style.strokeDashoffset=CIRC*(1-pomLeft/pomTotal);
}

function togglePom(){
  if(pomRunning){clearInterval(pomInt);pomRunning=false;safeGet("pomBtn").innerHTML="▶ Resume";if(typeof onMonPause==="function")onMonPause();}
  else{
    pomRunning=true;safeGet("pomBtn").innerHTML="⏸ Pause";pomInt=setInterval(pomTick,1000);
    if(pomPhase==="focus"&&typeof onMonStudyStart==="function")onMonStudyStart();
    if(typeof FocusVoice !== 'undefined') FocusVoice.speakTimerStart();
  }
}

function pomTick(){
  pomLeft--;
  if(pomPhase==="focus")pomFocusSec++;
  updatePomDisplay();
  if(pomLeft<=0){
    clearInterval(pomInt);pomRunning=false;safeGet("pomBtn").innerHTML="▶ Start";
    if(pomPhase==="focus"){
      pomSessions++;
      safeGet("pomSess").textContent=pomSessions;
      safeGet("pomXP").textContent=pomSessions*15;
      safeGet("pomTotal").textContent=Math.round(pomFocusSec/60)+"m";
      updatePomDots();
      triggerAlarm("Pomodoro complete! Take a break 🍅 +15 XP earned!");
      showToast("Pomodoro done! +15 XP 🎉","🍅");
      if(pomSessions%4===0)setPomPhase("long",safeGet("ptab-long"));
      else setPomPhase("short",safeGet("ptab-short"));
      if(typeof onMonBreakStart==="function")onMonBreakStart();
    }else{
      triggerAlarm("Break over! Time to focus 💪");
      showToast("Break over! Let's go 💪","⏱️");
      setPomPhase("focus",safeGet("ptab-focus"));
    }
  }
}

function resetPom(){clearInterval(pomInt);pomRunning=false;setPomPhase(pomPhase);safeGet("pomBtn").innerHTML="▶ Start";if(typeof onMonTimerStop==="function")onMonTimerStop();}

function updatePomDots(){
  const dots=safeQueryAll("#pomDots .session-dot");
  const idx=pomSessions%4;
  dots.forEach((d,i)=>{d.classList.remove("active","done");if(i<idx)d.classList.add("done");if(i===idx&&idx<4)d.classList.add("active");});
}
setPomPhase("focus");

// ══════════════════════════════════
//  ACTIVE RECALL
// ══════════════════════════════════
let cards=[{q:"What is the time complexity of Binary Search?",a:"O(log n)"},{q:"What does RAM stand for?",a:"Random Access Memory"}];
let curCard=0,rcGot=0,rcMiss=0;

function addCard(){
  const q=safeGet("newQ").value.trim(),a=safeGet("newA").value.trim();
  if(!q||!a){showToast("Fill both question and answer!","⚠️");return;}
  cards.push({q,a});safeGet("newQ").value="";safeGet("newA").value="";
  renderDeck();renderCard();showToast("Card added! 🃏","✅");
}

function renderCard(){
  const deck=safeGet("recall-deck"),nav=safeGet("cardNav"),ctr=safeGet("cardCtr");
  if(cards.length===0){deck.innerHTML=`<div style="text-align:center;color:var(--text-muted);font-size:.9rem;padding:30px 0;">Add cards above to get started! 🃏</div>`;nav.style.display="none";ctr.textContent="";return;}
  const c=cards[curCard%cards.length];
  ctr.textContent=`Card ${(curCard%cards.length)+1} of ${cards.length}`;
  nav.style.display="flex";
  deck.innerHTML=`<div class="card-flip" onclick="flipCard()"><div class="card-inner" id="cardInner"><div class="card-face card-front"><div class="card-hint">❓ Question — tap to flip</div><div class="card-text">${c.q}</div></div><div class="card-face card-back"><div class="card-hint">✅ Answer</div><div class="card-text">${c.a}</div><div style="display:flex;gap:8px;margin-top:10px;"><button class="btn btn-mint btn-sm" onclick="event.stopPropagation();markCard(true)">✅ Got it!</button><button class="btn btn-pink btn-sm" onclick="event.stopPropagation();markCard(false)">❌ Missed</button></div></div></div></div>`;
}

function flipCard(){const ci=safeGet("cardInner");if(ci)ci.classList.toggle("flipped");}
function nextCard(){curCard=(curCard+1)%cards.length;renderCard();}
function prevCard(){curCard=(curCard-1+cards.length)%cards.length;renderCard();}
function markCard(ok){
  if(ok)rcGot++;else rcMiss++;
  safeGet("rcGot").textContent=rcGot;
  safeGet("rcMiss").textContent=rcMiss;
  const t=rcGot+rcMiss;safeGet("rcAcc").textContent=t>0?Math.round(rcGot/t*100)+"%":"—";
  nextCard();
}
function renderDeck(){
  safeGet("deckCount").textContent=cards.length;
  safeGet("card-list").innerHTML=cards.map((c,i)=>`<div style="padding:10px 12px;background:var(--bg);border-radius:var(--radius-sm);border:1.5px solid var(--border);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:8px;"><div><div style="font-size:.82rem;font-weight:700;">${c.q}</div><div style="font-size:.75rem;color:var(--text-muted);font-weight:600;">→ ${c.a}</div></div><button class="btn btn-pink btn-sm" onclick="delCard(${i})">✕</button></div>`).join("");
}
function delCard(i){cards.splice(i,1);if(curCard>=cards.length)curCard=0;renderDeck();renderCard();}
renderCard();renderDeck();

// ══════════════════════════════════
//  SPACED REPETITION
// ══════════════════════════════════
let srData=JSON.parse(localStorage.getItem("fy_spaced")||"{}");
let srTopic="";

function startSR(){
  srTopic=safeGet("spTopic").value.trim();
  if(!srTopic){showToast("Enter a topic!","⚠️");return;}
  safeGet("spLabel").textContent=srTopic;
  safeGet("sp-input").style.display="none";
  safeGet("sp-card").style.display="block";
}
function rateSR(q){
  const e=srData[srTopic]||{ease:2.5,interval:1,reps:0};
  let{ease,interval,reps}=e;
  if(q<3){interval=1;reps=0;}
  else{if(reps===0)interval=1;else if(reps===1)interval=6;else interval=Math.round(interval*ease);reps++;ease=Math.max(1.3,ease+(0.1-(5-q)*(0.08+(5-q)*0.02)));}
  const next=new Date();next.setDate(next.getDate()+interval);
  srData[srTopic]={ease,interval,reps,next_review:next.toISOString().split("T")[0]};
  localStorage.setItem("fy_spaced",JSON.stringify(srData));
  showToast(`Next review in ${interval} day${interval>1?"s":""}! 📅`,"📅");
  safeGet("sp-input").style.display="block";
  safeGet("sp-card").style.display="none";
  safeGet("spTopic").value="";
  renderSRSchedule();
}
function renderSRSchedule(){
  const el=safeGet("sp-schedule"),keys=Object.keys(srData);
  if(!keys.length){el.innerHTML=`<div style="color:var(--text-muted);font-size:.88rem;font-weight:600;">Review topics to see your schedule here.</div>`;return;}
  const today=new Date().toISOString().split("T")[0];
  el.innerHTML=Object.entries(srData).sort((a,b)=>a[1].next_review.localeCompare(b[1].next_review)).map(([t,r])=>`<div class="spaced-row"><div><div style="font-weight:700;font-size:.88rem;">${t}</div><div style="font-size:.72rem;color:var(--text-muted);font-weight:600;">Ease: ${r.ease.toFixed(2)} · Reps: ${r.reps}</div></div><span class="next-badge ${r.next_review<=today?'today':''}">${r.next_review<=today?"Due today!":r.next_review}</span></div>`).join("");
}
renderSRSchedule();

// ══════════════════════════════════
//  FEYNMAN TECHNIQUE
// ══════════════════════════════════
const feynSteps=[
  {mins:5, prompt:"Write the topic name at the top of a blank page. What exactly do you want to understand?",ph:"e.g. I want to understand: Photosynthesis"},
  {mins:20,prompt:"Explain this concept as if teaching a 10-year-old. No jargon allowed! Write everything you know.",ph:"Plants use sunlight to make food…"},
  {mins:10,prompt:"Where did you get stuck? Go back to your notes and fill those gaps now.",ph:"I wasn't sure how chlorophyll works, so I looked it up…"},
  {mins:10,prompt:"Rewrite your explanation using a real-life analogy. Make it even simpler!",ph:"Photosynthesis is like a solar panel — the leaf captures sunlight…"},
];
let feynIdx=0,feynNotes=["","","",""];
let feynRunning=false,feynInt=null,feynLeft=0,feynTotalT=0;
let feynSessions=JSON.parse(localStorage.getItem("fy_feynman")||"[]");

function startFeynman(){
  const t=safeGet("feynTopic").value.trim();
  if(!t){showToast("Enter a topic first! 📚","⚠️");return;}
  feynIdx=0;feynNotes=["","","",""];
  safeGet("feynStartBtn").style.display="none";
  safeGet("feynTopic").disabled=true;
  safeGet("feyn-tracker").style.display="block";
  feynGoToStep(0,safeQueryAll("#feynStepBtns .phase-tab")[0]);
}
function feynStep(i,btn){saveFeynNote();feynGoToStep(i,btn);}
function feynGoToStep(i,btn){
  feynIdx=i;
  safeQueryAll("#feynStepBtns .phase-tab").forEach(b=>b.classList.remove("active"));
  if(btn)btn.classList.add("active");
  const s=feynSteps[i];
  safeGet("feynContent").innerHTML=`<div style="background:var(--purple-light);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:10px;"><div style="font-size:.78rem;font-weight:800;color:var(--purple-deep);margin-bottom:4px;">Step ${i+1} of 4</div><div style="font-size:.85rem;font-weight:600;color:var(--text-soft);">${s.prompt}</div></div><textarea id="feynNote" class="input" rows="5" placeholder="${s.ph}" style="resize:vertical;line-height:1.6;">${feynNotes[i]}</textarea><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">${i>0?`<button class="btn btn-outline btn-sm" onclick="feynBack()">← Back</button>`:""} ${i<3?`<button class="btn btn-primary btn-sm" onclick="feynNext()">Next →</button>`:`<button class="btn btn-mint btn-sm" onclick="feynFinish()">✅ Complete!</button>`}</div>`;
  feynLeft=feynTotalT=s.mins*60;
  feynRunning=false;if(feynInt)clearInterval(feynInt);
  safeGet("feynTimerBtn").textContent="▶ Start";
  safeGet("feynTimerLabel").textContent=`STEP ${i+1}`;
  updateFeynDisplay();
}
function saveFeynNote(){const n=safeGet("feynNote");if(n)feynNotes[feynIdx]=n.value;}
function feynNext(){saveFeynNote();if(feynIdx<3){const b=safeQueryAll("#feynStepBtns .phase-tab")[feynIdx+1];feynGoToStep(feynIdx+1,b);}}
function feynBack(){saveFeynNote();if(feynIdx>0){const b=safeQueryAll("#feynStepBtns .phase-tab")[feynIdx-1];feynGoToStep(feynIdx-1,b);}}
function feynFinish(){
  saveFeynNote();
  const t=safeGet("feynTopic").value.trim();
  feynSessions.unshift({topic:t,date:new Date().toLocaleString(),notes:[...feynNotes]});
  if(feynSessions.length>10)feynSessions.pop();
  localStorage.setItem("fy_feynman",JSON.stringify(feynSessions));
  renderFeynHistory();showToast("Feynman session saved! 🎉","🏆");
  safeGet("feyn-tracker").style.display="none";
  safeGet("feynStartBtn").style.display="inline-flex";
  safeGet("feynTopic").disabled=false;safeGet("feynTopic").value="";
  feynRunning=false;if(feynInt)clearInterval(feynInt);
}
function toggleFeynTimer(){
  if(feynRunning){clearInterval(feynInt);feynRunning=false;safeGet("feynTimerBtn").textContent="▶ Resume";}
  else{
    feynRunning=true;safeGet("feynTimerBtn").textContent="⏸ Pause";
    feynInt=setInterval(()=>{feynLeft--;updateFeynDisplay();if(feynLeft<=0){clearInterval(feynInt);feynRunning=false;safeGet("feynTimerBtn").textContent="▶ Start";triggerAlarm(`Step ${feynIdx+1} done! Move to next step 👉`);}},1000);
    if(typeof FocusVoice !== 'undefined') FocusVoice.speakTimerStart();
  }
}
function resetFeynTimer(){clearInterval(feynInt);feynRunning=false;feynLeft=feynTotalT;updateFeynDisplay();safeGet("feynTimerBtn").textContent="▶ Start";}
function updateFeynDisplay(){
  const m=Math.floor(feynLeft/60).toString().padStart(2,"0"),s=(feynLeft%60).toString().padStart(2,"0");
  safeGet("feynDisplay").textContent=`${m}:${s}`;
  safeGet("feynRing").style.strokeDashoffset=415*(1-feynLeft/feynTotalT);
}
function renderFeynHistory(){
  const el=safeGet("feynHistory");
  if(!feynSessions.length){el.innerHTML=`<div style="color:var(--text-muted);font-size:.85rem;font-weight:600;">Complete a session to see it here!</div>`;return;}
  el.innerHTML=feynSessions.map((s,i)=>`<div style="padding:10px 12px;background:var(--bg);border-radius:var(--radius-sm);border:1.5px solid var(--border);margin-bottom:6px;cursor:pointer;" onclick="toggleFD(${i})"><div style="font-size:.85rem;font-weight:800;">📚 ${s.topic}</div><div style="font-size:.72rem;color:var(--text-muted);font-weight:600;">${s.date}</div><div id="fd-${i}" style="display:none;margin-top:8px;font-size:.78rem;color:var(--text-soft);line-height:1.6;white-space:pre-wrap;">${s.notes.filter(Boolean).join("\n\n---\n\n")}</div></div>`).join("");
}
function toggleFD(i){const el=safeGet(`fd-${i}`);el.style.display=el.style.display==="none"?"block":"none";}
renderFeynHistory();

// ══════════════════════════════════
//  52/17 METHOD
// ══════════════════════════════════
let ftDur={work:52*60,brk:17*60};
let ftPhase="work",ftLeft,ftTotal,ftRunning=false,ftInt=null;
let ftCycles=0,ftFocusSec=0;
const ft52Tips=["During your 17-min break, take a real walk — no phone! Your brain consolidates learning while you rest. 🚶","The 52 minutes must be DEEP work — one task only. Close all notifications! 📵","After 3 cycles, reward yourself with something you enjoy — you've earned it! 🎁","Use your break to hydrate and do light stretching. Physical movement boosts brain performance. 💧"];
safeGet("ftTip").textContent=ft52Tips[Math.floor(Math.random()*ft52Tips.length)];

function updateFTDur(){ftDur.work=parseInt(safeGet("ftWorkMin").value)*60;ftDur.brk=parseInt(safeGet("ftBreakMin").value)*60;safeGet("ftWork").textContent=`🧠 Work: ${safeGet("ftWorkMin").value} min`;safeGet("ftBreak").textContent=`☕ Break: ${safeGet("ftBreakMin").value} min`;if(!ftRunning)resetFT();}
function updateFTDots(){const n=parseInt(safeGet("ftCycleN").value)||4;safeGet("ftDots").innerHTML=Array.from({length:n},(_,i)=>`<div class="session-dot ${i===0?'active':''}"></div>`).join("");}

function resetFT(){
  clearInterval(ftInt);ftRunning=false;ftPhase="work";ftLeft=ftTotal=ftDur.work;
  updateFTDisplay();safeGet("ftBtn").textContent="▶ Start";
  safeGet("ftEmoji").textContent="🧠";safeGet("ftLabel").textContent="DEEP WORK";
  setFTUI("work");if(typeof onMonTimerStop==="function")onMonTimerStop();
}
function setFTUI(phase){
  const w=safeGet("ftWork"),b=safeGet("ftBreak");
  if(phase==="work"){w.style.background="linear-gradient(135deg,var(--purple-deep),var(--pink-deep))";w.style.color="white";b.style.background="var(--border)";b.style.color="var(--text-muted)";}
  else{b.style.background="linear-gradient(135deg,var(--mint),#A8D8FF)";b.style.color="#1E5C47";w.style.background="var(--border)";w.style.color="var(--text-muted)";}
}
function toggleFT(){
  if(ftRunning){clearInterval(ftInt);ftRunning=false;safeGet("ftBtn").textContent="▶ Resume";if(typeof onMonPause==="function")onMonPause();}
  else{
    ftRunning=true;safeGet("ftBtn").textContent="⏸ Pause";ftInt=setInterval(ftTick,1000);
    if(ftPhase==="work"&&typeof onMonStudyStart==="function")onMonStudyStart();
    if(typeof FocusVoice !== 'undefined') FocusVoice.speakTimerStart();
  }
}
function ftTick(){
  ftLeft--;if(ftPhase==="work")ftFocusSec++;updateFTDisplay();
  if(ftLeft<=0){
    clearInterval(ftInt);ftRunning=false;safeGet("ftBtn").textContent="▶ Start";
    if(ftPhase==="work"){
      ftCycles++;
      safeGet("ftCycles").textContent=ftCycles;
      safeGet("ftFocus").textContent=Math.round(ftFocusSec/60)+"m";
      safeGet("ftXP").textContent=ftCycles*20;
      updateFTCycleDots();
      triggerAlarm("52 minutes done! Take your true 17-min break ☕ +20 XP!");
      showToast("52 min done! Take a real break 🎉","⚡");
      ftPhase="brk";ftLeft=ftTotal=ftDur.brk;
      safeGet("ftEmoji").textContent="☕";safeGet("ftLabel").textContent="TRUE BREAK";setFTUI("brk");
      if(typeof onMonBreakStart==="function")onMonBreakStart();
    }else{
      triggerAlarm("Break over! Time for deep work 💪");
      showToast("Break over! Deep work time 🧠","⚡");
      ftPhase="work";ftLeft=ftTotal=ftDur.work;
      safeGet("ftEmoji").textContent="🧠";safeGet("ftLabel").textContent="DEEP WORK";setFTUI("work");
    }
    updateFTDisplay();
  }
}
function updateFTDisplay(){
  const m=Math.floor(ftLeft/60).toString().padStart(2,"0"),s=(ftLeft%60).toString().padStart(2,"0");
  safeGet("ftDisplay").textContent=`${m}:${s}`;
  safeGet("ftRing").style.strokeDashoffset=CIRC*(1-ftLeft/ftTotal);
}
function updateFTCycleDots(){
  const dots=safeQueryAll("#ftDots .session-dot"),idx=ftCycles%dots.length;
  dots.forEach((d,i)=>{d.classList.remove("active","done");if(i<idx)d.classList.add("done");if(i===idx)d.classList.add("active");});
}
resetFT();

// ══════════════════════════════════
//  AMBIENT SOUNDS — MP3 Version
// ══════════════════════════════════

const soundNames = {
  rain:   "🌧️ Rain",
  forest: "🌲 Forest",
  cafe:   "☕ Café",
  ocean:  "🌊 Ocean",
  fire:   "🔥 Fireplace",
  white:  "🌫️ White Noise",
  lofi:   "🎧 Lo-Fi",
  birds:  "🐦 Birds"
};

// One shared <audio> element — reused for every sound
let ambientAudio  = null;
let curSoundType  = null;
let curVol        = 0.5;
let lastAudioErrorType = null;

function getAudioEl() {
  if (!ambientAudio) {
    ambientAudio         = new Audio();
    ambientAudio.loop    = true;
    ambientAudio.volume  = curVol;
    // Smooth fade on end (shouldn't happen with loop=true but safety net)
    ambientAudio.addEventListener("error", (e) => {
      const failedType = curSoundType;
      if (failedType && failedType === lastAudioErrorType) return;
      lastAudioErrorType = failedType;

      console.warn("Ambient audio error:", e, "src:", ambientAudio.src, "type:", failedType);
      showToast("Could not load sound file. Check static/sounds/ folder and browser audio support.", "⚠️");
      if (ambientAudio) {
        ambientAudio.loop = false;
        ambientAudio.pause();
        ambientAudio.currentTime = 0;
        ambientAudio.src = "";
      }
      stopAll(true);
    });
  }
  return ambientAudio;
}

// ── Stop current sound ──
function stopAll(updateUI = true) {
  if (ambientAudio) {
    ambientAudio.pause();
    ambientAudio.currentTime = 0;
  }
  curSoundType = null;
  lastAudioErrorType = null;
  if (updateUI) {
    safeQueryAll(".sound-btn").forEach(b => b.classList.remove("playing"));
    const np = safeGet("nowPlaying");
    if (np) np.textContent = "Nothing selected";
  }
}

// ── Play a sound from static/sounds/ ──
function playSound(btn, type) {
  // Toggle off if same sound clicked again
  if (curSoundType === type) {
    stopAll(true);
    return;
  }

  const audio = getAudioEl();

  // Stop previous
  audio.pause();
  audio.currentTime = 0;

  // Set new source — files live in static/sounds/
  audio.src    = `/static/sounds/${type}.mp3`;
  audio.volume = curVol;
  audio.loop   = true;

  // Play (returns a promise in modern browsers)
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(err => {
      console.warn("Play failed:", err);
      showToast("Click the page first to enable audio!", "🔊");
    });
  }

  curSoundType = type;

  // Update UI
  safeQueryAll(".sound-btn").forEach(b => b.classList.remove("playing"));
  btn.classList.add("playing");
  const np = safeGet("nowPlaying");
  if (np) np.textContent = soundNames[type] || type;
}

// ── Volume control ──
function setVol(v) {
  curVol = v / 100;
  const pctEl = safeGet("volPct");
  if (pctEl) pctEl.textContent = v + "%";
  if (ambientAudio) {
    ambientAudio.volume = curVol;
  }
}

// ══════════════════════════════════════════════
//  AI FOCUS MONITOR hooks
//  Full implementation is in ai_monitor.js (global)
//  These functions are defined there and called here.
// ══════════════════════════════════════════════
// onMonStudyStart(), onMonBreakStart(), onMonPause(), onMonTimerStop()
// are all defined in ai_monitor.js — no need to redefine here.

// All monitoring functions are now in static/ai_monitor.js (global component).