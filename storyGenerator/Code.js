function onOpen() {
  var ui = SpreadsheetApp.getUi();
  var menu = ui.createMenu('Story');
  menu.addItem('multi-character-mode', 'storyGenerate');
  menu.addItem('single-character-mode', 'fullStoryGenerate');
  menu.addToUi();
}

function forcePermission() {
  // 아무 의미 없는 요청이지만, 권한 팝업을 유도합니다.
  UrlFetchApp.fetch("https://www.google.com");
  console.log("권한 획득 성공!");
}