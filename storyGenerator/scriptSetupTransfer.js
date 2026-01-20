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
    let selectionData = [];
    let rowNum = 1;
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
            startRow[targetH["shot"]] = 1;
            startRow[targetH["FX"]] = 1;
            outputData.push(startRow);
        }
        

        const currentRow = new Array(columns).fill("");
        const inputSpeaker = row[generatedScriptH["speaker"]];
        const inputText = row[generatedScriptH["text"]];
        const inputChoiceGrade = row[generatedScriptH["choice_grade"]];
        const inputReplyText = row[generatedScriptH["reply_text"]];
        let tag = "";

        // 현재 행이 "선택지"가 아니고, 쌓여있는 "선택지 답변(selectionData)"이 있다면 지금 출력
        if(inputSpeaker !== "선택지" && selectionData.length > 0) {
            outputData.push(...selectionData);
            selectionData = [];

            currentRow[targetH["tag"]] = "#end";
        }

        currentRow[targetH["sceneId"]] = sceneId;
        currentRow[targetH["shot"]] = 1;
        currentRow[targetH["FX"]] = 1;
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
                if(selectionData.length === 0) {
                  const branchRow = new Array(columns).fill("");
                  branchRow[targetH["sceneId"]] = sceneId;
                  branchRow[targetH["type"]] = "브랜치";
                  outputData.push(branchRow);
                }

                currentRow[targetH["type"]] = "선택지";
                currentRow[targetH["Text"]] = inputText;

                if(inputChoiceGrade === "COOL") tag = "#1";
                else if(inputChoiceGrade === "BRILLIANT") tag = "#2";
                else if(inputChoiceGrade === "AWESOME") tag = "#3";
                
                currentRow[targetH["next"]] = tag;

                const choiceValues = new Array(columns).fill("");
                choiceValues[targetH["sceneId"]] = sceneId;
                choiceValues[targetH["value"]] = inputChoiceGrade;
                choiceValues[targetH["type"]] = "대사";
                choiceValues[targetH["Speaker"]] = "유저";
                choiceValues[targetH["Text"]] = inputReplyText;
                choiceValues[targetH["tag"]] = tag;
                choiceValues[targetH["next"]] = "#end";
                choiceValues[targetH["FX"]] = 1;
                choiceValues[targetH["shot"]] = 1;
                selectionData.push(choiceValues);
                break;
            default:
                currentRow[targetH["type"]] = "대사";
                currentRow[targetH["Speaker"]] = inputSpeaker;
                currentRow[targetH["Text"]] = inputText;
                break;
        }

        outputData.push(currentRow);
        
        
        if(isEnd) {
            if(selectionData.length > 0) {
              outputData.push(...selectionData);
              selectionData = [];
            }

            //씬 종료 시, 종료 line 추가
            const endRow = new Array(columns).fill("");
            endRow[targetH["sceneId"]] = sceneId;
            endRow[targetH["type"]] = "종료";
            outputData.push(endRow);
        }
    }

    //타겟 시트에 데이터 쓰기
    mergeSheetDataToTargetSheet(targetSheet, outputData, 1);
}
