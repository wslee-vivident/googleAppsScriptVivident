function storyGenerate(targetSheet) {
    const endPoint = "https://data-generate-api-570233004501.asia-northeast3.run.app/ai-create/story-generate";
    const promptFile = "story_generate_default.txt";

    var fileId = PropertiesService.getScriptProperties().getProperty("FILE_ID");
    var masterFile = SpreadsheetApp.openById(fileId);

    var sheet = masterFile.getSheetByName(targetSheet).getDataRange().getValues();
    var headers = sheet[0];
    var headerH = makeHeaderIndex_(headers);
    var selectedColumns = [
        headerH["key"],
        headerH["speaker"],
        headerH["emotion"],
        headerH["level"],
        headerH["direction"],
        headerH["location"],
        headerH["innerThought"]
    ];

    const dictionaryId = PropertiesService.getScriptProperties().getProperty("DICTIONARY");
    const dictionarySheet = SpreadsheetApp.openById(dictionaryId).getSheetByName("Dictionary");
    const dicValues = dictionarySheet.getDataRange().getValues();
    const dicObj = convertToObject_(dicValues);
    const dictionary = arrayToDictionary(dicObj, "ko-KR");

    const refData = loadRefData(masterFile);



    const speakerSheet = SpreadsheetApp.openById(localizationSheetId).getSheetByName("dialogSpeaker");
    const speakerValues = speakerSheet.getDataRange().getValues();
    const speakerHeader = speakerValues[0];
    const speakerData = speakerValues.slice(1);

    const speakerIndex = buildLookupCompositeOne(
        speakerData,
        speakerHeader,
        ["Name"],
        "id"
    );
    
    var originHeader = ["key", "character","type", "text"];
    var originDataIndex = makeHeaderIndex_(originHeader);
    var originData = [];
    originData = sheet
        .filter(row => row[headers.indexOf("#translate")] === "true" && row[headers.indexOf("ko-KR")] !== '' && row[headers.indexOf("ko-KR")] !== undefined)
        .map(row => selectedColumns.map(index => row[index]) || "");

    for( const [rowIndex, rowData] of originData.entries()) {
        const originCharacterText = rowData[originDataIndex["character"]];
        const characterId = originCharacterText
        ? lookupCompositeOne(speakerIndex, {"Name" : originCharacterText})
        : "";

        rowData[originDataIndex["character"]] = characterId;
    }

    originData.unshift(originHeader);
    if(originData.length <= 0) {
        return SpreadsheetApp.getUi().alert("잘못된 시트 접근입니다. 로컬 테이블에서 실행 필요!");
    }

    
    const payload = {
        data : originData,
        globalSetup : targetCountries,
        dictionary : dictionary,
        sheetName : targetSheet.toString(),
        sheetId : fileId,
        promptFile : promptFile
    };

    Logger.log(JSON.stringify(payload.dictionary, null, 2));

    /*
    const options = {
        method : "post",
        contentType : "application/json",
        payload : JSON.stringify(payload),
        muteHttpExceptions : true,
    };

    Logger.log(JSON.stringify(payload, null, 2));
    
    try {
        const response = UrlFetchApp.fetch(endPoint, options);
        Logger.log(`sent: ${response.getResponseCode()}`);

    } catch (e) {
        Logger.log(`Error sending : ${e.message}`);
    }
    */
}
