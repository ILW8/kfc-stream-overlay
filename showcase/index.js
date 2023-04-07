let socket = new ReconnectingWebSocket('ws://' + location.host + '/ws');

let image_container = document.getElementById('mapimage-container');
let strain_background = document.getElementById('strain-background');
let title = document.getElementById('title');
let diff = document.getElementById('diff');
let mapper = document.getElementById('mapper');

let len = document.getElementById('len');
let bpm = document.getElementById('bpm');
let sr = document.getElementById('sr');
let cs = document.getElementById('cs');
let ar = document.getElementById('ar');
let od = document.getElementById('od');

let replay = document.getElementById('replay');
let replay_cont = document.getElementById('replay-container');
let nowplaying = document.getElementById('nowplaying');
let nowplaying_cont = document.getElementById('nowplaying-container');

let progressChart = document.getElementById('progress');
let strain_container = document.getElementById('strain-container');

let mappool;
(async () => {
	$.ajaxSetup({ cache: false });
	let a = await $.getJSON('../_data/beatmaps.json');
	mappool = (a).beatmaps;
})();

socket.onopen = () => { console.log('Successfully Connected'); };
socket.onclose = event => { console.log('Socket Closed Connection: ', event); socket.send('Client Closed!'); };
socket.onerror = error => { console.log('Socket Error: ', error); };

let image, title_, diff_, artist_, replay_, id, md5;
let len_, bpm_, sr_, cs_, ar_, od_;
let strains, seek, fulltime, strainsStartFraction, strainsEndFraction;
let state;
let last_strain_update = 0;


