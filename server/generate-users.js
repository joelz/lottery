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

  const signinKeys = new Set();
  signinSheet.slice(1).forEach((row) => {
    const key = buildKey(row[0], row[1]);
    if (key) {
      signinKeys.add(key);
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


