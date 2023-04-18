let socket = new ReconnectingWebSocket('ws://' + "10.24.200.12:24050" + '/ws');
let canvas = document.getElementById("osuPlayField");
let ctx = canvas.getContext("2d");

socket.onopen = () => {
    console.log('Successfully Connected');
};

let animation = {
    red_score: new CountUp('score-red', 0, 0, 2, .3, {
        useEasing: true,
        useGrouping: true,
        separator: '',
        decimal: '.',
        suffix: '%'
    }),
    blue_score: new CountUp('score-blue', 0, 0, 2, .3, {
        useEasing: true,
        useGrouping: true,
        separator: '',
        decimal: '.',
        suffix: '%'
    }),
}

socket.onclose = event => {
    console.log('Socket Closed Connection: ', event);
    socket.send('Client Closed!');
};

socket.onerror = error => {
    console.log('Socket Error: ', error);
};

let map;  // current active map


const SYNC_THRESHOLD_MS = 500; // if time delta between current drawn cursor and latest data > threshold, skip
const TRAIL_LENGTH_MS = 500;
let cursorPositionsQueue = [];
// let queueLatestTimestamp = 0;
let startCursorTimestamp = -1;
let startTimestamp = -1;
let previousTimestamp = 0;
let lastDrawnCursorTimestamp = 0;
let hasDrawn = false;

let _temp_latest = undefined;


socket.onmessage = event => {
    /**
     *
     * @type {
     * {gameplay:{
     *   recentCursorPositions:{
     *       Replays:[{
     *               X: float,
     *               Y: float,
     *               WasButtonPressed: number,
     *               Time: number
     *       }]
     *   },
     *   cursorPosition:{
     *     X: float,
     *     Y: float,
     *     WasButtonPressed: number,
     *     Time: number
     *   }
     * }}} data
     */
    let data = JSON.parse(event.data);
    if (data.gameplay.recentCursorPositions.Replays === null) return;
    let seek_cond = false
    let negative_time_cond = data.gameplay.cursorPosition.Time < 1000;
    if (seek_cond || negative_time_cond) {
        cursorPositionsQueue.length = 0; // clear queue
        startTimestamp = -1;
    }
    // else {
    //     for (let entry of data.gameplay.recentCursorPositions.Replays) {
    //         if (entry.Time <= queueLatestTimestamp) continue;
    //         cursorPositionsQueue.push(entry);
    //     }
    // }
    cursorPositionsQueue = data.gameplay.recentCursorPositions.Replays;
    // queueLatestTimestamp = data.gameplay.cursorPosition.Time;

    // for (let entry of data.gameplay.recentCursorPositions.Replays) {
    //     if (entry.Time <= 0) {
    //         console.log(JSON.stringify(entry));
    //     }
    // }
}

function drawCursorMovement(timestamp) {
    if (cursorPositionsQueue.length === 0) {
        console.log("queue empty")
        return;
    }
    if (startTimestamp === -1) {
        console.log("startTimestamp -1")
        startTimestamp = timestamp;
        lastDrawnCursorTimestamp = 0
        startCursorTimestamp = cursorPositionsQueue[0].Time + TRAIL_LENGTH_MS;

        // for (let entry of cursorPositionsQueue) {
        //     if (entry.Time >= cursorPositionsQueue[cursorPositionsQueue.length - 1].Time - 2 * TRAIL_LENGTH_MS) {
        //         startCursorTimestamp = entry.Time;
        //     }
        // }
        // lastDrawnCursorTimestamp = startCursorTimestamp;
    }


    let cursorTimestamp = startCursorTimestamp + (timestamp - startTimestamp);  // draw up to this timestamp
    //
    // if (cursorPositionsQueue[0].Time < cursorTimestamp) {
    //     startTimestamp = timestamp;
    //     startCursorTimestamp = cursorPositionsQueue[0].Time;
    //     lastDrawnCursorTimestamp = 0
    //     return;
    // }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    let hasMoved = false;

    // draw trail
    let lastDrawn = cursorPositionsQueue[0];
    let trailDrawn = false;
    let hasReachedEnd = true;
    for (let entry of cursorPositionsQueue) {
        if (entry.Time >= cursorTimestamp) {
            hasReachedEnd = false;
            break;
        }
        if (entry.Time <= (lastDrawnCursorTimestamp - TRAIL_LENGTH_MS)) continue;

        trailDrawn = true;
        if (!hasMoved) {
            ctx.moveTo(entry.X, entry.Y);
            hasMoved = true;
        }

        ctx.lineTo(entry.X, entry.Y);

        lastDrawnCursorTimestamp = lastDrawn.Time;
        lastDrawn = entry;
    }
    // if (!trailDrawn) {
    //     console.log("no trail drawn");
    // }
    ctx.stroke();
    // if (lastDrawn.Time < (cursorTimestamp - TRAIL_LENGTH_MS)) {
    if (hasReachedEnd || !trailDrawn) {
        // startTimestamp +=  cursorTimestamp - lastDrawn.Time - 10;
        // cursorTimestamp = startCursorTimestamp + (timestamp - startTimestamp);
        // console.log(`${lastDrawn.Time.toFixed(3).toString().padStart(10, '0')}\n${cursorTimestamp.toFixed(3).toString().padStart(10, '0')}`);
        startTimestamp = -1;
    }

    // draw circle
    ctx.beginPath();
    ctx.arc(lastDrawn.X, lastDrawn.Y, 8, 0, 2 * Math.PI);
    ctx.stroke();

    // console.log("before: " + cursorPositionsQueue.length)
    // while (lastDrawnCursorTimestamp - (cursorPositionsQueue[0]?.Time ?? 0) > TRAIL_LENGTH_MS && cursorPositionsQueue.length > 0) {
    //     cursorPositionsQueue.shift();
    // }
    // console.log("after: " + cursorPositionsQueue.length)
}

function drawCursorMovementWrapper(timestamp) {
    drawCursorMovement(timestamp);
    window.requestAnimationFrame(drawCursorMovementWrapper);
}

window.requestAnimationFrame(drawCursorMovementWrapper);