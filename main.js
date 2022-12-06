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
    txtResult = $("#txt-result");


btnStartLibre.addEventListener('click', () => {
    startTest('libre')
})

btnStartShahid.addEventListener('click', () => {
    startTest('shahid')
})


function updateResultText(result) {
    txtResult.innerText = result || 'starting';
}

function disableButtons(){
    btnStartShahid.disabled = true
    btnStartLibre.disabled = true
}

function enableButtons(){
    btnStartShahid.disabled = false
    btnStartLibre.disabled = false
}

function onTestDone(result, logs){

    testParams.result = result;
    testParams.test_duration = (Date.now() - testStartTime) / 1000.0

    console.log(logs)
    enableButtons();
    updateResultText(result);
    logResultToRemote();
}

function startTest(server) {
    const settings = {
        onResultUpdate: updateResultText,
        onDone: onTestDone
    };
    switch (server) {
        case 'shahid':
            settings.dlUrl = 'test_assets/CHUNK_SIZE';
            settings.dlChunkSize = 30;
            break;
        case 'libre':
            settings.dlUrl = 'https://de4.backend.librespeed.org/garbage.php?cors=true&r=0.28475918550518564&ckSize=CHUNK_SIZE';
            settings.dlChunkSize = 100;
            break;
    }

    testParams = {...__initTestParams};

    testParams.chunk_size = settings.dlChunkSize;
    testParams.server = server

    testStartTime = Date.now();

    disableButtons();
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