// pjax.js - Lightweight SPA routing for FocusYou to keep audio and timers alive
document.addEventListener("DOMContentLoaded", () => {
    document.body.addEventListener("click", async (e) => {
        // Intercept sidebar links and internal navigation cards
        const link = e.target.closest("a.nav-link, a.menu-card, .menu-grid a, .chips-row a");
        if (link && link.tagName === 'A' && link.href && link.origin === window.location.origin) {
            e.preventDefault();
            const url = link.href;
            
            try {
                const response = await fetch(url);
                const html = await response.text();
                
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                
                const newMain = doc.querySelector("main.main-content");
                const currentMain = document.querySelector("main.main-content");
                
                if (newMain && currentMain) {
                    // Replace main content
                    currentMain.innerHTML = newMain.innerHTML;
                    
                    // Update active link in sidebar
                    document.querySelectorAll("a.nav-link").forEach(a => {
                        a.classList.remove("active");
                        if (a.href === url) a.classList.add("active");
                    });
                    
                    // Update URL and history natively
                    window.history.pushState({}, "", url);
                    
                    // Re-evaluate scripts within the new main content
                    const scripts = currentMain.querySelectorAll("script");
                    scripts.forEach(oldScript => {
                        const newScript = document.createElement("script");
                        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                        newScript.textContent = oldScript.textContent;
                        oldScript.parentNode.replaceChild(newScript, oldScript);
                    });
                    
                    // If moving to/from timer, ensure timer UI updates if timer is running
                    if (typeof updatePomDisplay === "function") {
                        try { updatePomDisplay(); updateFTDisplay(); updateFeynDisplay(); } catch(err){}
                    }
                    
                    // Close mobile sidebar if open
                    const sidebar = document.getElementById("sidebar");
                    const overlay = document.getElementById("overlay");
                    if (sidebar) sidebar.classList.remove("open");
                    if (overlay) overlay.classList.remove("open");

                } else {
                    // Fallback to normal navigation if structure differs
                    window.location.href = url;
                }
            } catch (error) {
                console.error("PJAX error:", error);
                window.location.href = url;
            }
        }
    });
    
    // Handle back/forward buttons natively
    window.addEventListener("popstate", () => {
        window.location.reload();
    });
});
