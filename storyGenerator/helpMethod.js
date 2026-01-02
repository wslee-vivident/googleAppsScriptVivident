function makeHeaderIndex_(headerRow) {
  const idx = {};
  headerRow.forEach((h, i) => (idx[String(h).trim()] = i));
  return idx;
}

function loadRefData(masterFile) {
  const refData = {};

  const refLists = SpreadsheetApp.getActive().getSheetByName("ref_sheets").getDataRange().getValues().flat();

  refLists.forEach(name => {
    const sheet = masterFile.getSheetByName(name);
    if(!sheet) throw new Error("Missing Sheet: " + name);

    const values = sheet.getDataRange().getValues();
    const header = values[0] || [];
    const data = values.slice(3);

    refData[name] = { header, data };
  });

  return refData;
}

function buildLookupCompositeOne(
  sheetRows, // Entire data values of Sheet | getValues()
  headerRow, // header -> rows
  keyColumns, // composite keys (combined)
  valueColumn // result data
) {
  const columnIndex = {};
  headerRow.forEach((h, i) => (columnIndex[String(h).trim()] = i));

   // 컬럼 존재 체크
   if(!(valueColumn in columnIndex)) {
    throw new Error(`[buildIndexBundle] value column not found : ${valueColumn}`);
   }
   keyColumns.forEach(col => {
    if(!(col in columnIndex)) {
      throw new Error(`[buildIndexBundle] key column not found : ${col}`);
    }
   });

   const valueColIndex = columnIndex[valueColumn];
   const indexMap = {};

   for (let rowIndex=0; rowIndex < sheetRows.length; rowIndex++) {
    const row = sheetRows[rowIndex];
    const compositeKey = keyColumns
      .map(col => String(row[columnIndex[col]] ?? "").trim())
      .join("|");

    if(compositeKey.replace(/\|/g, "").trim() === "") {
      continue;
    }

    if (indexMap[compositeKey] !== undefined) {
      throw new Error(
        `[buildIndexBundle] Duplicate key: ${compositeKey} (row ${rowIndex + 4})`
      );
    }
    indexMap[compositeKey] = row[valueColIndex];
  }

  return { keyColumns, valueColumn, indexMap };
}

function buildLookupMany(
  sheetRows,
  headerRow,
  keyColumn
) {
  const columnIndex = {};
  headerRow.forEach((h, i) => (columnIndex[String(h).trim()] = i));

  if(!(keyColumn in columnIndex)) {
    throw new Error(`[buildSingleColumnIndex] column not found : ${keyColumn}`);
  }

  const keyIndex = columnIndex[keyColumn];
  const resultMap = {};

  for(let i = 0; i < sheetRows.length; i++) {
    const row = sheetRows[i];
    const key = String(row[keyIndex] ?? "").trim();

    if(!resultMap[key]) {
      resultMap[key] = [];
    }
    resultMap[key].push(row);
  }
  
  return resultMap;
}

function convertToObject_(values) {
  if(!values ||values.length < 2) return [];

  const [headers, ...rows] = values;

  return rows.map(row => {
    return headers.reduce( (obj, header, index) => {
      obj[header] = row[index];
      return obj;
    }, {});
  });
}

function arrayToDictionary(arrayData, keyColumn) {
  return arrayData.reduce((acc, item) => {
    const key = item[keyColumn];
    if(key) {
      acc[key] = item;
    }
    return acc;
  }, {});
}

function lookupCompositeOne(indexBundle, conditions) {
  const { keyColumns, indexMap } = indexBundle;

  const compositeKey = keyColumns
    .map(col => {
      if(!(col in conditions)) {
        throw new Error(`[getByConditions] Missing condition: ${col}`);
      }
      return String(conditions[col] ?? "").trim();
    })
    .join("|");

    return indexMap[compositeKey] ?? null;
}

function mergeSheetDataToTargetSheet(targetSheet, inputData) {
  if(!inputData || inputData.length === 0) return;
  
  const fullData = targetSheet.getDataRange().getValues();
  const targetHeader = fullData[0];
  const existingBody = fullData.slice(3);


  const sceneIdsToReplace = new Set(inputData.map(row => String(row[0]).trim()));

  const filteredBody = existingBody.filter(row => {
    const currentSceneId = String(row[0]).trim();
    return !sceneIdsToReplace.has(currentSceneId);
  });

  const finalTable = [...filteredBody, ...inputData];

  const lastRow = targetSheet.getMaxRows();
  const lastCol = targetSheet.getMaxColumns();
  if(lastRow >=4 ) {
    targetSheet.getRange(4, 1, lastRow-3, lastCol).clear();
  }

  if(finalTable.length > 0) {
    const targetRange = targetSheet.getRange(4, 1, finalTable.length, finalTable[0].length);
    targetRange.setValues(finalTable);

    targetRange.sort([
      {column : 22, ascending : true}, // sceneId sort
      {column : 3, ascending : true} // index sort
    ]);
  }
}
