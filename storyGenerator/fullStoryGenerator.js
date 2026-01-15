function fullStoryGenerate() {
    const endPoint = "https://data-generate-api-570233004501.asia-northeast3.run.app/ai-create/full-story-generate";
    const promptFile = "story_generate_fullScript.txt";

    var fileId = PropertiesService.getScriptProperties().getProperty("FILE_ID");
    var masterFile = SpreadsheetApp.openById(fileId);
    var sheetId = SpreadsheetApp.getActive().getId();

    var values = SpreadsheetApp.getActive().getSheetByName("script_info").getDataRange().getValues();
    var inputHeader = values[0];
    var inputData = values.slice(1);
    var inputH = makeHeaderIndex_(inputHeader);

    //용어집 데이터화
    const dictionaryId = PropertiesService.getScriptProperties().getProperty("DICTIONARY");
    const dictionarySheet = SpreadsheetApp.openById(dictionaryId).getSheetByName("Dictionary");
    const dicValues = dictionarySheet.getDataRange().getValues();
    const dicObj = convertToObject_(dicValues);
    const dictionary = arrayToDictionary(dicObj, "ko-KR");

    //캐릭터 참조 테이블 매핑 구성
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

    //게임 시스템 타입 참조 테이블 매핑 구성
    const systemSheetData = SpreadsheetApp.getActive().getSheetByName("ref_system").getDataRange().getValues();
    const systemDataHeader = systemSheetData[0];
    const systemDataBody = systemSheetData.slice(1);

    const systemIndex = buildLookupCompositeOne(
        systemDataBody,
        systemDataHeader,
        ["Name"],
        "id"
    );

    const sceneIds = values
        .filter((row) => String(row[inputH["isGenerate"]]).trim() === "true")
        .map((row) => row[inputH["sceneId"]]);

    
    //마스터 테이블에서 필요한 데이터들 인덱스 매핑 구성
    const refData = loadRefData(masterFile);
    const enumIndex = buildLookupCompositeOne(
      refData["enum"].data,
      refData["enum"].header,
      ["#Name"],
      "Name"
    );
    const spaceIndex = buildLookupCompositeOne(
        refData["spaces"].data,
        refData["spaces"].header,
        ["#Name"],
        "id"
    );
    const spaceTitleIndex = buildLookupCompositeOne(
        refData["spaces"].data,
        refData["spaces"].header,
        ["id"],
        "title"
    );
    const spaceDescIndex = buildLookupCompositeOne(
        refData["spaces"].data,
        refData["spaces"].header,
        ["id"],
        "description"
    );
    const spaceParentIndex = buildLookupCompositeOne(
        refData["spaces"].data,
        refData["spaces"].header,
        ["#Name"],
        "parentId"
    );
    const localizationIndex = buildLookupCompositeOne(
      refData["localization"].data,
      refData["localization"].header,
      ["key"],
      "ko-KR"
    );


    const enumH = makeHeaderIndex_(refData["enum"].header);
    const emotionList = refData["enum"].data
        .filter((row) => String(row[enumH["Type"]]).trim() === "Emotion")
        .map((row) => row[enumH["Name"]]);

    //Logger.log(emotionList);
    
    const resultHeader = [
      "sceneId",
      "character",
      "level",
      "systemKind",
      "direction",
      "place",
      "location",
      "model",
      "temperature"
    ];
    const resultH = makeHeaderIndex_(resultHeader);
    const validSceneIdSet = new Set(sceneIds);
    const filteredData = inputData.filter((row) => {
        const rowSceneId = row[inputH["sceneId"]];

        return validSceneIdSet.has(rowSceneId);
    });

    //Logger.log(filteredData);

    const resultData = [];
    for( const [rowIndex, rowData] of filteredData.entries() ) {
        const inputCharacter = rowData[inputH["character"]];
        const character = inputCharacter
            ? lookupCompositeOne(speakerIndex, {"Name" : inputCharacter})
            : "";
        
        const inputSystem = rowData[inputH["systemKind"]];
        const system = inputSystem
            ? lookupCompositeOne(systemIndex, {"Name" : inputSystem})
            : "";

        const inputLocation = rowData[inputH["location"]];
        const location_id = inputLocation
            ? lookupCompositeOne(spaceIndex, {"#Name" : inputLocation})
            : "";
        const placeId = inputLocation
            ? lookupCompositeOne(spaceParentIndex, {"#Name" : inputLocation})
            : "";
        
        const locationTitleKey = location_id
            ? lookupCompositeOne(spaceTitleIndex, {"id" : location_id})
            : "";
        const locationDescriptionKey = location_id
            ? lookupCompositeOne(spaceDescIndex, {"id" : location_id})
            : "";
        const locationKeyList = [locationTitleKey, locationDescriptionKey];
        let location = "";
        for(const key of locationKeyList) {
            const text = key 
                ? lookupCompositeOne(localizationIndex, {"key" : key})
                : "";
            location += (text + "\n");
        }

        const placeTitleKey = placeId
            ? lookupCompositeOne(spaceTitleIndex, {"id" : placeId})
            : "";
        const placeDescriptionKey = placeId
            ? lookupCompositeOne(spaceDescIndex, {"id" : placeId})
            : "";

        const placeKeyList = [placeTitleKey, placeDescriptionKey];
        let place = "";
        for(const key of placeKeyList) {
            const text = key
                ? lookupCompositeOne(localizationIndex, {"key" : key})
                : "";
            
            place += (text + "\n");
        }
        
        
        const dataRow = new Array(resultHeader.length).fill("");
        dataRow[resultH["sceneId"]] = rowData[inputH["sceneId"]];
        dataRow[resultH["character"]] = character;
        dataRow[resultH["level"]] = rowData[inputH["level"]];
        dataRow[resultH["systemKind"]] = system;
        dataRow[resultH["direction"]] = rowData[inputH["DirectionWithContext"]];
        dataRow[resultH["place"]] = place;
        dataRow[resultH["location"]] = location;
        dataRow[resultH["model"]] = rowData[inputH["model"]];
        dataRow[resultH["temperature"]] = rowData[inputH["temperature"]];
       
        resultData.push(dataRow);
    }
    resultData.unshift(resultHeader);

    
    const payload = {
        data : resultData,
        emotions : emotionList,
        dictionary : dictionary,
        sheetName : "script_generator",
        sheetId : sheetId,
        promptFile : promptFile
    };

    //Logger.log(JSON.stringify(payload.data, null, 2));

    
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
