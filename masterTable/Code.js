function getSpreadSheetData()
{
  var fileId = PropertiesService.getScriptProperties().getProperty("FILE_ID");
  var sheet = SpreadsheetApp.openById(fileId).getSheetByName("#DataTable_Index");
  var dataSheet = sheet.getDataRange().getValues();
  var header = dataSheet[0];
  var selectedColumn = [header.indexOf("FileId"), header.indexOf('Table Name')];

  var filterData = dataSheet
  .filter(row => row[header.indexOf("FileId")] != '' && row[header.indexOf("File")] === true && row[header.indexOf('Type')] === "Table")
  .map(row => selectedColumn.map(index => row[index]));

  return filterData;
}

function onOpen()
{
  //when google spreadSheet is opened,
  var ui = SpreadsheetApp.getUi();
  var menu = ui.createMenu('DataManager');
  menu.addItem('DataManager', 'showDialog');
  menu.addItem('CreateSheets', 'createTableFromOriginSheet');
  menu.addItem('CreateEnum', 'writeEnumList');
  menu.addItem('SheetToFile', 'duplicateSpreadSheetFileFromSheet');
  menu.addItem('Sort sheets by list', 'reorderSheetByWrittenData');
  menu.addItem('Update DataTable_Index', 'updateTableInfoToOriginSheet');
  menu.addToUi();

  var menu2 = ui.createMenu('Localization');
  menu2.addItem('Get JSON from Tolgee', 'mergeJsonToSheetPreserveMeta');
  menu2.addItem('Export JSON All', 'exportSheetToJson');
  menu2.addItem('Translate ALL', 'translateAll');
  menu2.addToUi();

  var menu3 = ui.createMenu("Sync")
    .addItem("Dev Push", "syncToDevAdmin")
    
    .addSubMenu(
      ui.createMenu("🛠️ Development")
        .addItem("PUSH to Dev Admin", "syncToDevAdmin")
        .addItem("PULL from Dev Admin", "pullFromDevAdmin")
        // .addItem("Push All Sheets", "syncAllSheetsToDevAdmin")
        .addSeparator()
        .addItem("🔑 Set API Key", "promptSetApiKeyDev")
        .addItem("🗑️ Clear API Key", "clearApiKeyDev")
        .addSeparator()
        .addItem("Test Connection", "testConnectionProd")
    )
    .addSubMenu(
      ui.createMenu("🚀 Production")
        .addItem("Push to Admin", "syncToAdmin")
        .addItem("PULL from Admin", "pullFromAdmin")
        // .addItem("Push All Sheets", "syncAllSheetsToAdmin")
        .addSeparator()
        .addItem("🔑 Set API Key", "promptSetApiKeyProd")
        .addItem("🗑️ Clear API Key", "clearApiKeyProd")
        .addSeparator()
        .addItem("Test Connection", "testConnectionProd")
    )
    .addToUi();
}


function translateAll() {
  const sheetName = SpreadsheetApp.getActiveSheet().getSheetName();
  translateOtherLangs(sheetName);
}

function writeEnumList() {
  createEnumData(true);
}

function showDialog()
{
  var html = HtmlService.createHtmlOutputFromFile('ManagerForm')
    .setWidth(1080)
    .setHeight(1920);

  SpreadsheetApp.getUi().showModalDialog(html, '시트 데이터 관리자');
}

function writeUpdateLog(worker, log, procedureType, tableSelect)
{
  var targetSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("#History");
  var targetSheetDataValues = targetSheet.getDataRange().getValues();
  var currentData = new Date();

  var formateedDate = Utilities.formatDate(currentData, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  var logData = [worker, tableSelect.toString(), procedureType, log, formateedDate];
  var resultData = [logData];

  targetSheet.getRange(targetSheetDataValues.length+1, 1, resultData.length, logData.length).setValues(resultData);
}

