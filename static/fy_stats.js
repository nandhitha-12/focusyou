// ════════════════════════════════════════════════════
//  fy_stats.js  — Shared Stats Engine (XP + Streak)
//  Place in: AI/static/fy_stats.js
// ════════════════════════════════════════════════════

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