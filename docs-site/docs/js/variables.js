// variables.js - Email-based Login + Single User Row Only

let currentUserData = null;
let currentUserEmail = null;

// ==================== LOGIN MODAL ====================
function showLoginModal() {
    if (document.getElementById("login-modal")) return;

    const modal = document.createElement("div");
    modal.id = "login-modal";
    modal.style = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000; font-family: system-ui;
    `;

    modal.innerHTML = `
        <div style="background: var(--md-default-bg-color); color: var(--md-default-fg-color);
                    padding: 32px; border-radius: 12px; width: 400px; max-width: 92%;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.4);">
            <h2 style="margin: 0 0 8px 0;">Lab Environment Access</h2>
            <p style="margin: 0 0 20px 0; opacity: 0.8;">Enter your email to load your personal lab data:</p>
            
            <input id="login-email" type="email" placeholder="user1@mail.com" 
                   style="width:100%; padding:12px; margin-bottom:16px; border-radius:8px; 
                          border:1px solid var(--md-default-fg-color--lightest); font-size:15px;">
            
            <button id="login-btn" style="width:100%; padding:14px; background:var(--md-primary-fg-color);
                    color:var(--md-primary-bg-color); border:none; border-radius:8px; font-size:16px; cursor:pointer;">
                Load My Lab Data
            </button>
            
            <p id="login-error" style="color:#ff6b6b; margin-top:12px; text-align:center; display:none;"></p>
        </div>
    `;

    document.body.appendChild(modal);

    const emailInput = document.getElementById("login-email");
    const loginBtn = document.getElementById("login-btn");
    const errorEl = document.getElementById("login-error");

    emailInput.focus();

    loginBtn.onclick = async () => {
        const email = emailInput.value.trim();
        if (!email) {
            errorEl.textContent = "Please enter your email";
            errorEl.style.display = "block";
            return;
        }

        loginBtn.textContent = "Loading...";
        loginBtn.disabled = true;
        errorEl.style.display = "none";

        try {
            // Validate email exists
            const checkRes = await fetch(`http://localhost:9000/api/validate-email?email=${encodeURIComponent(email)}`);
            const checkData = await checkRes.json();

            if (!checkData.valid) {
                errorEl.textContent = "Email not found in lab database.";
                errorEl.style.display = "block";
                loginBtn.textContent = "Load My Lab Data";
                loginBtn.disabled = false;
                return;
            }

            // Fetch only this user's row
            const varRes = await fetch(`http://localhost:9000/api/variables?email=${encodeURIComponent(email)}`);
            const varData = await varRes.json();

            if (varData.variables) {
                currentUserEmail = email;
                currentUserData = varData.variables;

                // Store in localStorage
                localStorage.setItem("labUserEmail", email);
                localStorage.setItem("labUserVariables", JSON.stringify(currentUserData));

                modal.remove();
                initAfterSuccessfulLogin();
            }
        } catch (err) {
            console.error(err);
            errorEl.textContent = "Connection error. Is the backend running?";
            errorEl.style.display = "block";
        } finally {
            loginBtn.textContent = "Load My Lab Data";
            loginBtn.disabled = false;
        }
    };
}

// ==================== INIT & RESTORE ====================
async function loadStoredUser() {
    const savedEmail = localStorage.getItem("labUserEmail");
    const savedVars = localStorage.getItem("labUserVariables");

    if (savedEmail && savedVars) {
        try {
            currentUserEmail = savedEmail;
            currentUserData = JSON.parse(savedVars);
            return true;
        } catch (e) {
            console.warn("Corrupted user data, clearing...");
            localStorage.removeItem("labUserEmail");
            localStorage.removeItem("labUserVariables");
        }
    }
    return false;
}

function initAfterSuccessfulLogin() {
    injectStyles();
    replaceVariables(currentUserData || {});
    createFloatingPanel();
    createToggleButton();
}

async function initVariables() {
    const hasStoredUser = await loadStoredUser();

    if (hasStoredUser) {
        initAfterSuccessfulLogin();
    } else {
        showLoginModal();
    }
}

// ==================== FLOATING PANEL (Single User Only) ====================
function createFloatingPanel() {
    const panel = document.createElement("div");
    panel.id = "vars-panel";
    panel.style = `
        position: fixed; bottom: 70px; right: 20px; width: 440px; max-height: 80vh;
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
                color:white; border:none; border-radius:8px; cursor:pointer; font-weight:500;">
            Logout / Switch User
        </button>
    `;

    document.body.appendChild(panel);

    document.getElementById("close-panel").onclick = () => panel.style.display = "none";
    document.getElementById("logout-btn").onclick = () => {
        if (confirm("Logout and clear your lab data?")) {
            localStorage.removeItem("labUserEmail");
            localStorage.removeItem("labUserVariables");
            location.reload();
        }
    };

    renderUserPanel();
}

function renderUserPanel() {
    const container = document.getElementById("vars-content");
    if (!currentUserData) return;

    let html = `<table style="width:100%; border-collapse:collapse; font-size:13px;">`;
    Object.entries(currentUserData).forEach(([key, value]) => {
        const display = value ? value : '<span style="opacity:0.4">—</span>';
        html += `
            <tr style="border-bottom:1px solid var(--md-default-fg-color--lightest);">
                <td style="padding:10px 8px; font-weight:600; width:42%;">${formatTitle(key)}</td>
                <td style="padding:10px 8px; cursor:pointer; font-family:monospace;" 
                    onclick="copyLabValue(this, '${value ? value.toString().replace(/'/g, "\\'") : ""}')">
                    ${display}
                </td>
            </tr>`;
    });
    html += `</table>`;
    container.innerHTML = html;
}

window.copyLabValue = async function (el, value) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    const original = el.style.background;
    el.style.background = "#4caf50";
    el.style.color = "#fff";
    setTimeout(() => {
        el.style.background = original || "";
        el.style.color = "";
    }, 700);
};

function formatTitle(text) {
    return text.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ==================== Existing Helper Functions (kept from your original) ====================
function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
        .var-value {
            background: var(--md-code-bg-color);
            color: var(--md-code-fg-color);
            font-family: var(--md-code-font-family, monospace);
            font-size: 0.85em;
            padding: 2px 6px;
            border-radius: 4px;
            cursor: pointer;
        }
        .var-value.copied {
            background: #4caf50 !important;
            color: #fff !important;
        }
    `;
    document.head.appendChild(style);
}

function replaceVariables(vars) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const nodesToProcess = [];
    let node;
    while (node = walker.nextNode()) {
        if (node.nodeValue.includes("[[")) nodesToProcess.push(node);
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
                let value = vars[key];
                if (value !== undefined) {
                    const span = document.createElement("span");
                    span.className = "var-value";
                    span.setAttribute("data-value", value);
                    span.textContent = value;
                    fragment.appendChild(span);
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

function showInlineCopyFeedback(el) {
    const original = el.textContent;
    el.classList.add("copied");
    el.textContent = "Copied!";
    setTimeout(() => {
        el.classList.remove("copied");
        el.textContent = original;
    }, 700);
}

document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("var-value")) {
        const value = e.target.getAttribute("data-value");
        await navigator.clipboard.writeText(value);
        showInlineCopyFeedback(e.target);
    }
});

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
    initVariables();
});

if (typeof document$ !== "undefined") {
    document$.subscribe(() => {
        if (currentUserData) {
            replaceVariables(currentUserData);
        }
    });
}