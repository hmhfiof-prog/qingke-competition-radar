/* 竞赛目录导入工具 · 前端逻辑（与 scripts/import_catalog.py 规则一致） */
(function () {
  "use strict";

  // ---- 学科方向智能分类 ----
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

  // ---- 列名关键词 ----
  var COLUMN_RULES = {
    name: ["竞赛名称", "比赛名称", "赛事名称", "竞赛项目", "项目名称", "大赛名称", "名称", "项目"],
    category: ["类别", "分类", "竞赛类别", "等级分类", "类别分类"],
    level: ["级别", "层次", "层级", "竞赛级别", "比赛级别", "赛事级别"],
    unit: ["牵头单位", "承办单位", "负责单位", "归属单位", "牵头学院", "主办单位", "组织单位", "单位", "学院"],
    note: ["备注", "说明", "官网", "网址", "链接", "联系方式"],
    year: ["年份", "年度"],
  };
  var FIELD_LABELS = { name: "竞赛名称", category: "类别", level: "级别", unit: "牵头单位", note: "备注", year: "年份" };

  // ---- 解析文本为二维数组 ----
  function parseText(text) {
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l; });
    if (!lines.length) return [];
    var delim = null;
    if (lines[0].indexOf("\t") !== -1) delim = "\t";
    else if (lines[0].indexOf(",") !== -1) delim = ",";
    else if (lines[0].indexOf("|") !== -1) delim = "|";
    else if (lines[0].indexOf(";") !== -1) delim = ";";
    if (!delim) return lines.map(function (l) { return [l]; });
    return lines.map(function (l) {
      var cells = [], cur = "", inQ = false;
      for (var i = 0; i < l.length; i++) {
        var ch = l[i];
        if (inQ) {
          if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
          else cur += ch;
        } else if (ch === '"') { inQ = true; }
        else if (ch === delim) { cells.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
      cells.push(cur.trim());
      return cells;
    });
  }

  // ---- 表头识别 ----
  function scoreHeader(row) {
    var s = 0;
    for (var i = 0; i < row.length; i++) {
      var cc = String(row[i] || "").trim().toLowerCase();
      if (!cc) continue;
      for (var f in COLUMN_RULES) {
        var kws = COLUMN_RULES[f];
        for (var j = 0; j < kws.length; j++) {
          if (cc.indexOf(kws[j].toLowerCase()) !== -1) { s++; break; }
        }
      }
    }
    return s;
  }
  function findHeaderRow(rows) {
    var best = -1, bestI = 0;
    for (var i = 0; i < Math.min(15, rows.length); i++) {
      var sc = scoreHeader(rows[i]);
      if (sc > best) { best = sc; bestI = i; }
      if (best >= 4) break;
    }
    return best >= 2 ? bestI : -1;
  }
  function mapColumns(header) {
    var mapping = {};
    for (var i = 0; i < header.length; i++) {
      var cc = String(header[i] || "").trim();
      if (!cc) continue;
      var bestField = null, bestScore = 0;
      var ccl = cc.toLowerCase();
      for (var f in COLUMN_RULES) {
        var kws = COLUMN_RULES[f];
        for (var j = 0; j < kws.length; j++) {
          var kw = kws[j];
          var sc;
          if (ccl === kw.toLowerCase()) sc = kw.length * 100 + 1000;
          else if (ccl.indexOf(kw.toLowerCase()) !== -1) sc = kw.length;
          else continue;
          if (sc > bestScore) { bestScore = sc; bestField = f; }
        }
      }
      if (bestField && !(bestField in mapping)) mapping[bestField] = i;
    }
    return mapping;
  }

  // ---- 归一化 ----
  function normCategory(v) {
    v = String(v || "").trim();
    if (!v) return null;
    if (/A类|一类|A级/.test(v)) return "A";
    if (/B类|二类|B级/.test(v)) return "B";
    if (/C类|三类|C级/.test(v)) return "C";
    var v0 = v.toUpperCase();
    if (v0 === "A" || v0 === "B" || v0 === "C") return v0;
    var m = v0.match(/^([ABC])/);
    return m ? m[1] : null;
  }
  function normLevel(v) {
    v = String(v || "").trim();
    if (!v) return null;
    if (/国家级|全国|国家|国赛/.test(v)) return "G";
    if (/省级|省赛|省/.test(v)) return "S";
    var v0 = v.toUpperCase();
    if (v0 === "G" || v0 === "S") return v0;
    var m = v0.match(/^([GS])/);
    return m ? m[1] : null;
  }

  // ---- 演示时间 ----
  function pad(n) { return String(n).padStart(2, "0"); }
  function fmt(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function genDates(idx, year) {
    if (idx % 10 < 3) {
      var rs = addDays(new Date(year, 0, 1), (idx * 7) % 40);
      var re = addDays(rs, 30 + (idx * 3) % 25);
      var es = addDays(re, 15 + (idx * 5) % 30);
      var ee = addDays(es, 2 + idx % 5);
    } else if (idx % 10 < 6) {
      rs = addDays(new Date(year, 7, 3), (idx * 3) % 25);
      re = addDays(rs, 25 + (idx * 7) % 20);
      es = addDays(re, 20 + (idx * 5) % 35);
      ee = addDays(es, 2 + idx % 5);
    } else {
      rs = addDays(new Date(year, 4, 20), (idx * 5) % 30);
      re = addDays(new Date(year, 7, 10), (idx * 3) % 30);
      es = addDays(re, 12 + (idx * 7) % 30);
      ee = addDays(es, 2 + idx % 5);
    }
    return { regStart: fmt(rs), regEnd: fmt(re), eventStart: fmt(es), eventEnd: fmt(ee) };
  }

  // ---- 状态 ----
  var rows = [];
  var headerIdx = -1;
  var mapping = {};
  var items = [];

  // ---- UI ----
  var $ = function (id) { return document.getElementById(id); };

  function showMap() {
    var grid = $("map-grid");
    grid.innerHTML = "";
    ["name", "category", "level", "unit", "note"].forEach(function (key) {
      var label = document.createElement("span");
      label.className = "map-label";
      label.textContent = FIELD_LABELS[key] + "：";
      var sel = document.createElement("select");
      sel.dataset.key = key;
      for (var i = -1; i < rows[headerIdx].length; i++) {
        var opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = i === -1 ? "（不使用）" : "第 " + (i + 1) + " 列：" + (rows[headerIdx][i] || "(空)");
        sel.appendChild(opt);
      }
      sel.value = String(mapping[key] === undefined ? -1 : mapping[key]);
      grid.appendChild(label);
      grid.appendChild(sel);
    });
    $("map-card").hidden = false;
    $("preview-card").hidden = true;
  }

  function buildItems() {
    var year = parseInt($("meta-year").value, 10) || new Date().getFullYear();
    items = [];
    var used = {};
    for (var i = 0; i < rows.length; i++) {
      if (i <= headerIdx) continue;
      var row = rows[i];
      var get = function (key) {
        var idx = mapping[key];
        return (idx !== undefined && idx >= 0 && idx < row.length) ? String(row[idx] || "").trim() : "";
      };
      var name = get("name");
      if (!name || name === "合计" || name === "总计") continue;
      if (used[name]) name = name + "（" + (i + 1) + "）";
      used[name] = true;
      var cat = normCategory(get("category")) || "C";
      var lvl = normLevel(get("level")) || "G";
      var unit = get("unit") || "待确认";
      var note = get("note");
      var d = genDates(items.length, year);
      items.push({
        id: items.length + 1,
        name: name,
        category: cat,
        categoryName: { A: "A 类", B: "B 类", C: "C 类" }[cat],
        level: lvl,
        levelName: lvl === "G" ? "国家级" : "省级",
        unit: unit,
        regStart: d.regStart, regEnd: d.regEnd,
        eventStart: d.eventStart, eventEnd: d.eventEnd,
        official: "",
        note: note || "参赛信息以各竞赛组委会官方通知为准。",
        field: classifyField(name),
      });
    }
  }

  function showPreview() {
    buildItems();
    var cat = {}, lvl = {}, fld = {}, units = {};
    items.forEach(function (it) {
      cat[it.category] = (cat[it.category] || 0) + 1;
      lvl[it.level] = (lvl[it.level] || 0) + 1;
      fld[it.field] = (fld[it.field] || 0) + 1;
      units[it.unit] = true;
    });
    $("stat-line").textContent =
      "共 " + items.length + " 项 · A类" + (cat.A || 0) + " / B类" + (cat.B || 0) + " / C类" + (cat.C || 0) +
      " · 国家级" + (lvl.G || 0) + " / 省级" + (lvl.S || 0) + " · " + Object.keys(units).length + " 个牵头单位";
    var pv = $("preview");
    pv.innerHTML = "";
    var table = document.createElement("table");
    var thead = document.createElement("thead");
    var tr = document.createElement("tr");
    ["序号", "名称", "类别", "级别", "牵头单位", "学科方向"].forEach(function (h) {
      var th = document.createElement("th"); th.textContent = h; tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    items.slice(0, 12).forEach(function (it, k) {
      var r = document.createElement("tr");
      [k + 1, it.name, it.category, it.levelName, it.unit, it.field].forEach(function (v) {
        var td = document.createElement("td"); td.textContent = v; r.appendChild(td);
      });
      tbody.appendChild(r);
    });
    table.appendChild(tbody);
    pv.appendChild(table);
    if (items.length > 12) {
      var more = document.createElement("p");
      more.className = "hint";
      more.textContent = "… 共 " + items.length + " 项，仅预览前 12 项";
      pv.appendChild(more);
    }
    $("preview-card").hidden = false;
  }

  function buildDataJs() {
    var meta = {
      source: $("meta-source").value.trim() || "导入的竞赛认定目录",
      year: parseInt($("meta-year").value, 10) || null,
      school: $("meta-school").value.trim(),
    };
    var header =
      "// 青科竞赛雷达 · 学科竞赛认定数据（由导入工具生成）\n" +
      "// 报名/比赛时间为演示用示例数据，正式系统由采集方案提供实时信息。\n" +
      "// 学科方向（field）为按名称关键词自动智能分类，可人工修正。\n";
    return header +
      "window.COMPETITIONS_META = " + JSON.stringify(meta, null, 2) + ";\n\n" +
      "window.COMPETITIONS = " + JSON.stringify(items, null, 2) + ";\n";
  }

  function doParse() {
    var text = $("paste").value;
    if (!text.trim()) { alert("请先粘贴表格内容或选择文件"); return; }
    rows = parseText(text);
    if (!rows.length) { alert("未能解析到数据"); return; }
    headerIdx = findHeaderRow(rows);
    if (headerIdx < 0) { alert("未识别到表头行，请确认首行包含列名（如：竞赛名称、类别…）"); return; }
    mapping = mapColumns(rows[headerIdx]);
    if (!("name" in mapping)) { alert("未识别到「竞赛名称」列，请手动选择列映射"); }
    showMap();
  }

  // ---- 事件 ----
  $("btn-parse").addEventListener("click", doParse);
  $("btn-sample").addEventListener("click", function () {
    $("paste").value =
      "序号\t项目名称\t分类\t级别\t承办单位\t备注\n" +
      "1\t全国大学生数学建模竞赛\tA类\t国家级\t数理学院\t\n" +
      "2\t山东省大学生程序设计竞赛\tB类\t省级\t信息学院\t\n" +
      "3\t全国大学生高分子材料创新创业大赛\tA类\t国家级\t高分子科学与工程学院\t官网报名\n" +
      "4\t大学生英语能力挑战赛\tB类\t国家级\t外语学院\t\n" +
      "5\t高校篮球联赛（华东赛区）\tC类\t省级\t体育学院\t";
  });
  $("btn-map").addEventListener("click", function () {
    var sels = $("map-grid").querySelectorAll("select");
    var nm = {};
    for (var i = 0; i < sels.length; i++) {
      var v = parseInt(sels[i].value, 10);
      if (v >= 0) nm[sels[i].dataset.key] = v;
    }
    mapping = nm;
    if (!("name" in mapping)) { alert("必须选择「竞赛名称」列"); return; }
    showPreview();
  });
  $("btn-download").addEventListener("click", function () {
    var blob = new Blob([buildDataJs()], { type: "application/javascript;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = $("dl-link");
    a.href = url;
    a.download = "data.js";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  $("btn-copy").addEventListener("click", function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(buildDataJs()).then(function () { alert("已复制到剪贴板"); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = buildDataJs();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("已复制到剪贴板");
    }
  });
  $("file").addEventListener("change", function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { $("paste").value = r.result; doParse(); };
    r.readAsText(f, "utf-8");
  });
})();
