#!/usr/bin/env node

/**
 * Converts 年会最佳.xlsx into a compact JSON dataset that the
 * front-end can fetch without needing any third-party browser libraries.
 *
 * Usage:
 *   node build-annual-best-data.js
 *
 * Output:
 *   vote-data.json (overwrites on each run)
 */

const fs = require("fs");
const path = require("path");
const xlsx = require("node-xlsx");

const SOURCE_FILE = path.join(__dirname, "年会最佳.xlsx");
const OUTPUT_FILE = path.join(__dirname, "vote-data.json");

const COLUMN_ALIASES = {
  program: ["最佳节目（必填）", "最佳节目"],
  person: ["最佳COSPLAY个人（必填）", "最佳COSPLAY个人"]
};

function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel 数据文件不存在: ${filePath}`);
  }
}

function loadSheet() {
  const workSheets = xlsx.parse(SOURCE_FILE);
  if (!workSheets.length || !workSheets[0].data.length) {
    throw new Error("Excel 文件没有可读取的数据");
  }
  return workSheets[0].data;
}

function normalizeValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function findColumnIndex(headers, aliases) {
  if (!Array.isArray(headers)) {
    return -1;
  }
  return headers.findIndex(header => {
    const cell = normalizeValue(header);
    return aliases.includes(cell);
  });
}

function buildCounters(rows, columnIndex) {
  const counter = Object.create(null);
  rows.forEach(row => {
    const cellValue = normalizeValue(row[columnIndex]);
    if (!cellValue) {
      return;
    }
    // 多选结果用英文逗号分隔，拆分后逐个统计
    const choices = cellValue.split(",").map(s => s.trim()).filter(Boolean);
    choices.forEach(choice => {
      counter[choice] = (counter[choice] || 0) + 1;
    });
  });
  return Object.entries(counter)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label, "zh-Hans-CN");
    });
}

function main() {
  assertFileExists(SOURCE_FILE);
  const data = loadSheet();
  const headers = data[0];
  const rows = data.slice(1).filter(
    row => Array.isArray(row) && row.some(cell => normalizeValue(cell))
  );

  const columnIndexes = {
    program: findColumnIndex(headers, COLUMN_ALIASES.program),
    person: findColumnIndex(headers, COLUMN_ALIASES.person)
  };

  Object.entries(columnIndexes).forEach(([key, index]) => {
    if (index === -1) {
      throw new Error(`无法在 Excel 中找到 “${key}” 对应的列`);
    }
  });

  const result = {
    sourceFile: path.basename(SOURCE_FILE),
    updatedAt: new Date().toISOString(),
    totalSubmissions: rows.length,
    awards: {
      bestProgram: {
        title: "最佳节目",
        items: buildCounters(rows, columnIndexes.program)
      },
      bestCosplayPerson: {
        title: "最佳COSPLAY个人",
        items: buildCounters(rows, columnIndexes.person)
      }
    }
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), "utf8");
  console.log(
    `✅ 共有 ${rows.length} 份投票，结果已写入 ${path.relative(
      process.cwd(),
      OUTPUT_FILE
    )}`
  );
}

try {
  main();
} catch (err) {
  console.error("❌ 生成投票数据失败：", err.message);
  process.exit(1);
}
