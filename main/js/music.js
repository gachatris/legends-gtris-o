const music = new class {
	Song = class {
		constructor(parent) {
			this.parent = parent;
			this.sources = { start: null, loop: null, end: null };
			this.seekTime = 0;
			this.startTime = 0;
			this.continuable = false;
			this.isReady = false;
			this.isMiddlePlay = false;
			this.isPlaying = false;
			this.bpmSync = { active: false, timeSignature: 4 / 4 }
		}
		load(url, continuable, bpmSync, callback) {
			let isReady = false;
			let count = 0;
			let start = new this.parent.SongSource(this);
			let loop = new this.parent.SongSource(this);
			let end = new this.parent.SongSource(this);
			this.sources.start = start;
			this.sources.loop = loop;
			this.sources.end = end;
			let ls = 2;
			let cb = () => {
				count++;
				if (count >= ls) {
					this.isReady = true;
					callback()
				}
			};
			this.continuable = continuable || false;
			
			memoryManager.asyncLoad(url + "/files.json", "text").then((jsontxt) => {
				let h = JSON.parse(jsontxt);
				ls = Object.keys(h).length;
				
				for (let ms in h) {
					this.sources[ms].loadBuffer(url + "/" + h[ms], ms === "loop", cb);
				}
				if (bpmSync.active) {
				//ls++;
				this.bpmSync.active = true;
				
				this.bpmSync.timeSignature = bpmSync.timeSignature;
				this.bpmSync.bpm = bpmSync.bpm
			}
			})
			
			
			
		}
		getNextMeasureTime() {
			let now = this.parent.getCtxCurrentTime();
			if (!this.bpmSync.active) { return now }
			let loopStartTime = this.startTime + this.sources.start.duration;
			let measureDuration = 60 / this.bpmSync.bpm * (this.bpmSync.timeSignature * 4);
			let timeUntilNextMeasure = measureDuration - (now - loopStartTime) % measureDuration;
			let stopTime = now + timeUntilNextMeasure;
			return stopTime
		}
		play(continuable, time) {
			if (!this.isReady) return;
			this.sources.loop.stop();
			this.sources.start.stop();
			let seek = 0;
			if (continuable && this.continuable && this.isMiddlePlay) { seek = Math.max(this.seekTime, 0) } else {}
			let now = time !== void 0 ? time : this.parent.getCtxCurrentTime();
			this.startTime = now;
			this.isPlaying = true;
			this.isMiddlePlay = true;
			if (seek < this.sources.start.duration) this.sources.start.play(now, seek);
			this.sources.loop.play(now + this.sources.start.duration - Math.min(this.sources.start.duration, seek), Math.max(0, seek - this.sources.start.duration) % this.sources.loop.duration)
		}
		stop(isForce) {
			if (!this.isReady) return;
			if (!this.isPlaying) return;
			let now = this.getNextMeasureTime();
			let ns = this.parent.getCtxCurrentTime();
			this.sources.loop.stop(now);
			this.sources.start.stop(now);
			if (this.bpmSync.active) this.sources.end.play(now);
			this.isPlaying = false;
			this.seekTime += ns - this.startTime
		}
		resetSeek() {
			let now = this.parent.getCtxCurrentTime();
			this.seekTime = 0;
			this.startTime = now;
			this.isMiddlePlay = false
		}
	};
	SongSource = class {
		constructor(parent) {
			this.buffer;
			this.startTime = 0;
			this.duration = 0;
			this.ready = false;
			this.parent = parent;
			this.superparent = parent.parent;
			this.source = null;
			this.isPlaying = false;
			this.isLoop = false;
			this.isStop = false
		}
		async loadBuffer(url, isLoop, callback) {
			this.ready = false;
			let arrayBuffer = await memoryManager.asyncLoad(url, "blob");
			let ab = await arrayBuffer.arrayBuffer();
			this.buffer = await this.superparent.ctx.decodeAudioData(ab);
			this.isLoop = isLoop;
			this.duration = this.buffer.duration;
			this.ready = true;
			callback()
		}
		play(now, seek = 0) {
			let cs = 0;
			if (this?.source && this.isPlaying && this.isStop) {
				let _now = this.superparent.getCtxCurrentTime();
				this.isPlaying = false;
				this?.source.stop(_now)
			}
			this.startTime = now;
			this.source = this.superparent.ctx.createBufferSource();
			this.source.buffer = this.buffer;
			this.source.connect(this.superparent.gain);
			this.source.loop = this.isLoop;
			this.isStop = false;
			this.source.start(now + cs, seek);
			this.isPlaying = true
		}
		stop(time) {
			let now = this.superparent.getCtxCurrentTime();
			let n = time !== void 0 ? time : now;
			if (this.source && this.isPlaying && !this.isStop) {
				this.isPlaying = false;
				this.source.stop(n);
				this.isStop = true
			}
		}
	};
	constructor() {
		this.ctx = audioMaster.ctx;
		this.gain = this.ctx.createGain();
		this.gain.connect(this.ctx.destination);
		this.songs = {};
		this.references = {};
		this.volume = 100;
		this.active = "";
		this.isReady = false;
		this.bpmSyncStopTime = 0;
	}
	getCtxCurrentTime() { return this.ctx.currentTime } 
	volumeSet(volume) { this.gain.gain.value = volume / 100 } 
	load(arr) {
		let notExist = [];
		for (let g of arr) { if (!(g.path in this.songs)) { notExist.push(g) } }
		if (notExist.length > 0) {
			let count = 0;
			this.isReady = false;
			for (let a of notExist) {
				let song = new this.Song(this);
				let url = `/assets/music/${a.path}`;
				this.songs[a.path] = song;
				song.load(url, a.continuable, a.bpmSync, () => { count++; if (count >= notExist.length) { this.isReady = true } })
			}
		}
		for (let g of arr) { this.references[g.name] = g.path }
	}
	play(name, c) {
		let newTime = this.getCtxCurrentTime();
		let lastActive = this.active;
		if (lastActive in this.references && this.songs[this.references[lastActive]].bpmSync.active) {
			newTime = this.songs[this.references[lastActive]].getNextMeasureTime();
			this.bpmSyncStopTime = newTime;
		}
			
		for (let _a in this.songs) {
			let a = this.songs[_a];
			a.stop(false);
		}
		this.active = name;
		let m = this.songs[this.references[name]];
		if (!m) return;
		m.play(c, Math.max(newTime, this.bpmSyncStopTime));
	}
	stopAll(isForce) {
		let newTime = this.getCtxCurrentTime();
let lastActive = this.active;
if (lastActive in this.references && this.songs[this.references[lastActive]].bpmSync.active) {
	newTime = this.songs[this.references[lastActive]].getNextMeasureTime();
	this.bpmSyncStopTime = newTime;
}
		for (let _a in this.songs) {
			let a = this.songs[_a];
			a.stop(isForce)
		}
		this.active = ""
	}
	resetAllSeek() {
		for (let _a in this.songs) {
			let a = this.songs[_a];
			a.resetSeek()
		}
	}
};



__main_params__.__private.music = music;