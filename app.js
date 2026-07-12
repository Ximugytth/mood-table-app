(function () {
  "use strict";

  const STORAGE = {
    templates: "moodTable.templates",
    activeTemplateId: "moodTable.activeTemplateId",
    records: (templateId) => `moodTable.records.${templateId}`,
    analytics: (templateId) => `moodTable.analytics.${templateId}`,
  };

  const APP_VERSION = "8.7.1";
  const SCORE_MODEL_V2 = "whole-person-v2";
  const SCORE_MODEL_V1 = "legacy-v1";
  const SCORE_MODELS = {
    [SCORE_MODEL_V2]: {
      label: "个人状态模型 v2",
      weights: { valence: 0.40, calm: 0.25, energy: 0.15, rumination: 0.12, comfort: 0.08 },
      missing: "neutral",
    },
    [SCORE_MODEL_V1]: {
      label: "旧版模型 v1",
      weights: { valence: 0.45, calm: 0.30, energy: 0.10, rumination: 0.10, comfort: 0.05 },
      missing: "renormalize",
    },
  };
  const DYNAMICS_THRESHOLDS = {
    dailySwingStable: 18,
    dailySwingHigh: 35,
    jumpNotice: 12,
    jumpHigh: 25,
  };
  const BACKUP_SCHEMA = "mood-table-backup";
  const ROLE_OPTIONS = [
    ["none", "不绘图"],
    ["valence", "愉快（效价）"],
    ["energeticArousal", "能量（精力性唤醒）"],
    ["tenseArousal", "紧张担忧（紧张性唤醒）"],
    ["rumination", "反刍轨道"],
    ["activity", "活动事件"],
    ["physical", "身体状态"],
  ];
  const AXIS_META = {
    valence: { label: "愉快", color: "#287460", soft: "rgba(40,116,96,.16)" },
    energeticArousal: { label: "能量", color: "#bf8522", soft: "rgba(191,133,34,.16)" },
    tenseArousal: { label: "紧张担忧", color: "#d76f5c", soft: "rgba(215,111,92,.16)" },
    physical: { label: "腰痛", color: "#4d78a8", soft: "rgba(77,120,168,.16)" },
    state: { label: "状态指数", color: "#2e6657", soft: "rgba(46,102,87,.16)" },
  };

  const DEFAULT_COLUMNS = [
    "日期",
    "时间",
    "愉快",
    "能量",
    "紧张担忧",
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
    analytics: {
      version: 3,
      columns: {},
      scaleMode: "personal",
      activeScoreModel: SCORE_MODEL_V2,
    },
    trendMode: "day",
    overviewScale: 7,
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
    stateScale7Button: document.getElementById("stateScale7Button"),
    stateScale14Button: document.getElementById("stateScale14Button"),
    stateScale56Button: document.getElementById("stateScale56Button"),
    overviewStateScore: document.getElementById("overviewStateScore"),
    overviewStateDelta: document.getElementById("overviewStateDelta"),
    overviewStateCoverage: document.getElementById("overviewStateCoverage"),
    overviewStateModel: document.getElementById("overviewStateModel"),
    overviewStateCanvas: document.getElementById("overviewStateCanvas"),
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
    trendFortnightButton: document.getElementById("trendFortnightButton"),
    trendCourseButton: document.getElementById("trendCourseButton"),
    personalScaleButton: document.getElementById("personalScaleButton"),
    fixedScaleButton: document.getElementById("fixedScaleButton"),
    trendPreviousButton: document.getElementById("trendPreviousButton"),
    trendDateInput: document.getElementById("trendDateInput"),
    trendNextButton: document.getElementById("trendNextButton"),
    trendTodayButton: document.getElementById("trendTodayButton"),
    trendTimelineControl: document.getElementById("trendTimelineControl"),
    trendTimelineSlider: document.getElementById("trendTimelineSlider"),
    trendSliderStart: document.getElementById("trendSliderStart"),
    trendSliderEnd: document.getElementById("trendSliderEnd"),
    trendPeriodTitle: document.getElementById("trendPeriodTitle"),
    trendCoverage: document.getElementById("trendCoverage"),
    trendNoData: document.getElementById("trendNoData"),
    trendStateScore: document.getElementById("trendStateScore"),
    trendStateDelta: document.getElementById("trendStateDelta"),
    trendStateSummary: document.getElementById("trendStateSummary"),
    dynamicsAverage: document.getElementById("dynamicsAverage"),
    dynamicsDailyRmssd: document.getElementById("dynamicsDailyRmssd"),
    dynamicsMaxSwing: document.getElementById("dynamicsMaxSwing"),
    dynamicsMeanJump: document.getElementById("dynamicsMeanJump"),
    dynamicsPairCount: document.getElementById("dynamicsPairCount"),
    dynamicsRecovery: document.getElementById("dynamicsRecovery"),
    dynamicsRecoveryPath: document.getElementById("dynamicsRecoveryPath"),
    dynamicsStabilityStrip: document.getElementById("dynamicsStabilityStrip"),
    dynamicsDataQuality: document.getElementById("dynamicsDataQuality"),
    dynamicsEventList: document.getElementById("dynamicsEventList"),
    dynamicsPatternList: document.getElementById("dynamicsPatternList"),
    stateProfilePoint: document.getElementById("stateProfilePoint"),
    stateProfileInterpretation: document.getElementById("stateProfileInterpretation"),
    stateProfileConfidence: document.getElementById("stateProfileConfidence"),
    detailedAnalysis: document.getElementById("detailedAnalysis"),
    aiWeeklyButton: document.getElementById("aiWeeklyButton"),
    stateCanvas: document.getElementById("stateCanvas"),
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
    scoreModelSelect: document.getElementById("scoreModelSelect"),
    cancelAnalyticsButton: document.getElementById("cancelAnalyticsButton"),
    aiWeeklyDialog: document.getElementById("aiWeeklyDialog"),
    aiWeeklyForm: document.getElementById("aiWeeklyForm"),
    aiWeeklySummary: document.getElementById("aiWeeklySummary"),
    aiWeeklyOutput: document.getElementById("aiWeeklyOutput"),
    copyAiWeeklyButton: document.getElementById("copyAiWeeklyButton"),
    downloadAiWeeklyButton: document.getElementById("downloadAiWeeklyButton"),
    closeAiWeeklyButton: document.getElementById("closeAiWeeklyButton"),
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

  function addDateDays(value, days) {
    const date = dateFromValue(value);
    date.setDate(date.getDate() + days);
    return formatLocalDate(date);
  }

  function dateDistance(startValue, endValue) {
    const start = dateFromValue(startValue);
    const end = dateFromValue(endValue);
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((endUtc - startUtc) / 86400000);
  }

  function trendSliderBounds() {
    const recordDates = state.records
      .map(inferRecordDate)
      .filter(Boolean)
      .sort();
    const fallbackStart = addDateDays(todayDate(), -90);
    const minimum = recordDates[0] || fallbackStart;
    const maximum = [
      recordDates[recordDates.length - 1] || todayDate(),
      todayDate(),
    ].sort().at(-1);
    return {
      minimum,
      maximum,
      offset: Math.min(
        Math.max(dateDistance(minimum, state.selectedDate), 0),
        Math.max(dateDistance(minimum, maximum), 1)
      ),
      span: Math.max(dateDistance(minimum, maximum), 1),
    };
  }

  function shiftTrendDate(days) {
    const slider = trendSliderBounds();
    const target = addDateDays(state.selectedDate, days);
    state.selectedDate = target < slider.minimum
      ? slider.minimum
      : (target > slider.maximum ? slider.maximum : target);
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
      archivedColumns: [],
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

  function getArchivedColumns(template = getActiveTemplate()) {
    return Array.isArray(template?.archivedColumns) ? template.archivedColumns : [];
  }

  function archiveColumn(template, column) {
    const archived = getArchivedColumns(template);
    if (!archived.some((item) => item.id === column.id)) {
      archived.push({
        id: column.id,
        name: column.name,
        analytics: state.analytics.columns[column.id] || inferAnalyticsForColumn(column),
      });
    }
    template.archivedColumns = archived;
  }

  function restoreArchivedColumn(template, name) {
    const archived = getArchivedColumns(template);
    const index = archived.findIndex((column) => column.name === name);
    if (index < 0) return null;
    const [restored] = archived.splice(index, 1);
    template.archivedColumns = archived;
    if (restored.analytics) {
      state.analytics.columns[restored.id] = restored.analytics;
    }
    return { id: restored.id, name };
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
    const activeScoreModel = Object.hasOwn(SCORE_MODELS, config?.activeScoreModel)
      ? config.activeScoreModel
      : SCORE_MODEL_V2;
    const next = {
      version: 3,
      columns: {},
      scaleMode: config?.scaleMode === "fixed" ? "fixed" : "personal",
      activeScoreModel,
    };
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

  function activeScoreModelId() {
    return Object.hasOwn(SCORE_MODELS, state.analytics.activeScoreModel)
      ? state.analytics.activeScoreModel
      : SCORE_MODEL_V2;
  }

  function activeScoreModel() {
    return SCORE_MODELS[activeScoreModelId()];
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
    if (!state.templates.some((template) => template.id === state.activeTemplateId)) {
      state.activeTemplateId = state.templates[0].id;
      localStorage.setItem(STORAGE.activeTemplateId, state.activeTemplateId);
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
      requestAnimationFrame(() => {
        renderStateOverview();
      });
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
          String(record.values?.[column.id] ?? "").toLowerCase().includes(query)
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
          return String(record.values?.[state.sort.columnId] ?? "");
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
    return String(timeColumn ? record.values?.[timeColumn.id] ?? "" : record.entryTime ?? "");
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
        const value = String(record.values?.[column.id] ?? "").trim();
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
        input.value = record.values?.[column.id] ?? "";
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
    if (view === "trends") {
      els.detailedAnalysis.open = false;
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
    const requestedName = name.trim();
    const restored = template.columns.some((column) => column.name === requestedName)
      ? null
      : restoreArchivedColumn(template, requestedName);
    const column = restored || {
      id: uid("col"),
      name: uniqueColumnName(requestedName, template.columns),
    };
    template.columns.push(column);
    if (!state.analytics.columns[column.id]) {
      state.analytics.columns[column.id] = inferAnalyticsForColumn(column);
    }
    template.updatedAt = nowIso();
    state.records.forEach((record) => {
      if (!(column.id in record.values)) {
        record.values[column.id] = "";
      }
      record.updatedAt = nowIso();
    });
    saveTemplates();
    saveRecords();
    saveAnalytics();
    render();
    showToast(restored ? "已恢复归档列及历史数据" : "已添加列");
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
    if (!column || !confirm(`归档列「${column.name}」？历史数据会保留，以后添加同名列可恢复。`)) {
      return;
    }
    archiveColumn(template, column);
    template.columns = template.columns.filter((item) => item.id !== columnId);
    delete state.analytics.columns[columnId];
    template.updatedAt = nowIso();
    if (state.sort.columnId === columnId) {
      state.sort = { columnId: "", direction: "" };
    }
    saveTemplates();
    saveRecords();
    saveAnalytics();
    render();
    showToast("列已归档，历史数据仍保留");
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
    const oldNames = new Set(oldColumns.map((column) => column.name));
    const potentialRenames = columnNames.length === oldColumns.length
      ? columnNames
          .map((columnName, index) => (
            oldColumns[index]?.name !== columnName && !oldNames.has(columnName)
              ? `${oldColumns[index]?.name || "新列"} → ${columnName}`
              : ""
          ))
          .filter(Boolean)
      : [];
    if (
      state.records.length > 0 &&
      potentialRenames.length > 0 &&
      !confirm(`以下列将按位置更名并继续关联历史数据：\n${potentialRenames.join("\n")}\n\n继续吗？`)
    ) {
      return false;
    }
    const assignedOldIds = new Set();
    const nextColumns = columnNames.map((columnName) => {
      const exact = oldColumns.find(
        (column) => column.name === columnName && !assignedOldIds.has(column.id)
      );
      if (exact) {
        assignedOldIds.add(exact.id);
        return { id: exact.id, name: columnName };
      }
      const restored = restoreArchivedColumn(template, columnName);
      if (restored) {
        return restored;
      }
      return null;
    });
    const sameColumnCount = columnNames.length === oldColumns.length;
    nextColumns.forEach((column, index) => {
      if (column) {
        return;
      }
      const positional = oldColumns[index];
      if (sameColumnCount && positional && !assignedOldIds.has(positional.id)) {
        assignedOldIds.add(positional.id);
        nextColumns[index] = { id: positional.id, name: columnNames[index] };
      } else {
        nextColumns[index] = { id: uid("col"), name: columnNames[index] };
      }
    });
    oldColumns
      .filter((column) => !assignedOldIds.has(column.id))
      .forEach((column) => archiveColumn(template, column));
    state.records.forEach((record) => {
      nextColumns.forEach((column) => {
        if (!(column.id in record.values)) {
          record.values[column.id] = "";
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
            const value = record.values?.[column.id];
            return String(value ?? "").trim() ? value : inferRecordDate(record, template);
          }
          if (column.id === timeColumn?.id) {
            const value = record.values?.[column.id];
            return String(value ?? "").trim() ? value : recordTime(record, template);
          }
          return record.values?.[column.id] ?? "";
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

    if (inQuotes) {
      throw new Error("CSV 中存在未闭合的引号");
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
        const headerWidth = rows[0].length;
        if (rows.slice(1).some((row) => row.length > headerWidth)) {
          throw new Error("CSV 数据列数超过表头列数");
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

  function findImportColumn(header, template) {
    const exact = template.columns.find((column) => column.name === header);
    if (exact) return exact;
    const inferredRole = inferAnalyticsForColumn({ name: header }).role;
    if (inferredRole === "none") return null;
    const compatible = template.columns.filter((column) => {
      const setting = state.analytics.columns[column.id] || inferAnalyticsForColumn(column);
      return setting.role === inferredRole;
    });
    return compatible.length === 1 ? compatible[0] : null;
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
    const usedColumnIds = new Set();
    let columns;

    if (mode === "replace") {
      columns = headers.map((header) => {
        let existing = findImportColumn(header, template);
        if (existing && usedColumnIds.has(existing.id)) existing = null;
        const column = existing || { id: uid("col"), name: header };
        usedColumnIds.add(column.id);
        return column;
      });
      template.columns = columns;
    } else {
      columns = headers.map((header) => {
        let existing = findImportColumn(header, template);
        if (existing && usedColumnIds.has(existing.id)) existing = null;
        if (!existing) {
          existing = { id: uid("col"), name: uniqueColumnName(header, template.columns) };
          template.columns.push(existing);
        }
        usedColumnIds.add(existing.id);
        return existing;
      });
    }

    const importedRecords = dataRows.map((row) => {
      const values = {};
      template.columns.forEach((column) => {
        values[column.id] = "";
      });
      columns.forEach((column, index) => {
        values[column.id] = row[index] ?? "";
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
    els.scoreModelSelect.value = state.analytics.activeScoreModel || SCORE_MODEL_V2;
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
    const next = {
      version: 3,
      columns: { ...state.analytics.columns },
      scaleMode: state.analytics.scaleMode,
      activeScoreModel: Object.hasOwn(SCORE_MODELS, els.scoreModelSelect.value)
        ? els.scoreModelSelect.value
        : SCORE_MODEL_V2,
    };
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
      const archivedColumns = Array.isArray(template.archivedColumns) ? template.archivedColumns : [];
      if (!archivedColumns.every((column) => column?.id && typeof column.name === "string")) {
        return "归档列结构不完整";
      }
      const columnIds = [...template.columns, ...archivedColumns].map((column) => column.id);
      if (new Set(columnIds).size !== columnIds.length) return "模板中有重复列";
      const records = backup.recordsByTemplate?.[template.id];
      if (!Array.isArray(records)) return "记录结构不完整";
      if (!records.every((record) =>
        record?.id &&
        record.values &&
        typeof record.values === "object" &&
        !Array.isArray(record.values)
      )) {
        return "记录内容结构不完整";
      }
      if (new Set(records.map((record) => record.id)).size !== records.length) return "记录中有重复 ID";
      const analytics = backup.analyticsByTemplate?.[template.id];
      if (analytics && (
        typeof analytics !== "object" ||
        !analytics.columns ||
        typeof analytics.columns !== "object" ||
        Array.isArray(analytics.columns)
      )) {
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

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function ruminationValue(record) {
    const column = getColumnByRole("rumination");
    if (!column) return null;
    const setting = getAnalyticsSetting(column.id);
    const levels = setting.levels || ["无", "轻微", "有", "非常强"];
    const raw = String(record.values?.[column.id] ?? "").trim();
    if (!raw) return null;
    const index = levels.indexOf(raw);
    return index >= 0 ? index : null;
  }

  function stateValue(record) {
    const valence = numericValue(record, "valence");
    const tension = numericValue(record, "tenseArousal");
    if (valence === null || tension === null) {
      return null;
    }
    const energy = numericValue(record, "energeticArousal");
    const rumination = ruminationValue(record);
    const pain = numericValue(record, "physical");
    const model = activeScoreModel();
    const parts = [
      { key: "valence", weight: model.weights.valence, value: clamp(((valence + 5) / 10) * 100, 0, 100) },
      { key: "calm", weight: model.weights.calm, value: clamp(((10 - tension) / 10) * 100, 0, 100) },
      {
        key: "energy",
        weight: model.weights.energy,
        value: energy === null ? null : clamp(((energy + 5) / 10) * 100, 0, 100),
      },
      {
        key: "rumination",
        weight: model.weights.rumination,
        value: rumination === null ? null : clamp(((3 - rumination) / 3) * 100, 0, 100),
      },
      {
        key: "comfort",
        weight: model.weights.comfort,
        value: pain === null ? null : clamp(((10 - pain) / 10) * 100, 0, 100),
      },
    ];
    const available = parts.filter((part) => part.value !== null);
    const usedWeight = available.reduce((sum, part) => sum + part.weight, 0);
    if (usedWeight <= 0) return null;
    const missing = parts.filter((part) => part.value === null);
    const missingWeight = missing.reduce((sum, part) => sum + part.weight, 0);
    const score = model.missing === "neutral"
      ? parts.reduce(
          (sum, part) => sum + (part.value === null ? 50 : part.value) * part.weight,
          0
        )
      : available.reduce(
          (sum, part) => sum + part.value * part.weight,
          0
        ) / usedWeight;
    return {
      score,
      coverage: usedWeight,
      uncertainty: model.missing === "neutral" ? missingWeight * 50 : 0,
      imputedWeight: model.missing === "neutral" ? missingWeight : 0,
      imputedKeys: model.missing === "neutral" ? missing.map((part) => part.key) : [],
      modelId: activeScoreModelId(),
      parts,
    };
  }

  function timeBucket(record) {
    const match = recordTime(record).match(/^(\d{1,2}):(\d{2})/);
    if (!match) return "unknown";
    const hours = Number(match[1]);
    const minute = Number(match[2]);
    if (hours > 23 || minute > 59) return "unknown";
    const minutes = hours * 60 + minute;
    if (minutes >= 5 * 60 && minutes < 12 * 60) return "morning";
    if (minutes >= 12 * 60 && minutes < 14 * 60) return "noon";
    if (minutes >= 14 * 60 && minutes < 18 * 60) return "afternoon";
    return "evening";
  }

  function meanFinite(values) {
    const finite = values.filter((value) => Number.isFinite(value));
    return finite.length
      ? finite.reduce((sum, value) => sum + value, 0) / finite.length
      : null;
  }

  function dailyState(date) {
    const buckets = new Map();
    const untimedValues = [];
    let invalidTimeCount = 0;
    state.records
      .filter((record) => inferRecordDate(record) === date)
      .forEach((record) => {
        const value = stateValue(record);
        if (!value) return;
        const bucket = timeBucket(record);
        if (bucket === "unknown") {
          invalidTimeCount += 1;
          untimedValues.push(value);
          return;
        }
        if (!buckets.has(bucket)) buckets.set(bucket, []);
        buckets.get(bucket).push(value);
      });
    const bucketScores = [];
    const bucketCoverage = [];
    const bucketUncertainty = [];
    const bucketImputedWeight = [];
    const groups = buckets.size > 0
      ? [...buckets.values()]
      : (untimedValues.length ? [untimedValues] : []);
    groups.forEach((values) => {
      bucketScores.push(meanFinite(values.map((value) => value.score)));
      bucketCoverage.push(meanFinite(values.map((value) => value.coverage)));
      bucketUncertainty.push(meanFinite(values.map((value) => value.uncertainty)));
      bucketImputedWeight.push(meanFinite(values.map((value) => value.imputedWeight)));
    });
    const score = meanFinite(bucketScores);
    if (score === null) return null;
    return {
      date,
      score,
      coverage: meanFinite(bucketCoverage) || 0,
      uncertainty: meanFinite(bucketUncertainty) || 0,
      imputedWeight: meanFinite(bucketImputedWeight) || 0,
      periods: buckets.size,
      invalidTimeCount,
      usedUntimedFallback: buckets.size === 0 && untimedValues.length > 0,
    };
  }

  function stateWindow(endDate, days) {
    const dates = dateValues(endDate, days);
    return dates.map((date) => dailyState(date));
  }

  function stateWindowSummary(endDate, days) {
    const daily = stateWindow(endDate, days);
    const valid = daily.filter(Boolean);
    const score = meanFinite(valid.map((item) => item.score));
    let earlyDays;
    let lateDays;
    if (days >= 56) {
      earlyDays = daily.slice(0, 14);
      lateDays = daily.slice(-14);
    } else if (days >= 14) {
      earlyDays = daily.slice(0, 7);
      lateDays = daily.slice(-7);
    } else {
      earlyDays = daily.slice(0, 3);
      lateDays = daily.slice(-3);
    }
    const early = meanFinite(earlyDays.filter(Boolean).map((item) => item.score));
    const late = meanFinite(lateDays.filter(Boolean).map((item) => item.score));
    return {
      days,
      daily,
      valid,
      score,
      delta: early === null || late === null ? null : late - early,
      coverage: meanFinite(valid.map((item) => item.coverage)),
      uncertainty: meanFinite(valid.map((item) => item.uncertainty)),
      imputedWeight: meanFinite(valid.map((item) => item.imputedWeight)),
    };
  }

  function standardDeviation(values) {
    const finite = values.filter(Number.isFinite);
    if (finite.length < 2) return 0;
    const mean = meanFinite(finite);
    const variance = meanFinite(finite.map((value) => (value - mean) ** 2));
    return Math.sqrt(variance);
  }

  function dateTimeMinutes(record) {
    const date = inferRecordDate(record);
    const match = recordTime(record).match(/^(\d{1,2}):(\d{2})/);
    const base = Date.UTC(
      ...date.split("-").map((part, index) => index === 1 ? Number(part) - 1 : Number(part))
    ) / 60000;
    return base + (match ? Number(match[1]) * 60 + Number(match[2]) : 23 * 60 + 59);
  }

  function rangeRecords(dates) {
    const dateSet = new Set(dates);
    return state.records
      .filter((record) => dateSet.has(inferRecordDate(record)))
      .map((record, index) => ({ record, index }))
      .sort((a, b) =>
        dateTimeMinutes(a.record) - dateTimeMinutes(b.record) || a.index - b.index
      );
  }

  function rangeStateTimeline(dates) {
    return rangeRecords(dates)
      .map((item) => ({
        record: item.record,
        date: inferRecordDate(item.record),
        time: recordTime(item.record) || "--:--",
        minutes: dateTimeMinutes(item.record),
        state: stateValue(item.record),
      }))
      .filter((item) => item.state && timeBucket(item.record) !== "unknown");
  }

  function rolePercent(record, role) {
    const column = getColumnByRole(role);
    const value = numericValue(record, role);
    if (!column || value === null) return null;
    const setting = getAnalyticsSetting(column.id);
    const min = Number.isFinite(Number(setting.min)) ? Number(setting.min) : 0;
    const max = Number.isFinite(Number(setting.max)) ? Number(setting.max) : 10;
    if (max <= min) return null;
    return clamp(((value - min) / (max - min)) * 100, 0, 100);
  }

  function activityText(record) {
    const column = getColumnByRole("activity");
    return column ? String(record.values?.[column.id] ?? "").trim() : "";
  }

  function ruminationText(record) {
    const column = getColumnByRole("rumination");
    return column ? String(record.values?.[column.id] ?? "").trim() : "";
  }

  function longestMissingRun(daily) {
    let current = 0;
    let longest = 0;
    daily.forEach((item) => {
      if (item) {
        current = 0;
        return;
      }
      current += 1;
      longest = Math.max(longest, current);
    });
    return longest;
  }

  function daySwingMap(timeline) {
    const byDate = new Map();
    timeline.forEach((item) => {
      if (!byDate.has(item.date)) byDate.set(item.date, []);
      byDate.get(item.date).push(item.state.score);
    });
    const swings = [];
    byDate.forEach((scores, date) => {
      if (scores.length < 2) return;
      const low = scores.reduce(
        (best, score, index) => score < best.score ? { score, index } : best,
        { score: scores[0], index: 0 }
      );
      const high = scores.reduce(
        (best, score, index) => score > best.score ? { score, index } : best,
        { score: scores[0], index: 0 }
      );
      swings.push({
        date,
        swing: Math.max(...scores) - Math.min(...scores),
        min: Math.min(...scores),
        max: Math.max(...scores),
        count: scores.length,
        lowIndex: low.index,
        highIndex: high.index,
      });
    });
    return swings;
  }

  function adjacentJumps(timeline) {
    const jumps = [];
    for (let index = 1; index < timeline.length; index += 1) {
      const previous = timeline[index - 1];
      const current = timeline[index];
      const gapHours = (current.minutes - previous.minutes) / 60;
      if (current.date !== previous.date || gapHours < 0 || gapHours > 12) continue;
      const jump = Math.abs(current.state.score - previous.state.score);
      jumps.push({
        from: previous,
        to: current,
        jump,
        gapHours,
      });
    }
    return jumps;
  }

  function recoverySummary(timeline, average, deviation) {
    if (timeline.length < 2 || !Number.isFinite(average)) return null;
    const lowThreshold = Math.min(45, average - Math.max(deviation * 0.5, 8));
    const target = Math.max(45, average - 5);
    const candidates = timeline.filter((item) => item.state.score <= lowThreshold);
    if (!candidates.length) return null;
    const low = candidates.reduce((min, item) =>
      item.state.score < min.state.score ? item : min
    );
    const startIndex = timeline.indexOf(low);
    const recovered = timeline
      .slice(startIndex + 1)
      .find((item) => item.state.score >= target);
    if (!recovered) {
      return {
        text: `${low.date.slice(5)} ${low.time} 低点 ${formatStateScore(low.state.score)}，窗口内未首次观测到回到 ${formatStateScore(target)}`,
        hours: null,
        low,
        recovered: null,
        target,
        path: timeline.slice(startIndex, Math.min(startIndex + 6, timeline.length)),
      };
    }
    const hours = (recovered.minutes - low.minutes) / 60;
    const timeText = hours < 24
      ? `${hours.toFixed(1)} 小时`
      : `${(hours / 24).toFixed(1)} 天`;
    return {
      text: `${low.date.slice(5)} ${low.time} 后 ${timeText} 首次观测到回到 ${formatStateScore(target)}${hours > 12 ? " · 采样间隔较大" : ""}`,
      hours,
      lowConfidence: hours > 12,
      low,
      recovered,
      target,
      path: timeline.slice(startIndex, timeline.indexOf(recovered) + 1),
    };
  }

  function dailyStateRange(date) {
    let untimedIndex = 0;
    const points = rangeRecords([date])
      .map((item) => {
        const rawTime = recordTime(item.record).trim();
        const untimed = timeBucket(item.record) === "unknown";
        if (untimed) untimedIndex += 1;
        return {
          record: item.record,
          date: inferRecordDate(item.record),
          time: untimed ? `记录 ${untimedIndex}` : rawTime,
          minutes: dateTimeMinutes(item.record),
          state: stateValue(item.record),
          untimed,
        };
      })
      .filter((item) => item.state);
    if (!points.length) return null;
    const scores = points.map((item) => item.state.score);
    return {
      date,
      mean: meanFinite(scores),
      min: Math.min(...scores),
      max: Math.max(...scores),
      count: scores.length,
      untimedCount: points.filter((item) => item.untimed).length,
      points,
    };
  }

  function dynamicsSeverity(value, stableThreshold, highThreshold) {
    if (!Number.isFinite(value)) return "missing";
    if (value < stableThreshold) return "stable";
    if (value <= highThreshold) return "medium";
    return "high";
  }

  function dailyDynamics(dates, daily, swings) {
    const swingByDate = new Map(swings.map((item) => [item.date, item]));
    return dates.map((date, index) => {
      const stateDay = daily[index];
      const range = dailyStateRange(date);
      const swing = swingByDate.get(date);
      const swingValue = swing?.swing ?? (range && range.count > 1 ? range.max - range.min : null);
      return {
        date,
        score: stateDay?.score ?? null,
        range,
        swing: swingValue,
        count: range?.count ?? 0,
        severity: dynamicsSeverity(
          swingValue,
          DYNAMICS_THRESHOLDS.dailySwingStable,
          DYNAMICS_THRESHOLDS.dailySwingHigh
        ),
      };
    });
  }

  function jumpMarkers(jumps) {
    return jumps
      .filter((item) => item.jump >= DYNAMICS_THRESHOLDS.jumpNotice)
      .map((item) => ({
        date: item.to.date,
        fromDate: item.from.date,
        fromTime: item.from.time,
        toTime: item.to.time,
        value: item.to.state.score,
        jump: item.jump,
        severity: item.jump > DYNAMICS_THRESHOLDS.jumpHigh ? "high" : "medium",
      }));
  }

  function dimensionPatterns(timeline) {
    const counts = new Map();
    timeline.forEach((item) => {
      const valence = rolePercent(item.record, "valence");
      const energy = rolePercent(item.record, "energeticArousal");
      const tension = rolePercent(item.record, "tenseArousal");
      if (valence === null || energy === null || tension === null) return;
      const parts = [];
      parts.push(valence <= 35 ? "低愉快" : (valence >= 65 ? "高愉快" : "中性愉快"));
      parts.push(energy <= 35 ? "低能量" : (energy >= 65 ? "高能量" : "中等能量"));
      parts.push(tension >= 65 ? "高紧张担忧" : (tension <= 35 ? "低紧张担忧" : "中等紧张担忧"));
      const key = parts.join(" + ");
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
      .slice(0, 4)
      .map(([label, count]) => ({ label, count }));
  }

  function dynamicEventList(timeline, jumps, average, deviation) {
    const events = [];
    const lowThreshold = Number.isFinite(average)
      ? average - Math.max(deviation * 0.5, 8)
      : 45;
    [...timeline]
      .sort((a, b) => a.state.score - b.state.score)
      .slice(0, 3)
      .forEach((item) => {
        const activity = activityText(item.record);
        const rumination = ruminationText(item.record);
        if (item.state.score > lowThreshold && !activity && !rumination) return;
        events.push({
          sort: item.minutes,
          text: `${item.date.slice(5)} ${item.time} · 状态 ${formatStateScore(item.state.score)}${
            activity ? ` · ${activity}` : ""
          }${rumination ? ` · 反刍：${rumination}` : ""}`,
        });
      });
    jumps
      .filter((item) => item.jump >= 20)
      .sort((a, b) => b.jump - a.jump)
      .slice(0, 3)
      .forEach((item) => {
        events.push({
          sort: item.to.minutes,
          text: `${item.from.date.slice(5)} ${item.from.time} → ${item.to.date.slice(5)} ${item.to.time} · 跳变 ${item.jump.toFixed(1)}`,
        });
      });
    return events
      .sort((a, b) => a.sort - b.sort)
      .map((item) => item.text)
      .slice(0, 6);
  }

  function rootMeanSquare(values) {
    const finite = values.filter(Number.isFinite);
    if (!finite.length) return null;
    return Math.sqrt(meanFinite(finite.map((value) => value ** 2)));
  }

  function consecutiveDailyChanges(daily) {
    const changes = [];
    for (let index = 1; index < daily.length; index += 1) {
      const previous = daily[index - 1];
      const current = daily[index];
      if (!previous || !current) continue;
      changes.push(current.score - previous.score);
    }
    return changes;
  }

  function dynamicsConfidence(validDays, totalDays, pairCount, timeBucketCount) {
    const validRatio = totalDays > 0 ? validDays / totalDays : 0;
    if (validRatio >= 0.7 && pairCount >= 4 && timeBucketCount >= 3) return "足够";
    if (validRatio >= 0.5 && pairCount >= 2 && timeBucketCount >= 2) return "有限";
    return "不足";
  }

  function profileInterpretation(average, dailyRmssd, confidence) {
    if (!Number.isFinite(average) || !Number.isFinite(dailyRmssd) || confidence === "不足") {
      return "数据不足，暂不划分状态组合。";
    }
    const level = average >= 50 ? "high" : "low";
    const volatile = dailyRmssd >= DYNAMICS_THRESHOLDS.jumpNotice;
    if (level === "high" && !volatile) return "状态较好且平稳。";
    if (level === "high" && volatile) return "总体状态尚好，但存在明显起伏。";
    if (level === "low" && !volatile) return "状态持续偏低，建议关注低状态的延续。";
    return "低点与跳变并存，建议结合活动和反刍记录查看。";
  }

  function computeDynamics(dates) {
    const daily = dates.map((date) => dailyState(date));
    const validDaily = daily.filter(Boolean);
    const timeline = rangeStateTimeline(dates);
    const scores = timeline.map((item) => item.state.score);
    const average = meanFinite(validDaily.map((item) => item.score));
    const deviation = standardDeviation(scores);
    const swings = daySwingMap(timeline);
    const maxSwing = swings.length
      ? swings.reduce((max, item) => item.swing > max.swing ? item : max)
      : null;
    const jumps = adjacentJumps(timeline);
    const meanJump = rootMeanSquare(jumps.map((item) => item.jump));
    const dailyChanges = consecutiveDailyChanges(daily);
    const dailyRmssd = rootMeanSquare(dailyChanges);
    const buckets = new Set(timeline.map((item) => timeBucket(item.record)));
    const recordDays = new Set(rangeRecords(dates).map((item) => inferRecordDate(item.record))).size;
    const invalidTimeCount = rangeRecords(dates).filter((item) => {
      return stateValue(item.record) && timeBucket(item.record) === "unknown";
    }).length;
    const fallbackDays = validDaily.filter((item) => item.usedUntimedFallback).length;
    const imputedWeight = meanFinite(validDaily.map((item) => item.imputedWeight)) || 0;
    const confidence = dynamicsConfidence(validDaily.length, dates.length, dailyChanges.length, buckets.size);
    const quality = [];
    quality.push(`${validDaily.length}/${dates.length} 个有效状态日 · ${dailyChanges.length} 组连续日配对`);
    quality.push(`最长连续缺失 ${longestMissingRun(daily)} 天`);
    quality.push(`覆盖 ${buckets.size}/4 个常用时段`);
    if (activeScoreModelId() === SCORE_MODEL_V2) {
      quality.push(`平均指标覆盖 ${Math.round((1 - imputedWeight) * 100)}% · 中性补位 ${Math.round(imputedWeight * 100)}%`);
    }
    if (fallbackDays > 0) {
      quality.push(`${fallbackDays} 天没有具体时间，状态日均按当天有效记录均值恢复；不计算相邻跳变和恢复时间`);
    }
    if (invalidTimeCount > 0 && fallbackDays === 0) {
      quality.push(`${invalidTimeCount} 条无具体时间记录未混入已有标准时段的日均`);
    }
    if (recordDays > validDaily.length) quality.push(`${recordDays - validDaily.length} 天有记录但缺少核心分数`);
    quality.push(`结论置信度：${confidence}`);
    return {
      average,
      dailyRmssd,
      dailyPairCount: dailyChanges.length,
      confidence,
      interpretation: profileInterpretation(average, dailyRmssd, confidence),
      imputedWeight,
      invalidTimeCount,
      maxSwing,
      meanJump,
      recovery: recoverySummary(timeline, average, deviation),
      events: dynamicEventList(timeline, jumps, average, deviation),
      patterns: dimensionPatterns(timeline),
      daily: dailyDynamics(dates, daily, swings),
      jumps: jumpMarkers(jumps),
      quality,
    };
  }

  function renderList(element, items, emptyText) {
    element.innerHTML = "";
    const list = items.length ? items : [emptyText];
    list.forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      element.append(item);
    });
  }

  function renderStabilityStrip(dynamics) {
    els.dynamicsStabilityStrip.innerHTML = "";
    dynamics.daily.forEach((day) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `stability-day ${day.severity}`;
      const label = day.date.slice(5);
      item.innerHTML = `<span>${label}</span><strong>${
        Number.isFinite(day.swing) ? day.swing.toFixed(0) : "-"
      }</strong>`;
      const title = day.severity === "missing"
        ? `${day.date} 数据不足`
        : `${day.date} · 日内波动 ${day.swing.toFixed(1)} · ${day.count} 条有效记录${
            day.range?.untimedCount ? ` · ${day.range.untimedCount} 条无具体时间` : ""
          }`;
      item.title = title;
      item.setAttribute("aria-label", title);
      item.addEventListener("click", () => showToast(title));
      els.dynamicsStabilityStrip.append(item);
    });
  }

  function renderRecoveryPath(recovery) {
    els.dynamicsRecoveryPath.innerHTML = "";
    if (!recovery?.path?.length) {
      const empty = document.createElement("span");
      empty.className = "recovery-empty";
      empty.textContent = "暂无可绘制恢复路径";
      els.dynamicsRecoveryPath.append(empty);
      return;
    }
    const path = recovery.path.slice(0, 8);
    path.forEach((point, index) => {
      const node = document.createElement("span");
      node.className = "recovery-point";
      const isLow = point === recovery.low;
      const isRecovered = point === recovery.recovered;
      node.classList.toggle("low", isLow);
      node.classList.toggle("recovered", isRecovered);
      node.style.setProperty("--score", String(clamp(point.state.score, 0, 100)));
      node.innerHTML = `<i></i><small>${point.date.slice(5)} ${point.time}<br>${formatStateScore(point.state.score)}</small>`;
      node.title = `${point.date} ${point.time} · 状态 ${formatStateScore(point.state.score)}`;
      els.dynamicsRecoveryPath.append(node);
      if (index < path.length - 1) {
        const line = document.createElement("span");
        line.className = "recovery-line";
        els.dynamicsRecoveryPath.append(line);
      }
    });
  }

  function renderDynamics(dates) {
    const dynamics = computeDynamics(dates);
    els.dynamicsAverage.textContent = formatStateScore(dynamics.average);
    els.dynamicsDailyRmssd.textContent = Number.isFinite(dynamics.dailyRmssd)
      ? dynamics.dailyRmssd.toFixed(1)
      : "-";
    els.dynamicsMaxSwing.textContent = dynamics.maxSwing
      ? `${dynamics.maxSwing.swing.toFixed(1)} · ${dynamics.maxSwing.date.slice(5)}`
      : "-";
    els.dynamicsMeanJump.textContent = Number.isFinite(dynamics.meanJump)
      ? dynamics.meanJump.toFixed(1)
      : "-";
    els.dynamicsPairCount.textContent = String(dynamics.dailyPairCount);
    els.dynamicsRecovery.textContent = dynamics.recovery?.text || "当前窗口未形成可判断低点";
    const canPlot = Number.isFinite(dynamics.average) && Number.isFinite(dynamics.dailyRmssd);
    els.stateProfilePoint.classList.toggle("hidden", !canPlot);
    if (canPlot) {
      els.stateProfilePoint.style.left = `${clamp(dynamics.average, 3, 97)}%`;
      els.stateProfilePoint.style.bottom = `${clamp((dynamics.dailyRmssd / 30) * 100, 3, 97)}%`;
      els.stateProfilePoint.title = `平均状态 ${dynamics.average.toFixed(1)} · 日间 RMSSD ${dynamics.dailyRmssd.toFixed(1)}`;
    }
    els.stateProfileInterpretation.textContent = dynamics.interpretation;
    els.stateProfileConfidence.textContent = `结论置信度：${dynamics.confidence} · RMSSD 仅连接连续自然日`;
    renderStabilityStrip(dynamics);
    renderRecoveryPath(dynamics.recovery);
    renderList(els.dynamicsDataQuality, dynamics.quality, "暂无足够数据");
    renderList(els.dynamicsEventList, dynamics.events, "暂无明显低点或大幅跳变");
    renderList(
      els.dynamicsPatternList,
      dynamics.patterns.map((item) => `${item.label} · ${item.count} 次`),
      "暂无足够三轴数据"
    );
  }

  function rollingStateValues(daily, windowDays = 14) {
    return daily.map((item, index) => {
      const values = daily
        .slice(Math.max(0, index - windowDays + 1), index + 1)
        .filter(Boolean)
        .map((entry) => entry.score);
      return values.length >= 3 ? meanFinite(values) : null;
    });
  }

  function momentaryStateTimeline() {
    return dailyTimeline()
      .map((item) => ({
        ...item,
        state: stateValue(item.record),
        untimed: timeBucket(item.record) === "unknown",
      }));
  }

  function destroyChart(key) {
    if (state.charts[key]) {
      state.charts[key].destroy();
      delete state.charts[key];
    }
  }

  function recentPersonalValues(role) {
    const dates = dateValues(state.selectedDate, 14);
    if (role === "state") {
      return stateWindow(state.selectedDate, 14)
        .filter(Boolean)
        .map((item) => ({ date: item.date, value: item.score }));
    }
    return state.records
      .filter((record) => dates.includes(inferRecordDate(record)))
      .map((record) => ({
        date: inferRecordDate(record),
        value: numericValue(record, role),
      }))
      .filter((item) => item.value !== null);
  }

  function chartDomain(setting, values, role) {
    const fixedMin = Number.isFinite(Number(setting.min)) ? Number(setting.min) : 0;
    const fixedMax = Number.isFinite(Number(setting.max)) ? Number(setting.max) : 10;
    const displayed = values.filter(Number.isFinite);
    const includeDisplayedOutliers = (domain) => {
      if (!displayed.length) return domain;
      const min = Math.min(domain.min, ...displayed);
      const max = Math.max(domain.max, ...displayed);
      if (min === domain.min && max === domain.max) return domain;
      const padding = Math.max((max - min) * 0.04, 0.1);
      return {
        min: min < domain.min ? min - padding : domain.min,
        max: max > domain.max ? max + padding : domain.max,
      };
    };
    if (state.analytics.scaleMode === "fixed") {
      return { min: fixedMin, max: fixedMax };
    }
    const personal = recentPersonalValues(role);
    const validDays = new Set(personal.map((item) => item.date)).size;
    const reference = personal.map((item) => item.value).filter(Number.isFinite);
    if (reference.length < 4 || validDays < 3) {
      return includeDisplayedOutliers({ min: fixedMin, max: fixedMax });
    }
    const observedMin = Math.min(...reference);
    const observedMax = Math.max(...reference);
    const fixedSpan = Math.max(fixedMax - fixedMin, 1);
    const observedSpan = Math.max(observedMax - observedMin, fixedSpan * 0.25);
    const targetSpan = Math.min(observedSpan * 1.2, fixedSpan);
    const center = (observedMin + observedMax) / 2;
    let min = center - targetSpan / 2;
    let max = center + targetSpan / 2;
    if (min < fixedMin) {
      max += fixedMin - min;
      min = fixedMin;
    }
    if (max > fixedMax) {
      min -= max - fixedMax;
      max = fixedMax;
    }
    return includeDisplayedOutliers({
      min: Math.max(min, fixedMin),
      max: Math.min(max, fixedMax),
    });
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

  function drawNativeChart(
    canvas,
    labels,
    values,
    role,
    setting,
    compact,
    ranges = null,
    inspection = null
  ) {
    const { context, width, height } = prepareCanvas(canvas);
    const meta = AXIS_META[role];
    const domainValues = ranges
      ? ranges.flatMap((item) => item ? [item.min, item.max, item.mean] : [])
      : values;
    const domain = chartDomain(setting, domainValues, role);
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
      const maxLabels = width < 480 ? 5 : 7;
      const labelStep = Math.max(1, Math.ceil((labels.length - 1) / Math.max(maxLabels - 1, 1)));
      labels.forEach((label, index) => {
        if (index % labelStep !== 0 && index !== labels.length - 1) return;
        context.fillText(String(label), xAt(index), height - 9);
      });
    }

    context.save();
    context.beginPath();
    context.rect(padding.left, padding.top, chartWidth, chartHeight);
    context.clip();

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

    const plottedValues = values;
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
    if (!compact && inspection?.markers?.length) {
      inspection.markers.forEach((marker) => {
        if (!Number.isFinite(marker.index) || marker.index < 0 || marker.index >= labels.length) return;
        const value = Number.isFinite(marker.value)
          ? marker.value
          : plottedValues[marker.index];
        if (!Number.isFinite(value)) return;
        const x = xAt(marker.index);
        const y = yAt(value);
        context.save();
        context.fillStyle = marker.severity === "high" ? "#d94b3d" : "#d89424";
        context.strokeStyle = "#ffffff";
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(x, y - 9);
        context.lineTo(x + 6, y + 4);
        context.lineTo(x - 6, y + 4);
        context.closePath();
        context.fill();
        context.stroke();
        context.restore();
      });
    }
    context.restore();
    updateChartInspector(canvas, {
      compact,
      labels: inspection?.labels || labels,
      values: plottedValues,
      ranges,
      role,
      domain,
      padding,
      width,
      height,
      valueLabel: inspection?.valueLabel || AXIS_META[role].label,
      secondaryValues: inspection?.secondaryValues || null,
      secondaryLabel: inspection?.secondaryLabel || "",
      notes: inspection?.notes || null,
    });
  }

  function formatInspectorValue(value) {
    return Number.isFinite(value) ? Number(value.toFixed(1)).toString() : "-";
  }

  function ensureChartInspector(canvas) {
    if (canvas._chartInspector) return canvas._chartInspector;
    const frame = canvas.parentElement;
    const root = document.createElement("div");
    root.className = "chart-inspector";
    root.setAttribute("aria-live", "polite");
    const line = document.createElement("span");
    line.className = "chart-inspector-line";
    const dot = document.createElement("span");
    dot.className = "chart-inspector-dot";
    const tooltip = document.createElement("span");
    tooltip.className = "chart-inspector-tooltip";
    const label = document.createElement("strong");
    const value = document.createElement("span");
    const secondary = document.createElement("small");
    tooltip.append(label, value, secondary);
    root.append(line, dot, tooltip);
    frame.append(root);
    const ui = { root, line, dot, tooltip, label, value, secondary };
    canvas._chartInspector = ui;

    const inspectPointer = (event) => {
      const model = canvas._chartInspectionModel;
      if (!model?.labels.length) return;
      const rect = canvas.getBoundingClientRect();
      const chartWidth = Math.max(model.width - model.padding.left - model.padding.right, 1);
      const localX = event.clientX - rect.left;
      const ratio = Math.min(
        Math.max((localX - model.padding.left) / chartWidth, 0),
        1
      );
      const index = model.labels.length <= 1
        ? 0
        : Math.round(ratio * (model.labels.length - 1));
      showChartInspection(canvas, index);
    };
    canvas.addEventListener("pointerdown", inspectPointer);
    canvas.addEventListener("pointermove", (event) => {
      if (event.pointerType === "mouse" || event.buttons > 0) {
        inspectPointer(event);
      }
    });
    canvas.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") root.classList.remove("visible");
    });
    canvas.addEventListener("focus", () => {
      const model = canvas._chartInspectionModel;
      if (!model?.labels.length) return;
      const fallback = model.values.reduce(
        (latest, item, index) => Number.isFinite(item) ? index : latest,
        model.labels.length - 1
      );
      showChartInspection(canvas, model.lastIndex ?? Math.max(fallback, 0));
    });
    canvas.addEventListener("blur", () => root.classList.remove("visible"));
    canvas.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const model = canvas._chartInspectionModel;
      if (!model?.labels.length) return;
      event.preventDefault();
      let index = model.lastIndex ?? model.labels.length - 1;
      if (event.key === "ArrowLeft") index -= 1;
      if (event.key === "ArrowRight") index += 1;
      if (event.key === "Home") index = 0;
      if (event.key === "End") index = model.labels.length - 1;
      showChartInspection(canvas, Math.min(Math.max(index, 0), model.labels.length - 1));
    });
    return ui;
  }

  function showChartInspection(canvas, index) {
    const model = canvas._chartInspectionModel;
    if (!model || index < 0 || index >= model.labels.length) return;
    const ui = ensureChartInspector(canvas);
    document.querySelectorAll(".chart-inspector.visible").forEach((inspector) => {
      if (inspector !== ui.root) inspector.classList.remove("visible");
    });
    model.lastIndex = index;
    const chartWidth = Math.max(model.width - model.padding.left - model.padding.right, 1);
    const chartHeight = Math.max(model.height - model.padding.top - model.padding.bottom, 1);
    const x = model.padding.left + (
      model.labels.length <= 1
        ? chartWidth / 2
        : (index / (model.labels.length - 1)) * chartWidth
    );
    const frameRect = canvas.parentElement.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const left = canvasRect.left - frameRect.left + x;
    const top = canvasRect.top - frameRect.top + model.padding.top;
    const value = model.values[index];
    const range = model.ranges?.[index];
    const secondaryValue = model.secondaryValues?.[index];
    const note = model.notes?.[index] || "";

    ui.label.textContent = String(model.labels[index]);
    if (Number.isFinite(value)) {
      ui.value.textContent = range
        ? `${model.valueLabel} ${formatInspectorValue(value)} · ${formatInspectorValue(range.min)}～${formatInspectorValue(range.max)}`
        : `${model.valueLabel} ${formatInspectorValue(value)}`;
    } else {
      ui.value.textContent = `${model.valueLabel} 无有效记录`;
    }
    if (model.secondaryLabel) {
      const secondaryText = Number.isFinite(secondaryValue)
        ? `${model.secondaryLabel} ${formatInspectorValue(secondaryValue)}`
        : `${model.secondaryLabel} 无有效记录`;
      ui.secondary.textContent = [secondaryText, note].filter(Boolean).join(" · ");
      ui.secondary.classList.remove("hidden");
    } else if (note) {
      ui.secondary.textContent = note;
      ui.secondary.classList.remove("hidden");
    } else {
      ui.secondary.textContent = "";
      ui.secondary.classList.add("hidden");
    }

    ui.line.style.left = `${left}px`;
    ui.line.style.top = `${top}px`;
    ui.line.style.height = `${chartHeight}px`;
    if (Number.isFinite(value)) {
      const clamped = Math.min(Math.max(value, model.domain.min), model.domain.max);
      const y = model.padding.top +
        ((model.domain.max - clamped) / (model.domain.max - model.domain.min)) * chartHeight;
      ui.dot.style.left = `${left}px`;
      ui.dot.style.top = `${canvasRect.top - frameRect.top + y}px`;
      ui.dot.style.background = AXIS_META[model.role].color;
      ui.dot.classList.remove("hidden");
    } else {
      ui.dot.classList.add("hidden");
    }
    ui.root.classList.add("visible");
    ui.tooltip.style.top = `${canvasRect.top - frameRect.top + 6}px`;
    const tooltipWidth = ui.tooltip.offsetWidth;
    const tooltipLeft = Math.min(
      Math.max(left - tooltipWidth / 2, 4),
      Math.max(frameRect.width - tooltipWidth - 4, 4)
    );
    ui.tooltip.style.left = `${tooltipLeft}px`;
  }

  function updateChartInspector(canvas, model) {
    if (model.compact) {
      canvas._chartInspectionModel = null;
      canvas._chartInspector?.root.classList.remove("visible");
      canvas.removeAttribute("tabindex");
      return;
    }
    canvas._chartInspectionModel = model;
    canvas.tabIndex = 0;
    canvas.style.touchAction = "pan-y";
    if (!canvas.dataset.inspectorBaseLabel) {
      canvas.dataset.inspectorBaseLabel =
        canvas.getAttribute("aria-label") || `${AXIS_META[model.role].label}趋势`;
    }
    canvas.setAttribute(
      "aria-label",
      `${canvas.dataset.inspectorBaseLabel}，触摸或使用左右方向键查看具体日期和数值`
    );
    ensureChartInspector(canvas).root.classList.remove("visible");
  }

  function makeLineChart(
    key,
    canvas,
    labels,
    values,
    role,
    compact = false,
    inspection = null
  ) {
    destroyChart(key);
    if (!canvas) return;
    const column = getColumnByRole(role);
    const setting = role === "state"
      ? { min: 0, max: 100 }
      : (column ? getAnalyticsSetting(column.id) : { min: 0, max: 10 });
    drawNativeChart(canvas, labels, values, role, setting, compact, null, inspection);
    state.charts[key] = { destroy() {} };
  }

  function makeRangeChart(key, canvas, labels, aggregates, role, inspection = null) {
    destroyChart(key);
    if (!canvas) return;
    const column = getColumnByRole(role);
    const setting = role === "state"
      ? { min: 0, max: 100 }
      : (column ? getAnalyticsSetting(column.id) : { min: 0, max: 10 });
    drawNativeChart(
      canvas,
      labels,
      aggregates.map((item) => item?.mean ?? null),
      role,
      setting,
      false,
      aggregates,
      inspection
    );
    state.charts[key] = { destroy() {} };
  }

  function makeStateDynamicsChart(key, canvas, labels, values, ranges, markers, inspection = null) {
    destroyChart(key);
    if (!canvas) return;
    drawNativeChart(
      canvas,
      labels,
      values,
      "state",
      { min: 0, max: 100 },
      false,
      ranges,
      { ...(inspection || {}), markers }
    );
    state.charts[key] = { destroy() {} };
  }

  function formatStateScore(value) {
    return Number.isFinite(value) ? value.toFixed(1) : "-";
  }

  function stateCoverageNote(value) {
    if (!value) return "";
    const coverage = `指标覆盖 ${Math.round((value.coverage || 0) * 100)}%`;
    if (!value.imputedWeight) return coverage;
    return `${coverage} · 中性补位 ${Math.round(value.imputedWeight * 100)}% · 最大误差 ±${(value.uncertainty || 0).toFixed(1)}`;
  }

  function formatStateDelta(delta, longWindow = false) {
    if (!Number.isFinite(delta)) return "暂无可比变化";
    const prefix = longWindow ? "最近 14 天较最早 14 天" : "后段较前段";
    const sign = delta > 0 ? "+" : "";
    return `${prefix} ${sign}${delta.toFixed(1)}`;
  }

  function renderStateOverview() {
    const days = state.overviewScale;
    const summary = stateWindowSummary(state.selectedDate, days);
    [
      [els.stateScale7Button, 7],
      [els.stateScale14Button, 14],
      [els.stateScale56Button, 56],
    ].forEach(([button, value]) => {
      button.classList.toggle("active", days === value);
      button.setAttribute("aria-pressed", String(days === value));
    });
    els.overviewStateScore.textContent = formatStateScore(summary.score);
    els.overviewStateDelta.textContent = formatStateDelta(summary.delta, days === 56);
    const indicatorCoverage = Number.isFinite(summary.coverage)
      ? ` · 指标覆盖 ${Math.round(summary.coverage * 100)}%`
      : "";
    const uncertainty = Number.isFinite(summary.uncertainty) && summary.uncertainty > 0
      ? ` · 最大误差 ±${summary.uncertainty.toFixed(1)}`
      : "";
    els.overviewStateCoverage.textContent =
      `${summary.valid.length}/${days} 个有效日${indicatorCoverage}${uncertainty}`;
    const model = activeScoreModel();
    els.overviewStateModel.textContent = activeScoreModelId() === SCORE_MODEL_V2
      ? `${model.label} · 40/25/15/12/8 · 缺失项中性补位`
      : `${model.label} · 45/30/10/10/5 · 按已填指标重分配`;
    const dates = dateValues(state.selectedDate, days);
    const chartValues = days === 56
      ? rollingStateValues(summary.daily)
      : summary.daily.map((item) => item?.score ?? null);
    makeLineChart(
      "overviewState",
      els.overviewStateCanvas,
      dates.map((date) => date.slice(5)),
      chartValues,
      "state",
      false,
      {
        labels: dates,
        valueLabel: days === 56 ? "14 天滚动均值" : "状态指数",
        secondaryValues: days === 56
          ? summary.daily.map((item) => item?.score ?? null)
          : null,
        secondaryLabel: days === 56 ? "当日状态" : "",
        notes: summary.daily.map(stateCoverageNote),
      }
    );
  }

  function renderStateTrend(days) {
    if (days === 1) {
      const timeline = momentaryStateTimeline();
      const values = timeline.map((item) => item.state?.score ?? null);
      const valid = timeline.filter((item) => item.state);
      const untimedCount = valid.filter((item) => item.untimed).length;
      const midpoint = Math.ceil(valid.length / 2);
      const early = meanFinite(valid.slice(0, midpoint).map((item) => item.state.score));
      const late = meanFinite(valid.slice(midpoint).map((item) => item.state.score));
      els.trendStateScore.textContent = formatStateScore(meanFinite(values));
      els.trendStateDelta.textContent = formatStateDelta(
        early === null || late === null ? null : late - early
      );
      els.trendStateSummary.textContent =
        `${valid.length}/${timeline.length} 条有效记录 · ${activeScoreModel().label} · 需要愉快和紧张担忧${
          untimedCount ? ` · ${untimedCount} 条无具体时间，按原始顺序显示` : ""
        }`;
      makeLineChart(
        "state",
        els.stateCanvas,
        timeline.map((item) => item.label),
        values,
        "state",
        false,
        {
          valueLabel: "状态指数",
          notes: timeline.map((item) => stateCoverageNote(item.state)),
        }
      );
      return;
    }
    const summary = stateWindowSummary(state.selectedDate, days);
    els.trendStateScore.textContent = formatStateScore(summary.score);
    els.trendStateDelta.textContent = formatStateDelta(summary.delta, days === 56);
    const indicatorCoverage = Number.isFinite(summary.coverage)
      ? ` · 指标覆盖 ${Math.round(summary.coverage * 100)}%`
      : "";
    const uncertainty = Number.isFinite(summary.uncertainty) && summary.uncertainty > 0
      ? ` · 最大误差 ±${summary.uncertainty.toFixed(1)}`
      : "";
    els.trendStateSummary.textContent =
      `${summary.valid.length}/${days} 个有效日 · ${
        days === 56 ? "曲线为 14 天滚动均值" : "每日按时段等权"
      } · ${activeScoreModel().label}${indicatorCoverage}${uncertainty}`;
    const dates = dateValues(state.selectedDate, days);
    const dynamics = computeDynamics(dates);
    const chartValues = days === 56
      ? rollingStateValues(summary.daily)
      : summary.daily.map((item) => item?.score ?? null);
    const ranges = dynamics.daily.map((item) => item.range?.count >= 2
      ? { min: item.range.min, max: item.range.max, mean: item.range.mean }
      : null);
    makeStateDynamicsChart(
      "state",
      els.stateCanvas,
      dates.map((date) => date.slice(5)),
      chartValues,
      ranges,
      [],
      {
        labels: dates,
        valueLabel: days === 56 ? "14 天滚动均值" : "状态指数",
        secondaryValues: days === 56
          ? summary.daily.map((item) => item?.score ?? null)
          : null,
        secondaryLabel: days === 56 ? "当日状态" : "",
        notes: summary.daily.map(stateCoverageNote),
      }
    );
  }

  function timeSortValue(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : Number.MAX_SAFE_INTEGER;
  }

  function dailyTimeline() {
    let untimedIndex = 0;
    return state.records
      .filter((record) => inferRecordDate(record) === state.selectedDate)
      .map((record, index) => {
        const rawTime = recordTime(record).trim();
        const untimed = timeBucket(record) === "unknown";
        if (untimed) untimedIndex += 1;
        return {
          record,
          index,
          label: untimed ? `记录 ${untimedIndex}` : rawTime,
        };
      })
      .sort((a, b) => timeSortValue(a.label) - timeSortValue(b.label) || a.index - b.index);
  }

  function trendWindowDays() {
    if (state.trendMode === "week") return 7;
    if (state.trendMode === "fortnight") return 14;
    if (state.trendMode === "course") return 56;
    return 1;
  }

  function renderRoleChart(role, key, canvas) {
    const days = trendWindowDays();
    if (days > 1) {
      const dates = dateValues(state.selectedDate, days);
      const aggregates = aggregateRole(role, dates);
      makeRangeChart(
        key,
        canvas,
        dates.map((date) => date.slice(5)),
        aggregates,
        role,
        { labels: dates }
      );
      return aggregates.some(Boolean);
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
          const value = String(record.values?.[column.id] ?? "").trim();
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
      const prefix = trendWindowDays() > 1 ? `${entry.date.slice(5)} ${entry.time}` : entry.time;
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
    const days = trendWindowDays();
    const dates = days > 1 ? dateValues(state.selectedDate, days) : [state.selectedDate];
    els.trendDateInput.value = state.selectedDate;
    els.trendTimelineControl.classList.toggle("hidden", days === 1);
    if (days > 1) {
      const slider = trendSliderBounds();
      els.trendTimelineSlider.min = "0";
      els.trendTimelineSlider.max = String(slider.span);
      els.trendTimelineSlider.value = String(slider.offset);
      els.trendTimelineSlider.dataset.minimum = slider.minimum;
      els.trendDateInput.min = slider.minimum;
      els.trendDateInput.max = slider.maximum;
      els.trendSliderStart.textContent = dates[0];
      els.trendSliderEnd.textContent = dates[dates.length - 1];
      els.trendTimelineSlider.setAttribute(
        "aria-valuetext",
        `${dates[0]} 至 ${dates[dates.length - 1]}`
      );
    }
    [
      [els.trendDayButton, "day"],
      [els.trendWeekButton, "week"],
      [els.trendFortnightButton, "fortnight"],
      [els.trendCourseButton, "course"],
    ].forEach(([button, mode]) => {
      button.classList.toggle("active", state.trendMode === mode);
      button.setAttribute("aria-pressed", String(state.trendMode === mode));
    });
    const personalScale = state.analytics.scaleMode !== "fixed";
    els.personalScaleButton.classList.toggle("active", personalScale);
    els.fixedScaleButton.classList.toggle("active", !personalScale);
    els.personalScaleButton.setAttribute("aria-pressed", String(personalScale));
    els.fixedScaleButton.setAttribute("aria-pressed", String(!personalScale));
    els.trendPeriodTitle.textContent = days === 1
      ? formatDateTitle(state.selectedDate)
      : `${days} 天 · ${dates[0].slice(5)} 至 ${dates[dates.length - 1].slice(5)}`;
    const coverageText = days > 1
      ? "折线为日均，阴影为当天最低至最高"
      : "共用时间轴，三个维度独立显示";
    renderStateTrend(days);
    renderDynamics(dates);

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
    notes.push(personalScale ? "个人缩放参考最近 14 天" : "固定量表便于跨月比较");
    if (outsideCount > 0) {
      notes.push(personalScale
        ? `${outsideCount} 个越界值已自动扩展显示`
        : `${outsideCount} 个越界值超出固定量表，图中按边界裁剪`);
    }
    if (invalidCount > 0) notes.push(`${invalidCount} 个非数值内容未绘制`);
    els.trendCoverage.textContent = [coverageText, ...notes].join(" · ");
    els.trendNoData.classList.toggle("hidden", hasData);
    renderContextTrack(els.ruminationTrack, "rumination", dates);
    renderContextTrack(els.activityTrack, "activity", dates);
  }

  function formatPromptNumber(value, digits = 1) {
    return Number.isFinite(value) ? value.toFixed(digits) : "-";
  }

  function rawValueByRole(record, role) {
    const column = getColumnByRole(role);
    return column ? String(record.values?.[column.id] ?? "").trim() : "";
  }

  function meanRoleForDates(role, dates) {
    return meanFinite(
      aggregateRole(role, dates)
        .filter(Boolean)
        .map((item) => item.mean)
    );
  }

  function truncatePromptText(value, maxLength = 160) {
    const text = String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).trimEnd()}...`;
  }

  function timeBucketCoverage(timeline) {
    const labels = {
      morning: "早",
      noon: "中",
      afternoon: "晚",
      evening: "夜",
    };
    const buckets = new Set(timeline.map((item) => timeBucket(item.record)).filter((item) => item !== "unknown"));
    const present = Object.entries(labels)
      .filter(([key]) => buckets.has(key))
      .map(([, label]) => label);
    return {
      count: present.length,
      text: present.length ? present.join("/") : "无有效时段",
    };
  }

  function changeText(delta) {
    if (!Number.isFinite(delta)) return "可比较数据不足";
    if (Math.abs(delta) < 3) return `基本持平（${delta >= 0 ? "+" : ""}${delta.toFixed(1)}）`;
    return `${delta > 0 ? "后段升高" : "后段降低"} ${Math.abs(delta).toFixed(1)} 分`;
  }

  function volatilityLabel(severity) {
    if (severity === "stable") return "低波动";
    if (severity === "medium") return "中等波动";
    if (severity === "high") return "高波动";
    return "数据不足";
  }

  function strongestRumination(records) {
    const ranked = records
      .map((record) => ({
        text: ruminationText(record),
        value: ruminationValue(record),
      }))
      .filter((item) => item.text || item.value !== null)
      .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
    return ranked[0]?.text || "无记录";
  }

  function dailyCardLines(date, day) {
    const records = rangeRecords([date]).map((item) => item.record);
    const range = day?.range || dailyStateRange(date);
    const activities = records
      .map((record) => ({
        time: recordTime(record) || "--:--",
        text: activityText(record),
      }))
      .filter((item) => item.text)
      .slice(0, 3)
      .map((item) => `${item.time} ${truncatePromptText(item.text, 90)}`);
    const rangeText = range?.count >= 2
      ? `${formatStateScore(range.min)} / ${formatStateScore(range.max)}`
      : "- / -";
    return [
      `### ${date}`,
      `- 平均状态：${formatStateScore(day?.score ?? range?.mean)}`,
      `- 当天最高/最低：${rangeText}${range?.count === 1 ? "（仅一个时间点）" : ""}`,
      `- 波动：${volatilityLabel(day?.severity)}`,
      `- 反刍：${strongestRumination(records)}`,
      `- 关键活动：${activities.length ? activities.join("；") : "无明显活动文本"}`,
    ];
  }

  function evidenceKey(item) {
    return item.record.id || `${item.date}-${item.time}-${item.minutes}`;
  }

  function addEvidenceCandidate(map, item, priority, reason) {
    const key = evidenceKey(item);
    const current = map.get(key);
    if (current) {
      current.priority = Math.max(current.priority, priority);
      current.reasons.add(reason);
      return;
    }
    map.set(key, {
      item,
      priority,
      reasons: new Set([reason]),
    });
  }

  function selectWeeklyEvidence(dates) {
    const timeline = rangeStateTimeline(dates);
    const candidates = new Map();
    [...timeline]
      .sort((a, b) => a.state.score - b.state.score)
      .slice(0, 3)
      .forEach((item, index) => addEvidenceCandidate(candidates, item, 100 - index, "低点"));
    [...timeline]
      .sort((a, b) => b.state.score - a.state.score)
      .slice(0, 2)
      .forEach((item, index) => addEvidenceCandidate(candidates, item, 88 - index, "高点"));

    adjacentJumps(timeline)
      .filter((item) => item.jump >= DYNAMICS_THRESHOLDS.jumpNotice)
      .sort((a, b) => b.jump - a.jump)
      .slice(0, 4)
      .forEach((jump) => {
        addEvidenceCandidate(candidates, jump.from, 75 + Math.min(jump.jump, 30), "跳变前");
        addEvidenceCandidate(candidates, jump.to, 75 + Math.min(jump.jump, 30), "跳变后");
      });

    timeline.forEach((item) => {
      const rumination = ruminationValue(item.record);
      if (rumination !== null && rumination >= 2) {
        addEvidenceCandidate(candidates, item, 70 + rumination * 4, "强反刍");
      }
      const activity = activityText(item.record);
      if (activity.length >= 30) {
        addEvidenceCandidate(candidates, item, 45 + Math.min(activity.length / 20, 12), "活动解释");
      }
    });

    const selected = [];
    const dayCounts = new Map();
    [...candidates.values()]
      .sort((a, b) => b.priority - a.priority || a.item.minutes - b.item.minutes)
      .forEach((candidate) => {
        const dayCount = dayCounts.get(candidate.item.date) || 0;
        if (selected.length >= 12 || dayCount >= 3) return;
        selected.push(candidate);
        dayCounts.set(candidate.item.date, dayCount + 1);
      });

    return selected.sort((a, b) => a.item.minutes - b.item.minutes);
  }

  function evidenceLine(candidate, index) {
    const item = candidate.item;
    const record = item.record;
    const evidenceId = `E${String(index + 1).padStart(2, "0")}`;
    const activity = truncatePromptText(activityText(record), 160) || "无";
    return `[${evidenceId}] ${item.date} ${item.time}｜状态 ${formatStateScore(item.state.score)}｜愉快 ${rawValueByRole(record, "valence") || "-"}｜能量 ${rawValueByRole(record, "energeticArousal") || "-"}｜紧张担忧 ${rawValueByRole(record, "tenseArousal") || "-"}｜反刍 ${ruminationText(record) || "无记录"}｜活动原文：${activity}`;
  }

  function formatJumpLine(jump) {
    const fromDate = jump.from.date === jump.to.date ? jump.from.date : `${jump.from.date} ${jump.from.time}`;
    const fromTime = jump.from.date === jump.to.date ? jump.from.time : "";
    const start = [fromDate, fromTime].filter(Boolean).join(" ");
    return `  - ${start} → ${jump.to.date} ${jump.to.time}，状态变化 ${jump.jump.toFixed(1)}`;
  }

  function formatRecoveryContext(recovery) {
    if (!recovery) return ["  - 当前 7 天窗口未形成可判断低点或恢复路径。"];
    const lines = [
      `  - 低点：${recovery.low.date} ${recovery.low.time}，状态 ${formatStateScore(recovery.low.state.score)}`,
      `  - 恢复目标：${formatStateScore(recovery.target)}`,
    ];
    if (recovery.recovered) {
      const hours = recovery.hours;
      const duration = hours < 24 ? `${hours.toFixed(1)} 小时` : `${(hours / 24).toFixed(1)} 天`;
      lines.push(`  - 首次观测恢复：低点后 ${duration}，到 ${recovery.recovered.date} ${recovery.recovered.time}${recovery.lowConfidence ? "；采样间隔较大，实际恢复时间不能精确判断" : ""}`);
    } else {
      lines.push("  - 首次观测恢复：窗口内尚未观测到回到目标。");
    }
    return lines;
  }

  function buildAiWeeklyContext(endDate = state.selectedDate) {
    const dates = dateValues(endDate, 7);
    const summary = stateWindowSummary(endDate, 7);
    const dynamics = computeDynamics(dates);
    const timeline = rangeStateTimeline(dates);
    const coverage = timeBucketCoverage(timeline);
    const highestDay = summary.valid.length
      ? summary.valid.reduce((best, item) => item.score > best.score ? item : best)
      : null;
    const lowestDay = summary.valid.length
      ? summary.valid.reduce((best, item) => item.score < best.score ? item : best)
      : null;
    const visibleJumps = adjacentJumps(timeline)
      .filter((item) => item.jump >= DYNAMICS_THRESHOLDS.jumpNotice)
      .sort((a, b) => a.from.minutes - b.from.minutes)
      .slice(0, 6);
    const evidence = selectWeeklyEvidence(dates);
    const patternLines = dynamics.patterns.length
      ? dynamics.patterns.map((item) => `  - ${item.label}：${item.count} 次`)
      : ["  - 暂无足够三轴数据。"];
    const qualityNotes = [];
    if (timeline.length < 4) qualityNotes.push("有效时间点很少，以下分析应视为低置信度线索。");
    if (longestMissingRun(summary.daily) > 1) qualityNotes.push("存在连续缺失日期，请避免把未记录时段当作状态稳定。");
    if (coverage.count < 3) qualityNotes.push("记录时段覆盖不均匀，请谨慎比较不同日期。");
    if (dynamics.invalidTimeCount > 0) {
      qualityNotes.push(`${dynamics.invalidTimeCount} 条记录无具体时间；仅在当天没有标准时间时用于日均，不用于相邻跳变和恢复路径。`);
    }
    const model = activeScoreModel();
    const modelDescription = activeScoreModelId() === SCORE_MODEL_V2
      ? "愉快40% / 平静25% / 能量15% / 低反刍12% / 身体舒适8%；非核心缺失项按50分中性补位"
      : "愉快45% / 平静30% / 能量10% / 低反刍10% / 身体舒适5%；按已填写指标重新分配权重";
    const markdown = [
      "# 我的 7 天情绪周复盘 Context",
      "",
      "请基于下面数据做个人复盘。不要做医学诊断。请区分：",
      "1. 数据事实",
      "2. 可能解释",
      "3. 下周建议",
      "",
      "所有重要判断请引用日期或证据编号。请优先解释这一周状态为什么变化，并明确哪些结论不确定。",
      "",
      "## 1. 时间范围与数据质量",
      `- 范围：${dates[0]} 至 ${dates[dates.length - 1]}`,
      `- 有效状态日：${summary.valid.length}/7`,
      `- 有效时间点：${timeline.length}`,
      `- 最长连续缺失：${longestMissingRun(summary.daily)} 天`,
      `- 时段覆盖：${coverage.count}/4（${coverage.text}）`,
      `- 个人状态模型：${model.label}`,
      `- 模型口径：${modelDescription}`,
      `- 平均指标覆盖：${formatPromptNumber((summary.coverage || 0) * 100, 0)}%`,
      `- 中性补位：${formatPromptNumber((summary.imputedWeight || 0) * 100, 0)}%${summary.uncertainty ? `，综合分最大不确定范围 ±${summary.uncertainty.toFixed(1)}` : ""}`,
      `- 动力学置信度：${dynamics.confidence}`,
      `- 注意：${qualityNotes.length ? qualityNotes.join(" ") : "记录频率可能不均匀，请避免把未记录时段当作状态稳定。"}`,
      "",
      "## 2. 一周数值摘要",
      `- 平均状态指数：${formatStateScore(summary.score)}`,
      `- 愉快平均：${formatPromptNumber(meanRoleForDates("valence", dates))}`,
      `- 能量平均：${formatPromptNumber(meanRoleForDates("energeticArousal", dates))}`,
      `- 紧张担忧平均：${formatPromptNumber(meanRoleForDates("tenseArousal", dates))}`,
      `- 腰痛平均：${formatPromptNumber(meanRoleForDates("physical", dates))}`,
      `- 最高状态日：${highestDay ? `${highestDay.date}，${formatStateScore(highestDay.score)}` : "-"}`,
      `- 最低状态日：${lowestDay ? `${lowestDay.date}，${formatStateScore(lowestDay.score)}` : "-"}`,
      `- 最近段相对前段：${changeText(summary.delta)}`,
      "",
      "## 3. 情绪动力学摘要",
      `- 日间 RMSSD：${formatPromptNumber(dynamics.dailyRmssd)}（${dynamics.dailyPairCount} 组连续自然日配对）`,
      `- 状态画像：${dynamics.interpretation}`,
      `- 最大日内波动：${dynamics.maxSwing ? `${dynamics.maxSwing.swing.toFixed(1)}，发生在 ${dynamics.maxSwing.date}` : "-"}`,
      `- 日内相邻跳变 RMSSD：${formatPromptNumber(dynamics.meanJump)}（仅计算同日且间隔不超过12小时的记录）`,
      "- 明显跳变：",
      ...(visibleJumps.length ? visibleJumps.map(formatJumpLine) : ["  - 暂无明显跳变。"]),
      "- 恢复路径：",
      ...formatRecoveryContext(dynamics.recovery),
      "- 常见状态组合：",
      ...patternLines,
      "",
      "## 4. 每日卡片",
      ...dates.flatMap((date) => ["", ...dailyCardLines(date, dynamics.daily.find((item) => item.date === date))]),
      "",
      "## 5. 关键原文证据",
      ...(evidence.length ? evidence.map(evidenceLine) : ["暂无足够关键原文证据。"]),
      "",
      "## 6. 请你输出",
      "- 本周总体状态",
      "- 主要波动模式",
      "- 可能触发因素",
      "- 可能恢复因素",
      "- 反刍和状态变化的关系",
      "- 下周 3–5 条具体建议",
      "- 哪些结论不确定",
    ].join("\n");
    return {
      markdown,
      meta: {
        start: dates[0],
        end: dates[dates.length - 1],
        validDays: summary.valid.length,
        timePoints: timeline.length,
        evidenceCount: evidence.length,
      },
    };
  }

  function openAiWeeklyDialog() {
    const context = buildAiWeeklyContext(state.selectedDate);
    els.aiWeeklyOutput.value = context.markdown;
    els.aiWeeklyOutput.dataset.start = context.meta.start;
    els.aiWeeklyOutput.dataset.end = context.meta.end;
    els.aiWeeklySummary.textContent =
      `范围 ${context.meta.start} 至 ${context.meta.end} · ${context.meta.validDays}/7 个有效状态日 · ${context.meta.timePoints} 个有效时间点 · ${context.meta.evidenceCount} 条证据。不会上传或写回数据。`;
    els.aiWeeklyDialog.showModal();
    requestAnimationFrame(() => {
      els.aiWeeklyOutput.scrollTop = 0;
    });
  }

  async function copyAiWeeklyMarkdown() {
    const text = els.aiWeeklyOutput.value;
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        els.aiWeeklyOutput.focus();
        els.aiWeeklyOutput.select();
        document.execCommand("copy");
      }
      showToast("周复盘 Markdown 已复制");
    } catch (error) {
      els.aiWeeklyOutput.focus();
      els.aiWeeklyOutput.select();
      showToast("已选中文本，可手动复制");
    }
  }

  function downloadAiWeeklyMarkdown() {
    const text = els.aiWeeklyOutput.value;
    if (!text) return;
    const start = els.aiWeeklyOutput.dataset.start || todayDate();
    const end = els.aiWeeklyOutput.dataset.end || todayDate();
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = sanitizeFileName(`AI周复盘_${start}_至_${end}`) + ".md";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    showToast("周复盘 Markdown 已下载");
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
    els.aiWeeklyButton.addEventListener("click", openAiWeeklyDialog);
    els.detailedAnalysis.addEventListener("toggle", () => {
      if (els.detailedAnalysis.open) requestAnimationFrame(renderTrends);
    });
    els.backupButton.addEventListener("click", exportFullBackup);
    els.backupFileInput.addEventListener("change", (event) => restoreFullBackup(event.target.files[0]));
    els.openTrendsButton.addEventListener("click", () => switchView("trends"));
    els.trendsBackButton.addEventListener("click", () => switchView("overview"));
    [
      [els.stateScale7Button, 7],
      [els.stateScale14Button, 14],
      [els.stateScale56Button, 56],
    ].forEach(([button, days]) => {
      button.addEventListener("click", () => {
        state.overviewScale = days;
        renderStateOverview();
      });
    });
    els.trendDayButton.addEventListener("click", () => {
      state.trendMode = "day";
      render();
    });
    els.trendWeekButton.addEventListener("click", () => {
      state.trendMode = "week";
      render();
    });
    els.trendFortnightButton.addEventListener("click", () => {
      state.trendMode = "fortnight";
      render();
    });
    els.trendCourseButton.addEventListener("click", () => {
      state.trendMode = "course";
      render();
    });
    els.personalScaleButton.addEventListener("click", () => {
      state.analytics.scaleMode = "personal";
      saveAnalytics();
      render();
    });
    els.fixedScaleButton.addEventListener("click", () => {
      state.analytics.scaleMode = "fixed";
      saveAnalytics();
      render();
    });
    els.trendPreviousButton.addEventListener("click", () => shiftTrendDate(-1));
    els.trendNextButton.addEventListener("click", () => shiftTrendDate(1));
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
    els.trendTimelineSlider.addEventListener("input", () => {
      const minimum = normalizeDateValue(els.trendTimelineSlider.dataset.minimum);
      if (!minimum) return;
      state.selectedDate = addDateDays(minimum, Number(els.trendTimelineSlider.value));
      clearTimeout(bindEvents.sliderTimer);
      bindEvents.sliderTimer = setTimeout(renderTrends, 16);
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
    els.copyAiWeeklyButton.addEventListener("click", copyAiWeeklyMarkdown);
    els.downloadAiWeeklyButton.addEventListener("click", downloadAiWeeklyMarkdown);
    els.closeAiWeeklyButton.addEventListener("click", () => els.aiWeeklyDialog.close());

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
          renderStateOverview();
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
