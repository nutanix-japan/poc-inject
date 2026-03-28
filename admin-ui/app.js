console.log("🚀 APP.JS LOADED");

const API_BASE = "http://localhost:9000";

let currentColumns = [];

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
        const fieldName = params.column.getColId(); // always the exact field key
        this.eGui = document.createElement("div");
        this.eGui.className = "col-header-wrap";
        this.eGui.innerHTML = `
            <span class="col-header-label">${params.displayName}</span>
            <button class="col-delete-btn" title="Delete column &quot;${fieldName}&quot;">
                <span class="material-icons-round">delete_outline</span>
            </button>
        `;
        this.eGui.querySelector(".col-delete-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            deleteColumn(fieldName); // use field, not displayName
        });
    }
    getGui() { return this.eGui; }
}

// ── Grid setup ──
const gridOptions = {
    columnDefs: [],
    rowData: [],
    defaultColDef: {
        editable: true,
        resizable: true,
        sortable: true,
        filter: "agTextColumnFilter",
        floatingFilter: true,
    },
    components: {
        deleteRowRenderer: DeleteRowRenderer,
        deleteColHeaderRenderer: DeleteColHeaderRenderer,
    },
    onCellValueChanged: saveRow,
    animateRows: true,
    getRowId: params => params.data.email, // email as stable row key
};

const gridDiv = document.getElementById("grid");
const gridApi = agGrid.createGrid(gridDiv, gridOptions);

// ── Build column defs ──
function buildColumnDefs(columns) {
    return [
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

// ── Load lab ──
async function loadLab() {
    try {
        const res = await fetch(`${API_BASE}/api/lab`);
        const lab = await res.json();

        currentColumns = lab.columns;

        gridApi.setGridOption("columnDefs", buildColumnDefs(currentColumns));
        gridApi.setGridOption("rowData", lab.slots ?? []);

        updateStats(lab.slots ?? [], currentColumns);

    } catch (err) {
        console.error("❌ Failed to load lab:", err);
        showToast("Failed to load lab", true);
    }
}

// ── Add Row ──
async function addRow() {
    const newRow = {};
    currentColumns.forEach(col => newRow[col] = "");

    try {
        // Insert with empty email as placeholder — user fills it in
        await fetch(`${API_BASE}/api/lab/slots/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newRow)
        });

        gridApi.applyTransaction({ add: [newRow] });
        refreshStats();
        showToast("Row added — fill in email to save");

    } catch (err) {
        console.error("❌ Failed to add row:", err);
        showToast("Failed to add row", true);
    }
}

// ── Delete Row ──
async function deleteRow(rowData) {
    const email = rowData.email;
    if (!email) {
        // Row was never saved (no email) — just remove from grid
        gridApi.applyTransaction({ remove: [rowData] });
        refreshStats();
        return;
    }
    if (!confirm(`Delete slot for "${email}"?`)) return;

    try {
        await fetch(`${API_BASE}/api/lab/slots/${encodeURIComponent(email)}`, {
            method: "DELETE"
        });
        gridApi.applyTransaction({ remove: [rowData] });
        refreshStats();
        showToast(`Deleted ${email}`);

    } catch (err) {
        console.error("❌ Failed to delete row:", err);
        showToast("Failed to delete row", true);
    }
}

// ── Save row on cell edit ──
async function saveRow(event) {
    const row = event.data;
    const email = row.email;

    if (!email || email.trim() === "") {
        // Don't persist until email is set
        showToast("Set an email to save this row", true);
        return;
    }

    try {
        await fetch(`${API_BASE}/api/lab/slots/${encodeURIComponent(email)}`, {
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

// ── Add Column ──
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
        const res = await fetch(`${API_BASE}/api/lab/columns`, {
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
    if (e.key === "Enter") confirmAddColumn();
    if (e.key === "Escape") closeAddColumnModal();
});

// ── Delete Column ──
async function deleteColumn(colName) {
    if (!confirm(`Delete column "${colName}"? This removes it from all rows.`)) return;

    try {
        const res = await fetch(`${API_BASE}/api/lab/columns/${colName}`, {
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

// ── Stats ──
function updateStats(slots, columns) {
    document.getElementById("stat-rows").textContent = slots.length;
    document.getElementById("stat-cols").textContent = columns.length;
    const assigned = slots.filter(s => s.email && s.email.trim() !== "").length;
    document.getElementById("stat-assigned").textContent = assigned;
}

function refreshStats() {
    const rows = [];
    gridApi.forEachNode(node => rows.push(node.data));
    updateStats(rows, currentColumns);
}

loadLab();