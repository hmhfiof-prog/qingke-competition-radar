/* 青科竞赛雷达 · 静态版交互逻辑 */
(function () {
  "use strict";

  var COMPETITIONS = window.COMPETITIONS || [];

  var STATUS_META = {
    upcoming: "未开始",
    open: "报名中",
    ended: "已结束",
  };

  var state = {
    query: "",
    category: "ALL",
    level: "ALL",
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
    var p = s.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
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
    return s.split("-").join(".");
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
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

  function filtered() {
    var q = state.query.trim().toLowerCase();
    var list = COMPETITIONS.filter(function (c) {
      if (state.category !== "ALL" && c.category !== state.category) return false;
      if (state.level !== "ALL" && c.level !== state.level) return false;
      if (state.unit !== "ALL" && c.unit !== state.unit) return false;
      if (state.onlyUpcoming) {
        var st = getStatus(c);
        if (st !== "upcoming" && st !== "open") return false;
      }
      if (state.onlyFavorites && !favorites.has(c.id)) return false;
      if (q) {
        var hay = (c.name + " " + c.unit + " " + c.categoryName + " " + c.levelName).toLowerCase();
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
      '<span class="badge lvl-' + c.level + '">' + esc(c.levelName) + "</span>";
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

  function renderStats() {
    var n = 0;
    COMPETITIONS.forEach(function (c) {
      var st = getStatus(c);
      if (st === "upcoming" || st === "open") n++;
    });
    document.getElementById("stat-upcoming").innerHTML = "<strong>" + n + "</strong><span>项即将报名 / 报名中</span>";
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

  function resetFilters() {
    state.query = "";
    state.category = "ALL";
    state.level = "ALL";
    state.unit = "ALL";
    state.onlyUpcoming = false;
    state.onlyFavorites = false;
    state.sort = "catalog";
    syncControls();
    render();
  }

  function syncControls() {
    document.getElementById("filter-query").value = state.query;
    document.getElementById("filter-category").value = state.category;
    document.getElementById("filter-level").value = state.level;
    document.getElementById("filter-unit").value = state.unit;
    document.getElementById("filter-sort").value = state.sort;
    document.getElementById("toggle-upcoming").checked = state.onlyUpcoming;
    document.getElementById("toggle-fav").checked = state.onlyFavorites;
  }

  function goToFavorites() {
    state.onlyFavorites = true;
    state.onlyUpcoming = false;
    syncControls();
    render();
    document.getElementById("list").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bind() {
    document.getElementById("filter-query").addEventListener("input", function (e) {
      state.query = e.target.value;
      render();
    });
    document.getElementById("filter-category").addEventListener("change", function (e) {
      state.category = e.target.value;
      render();
    });
    document.getElementById("filter-level").addEventListener("change", function (e) {
      state.level = e.target.value;
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
    renderStats();
    bind();
    render();
  });
})();
