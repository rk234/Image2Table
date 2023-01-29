
function extractTable(image) {
    var result = new cv.Mat();
    cv.cvtColor(image, result, cv.COLOR_BGR2GRAY)
    cv.adaptiveThreshold(result, result, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 5);
    cv.Canny(result, result, 200, 300)
    cv.blur(result, result,new cv.Size(4,4))
    cv.threshold(result, result, 0, 255, cv.THRESH_BINARY)

    var cnts = new cv.MatVector();

    cv.findContours(result, cnts, new cv.Mat(), cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
    cnts = grabContours(cnts);

    //TODO: Sort the contours by their size!
    
    var tableCnt;
    for(var i = 0; i < cnts.size(); i++) {
        const cnt = cnts.get(i);
        const peri = cv.arcLength(cnt, true);
        var approx = new cv.Mat()
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true)
        if(approx.size().width * approx.size().height == 4) {
            tableCnt = approx;
            break;
        }
    }

    return {bw: fourPointTransform(result, tableCnt), color: fourPointTransform(image, tableCnt)};
}

function grabContours(cnts) {
    if(cnts.size() == 2)
        cnts = cnts.get(0)
    else if(cnts.size() == 3)
        cnts = cnts.get(1)

    return cnts;
}

function fourPointTransform(image, contour) {
    let corner1 = new cv.Point(contour.data32S[0], contour.data32S[1]);
    let corner2 = new cv.Point(contour.data32S[2], contour.data32S[3]);
    let corner3 = new cv.Point(contour.data32S[4], contour.data32S[5]);
    let corner4 = new cv.Point(contour.data32S[6], contour.data32S[7]);

    //Order the corners
    let cornerArray = [{ corner: corner1 }, { corner: corner2 }, { corner: corner3 }, { corner: corner4 }];
    //Sort by Y position (to get top-down)
    cornerArray.sort((item1, item2) => { return (item1.corner.y < item2.corner.y) ? -1 : (item1.corner.y > item2.corner.y) ? 1 : 0; }).slice(0, 5);

    //Determine left/right based on x position of top and bottom 2
    let tl = cornerArray[0].corner.x < cornerArray[1].corner.x ? cornerArray[0] : cornerArray[1];
    let tr = cornerArray[0].corner.x > cornerArray[1].corner.x ? cornerArray[0] : cornerArray[1];
    let bl = cornerArray[2].corner.x < cornerArray[3].corner.x ? cornerArray[2] : cornerArray[3];
    let br = cornerArray[2].corner.x > cornerArray[3].corner.x ? cornerArray[2] : cornerArray[3];

    //Calculate the max width/height
    let widthBottom = Math.hypot(br.corner.x - bl.corner.x, br.corner.y - bl.corner.y);
    let widthTop = Math.hypot(tr.corner.x - tl.corner.x, tr.corner.y - tl.corner.y);
    let theWidth = (widthBottom > widthTop) ? widthBottom : widthTop;
    let heightRight = Math.hypot(tr.corner.x - br.corner.x, tr.corner.y - br.corner.y);
    let heightLeft = Math.hypot(tl.corner.x - bl.corner.x, tr.corner.y - bl.corner.y);
    let theHeight = (heightRight > heightLeft) ? heightRight : heightLeft;

    //Transform!
    let finalDestCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, theWidth - 1, 0, theWidth - 1, theHeight - 1, 0, theHeight - 1]); //
    let srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.corner.x, tl.corner.y, tr.corner.x, tr.corner.y, br.corner.x, br.corner.y, bl.corner.x, bl.corner.y]);
    let dsize = new cv.Size(theWidth, theHeight);
    let M = cv.getPerspectiveTransform(srcCoords, finalDestCoords)
    
    var result = new cv.Mat();

    cv.warpPerspective(image, result, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    
    return result;
}

function removeText(table_thresh) {
    let width, height;
    ({width, height} = table_thresh.size());

    var cnts = new cv.MatVector();

    cv.findContours(table_thresh, cnts, new cv.Mat(), cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE)

    for(var i = 0; i < cnts.size(); i++) {
        const c = cnts.get(i);
        const area = cv.contourArea(c)
        
        var vec = new cv.MatVector();
        vec.push_back(c)

        if(area < (height*width)/2)
            cv.drawContours(table_thresh, vec, -1, new cv.Scalar(0,0,0), -1)
    }
    //TODO: Fill possible gaps in the table grid lines. Line 53 in python
    var verticalKernel = new cv.Mat();
    verticalKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1,5));
    var horizontalKernel = new cv.Mat();
    horizontalKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5,1));

    cv.morphologyEx(table_thresh, table_thresh, cv.MORPH_CLOSE, verticalKernel);
    cv.morphologyEx(table_thresh, table_thresh, cv.MORPH_CLOSE, horizontalKernel);

    return table_thresh;
}

function getCells(table_thresh, cols) {
    ({width, height} = table_thresh.size());

    var cellCnts = new cv.MatVector();
    cv.findContours(table_thresh, cellCnts, new cv.Mat(), cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);
    //Sort Contours Top to Bottom
    console.log(cellCnts.size())

    var tableRows = []
    var row = []

    var tableIndex = 0;
    for(var i = cellCnts.size()-1; i >= 0; i--) {
        const c = cellCnts.get(i);
        const area = cv.contourArea(c);
        var vec = new cv.MatVector();
        vec.push_back(c)
        
        if(area < (height*width)/2 && area > (height*width) / 1000) {
            tableIndex++;
            
            row.push(c)
            
            if(tableIndex % 4 == 0) {
                tableRows.push(row);
                row = []
            }
        }
    }

    return tableRows;
}

function getText(table, tableRows) {
    var textTable = []
    tableRows.forEach(row => {
        var textRow = []
        row.forEach(c => {
            const cnt = c;
            const peri = cv.arcLength(cnt, true);
            var approx = new cv.Mat()
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true)

            var cell = fourPointTransform(table, approx)
            cv.imshow('canvas-out',cell);

            var text = OCRAD(document.querySelector('#canvas-out'));

            textRow.push(text.replace("|", "").replace("\n", "").replace("'","").trim())
        })

        textTable.push(textRow);
    })

    return textTable;
}

function getTable(mat, rows, cols) {
    let table, table_thresh;
    ({color: table, bw: table_thresh} = extractTable(mat));
    table_thresh = removeText(table_thresh);
    var tableRows = getCells(table_thresh, cols);
    var textTable = getText(table, tableRows);
    
    return textTable;
}