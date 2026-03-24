async function loadVariables() {
    try {
        const res = await fetch("http://localhost:9000/api/variables");
        return await res.json();
    } catch (err) {
        console.error("Failed to load variables:", err);
        return {};
    }
}

// Resolve nested keys like "env.API_URL"
function resolvePath(obj, path) {
    return path.split('.').reduce((acc, key) => acc && acc[key], obj);
}

// Replace {{var}} in text nodes
function replaceVariables(vars) {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    let node;
    while (node = walker.nextNode()) {
        node.nodeValue = node.nodeValue.replace(/\{\{(.*?)\}\}/g, (match, key) => {
            const value = resolvePath(vars, key.trim());
            return value !== undefined ? value : match; // strict mode
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const vars = await loadVariables();
    console.log("Loaded variables:", vars);

    replaceVariables(vars);

    createFloatingPanel(vars);
    createToggleButton();
});

// Replace - Floating panel section - human readable

function createFloatingPanel(vars) {
    const panel = document.createElement("div");
    panel.id = "vars-panel";

    panel.style = `
     position: fixed;
     bottom: 70px;
     right: 20px;
     width: 420px;
     max-height: 80vh;
     background: var(--md-default-bg-color);
     color: var(--md-default-fg-color);
     border-radius: 12px;
     box-shadow: var(--md-shadow-z3);
     overflow-y: auto;
     z-index: 9999;
     padding: 16px;
     font-size: 13px;
     display: none;
     border: 1px solid var(--md-default-fg-color--lightest);
   `;

    panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <strong>Variables</strong>
      <button id="close-panel" style="background:none; border:none; color:white; cursor:pointer;">✖</button>
    </div>
    <div id="vars-content"></div>
  `;

    document.body.appendChild(panel);

    document.getElementById("close-panel").onclick = () => {
        panel.style.display = "none";
    };

    renderVariables(vars);
}

// Helper

function renderVariables(vars) {
    const container = document.getElementById("vars-content");
    container.innerHTML = "";

    Object.keys(vars).forEach(section => {
        const sectionDiv = document.createElement("div");

        sectionDiv.style = `
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--md-default-fg-color--lightest);
    `;

        // Section title
        const title = document.createElement("div");
        title.innerText = formatTitle(section);

        title.style = `
      font-weight: 600;
      margin-bottom: 10px;
      font-size: 14px;
    `;

        sectionDiv.appendChild(title);

        // Rows
        Object.entries(vars[section]).forEach(([key, value]) => {
            const row = document.createElement("div");

            row.style = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 6px 0;
      `;

            // Label
            const label = document.createElement("div");
            label.innerText = formatLabel(key);

            label.style = `
        opacity: 0.7;
      `;

            // Value (copyable)
            const valueEl = document.createElement("div");
            valueEl.innerText = value;

            valueEl.style = `
        background: var(--md-code-bg-color);
        padding: 4px 8px;
        border-radius: 6px;
        font-family: monospace;
        cursor: pointer;
      `;

            valueEl.onclick = async () => {
                await navigator.clipboard.writeText(value);
                showCopyFeedback(valueEl);
            };

            row.appendChild(label);
            row.appendChild(valueEl);

            sectionDiv.appendChild(row);
        });

        container.appendChild(sectionDiv);
    });
}

// Copy to copied - user feedback section 

function showCopyFeedback(el) {
    const originalBg = el.style.background;
    const originalText = el.innerText;

    el.style.background = "#4caf50";
    el.style.color = "#fff";
    el.innerText = "Copied";

    setTimeout(() => {
        el.style.background = originalBg;
        el.style.color = "";
        el.innerText = originalText;
    }, 700);
}

// Toggle button
function createToggleButton() {
    const btn = document.createElement("button");

    btn.innerText = "⚙ Variables";

    btn.style = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 14px;
      border-radius: 20px;
      border: none;
      background: var(--md-primary-fg-color);
      color: var(--md-primary-bg-color);
      cursor: pointer;
      z-index: 9999;
      font-weight: 500;
    `;

    btn.onclick = () => {
        const panel = document.getElementById("vars-panel");
        panel.style.display = panel.style.display === "none" ? "block" : "none";
    };

    document.body.appendChild(btn);
}

// formatTitle helper

function formatTitle(text) {
    return text
        .replace(/_/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

function formatLabel(text) {
    return text
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
}