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

// Inject styles for inline .var-value spans
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
            border: 1px solid transparent;
            transition: background 0.15s, border-color 0.15s;
            position: relative;
        }

        .var-value:hover {
            border-color: var(--md-primary-fg-color);
        }

        .var-value::after {
            content: "Click to copy";
            position: absolute;
            bottom: calc(100% + 6px);
            left: 50%;
            transform: translateX(-50%);
            background: var(--md-default-fg-color);
            color: var(--md-default-bg-color);
            font-family: var(--md-text-font-family, sans-serif);
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 4px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s;
        }

        .var-value:hover::after {
            opacity: 1;
        }

        .var-value.copied {
            background: #4caf50 !important;
            color: #fff !important;
            border-color: transparent !important;
        }

        .var-value.copied::after {
            content: "Copied!";
            opacity: 1;
            background: #4caf50;
            color: #fff;
        }
    `;
    document.head.appendChild(style);
}

// Replace [[section.KEY]] in text nodes with clickable spans.
// Uses DocumentFragment to split each text node into plain text + span pieces,
// which correctly handles multiple placeholders in the same text node.
function replaceVariables(vars) {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    // Collect nodes first — modifying the DOM while walking breaks the walker
    const nodesToProcess = [];
    let node;
    while (node = walker.nextNode()) {
        if (node.nodeValue.includes("[[")) nodesToProcess.push(node);
    }

    nodesToProcess.forEach(node => {
        const parent = node.parentNode;
        if (!parent) return;

        // Split on [[...]] boundaries, keeping the delimiters as separate parts
        const parts = node.nodeValue.split(/(\[\[.*?\]\])/g);

        if (parts.length <= 1) return;

        const fragment = document.createDocumentFragment();

        parts.forEach(part => {
            const match = part.match(/^\[\[(.*?)\]\]$/);

            if (match) {
                const key = match[1].trim();
                let value = resolvePath(vars, key);

                // Fallback: search all sections for a flat key match
                if (value === undefined) {
                    Object.values(vars).forEach(section => {
                        if (section && section[key] !== undefined) value = section[key];
                    });
                }

                if (value !== undefined) {
                    const span = document.createElement("span");
                    span.className = "var-value";
                    span.setAttribute("data-value", value);
                    span.textContent = value;
                    fragment.appendChild(span);
                } else {
                    // Unresolved placeholder — leave as-is
                    fragment.appendChild(document.createTextNode(part));
                }
            } else {
                fragment.appendChild(document.createTextNode(part));
            }
        });

        parent.replaceChild(fragment, node);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const vars = await loadVariables();
    console.log("Loaded variables:", vars);

    injectStyles();
    replaceVariables(vars);

    createFloatingPanel(vars);
    createToggleButton();
});

// Click-to-copy for inline .var-value spans in page body
document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("var-value")) {
        const value = e.target.getAttribute("data-value");
        await navigator.clipboard.writeText(value);
        showInlineCopyFeedback(e.target);
    }
});

function showInlineCopyFeedback(el) {
    const original = el.textContent;
    el.classList.add("copied");
    el.textContent = "Copied!";
    setTimeout(() => {
        el.classList.remove("copied");
        el.textContent = original;
    }, 700);
}

// Floating panel

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

            const label = document.createElement("div");
            label.innerText = formatLabel(key);
            label.style = `opacity: 0.7;`;

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

// Copy feedback for floating panel values
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
