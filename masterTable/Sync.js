/**
 * Google Apps Script for syncing Google Sheets with Eevee Studio Admin
 *
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Go to Extensions → Apps Script
 * 3. Replace the default code with this entire file
 * 4. Update the CONFIG section below with your values
 * 5. Save the script
 * 6. Run onOpen() once to add the Sync menu
 *
 * USAGE:
 * - Click "Sync" menu → "Push to Admin" to sync current sheet to Admin database
 * - You can also add a button and assign the syncToAdmin function
 */

// ==================== CONFIG ====================
// Update these values for your setup

const CONFIG = {
  // Production Admin server URL (no trailing slash)
  ADMIN_URL: "https://studio.moelive.io",

  // Development Admin server URL (no trailing slash)
  DEV_ADMIN_URL: "https://studio-dev.moelive.io",
};

// ==================== API KEY MANAGEMENT ====================

/**
 * Gets the stored API key for specified environment
 * @param {"prod" | "dev"} env - Target environment
 * @returns {string|null} The API key or null if not set
 */
function getApiKey(env) {
  const key = env === "prod" ? "EEVEE_API_KEY_PROD" : "EEVEE_API_KEY_DEV";
  return PropertiesService.getUserProperties().getProperty(key);
}

/**
 * Saves the API key for specified environment
 * @param {"prod" | "dev"} env - Target environment
 * @param {string} apiKey - The API key to save
 */
function setApiKey(env, apiKey) {
  const key = env === "prod" ? "EEVEE_API_KEY_PROD" : "EEVEE_API_KEY_DEV";
  PropertiesService.getUserProperties().setProperty(key, apiKey);
}

/**
 * Prompts user to enter Production API key
 */
function promptSetApiKeyProd() {
  promptSetApiKey_("prod");
}

/**
 * Prompts user to enter Development API key
 */
function promptSetApiKeyDev() {
  promptSetApiKey_("dev");
}

/**
 * Internal function to prompt for API key
 * @param {"prod" | "dev"} env - Target environment
 */
function promptSetApiKey_(env) {
  const ui = SpreadsheetApp.getUi();
  const envLabel = env === "prod" ? "Production" : "Development";
  const currentKey = getApiKey(env);

  const prompt = currentKey
    ? `Current ${envLabel} API key: ${currentKey.substring(0, 10)}....\n\nEnter new API key (or cancel to keep current):`
    : `Enter your ${envLabel} API key (format: st_xxxxx...):`;

  const response = ui.prompt(`Set ${envLabel} API Key`, prompt, ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() === ui.Button.OK) {
    const newKey = response.getResponseText().trim();
    if (newKey) {
      setApiKey(env, newKey);
      SpreadsheetApp.getActiveSpreadsheet().toast(`${envLabel} API key saved successfully!`, "✅ Success", 3);
    } else {
      ui.alert("Error", "API key cannot be empty.", ui.ButtonSet.OK);
    }
  }
}

/**
 * Clears Production API key
 */
function clearApiKeyProd() {
  clearApiKey_("prod");
}

/**
 * Clears Development API key
 */
function clearApiKeyDev() {
  clearApiKey_("dev");
}

/**
 * Internal function to clear API key
 * @param {"prod" | "dev"} env - Target environment
 */
function clearApiKey_(env) {
  const ui = SpreadsheetApp.getUi();
  const envLabel = env === "prod" ? "Production" : "Development";
  const key = env === "prod" ? "EEVEE_API_KEY_PROD" : "EEVEE_API_KEY_DEV";

  const response = ui.alert(
    `Clear ${envLabel} API Key`,
    `Are you sure you want to remove the ${envLabel} API key?`,
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    PropertiesService.getUserProperties().deleteProperty(key);
    SpreadsheetApp.getActiveSpreadsheet().toast(`${envLabel} API key cleared.`, "✅ Success", 3);
  }
}

// Sheet ID for the mapping configuration sheet
// This sheet should have columns: sheetName, tableName, exact, filters
const MAPPING_SHEET_ID = 1436172190;

/**
 * Reads the mapping configuration from the dedicated mapping sheet
 * @returns {Object} Map of sheetName -> { tableName, exact, filters }
 */
