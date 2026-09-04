import {
  JOB_FAMILIES,
  type Band,
  type Filters,
  type GroupByField,
  type JobFamily,
  type Metric,
  type OverviewIR,
  type QueryIR,
  type Refusal,
} from "@/lib/query-ir";
import type { LLMProvider } from "./provider";

/**
 * A deterministic, rule-based stand-in for a real model. Good enough to demo
 * every metric, filter, groupBy, and refusal path with no API key and no
 * network. It returns `unknown` like any provider — the pipeline still
 * validates it against the schema.
 *
 * Destructive / off-topic intent is checked BEFORE any metric keyword, so
 * "delete all hire records" is refused rather than mis-parsed into hire_count
 * just because it contains "hire".
 */
export class MockProvider implements LLMProvider {
  proposeQueryIR(question: string): Promise<unknown> {
    return Promise.resolve(interpret(question));
  }
}

// --- intent guards (run first) -------------------------------------------

const WRITE_INTENT =
  /\b(delete|drop|remove|truncate|wipe|erase|insert|update|modify|change|edit|alter|set|reset|overwrite|purge|create)\b/;

const OFF_TOPIC =
  /\b(weather|forecast\s+for|joke|recipe|stock\s+price|score|movie|song|lyrics|capital\s+of|president|translate|currency|bitcoin|horoscope|poem)\b/;

const UNSUPPORTED_METRIC =
  /\b(median|percentile|trend|over\s+time|month[- ]over[- ]month|year[- ]over[- ]year|forecast|project(ion|ed)?|ratio|per\s+cent|percentage|attrition|turnover|retention\s+rate|offer\s+acceptance|pipeline\s+conversion|cost\s+per\s+hire|diversity)\b/;

