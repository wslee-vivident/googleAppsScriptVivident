function mergeJsonToSheetPreserveMeta() {
  const fileId = PropertiesService.getScriptProperties().getProperty("FILE_ID");
  const folderId = PropertiesService.getScriptProperties().getProperty("LOCAL_FOLDER"); // JSON 파일 폴더
  const sheetName = "Localization";
  const sheet = SpreadsheetApp.openById(fileId).getSheetByName(sheetName);
  if (!sheet) throw new Error(`❌ 시트 "${sheetName}"를 찾을 수 없습니다.`);

  // 1️⃣ 시트 데이터 → 객체화
  const range = sheet.getDataRange();
  const values = range.getValues();
  const header = values[0];
  const keyIndex = header.indexOf("key"); // 소문자 주의 (대소문자 일치시 변경)
  if (keyIndex === -1) throw new Error('❌ "key" 컬럼이 필요합니다.');

  // 언어 컬럼만 식별 (#으로 시작하지 않고, key도 아님)
  const langCols = header.reduce((acc, col, i) => {
    if (col && !col.startsWith("#") && col !== "key") acc[col] = i;
    return acc;
  }, {});

  // 시트 데이터 객체화
  const sheetData = {};
  for (let r = 1; r < values.length; r++) {
    const key = values[r][keyIndex];
    if (!key) continue;
    sheetData[key] = {};
    for (let lang in langCols) {
      const c = langCols[lang];
      sheetData[key][lang] = values[r][c];
    }
  }

  // 2️⃣ JSON 파일 → translations 객체 생성
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const translations = {};
  const langs = [];

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    if (!name.toLowerCase().endsWith(".json")) continue;
    const lang = name.replace(".json", "");
    langs.push(lang);

    const json = JSON.parse(file.getBlob().getDataAsString());
    for (let key in json) {
      if (!translations[key]) translations[key] = {};
      translations[key][lang] = json[key];
    }
  }

  // 3️⃣ 시트와 JSON 병합
  // - 기존 key는 업데이트
  // - 새로운 key는 추가
  // - #meta 컬럼은 그대로 보존

  // 언어 컬럼 확장 (새 언어가 JSON에 있으면 추가)
  langs.forEach(lang => {
    if (!header.includes(lang)) {
      header.push(lang);
      langCols[lang] = header.length - 1;
    }
  });

  // 기존 key 목록
  const existingKeys = Object.keys(sheetData);
  const allKeys = Array.from(new Set([...existingKeys, ...Object.keys(translations)])).sort();

  // 기존 values를 복제해서 메타데이터 유지
  const rowsMap = {};
  for (let i = 1; i < values.length; i++) {
    const key = values[i][keyIndex];
    if (key) rowsMap[key] = [...values[i]];
  }

  // 최종 rows 배열
  const rows = [header];

  for (let key of allKeys) {
    let row = rowsMap[key] ? [...rowsMap[key]] : Array(header.length).fill("");
    row[keyIndex] = key;

    for (let lang in translations[key] || {}) {
      const c = langCols[lang];
      if (c !== undefined) row[c] = translations[key][lang];
    }

    rows.push(row);
  }

  // 4️⃣ 기존 시트에 일괄 반영 (meta 유지)
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, header.length).setValues(rows);

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert(`✅ 병합 완료: ${rows.length - 1}개 key, 메타 컬럼 보존`);
}

function exportSheetToJson() {
  const fileId = PropertiesService.getScriptProperties().getProperty("FILE_ID");
  const folderId = PropertiesService.getScriptProperties().getProperty("LOCAL_FOLDER"); // JSON 파일 폴더
  const sheetName = "Localization";
  const sheet = SpreadsheetApp.openById(fileId).getSheetByName(sheetName);
  if (!sheet) throw new Error(`❌ 시트 "${sheetName}"를 찾을 수 없습니다.`);

  // 1️⃣ 시트 데이터 → 객체화
  const range = sheet.getDataRange();
  const values = range.getValues();
  const header = values[0];
  const keyIndex = header.indexOf("key"); // 소문자 주의 (대소문자 일치시 변경)
  if (keyIndex === -1) throw new Error('❌ "key" 컬럼이 필요합니다.');

  // 언어 컬럼만 식별 (#으로 시작하지 않고, key도 아님)
  const langCols = header.reduce((acc, col, i) => {
    if (col && !col.startsWith("#") && col !== "key") acc[col] = i;
    return acc;
  }, {});

  const translations = {};

  Object.keys(langCols).forEach(lang => {
    const colIndex = header.indexOf(lang);
    const obj = {};

    values.forEach(row => {
      const key = row[keyIndex];
      const value = row[colIndex];
      if (key) obj[key] = value;
    });

    translations[lang] = obj;
  });

  const folder = DriveApp.getFolderById(folderId);

  for(const [lang, dataObj] of Object.entries(translations)) {
    const jsonString = JSON.stringify(dataObj, null, 2);
    const fileName = `${lang}.json`;

    const files = folder.getFilesByName(fileName);
    if(files.hasNext()) {
      const existingFile = files.next();
      existingFile.setContent(jsonString);
      Logger.log(`🔄 ${lang} 덮어쓰기 완료: ${existingFile.getUrl()}`);
    } else {
      const newFile = folder.createFile(fileName, jsonString, MimeType.PLAIN_TEXT);
      Logger.log(`✅ ${lang} 새 파일 생성됨: ${newFile.getUrl()}`);
    }
  }

  SpreadsheetApp.flush();
  const ui = SpreadsheetApp.getUi();
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
  ui.alert('✅ JSON 파일 생성 완료!', `Drive 폴더로 이동:\n${folderUrl}`, ui.ButtonSet.OK);
}



