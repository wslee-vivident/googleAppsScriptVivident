function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Script Generator');
  menu.addItem('Generate', 'scriptGenerate');
  menu.addToUi();
}

function scriptGenerate() {
  const fileId = PropertiesService.getScriptProperties().getProperty("MASTER");
  const masterFile = SpreadsheetApp.openById(fileId);
  const masterSchemeSheet = masterFile.getSheetByName("#DataTable_Index");
  const masterData = masterSchemeSheet.getDataRange().getValues();
  const masterHeader = masterData[0];
  
  const sheet = SpreadsheetApp.getActive().getSheetByName("GENERATOR");
  const data = sheet.getDataRange().getValues();
  var scriptTextKeys = [];

  const localizationSheet = masterFile.getSheetByName("localization");

  const storyScriptsId = masterData
    .map(row => {
      return row[masterHeader.indexOf("Table Name")] === "storyScripts"
      ? row[masterHeader.indexOf("FileId")] : null
    })
    .filter(value => value !== null);

  scriptTextKeys = writeSceneScript(storyScriptsId, data, masterFile);
  generateTextKey(localizationSheet, scriptTextKeys);

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert("✅ 스크립트 작성 완료!");
}

function writeSceneScript(targetSheetId, inputData, masterFile) {
  const target = SpreadsheetApp.openById(targetSheetId);
  const targetName = target.getName();
  const targetSheet = target.getSheetByName(targetName);
  const targetData = targetSheet.getDataRange().getValues();
  const targetHeader = targetData[0];
  const targetBodyData = targetData.slice(3);

  //Input data from writer
  const inputBodyData = inputData.slice(1);
  const inputIdxeader = inputData[0];

  const refData = loadRefData(masterFile);
  
  const returnTable = [];
  const sceneIdList = [];
  const textKeyList = [];

  const inputIdx = makeHeaderIndex_(inputIdxeader);
  const targetIdx = makeHeaderIndex_(targetHeader);

  const speakerSheet = SpreadsheetApp.getActive().getSheetByName("speaker").getDataRange().getValues();
  const speakerHeader = speakerSheet[0];
  const speakerData = speakerSheet.slice(1);

  const thisSheet = SpreadsheetApp.getActive().getSheetByName("GENERATOR");
  const sheetLastCol = thisSheet.getLastColumn();
  const sheetLastRow = thisSheet.getLastRow();
 
  const lastValues = thisSheet.getRange(sheetLastRow, 1, 1, sheetLastCol).getValues()[0];
  const lastType = String(lastValues[inputIdx.type] ?? "").trim();
  if(lastType !== "종료") {
    const newRow = Array(sheetLastCol).fill("");
    newRow[inputIdx.sceneId] = String(lastValues[inputIdx.sceneId] ?? "").trim();
    newRow[inputIdx.Row] = String(lastValues[inputIdx.Row] + 1 ?? "").trim();
    newRow[inputIdx.FX] = String(lastValues[inputIdx.FX] ?? "").trim();;
    newRow[inputIdx.shot] = String(lastValues[inputIdx.shot] ?? "").trim();
    newRow[inputIdx.type] = "종료";
    
    inputBodyData.push(newRow);
  }

  
  for(const row of inputBodyData) {
    const sceneId = String(row[inputIdx.sceneId] ?? "").trim();
    const inputRow = String(row[inputIdx.Row] ?? "").trim();
    const rowNumValue = Utilities.formatString("%03d", parseInt(inputRow || "0", 10));
    const inputTextNum = String(row[inputIdx.TextNum] ?? "").trim();
    const textNumValue = Utilities.formatString("%03d", parseInt(inputTextNum || "0", 10));
    const inputShot = String(row[inputIdx.shot] ?? "").trim();
    const inputFX = String(row[inputIdx.FX] ?? "").trim();

    const index = inputShot + rowNumValue + textNumValue + inputFX;
    const textArray = Array.from({length : 2}, (_, col) => {
      switch(col) {
        case 0 :
          return sceneId;
        case 1 :
          return index;
        default :
          return "";
      }
    });
    
    textKeyList.push(textArray);
    sceneIdList.push(sceneId);
  }
  
  const searchIds = new Set(sceneIdList);
  const table = targetBodyData.filter(r => !searchIds.has(String(r[0])));

  const speakerIndex = buildLookupCompositeOne(
    speakerData,
    speakerHeader,
    ["speaker"],
    "key"
  )
  
  const enumIndex = buildLookupCompositeOne(
    refData["enum"].data,
    refData["enum"].header,
    ["#Name"],
    "Name"
  );

  const assetIndex = buildLookupCompositeOne(
    refData["assets"].data,
    refData["assets"].header,
    ["#Name"],
    "id"
  );

  const characterIndex = buildLookupCompositeOne(
    refData["characters"].data,
    refData["characters"].header,
    ["#Name"],
    "id"
  );

  const costumeIndex = buildLookupCompositeOne(
    refData["characterCostumes"].data,
    refData["characterCostumes"].header,
    ["#Name"],
    "id"
  );

  const characterAssetIndex = buildLookupCompositeOne(
    refData["characterAssets"].data,
    refData["characterAssets"].header,
    ["#CharacterAssetKind", "#CharacterId", "#CostumeId", "#Emotion", "#Order"],
    "assetId"
  );

  const bonusIndex = buildLookupCompositeOne(
    refData["storyBonus"].data,
    refData["storyBonus"].header,
    ["#Name"],
    "id"
  );

  const actionIndex = buildLookupCompositeOne(
    refData["storyScriptActions"].data,
    refData["storyScriptActions"].header,
    ["#Name"],
    "id"
  );

  const spaceIndex = buildLookupCompositeOne(
    refData["spaces"].data,
    refData["spaces"].header,
    ["#Name"],
    "id"
  );

  const spaceAssetIndex = buildLookupCompositeOne(
    refData["spaceAssets"].data,
    refData["spaceAssets"].header,
    ["spaceId", "kind", "timeOfDay"],
    "assetId"
  );

  const columns = targetSheet.getMaxColumns();
  let lastBranchIndex = "";
  for(const [rowIndex, row] of inputBodyData.entries()) {
    
    const index = textKeyList[rowIndex][1];
    const sceneId = row[inputIdx.sceneId];
    const shot = row[inputIdx.shot];
    const value = row[inputIdx.value];
    const next = row[inputIdx.next];
    const tag = row[inputIdx.tag];
    const wait = row[inputIdx.wait];
    const posReset = row[inputIdx.posReset];
    const layer = row[inputIdx.layer];
    const bonusScore = row[inputIdx.bonusScore];
    const sheetOrder = row[inputIdx["#Order"]];
    var assetId = "";
    var assetName = "";
    var textKey = "";
    var translationKor = "";
    var bonusLabel = "";
    var bonusId = "";

    const inputType = row[inputIdx.type];
    const type = inputType
      ? lookupCompositeOne(enumIndex, {"#Name" : inputType})
      : "NONE";

    const inputSpeaker = row[inputIdx.Speaker];
    const speaker = inputSpeaker
      ? lookupCompositeOne(speakerIndex, {"speaker" : inputSpeaker})
      : "";

    const inputActionId = row[inputIdx.actionId];
    const actionId = inputActionId
      ? lookupCompositeOne(actionIndex, {"#Name" : inputActionId})
      : "";

    const dataRow = Array(columns).fill("");


    const text = row[inputIdx.Text];
    if(text && String(text).trim() !== "") {
      const key = textKeyList[rowIndex].join("_");
      returnTable.push([
        key,
        text
      ]);

      textKey = key;
      translationKor = text;
    }

    if(type && String(type).trim() === "branch") {
      lastBranchIndex = index;
    }

    if(type && String(type).trim() === "choice") {
      const inputBonusId = row[inputIdx.bonusId];
      bonusId = inputBonusId
        ? lookupCompositeOne(bonusIndex, {"#Name" : inputBonusId})
        : "";
      const bonusLabelKey = [
        type,
        lastBranchIndex,
      ].map(v => String(v ?? "").trim()).join("_");
      bonusLabel = bonusLabelKey;
    }

    const inputCharacterAssetKind = row[inputIdx.CharacterAssetKind];
    const inputCharacterId = row[inputIdx.CharacterId];
    const inputCostumeId = row[inputIdx.CostumeId];
    const inputEmotion = row[inputIdx.Emotion];
    const inputCharacterAssetNum = row[inputIdx.CharacterAssetNum];
    const inputSpaceId = row[inputIdx.spaceName];
    const inputTimeOfDay = row[inputIdx.timeOfDay];
    const inputFxAssetId = row[inputIdx.fxAssetId];

    if(inputCharacterAssetKind && String(inputCharacterAssetKind).trim() !== "") {
      const assetKind = inputCharacterAssetKind
      ? lookupCompositeOne(enumIndex, {"#Name" : inputCharacterAssetKind})
      : "";

      const characterId = inputCharacterId
      ? lookupCompositeOne(characterIndex, {"#Name" : inputCharacterId})
      : "";

      const costumeId = inputCostumeId
      ? lookupCompositeOne(costumeIndex, {"#Name" : inputCostumeId})
      : "";

      const emotion = inputEmotion
      ? lookupCompositeOne(enumIndex, {"#Name" : inputEmotion})
      : "";

      const assetLookupKey = [
        assetKind,
        characterId,
        costumeId,
        emotion,
        inputCharacterAssetNum
      ].map(v => String(v ?? "").trim()).join("|");

      assetId = characterAssetIndex.indexMap[assetLookupKey];
      assetName = characterId;
    } else if (inputSpaceId && String(inputSpaceId).trim() !== "") {
      const kind = "BACKGROUND";
      const space_id = inputSpaceId
        ? lookupCompositeOne(spaceIndex, {"#Name" : inputSpaceId})
        : "";
      const timeOfDay_space = inputTimeOfDay
        ? lookupCompositeOne(enumIndex, {"#Name" : inputTimeOfDay})
        : "";
      Logger.log(timeOfDay_space);
      if(timeOfDay_space === "") {
        throw new Error("장소에 입력한 시간대가 없습니다. : " + inputSpaceId);
      }
      
       const assetLookupKey = [
          space_id,
          kind,
          timeOfDay_space
        ].map(v => String(v ?? "").trim()).join("|");

        Logger.log(assetLookupKey);

      assetId = spaceAssetIndex.indexMap[assetLookupKey];
      Logger.log(assetId);
      assetName = type;
    } else if (inputFxAssetId && String(inputFxAssetId).trim() !== ""){
      const fx_assetId = inputFxAssetId
        ? lookupCompositeOne(assetIndex, {"#Name" : inputFxAssetId})
        : "";

      assetId = fx_assetId;
      assetName = type;
    }

    dataRow[targetIdx.sceneId] = sceneId;
    dataRow[targetIdx.speaker] = speaker;
    dataRow[targetIdx.shot] = shot;
    dataRow[targetIdx.index] = index;
    dataRow[targetIdx.type] = type;
    dataRow[targetIdx.value] = value;
    dataRow[targetIdx.next] = next;
    dataRow[targetIdx.tag] = tag;
    dataRow[targetIdx.wait] = wait;
    dataRow[targetIdx.posReset] = posReset;
    dataRow[targetIdx.layer] = layer;
    dataRow[targetIdx.bonusScore] = bonusScore;
    dataRow[targetIdx.assetId] = assetId;
    dataRow[targetIdx.assetName] = assetName;
    dataRow[targetIdx.textKey] = textKey;
    dataRow[targetIdx["translation-koKr"]] = translationKor;
    dataRow[targetIdx.bonusId] = bonusId;
    dataRow[targetIdx.bonusLabel] = bonusLabel;
    dataRow[targetIdx.actionId] = actionId;
    dataRow[targetIdx["#Order"]] = sheetOrder;

    table.push(dataRow);
  }

  mergeSheetDataToTargetSheet(targetSheet, table);

  return returnTable;

}

