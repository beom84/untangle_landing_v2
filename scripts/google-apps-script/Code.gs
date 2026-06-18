const SHEET_NAME = "registrations";

const HEADERS = [
  "createdAt",
  "submissionKey",
  "contactMode",
  "contactValue",
  "surveyStep",
  "painMoment",
  "currentMethods",
  "currentMethodsOther",
  "branchTarget",
  "branchChoice",
  "biggestGap",
  "surveyCompleted",
  "surveyCompletedAt",
  "updatedAt",
  "variant",
  "thoughtCategory",
  "thoughtCategoryOther",
];

function doGet() {
  return jsonResponse_({
    ok: true,
    service: "untangle-registration-survey",
    sheetName: SHEET_NAME,
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const payload = parsePayload_(e);
    const sheet = getSheet_();

    if (payload.action === "register") {
      upsertRegistration_(sheet, payload);
      return jsonResponse_({ ok: true, action: "register" });
    }

    if (payload.action === "survey") {
      upsertSurvey_(sheet, payload);
      return jsonResponse_({ ok: true, action: "survey" });
    }

    return jsonResponse_({ ok: false, error: "Unsupported action" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown script error";
    return jsonResponse_({ ok: false, error: message });
  } finally {
    lock.releaseLock();
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing request body");
  }

  return JSON.parse(e.postData.contents);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), HEADERS.length);
  const currentHeaders = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(normalizeHeader_);
  const needsMigration =
    lastColumn !== HEADERS.length ||
    HEADERS.some((header, index) => currentHeaders[index] !== header);

  if (!needsMigration) {
    sheet.setFrozenRows(1);
    return;
  }

  const existingRows =
    lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues() : [];
  const currentHeaderIndex = currentHeaders.reduce((lookup, header, index) => {
    if (header && lookup[header] === undefined) {
      lookup[header] = index;
    }
    return lookup;
  }, {});
  const migratedRows = existingRows.map((row) =>
    HEADERS.map((header) => {
      const columnIndex = currentHeaderIndex[header];
      return columnIndex === undefined ? "" : row[columnIndex] ?? "";
    }),
  );

  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  if (migratedRows.length > 0) {
    sheet.getRange(2, 1, migratedRows.length, HEADERS.length).setValues(migratedRows);
  }

  sheet.setFrozenRows(1);
}

function upsertRegistration_(sheet, payload) {
  validateRequired_(payload, [
    "submissionKey",
    "createdAt",
    "contactMode",
    "contactValue",
  ]);

  const rowIndex = findRowIndexBySubmissionKey_(sheet, payload.submissionKey);
  const record = getRowRecord_(sheet, rowIndex);

  record.createdAt = payload.createdAt;
  record.submissionKey = payload.submissionKey;
  record.contactMode = payload.contactMode;
  record.contactValue = payload.contactValue;
  record.updatedAt = payload.createdAt;
  record.variant = payload.variant || record.variant || "";

  writeRecord_(sheet, rowIndex, record);
}

function upsertSurvey_(sheet, payload) {
  validateRequired_(payload, ["submissionKey", "surveyStep"]);

  const rowIndex = findRowIndexBySubmissionKey_(sheet, payload.submissionKey);
  const record = getRowRecord_(sheet, rowIndex);

  record.submissionKey = payload.submissionKey;
  record.surveyStep = payload.surveyStep;
  record.thoughtCategory = payload.thoughtCategory || "";
  record.thoughtCategoryOther = payload.thoughtCategoryOther || "";
  record.painMoment = payload.painMoment || "";
  record.currentMethods = normalizeMethods_(payload.currentMethods);
  record.currentMethodsOther = payload.currentMethodsOther || "";
  record.branchTarget = normalizeBranchTarget_(
    payload.branchTarget,
    payload.currentMethods,
  );
  record.branchChoice = normalizeBranchChoice_(payload.branchChoice);
  record.biggestGap = payload.biggestGap || "";
  record.surveyCompleted = Boolean(payload.surveyCompleted);
  record.surveyCompletedAt = payload.surveyCompletedAt || "";
  record.updatedAt = payload.updatedAt || new Date().toISOString();
  record.variant = payload.variant || record.variant || "";

  writeRecord_(sheet, rowIndex, record);
}

function validateRequired_(payload, fields) {
  const missing = fields.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || value === "";
  });

  if (missing.length > 0) {
    throw new Error("Missing fields: " + missing.join(", "));
  }
}

function normalizeMethods_(value) {
  if (!Array.isArray(value)) {
    return "";
  }

  return value.join(", ");
}

function normalizeBranchChoice_(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBranchTarget_(branchTarget, currentMethods) {
  const allowed = ["adhd_app", "ai", "none", "general_methods"];
  if (typeof branchTarget === "string" && allowed.indexOf(branchTarget) !== -1) {
    return branchTarget;
  }

  return computeBranchTarget_(currentMethods);
}

function computeBranchTarget_(currentMethods) {
  if (!Array.isArray(currentMethods)) {
    return "general_methods";
  }

  if (currentMethods.indexOf("adhd_app") !== -1) {
    return "adhd_app";
  }

  if (currentMethods.indexOf("ai") !== -1) {
    return "ai";
  }

  if (currentMethods.indexOf("none") !== -1 || currentMethods.indexOf("endure") !== -1) {
    return "none";
  }

  return "general_methods";
}

function findRowIndexBySubmissionKey_(sheet, submissionKey) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return null;
  }

  const keyColumn = HEADERS.indexOf("submissionKey") + 1;
  const values = sheet.getRange(2, keyColumn, lastRow - 1, 1).getValues();
  const offset = values.findIndex((row) => row[0] === submissionKey);

  return offset === -1 ? null : offset + 2;
}

function getRowRecord_(sheet, rowIndex) {
  if (!rowIndex) {
    return createEmptyRecord_();
  }

  const values = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
  return HEADERS.reduce((record, header, index) => {
    record[header] = values[index];
    return record;
  }, createEmptyRecord_());
}

function createEmptyRecord_() {
  return HEADERS.reduce((record, header) => {
    record[header] = "";
    return record;
  }, {});
}

function writeRecord_(sheet, rowIndex, record) {
  const values = HEADERS.map((header) => record[header] ?? "");

  if (rowIndex) {
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([values]);
    return;
  }

  sheet.appendRow(values);
}

function jsonResponse_(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function normalizeHeader_(value) {
  return typeof value === "string" ? value.trim() : "";
}
