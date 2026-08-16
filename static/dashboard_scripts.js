// ════════════════════════════════════════════════════
//  fy_stats.js + dashboard.js — combined
// ════════════════════════════════════════════════════

// ── Stats Engine ──
function fyLoadStats(){
  const raw=localStorage.getItem("fy_stats");
  return raw?JSON.parse(raw):{xp:0,streak:0,lastActiveDate:"",totalDone:0};
}
function fySaveStats(s){
  localStorage.setItem("fy_stats",JSON.stringify(s));
}

function fyCheckStreak(){
  const stats=fyLoadStats();
  const today=new Date().toISOString().split("T")[0];
  if(stats.lastActiveDate===today)return stats;
  const yesterday=new Date(Date.now()-86400000).toISOString().split("T")[0];
  if(stats.lastActiveDate===yesterday){
    stats.streak=(stats.streak||0)+1;
    fyShowStreakToast(stats.streak,"up");
  }else if(!stats.lastActiveDate){
    stats.streak=1;
  }else{
    const lost=stats.streak;
    stats.streak=1;
    fyShowStreakToast(lost,"broken");
  }
  stats.lastActiveDate=today;
  fySaveStats(stats);
  return stats;
}

function fyAddXP(amount,reason){
  const stats=fyLoadStats();
  stats.xp=(stats.xp||0)+amount;
  stats.totalDone=(stats.totalDone||0)+1;
  fySaveStats(stats);
  fyShowXPToast(amount,reason);
  localStorage.setItem("fy_stats_updated",Date.now());
  return stats;
}

function fyRemoveXP(amount){
  const stats=fyLoadStats();
  stats.xp=Math.max(0,(stats.xp||0)-amount);
  stats.totalDone=Math.max(0,(stats.totalDone||0)-1);
  fySaveStats(stats);
  localStorage.setItem("fy_stats_updated",Date.now());
  return stats;
}

const FY_XP_MAP={high:30,med:20,low:10};
function fyXPForPriority(p){return FY_XP_MAP[p]||20;}

function fyShowXPToast(amount,reason){
  fyToast("+"+amount+" XP — "+(reason||"Task done!"),"⭐");
}
function fyShowStreakToast(streak,type){
  if(type==="up"){
    if(streak>=7)fyToast("🔥 "+streak+" day streak! You're on fire!","🏆");
    else fyToast("Streak: "+streak+" days in a row!","🔥");
  }else{
    fyToast("Streak lost ("+streak+" days). Starting fresh — day 1! 💪","😢");
  }
}
function fyToast(msg,icon){
  const old=document.getElementById("fy-toast");
  if(old)old.remove();
  const t=document.createElement("div");
  t.id="fy-toast";
  t.innerHTML="<span style='font-size:1.3rem'>"+icon+"</span> "+msg;
  Object.assign(t.style,{
    position:"fixed",bottom:"28px",right:"28px",
    background:"linear-gradient(135deg,#9D87F5,#FF85A1)",
    color:"white",padding:"13px 22px",borderRadius:"99px",
    fontFamily:"'Nunito',sans-serif",fontWeight:"800",fontSize:".9rem",
    boxShadow:"0 6px 24px rgba(157,135,245,.45)",zIndex:"9999",
    display:"flex",alignItems:"center",gap:"10px",
    transform:"translateY(80px)",opacity:"0",
    transition:"all .35s cubic-bezier(.34,1.56,.64,1)",
  });
  document.body.appendChild(t);
  requestAnimationFrame(()=>{t.style.transform="translateY(0)";t.style.opacity="1";});
  setTimeout(()=>{
    t.style.transform="translateY(80px)";t.style.opacity="0";
    setTimeout(()=>t.remove(),400);
  },3000);
}

const FY_GRADES=[
  {name:"Seedling 🌱",min:0},
  {name:"Learner 📖",min:100},
  {name:"Scholar 🎓",min:300},
  {name:"Achiever ⭐",min:600},
  {name:"Expert 🔥",min:1000},
  {name:"Master 🏆",min:1500},
  {name:"Legend 💎",min:2500},
];
function fyGetGrade(xp){let g=FY_GRADES[0];for(const gr of FY_GRADES){if(xp>=gr.min)g=gr;}return g;}
function fyGetNextGrade(xp){for(const g of FY_GRADES){if(xp<g.min)return g;}return null;}


// ════════════════════════════════════════
//  Dashboard Logic
// ════════════════════════════════════════

document.getElementById("sidebarName").textContent  = USERNAME;
document.getElementById("avatarLetter").textContent = USERNAME.charAt(0).toUpperCase();

fyCheckStreak();