function getSheetTableMap() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = spreadsheet.getSheets();

  // Find the mapping sheet by ID
  const mappingSheet = sheets.find((s) => s.getSheetId() === MAPPING_SHEET_ID);

  if (!mappingSheet) {
    console.warn(`Mapping sheet with ID ${MAPPING_SHEET_ID} not found. Using default kebab-case conversion.`);
    return {};
  }

  const data = mappingSheet.getDataRange().getValues();

  // First row is header: sheetName, tableName, exact, filters
  const headers = data[0];
  const sheetNameIdx = headers.indexOf("sheetName");
  const tableNameIdx = headers.indexOf("tableName");
  const exactIdx = headers.indexOf("pushExact");
  const pullExactIdx = headers.indexOf("pullExact");
  const filtersIdx = headers.indexOf("filters");

  if (sheetNameIdx === -1 || tableNameIdx === -1) {
    console.warn("Mapping sheet missing required columns (sheetName, tableName)");
    return {};
  }

  const map = {};

  // Skip header row
  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    const sheetName = row[sheetNameIdx];
    const tableName = row[tableNameIdx];

    if (!sheetName || !tableName) continue;

    const config = { tableName };

    // Parse exact (boolean)
    if (exactIdx !== -1 && row[exactIdx] !== "" && row[exactIdx] !== null) {
      const exactValue = row[exactIdx];
      config.exact = exactValue === true || exactValue === "TRUE" || exactValue === "true";
    }

    // Parse pullExact (boolean)
    if (pullExactIdx !== -1 && row[pullExactIdx] !== "" && row[pullExactIdx] !== null) {
      const pullExactValue = row[pullExactIdx];
      config.pullExact = pullExactValue === true || pullExactValue === "TRUE" || pullExactValue === "true";
    }

    // Parse filters (JSON)
    if (filtersIdx !== -1 && row[filtersIdx] && row[filtersIdx] !== "") {
      try {
        const filtersValue = row[filtersIdx];
        config.filters = typeof filtersValue === "string" ? JSON.parse(filtersValue) : filtersValue;
      } catch (e) {
        console.warn(`Failed to parse filters for sheet "${sheetName}": ${e.message}`);
      }
    }

    map[sheetName] = config;
  }

  return map;
}

// ==================== MAIN FUNCTIONS ====================

/**
 * Syncs the currently active sheet to Production Admin
 */
function syncToAdmin() {
  syncSheet_("prod");
}

/**
 * Syncs the currently active sheet to Development Admin
 */
function syncToDevAdmin() {
  syncSheet_("dev");
}

/**
 * Pulls data from Production Admin (DB -> Sheet) for the currently active sheet.
 */
function pullFromAdmin() {
  pullSheet_("prod", { exact: undefined });
}

/**
 * Pulls data from Development Admin (DB -> Sheet) for the currently active sheet.
 */
function pullFromDevAdmin() {
  pullSheet_("dev", { exact: undefined });
}

/**
 * Exact pull from Production Admin (DB -> Sheet) for the currently active sheet.
 * Overwrites data rows (below header/desc/type) to match DB.
 */
function exactPullFromAdmin() {
  pullSheet_("prod", { exact: true });
}

/**
 * Exact pull from Development Admin (DB -> Sheet) for the currently active sheet.
 * Overwrites data rows (below header/desc/type) to match DB.
 */
function exactPullFromDevAdmin() {
  pullSheet_("dev", { exact: true });
}

/**
 * Internal function to sync sheet to specified environment
 * @param {"prod" | "dev"} env - Target environment
 */
function syncSheet_(env) {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const sheetName = sheet.getName();

  // Get mapping configuration
  const sheetTableMap = getSheetTableMap();
  const config = sheetTableMap[sheetName] || {};

  // Get table name from mapping or convert sheet name to kebab-case
  const tableName = config.tableName || toKebabCase(sheetName);
  const envLabel = env === "prod" ? "Production" : "Development";

  // Production sync requires additional confirmation
  if (env === "prod") {
    const confirmation = ui.alert(
      "⚠️ Production Sync Confirmation",
      `You are about to sync "${sheetName}" to PRODUCTION database.\n\nTable: ${tableName}\nThis will modify live data.\n\nAre you sure you want to continue?`,
      ui.ButtonSet.YES_NO
    );

    if (confirmation !== ui.Button.YES) {
      SpreadsheetApp.getActiveSpreadsheet().toast("Production sync cancelled.", "Cancelled", 3);
      return;
    }
  }

  try {
    // Convert sheet to CSV
    const csvData = sheetToCsv(sheet);

    // Call webhook with optional exact and filters
    const result = callWebhook({
      tableName,
      csvData,
      env,
      exact: config.exact,
      filters: config.filters,
    });

    // Show result
    showSyncResult(result, sheetName, tableName, envLabel);
  } catch (error) {
    showSyncError(error, sheetName, tableName, envLabel);
    console.error("Sync error:", error);
  }
}

