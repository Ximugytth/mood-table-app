(function () {
  "use strict";

  const STORAGE = {
    templates: "moodTable.templates",
    activeTemplateId: "moodTable.activeTemplateId",
    records: (templateId) => `moodTable.records.${templateId}`,
  };

  const DEFAULT_COLUMNS = [
    "日期",
    "时间",
    "心情分数",
    "情绪标签",
    "事件",
    "睡眠",
    "压力",
    "备注",
  ];

  const state = {
    templates: [],
    activeTemplateId: "",
    records: [],
    selectedDate: todayDate(),
    viewMode: "day",
    search: "",
    sort: { columnId: "", direction: "" },
    templateDialogMode: "create",
    importRows: [],
    importFileName: "",
    deferredInstallPrompt: null,
  };

  const els = {
    installButton: document.getElementById("installButton"),
    saveStatus: document.getElementById("saveStatus"),
    selectedDateTitle: document.getElementById("selectedDateTitle"),
    dayRecordSummary: document.getElementById("dayRecordSummary"),
    dayViewButton: document.getElementById("dayViewButton"),
    allViewButton: document.getElementById("allViewButton"),
    dateNavigator: document.getElementById("dateNavigator"),
    previousDayButton: document.getElementById("previousDayButton"),
    selectedDateInput: document.getElementById("selectedDateInput"),
    nextDayButton: document.getElementById("nextDayButton"),
    todayButton: document.getElementById("todayButton"),
    templateSelect: document.getElementById("templateSelect"),
    newTemplateButton: document.getElementById("newTemplateButton"),
    renameTemplateButton: document.getElementById("renameTemplateButton"),
    deleteTemplateButton: document.getElementById("deleteTemplateButton"),
    addRowButton: document.getElementById("addRowButton"),
    addColumnButton: document.getElementById("addColumnButton"),
    exportButton: document.getElementById("exportButton"),
    csvFileInput: document.getElementById("csvFileInput"),
    searchInput: document.getElementById("searchInput"),
    clearSearchButton: document.getElementById("clearSearchButton"),
    tableHead: document.getElementById("tableHead"),
    tableBody: document.getElementById("tableBody"),
    sheetTitle: document.getElementById("sheetTitle"),
    emptyState: document.getElementById("emptyState"),
    emptyStateTitle: document.getElementById("emptyStateTitle"),
    emptyStateCopy: document.getElementById("emptyStateCopy"),
    emptyAddButton: document.getElementById("emptyAddButton"),
    recordCount: document.getElementById("recordCount"),
    moodAverage: document.getElementById("moodAverage"),
    moodMax: document.getElementById("moodMax"),
    moodMin: document.getElementById("moodMin"),
    templateDialog: document.getElementById("templateDialog"),
    templateForm: document.getElementById("templateForm"),
    templateDialogTitle: document.getElementById("templateDialogTitle"),
    templateNameInput: document.getElementById("templateNameInput"),
    templateColumnsInput: document.getElementById("templateColumnsInput"),
    cancelTemplateButton: document.getElementById("cancelTemplateButton"),
    importDialog: document.getElementById("importDialog"),
    importForm: document.getElementById("importForm"),
    importSummary: document.getElementById("importSummary"),
    cancelImportButton: document.getElementById("cancelImportButton"),
    toast: document.getElementById("toast"),
  };

  function uid(prefix) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function todayDate() {
    const date = new Date();
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function currentTime() {
    const date = new Date();
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function formatLocalDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function normalizeDateValue(value) {
    const match = String(value || "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) {
      return "";
    }
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const normalized = formatLocalDate(date);
    return normalized === `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`
      ? normalized
      : "";
  }

  function dateFromValue(value) {
    const normalized = normalizeDateValue(value);
    if (!normalized) {
      return new Date();
    }
    const [year, month, day] = normalized.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function shiftSelectedDate(days) {
    const date = dateFromValue(state.selectedDate);
    date.setDate(date.getDate() + days);
    state.selectedDate = formatLocalDate(date);
    state.viewMode = "day";
    render();
  }

  function formatDateTitle(value) {
    const date = dateFromValue(value);
    const label = new Intl.DateTimeFormat("zh-CN", {
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(date);
    if (value === todayDate()) {
      return `今天 · ${label}`;
    }
    return label;
  }

  function safeJsonParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn("Storage parse failed", error);
      return fallback;
    }
  }

  function makeTemplate(name, columnNames) {
    const createdAt = nowIso();
    return {
      id: uid("tpl"),
      name: name.trim() || "未命名模板",
      columns: uniqueNames(columnNames).map((columnName) => ({
        id: uid("col"),
        name: columnName,
      })),
      createdAt,
      updatedAt: createdAt,
    };
  }

  function defaultTemplate() {
    return makeTemplate("每日心情记录", DEFAULT_COLUMNS);
  }

  function uniqueNames(names) {
    const used = new Map();
    return names
      .map((name) => String(name || "").trim())
      .filter(Boolean)
      .map((name) => {
        const count = used.get(name) || 0;
        used.set(name, count + 1);
        return count === 0 ? name : `${name} ${count + 1}`;
      });
  }

  function getActiveTemplate() {
    return state.templates.find((template) => template.id === state.activeTemplateId) || state.templates[0];
  }

  function loadApp() {
    state.templates = safeJsonParse(localStorage.getItem(STORAGE.templates), []);
    if (!Array.isArray(state.templates) || state.templates.length === 0) {
      const template = defaultTemplate();
      state.templates = [template];
      state.activeTemplateId = template.id;
      saveTemplates();
      localStorage.setItem(STORAGE.activeTemplateId, template.id);
      localStorage.setItem(STORAGE.records(template.id), JSON.stringify([]));
    } else {
      state.activeTemplateId =
        localStorage.getItem(STORAGE.activeTemplateId) || state.templates[0].id;
    }
    if (!getActiveTemplate()) {
      state.activeTemplateId = state.templates[0].id;
    }
    loadRecords();
  }

  function saveTemplates() {
    localStorage.setItem(STORAGE.templates, JSON.stringify(state.templates));
  }

  function saveRecords() {
    localStorage.setItem(STORAGE.records(state.activeTemplateId), JSON.stringify(state.records));
    markSaved();
  }

  function loadRecords() {
    const records = safeJsonParse(localStorage.getItem(STORAGE.records(state.activeTemplateId)), []);
    state.records = Array.isArray(records) ? records : [];
    if (migrateRecordDates()) {
      localStorage.setItem(STORAGE.records(state.activeTemplateId), JSON.stringify(state.records));
    }
  }

  function getDateColumn(template = getActiveTemplate()) {
    return template?.columns.find((column) => column.name.trim() === "日期") ||
      template?.columns.find((column) => column.name.includes("日期"));
  }

  function inferRecordDate(record, template = getActiveTemplate()) {
    const storedDate = normalizeDateValue(record.pageDate);
    if (storedDate) {
      return storedDate;
    }
    const dateColumn = getDateColumn(template);
    const cellDate = normalizeDateValue(dateColumn ? record.values?.[dateColumn.id] : "");
    if (cellDate) {
      return cellDate;
    }
    const createdDate = record.createdAt ? new Date(record.createdAt) : null;
    return createdDate && !Number.isNaN(createdDate.getTime())
      ? formatLocalDate(createdDate)
      : todayDate();
  }

  function migrateRecordDates() {
    let changed = false;
    state.records.forEach((record) => {
      const pageDate = inferRecordDate(record);
      if (record.pageDate !== pageDate) {
        record.pageDate = pageDate;
        changed = true;
      }
    });
    return changed;
  }

  function markSaved() {
    els.saveStatus.textContent = `已在本机保存 ${new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  function render() {
    renderTemplateSelect();
    renderDateWorkspace();
    renderTable();
    renderStats();
  }

  function getScopedRecords() {
    if (state.viewMode === "all") {
      return [...state.records];
    }
    return state.records.filter((record) => inferRecordDate(record) === state.selectedDate);
  }

  function renderDateWorkspace() {
    const scopedCount = getScopedRecords().length;
    const isDay = state.viewMode === "day";
    els.selectedDateTitle.textContent = isDay ? formatDateTitle(state.selectedDate) : "全部记录";
    els.dayRecordSummary.textContent = `${scopedCount} 条记录`;
    els.selectedDateInput.value = state.selectedDate;
    els.dateNavigator.classList.toggle("hidden", !isDay);
    els.dayViewButton.classList.toggle("active", isDay);
    els.allViewButton.classList.toggle("active", !isDay);
    els.dayViewButton.setAttribute("aria-pressed", String(isDay));
    els.allViewButton.setAttribute("aria-pressed", String(!isDay));
    els.exportButton.textContent = isDay ? "导出当天 CSV" : "导出全部 CSV";
    els.sheetTitle.textContent = isDay ? "当天记录" : "全部记录";
  }

  function renderTemplateSelect() {
    els.templateSelect.innerHTML = "";
    state.templates.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name;
      option.selected = template.id === state.activeTemplateId;
      els.templateSelect.append(option);
    });
  }

  function getVisibleRecords() {
    const template = getActiveTemplate();
    if (!template) {
      return [];
    }
    const query = state.search.trim().toLowerCase();
    let records = getScopedRecords();
    if (query) {
      records = records.filter((record) =>
        template.columns.some((column) =>
          String(record.values?.[column.id] || "").toLowerCase().includes(query)
        )
      );
    }
    if (state.sort.columnId && state.sort.direction) {
      records.sort((a, b) => {
        const aValue = String(a.values?.[state.sort.columnId] || "");
        const bValue = String(b.values?.[state.sort.columnId] || "");
        const aNum = parseFloat(aValue);
        const bNum = parseFloat(bValue);
        const bothNumeric = Number.isFinite(aNum) && Number.isFinite(bNum);
        const result = bothNumeric
          ? aNum - bNum
          : aValue.localeCompare(bValue, "zh-CN", { numeric: true });
        return state.sort.direction === "asc" ? result : -result;
      });
    }
    return records;
  }

  function renderTable() {
    const template = getActiveTemplate();
    if (!template) {
      return;
    }
    els.tableHead.innerHTML = "";
    els.tableBody.innerHTML = "";

    const headRow = document.createElement("tr");
    const rowHeader = document.createElement("th");
    rowHeader.textContent = "行";
    headRow.append(rowHeader);

    template.columns.forEach((column) => {
      const th = document.createElement("th");
      const wrapper = document.createElement("div");
      wrapper.className = "column-head";

      const input = document.createElement("input");
      input.value = column.name;
      input.setAttribute("aria-label", `列名：${column.name}`);
      input.addEventListener("change", () => renameColumn(column.id, input.value));
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          input.blur();
        }
      });

      const actions = document.createElement("div");
      actions.className = "column-actions";
      const sortButton = document.createElement("button");
      sortButton.className = "tiny-button tool-button";
      sortButton.type = "button";
      sortButton.textContent = sortLabel(column.id);
      sortButton.title = "按这一列排序";
      sortButton.addEventListener("click", () => toggleSort(column.id));

      const deleteButton = document.createElement("button");
      deleteButton.className = "tiny-button danger-button";
      deleteButton.type = "button";
      deleteButton.textContent = "删列";
      deleteButton.title = "删除这一列";
      deleteButton.addEventListener("click", () => deleteColumn(column.id));

      actions.append(sortButton, deleteButton);
      wrapper.append(input, actions);
      th.append(wrapper);
      headRow.append(th);
    });
    els.tableHead.append(headRow);

    const visibleRecords = getVisibleRecords();
    visibleRecords.forEach((record, visibleIndex) => {
      const tr = document.createElement("tr");
      const rowToolCell = document.createElement("td");
      const originalIndex = state.records.findIndex((item) => item.id === record.id);
      rowToolCell.innerHTML = "";

      const tools = document.createElement("div");
      tools.className = "row-tools";
      const number = document.createElement("span");
      number.className = "row-number";
      number.textContent = String(visibleIndex + 1);
      const deleteRowButton = document.createElement("button");
      deleteRowButton.className = "tiny-button danger-button";
      deleteRowButton.type = "button";
      deleteRowButton.textContent = "删除";
      deleteRowButton.addEventListener("click", () => deleteRow(record.id));
      tools.append(number, deleteRowButton);
      rowToolCell.append(tools);
      tr.append(rowToolCell);

      template.columns.forEach((column) => {
        const td = document.createElement("td");
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.contentEditable = "true";
        cell.dataset.placeholder = placeholderFor(column.name, originalIndex);
        cell.textContent = record.values?.[column.id] || "";
        cell.setAttribute("aria-label", `${column.name} 第 ${visibleIndex + 1} 行`);
        cell.addEventListener("input", () => {
          record.values[column.id] = cell.innerText;
          record.updatedAt = nowIso();
          saveRecords();
          renderStats();
        });
        cell.addEventListener("blur", () => {
          record.values[column.id] = cell.innerText.trimEnd();
          if (column.id === getDateColumn(template)?.id) {
            const nextPageDate = normalizeDateValue(record.values[column.id]);
            if (nextPageDate) {
              record.pageDate = nextPageDate;
            }
          }
          record.updatedAt = nowIso();
          saveRecords();
          render();
        });
        td.append(cell);
        tr.append(td);
      });
      els.tableBody.append(tr);
    });

    const hasVisibleRecords = visibleRecords.length > 0;
    els.emptyState.classList.toggle("hidden", hasVisibleRecords);
    if (!hasVisibleRecords && state.search.trim()) {
      els.emptyStateTitle.textContent = "没有找到匹配的记录";
      els.emptyStateCopy.textContent = "换一个关键词，或者清空筛选再看看。";
      els.emptyAddButton.classList.add("hidden");
    } else if (!hasVisibleRecords && state.viewMode === "all") {
      els.emptyStateTitle.textContent = "还没有任何记录";
      els.emptyStateCopy.textContent = "从今天开始，留下一条属于自己的记录。";
      els.emptyAddButton.classList.remove("hidden");
    } else {
      els.emptyStateTitle.textContent =
        state.selectedDate === todayDate() ? "今天还没有记录" : "这一天还没有记录";
      els.emptyStateCopy.textContent = "添加一条，把此刻的感受放在这里。";
      els.emptyAddButton.classList.remove("hidden");
    }
  }

  function sortLabel(columnId) {
    if (state.sort.columnId !== columnId || !state.sort.direction) {
      return "排序";
    }
    return state.sort.direction === "asc" ? "升序" : "降序";
  }

  function placeholderFor(columnName, rowIndex) {
    if (columnName === "日期") return state.selectedDate;
    if (columnName === "时间") return currentTime();
    if (columnName.includes("心情")) return "1-10";
    return "";
  }

  function renderStats() {
    const template = getActiveTemplate();
    const visibleRecords = getVisibleRecords();
    const scopedRecords = getScopedRecords();
    els.recordCount.textContent = state.search
      ? `${visibleRecords.length}/${scopedRecords.length}`
      : String(scopedRecords.length);

    const moodColumn = template?.columns.find((column) => column.name.includes("心情"));
    const values = moodColumn
      ? visibleRecords
          .map((record) => parseFloat(String(record.values?.[moodColumn.id] || "").replace(",", ".")))
          .filter((value) => Number.isFinite(value))
      : [];

    if (values.length === 0) {
      els.moodAverage.textContent = "-";
      els.moodMax.textContent = "-";
      els.moodMin.textContent = "-";
      return;
    }

    const sum = values.reduce((total, value) => total + value, 0);
    els.moodAverage.textContent = (sum / values.length).toFixed(1);
    els.moodMax.textContent = String(Math.max(...values));
    els.moodMin.textContent = String(Math.min(...values));
  }

  function addRow() {
    const template = getActiveTemplate();
    if (state.viewMode === "all") {
      state.viewMode = "day";
    }
    const dateColumn = getDateColumn(template);
    const values = {};
    template.columns.forEach((column) => {
      if (column.id === dateColumn?.id) values[column.id] = state.selectedDate;
      else if (column.name === "时间") values[column.id] = currentTime();
      else values[column.id] = "";
    });
    state.records.push({
      id: uid("row"),
      values,
      pageDate: state.selectedDate,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    saveRecords();
    render();
    showToast("已添加一条记录");
  }

  function deleteRow(recordId) {
    state.records = state.records.filter((record) => record.id !== recordId);
    saveRecords();
    render();
    showToast("记录已删除");
  }

  function addColumn() {
    const template = getActiveTemplate();
    const name = prompt("请输入新列名", "新列");
    if (!name || !name.trim()) {
      return;
    }
    const column = { id: uid("col"), name: uniqueColumnName(name.trim(), template.columns) };
    template.columns.push(column);
    template.updatedAt = nowIso();
    state.records.forEach((record) => {
      record.values[column.id] = "";
      record.updatedAt = nowIso();
    });
    saveTemplates();
    saveRecords();
    render();
    showToast("已添加列");
  }

  function renameColumn(columnId, nextName) {
    const template = getActiveTemplate();
    const column = template.columns.find((item) => item.id === columnId);
    if (!column) {
      return;
    }
    const cleanName = String(nextName || "").trim();
    if (!cleanName) {
      render();
      showToast("列名不能为空");
      return;
    }
    column.name = uniqueColumnName(cleanName, template.columns.filter((item) => item.id !== columnId));
    template.updatedAt = nowIso();
    saveTemplates();
    render();
    showToast("列名已更新");
  }

  function deleteColumn(columnId) {
    const template = getActiveTemplate();
    if (template.columns.length <= 1) {
      showToast("至少保留一列");
      return;
    }
    const column = template.columns.find((item) => item.id === columnId);
    if (!column || !confirm(`删除列「${column.name}」？这一列的数据也会删除。`)) {
      return;
    }
    template.columns = template.columns.filter((item) => item.id !== columnId);
    template.updatedAt = nowIso();
    state.records.forEach((record) => {
      delete record.values[columnId];
      record.updatedAt = nowIso();
    });
    if (state.sort.columnId === columnId) {
      state.sort = { columnId: "", direction: "" };
    }
    saveTemplates();
    saveRecords();
    render();
    showToast("列已删除");
  }

  function uniqueColumnName(name, columns) {
    const existing = new Set(columns.map((column) => column.name));
    if (!existing.has(name)) {
      return name;
    }
    let index = 2;
    while (existing.has(`${name} ${index}`)) {
      index += 1;
    }
    return `${name} ${index}`;
  }

  function toggleSort(columnId) {
    if (state.sort.columnId !== columnId) {
      state.sort = { columnId, direction: "asc" };
    } else if (state.sort.direction === "asc") {
      state.sort.direction = "desc";
    } else {
      state.sort = { columnId: "", direction: "" };
    }
    renderTable();
  }

  function openTemplateDialog(mode) {
    state.templateDialogMode = mode;
    const template = getActiveTemplate();
    const isCreate = mode === "create";
    els.templateDialogTitle.textContent = isCreate ? "新建模板" : "编辑模板";
    els.templateNameInput.value = isCreate ? "" : template.name;
    els.templateColumnsInput.value = isCreate
      ? DEFAULT_COLUMNS.join("\n")
      : template.columns.map((column) => column.name).join("\n");
    els.templateDialog.showModal();
    els.templateNameInput.focus();
  }

  function saveTemplateFromDialog() {
    const name = els.templateNameInput.value.trim();
    const columnNames = uniqueNames(els.templateColumnsInput.value.split(/\r?\n/));
    if (!name || columnNames.length === 0) {
      showToast("请填写模板名称和列名");
      return false;
    }

    if (state.templateDialogMode === "create") {
      const template = makeTemplate(name, columnNames);
      state.templates.push(template);
      state.activeTemplateId = template.id;
      state.records = [];
      saveTemplates();
      localStorage.setItem(STORAGE.activeTemplateId, template.id);
      saveRecords();
      render();
      showToast("模板已创建");
      return true;
    }

    const template = getActiveTemplate();
    const oldColumns = template.columns;
    const nextColumns = columnNames.map((columnName, index) => ({
      id: oldColumns[index]?.id || uid("col"),
      name: columnName,
    }));
    const nextIds = new Set(nextColumns.map((column) => column.id));
    state.records.forEach((record) => {
      nextColumns.forEach((column) => {
        if (!(column.id in record.values)) {
          record.values[column.id] = "";
        }
      });
      Object.keys(record.values).forEach((key) => {
        if (!nextIds.has(key)) {
          delete record.values[key];
        }
      });
      record.updatedAt = nowIso();
    });
    template.name = name;
    template.columns = nextColumns;
    template.updatedAt = nowIso();
    saveTemplates();
    saveRecords();
    render();
    showToast("模板已更新");
    return true;
  }

  function deleteTemplate() {
    const template = getActiveTemplate();
    if (state.templates.length <= 1) {
      showToast("至少保留一个模板");
      return;
    }
    if (!confirm(`删除模板「${template.name}」？这个模板下的数据也会删除。`)) {
      return;
    }
    state.templates = state.templates.filter((item) => item.id !== template.id);
    localStorage.removeItem(STORAGE.records(template.id));
    state.activeTemplateId = state.templates[0].id;
    localStorage.setItem(STORAGE.activeTemplateId, state.activeTemplateId);
    saveTemplates();
    loadRecords();
    render();
    showToast("模板已删除");
  }

  function exportCsv() {
    const template = getActiveTemplate();
    const exportRecords = getScopedRecords();
    const dateColumn = getDateColumn(template);
    const exportColumns = dateColumn
      ? template.columns
      : [{ id: "__pageDate", name: "记录日期" }, ...template.columns];
    const rows = [
      exportColumns.map((column) => column.name),
      ...exportRecords.map((record) =>
        exportColumns.map((column) => {
          if (column.id === "__pageDate") {
            return inferRecordDate(record, template);
          }
          if (column.id === dateColumn?.id) {
            return record.values?.[column.id] || inferRecordDate(record, template);
          }
          return record.values?.[column.id] || "";
        })
      ),
    ];
    const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    const scopeName = state.viewMode === "day" ? state.selectedDate : `全部_${todayDate()}`;
    anchor.download = `${sanitizeFileName(template.name)}_${scopeName}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(anchor.href);
    showToast(`已导出 ${exportRecords.length} 条记录，请到“下载”中查看`);
  }

  function escapeCsvCell(value) {
    const text = String(value ?? "");
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function sanitizeFileName(value) {
    return String(value || "mood-table")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 60);
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    const input = text.replace(/^\ufeff/, "");

    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      const next = input[index + 1];
      if (inQuotes) {
        if (char === '"' && next === '"') {
          cell += '"';
          index += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          cell += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(cell);
        cell = "";
      } else if (char === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else if (char === "\r") {
        if (next === "\n") {
          continue;
        }
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    if (cell.length > 0 || row.length > 0) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter((csvRow) => csvRow.some((value) => String(value).trim() !== ""));
  }

  function onCsvFileSelected(file) {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ""));
        if (rows.length < 1) {
          showToast("CSV 文件是空的");
          return;
        }
        state.importRows = rows;
        state.importFileName = file.name;
        els.importSummary.textContent = `文件「${file.name}」包含 ${Math.max(rows.length - 1, 0)} 条数据。`;
        els.importDialog.showModal();
      } catch (error) {
        console.error(error);
        showToast("CSV 解析失败");
      }
    };
    reader.readAsText(file, "utf-8");
    els.csvFileInput.value = "";
  }

  function confirmImport() {
    if (state.importRows.length === 0) {
      return false;
    }
    const mode = new FormData(els.importForm).get("importMode");
    const template = getActiveTemplate();
    const headers = uniqueNames(state.importRows[0]);
    const dataRows = state.importRows.slice(1);
    const importedDateIndex = headers.findIndex((header) => header.includes("日期"));
    let columns;

    if (mode === "replace") {
      columns = headers.map((header) => {
        const existing = template.columns.find((column) => column.name === header);
        return existing || { id: uid("col"), name: header };
      });
      template.columns = columns;
    } else {
      columns = headers.map((header) => {
        let existing = template.columns.find((column) => column.name === header);
        if (!existing) {
          existing = { id: uid("col"), name: uniqueColumnName(header, template.columns) };
          template.columns.push(existing);
        }
        return existing;
      });
    }

    const importedRecords = dataRows.map((row) => {
      const values = {};
      template.columns.forEach((column) => {
        values[column.id] = "";
      });
      columns.forEach((column, index) => {
        values[column.id] = row[index] || "";
      });
      return {
        id: uid("row"),
        values,
        pageDate: normalizeDateValue(row[importedDateIndex]) || state.selectedDate,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
    });

    state.records = mode === "replace" ? importedRecords : [...state.records, ...importedRecords];
    template.updatedAt = nowIso();
    saveTemplates();
    saveRecords();
    render();
    showToast(mode === "replace" ? "CSV 已覆盖导入" : "CSV 已追加导入");
    return true;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      els.toast.classList.add("hidden");
    }, 2400);
  }

  function bindEvents() {
    els.dayViewButton.addEventListener("click", () => {
      state.viewMode = "day";
      render();
    });
    els.allViewButton.addEventListener("click", () => {
      state.viewMode = "all";
      render();
    });
    els.previousDayButton.addEventListener("click", () => shiftSelectedDate(-1));
    els.nextDayButton.addEventListener("click", () => shiftSelectedDate(1));
    els.todayButton.addEventListener("click", () => {
      state.selectedDate = todayDate();
      state.viewMode = "day";
      render();
    });
    els.selectedDateInput.addEventListener("change", () => {
      const date = normalizeDateValue(els.selectedDateInput.value);
      if (date) {
        state.selectedDate = date;
        state.viewMode = "day";
        render();
      }
    });

    els.templateSelect.addEventListener("change", () => {
      state.activeTemplateId = els.templateSelect.value;
      localStorage.setItem(STORAGE.activeTemplateId, state.activeTemplateId);
      state.sort = { columnId: "", direction: "" };
      loadRecords();
      render();
    });

    els.newTemplateButton.addEventListener("click", () => openTemplateDialog("create"));
    els.renameTemplateButton.addEventListener("click", () => openTemplateDialog("edit"));
    els.deleteTemplateButton.addEventListener("click", deleteTemplate);
    els.addRowButton.addEventListener("click", addRow);
    els.emptyAddButton.addEventListener("click", addRow);
    els.addColumnButton.addEventListener("click", addColumn);
    els.exportButton.addEventListener("click", exportCsv);
    els.csvFileInput.addEventListener("change", (event) => onCsvFileSelected(event.target.files[0]));
    els.searchInput.addEventListener("input", () => {
      state.search = els.searchInput.value;
      renderTable();
      renderStats();
    });
    els.clearSearchButton.addEventListener("click", () => {
      state.search = "";
      els.searchInput.value = "";
      render();
    });

    els.templateForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveTemplateFromDialog()) {
        els.templateDialog.close();
      }
    });
    els.cancelTemplateButton.addEventListener("click", () => {
      els.templateForm.reset();
      els.templateDialog.close();
    });

    els.importForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (confirmImport()) {
        els.importDialog.close();
      }
    });
    els.cancelImportButton.addEventListener("click", () => {
      state.importRows = [];
      state.importFileName = "";
      els.importDialog.close();
    });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.deferredInstallPrompt = event;
      els.installButton.classList.remove("hidden");
    });

    els.installButton.addEventListener("click", async () => {
      if (!state.deferredInstallPrompt) {
        showToast("请用安卓 Chrome 的菜单添加到主屏幕");
        return;
      }
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      els.installButton.classList.add("hidden");
    });
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      console.warn("Service worker registration failed", error);
    }
  }

  loadApp();
  bindEvents();
  render();
  markSaved();
  registerServiceWorker();
})();
