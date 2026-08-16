// ════════════════════════════════════════
//  dashboard.js  — requires fy_stats.js
//  Place in: AI/static/dashboard.js
// ════════════════════════════════════════

// USERNAME is set by Flask inline in dashboard.html
document.getElementById("sidebarName").textContent  = USERNAME;
document.getElementById("avatarLetter").textContent = USERNAME.charAt(0).toUpperCase();

// ── Check streak on every dashboard visit ──
fyCheckStreak();

// ── FEATURE 1: Smart Time-Based Greeting ──
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

// ── FEATURE 2: Auto-Rotating Motivation Quotes ──
const motivations=[
  {emoji:"🌸",text:"Small steps every day lead to big results!",              sub:"You've got this 💪"},
  {emoji:"🔥",text:"Consistency beats perfection every time.",                sub:"Keep that streak alive!"},
  {emoji:"🎯",text:"Focus on progress, not perfection.",                      sub:"One task at a time ✨"},
  {emoji:"🌟",text:"Your future self will thank you for studying today.",     sub:"FocusYou is with you ☕"},
  {emoji:"🐰",text:"Even the bunny studies hard!",                            sub:"Hop to it! 🥕"},
  {emoji:"💎",text:"Discipline is choosing what you want most over what you want now.", sub:"Choose your future self 🏆"},
  {emoji:"🚀",text:"Every expert was once a beginner. Keep going!",           sub:"Progress over perfection 🌈"},
  {emoji:"🧠",text:"Your brain is a muscle — the more you use it, the stronger it gets.", sub:"Study hard, grow harder 💡"},
  {emoji:"⚡",text:"Success is the sum of small efforts repeated day in and day out.", sub:"One more task = one step closer 🎯"},
  {emoji:"🌺",text:"Don't watch the clock — do what it does. Keep going.",   sub:"Time flies when you're focused ⏱️"},
  {emoji:"🦋",text:"Believe you can and you're halfway there.",               sub:"Confidence is your superpower ✨"},
  {emoji:"📚",text:"The secret of getting ahead is getting started.",         sub:"Start now, not later! 🌟"},
  {emoji:"🏆",text:"Winners are not people who never fail, but people who never quit.", sub:"Never give up 🔥"},
  {emoji:"☕",text:"Today's hard work is tomorrow's easy review.",            sub:"FocusYou believes in you 🐰"},
  {emoji:"🌙",text:"Great things never came from comfort zones.",             sub:"Push a little further today 💪"},
];
let motIndex=Math.floor(Math.random()*motivations.length);

function applyMotivation(m){
  const card=document.querySelector(".motivation-card");
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

// ── Quick Ask AI ──
function setQ(text){const i=document.getElementById("quickInput");i.value=text;i.focus();}
async function quickAsk(){
  const input=document.getElementById("quickInput"),btn=document.getElementById("askBtn"),result=document.getElementById("quick-result");
  const text=input.value.trim();if(!text)return;
  btn.disabled=true;btn.textContent="...";
  result.style.display="block";
  result.innerHTML='<span style="color:#B0A0CC">🤖 Thinking…</span>';
  try{
    const res=await fetch("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text})});
    const data=await res.json();
    result.innerHTML=data.reply.replace(/\n/g,"<br/>");
  }catch(e){result.innerHTML="⚠️ Something went wrong. <a href='/chatbot'>Try Full Chat</a>";}
  btn.disabled=false;btn.textContent="Ask 🚀";
}

// ── Mobile sidebar ──
document.getElementById("menuToggle").onclick=()=>{document.getElementById("sidebar").classList.toggle("open");document.getElementById("overlay").classList.toggle("open");};
document.getElementById("overlay").onclick   =()=>{document.getElementById("sidebar").classList.remove("open");document.getElementById("overlay").classList.remove("open");};

// ── Live Stats Display ──
function refreshDashStats(){
  const stats=fyLoadStats();
  const grade=fyGetGrade(stats.xp);
  const next =fyGetNextGrade(stats.xp);
  const pct  =next?Math.min(100,Math.round((stats.xp-grade.min)/(next.min-grade.min)*100)):100;

  document.getElementById("dashXP").textContent       =stats.xp;
  document.getElementById("dashXPSub").textContent    =next?(next.min-stats.xp)+" XP to "+next.name:"MAX level! 🏅";
  document.getElementById("dashStreak").textContent   =stats.streak||0;
  document.getElementById("dashStreakSub").textContent=(stats.streak||0)===1?"consecutive day":"consecutive days";
  document.getElementById("dashGrade").textContent    =grade.name;
  document.getElementById("dashGradeSub").textContent =next?pct+"% to "+next.name:"Legendary! 🏅";
  document.getElementById("dashGradeBar").style.width =pct+"%";
  document.getElementById("dashDone").textContent     =stats.totalDone||0;
}
refreshDashStats();
setInterval(refreshDashStats,3000);
window.addEventListener("storage",(e)=>{if(e.key==="fy_stats"||e.key==="fy_stats_updated")refreshDashStats();});