/**
 * Internal function to pull data from Admin (DB -> Sheet) for the active sheet.
 * @param {"prod" | "dev"} env - Target environment
 * @param {{ exact: boolean | undefined }} options - Pull options
 */
function pullSheet_(env, options) {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = sheet.getName();

  // Get mapping configuration
  const sheetTableMap = getSheetTableMap();
  const config = sheetTableMap[sheetName] || {};

  // Get table name from mapping or convert sheet name to kebab-case
  const tableName = config.tableName || toKebabCase(sheetName);
  const envLabel = env === "prod" ? "Production" : "Development";

  // Determine exact mode: explicit option overrides mapping, otherwise use mapping pullExact
  const exact = options && options.exact !== undefined ? options.exact : config.pullExact;

  // Production pull requires confirmation
  if (env === "prod") {
    const confirmation = ui.alert(
      "⚠️ Production Pull Confirmation",
      `You are about to PULL "${sheetName}" from PRODUCTION database.\n\nTable: ${tableName}\nExact: ${exact ? "true" : "false"}\n\nThis will overwrite sheet data rows (below header/desc/type) depending on exact.\n\nContinue?`,
      ui.ButtonSet.YES_NO
    );
    if (confirmation !== ui.Button.YES) {
      spreadsheet.toast("Production pull cancelled.", "Cancelled", 3);
      return;
    }
  }

  try {
    spreadsheet.toast(`Pulling from ${envLabel}...`, "⏳ Pull", 5);

    const result = callPullWebhook({
      tableName,
      sheetName,
      spreadsheetId: spreadsheet.getId(),
      env,
      exact,
      filters: config.filters,
    });

    showPullResult(result, sheetName, tableName, envLabel);
  } catch (error) {
    showSyncError(error, sheetName, tableName, envLabel);
    console.error("Pull error:", error);
  }
}

/**
 * Syncs all sheets to Production Admin
 */
function syncAllSheetsToAdmin() {
  syncAllSheets_("prod");
}

/**
 * Syncs all sheets to Development Admin
 */
function syncAllSheetsToDevAdmin() {
  syncAllSheets_("dev");
}

/**
 * Internal function to sync all sheets to specified environment
 * @param {"prod" | "dev"} env - Target environment
 */
function syncAllSheets_(env) {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const envLabel = env === "prod" ? "Production" : "Development";

  // Production requires extra confirmation
  if (env === "prod") {
    const firstConfirm = ui.alert(
      "⚠️ Production Sync - All Sheets",
      `You are about to sync ALL sheets to PRODUCTION database.\n\nThis will modify live data for multiple tables.\n\nAre you sure?`,
      ui.ButtonSet.YES_NO
    );

    if (firstConfirm !== ui.Button.YES) {
      spreadsheet.toast("Production sync cancelled.", "Cancelled", 3);
      return;
    }

    // Second confirmation for production
    const secondConfirm = ui.alert(
      "🚨 Final Confirmation",
      `FINAL WARNING: This action will sync all sheets to PRODUCTION.\n\nType 'YES' mentally and click OK to proceed.`,
      ui.ButtonSet.OK_CANCEL
    );

    if (secondConfirm !== ui.Button.OK) {
      spreadsheet.toast("Production sync cancelled.", "Cancelled", 3);
      return;
    }
  } else {
    const response = ui.alert(
      `Sync All Sheets to ${envLabel}`,
      `This will sync ALL sheets to ${envLabel} Admin. Continue?`,
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      return;
    }
  }

  const sheets = spreadsheet.getSheets();
  const results = [];

  // Get mapping configuration once
  const sheetTableMap = getSheetTableMap();

  for (const sheet of sheets) {
    const sheetName = sheet.getName();

    // Skip hidden sheets, sheets starting with _, and the mapping sheet itself
    if (sheet.isSheetHidden() || sheetName.startsWith("#") || sheet.getSheetId() === MAPPING_SHEET_ID) {
      continue;
    }

    const config = sheetTableMap[sheetName] || {};
    const tableName = config.tableName || toKebabCase(sheetName);

    try {
      const csvData = sheetToCsv(sheet);
      const result = callWebhook({
        tableName,
        csvData,
        env,
        exact: config.exact,
        filters: config.filters,
      });
      results.push({
        sheet: sheetName,
        table: tableName,
        success: true,
        summary: result.summary,
      });
    } catch (error) {
      results.push({
        sheet: sheetName,
        table: tableName,
        success: false,
        error: error.message,
      });
    }
  }

  // Show summary
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  if (failCount > 0) {
    // Show alert for failures
    let message = `[${envLabel}] Synced ${successCount} sheets successfully.\n`;
    message += `${failCount} sheets failed.\n\n`;
    message += "Failed sheets:\n";
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        message += `- ${r.sheet}: ${r.error}\n`;
      });
    ui.alert("Sync Complete with Errors", message, ui.ButtonSet.OK);
  } else {
    // Show toast for success
    spreadsheet.toast(`Successfully synced ${successCount} sheets.`, `✅ ${envLabel} Sync Complete`, 5);
  }
}

