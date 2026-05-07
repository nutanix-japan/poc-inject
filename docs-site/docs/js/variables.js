// variables.js - Updated for current main.py API

let currentUserData = null;

console.log("%c[Vars] variables.js loaded successfully", "color:#4caf50; font-weight:bold");

// ==================== LOGIN MODAL ====================
function showLoginModal() {
    if (document.getElementById("login-modal")) return;

    const modal = document.createElement("div");
    modal.id = "login-modal";
    modal.style = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.8);
        display: flex; align-items: center; justify-content: center; z-index: 10000;
    `;

    modal.innerHTML = `
        <div style="background: var(--md-default-bg-color); color: var(--md-default-fg-color); 
                    padding: 32px; border-radius: 12px; width: 420px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
            <h2 style="margin:0 0 10px 0;">Lab Access</h2>
            <p style="margin:0 0 20px 0; opacity:0.9;">Enter your email to load your lab data:</p>
            
            <input id="login-email" type="email" placeholder="user1@mail.com" 
                   style="width:100%; padding:14px; margin-bottom:16px; border-radius:8px; font-size:15px;">
            
            <button id="login-btn" style="width:100%; padding:14px; background:var(--md-primary-fg-color);
                    color:var(--md-primary-bg-color); border:none; border-radius:8px; cursor:pointer; font-size:16px;">
                Load My Lab Data
            </button>
            
            <p id="login-error" style="color:#ff6b6b; margin-top:12px; text-align:center; display:none;"></p>
        </div>
    `;

    document.body.appendChild(modal);

    const loginBtn = document.getElementById("login-btn");
    const errorEl = document.getElementById("login-error");

    loginBtn.onclick = async () => {
        const email = document.getElementById("login-email").value.trim();
        if (!email) return;

        loginBtn.textContent = "Loading...";
        loginBtn.disabled = true;
        errorEl.style.display = "none";

        try {
            // First validate email (optional but good)
            const validateRes = await fetch(`http://localhost:9000/api/validate-email?email=${encodeURIComponent(email)}`);
            const validateData = await validateRes.json();

            if (!validateData.valid) {
                errorEl.textContent = validateData.message || "Email not found";
                errorEl.style.display = "block";
                return;
            }

            // Fetch user variables
            const res = await fetch(`http://localhost:9000/api/variables?email=${encodeURIComponent(email)}`);
            const data = await res.json();

            if (data.variables) {
                currentUserData = data.variables;

                localStorage.setItem("labUserEmail", email);
                localStorage.setItem("labUserVariables", JSON.stringify(currentUserData));

                console.log("%c[Vars] Login successful for", "color:#a6e3a1", email);

                document.getElementById("login-modal").remove();
                setTimeout(initAfterLogin, 100);
            }
        } catch (err) {
            console.error(err);
            errorEl.textContent = "Failed to connect to backend (port 9000)";
            errorEl.style.display = "block";
        } finally {
            loginBtn.textContent = "Load My Lab Data";
            loginBtn.disabled = false;
        }
    };
};

// ==================== INIT & RESTORE ====================
async function initVariables() {
    const savedVars = localStorage.getItem("labUserVariables");
    if (savedVars) {
        try {
            currentUserData = JSON.parse(savedVars);
            console.log("%c[Vars] Restored user from localStorage", "color:#a6e3a1");
            initAfterLogin();
            return;
        } catch (e) {
            console.warn("Corrupted saved data, clearing...");
            localStorage.clear();
        }
    }
    showLoginModal();
}

function initAfterLogin() {
    injectStyles();
    replaceVariables(currentUserData);
    createFloatingPanel();
    createToggleButton();
}

// ==================== VARIABLE REPLACEMENT ====================
function replaceVariables(vars) {
    if (!vars) return;
    console.log("%c[Vars] Replacing variables. Available keys:", "color:#89b4fa", Object.keys(vars));

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const nodesToProcess = [];

    let node;
    while (node = walker.nextNode()) {
        if (node.nodeValue.includes("[[")) {
            nodesToProcess.push(node);
        }
    }

    nodesToProcess.forEach(node => {
        const parent = node.parentNode;
        if (!parent || parent.closest?.(".var-value") || ["CODE", "PRE"].includes(parent.tagName)) return;

        const parts = node.nodeValue.split(/(\[\[.*?\]\])/g);
        if (parts.length <= 1) return;

        const fragment = document.createDocumentFragment();

        parts.forEach(part => {
            const match = part.match(/^\[\[(.*?)\]\]$/);
            if (match) {
                const key = match[1].trim();
                const value = vars[key];

                if (value !== undefined && value !== null) {
                    const span = document.createElement("span");
                    span.className = "var-value";
                    span.setAttribute("data-value", value);
                    span.textContent = String(value);
                    fragment.appendChild(span);
                    console.log(`%c[Vars] Replaced [[${key}]] → ${value}`, "color:#a6e3a1");
                } else {
                    fragment.appendChild(document.createTextNode(part));
                }
            } else {
                fragment.appendChild(document.createTextNode(part));
            }
        });

        parent.replaceChild(fragment, node);
    });
}

