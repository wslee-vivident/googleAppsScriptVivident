function onOpen() {
  var ui = SpreadsheetApp.getUi();
  var menu = ui.createMenu('Story');
  menu.addItem('Generate', 'onStoryGenerate');
  menu.addToUi();
}

function onStoryGenerate() {
    const sheetName = SpreadsheetApp.getActiveSheet().getSheetName();
    storyGenerate(sheetName);
}