/**
 * Tests the connection to Production Admin server
 */
function testConnectionProd() {
  testConnection_("prod");
}

/**
 * Tests the connection to Development Admin server
 */
function testConnectionDev() {
  testConnection_("dev");
}

/**
 * Internal function to test connection to specified environment
 * @param {"prod" | "dev"} env - Target environment
 */
function testConnection_(env) {
  const ui = SpreadsheetApp.getUi();
  const baseUrl = env === "prod" ? CONFIG.ADMIN_URL : CONFIG.DEV_ADMIN_URL;
  const envLabel = env === "prod" ? "Production" : "Development";

  try {
    // Simple test - try to access the API
    const response = UrlFetchApp.fetch(`${baseUrl}/api/health`, {
      method: "get",
      muteHttpExceptions: true,
    });

    const status = response.getResponseCode();

    if (status === 200 || status === 404) {
      ui.alert(
        `${envLabel} Connection Test`,
        `✅ Connection successful!\n\nServer: ${baseUrl}\nStatus: ${status}`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        `${envLabel} Connection Test`,
        `⚠️ Server responded with status ${status}\n\nServer: ${baseUrl}`,
        ui.ButtonSet.OK
      );
    }
  } catch (error) {
    ui.alert(
      `${envLabel} Connection Test`,
      `❌ Connection failed!\n\nServer: ${baseUrl}\nError: ${error.message}`,
      ui.ButtonSet.OK
    );
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Converts camelCase or PascalCase to kebab-case
 * Also handles spaces and existing hyphens
 * Examples:
 *   "labAssets" -> "lab-assets"
 *   "globalConfig" -> "global-config"
 *   "MySheetName" -> "my-sheet-name"
 *   "already-kebab" -> "already-kebab"
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2") // Insert hyphen between camelCase
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2") // Handle consecutive caps like "XMLParser" -> "xml-parser"
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .toLowerCase();
}

/**
 * Converts a sheet to CSV format
 * Handles commas, quotes, and newlines in cell values
 */
function sheetToCsv(sheet) {
  const data = sheet.getDataRange().getValues();
  const rows = [];

  for (const row of data) {
    const csvRow = row.map((cell) => {
      // Convert cell to string
      let value = cell === null || cell === undefined ? "" : String(cell);

      // Handle dates
      if (cell instanceof Date) {
        value = cell.toISOString();
      }

      // Handle booleans
      if (typeof cell === "boolean") {
        value = cell ? "true" : "false";
      }

      // Escape quotes and wrap in quotes if contains special chars
      if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
        value = '"' + value.replace(/"/g, '""') + '"';
      }

      return value;
    });

    rows.push(csvRow.join(","));
  }

  return rows.join("\n");
}

/**
 * Calls the Admin webhook endpoint
 */
function callWebhook(params) {
  const { tableName, csvData, env = "prod", exact, filters } = params;

  const envLabel = env === "prod" ? "Production" : "Development";
  const apiKey = getApiKey(env);
  if (!apiKey) {
    throw new Error(`${envLabel} API key not set. Please set it via Sync → ${envLabel} → Set API Key`);
  }

  const baseUrl = env === "prod" ? CONFIG.ADMIN_URL : CONFIG.DEV_ADMIN_URL;
  const url = `${baseUrl}/api/sync/google-sheets/webhook/push`;

  // API key is sent in the body, not in headers
  const payload = {
    tableName,
    csvData,
    apiKey,
  };

  // Add optional exact and filters if provided
  if (exact !== undefined) {
    payload.exact = exact;
  }
  if (filters !== undefined) {
    payload.filters = filters;
  }

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch (e) {
    responseData = { error: responseText };
  }

  if (responseCode !== 200) {
    // Throw error with full response data for detailed error display
    const error = new Error(responseData.error || `HTTP ${responseCode}`);
    error.responseData = responseData;
    error.statusCode = responseCode;
    throw error;
  }

  return responseData;
}

/**
 * Calls the Admin pull webhook endpoint (DB -> Sheet)
 */
function callPullWebhook(params) {
  const { tableName, sheetName, spreadsheetId, env = "prod", exact, filters } = params;

  const envLabel = env === "prod" ? "Production" : "Development";
  const apiKey = getApiKey(env);
  if (!apiKey) {
    throw new Error(`${envLabel} API key not set. Please set it via Sync → ${envLabel} → Set API Key`);
  }

  const baseUrl = env === "prod" ? CONFIG.ADMIN_URL : CONFIG.DEV_ADMIN_URL;
  const url = `${baseUrl}/api/sync/google-sheets/webhook/pull`;

  const payload = {
    tableName,
    sheetName,
    spreadsheetId,
    apiKey,
  };

  if (exact !== undefined) {
    payload.exact = exact;
  }
  if (filters !== undefined) {
    payload.filters = filters;
  }

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch (e) {
    responseData = { error: responseText };
  }

  if (responseCode !== 200) {
    const error = new Error(responseData.error || `HTTP ${responseCode}`);
    error.responseData = responseData;
    error.statusCode = responseCode;
    throw error;
  }

  return responseData;
}

/**
 * Shows the pull result as a toast notification
 * @param {Object} result - Result from pull webhook
 * @param {string} sheetName - Name of the target sheet
 * @param {string} tableName - Name of the source table
 * @param {string} envLabel - Environment label
 */
function showPullResult(result, sheetName, tableName, envLabel) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  if (!result || !result.success) {
    ui.alert("Pull Error", `Failed to pull: ${(result && result.error) || "Unknown error"}`, ui.ButtonSet.OK);
    return;
  }

  const details = result.details || {};
  const updated = details.rowsUpdated !== undefined ? details.rowsUpdated : "?";
  const inserted = details.rowsInserted !== undefined ? details.rowsInserted : "?";
  const fetched = details.rowsFetched !== undefined ? details.rowsFetched : "?";
  const toastMessage = `Fetched: ${fetched}, Updated: ${updated}, Inserted: ${inserted}`;

  spreadsheet.toast(toastMessage, `✅ ${envLabel} Pull: ${sheetName}`, 6);
}

