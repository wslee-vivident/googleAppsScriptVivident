function storyGenerate() {
    const endPoint = "https://data-generate-api-570233004501.asia-northeast3.run.app/ai-create/full-story-generate";
    const promptFile = "story_generate_fullScript.txt";

    var fileId = PropertiesService.getScriptProperties().getProperty("FILE_ID");
    var masterFile = SpreadsheetApp.openById(fileId);
    var sheetid = SpreadsheetApp.getActive().getId();

    var values = SpreadsheetApp.getActive().getSheetByName("dialog_generator").getDataRange().getValues();
    var inputHeader = values[0];
    var inputData = values.slice(1);
    var inputH = makeHeaderIndex_(inputHeader);

    const dictionaryId = PropertiesService.getScriptProperties().getProperty("DICTIONARY");
    const dictionarySheet = SpreadsheetApp.openById(dictionaryId).getSheetByName("Dictionary");
    const dicValues = dictionarySheet.getDataRange().getValues();
    const dicObj = convertToObject_(dicValues);
    const dictionary = arrayToDictionary(dicObj, "ko-KR");

    const speakerSheet = SpreadsheetApp.getActive().getSheetByName("dialogSpeaker");
    const speakerValues = speakerSheet.getDataRange().getValues();
    const speakerHeader = speakerValues[0];
    const speakerData = speakerValues.slice(1);

    const speakerIndex = buildLookupCompositeOne(
        speakerData,
        speakerHeader,
        ["Name"],
        "id"
    );
    const modelIndex = buildLookupCompositeOne(
        speakerData,
        speakerHeader,
        ["id"],
        "model"
    );

    const sceneInfoSheet = SpreadsheetApp.getActive().getSheetByName("scene_info");
    const sceneInfoValues = sceneInfoSheet.getDataRange().getValues();
    const sceneInfoHeader = sceneInfoValues[0];
    const sceneInfoData = sceneInfoValues.slice(1);
    const sceneInfoH = makeHeaderIndex_(sceneInfoHeader);
    const selectedComlumnsSceneInfo = [
        sceneInfoH["sceneId"],
        sceneInfoH["narrationTone"],
        sceneInfoH["writingStyle"],
        sceneInfoH["introContext"],
        sceneInfoH["location"]
    ];
    const sceneHeader = [
      "sceneId",
      "narrationTone",
      "writingStyle",
      "introContext",
      "location"
    ];
    const sceneIds = sceneInfoData
        .filter((row) => String(row[sceneInfoH["isGenerate"]]).trim() === "true")
        .map((row) => row[sceneInfoH["sceneId"]]);

    const sceneInfoFiltered = sceneInfoData
        .filter((row) => String(row[sceneInfoH["isGenerate"]]).trim() === "true")
        .map((row) => selectedComlumnsSceneInfo.map((colIdx) => row[colIdx]) || "");

    sceneInfoFiltered.unshift(sceneHeader);
    const sceneInfoConvert = convertToObject_(sceneInfoFiltered);
    const sceneInfoObj = arrayToDictionary(sceneInfoConvert, "sceneId");

    const refData = loadRefData(masterFile);

    const enumIndex = buildLookupCompositeOne(
      refData["enum"].data,
      refData["enum"].header,
      ["#Name"],
      "Name"
    );

    const spaceTitleIndex = buildLookupCompositeOne(
        refData["spaces"].data,
        refData["spaces"].header,
        ["#Name"],
        "title"
    );

    const spaceDescIndex = buildLookupCompositeOne(
        refData["spaces"].data,
        refData["spaces"].header,
        ["#Name"],
        "description"
    );

    const localizationIndex = buildLookupCompositeOne(
      refData["localization"].data,
      refData["localization"].header,
      ["key"],
      "ko-KR"
    );
    
    const resultHeader = [
      "sceneId",
      "key",
      "speaker",
      "emotion",
      "level",
      "direction",
      "location",
      "innerThought",
      "narrationTone",
      "writingStyle",
      "introContext",
      "model",
      "temperature"
    ];
    const resultH = makeHeaderIndex_(resultHeader);
    const validSceneIdSet = new Set(sceneIds);
    const filteredDialogs = inputData.filter((row) => {
      const rowSceneId = row[inputH["sceneId"]];

      return validSceneIdSet.has(rowSceneId);
    });

    const resultData = [];
    for( const [rowIndex, rowData] of filteredDialogs.entries()) {
        const inputSpeaker = rowData[inputH["speaker"]];
        const speaker = inputSpeaker
            ? lookupCompositeOne(speakerIndex, {"Name" : inputSpeaker})
            : "";
        const inputEmotion = rowData[inputH["emotion"]];
        const emotion = inputEmotion
            ? lookupCompositeOne(enumIndex, {"#Name" : inputEmotion})
            : "";
        const model = speaker
            ? lookupCompositeOne(modelIndex, {"id" : speaker})
            : "";

        var inputInnerThought = rowData[inputH["innerThought"]];
        var innerThoughtObj = {};
        if(inputInnerThought.toString().trim() !== "") {
            innerThoughtObj = convertInnerThoughtToObj_(inputInnerThought, speaker);
        }

        let inputLocation = rowData[inputH["location"]];
        let defaultLocation = sceneInfoObj[rowData[inputH["sceneId"]]]?.location || "";
        let selectedLocation = "";
        if(inputLocation === "") {
          selectedLocation = defaultLocation;
        } else {
          selectedLocation = inputLocation;
        }
        
        
        const space_title = selectedLocation
            ? lookupCompositeOne(spaceTitleIndex, {"#Name" : selectedLocation})
            : "";
        const space_description = selectedLocation
            ? lookupCompositeOne(spaceDescIndex, {"#Name" : selectedLocation})
            : "";

        const locationTitle = space_title
            ? lookupCompositeOne(localizationIndex, {"key" : space_title})
            : "";
        const locationDesc = space_description
            ? lookupCompositeOne(localizationIndex, {"key" : space_description})
            : "";

        const location = locationTitle + "\n" + locationDesc;
        
        const dataRow = new Array(resultHeader.length).fill("");

        dataRow[resultH["sceneId"]] = rowData[inputH["sceneId"]];
        dataRow[resultH["key"]] = rowData[inputH["key"]];
        dataRow[resultH["speaker"]] = speaker;
        dataRow[resultH["emotion"]] = emotion;
        dataRow[resultH["level"]] = rowData[inputH["level"]];
        dataRow[resultH["direction"]] = rowData[inputH["direction"]];
        dataRow[resultH["location"]] = location;
        dataRow[resultH["innerThought"]] = innerThoughtObj;
        dataRow[resultH["narrationTone"]] = sceneInfoObj[rowData[inputH["sceneId"]]]?.narrationTone || "";
        dataRow[resultH["writingStyle"]] = sceneInfoObj[rowData[inputH["sceneId"]]]?.writingStyle || "";
        dataRow[resultH["introContext"]] = sceneInfoObj[rowData[inputH["sceneId"]]]?.introContext || "";
        dataRow[resultH["model"]] = model;
        dataRow[resultH["temperature"]] = rowData[inputH["temperature"]];

        resultData.push(dataRow);

    }

    resultData.unshift(resultHeader);

    
    const payload = {
        data : resultData,
        dictionary : dictionary,
        sheetName : "dialog_generator",
        sheetId : sheetid,
        promptFile : promptFile
    };

    Logger.log(JSON.stringify(payload.data, null, 2));

    const options = {
        method : "post",
        contentType : "application/json",
        payload : JSON.stringify(payload),
        muteHttpExceptions : true,
    };
    
    try {
        const response = UrlFetchApp.fetch(endPoint, options);
        Logger.log(`sent: ${response.getResponseCode()}`);

    } catch (e) {
        Logger.log(`Error sending : ${e.message}`);
    }
}
