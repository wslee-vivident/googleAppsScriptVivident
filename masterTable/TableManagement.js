function reorderSheetByWrittenData() {
  var fileId = PropertiesService.getScriptProperties().getProperty("FILE_ID");
  const file = SpreadsheetApp.openById(fileId);
  const indexData = file.getSheetByName("#DataTable_Index").getDataRange().getValues();
  const headers = indexData[0];
  const orderlist = indexData
    .filter(row => row[headers.indexOf("Type")] === "Table" && row[headers.indexOf("Setup")] === true)
    .map(row => row[headers.indexOf("Table Name")]);
  
  const allSheets = file.getSheets();
  const allSheetslist = allSheets.map(sheet => sheet.getName());

  const unlistedSheetNames = allSheetslist.filter(name => !orderlist.includes(name));

  let position = 1;

  //Step.1 move first the item unlisted
  for (let name of unlistedSheetNames) {
    const sheet = file.getSheetByName(name);
    if(sheet) {
      file.setActiveSheet(sheet);
      file.moveActiveSheet(position++);
    }
  }

  //Step.2 order by the exsited previous list
  for (let name of orderlist) {
    const sheet = file.getSheetByName(name);
    if(sheet) {
      file.setActiveSheet(sheet);
      file.moveActiveSheet(position++);
    }
  }

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert("✅ 시트 순서 정렬 완료!");
}



function importTableFromExternalSheets(tableArray)
{
  var tableLog = [];
  tableArray.forEach(targetId => {
    targetId = targetId.toString();
    var targetName = SpreadsheetApp.openById(targetId).getName();

    var originSheet = SpreadsheetApp.openById(targetId).getSheetByName(targetName);
    var targetSheet = SpreadsheetApp.getActive().getSheetByName(targetName);

    //Copy data from origin sheet
    var range = originSheet.getDataRange();
    var values = range.getDisplayValues();
    var backgrounds = range.getBackgrounds();
    var fontFamilies = range.getFontFamilies()
    var fontSizes = range.getFontSizes();
    var fontStyles = range.getFontStyles();

    var newRange = targetSheet.getRange(1,1, values.length, values[0].length);
    newRange.setValues(values);
    newRange.setBackground(backgrounds);
    newRange.setFontFamilies(fontFamilies);
    newRange.setFontSizes(fontSizes);
    newRange.setFontStyles(fontStyles);

    var extraRows = targetSheet.getMaxRows() - values.length;
    if(extraRows > 0) {
      targetSheet.deleteRows(values.length + 1, extraRows);
    }

    var extraColumns = targetSheet.getMaxColumns() - values[0].length;
    if(extraColumns > 0) {
      targetSheet.deleteColumns(values[0].length + 1, extraColumns);
    }
    tableLog.push(targetName + "\n");
  });
  
  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert("📌 데이터 임포트 완료:\n" + tableLog.toString());
  
  return "SUCCEED";
}
function exportTableToExternalSheets(tableArray)
{
  var proceedureLog = [];
  tableArray.forEach(targetId => {
    targetId = targetId.toString();
    var targetName = SpreadsheetApp.openById(targetId).getName();

    var originSheet = SpreadsheetApp.getActive().getSheetByName(targetName);
    var sheetFile = SpreadsheetApp.openById(targetId);
    var currentData = new Date();
    var exportSheetName = Utilities.formatDate(currentData, Session.getScriptTimeZone(), "yy.MM.dd_HH:mm:ss");
    var copiedSheet = sheetFile.insertSheet(exportSheetName);

    var range = originSheet.getDataRange();
    var values = range.getDisplayValues();
    var backgrounds = range.getBackgrounds();
    var fontFamilies = range.getFontFamilies()
    var fontSizes = range.getFontSizes();
    var fontStyles = range.getFontStyles();

    var newRange = copiedSheet.getRange(1,1,values.length, values[0].length);
    newRange.setValues(values);
    newRange.setBackgrounds(backgrounds);
    newRange.setFontFamilies(fontFamilies);
    newRange.setFontSizes(fontSizes);
    newRange.setFontStyles(fontStyles);

    var extraRows = copiedSheet.getMaxRows() - values.length;
    if(extraRows > 0) {
      copiedSheet.deleteRows(values.length + 1, extraRows);
    }

    var extraColumns = copiedSheet.getMaxColumns() - values[0].length;
    if(extraColumns > 0) {
      copiedSheet.deleteColumns(values[0].length + 1, extraColumns);
    }
    proceedureLog.push(targetName + "\n");
  });

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert("✅데이터 익스포트 완료!\n" + proceedureLog.toString());

  return "SUCCEED";
}

