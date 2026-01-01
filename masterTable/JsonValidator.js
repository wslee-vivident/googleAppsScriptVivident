function validateJsonColumns() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  const headerRowIndex = 2; // Row 3 (0-based)
  const dataStartRow = 3;   // Row 4 (0-based)
  const headers = values[headerRowIndex] || [];

  const jsonColumns = [];
  for (let c = 0; c < headers.length; c++) {
    if (String(headers[c]).trim().toLowerCase() === "json") {
      jsonColumns.push(c);
    }
  }
  if (jsonColumns.length === 0) return;

  // Reset background and notes
  jsonColumns.forEach(c => {
    const range = sheet.getRange(dataStartRow + 1, c + 1, values.length - dataStartRow);
    range.setBackground(null);
    range.clearNote();
  });

  for (let r = dataStartRow; r < values.length; r++) {
    for (const c of jsonColumns) {
      const cellValue = values[r][c];
      const cell = sheet.getRange(r + 1, c + 1);

      if (!cellValue) continue;

      try {
        JSON.parse(cellValue);
      } catch (err) {
        // Highlight invalid JSON
        cell.setBackground("#fff3b0");

        // Extract snippet for "after '...'" (up to 50 chars before error)
        let snippet = "";
        const match = err.message.match(/position (\d+)/i);
        if (match && match[1]) {
          const pos = parseInt(match[1], 10);
          const start = Math.max(0, pos - 50);
          snippet = cellValue.substring(start, pos).replace(/\n/g, " ");
        }

        const noteMessage = snippet
          ? `JSON Parse Error: ${err.message} after '${snippet}'`
          : `JSON Parse Error: ${err.message}`;

        cell.setNote(noteMessage);
      }
    }
  }
}
