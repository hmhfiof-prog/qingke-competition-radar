#!/usr/bin/env node
/**
 * 青科竞赛雷达 · 官网实时时间抓取器 v2
 * 读取 data.js，对含官网链接的赛事：
 *   1) 抓首页；2) 找出"通知/公告/报名/新闻"类链接页（最多3个）一并抓取；
 *   3) 只接受"同一公告内的明确日期区间"或"同年度、跨度合理的起止对"，写入 live-overrides.js。
 * 质量门槛从严：宁可少抓，不可乱抓。任何站点失败不影响整体，脚本以 0 退出。
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const LIMIT = process.env.CRAWL_LIMIT ? parseInt(process.env.CRAWL_LIMIT, 10) : 0;
const CONCURRENCY = 3;
const FETCH_TIMEOUT = 10000;
const MAX_NOTICE_LINKS = 3;

function findInRepo(name) {
  for (const dir of [ROOT, path.join(ROOT, "competition-tracker")]) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const DATA_PATH = findInRepo("data.js") || path.join(ROOT, "data.js");
const OUT_PATH = path.join(path.dirname(DATA_PATH), "live-overrides.js");

function loadJs(file) {
  if (!fs.existsSync(file)) return {};
  const src = fs.readFileSync(file, "utf8");
  const s = { window: {} };
  vm.createContext(s);
  try { vm.runInContext(src, s); } catch (e) { console.error("解析失败", file, e.message); }
  return s.window || {};
}

const { COMPETITIONS = [] } = loadJs(DATA_PATH);
const prev = loadJs(OUT_PATH);

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

async function fetchText(url, timeout = FETCH_TIMEOUT) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", "Accept": "text/html,application/xhtml+xml,*/*;q=0.8" },
      redirect: "follow", signal: ac.signal,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    let text = null;
    for (const enc of ["utf-8", "gbk"]) {
      try {
        const d = new TextDecoder(enc, { fatal: true });
        const s = d.decode(buf);
        if (!s.includes("\uFFFD")) { text = s; break; }
      } catch { /* try next */ }
    }
    if (!text) text = new TextDecoder("utf-8").decode(buf);
    const stripped = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    return { ok: true, status: res.status, raw: text, text: stripped, finalUrl: res.url };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e).slice(0, 100) };
  } finally {
    clearTimeout(timer);
  }
}