function createEnumData(isUIMacro)
{
  var fileId = PropertiesService.getScriptProperties().getProperty("FILE_ID");
  var masterFile = SpreadsheetApp.openById(fileId);
  var enumSheet = masterFile.getSheetByName("Enum");
  var typeSheet = masterFile.getSheetByName("#Type");
  var sheet = masterFile.getSheetByName("#DataTable_Index");
  var dataSheet = sheet.getDataRange().getValues();
  var header = dataSheet[0];
  var selectedColumn = [header.indexOf("Table Name"), header.indexOf('Length')];
  var enumTypesArray = [];

  //✅ 기존 Enum 시트 데이터 가져오기 (Quest, Description, Name 유지)
  var prevData = enumSheet.getDataRange().getValues();
  var enumHeader = prevData[0];
  var exsitedEnum = prevData.filter(row => row[enumHeader.indexOf("#Quest")] === true);
  var enumResultArray = [];

  // ✅ 필터링 후 Enum 데이터 가져오기    
  var filterData = dataSheet
  .filter(row => row[header.indexOf("Setup")] === true && row[header.indexOf('Type')] === "Enum")
  .map(row => selectedColumn.map(index => row[index]));

  if(filterData.length <= 0) {
    SpreadsheetApp.getUi().alert("에러! : Enum을 만들 수 있는 데이터가 없습니다.");
    return "ERROR";
  }

  for(var i = 0; i < filterData.length; i++)
  {
    var searchText = filterData[i][0].toString();
    var targetRow = dataSheet
    .map((row,index) => (row[header.indexOf("Table Name")] === searchText ? index + 1 : null))
    .filter(row => row !== null);
    var columnContents = sheet.getRange(targetRow, header.indexOf("Contents")+1, 1, filterData[i][1]).getValues().flat();

    for(var j = 0; j < columnContents.length; j++)
    {
      var valueArray = [searchText, columnContents[j].toString(), j+1, "", "", ""];
      enumResultArray.push(valueArray);
    }

    var enumTypeValue = [searchText, "Enum"];
    enumTypesArray.push(enumTypeValue);
  }

  // ✅ 기존의 enum 시트와 새 enum 시트를 머지
  for(let i = 0; i < enumResultArray.length; i++) {
    var newKey = enumResultArray[i][enumHeader.indexOf("Type")] + "_" + enumResultArray[i][enumHeader.indexOf("Name")];

    for(let j = 0; j < exsitedEnum.length; j++) {
      var key = exsitedEnum[j][enumHeader.indexOf("Type")] + "_" + exsitedEnum[j][enumHeader.indexOf("Name")];

      if(newKey === key) {
        enumResultArray[i][enumHeader.indexOf("#Quest")] = exsitedEnum[j][enumHeader.indexOf("#Quest")];
        enumResultArray[i][enumHeader.indexOf("#Description")] = exsitedEnum[j][enumHeader.indexOf("#Description")];
        enumResultArray[i][enumHeader.indexOf("#Name")] = exsitedEnum[j][enumHeader.indexOf("#Name")];
        
      }
    }
  }

  enumSheet.getRange(2,1, enumResultArray.length, enumResultArray[0].length).clear();
  enumSheet.getRange(2,1, enumResultArray.length, enumResultArray[0].length).setValues(enumResultArray);
  
  typeSheet.getRange(8, 1, enumTypesArray.length, 2).clear();
  typeSheet.getRange(8, 1, enumTypesArray.length, 2).setValues(enumTypesArray);

  if(isUIMacro) {
    SpreadsheetApp.flush();
    SpreadsheetApp.getUi().alert("✅Enum 테이블 시트 제작 완료!\n");
  }
}

