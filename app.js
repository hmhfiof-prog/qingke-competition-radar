/* 青科竞赛雷达 · 静态版交互逻辑 v2（智能分类筛选版） */
(function () {
  "use strict";

  var COMPETITIONS = window.COMPETITIONS || [];
  var META = window.COMPETITIONS_META || {};

  var STATUS_META = {
    upcoming: "未开始",
    open: "报名中",
    ended: "已结束",
  };

  // 学科方向智能分类（内嵌，兼容旧数据；data.js 已含 field 时优先使用）
  var FIELD_RULES = [
    ["数学", ["数学建模", "数学竞赛", "数学应用", "统计建模", "数模", "MCM", "ICM", "力学竞赛", "物理学术"]],
    ["物理", ["物理", "光电", "物理实验"]],
    ["材料", ["材料", "高分子", "金相", "热处理", "焊接", "失效分析"]],
    ["化学化工", ["化学", "化工", "橡胶", "过程装备"]],
    ["生物环境", ["生物", "生命科学", "环境", "生态", "海洋", "低碳", "环保", "绿色", "农业"]],
    ["机械制造", ["机械", "制造", "机电", "工业工程", "成图", "三维", "智能制造", "先进成图"]],
    ["经济管理", ["经济", "管理", "金融", "会计", "商务", "贸易", "市场", "供应链", "物流", "财税", "资产评估", "人力资源", "品牌策划", "商业模式", "电子商务"]],
    ["电子信息", ["电子", "电气", "自动化", "智能汽车", "机器人", "嵌入式", "物联网", "信息安全", "网络安全", "网络技术", "智能媒体", "虚拟现实"]],
    ["计算机软件", ["程序", "软件", "算法", "计算机", "大数据", "人工智能", "区块链", "数字媒体", "开源", "天梯", "蓝桥"]],
    ["外语", ["英语", "日语", "德语", "外语", "翻译", "演讲", "写作", "阅读", "辩论", "词汇", "跨文化"]],
    ["创新创业", ["创新", "创业", "挑战杯", "互联网+", "学创杯", "三创", "服务外包", "商业精英", "创业综合"]],
    ["设计艺术", ["设计", "艺术", "广告", "创意", "动漫", "摄影", "书法", "服装", "数字艺术", "纪录片", "微电影", "美术", "短视频", "好创意", "学院奖"]],
    ["体育", ["体育", "田径", "篮球", "足球", "排球", "武术", "跆拳道", "健美操", "乒乓球", "羽毛球", "网球", "游泳", "定向", "跳绳", "运动会", "啦啦操", "锦标赛"]],
    ["人文社科", ["新闻", "传播", "法律", "社工", "思想政治", "马克思主义", "历史", "公益", "志愿服务", "传统文化", "乡村振兴", "科普"]],
  ];
  function classifyField(name) {
    var n = String(name || "");
    for (var i = 0; i < FIELD_RULES.length; i++) {
      var kws = FIELD_RULES[i][1];
      for (var j = 0; j < kws.length; j++) {
        if (n.indexOf(kws[j]) !== -1) return FIELD_RULES[i][0];
      }
    }
    return "其他";
  }
  function getField(c) {
    return c.field || classifyField(c.name);
  }

  var state = {
    query: "",
    categories: [], // 多选 A/B/C
    levels: [],     // 多选 G/S
    fields: [],     // 多选学科方向
    unit: "ALL",
    onlyUpcoming: false,
    onlyFavorites: false,
    sort: "catalog",
  };

  var favorites = loadFavorites();
  var detail = null;
  var now = new Date();

  function loadFavorites() {
    try {
      var raw = window.localStorage.getItem("qkradar:favorites");
      if (raw) return new Set(JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return new Set();
  }

  function saveFavorites() {
    try {
      window.localStorage.setItem("qkradar:favorites", JSON.stringify(Array.from(favorites)));
    } catch (e) { /* ignore */ }
  }

  function parseDate(s) {
    var p = String(s).split("-").map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }

  function daysBetween(a, b) {
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function getStatus(c) {
    if (now < parseDate(c.regStart)) return "upcoming";
    if (now <= parseDate(c.regEnd)) return "open";
    return "ended";
  }

  function countdownText(c) {
    var st = getStatus(c);
    if (st === "upcoming") {
      return "距报名开始还有 " + Math.max(0, daysBetween(now, parseDate(c.regStart))) + " 天";
    }
    if (st === "open") {
      return "距报名截止还有 " + Math.max(0, daysBetween(now, parseDate(c.regEnd))) + " 天";
    }
    return "本年度赛程已结束";
  }

  function fmtDate(s) {
    return String(s).split("-").join(".");
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  function starIcon(filled) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="' +
      (filled ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">' +
      '<path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.7l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95L12 2.6z"/></svg>';
  }

  function externalIcon() {
    return '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>';
  }

  function calendarIcon() {
    return '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  }

  function unitIcon() {
    return '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
      '<path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  }

  function tagIcon() {
    return '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/></svg>';
  }

  function filtered() {
    var q = state.query.trim().toLowerCase();
    var list = COMPETITIONS.filter(function (c) {
      if (state.categories.length && state.categories.indexOf(c.category) === -1) return false;
      if (state.levels.length && state.levels.indexOf(c.level) === -1) return false;
      if (state.fields.length && state.fields.indexOf(getField(c)) === -1) return false;
      if (state.unit !== "ALL" && c.unit !== state.unit) return false;
      if (state.onlyUpcoming) {
        var st = getStatus(c);
        if (st !== "upcoming" && st !== "open") return false;
      }
      if (state.onlyFavorites && !favorites.has(c.id)) return false;
      if (q) {
        var hay = (c.name + " " + c.unit + " " + c.categoryName + " " + c.levelName + " " + (getField(c) || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (state.sort === "regEnd") {
      list.sort(function (a, b) { return parseDate(a.regEnd) - parseDate(b.regEnd); });
    } else if (state.sort === "eventStart") {
      list.sort(function (a, b) { return parseDate(a.eventStart) - parseDate(b.eventStart); });
    }
    return list;
  }

  function badge(c) {
    return '<span class="badge cat-' + c.category + '">' + esc(c.categoryName) + "</span>" +
      '<span class="badge lvl-' + c.level + '">' + esc(c.levelName) + "</span>" +
      (getField(c) ? '<span class="badge field-badge">' + tagIcon() + esc(getField(c)) + "</span>" : "");
  }

  function statusBadge(c) {
    var st = getStatus(c);
    return '<span class="badge status status-' + st + '">' + STATUS_META[st] + "</span>";
  }

  function cardHTML(c) {
    var st = getStatus(c);
    var fav = favorites.has(c.id);
    var official = c.official
      ? '<a class="btn btn-small btn-primary" href="' + esc(c.official) + '" target="_blank" rel="noopener noreferrer">官网直达 ' + externalIcon() + "</a>"
      : '<span class="official-muted">官网以官方通知为准</span>';
    return (
      '<li class="card" data-id="' + c.id + '">' +
        '<div class="card-top">' +
          '<div class="badges">' + badge(c) + statusBadge(c) + "</div>" +
          '<button type="button" class="fav-btn' + (fav ? " is-fav" : "") + '" data-fav="' + c.id + '" aria-pressed="' + fav + '" aria-label="' + (fav ? "取消收藏：" : "收藏：") + esc(c.name) + '">' +
            starIcon(fav) +
          "</button>" +
        "</div>" +
        '<h3 class="card-title"><button type="button" class="card-title-btn" data-detail="' + c.id + '">' + esc(c.name) + "</button></h3>" +
        '<p class="card-unit">' + unitIcon() + " " + esc(c.unit) + "</p>" +
        '<dl class="card-dates">' +
          "<div><dt>" + calendarIcon() + " 报名时间</dt><dd>" + fmtDate(c.regStart) + " 至 " + fmtDate(c.regEnd) + "</dd></div>" +
          "<div><dt>" + calendarIcon() + " 比赛时间</dt><dd>" + fmtDate(c.eventStart) + " 至 " + fmtDate(c.eventEnd) + "</dd></div>" +
        "</dl>" +
        '<p class="countdown countdown-' + st + '">' + countdownText(c) + "</p>" +
        '<div class="card-actions">' + official +
          '<button type="button" class="btn btn-small btn-ghost" data-detail="' + c.id + '">查看详情</button>' +
        "</div>" +
      "</li>"
    );
  }

  function render() {
    var list = filtered();
    var cardsEl = document.getElementById("cards");
    var countEl = document.getElementById("result-count");
    var emptyEl = document.getElementById("empty");

    cardsEl.innerHTML = list.map(cardHTML).join("");

    var label = "";
    if (state.onlyUpcoming) label += "（未开赛）";
    if (state.onlyFavorites) label += "（已收藏）";
    countEl.innerHTML = "共 <strong>" + list.length + "</strong> 项" + label;
    emptyEl.hidden = list.length !== 0;
  }

  function countBy(key, value) {
    return COMPETITIONS.filter(function (c) { return c[key] === value; }).length;
  }

  function renderStats() {
    var total = COMPETITIONS.length;
    var A = countBy("category", "A"), B = countBy("category", "B"), C = countBy("category", "C");
    var G = countBy("level", "G"), S = countBy("level", "S");
    var units = {};
    var upcoming = 0;
    COMPETITIONS.forEach(function (c) {
      units[c.unit] = true;
      var st = getStatus(c);
      if (st === "upcoming" || st === "open") upcoming++;
    });
    var unitCount = Object.keys(units).length;
    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-upcoming").querySelector(".stat-num").textContent = upcoming;
    document.getElementById("stat-units").textContent = unitCount;
    var catEl = document.querySelector(".stats-strip .stat:nth-child(2) .stat-num");
    var lvlEl = document.querySelector(".stats-strip .stat:nth-child(3) .stat-num");
    if (catEl) catEl.textContent = A + " / " + B + " / " + C;
    if (lvlEl) lvlEl.textContent = G + " / " + S;
  }

  function renderMeta() {
    if (META.source && document.getElementById("about-base")) {
      document.getElementById("about-base").innerHTML = "赛事目录依据" + esc(META.source) + "，共 <strong>" + COMPETITIONS.length + "</strong> 项，分为 A / B / C 三类，国家级 / 省级两级。";
    }
    if (META.year && document.getElementById("hero-tag-year")) {
      document.getElementById("hero-tag-year").textContent = META.year + " 年度认定目录";
    }
    if (document.getElementById("hero-tag-count")) {
      document.getElementById("hero-tag-count").textContent = COMPETITIONS.length + " 项 · A/B/C 三类";
    }
  }

  function populateUnits() {
    var seen = {};
    var unitEl = document.getElementById("filter-unit");
    COMPETITIONS.forEach(function (c) {
      if (!seen[c.unit]) {
        seen[c.unit] = true;
        var opt = document.createElement("option");
        opt.value = c.unit;
        opt.textContent = c.unit;
        unitEl.appendChild(opt);
      }
    });
  }

  function populateFields() {
    var counts = {};
    COMPETITIONS.forEach(function (c) {
      var f = getField(c);
      counts[f] = (counts[f] || 0) + 1;
    });
    var order = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var el = document.getElementById("chips-field");
    el.innerHTML = "";
    order.forEach(function (f) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.setAttribute("data-field", f);
      btn.textContent = f + " " + counts[f];
      el.appendChild(btn);
    });
  }

  function toggleIn(arr, v) {
    var i = arr.indexOf(v);
    if (i === -1) arr.push(v); else arr.splice(i, 1);
  }

  function syncChips() {
    document.querySelectorAll("#chips-category .chip").forEach(function (b) {
      b.classList.toggle("is-active", state.categories.indexOf(b.getAttribute("data-cat")) !== -1);
    });
    document.querySelectorAll("#chips-level .chip").forEach(function (b) {
      b.classList.toggle("is-active", state.levels.indexOf(b.getAttribute("data-level")) !== -1);
    });
    document.querySelectorAll("#chips-field .chip").forEach(function (b) {
      b.classList.toggle("is-active", state.fields.indexOf(b.getAttribute("data-field")) !== -1);
    });
  }

  function syncControls() {
    document.getElementById("filter-query").value = state.query;
    document.getElementById("filter-unit").value = state.unit;
    document.getElementById("filter-sort").value = state.sort;
    document.getElementById("toggle-upcoming").checked = state.onlyUpcoming;
    document.getElementById("toggle-fav").checked = state.onlyFavorites;
    syncChips();
  }

  function resetFilters() {
    state.query = "";
    state.categories = [];
    state.levels = [];
    state.fields = [];
    state.unit = "ALL";
    state.onlyUpcoming = false;
    state.onlyFavorites = false;
    state.sort = "catalog";
    syncControls();
    render();
  }

  function goToFavorites() {
    state.onlyFavorites = true;
    state.onlyUpcoming = false;
    syncControls();
    render();
    document.getElementById("list").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openModal(id) {
    var c = null;
    COMPETITIONS.forEach(function (x) { if (x.id === id) c = x; });
    if (!c) return;
    detail = c;
    var st = getStatus(c);
    document.getElementById("modal-badges").innerHTML = badge(c) + statusBadge(c);
    document.getElementById("modal-title").textContent = c.name;
    document.getElementById("modal-unit").textContent = "牵头单位：" + c.unit;
    document.getElementById("modal-dates").innerHTML =
      "<div><dt>报名时间</dt><dd>" + fmtDate(c.regStart) + " 至 " + fmtDate(c.regEnd) + "</dd></div>" +
      "<div><dt>比赛时间</dt><dd>" + fmtDate(c.eventStart) + " 至 " + fmtDate(c.eventEnd) + "</dd></div>" +
      "<div><dt>目录序号</dt><dd>第 " + c.id + " 项</dd></div>";
    document.getElementById("modal-countdown").className = "modal-countdown countdown-" + st;
    document.getElementById("modal-countdown").textContent = countdownText(c);
    document.getElementById("modal-note").innerHTML = "<b>备注：</b>" + esc(c.note);
    var fav = favorites.has(c.id);
    document.getElementById("modal-actions").innerHTML =
      (c.official
        ? '<a class="btn btn-primary" href="' + esc(c.official) + '" target="_blank" rel="noopener noreferrer">前往官网 ' + externalIcon() + "</a>"
        : '<span class="official-muted">官网地址以组委会官方通知为准</span>') +
      '<button type="button" class="btn ' + (fav ? "btn-primary" : "btn-ghost") + '" data-modal-fav="' + c.id + '">' +
        starIcon(fav) + (fav ? " 已收藏" : " 收藏") +
      "</button>";
    document.getElementById("modal-backdrop").hidden = false;
    document.getElementById("modal-close").focus();
  }

  function closeModal() {
    document.getElementById("modal-backdrop").hidden = true;
    detail = null;
  }

  function bind() {
    document.getElementById("filter-query").addEventListener("input", function (e) {
      state.query = e.target.value;
      render();
    });
    document.getElementById("filter-unit").addEventListener("change", function (e) {
      state.unit = e.target.value;
      render();
    });
    document.getElementById("filter-sort").addEventListener("change", function (e) {
      state.sort = e.target.value;
      render();
    });

    // 芯片多选：类别 / 级别 / 学科方向
    ["chips-category", "chips-level", "chips-field"].forEach(function (groupId) {
      document.getElementById(groupId).addEventListener("click", function (e) {
        var btn = e.target.closest(".chip");
        if (!btn) return;
        var cat = btn.getAttribute("data-cat");
        var lvl = btn.getAttribute("data-level");
        var fld = btn.getAttribute("data-field");
        if (cat) toggleIn(state.categories, cat);
        else if (lvl) toggleIn(state.levels, lvl);
        else if (fld) toggleIn(state.fields, fld);
        syncChips();
        render();
      });
    });

    document.getElementById("toggle-upcoming").addEventListener("change", function (e) {
      state.onlyUpcoming = e.target.checked;
      render();
    });
    document.getElementById("toggle-fav").addEventListener("change", function (e) {
      state.onlyFavorites = e.target.checked;
      render();
    });
    document.getElementById("btn-reset").addEventListener("click", resetFilters);
    document.getElementById("btn-clear").addEventListener("click", resetFilters);

    document.getElementById("nav-fav").addEventListener("click", goToFavorites);
    document.getElementById("hero-fav").addEventListener("click", goToFavorites);
    document.getElementById("brand-link").addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    document.getElementById("cards").addEventListener("click", function (e) {
      var t = e.target.closest("[data-detail]");
      var f = e.target.closest("[data-fav]");
      if (t) {
        openModal(Number(t.getAttribute("data-detail")));
      } else if (f) {
        var id = Number(f.getAttribute("data-fav"));
        if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
        saveFavorites();
        render();
      }
    });

    document.getElementById("modal-actions").addEventListener("click", function (e) {
      var f = e.target.closest("[data-modal-fav]");
      if (!f) return;
      var id = Number(f.getAttribute("data-modal-fav"));
      if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
      saveFavorites();
      if (detail && detail.id === id) openModal(id);
      render();
    });

    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("modal-backdrop").addEventListener("mousedown", function (e) {
      if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    populateUnits();
    populateFields();
    renderStats();
    renderMeta();
    bind();
    render();
  });
})();