function pad(n) { return String(n).padStart(2, "0"); }
function toDate(s) { const p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function dayDiff(a, b) { return Math.round((toDate(b) - toDate(a)) / 86400000); }

const NOW = new Date();
const CUR_YEAR = NOW.getFullYear();
const MIN_YEAR_SINGLE = CUR_YEAR;       // 单日期只接受当前/次年
const MAX_YEAR = CUR_YEAR + 1;
const MIN_YEAR_SPAN = CUR_YEAR - 1;     // 区间允许从前一年末开始（跨年报名）

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function extractLinks(raw, baseUrl) {
  const out = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const seen = new Set();
  while ((m = re.exec(raw))) {
    const href = decodeEntities(m[1].trim());
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, "").slice(0, 60);
    if (!href || /^(javascript|#|mailto:)/i.test(href)) continue;
    let abs;
    try { abs = new URL(href, baseUrl).href; } catch { continue; }
    if (seen.has(abs)) continue;
    seen.add(abs);
    const blob = text + " " + href;
    if (/通知|公告|报名|新闻|资讯|新闻动态|notice|news|tzgg|gg|baoming|announce|detail|content|info/i.test(blob)) {
      out.push({ url: abs, text });
    }
  }
  return out.slice(0, MAX_NOTICE_LINKS);
}

function dateHits(text) {
  const hits = [];
  const re = /(.{0,36}?)(20\d{2})[年.\-\/](\d{1,2})[月.\-\/](\d{1,2})[日]?/g;
  let m;
  while ((m = re.exec(text))) {
    const y = +m[2], mo = +m[3], d = +m[4];
    if (y < MIN_YEAR_SINGLE || y > MAX_YEAR) continue;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    hits.push({ date: `${y}-${pad(mo)}-${pad(d)}`, ctx: (m[1] || "").replace(/\s+/g, "").slice(-24) });
  }
  return hits;
}

function hasKw(ctx, kws) { return kws.some((k) => ctx.includes(k)); }

/** 严格解析：只返回有信心的区间 */
function parseTimeline(text) {
  const spans = [];
  // 报名/注册/提交 … X 至 Y
  const regSpan = /(报名|注册|作品提交|作品上传|参赛)[^。；\n]{0,40}?(20\d{2})[年.\-\/](\d{1,2})[月.\-\/](\d{1,2})[日]?\s*[至到—\-~]\s*(20\d{2})[年.\-\/](\d{1,2})[月.\-\/](\d{1,2})[日]?/g;
  let m;
  while ((m = regSpan.exec(text))) {
    const a = `${m[2]}-${pad(+m[3])}-${pad(+m[4])}`;
    const b = `${m[5]}-${pad(+m[6])}-${pad(+m[7])}`;
    const ay = +m[2], by = +m[5];
    const span = dayDiff(a, b);
    if (by >= CUR_YEAR && ay >= MIN_YEAR_SPAN && by <= MAX_YEAR && a <= b && span >= 0 && span <= 400) spans.push({ type: "reg", a, b });
  }
  const evSpan = /(比赛|决赛|初赛|竞赛|现场|答辩|复赛)[^。；\n]{0,40}?(20\d{2})[年.\-\/](\d{1,2})[月.\-\/](\d{1,2})[日]?\s*[至到—\-~]\s*(20\d{2})[年.\-\/](\d{1,2})[月.\-\/](\d{1,2})[日]?/g;
  while ((m = evSpan.exec(text))) {
    const a = `${m[2]}-${pad(+m[3])}-${pad(+m[4])}`;
    const b = `${m[5]}-${pad(+m[6])}-${pad(+m[7])}`;
    const ay = +m[2], by = +m[5];
    const span = dayDiff(a, b);
    if (by >= CUR_YEAR && ay >= MIN_YEAR_SPAN && by <= MAX_YEAR && a <= b && span >= 0 && span <= 90) spans.push({ type: "event", a, b });
  }

  const result = {};
  const regSpans = spans.filter((s) => s.type === "reg");
  const evSpans = spans.filter((s) => s.type === "event");
  // 选跨度最短、最靠近当前时间的区间
  if (regSpans.length) {
    const best = regSpans.sort((x, y) => dayDiff(x.a, x.b) - dayDiff(y.a, y.b) || y.a.localeCompare(x.a))[0];
    result.regStart = best.a; result.regEnd = best.b;
  }
  if (evSpans.length) {
    const best = evSpans.sort((x, y) => dayDiff(x.a, x.b) - dayDiff(y.a, y.b) || y.a.localeCompare(x.a))[0];
    result.eventStart = best.a; result.eventEnd = best.b;
  }
  if (result.regStart && result.regEnd) return result;

  // 无明确区间时，退化为"起止关键词单日"，要求同年、跨度合理
  const hits = dateHits(text);
  const regStarts = hits.filter((h) => hasKw(h.ctx, ["报名", "注册", "提交", "上传", "作品"]) && !hasKw(h.ctx, ["截止", "结束", "止", "前"]));
  const regEnds = hits.filter((h) => hasKw(h.ctx, ["截止", "结束", "止", "前"]));
  const evs = hits.filter((h) => hasKw(h.ctx, ["比赛", "决赛", "初赛", "竞赛", "现场", "举行", "赛区"]));
  if (!result.regStart && regStarts.length && regEnds.length) {
    const a = regStarts.map((h) => h.date).sort()[0];
    const b = regEnds.map((h) => h.date).sort()[0];
    const span = dayDiff(a, b);
    if (a <= b && span >= 0 && span <= 200 && a.slice(0, 4) === b.slice(0, 4)) { result.regStart = a; result.regEnd = b; }
  }
  if (!result.eventStart && evs.length) {
    const dates = evs.map((h) => h.date).sort();
    const a = dates[0], b = dates[dates.length - 1];
    const span = dayDiff(a, b);
    if (a.slice(0, 4) === b.slice(0, 4) && span >= 0 && span <= 30) { result.eventStart = a; result.eventEnd = b; }
  }
  return Object.keys(result).length ? result : null;
}

function hostOf(u) { try { return new URL(u).host; } catch { return u; } }

async function crawlOne(c) {
  const home = await fetchText(c.official);
  if (!home.ok) return { fetchFailed: true, error: home.error };

  const pages = [home];
  const links = extractLinks(home.raw || "", home.finalUrl || c.official);
  for (const l of links.slice(0, MAX_NOTICE_LINKS)) {
    const r = await fetchText(l.url);
    if (r.ok && r.text) pages.push(r);
    await new Promise((res) => setTimeout(res, 120));
  }

  let best = null;
  for (const p of pages) {
    const tl = parseTimeline(p.text);
    if (!tl) continue;
    if (!best) best = tl;
    else {
      // 优先有报名区间的
      if (tl.regStart && !best.regStart) best = tl;
      else if (tl.regStart && best.regStart && tl.eventStart && !best.eventStart) best = tl;
    }
  }
  return { fetchFailed: false, timeline: best, pages: pages.length };
}

async function main() {
  const targets = COMPETITIONS.filter((c) => c.official && /^https?:\/\//.test(c.official));
  const limited = LIMIT > 0 ? targets.slice(0, LIMIT) : targets;

  const results = new Map(); // id -> {status, data}
  let idx = 0;
  async function worker() {
    while (idx < limited.length) {
      const c = limited[idx++];
      const r = await crawlOne(c);
      if (r.fetchFailed) {
        results.set(c.id, { status: "failed" });
        console.log(`[skip] id=${c.id} ${c.name} ${c.official} => ${r.error}`);
      } else if (r.timeline) {
        results.set(c.id, {
          status: "ok",
          data: {
            regStart: r.timeline.regStart || null,
            regEnd: r.timeline.regEnd || null,
            eventStart: r.timeline.eventStart || null,
            eventEnd: r.timeline.eventEnd || null,
            source: hostOf(c.official),
            official: c.official,
            fetchedAt: new Date().toISOString(),
          },
        });
        console.log(`[ok] id=${c.id} ${c.name} => ` + JSON.stringify(r.timeline) + ` (pages=${r.pages})`);
      } else {
        results.set(c.id, { status: "none" });
        console.log(`[no] id=${c.id} ${c.name} ${c.official} (pages=${r.pages})`);
      }
      await new Promise((res) => setTimeout(res, 120));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const out = {};
  let kept = 0;
  for (const c of limited) {
    const r = results.get(c.id);
    const old = prev[c.id] && typeof prev[c.id] === "object" ? prev[c.id] : null;
    if (r && r.status === "ok") out[c.id] = { ...r.data };
    else if (r && r.status === "failed" && old && (old.regStart || old.regEnd || old.eventStart)) {
      out[c.id] = { ...old }; kept++; // 站点暂时连不上：保留上次结果
    }
  }
  out._meta = {
    fetchedAt: new Date().toISOString(),
    crawled: limited.length,
    live: Object.keys(out).filter((k) => k !== "_meta").length,
    keptPrevious: kept,
    note: "由 GitHub Actions 定时抓取各竞赛官网自动生成；标注「官网实时」的赛事时间为自动抓取结果，请以官网公告为准。",
  };

  const header = [
    "// 青科竞赛雷达 · 官网实时时间覆盖（由 scripts/fetch-live-dates.mjs 自动生成，请勿手改）",
    "// 命中项为自动抓取官网公告得到的报名/比赛时间；未命中项仍使用 data.js 中的目录数据。",
  ].join("\n");
  const body = "window.LIVE_OVERRIDES = " + JSON.stringify(out, null, 2) + ";";
  fs.writeFileSync(OUT_PATH, header + "\n" + body + "\n", "utf8");

  const s = { window: {} };
  vm.createContext(s);
  vm.runInContext(fs.readFileSync(OUT_PATH, "utf8"), s);
  const liveCount = Object.keys(s.window.LIVE_OVERRIDES).filter((k) => k !== "_meta").length;
  console.log(`\n抓取完成：官网 ${limited.length} 个，新抓 ${Array.from(results.values()).filter((x) => x.status === "ok").length} 个，覆盖 ${liveCount} 项（保留上次 ${kept} 项）→ ${OUT_PATH}`);
}

main().catch((e) => { console.error("运行失败:", e); process.exit(1); });