function updateTableInfoToOriginSheet()
{
  const fileId = PropertiesService.getScriptProperties().getProperty("FILE_ID");
  const masterFile = SpreadsheetApp.openById(fileId);
  const sheet = masterFile.getSheetByName("#DataTable_Index");
  const dataSheet = sheet.getDataRange().getValues();
  const header = dataSheet[0];
  const selectedColumn = [header.indexOf("Table Name"), header.indexOf("Num")];

  createEnumData(false);
  const typeSheet = masterFile.getSheetByName("#Type").getDataRange().getValues();
  const typeList = typeSheet
    .slice(1)
    .map(row => row[0])
    .filter(value => value !== "");

  const targetTables = dataSheet
  .filter(row => row[header.indexOf("Setup")] === true && row[header.indexOf('Type')] === "Table")
  .map(row => selectedColumn.map(index => row[index]));

  if(targetTables.length <= 0) {
    SpreadsheetApp.getUi().alert("에러! : 시트를 만들 수 있는 테이블이 없습니다.");
    return "ERROR";
  }

  const contentColumnIdx = header.indexOf("Contents");
  for (const [name, rowNum] of targetTables) {
    const table = masterFile.getSheetByName(String(name));

    if(!table) continue;
    const lastColumn = table.getLastColumn();

    if(lastColumn === 0) continue;
    const tableHeader = table.getRange(1,1,1, lastColumn).getValues();

    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(typeList, true)
      .setAllowInvalid(true)
      .build();

    
    const ruleRange = table.getRange(3,1,1,lastColumn);
    ruleRange.setDataValidation(rule);
    
    sheet.getRange(rowNum, contentColumnIdx+1, 1, lastColumn).setValues(tableHeader);
  }

  reorderSheetByWrittenData();
}

function createTableFromOriginSheet()
{
  var fileId = PropertiesService.getScriptProperties().getProperty("FILE_ID");
  var masterFile = SpreadsheetApp.openById(fileId);
  var sheet = masterFile.getSheetByName("#DataTable_Index");
  var backgroundColor = sheet.getRange('A1').getBackground();
  var dataSheet = sheet.getDataRange().getValues();
  var typeSheet = masterFile.getSheetByName("#Type").getDataRange().getValues();
  var header = dataSheet[0];
  var selectedColumn = [header.indexOf("Table Name"), header.indexOf('Length')];

  var filterData = dataSheet
  .filter(row => row[header.indexOf("Setup")] === false && row[header.indexOf('Type')] === "Table")
  .map(row => selectedColumn.map(index => row[index]));

  if(filterData.length <= 0) {
    SpreadsheetApp.getUi().alert("에러! : 시트를 만들 수 있는 테이블이 없습니다.");
    return "ERROR";
  }

  for(var i = 0; i < filterData.length; i++)
  {
    //Table Name
    var searchText = filterData[i][0].toString();
    //Find the row number where the search text existed
    var targetRow = dataSheet
    .map((row,index) => (row[header.indexOf("Table Name")] === searchText ? index+1 : null))
    .filter(row => row !== null);
    //Extract column contents
    var columnContents = sheet.getRange(targetRow, header.indexOf("Contents")+1, 1, filterData[i][1]).getValues();
   
    var newSheet = masterFile.insertSheet(filterData[i][0].toString());
    var activeSheet = SpreadsheetApp.getActiveSpreadsheet();
    var numSheets = activeSheet.getSheets().length;
    activeSheet.setActiveSheet(newSheet);
    activeSheet.moveActiveSheet(numSheets);

    var writeRange = newSheet.getRange(1,1,1, columnContents[0].length);
    writeRange.setValues(columnContents);


    var filteredTypeData = typeSheet
    .slice(1)
    .map(row => row[0])
    .filter(value => value !== "");
    
    writeRange = newSheet.getRange(3,1,1, columnContents[0].length);
    var numCols = writeRange.getNumColumns();


    var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(filteredTypeData, true)
    .build();


    var validationRules = Array.from({length : 1}, ()=> Array(numCols).fill(rule));
    writeRange.setDataValidations(validationRules);

    writeRange = newSheet.getRange(2,1,1, columnContents[0].length);
    var descLabel = Array.from({length : 1}, ()=> Array(numCols).fill("설명 문구"));
    writeRange.setValues(descLabel);


    writeRange = newSheet.getRange(1,1,3, columnContents[0].length);
    var cellBackgrounds  = Array.from({length : 3}, ()=> Array(numCols).fill(backgroundColor));
    writeRange.setBackgrounds(cellBackgrounds);

    if(newSheet.getMaxColumns() > columnContents[0].length ) {
      newSheet.deleteColumns(columnContents[0].length + 1, newSheet.getMaxColumns() - columnContents[0].length);
    }
    newSheet.deleteRows(15, newSheet.getMaxRows() - 15);

    sheet.getRange(targetRow, header.indexOf("Setup")+1, 1, 1).setValue(true);
  }

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert("✅테이블 시트 제작 완료!\n");
}

