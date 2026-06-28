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
    "愉快",
    "能量",
    "压力",
    "腰痛",
    "反刍",
    "活动",
  ];

  const state = {
    templates: [],
    activeTemplateId: "",
    records: [],
    selectedDate: todayDate(),
    viewMode: "day",
    activeView: "overview",
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
    addColumnButton: document.getElementById("addColumnButton"),
    exportButton: document.getElementById("exportButton"),
    csvFileInput: document.getElementById("csvFileInput"),
    searchInput: document.getElementById("searchInput"),
    clearSearchButton: document.getElementById("clearSearchButton"),
    overviewView: document.getElementById("overviewView"),
    recordView: document.getElementById("recordView"),
    openRecordButton: document.getElementById("openRecordButton"),
    summaryRecordButton: document.getElementById("summaryRecordButton"),
    summaryTitle: document.getElementById("summaryTitle"),
    overviewList: document.getElementById("overviewList"),
    overviewEmptyState: document.getElementById("overviewEmptyState"),
    recordCount: document.getElementById("recordCount"),
    moodAverageLabel: document.getElementById("moodAverageLabel"),
    moodAverage: document.getElementById("moodAverage"),
    moodMax: document.getElementById("moodMax"),
    moodMin: document.getElementById("moodMin"),
    recordBackButton: document.getElementById("recordBackButton"),
    recordDateTitle: document.getElementById("recordDateTitle"),
    recordPageSummary: document.getElementById("recordPageSummary"),
    recordPreviousDayButton: document.getElementById("recordPreviousDayButton"),
    recordDateInput: document.getElementById("recordDateInput"),
    recordNextDayButton: document.getElementById("recordNextDayButton"),
    recordTodayButton: document.getElementById("recordTodayButton"),
    recordAddButton: document.getElementById("recordAddButton"),
    entryScroll: document.getElementById("entryScroll"),
    entryTable: document.getElementById("entryTable"),
    entryTableHead: document.getElementById("entryTableHead"),
    entryTableBody: document.getElementById("entryTableBody"),
    recordEmptyState: document.getElementById("recordEmptyState"),
    recordEmptyAddButton: document.getElementById("recordEmptyAddButton"),
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

  function getTimeColumn(template = getActiveTemplate()) {
    return template?.columns.find((column) => column.name.trim() === "时间") ||
      template?.columns.find((column) => column.name.includes("时间"));
  }

  function getMetricColumns(template = getActiveTemplate()) {
    const dateColumn = getDateColumn(template);
    const timeColumn = getTimeColumn(template);
    return (template?.columns || []).filter(
      (column) => column.id !== dateColumn?.id && column.id !== timeColumn?.id
    );
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
    renderStats();
    renderOverviewSummary();
    renderRecordPage();
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
    els.dayRecordSummary.textContent = `${scopedCount} 个时间点`;
    els.selectedDateInput.value = state.selectedDate;
    els.dateNavigator.classList.toggle("hidden", !isDay);
    els.dayViewButton.classList.toggle("active", isDay);
    els.allViewButton.classList.toggle("active", !isDay);
    els.dayViewButton.setAttribute("aria-pressed", String(isDay));
    els.allViewButton.setAttribute("aria-pressed", String(!isDay));
    els.exportButton.textContent = isDay ? "导出当天 CSV" : "导出全部 CSV";
    els.summaryTitle.textContent = isDay ? "当天记录" : "全部记录";
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

  function recordTime(record, template = getActiveTemplate()) {
    const timeColumn = getTimeColumn(template);
    return String(timeColumn ? record.values?.[timeColumn.id] || "" : record.entryTime || "");
  }

  function renderOverviewSummary() {
    const template = getActiveTemplate();
    if (!template) {
      return;
    }
    const visibleRecords = getVisibleRecords();
    const metricColumns = getMetricColumns(template);
    els.overviewList.innerHTML = "";

    visibleRecords.forEach((record) => {
      const item = document.createElement("article");
      item.className = "summary-item";

      const time = document.createElement("div");
      time.className = "summary-time";
      const timeLabel = recordTime(record, template) || "--:--";
      time.textContent =
        state.viewMode === "all"
          ? `${inferRecordDate(record, template).slice(5)} ${timeLabel}`
          : timeLabel;

      const values = document.createElement("div");
      values.className = "summary-values";
      metricColumns.forEach((column) => {
        const value = String(record.values?.[column.id] || "").trim();
        if (!value) {
          return;
        }
        const part = document.createElement("span");
        part.className = "summary-value";
        const label = document.createElement("strong");
        label.textContent = `${column.name} `;
        part.append(label, document.createTextNode(value));
        values.append(part);
      });
      if (!values.childElementCount) {
        const empty = document.createElement("span");
        empty.className = "summary-value";
        empty.textContent = "尚未填写指标";
        values.append(empty);
      }
      item.append(time, values);
      els.overviewList.append(item);
    });

    els.overviewEmptyState.classList.toggle("hidden", visibleRecords.length > 0);
  }

  function inputModeFor(columnName) {
    return /心情|愉快|能量|压力|疼|痛|反刍|睡眠|评分|分数/.test(columnName)
      ? "decimal"
      : "text";
  }

  function queueRecordSave() {
    clearTimeout(queueRecordSave.timer);
    queueRecordSave.timer = setTimeout(() => {
      queueRecordSave.timer = null;
      saveRecords();
    }, 180);
  }

  function flushRecordSave() {
    if (!queueRecordSave.timer) {
      return;
    }
    clearTimeout(queueRecordSave.timer);
    queueRecordSave.timer = null;
    saveRecords();
  }

  function focusEntry(recordId, metricIndex) {
    const input = els.entryTableBody.querySelector(
      `[data-record-id="${recordId}"][data-metric-index="${metricIndex}"]`
    );
    if (input) {
      input.focus({ preventScroll: true });
      input.scrollIntoView({ block: "center", inline: "nearest" });
    }
  }

  function renderRecordPage() {
    const template = getActiveTemplate();
    if (!template) {
      return;
    }
    const records = state.records.filter(
      (record) => inferRecordDate(record, template) === state.selectedDate
    );
    const metrics = getMetricColumns(template);
    const timeColumn = getTimeColumn(template);

    els.recordDateTitle.textContent = formatDateTitle(state.selectedDate);
    els.recordPageSummary.textContent = `${records.length} 个时间点`;
    els.recordDateInput.value = state.selectedDate;
    els.entryTableHead.innerHTML = "";
    els.entryTableBody.innerHTML = "";

    const headRow = document.createElement("tr");
    const metricHeading = document.createElement("th");
    metricHeading.className = "metric-heading";
    metricHeading.textContent = "指标";
    headRow.append(metricHeading);

    records.forEach((record) => {
      const th = document.createElement("th");
      const wrapper = document.createElement("div");
      wrapper.className = "time-heading";

      const timeInput = document.createElement("input");
      timeInput.className = "time-input";
      timeInput.type = "time";
      timeInput.value = recordTime(record, template);
      timeInput.setAttribute("aria-label", "记录时间");
      timeInput.addEventListener("input", () => {
        if (timeColumn) {
          record.values[timeColumn.id] = timeInput.value;
        } else {
          record.entryTime = timeInput.value;
        }
        record.updatedAt = nowIso();
        queueRecordSave();
      });
      timeInput.addEventListener("change", flushRecordSave);

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-time-button";
      deleteButton.type = "button";
      deleteButton.textContent = "×";
      deleteButton.title = "删除这个时间点";
      deleteButton.setAttribute("aria-label", `删除 ${timeInput.value || "这个"} 时间点`);
      deleteButton.addEventListener("click", () => {
        const label = recordTime(record, template) || "这个";
        if (confirm(`删除 ${label} 的记录？`)) {
          deleteRow(record.id);
        }
      });

      wrapper.append(timeInput, deleteButton);
      th.append(wrapper);
      headRow.append(th);
    });
    els.entryTableHead.append(headRow);

    metrics.forEach((column, metricIndex) => {
      const tr = document.createElement("tr");
      const nameCell = document.createElement("th");
      nameCell.className = "metric-name";
      nameCell.scope = "row";
      nameCell.textContent = column.name;
      tr.append(nameCell);

      records.forEach((record) => {
        const td = document.createElement("td");
        td.className = "entry-cell";
        const input = document.createElement("input");
        input.className = "entry-input";
        input.type = "text";
        input.inputMode = inputModeFor(column.name);
        input.enterKeyHint = metricIndex === metrics.length - 1 ? "done" : "next";
        input.autocomplete = "off";
        input.value = record.values?.[column.id] || "";
        input.placeholder = input.inputMode === "decimal" ? "填写数值" : "填写内容";
        input.dataset.recordId = record.id;
        input.dataset.metricIndex = String(metricIndex);
        input.setAttribute("aria-label", `${column.name}，${recordTime(record, template) || "当前时间"}`);
        input.addEventListener("input", () => {
          record.values[column.id] = input.value;
          record.updatedAt = nowIso();
          queueRecordSave();
        });
        input.addEventListener("change", flushRecordSave);
        input.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") {
            return;
          }
          event.preventDefault();
          if (metricIndex < metrics.length - 1) {
            focusEntry(record.id, metricIndex + 1);
          } else {
            input.blur();
            flushRecordSave();
          }
        });
        td.append(input);
        tr.append(td);
      });
      els.entryTableBody.append(tr);
    });

    const isEmpty = records.length === 0;
    els.entryTable.classList.toggle("hidden", isEmpty);
    els.recordEmptyState.classList.toggle("hidden", !isEmpty);
  }

  function renderStats() {
    const template = getActiveTemplate();
    const visibleRecords = getVisibleRecords();
    const scopedRecords = getScopedRecords();
    els.recordCount.textContent = state.search
      ? `${visibleRecords.length}/${scopedRecords.length}`
      : String(scopedRecords.length);

    const moodColumn = template?.columns.find((column) =>
      /心情|愉快|情绪/.test(column.name)
    );
    els.moodAverageLabel.textContent = moodColumn ? `平均${moodColumn.name}` : "平均指标";
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

  function switchView(view) {
    flushRecordSave();
    state.activeView = view;
    if (view === "record") {
      state.viewMode = "day";
    }
    document.body.classList.toggle("record-mode", view === "record");
    els.overviewView.classList.toggle("hidden", view !== "overview");
    els.recordView.classList.toggle("hidden", view !== "record");
    render();
  }

  function addRow() {
    const template = getActiveTemplate();
    if (state.viewMode === "all") {
      state.viewMode = "day";
    }
    const dateColumn = getDateColumn(template);
    const timeColumn = getTimeColumn(template);
    const values = {};
    template.columns.forEach((column) => {
      if (column.id === dateColumn?.id) values[column.id] = state.selectedDate;
      else if (column.id === timeColumn?.id) values[column.id] = currentTime();
      else values[column.id] = "";
    });
    const record = {
      id: uid("row"),
      values,
      pageDate: state.selectedDate,
      entryTime: timeColumn ? "" : currentTime(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.records.push(record);
    saveRecords();
    switchView("record");
    requestAnimationFrame(() => {
      if (getMetricColumns(template).length > 0) {
        focusEntry(record.id, 0);
      } else {
        const timeInputs = els.entryTableHead.querySelectorAll(".time-input");
        timeInputs[timeInputs.length - 1]?.focus();
      }
    });
    showToast("已添加一个时间点");
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
    renderOverviewSummary();
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
    const timeColumn = getTimeColumn(template);
    let exportColumns = dateColumn
      ? template.columns
      : [{ id: "__pageDate", name: "记录日期" }, ...template.columns];
    if (!timeColumn) {
      const dateIndex = exportColumns.findIndex(
        (column) => column.id === "__pageDate" || column.id === dateColumn?.id
      );
      const insertIndex = dateIndex >= 0 ? dateIndex + 1 : 0;
      exportColumns = [...exportColumns];
      exportColumns.splice(insertIndex, 0, { id: "__entryTime", name: "记录时间" });
    }
    const rows = [
      exportColumns.map((column) => column.name),
      ...exportRecords.map((record) =>
        exportColumns.map((column) => {
          if (column.id === "__pageDate") {
            return inferRecordDate(record, template);
          }
          if (column.id === "__entryTime") {
            return recordTime(record, template);
          }
          if (column.id === dateColumn?.id) {
            return record.values?.[column.id] || inferRecordDate(record, template);
          }
          if (column.id === timeColumn?.id) {
            return record.values?.[column.id] || recordTime(record, template);
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
    els.openRecordButton.addEventListener("click", () => switchView("record"));
    els.summaryRecordButton.addEventListener("click", addRow);
    els.recordBackButton.addEventListener("click", () => switchView("overview"));
    els.recordPreviousDayButton.addEventListener("click", () => shiftSelectedDate(-1));
    els.recordNextDayButton.addEventListener("click", () => shiftSelectedDate(1));
    els.recordTodayButton.addEventListener("click", () => {
      state.selectedDate = todayDate();
      state.viewMode = "day";
      render();
    });
    els.recordDateInput.addEventListener("change", () => {
      const date = normalizeDateValue(els.recordDateInput.value);
      if (date) {
        state.selectedDate = date;
        state.viewMode = "day";
        render();
      }
    });

    els.templateSelect.addEventListener("change", () => {
      flushRecordSave();
      state.activeTemplateId = els.templateSelect.value;
      localStorage.setItem(STORAGE.activeTemplateId, state.activeTemplateId);
      state.sort = { columnId: "", direction: "" };
      loadRecords();
      render();
    });

    els.newTemplateButton.addEventListener("click", () => openTemplateDialog("create"));
    els.renameTemplateButton.addEventListener("click", () => openTemplateDialog("edit"));
    els.deleteTemplateButton.addEventListener("click", deleteTemplate);
    els.recordAddButton.addEventListener("click", addRow);
    els.recordEmptyAddButton.addEventListener("click", addRow);
    els.addColumnButton.addEventListener("click", addColumn);
    els.exportButton.addEventListener("click", exportCsv);
    els.csvFileInput.addEventListener("change", (event) => onCsvFileSelected(event.target.files[0]));
    els.searchInput.addEventListener("input", () => {
      state.search = els.searchInput.value;
      renderOverviewSummary();
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

    window.addEventListener("pagehide", flushRecordSave);
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
  switchView("overview");
  markSaved();
  registerServiceWorker();
})();
