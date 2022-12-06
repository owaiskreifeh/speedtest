

function s_ms(s) { return s * 1000 }
function ms_s(ms) { return ms / 1000 }
function byte_bit(B) { return B * 8 }
function now() { return Date.now() }
function untilNow(t) { return now() - t }
function randomString(len = 16) { return Math.random().toString(36).substring(2, len + 2); }
function log() { console.log("SpeedTest: ", ...arguments) }


const initSettings = {
    testTimeout: 15,
    parallelDownloads: 5,
    chunkSize: 30,
    overheadCompensationFactor: 1.04,
    autoTiming: true,
    graceTime: 1.5,
    parallelDownloadsDelay: 300,
    bonusTimeCap: 400,
    looperInterval: 200,
    overheadCompensationFactor: 1.05,
    retryOnError: true,

    onProgress: log,
    onDone: log,

    url: 'https://de4.backend.librespeed.org/garbage.php?cors=true&r=0.28475918550518564&ckSize=CHUNK_SIZE'
}


// Global vars, not dependant on test
let xhr = [],
    interval = null,
    timeouts = [],
    result = 0,
    resumeTest = true;


// stops all XHR activity, aggressively
function clearRequests() {
    log("stopping pending XHRs");
    if (xhr) {
        for (let i = 0; i < xhr.length; i++) {
            try {
                xhr[i].onprogress = null;
                xhr[i].onload = null;
                xhr[i].onerror = null;
            } catch (e) { }
            try {
                xhr[i].abort();
            } catch (e) { }
            try {
                delete xhr[i];
            } catch (e) { }
        }
        xhr = null;
    }
}

function testDownloadSpeed(passedSettings = {}) {
    const settings = {
        ...initSettings,
        ...passedSettings,
    }


    let totalLoaded = 0,
        startTime = now(),
        bonusTime = 0,
        inGraceTime = true,
        failed = false,
        testProgress = 1;

    const stopTest = () => {
        clearInterval(interval);
        resumeTest = false;
        interval = null;
        clearRequests();
        testProgress = 0;
    }

    const testStream = (index, delay) => {
        const test = () => {
            let prevLoaded = 0,
                req = new XMLHttpRequest();

            xhr[index] = req;

            const abort = () => {
                try {
                    req.abort;
                } catch (e) { }
            }

            const retry = () => {
                testStream(index, 0);
            }

            const onprogress = event => {
                if (!resumeTest) {
                    abort();
                }

                const loadDiff = event.loaded <= 0 ? 0 : event.loaded - prevLoaded;
                if (isNaN(loadDiff) || !isFinite(loadDiff) || loadDiff < 0) return; // just in case

                totalLoaded += loadDiff;
                prevLoaded = event.loaded;
            }

            const onload = () => {
                log("file has been fully downloaded, retying immediately");
                abort();
                retry();
            }

            const onerror = () => {
                log("failed to download file");
                abort();

                if (settings.retryOnError) {
                    log("retrying last failed file")
                    retry();
                } else {
                    failed = true;
                }
            }

            req.onprogress = onprogress;
            req.onload = onload;
            req.onerror = onerror;

            req.open('GET', settings.url.replace("CHUNK_SIZE", settings.chunkSize) + '?rand=' + randomString())
            req.send();
        }

        timeouts.push(setTimeout(test, delay + 1))
    }


    if (interval) {
        stopTest();
    }

    // Start testing
    for (let index = 0; index < settings.parallelDownloads; index++) {
        testStream(index, index * settings.parallelDownloadsDelay)
    }

    // Main update loop
    const looper = () => {
        log(result, inGraceTime ? 'inGraceTime' : '');

        if (settings.onProgress instanceof Function) {
            log("current progress", testProgress);
            log("current result", result);
            settings.onProgress(result, inGraceTime);
        }

        const t = untilNow(startTime);

        if (!inGraceTime) {
            testProgress = (t + bonusTime) / (s_ms(settings.testTimeout))
        }

        if (t < settings.looperInterval) return;

        if (inGraceTime) {
            if (t > ms_s(settings.graceTime)) {
                if (totalLoaded > 0) {
                    startTime = now();
                    bonusTime = 0;
                    totalLoaded = 0;
                }
                inGraceTime = false;
            }
        } else {
            const speed = totalLoaded / ms_s(t);

            if (settings.autoTiming) {
                const bonus = (5 * speed) / 100 * 1000;
                bonusTime += Math.min(settings.bonusTimeCap, bonus)
            }

            result =
                (byte_bit(speed) * settings.overheadCompensationFactor) /
                (1000 * 1000 /** bits to Mb */)

            if (ms_s(t + bonusTime) > settings.testTimeout || failed) {
                if (failed) {
                    log('Test Failed')
                } else {
                    log("Test Timeout")
                }
                stopTest();
                if (settings.onDone instanceof Function) {
                    settings.onDone(result);
                }
            }

        }
    }
    interval = setInterval(looper, settings.looperInterval)
}

testDownloadSpeed();