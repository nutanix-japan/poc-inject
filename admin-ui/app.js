console.log("🚀 APP.JS LOADED");

const API_BASE = "http://localhost:9000";

let currentLab = "";
let currentColumns = [];
let nextId = 1;

// ── Delete Row Cell Renderer ──
class DeleteRowRenderer {
    init(params) {
        this.eGui = document.createElement("button");
        this.eGui.className = "delete-btn";
        this.eGui.title = "Delete row";
        this.eGui.innerHTML = '<span class="material-icons-round">delete_outline</span>';
        this.eGui.addEventListener("click", () => deleteRow(params.data));
    }
    getGui() { return this.eGui; }
}

// ── Delete Column Header Renderer ──
class DeleteColHeaderRenderer {
    init(params) {
        this.eGui = document.createElement("div");
        this.eGui.className = "col-header-wrap";
        this.eGui.innerHTML = `
            <span class="col-header-label">${params.displayName}</span>
            <button class="col-delete-btn" title="Delete column &quot;${params.displayName}&quot;">
                <span class="material-icons-round">delete_outline</span>
            </button>
        `;
        this.eGui.querySelector(".col-delete-btn").addEventListener("click", (e) => {
            e.stopPropagation(); // don't trigger sort
            deleteColumn(params.displayName);
        });
    }
    getGui() { return this.eGui; }
}

// ── Grid setup ──
const gridOptions = {
    columnDefs: [],
    rowData: [],
    defaultColDef: { editable: true, resizable: true, sortable: true, filter: true, floatingFilter: true },
    components: {
        deleteRowRenderer: DeleteRowRenderer,
        deleteColHeaderRenderer: DeleteColHeaderRenderer,
    },
    onCellValueChanged: saveRow,
    animateRows: true,
    floatingFilter: true,
};

const gridDiv = document.getElementById("grid");
const gridApi = agGrid.createGrid(gridDiv, gridOptions);

// ── Stats + badge + breadcrumb ──
function updateStats(slots, columns) {
    document.getElementById("stat-rows").textContent     = slots.length;
    document.getElementById("stat-cols").textContent     = columns.length;
    const assigned = slots.filter(s => s.email && s.email.trim() !== "").length;
    document.getElementById("stat-assigned").textContent = assigned;
}

function updateLabMeta(labName) {
    document.getElementById("badge-label").textContent    = labName;
    document.getElementById("breadcrumb-lab").textContent = labName;
}

// ── Load labs ──
async function loadLabs() {
    try {
        const res  = await fetch(`${API_BASE}/api/labs`);
        const data = await res.json();

        const selector = document.getElementById("labSelector");
        selector.innerHTML = "";

        Object.keys(data.labs).forEach(lab => {
            const opt = document.createElement("option");
            opt.value = lab;
            opt.textContent = lab;
            selector.appendChild(opt);
        });

        selector.addEventListener("change", () => loadLab(selector.value));

        const firstLab = Object.keys(data.labs)[0];
        selector.value = firstLab;
        loadLab(firstLab);

    } catch (err) {
        console.error("❌ Failed to load labs:", err);
        showToast("Failed to load labs", true);
    }
}

// ── Build column defs ──
function buildColumnDefs(columns) {
    return [
        { field: "id", hide: true },
        ...columns.map(col => ({
            field: col,
            editable: true,
            filter: "agTextColumnFilter",
            floatingFilter: true,
            headerComponent: "deleteColHeaderRenderer",
        })),
        {
            field: "delete_action",
            headerName: "",
            width: 56,
            editable: false,
            sortable: false,
            filter: false,
            floatingFilter: false,
            resizable: false,
            cellRenderer: "deleteRowRenderer",
            pinned: "right",
        }
    ];
}

