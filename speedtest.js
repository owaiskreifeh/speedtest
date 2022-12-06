var dlStatus = ""; // download speed in megabit/s with 2 decimal digits
var testState = 1;
var xhr = null; // array of currently active xhr requests
var interval = null; // timer used in tests
var log = ""; //telemetry log

let settings = {
    dlUrl: 'https://de4.backend.librespeed.org/garbage.php?cors=true&r=0.28475918550518564&ckSize=CHUNK_SIZE',
    dlMaxDuration: 15, // max duration of download test in seconds
    dlGraceTime: 1.5, //time to wait in seconds before actually measuring dl speed (wait for TCP window to increase)
    dlMultiStream: 5, // number of download streams to use
    dlMultiStreamDelay: 300, // ms //how much concurrent requests should be delayed
    dlUseBlob: true, // if set to true, it reduces ram usage but uses the hard drive (useful with large chunkSize and/or high dlMultiStream)
    dlChunkSize: 100, // MB // size of chunks requested
    overheadCompensationFactor: 1.04, //can be changed to compensatie for transport overhead,
    ignoreErrors: 1, // 0=fail on errors, 1=attempt to restart a stream if it fails, 2=ignore all errors
    timeAuto: true, // if set to true, tests will take less time on faster connections,
    useMebibits: false,
    telemetry_level: 5, // all
}

function tlog(s) {
	if (settings.telemetry_level >= 2) {
		log += Date.now() + ": " + s + "\n";
	}
}
function tverb(s) {
	if (settings.telemetry_level >= 3) {
		log += Date.now() + ": " + s + "\n";
	}
}
function twarn(s) {
	if (settings.telemetry_level >= 2) {
		log += Date.now() + " WARN: " + s + "\n";
	}
	console.warn(s);
}





function randomString (len = 16) {
    return Math.random().toString(36).substring(2,len+2);
}

var dlCalled = false; // used to prevent multiple accidental calls to dlTest
function dlTest(done) {
	if (dlCalled) return;
	else dlCalled = true; // dlTest already called?
	var totLoaded = 0.0, // total number of loaded bytes
		startT = new Date().getTime(), // timestamp when test was started
		bonusT = 0, //how many milliseconds the test has been shortened by (higher on faster connections)
		graceTimeDone = false, //set to true after the grace time is past
		failed = false; // set to true if a stream fails
	xhr = [];
	// function to create a download stream. streams are slightly delayed so that they will not end at the same time
	var testStream = function(i, delay) {
		setTimeout(
			function() {
				if (testState !== 1) return; // delayed stream ended up starting after the end of the download test
				tverb("dl test stream started " + i + " " + delay);
				var prevLoaded = 0; // number of bytes loaded last time onprogress was called
				var x = new XMLHttpRequest();
				xhr[i] = x;
				xhr[i].onprogress = function(event) {
					tverb("dl stream progress event " + i + " " + event.loaded);
					if (testState !== 1) {
						try {
							x.abort();
						} catch (e) {}
					} // just in case this XHR is still running after the download test
					// progress event, add number of new loaded bytes to totLoaded
					var loadDiff = event.loaded <= 0 ? 0 : event.loaded - prevLoaded;
					if (isNaN(loadDiff) || !isFinite(loadDiff) || loadDiff < 0) return; // just in case
					totLoaded += loadDiff;
					prevLoaded = event.loaded;
				}.bind(this);
				xhr[i].onload = function() {
					// the large file has been loaded entirely, start again
					tverb("dl stream finished " + i);
					try {
						xhr[i].abort();
					} catch (e) {} // reset the stream data to empty ram
					testStream(i, 0);
				}.bind(this);
				xhr[i].onerror = function() {
					// error
					tverb("dl stream failed " + i);
					if (settings.ignoreErrors === 0) failed = true; //abort
					try {
						xhr[i].abort();
					} catch (e) {}
					delete xhr[i];
					if (settings.ignoreErrors === 1) testStream(i, 0); //restart stream
				}.bind(this);
				// send xhr
				try {
					if (settings.dlUseBlob) xhr[i].responseType = "blob";
					else xhr[i].responseType = "arraybuffer";
				} catch (e) {}
				xhr[i].open("GET", settings.dlUrl.replace('CHUNK_SIZE', settings.dlChunkSize) +"?q="+ randomString())
				xhr[i].send();
			}.bind(this),
			1 + delay
		);
	}.bind(this);
	// open streams
	for (var i = 0; i < settings.dlMultiStream; i++) {
		testStream(i, settings.dlMultiStreamDelay * i);
	}
	// every 200ms, update dlStatus
	interval = setInterval(
		function() {
			tverb("DL: " + dlStatus + (graceTimeDone ? "" : " (in grace time)"));
			if (settings.onResultUpdate) {
				settings.onResultUpdate(dlStatus)
			}
			var t = new Date().getTime() - startT;
			if (graceTimeDone) dlProgress = (t + bonusT) / (settings.dlMaxDuration * 1000);
			if (t < 200) return;
			if (!graceTimeDone) {
				if (t > 1000 * settings.dlGraceTime) {
					if (totLoaded > 0) {
						// if the connection is so slow that we didn't get a single chunk yet, do not reset
						startT = new Date().getTime();
						bonusT = 0;
						totLoaded = 0.0;
					}
					graceTimeDone = true;
				}
			} else {
				var speed = totLoaded / (t / 1000.0);
				if (settings.timeAuto) {
					//decide how much to shorten the test. Every 200ms, the test is shortened by the bonusT calculated here
					var bonus = (5.0 * speed) / 100000;
					bonusT += bonus > 400 ? 400 : bonus;
				}
				//update status
				dlStatus = ((speed * 8 * settings.overheadCompensationFactor) / (settings.useMebibits ? 1048576 : 1000000)).toFixed(2); // speed is multiplied by 8 to go from bytes to bits, overhead compensation is applied, then everything is divided by 1048576 or 1000000 to go to megabits/mebibits
				if ((t + bonusT) / 1000.0 > settings.dlMaxDuration || failed) {
					// test is over, stop streams and timer
					if (failed || isNaN(dlStatus)) dlStatus = "Fail";
					clearRequests();
					clearInterval(interval);
					dlProgress = 1;
					done();
				}
			}
		}.bind(this),
		200
	);
}


// stops all XHR activity, aggressively
function clearRequests() {
	tverb("stopping pending XHRs");
	if (xhr) {
		for (var i = 0; i < xhr.length; i++) {
			try {
				xhr[i].onprogress = null;
				xhr[i].onload = null;
				xhr[i].onerror = null;
			} catch (e) {}
			try {
				xhr[i].upload.onprogress = null;
				xhr[i].upload.onload = null;
				xhr[i].upload.onerror = null;
			} catch (e) {}
			try {
				xhr[i].abort();
			} catch (e) {}
			try {
				delete xhr[i];
			} catch (e) {}
		}
		xhr = null;
	}
}

function startSpeedTest(_settings){

	settings = {
		...settings,
		..._settings,
	}

    dlTest(() => {
		if (settings.onDone) {
			settings.onDone(dlStatus, log)
		}
        dlCalled = false;
        dlStatus = '';
        log = '';
    })
}