socket.onmessage = async event => {
	let data = JSON.parse(event.data);

	if (state !== data.menu.state) {
		state = data.menu.state;
		if (state !== 2) {
			replay_cont.style.opacity = 0;
			nowplaying_cont.style.opacity = 0;
		}
		else {
			replay_cont.style.opacity = 1;
			nowplaying_cont.style.opacity = 1;
		}
	}

	// update now playing
	if (mappool && (id !== data.menu.bm.id || md5 !== data.menu.bm.md5 )) {
		id = data.menu.bm.id;
		md5 = data.menu.bm.md5;
		let map = mappool.find(m => m.beatmap_id === id);
		if (map === undefined) {
			map = mappool.find(m => m.md5 === md5);
		}
		nowplaying.innerHTML = map ? map.identifier : 'XX';
	}

	// update replayer
	if ((!data.resultsScreen.name && replay_ !== data.gameplay.name) || (data.resultsScreen.name && replay_ !== data.resultsScreen.name)) {
		replay_ = data.resultsScreen.name || data.gameplay.name;
		replay.innerHTML = replay_ || '';
		if (replay_ && state === 2) replay_cont.style.opacity = 1;
		else replay_cont.style.opacity = 0;
	}

	// update background image
	if (image !== data.menu.bm.path.full) {
		image = data.menu.bm.path.full;
		data.menu.bm.path.full = data.menu.bm.path.full.replace(/#/g, '%23').replace(/%/g, '%25').replace(/\\/g, '/');
		image_container.style.backgroundImage = `url('http://${location.host}/Songs/${data.menu.bm.path.full}')`;
		strain_background.style.backgroundImage = `url('http://${location.host}/Songs/${data.menu.bm.path.full}')`;
	}

	// update title
	if (title_ !== `${data.menu.bm.metadata.artist} - ${data.menu.bm.metadata.title}`) {
		title_ = `${data.menu.bm.metadata.artist} - ${data.menu.bm.metadata.title}`;
		title.innerHTML = title_;
	}

	// update diff/mapper
	if (diff_ !== data.menu.bm.metadata.difficulty) {
		diff_ = data.menu.bm.metadata.difficulty;
		diff.innerHTML = `[${diff_}]`;
		mapper.innerHTML = data.menu.bm.metadata.mapper;
	}

	// update map stats
	if (ar_ !== data.menu.bm.stats.AR || cs_ !== data.menu.bm.stats.CS || sr_ !== data.menu.bm.stats.fullSR || len_ !== data.menu.bm.time.full - data.menu.bm.time.firstObj) {

		bpm_ = data.menu.bm.stats.BPM.max;
		bpm.innerHTML = Math.round(bpm_ * 10) / 10;

		sr_ = data.menu.bm.stats.fullSR;
		sr.innerHTML = sr_.toFixed(2);

		cs_ = data.menu.bm.stats.CS;
		cs.innerHTML = Math.round(cs_ * 10) / 10;

		ar_ = data.menu.bm.stats.AR;
		ar.innerHTML = Math.round(ar_ * 10) / 10;

		od_ = data.menu.bm.stats.OD;
		od.innerHTML = Math.round(od_ * 10) / 10;

		let length_modifier = data.resultsScreen.mods.str.includes('DT') || data.menu.mods.str.includes('DT') ? 1.5 : 1;
		len_ = data.menu.bm.time.full - data.menu.bm.time.firstObj;
		let mins = Math.trunc((len_ / length_modifier) / 1000 / 60);
		let secs = Math.trunc((len_ / length_modifier) / 1000 % 60);
		len.innerHTML = `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// update strains
	if (strains != JSON.stringify(data.menu.pp.strains) && window.strainGraph) {
		strains = JSON.stringify(data.menu.pp.strains) || null;

		strains = data.menu.pp.strains

		let startTime = data.menu.bm.time.firstObj;
		let endTime = data.menu.bm.time.full;
		let mp3Time = data.menu.bm.time.mp3;  // full duration of song

		if (endTime/mp3Time < 0.95 || startTime/mp3Time > 0.05) {  // don't trim if trim amount < 5% on either side
			strainsStartFraction = Math.max(0,
				-0.05 + // add padding to account for smoothing
				startTime/mp3Time);
			strainsEndFraction = Math.min(1.00, 0.05 + endTime/mp3Time);  // idem
			strains = strains.slice(Math.floor(strains.length * strainsStartFraction), Math.floor(strains.length * strainsEndFraction));
		} else {
			strainsStartFraction = 0.;
			strainsEndFraction = 1.;
		}

		let temp_strains = smooth(strains, 3);
		let new_strains = [];
		for (let i = 0; i < Math.min(temp_strains.length, 400); i++) {
			new_strains.push(temp_strains[Math.floor(i * (temp_strains.length / Math.min(temp_strains.length, 400)))]);
		}

		config.data.datasets[0].data = new_strains;
		config.data.labels = new_strains;
		config.options.scales.y.max = Math.max(...new_strains) * 1.3;
		configProgress.data.datasets[0].data = new_strains;
		configProgress.data.labels = new_strains;
		configProgress.options.scales.y.max = Math.max(...new_strains) * 1.3;
		window.strainGraph.update();
		window.strainGraphProgress.update();
	}

	let now = Date.now();
	if (fulltime !== Math.floor((strainsEndFraction - strainsStartFraction) * data.menu.bm.time.mp3)) {
		fulltime = Math.floor((strainsEndFraction - strainsStartFraction) * data.menu.bm.time.mp3);
	}
	if (fulltime !== undefined && fulltime !== 0 && now - last_strain_update > 500) {
		last_strain_update = now;
		seek = Math.min(
			1.,
			Math.max(
				0.,
				data.menu.bm.time.current - data.menu.bm.time.mp3 * strainsStartFraction)/fulltime
		);
		let maskPosition = `${-1420 + 1420 * seek}px 0px`;
		progressChart.style.maskPosition = maskPosition;
		progressChart.style.webkitMaskPosition = maskPosition;
	}
}

window.onload = function () {
	let ctx = document.getElementById('strains').getContext('2d');
	window.strainGraph = new Chart(ctx, config);

	let ctxProgress = document.getElementById('strainsProgress').getContext('2d');
	window.strainGraphProgress = new Chart(ctxProgress, configProgress);
};

let config = {
	type: 'line',
	data: {
		labels: [],
		datasets: [{
			borderColor: 'rgba(5, 5, 5, 0)',
			backgroundColor: 'rgba(255, 255, 255, 0.1)',
			data: [],
			fill: true,
		}]
	},
	options: {
		tooltips: { enabled: false },
		legend: { display: false, },
		elements: { point: { radius: 0 } },
		responsive: false,
		scales: {
			x: { display: false, },
			y: {
				display: false,
				min: 0,
				max: 100
			}
		},
		animation: { duration: 0 }
	}
}

let configProgress = {
	type: 'line',
	data: {
		labels: [],
		datasets: [{
			borderColor: 'rgba(245, 245, 245, 0)',
			backgroundColor: 'rgba(255, 255, 255, 0.2)',
			data: [],
			fill: true,
		}]
	},
	options: {
		tooltips: { enabled: false },
		legend: { display: false, },
		elements: { point: { radius: 0 } },
		responsive: false,
		scales: {
			x: { display: false, },
			y: {
				display: false,
				min: 0,
				max: 100
			}
		},
		animation: { duration: 0 }
	}
}
