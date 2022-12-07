var $ = document.querySelector.bind(document);

var __initTestParams = {
    server: "unknown",
    result: 0,
    chunk_size: 0,
    test_duration: 0,
};

var testParams = {
    server: "unknown",
    result: 0,
    chunk_size: 0,
    test_duration: 0,
};

var testStartTime = 0;

var btnStartShahid = $("#action-start-shahid"),
    btnStartLibre = $("#action-start-libre"),
    btnStart = $("#action-start"),
    txtResult = $("#txt-result"),
    txtRTT = $("#txt-rtt"),
    txtRTTDescription = $("#txt-rtt-description");


btnStartLibre.addEventListener('click', () => {
    startTest('libre')
})

btnStartShahid.addEventListener('click', () => {
    startTest('shahid')
})

btnStart.addEventListener('click', () => {
    startTest();
})


function updateResultText(result) {
    txtResult.innerText = Number(result).toFixed(2) || 'starting';
}

function disableButtons(){
    btnStartShahid.disabled = true
    btnStartLibre.disabled = true
    btnStart.disabled = true
}

function enableButtons(){
    btnStartShahid.disabled = false
    btnStartLibre.disabled = false
    btnStart.disabled = false;

}

function onTestDone(result, logs){

    testParams.result = result;
    testParams.test_duration = (Date.now() - testStartTime) / 1000.0

    console.log(logs)
    enableButtons();
    updateResultText(result);
    // logResultToRemote();
}

function startTest() {
    disableButtons();

    rttTest((description, result) => {
        txtRTT.innerText = Number(result).toFixed(2);
        txtRTTDescription.innerText = description

        speedTest('libre')
    })
}

function rttTest(onDone){
    checkConnection({
        onDone: onDone
    })
}

function speedTest(server){
    const settings = {
        onResultUpdate: updateResultText,
        onDone: onTestDone
    };
    switch (server) {
        case 'shahid':
            settings.url = 'test_assets/CHUNK_SIZE';
            settings.chunkSize = 30;
            break;
        case 'libre':
            settings.url = 'https://de4.backend.librespeed.org/garbage.php?cors=true&r=0.28475918550518564&ckSize=CHUNK_SIZE';
            settings.chunkSize = 100;
            break;
    }

    testParams = {...__initTestParams};

    testParams.chunk_size = settings.dlChunkSize;
    testParams.server = server

    testStartTime = Date.now();

    startSpeedTest(settings)

}

function logResultToRemote(){
    const headers = new Headers()
    headers.append("Content-Type", "application/json")
    
    const body = testParams
    const options = {
      method: "POST",
      headers,
      mode: "cors",
      body: JSON.stringify(body),
    }
    
    fetch("https://eo8sbyc35pvmxt0.m.pipedream.net", options)
}