// ── Greeting ──
function setGreeting(){
  const h=new Date().getHours();
  let label,icon,sub;
  if     (h>=5 &&h<12){label="Good Morning";  icon="☀️"; sub="Rise and shine — your best study session awaits!";}
  else if(h>=12&&h<17){label="Good Afternoon";icon="🌤️";sub="Keep the momentum going — you're doing great!";}
  else if(h>=17&&h<21){label="Good Evening";  icon="🌆"; sub="Evening focus sessions build champions!";}
  else                {label="Good Night";    icon="🌙"; sub="Late-night grind — remember to rest too! 💤";}
  document.getElementById("greeting").textContent = label+", "+USERNAME+"! "+icon;
  document.getElementById("greetSub").textContent = sub;
}
setGreeting();

// ── Motivation Quotes ──
const motivations=[
  {emoji:"🌸",text:"Small steps every day lead to big results!",sub:"You've got this 💪"},
  {emoji:"🔥",text:"Consistency beats perfection every time.",sub:"Keep that streak alive!"},
  {emoji:"🎯",text:"Focus on progress, not perfection.",sub:"One task at a time ✨"},
  {emoji:"🌟",text:"Your future self will thank you for studying today.",sub:"FocusYou is with you ☕"},
  {emoji:"🐰",text:"Even the bunny studies hard!",sub:"Hop to it! 🥕"},
  {emoji:"💎",text:"Discipline is choosing what you want most over what you want now.",sub:"Choose your future self 🏆"},
  {emoji:"🚀",text:"Every expert was once a beginner. Keep going!",sub:"Progress over perfection 🌈"},
  {emoji:"🧠",text:"Your brain is a muscle — the more you use it, the stronger it gets.",sub:"Study hard, grow harder 💡"},
  {emoji:"⚡",text:"Success is the sum of small efforts repeated day in and day out.",sub:"One more task = one step closer 🎯"},
  {emoji:"🌺",text:"Don't watch the clock — do what it does. Keep going.",sub:"Time flies when you're focused ⏱️"},
  {emoji:"🦋",text:"Believe you can and you're halfway there.",sub:"Confidence is your superpower ✨"},
  {emoji:"📚",text:"The secret of getting ahead is getting started.",sub:"Start now, not later! 🌟"},
  {emoji:"🏆",text:"Winners are not people who never fail, but people who never quit.",sub:"Never give up 🔥"},
  {emoji:"☕",text:"Today's hard work is tomorrow's easy review.",sub:"FocusYou believes in you 🐰"},
  {emoji:"🌙",text:"Great things never came from comfort zones.",sub:"Push a little further today 💪"},
];
let motIndex=Math.floor(Math.random()*motivations.length);

function applyMotivation(m){
  const card=document.querySelector(".motivation-card");
  if(!card) return;
  card.style.transition="opacity 0.4s ease";
  card.style.opacity="0";
  setTimeout(()=>{
    document.getElementById("motEmoji").textContent=m.emoji;
    document.getElementById("motText").textContent =m.text;
    document.getElementById("motSub").textContent  =m.sub;
    card.style.opacity="1";
  },400);
}
applyMotivation(motivations[motIndex]);
setInterval(()=>{motIndex=(motIndex+1)%motivations.length;applyMotivation(motivations[motIndex]);},10000);
function nextMotivation(){motIndex=(motIndex+1)%motivations.length;applyMotivation(motivations[motIndex]);}

// ── Bunny react ──
function bunnyReact(){
  const b=document.getElementById("headerBunny");
  const moods=[
    {face:"😄",text:"You're doing great!"},
    {face:"🤓",text:"Time to study!"},
    {face:"😴",text:"Don't sleep! Stay focused!"},
    {face:"🥕",text:"Here's a carrot reward!"},
  ];
  const r=moods[Math.floor(Math.random()*moods.length)];
  b.textContent=r.face;
  document.getElementById("greetSub").textContent=r.text;
  setTimeout(()=>{b.textContent="🐰";setGreeting();},2000);
}

// ── Quick Ask AI (calls Groq directly from browser) ──
const GROQ_API_KEY = "";

function setQ(text){
  const i=document.getElementById("quickInput");
  if(i){i.value=text;i.focus();}
}