/**
 * Shows detailed sync error in a dialog
 * @param {Error} error - The error object with optional responseData
 * @param {string} sheetName - Name of the synced sheet
 * @param {string} tableName - Name of the target table
 * @param {string} envLabel - Environment label (Production/Development)
 */
function showSyncError(error, sheetName, tableName, envLabel) {
  const ui = SpreadsheetApp.getUi();
  const responseData = error.responseData || {};
  const statusCode = error.statusCode || "Unknown";

  const lines = [
    `❌ Sync Failed`,
    ``,
    `Environment: ${envLabel}`,
    `Sheet: ${sheetName}`,
    `Table: ${tableName}`,
    `Status: ${statusCode}`,
    ``,
    `Error: ${error.message}`,
  ];

  // Add hint if available (e.g., for table not found)
  if (responseData.hint) {
    lines.push(``, `💡 Hint: ${responseData.hint}`);
  }

  // Add details if available (e.g., validation errors, bulk operation errors)
  if (responseData.details) {
    lines.push(``, `Details:`);
    if (Array.isArray(responseData.details)) {
      responseData.details.slice(0, 5).forEach((detail) => {
        lines.push(`  • ${detail}`);
      });
      if (responseData.details.length > 5) {
        lines.push(`  ... and ${responseData.details.length - 5} more`);
      }
    } else {
      lines.push(`  ${responseData.details}`);
    }
  }

  // Add summary if available (e.g., for "no valid rows" error)
  if (responseData.summary) {
    const s = responseData.summary;
    lines.push(``, `Parse Summary:`, `  Total: ${s.total}, Valid: ${s.valid}, Invalid: ${s.invalid}`);
  }

  // Add invalid rows if available
  if (responseData.invalidRows && responseData.invalidRows.length > 0) {
    lines.push(``, `Invalid Rows (first ${Math.min(5, responseData.invalidRows.length)}):`);
    responseData.invalidRows.slice(0, 5).forEach((row, idx) => {
      const rowNum = row.row || idx + 1;
      const errors = row.errors ? row.errors.join(", ") : "Unknown error";
      lines.push(`  Row ${rowNum}: ${errors}`);
    });
    if (responseData.invalidRows.length > 5) {
      lines.push(`  ... and ${responseData.invalidRows.length - 5} more invalid rows`);
    }
  }

  ui.alert(`${envLabel} Sync Error`, lines.join("\n"), ui.ButtonSet.OK);
}

