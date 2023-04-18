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
let queueLatestTimestamp = 0;
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
    // console.log(data.gameplay.cursorPosition);
    // let seek_cond = cursorPositionsQueue.length > 0 && data.gameplay.cursorPosition.Time - lastDrawnCursorTimestamp > SYNC_THRESHOLD_MS + TRAIL_LENGTH_MS && hasDrawn && lastDrawnCursorTimestamp > 0
    let seek_cond = false
    let negative_time_cond = data.gameplay.cursorPosition.Time < 1000;
    if (seek_cond || negative_time_cond) {
        // console.log(new Date().toISOString() + "   clearing queue " + `(${seek_cond}, ${negative_time_cond})`)
        // console.log(new Date().toISOString() + "   clearing queue " + `(${data.gameplay.cursorPosition.Time} ${queueLatestTimestamp})`)
        // console.log(JSON.stringify(data.gameplay.recentCursorPositions.Replays))
        // console.log(JSON.stringify(cursorPositionsQueue))
        cursorPositionsQueue.length = 0; // clear queue
        startTimestamp = -1;
        hasDrawn = false;
        cursorPositionsQueue.push(...data.gameplay.recentCursorPositions.Replays);
    } else {
        for (let entry of data.gameplay.recentCursorPositions.Replays) {
            if (entry.Time <= queueLatestTimestamp) continue;
            cursorPositionsQueue.push(entry);
        }
    }
    queueLatestTimestamp = data.gameplay.cursorPosition.Time;
    _temp_latest = data.gameplay.cursorPosition;

    for (let entry of data.gameplay.recentCursorPositions.Replays) {
        if (entry.Time <= 0) {
            console.log(JSON.stringify(entry));
        }
    }
}

function drawCursorMovement(timestamp) {
    if (cursorPositionsQueue.length === 0) {
        console.log("queue empty")
        return;
    }

    if (startTimestamp === -1) {
        // console.log("startTimestamp -1")
        startTimestamp = timestamp;
        startCursorTimestamp = cursorPositionsQueue[0].Time;
        lastDrawnCursorTimestamp = 0
        return;
    }


    let cursorTimestamp = startCursorTimestamp + (timestamp - startTimestamp);  // draw up to this timestamp

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(cursorPositionsQueue[0].X, cursorPositionsQueue[0].Y);


    // draw trail
    let lastEntry = cursorPositionsQueue[0];
    for (let entry of cursorPositionsQueue) {
        if (entry.Time >= cursorTimestamp) {
            break;
        }

        ctx.lineTo(entry.X, entry.Y);
        ctx.stroke();

        lastDrawnCursorTimestamp = lastEntry.Time;
        lastEntry = entry;
    }


    // draw circle
    ctx.beginPath();
    ctx.arc(lastEntry.X, lastEntry.Y, 8, 0, 2 * Math.PI);
    ctx.stroke();

    // console.log("before: " + cursorPositionsQueue.length)
    while (lastDrawnCursorTimestamp - (cursorPositionsQueue[0]?.Time ?? 0) > TRAIL_LENGTH_MS && cursorPositionsQueue.length > 0) {
        cursorPositionsQueue.shift();
    }
    // console.log("after: " + cursorPositionsQueue.length)

    hasDrawn = true;
}

function drawCursorMovementWrapper(timestamp) {
    drawCursorMovement(timestamp);
    window.requestAnimationFrame(drawCursorMovementWrapper);
}

window.requestAnimationFrame(drawCursorMovementWrapper);