function onOpen()
{
  var ui = SpreadsheetApp.getUi();
  var menu2 = ui.createMenu('Localization');
  menu2.addItem('Translate ALL', 'translateAll');
  menu2.addToUi();
}

function translateAll() {
  const sheetName = SpreadsheetApp.getActiveSheet().getSheetName();
  translateOtherLangs(sheetName);
}
