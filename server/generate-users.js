#!/usr/bin/env node

/**
 * Utility script to generate `server/data/users.xlsx` by intersecting
 * the full user roster (`all.xlsx`) with the sign-in list (`signin.xlsx`).
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('node-xlsx');

const DATA_DIR = path.join(__dirname, 'data');
const SOURCE_ALL = path.join(DATA_DIR, 'all.xlsx');
const SOURCE_SIGNIN = path.join(DATA_DIR, 'signin.xlsx');
const TARGET_USERS = path.join(DATA_DIR, 'users.xlsx');

const HEADER_FALLBACK = ['工号', '姓名', '部门', '公司'];

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`未找到 ${label} 文件: ${filePath}`);
  }
}

function readFirstSheet(filePath, label) {
  ensureFileExists(filePath, label);
  const sheets = xlsx.parse(fs.readFileSync(filePath));
  if (!sheets.length || !Array.isArray(sheets[0].data)) {
    throw new Error(`${label} (${filePath}) 中没有可用数据`);
  }
  return sheets[0].data.filter((row) => Array.isArray(row) && row.length);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function buildKey(name, department) {
  const normalizedName = normalize(name);
  const normalizedDept = normalize(department);
  if (!normalizedName || !normalizedDept) {
    return null;
  }
  return `${normalizedName}||${normalizedDept}`;
}

function main() {
  const allSheet = readFirstSheet(SOURCE_ALL, '所有用户列表');
  if (!allSheet.length) {
    console.warn('所有用户列表为空，退出。');
    return;
  }

  const signinSheet = readFirstSheet(SOURCE_SIGNIN, '签到列表');
  if (signinSheet.length <= 1) {
    console.warn('签到列表缺少有效数据，退出。');
    return;
  }

  const [allHeaderRaw, ...allRows] = allSheet;
  const header = Array.isArray(allHeaderRaw) && allHeaderRaw.length ? allHeaderRaw : HEADER_FALLBACK;

  // 找到「请签到（必填）」列的索引
  const signinHeader = signinSheet[0];
  const signinColIndex = signinHeader.findIndex(
    (col) => String(col || '').includes('请签到')
  );
  if (signinColIndex === -1) {
    console.warn('签到列表中未找到「请签到（必填）」列，退出。');
    return;
  }

  const signinKeys = new Set();
  signinSheet.slice(1).forEach((row) => {
    const cellValue = String(row[signinColIndex] || '').trim();
    if (!cellValue) return;

    // 解析格式：「部门, 姓名, 桌号」，如「财务部, 李娟, 11桌」
    const parts = cellValue.split(/[,，]\s*/);
    if (parts.length >= 2) {
      const department = parts[0].trim();
      const name = parts[1].trim();
      const key = buildKey(name, department);
      if (key) {
        signinKeys.add(key);
      }
    }
  });

  const matchedRows = allRows.filter((row) => {
    const key = buildKey(row[1], row[2]);
    return key && signinKeys.has(key);
  });

  const workbook = xlsx.build([
    {
      name: 'users',
      data: [header, ...matchedRows],
    },
  ]);

  fs.writeFileSync(TARGET_USERS, workbook);
  console.log(`已生成 ${matchedRows.length} 条记录到 ${TARGET_USERS}`);
}

try {
  main();
} catch (error) {
  console.error(`生成 users.xlsx 失败: ${error.message}`);
  process.exitCode = 1;
}


