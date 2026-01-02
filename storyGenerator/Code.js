function onOpen() {
  var ui = SpreadsheetApp.getUi();
  var menu = ui.createMenu('Story');
  menu.addItem('Generate', 'storyGenerate');
  menu.addToUi();
}

function storyGenerate() {
    //Hi
}
