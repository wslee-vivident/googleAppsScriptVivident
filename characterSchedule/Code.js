function validateScheduleData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('CharacterSchedule');
  
  // 시트가 없으면 에러
  if (!sheet) {
    SpreadsheetApp.getUi().alert( 
      '"CharacterSchedule" 시트를 찾을 수 없습니다.시트 이름을 확인해주세요.', 
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  // 헤더 행 제외
  const startRow = 3;
  
  const errors = [];
  
  const headers = values[0];
  const colIndices = {
    scheduleID: headers.indexOf('ScheduleID'),
    characterID: headers.indexOf('CharacterID'),
    startDate: headers.indexOf('StartDate'),
    startTime: headers.indexOf('StartTime'),
    endDate: headers.indexOf('EndDate'),
    endTime: headers.indexOf('EndTime')
  };
  
  for (let i = startRow; i < values.length; i++) {
    const row = values[i];
    const rowNumber = i + 1;
    
    if (!row[colIndices.scheduleID]) continue;
    
    const characterID = row[colIndices.characterID];
    const startDate = row[colIndices.startDate];
    const startTime = row[colIndices.startTime];
    const endDate = row[colIndices.endDate];
    const endTime = row[colIndices.endTime];
    
    if (startTime) {
      const timeMatch = startTime.match(/^(\d{2}):(\d{2})$/);
      if (timeMatch) {
        const minutes = timeMatch[2];
        if (minutes !== '00') {
          errors.push({
            row: rowNumber,
            type: 'INVALID_TIME_UNIT',
            message: `Row ${rowNumber}: StartTime "${startTime}"은 1시간 단위가 아닙니다. 분은 00이어야 합니다.`,
            severity: 'ERROR'
          });
        }
      } else {
        errors.push({
          row: rowNumber,
          type: 'INVALID_TIME_FORMAT',
          message: `Row ${rowNumber}: StartTime "${startTime}"의 형식이 잘못되었습니다. (HH:MM 형식이어야 함)`,
          severity: 'ERROR'
        });
      }
    }
    
    if (i > startRow) {
      const prevRow = values[i - 1];
      const prevCharacterID = prevRow[colIndices.characterID];
      const prevEndDate = prevRow[colIndices.endDate];
      const prevEndTime = prevRow[colIndices.endTime];
      
      if (characterID === prevCharacterID) {
        const isContinuous = 
          (prevEndDate === startDate && prevEndTime === startTime) || // 같은 날 시간 연속
          (isNextDay(prevEndDate, startDate) && prevEndTime === '24:00' && startTime === '00:00'); // 자정 넘어가는 경우
        
        if (!isContinuous) {
          errors.push({
            row: rowNumber,
            type: 'TIME_DISCONTINUITY',
            message: `Row ${rowNumber}: 이전 스케줄의 종료 시간(${prevEndDate} ${prevEndTime})과 현재 스케줄의 시작 시간(${startDate} ${startTime})이 연속되지 않습니다.`,
            severity: 'WARNING'
          });
        }
      }
    }
  }
  
  displayResults(errors);
  
  return errors;
}

function isNextDay(date1Str, date2Str) {
  const date1 = new Date(date1Str);
  const date2 = new Date(date2Str);
  
  const nextDay = new Date(date1);
  nextDay.setDate(nextDay.getDate() + 1);
  
  return nextDay.toDateString() === date2.toDateString();
}

function displayResults(errors) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 기존 검증 결과 시트 삭제
  const existingSheet = ss.getSheetByName('Validation_Results');
  if (existingSheet) {
    ss.deleteSheet(existingSheet);
  }
  
  // 새 결과 시트 생성
  const resultSheet = ss.insertSheet('Validation_Results');
  
  if (errors.length === 0) {
    resultSheet.getRange('A1').setValue('문제가 없습니다.');
    resultSheet.getRange('A1').setBackground('#d9ead3').setFontWeight('bold');
    
    SpreadsheetApp.getUi().alert('문제가 없습니다.', SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    const headers = [['행 번호', '에러 타입', '심각도', '메시지']];
    resultSheet.getRange(1, 1, 1, 4).setValues(headers);
    resultSheet.getRange(1, 1, 1, 4).setBackground('#4a86e8').setFontColor('#ffffff').setFontWeight('bold');
    
    const errorData = errors.map(error => [
      error.row,
      error.type,
      error.severity,
      error.message
    ]);
    
    resultSheet.getRange(2, 1, errorData.length, 4).setValues(errorData);
    
    for (let i = 0; i < errors.length; i++) {
      const row = i + 2;
      if (errors[i].severity === 'ERROR') {
        resultSheet.getRange(row, 1, 1, 4).setBackground('#f4cccc');
      } else if (errors[i].severity === 'WARNING') {
        resultSheet.getRange(row, 1, 1, 4).setBackground('#fff2cc');
      }
    }


    resultSheet.autoResizeColumns(1, 4);
    
    const errorCount = errors.filter(e => e.severity === 'ERROR').length;
    const warningCount = errors.filter(e => e.severity === 'WARNING').length;
    
    SpreadsheetApp.getUi().alert(
      '검증 완료', 
      `총 ${errors.length}개의 문제 발견:\n\n🔴 에러: ${errorCount}개\n🟡 경고: ${warningCount}개\n\n"Validation_Results" 시트에서 상세 내용을 확인하세요.`, 
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}


function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('스케줄 검증')
      .addItem('데이터 정합성 검사', 'validateScheduleData')
      .addToUi();
}