function duplicateSpreadSheetFileFromSheet()
{
  var folderId = PropertiesService.getScriptProperties().getProperty("FOLDER_ID");
  var fileId = PropertiesService.getScriptProperties().getProperty("FILE_ID");
  var sheet = SpreadsheetApp.openById(fileId).getSheetByName("#DataTable_Index");
  var dataSheet = sheet.getDataRange().getValues();
  var header = dataSheet[0];

  var filterData = dataSheet
  .filter(row => row[header.indexOf("Setup")] === true && row[header.indexOf("File")] === false && row[header.indexOf('Type')] === "Table")
  .map(row => row[header.indexOf("Table Name")]);

  if(filterData.length <= 0) {
    SpreadsheetApp.getUi().alert("에러! : 생성할 파일 리스트가 없습니다.");
    return "ERROR";
  }

  for(var i = 0; i < filterData.length; i++)
  {
    var targetName = filterData[i].toString();
    var docSheetName = "Description";
    var newSpreadsheet = SpreadsheetApp.create(targetName);
    var targetDriveFolder = DriveApp.getFolderById(folderId);
    
    var originSheet = SpreadsheetApp.getActive().getSheetByName(targetName);
    var newSpreadsheetFile = SpreadsheetApp.openById(newSpreadsheet.getId());
    var copiedSheet = newSpreadsheetFile.insertSheet(targetName);

    var range = originSheet.getDataRange();
    var values = range.getDisplayValues();
    var backgrounds = range.getBackgrounds();
    var fontFamilies = range.getFontFamilies()
    var fontSizes = range.getFontSizes();
    var fontStyles = range.getFontStyles();

    var newRange = copiedSheet.getRange(1,1,values.length, values[0].length);
    newRange.setValues(values);
    newRange.setBackgrounds(backgrounds);
    newRange.setFontFamilies(fontFamilies);
    newRange.setFontSizes(fontSizes);
    newRange.setFontStyles(fontStyles);

    var defaultSheet = newSpreadsheetFile.getSheets()[0];
    if(defaultSheet.getName() === "시트1") {
      newSpreadsheetFile.deleteSheet(defaultSheet);
    }

    var file = DriveApp.getFileById(newSpreadsheet.getId());
    file.moveTo(targetDriveFolder);

    const lastColumn = copiedSheet.getLastColumn();
    const descHeader = copiedSheet.getRange(1,1, 3, lastColumn).getValues();

    const validColIndexes = descHeader[0]
      .map((v, i) => String(v).trim() !== "" ? i : -1)
      .filter(i => i !== -1);

    const trimmedMatrix = descHeader.map(row => 
      validColIndexes.map(i => row[i])
    );

    const transpostMatrix = transpose(trimmedMatrix);
    const output = [
      ["Column Name", "Description", "Type"],
      ...transpostMatrix
    ];
    

    let doc = newSpreadsheetFile.getSheetByName(docSheetName);
    doc = doc ? (doc.clear(), doc) : newSpreadsheetFile.insertSheet(docSheetName);
    doc.getRange(1, 1, output.length, output[0].length).setValues(output);

    var matchIndex = dataSheet.findIndex(row => row[header.indexOf("Table Name")] === targetName);
    var targetCell = matchIndex >= 0 ? sheet.getRange(matchIndex + 1, header.indexOf("Table Name") + 1).getA1Notation() : "NULL";
    
    var targetRange = sheet.getRange(targetCell);

    sheet.getRange(targetRange.getRow(), header.indexOf("FileId")+1, 1, 1).setValue(newSpreadsheet.getId().toString());
    sheet.getRange(targetRange.getRow(), header.indexOf("File")+1, 1, 1).setValue(true);
  }

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert("작성 완료!");
}

function transpose(matrix) {
  return matrix[0].map((_, colIndex) =>
    matrix.map(row => row[colIndex])
  );
}