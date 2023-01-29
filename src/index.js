const screens = [
    ".home-container",
    ".processing-container",
    ".result-container"
]

/*let mat = cv.imread(document.querySelector(".user-image"));


const table = getTable(mat);

console.log(table);*/


document.querySelector(".image-in").addEventListener('change', (e) => {
    fileSelected(e.target.files[0])
})

document.querySelector(".convert-btn").addEventListener('click', (e) => {
    convert(0,0)
})

document.querySelector(".export-btn").addEventListener('click', (e) => {
    exportCSV(tableData);
})

var tableData;

function fileSelected(file) {
    const image = document.querySelector(".user-image");
    image.src = URL.createObjectURL(file);

    const imageUI = document.querySelector(".user-image-ui");
    imageUI.src = URL.createObjectURL(file);

    console.log(file)
    setScreen(screens[1]);
}

function convert(cols, rows) {

    const indicator = document.querySelector(".progress");

    indicator.classList.remove("inactive")
    let mat = cv.imread(document.querySelector(".user-image"));
    tableData = getTable(mat, cols, rows);
    indicator.classList.add("inactive")

    console.log(tableData);

    injectTable(tableData);

    setScreen(screens[2]);
}

function exportCSV(data) {
    var csv = "";

    data.forEach(row => {
        var rowText = ""
        for(var i = 0; i < row.length; i++) {
            if(i != row.length-1) {
                rowText += row[i] + ", ";
            } else {
                rowText += row[i] + "\n";
            }
        }
        csv += rowText;
    })

    const blob = new Blob([csv], {type: "text/plain;charset=utf-8"})

    saveAs(blob, "output.csv");
}

function injectTable(tbl) {
    const table = document.querySelector("table");
    table.innerHTML = "";
    const tBody = document.createElement("tbody");

    for(var i = 0; i < tbl.length; i++) {
        if(i==0) {
            const tHead = document.createElement("thead")
            const tr = document.createElement("tr");

            tHead.appendChild(tr);

            for(var j = 0; j < tbl[0].length; j++) {
                const data = document.createElement("td");
                data.setAttribute("contenteditable", true)
                data.innerHTML = tbl[i][j];
                tr.appendChild(data);
            }

            table.appendChild(tHead);
        } else {
            const tr = document.createElement("tr");

            tBody.appendChild(tr);

            for(var j = 0; j < tbl[0].length; j++) {
                const data = document.createElement("td");
                data.setAttribute("contenteditable", true)
                data.innerHTML = tbl[i][j];
                tr.appendChild(data);
            }

           
        }

        table.appendChild(tBody);
    }
}

function setScreen(name) {
    screens.forEach(scr => {
        if(scr == name) {
            document.querySelector(scr).classList.remove("inactive");
        } else {
            if(!document.querySelector(scr).classList.contains("inactive")) {
                document.querySelector(scr).classList.add("inactive");
            }
        }
    })
}