// ==================== FLOATING PANEL ====================
function createFloatingPanel() {
    if (document.getElementById("vars-panel")) return;

    const panel = document.createElement("div");
    panel.id = "vars-panel";
    panel.style = `
        position: fixed; bottom: 70px; right: 20px; width: 460px; max-height: 80vh;
        background: var(--md-default-bg-color); color: var(--md-default-fg-color);
        border-radius: 12px; box-shadow: var(--md-shadow-z3); overflow-y: auto;
        z-index: 9999; padding: 16px; font-size: 13px; display: none;
        border: 1px solid var(--md-default-fg-color--lightest);
    `;

    panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <strong>Your Lab Environment</strong>
            <button id="close-panel" style="background:none; border:none; font-size:18px; cursor:pointer;">✖</button>
        </div>
        <div id="vars-content"></div>
        <button id="logout-btn" style="margin-top:16px; width:100%; padding:10px; background:#ff5252; 
                color:white; border:none; border-radius:8px; cursor:pointer;">
            Logout / Switch User
        </button>
    `;

    document.body.appendChild(panel);

    document.getElementById("close-panel").onclick = () => panel.style.display = "none";
    document.getElementById("logout-btn").onclick = () => {
        if (confirm("Logout and clear data?")) {
            localStorage.clear();
            location.reload();
        }
    };

    renderUserPanel();
}

function renderUserPanel() {
    const container = document.getElementById("vars-content");
    if (!currentUserData) return;

    let html = `<table style="width:100%; border-collapse:collapse;">`;
    Object.entries(currentUserData).forEach(([key, value]) => {
        const display = value || '<span style="opacity:0.4">—</span>';
        html += `
            <tr style="border-bottom:1px solid var(--md-default-fg-color--lightest);">
                <td style="padding:10px 8px; font-weight:600; width:45%;">${formatTitle(key)}</td>
                <td style="padding:10px 8px; cursor:pointer; font-family:monospace;" 
                    onclick="copyLabValue(this, '${(value || "").toString().replace(/'/g, "\\'")}')">${display}</td>
            </tr>`;
    });
    html += `</table>`;
    container.innerHTML = html;
}

window.copyLabValue = async function (el, value) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    const orig = el.style.background;
    el.style.background = "#4caf50";
    el.style.color = "#fff";
    setTimeout(() => { el.style.background = orig || ""; el.style.color = ""; }, 700);
};

function formatTitle(text) {
    return text.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
        .var-value {
            background: var(--md-code-bg-color);
            color: var(--md-code-fg-color);
            font-family: monospace;
            font-size: 0.85em;
            padding: 2px 6px;
            border-radius: 4px;
            cursor: pointer;
        }
        .var-value.copied { background: #4caf50 !important; color: #fff !important; }
    `;
    document.head.appendChild(style);
}

function createToggleButton() {
    const btn = document.createElement("button");
    btn.innerText = "⚙ My Lab";
    btn.style = `
        position: fixed; bottom: 20px; right: 20px; padding: 10px 16px;
        border-radius: 20px; border: none; background: var(--md-primary-fg-color);
        color: var(--md-primary-bg-color); cursor: pointer; z-index: 9999; font-weight: 500;
    `;
    btn.onclick = () => {
        const panel = document.getElementById("vars-panel");
        if (panel) panel.style.display = panel.style.display === "none" ? "block" : "none";
    };
    document.body.appendChild(btn);
}

// ==================== START ====================
document.addEventListener("DOMContentLoaded", () => {
    console.log("%c[Vars] DOMContentLoaded fired", "color:#4caf50");
    initVariables();
});

if (typeof document$ !== "undefined") {
    document$.subscribe(() => {
        if (currentUserData) replaceVariables(currentUserData);
    });
}