function generateTextKey(targetSheet, inputData) {
  const fullData = targetSheet.getDataRange().getValues();
  const targetHeader = fullData[0];
  const localizationIdx = makeHeaderIndex_(targetHeader);
  
  const keyMap = new Map();
  fullData.forEach((row, index) => {
    if(row[0]) {
      keyMap.set(String(row[0]).trim(), index);
    }
  });

  inputData.forEach( ([key, koText]) => {
    const trimmedKey = String(key).trim();

    if(keyMap.has(trimmedKey)) {
       // [케이스 1] 이미 존재하는 Key일 경우
      const rowIndex = keyMap.get(trimmedKey);

      // key 값 재확인 및 ko-KR(G열) 값만 교체
      fullData[rowIndex][localizationIdx.key] = trimmedKey;
      fullData[rowIndex][localizationIdx["ko-KR"]] = koText;
    } else {
      // [케이스 2] 새로운 Key일 경우
      // 새 행 생성 (이미지 예시의 characterInfo 형식을 기본으로 사용)
       const newRow = Array(fullData[0].length).fill("");
      newRow[localizationIdx.key] = trimmedKey;
      newRow[localizationIdx.tag] = "storyscript";
      newRow[localizationIdx["#type"]] = "characterDialog";
      newRow[localizationIdx["#translate"]] = "false";
      newRow[localizationIdx["ko-KR"]] = koText;

      fullData.push(newRow);
    }
  });

  // 4. 수정된 전체 데이터를 시트에 한 번에 덮어씁니다. (Batch Update)
  // 기존 범위보다 데이터가 늘어날 수 있으므로 새롭게 범위를 지정합니다.
  const targetRange = targetSheet.getRange(1, 1, fullData.length, fullData[0].length);
  targetRange.setNumberFormat("@");
  targetRange.setValues(fullData);
}

