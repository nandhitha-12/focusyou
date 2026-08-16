document.addEventListener("DOMContentLoaded", async () => {
    // 1. Load LocalStorage Data (XP, Tasks, Streak)
    const stats = fyLoadStats();
    
    // Streak
    document.getElementById("stkCur").textContent = (stats.streak || 0) + " Days 🔥";
    if (!stats.best_streak || stats.streak > stats.best_streak) {
        stats.best_streak = stats.streak;
        fySaveStats(stats);
    }
    document.getElementById("stkBest").textContent = (stats.best_streak || 0) + " Days 🏆";

    // XP
    const grade = fyGetGrade(stats.xp);
    const nextGrade = fyGetNextGrade(stats.xp);
    document.getElementById("xpCur").textContent = stats.xp;
    document.getElementById("xpNext").textContent = nextGrade ? nextGrade.min : "MAX";
    document.getElementById("xpLvlName").textContent = grade.name;
    document.getElementById("xpLvlIcon").textContent = grade.name.slice(-2);
    let xpPct = 100;
    if (nextGrade) {
        xpPct = Math.min(100, Math.max(0, ((stats.xp - grade.min) / (nextGrade.min - grade.min)) * 100));
    }
    document.getElementById("xpBar").style.width = xpPct + "%";

    // Tasks created vs completed
    const rawTodos = localStorage.getItem("fy_todos");
    const todos = rawTodos ? JSON.parse(rawTodos) : [];
    const totalTasks = todos.length;
    const doneTasks = todos.filter(t => t.done).length;
    document.getElementById("taskTotal").textContent = totalTasks;
    document.getElementById("taskDone").textContent = doneTasks;
    let completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    document.getElementById("taskRate").textContent = completionRate + "%";

    // Daily Goals
    const todayStr = new Date().toISOString().split("T")[0];
    const todayTodos = todos.filter(t => t.date === todayStr);
    const todayDone = todayTodos.filter(t => t.done).length;
    const todayTotal = todayTodos.length;
    const goalList = document.getElementById("dailyGoalsList");
    if (goalList) {
        if (todayTotal === 0) {
            goalList.innerHTML = `<div class="goal-item" style="justify-content:center;color:var(--text-muted);">No goals for today!</div>`;
        } else {
            goalList.innerHTML = todayTodos.map(t => `
                <div class="goal-item ${t.done ? 'done' : ''}">
                    <span>${t.done ? '✅' : '⬜'}</span>
                    <span class="g-text">${t.text}</span>
                </div>
            `).join("");
        }
    }
    const goalProgTxt = document.getElementById("goalProgTxt");
    if (goalProgTxt) {
        const todayPct = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;
        goalProgTxt.textContent = `${todayDone}/${todayTotal} (${todayPct}%)`;
        const goalProgBar = document.getElementById("goalProgBar");
        if (goalProgBar) {
            goalProgBar.style.width = todayPct + "%";
        }
    }

    // 2. Fetch Backend Data (Subjects, Placement, Study Hours)
    try {
        const res = await fetch("/api/progress_data");
        const dbData = await res.json();
        
        // Study Hours
        let todayMins = 0, weekMins = 0, monthMins = 0;
        const now = new Date();
        const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        let weekData = [0,0,0,0,0,0,0]; // Sun to Sat
        
        dbData.study_sessions.forEach(s => {
            const sDate = new Date(s.date);
            if (s.date === todayStr) todayMins += s.duration;
            if (sDate >= startOfWeek) {
                weekMins += s.duration;
                if(sDate.getDay() >=0 && sDate.getDay()<=6) weekData[sDate.getDay()] += s.duration / 60; // in hours
            }
            if (sDate >= startOfMonth) monthMins += s.duration;
        });

        const todayHrs = (todayMins / 60).toFixed(1);
        const weekHrs = (weekMins / 60).toFixed(1);
        const monthHrs = (monthMins / 60).toFixed(1);

        document.getElementById("shToday").textContent = `${todayHrs} hrs`;
        document.getElementById("shWeek").textContent = `${weekHrs} hrs`;
        
        // Let's assume daily goal is 4 hours (240 mins), weekly 28 hours
        document.getElementById("shTodayBar").style.width = Math.min(100, (todayMins / 240) * 100) + "%";
        document.getElementById("shWeekBar").style.width = Math.min(100, (weekMins / (28*60)) * 100) + "%";

        // Chart.js
        const ctx = document.getElementById('weeklyChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                datasets: [{
                    label: 'Study Hours',
                    data: weekData,
                    backgroundColor: 'rgba(157, 135, 245, 0.7)',
                    borderColor: 'rgba(157, 135, 245, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { display: false } }
            }
        });

        // Calculate Focus Score
        let focusScore = Math.min(100, Math.round(50 + (completionRate * 0.2) + ((stats.streak||0) * 1.5) + (todayHrs * 5)));
        document.getElementById("focusScoreVal").textContent = focusScore;
        let fLabel = "Needs Improvement";
        if (focusScore >= 90) fLabel = "Excellent 🔥";
        else if (focusScore >= 75) fLabel = "Good 👍";
        else if (focusScore >= 50) fLabel = "Average 📊";
        document.getElementById("focusScoreLbl").textContent = fLabel;

        const examReadiness = focusScore;
        document.getElementById("examReadinessTxt").textContent = examReadiness + "%";
        document.getElementById("examReadinessBar").style.width = examReadiness + "%";
        document.getElementById("examMascot").textContent = examReadiness >= 80 ? "😎" : (examReadiness >= 50 ? "🤔" : "😟");

        // Unlock Badges
        if (stats.xp >= 100) document.getElementById("bdg-xp").classList.remove("locked");
        if (stats.streak >= 7) document.getElementById("bdg-streak").classList.remove("locked");
        if (totalTasks >= 100) document.getElementById("bdg-tasks").classList.remove("locked");
        if (monthHrs >= 50) document.getElementById("bdg-hrs").classList.remove("locked");
        // We'll leave AI locked to be unlocked manually or if they chat

        // Fetch AI Insights
        fetchAIInsights(focusScore, weekHrs, examReadiness, stats.streak);

    } catch (e) {
        console.error("Failed to load progress data", e);
    }
});

// Update function
window.updateProg = async (type, id, name, oldVal) => {
    const val = prompt(`Enter new progress % for ${name} (0-100):`, oldVal);
    if (val === null) return;
    const progress = Math.min(100, Math.max(0, parseInt(val) || 0));
    await fetch("/api/update_progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, progress })
    });
    location.reload();
};

async function fetchAIInsights(focusScore, weekHrs, examReadiness, streak) {
    const promptStr = `Act as an encouraging AI Study Coach. Based on these stats: Focus Score=${focusScore}/100, Weekly Study Hours=${weekHrs}, Exam Readiness=${examReadiness}%, Streak=${streak} days. Write 3 short, very impressive, highly personalized insight bullet points. Output ONLY HTML string (like "<div>💡 insight 1</div><div>🚀 insight 2</div>"), no markdown.`;
    
    try {
        const res = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: promptStr })
        });
        const data = await res.json();
        let reply = data.reply.replace(/```html/g, "").replace(/```/g, "").trim();
        document.getElementById("aiInsightsContainer").innerHTML = `<div class="ai-bubble" style="line-height:1.8;">${reply}</div>`;
    } catch (e) {
        document.getElementById("aiInsightsContainer").innerHTML = `<div class="ai-bubble" style="color:red;">Could not load AI Insights. Keep focusing!</div>`;
    }
}