/**
 * Shows the sync result as a toast notification
 * For results with warnings/errors, shows a dialog instead
 * @param {Object} result - Sync result from webhook
 * @param {string} sheetName - Name of the synced sheet
 * @param {string} tableName - Name of the target table
 * @param {string} envLabel - Environment label (Production/Development)
 */
function showSyncResult(result, sheetName, tableName, envLabel) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  if (result.success) {
    const summary = result.summary;
    const hasWarnings = (result.errors && result.errors.length > 0) || result.invalidRowsCount > 0;

    // If there are warnings or errors, show detailed dialog
    if (hasWarnings) {
      const lines = [
        `✅ Sync completed with warnings`,
        ``,
        `Environment: ${envLabel}`,
        `Sheet: ${sheetName}`,
        `Table: ${tableName}`,
        ``,
        `Summary:`,
        `  • Total: ${summary.total}`,
        `  • Created: ${summary.created}`,
        `  • Updated: ${summary.updated}`,
        `  • Skipped: ${summary.skipped}`,
        `  • Errors: ${summary.errors}`,
      ];

      // Add deleted count if exact mode was used
      if (result.deletedCount !== undefined) {
        lines.push(`  • Deleted: ${result.deletedCount}`);
      }

      // Add bulk operation errors (DB errors during create/update/delete)
      if (result.errors && result.errors.length > 0) {
        lines.push(``, `❌ Operation Errors (${result.errors.length}):`);
        result.errors.slice(0, 5).forEach((err) => {
          const op = err.operation || {};
          const opType = op.type || "unknown";
          const opId = op.id || op.compositeId ? JSON.stringify(op.compositeId) : "?";
          lines.push(`  • [${opType}] id=${opId}: ${err.error}`);
        });
        if (result.errors.length > 5) {
          lines.push(`  ... and ${result.errors.length - 5} more errors`);
        }
      }

      // Add warning for invalid rows (CSV parse errors)
      if (result.invalidRowsCount > 0) {
        lines.push(``, `⚠️ Invalid Rows (${result.invalidRowsCount} skipped):`);

        if (result.invalidRows && result.invalidRows.length > 0) {
          result.invalidRows.slice(0, 3).forEach((row, idx) => {
            const rowNum = row.row || idx + 1;
            const errors = row.errors ? row.errors.join(", ") : "Unknown error";
            lines.push(`  Row ${rowNum}: ${errors}`);
          });
          if (result.invalidRows.length > 3) {
            lines.push(`  ... and ${result.invalidRows.length - 3} more`);
          }
        }
      }

      ui.alert(`${envLabel} Sync Result`, lines.join("\n"), ui.ButtonSet.OK);
    } else {
      // Success without warnings - show toast
      const deleted = result.deletedCount !== undefined ? `, Deleted: ${result.deletedCount}` : "";
      const toastMessage = `Created: ${summary.created}, Updated: ${summary.updated}, Skipped: ${summary.skipped}${deleted}`;
      spreadsheet.toast(toastMessage, `✅ ${envLabel} Sync: ${sheetName}`, 5);
    }
  } else {
    ui.alert("Sync Error", `Failed to sync: ${result.error || "Unknown error"}`, ui.ButtonSet.OK);
  }
}