// ── Load a specific lab ──
async function loadLab(labName) {
    try {
        currentLab = labName;
        updateLabMeta(labName);

        const res = await fetch(`${API_BASE}/api/labs/${labName}`);
        const lab = await res.json();

        currentColumns = lab.columns;
        const slots = lab.slots ?? [];

        gridApi.setGridOption("columnDefs", buildColumnDefs(currentColumns));
        gridApi.setGridOption("rowData", slots);

        nextId = slots.length > 0 ? Math.max(...slots.map(s => s.id)) + 1 : 1;
        updateStats(slots, currentColumns);

    } catch (err) {
        console.error(`❌ Failed to load lab ${labName}:`, err);
        showToast(`Failed to load ${labName}`, true);
    }
}

// ── Add Row ──
async function addRow() {
    const newRow = { id: nextId++ };
    currentColumns.forEach(col => newRow[col] = "");

    try {
        await fetch(`${API_BASE}/api/labs/${currentLab}/slots/${newRow.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newRow)
        });

        gridApi.applyTransaction({ add: [newRow] });
        refreshStats();
        showToast("Row added");

    } catch (err) {
        console.error("❌ Failed to add row:", err);
        showToast("Failed to add row", true);
    }
}

// ── Delete Row ──
async function deleteRow(rowData) {
    if (!confirm(`Delete row (id: ${rowData.id})?`)) return;

    try {
        await fetch(`${API_BASE}/api/labs/${currentLab}/slots/${rowData.id}`, {
            method: "DELETE"
        });

        gridApi.applyTransaction({ remove: [rowData] });
        refreshStats();
        showToast("Row deleted");

    } catch (err) {
        console.error("❌ Failed to delete row:", err);
        showToast("Failed to delete row", true);
    }
}

// ── Save row on edit ──
async function saveRow(event) {
    try {
        const row = event.data;
        await fetch(`${API_BASE}/api/labs/${currentLab}/slots/${row.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(row)
        });
        refreshStats();
        showToast("Saved");
    } catch (err) {
        console.error("❌ Save failed:", err);
        showToast("Save failed", true);
    }
}

// ── Delete Column ──
async function deleteColumn(colName) {
    if (!confirm(`Delete column "${colName}"? This removes it from all rows.`)) return;

    try {
        const res = await fetch(`${API_BASE}/api/labs/${currentLab}/columns/${colName}`, {
            method: "DELETE"
        });

        const result = await res.json();
        if (result.error) { showToast(result.error, true); return; }

        currentColumns = currentColumns.filter(c => c !== colName);
        gridApi.setGridOption("columnDefs", buildColumnDefs(currentColumns));
        refreshStats();
        showToast(`Column "${colName}" deleted`);

    } catch (err) {
        console.error("❌ Failed to delete column:", err);
        showToast("Failed to delete column", true);
    }
}

// ── Refresh stats from live grid ──
function refreshStats() {
    const rows = [];
    gridApi.forEachNode(node => rows.push(node.data));
    updateStats(rows, currentColumns);
}

// ── Add Column Modal ──
function openAddColumnModal() {
    document.getElementById("colNameInput").value = "";
    document.getElementById("modal-overlay").classList.add("active");
    setTimeout(() => document.getElementById("colNameInput").focus(), 50);
}

function closeAddColumnModal() {
    document.getElementById("modal-overlay").classList.remove("active");
}

async function confirmAddColumn() {
    const colName = document.getElementById("colNameInput").value.trim();
    if (!colName) { showToast("Enter a column name", true); return; }

    try {
        const res = await fetch(`${API_BASE}/api/labs/${currentLab}/columns`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ column: colName })
        });

        const result = await res.json();
        if (result.error) { showToast(result.error, true); return; }

        currentColumns.push(colName);
        gridApi.setGridOption("columnDefs", buildColumnDefs(currentColumns));
        refreshStats();
        closeAddColumnModal();
        showToast(`Column "${colName}" added`);

    } catch (err) {
        console.error("❌ Failed to add column:", err);
        showToast("Failed to add column", true);
    }
}

document.getElementById("colNameInput").addEventListener("keydown", e => {
    if (e.key === "Enter")  confirmAddColumn();
    if (e.key === "Escape") closeAddColumnModal();
});

loadLabs();
