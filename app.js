(function () {
  "use strict";

  const STORAGE = {
    templates: "moodTable.templates",
    activeTemplateId: "moodTable.activeTemplateId",
    records: (templateId) => `moodTable.records.${templateId}`,
    analytics: (templateId) => `moodTable.analytics.${templateId}`,
  };

  const APP_VERSION = "7.4";
  const BACKUP_SCHEMA = "mood-table-backup";
  const ROLE_OPTIONS = [
    ["none", "不绘图"],
    ["valence", "愉快（效价）"],
    ["energeticArousal", "能量（精力性唤醒）"],
    ["tenseArousal", "焦虑（紧张性唤醒）"],
    ["rumination", "反刍轨道"],
    ["activity", "活动事件"],
    ["physical", "身体状态"],
  ];
  const AXIS_META = {
    valence: { label: "愉快", color: "#287460", soft: "rgba(40,116,96,.16)" },
    energeticArousal: { label: "能量", color: "#bf8522", soft: "rgba(191,133,34,.16)" },
    tenseArousal: { label: "焦虑", color: "#d76f5c", soft: "rgba(215,111,92,.16)" },
    physical: { label: "腰痛", color: "#4d78a8", soft: "rgba(77,120,168,.16)" },
  };

  const DEFAULT_COLUMNS = [
    "日期",
    "时间",
    "愉快",
    "能量",
    "焦虑",
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
    analytics: { version: 1, columns: {} },
    trendMode: "day",
    charts: {},
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
    analyticsButton: document.getElementById("analyticsButton"),
    backupButton: document.getElementById("backupButton"),
    backupFileInput: document.getElementById("backupFileInput"),
    searchInput: document.getElementById("searchInput"),
    clearSearchButton: document.getElementById("clearSearchButton"),
    sortSelect: document.getElementById("sortSelect"),
    overviewView: document.getElementById("overviewView"),
    recordView: document.getElementById("recordView"),
    openRecordButton: document.getElementById("openRecordButton"),
    summaryRecordButton: document.getElementById("summaryRecordButton"),
    summaryTitle: document.getElementById("summaryTitle"),
    overviewList: document.getElementById("overviewList"),
    overviewEmptyState: document.getElementById("overviewEmptyState"),
    openTrendsButton: document.getElementById("openTrendsButton"),
    miniValenceValue: document.getElementById("miniValenceValue"),
    miniEnergyValue: document.getElementById("miniEnergyValue"),
    miniTensionValue: document.getElementById("miniTensionValue"),
    miniValenceCanvas: document.getElementById("miniValenceCanvas"),
    miniEnergyCanvas: document.getElementById("miniEnergyCanvas"),
    miniTensionCanvas: document.getElementById("miniTensionCanvas"),
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
    trendsView: document.getElementById("trendsView"),
    trendsBackButton: document.getElementById("trendsBackButton"),
    trendSettingsButton: document.getElementById("trendSettingsButton"),
    trendDayButton: document.getElementById("trendDayButton"),
    trendWeekButton: document.getElementById("trendWeekButton"),
    trendPreviousButton: document.getElementById("trendPreviousButton"),
    trendDateInput: document.getElementById("trendDateInput"),
    trendNextButton: document.getElementById("trendNextButton"),
    trendTodayButton: document.getElementById("trendTodayButton"),
    trendPeriodTitle: document.getElementById("trendPeriodTitle"),
    trendCoverage: document.getElementById("trendCoverage"),
    trendNoData: document.getElementById("trendNoData"),
    valenceCanvas: document.getElementById("valenceCanvas"),
    energyCanvas: document.getElementById("energyCanvas"),
    tensionCanvas: document.getElementById("tensionCanvas"),
    painCanvas: document.getElementById("painCanvas"),
    valenceRangeLabel: document.getElementById("valenceRangeLabel"),
    energyRangeLabel: document.getElementById("energyRangeLabel"),
    tensionRangeLabel: document.getElementById("tensionRangeLabel"),
    painRangeLabel: document.getElementById("painRangeLabel"),
    ruminationTrack: document.getElementById("ruminationTrack"),
    activityTrack: document.getElementById("activityTrack"),
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
    analyticsDialog: document.getElementById("analyticsDialog"),
    analyticsForm: document.getElementById("analyticsForm"),
    analyticsList: document.getElementById("analyticsList"),
    cancelAnalyticsButton: document.getElementById("cancelAnalyticsButton"),
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
    const input = String(value || "").trim();
    const match = input.match(/^(\d{4})\s*[-年/.]\s*(\d{1,2})\s*[-月/.]\s*(\d{1,2})(?:\s*日)?(?:$|[T\s])/);
    if (!match) {
      return "";
    }
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const normalized = formatLocalDate(date);
    return normalized === `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`
      ? normalized
      : "";
  }

  function parseNumericValue(value) {
    const text = String(value ?? "")
      .trim()
      .replace(/[，,]/g, ".")
      .replace(/[－−]/g, "-")
      .replace(/[＋]/g, "+");
    if (!text) {
      return null;
    }
    const match = text.match(/^([-+]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*(?:分|\/\s*\d+(?:\.\d+)?))?$/);
    if (!match) {
      return null;
    }
    const number = Number(match[1]);
    return Number.isFinite(number) ? number : null;
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

  function inferAnalyticsForColumn(column) {
    const name = String(column?.name || "").trim();
    if (/愉快|正负性|效价/.test(name)) {
      return { dataType: "number", role: "valence", min: -5, max: 5 };
    }
    if (/心情分数|情绪分数/.test(name)) {
      return { dataType: "number", role: "valence", min: 1, max: 10 };
    }
    if (/能量|精力/.test(name)) {
      return { dataType: "number", role: "energeticArousal", min: -5, max: 5 };
    }
    if (/焦虑|紧张/.test(name)) {
      return { dataType: "number", role: "tenseArousal", min: 0, max: 10 };
    }
    if (/反刍/.test(name)) {
      return {
        dataType: "ordinal",
        role: "rumination",
        levels: ["无", "轻微", "有", "非常强"],
      };
    }
    if (/活动|事件/.test(name)) {
      return { dataType: "text", role: "activity" };
    }
    if (/腰痛|疼痛|疼|痛/.test(name)) {
      return { dataType: "number", role: "physical", min: 0, max: 10 };
    }
    return { dataType: "text", role: "none" };
  }

  function reconcileAnalytics(config = state.analytics) {
    const template = getActiveTemplate();
    const next = { version: 1, columns: {} };
    (template?.columns || []).forEach((column) => {
      next.columns[column.id] = config?.columns?.[column.id] || inferAnalyticsForColumn(column);
    });
    return next;
  }

  function loadAnalytics() {
    const stored = safeJsonParse(localStorage.getItem(STORAGE.analytics(state.activeTemplateId)), null);
    state.analytics = reconcileAnalytics(stored);
  }

  function saveAnalytics() {
    state.analytics = reconcileAnalytics(state.analytics);
    if (writeStorage(STORAGE.analytics(state.activeTemplateId), state.analytics)) {
      markSaved();
      return true;
    }
    return false;
  }

  function getColumnByRole(role) {
    const template = getActiveTemplate();
    return template?.columns.find((column) => state.analytics.columns[column.id]?.role === role);
  }

  function getAnalyticsSetting(columnId) {
    return state.analytics.columns[columnId] || { dataType: "text", role: "none" };
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
    loadAnalytics();
  }

  function saveTemplates() {
    return writeStorage(STORAGE.templates, state.templates);
  }

  function saveRecords() {
    if (writeStorage(STORAGE.records(state.activeTemplateId), state.records)) {
      markSaved();
      return true;
    }
    return false;
  }

  function loadRecords() {
    const records = safeJsonParse(localStorage.getItem(STORAGE.records(state.activeTemplateId)), []);
    state.records = Array.isArray(records) ? records : [];
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

  function markSaved() {
    els.saveStatus.textContent = `已在本机保存 ${new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Local storage write failed", error);
      els.saveStatus.textContent = "保存失败，请立即导出完整备份";
      showToast("本机存储空间不足，刚才的修改可能未保存");
      return false;
    }
  }

  function render() {
    renderTemplateSelect();
    renderSortSelect();
    renderDateWorkspace();
    renderStats();
    renderOverviewSummary();
    renderRecordPage();
    if (state.activeView === "overview") {
      requestAnimationFrame(renderTrendPreview);
    } else if (state.activeView === "trends") {
      requestAnimationFrame(renderTrends);
    }
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

  function renderSortSelect() {
    const template = getActiveTemplate();
    const selectedValue = state.sort.columnId && state.sort.direction
      ? `${state.sort.columnId}|${state.sort.direction}`
      : "";
    els.sortSelect.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "按录入顺序";
    els.sortSelect.append(defaultOption);
    (template?.columns || []).forEach((column) => {
      [["asc", "升序"], ["desc", "降序"]].forEach(([direction, label]) => {
        const option = document.createElement("option");
        option.value = `${column.id}|${direction}`;
        option.textContent = `${column.name} · ${label}`;
        option.selected = option.value === selectedValue;
        els.sortSelect.append(option);
      });
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
        const dateColumn = getDateColumn(template);
        const timeColumn = getTimeColumn(template);
        const valueFor = (record) => {
          if (state.sort.columnId === dateColumn?.id) return inferRecordDate(record, template);
          if (state.sort.columnId === timeColumn?.id) return recordTime(record, template);
          return String(record.values?.[state.sort.columnId] || "");
        };
        const aValue = valueFor(a);
        const bValue = valueFor(b);
        if (!String(aValue).trim() && String(bValue).trim()) return 1;
        if (String(aValue).trim() && !String(bValue).trim()) return -1;
        const aNum = parseNumericValue(aValue);
        const bNum = parseNumericValue(bValue);
        const bothNumeric = aNum !== null && bNum !== null;
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
        const setting = getAnalyticsSetting(column.id);
        const input = document.createElement(setting.dataType === "ordinal" ? "select" : "input");
        input.className = "entry-input";
        if (input.tagName === "SELECT") {
          ["", ...(setting.levels || ["无", "轻微", "有", "非常强"])].forEach((level) => {
            const option = document.createElement("option");
            option.value = level;
            option.textContent = level || "请选择";
            input.append(option);
          });
        } else {
          input.type = "text";
          input.inputMode = setting.dataType === "number" ? "decimal" : inputModeFor(column.name);
          input.enterKeyHint = metricIndex === metrics.length - 1 ? "done" : "next";
          input.autocomplete = "off";
          input.placeholder = setting.dataType === "number"
            ? `${setting.min ?? ""} ～ ${setting.max ?? ""}`
            : "填写内容";
        }
        input.value = record.values?.[column.id] || "";
        input.dataset.recordId = record.id;
        input.dataset.metricIndex = String(metricIndex);
        input.setAttribute("aria-label", `${column.name}，${recordTime(record, template) || "当前时间"}`);
        const updateValue = () => {
          record.values[column.id] = input.value;
          record.updatedAt = nowIso();
          updateInputValidity(input, setting);
          queueRecordSave();
        };
        input.addEventListener("input", updateValue);
        input.addEventListener("change", updateValue);
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
        updateInputValidity(input, setting);
        td.append(input);
        tr.append(td);
      });
      els.entryTableBody.append(tr);
    });

    const isEmpty = records.length === 0;
    els.entryTable.classList.toggle("hidden", isEmpty);
    els.recordEmptyState.classList.toggle("hidden", !isEmpty);
  }

  function updateInputValidity(input, setting) {
    if (setting.dataType !== "number" || !String(input.value).trim()) {
      input.classList.remove("invalid-value");
      input.removeAttribute("title");
      return;
    }
    const value = parseNumericValue(input.value);
    const invalid =
      value === null ||
      (Number.isFinite(Number(setting.min)) && value < Number(setting.min)) ||
      (Number.isFinite(Number(setting.max)) && value > Number(setting.max));
    input.classList.toggle("invalid-value", invalid);
    if (invalid) {
      input.title = value === null
        ? "这个内容不是可识别的数值，原始内容仍会保存。"
        : `参考范围：${setting.min} ～ ${setting.max}。原始值仍会保存并显示在图表中。`;
    } else {
      input.removeAttribute("title");
    }
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
          .map((record) => parseNumericValue(record.values?.[moodColumn.id]))
          .filter((value) => value !== null)
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
    document.body.classList.toggle("trends-mode", view === "trends");
    els.overviewView.classList.toggle("hidden", view !== "overview");
    els.recordView.classList.toggle("hidden", view !== "record");
    els.trendsView.classList.toggle("hidden", view !== "trends");
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
    state.analytics.columns[column.id] = inferAnalyticsForColumn(column);
    template.updatedAt = nowIso();
    state.records.forEach((record) => {
      record.values[column.id] = "";
      record.updatedAt = nowIso();
    });
    saveTemplates();
    saveRecords();
    saveAnalytics();
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
    if (getAnalyticsSetting(columnId).role === "none") {
      state.analytics.columns[columnId] = inferAnalyticsForColumn(column);
      saveAnalytics();
    }
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
    delete state.analytics.columns[columnId];
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
    saveAnalytics();
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
      state.analytics = reconcileAnalytics({ version: 1, columns: {} });
      saveTemplates();
      localStorage.setItem(STORAGE.activeTemplateId, template.id);
      saveRecords();
      saveAnalytics();
      render();
      showToast("模板已创建");
      return true;
    }

    const template = getActiveTemplate();
    const oldColumns = template.columns;
    const assignedOldIds = new Set();
    const nextColumns = columnNames.map((columnName) => {
      const exact = oldColumns.find(
        (column) => column.name === columnName && !assignedOldIds.has(column.id)
      );
      if (exact) {
        assignedOldIds.add(exact.id);
        return { id: exact.id, name: columnName };
      }
      return null;
    });
    nextColumns.forEach((column, index) => {
      if (column) {
        return;
      }
      const positional = oldColumns[index];
      if (positional && !assignedOldIds.has(positional.id)) {
        assignedOldIds.add(positional.id);
        nextColumns[index] = { id: positional.id, name: columnNames[index] };
      } else {
        nextColumns[index] = { id: uid("col"), name: columnNames[index] };
      }
    });
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
    state.analytics = reconcileAnalytics(state.analytics);
    template.updatedAt = nowIso();
    saveTemplates();
    saveRecords();
    saveAnalytics();
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
    localStorage.removeItem(STORAGE.analytics(template.id));
    state.activeTemplateId = state.templates[0].id;
    localStorage.setItem(STORAGE.activeTemplateId, state.activeTemplateId);
    saveTemplates();
    loadRecords();
    loadAnalytics();
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
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
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
    const headers = uniqueNames(
      state.importRows[0].map((header, index) => String(header || "").trim() || `第 ${index + 1} 列`)
    );
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
    state.analytics = reconcileAnalytics(state.analytics);
    saveTemplates();
    saveRecords();
    saveAnalytics();
    render();
    showToast(mode === "replace" ? "CSV 已覆盖导入" : "CSV 已追加导入");
    return true;
  }

  function openAnalyticsDialog() {
    const template = getActiveTemplate();
    els.analyticsList.innerHTML = "";
    getMetricColumns(template).forEach((column) => {
      const setting = getAnalyticsSetting(column.id);
      const row = document.createElement("div");
      row.className = "analytics-row";
      row.dataset.columnId = column.id;

      const name = document.createElement("strong");
      name.textContent = column.name;
      const role = document.createElement("select");
      role.className = "analytics-role";
      role.setAttribute("aria-label", `${column.name}的图表作用`);
      ROLE_OPTIONS.forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        option.selected = setting.role === value;
        role.append(option);
      });

      const range = document.createElement("div");
      range.className = "analytics-range";
      const min = document.createElement("input");
      min.className = "analytics-min";
      min.type = "number";
      min.step = "any";
      min.value = setting.min ?? "";
      min.placeholder = "最小";
      const max = document.createElement("input");
      max.className = "analytics-max";
      max.type = "number";
      max.step = "any";
      max.value = setting.max ?? "";
      max.placeholder = "最大";
      range.append(min, max);

      const toggleRange = () => {
        const numeric = ["valence", "energeticArousal", "tenseArousal", "physical"].includes(role.value);
        range.classList.toggle("hidden", !numeric);
      };
      role.addEventListener("change", toggleRange);
      toggleRange();
      row.append(name, role, range);
      els.analyticsList.append(row);
    });
    els.analyticsDialog.showModal();
  }

  function saveAnalyticsFromDialog() {
    const next = { version: 1, columns: { ...state.analytics.columns } };
    const used = new Set();
    for (const row of els.analyticsList.querySelectorAll(".analytics-row")) {
      const columnId = row.dataset.columnId;
      const role = row.querySelector(".analytics-role").value;
      if (role !== "none" && used.has(role)) {
        showToast("每种图表作用只能选择一个指标");
        return false;
      }
      if (role !== "none") used.add(role);
      if (role === "rumination") {
        next.columns[columnId] = {
          dataType: "ordinal",
          role,
          levels: ["无", "轻微", "有", "非常强"],
        };
      } else if (role === "activity" || role === "none") {
        next.columns[columnId] = { dataType: "text", role };
      } else {
        const min = Number(row.querySelector(".analytics-min").value);
        const max = Number(row.querySelector(".analytics-max").value);
        if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
          showToast("数值指标需要填写有效的最小值和最大值");
          return false;
        }
        next.columns[columnId] = { dataType: "number", role, min, max };
      }
    }
    state.analytics = next;
    saveAnalytics();
    render();
    showToast("分析设置已保存");
    return true;
  }

  function exportFullBackup() {
    flushRecordSave();
    const recordsByTemplate = {};
    const analyticsByTemplate = {};
    state.templates.forEach((template) => {
      const records = safeJsonParse(localStorage.getItem(STORAGE.records(template.id)), []);
      const analytics = safeJsonParse(localStorage.getItem(STORAGE.analytics(template.id)), null);
      recordsByTemplate[template.id] = template.id === state.activeTemplateId
        ? state.records
        : (Array.isArray(records) ? records : []);
      analyticsByTemplate[template.id] = template.id === state.activeTemplateId
        ? state.analytics
        : (analytics || { version: 1, columns: {} });
    });
    const backup = {
      schema: BACKUP_SCHEMA,
      version: 1,
      appVersion: APP_VERSION,
      exportedAt: nowIso(),
      templates: state.templates,
      activeTemplateId: state.activeTemplateId,
      recordsByTemplate,
      analyticsByTemplate,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `心情表格_完整备份_${todayDate()}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    showToast("完整备份已导出，请妥善保存");
  }

  function validateBackup(backup) {
    if (!backup || backup.schema !== BACKUP_SCHEMA || backup.version !== 1) return "不是受支持的心情表格备份";
    if (!Array.isArray(backup.templates) || backup.templates.length === 0) return "备份中没有模板";
    const ids = new Set();
    for (const template of backup.templates) {
      if (!template?.id || !template?.name || !Array.isArray(template.columns)) return "模板结构不完整";
      if (ids.has(template.id)) return "备份中有重复模板";
      ids.add(template.id);
      if (!template.columns.every((column) => column?.id && typeof column.name === "string")) return "模板列结构不完整";
      const records = backup.recordsByTemplate?.[template.id];
      if (!Array.isArray(records)) return "记录结构不完整";
      if (!records.every((record) => record && typeof record === "object" && record.values && typeof record.values === "object")) {
        return "记录内容结构不完整";
      }
      const analytics = backup.analyticsByTemplate?.[template.id];
      if (analytics && (typeof analytics !== "object" || typeof analytics.columns !== "object")) {
        return "分析设置结构不完整";
      }
    }
    if (!ids.has(backup.activeTemplateId)) return "当前模板无效";
    return "";
  }

  async function restoreFullBackup(file) {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const error = validateBackup(backup);
      if (error) {
        showToast(error);
        return;
      }
      const recordCount = backup.templates.reduce(
        (sum, template) => sum + backup.recordsByTemplate[template.id].length,
        0
      );
      if (!confirm(`恢复 ${backup.templates.length} 个模板、${recordCount} 条记录？这会覆盖本机现有的心情表格数据。`)) {
        return;
      }
      const moodKeys = Object.keys(localStorage).filter((key) => key.startsWith("moodTable."));
      const previousData = new Map(moodKeys.map((key) => [key, localStorage.getItem(key)]));
      try {
        moodKeys.forEach((key) => localStorage.removeItem(key));
        localStorage.setItem(STORAGE.templates, JSON.stringify(backup.templates));
        localStorage.setItem(STORAGE.activeTemplateId, backup.activeTemplateId);
        backup.templates.forEach((template) => {
          localStorage.setItem(
            STORAGE.records(template.id),
            JSON.stringify(backup.recordsByTemplate[template.id])
          );
          const analytics = backup.analyticsByTemplate?.[template.id];
          if (analytics) {
            localStorage.setItem(STORAGE.analytics(template.id), JSON.stringify(analytics));
          }
        });
      } catch (writeError) {
        Object.keys(localStorage)
          .filter((key) => key.startsWith("moodTable."))
          .forEach((key) => localStorage.removeItem(key));
        previousData.forEach((value, key) => {
          if (value !== null) {
            localStorage.setItem(key, value);
          }
        });
        throw writeError;
      }
      loadApp();
      switchView("overview");
      showToast("完整备份已恢复");
    } catch (error) {
      console.error(error);
      showToast("备份文件无法读取");
    } finally {
      els.backupFileInput.value = "";
    }
  }

  function dateValues(endDate, days) {
    const end = dateFromValue(endDate);
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(end);
      date.setDate(end.getDate() - (days - 1 - index));
      return formatLocalDate(date);
    });
  }

  function numericValue(record, role) {
    const column = getColumnByRole(role);
    if (!column) return null;
    return parseNumericValue(record.values?.[column.id]);
  }

  function aggregateRole(role, dates) {
    return dates.map((date) => {
      const values = state.records
        .filter((record) => inferRecordDate(record) === date)
        .map((record) => numericValue(record, role))
        .filter((value) => value !== null);
      return values.length
        ? {
            mean: values.reduce((sum, value) => sum + value, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
          }
        : null;
    });
  }

  function destroyChart(key) {
    if (state.charts[key]) {
      state.charts[key].destroy();
      delete state.charts[key];
    }
  }

  function chartDomain(setting, values) {
    const finiteValues = values.filter((value) => Number.isFinite(value));
    let min = Number.isFinite(Number(setting.min)) ? Number(setting.min) : Math.min(...finiteValues);
    let max = Number.isFinite(Number(setting.max)) ? Number(setting.max) : Math.max(...finiteValues);
    if (finiteValues.length > 0) {
      min = Math.min(min, ...finiteValues);
      max = Math.max(max, ...finiteValues);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { min: 0, max: 10 };
    }
    if (min === max) {
      return { min: min - 1, max: max + 1 };
    }
    const padding = (max - min) * 0.04;
    return {
      min: finiteValues.some((value) => value < Number(setting.min)) ? min - padding : min,
      max: finiteValues.some((value) => value > Number(setting.max)) ? max + padding : max,
    };
  }

  function prepareCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(Math.round(rect.width || canvas.clientWidth || 300), 1);
    const height = Math.max(Math.round(rect.height || canvas.clientHeight || 150), 1);
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);
    return { context, width, height };
  }

  function formatAxisNumber(value) {
    if (Math.abs(value) >= 100) return String(Math.round(value));
    return String(Number(value.toFixed(1)));
  }

  function drawNativeChart(canvas, labels, values, role, setting, compact, ranges = null) {
    const { context, width, height } = prepareCanvas(canvas);
    const meta = AXIS_META[role];
    const domainValues = ranges
      ? ranges.flatMap((item) => item ? [item.min, item.max, item.mean] : [])
      : values;
    const domain = chartDomain(setting, domainValues);
    const padding = compact
      ? { left: 3, right: 3, top: 5, bottom: 3 }
      : { left: 38, right: 12, top: 10, bottom: 27 };
    const chartWidth = Math.max(width - padding.left - padding.right, 1);
    const chartHeight = Math.max(height - padding.top - padding.bottom, 1);
    const xAt = (index) => padding.left + (
      labels.length <= 1 ? chartWidth / 2 : (index / (labels.length - 1)) * chartWidth
    );
    const yAt = (value) => padding.top + ((domain.max - value) / (domain.max - domain.min)) * chartHeight;

    if (!compact) {
      context.font = '11px "Microsoft YaHei", "PingFang SC", sans-serif';
      context.textBaseline = "middle";
      context.strokeStyle = "rgba(23,33,30,.09)";
      context.fillStyle = "#66736f";
      context.lineWidth = 1;
      for (let index = 0; index <= 4; index += 1) {
        const ratio = index / 4;
        const y = padding.top + ratio * chartHeight;
        const value = domain.max - ratio * (domain.max - domain.min);
        context.beginPath();
        context.moveTo(padding.left, y);
        context.lineTo(width - padding.right, y);
        context.stroke();
        context.textAlign = "right";
        context.fillText(formatAxisNumber(value), padding.left - 6, y);
      }
      context.textAlign = "center";
      labels.forEach((label, index) => {
        context.fillText(String(label), xAt(index), height - 9);
      });
    }

    if (ranges) {
      context.strokeStyle = meta.soft;
      context.lineWidth = Math.max(8, Math.min(16, chartWidth / Math.max(labels.length, 1) / 2));
      context.lineCap = "round";
      ranges.forEach((item, index) => {
        if (!item) return;
        context.beginPath();
        context.moveTo(xAt(index), yAt(item.min));
        context.lineTo(xAt(index), yAt(item.max));
        context.stroke();
      });
      context.lineCap = "butt";
    }

    const plottedValues = ranges ? ranges.map((item) => item?.mean ?? null) : values;
    context.strokeStyle = meta.color;
    context.fillStyle = meta.color;
    context.lineWidth = compact ? 2 : 2.5;
    context.lineJoin = "round";
    context.lineCap = "round";
    let drawing = false;
    plottedValues.forEach((value, index) => {
      if (!Number.isFinite(value)) {
        if (drawing) context.stroke();
        drawing = false;
        return;
      }
      const x = xAt(index);
      const y = yAt(value);
      if (!drawing) {
        context.beginPath();
        context.moveTo(x, y);
        drawing = true;
      } else {
        context.lineTo(x, y);
      }
    });
    if (drawing) context.stroke();

    plottedValues.forEach((value, index) => {
      if (!Number.isFinite(value)) return;
      context.beginPath();
      context.arc(xAt(index), yAt(value), compact ? 2.5 : 3.5, 0, Math.PI * 2);
      context.fill();
      if (!compact) {
        context.strokeStyle = "#ffffff";
        context.lineWidth = 1.5;
        context.stroke();
        context.strokeStyle = meta.color;
      }
    });
  }

  function makeLineChart(key, canvas, labels, values, role, compact = false) {
    destroyChart(key);
    if (!canvas) return;
    const column = getColumnByRole(role);
    const setting = column ? getAnalyticsSetting(column.id) : { min: 0, max: 10 };
    drawNativeChart(canvas, labels, values, role, setting, compact);
    state.charts[key] = { destroy() {} };
  }

  function makeRangeChart(key, canvas, labels, aggregates, role) {
    destroyChart(key);
    if (!canvas) return;
    const column = getColumnByRole(role);
    const setting = column ? getAnalyticsSetting(column.id) : { min: 0, max: 10 };
    drawNativeChart(
      canvas,
      labels,
      aggregates.map((item) => item?.mean ?? null),
      role,
      setting,
      false,
      aggregates
    );
    state.charts[key] = { destroy() {} };
  }

  function renderTrendPreview() {
    const dates = dateValues(state.selectedDate, 7);
    const labels = dates.map((date) => date.slice(5));
    [
      ["valence", "miniValence", els.miniValenceCanvas, els.miniValenceValue],
      ["energeticArousal", "miniEnergy", els.miniEnergyCanvas, els.miniEnergyValue],
      ["tenseArousal", "miniTension", els.miniTensionCanvas, els.miniTensionValue],
    ].forEach(([role, key, canvas, valueElement]) => {
      const aggregates = aggregateRole(role, dates);
      const values = aggregates.map((item) => item?.mean ?? null);
      const latest = [...values].reverse().find((value) => value !== null);
      valueElement.textContent = latest === undefined ? "-" : latest.toFixed(1);
      makeLineChart(key, canvas, labels, values, role, true);
    });
  }

  function timeSortValue(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : Number.MAX_SAFE_INTEGER;
  }

  function dailyTimeline() {
    return state.records
      .filter((record) => inferRecordDate(record) === state.selectedDate)
      .map((record, index) => ({
        record,
        index,
        label: recordTime(record) || "--:--",
      }))
      .sort((a, b) => timeSortValue(a.label) - timeSortValue(b.label) || a.index - b.index);
  }

  function renderRoleChart(role, key, canvas) {
    if (state.trendMode === "week") {
      const dates = dateValues(state.selectedDate, 7);
      makeRangeChart(key, canvas, dates.map((date) => date.slice(5)), aggregateRole(role, dates), role);
      return aggregateRole(role, dates).some(Boolean);
    }
    const timeline = dailyTimeline();
    const values = timeline.map((point) => numericValue(point.record, role));
    makeLineChart(key, canvas, timeline.map((point) => point.label), values, role);
    return values.some((value) => value !== null);
  }

  function renderContextTrack(element, role, dates) {
    element.innerHTML = "";
    const column = getColumnByRole(role);
    const setting = column ? getAnalyticsSetting(column.id) : null;
    const entries = [];
    if (column) {
      state.records
        .filter((record) => dates.includes(inferRecordDate(record)))
        .forEach((record) => {
          const value = String(record.values?.[column.id] || "").trim();
          if (!value) return;
          entries.push({
            date: inferRecordDate(record),
            time: recordTime(record) || "--:--",
            value,
            level: setting?.levels?.indexOf(value) ?? -1,
          });
        });
    }
    entries.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    entries.forEach((entry) => {
      const item = document.createElement("span");
      item.className = `track-item${role === "rumination" ? ` level-${Math.max(entry.level, 0)}` : ""}`;
      const prefix = state.trendMode === "week" ? `${entry.date.slice(5)} ${entry.time}` : entry.time;
      item.textContent = `${prefix} · ${entry.value}`;
      element.append(item);
    });
    if (entries.length === 0) {
      const empty = document.createElement("span");
      empty.className = "track-empty";
      empty.textContent = role === "rumination" ? "暂无反刍记录" : "暂无活动事件";
      element.append(empty);
    }
  }

  function roleDataStatus(role, dates) {
    const column = getColumnByRole(role);
    const setting = column ? getAnalyticsSetting(column.id) : null;
    const status = { valid: 0, invalid: 0, outside: 0, min: null, max: null };
    if (!column) {
      return status;
    }
    state.records
      .filter((record) => dates.includes(inferRecordDate(record)))
      .forEach((record) => {
        const raw = String(record.values?.[column.id] ?? "").trim();
        if (!raw) {
          return;
        }
        const value = parseNumericValue(raw);
        if (value === null) {
          status.invalid += 1;
          return;
        }
        status.valid += 1;
        status.min = status.min === null ? value : Math.min(status.min, value);
        status.max = status.max === null ? value : Math.max(status.max, value);
        if (
          (Number.isFinite(Number(setting?.min)) && value < Number(setting.min)) ||
          (Number.isFinite(Number(setting?.max)) && value > Number(setting.max))
        ) {
          status.outside += 1;
        }
      });
    return status;
  }

  function renderTrends() {
    const dates = state.trendMode === "week" ? dateValues(state.selectedDate, 7) : [state.selectedDate];
    els.trendDateInput.value = state.selectedDate;
    els.trendDayButton.classList.toggle("active", state.trendMode === "day");
    els.trendWeekButton.classList.toggle("active", state.trendMode === "week");
    els.trendPeriodTitle.textContent = state.trendMode === "day"
      ? formatDateTitle(state.selectedDate)
      : `${dates[0].slice(5)} 至 ${dates[6].slice(5)}`;
    const coverageText = state.trendMode === "week"
      ? "折线为日均，阴影为当天最低至最高"
      : "共用时间轴，三个维度独立显示";

    const chartMap = [
      ["valence", "valence", els.valenceCanvas, els.valenceRangeLabel],
      ["energeticArousal", "energy", els.energyCanvas, els.energyRangeLabel],
      ["tenseArousal", "tension", els.tensionCanvas, els.tensionRangeLabel],
      ["physical", "pain", els.painCanvas, els.painRangeLabel],
    ];
    let hasData = false;
    let invalidCount = 0;
    let outsideCount = 0;
    chartMap.forEach(([role, key, canvas, rangeLabel]) => {
      const column = getColumnByRole(role);
      const setting = column ? getAnalyticsSetting(column.id) : null;
      const status = roleDataStatus(role, dates);
      invalidCount += status.invalid;
      outsideCount += status.outside;
      const actualOutside =
        setting &&
        status.valid > 0 &&
        (status.min < Number(setting.min) || status.max > Number(setting.max));
      rangeLabel.textContent = setting
        ? `${setting.min} ～ ${setting.max}${actualOutside ? ` · 实际 ${status.min} ～ ${status.max}` : ""}`
        : "未设置";
      hasData = renderRoleChart(role, key, canvas) || hasData;
    });
    const notes = [];
    if (outsideCount > 0) notes.push(`${outsideCount} 个越界值已自动扩展显示`);
    if (invalidCount > 0) notes.push(`${invalidCount} 个非数值内容未绘制`);
    els.trendCoverage.textContent = [coverageText, ...notes].join(" · ");
    els.trendNoData.classList.toggle("hidden", hasData);
    renderContextTrack(els.ruminationTrack, "rumination", dates);
    renderContextTrack(els.activityTrack, "activity", dates);
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
      loadAnalytics();
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
    els.analyticsButton.addEventListener("click", openAnalyticsDialog);
    els.trendSettingsButton.addEventListener("click", openAnalyticsDialog);
    els.backupButton.addEventListener("click", exportFullBackup);
    els.backupFileInput.addEventListener("change", (event) => restoreFullBackup(event.target.files[0]));
    els.openTrendsButton.addEventListener("click", () => switchView("trends"));
    els.trendsBackButton.addEventListener("click", () => switchView("overview"));
    els.trendDayButton.addEventListener("click", () => {
      state.trendMode = "day";
      render();
    });
    els.trendWeekButton.addEventListener("click", () => {
      state.trendMode = "week";
      render();
    });
    els.trendPreviousButton.addEventListener("click", () =>
      shiftSelectedDate(state.trendMode === "week" ? -7 : -1)
    );
    els.trendNextButton.addEventListener("click", () =>
      shiftSelectedDate(state.trendMode === "week" ? 7 : 1)
    );
    els.trendTodayButton.addEventListener("click", () => {
      state.selectedDate = todayDate();
      render();
    });
    els.trendDateInput.addEventListener("change", () => {
      const date = normalizeDateValue(els.trendDateInput.value);
      if (date) {
        state.selectedDate = date;
        render();
      }
    });
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
    els.sortSelect.addEventListener("change", () => {
      const [columnId = "", direction = ""] = els.sortSelect.value.split("|");
      state.sort = { columnId, direction };
      renderOverviewSummary();
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
    els.analyticsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (saveAnalyticsFromDialog()) {
        els.analyticsDialog.close();
      }
    });
    els.cancelAnalyticsButton.addEventListener("click", () => els.analyticsDialog.close());

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
    window.addEventListener("resize", () => {
      clearTimeout(bindEvents.resizeTimer);
      bindEvents.resizeTimer = setTimeout(() => {
        if (state.activeView === "overview") {
          renderTrendPreview();
        } else if (state.activeView === "trends") {
          renderTrends();
        }
      }, 120);
    });
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", {
        updateViaCache: "none",
      });
      await registration.update();
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
