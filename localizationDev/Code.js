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

//이 것은 테스트이며 과연 잘 넘어가는지 확인
//이제는 세 번째 레슨
//자 이제 들어가자 Thank you for this!