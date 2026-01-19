function transferToScriptGenerator() {
    const targetId = PropertiesService.getScriptProperties().getProperty("SCRIPT_GENERATOR");

    const targetFile = SpreadsheetApp.openById(targetId);
    const targetSheet = targetFile.getSheetByName("GENERATOR");
    const targetHeader = targetSheet.getDataRange().getValues()[0];
    const targetH = makeHeaderIndex_(targetHeader);

    const scriptInfoSheet = SpreadsheetApp.getActive().getSheetByName("script_info");
    const scriptInfoValues = scriptInfoSheet.getDataRange().getValues();
    const scriptInfoHeader = scriptInfoValues[0];
    const scriptInfoData = scriptInfoValues.slice(1);
    const scriptInfoH = makeHeaderIndex_(scriptInfoHeader);

    const generatedScriptSheet = SpreadsheetApp.getActive().getSheetByName("script_generator"); 
    const generatedScriptValues = generatedScriptSheet.getDataRange().getValues();
    const generatedScriptHeader = generatedScriptValues[0];
    const generatedScriptData = generatedScriptValues.slice(1);
    const generatedScriptH = makeHeaderIndex_(generatedScriptHeader);

    //스크립트 메인 정보에서 id 기준으로 location 정보 추출
    const sceneMainInfo = scriptInfoData.reduce((acc, row) => {
        const sceneId = row[scriptInfoH["sceneId"]];
        acc[sceneId] = {
            location : row[scriptInfoH["location"]],
        };
        return acc;
    }, {});

    //GENERATOR에 보낼 배열 데이터 구성
    let outputData = [];
    const columns = targetHeader.length;

    for(let i = 0; i < generatedScriptData.length; i++) {
        const row = generatedScriptData[i];
        const sceneId = row[generatedScriptH["sceneId"]];
        
        const isStart = (i === 0) || (sceneId !== generatedScriptData[i - 1][generatedScriptH["sceneId"]]);
        const isEnd = (i === generatedScriptData.length - 1) || (sceneId !== generatedScriptData[i + 1][generatedScriptH["sceneId"]]);

        if(isStart) {
            //씬 시작 시, location 정보 추가
            const startRow = new Array(columns).fill("");
            startRow[targetH["sceneId"]] = sceneId;
            startRow[targetH["type"]] = "배경";
            startRow[targetH["spaceName"]] = sceneMainInfo[sceneId]?.location || "";
            outputData.push(startRow);
        }

        const currentRow = new Array(columns).fill("");
        const inputSpeaker = row[generatedScriptH["speaker"]];
        const inputText = row[generatedScriptH["text"]];
        const inputChoiceGrade = row[generatedScriptH["choice_grade"]];
        const inputReplyText = row[generatedScriptH["reply_text"]];
        let tag = "";

        currentRow[targetH["sceneId"]] = sceneId;
        switch(inputSpeaker) {
            case "지문":
                currentRow[targetH["type"]] = "지문";
                currentRow[targetH["Text"]] = inputText;
                break;
            case "주인공":
                currentRow[targetH["type"]] = "대사";
                currentRow[targetH["Speaker"]] = "유저";
                currentRow[targetH["Text"]] = inputText;
                break;
            case "선택지":
                currentRow[targetH["type"]] = "선택지";
                currentRow[targetH["Text"]] = inputText;
                if(inputChoiceGrade === "COOL") {
                    currentRow[targetH["next"]] = "#1";
                    tag = "#1";
                } else if(inputChoiceGrade === "BRILLIANT") {
                    currentRow[targetH["next"]] = "#2";
                    tag = "#2";
                } else if(inputChoiceGrade === "AWESOME") {
                    currentRow[targetH["next"]] = "#3";
                    tag = "#3";
                }
                const choiceValues = new Array(columns).fill("");
                choiceValues[targetH["sceneId"]] = sceneId;
                choiceValues[targetH["value"]] = inputChoiceGrade;
                choiceValues[targetH["type"]] = "대사";
                choiceValues[targetH["Speaker"]] = "유저";
                choiceValues[targetH["Text"]] = inputReplyText;
                choiceValues[targetH["tag"]] = tag;
                outputData.push(choiceValues);
                break;
            default:
                currentRow[targetH["type"]] = "대사";
                currentRow[targetH["Speaker"]] = inputSpeaker;
                currentRow[targetH["Text"]] = inputText;
                break;
        }

        outputData.push(currentRow);
        
        
        if(isEnd) {
            //씬 종료 시, 종료 line 추가
            const endRow = new Array(columns).fill("");
            endRow[targetH["sceneId"]] = sceneId;
            endRow[targetH["isEnd"]] = "TRUE";
            outputData.push(endRow);
        }
    }

    //타겟 시트에 데이터 쓰기
    targetRange = targetSheet.getRange(2, 1, outputData.length, outputData[0].length);
    targetRange.setValues(outputData);
}