async function quickAsk(){
  const input  = document.getElementById("quickInput");
  const btn    = document.getElementById("askBtn");
  const result = document.getElementById("quick-result");
  if(!input || !btn || !result) return;

  const text = input.value.trim();
  if(!text) return;

  btn.disabled    = true;
  btn.textContent = "...";
  result.style.display = "block";
  result.innerHTML = '<div style="padding:10px 0;color:#B0A0CC;font-size:.88rem;font-weight:700">🤖 Thinking…</div>';

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + GROQ_KEY
      },
      body: JSON.stringify({
        model:      "llama-3.3-70b-versatile",
        messages:   [
          { role: "system", content: "You are a helpful, friendly study assistant for FocusYou app. Keep replies concise, clear and encouraging. Max 3-4 sentences." },
          { role: "user",   content: text }
        ],
        max_tokens:  300,
        temperature: 0.7,
        stream:      false
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || "API error " + res.status);
    }

    const data  = await res.json();
    const reply = data.choices?.[0]?.message?.content || "No response";

    result.innerHTML = `
      <div style="
        margin-top:8px;
        padding:14px 16px;
        background:linear-gradient(135deg,#EDE8FF,#FFE8F4);
        border-radius:14px;
        font-size:.88rem;
        font-weight:600;
        color:#3D2C5E;
        line-height:1.75;
        border:1.5px solid #C9B8FF;
        box-shadow:0 2px 10px rgba(157,135,245,.12);
      ">🐰 ${reply.replace(/\n/g,"<br/>")}</div>
      <div style="text-align:right;margin-top:6px;">
        <a href="/chatbot" style="font-size:.75rem;font-weight:800;color:#9D87F5;text-decoration:none;">
          Continue in Full Chat →
        </a>
      </div>`;

  } catch(e) {
    console.error("quickAsk error:", e);
    result.innerHTML = `
      <div style="color:#FF85A1;font-size:.85rem;padding:8px 0;font-weight:700">
        ⚠️ ${e.message || "Something went wrong."}
        <a href="/chatbot" style="color:#9D87F5;margin-left:6px;">Try Full Chat →</a>
      </div>`;
  } finally {
    btn.disabled    = false;
    btn.textContent = "Ask 🚀";
  }
}

// ── Mobile sidebar ──
const menuToggle = document.getElementById("menuToggle");
const sidebar    = document.getElementById("sidebar");
const overlay    = document.getElementById("overlay");
if(menuToggle) menuToggle.onclick = () => { sidebar.classList.toggle("open"); overlay.classList.toggle("open"); };
if(overlay)    overlay.onclick    = () => { sidebar.classList.remove("open"); overlay.classList.remove("open"); };

// ── Today's Planner Tasks ──
function renderTodayTasks(){
  const raw   = localStorage.getItem("fy_todos");
  const todos = raw ? JSON.parse(raw) : [];
  const today = new Date().toISOString().split("T")[0];
  const todayTodos = todos.filter(t=>t.date===today);
  const el = document.getElementById("dashTodayTasks");
  if(!el) return;
  if(todayTodos.length===0){
    el.innerHTML="<div style='text-align:center;padding:10px 0;color:var(--text-muted);font-size:.88rem'>No tasks for today! Enjoy your free time 🌿</div>";
    return;
  }
  const catEmoji={study:"📚",revision:"🔁",exam:"🎯",break:"☕",other:"📌"};
  el.innerHTML=todayTodos.map(t=>`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;opacity:${t.done?0.6:1}">
      <span style="font-size:1rem;flex-shrink:0;">${t.done?"✅":"⏳"}</span>
      <span style="text-decoration:${t.done?'line-through':'none'};color:${t.done?'var(--text-muted)':'var(--text)'};font-weight:700;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${t.text}">
        ${catEmoji[t.category]||"📌"} ${t.text}
      </span>
    </div>`).join("");
}
renderTodayTasks();
window.addEventListener("storage",(e)=>{if(e.key==="fy_todos")renderTodayTasks();});

// ── Live Stats ──
function refreshDashStats(){
  const stats=fyLoadStats();
  const grade=fyGetGrade(stats.xp);
  const next =fyGetNextGrade(stats.xp);
  const pct  =next?Math.min(100,Math.round((stats.xp-grade.min)/(next.min-grade.min)*100)):100;

  document.getElementById("dashXP").textContent       = stats.xp;
  document.getElementById("dashXPSub").textContent    = next?(next.min-stats.xp)+" XP to "+next.name:"MAX level! 🏅";
  document.getElementById("dashStreak").textContent   = stats.streak||0;
  document.getElementById("dashStreakSub").textContent = (stats.streak||0)===1?"consecutive day":"consecutive days";
  document.getElementById("dashGrade").textContent    = grade.name;
  document.getElementById("dashGradeSub").textContent = next?pct+"% to "+next.name:"Legendary! 🏅";
  document.getElementById("dashGradeBar").style.width = pct+"%";
  document.getElementById("dashDone").textContent     = stats.totalDone||0;
}
refreshDashStats();
setInterval(refreshDashStats,3000);
window.addEventListener("storage",(e)=>{if(e.key==="fy_stats"||e.key==="fy_stats_updated")refreshDashStats();});