// A broad "the whole picture" request — not one metric. Answered by running
// every applicable metric under the detected filters and composing sections.
const OVERVIEW_INTENT =
  /\b(summary|overview|recap|rundown|round[- ]?up|snapshot|dashboard|hiring report|recruiting report|full picture|big picture|state of (hiring|recruiting|things)|how(?:'?s| is| are)\s+(?:our\s+)?(hiring|recruiting|things|we)\s+(doing|going|looking|tracking)|everything (that )?(happened|going on)|all (?:the |our )?(metrics|numbers|stats|figures|hiring data)|tell me about (?:our|the)\s+(hiring|recruiting|quarter|year))\b/;

// --- domain vocabulary --------------------------------------------------

const HIRING_TERMS =
  /\b(hire|hires|hired|hiring|headcount|head\s?count|employee|employees|staff|req|reqs|requisition|requisitions|role|roles|position|positions|vacanc|open|fill|filled|time[- ]to[- ]fill|band|junior|mid|senior|team|family|families|department|recruit)\b/;

// --- metric detection (order matters) ---------------------------------

function detectMetric(q: string): Metric | null {
  if (
    /\b(time[- ]to[- ]fill|time\s+to\s+fill|days\s+to\s+fill|fill\s+time|how\s+long.*(fill|close))\b/.test(
      q,
    )
  ) {
    return "avg_time_to_fill";
  }
  const mentionsHeadcount =
    /\b(headcount|head\s?count|active\s+employees|how\s+many\s+(people|employees|staff)|team\s+size|staff\s+count)\b/.test(
      q,
    );
  const byBand =
    /\b(by|per|across|split\s+by|broken\s+out\s+by|grouped\s+by)\s+(band|level|seniority)\b/.test(
      q,
    );
  if (mentionsHeadcount && byBand) return "headcount_by_band";
  if (/\bheadcount\s+by\s+band\b/.test(q)) return "headcount_by_band";
  if (
    /\b(open|unfilled|active)\s+(req|reqs|requisition|requisitions|role|roles|position|positions|job|jobs|headcount)\b/.test(
      q,
    )
  ) {
    return "open_reqs";
  }
  if (/\b(vacanc(y|ies)|roles?\s+(are\s+)?open|positions?\s+(are\s+)?open|openings)\b/.test(q)) {
    return "open_reqs";
  }
  if (mentionsHeadcount) return "headcount";
  // "hire/hires/hired" — deliberately NOT bare "hiring", which is too vague to
  // pin to a metric ("tell me about our hiring" -> ambiguous, not hire_count).
  if (/\b(hire|hires|hired)\b/.test(q)) return "hire_count";
  return null;
}

// --- filter + groupBy detection --------------------------------------

function detectJobFamily(q: string): JobFamily | undefined {
  for (const family of JOB_FAMILIES) {
    if (new RegExp(`\\b${family.toLowerCase()}\\b`).test(q)) return family;
  }
  if (/\beng\b/.test(q)) return "Engineering";
  return undefined;
}

function detectBand(q: string): Band | undefined {
  if (/\bjunior\b|\bjr\.?\b/.test(q)) return "Junior";
  if (/\bmid[- ]?level\b|\bmid\b/.test(q)) return "Mid";
  if (/\bsenior\b|\bsr\.?\b/.test(q)) return "Senior";
  // Require band context for "staff" so it isn't confused with "staff count".
  if (/\bstaff[- ]?level\b|\bstaff\s+(engineer|band|employees|hires?)\b|\bband\s+staff\b/.test(q)) {
    return "Staff";
  }
  return undefined;
}

function detectGroupBy(q: string): GroupByField | undefined {
  if (
    /\b(by|per|across|grouped\s+by|split\s+by|broken\s+out\s+by)\s+(band|level|seniority)\b/.test(q)
  ) {
    return "band";
  }
  if (
    /\b(by|per|across|grouped\s+by|split\s+by|broken\s+out\s+by)\s+(job\s+)?(family|families|function|department|departments|team|teams|org)\b/.test(
      q,
    )
  ) {
    return "jobFamily";
  }
  return undefined;
}

const MONTH_END: Record<string, string> = {
  "01": "31",
  "02": "28",
  "03": "31",
  "04": "30",
  "05": "31",
  "06": "30",
  "07": "31",
  "08": "31",
  "09": "30",
  "10": "31",
  "11": "30",
  "12": "31",
};

function detectDateRange(q: string): { from: string; to: string } | undefined {
  // Relative years, resolved against the current date.
  const thisYear = new Date().getUTCFullYear();
  if (/\b(this|current)\s+(calendar\s+)?year\b/.test(q)) {
    return { from: `${thisYear}-01-01`, to: `${thisYear}-12-31` };
  }
  if (/\b(last|previous|prior)\s+year\b/.test(q)) {
    return { from: `${thisYear - 1}-01-01`, to: `${thisYear - 1}-12-31` };
  }

  const explicit = q.match(
    /(\d{4}-\d{2}-\d{2})\s*(?:to|and|through|-|–|until)\s*(\d{4}-\d{2}-\d{2})/,
  );
  if (explicit) return { from: explicit[1] as string, to: explicit[2] as string };

  const quarter = q.match(/\bq([1-4])\s*(?:of\s*)?(\d{4})\b/) ?? q.match(/\b(\d{4})\s*q([1-4])\b/);
  if (quarter) {
    const isQfirst = quarter[0].toLowerCase().startsWith("q");
    const qn = Number(isQfirst ? quarter[1] : quarter[2]);
    const year = isQfirst ? quarter[2] : quarter[1];
    const startMonth = (qn - 1) * 3 + 1;
    const from = `${year}-${String(startMonth).padStart(2, "0")}-01`;
    const endMonthStr = String(startMonth + 2).padStart(2, "0");
    return { from, to: `${year}-${endMonthStr}-${MONTH_END[endMonthStr]}` };
  }

  const year = q.match(/\b(in|during|for)\s+(20\d{2})\b/) ?? q.match(/\b(20\d{2})\b/);
  if (year) {
    const y = year[2] ?? year[1];
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  return undefined;
}

// --- assembly --------------------------------------------------------

function refusal(reason: Refusal["reason"], message: string): Refusal {
  return { refusal: true, reason, message };
}

function interpret(question: string): QueryIR | OverviewIR | Refusal {
  const q = ` ${question.toLowerCase().trim()} `;

  // 1. Any write / destructive intent — read-only tool, checked before metrics.
  if (WRITE_INTENT.test(q)) {
    return refusal(
      "out_of_scope",
      "This assistant is read-only and cannot change, add, or delete any records.",
    );
  }

  // 2. Clearly not about the hiring dataset.
  if (OFF_TOPIC.test(q)) {
    return refusal("out_of_scope", "I can only answer questions about this hiring dataset.");
  }

  // 3. A hiring question, but for a metric we do not support.
  if (UNSUPPORTED_METRIC.test(q)) {
    return refusal(
      "unsupported_metric",
      "That metric isn't supported. I can report hire count, open reqs, headcount, average time to fill, and headcount by band.",
    );
  }

  // 4. Pick a metric.
  const metric = detectMetric(q);

  // 5. Filters (shared by a single-metric query and an overview).
  const filters: Filters = {};
  const jobFamily = detectJobFamily(q);
  if (jobFamily) filters.jobFamily = jobFamily;
  const band = detectBand(q);
  if (band) filters.band = band;
  const dateRange = detectDateRange(q);
  if (dateRange) filters.dateRange = dateRange;

  // 6. No single metric: a broad "whole picture" question becomes an overview;
  //    a vague hiring question with no breadth signal is still ambiguous.
  if (!metric) {
    if (OVERVIEW_INTENT.test(q)) {
      return { version: 1, overview: true, filters };
    }
    return HIRING_TERMS.test(q)
      ? refusal(
          "ambiguous",
          "Please ask about a specific metric: hire count, open reqs, headcount, average time to fill, or headcount by band. Or ask for a summary to see them all.",
        )
      : refusal("out_of_scope", "I can only answer questions about this hiring dataset.");
  }

  // 7. Single-metric query.
  const groupBy = detectGroupBy(q);
  const ir: QueryIR = { version: 1, metric, filters };
  if (groupBy && metric !== "headcount_by_band") ir.groupBy = groupBy;
  return ir;
}
