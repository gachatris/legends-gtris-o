//fileLayer: audio_master
const audioMaster = new class {
	constructor() {
		this.ctx = new (window.AudioContext || window.webkitAudioContext)({
			latencyHint: "interactive"
		});
		this.gain = this.ctx.createGain();
		this.gain.connect(this.ctx.destination);
		this.gain.gain.value = 1;
		//this.ctx.resume();
		this.buffers = {};
		this.globalCounter = 0; //for audio IDs
		this.playbacks = {};
	}
	
	Audio = class {
		constructor(parent, parameters) {
			this.parameters = parameters;
			this.parent = parent;
			this.gain = this.parent.ctx.createGain();
			this.gain.connect(this.parent.gain);
			this.buffer = null;
			this.duration = 0;
			this.seekTime = 0;
			this.isReady = false;
			this.isPlaying = false;
			this.playbacks = [];
			this.listeners = {};
		}
	 load() {
			return new Promise(async res => {
				if (!this.parameters.src) return;
			if (this.parameters.src in this.parent.buffers) {
				this.buffer = this.parent.buffers[this.parameters.src];
			} else {
				let array = (await memoryManager.asyncLoad(this.parameters.src, "blob", true));
				
				let ab = await array.arrayBuffer();
				let buffer = await this.parent.ctx.decodeAudioData(ab);
				this.buffer = buffer;
				this.parent.buffers[this.parameters.src] = buffer;
			}
			this.duration = this.buffer.duration;
			this.isReady = true;
			res()
			});
		}
		/**
		 * loads a source that already has a Blob property
 		*/
		async loadSync(callback) {
			
		if (!this.parameters.arrayBuffer) return;
		////console.log(this.parameters.arrayBuffer)
			let buffer = await this.parent.ctx.decodeAudioData(this.parameters.arrayBuffer);
		
			this.buffer = buffer;
			this.parent.buffers[this.parameters.src] = buffer;
			this.duration = this.buffer.duration;
			this.isReady = true;
			callback();
		}
		volume(value) {
			this.gain.gain.value = value;
		}
		/**
		 * plays a buffer
		 * @returns Object {
		 	source: source,
			gain: gain.gain,
			pan:pan.pan,
			rate: source.playbackRate
		 }
 		*/
		play(parameters) {
			parameters = parameters || {};
			let now = this.parent.ctx.currentTime;
			if (!this.isReady) return;
			let source = this.parent.ctx.createBufferSource();
			let pan = this.parent.ctx.createPanner();
			pan.connect(this.gain);
			source.connect(pan);
			source.buffer = this.buffer;
			pan.value = ("pan" in parameters) ? parameters?.pan : 0;
			source.loop = this.parameters.loop;
			source.playbackRate.value = parameters?.rate || 1;
			source.start(("when" in parameters) ? parameters?.when : (now + (("delay" in parameters) ? parameters?.delay : 0)), parameters?.seek || void 0, parameters?.duration || void 0);
			let id = this.parent.globalCounter;
			this.parent.globalCounter++;
			this.playbacks.push(id);
			this.isPlaying = true;
			let h = {
				id: id,
				source: source,
				gain: this.gain,
				pan:pan.pan,
				rate: source.playbackRate
			}
			this.parent.playbacks[id] = h;
			source.addEventListener("ended", () => {
				delete this.parent.playbacks[id];
				this.playbacks.shift();
				if (this.playbacks.length == 0) this.isPlaying = false;
				////console.log("end")
			});
			return h;
		}
		stop() {
			let now = this.parent.ctx.currentTime;
			for (let f of this.playbacks) {
				this.parent.playbacks[f].source.stop(now);
			}
		}
		rate(value) {
			for (let f of this.playbacks) {
				this.parent.playbacks[f].source.playbackRate.value = value !== void 0 ? value : 1;
			}
		}
		unload() {
			
		}
		checkPlaying() {
			let a = this.isPlaying;
			return a;
		}
		once(event, func) {
			
		}
	}
	
	createAudio(p) {
		let a = new this.Audio(this, p);
		return a;
	}
	getPlaybackById(id) {
		if (id in this.playbacks) return this.playbacks[id];
		return null;
	}
	suspendResume(sr) {
		if (sr) {
			this.ctx.suspend();
		} else {
			this.ctx.resume();
		}
	}
	
}();

addEventListener("click", () => {
	if (audioMaster.ctx.state === "suspended") audioMaster.ctx.resume();
}, {
	once: true,
});
addEventListener("keydown", () => {
	if (audioMaster.ctx.state === "suspended") audioMaster.ctx.resume();
}, {
	once: true,
});

//fileLayer: memory_manager
let memoryManager = new class {
	//next update
	constructor() {
		this.mem = {};
		this.loadMax = 0;
		this.loaded = 0;
		this.ready = true;
		this.waitingQueue = {};
		this.loadTimes = {};
	}
	
	#checkLoad(count, max) {
		
	}
	
	directAsyncLoad(url, type) {
		return new Promise(async (resolve, reject) => {
			let a;
			if (type == "image") a = await loadImage(path);
			else a = await load(path, type);
			resolve(a);
		});
	}
	
	
	async _fetch(path, type) {
		this.mem[path] = {
			a: null,
			isLoaded: false
		};
		let a = null;
		if (!(path in this.loadTimes)) this.loadTimes[path] = 0;
		this.loadTimes[path]++;
		////console.log(this.loadTimes)
		try {
			if (type == "image") {
				a = await loadImage(path);
			}
			else a = await load(path, type);
		} catch (e) {
			
		}
		let g = this.mem[path];
		g.a = a;
		g.isLoaded = true;
		for (let h of this.waitingQueue[path]) {
			h();
		}
		delete this.waitingQueue[path];
	}
	
	syncLoad(path, type, func) {
		//this line is important to prevent executing this method that is not handled by a code.
		if (!func) throw "The load method of Memory Manager needs the func argument provided.";
		
		if ((path in this.mem)) {
			if (path in this.waitingQueue) {
				this.waitingQueue[path].push(() => {
					func(this.mem[path].a);
				});
			} else if (this.mem[path].isLoaded) {
				
				func(this.mem[path].a);
				
			} else {
				this.waitingQueue[path] = [() => {
					func(this.mem[path].a);
				}];
			}
		} else {
			this.waitingQueue[path] = [() => {
				func(this.mem[path].a);
			}];
			this._fetch(path, type, func);
		}
	}
	
	asyncLoad(path, type) {
		//this line is important to prevent executing this method that is not handled by a code.
		//if (!func) throw "The load method of Memory Manager needs the func argument provided.";
		
		return new Promise((res, rej) => {
			if ((path in this.mem)) {
				if (path in this.waitingQueue) {
					this.waitingQueue[path].push(() => {
						res(this.mem[path].a);
					});
				} else if (this.mem[path].isLoaded) {
					
					res(this.mem[path].a);
					
				} else {
					this.waitingQueue[path] = [() => {
						res(this.mem[path].a);
					}];
				}
			} else {
				this.waitingQueue[path] = [() => {
					res(this.mem[path].a);
				}];
				this._fetch(path, type);
			}
		})
		
		
	}
}

__main_params__.__private.memoryManager = memoryManager;

//fileLayer: shortcuts
function $(gid) {
 //////console.log(gid, document.getElementById(gid))
 return document.getElementById(gid);
}

const id = $;

const bitwiseSL = (pos) => 1 << pos;

const generateUUID = function() {
 const HEXADECIMAL = "0123456789abcdef";
 let uuid = "";
 for (let u = 0; u < 4 * 8; u++) {
  if ((u % 4) == 0 && ~~(u / 4) >= 2 && ~~(u / 4) <= 5)
   uuid += "-";
  uuid += HEXADECIMAL[~~(Math.random() * 16)];
  
 }
 return uuid;
}

const elem = function(el, func) {
 let a = document.createElement(el);
 func(a);
};

const style = function(i, prop, val) {
 let a = $(i).style;
 if (a[prop] !== val) a[prop] = val;
};

const ih = function(i, val) {
 let a = $(i).innerHTML;
 if (a !== val) $(i).innerHTML = val;
};

const iha = function(i, val) {
 $(i).innerHTML += val;
};

const ihelem = function(i, val) {
 let a = i.innerHTML;
 if (a !== val) i.innerHTML = val;
};

const createSVG = function(width, height, innerhtml) {
 let a = document.createElementNS("http://www.w3.org/2000/svg", "svg");
 a.setAttribute("width", width);
 a.setAttribute("height", height);
 
 //a.innerHTML = innerhtml;
 a.setAttribute("xmlns", "http://www.w3.org/2000/svg");
 return a;
}

const ihaelem = function(i, val) {
 i.innerHTML += val;
};
const styleelem = function(i, prop, val) {
 let a = i.style;
 if (a[prop] !== val) a[prop] = val;
};
const stylepropelem = function(i, prop, val) {
 i.style.setProperty(prop, val);
 
};

class ParkMillerPRNG {
 constructor() {
  this.seed = 1;
 }
 next() {
  return this.gen() / 2147483647;
 }
 gen() {
  return (this.seed = (this.seed * 16807) % 2147483647);
 }
}

const grid = function(x, y, val) {
 let a = [];
 for (let e = 0; e < x; e++) {
  a.push([]);
  for (var f = 0; f < y; f++) {
   a[e][f] = (val);
  }
 }
 return a;
}

const getCanvasCtx = function(canvas) {
 return canvas.getContext("2d");
};
const clientRect = function(f, type) {
 return $(f).getBoundingClientRect()[type];
};
const asyncPromise = function(func) {
 return new Promise((res, rej) => {
  func(res, rej);
 });
};

const arrayModifyBatch = function(arr, func) {
 let j = arr;
 for (let h = 0, b = j.length; h < b; h++) {
  func(j[h]);
 }
};

function bezier(t, start, end, initial, p1, p2, final) {
 return start + ((end - start) * ((1 - t) * (1 - t) * (1 - t) * initial +
  3 * (1 - t) * (1 - t) * t * p1 +
  3 * (1 - t) * t * t * p2 +
  t * t * t * final));
}

function bezier1D(t, s1, s2) {
 const u = 1 - t;
 return u * u * u * 0 + 3 * u * u * t * s1 + 3 * u * t * t * s2 + t * t * t * 1;
}

function sortRandomInt(array, randint) {
 for (var i = 0; i < array.length - 1; i++)
 {
  var temp = array[i];
  var rand = ~~((array.length - i) * randint()) + i;
  array[i] = array[rand];
  array[rand] = temp;
 };
}

function step(x, ratio, min) {
 let m = ~~(x / (1 / ratio))
 
 return min + (m / ratio);
}

function radians(deg) {
 return deg * (Math.PI / 180);
}

function degrees(rad) {
 return rad * (Math.PI / 180);
}

function hexToRGB(hex) {
 let b = hex % 0x000100;
 let g = ~~((hex % 0x010000) / 0x000100);
 let r = ~~((hex % 0x01000000) / 0x010000);
 return {
  r: r,
  g: g,
  b: b,
 }
}

const blobToBase64 = function(blob) {
 return new Promise((call, rej) => {
  var reader = new FileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = function() {
   var base64 = reader.result;
   call(base64);
  };
 });
};

class ArrayFunctionIterator {
 constructor(func) {
  this.arr = [];
  this.func = func;
 }
 update() {
  this.func(this.arr);
 }
 addItem(item) {
  this.arr.push(item);
 }
 getItem(index) {
  return this.arr[index];
 }
 reset() {
  this.arr = [];
 }
}

class ObjectFunctionIterator {
 constructor(func) {
  this.obj = {};
  this.func = func;
 }
 update() {
  this.func(this.obj);
 }
 addItem(key, item) {
  this.obj[key] = item;;
 }
 getItem(key) {
  return this.obj[key];
 }
 
 remove(key) {
  delete this.obj[key];
 }
 
 reset() {
  for (let h in this.obj) {
   delete this.obj[h];
  }
 }
}

class NumberChangeFuncExec {
 constructor(a, func) {
  this.a = a;
  this.last = a;
  this.func = (m, arg) => {
   func(m, arg);
  };
  
 }
 add(num, arg) {
  this.a += num;
  if (this.a !== this.last) {
   this.last = this.a;
   this.func(this.a, arg);
  }
 }
 assign(val, arg) {
  if (val !== this.a) {
   this.a = val;
   this.last = this.a;
   this.func(this.a, arg);
  }
 }
 execute(arg) {
  this.func(this.a, arg);
 }
 getNumber() {
  return this.a;
 }
}

class ChangeFuncExec {
 constructor(a, func) {
  this.a = a;
  this.last = a;
  this.func = (m, arg) => {
   func(m, arg);
  };
  
 }
 assign(val, arg) {
  if (val !== this.a) {
   this.a = val;
   this.last = this.a;
   this.func(this.a, arg);
  }
 }
 execute(arg) {
  this.func(this.a, arg);
 }
 getA() {
  return this.a;
 }
}

class MeterBar extends NumberChangeFuncExec {
 #bar;
 #meter;
 constructor() {
  super(0, (a) => {
   for (let m of this.#bar) styleelem(m, `height`, `${Math.max(0, (this.height * (1 - a)))}px`);
  });
  this.cellSize = 0;
  this.isEnable = false;
 }
 resize(cellSize, w, h) {
  this.cellSize = cellSize;
  this.width = this.cellSize * w;
  this.height = this.cellSize * h;
  for (let a of [this.#meter]) {
   styleelem(a, "width", `${this.width}px`);
   styleelem(a, "height", `${this.height}px`);
  }
  for (let m of this.#bar) styleelem(m, `height`, `${Math.max(0, (this.height * (1 - this.a)))}px`);
 }
 
 toggle(bool) {
  this.isEnable = bool;
  styleelem(this.#meter, `opacity`, this.isEnable ? "100%" : "0%");
 }
 
 
 initialize(meter, bar) {
  this.#meter = meter;
  this.#bar = bar;
 }
}

class MultipleMeterBar {
 #bars;
 #meter;
 #ClusteredBar = class {
  constructor(parent) {
   this.parent = parent;
   this.bar = document.createElement("GTRIS-NONR");
   this.base = new NumberChangeFuncExec(0, (a) => {
    styleelem(this.bar, `height`, `${Math.max(0, (this.parent.height * (1 - a)))}px`);
   });
   
  }
 }
 constructor(num) {
  this.cellSize = 0;
  this.#bars = [];
  
  this.width = this.cellSize * 1;
  this.height = this.cellSize * 1;
  this.isEnable = false;
  for (let h = 0; h < num; h++) {
   this.#bars[h] = new this.#ClusteredBar(this);
  }
 }
 toggle(bool) {
  this.isEnable = bool;
  styleelem(this.#meter, `opacity`, this.isEnable ? "100%" : "0%");
 }
 resize(cellSize, w, h) {
  this.cellSize = cellSize;
  this.width = this.cellSize * w;
  this.height = this.cellSize * h;
  for (let a of [this.#meter]) {
   styleelem(a, "width", `${this.width}px`);
   styleelem(a, "height", `${this.height}px`);
  }
  for (let m of this.#bars) styleelem(m.bar, `height`, `${Math.max(0, (this.height * (1 - m.base.a)))}px`);
 }
 
 initialize(meter, bar) {
  this.#meter = meter;
  //this.#bars = bar;
  let i = 0;
  for (let h of bar) {
   this.#bars[i].bar = h;
   i++;
  }
 }
 assign(am) {
  
  for (let h = 0; h < am.length; h++) {
   this.#bars[h].base.assign(am[h]);
  }
  
 }
}

class GIFRenderer {
 #canvas;
 #ctx;
 #target;
 constructor(width, height, frameWidth, frameHeight, fps, func, updateFunc, isLoop) {
  //this.#canvas = new OffscreenCanvas(width, height);
  //this.#ctx = this.#canvas.getContext("2d");
  this.images = [];
  this.frame = {
   x: 0,
   y: 0,
   w: frameWidth,
   h: frameHeight,
  };
  this.dim = {
   w: width,
   h: height
  };
  this.origDim = {
   w: width,
   h: height
  };
  this.frameCount = 0;
  this.actualFrames = 0;
  this.func = func;
  this.func2 = updateFunc;
  this.fps = fps;
  this.frameDelay = fps;
  this.enabled = false;
  this.isLoop = isLoop;
  
 }
 initialize(target) {
  this.#target = target;
 }
 loadImages(arr) {
  let len = arr.length;
  this.dim.h = this.origDim.h * len;
  //this.#canvas.width = this.dim.w;
  //this.#canvas.height = this.dim.h;
  let count = 0;
  for (let e of arr) {
   //this.#ctx.drawImage(e, 0, 0, this.origDim.w, this.origDim.h, 0, this.origDim.h * count, this.origDim.w, this.origDim.h);
   this.images.push(e);
   count++;
  }
  
  
  /*let test = new OffscreenCanvas(this.frame.w, this.frame.h);
  let testCtx = test.getContext("2d");
  testCtx.drawImage(this.#canvas, 0, 0, this.frame.w, this.frame.h);*/
  
  /*this.#canvas.convertToBlob().then(res => {
   let a = document.createElement("a");
   a.download = Date.now() + "rawlead.png";
   a.href = URL.createObjectURL(res);
   a.click();
  })*/
 }
 
 getCanvas() {
  return this.#canvas;
 }
 
 run() {
  if (!this.enabled) return;
  this.actualFrames++;
  if (this.frameDelay > 0) {
   this.frameDelay--;
  } else {
   this.frameDelay = this.fps;
   this.func(this.#target, this.images[this.frame.y], this.frame.x, 0, this.frame.w, this.frame.h, this.frameCount, this);
  }
  if (this.func2 !== void 0) this.func2(this.actualFrames);
  if (this.isLoop) {
   this.actualFrames = 0;
  }
 }
 
 exec(y, x) {
  this.enabled = true;
  this.frame.x = x || 0;
  this.frame.y = y;
  this.frameDelay = this.fps;
  this.frameCount = 0;
  this.actualFrames = 0;
 }
 immediateExec(y) {
  this.enabled = true;
  this.frame.x = 0;
  this.frame.y = y;
  this.frameDelay = this.fps;
  this.frameCount = 0;
  this.actualFrames = 0;
  this.run();
 }
}

class FrameRenderer {
 constructor(initial, max, func, addFunc, loop) {
  this.inititalFrame = initial;
  this.frame = initial;
  this.maxFrame = max;
  this.func = func;
  this.enabled = false;
  this.addFunc = addFunc;
  this.isLoop = loop || false;
 }
 run() {
  if (!this.enabled) return;
  
  this.func(this.frame, this.maxFrame, this);
  if (typeof this.addFunc !== "undefined") this.addFunc();
  this.frame++;
  if (this.frame >= this.maxFrame) {
   if (this.isLoop) {
    this.frame = 0;
   } else {
    this.enabled = false;
   }
  }
  
 }
 
 setFrame(max) {
  this.maxFrame = max;
 }
 reset(initial) {
  this.frame = initial !== void 0 ? initial : this.inititalFrame;
  this.enabled = true;
 }
 toggleEnable(bool) {
  this.enabled = bool;
 }
}

class EndlessFrameRenderer {
 constructor(initial, max, func, addFunc, loop) {
  this.inititalFrame = initial;
  this.frame = initial;
  this.maxFrame = max;
  this.func = func;
  this.enabled = false;
  this.addFunc = addFunc;
  this.isLoop = loop || false;
 }
 run() {
  if (!this.enabled) return;
  
  this.func(this.frame, this.maxFrame, this);
  if (typeof this.addFunc !== "undefined") this.addFunc();
  this.frame++;
  if (this.frame >= this.maxFrame) {
   if (this.isLoop) {
    this.frame = 0;
   } else {
    this.enabled = false;
   }
  }
  
 }
 
 setFrame(max) {
  this.maxFrame = max;
 }
 reset(initial) {
  this.frame = initial !== void 0 ? initial : this.inititalFrame;
  this.enabled = true;
 }
 toggleEnable(bool) {
  this.enabled = bool;
 }
}

class AnimationFrameRenderer {
 constructor(element, initial, max, fps, param, addFunc) {
  this.param = param || {};
  let paramDel = "delay" in param ? param.delay : 0;
  this.a = new FrameRenderer(initial, max + paramDel, (frame, maxFrame) => {
   let tminus = maxFrame - Math.max(0, frame - paramDel);
   //////console.log("played pi")
   
   if (tminus >= 0)
    styleelem(this.element, "animation-delay", `${~~((1000 / (60 * (-1))) * Math.min(maxFrame,Math.max(frame + 1 - paramDel, 1)))}ms`);
   
   
  }, addFunc, "loop" in param ? param.loop : false);
  this.element = element;
  this.fps = fps;
  this.max = max;
  this.isLoop = "loop" in param ? param.loop : false;
  this.delay = paramDel;
  //styleelem(this.element, "opacity", `${this.param.opacity||0}%`);
 }
 
 play() {
  this.element.offsetHeight;
  styleelem(this.element, "animation-name", this.param.name);
  styleelem(this.element, "animation-duration", `${~~((this.fps) * (this.max))}ms`);
  styleelem(this.element, "animation-timing-function", this.param.timing);
  styleelem(this.element, "animation-iteration-count", this.isLoop ? "infinite" : "1");
  styleelem(this.element, "animation-play-state", "paused");
  this.a.reset();
  
 }
 run() {
  this.a.run();
 }
 setFrame(max) {
  this.max = max;
  this.a.setFrame(max + this.delay);
 }
 reset() {
  styleelem(this.element, "animation-name", "none");
  this.a.toggleEnable(false);
  
 }
}

class FrameRendererSet {
 constructor(arr, playName, stopName, runName) {
  this.obj = {};
  this.length = 0;
  this.names = [];
  for (let k = 0; k < arr.length; k++) {
   let ref = arr[k];
   this.length++;
   this.obj[ref.name] = ref.a;
   this.names.push(ref.name);
   
  }
  this.function = playName;
  this.malfunction = stopName;
  this.runfunction = runName;
 }
 play(name) {
  this.obj[name][this.function]();
 }
 stop(name) {
  this.obj[name][this.malfunction]();
 }
 stopAll() {
  for (let me = 0; me < this.length; me++) {
   let name = this.names[me];
   this.obj[name][this.malfunction]();
  }
 }
 
 run() {
  for (let me = 0; me < this.length; me++) {
   let name = this.names[me];
   this.obj[name][this.runfunction]();
  }
 }
}

class TextToHTMLLetterSeparator {
 constructor() {
  this.a = [];
  this.text = "";
 }
 
 setSeparatedText(element, text) {
  if (this.text === text) return null;
  if (!(element instanceof HTMLElement)) throw new DOMException("What the heck? Argument 'element' is not an HTMLElement.");
  this.a.length = 0;
  let a = text.split("");
  let em = element;
  let b = a.length;
  
  ihelem(em, "");
  
  for (let i = 0; i < b; i++) {
   let m = document.createElement("GTRIS-TS-LETTER");
   m.innerHTML = a[i] === " " ? "&nbsp" : a[i];
   styleelem(m, "display", "inline-block");
   //styleelem(m, "fontSize", `${Math.random()*38}px`);
   let am = `TTHTMLELEMENT-${btoa(Math.random() * Math.random() * 9)}`;
   m.id = am;
   //ihaelem(em, m.outerHTML);
   // this.a.push(document.getElementById(am));
   this.a.push(m);
   element.append(m);
  }
 }
}

class DateSynchronizedLoopHandler {
 constructor(fps, func) {
  this.actualFrames = 0;
  this.isRunning = false;
  this.fps = fps;
  this.startTime = 0;
  this.run = func;
  
  this.speed = 1;
  this.c = 0;
  
  this.isAsynchronous = false;
  this.confirmIsAsync = false;
  
  this.raf = {
   startTime: 0,
   addup: 0,
   lagIterationLimit: 5
  }
 }
 
 #asyncRun(_timestamp) {
  if (!this.isRunning) return;
  if (!this.raf.startTime) {
   this.raf.startTime = _timestamp;
  }
  this.raf.addup += _timestamp - this.raf.startTime;
  this.raf.startTime = _timestamp;
  
  while (this.raf.addup >= 1000 / this.fps) {
   this.raf.addup -= 1000 / this.fps;
   this.c += this.speed;
   while (this.c >= 1) {
    try {
     this.run();
    } catch (e) {
     console.error(e, e.stack);
    }
    this.c--;
   }
  }
  
  
  
  if (this.confirmIsAsync !== this.isAsynchronous) {
   this.isAsynchronous = this.confirmIsAsync;
   if (!this.isAsynchronous) {
    this.startSyncLoop(true);
    this.raf.startTime = 0;
   }
  }
  
  if (this.isAsynchronous) {
   window.requestAnimationFrame((timestamp) => {
    
    
    this.#asyncRun(timestamp);
   });
  } else this.raf.startTime = 0;
 }
 
 startSyncLoop(t) {
  if (this.isRunning && !t) return;
  this.startTime = performance.now();
  this.actualFrames = 0;
  
  this.interval = setInterval(() => {
   let syncTime = Math.floor((performance.now() - this.startTime)) / (1000 / this.fps);
   let syncFrames = syncTime - this.actualFrames;
   for (let i = 0; i < syncFrames && this.isRunning; i++, this.actualFrames++) {
    
    if (this.confirmIsAsync !== this.isAsynchronous) {
     this.isAsynchronous = this.confirmIsAsync;
     
     if (this.isAsynchronous) {
      clearInterval(this.interval);
      window.requestAnimationFrame((timestamp) => {
       this.raf.startTime = 0;
       this.#asyncRun(timestamp);
      });
     }
    }
    this.c += this.speed;
    while (this.c >= 1) {
     this.run();
     this.c--;
    }
   }
  }, 1000 / this.fps);
 }
 
 start() {
  if (!this.isRunning) {
   
   if (this.isAsynchronous) {
    this.isRunning = true;
    window.requestAnimationFrame((timestamp) => {
     this.raf.startTime = 0;
     this.#asyncRun(timestamp);
     
    });
    return;
   }
   
   this.startSyncLoop();
   this.isRunning = true;
  };
 }
 
 stop() {
  if (this.isRunning) {
   
   clearInterval(this.interval);
   this.isRunning = false;
   
  }
 }
 
 replaceRun(func) {
  this.run = func;
 }
}

class RAFLoopHandler {
 constructor(fps, func) {
  this.actualFrames = 0;
  this.isRunning = false;
  this.fps = fps;
  this.prevTime = 0;
  this.run = func;
  
  this.speed = 1;
  this.c = 0;
  this.delta = 0;
  this.lagIterLimit = 50;
  this.confirmIsAsync = false;
  this.tdifference = 0;
 }
 
 #asyncRun(t) {
  
  if (!this.isRunning) return;
  {
   let difference = t - this.prevTime;
   this.tdifference += difference;
   
   this.prevTime = t;
   let ms = 0;
   while (ms < this.lagIterLimit && this.tdifference >= (1000 / this.fps)/* && (true||!this.confirmIsAsync)/**/) {
    ms++;
    this.c += this.speed;
    this.tdifference -= (1000 / this.fps);
    while (this.c >= 1) {
     
     try {
      this.run();
     } catch (e) {
      console.error(e, e.stack);
     }
     this.c--;
    }
    
    
    if (difference > 30 * 1000) {
   this.tdifference = 0;
  } 
  
  
   } 
   
  }
  
  
  
  window.requestAnimationFrame((time) => {
   this.#asyncRun(time);
  });
  
 }
 
 start() {
  if (!this.isRunning) {
   
   this.isRunning = true;
   window.requestAnimationFrame((time) => {
 this.#asyncRun(time);
});
  };
 }
 
 stop() {
  if (this.isRunning) {
   
   this.isRunning = false;
   
  }
 }
 
 replaceRun(func) {
  this.run = func;
 }
}

class FunctionTimer {
 #NumberFunc = class {
  constructor(a, func) {
   this.a = a;
   this.last = a;
   this.func = (m, arg) => {
    func(m, arg);
   };
   
  }
  add(num, arg) {
   this.a += num;
   if (this.a !== this.last) {
    this.last = this.a;
    this.func(this.a, arg);
   }
  }
  assign(val, arg) {
   if (val !== this.a) {
    this.a = val;
    this.last = this.a;
    this.func(this.a, arg);
   }
  }
  execute(arg) {
   this.func(this.a, arg);
  }
 }
 constructor(parent, func) {
  this.parent = parent;
  this.time = -9;
  this.max = 10 * 60;
  this.enabled = 0;
  this.func = new this.#NumberFunc(-99, (x) => {
   func(x, this.max);
  });
 }
 
 set(time) {
  this.time = time;
  if (this.enabled && this.time >= -1) this.func.assign(time);
 }
 setMax(max) {
  this.max = max;
  if (this.enabled && this.time >= -1) this.func.execute();
 }
 
 
 increment(add) {
  this.time += add;
 }
 
 update() {
  if (this.enabled && this.time >= -1) this.func.assign(this.time);
 }
 
}

class DOMTouchInteractivity {
 constructor(reference, func) {
  this.reference = reference;
  
  this.isActive = true;
  this.lastTouch = null;
  
  this.touchArr = {};
  this.func = (event) => {
   func(event);
  }
 }
 
 
 
 
 initialize() {
  var event = (e) => {
   if (((e.type == "touchstart") || (e.type == "touchmove") || (e.type == "touchend")) && (this.isActive)) {
    let length = e.touches.length;
    if (e.type === "touchstart") this.lastTouch = e.touches[length - 1];
    let existing = {};
    for (var touches = 0; touches < length; touches++) {
     let tX = e.touches[touches].pageX,
      tY = e.touches[touches].pageY;
     let name = e.touches[touches].identifier; //`x${tX}y${tY}`;
     existing[name] = true;
     if (!(name in this.touchArr)) {
      this.func({
       pageX: tX,
       pageY: tY,
       identifier: name,
       type: e.type,
       //preventDefault: e.preventDefault
      });
      
     }
    };
    
    for (let m in this.touchArr) {
     if (!(m in existing)) {
      if ("a" in this.touchArr[m] && this.touchArr[m].a.isPressed) {
       this.touchArr[m].a.func("touchend");
       this.touchArr[m].a.isPressed = false;
      }
      delete this.touchArr[m];
     } else {
      if ("a" in this.touchArr[m] && !this.touchArr[m].a.isPressed) {
       this.touchArr[m].a.func("touchstart");
       this.touchArr[m].a.isPressed = true;
      }
     }
    }
    
    
    
    
    //if (!game.isReplay) game.touchesPressed = 0;
    /*for (var touches = 0; touches <= length; touches++) {
    let count = 0;
     var tX = 0;
     var tY = 0;
     if (length !== 0 && e.touches[touches]) {
      tX = e.touches[touches].pageX;
      tY = e.touches[touches].pageY;
     } else {
      tX = this.lastTouch.pageX;
      tY = this.lastTouch.pageY;
     }
     for (var i in this.buttons) {
      var button = id(this.buttons[i].id),
       buttonClass = this.buttons[i];
      var buttonOffsetTop = clientRect(this.buttons[i].id, "y");
      var buttonOffsetLeft = clientRect(this.buttons[i].id, "x");
      var buttonOffsetHeight = clientRect(this.buttons[i].id, "height");
      var buttonOffsetWidth = clientRect(this.buttons[i].id, "width");
      //////console.log(tX, tY, e.type)
      if (
       tX >= buttonOffsetLeft && tX < buttonOffsetWidth + buttonOffsetLeft &&
       tY >= buttonOffsetTop && tY < buttonOffsetHeight + buttonOffsetTop &&
       buttonClass.active && buttonClass.isWholeActive && buttonClass.isControllerActive &&
       buttonClass.isNotReplayToShow
      ) {
       if (e.type == "touchstart") style(buttonClass.id, "opacity", "100%");
       if (e.type == "touchend") style(buttonClass.id, "opacity", "75%");
       if (((e.type == "touchstart") || e.type == "touchend") || (buttonClass.dragTap && e.type == "touchmove")) {
        if (e.type === "touchstart" && !buttonClass.isPressed) {
         buttonClass.isPressed = true;
         buttonClass.func(e.type);
        }
        
       }
      } else {
       style(buttonClass.id, "opacity", "75%");
        if ( buttonClass.isPressed) {
         buttonClass.isPressed = false;
         buttonClass.func(e.type);
        }
      }
     }
    }/**/
   }
  };
  
  
  for (let p of ["start", "end"]) this.reference.addEventListener(`touch${p}`, e => event(e), false);
  ////console.log(this.reference)
 }
};
/*let hshsh = new TextToHTMLLetterSeparator();
hshsh.setSeparatedText(document.documentElement, "WTF LOL");
////console.log(hshsh)*/

class Bitboard {
 constructor(width, height) {
  this.base = new Uint32Array(~~((width * height) / 32) + 1);
  this.width = width;
  this.height = height;
 }
 findCell(x, y) {
  let index = x * this.height + y;
  return this.base[~~((index) / 32)] & (1 < (index % 32));
 }
 setCell(x, y, c) {
  let index = x * this.height + y;
  if (c == 1) {
   this.base[~~((index) / 32)] |= (1 << (index % 32));
   return;
  } // invalidate values of c other than 0 and 1
  this.base[~~((index) / 32)] &= ~(1 << (index % 32));
 }
 copyThisBB(bitboard) {
  for (let g = 0; g < bitboard.base.length; g++) { //we don't want to reference a third-party Uint32Array object.
   bitboard.base[g] = this.base[g];
  }
 }
}

class ModifiedBitboard {
 constructor(width, height, cluster, T) {
  this.clusterBitCount = cluster;
  this.base = new T(~~((width * height) / cluster) + 1);
  for (let g = 0; g < this.base.length; g++) { //we don't want to reference a third-party Uint32Array object.
   this.base[g] = 0;
  }
  this.width = width;
  this.height = height;
 }
 findCell(x, y) {
  let index = x * this.height + y;
  return this.base[~~((index) / this.clusterBitCount)] & (1 << (index % this.clusterBitCount));
 }
 setCell(x, y, c) {
  let index = x * this.height + y;
  if (c == 1) {
   this.base[~~((index) / this.clusterBitCount)] |= (1 << (index % this.clusterBitCount));
   return;
  } // invalidate values of c other than 0 and 1
  this.base[~~((index) / this.clusterBitCount)] &= ~(1 << (index % this.clusterBitCount));
 }
 copyThisBB(bitboard) {
  for (let g = 0; g < bitboard.base.length; g++) { //we don't want to reference a third-party Uint32Array object.
   bitboard.base[g] = this.base[g];
  }
 }
 
 reset() {
  for (let g = 0; g < this.base.length; g++) { //we don't want to reference a third-party Uint32Array object.
   this.base[g] = 0;
  }
 }
}

//fileLayer: characters
const gtcharacter = new class {
	constructor() {
		this.characters = [
		{
			core: {
				color: {
					red: 225,
					green: 112,
					blue: 0
				},
				name: "misty_firefox>name",
				description: "misty_firefox>desc",
				date_featured: "9-17-2024",
				version: "0.0.1 Alpha",
				path: "misty_firefox"
			},
			versions: [
			{
				color: {
					red: 225,
					green: 112,
					blue: 0
				},
				path: "main",
				init: "init.json",
				lang_path: "misty_firefox>ver>main",
				
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
				name: "name",
			}]
		},
		{
			core: {
				color: {
					red: 225,
					green: 112,
					blue: 0
				},
				name: "rubystudios>name",
				description: "rubystudios>desc",
				date_featured: "9-17-2024",
				version: "0.0.1 Alpha",
				path: "rubystudios"
			},
			versions: [
			{
				color: {
					red: 225,
					green: 2,
					blue: 2
				},
				path: "main",
				init: "init.json",
				lang_path: "rubystudios>ver>main",
				name: "name",
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
			}]
		},
		{
			core: {
				color: {
					red: 225,
					green: 112,
					blue: 0
				},
				name: "dominic_zi>name",
				description: "dominic_zi>desc",
				date_featured: "9-17-2024",
				version: "0.0.1 Alpha",
				path: "dominic_zi"
			},
			versions: [
			{
				color: {
					red: 225,
					green: 2,
					blue: 2
				},
				path: "main",
				init: "init.json",
				lang_path: "dominic_zi>ver>main",
				name: "name",
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
			}]
		},
		{
			core: {
				color: {
					red: 225,
					green: 112,
					blue: 0
				},
				name: "elisha>name",
				description: "elisha>desc",
				date_featured: "9-17-2024",
				version: "0.0.1 Alpha",
				path: "elisha"
			},
			versions: [
			{
				color: {
					red: 225,
					green: 2,
					blue: 2
				},
				path: "main",
				init: "init.json",
				lang_path: "elisha>ver>main",
				name: "name",
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
			}]
		},
		{
			core: {
				color: {
					red: 225,
					green: 112,
					blue: 0
				},
				name: "epicman>name",
				description: "epicman>desc",
				date_featured: "9-17-2024",
				version: "0.0.1 Alpha",
				path: "epicman"
			},
			versions: [
			{
				color: {
					red: 225,
					green: 112,
					blue: 2
				},
				path: "main",
				init: "init.json",
				lang_path: "epicman>ver>main",
				name: "name",
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
			}]
		},
		{
			core: {
				color: {
					red: 3,
					green: 3,
					blue: 122
				},
				name: "flotalendy>name",
				description: "flotalendy>desc",
				date_featured: "9-17-2024",
				version: "0.0.1 Alpha",
				path: "flotalendy"
			},
			versions: [
			{
				color: {
					red: 3,
					green: 3,
					blue: 122
				},
				path: "main",
				init: "init.json",
				lang_path: "flotalendy>ver>main",
				name: "name",
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
			}]
		},
		{
			core: {
				color: {
					red: 3,
					green: 3,
					blue: 122
				},
				name: "eclipse>name",
				description: "eclipse>desc",
				date_featured: "5-25-2025",
				version: "0.0.2 Alpha",
				path: "eclipse"
			},
			versions: [
			{
				color: {
					red: 111,
					green: 3,
					blue: 122
				},
				path: "main",
				init: "init.json",
				lang_path: "eclipse>ver>main",
				name: "name",
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
			}]
		},
		{
			core: {
				color: {
					red: 20,
					green: 20,
					blue: 122
				},
				name: "abcia2>name",
				description: "abcia2>desc",
				date_featured: "5-25-2025",
				version: "0.0.2 Alpha",
				path: "abcia2"
			},
			versions: [
			{
				color: {
					red: 20,
					green: 20,
					blue: 122
				},
				path: "main",
				init: "init.json",
				lang_path: "abcia2>ver>main",
				name: "name",
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
			}]
		},
		{
			core: {
				color: {
					red: 40,
					green: 40,
					blue: 122
				},
				name: "izzy>name",
				description: "izzy>desc",
				date_featured: "12-02-2025",
				version: "0.2.0 Alpha",
				path: "izzy"
			},
			versions: [
			{
				color: {
					red: 40,
					green: 40,
					blue: 122
				},
				path: "main",
				init: "init.json",
				lang_path: "izzy>ver>main",
				name: "name",
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
			}]
		},
		{
			core: {
				color: {
					red: 190,
					green: 190,
					blue: 211
				},
				name: "skylight>name",
				description: "skylight>desc",
				date_featured: "12-02-2025",
				version: "0.2.0 Alpha",
				path: "skylight"
			},
			versions: [
			{
				color: {
					red: 190,
					green: 190,
					blue: 211
				},
				path: "main",
				init: "init.json",
				lang_path: "skylight>ver>main",
				name: "name",
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
			}]
		},
		{
			core: {
				color: {
					red: 12,
					green: 12,
					blue: 113
				},
				name: "emikama>name",
				description: "emikama>desc",
				date_featured: "12-02-2025",
				version: "0.2.0 Alpha",
				path: "emikama"
			},
			versions: [
			{
				color: {
					red: 12,
					green: 12,
					blue: 113
				},
				path: "main",
				init: "init.json",
				lang_path: "emikama>ver>main",
				name: "name",
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
			}]
		},
		{
			core: {
				color: {
					red: 170,
					green: 255,
					blue: 170
				},
				name: "rainuff>name",
				description: "rainuff>desc",
				date_featured: "12-02-2025",
				version: "0.2.0 Alpha",
				path: "rainuff"
			},
			versions: [
			{
				color: {
					red: 170,
					green: 255,
					blue: 170
				},
				path: "main",
				init: "init.json",
				lang_path: "rainuff>ver>main",
				name: "name",
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
			}]
		},
		{
			core: {
				color: { red: 225, green: 112, blue: 0 },
				name: "elabbygaile>name",
				description: "elabbygaile>desc",
				date_featured: "12-02-2025",
				version: "0.2.0 Alpha",
				path: "elabbygaile",
				phylum: true,
			},
			versions: [
			{
				color: { red: 225, green: 225, blue: 0 },
				path: "main",
				init: "init.json",
				lang_path: "elabbygaile>ver>main",
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
				name: "name"
			}]
		},
		{
			core: {
				color: { red: 225, green: 112, blue: 0 },
				name: "gabbryielle>name",
				description: "gabbryielle>desc",
				date_featured: "12-02-2025",
				version: "0.2.0 Alpha",
				path: "gabbryielle",
				phylum: true,
			},
			versions: [
			{
				color: { red: 225, green: 225, blue: 0 },
				path: "main",
				init: "init.json",
				lang_path: "gabbryielle>ver>main",
				description: "desc",
				select_image: "images/select.png",
				rpg_card: "images/rpg_card.png",
				rpg_attr_init: "rpg_attr.json",
				rpg_init: "rpg_init.json",
				name: "name"
			}]
		}
		];
		
		for (let h in this.characters) {
			let reference = this.characters[h];
			let ver = Object.keys(reference.versions);
			reference.core.verlength = ver.length;
		}
	}
}();

//fileLayer: worker
const multithread = new class {

 #importScripts = `
importScripts("<{IMPORT_URL}>");

onmessage = (d) => {
 let result = _eval(d.data);
 postMessage(result);
}
 `;

 #workers = {};

 #$BTOBASE64(blob, call) {
  var reader = new FileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = function() {
   var base64 = reader.result;
   call(base64);
  }
 }

 constructor() {}
 engageWorker(name, impscrtext, on) {
  if (this.#workers?.[name]) {
   if (this.#workers[name].worker instanceof Worker) {
    this.#workers[name].worker.terminate();
   }
  }
  this.#workers[name] = {
   worker: {
    postMessage: () => {},
   },
   base64: ""
  };

  let f = new Blob([impscrtext], { type: 'text/plain' });
  this.#$BTOBASE64(f, blobA => {
   ////console.log(blobA);
   let blobABlob = new Blob([blobA], { type: 'text/plain' });
   let blobAURL = URL.createObjectURL(f);
   let blobAText = this.#importScripts.replace("<{IMPORT_URL}>", blobAURL);

   let fw = new Blob([blobAText], { type: 'text/plain' });
   let fwe = URL.createObjectURL(fw);
   this.#workers[name].base64 = blobA;
   this.#workers[name].worker = new Worker(fwe);
   this.#workers[name].worker.onerror = (e) => {
   	//console.log(name, e.message, arguments);
   }
   on(this.#workers[name]);
  });
  return this.#workers[name];
 }


 stopAll() {
  for (let w in this.#workers) {
   this.#workers[w].worker.terminate();
  }
 }
}



//fileLayer: loader
function load(entity, type) {
	if (__main_params__.appinfo.android) return new Promise(async (res, rej) => {
		let result = __main_params__.fetch(entity, type);
		res(result);
	});
	return new Promise(async (res, rej) => {
		__main_params__.database.read("assets", entity, async (read) => {
			let result = null;
			if (typeof read === "undefined") {
				try {
				result = await __main_params__.fetch(entity, type);
				
					__main_params__.database.write("assets", entity, result);
				} catch (e) {

				}
				////console.log(entity)
			} else {
				////console.log(read);
				result = read.value;
			}
			
			res(result);
		});
	});


}

function loadImage(directory, isImgElem) {
	if (__main_params__.appinfo.android) return new Promise(async (res, rej) => {
		try{
		let result = await __main_params__.fetch(directory, "blob");
		////console.log(result)
		let img = new Image();
		img.src = URL.createObjectURL(result);
		//////console.log(img.src)
		img.onload = () => {
			URL.revokeObjectURL(result);
			res(img);
		}
		} catch(e) {
			//console.log(e.stack)
		}
		//res(result)
	});
	return new Promise((res, rej) => {

		__main_params__.database.read("assets", directory, async (read) => {
			let result = {};
			//////console.log(directory)
			if (typeof read === "undefined") {
				result = await __main_params__.fetch(directory, "blob");
				////console.log(directory)
				try {
					__main_params__.database.write("assets", directory, result);
				} catch (e) {

				}


			} else {
				////console.log(read)
				result = read.value;
			}
			
			/*let img = new Image();
			img.src = URL.createObjectURL(new Blob([result]));
			//////console.log(img.src)
			img.onload = () => {
				URL.revokeObjectURL(img.src);
				if (isImgElem) {
					res(img);
					return;
				}
				
			img = null
			
			
			
			}/**/
			let bmp = createImageBitmap(result);
			res(bmp);
			
			
		});


	});
}
/**/

__main_params__.__private.loadImage = loadImage;
__main_params__.__private.load = load;

//fileLayer: locals
const language = new class {

	#languages = {};
	#charLanguages = {};
	#settingLanguages = {};
	#images = {};
	#isLoadActive = true;
	#imgPathArrStr = "";
	#current = "en-US";

	load(file) {
		this.#current = file;
		let km = file.toLowerCase().replace(/\-/gm, "_");
		return new Promise(async (res, rej) => {
			this.loadLanguage(await load(`./assets/lang/${km}/main.json`, "text"));
			this.loadCharLanguage(await load(`./assets/lang/${km}/characters.json`, "text"));
			this.loadSettingLanguage(await load(`./assets/lang/${km}/settings.json`, "text"));
			res();
		})
	}

	loadCharLanguage(file) {
		let a = JSON.parse(file);
		this.#charLanguages[this.#current] = {};
		this.#charLanguages[this.#current] = a;
		////console.log(a)
	}
	
	loadLanguage(file) {
		let a = JSON.parse(file);
		this.#languages[this.#current] = {};
		this.#languages[this.#current] = a;
		////console.log(a)
	}
	loadSettingLanguage(file) {
	let a = JSON.parse(file);
	this.#settingLanguages[this.#current] = {};
	this.#settingLanguages[this.#current] = a;
	////console.log(a)
	}

	getLocalizationPath(file) {
		return `assets/lang/${"en_us"}/${file}`;
	}

	loadLangImage(arr) {
		let isBool = true;
		let tarr = [];
		for (let hh of arr) {
			let h = this.getLocalizationPath(hh);
			if (!(h in this.#images)) {
				isBool = false;
				tarr.push([hh, h]);
			} else if (!this.#images[h].active) {
				isBool = false;

			}
		}



		if (!isBool) {
			this.#isLoadActive = false;
			let count = 0;
			for (let a of tarr) {
				this.#images[a[0]] = {
					a: new Image(),
					active: false
				};
				//////console.log(a);
				loadImage(a[1]).then((ue) => {
					this.#images[a[0]].a = ue;
					this.#images[a[0]].active = true;
					//////console.log(a[1], ue)
					count++;
					if (count >= arr.length) {
						this.#isLoadActive = true;
					}
				});


			}
		}
	}

	getImage(src) {
		//////console.log(this.#images[src].a);
		return this.#images[src].a;
	}

	loadImgsByJson(u) {
		/*if (this.##imgPathArrStr !== "") {
			return;
		}
		load(this.getLocalizationPath("images_init.json"), "text").then(u => {
			////console.log(this.getLocalizationPath("images_init.json"));
			
		});*/
		this.loadLangImage(JSON.parse(u));
	}

	translate(query, input, fallback) {
		let _input = (typeof input !== 'object' || !(input instanceof Array) ? [input] : (input)),
			language = this.#languages[this.#current],
			result = language[query] || fallback || "    ";
		for (let v = 0; v < _input.length; v++) {
			let varInstance = _input[v];
			let placeholder = `var\=${v}`;
			let regExp = new RegExp(placeholder, "gm");
			result = result.replace(regExp, varInstance);
		}
		return result;
	}
	
	settingTranslate(query, fallback) {
		//let _input = (typeof input !== 'object' || !(input instanceof Array) ? [input] : (input)),
			let language = this.#settingLanguages[this.#current],
			result = (language[query.split("||")[0]] || fallback || "    ").split("||");
		//let k = JSON.parse(JSON.stringify(result));
		while (result.length < 2) {
			result.push(fallback || "    ");
		}
		return result; //0: name, 1: footer
	}

	charTranslate(query, fallback) {
		//let _input = (typeof input !== 'object' || !(input instanceof Array) ? [input] : (input)),
		let querySplit = query.split(">"),
			base = this.#charLanguages[this.#current][querySplit[0]],
			language = this.#charLanguages[this.#current];


		for (let v = 0; v < querySplit.length; v++) {
			let langTemp = this.#charLanguages[this.#current];
			if (v === 0) language = langTemp;
			else language = base;
			base = language[querySplit[v]];

		}
		let result = base || fallback || "    ";



		return result;

	}
}();
__main_params__.__private.language = language;

//fileLayer: touch
class MobileButton {
	constructor(event, img, type, func, px, py, lx, ly, len, height, dragTap) {
		this.portraitX = px;
		this.portraitY = py;
		this.landscapeX = lx;
		this.landscapeY = ly;
		this.sizeX = len;
		this.sizeY = height;
		this.src = img;
		
		this.actual = {
			sizeX: 0,
			sizeY: 0,
			
		}
		this.type = type;
		this.func = func;
		this.id = `CONTROL-${event.toUpperCase()}`;
		this.active = true;
		this.isControllerActive = true;
		this.isWholeActive = true;
		this.isNotReplayToShow = true;
		this.dragTap = dragTap ? dragTap : false;
		this.isPressed = false;
		
	};
	fire() {
		this.func();
	}
}

class MobileButtonSystem {
	constructor() {
		this.buttons = {};
		this.isActive = true;
		this.lastTouch = null;
		this.cellSize = 0;
		this.cellSizeX = 0;
		this.cellSizeY = 0;
		this.touchArr = {};
		this.viewportPos = {
			x: 0,
			y: 0
		};
		this.ratio = {
			width: 0,
			height: 0
		};
	}
	toggleControllers() {
		for (let buttons in this.buttons) {
			let btn = this.buttons[buttons];
			if (btn.type == "controller") btn.active = !btn.active;
		}
		this.checkButtons();
	}
	replayToggleControllers(bool) {
		for (let buttons in this.buttons) {
			let btn = this.buttons[buttons];
			if (btn.type == "controller") btn.isNotReplayToShow = bool;
		}
		this.checkButtons();
	}
	enableControllers(bool) {
		for (let buttons in this.buttons) {
			let btn = this.buttons[buttons];
			if (btn.type == "controller") btn.isControllerActive = bool;
		}
		this.checkButtons();
	}
	enableButtons(bool) {
		for (let buttons in this.buttons) {
			let btn = this.buttons[buttons];
			btn.isWholeActive = bool;
		}
		this.checkButtons();
	}
	
	resize(o, mw, mh, w, h, cs) {
		this.res = {
			w: mw,
			h: mh,
			ow: 0,
			oh: 0
		};
		
		
		style("GTRIS-TOUCH", "width", `${w}px`);
		style("GTRIS-TOUCH", "height", `${h}px`);
		
		this.orientation = o;
		
		this.viewportPos = {
			x: 0,
			y: 0
		};
		
		
		
		switch (o) {
			case "portrait": {
				this.viewportPos.y = (mh / 4) - (h / 2);
				this.cellSize = w / 9;
				break;
			}
			case "landscape": {
				this.viewportPos.x = (mw / 2) - (w / 2);
				this.cellSize = h / 9;
				break;
			}
			
		}
		this.checkButtons();
		
	}
	
	checkButtons() {
		//var a = e => $IH("GTRIS-TOUCH", e),
		
		for (var e in this.buttons) {
			var o = this.buttons[e];
			let x = ((this.orientation == "landscape" ? o.landscapeX : o.portraitX)) * this.cellSize;
			let y = ((this.orientation == "landscape" ? o.landscapeY : o.portraitY)) * this.cellSize;
			var screen = Math.max(game.aspectResolution.w, game.aspectResolution.h) + Math.max(this.viewportPos.x, this.viewportPos.y);
			let padX = this.orientation === "portrait" ? Math.max((((this.res.w * (16 / 9)) - this.res.h) / 2) / 5148, 0) : 0,
				padY = this.orientation === "portrait" ? (this.res.h - game.aspectResolution.h) / 2 : 0;
			var _id = id(o.id);
			_id.style = `display:${o.active && o.isWholeActive && o.isControllerActive && o.isNotReplayToShow ? "block" : "none"};opacity:${60}%;background:#938;top:${0}px;left:${0}px;position:absolute;pointer-events:none`;
			let posY = padY + y - (o.sizeY / 2);
			let posX = padX + x - (o.sizeX / 2);
			_id.style.top = posY + "px";
			_id.style.left = posX + "px";
			_id.style.width = (this.cellSize * o.sizeX) + "px";
			_id.style.height = (this.cellSize * o.sizeY) + "px";
			let cx = 0,
				cy = 0;
			if (this.orientation == "landscape") {
				
			}
			
		}
		//a(iH);
	};
	createButton(event, img, type, func, px, py, lx, ly, len, height) {
		if ((event in this.buttons)) return;
		this.buttons[event] = new MobileButton(event, img, type, func, px, py, lx, ly, len, height);
		elem("gtris-mobile-button", button => {
			button.id = this.buttons[event].id;
			/*cacheManager.loadCache(img, (fname) => {
			 let s = new Image();
			 s.src = fname;
			 return s;
			}, "characterimage", _img => {
			 button.append(_img.value);
			 styleelem(_img.value, "pointer-events", "none");
			 styleelem(_img.value, "height", "100%");
			 styleelem(_img.value, "width", "100%");
			});*/
			
			load(this.buttons[event].src, "blob").then(y => {
				let olm = document.createElement("img");
				olm.src = URL.createObjectURL(y);
				olm.onload = () => {
					URL.revokeObjectURL(olm.src);
				}
				button.append(olm);
				olm.style.width = "100%";
				olm.style.height = "100%";
			})
			id("GTRIS-TOUCH").appendChild(button);
		});
		this.checkButtons();
	};
	showHide(bool) {
		this.isActive = bool;
		style("GTRIS-TOUCH", "display", bool ? "auto" : "none");
	}
	initiateButtons() {
		let deviation = 0.3;
		var NX = -3,
			NY = 4 + deviation,
			AX = -0.05 + deviation,
			AY = 11.7;
		
		
		
		
		let sizeNormal = 1 + deviation;
		let MX = 9 - sizeNormal - deviation;
		let LNX = 16 - sizeNormal - deviation;
		this.createButton("harddrop", "assets/menu/control_mobile/up.png", "controller", (type) => {
			let ls = game.bitFlags.harddrop;
			if (type == "touchstart") game.typeInput(ls, 1);
			if (type == "touchend") game.typeInput(ls, 0);
			if (menu.isMenu) {
				let ja = "up";
				if (type == "touchstart")
					menu.controlsListen(ja, "down");
				if (type == "touchend")
					menu.controlsListen(ja, "up");
			}
			
			
		}, 1 + deviation * 2 + AX, 0 - deviation * 0 + AY, 1 + deviation * 2 + NX, 0 - deviation * 0 + NY, sizeNormal, sizeNormal, true);
		this.createButton("softdrop", "assets/menu/control_mobile/down.png", "controller", (type) => {
				let ls = game.bitFlags.softdrop;
if (type == "touchstart") game.typeInput(ls, 1);
if (type == "touchend") game.typeInput(ls, 0);
				//////console.log(type)
				if (menu.isMenu) {
					let ja = "down";
					if (type == "touchstart")
						menu.controlsListen(ja, "down");
					if (type == "touchend")
						menu.controlsListen(ja, "up");
				}
				
			}, 1 + deviation * 2 + AX, 2 + deviation * 2 + AY,
			1 + deviation * 2 + NX, 2 + deviation * 2 + NY, sizeNormal, sizeNormal, true);
		this.createButton("left", "assets/menu/control_mobile/left.png", "controller", (type) => {
				let ls = game.bitFlags.left;
if (type == "touchstart") game.typeInput(ls, 1);
if (type == "touchend") game.typeInput(ls, 0);
				if (menu.isMenu) {
					let ja = "left";
					if (type == "touchstart")
						menu.controlsListen(ja, "down");
					if (type == "touchend")
						menu.controlsListen(ja, "up");
				}
				
			}, deviation + AX, 1 + deviation + AY,
			deviation + NX, 1 + deviation + NY, sizeNormal, sizeNormal, true);
		this.createButton("right", "assets/menu/control_mobile/right.png", "controller", (type) => {
				let ls = game.bitFlags.right;
if (type == "touchstart") game.typeInput(ls, 1);
if (type == "touchend") game.typeInput(ls, 0);
				if (menu.isMenu) {
					let ja = "right";
					if (type == "touchstart")
						menu.controlsListen(ja, "down");
					if (type == "touchend")
						menu.controlsListen(ja, "up");
				}
				
			}, 2 + deviation * 3 + AX, 1 + deviation + AY,
			2 + deviation * 3 + NX, 1 + deviation + NY, sizeNormal, sizeNormal, true);
		
		this.createButton("hold", "assets/menu/control_mobile/x.png", "controller", (type) => {
				let ls = game.bitFlags.hold;
if (type == "touchstart") game.typeInput(ls, 1);
if (type == "touchend") game.typeInput(ls, 0);
				
			}, MX - (1 + deviation + AX), 0 - deviation * 0 + AY,
			LNX - (1 + deviation + NX), 0 - deviation * 0 + NY, sizeNormal, sizeNormal, true);
		
		this.createButton("ccw", "assets/menu/control_mobile/b.png", "controller", (type) => {
				let ls = game.bitFlags.ccw;
if (type == "touchstart") game.typeInput(ls, 1);
if (type == "touchend") game.typeInput(ls, 0);
				if (menu.isMenu) {
					let ja = "b";
					if (type == "touchend")
						menu.controlsListen(ja, "down");
				}
				
			}, MX - (1 + deviation + AX), 2 + deviation * 2 + AY,
			LNX - (1 + deviation + NX), 2 + deviation * 2 + NY, sizeNormal, sizeNormal, true);
		
		this.createButton("c180w", "assets/menu/control_mobile/y.png", "controller", (type) => {
				let ls = game.bitFlags.c180w;
if (type == "touchstart") game.typeInput(ls, 1);
if (type == "touchend") game.typeInput(ls, 0);
				
			}, MX - (2 + deviation * 2 + AX), 1 + deviation * 1 + AY,
			LNX - (2 + deviation * 2 + NX), 1 + deviation * 1 + NY, sizeNormal, sizeNormal, true);
		this.createButton("cw", "assets/menu/control_mobile/a.png", "controller", (type) => {
				let ls = game.bitFlags.cw;
if (type == "touchstart") game.typeInput(ls, 1);
if (type == "touchend") game.typeInput(ls, 0);
				if (menu.isMenu) {
					let ja = "a";
					if (type == "touchend")
						menu.controlsListen(ja, "down");
					
				}
				
			}, MX - (0 + deviation * 0 + AX), 1 + deviation * 1 + AY,
			LNX - (0 + deviation * 0 + NX), 1 + deviation * 1 + NY, sizeNormal, sizeNormal, true);
		
		this.createButton("restart", "assets/menu/control_mobile/pause.png", "button", (type) => {
			if (type == "touchstart") {
				//game.initialize();
				game.pauseGame();
			}
			
		}, 0.5, 1 + deviation * 1, -10, 34, 0.7, 0.7);
		this.createButton("controls", "assets/menu/control_mobile/toggle.png", "button", (type) => {
			if (type == "touchend") this.toggleControllers();
		}, 1.5, 1 + deviation * 1, -10, 34, 0.7, 0.7);
		this.createButton("skill1", "assets/menu/control_mobile/skill1.png", "controller", (type) => {
			let ls = game.bitFlags.s1;
if (type == "touchstart") game.typeInput(ls, 1);
if (type == "touchend") game.typeInput(ls, 0);
		}, 2.5, 1 + deviation * 1, -10, 34, 0.7, 0.7);
		this.createButton("skill3", "assets/menu/control_mobile/skill2.png", "controller", (type) => {
			let ls = game.bitFlags.s2;
if (type == "touchstart") game.typeInput(ls, 1);
if (type == "touchend") game.typeInput(ls, 0);
		}, 3.5, 1 + deviation * 1, -10, 34, 0.7, 0.7);
		this.createButton("skill13", "assets/menu/control_mobile/skill3.png", "controller", (type) => {
			let ls = game.bitFlags.s3;
if (type == "touchstart") game.typeInput(ls, 1);
if (type == "touchend") game.typeInput(ls, 0);
		}, 4.5, 1 + deviation * 1, -10, 34, 0.7, 0.7);
		
		this.checkButtons()
		this.initialize();
		/*if (!window.mobileAndTabletCheck()) {
		 this.toggleControllers();


		}*/
	}
	
	initialize() {
		var event = (e) => {
			if (((e.type == "touchstart") || (e.type == "touchmove") || (e.type == "touchend")) && (this.isActive)) {
				let isPressed = false;
				let length = e.touches.length;
				if (e.type === "touchstart") this.lastTouch = e.touches[length - 1];
				let existing = {};
				for (var touches = 0; touches < length; touches++) {
					let tX = e.touches[touches].pageX,
						tY = e.touches[touches].pageY;
					let name = e.touches[touches].identifier; //`x${tX}y${tY}`;
					existing[name] = true;
					if (!(name in this.touchArr)) {
						for (var i in this.buttons) {
							var button = id(this.buttons[i].id),
								buttonClass = this.buttons[i];
							var buttonOffsetTop = clientRect(this.buttons[i].id, "y");
							var buttonOffsetLeft = clientRect(this.buttons[i].id, "x");
							var buttonOffsetHeight = clientRect(this.buttons[i].id, "height");
							var buttonOffsetWidth = clientRect(this.buttons[i].id, "width");
							
							if (
								tX >= buttonOffsetLeft && tX < buttonOffsetWidth + buttonOffsetLeft &&
								tY >= buttonOffsetTop && tY < buttonOffsetHeight + buttonOffsetTop &&
								buttonClass.active && buttonClass.isWholeActive && buttonClass.isControllerActive &&
								buttonClass.isNotReplayToShow
							) {
								this.touchArr[name] = {
									x: tX,
									y: tY,
									a: {},
								};
								this.touchArr[name].a = buttonClass;
							}
						}
						
					}
				};
				
				for (let m in this.touchArr) {
					if (!(m in existing)) {
						if ("a" in this.touchArr[m] && this.touchArr[m].a.isPressed) {
							this.touchArr[m].a.func("touchend");
							this.touchArr[m].a.isPressed = false;
							style(this.touchArr[m].a.id, "opacity", 0.6);
						}
						delete this.touchArr[m];
					} else {
						if ("a" in this.touchArr[m] && !this.touchArr[m].a.isPressed) {
							this.touchArr[m].a.func("touchstart");
							this.touchArr[m].a.isPressed = true;
							style(this.touchArr[m].a.id, "opacity", 1);
							isPressed = true;
						}
					}
				}
				
				return isPressed;
				
				
				
			}
		}
		for (let p of ["start", "end"]) window.addEventListener(`touch${p}`, e => {
			if (!fsw.isShown) e.preventDefault();
			else return;
			let t = e.touches[0];
			let y = event(e);
			menu.interactHardwareType = 1;
			
			if (!fsw.isShown && !menu.characterMenu.isActive && menu.isControllable && menu.isMenu) {
				if (p == "start") {
					menu.touchSensitivity.direction = y ? 3 : 0;
					
					menu.touchArea.start.x = t.pageX;
					menu.touchArea.start.y = t.pageY;
					menu.touchArea.difference.x = 0;
					menu.touchArea.difference.y = 0;
					menu.touchArea.x = t.pageX;
					menu.touchArea.y = t.pageY;
					menu.touchSensitivity.difference.x = t.pageX;
					menu.touchSensitivity.difference.y = t.pageY;
					menu.scroll.startY = menu.scroll.currentY;
					
					menu.touchArea.isPress = true;
					menu.touchArea.isNoMove = true;
					//////console.log(menu.touchArea.x);
				}
				
				if (p == "end") {
					menu.touchArea.isPress = false;
					let backb = id("GTRIS-MENU-DIV").getBoundingClientRect();
					if (!(backb.y <= menu.touchArea.y &&
							(backb.y + backb.height) > menu.touchArea.y &&
							backb.x <= menu.touchArea.x &&
							(backb.x + backb.width) > menu.touchArea.x
						)) {
						menu.touchArea.isNoMove = false;
					}
					
					
					if (menu.touchArea.isNoMove) {
						////console.log(evt.type)
						menu.selectableClick();
					}
				}
			} else if (menu.characterMenu.isActive) {
				menu.characterMenu.panelInteractListen(e);
			}
		}, false);
		
		window.addEventListener(`touchmove`, e => {
			e.preventDefault();
			let t = e.touches[0];
			
			if (menu.touchArea.isPress) {
				menu.touchArea.x = t.pageX;
				menu.touchArea.y = t.pageY;
				
				menu.touchArea.difference.x = (t.pageX - menu.touchArea.start.x);
				menu.touchArea.difference.y = (t.pageY - menu.touchArea.start.y);
				
				
				let dx = menu.touchArea.x - menu.touchSensitivity.difference.x;
				let dy = menu.touchArea.y - menu.touchSensitivity.difference.y;
				let hs = true;
				if (fsw.isShown || menu.characterMenu.isActive) { hs = false; return }
				
				if (menu.touchSensitivity.direction == 1 || menu.touchSensitivity.direction == 0) {
					let l = false;
					if (menu.touchSensitivity.direction == 0) {
						if (Math.abs(dx) >= game.cellSize * 2) {
							menu.touchSensitivity.direction = 1;
						}
						if (Math.abs(dy) >= game.cellSize * 2) {
							menu.touchSensitivity.direction = 2;
						}
						if (Math.abs(dx) >= game.cellSize * 0.5) {
							hs = false;
						}
						if (Math.abs(dy) >= game.cellSize * 0.5) {
							hs = false;
						}
					}
					while (menu.touchSensitivity.direction == 1 && dx > menu.touchSensitivity.x) {
						menu.touchSensitivity.difference.x += menu.touchSensitivity.x;
						dx -= menu.touchSensitivity.x;
						menu.moveRight();
						l = true;
						
					}
					while (dx < -menu.touchSensitivity.x) {
						menu.touchSensitivity.difference.x -= menu.touchSensitivity.x;
						dx += menu.touchSensitivity.x;
						menu.moveLeft();
						l = true;
					}
					if (l) menu.touchSensitivity.direction = 1;
					hs = l;
				}
				
				if (menu.touchSensitivity.direction == 2 || menu.touchSensitivity.direction == 0) {
					let l = false;
					while (dy > menu.touchSensitivity.y) {
						menu.touchSensitivity.difference.y += menu.touchSensitivity.y;
						dy -= menu.touchSensitivity.y;
						//	menu.moveDown();
						l = true;
					}
					while (dy < -menu.touchSensitivity.y) {
						menu.touchSensitivity.difference.y -= menu.touchSensitivity.y;
						dy += menu.touchSensitivity.y;
						//	menu.moveUp();	
						l = true;
					}
					if (l) menu.touchSensitivity.direction = 2;
					hs = l;
					menu.scroll.currentY = ((menu.scroll.startY - menu.touchArea.difference.y * 3));
					////console.log(menu.scroll.currentY, menu.scroll.startY - menu.touchArea.difference.y)
					//menu.scroll.currentY = 
				}
				if (hs) {
					menu.touchArea.isNoMove = false;
				}
			}
		}, false);
	}
};

const touchButtons = new MobileButtonSystem();

//fileLayer: data
const MATRIX = [
	 [
 	[
 		[2, 0, 0],
 		[2, 2, 0],
 		[0, 2, 0],
 	],
 	[
 		[0, 0, 0],
 		[0, 2, 2],
 		[2, 2, 0],
 	],
 	[
 		[0, 2, 0],
 		[0, 2, 2],
 		[0, 0, 2],
 	],
 	[
 		[0, 2, 2],
 		[2, 2, 0],
 		[0, 0, 0],
 	],
 ],
 [
 	[
 		[0, 3, 0],
 		[0, 3, 0],
 		[3, 3, 0]
 	],
  [
 		[0, 0, 0],
 		[3, 3, 3],
 		[0, 0, 3],
 	],
 	[
 		[0, 3, 3],
 		[0, 3, 0],
 		[0, 3, 0]
 	],
 	[
 		[3, 0, 0],
 		[3, 3, 3],
 		[0, 0, 0]
 	],

 ],
 [
 	[
 		[4, 4],
 		[4, 4],
 	],
 	[
 		[4, 4],
 		[4, 4],
 	],
 	[
 		[4, 4],
 		[4, 4],
 	],
 	[
 		[4, 4],
 		[4, 4],
 	]
 ],
  [
 	[
 		[0, 5, 0],
 		[5, 5, 0],
 		[5, 0, 0]
 	],
 	[
 		[0, 0, 0],
 		[5, 5, 0],
 		[0, 5, 5],
 	],
 	[
 		[0, 0, 5],
 		[0, 5, 5],
 		[0, 5, 0],
 	],
 	[
 		[5, 5, 0],
 		[0, 5, 5],
 		[0, 0, 0],
 	],
 ],
 [
  [
   [0, 6, 0, 0],
   [0, 6, 0, 0],
   [0, 6, 0, 0],
   [0, 6, 0, 0],
  ],
  [
   [0, 0, 0, 0],
   [0, 0, 0, 0],
   [6, 6, 6, 6],
   [0, 0, 0, 0]
  ],
  [
   [0, 0, 6, 0],
   [0, 0, 6, 0],
   [0, 0, 6, 0],
   [0, 0, 6, 0]
  ],
  [
   [0, 0, 0, 0],
   [6, 6, 6, 6],
   [0, 0, 0, 0],
   [0, 0, 0, 0]
  ]
 ],
 [
 	[
 		[7, 7, 0],
 		[0, 7, 0],
 		[0, 7, 0],
 	],
 	[
 		[0, 0, 0],
 		[7, 7, 7],
 		[7, 0, 0],
 	],
 	[
 		[0, 7, 0],
 		[0, 7, 0],
 		[0, 7, 7],
 	],
 	[
 		[0, 0, 7],
 		[7, 7, 7],
 		[0, 0, 0],
 	],
 ],
 [
 	[
 		[0, 8, 0],
 		[8, 8, 0],
 		[0, 8, 0],
 	],
 	[
 		[0, 0, 0],
 		[8, 8, 8],
 		[0, 8, 0],
 	],
 	[
 		[0, 8, 0],
 		[0, 8, 8],
 		[0, 8, 0],
 	],
 	[
 		[0, 8, 0],
 		[8, 8, 8],
 		[0, 0, 0],
 	],
 ],


];

const WK_SRSX = {
	I: {
		right: [
        [[0, 0], [-2, 0], [+1, 0], [-2, +1], [+1, -2]],
        [[0, 0], [-1, 0], [+2, 0], [-1, -2], [+2, +1]],
        [[0, 0], [+2, 0], [-1, 0], [+2, -1], [-1, +2]],
        [[0, 0], [+1, 0], [-2, 0], [+1, +2], [-2, -1]],
      ],
		left: [
        [[0, 0], [-1, 0], [+2, 0], [-1, -2], [+2, +1]],
        [[0, 0], [+2, 0], [-1, 0], [+2, -1], [-1, +2]],
        [[0, 0], [+1, 0], [-2, 0], [+1, +2], [-2, -1]],
        [[0, 0], [-2, 0], [+1, 0], [-2, +1], [+1, -2]],
      ],
		double: [
        [[0, 0], [-1, 0], [-2, 0], [+1, 0], [+2, 0], [0, +1]],
        [[0, 0], [0, +1], [0, +2], [0, -1], [0, -2], [-1, 0]],
        [[0, 0], [+1, 0], [+2, 0], [-1, 0], [-2, 0], [0, -1]],
        [[0, 0], [0, +1], [0, +2], [0, -1], [0, -2], [+1, 0]],
      ],
	},
	other: {
		right: [
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]],
		left: [
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]],
		double: [
  [[0, 0], [1, 0], [2, 0], [1, 1], [2, 1], [-1, 0], [-2, 0], [-1, 1], [-2, 1], [0, -1], [3, 0], [-3, 0], [0, 0]],
  [[0, 0], [0, 1], [0, 2], [-1, 1], [-1, 2], [0, -1], [0, -2], [-1, -1], [-1, -2], [1, 0], [0, 3], [0, -3], [0, 0]],
  [[0, 0], [-1, 0], [-2, 0], [-1, -1], [-2, -1], [1, 0], [2, 0], [1, -1], [2, -1], [0, 1], [-3, 0], [3, 0], [0, 0]],
  [[0, 0], [0, 1], [0, 2], [1, 1], [1, 2], [0, -1], [0, -2], [1, -1], [1, -2], [-1, 0], [0, 3], [0, -3], [0, 0]]],
	},
	O: {
		right: [
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2], [0, 3], [-1, 3], [0, 0]],
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2], [0, -3], [1, -3], [0, 0]],
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2], [0, 3], [1, 3], [0, 0]],
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2], [0, 3], [-1, -3], [0, 0]]],
		left: [
  [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2], [0, 3], [1, 3], [0, 0]],
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2], [0, -3], [1, -3], [0, 0]],
  [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2], [0, 3], [-1, 3], [0, 0]],
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2], [0, 3], [-1, -3], [0, 0]]],
		double: [
  [[0, 0], [1, 0], [2, 0], [1, 1], [2, 1], [-1, 0], [-2, 0], [-1, 1], [-2, 1], [0, -1], [3, 0], [-3, 0], [0, 0]],
  [[0, 0], [0, 1], [0, 2], [-1, 1], [-1, 2], [0, -1], [0, -2], [-1, -1], [-1, -2], [1, 0], [0, 3], [0, -3], [0, 0]],
  [[0, 0], [-1, 0], [-2, 0], [-1, -1], [-2, -1], [1, 0], [2, 0], [1, -1], [2, -1], [0, 1], [-3, 0], [3, 0], [0, 0]],
  [[0, 0], [0, 1], [0, 2], [1, 1], [1, 2], [0, -1], [0, -2], [1, -1], [1, -2], [-1, 0], [0, 3], [0, -3], [0, 0]]],
	},

};

//[propPos][rot][points]

const SPIN_DETECTION = {
		I: {
			highX: [[1, 2, 2, 1], [1, 3, 1, 3], [1, 2, 2, 1], [0, 2, 0, 2]],
			highY: [[0, 2, 0, 2], [1, 2, 2, 1], [1, 3, 1, 3], [1, 2, 2, 1]],
			lowX: [[-1, 4, -1, 4], [2, 2, 2, 2], [-1, 4, -1, 4], [1, 1, 1, 1]],
			lowY: [[1, 1, 1, 1], [-1, 4, -1, 4], [2, 2, 2, 2], [-1, 4, -1, 4]]
		},
		J: {
			highX: [[1, 2], [2, 2], [1, 0], [0, 0]],
			highY: [[0, 0], [1, 2], [2, 2], [1, 0]],
			lowX: [[0, 2], [0, 0], [2, 0], [2, 2]],
			lowY: [[2, 2], [0, 2], [0, 0], [2, 0]]
		},
		L: {
			highX: [[1, 0], [2, 2], [1, 2], [0, 0]],
			highY: [[0, 0], [1, 0], [2, 2], [1, 2]],
			lowX: [[2, 0], [0, 0], [0, 2], [2, 2]],
			lowY: [[2, 2], [2, 0], [0, 0], [0, 3]]
		},
		O: {
			highX: [[0, 1], [2, 2], [1, 0], [-1, -1]],
			highY: [[-1, -1], [0, 1], [2, 2], [1, 0]],
			lowX: [[1, 0], [-1, -1], [0, 1], [2, 2]],
			lowY: [[2, 2], [1, 0], [-1, -1], [0, 1]]
		},
		S: {
			highX: [[0, 2], [1, 2], [2, 0], [1, 0]],
			highY: [[0, 1], [2, 0], [2, 1], [0, 2]],
			lowX: [[0, -1], [1, 2], [-1, 3], [1, 0]],
			lowY: [[0, 1], [-1, 3], [2, 1], [3, -1]]
		},
		T: {
			highX: [[0, 2], [2, 2], [0, 2], [0, 0]],
			highY: [[0, 0], [0, 2], [2, 2], [0, 2]],
			lowX: [[0, 2], [0, 0], [0, 2], [2, 2]],
			lowY: [[2, 2], [0, 2], [0, 0], [0, 2]]
		},
		Z: {
			highX: [[2, 0], [2, 1], [0, 2], [0, 1]],
			highY: [[0, 1], [2, 0], [2, 1], [0, 2]],
			lowX: [[-1, 3], [2, 1], [3, -1], [0, 1]],
			lowY: [[0, 1], [-1, 3], [2, 1], [3, -1]]
		},
	},
	SPAWN_OFFSETS = {
		Z: [3, 0],
		L: [3, 0],
		O: [4, 0],
		S: [3, 0],
		I: [3, 0],
		J: [3, 0],
		T: [3, 0],
	};
const PREVIEW_OFFSETS = {
		Z: [1, 0.5],
		L: [1, 0.5],
		O: [1.5, 0.5],
		S: [1, 0.5],
		I: [0.3333, 0],
		J: [1, 0.5],
		T: [1, 0.5],
	}
const FLAG_DIRECTIONS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1]
 ];
 


const FLAG_CONNECTIONS = {
	color: 255,
	up: 256,
	right: 512,
	down: 1024,
	left: 2048
}

const PIECE = (function() {
	var a = [];
	var b = ["Z", "L", "O", "S", "I", "J", "T"];
	for (let i = 0; i < 7; i++) {
		a.push({
			index: i,
			prevx: PREVIEW_OFFSETS[b[i]][0],
			prevy: PREVIEW_OFFSETS[b[i]][1],
			x: SPAWN_OFFSETS[b[i]][0],
			y: SPAWN_OFFSETS[b[i]][1],
			matrix: MATRIX[i],
			kickTable: WK_SRSX[b[i] == "I" ? "I" : (b[i] == "O" ? "O" : "other")],
			spinDetection: SPIN_DETECTION[b[i]]
		});
	}
	return a;
})();

//navigator.clipboard.writeText(JSON.stringify(PIECE))

const BLOBS = (function() {

	let pp = function(c, d) {
		let ma = [[
    [
     [0, 0, 0],
     [c, d, 0],
     [0, 0, 0]
    ],
    [
     [0, 0, 0],
     [0, d, 0],
     [0, c, 0]
    ],
    [
     [0, 0, 0],
     [0, d, c],
     [0, 0, 0]
    ],
    [
     [0, c, 0],
     [0, d, 0],
     [0, 0, 0]
    ]
   ], [
       [
        [0, 0, 0],
        [c, d, 0],
        [0, d, 0]
       ],
       [
        [0, 0, 0],
        [0, d, d],
        [0, c, 0]
       ],
       [
        [0, d, 0],
        [0, d, c],
        [0, 0, 0]
       ],
       [
        [0, c, 0],
        [d, d, 0],
        [0, 0, 0]
       ]
      ],
[
       [
        [0, 0, 0],
        [d, d, 0],
        [0, c, 0]
       ],
       [
        [0, 0, 0],
        [0, d, c],
        [0, d, 0]
       ],
       [
        [0, c, 0],
        [0, d, d],
        [0, 0, 0]
       ],
       [
        [0, d, 0],
        [c, d, 0],
        [0, 0, 0]
       ]
      ],
[
       [
        [0, 0, 0],
        [c, c, 0],
        [d, d, 0]
       ],
       [
        [0, 0, 0],
        [c, d, 0],
        [c, d, 0]
       ],
       [
        [0, 0, 0],
        [d, d, 0],
        [c, c, 0]
       ],
       [
        [0, 0, 0],
        [d, c, 0],
        [d, c, 0]
       ]
      ],
      [
             [
                           [0, 0, 0],
                           [d, d, 0],
                           [d, d, 0],
                          ],
             [
              [0, 0, 0],
              [d, d, 0],
              [d, d, 0],
             ],
                          [
                           [0, 0, 0],
                           [d, d, 0],
                           [d, d, 0],
                          ],
                                       [
                                         [0, 0, 0],
                                        [d, d, 0],
                                        [d, d, 0],
                                       ]
            ]
      ][0];
		return ma;
	}



	let color1Bag = [];
	let color2Bag = [];
	let color3Bag = [];
	let main = [];

	let index = 0;

	for (let a = 1; a <= 5; a++) {
		for (let b = 1; b <= 5; b++) {

			let c = a + 0;
			let d = b + 0;

			main.push({
				index: index,
				matrix: pp(c, d),
				cp1: c,
				cp2: d,
				x: 3,
				y: 0,
				kickTable: {
					right: [
  [[0, 0], [-1, 0], [0, -1], [-1, -1], [-1, 0]],
  [[0, 0], [0, -1], [0, -1], [1, 0], [0, -1]],
  [[0, 0], [1, 0], [0, -1], [1, -1], [1, 0]],
  [[0, 0], [0, -1], [0, -1], [-1, 0], [0, -1]],
  ],
					left: [
  [[0, 0], [1, 0], [0, -1], [1, -1], [1, 0]],
  [[0, 0], [0, -1], [0, -1], [-1, 0], [0, -1]],
  [[0, 0], [-1, 0], [0, -1], [-1, -1], [-1, 0]],
  [[0, 0], [0, -1], [0, -1], [1, 0], [0, -1]],
  ],
					double: [
  [[0, 0], [0, 1]],
  [[0, 0], [0, 1]],
  [[0, 0], [0, 2]],
  [[0, 0], [0, 2]]
  ]
				},
			});
			color3Bag.push(index);
			if (a <= 3 && b <= 3) {
				color1Bag.push(index);
			}
			if (a <= 4 && b <= 4) {
				color2Bag.push(index);
			}
			index++;

		}
	}

	return {
		main: main,
		c1: color1Bag,
		c2: color2Bag,
		c3: color3Bag
	};

})();

const COLOR_BONUS = [[0, 3, 6, 12, 24, 48], [0, 2, 4, 6, 8, 10]];
const GROUP_BONUS = [[0, 0, 0, 0, 2, 3, 4, 5, 6, 7, 10], [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 8]];
const TSU_CHAIN_POWER = [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512, 544, 576, 608, 640, 672, 699];

/*////console.log(JSON.stringify(BLOBS.main.map((a) => {
 /*return {
  /*c1: a.cp1,
  c2: a.cp2,
  i: a.index
  
 };
 
 return a.matrix
}))) /**/

const TSU_CHAIN_SEQUENCE = {
	normal: ["init1", "init2", "spell1", "spell2", "spell3", "spell4", "spell5"],
	old: ["init1", "spell1", "spell2", "init5", "spell3", "spell4", "spell5"]
};

const CHAIN_SEQUENCE = [
 ["init1"],
 ["init1", "spell1"],
 ["init1", "init2", "spell1"],
 ["init1", "init2", "init3", "spell2"],
 ["init1", "init2", "init3", "init4", "spell2"],
 ["init1", "init2", "init3", "init4", "init5", "spell2"],
 ["init1", "init2", "init3", "init4", "init5", "init5", "spell3"],
 ["init1", "init2", "init3", "init4", "init5", "init5", "init5", "spell3"],
 ["init1", "init2", "init3", "init4", "spell2", "init5", "init5", "init5", "spell3"],
 ["init1", "init2", "init3", "init4", "spell2", "init4", "init5", "init5", "init5", "spell4"],
 ["init1", "init2", "init3", "init4", "spell2", "init3", "init4", "init5", "init5", "init5", "spell4"],
 ["init1", "init2", "init3", "init5", "spell2", "init3", "init4", "init5", "spell3", "init5", "init5", "spell4"],
 ["init1", "init2", "init3", "init5", "spell2", "init3", "init4", "init5", "spell3", "init5", "init5", "init5", "spell5"],
 ["init1", "init2", "init3", "init5", "spell2", "init2", "init3", "init4", "init5", "spell3", "init4", "init5", "init5", "spell5"],
 ["init1", "init2", "init3", "init5", "spell2", "init2", "init3", "init4", "init5", "spell3", "init3", "init4", "init5", "init5", "spell5"],
 ["init1", "init2", "init3", "init4", "init5", "spell2", "init2", "init4", "init5", "spell3", "init2", "init3", "init4", "init5", "init5", "spell5"],
 ["init1", "init2", "init3", "init4", "init5", "spell2", "init2", "init3", "init4", "init5", "spell3", "init2", "init3", "init4", "init5", "init5", "spell5"],
 ["init1", "init2", "init3", "init4", "init5", "spell2", "init2", "init3", "init4", "init5", "spell3", "init2", "init3", "init4", "init5", "init5", "init5", "spell5"],
 ["init1", "init2", "init3", "init4", "init5", "spell2", "init2", "init3", "init4", "init5", "spell3", "init2", "init3", "init4", "init3", "init4", "init5", "init5", "spell5"],
 ["init1", "init2", "init3", "init4", "init5", "spell2", "init2", "init3", "init4", "init5", "spell3", "init2", "init3", "init4", "init3", "init4", "init5", "init5", "init5", "spell5"],

 ["init5", "init2", "init3", "init4", "init5", "spell2", "init2", "init3", "init4", "init5", "spell3", "init2", "init3", "init4", "init3", "init4", "init5", "init5", "init5", "spell5"],
 ["init1", "init2", "init3", "init4", "init5", "spell2", "init2", "init3", "init4", "init5", "spell3", "init2", "init3", "init4", "init3", "init4", "init5", "init5", "init5", "spell5"],
];

const SCORE_TABLE = {
	pc: {
		b2b: {
			spin: [0, 2300, 3500, 5400],
			mini: [0, 1500, 2100, 2400],
			line: [0, 0, 0, 0, 3200, 4200],
		},
		nob2b: {
			spin: [0, 1200, 2400, 3600],
			mini: [0, 1000, 1400, 1800],
			line: [0, 800, 1200, 1800, 2000, 2800],
		}
	},
	nopc: {
		b2b: {
			spin: [400, 1200, 1600, 2400],
			mini: [100, 300, 600, 900],
			line: [0, 0, 0, 0, 1200, 1900],
		},
		nob2b: {
			spin: [400, 800, 1200, 1600],
			mini: [100, 200, 400, 600],
			line: [0, 100, 300, 500, 800, 1400],
		}
	},
	combo: 50,
};

const ALL_CLEAR_ANIMATION_PRESETS = {
	1: [true, [1, 1], [0, 1], 40, {
		y1: 0,
		y2: 0.9,
		y3: 1,
		y4: 1,
		s1: 0,
		s2: 0.9,
		s3: 1,
		s4: 1
	}],
	2: [false, [0, 1], [1, 1], 40, {
		y1: 0,
		y2: 0,
		y3: 0,
		y4: 1,
		s1: 0,
		s2: 0.9,
		s3: 1,
		s4: 1
	}],
	3: [false, [1, 1], [0.3, 1], -1, {
		y1: 0,
		y2: 0,
		y3: 0,
		y4: 1,
		s1: 0,
		s2: 0.9,
		s3: 1,
		s4: 1
	}],

}

//fileLayer: particle
class ObjectParticle {
 constructor(type, duration, imgRef, spriteRow, spriteCol, startX, startY, endX, endY, size, color, bezier, isOpaqueTrail, trailOptions, rotateOptions) {
  this.maintype = type;
  
  this.x = startX;
  this.y = startY;
  this.startX = startX;
  this.startY = startY;
  this.spriteCell = spriteCol;
  this.spriteRow = spriteRow;
  this.endX = endX;
  this.endY = endY;
  this.duration = duration;
  this.rotate = {
   speed: 0,
   pos: 0,
   type: "free",
   
  };
  if (typeof rotateOptions === "object") {
   for (let y in rotateOptions) {
    if (y in this.rotate) {
     this.rotate[y] = rotateOptions[y];
    }
   }
  }
  this.size = size;
  this.maxDuration = duration;
  this.elapsed = 0;
  this.type = "none";
  this.color = {
   r: color.r,
   g: color.g,
   b: color.b
  };
  this.color.isRandom = color == "random";
  this.bezier = bezier;
  this.isOpaqueTrail = isOpaqueTrail || false;
  //this.isBasic = false;
  if (this.type === "randomEase") {
   this.random1 = (Math.random() * 2);
   this.random2 = (Math.random() * 2);
  }
  this.trailArr = 0;
  this.trailFrame = 30;
  this.trailColor = {
   r: 255,
   g: 255,
   b: 255
  };
  if (isOpaqueTrail) {
   this.trailArr = [];
   this.trailFrame = ("frame" in trailOptions) ? trailOptions.frame : 30;
   
   this.trailColor.r = ("r" in trailOptions) ? trailOptions.r : 255;
   this.trailColor.g = ("g" in trailOptions) ? trailOptions.g : 255;
   this.trailColor.b = ("b" in trailOptions) ? trailOptions.b : 255;
   //////console.log(this.trailColor)
  }
  
  this.imgRef = imgRef;
  
 };
 update() {
  this.duration--;
  this.elapsed++;
  
  
  let fromX = this.x;
  let fromY = this.y;
  this.x = this.startX + ((this.endX - this.startX) * this.bezierFunc(this.duration / this.maxDuration,
   this.bezier.x1,
   this.bezier.x2,
   this.bezier.x3,
   this.bezier.x4));
  this.y = this.startY + ((this.endY - this.startY) * this.bezierFunc(this.duration / this.maxDuration,
   this.bezier.y1,
   this.bezier.y2,
   this.bezier.y3,
   this.bezier.y4));
  let toX = this.x;
  let toY = this.y;
  
  if (this.isOpaqueTrail) {
   
   
   //////console.log("trail")
   let len = this.trailArr.length;
   
   for (let h = 0; h < len; h++) {
    let ref = this.trailArr[h];
    
    
    //ref.frame--;
    if (ref.frame > 0) {
     ref.frame -= particle.refreshRate * 2;
     if (ref.frame <= 0) ref.frame = 0;
    } else {
     this.trailArr.splice(h, 1);
     len--;
     h--;
     
    }
   }
   
   if (this.duration >= 0) this.trailArr.push(new ObjectTrail({
    x1: fromX + (this.size / 2),
    y1: fromY + (this.size / 2),
    x2: toX + (this.size / 2),
    y2: toY + (this.size / 2)
   }, this.trailFrame))
  }
  this.rotate.pos += this.rotate.speed;
  /*
  if (this.type == "linear") {
   this.x = this.startX + ((this.endX - this.startX) * (this.duration / this.maxDuration));
   this.y = this.startY + ((this.endY - this.startY) * (this.duration / this.maxDuration));
  } else if (this.type == "ease") {
   this.y = (this.bezier(
    this.duration / this.maxDuration,
    this.startY,
    this.startY * 1.2,
    this.endY * 1.9,
    this.endY
   ));
   this.x = this.startX + ((this.endX - this.startX) * (this.duration / this.maxDuration));
  } else if (this.type == "ease2") {
   this.x = this.startX + ((this.endX - this.startX) * this.bezier(this.duration / this.maxDuration,
    0,
    0.8,
    1,
    1));
   this.y = this.startY + ((this.endY - this.startY) * this.bezier(this.duration / this.maxDuration,
    0,
    1,
    1,
    1));
  } else if (this.type == "hardDrop") {
   this.x = this.startX + ((this.endX - this.startX) * this.bezier(this.duration / this.maxDuration,
    0,
    0,
    0,
    1));
   this.y = this.startY + ((this.endY - this.startY) * this.bezier(this.duration / this.maxDuration,
    0,
    0,
    0,
    1));
  } else if (this.type == "randomEase") {
   this.x = this.startX + ((this.endX - this.startX) * this.bezier(this.duration / this.maxDuration,
    0,
    this.random1,
    this.random2,
    1));
   this.y = this.startY + ((this.endY - this.startY) * this.bezier(this.duration / this.maxDuration,
    0,
    1,
    1,
    1));
  } else if (this.type == "fall") {
   this.x = this.startX + ((this.endX - this.startX) * this.duration / this.maxDuration);
   this.y = this.startY + ((this.endY - this.startY) * this.bezier(this.duration / this.maxDuration,
    0,
    0,
    1,
    1));
  }
  */
 };
 getX() {
  return this.x;
 };
 getY() {
  return this.y;
 }
 opacityFade() {
  return (Math.min(1, (this.duration * 2.5) / this.maxDuration));
 }
 basicParticle(ctx) {
  let size = this.size * game.fontSize * 0.2;
  let color = !this.color.isRandom ? this.color : {
   r: ~~(Math.random() * 255),
   g: ~~(Math.random() * 255),
   b: ~~(Math.random() * 255)
  };
  ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${Math.floor(Math.min(100, (this.duration * 250) / this.maxDuration))}%`;
  //ctx.arc(this.x, this.y, size, 0, 2 * Math.PI, 0);
  //ctx.fill();
  ctx.fillRect(this.x, this.y, size, size);
 }
 bezierFunc(t, initial, p1, p2, final) {
  return (1 - t) * (1 - t) * (1 - t) * initial +
   3 * (1 - t) * (1 - t) * t * p1 +
   3 * (1 - t) * t * t * p2 +
   t * t * t * final;
 }
}

class ObjectTrail {
 constructor(param, frame) {
  this.x1 = param.x1 || 0,
   this.y1 = param.y1 || 0,
   this.x2 = param.x2 || 0,
   this.y2 = param.y2 || 0;
  
  this.distanceX = this.x1 - this.x2;
  //////console.log(this.x1)
  this.distanceY = this.y1 - this.y2;
  
  this.angle = Math.atan(this.distanceY / (this.distanceX || 0.000001)); // to prevent div by 0
  //this.angleY = Math.atan(this.distanceX/(this.distanceY || 0.000001))); // to prevent div by 0
  
  this.frame = frame || 30;
  this.frameMax = this.frame;
  this.width = (param.width / 2) || 3;
  this.maxWidth = this.width;
  
  
 }
 static changePos(x, y) {
  let x1 = this.x2;
  let y1 = this.y2;
  
  this.x1 = x1 || 0,
   this.y1 = y1 || 0,
   this.x2 = x || 0,
   this.y2 = y || 0;
  
  this.distanceX = this.x2 - this.x1;
  this.distanceY = this.y2 - this.y1;
  
  this.angleX = Math.tan(Math.arctan(this.distanceY / (this.distanceX || 0.000001))); // to prevent div by 0
  this.angleY = Math.tan(Math.arctan(this.distanceX / (this.distanceY || 0.000001))); // to prevent div by 0
  
 }
}

class ParticleImage {
 constructor(imgRef, cw, ch) {
  this.a = imgRef;
  this.cw = cw;
  this.ch = ch;
 }
}

Path = class {
 constructor() {
  this.waypoints = [];
  this.lengths = [];
  this.length = 0;
  this.seek = 0;
  this.timing = "linear";
  this.bez = [1 / 3, 2 / 3];
  this.last = {
   x: 0,
   y: 0
  }
 }
 setPath(arr) {
  this.waypoints = arr;
  this.lengths.length = 0;
  this.length = 0;
  for (let g = 0; g < this.waypoints.length - 1; g++) {
   let ref = this.waypoints[g];
   let ref2 = this.waypoints[g + 1];
   let dx = ref2.x - ref.x;
   let dy = ref2.y - ref.y;
   let length = Math.sqrt(dx * dx + dy * dy); //pythagoras what is the meaning of this
   this.length += length;
   this.lengths.push(length);
   this.last.x = ref2.x;
   this.last.y = ref2.y;
  }
  
 }
 setEasing(timing, bezier) {
  
 }
 positionAt(seek) {
  let ref = this.waypoints;
  let ref2 = this.lengths;
  let target = seek * this.length;
  let tr = 0;
  for (let j = 0; j < ref2.length; j++) {
   if (tr + ref2[j] >= target) {
    let time = (target - tr) / ref2[j];
    return {
     x: ref[j].x + (ref[j + 1].x - ref[j].x) * time,
     y: ref[j].y + (ref[j + 1].y - ref[j].y) * time
    };
   }
   tr += ref2[j];
  }
  return ref[ref.length - 1];
 }
};

const particle = new class {
 
 constructor() {
  this.refreshRate = 1;
  this.canvas = id("PARTICLE-PARTICLE-CANVAS");
  this.ctx = this.canvas.getContext("2d");
  this.canvas2;
  this.canvas3;
  elem("CANVAS", (e) => {
   this.canvas2 = e;
  });
  elem("CANVAS", (e) => {
   this.canvas3 = e;
  });
  this.ctx2 = this.canvas2.getContext("2d");
  this.ctx3 = this.canvas3.getContext("2d");
  this.intrv = 10;
  this.images = {};
  this.particles = [];
  this.isClear = false;
  
 }
 
 refresh() {
  if (this.intrv < 0) {
   this.clear(this.ctx);
   
   animatedLayers.run();
   
   for (let dh = 0; dh < this.refreshRate; dh++) {
    this.intrv = -1;
    let msd = game.cellSize / 20;
    //this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    if (this.particles.length > 0) {
     for (let i = 0, len = this.particles.length; i < len; i++) {
      if (typeof this.particles[i] !== "undefined") {
       this.particles[i].update();
       let reference = this.particles[i];
       if (this.particles[i].maintype == 0) {
        if (reference.isOpaqueTrail) {
         let path = this.ctx.beginPath();
         
         let len = reference.trailArr.length;
         
         
         for (let h = 0; h < len; h++) {
          let ref = reference.trailArr[h];
          
          //ref.x2 + (Math.sin(ref.angle) * (ref.width * (quot)));
          
          //////console.log()//ref.y2 + (ref.angleY * (ref.width * (quot))))
          let quot = Math.min((ref.frame / ref.frameMax) * msd*2, msd);
          
          if (h == 0) this.ctx.moveTo(ref.x2 + (Math.sin(ref.angle) * (ref.width * (quot))), ref.y2 + (Math.cos(ref.angle) * (-ref.width * (quot))));
          
          else this.ctx.lineTo(ref.x2 + (Math.sin(ref.angle) * (ref.width * (quot))), ref.y2 + (Math.cos(ref.angle) * (-ref.width * (quot))));
          
         }
         for (let h = len - 1; h >= 0; h--) {
          let ref = reference.trailArr[h];
          let quot = Math.min((ref.frame / ref.frameMax) * msd*2, msd);
          
          this.ctx.lineTo(ref.x2 + (Math.sin(ref.angle) * (-ref.width * (quot))), ref.y2 + (Math.cos(ref.angle) * (ref.width * (quot))));
          
         }
         this.ctx.closePath();
         this.ctx.fillStyle = `rgb(${reference.trailColor.r},${reference.trailColor.g},${reference.trailColor.b})`;
         //let path = new Path2D(string);
         this.ctx.fill();
        }
        
        
        this.dynamicDraw(
         game.cellSize,
         this.particles[i].imgRef,
         this.particles[i].getX(),
         this.particles[i].getY(),
         this.particles[i].spriteRow,
         this.particles[i].spriteCell,
         
         this.particles[i].duration > 0 ? this.particles[i].size : 0,
         this.particles[i].rotate.pos
        );
       } else {
        this.particles[i].basicParticle(this.ctx);
       }
       if (this.particles[i].duration < -30) {
        this.particles.splice(i, 1);
        len--;
        i--
       }
      }
      this.isClear = false;
     }
     
     //this.ctx.drawImage(this.canvas2, 0, 0, this.canvas.width, this.canvas.height);
     
    } else {
     if (!this.isClear) {
      //this.clear(this.ctx);
      this.clear(this.ctx2);
      this.isClear = true;
     }
    }
   }
   
   /*let mhn = this.ctx3.getImageData(0,0,this.canvas3.width, this.canvas3.height);
   for (let p = 3; p < mhn.data.length; p += 4) {
     if (mhn.data[p] < 50) mhn.data[p] = 0;
    }
    this.ctx3.putImageData(mhn, 0, 0);*/
   
  } else {
   this.intrv--;
  }
  
 }
 
 addImage(name, image, w, h) {
  this.images[name] = new ParticleImage(image, w, h);
 }
 
 addParticle(cellSize, imgRef, spriteRow, spriteCell, startX, startY, endX, endY, duration, size, clr, bez, isTrail, trailOptions, rotateOptions) {
  let color = clr ? clr : {
   r: 255,
   g: 255,
   b: 255
  };
  
  this.particles.push(new ObjectParticle(
   0,
   duration * this.refreshRate,
   imgRef,
   spriteRow,
   spriteCell,
   endX - ((size * cellSize) / 2),
   endY - ((size * cellSize) / 2),
   startX - ((size * cellSize) / 2),
   startY - ((size * cellSize) / 2),
   size * cellSize,
   color,
   bez,
   isTrail,
   trailOptions,
   rotateOptions));
 };
 
 addBasicParticle(cellSize, startX, startY, endX, endY, duration, size, clr, bez, isTrail, trailOptions, rotateOptions) {
  let color = clr ? clr : {
   r: 255,
   g: 255,
   b: 255
  };
  
  this.particles.push(new ObjectParticle(
   1,
   duration * this.refreshRate,
   null,
   0,
   0,
   endX - ((size * cellSize) / 2),
   endY - ((size * cellSize) / 2),
   startX - ((size * cellSize) / 2),
   startY - ((size * cellSize) / 2),
   size * cellSize,
   color,
   bez,
   isTrail,
   trailOptions,
   rotateOptions));
 };
 
 
 customDraw(img, sx, sy, sw, sh, x, y, w, h) {
  this.ctx2.drawImage(img, sx, sy, sw, sh, x, y, w, h);
 }
 
 dynamicDraw(cs, _img, x, y, r, cell, size, deg) {
  x = ~~x;
  let row;
  //let cs = game.cellSize
  let img = this.images[_img];
  let type = img.a;
  
  if (r == 1 || true) {
   type = img.a;
   row = r;
  }
  /*
    this.ctx.drawImage(
     type,
     cell * img.cw,
     row * img.ch,
     img.cw,
     img.ch,
     x,
     y,
     size,
     size,
    );*/
  /*let m = this.ctx2.getImageData(0, 0, this.canvas2.width,
    this.canvas2.height);
  
  for (let a = 3, length = m.length; a < length; a += 4) {
   if (m[a] < 100 && m[a] !== 0) m[a] = 0;
  }
  this.ctx2.putImageData(m,0,0)*/
  
  this.ctx.save();
  this.ctx.translate(x + size / 2, y + size / 2);
  this.ctx.rotate((Math.PI * 2) * (deg / 360));
  this.ctx.drawImage(type,
   cell * img.cw,
   row * img.ch,
   img.cw,
   img.ch, -size / 2, -size / 2, size, size);
  this.ctx.restore();
 };
 
 size(w, h) {
  this.canvas.width = w;
  this.canvas.height = h;
  this.canvas2.width = w;
  this.canvas2.height = h;
  this.canvas3.width = w;
  this.canvas3.height = h;
  
 }
 
 clear(context) {
  context.clearRect(
   0,
   0,
   context.canvas.width,
   context.canvas.height
  )
 }
 
 
}();

const animatedLayers = new class {
	#Image = class {
		constructor(w, h) {
			this.a = null;
			this.w = w;
			this.h = h;
			
		}
		load(img) { this.a = img }
	};
	#ObjectLayer = class {
		constructor(frame, posX, posY, rot, imgX, imgY, frameW, frameH, boundX, speed, img, centerPos, lp, paused, opacity) {
			this.pos = { x: posX, y: posY, rot: rot || 0 };
			this.offsetPos = { frame: 0, frameMax: 0, x: posX, y: posY, bez: [1 / 3, 2 / 3] };
			this.offsetRot = { frame: 0, frameMax: 0, rot: rot, bez: [1 / 3, 2 / 3] };
			this.offsetFlip = [];
			for (let gsv = 0; gsv < 2; gsv++) { this.offsetFlip.push({ frame: 0, frameMax: 0, val: 1, newVal: 1, bez: [1 / 3, 2 / 3] }) } this.img = { w: imgX, h: imgY };
			this.opacity = { fromValue: 1, toValue: 1, max: -1, time: -1 };
			this.frame = { w: frameW, h: frameH, int: frame, bound: boundX, elapsed: 0, max: frame, rate: speed };
			this.a = img;
			this.sizeMult = 1;
			this.centerPos = { y: 0, x: 0 };
			this.isSizeCustom = false;
			this.controllable = { on: false };
			this.loop = {};
			this.isPaused = paused;
			let loop = lp || {};
			this.loop.isOn = loop.isOn || false;
			this.loop.targetFrame = "targetFrame" in loop ? loop.targetFrame : frame;
			this.loop.resetFrame = loop.resetFrame || 0;
			if (typeof centerPos === "object") {
				this.centerPos.x = centerPos.x;
				this.centerPos.y = centerPos.y;
				this.isSizeCustom = "sizecustom" in centerPos ? centerPos.sizecustom : 1;
				this.sizeMult = "mult" in centerPos ? centerPos.mult : 1
			}
			this.path = new Path;
			this.pathFrame = { int: 0, max: 0 }
		}
		setPath(waypoints, frame, bez) {
			this.path.setPath(waypoints);
			if (bez) this.path.bez = bez;
			this.pathFrame.int = frame;
			this.pathFrame.max = frame;
			this.pos.x = this.path.last.x;
			this.pos.y = this.path.last.y
		}
		scaleXOffset(x, nx, frame, bez) {
			let msd = this.offsetFlip[0];
			msd.newVal = x;
			msd.val = nx;
			if (bez) msd.bez = bez;
			msd.frame = msd.frameMax = frame || 0
		}
		scaleYOffset(x, nx, frame, bez) {
			let msd = this.offsetFlip[1];
			msd.newVal = x;
			msd.val = nx;
			if (bez) msd.bez = bez;
			msd.frame = msd.frameMax = frame || 0
		}
		moveOffset(x0, y0, x1, y1, frame, bez) {
			this.offsetPos.x = x0;
			this.offsetPos.y = y0;
			this.pos.x = x1;
			this.pos.y = y1;
			if (bez) this.offsetPos.bez = bez;
			this.offsetPos.frame = this.offsetPos.frameMax = frame || 0
		}
		rotateOffset(r0, r1, frame, bez) {
			this.offsetRot.rot = r0;
			this.pos.rot = r1;
			if (bez) this.offsetRot.bez = bez;
			this.offsetRot.frame = this.offsetRot.frameMax = frame || 0
		}
		setFrame(frame) {
			let el = this;
			let decimal = el.frame.elapsed - ~~el.frame.elapsed;
			el.frame.int = el.frame.max - (frame + decimal);
			el.frame.elapsed = frame + decimal
		}
	};
	constructor(ctx) {
		this.cellSize = 0;
		this.ctx = ctx;
		this.images = {};
		this.main = new ObjectFunctionIterator(ob => {
			let g = Object.keys(ob);
			let l = g.length;
			for (let h = 0; h < l; h++) {
				let el = ob[g[h]];
				let opacityDifference = 0;
				if (el.opacity.time <= 1 + el.opacity.max) {
					el.opacity.time++;
					if (el.opacity.max < el.opacity.time) el.opacity.time = el.opacity.max;
					opacityDifference = (el.opacity.toValue - el.opacity.fromValue) * ((el.opacity.max - el.opacity.time) / el.opacity.max)
				} else opacityDifference = 0;
				this.ctx.globalAlpha = el.opacity.toValue - opacityDifference;
				let mnx = el.pos.x;
				let mny = el.pos.y;
				let mnr = el.pos.rot;
				if (el.offsetPos.frame > 0) {
					let bm = bezier1D(el.offsetPos.frame / el.offsetPos.frameMax, el.offsetPos.bez[0], el.offsetPos.bez[1]);
					mnx = el.pos.x + (el.offsetPos.x - el.pos.x) * bm;
					mny = el.pos.y + (el.offsetPos.y - el.pos.y) * bm;
					el.offsetPos.frame--
				}
				if (el.pathFrame.int > 0) {
					let bm = bezier1D((el.pathFrame.max - el.pathFrame.int) / el.pathFrame.max, el.path.bez[0], el.path.bez[1]);
					let re = el.path.positionAt(bm);
					mnx = re.x;
					mny = re.y;
					el.pathFrame.int--
				}
				if (el.offsetRot.frame > 0) {
					let bm = bezier1D(el.offsetRot.frame / el.offsetRot.frameMax, el.offsetRot.bez[0], el.offsetRot.bez[1]);
					mnr = el.pos.rot + (el.offsetRot.rot - el.pos.rot) * bm;
					el.offsetRot.frame--
				}
				for (let hsm = 0; hsm < 2; hsm++) {
					let msd = el.offsetFlip[hsm];
					msd.out = msd.val;
					if (msd.frame > 0) {
						let bm = bezier1D(msd.frame / msd.frameMax, msd.bez[0], msd.bez[1]);
						msd.out = msd.val + (msd.newVal - msd.val) * bm;
						msd.frame--
					}
				}
				let sizeMult = el.isSizeCustom ? el.sizeMult : this.cellSize * el.sizeMult;
				this.ctx.save();
				this.ctx.translate(el.centerPos.x + mnx * sizeMult, el.centerPos.y + mny * sizeMult);
				this.ctx.rotate(Math.PI * 2 * (mnr / 360));
				this.ctx.translate(0 - 0 * sizeMult * (el.img.w / 2), 0 - 0 * sizeMult * (el.img.h / 2));
				this.ctx.scale(el.offsetFlip[0].out, el.offsetFlip[1].out);
				this.ctx.drawImage(this.images[el.a].a, ~~(Math.floor(el.frame.elapsed) % el.frame.bound) * el.frame.w, ~~(~~el.frame.elapsed / el.frame.bound) * el.frame.h, el.frame.w, el.frame.h, -(sizeMult * (el.img.w / 2)), -(sizeMult * (el.img.h / 2)), sizeMult * el.img.w, sizeMult * el.img.h);
				this.ctx.restore();
				this.ctx.globalAlpha = 1;
				if (!el.isPaused) {
					el.frame.int -= el.frame.rate;
					el.frame.elapsed += el.frame.rate
				}
				if (el.loop.isOn && (el.loop.targetFrame <= ~~el.frame.elapsed || el.frame.int <= 0 - el.frame.rate)) {
					let decimal = el.frame.elapsed - ~~el.frame.elapsed;
					el.frame.int = el.frame.max - (el.loop.resetFrame + decimal);
					el.frame.elapsed = el.loop.resetFrame + decimal
				}
				if (el.frame.int <= 0 - el.frame.rate && !el.loop.isOn && !el.isPaused) {
					delete ob[g[h]];
					g.splice(h, 1);
					h--;
					l--
				}
			}
		})
	}
	getObject(name) { return this.main.obj[name] } checkObject(boolName) { return boolName in this.main.obj } create(id, frame, centerX, centerY, posX, posY, rot, frameW, frameH, w, h, speed, img, boundX, sizeMult, loop, paused, isSizeCustom) { this.main.addItem(id || Math.random() * 2147483647, new this.#ObjectLayer(frame, posX - 0 * this.cellSize * w / 2, posY - 0 * this.cellSize * h / 2, rot, w, h, frameW, frameH, boundX || 10, speed, img, { x: centerX || 0, y: centerY || 0, mult: sizeMult !== void 0 ? sizeMult : 1, sizecustom: isSizeCustom }, loop, paused, 1)); return this.main.obj[name] } setOpacity(name, value, time) {
		this.main.obj[name].opacity.fromValue = this.main.obj[name].opacity.toValue;
		this.main.obj[name].opacity.toValue = value;
		this.main.obj[name].opacity.max = time || -88;
		this.main.obj[name].opacity.time = 0
	}
	remove(id) { if (this.checkObject(id)) this.main.remove(id) } loadOffline(id, img, w, h) {
		this.images[id] = new this.#Image(w, h);
		this.images[id].load(img)
	}
	loadOfflineArr(arr) {
		for (let a of arr) {
			let m = a.dir;
			this.images[a.name] = new this.#Image(m.width, m.height);
			this.images[a.name].load(m)
		}
	}
	load(arr) {
		return new Promise(async res => {
			for (let a of arr) {
				let m = await loadImage(a.dir);
				this.images[a.name] = new this.#Image(m.width, m.height);
				this.images[a.name].load(m)
			}
			res()
		})
	}
	run() { this.main.update() }
}(particle.ctx);

//fileLayer: ai
class NoAI {
	//Sapphirus AI
	#core = 0;
	active = true;
	constructor(parent, name, text) {
		this.parent = parent;
		this.active = false;
		
		
	}
	engageWorker() {
		
	}
	loadFrenzyMovements(file) {
		
	}
	
	run(a) {}
	
	postToCore(jsobj) {
		
	}
	
	
	async evaluate(active, hold, isHeld, next, b2b, combo, grid, hx, hy, px, py, prot, temp) {
		
	}
}

class BaseAI {
	controls = {
	1: "A",
	2: "B",
	5: "C",
	6: "D",
	7: "E",
	3: "F",
	4: "G",
	128: "H"
}
bitToFlag = {
	A: "left",
	B: "right",
	C: "softdrop",
	D: "harddrop",
	E: "hold",
	F: "cw",
	G: "ccw",
	H: "c180w"
}
isThinking = false;
}

class ArtificialIntelligence extends BaseAI {
	//Sapphirus AI
	#core = 0;
	constructor(parent, name, text) {
		super();
		this.parent = parent;
		this.delayReset = 10;
		this.moves = [];
		this.active = false;
		this.pressStr = 0;
		this.pressLast = 0;
		this.pieceDelay = 0;
		this.ai = {
			controlImg: {
				x: 0,
				y: 0,
				rot: 0,
				hold: 0
			},
			rotations: [
				[0],
				[
					1, 1, 1, 1
				],
				[
					2, 2, 2, 2
				]
			],
			
			enableTspin: true,
			grid: [],
			ppsLimit: 1,
			
			extraMovements: [],
			x: 0,
			y: 0,
			rot: 0,
			matrix: [],
			heuristicsWeight: {
				aggHeight: -0.0000510066,
				bump: -0.184483,
				lines: 0.1760666,
				holes: -41.0000300044,
				blockade: -0.0666,
				failedTspin: -994.0,
				failedWide: -990,
				b2b: 0.75,
				possibleSpin: 0.22202
			},
			failedWide: 0,
			tspinDetector: {
				tslot: [
					[0, 1],
					[1, 1],
					[2, 1],
					[1, 2]
				],
				bottom: [
					[0, 2],
					[2, 2] /*, [-1, 1], [3, 1]*/
				],
				tuck: [
					[0, 0, [
						[1, 0],
						[2, 0]
					]],
					[2, 0, [
						[0, 0],
						[1, 0]
					]]
				],
			},
			tspinHeight: 5,
			flag: {
				LEFT: 1,
				RIGHT: 2,
				SOFTDROP: 4,
				HARDDROP: 8,
				HOLD: 16,
				CW: 32,
				CCW: 64,
				C180W: 128,
			},
			
			tspinDetected: {
				tslot: [],
				bottom: [],
				tuck: [],
				
				tLines: [],
				tBlock: [],
				tSlot: [],
				tAvoidColumn: []
				
				
			}
			
		};
		this.name = name;
		this.text = text;
		
		this.isThinking = false;
		
	}
	engageWorker() {
		multithread.engageWorker(this.name, this.text, (a) => {
			this.#core = a.worker;
		});
	}
	loadFrenzyMovements(file) {
		
	}
	
	j = {
	1: "A",
	2: "B",
	4: "C",
	8: "D",
	16: "E",
	32: "F",
	64: "G",
	128: "H"
};
	
	run(a) {
		//this.pressStr = 0;
		let isTooMuchChain = false;
		
if (this.moves[0] !== 4&& this.pressStr > 0) {
	this.pressStr = 0;
	
	this.moves.shift();
	return;
}
		game.forEachPlayer(player => {
			if (player.blob.forecastedChain > 5) isTooMuchChain = true;
		});
		
		
		if (this.pieceDelay < 0) {
			
			this.pieceDelay = Math.random() * 15 + 5;
			if (this.parent.block.isProfessional) this.pieceDelay += 30;
			
			if (isTooMuchChain) {
				//h = 8;
				//this.moves.push(88);
				this.pieceDelay = 0;
			}
			
			
			
				for (let g = 0; g < this.moves.length; g++) {
					
					let h = this.moves[g];
					this.pressStr = game.bitFlags[this.bitToFlag[this.j[h]]];
					

					if (h == 4) {
						if (this.parent.block.checkValid(this.parent.block.piece.activeArr, 0, 1)) {
							break;
							
							
						} else {
							this.pressStr ^= game.bitFlags.softdrop;
							this.pieceDelay = -999;
							
							this.moves.shift();
							g--;
						}
					}
					
										
					
					//////console.log(this.parent.pressStr)
					break;
					
				}
		}
		
		this.pieceDelay--;
	}
	
	postToCore(jsobj) {
		try {
			this.#core.postMessage(jsobj);
		} catch (e) {
			//////console.log(e);
		}
		
		return new Promise((res) => {
			this.#core.addEventListener("message", (te) => {
				res(te.data);
			}, { once: true });
		});
	}
	
	
	async evaluate(active, hold, isHeld, next, b2b, combo, grid, hx, hy, px, py, prot, temp) {
		if (isHeld) return;
		//////console.log(this.parent.player, this.parent)
		let obj = {
			grid: JSON.parse(JSON.stringify(grid)),
			b2b: b2b,
			preset: this.ai,
			pieceSet: temp,
			isWarning: this.parent.isWarning,
			width: 10,
			height: 40,
			hiddenHeight: 20,
			visibleHeight: 20,
			combo: this.parent.block.combo,
			isEnable180: false,
			piecesCount: 1,
			tFulfill: this.ai.tspinDetected.tFulfill || [],
			tPrevent: this.ai.tspinDetected.tPrevent || [],
			tLines: this.ai.tspinDetected.tLines || [],
			tAvoidColumn: this.ai.tspinDetected.tAvoidColumn || [],
		};
		
		
		
		this.moves = [];
		
		let args = [active, hold, next, obj, px, py, hx, hy, prot];
		let best = await this.postToCore(args);
		this.moves = best.move;
		this.ai.tspinDetected.tLines = best.tl;
		this.ai.tspinDetected.tAvoidColumn = best.ta;
		this.ai.tspinDetected.tPrevent = best.tp;
		this.ai.tspinDetected.tFulfill = best.tf;
	}
}
class NeoplexArtificialIntelligence extends BaseAI {
	#core = 0;
	constructor(parent, name, text) {
		super();
		this.delRes = 5;
		this.del = 0;
		this.active = false;
		this.pressStr = 0;
		this.pressLast = "";
		this.moves = [];
		this.parent = parent;
		this.name = name;
		this.text = text;
		this.isThinking = false;
	}
	
	engageWorker() {
		multithread.engageWorker(this.name, this.text, (a) => {
			this.#core = a.worker;
			this.#core.onerror = (e) => {
				//////console.log(e)
				console.warn(e.message, e.colno, e.lineno)
			}
		});
	}
	
	postToCore(obj) {
		try {
			this.#core.postMessage(obj);
		} catch (e) {
			//////console.log(e);
		}
		
		return new Promise((res) => {
			this.#core.addEventListener("message", (t) => {
				res(t.data);
			}, { once: true });
		});
	}
	
	run() {
		
		
		
		
	if (this.pressStr > 0 && this.moves[0] !== 5) {
		this.pressStr = 0;
		
		this.moves.shift();
		return;
	}
		
		let isTooMuchChain = false;
		
		if (this.del < 0) {
			this.del = Math.random() * 0 + 0;
			
			if (isTooMuchChain) {
				//h = 8;
				//this.moves = [6];
				//this.del = 0;
			}
			
			
			
			for (let g = 0; g < this.moves.length; g++) {
				let m = this.controls;
				let h = this.moves[g];
				if (isTooMuchChain) {
					h = 6;
					this.del = -90;
				}
				this.pressStr = game.bitFlags[this.bitToFlag[m[h]]];
				
				
				
				if (h == 5) {
					if (this.parent.block.checkValid(this.parent.block.piece.activeArr, 0, 1)) {
						break;
						
					} else {
						this.pressStr ^= game.bitFlags.softdrop;
						this.del = -999;
						this.moves.shift();
						g--;
					}
				}
				
				break;
			}
		}
		this.del--;
		
	}
	
	async evaluate(active, hold, isHeld, next, b2b, combo, grid, hx, hy, px, py, prot, temp, drawMatrix, count) {
		if (isHeld) return;
		this.isThinking = true;
		this.moves.length = 0;
		//let [width, hiddenHeight, visibleHeight, height, stack, active, hold, next] = data;
		
		let args = [10, 20, 20, 40, grid, active, hold, next, this.parent.block.combo, count];
		let best = await this.postToCore(args);
		let g = best.a;
		this.moves = g[1];
		//drawMatrix(g[2], g[3], g[4], g[5]);
		this.isThinking = false;
	}
}

class NeoplexBlobArtificialIntelligence extends BaseAI{
	#core = 0;
	#functions = 0;
	constructor(parent, name, text, funcText) {
		super();
		this.delRes = 10;
		this.del = 0;
		this.active = false;
		this.pressStr = 0;
		this.pressLast = "";
		this.moves = [];
		this.previous = {
			x: 2,
			rot: 0
		};
		this.movePos = {
			x: 0,
			y: 0,
			rot: 0
		};
		this.parent = parent;
		this.name = name;
		this.text = text;
		this.funcText = funcText
		this.isThinking = false;
	}
	
	engageWorker() {
		multithread.engageWorker(this.name, this.text, (a) => {
			this.#core = a.worker;
			this.#core.onerror = (e) => {
				//////console.log(text)
				alert("AWWW SNAP " + e.message, e.colno, e.lineno);
			}
		});
		multithread.engageWorker(this.name, this.funcText, (a) => {
			this.#functions = a.worker;
			this.#functions.onerror = (e) => {
				//////console.log(text)
				console.warn("AW SNAP " + e.message, e.colno, e.lineno);
			}
		});
	}
	
	postToCore(obj) {
		try {
			this.#core.postMessage(obj);
		} catch (e) {
			//////console.log(e);
		}
		
		return new Promise((res) => {
			this.#core.addEventListener("message", (t) => {
				res(t.data);
			}, { once: true });
		});
	}
	
	postToFunctions(obj) {
		try {
			this.#functions.postMessage(obj);
		} catch (e) {
			//////console.log(e);
		}
		
		return new Promise((res) => {
			this.#functions.addEventListener("message", (t) => {
				res(t.data);
			}, { once: true });
		});
	}
	
	run() {
		if (this.pressStr > 0 && this.moves[0] !== 5) {
			this.pressStr = 0;
			this.moves.shift();
			return;
		}
		if (this.del < 0) {
			this.del = Math.random() * 0 + 0;
			for (let g = 0; g < this.moves.length; g++) {
				let m = this.controls
				let h = this.moves[g];
				if (!this.parent.flagPresses.softdrop) this.pressStr = game.bitFlags[this.bitToFlag[m[h]]];

				if (h == 5) {
					if (this.parent.blob.checkValid(this.parent.blob.piece.activeArr, 0, 1)) {
						this.del = -999;
						
					} else {
						this.pressStr ^= game.bitFlags.softdrop;
						this.del = -999;
						this.moves.shift();
						g--;
					}
				}
				
				
				break;
			}
		}
		this.del--;
		
	}
	
	evalNode(arr) {
		return new Promise((res) => {
			
			
		});
		
	}
	
	async evaluate(stack, preview, w, h, vh, hh) {
		this.moves.length = 0;
		
		//stack, preview, w, h, hh, vh
		//////console.log(preview)
		let args = [stack, preview, w, h, hh, vh];
		//////console.log("ayo wf")
		//////console.log(preview)
		let bst = await this.postToCore(args);
		let best = bst.a;
		//////console.log(best)
		//////console.log(nodes.a + " NODES");
		//////console.log(nodes.a)
		/*let args2 = [nodes.a, this.previous.x, this.previous.rot];
		//////console.log(args2)
		
		let best = await this.postToFunctions(args2);
		//////console.log(best);*/
		//let best = JSON.parse(tbest);
		let px = 1,
			rot = 0;
		this.previous.x = best.x;
		this.previous.rot = best.rot;
		
		
		
		while (rot !== best.rot) {
			/*if (rot === 3) {
				this.moves.push(4);
				rot = 3;
			}*/
			{
				this.moves.push(3);
				rot++;
			}
		}
		
		while (px !== best.x) {
			if (px > best.x) {
				px--;
				this.moves.push(1);
			}
			if (px < best.x) {
				px++;
				this.moves.push(2);
			}
			//////console.log(px)
		}
		/*
		 */
		
		/*while(this.parent.blob.fieldSize.w > px) {
		 px++;
		 this.moves.push(2);
		}/**/
		
		this.moves.push(5);
		this.moves.push(6);
		
		//for (let g = 0; g < best.le)
		
		/*let g = best.a;
		this.moves = g[1];*/
		//drawMatrix(g[2], g[3], g[4], g[5]);
		
	}
}

class Neoplex2BlobArtificialIntelligence extends BaseAI{
	#core = 0;
	constructor(parent, name, text) {
		super();
		this.parent = parent;
		this.delayReset = 10;
		this.moves = [];
		this.active = false;
		this.pressStr = 0;
		this.pressLast = "";
		this.del = 10;
		this.ai = {
			x: 0,
			y: 0,
			rot: 0,
			enable: 0,
		};
		this.name = name;
		this.text = text;
		this.isThinking = false;
	}
	
	engageWorker() {
		multithread.engageWorker(this.name, this.text, (a) => {
			this.#core = a.worker;
			this.#core.onerror = (e) => {
				//////console.log(e)
				console.warn(e.message, e.colno, e.lineno)
			}
		});
	}
	m = {
					1: "A",
					2: "B",
					5: "C",
					6: "D",
					7: "E",
					3: "G",
					4: "F",
					128: "H"
				}
	run(a) {
		
		if (this.pressStr > 0 && this.moves[0] !== 5) {
	this.pressStr = 0;
	this.moves.shift();
	return;
}
		
		

		if (this.parent.activeType !== 1) return;
		
		let isTooMuchChain = this.parent.blob.insane.isOn || this.parent.blob.isWarning;
		game.forEachPlayer(player => {
			if (player.blob.forecastedChain > 6) isTooMuchChain = true;
		});
		
		if (this.del < 0) {
			this.del = Math.random() * 0 + (isTooMuchChain ? 0 : 10);
			for (let g = 0; g < this.moves.length; g++) {
				let h = this.moves[g];
				if (!this.parent.flagPresses.softdrop) this.pressStr = game.bitFlags[this.bitToFlag[this.m[h]]];
				
				if (h == 5) {
					if (this.parent.blob.piece.enable/*checkValid(this.parent.blob.piece.activeArr, 0, 1)/**/ && this.active) {
						this.del = -999;
						if (this.parent.blob.y >= 0 && !(this.pressStr & game.bitFlags.softdrop)) this.pressStr = game.bitFlags.softdrop;
						
					} else {
						this.pressStr ^= game.bitFlags.softdrop;
						this.del = -999;
						this.moves.shift();
						g--;
					}
				}
				
				
				break;
			}
		}
		this.del--;
	}
	
	postToCore(jsobj) {
		try {
			this.#core.postMessage(jsobj);
		} catch (e) {
			////console.log(e);
		}
		
		return new Promise((res) => {
			this.#core.addEventListener("message", (te) => {
				res(te.data);
			}, { once: true });
		});
	}
	
	
	async evaluate(stack, preview, w, h, vh, hh) {
		//this.ai.enable = false;
		this.active = false;
		this.moves = [5];
		let colors = [];
		for (let color = 0; color < this.parent.blob.colors; color++) {
			colors.push(this.parent.blob.colorSet[color]);
		}
		let prev = this.parent.blob.piece.active;
		let arrActive = this.#blobTranslate(prev.color1, prev.color2, prev.type);
		let arr = [stack, w, hh, vh, arrActive, this.parent.garbageLength + ((this.parent.blob.insane.isOn || this.parent.blob.isWarning) ? 8 : 0), this.parent.blob.piece.isBig, colors];
		//////console.log(arr)
		
		let best = await this.postToCore(arr);
		best = best.a;
		let limit = 30;
		//////console.log(best);
		//this.ai.enable = true;
		this.active = true;
		this.ai.x = best.x;
		this.moves.length = 0;
		//this.ai.y = best.y;
		this.ai.rot = best.rot;
		//////console.log(this.ai.rot)
		let rot = this.parent.blob.piece.rot;
		if (this.parent.blob.piece.isBig) {
			while (rot !== best.rot && limit > 0) {
				if (best.rot < rot) {
					this.moves.push(4);
					rot--;
				} else /**/ {
					this.moves.push(3);
					rot++;
				}
				limit--;
			}
		}
		else
			while (rot !== best.rot && limit > 0) {
				if (best.rot === 3) {
					this.moves.push(4);
					rot = 3;
				} else /**/ {
					this.moves.push(3);
					rot++;
				}
				limit--;
			}
		let px = this.parent.blob.piece.x;
		while (px !== best.x && limit > 0) {
			if (px > best.x) {
				px--;
				this.moves.push(1);
			}
			if (px < best.x) {
				px++;
				this.moves.push(2);
			}
			limit--;
			//////console.log(px)
		}
		/*
		 */
		
		/*while(this.parent.blob.fieldSize.w > px) {
		 px++;
		 this.moves.push(2);
		}/**/
		
		
		
		this.moves.push(5);
		//this.moves.push(6);
		
		//////console.log(this.parent.player, this.parent)
		/*let obj = {
		 grid: JSON.parse(JSON.stringify(grid)),
		 b2b: b2b,
		 preset: this.ai,
		 pieceSet: temp,
		 isWarning: false,
		 width: 10,
		 height: 40,
		 hiddenHeight: 20,
		 visibleHeight: 20,
		 combo: this.parent.block.combo,
		 isEnable180: true,
		 piecesCount: 1,
		 tFulfill: this.ai.tspinDetected.tFulfill || [],
		 tPrevent: this.ai.tspinDetected.tPrevent || [],
		 tLines: this.ai.tspinDetected.tLines || [],
		 tAvoidColumn: this.ai.tspinDetected.tAvoidColumn || [],
		};



		this.moves = [];

		let args = [active, hold, next, obj, px, py, hx, hy, prot];
		let best = await this.postToCore(args);
		this.moves = best.move;
		this.ai.tspinDetected.tLines = best.tl;
		this.ai.tspinDetected.tAvoidColumn = best.ta;
		this.ai.tspinDetected.tPrevent = best.tp;
		this.ai.tspinDetected.tFulfill = best.tf;

		for (let v = 0, len = this.moves.length; v < len; v++) {

		}/**/
	}
	
	#blobTranslate(c, d, t) {
		let ma = [
			[
				[
					[0, 0, 0],
					[c, d, 0],
					[0, 0, 0]
				],
				[
					[0, 0, 0],
					[0, d, 0],
					[0, c, 0]
				],
				[
					[0, 0, 0],
					[0, d, c],
					[0, 0, 0]
				],
				[
					[0, c, 0],
					[0, d, 0],
					[0, 0, 0]
				]
			],
			[
				[
					[0, 0, 0],
					[c, d, 0],
					[0, d, 0]
				],
				[
					[0, 0, 0],
					[0, d, d],
					[0, c, 0]
				],
				[
					[0, d, 0],
					[0, d, c],
					[0, 0, 0]
				],
				[
					[0, c, 0],
					[d, d, 0],
					[0, 0, 0]
				]
			],
			[
				[
					[0, 0, 0],
					[d, d, 0],
					[0, c, 0]
				],
				[
					[0, 0, 0],
					[0, d, c],
					[0, d, 0]
				],
				[
					[0, c, 0],
					[0, d, d],
					[0, 0, 0]
				],
				[
					[0, d, 0],
					[c, d, 0],
					[0, 0, 0]
				]
			],
			[
				[
					[0, 0, 0],
					[c, c, 0],
					[d, d, 0]
				],
				[
					[0, 0, 0],
					[c, d, 0],
					[c, d, 0]
				],
				[
					[0, 0, 0],
					[d, d, 0],
					[c, c, 0]
				],
				[
					[0, 0, 0],
					[d, c, 0],
					[d, c, 0]
				]
			],
			[
				[
					[0, 0, 0],
					[d, d, 0],
					[d, d, 0],
				],
				[
					[0, 0, 0],
					[d, d, 0],
					[d, d, 0],
				],
				[
					[0, 0, 0],
					[d, d, 0],
					[d, d, 0],
				],
				[
					[0, 0, 0],
					[d, d, 0],
					[d, d, 0],
				]
			]
		][t];
		return ma;
	}
	
}


class NeoplexStaticFrenzyAI {
	//Sapphirus AI
	#core = 0;
	constructor(parent, name, text) {
		this.parent = parent;
		this.delayReset = 10;
		this.moves = [];
		this.active = false;
		this.pressStr = 0;
		this.pressLast = 0;
		this.pieceDelay = 0;
		this.ai = {
			controlImg: {
				x: 0,
				y: 0,
				rot: 0,
				hold: 0
			},
			rotations: [
				[0],
				[
					1, 1, 1, 1
				],
				[
					2, 2, 2, 2
				]
			],
			
			enableTspin: false,
			grid: [],
			ppsLimit: 289,
			
			extraMovements: [],
			x: 0,
			y: 0,
			rot: 0,
			matrix: [],
			heuristicsWeight: {
				aggHeight: -0.0000510066,
				bump: -0.184483,
				lines: 0.1760666,
				holes: -41.0000300044,
				blockade: -0.0666,
				failedTspin: -994.0,
				failedWide: -0,
				b2b: 0.75,
				possibleSpin: 0.202
			},
			failedWide: 0,
			tspinDetector: {
				tslot: [
					[0, 1],
					[1, 1],
					[2, 1],
					[1, 2]
				],
				bottom: [
					[0, 2],
					[2, 2] /*, [-1, 1], [3, 1]*/
				],
				tuck: [
					[0, 0, [
						[1, 0],
						[2, 0]
					]],
					[2, 0, [
						[0, 0],
						[1, 0]
					]]
				],
			},
			tspinHeight: 5,
			flag: {
				LEFT: 1,
				RIGHT: 2,
				SOFTDROP: 4,
				HARDDROP: 8,
				HOLD: 16,
				CW: 32,
				CCW: 64,
				C180W: 128,
			},
			
			tspinDetected: {
				tslot: [],
				bottom: [],
				tuck: [],
				
				tLines: [],
				tBlock: [],
				tSlot: [],
				tAvoidColumn: []
				
				
			}
		};
		
		
	}
	
	engageWorker() {
		multithread.engageWorker(this.name, this.text, (a) => {
			this.#core = a.worker;
			this.#core.onerror = (e) => {
				//////console.log(e)
				console.warn(e.message, e.colno, e.lineno)
			}
		});
	}
	
	loadFrenzyMovements(file) {
		
	}
	
	run(a) {
		this.pressStr = "";
		let isTooMuchChain = false;
		game.forEachPlayer(player => {
			if (player.blob.forecastedChain > 5) isTooMuchChain = true;
		});
		
		
		if (this.pieceDelay < 0) {
			
			this.pieceDelay = Math.random() * 10 + 0;
			
			if (isTooMuchChain) {
				//h = 8;
				//this.moves.push(88);
				this.pieceDelay = 0;
			}
			if (false) {
				this.pressStr = "Dd";
			} else if (this.ai.extraMovements.length > 0 && this.parent.block.frenzy.isOn) {
				
				let isSoftDrop = 0;
				let j = {
					1: "Aa",
					2: "Bb",
					3: "C",
					4: "Dd",
					5: "Ee",
					6: "Gg",
					7: "Ff",
					8: "Hh"
				}
				let h = this.ai.extraMovements[0];
				
				if (!this.parent.flagPresses.softdrop) this.pressStr += j[h];
				if (h == 4) {
					if (this.parent.block.checkValid(this.parent.block.piece.activeArr, 0, 1)) {
						this.pieceDelay = -999;
						isSoftDrop = 1;
						
					} else {
						this.pieceDelay = -999;
						this.pressStr += "c";
					}
				}
				if (!isSoftDrop) this.ai.extraMovements.shift();
				
			}
			
			else
				for (let g = 0; g < this.moves.length; g++) {
					let j = {
						1: "Aa",
						2: "Bb",
						4: "C",
						8: "Dd",
						16: "Ee",
						32: "Gg",
						64: "Ff",
						128: "Hh"
					}
					let h = this.moves[g];
					
					if (!this.parent.flagPresses.softdrop) this.pressStr += j[h];
					if (h == 4) {
						if (this.parent.block.checkValid(this.parent.block.piece.activeArr, 0, 1)) {
							break;
							this.pieceDelay = -999;
						} else {
							this.pieceDelay = -999;
							this.pressStr += "c";
						}
					}
					this.moves.shift();
					g--;
					break;
				}
		}
		this.pieceDelay--;
	}
	
	postToCore(jsobj) {
		try {
			this.#core.postMessage(jsobj);
		} catch (e) {
			//////console.log(e);
		}
		
		return new Promise((res) => {
			this.#core.addEventListener("message", (te) => {
				res(te.data);
			}, { once: true });
		});
	}
	
	
	async evaluate(active, hold, isHeld, next, b2b, combo, grid, hx, hy, px, py, prot, temp) {
		if (isHeld) return;
		//////console.log(this.parent.player, this.parent)
		let obj = {
			grid: JSON.parse(JSON.stringify(grid)),
			b2b: b2b,
			preset: this.ai,
			pieceSet: temp,
			isWarning: false,
			width: 10,
			height: 40,
			hiddenHeight: 20,
			visibleHeight: 20,
			combo: this.parent.block.combo,
			isEnable180: false,
			piecesCount: 1,
			tFulfill: this.ai.tspinDetected.tFulfill || [],
			tPrevent: this.ai.tspinDetected.tPrevent || [],
			tLines: this.ai.tspinDetected.tLines || [],
			tAvoidColumn: this.ai.tspinDetected.tAvoidColumn || [],
		};
		
		
		
		this.moves = [];
		
		let args = [active, hold, next, obj, px, py, hx, hy, prot];
		let best = await this.postToCore(args);
		this.moves = best.move;
		this.ai.tspinDetected.tLines = best.tl;
		this.ai.tspinDetected.tAvoidColumn = best.ta;
		this.ai.tspinDetected.tPrevent = best.tp;
		this.ai.tspinDetected.tFulfill = best.tf;
		
		for (let v = 0, len = this.moves.length; v < len; v++) {
			
		}
	}
}

class ArtificialIntelligenceRPG {
	constructor(par) {
		this.a = par;
		this.skillTime = 0;
		this.pressStr = 0;
	}
	run() {
		if (this.pressStr > 0) {
			this.pressStr = 0;
			this.moves.shift();
			return;
		}
		if (this.a.rpgAttr.isOn && this.a.rpgAttr.isRPG && this.a.rpgAttr.isUsableSkills) {
			let a = this.a, //destructuring syntax for assignment? naah gonna go for the basic syntax...
				b = a.rpgAttr;
			
			if (this.skillTime <= 0) {
				do {
					this.skillTime = 5;
					if ((b.hp / b.maxHP) < 0.3) {
						////console.log("lowhp")
						if (this.useSkill(["immunity", "healing"]))
							break;
					}
					if (((b.hpDamage) / b.hp) > 0.3) {
						if (this.useSkill(["absorption", "defup"]))
							break;
					}
					if (a.activeType == 0 && ((a.block.stackAltitude - a.block.fieldSize.hh) / a.block.fieldSize.vh) < 0.355) {
						if (this.useSkill(["avalanche", "lineclear"]))
							break;
					}
					this.skillTime = 50;
				} while (false);
				
			} else this.skillTime--;
		}
	}
	useSkill(desc) {
		let a = this.a.rpgAttr,
			b = a.deck.characters;
		for (let x = 0; x < 3; x++) {
			let r = b[x];
			if (r.skill.mana > a.mana || r.skill.cooldown > 0) continue;
			for (let j of desc)
				if (r.skill.rawDesc.indexOf(j) !== -1) {
					this.pressStr |= game.bitFlags[`s${x+1}`];
					return true;
				}
		}
		return false;
	}
	useSkillWithExclusion(excludeDesc) {
		let a = this.a.rpgAttr,
			b = a.deck.characters;
		for (let x = 0; x < 3; x++) {
			let r = b[x];
			
			if (r.skill.mana > a.mana || r.skill.cooldown > 0) continue;
			for (let j of excludeDesc)
				if (r.skill.rawDesc.indexOf(j) === -1) {
					this.pressStr |= game.bitFlags[`s${x+1}`];
					return true;
				}
		}
		return false;
	}
}

//fileLayer: music
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

//fileLayer: sound
const sound = new class {
	constructor() {
		this.sounds = {};
		this.isReady = true;
		this.soundNames = {};
		this.volume = 100;
		this.bytes = 0;
	}
	load(filename, required) {
		/*return new Promise((res=> {
			res();
		}))*/
		let direct = `/assets/sounds/game/${filename}/init.json`;
		this.isReady = false;
		return new Promise(async (res, rej) => {
			if (direct in this.soundNames) {
				res();
				this.isReady = true;
				return;
			}
			let loaded = 0;
			let loadLength = 0;
			let a = JSON.parse(await load(direct, "text"));
			this.soundNames[direct] = a;
			let storage = {};
			let sounds = [];
			let soundInits = {};
			//for (let o in a.)
			
			for (let b in a.sounds) {
				let mref = a.sounds[b];
				let reference = a.sources.main[mref.src];
				sounds.push({
					name: b,
					src: `/assets/sounds/game/${filename}/${reference}`,
					loop: mref.loop
				});
				loadLength++;
				//////console.log(reference);
				//storage[b] = await load(`/assets/sounds/game/${filename}/${reference}`, "blob");
			}
			for (let b = 1; b <= a.sources.chain.count; b++) {
				
				let reference = a.sources.chain.src;
				let directory = `/assets/sounds/game/${filename}/${reference}${b}.${a.sources.chain.filetype}`;
				sounds.push({
					name: a.sources.chain.name + b,
					src: directory,
					loop: false
				});
				//////console.log(reference);
				loadLength++;
			}
			
			if ("swapcombo" in a.sources)
				for (let b = 1; b <= a.sources.swapcombo.count; b++) {
					let reference = a.sources.swapcombo.src;
					let directory = `/assets/sounds/game/${filename}/${reference}${b}.${a.sources.swapcombo.filetype}`;
					sounds.push({
						name: a.sources.swapcombo.name + b,
						src: directory,
						loop: false
					});
					//////console.log(reference);
					loadLength++;
					
				}
			
			for (let b of sounds) {
				
				
				//let reference = sounds[b];
				//this.bytes += storage[reference.src].size;
				/*memoryManager.syncLoad(b.src, "blob", (aa) => {
					let blob = URL.createObjectURL(aa);
					this.sounds[b.name] = new MainHowler.Howl({
						src: blob,
						format: "ogg",
						loop: b.loop,
						preload: false
					});
					
					this.sounds[b.name].load();
					this.sounds[b.name].once("load", () => {
						URL.revokeObjectURL(blob);
					});
					
					
					loaded++;
					if (loaded >= loadLength) {
						this.isReady = true;
						this.volumeSet(this.volume);
						////console.log(this.bytes / (1024*1024))
						res();
					}
				});
				/**/
			this.sounds[b.name] = audioMaster.createAudio({
					src: b.src,
					loop: b.loop,
				});
				
				//Todo save memory 
				this.sounds[b.name] .load().then(sh => {
					loaded++;
					if (loaded >= loadLength) {
						this.isReady = true;
						this.volumeSet(this.volume);
						////console.log(this.bytes / (1024*1024))
						res();
					}
				});
				/**/
				
			}
			
			
			
			
			
			
		});
	}
	
	stop(str) {
		if (str in this.sounds) {
			this.sounds[str].stop();
			
		}
	}
	
	getSound(str) {
		return this.sounds[str] || new GTRISNoSoundObject();
	}
	
	play(str) {
		let id = 0;
		if (str in this.sounds) {
			//this.sounds[str].stop();
			////console.log(this.sounds[str]._sounds.length)
			id = (this.sounds[str].play());
			
		}
		return id;
	}
	
	rate(str, value) {
		if (str in this.sounds) {
			//this.sounds[str].stop();
			
			this.sounds[str].rate(value !== void 0 ? value : 1);
			//////console.log(this.sounds[str])
		}
	}
	
	volumeSet(value) {
		this.volume = value;
		for (let str in this.sounds) {
			//this.sounds[str].stop();
			
			this.sounds[str].volume(value / 100);
			//////console.log(this.sounds[str])
		}
	}
}();


class GTRISSoundObject {
	constructor(obj) {
		this.doc = document.createElement("audio");
		this._volume = obj.volume || 0;
		this._loop = obj.loop || false;
		this._src = obj.src || "";
		this.doc.src = this._src;
		this.doc.volume = this._volume;
		this.doc.loop = this._loop;
		if (obj.preload) this.doc.load();
	}
	load() {
		this.doc.load();
	}
	play(seek) {
		this.doc.currentTime = seek || 0;
		this.doc.play()
			.catch(e => {
				console.error(`GTRISSoundObject object with the source destination "${this._src}" cannot play a non-existent sound file.`);
			});
	};
	stop() {
		this.doc.pause();
	}
	once(evt, func) {
		this.doc.addEventListener(evt, func, { once: true });
	}
	volume(v) {
		this._volume = v;
		this.doc.volume = v;
	}
	rate(e) {}
	stereo() {
		
	}
}
class GTRISNoSoundObject {
	constructor(obj) {
		this.doc = 0;
		this._volume = obj.volume || 0;
		this._loop = obj.loop || false;
		this._src = obj.src || "";
		this.doc.src = this._src;
		this.doc.volume = this._volume;
		this.doc.loop = this._loop;
	}
	load() {
		
	}
	play(seek) {
		
	};
	stop() {
		
	}
	once(evt, func) {
		
	}
	volume(v) {
		
	}
	rate(e) {}
	stereo() {
		
	}
}

__main_params__.__private.sound = sound;

//fileLayer: player
class MainPlayerFragment {
 
 DEFAULT_CHAIN_POWER_PRESET = JSON.parse(JSON.stringify(TSU_CHAIN_POWER));
 
 DEFAULT_CHAIN_FEVER_POWER_PRESET = [0, 6, 10, 16, 23, 32, 44, 63, 74, 97, 120, 157, 176, 211, 244, 281, 315, 351, 416, 473, 542, 604, 644, 681];
 
 DEFAULT_DROPSET = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
 
 DEFAULT_SPELL_SEQUENCE = JSON.stringify(CHAIN_SEQUENCE);
 
 static DEFAULT_HENSHIN_SPELL_SEQUENCE = [
  "t_count1",
  "t_count2",
  "t_count3",
  "t_count4",
  "t_count5",
  "t_count6",
  "t_count7",
  "init1",
  "init2",
  "init3",
  "init4",
  "init5",
  "spell1",
  "spell2",
  "spell3",
  "spell4",
  "spell5",
  "t_small",
  "t_small",
  "t_small",
  "t_small",
  
 ];
 
 constructor(player, n) {
  this.player = player;
  let regex = /PNUMBER/gm;
  this.assetHTML = manager.assetHTML.replace(regex, "P" + this.player);
  this.assetStyle = manager.assetStyle.replace(regex, "P" + this.player);
  this.htmlElements = [];
  this.soundActive = true;
  this.particleGarbageDelay = 25;
  this.team = Math.random();
  this.isPhylum = false;
  
  this.name = "No name";
  
  this.wins = 0;
  
  this.playerCenterPos = {
   x: 0,
   y: 0,
  }
  
  this.isVisible = true;
  this.score = 0;
  this.addScoreText = "";
  this.scoreText = new NumberChangeFuncExec(0, (m) => {
   this.editIH("STATS-SCORE-TEXT", m);
  });
  
  this.animationLayerElements = [];
  
  this.fieldSize = {
   w: 10,
   h: 40,
   vh: 20,
   hh: 22
  };
  
  this.rectanim = new RectangularAnimations(this);
  this.rpgAttr = new RPGAttributes(this);
  
  this.visibleFieldBufferHeight = 5;
  this.visibleFieldHeight = 0;
  
  this.character = {
   current: 0,
   canvas: void 0,
   ctx: void 0,
   active: false,
   voices: {},
   voiceActive: "",
   voiceID: -1,
   activeVoiceline: "",
   load: false,
   defaultAttributes: {
    "hp": 300,
    "def": 100,
    "atk": 10,
    "mp": 50,
    "lifesteal": 0.0,
    "atktol": 13,
    "hpregen": 3,
    "hpregentol": 1,
    "hpregentime": 40,
   },
   attributes: {
    "hp": 300,
    "def": 100,
    "atk": 10,
    "mp": 50,
    "lifesteal": 0.0,
    "atktol": 13,
    "hpregen": 3,
    "hpregentol": 1,
    "hpregentime": 40,
   },
   isUniqueVoicePlay: false,
   
   blob: {
    chainPower: JSON.parse(JSON.stringify(this.DEFAULT_CHAIN_POWER_PRESET)),
    feverPower: JSON.parse(JSON.stringify(this.DEFAULT_CHAIN_FEVER_POWER_PRESET)),
    dropset: JSON.parse(JSON.stringify(this.DEFAULT_DROPSET)),
   },
   isCounting: false,
   
   char: null,
   ver: null,
   jsonString: null,
   loadable: false,
   jsonLoaded: false,
   json: {},
   
  };
  elem("CANVAS", canvas => {
   canvas.width = (600 * 5);
   canvas.height = 600 * 5;
   this.character.canvas = canvas;
   let ctx = canvas.getContext("2d");
   this.character.ctx = ctx;
  });
  this.meterBar = {
   right: new MeterBar(),
   garbwait: new MultipleMeterBar(3)
  };
  
  this.color = {
   r: 0,
   g: 0,
   b: 0
  }
  
  this.seeds = {
   field: new ParkMillerPRNG(),
  };
  this.pressStr = "";
  this.lastPressStr = "";
  
  this.cellSize = 0;
  this.fieldCellSize = 0;
  
  this.clearText = {
   tspin: new GIFRenderer(8640, 180, 180, 180, 1, (a, canv, x, y, w, h, frame, that) => {
    let b = a.canvas;
    a.clearRect(0, 0, b.width, b.height);
    a.drawImage(canv, x * w, y * h, w, h, 0, 0, w, h);
    that.frame.x++;
    that.frameCount++;
    
    if (frame >= 48) that.enabled = false;
    if (frame == 42) this.clearText.tspinLine.assign(0);
   }, (frame) => {
    this.setStyle("CLEARTEXT-CANVTEXT", "animation-delay", `${~~((1000 / -60) * (frame))}ms`);
   }),
   tspinLine: new NumberChangeFuncExec(false, (state) => {
    let e = "CLEARTEXT-TSPIN-LINE";
    let element = this.getAsset(e);
    this.setStyle(e, "animation", "none");
    element.offsetHeight;
    if (state == 1) {
     this.setStyle(e, "opacity", "100%");
     this.setStyle(e, "animation", "fade-in 200ms 1 linear");
    } else if (state == 2) {
     this.setStyle(e, "opacity", "0%");
    } else if (state == 0) {
     this.setStyle(e, "animation", "fade-out 300ms 1 linear");
     this.setStyle(e, "opacity", "0%");
    }
   }),
   b2b: new NumberChangeFuncExec(false, (state) => {
    let e = "CLEARTEXT-TEXT-B2B";
    let element = this.getAsset(e);
    this.setStyle(e, "animation", "none");
    element.offsetHeight;
    if (state == 1) {
     this.setStyle(e, "opacity", "100%");
     this.setStyle(e, "animation-name", "ct-anim-nofadeout");
     this.setStyle(e, "animation-duration", `${~~((1000 / 60) * (60 + 60))}ms`);
     this.setStyle(e, "animation-timing-function", "ease-out");
     this.setStyle(e, "animation-play-state", "paused");
     this.clearTextRenderers.b2b.reset(0);
    } else if (state == 2) {
     this.setStyle(e, "opacity", "100%");
     this.clearTextRenderers.b2b.toggleEnable(false);
    } else if (state == 0) {
     this.clearTextRenderers.b2b.toggleEnable(false);
     this.setStyle(e, "opacity", "0%");
    }
   }),
   combo: new NumberChangeFuncExec(false, (state) => {
    let e = "CLEARTEXT-TEXT-COMBO";
    let element = this.getAsset(e);
    //this.setStyle(e, "animation", "none");
    //element.offsetHeight;
    if (state == 1) {
     this.setStyle(e, "opacity", "100%");
     this.stopAnimation("ctComboClose");
     this.playAnimation("ctComboOpen");
    } else if (state == 2) {
     this.setStyle(e, "opacity", "0%");
     this.stopAnimation("ctComboOpen");
     this.stopAnimation("ctComboClose");
    } else if (state == 0) {
     
     this.setStyle(e, "opacity", "0%");
     this.stopAnimation("ctComboOpen");
     this.playAnimation("ctComboClose");
     
    }
   }),
   
   line: new NumberChangeFuncExec(false, (state) => {
    let e = "CLEARTEXT-TEXT-LINE";
    let element = this.getAsset(e);
    this.setStyle(e, "animation", "none");
    element.offsetHeight;
    if (state == 1) {
     this.setStyle(e, "opacity", "0%");
     this.setStyle(e, "animation-name", "ct-anim");
     this.setStyle(e, "animation-duration", `${~~((1000 / 60) * (60 + 60))}ms`);
     this.setStyle(e, "animation-timing-function", "ease-out");
     this.setStyle(e, "animation-play-state", "paused!important");
     this.clearTextRenderers.line.reset(0);
    } else if (state == 0) {
     this.clearTextRenderers.line.toggleEnable(false);
     this.setStyle(e, "opacity", "0%");
    }
   }),
   spin: new NumberChangeFuncExec(false, (state) => {
    let e = "CLEARTEXT-TEXT-SPIN";
    let element = this.getAsset(e);
    this.setStyle(e, "animation", "none");
    element.offsetHeight;
    if (state == 1) {
     this.setStyle(e, "opacity", "0%");
     this.setStyle(e, "animation-name", "ct-anim");
     this.setStyle(e, "animation-duration", `${~~((1000 / 60) * (60 + 60))}ms`);
     this.setStyle(e, "animation-timing-function", "ease-out");
     this.setStyle(e, "animation-play-state", "paused!important");
     this.clearTextRenderers.spin.reset(0);
    } else if (state == 0) {
     this.clearTextRenderers.spin.toggleEnable(false);
     this.setStyle(e, "opacity", "0%");
    }
   }),
  };
  
  this.clearTextRenderers = {
   b2b: new FrameRenderer(0, 120, (frame) => {
    this.setStyle("CLEARTEXT-TEXT-B2B", "animation-delay", `${~~((1000 / -60) * (frame))}ms`);
   }),
   line: new FrameRenderer(0, 120, (frame) => {
    this.setStyle("CLEARTEXT-TEXT-LINE", "animation-delay", `${~~((1000 / -60) * (frame))}ms`);
   }),
   spin: new FrameRenderer(0, 120, (frame) => {
    this.setStyle("CLEARTEXT-TEXT-SPIN", "animation-delay", `${~~((1000 / -60) * (frame))}ms`);
   }),
  };
  
  this.clearTextAFR = {
   
  };
  
  this.canvasTemplate = {
   character: "FIELD-CHARACTER",
   insane: "FIELD-INSANE",
   stack: "FIELD-STACK",
   piece: "FIELD-PIECE",
   hold: "HOLD",
   next: "NEXT",
   back: "FIELD-BACK",
   blobNext: "BLOB-NEXT",
   playchar: "PLAYCHAR",
   rectanim: "RECTANIM",
   tspin: "CLEARTEXT-TSPIN",
   garbageTray: "GARBAGE-TRAY",
   garbageTrayBehind: "GARBAGE-TRAY-BEHIND",
   hpmeter: "HP-METER",
   feverGauge: "FEVER-GAUGE",
   rpgDeck: "RPG-DECK",
   team: "TEAM",
   characterAux: "AUX-FIELD-CHARACTER",
   backAux: "AUX-FIELD-BACK",
   insaneAux: "AUX-FIELD-INSANE",
   stackAux: "AUX-FIELD-STACK",
   pieceAux: "AUX-FIELD-PIECE",
  };
  this.canvasses = {};
  this.canvasCtx = {};
  
  this.fieldAnimations = {};
  
  this.playcharExt = {
   active: "insane",
   animname: [],
   anim: {},
   positions: {
    insane: [0, 0],
    transf: [1, 0],
    transfmic: [2, 0],
    transfmac: [3, 0],
    tfmicspell1: [0, 1],
    tfmicspell2: [1, 1],
    tfmicspell3: [2, 1],
    tfmicspell4: [3, 1],
   }
  };
  this.currentAI = "";
  this.ai = new NoAI(this);
  //this.aiBlob = new NeoplexBlobArtificialIntelligence(this, `PLAYERBLOB${this.player}`, manager.misc.ai_blob_original, manager.misc.ai_blob_functions);
  //this.aiFrenzy = new NeoplexStaticFrenzyAI(this, `STATICPLAYER${this.player}`, manager.misc.ai_frenzy)
  this.aiBlob = new NoAI(this);
  this.aiRPG = new ArtificialIntelligenceRPG(this);
  
  this.unfreezableFieldAnimations = {};
  this.namesUFA = [];
  
  this.isLosePlayed = false;
  // lose, win, nope, nope, nope
  this.delay = [-9];
  
  
  this.delayKeynamesCount = this.delay.length;
  
  this.animationElements = {};
  this.animationExistingElements = [];
  this.animationTriggerEvents = {};
  this.animationPaths = {};
 }
 
 setAI(name) {
  if (this.currentAI !== name) {
   this.currentAI = name;
   let abk = this.ai.active;
   let abb = this.aiBlob.active;
   
   
   let g;
   switch (name) {
    case "neoplexus": {
     g = {
      block: new NeoplexArtificialIntelligence(this, `PLAYER${this.player}`, manager.misc.ai_original),
      blob: new Neoplex2BlobArtificialIntelligence(this, `PLAYERBLOB${this.player}`, manager.misc.ai_blob_sapphirus, manager.misc.ai_blob_functions)
     };
     break;
    }
    case "normal": {
     g = {
      blob: new Neoplex2BlobArtificialIntelligence(this, `PLAYERBLOB${this.player}`, manager.misc.ai_blob_sapphirus, manager.misc.ai_blob_functions),
      block: new ArtificialIntelligence(this, `PLAYER${this.player}`, manager.misc.ai)
     };
     break;
    }
   }
   
   this.ai = g.block;
   this.aiBlob = g.blob;
   this.ai.engageWorker();
   this.aiBlob.engageWorker();
   this.ai.active = abk;
   this.aiBlob.active = abb;
  }
 }
 
 playSound(str) {
  if (this.soundActive) {
   let id = sound.play(str);
   let m = sound.getSound(str);
   //m.stereo(this.player % 2 == 1 ? 1 : -1, id);
  }
 }
 
 playVoice(a) {
  if (!this.isVisible || !this.soundActive || !(a in this.character.voices)) return;
  /*for (let b in this.character.voices) {
  	this.character.voices[b].stopVoice();
  }*/
  if (this.character.isUniqueVoicePlay && this.character.voices[a].checkPlay()) return /**/
  if (this.character.voiceActive in this.character.voices) {
   let km = this.character.voices[this.character.voiceActive].getVoice();
   km.stop(this.character.voiceID);
  }
  this.character.voiceActive = a;
  
  let id = this.character.voices[a].playVoice();
  let m = this.character.voices[a].getVoice();
  if (!m) return;
  this.character.voiceID = id;
  //m.stereo(1 * (this.player % 2 == 0 ? -1 : 1), id);
 }
 
 removeVoices() {
  //playerVoiceSystem.removePlayerVoices();
  for (let a in this.character.voices) delete this.character.voices[a]
 }
 
 getVoiceDuration(a) {
  if (!this.isVisible || !this.soundActive || !(a in this.character.voices)) return 0;
  
  /*if (!this.character.voices[a].checkPlay()) /**/
  return this.character.voices[a].duration();
 }
 
 checkVoicePlaying(a) {
  if (!this.isVisible || !this.soundActive || !(a in this.character.voices)) return false;
  
  /*if (!this.character.voices[a].checkPlay()) /**/
  return this.character.voices[a].checkPlay();
 }
 
 addDelayHandler(requiresVisibility, delay, func, isContinuous) {
  if (!(this.isVisible) && (requiresVisibility)) return;
  if (isContinuous) game.addDelayHandler(delay, func, isContinuous);
  else game.addDelayHandler(delay, func);
 }
 
 affixIDName(name) {
  return `P${this.player}-${name}`;
 }
 
 editIH(name, value) {
  //////console.log(this.getAsset(name))
  ihelem(this.getAsset(name), value);
 }
 
 assetRect(name) {
  return this.getAsset(name).getBoundingClientRect();
  //HTMLElement.prototype.getBoundingClientRect;
 }
 
 addParticle(requireVisibility, imgRef, spriteRow, spriteCell, startX, startY, endX, endY, duration, size, clr, bez, trail, topt, rotopt) {
  if (requireVisibility && !this.isVisible) return false;
  particle.addParticle(game.cellSize, imgRef, spriteRow, spriteCell, startX, startY, endX, endY, duration, size, clr, bez, trail, topt, rotopt);
 }
 
 addBasicParticle(requireVisibility, startX, startY, endX, endY, duration, size, clr, bez, trail, topt, rotopt) {
  if (requireVisibility && !this.isVisible) return false;
  particle.addBasicParticle(game.cellSize, startX, startY, endX, endY, duration, size, clr, bez, trail, topt, rotopt);
 }
 
 drawActivePlaycharExt(mx) {
  this.canvasClear("playchar");
  let x = mx || this.playcharExt.positions[this.playcharExt.active];
  //////console.log(x)
  this.canvasCtx.playchar.drawImage(
   this.character.canvas,
   x[0] * 600,
   600 * (x[1] + 1),
   600,
   600,
   0,
   0,
   600,
   600
  );
 }
 
 setActivePlaycharExt(m) {
  this.playcharExt.active = m;
  if (this.isVisible) this.drawActivePlaycharExt(this.playcharExt.positions[m]);
 }
 
 runDelay() {
  for (let a = 0; a < this.delayKeynamesCount; a++) {
   if (this.delay[a] >= 0) this.delay[a]--;
   //if (this.delay[a] == 0) this.delay[a] = -20;
  }
  
  if (this.delay[0] == 0) { //lose
   this.playVoice("lose");
   this.engagePlaycharExt("result");
   this.editIH("PLAYCHAR-TEXT", language.translate("result_lose"));
   this.isLosePlayed = true;
   this.playEmAnimation("lose");
  }
 }
 
 getAsset(_id) {
  if (_id in this.htmlElements) return this.htmlElements[this.affixIDName(_id)];
  return id(this.affixIDName(_id));
 }
 
 setStyle(name, prop, val) {
  //////console.log(name)
  styleelem(this.getAsset(name), prop, val);
 }
 styleVariable(name, prop, val) {
  //////console.log(name)
  stylepropelem(this.getAsset(name), `--${prop}`, val);
 }
 storeElementsToMemory() {
  this.htmlElements = {};
  this.htmlElements[this.affixIDName("AREA")] = id(`P${this.player}-AREA`);
  for (let y of id(`P${this.player}-AREA`).getElementsByTagName("*")) {
   let { id } = y;
   this.htmlElements[id] = y;
  }
  
  for (let canvas in this.canvasTemplate) {
   this.canvasses[canvas] = this.getAsset(`${this.canvasTemplate[canvas]}-CANVAS`);
   this.canvasCtx[canvas] = this.canvasses[canvas].getContext("2d");
  }
  
  this.fieldAnimations = {
   ctComboOpen: new AnimationFrameRenderer(this.getAsset("CLEARTEXT-TEXT-COMBO"), 0, 25, 1000 / 60, {
    name: "cleartext-animation-combo-open",
    timing: "cubic-bezier(0, 0, 1,1)",
   }),
   
   ctComboClose: new AnimationFrameRenderer(this.getAsset("CLEARTEXT-TEXT-COMBO"), 0, 25, 1000 / 60, {
    name: "cleartext-animation-combo-close",
    timing: "cubic-bezier(0, 0, 1,1)",
   }),
   
   
   fieldDown: new AnimationFrameRenderer(this.getAsset("WHOLE"), 0, 70, 1000 / 60, {
    name: "board-fall",
    timing: "cubic-bezier(0,0,1,0)",
   }),
   fieldStomp: new AnimationFrameRenderer(this.getAsset("STOMP-WHOLE"), 0, 70, 1000 / 60, {
    name: "board-stomp",
    timing: "cubic-bezier(0,0,1,0)",
   }),
   fieldDownAux: new AnimationFrameRenderer(this.getAsset("AUX-WHOLE"), 0, 70, 1000 / 60, {
    name: "board-fall",
    timing: "cubic-bezier(0,0,1,0)",
   }),
   fieldDownDelayed: new AnimationFrameRenderer(this.getAsset("WHOLE"), 0, 70, 1000 / 60, {
    name: "board-fall",
    timing: "cubic-bezier(0,0,1,0)",
    delay: 30,
   }),
   
   fieldShake: new AnimationFrameRenderer(this.getAsset("WHOLE"), 0, 15, 1000 / 60, {
    name: "field-shake",
    timing: "linear",
    loop: true,
   }),
   
   fieldFinisherFinalBlow1: new AnimationFrameRenderer(this.getAsset("ROTATING-WHOLE"), 0, 70, 1000 / 60, {
    name: "board-fallrot-finisher-chain",
    timing: "cubic-bezier(0,0,1,1)",
   }),
   
   
   fieldFinisherFinalBlow2: new AnimationFrameRenderer(this.getAsset("WHOLE"), 0, 70, 1000 / 60, {
    name: "board-fall-finisher-chain",
    timing: "cubic-bezier(0,-0.3,1,0)",
   }),
   fieldHitFinish: new AnimationFrameRenderer(this.getAsset("WHOLE"), 0, 65, 1000 / 60, {
    name: "board-hit-finish",
    timing: "cubic-bezier(0,1,1,1)",
   }),
   
   fieldWobbleRotate: new AnimationFrameRenderer(this.getAsset("ROTATING-WHOLE"), 0, 30, 1000 / 60, {
    name: `board-rotate-wobble`,
    timing: "cubic-bezier(0,0,1,1)",
   }),
   fieldVerticalSpin: new AnimationFrameRenderer(this.getAsset("ROTATING-WHOLE"), 0, 40, 1000 / 60, {
    name: "board-vertical-spin",
    timing: "linear",
   }),
   shakeUponHit: new AnimationFrameRenderer(this.getAsset("WHOLE"), 0, 65, 1000 / 60, {
    name: "shake-upon-hit",
    timing: "cubic-bezier(0,1,1,1)",
   }),
   shakeWMWHit: new AnimationFrameRenderer(this.getAsset("WHOLE"), 0, 3, 1000 / 60, {
    name: "wormhole-shake-hit",
    timing: "linear",
   }),
   
  };
  
  this.playcharExt.anim = {
   insaneChar: new AnimationFrameRenderer(this.getAsset("PLAYCHAR-CANVAS-DIV"), 0, 50, 1000 / 60, {
    name: "insane-entrance-character",
    timing: "cubic-bezier(0,0,1,1)",
   }),
   insaneText: new AnimationFrameRenderer(this.getAsset("PLAYCHAR-TEXT-DIV"), 0, 50, 1000 / 60, {
    name: "insane-entrance-text",
    timing: "cubic-bezier(0,0,1,1)",
   }),
   transformChar: new AnimationFrameRenderer(this.getAsset("PLAYCHAR-CANVAS-DIV"), 0, 100, 1000 / 60, {
    name: "insane-entrance-character",
    timing: "cubic-bezier(0,0,1,1)",
   }),
   transformCSpell: new AnimationFrameRenderer(this.getAsset("PLAYCHAR-CANVAS-DIV"), 0, 90, 1000 / 60, {
    name: "transformation-spell-character",
    timing: "cubic-bezier(0,0,1,1)",
   }),
   resultText: new AnimationFrameRenderer(this.getAsset("PLAYCHAR-TEXT-DIV"), 0, 20, 1000 / 60, {
    name: "playchar-text-down",
    timing: "cubic-bezier(0,0,1,1)",
   }),
   windeclare: new AnimationFrameRenderer(this.getAsset("PLAYCHAR-TEXT-DIV"), 0, 30, 1000 / 60, {
    name: "stamp-in",
    timing: "cubic-bezier(0,1,0,0)",
   }),
   losedeclare: new AnimationFrameRenderer(this.getAsset("PLAYCHAR-TEXT-DIV"), 0, 15, 1000 / 60, {
    name: "playchar-text-down",
    timing: "cubic-bezier(0,1,0,0)",
   }),
   fadeout: new AnimationFrameRenderer(this.getAsset("PLAYCHAR-TEXT-DIV"), 0, 20, 1000 / 60, {
    name: "fade-out",
    timing: "cubic-bezier(0,0,1,1)",
   }),
  }
  
  this.playcharExt.animname = [];
  for (let mmm in this.playcharExt.anim) {
   this.playcharExt.animname.push(mmm);
  }
  
  this.animFieldNames = [];
  for (let mmm in this.fieldAnimations) {
   this.animFieldNames.push(mmm);
  }
  
  this.unfreezableFieldAnimations.swapMain = new AnimationFrameRenderer(this.getAsset("FIELD-DYNAMIC"), 0, 40, 1000 / 60, {
   name: "plain-translate-scale",
   timing: "cubic-bezier(1,1,0,1)",
  });
  this.unfreezableFieldAnimations.swapAux = new AnimationFrameRenderer(this.getAsset("AUX-FIELD"), 0, 40, 1000 / 60, {
   name: "plain-translate-scale",
   timing: "cubic-bezier(1,0,0,1)",
  });
  
  for (let mmm in this.unfreezableFieldAnimations) {
   this.namesUFA.push(mmm);
  }
  
  this.clearText.tspin.initialize(this.canvasCtx.tspin);
  this.rectanim.fetchCtx(this.canvasCtx.rectanim);
  this.rpgAttr.fetchAsset(this.canvasses.hpmeter, this.canvasCtx.hpmeter, this.getAsset("HP-NUM-TEXT"));
  this.canvasses.team.width = this.canvasses.team.height = 500;
 }
 
 setCanvasSize(c, w, h) {
  this.canvasses[c].width = w;
  this.canvasses[c].height = h;
 }
 
 loadCharacter(char, ver) {
  this.character.char = char;
  this.character.ver = ver;
  let num = `/assets/characters/${char}/${ver}`;
  if (this.character.current !== num) {
   this.character.current = num;
   this.character.active = false;
   this.character.load = false;
   
   this.character.loadable = true;
   this.removeVoices();
   //this.character.isCounting = false;
   
   this.character.ctx.clearRect(0, 0,
    this.character.canvas.width,
    this.character.canvas.height
   );
   
   for (let w = 0; w < 16; w++) {
    this.character.blob.dropset[w] = this.DEFAULT_DROPSET[w];
   }
   
   for (let w = 0; w < 24; w++) {
    this.character.blob.feverPower[w] = this.DEFAULT_CHAIN_FEVER_POWER_PRESET[w];
   }
   
   for (let w = 0; w < 24; w++) {
    this.character.blob.chainPower[w] = this.DEFAULT_CHAIN_POWER_PRESET[w];
   }
   
   this.character.isCounting = false;
   
   this.character.loadedJson = false;
   
   //this.resetEmAnimation();
   
   //let mainDir = num;
   load(`${num}/init.json`).then((jsonString) => {
    //////console.log(jsonString)
    this.character.jsonString = jsonString;
    this.character.loadedJson = true;
    this.character.json = JSON.parse(jsonString);
    
    
   });
   
   return true;
  }
  return false;
 }
 
 cleanAssets() {
  
 }
 
 loadAssets() {
  return new Promise(async (res, rej) => {
   ////console.log(this.rpgAttr)
   
   if (this.rpgAttr.isRPG) {
    ////console.log("RPG MODE ENABLED");
    for (let h = 0; h < 3; h++) {
     let ref = this.rpgAttr.deck.characters[h];
     if (ref.character !== ref.characterLast) {
      ref.characterLast = ref.character;
      ref.isOK = false;
      this.character.loadable = true;
      
     }
     if (ref.version !== ref.versionLast) {
      ref.versionLast = ref.version;
      ref.isOK = false;
      this.character.loadable = true;
     }
    }
   }
   if (!this.character.load && this.character.loadable) {
    let json = (this.character.json);
    let num = `/assets/characters/${this.character.char}/${this.character.ver}`;
    let mainDir = num;
    let storage = {};
    let rawstore = {};
    this.character.loadable = false;
    this.character.active = false;
    
    let voiceURLs = json.sources.voice;
    let imageURLs = json.sources.image;
    let imageMains = json.init.image;
    
    for (let file in imageURLs) {
     let ref = `${mainDir}/${imageURLs[file]}`;
     storage[file] = ref;
    }
    
    for (let file in imageMains) {
     rawstore[`image_${file}`] = await memoryManager.asyncLoad(storage[imageMains[file].src], "image");
    }
    for (let file in json.init.spellImage) {
     rawstore[`image_spell_${file}`] = await memoryManager.asyncLoad(storage[json.init.spellImage[file]], "image");
    }
    
    //////console.log(num, rawstore)
    
    let ysh = ["normal", "warning"];
    
    for (let flf = 0; flf < ysh.length; flf++) {
     let ym = ysh[flf];
     this.character.ctx.drawImage(rawstore[`image_${ym}`], 300 * flf, 0, 300, 600);
    }
    
    
    /*let normal = await loadImage(storage.image_normal);
    let warning = await loadImage(storage.image_warning);*/
    /*let insane = await loadImage(storage.image_fever);
    
    let transf = await loadImage(storage.image_transform);
    let transfmic = await loadImage(storage.image_transform_micro);*/
    let hh = Object.keys(this.playcharExt.positions);
    for (let fll = 0; fll < hh.length; fll++) {
     if (hh[fll] in imageMains) {
      let ym = this.playcharExt.positions[hh[fll]];
      //let tr = await loadImage(storage[hh[fll]]);
      //////console.log(hh[fll], rawstore[hh[fll]])
      this.character.ctx.drawImage(rawstore[`image_${hh[fll]}`], 600 * ym[0], 600 * (1 + ym[1]), 600, 600);
      
      
     }
    }
    
    if ("main" in json.init) {
     /*for (let mas in this.character.attributes)
     	if (mas in json.init.main.attributes) {
     		this.character.attributes[mas] = json.init.main.attributes[mas];
     	} else this.character.attributes[mas] = this.character.defaultAttributes[mas];*/
     if ("ai" in json.init.main) {
      this.setAI(json.init.main.ai);
     } else {
      this.setAI("normal");
     }
     
     
     if ("uniqueVoicePlay" in json.init.main) {
      this.character.isUniqueVoicePlay = json.init.main.uniqueVoicePlay;
     } else {
      this.character.isUniqueVoicePlay = false;
     }
     
     
     if ("chainPower" in json.init.main) {
      for (let w = 0; w < 24; w++) {
       this.character.blob.chainPower[w] = json.init.main.chainPower[w];
       if (json.init.main.chainPower[w] === null) this.character.blob.chainPower[w] = this.DEFAULT_CHAIN_POWER_PRESET[w];
      }
     } else {
      for (let w = 0; w < 24; w++) {
       this.character.blob.chainPower[w] = this.DEFAULT_CHAIN_POWER_PRESET[w];
      }
     }
     
     
     if ("feverPower" in json.init.main) {
      for (let w = 0; w < 24; w++) {
       this.character.blob.feverPower[w] = json.init.main.feverPower[w];
       if (json.init.main.feverPower[w] === null) this.character.blob.feverPower[w] = this.DEFAULT_CHAIN_FEVER_POWER_PRESET[w];
       
      }
     } else {
      for (let w = 0; w < 24; w++) {
       this.character.blob.feverPower[w] = this.DEFAULT_CHAIN_FEVER_POWER_PRESET[w];
      }
     }
     
     if ("dropset" in json.init.main) {
      for (let w = 0; w < 16; w++) {
       this.character.blob.dropset[w] = json.init.main.dropset[w];
       if (json.init.main.dropset[w] === null) this.character.blob.dropset[w] = this.DEFAULT_DROPSET[w];
       
      }
     } else {
      for (let w = 0; w < 16; w++) {
       this.character.blob.dropset[w] = this.DEFAULT_DROPSET[w];
      }
     }
     
     this.character.isHenshinCounting = json.init.main.henshinCanCount;
     
     if ("counting" in json.init.main) this.character.isCounting = json.init.main.counting;
     
     //////console.log(this.character.blob)
    }
    
    this.animationLayerElements.length = 0;
    this.animationTriggerEvents = {};
    this.animationPaths = {};
    
    if ("animation" in json.init) {
     let anim = json.init.animation;
     for (let path in anim.paths) {
      this.animationPaths[path] = anim.paths[path];
     }
     ////console.log(anim.paths)
     for (let asset in anim.sources) {
      let mm = anim.sources[asset];
      let imagus = await memoryManager.asyncLoad(storage[mm.src], "image");
      animatedLayers.loadOffline(this.getCanvasAnimationLoadedName(asset), imagus,
       anim.sources[asset].width,
       anim.sources[asset].height
      );
      
      this.animationElements[asset] = {
       width: mm.width,
       height: mm.height,
       framewidth: mm.framewidth,
       frameheight: mm.frameheight,
       aspectwidth: mm.aspectwidth,
       aspectheight: mm.aspectheight,
       cellsizemult: mm.cellsizemult,
       xbound: mm.xbound,
       src: mm.src,
      };
      this.animationElements[asset].opacity = "opacity" in mm ? mm.opacity : 1
      
     }
     
     
     for (let name in anim.triggers) {
      let mn = anim.triggers[name];
      this.animationTriggerEvents[name] = {};
      for (let nn in mn) {
       this.animationTriggerEvents[name][nn] = [];
       for (let no of mn[nn]) {
        this.animationTriggerEvents[name][nn].push(no);
        if (no.action == "createAnimLayer") {
         if (no.targetid) {
          //////console.log(no.targetid);
          
          this.animationLayerElements.push((no.targetid));
         }
        }
       }
      }
     }
     
     //////console.log(this.animationTriggerEvents)
     
    }
    
    {
     let arr = [];
     let srcArr = [];
     
     /*for (let u = 1; u <= 5; u++) {
      arr.push(`init${u}`);
      arr.push(`spell${u}`);
     }

     arr.push("damage1");
     arr.push("damage2");
     arr.push("counterattack");
     arr.push("gtris");
     arr.push("gtrisplus");
     arr.push("insane");
     arr.push("insane_success");
     arr.push("daihenshin")
     arr.push("zenkeshi");
     arr.push("insane_fail");
     arr.push("win");
     arr.push("lose");

     for (let u = 1; u <= 2; u++) {
      arr.push(`wormhole_inflict${u}`);
      arr.push(`wormhole_damage${u}`);
     }
     arr.push(`wormhole_win`);
     arr.push(`wormhole_lose`);
     arr.push(`wormhole_enter`);/**/
     
     for (let h in json.init.voice) {
      arr.push(json.init.voice[h]);
     }
     
     for (let qi of arr) {
      if (qi in json.init.voice) srcArr.push(voiceURLs[json.init.voice[qi]]);
     }
     
     //////console.log(voiceURLs)/**/
     if (Object.keys(json.init.voice).length > 0) {
      await playerVoiceSystem.batchLoad(json.base, json.version, srcArr);
     }
     
     ////////console.log(json.init.voice)
     for (let hh in json.init.voice) {
      this.character.voices[hh] = new PlayerVoice(json.base, json.version, voiceURLs[json.init.voice[hh]]);
     }
     //////console.log(this.character.voices)
     
     //this.character.voices.spell5.playVoice();
    }
    
    if ("spellImage" in json.init) {
     let array = [];
     //////console.log(json.init)
     
     for (let uuu in json.init.spellImage)
      if (`image_spell_${json.init.spellImage[uuu]}` in rawstore) {
       array.push({
        a: rawstore[`image_spell_${json.init.spellImage[uuu]}`],
        s: uuu
       });
      }
     this.rectanim.load(array);
    }
    
    if (this.rpgAttr.isRPG) {
     for (let h = 0; h < 3; h++) {
      let ref = this.rpgAttr.deck.characters[h];
      let character = gtcharacter.characters[ref.character];
      let core = character.core;
      let version = character.versions[ref.version];
      ////console.log(version)
      await this.rpgAttr.loadRPG(h, `assets/characters/${core.path}/${version.path}`, version.rpg_init);
      ref.isOK = true;
     }
    }
    
    this.character.active = true;
    this.character.load = true;
    this.character.loadable = true;
    res();
    this.drawCharacterBg(0);
    return;
   } else res();
  });
 }
 
 changeBodyColorRGB(r, g, b) {
  this.color.r = r,
   this.color.g = g,
   this.color.b = b;
  for (let bi of ["AUX-BORDER-1", "AUX-BORDER-2", "BORDER-BLOCK", "BORDER-BLOB-1", "BORDER-BLOB-2"]) {
   this.setStyle(bi, "fill", `rgba(${r - 20},${g - 20},${b - 20},0.5)`);
   this.setStyle(bi, "stroke", `rgba(${r - 10},${g - 10},${b - 10},0.8)`);
  }
  
  for (let bi of ["NAMEPLATE-DIV"]) {
   this.setStyle(bi, "background", `rgb(${r - 80},${g - 80},${b - 80})`);
   this.setStyle(bi, "border-color", `rgb(${r - 10},${g - 10},${b - 10})`);
  }
  
  for (let gt = 1; gt <= 2; gt++) {
   this.setStyle(`BLOB-NEXT-BG-${gt}`, "fill", `rgba(${r - 10},${g - 10},${b - 10},0.5)`);
   this.setStyle(`BLOB-NEXT-BG-${gt}`, "stroke", `rgba(${Math.min(255, r + 100)},${Math.min(255, g + 100)},${Math.min(255, b + 100)},0.8)`);
  }
  this.setStyle(`RPG-DECK`, "background", `rgba(${r - 10},${g - 10},${b - 10},0.8)`);
  this.setStyle(`RPG-DECK`, "border", `0.3em solid rgba(${Math.min(255, r + 20)},${Math.min(255, g + 20)},${Math.min(255, b + 20)},0.8)`);
  
  
 }
 
 changeBodyColorHex(hex) {
  let a = hexToRGB(~~hex);
  this.changeBodyColorRGB(a.r, a.g, a.b);
 }
 
 getCanvasAnimationLoadedName(obj) {
  return `ANIM||${this.character.char}||${this.character.ver}||${obj}`;
 }
 
 canvasClear(ctx) {
  let a = this.canvasses[ctx];
  this.canvasCtx[ctx].clearRect(0, 0, a.width, a.height);
 }
 
 engageCleartextTSpin(visible, type, line) {
  if (this.isCompact && visible) return;
  if (type !== null) this.clearText.tspin.exec(type);
  if (line !== void 0) this.editIH("CLEARTEXT-TSPIN-LINE-TEXT", line);
  this.clearText.tspinLine.assign(2);
  this.clearText.tspinLine.assign(1);
  if (visible) {
   let e = "CLEARTEXT-CANVTEXT";
   let element = this.getAsset(e);
   this.setStyle(e, "animation-name", "none");
   this.setStyle(e, "animation-duration", `${~~((1000 / 60) * (60 + 36))}ms`);
   this.setStyle(e, "animation-timing-function", "linear");
   //this.setStyle(e, "animation-play-state", "pausef!important");
   element.offsetHeight;
   if (type == 0) {
    this.setStyle(e, "animation-name", "tspin-div-glow-regular");
   }
   if (type == 1) {
    this.setStyle(e, "animation-name", "tspin-div-glow-mini");
   }
  }
 }
 
 engageCleartext(type, visible, text, color) {
  if (this.isCompact && visible) return;
  let e = "",
   obj = "";
  switch (type) {
   case "b2b": {
    e = "CLEARTEXT-TEXT-B2B";
    obj = "b2b";
    break;
   }
   case "line": {
    e = "CLEARTEXT-TEXT-LINE";
    obj = "line";
    break;
   }
   case "spin": {
    e = "CLEARTEXT-TEXT-SPIN";
    obj = "spin";
    break;
   }
  }
  this.editIH(e, text);
  this.clearText[obj].assign(0);
  if (visible) {
   this.clearText[obj].assign(1);
  }
 }
 
 engageCleartextCombo(visible, toggle, text, color) {
  let e = "CLEARTEXT-TEXT-COMBO",
   obj = "combo";
  if (this.isCompact && visible) return;
  if (text) this.editIH(e, text);
  
  this.clearText[obj].assign(toggle);
  
 }
 
 engagePlaycharExt(type, name) {
  for (let h = 0, m = this.playcharExt.animname.length; h < m; h++)
   this.playcharExt.anim[this.playcharExt.animname[h]].reset();
  this.setStyle("PLAYCHAR-CANVAS-DIV", "opacity", "0%");
  this.setStyle("PLAYCHAR-TEXT-DIV", "opacity", "0%");
  switch (type) {
   case "insane": {
    //this.playcharExt.anim.insaneChar.play();
    this.playcharExt.anim.insaneText.play();
    this.setActivePlaycharExt(name || "insane");
    break;
   }
   
   case "result": {
    
    this.playcharExt.anim.resultText.play();
    this.setStyle("PLAYCHAR-TEXT-DIV", "opacity", "100%");
    break;
    
   }
   
   case "declareWin": {
    
    this.playcharExt.anim.windeclare.play();
    this.setStyle("PLAYCHAR-TEXT-DIV", "opacity", "100%");
    break;
    
   }
   
   case "declareLose": {
    
    this.playcharExt.anim.losedeclare.play();
    this.setStyle("PLAYCHAR-TEXT-DIV", "opacity", "100%");
    break;
    
   }
   
   case "insaneTransform": {
    this.playcharExt.anim.transformChar.play();
    this.playcharExt.anim.insaneText.play();
    this.setActivePlaycharExt(name || "transf");
    break;
   }
   
   case "insaneTransformSpell": {
    this.playcharExt.anim.transformCSpell.play();
    this.setActivePlaycharExt(name || "tfmicspell1");
    break;
   }
  }
 }
}

class InsaneMode {
 constructor(type, parent) {
  this.time = 60;
  this.maxTime = 150 * 60;
  this.isUnlimited = true;
  this.isCommandedEnd = false
  this.preset = {
   blob: game.presets.blobNormal,
   microBlob: game.presets.blobMicro,
   block: game.presets.blockNormal,
   block2: game.presets.blockJavaScriptus
  };
  this.henshinTypes = 2;
  this.status = "n";
  this.initialStart = false;
  this.initialStartHenshin = false;
  this.insaneType = 0;
  this.requireChain = -3;
  this.insaneModeCount = 0;
  this.blocks = {
   phase: 5,
   requireLine: -9,
   seq: 0,
   type: 0
  };
  this.combo = 0;
  this.isExtra = true;
  this.fixedHenshinType = 2;
  //////console.log(this.preset);
  this.parent = parent;
  this.type = type;
  //this.maxTime = this.time;
  this.isOn = false;
  this.isTime = false;
  this.isDelay = false;
  this.transEntTime = 0;
  this.memory = {
   preview: [],
   stack: [
    []
   ],
   combo: 0,
   b2b: 0,
   hold: void 0
   
  };
  this.delay = {
   ready: -30,
   in: -33,
   turningOff: -30,
   out: -30,
   del: -50,
   readyHenshin: -48,
  };
  this.delayOrder = ["ready", "readyHenshin", "in", "turningOff", "out", "del"];
  this.defaultDelays = {};
  this.chainScore = 0;
  this.customDelays = {};
  this.timeAdditions = {
   minChain: 2,
   timeAddMult: 0.5,
   allClear: 5,
   fixedTimeAdd: 2,
  };
  this.rng = new ParkMillerPRNG();
  for (let h in this.delay) {
   this.defaultDelays[h] = this.delay[h];
  }
 }
 
 setMemory(setload, stack, prev, combo, b2b, hold) {
  let a;
  switch (setload) {
   case "load": {
    a = {
     preview: this.memory.preview,
     stack: this.memory.stack,
     combo: this.memory.combo,
     b2b: this.memory.b2b,
     hold: this.memory.hold
    }
    break;
   }
   
   case "save": {
    this.memory.stack = stack;
    this.memory.preview = prev;
    this.memory.combo = combo;
    this.memory.b2b = b2b;
    this.memory.hold = hold;
    break;
   }
   
   case "reset": {
    this.memory = {
     preview: [],
     stack: [
      []
     ],
     combo: 0,
     b2b: 0,
     hold: void 0
    };
   }
  }
  return a;
 }
 load() {
  this.background.canvas = this.parent.parent.canvasses.character;
  this.background.ctx = this.parent.parent.canvasCtx.character;
 }
 update() {
  if (this.isTime && !this.isUnlimited) this.time--;
  
  if (this.isOn) {
   
   this.parent.parent.editIH("INSANE-TIMER", this.isUnlimited ? "" : Math.max(Math.floor(this.time / 60), 0));
   if (this.time <= 5 * game.FPS && this.time >= 0 && !this.parent.parent.hasWon) {
    if ((this.time % game.FPS) == 0 && this.time > 0) this.parent.parent.playSound("timer2_1");
    if (this.time == 0) {
     this.time = -90;
     this.parent.parent.playSound("timer_zero");
    }
   }
  }
 }
 
 draw() {
  if (this.isOn) {
   this.parent.parent.insaneBg.draw();
   
  }
 }
 
 reset() {
  for (let h in this.defaultDelays) {
   this.delay[h] = -99; //this.defaultDelays[h];
  }
  this.toggle(false);
  this.isTime = false;
  this.insaneModeCount = 0;
  this.time = -1;
  this.setMemory("reset");
  this.transEntTime = -4;
  this.blocks.requireLine = -9;
  this.blocks.phase = 1;
  this.blocks.seq = 0;
  this.parent.parent.editIH("INSANE-TIMER", "");
  
 }
 
 updateDelays() {
  
  let isDelay = false;
  for (let h of this.delayOrder) {
   if (this.delay[h] >= 0) {
    this.delay[h]--;
    isDelay = true;
    break;
   }
  }
  
  if (this.delay.readyHenshin == 0) {
   this.parent.parent.editIH("PLAYCHAR-TEXT", "Transform!");
   this.delay.in = 40;
   this.parent.delay[0] = 30;
   this.insaneType = 1 + ~~(this.rng.next() * this.henshinTypes);
   if (this.fixedHenshinType > 0) {
    this.insaneType = this.fixedHenshinType;
   }
   this.parent.parent.playAnimation("fieldVerticalSpin");
   this.parent.parent.engagePlaycharExt("insaneTransform");
   if (this.insaneModeCount == 0) this.parent.parent.playVoice("daihenshin");
   this.insaneModeCount++;
   this.transEntTime = 40 + 30;
  }
  if (this.transEntTime >= 0) {
   this.transEntTime--;
   if (this.delay.in < 20) this.delay.in = 3;
   
   if (this.transEntTime == 35) {
    
    this.parent.parent.playcharExt.anim.insaneText.play();
    this.parent.parent.setActivePlaycharExt(["transfmac", "transfmic"][this.insaneType - 1]);
    this.parent.parent.editIH("PLAYCHAR-TEXT", `Enhancement: ${["Macro", "Micro"][this.insaneType - 1]}`);
   }
   this.parent.parent.drawActivePlaycharExt();
   let cctx = this.parent.parent.canvasCtx.playchar;
   let hm = 0;
   
   if (this.transEntTime >= 35 && this.transEntTime <= 55) {
    hm = Math.min((55 - this.transEntTime), 20) / 20;
   }
   if (this.transEntTime < 35 && this.transEntTime >= 15) {
    hm = Math.min(this.transEntTime - 15, 20) / 25;
   }
   cctx.fillStyle = `rgba(255,255,255,${hm}`;
   
   //cctx.globalAlpha = hm;
   cctx.globalCompositeOperation = "source-atop";
   cctx.fillRect(0, 0, 600, 600);
   cctx.globalCompositeOperation = "source-over";
   cctx.globalAlpha = 1;
   
   
   if (this.transEntTime == 0) {
    
   }
  }
  
  if (this.delay.ready == 0) {
   this.delay.in = 40;
   this.parent.delay[0] = 30;
   this.insaneType = 0;
   this.parent.parent.playAnimation("fieldVerticalSpin");
   this.parent.parent.engagePlaycharExt("insane");
   if (this.insaneModeCount == 0) this.parent.parent.playVoice("insane");
   this.insaneModeCount++;
   if (this.type == "blob") {
    this.parent.parent.editIH("PLAYCHAR-TEXT", `Enhancement: Fever`);
    
   }
   if (this.type == "block") {
    this.parent.parent.editIH("PLAYCHAR-TEXT", `Enhancement: Frenzy`);
    
   }
   this.parent.parent.engageCleartext("b2b", false, "");
   this.parent.parent.engageCleartextCombo(false, 0, "");
  }
  
  if (this.delay.in == 20) {
   //this.delay.in = 50;
   this.parent.parent.playSound("insane");
   
   if (this.parent.parent.feverStat.isOn) {
    this.parent.parent.feverStat.playColored(true);
    if (this.parent.parent.feverStat.isUseTimer) this.maxTime = this.parent.parent.feverStat.time;
   }
   //this.parent.delay[0] = 30;
   this.toggle(true);
   this.parent.parent.insaneBg.type = this.insaneType > 0 ? 3 : 0;
   this.parent.parent.insaneBg.changeColorCustom(66, 66, 66);
   
   if (this.type == "block") this.parent.parent.insaneBg.type = 2;
   if (this.type == "blob") {
    let stack = JSON.parse(JSON.stringify(this.parent.stack)),
     prev = JSON.parse(JSON.stringify(this.parent.preview.queue)),
     combo = 0,
     b2b = 0,
     hold = 0;
    this.setMemory("save", stack, prev, combo, b2b, hold);
    //this.toggle(true);
    
    if (this.insaneType == 0) {
     this.parent.fieldSize.w = 6;
     this.parent.fieldSize.hh = 30;
     this.parent.fieldSize.vh = 12;
     this.parent.fieldSize.h = this.parent.fieldSize.vh + this.parent.fieldSize.hh;
     this.parent.blobRequire = 4;
     this.parent.stack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);
     /*this.parent.drawableStack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);
     this.parent.poppedSstack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);*/
     
     this.parent.drawStack(this.parent.stack);
    }
    if (this.insaneType == 1) {
     this.parent.fieldSize.w = 3;
     this.parent.fieldSize.hh = 30;
     this.parent.fieldSize.vh = 6;
     this.parent.fieldSize.h = this.parent.fieldSize.vh + this.parent.fieldSize.hh;
     this.parent.blobRequire = 3;
     this.parent.stack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);
     /*this.parent.drawableStack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);
     this.parent.poppedSstack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);*/
     
     this.parent.drawStack(this.parent.stack);
    }
    if (this.insaneType == 2) {
     this.parent.fieldSize.w = 10;
     this.parent.fieldSize.hh = 30;
     this.parent.fieldSize.vh = 20;
     this.parent.fieldSize.h = this.parent.fieldSize.vh + this.parent.fieldSize.hh;
     this.parent.blobRequire = 4;
     this.parent.stack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);
     /*this.parent.drawableStack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);
     this.parent.poppedSstack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);*/
     
     this.parent.drawStack(this.parent.stack);
    }
    
   }
   
   this.parent.parent.conclude1v1Overhead(3);
   
   
   this.parent.parent.switchGarbageBehind(true);
   this.time = this.maxTime;
   this.time += 1 * 60;
   
   
   
   //this.parent.parent.playAnimation("fieldVerticalSpin");
   if (this.type == "block") {
    
    let stack = JSON.parse(JSON.stringify(this.parent.stack)),
     prev = JSON.parse(JSON.stringify(this.parent.preview.queue)),
     combo = this.parent.combo,
     b2b = this.parent.b2b,
     hold = this.parent.piece.hold;
    this.setMemory("save", stack, prev, combo, b2b, hold);
    //this.toggle(true);
    if (this.insaneType == 0) {
     this.parent.fieldSize.w = 10;
     this.parent.fieldSize.hh = 20;
     this.parent.fieldSize.vh = 20;
     this.parent.piece.holdable = false;
     this.parent.holdShow(false);
     this.parent.fieldSize.h = this.parent.fieldSize.vh + this.parent.fieldSize.hh;
     //this.parent.blobRequire = 4;
     this.parent.stack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);
     /*this.parent.drawableStack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);
     this.parent.poppedSstack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);*/
     
     this.parent.drawStack(this.parent.stack);
    }
   }
   
   
  }
  
  if (this.delay.in == 0) {
   this.isTime = true;
   if (this.type == "blob") {
    if (this.insaneType == 0) {
     this.delay.del = 10;
     this.status = "start";
     
    }
    if (this.insaneType == 2) {
     //phase 22 is a 30-chain (MAX)
     this.microBlobToField(8 - 8, true);
    }
   }
   if (this.type === "block") {
    if (this.insaneType === 0) {
     //this.blockToField(0, 0,0,0);
     this.delay.del = 10;
     this.status = "start";
    }
   }
  }
  
  if (this.delay.del == 0) {
   if (this.status === "success") {
    if (this.type == "blob") {
     if (this.insaneType === 0) {
      this.blobToField(Math.max(0, Math.min(this.parent.parent.feverStat.presetChain, 15 - 2)), this.isExtra);
     }
     if (this.insaneType === 2) {
      let sum = Math.min(this.chainScore + 2, 30);
      
      this.microBlobToField(sum - 8, true);
     }
    }
    if (this.type == "block") {
     this.blocks.seq = 0;
     this.parent.parent.insaneBg.moveEye(this.parent.fieldSize.w / 2, this.parent.fieldSize.vh / 2, true);
     
     if (this.insaneType === 0) {
      //////console.log(`FAILED, ${this.requireChain}-chain is required, but a ${this.parent.previousChain}-chain is made.`)
      this.blocks.phase++;
      
      this.blockToField(Math.min(13, this.blocks.phase), this.rng.next(), this.rng.next(), this.rng.next());
     }
     if (this.insaneType === 1) {
      
     }
    }
   }
   if (this.status === "fail") {
    if (this.type == "blob") {
     if (this.insaneType === 0) {
      //////console.log(`FAILED, ${this.requireChain}-chain is required, but a ${this.parent.previousChain}-chain is made.`)
      
      this.blobToField(Math.max(0, Math.min(this.parent.parent.feverStat.presetChain, 15 - 2)), this.isExtra);
     }
     if (this.insaneType === 2) {
      //////console.log(`FAILED, ${this.requireChain}-chain is required, but a ${this.parent.previousChain}-chain is made.`)
      let difference = Math.max(8, this.requireChain - Math.min(2, this.requireChain - this.chainScore - 2))
      this.microBlobToField(difference - 8, true);
     }
    }
    if (this.type == "block") {
     this.blocks.seq = 0;
     this.parent.parent.insaneBg.moveEye(this.parent.fieldSize.w / 2, this.parent.fieldSize.vh / 2, true);
     
     if (this.insaneType === 0) {
      //////console.log(`FAILED, ${this.requireChain}-chain is required, but a ${this.parent.previousChain}-chain is made.`)
      this.blockToField(Math.min(13, this.blocks.phase), this.rng.next(), this.rng.next(), this.rng.next());
     }
     if (this.insaneType === 1) {
      
     }
    }
    
   }
   if (this.status === "start") {
    if (this.type == "blob") {
     this.blobToField(Math.max(0, Math.min(this.parent.parent.feverStat.presetChain, 15 - 2)), this.isExtra);
    }
    if (this.type == "block") {
     this.blocks.seq = 0;
     
     if (this.insaneType === 0) {
      this.parent.parent.insaneBg.moveEye(this.parent.fieldSize.w / 2, this.parent.fieldSize.vh / 2, true);
      
      //////console.log(`FAILED, ${this.requireChain}-chain is required, but a ${this.parent.previousChain}-chain is made.`)
      this.blocks.phase = 0;
      this.blockToField(Math.min(13, this.blocks.phase), this.rng.next(), this.rng.next(), this.rng.next());
     }
     if (this.insaneType === 1) {
      
     }
    }
   }
   
  }
  
  if (this.delay.turningOff == 0) {
   for (let h of this.delayOrder) {
    if (this.delay[h] >= 0) {
     this.delay[h] = -99;
     
    }
    
   }
   
   this.delay.out = 40;
   this.parent.delay[0] = 30;
   
   this.isCommandedEnd = false;
   
   this.parent.parent.playAnimation("fieldVerticalSpin");
   //this.parent.parent.engagePlaycharExt("insane");
  }
  
  if (this.delay.out == 20) {
   //this.delay.in = 50;
   this.parent.parent.playSound("swap_swap");
   /*if (this.parent.isAllClearTemp) {
   	this.parent.isAllClearTemp = false;
   	this.parent.playAllClearAnim(2);
   }*/
   //this.parent.delay[0] = 30;
   this.toggle(false);
   if (this.parent.parent.feverStat.isOn) {
    this.parent.parent.feverStat.reset();
   }
   this.parent.parent.canvasClear("insane");
   this.parent.parent.switchGarbageBehind(false);
   
   //this.parent.parent.playAnimation("fieldVerticalSpin");
   if (this.type == "blob") {
    if (this.insaneType == 1 || this.insaneType == 2) {
     
     this.parent.fieldSize.w = 6;
     this.parent.fieldSize.hh = 30 * 1;
     this.parent.fieldSize.vh = 12;
     this.parent.fieldSize.h = this.parent.fieldSize.vh + this.parent.fieldSize.hh;
     this.parent.blobRequire = 4;
    }
    
    
    
    let ma = this.setMemory("load");
    this.parent.stack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);
    for (let x = 0; x < this.parent.fieldSize.w; x++) {
     for (let y = 0; y < this.parent.fieldSize.h; y++) {
      this.parent.stack[x][y] = ma.stack[x][y];
     }
    }
    this.parent.setDelay(1, this.parent.parent.isInsaneModeOnly ? -19 : 5);
    this.parent.setDelay(0, this.parent.parent.isInsaneModeOnly ? -19 : 5);
    this.parent.drawStack(this.parent.stack);
    this.parent.canFallTrash = false;
    
    this.parent.blobCount = this.parent.checkBlobCount(this.parent.stack);
    
   }
   if (this.type == "block") {
    if (this.insaneType == 1 || this.insaneType == 2) {
     
     this.parent.fieldSize.w = 6;
     this.parent.fieldSize.hh = 30 * 1;
     this.parent.fieldSize.vh = 12;
     this.parent.fieldSize.h = this.parent.fieldSize.vh + this.parent.fieldSize.hh;
     this.parent.blobRequire = 4;
    }
    
    
    
    let ma = this.setMemory("load");
    this.parent.stack = grid(this.parent.fieldSize.w, this.parent.fieldSize.h, 0);
    for (let x = 0; x < this.parent.fieldSize.w; x++) {
     for (let y = 0; y < this.parent.fieldSize.h; y++) {
      this.parent.stack[x][y] = ma.stack[x][y];
     }
    }
    this.parent.previewModify(ma.preview, 1);
    this.parent.setDelay(1, this.parent.parent.isInsaneModeOnly ? -19 : 5);
    this.parent.setDelay(0, this.parent.parent.isInsaneModeOnly ? -19 : 5);
    this.parent.drawStack(this.parent.stack);
    this.parent.holdShow(this.parent.piece.defaultHoldable);
    this.parent.checkStackAltitude();
    
    
   }
   
   this.parent.parent.engageCleartext("b2b", false, "");
   this.parent.parent.engageCleartextCombo(false, 0, "");
  }
  
  if (this.delay.out == 0) {
   this.isTime = false;
   this.parent.parent.editIH("INSANE-TIMER", "");
   
   
   
   if (this.type == "blob" && this.parent.canFallTrashAfterFever) {
    this.parent.dropGarbage();
   }
   
   /*if (this.type == "blob") {
    this.blobToField(2, true);
   }*/
  }
  
  
  return isDelay;
 }
 
 blobToField(phase, isExtra, doesNotRequireChain) {
  let m = ~~(this.rng.next() * 6),
   c = 0;
  let colors = this.parent.colors;
  let colorSet = [];
  for (let i = 0; i < colors; i++) colorSet.push(this.parent.colorSet[i]);
  
  for (let i = 0; i < colorSet.length - 1; i++)
  {
   var temp = colorSet[i];
   var rand = ~~((colorSet.length - i) * this.rng.next()) + i;
   colorSet[i] = colorSet[rand];
   colorSet[rand] = temp;
  };
  colorSet.unshift(0);
  
  let a = this.preset.blob[phase][colors - 3][m];
  //////console.log(this.preset.blob[phase][colors - 3][m])
  
  let tempGrid = this.#checkInstantDrop(a.grid, a.grid.length, a.grid[0].length);
  
  let grid = [];
  
  for (let x = 0, l = tempGrid.length; x < l; x++) {
   grid[x] = [];
   for (let y = 0, w = tempGrid[x].length; y < w; y++) {
    let lm = tempGrid[x][y];
    if (lm > 15 && isExtra) lm -= 16;
    else if (lm > 15) lm = 0;
    grid[x][y] = colorSet[lm];
   }
  }
  
  
  this.parent.replaceField(grid, this.rng.next() > 0.5, !this.isOn);
  if (!doesNotRequireChain) this.requireChain = a.require;
 }
 microBlobToField(phase, isExtra) {
  let m = ~~(this.rng.next() * 4), // 4 is default
   c = 0;
  let colors = this.parent.colors;
  let colorSet = [];
  for (let i = 0; i < colors; i++) colorSet.push(this.parent.colorSet[i]);
  
  for (let i = 0; i < colorSet.length - 1; i++) {
   var temp = colorSet[i];
   var rand = ~~((colorSet.length - i) * this.rng.next()) + i;
   colorSet[i] = colorSet[rand];
   colorSet[rand] = temp;
  };
  colorSet.unshift(0);
  
  let a = this.preset.microBlob[phase][colors - 3][m];
  //////console.log(this.preset.blob[phase][colors - 3][m])
  
  let tempGrid = this.#checkInstantDrop(a.grid, a.grid.length, a.grid[0].length);
  
  let grid = [];
  
  for (let x = 0, l = tempGrid.length; x < l; x++) {
   grid[x] = [];
   for (let y = 0, w = tempGrid[x].length; y < w; y++) {
    let lm = tempGrid[x][y];
    if (lm > 15 && isExtra) lm -= 16;
    else if (lm > 15) lm = 0;
    if (lm > 0) grid[x][y] = colorSet[lm];
    else grid[x][y] = 0;
   }
  }
  
  
  this.parent.replaceField(grid, this.rng.next() > 0.5, true);
  this.requireChain = a.require;
  //////console.log(phase, colors - 3, m)
 }
 
 blockToField(phase, a, b, c) {
  //this.blocks.type = ~~(this.rng.next()*2);
  let base = this.preset.block;
  let aA = Math.floor(a * 7),
   bB = Math.floor(b * 3),
   cC = Math.floor(c * 2);
  
  if (this.blocks.type == 1) {
   base = this.preset.block2;
   aA = Math.floor(a * 6),
    bB = Math.floor(b * 2),
    cC = Math.floor(c * 2);
  }
  
  //////console.log(this.preset.block)
  let mPhase = 0;
  if (phase >= 4) mPhase++;
  if (phase >= 7) mPhase++;
  if (phase >= 10) mPhase++;
  if (phase >= 13) mPhase++;
  let m = base[mPhase][aA][bB][cC];
  //////console.log(m)
  //////console.log(this.preset.blob[phase][colors - 3][m])
  let tempGrid = m.grid;
  
  let grid = [];
  
  for (let x = 0, l = tempGrid.length; x < l; x++) {
   grid[x] = [];
   for (let y = 0, w = tempGrid[x].length; y < w; y++) {
    let lm = tempGrid[x][y];
    /*if (lm > 15 && isExtra) lm -= 16;
    else if (lm > 15) lm = 0;*/
    if (lm > 0) grid[x][y] = tempGrid[x][y];
    else grid[x][y] = 0;
   }
  }
  //////console.log(aA, bB, cC)
  
  
  this.parent.modifyGrid(this.parent.fieldSize.hh - (this.blocks.type == 1 ? 2 : 0), grid, this.blocks.type == 60 && cC < 1, false, true);
  this.blocks.requireLine = m.require;
  this.parent.previewModify(m.preview, 30);
  //////console.log(phase, colors - 3, m)
 }
 
 #checkInstantDrop(stack, w, h) {
  let width = w,
   height = h;
  
  let grid = JSON.parse(JSON.stringify(stack));
  
  
  let testSpace = function(x, y) {
    if (x < 0 || x >= width) {
     return true;
    }
    if (y < height) {
     if (typeof grid[x][y] !== "undefined" && grid[x][y] !== 0) {
      return true;
     }
     return false;
    }
    return true;
   },
   checkHoles = function() {
    let checked = true;
    for (let t = 0; t < height && checked; t++)
     for (var y = height - 1; y >= -1; y--) {
      for (var x = 0; x < width; x++) {
       checked = true;
       if (!testSpace(x, y - 1)) {
        continue
       }
       if (!testSpace(x, y)) {
        grid[x][y] = grid[x][y - 1]
        grid[x][y - 1] = 0;
        checked = false;
       }
      }
     }
   };
  while (true) {
   checkHoles();
   break
  }
  return grid;
 }
 
 toggle(tog) {
  this.isOn = tog;
  if (tog) {
   
  } else {
   
  }
 }
}

class InsaneBackground {
 #Ray = class {
  constructor(x1, y1, x2, y2, divisions) {
   this.distanceX = x2 - x1;
   this.distanceY = y2 - y1;
   this.x1 = x1;
   this.x2 = x2;
   this.y1 = y1;
   this.y2 = y2;
   this.midpointVertexCount = divisions - 1;
   this.midpointVertexes = [];
   for (let f = 0; f < this.midpointVertexCount; f++) {
    this.midpointVertexes.push({
     x: 0,
     y: 0,
    });
   }
   this.color = "#fff";
  }
  moveStart(x, y) {
   this.x1 = x;
   this.y1 = y;
   this.distanceX = this.x2 - this.x1;
   this.distanceY = this.y2 - this.y1;
   /*for (let f = 0; f < this.midpointVertexCount; f++) {
    this.midpointVertexes[f].ox =  this.distanceX / this.midpointVertexCount;
    this.midpointVertexes[f].oy =  this.distanceY / this.midpointVertexCount;
   }*/
  }
  
  moveEnd(x, y) {
   this.x2 = x;
   this.y2 = y;
   this.distanceX = this.x2 - this.x1;
   this.distanceY = this.y2 - this.y1;
   
   /*for (let f = 0; f < this.midpointVertexCount; f++) {
    this.midpointVertexes[f].ox = this.distanceX / this.midpointVertexCount;
    this.midpointVertexes[f].oy = this.distanceY / this.midpointVertexCount;
   }*/
  }
  
  
  draw(ctx, cellSize) {
   let mx = this.distanceX / this.midpointVertexCount,
    my = this.distanceY / this.midpointVertexCount,
    cx1 = this.x1,
    cy1 = this.y1,
    cx2 = this.x2,
    cy2 = this.y2;
   ctx.beginPath();
   ctx.moveTo((this.x1 * cellSize), (this.y1 * cellSize));
   for (let g = 0, m = this.midpointVertexes.length; g < m; g++) {
    let r = this.midpointVertexes[g];
    
    ctx.lineTo((((g + 1) * (mx)) + r.x + this.x1) * cellSize, (((g + 1) * (my)) + r.y + this.y1) * cellSize);
    if (g == 4) break;
   }
   
   ctx.lineTo((this.x2 * cellSize), (this.y2 * cellSize));
   ctx.lineWidth = 0.3 * cellSize;
   ctx.strokeStyle = this.color;
   ctx.stroke();
   
  }
 };
 constructor(parent) {
  this.parent = parent;
  this.canvas;
  this.ctx;
  this.cellSize = 40;
  this.colors = {
   r: 250,
   g: 60,
   b: 48,
  };
  this.colorMult = 1;
  this.eye = {
   x: 0,
   y: 0,
   w: 5,
   h: 5,
   offset: {
    
    dx: 0,
    dy: 0,
    frame: 0,
    max: 0,
    state: "set"
   }
  };
  this.origStarts = [];
  this.rays = [];
  this.henshinTemp = new OffscreenCanvas(540, 540);
  this.henshinTempCtx = this.henshinTemp.getContext("2d");
  this.henshinAnim = new GIFRenderer(10 * 540, 10 * 540, 540, 540, 0, (a, canv, x, y, w, h, frame, that) => {
   let b = a.canvas; // a.canvas is the main canvas, this.canvas
   //a.clearRect(0, 0, b.width, b.height);
   let mm = ((game.frames * 0.3) % 360)
   this.henshinTempCtx.clearRect(0, 0, w, h);
   this.henshinTempCtx.save();
   this.henshinTempCtx.translate(w / 2, h / 2);
   this.henshinTempCtx.rotate((Math.PI / 180) * (mm))
   this.henshinTempCtx.drawImage(canv, (x % 5) * w, (~~(x / 5) % 3) * h, w, h, w / -2, h / -2, w, h);
   let centerSize = 5;
   
   for (let yu = 0; yu < 2; yu++) a.drawImage(this.henshinTemp, 0, 0, w, h, this.parent.cellSize * ((-5) - (centerSize / 2)), this.parent.cellSize * (-centerSize / 2), this.parent.cellSize * (this.parent.fieldSize.vh + centerSize), this.parent.cellSize * (this.parent.fieldSize.vh + centerSize));
   this.henshinTempCtx.restore();
   
   that.frame.x++;
   that.frameCount++;
   
   //if (frame >= 30) that.enabled = false;
   if (frame == 15) that.actualFrames = 0;;
  }, (frame) => {
   
  }, true);
  this.fever = {
   
  };
  this.fever.temp = new OffscreenCanvas(540, 540),
   this.fever.tempCtx = this.fever.temp.getContext("2d"),
   this.fever.main = new GIFRenderer(540 * 3, 540 * 5, 540, 540, 0, (a, canv, x, y, w, h, frame, that) => {
    let b = a.canvas; // a.canvas is the main canvas, this.canvas
    //a.clearRect(0, 0, b.width, b.height);
    
    let eyeX = this.eye.x;
    let eyeY = this.eye.y;
    
    if (this.eye.offset.frame >= 0 && this.eye.offset.state == "reset") {
     let be = 1 - bezier(this.eye.offset.frame / this.eye.offset.max, 1, 0, 0, 0, 0, 1);
     eyeX = this.eye.x + (this.eye.offset.dx * be);
     eyeY = this.eye.y + (this.eye.offset.dy * be);
     this.eye.offset.frame--;
    }
    if (this.spinSpeed > 0.3) this.spinSpeed -= 0.005;
    else this.spinSpeed = 0.3;
    let mm = ((this.spinFrames) % 360);
    this.fever.tempCtx.clearRect(0, 0, w, h);
    this.fever.tempCtx.save();
    this.fever.tempCtx.translate(w / 2, h / 2);
    this.fever.tempCtx.rotate((Math.PI / 180) * (mm))
    this.fever.tempCtx.drawImage(canv, ~~(x % 3) * w, (~~(x / 3) % 5) * h, w, h, w / -2, h / -2, w, h);
    let centerSize = 30;
    
    a.drawImage(this.fever.temp, 0, 0, w, h, (this.parent.cellSize * ((-10) - (centerSize / 2) + eyeX)), this.parent.cellSize * ((-centerSize / 2) - 10 + eyeY), this.parent.cellSize * (this.parent.fieldSize.vh + centerSize), this.parent.cellSize * (this.parent.fieldSize.vh + centerSize));
    this.fever.tempCtx.restore();
    
    that.frame.x -= 1;
    that.frameCount += 1;
    this.spinFrames += this.spinSpeed;
    
    this.spinFrames %= 360;
    
    
    
    if (that.frameCount >= 13 || that.frame.x <= -1) {
     that.frameCount = 0;
     that.frame.x = 13;
    }
    
    //if (frame >= 30) that.enabled = false;
    if (frame == 30) that.actualFrames = 0;;
   }, (frame) => {
    //this.setStyle("CLEARTEXT-CANVTEXT", "animation-delay", `${~~((1000 / -60) * (frame))}ms`);
   }, true);
  
  
  this.frenzy = {
   
  };
  this.frenzy.temp = new OffscreenCanvas(540, 540),
   this.frenzy.tempCtx = this.frenzy.temp.getContext("2d"),
   this.frenzy.main = new GIFRenderer(540 * 3, 540 * 8, 540, 540, 0, (a, canv, x, y, w, h, frame, that) => {
    let b = a.canvas; // a.canvas is the main canvas, this.canvas
    //a.clearRect(0, 0, b.width, b.height);
    
    let eyeX = this.eye.x;
    let eyeY = this.eye.y;
    
    if (this.eye.offset.frame >= 0) {
     let be = 1 - bezier(this.eye.offset.frame / this.eye.offset.max, 1, 0, 0, 0, 0, 1);
     eyeX = this.eye.x + (this.eye.offset.dx * be);
     eyeY = this.eye.y + (this.eye.offset.dy * be);
     this.eye.offset.frame--;
    }
    
    let mm = ((this.spinFrames) % 360);
    this.frenzy.tempCtx.clearRect(0, 0, w, h);
    this.frenzy.tempCtx.save();
    this.frenzy.tempCtx.translate(w / 2, h / 2);
    this.frenzy.tempCtx.rotate((Math.PI / 180) * (mm));
    this.frenzy.tempCtx.drawImage(canv, ~~(x % 3) * w, (~~(x / 3) % 8) * h, w, h, w / -2, h / -2, w, h);
    let centerSize = 30;
    
    //////console.log(this.cellSize, this.parent.cellSize)
    for (let yu = 0; yu < 1; yu++) a.drawImage(this.frenzy.temp, 0, 0, w, h, (this.parent.cellSize * ((-10) - (centerSize / 2) + eyeX)), this.parent.cellSize * ((-centerSize / 2) - 10 + eyeY), this.parent.cellSize * (this.parent.fieldSize.vh + centerSize), this.parent.cellSize * (this.parent.fieldSize.vh + centerSize));
    this.frenzy.tempCtx.restore();
    
    that.frame.x += 1;
    that.frameCount += 1;
    this.spinFrames += 0.3;
    this.spinFrames %= 360;
    if (that.frameCount >= 24 || that.frame.x <= -1) {
     that.frameCount = 0;
     that.frame.x = 0;
    }
    
    //if (frame >= 30) that.enabled = false;
    if (frame == 30) that.actualFrames = 0;;
   }, (frame) => {
    //this.setStyle("CLEARTEXT-CANVTEXT", "animation-delay", `${~~((1000 / -60) * (frame))}ms`);
   }, true);
  
  this.spinSpeed = 0;
  this.spinFrames = 0;
  
  
  for (let f = 0; f < 12; f++) {
   this.rays.push(new this.#Ray(0, 1, 0, 1, 4));
  }
 }
 
 fetchAsset(canvas, ctx) {
  this.canvas = canvas;
  this.ctx = ctx;
  
  //refactor by excluding this spaghetti adds code
  this.henshinAnim.initialize(this.ctx);
  this.henshinAnim.loadImages([game.henshinBg]);
  this.henshinAnim.exec(0);
  //this.henshinTempCtx.drawImage(this.henshinAnim.getCanvas(), 0, 0);
  
  this.fever.main.initialize(this.ctx);
  this.fever.main.loadImages([game.feverBg]);
  this.fever.main.exec(0);
  //this.fever.tempCtx.drawImage(this.fever.main.getCanvas(), 0, 0);
  
  this.frenzy.main.initialize(this.ctx);
  this.frenzy.main.loadImages([game.frenzyBg]);
  this.frenzy.main.exec(0);
  //this.frenzy.tempCtx.drawImage(this.frenzy.main.getCanvas(), 0, 0);
  
 }
 reset() {
  this.eye.offset.frame = -9;
  this.spinSpeed = 0.3;
  this.moveEye(this.parent.fieldSize.w / 2, this.parent.fieldSize.vh / 2);
 }
 moveEye(x, y, isReset) {
  this.eye.offset.dx = this.eye.x - x;
  this.eye.offset.dy = this.eye.y - y;
  this.eye.x = x;
  this.eye.y = y;
  this.spinSpeed += 0.4;
  this.eye.offset.state = "set";
  if (isReset) {
   this.eye.offset.state = "reset";
   this.eye.offset.frame = 180;
   this.eye.offset.max = 180;
  } else {
   this.eye.offset.state = "reset";
   this.eye.offset.frame = 5;
   this.eye.offset.max = 5;
  }
  let w = this.parent.fieldSize.w;
  let vh = this.parent.fieldSize.vh;
  this.origStarts = [{
   x: 0 * (w / 3),
   y: 0 * (vh / 3)
  },
  {
   x: 1 * (w / 3),
   y: 0 * (vh / 3)
  },
  {
   x: 2 * (w / 3),
   y: 0 * (vh / 3)
  },
  {
   x: 3 * (w / 3),
   y: 0 * (vh / 3)
  },
  {
   x: 3 * (w / 3),
   y: 1 * (vh / 3)
  },
  {
   x: 3 * (w / 3),
   y: 2 * (vh / 3)
  },
  {
   x: 3 * (w / 3),
   y: 3 * (vh / 3)
  },
  {
   x: 2 * (w / 3),
   y: 3 * (vh / 3)
  },
  {
   x: 1 * (w / 3),
   y: 3 * (vh / 3)
  },
  {
   x: 0 * (w / 3),
   y: 3 * (vh / 3)
  },
  {
   x: 0 * (w / 3),
   y: 2 * (vh / 3)
  },
  {
   x: 0 * (w / 3),
   y: 1 * (vh / 3)
  }];
  
 }
 changeColor() {
  let ml = ~~(Math.random() * 10);
  this.colors.r = [130, 0, 0, 130, 130, 0, 130, 130, 70, 0][ml] * 2;
  this.colors.g = [0, 130, 0, 0, 130, 130, 0, 70, 130, 70][ml] * 2;
  this.colors.b = [0, 0, 130, 130, 0, 130, 70, 0, 0, 130][ml] * 2;
  
 }
 
 changeColorCustom(r, g, b) {
  //let ml = ~~(Math.random() * 10);
  this.colors.r = r;
  this.colors.g = g;
  this.colors.b = b;
  
 }
 draw() {
  this.parent.canvasClear("insane");
  //this.eye.x = Math.random() * 10;
  
  let w = this.parent.fieldSize.w;
  let vh = this.parent.fieldSize.vh;
  let qq = 1;
  
  this.parent.canvasCtx.insane.fillStyle = `rgba(${this.colors.r * qq},${this.colors.g * qq},${this.colors.b * qq}, 0.8)`;
  
  this.parent.canvasCtx.insane.fillRect(
   0, 0,
   this.parent.cellSize * (w),
   this.parent.cellSize * (vh)
  );
  
  this.parent.canvasCtx.insane.fillStyle = `rgba(${~~(Math.random() * 255)},${~~(Math.random() * 255)},${~~(Math.random() * 255)}, 0.5)`;
  
  //////console.log(this.parent.cellSize)
  if (this.type == 0) {
   
   
   if (false) {
    for (let m = 0; m < this.rays.length; m++) {
     let maxAr = 12,
      arCount = 4;
     let g = game.frames * 0.1 + Math.sin(game.frames + (60)) * 0.25;
     let ar = ((g) + (m * 4)) % (maxAr * arCount);
     let afr = ((g) + (m * 4) + (12)) % (maxAr * arCount);
     /*let arx = (Math.max(0, Math.min(maxAr, ar) - Math.min(maxAr, (maxAr * 3) - ar))) / maxAr;
     let ary = (Math.max(0, Math.min(maxAr, ar + (maxAr * 2)) - Math.min(maxAr, (maxAr * 3 - ar))) / maxAr;/**/
     
     let p1 = ar,
      pf1 = afr;
     let p = (p1 - Math.max(0, p1 - (maxAr * 1)) - Math.max(0, p1 - (maxAr * 2)) + Math.max(0, p1 - (maxAr * 3))) / maxAr;
     let lp = (pf1 - Math.max(0, pf1 - (maxAr * 1)) - Math.max(0, pf1 - (maxAr * 2)) + Math.max(0, pf1 - (maxAr * 3))) / maxAr;
     let arx = p;
     let ary = lp
     
     
     let sx = (Math.min(arx, 1)) * (w),
      sy = (Math.min(ary, 1)) * (vh);
     
     this.rays[m].moveStart(sx, sy);
     this.rays[m].moveEnd(this.eye.x, this.eye.y);
     let h = this.rays[m];
     for (let o = 0; o < h.midpointVertexes.length; o++) {
      let c = h.midpointVertexes[o];
      c.x = Math.sin(game.frames + ((o + 1) + 60)) * 0.25;
      c.y = Math.sin(game.frames + ((o * 0.25) * 60)) * 0.25;
     }
     
    }
    
    
    for (let h of this.rays) {
     h.draw(this.ctx, this.parent.cellSize);
    }
   }
   this.fever.main.run();
   
   /*this.parent.canvasCtx.insane.drawImage(
    game.insaneEye.canvas,
    this.parent.cellSize * (this.eye.x - (this.eye.w / 2)),
    this.parent.cellSize * (this.eye.y - (this.eye.h / 2)),
    this.parent.cellSize * (this.eye.w),
    this.parent.cellSize * (this.eye.h)
   );*/
  }
  else if (this.type === 2) {
   this.frenzy.main.run();
   
  }
  else this.henshinAnim.run();
 }
}

class RPGAttributes {
 #ctx;
 #canvas;
 #text;
 #targets = {
  current: this.parent
 };
 seed = new ParkMillerPRNG();
 selectTargets(arg, pickPlayer) {
  if (arg === "this") return this.parent;
  if (arg == "allies") {
   let arr = [];
   game.forEachPlayer(player => {
    if (player.player !== this.parent.player && this.parent.team == player.team) {
     arr.push(player);
    }
   });
   return arr;
  }
  if (arg == "enemies") {
   let arr = [];
   game.forEachPlayer(player => {
    if (player.player !== this.parent.player && this.parent.team !== player.team) {
     arr.push(player);
    }
   });
   return arr;
  }
 }
 static Skill = class {
  constructor(parent, number, parameters) {
   this.parent = parent;
   this.number = number;
   this.name = parameters.name || "0";
   this.skillStatusEffects = parameters.statfx || [];
   this.skillValues = parameters.skillValues || {
    parameters: {}
   };
   /*
   Effects {
   	se: "lifesteal",
   	to: "self",
   	parameters: {...}
   }
   /**/
   this.cooldown = parameters.initcd || 0;
   this.initCD = parameters.initcd || 0;
   this.maxCD = parameters.cd || 0;
   this.skillVoice = parameters?.voice || "skill";
   //this.character = parameters.character;
   //this.image = parameters.image;
   //this.card = parameters.card;
   this.mana = parameters.mana;
   this.attributeDesc = "";
  }
  execute() {
   if (this.cooldown > 0 || this.parent.mana < this.mana) return false;
   let skillVoice = this.skillVoice;
   ////console.log(this.skillStatusEffects)
   //let skillValues = {};
   /*for (let j in this.skillValues) {
   	let value = 0;
   	if (typeof h.parameters.value == "string") {
   		let split = h.parameters.value.split("%");
   		let split2 = split.split("-");
   		value = (parseFloat(split[0]) / 100);
   	}
   	skillValues[j] = [value, split2[0], split2[1]];
   }*/
   switch (this.name) {
    //mains
    case "misty1": {
     game.forEachPlayer(player => {
      let thisBase = this.parent.selectTargets("this");
      
      for (let player of this.parent.selectTargets("enemies")) {
       let baseValue = thisBase.rpgAttr.attributes.attack;
       
       
       player.rpgAttr.addStatusEffect(thisBase.player, "periodicdmg", this.skillValues.pdmgtime, {
        value: baseValue * (this.skillValues.pdmgpercentage / 100),
        maxf: this.skillValues.pdmginterval,
        type: "burn"
       })
       
      }
     });
     break;
    }
    case "epicman1": {
     if (this.parent.parent.activeType == 0) this.parent.parent.block.stompProps.afterHardDrop = true;
     if (this.parent.parent.activeType == 1) {
      
     }
     break;
    }
    case "dominic1": {
     //this.parent.parent.halt.delays.manipulation = 220;
     let num = ~~(this.parent.seed.next() * 1);
     switch (num) {
      case 0: {
       //Nitro
       
       break;
      }
     }
     break;
     
    }
    case "eclipse1": {
     if (this.parent.parent.activeType == 1) {
      this.parent.parent.blob.insane.delay.readyHenshin = 15;
      this.parent.parent.blob.insane.delay.fixedHenshinType = 2;
     } else if (this.parent.parent.activeType == 0) {
      this.parent.parent.block.insane.delay.ready = 15;
      //this.parent.parent.blob.insane.delay.fixedHenshinType = 2;
     }
     
     break;
    }
    case "skylight1": {
     if (this.parent.parent.activeType == 0) {
      this.parent.parent.removeGarbage(8);
     }
     if (this.parent.parent.activeType == 1) {
      this.parent.parent.removeGarbage(18);
     }
     break;
    }
    case "rainuff1": {
     break;
    }
    case "phylum1": {
     if (this.parent.parent.activeType == 0) {
      this.parent.parent.removeGarbage(8 * 5);
     }
     if (this.parent.parent.activeType == 1) {
      this.parent.parent.removeGarbage(18 * 5);
     }
     break;
    }
   }
   for (let h of this.skillStatusEffects) {
    let value = 0;
    if (typeof h.parameters.value == "string") {
     let split = h.parameters.value.split("%");
     if (split[1] == "hp") {
      value = ~~((parseFloat(split[0]) / 100) * this.parent.maxHP);
     }
     else value = ((parseFloat(split[0]) / 100) * this.parent.attributes[split[1]]);
    }
    else value = h.parameters.value;
    ////console.log(h.parameters)
    let modifiedParameters = JSON.parse(JSON.stringify(h.parameters));
    modifiedParameters.value = value;
    this.parent.addStatusEffect(this.parent.parent.player, h.type, h.time, modifiedParameters);
   }
   this.cooldown = this.maxCD;
   
   this.parent.playVoice(this.number, skillVoice);
   
   
   return true;
  }
  reset() {
   this.cooldown = this.maxCD;
  }
  change(parameters) {
   
  }
 };
 constructor(parent) {
  this.parent = parent;
  this.isOn = false;
  this.maxHP = 184472;
  this.hp = 2000;
  this.mana = 1000;
  this.maxMana = 1000;
  this.absorb = 0;
  this.hpBehind = 0;
  this.isOn = false;
  this.hpDamage = 0;
  this.isWOIHPMode = false;
  this.canReceiveGarbage = 1;
  this.isRPG = false;
  this.isUsableSkills = false;
  this.warningTime = 60;
  this.isZeroHPWarning = false;
  this.deck = {
   characters: {
    
   },
   loaded: true
  };
  for (let h = 0; h < 3; h++) {
   this.deck.characters[h] = {
    skill: new RPGAttributes.Skill(this, h, {}),
    character: null,
    version: null,
    characterLast: null,
    versionLast: null,
    jsonstring: "",
    json: {},
    card: new Image(2, 2),
    skillUse: new Image(2, 2),
    isOK: false
   };
  }
  ////console.log(this.deck);
  this.isRPGOK = true;
  this.manaRegen = {
   time: 0,
   max: 40,
   value: 1
  };
  this.skillUseDisplay = {
   frame: 0,
   max: 100,
   on: false,
   using: 0,
   //TODO use pythagoras distance formula: d=√((x-X)^2+(y-Y)^2) | x = 30, y = 2(720)
   tx1: -400,
   ty1: -1000,
   tx2: -200,
   ty2: 1000
  }
  
  //this.enableSkills = false;
  
  this.DEFAULT_ATTRIBUTES = {
   attack: 10,
   atkTolerance: 10,
   defense: 100,
   lifesteal: 0,
   lfa: 0,
   deflect: 0
  };
  this.ATTRIBUTE_NAMES = Object.keys(this.DEFAULT_ATTRIBUTES);
  this.ATTRIBUTE_LENGTH = this.ATTRIBUTE_NAMES.length;
  this.attributes = JSON.parse(JSON.stringify(this.DEFAULT_ATTRIBUTES));
  
  this.statusEffectsAttributes = JSON.parse(JSON.stringify(this.DEFAULT_ATTRIBUTES));
  for (let h in this.statusEffectsAttributes) {
   this.statusEffectsAttributes[h] = 0;
  }
  this.healthBar = {
   active: new NumberChangeFuncExec(null, (val, arg) => {
    if (arg) {
     this.healthBar.behind.execute();
     this.healthBar.absorb.execute();
     this.healthBar.forecastedDmg.execute();
     
    }
    this.drawHealthBar(val, "#0e0");
    if (arg) {
     this.healthBar.measure.execute();
    }
   }),
   behind: new NumberChangeFuncExec(null, (val, arg) => {
    this.drawHealthBar(val, "#cc2222", true);
    if (arg) {
     this.healthBar.absorb.execute();
     this.healthBar.forecastedDmg.execute();
     this.healthBar.active.execute();
     this.healthBar.measure.execute();
     
     
    }
    
   }),
   forecastedDmg: new NumberChangeFuncExec(null, (val, arg) => {
    if (arg) {
     this.healthBar.behind.execute();
     this.healthBar.absorb.execute();
    }
    this.drawHealthBar(val, "#fa0");
    if (arg) {
     this.healthBar.active.execute();
     this.healthBar.measure.execute();
    }
   }),
   text: new NumberChangeFuncExec(null, (val) => {
    this.#text.innerHTML = val;
   }),
   absorb: new NumberChangeFuncExec(null, (val, arg) => {
    if (arg)
    {
     this.healthBar.behind.execute();
    }
    
    this.drawHealthBar(val, "#9a9a9a");
    if (arg)
    {
     this.healthBar.forecastedDmg.execute();
     this.healthBar.active.execute();
     this.healthBar.measure.execute();
     
    }
    
   }),
   measure: new NumberChangeFuncExec(null, (val, arg) => {
    if (arg) {
     this.healthBar.behind.execute();
     this.healthBar.absorb.execute();
     this.healthBar.forecastedDmg.execute();
     this.healthBar.active.execute();
    }
    let width = 300;
    let gap = 300 / (val / 50)
    
    let ticks = val / 50;
    
    this.#ctx.fillStyle = "#000";
    for (let gx = 0; gx < ticks; gx++)
     this.#ctx.fillRect(gx * gap, 0, 3, 70 * ((gx % 5 == 0) ? 0.45 : 0.3));
    this.#ctx.fillRect(((this.maxHP) / val) * width, 0, 3, 70 * 0.7);
   }),
  };
  
  this.statusEffects = [];
  
 }
 
 drawHealthBar(val, color, isClear) {
  if (isClear) this.#ctx.clearRect(0, 0, 300, 70);
  this.#ctx.fillStyle = color;
  this.#ctx.fillRect(0, 0, 300 * val, 70);
 }
 executeSkill(number) {
  //this.parent.playSound("skill_activate");
  if (!(this.isOn && this.isRPG && this.isUsableSkills)) return;
  
  if (this.deck.characters[number] === void 0) return;
  if (!("skill" in this.deck.characters[number])) return;
  let isOK = this.deck.characters[number].skill.execute();
  if (isOK) {
   this.parent.playSound("skill_activate");
   this.mana -= this.deck.characters[number].skill.mana;
   this.executeSkillUse(number);
  }
 }
 reset() {
  this.hp = this.maxHP;
  this.statusEffects.length = 0;
  this.canReceiveGarbage = 1;
  this.manaRegen.value = 1;
  this.manaRegen.time = 0;
  this.skillUseDisplay.on = false;
  this.isZeroHPWarning = false;
  for (let eh in this.deck.characters) {
   let h = this.deck.characters[eh];
   h.skill.cooldown = h.skill.initCD;
  }
 }
 resetAttributes() {
  this.attributes = JSON.parse(JSON.stringify(this.DEFAULT_ATTRIBUTES));
 }
 playVoice(deckn, skill) {
  this.parent.playVoice(`deck${deckn}|${skill}`);
 }
 
 loadRPG(number, directory, fileName) {
  return new Promise(async (res, rej) => {
   ////console.log(number, directory, fileName)
   
   let jsonString = await memoryManager.asyncLoad(directory + "/" + fileName);
   let json = JSON.parse(jsonString);
   let raw = {};
   let references = {};
   for (let j in json.sources.image) {
    raw[j] = await memoryManager.asyncLoad(directory + "/" + json.sources.image[j], "image");
   }
   for (let j in json.init.image) {
    references[j] = raw[j];
   }
   
   {
    let arr = [];
    let srcArr = [];
    
    
    for (let h in json.init.voices) {
     arr.push(json.init.voices[h]);
    }
    
    for (let qi of arr) {
     if (qi in json.init.voices) srcArr.push(json.sources.voices[json.init.voices[qi]]);
    }
    
    if (Object.keys(json.init.voices).length > 0) {
     await playerVoiceSystem.batchLoad(json.base, json.version, srcArr);
    }
    
    ////////console.log(json.init.voice)
    for (let hh in json.init.voices) {
     this.parent.character.voices[`deck${number}|${hh}`] = new PlayerVoice(json.base, json.version, json.sources.voices[json.init.voices[hh]]);
    }
   }
   
   //Skill
   /*let attrString = await memoryManager.asyncLoad(directory + "/" + json.init.attributesJson);
   let skill = JSON.parse(attrString).skill;*/
   //end Skill
   
   let character = this.deck.characters[number];
   character.card = raw.card;
   character.skillUse = raw.use;
   ////console.log(raw.use)
   //character.skill.mana = raw.skill.mana;
   /////console.log("done")
   
   res();
  });
 }
 
 restInPeace() {
  
 }
 
 update() {
  if (!this.isOn) return;
  if (this.hpBehind > this.hp) {
   this.hpBehind -= (this.maxHP * 0.003);
   //if (this.hpBehind <)
  }
  if (this.hpBehind < this.hp) {
   this.hpBehind = this.hp;
  }
  if (!this.isWOIHPMode) {}
  
  let absorb = 0;
  let length = this.statusEffects.length;
  this.canReceiveGarbage = 1;
  if (this.isRPG) {
   if (this.isUsableSkills) {
    this.manaRegen.time--;
    if (this.manaRegen.time <= 0) {
     this.manaRegen.time = this.manaRegen.max;
     this.addMana(this.manaRegen.value);
    }
   }
   for (let l = 0; l < this.ATTRIBUTE_LENGTH; l++) {
    let g = this.ATTRIBUTE_NAMES[l];
    this.statusEffectsAttributes[g] = 0;
   }
   for (let h = 0; h < length && !(this.parent.hasWon || this.parent.isDead); h++) {
    let gg = this.statusEffects[h];
    if (gg.isTime) {
     if (gg.time > 0) {
      gg.time--;
     } else {
      this.statusEffects.splice(h, 1);
      h--;
      length--;
      continue;
     }
    }
    switch (gg.type) {
     case "periodicdmg": {
      if (gg.parameters.frame > 0) {
       gg.parameters.frame--;
      } else {
       gg.parameters.frame = gg.parameters.maxf;
       this.addHP(-gg.parameters.value, true);
       //this.parent.playSound("shoosh_chain");
       if (this.checkZeroHP()) {
        this.parent.checkLose();
       };
      }
      break;
     }
     
     case "regen": {
      if (gg.parameters.frame > 0) {
       gg.parameters.frame--;
      } else {
       gg.parameters.frame = gg.parameters.maxf;
       if (this.hp < this.maxHP && this.hp > 0) this.addHP(gg.parameters.value);
      }
      break;
     }
     case "lsbuff": {
      this.statusEffectsAttributes.lifesteal += gg.parameters.value;
      break;
     }
     case "lfabuff": {
      this.statusEffectsAttributes.lfa += gg.parameters.value;
      break;
     }
     case "atkbuff": {
      this.statusEffectsAttributes.attack += gg.parameters.value;
      break;
     }
     case "defbuff": {
      this.statusEffectsAttributes.defense += gg.parameters.value;
      break;
     }
     case "deflect": {
      this.statusEffectsAttributes.deflect += gg.parameters.value;
      break;
     }
     case "immune2garbage": {
      /*if (gg.parameters.frame > 0) {
      	gg.parameters.frame--;
      } else {
      	gg.parameters.frame = gg.parameters.maxf;
      	this.addHP(gg.parameters.value);
      }*/
      this.canReceiveGarbage--;
      break;
     }
    }
    if (gg.type == "absorb") {
     absorb += gg.parameters.value;
    }
    
   }
  }
  this.absorb = absorb;
  let max = Math.max(this.maxHP, this.hp + absorb);
  
  
  this.healthBar.behind.assign(this.hpBehind / max, true);
  this.healthBar.absorb.assign((this.hp + absorb) / max, true);
  this.healthBar.forecastedDmg.assign(this.hp / max, true);
  this.healthBar.active.assign((this.hp - this.hpDamage) / max, true);
  this.healthBar.text.assign(this.hp);
  this.healthBar.measure.assign(max, true);
  if (this.isRPG) {
   
   this.parent.canvasClear("rpgDeck");
   let ctx = this.parent.canvasCtx.rpgDeck;
   let jk = 350 * 2;
   let km = this.parent.player % 2 == 0;
   let aspect = 550 / 250;
   
   let x = (800) - (jk * aspect / 2);
   for (let j = 0; j < 3; j++) {
    let ref = this.deck.characters[j];
    
    /*this.parent.canvasCtx.rpgDeck.drawImage(
    	ref.card,
    	0,0,550,250,
    	x, j * 301, jk*aspect, jk
    );*/
    
    
    ctx.save();
    
    ctx.translate(x, j * (jk + 5));
    ctx.scale(km ? 1 : -1, 1);
    ctx.drawImage(ref.card, 0, 0, 550, 250, km ? 0 : -(jk * aspect), 0, jk * aspect, jk);
    //ctx.setTransform(1,0,0,1,0,0)
    ctx.restore();
    ctx.textBaseline = "top";
    ctx.font = `280px josefinsans`;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    let mk = 2 * (km ? 30 : (800 - 30));
    ctx.textAlign = km ? "start" : "end";
    ctx.lineWidth = 12 * 2;
    ctx.fillText(ref.skill.mana, mk, 20 + (j * (jk + 10)));
    ctx.strokeText(ref.skill.mana, mk, 20 + (j * (jk + 10)));
    ctx.textBaseline = "ideographic";
    ctx.font = `180px default-ttf`;
    ctx.lineWidth = 7;
    ctx.fillText(ref.skill.desc, mk, (jk - 40) + (j * (jk + 10)));
    ctx.strokeText(ref.skill.desc, mk, (jk - 40) + (j * (jk + 10)));
    if (ref.skill.cooldown > 0) {
     ctx.fillStyle = "#0008";
     ctx.fillRect(x, j * (jk + 5), jk * aspect, jk);
     ctx.font = `360px josefinsans`;
     ctx.fillStyle = "#fff";
     
     ctx.textBaseline = "middle";
     ctx.textAlign = "center";
     ctx.lineWidth = 12 * 2;
     ctx.fillText((ref.skill.cooldown / 60).toFixed(1), 400, (jk / 2) + (j * (jk + 5)));
     ctx.strokeText((ref.skill.cooldown / 60).toFixed(1), 400, (jk / 2) + (j * (jk + 5)));
    }
    if (ref.skill.mana > this.mana) {
     ctx.fillStyle = "#0008";
     ctx.fillRect(x, j * (jk + 5), jk * aspect, jk);
     ctx.font = `360px josefinsans`;
     ctx.fillStyle = "#fff";
     
     
    }
    
    if (ref.skill.cooldown >= 0) ref.skill.cooldown--;
   }
   ctx.fillStyle = "#333";
   ctx.fillRect(0, 2 * 12.2 * 100, 2 * 8 * 100, 2 * 0.8 * 100);
   
   ctx.fillStyle = "#aa3";
   ctx.fillRect(0, 2 * 12.2 * 100, 2 * ~~((this.mana / this.maxMana) * 8 * 100), 2 * 0.8 * 100);
   let mk = 2 * (km ? 30 : (800 - 30));
   ctx.fillStyle = "#fff";
   ctx.textBaseline = "top";
   ctx.textAlign = km ? "start" : "end";
   ctx.lineWidth = 6 * 2;
   ctx.font = `230px josefinsans`;
   ctx.fillText("Mana: " + this.mana, mk, 40 + (3 * (jk + 10)));
   ctx.strokeText("Mana: " + this.mana, mk, 40 + (3 * (jk + 10)));
   
   if (this.skillUseDisplay.on && game1v1.on)
    do {
     let add = 0;
     if (this.skillUseDisplay.frame > 45 && this.skillUseDisplay.frame <= 55) {
      add = 0.05;
     } else add = 8;
     
     this.skillUseDisplay.frame += add;
     if (this.skillUseDisplay.frame >= this.skillUseDisplay.max) {
      this.skillUseDisplay.on = false;
      break;
     }
     let sd = this.skillUseDisplay;
     if (!this.parent.isVisible) break;
     
     let isFlip = this.parent.player % 2 == 1;
     let w = 1000 * 1.265;
     let h = 720 * 1.265;
     if (isFlip) {
      background.drawImage(this.deck.characters[sd.using].skillUse,
       0, 0, 1000, 720,
       (1280 - w) - (sd.tx1 + ((sd.frame / sd.max) * (sd.tx2 - sd.tx1))),
       (sd.ty1 + ((sd.frame / sd.max) * (sd.ty2 - sd.ty1))),
       w,
       h,
       true
      );
     } else {
      background.drawImage(this.deck.characters[sd.using].skillUse,
       0, 0, 1000, 720,
       (sd.tx1 + ((sd.frame / sd.max) * (sd.tx2 - sd.tx1))),
       (sd.ty1 + ((sd.frame / sd.max) * (sd.ty2 - sd.ty1))),
       w,
       h,
       false
      );
     }
     
    } while (false);
   this.isZeroHPWarning = false;
   if (this.hp + absorb <= this.hpDamage) {
    this.isZeroHPWarning = true;
   } else {
    let ar = 0;
    if (this.hp / this.maxHP < 0.4) {
     ar += 1;
    }
    if (this.hp / this.maxHP < 0.15) {
     ar += 1;
    }
    this.warningTime -= ar;
    
    if (this.warningTime < 0 && !this.parent.isDead && !this.parent.hasWon) {
     this.warningTime = 60;
     this.parent.playSound("rpg_lowhp");
    }
   }
  }
  
 }
 
 executeSkillUse(number) {
  let sd = this.skillUseDisplay;
  sd.on = true;
  sd.frame = 0;
  sd.using = number;
 }
 
 fetchAsset(canvas, ctx, text) {
  this.#canvas = canvas;
  this.#ctx = ctx;
  this.#text = text;
  this.#canvas.width = 300;
  this.#canvas.height = 70;
 }
 addMana(_num) {
  if (_num < 0 && this.mana < 0) return;
  this.mana += _num;
  if (this.mana < 0) this.mana = 0;
  if (this.mana > this.maxMana) this.mana = this.maxMana
 }
 addHP(_num, isBypassAbsorb) {
  if (!this.isOn) return;
  let num = ~~_num;
  let isFull = false;
  if (this.hp > this.maxHP) {
   isFull = true;
  }
  let absorbed = 0;
  let numAttack = 0;
  if (num < 0 && !isBypassAbsorb) {
   numAttack = -1 * num;
   ////console.log(num, numAttack)
   //ABSORPTION
   if (numAttack > 0) {
    let length = this.statusEffects.length;
    for (let k = 0; k < length; k++)
     if (this.statusEffects[k].type == "absorb") {
      let ma = this.statusEffects[k];
      let ref = ma.parameters;
      let value = Math.min(numAttack, ref.value);
      ref.value -= value;
      numAttack -= value;
      absorbed += value;
      
      if (ref.value <= 0) {
       ma.triggerOn("zero");
       this.statusEffects.splice(k, 1);
       k--;
       length--;
      }
     }
    
    
   }
   num = -numAttack;
  } else numAttack = -num;
  ////console.log(numAttack)
  if (num !== 0) {
   if (this.parent.isVisible) {
    let asset = this.#text.getBoundingClientRect(); //this.parent.assetRect("FIELD");
    let plw = this.isAux ? 0.47 : 1;
    let px = (asset.x);
    let py = (asset.y); // + (this.parent.fieldCellSize * this.getQPosY(this.piece.y - this.fieldSize.hh) * plw);
    htmlEffects.add(num, px, py, 40, {
     name: "damage-text-animation",
     iter: 1,
     timefunc: "cubic-bezier(0,1,1,1)",
     initdel: 0,
    }, `color: #${num > 0 ? "0a0" : "a00"}; text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black; --__chaintext_size: ${this.parent.fieldFontSize * 0.9}`)
    
    
   }
  }
  this.hp += (num);
  
  if (this.hp > this.maxHP) {
   this.hp = this.maxHP;
  }
  if (this.hp < 0) {
   this.hp = 0;
  }
  if (!isFull) {
   
  }
  return {
   hp: Math.max(numAttack, 0),
   absorb: absorbed
  };
 }
 setMaxHP(max) {
  this.maxHP = max || 1000;
  this.hp = max || 1000;
 }
 
 setMaxMana(max) {
  this.maxMana = max || 1000;
  this.mana = max || 1000;
 }
 
 checkZeroHP() {
  if (!this.isOn) return false;
  if (this.hp <= 0) {
   return true;
  }
  return false;
 }
 
 openClose(oc) {
  this.isOn = oc;
  this.parent.setStyle(`GARBAGE-TRAY-DIV`, "top", `${this.parent.fieldCellSize * -1*(2.5 + (this.isOn ? 1.5 : 0))}px`);
  this.parent.setStyle("HP-BAR-DIV", "display", this.isOn ? "flex" : "none");
  this.parent.setStyle("RPG-DECK", "display", this.isOn && this.isRPG ? "flex" : "none");
 }
 
 emulateDamage(mpl) {
  if (this.isOn) {
   let removehp = 0;
   for (let kk in mpl) {
    let lifestealOpp = this.addHP(-mpl[kk]);
    removehp = mpl[kk];
    ////console.log(removehp)
    if (kk in game.players) {
     let player = game.players[kk];
     let laa = player.rpgAttr.attributes;
     let lab = player.rpgAttr.statusEffectsAttributes;
     player.rpgAttr.addHP(lifestealOpp.hp * (laa.lifesteal + lab.lifesteal - (this.attributes.deflect + this.statusEffectsAttributes.deflect)), 0);
     player.rpgAttr.addHP(lifestealOpp.absorb * (laa.lfa + lab.lfa), 0);
     if (player.rpgAttr.checkZeroHP()) {
      player.checkLose();
     };
    }
   }
   
  }
 }
 
 static STATUS_EFFECTS = {
  regen: {
   frame: 1,
   maxf: 10,
   value: 1
   
  },
  periodicdmg: {
   frame: 1,
   maxf: 100,
   value: 1
  },
  atkbuff: {
   value: 1
  },
  atkred: {
   value: 0.7
  },
  lsbuff: {
   value: 0.7
  },
  lfabuff: {
   value: 0
  },
  defbuff: {
   value: 0
  },
  defred: {
   value: 0
  },
  absorb: {
   value: 2
  },
  purify: {
   
  },
  buffred: {
   
  },
  deflect: {
   value: 0
  },
  immune2dmg: {
   value: 100
  },
  immune2garbage: {
   
  },
  
 };
 
 addStatusEffect(player, type, time, parameters, on) {
  this.statusEffects.push(new RPGAttributes.AttrDefStatusEffect(this, player, type, time, parameters, on))
 }
 
 static AttrDefStatusEffect = class {
  constructor(parent, player, type, time, parameters, on) {
   this.isTime = time !== "unli";
   this.time = this.isTime ? time : 99;
   this.player = player;
   this.maxTime = this.isTime ? time : 99;
   this.type = type;
   this.parameters = JSON.parse(JSON.stringify(RPGAttributes.STATUS_EFFECTS[type]));
   this.on = { ...(on || {}) };
   for (let h in parameters) {
    if (h in this.parameters) this.parameters[h] = parameters[h];
   }
   ////console.log(this)
  }
  triggerOn(name) {
   if (name in this.on) this.on[name]();
  }
 }
}

const playerVoiceSystem = {
 voices: {},
 storage: {},
 storagePaths: {},
 batchLoad: function(base, version, array) {
  return new Promise(async (res, rej) => {
   try {
    let storage = this.storage;
    let dir = `assets/characters/${base}/${version || "main"}`;
    let isPath = false;
    let bversion = `${base}/${version || "main"}`;
    if (bversion in this.storagePaths) {
     isPath = true;
    } else {
     this.storagePaths[bversion] = {};
    }
    
    /*if (player in this.voices) {
    	for (let o in this.voices[player]) {
    		delete this.voices[player][o];
    	}
    	delete this.voices[player];
    } else this.voices[player] = {};*/
    let loaded = 0;
    let loadLength = 0;
    let needLoad = [];
    for (let b of array) {
     let kl = `${base}#${version}|${b}`;
     ////console.log("load " + kl)
     if (kl in this.voices) {
      continue;
     }
     this.voices[kl] = {
      main: null,
      length: 0,
      isLoad: false
     };
     
     needLoad.push([kl, b]);
     
     loadLength++;
    }
    
    if (loadLength == 0) {
     ////console.log("voice loaded");
     
     res();
     return;
     
    }
    for (let o of needLoad) {
     let kl = o[0],
      b = o[1];
     ////console.log("load " + kl);
     try {
      if (!(kl in storage)) {
       let hm = `${dir}/${b}`;
       
       
       this.voices[kl] = {
        main: audioMaster.createAudio({
         src: hm,
         loop: false,
        }),
        length: 0,
        isLoad: false
       };
       
       if (!isPath) {
        
        this.storagePaths[bversion][kl] = hm;
       }
       storage[kl] = 0;
       //let blob = URL.createObjectURL(storage[kl]);
       //let ml = `${player}#${kl}`;
       
       
       
       this.voices[kl].main.load().then(_res => {
        //console.log(kl);
        loaded++;
        this.voices[kl].isLoad = true;
        this.voices[kl].length = ~~(this.voices[kl].main.duration * 60);
        if (loaded >= loadLength) {
         ////console.log("load done")
         res();
        }
       });
       for (let nx of ["load", "loaderror"]) this.voices[kl].main.once(nx, () => {
        
       })
      };
     } catch (e) {
      
      //console.log(e)
     }
     //////console.log(kl, storage[kl])
     
    }
    
    
   } catch (e) {
    ////console.log(e)
    res();
   }
  });
 },
 
 getVoice: function(base, version, name) {
  //if (!(p in this.voices)) return null;
  let a = `${base}#${version}|${name}`;
  //////console.log(this.voices[p], a)
  if (a in this.voices) {
   //this.voices[p][a].main.rate(1);
   return this.voices[a].main;
   /*this.voices[p][a].main.play();
   this.voices[p][a].main.play();
   this.voices[p][a].main.play();
   
   this.voices[p][a].main.play();
   this.voices[p][a].main.play();
   this.voices[p][a].main.play();
   this.voices[p][a].main.play();   */
   
  }
  return null;
 },
 
 play: function(base, version, name) {
  //if (!(p in this.voices)) return;
  let a = `${base}#${version}|${name}`;
  
  if (a in this.voices) {
   this.voices[a].main.volume(game.voiceVolume / 100);
   
   return this.voices[a].main.play();
   /*this.voices[p][a].main.play();
   this.voices[p][a].main.play();
   this.voices[p][a].main.play();
   
   this.voices[p][a].main.play();
   this.voices[p][a].main.play();
   this.voices[p][a].main.play();
   this.voices[p][a].main.play();   */
   
  }
  
 },
 check: function(base, version, name) {
  //if (!(p in this.voices)) return false;
  let a = `${base}#${version}|${name}`;
  if (a in this.voices) {
   
   return this.voices[a].main.checkPlaying();
   
  }
  return false;
 },
 stop: function(base, version, name) {
  //if (!(p in this.voices)) return;
  let a = `${base}#${version}|${name}`;
  if (a in this.voices) {
   this.voices[a].main.stop();
  }
  
 },
 duration: function(base, version, name) {
  //if (!(p in this.voices)) return 0;
  let a = `${base}#${version}|${name}`;
  if (a in this.voices) {
   return this.voices[a].length;
   /*this.voices[p][a].main.play();
   this.voices[p][a].main.play();
   this.voices[p][a].main.play();
   
   this.voices[p][a].main.play();
   this.voices[p][a].main.play();
   this.voices[p][a].main.play();
   this.voices[p][a].main.play();   */
   
  }
  return 0;
 },
 
 unloadAll: function(exemptions) {
  for (let h in this.storagePaths) {
   if (h in exemptions) continue; // exemptions is an object
   for (let b in this.storagePaths[h]) {
    delete this.storagePaths[h][b];
    
   }
   delete this.storagePaths[h];
  }
 },
 
 removePlayerVoices: function() {
  //if (!(player in this.voices)) return;
  
  for (let b in this.voices[player]) {
   delete this.voices[player][b];
   
  }
  delete this.voices[player];
  
 }
 
}

class RectangularAnimations {
 #canvas;
 #testCanv
 #ctx;
 #testCtx;
 constructor(parent) {
  this.parent = parent;
  this.#canvas = new OffscreenCanvas(1235 * 3, 700 * 3);
  this.#testCanv = new OffscreenCanvas(247, 70);
  this.dim = {
   w: 247,
   h: 70
  };
  this.#ctx = this.#canvas.getContext("2d");
  this.#testCtx = this.#testCanv.getContext("2d");
  
  this.spells = {
   spell1: [0, 0],
   spell2: [1, 0],
   spell3: [2, 0],
   spell4: [0, 1],
   spell5: [1, 1],
   counter: [2, 1],
   damage2: [0, 2],
  }
  this.mainCtx;
  this.current = "none";
  this.frame = 0;
  this.maxFrames = 50;
  this.enabled = true;
  this.delay = 2.5;
 }
 load(arr) {
  this.#ctx.clearRect(0, 0, 1235 * 3, 700 * 3);
  
  
  for (let uw = 0; uw < arr.length; uw++) {
   let j = arr[uw],
    ms = this.spells[j.s];
   this.#ctx.drawImage(j.a, /*0,0,1235,700,/**/ 1235 * (ms[0]), this.dim.h * 10 * (~~(ms[1])), 1235, this.dim.h * 10);
   
  }
  this.#testCtx.drawImage(this.#canvas, 0, 0);
 }
 fetchCtx(ctx) {
  this.mainCtx = ctx;
 }
 play(spell) {
  if (this.spell !== void 0) return;
  this.current = spell || "none";
  this.frame = 0;
  this.enabled = true;
  
 }
 run() {
  
  if (this.delay > 0) {
   this.delay--;
  }
  if (this.delay <= 0 && this.enabled && this.current !== "none") {
   
   this.mainCtx.clearRect(0, 0, 247, 70);
   let m = this.spells[this.current];
   let l = 0;
   if (this.frame <= 5) {
    l = (this.frame) / 5;
   } else
   if (this.frame >= 45) {
    l = (50 - this.frame) / 5;
   } else l = 1;
   this.mainCtx.drawImage(this.#canvas,
    247 * ~~((this.frame % 5) + (m[0] * 5)),
    70 * ~~(~~(this.frame / 5) + (m[1] * 10)),
    this.dim.w,
    this.dim.h,
    0, this.dim.h * ((1 - l) / 2),
    this.dim.w,
    this.dim.h * (l)
   )
   this.frame++;
   this.delay += 2.5;
   if (this.frame > this.maxFrames) this.enabled = false;
  }
 }
}


class PlayerVoice {
 constructor(base, version, name) {
  this.base = base;
  this.version = version;
  this.name = name;
  
  this.a = playerVoiceSystem;
  this.playerTarget = [];
 }
 
 playVoice() {
  this.a.play(this.base, this.version, this.name);
 }
 stopVoice() {
  this.a.stop(this.base, this.version, this.name);
 }
 
 checkPlay() {
  return this.a.check(this.base, this.version, this.name)
 }
 
 getVoice() {
  return this.a.getVoice(this.base, this.version, this.name);
 }
 
 duration() {
  return this.a.duration(this.base, this.version, this.name);
 }
 
}

class GarbageTrayObject {
 constructor() {
  this.x = 0;
  this.gx = 0;
 }
}

class LegacyMode {
 constructor(parent) {
  this.parent = parent;
  this.isActive = false;
  this.isEnable = false;
  this.isControl = false;
  this.isWarning = false;
  this.canControl = false;
  this.isAux = false;
 }
}

class GachatrisBlock extends LegacyMode {
 
 constructor(parent) {
  super(parent);
  this.garbageLimit = 8;
  this.isInvisible = false;
  
  this.isWarningTopOut = false;
  this.isSpawnablePiece = false;
  
  this.attackType = "scorebased";
  this.piece = {
   x: 0,
   y: 0,
   rot: 0,
   template: PIECE,
   activeArr: [
    []
   ],
   active: 0,
   holdable: true,
   defaultHoldable: true,
   hold: 0,
   isAir: false,
   moved: false,
   dirty: false,
   held: false,
   enable: false,
   rotated: false,
   isHardDrop: false,
   spin: {
    spin: 0,
    mini: 0,
    x1y2: 0,
   },
   lastDrop: {
    x: 0,
    y: 0
   },
   kickTable: null,
   kickDistance: {
    x: 0,
    y: 0
   },
   spinTable: null,
   last: {
    x: 0,
    y: 0,
    
   },
   is180able: false,
   count: 0
  };
  this.stompProps = {
   delayIndex: 4,
   afterHardDrop: false,
   
  };
  
  this.delay = {};
  this.delayAdd = {};
  this.delayDefault = {
   0: 7,
   1: 35,
   2: 5,
   3: 0,
  };
  this.lcdTimes5 = 2;
  this.delayParamsLength = 8;
  this.isProfessional = false;
  this.canRaiseGarbage = true;
  
  this.warningTrig = new NumberChangeFuncExec(0, (t) => {
   this.isWarning = t;
  });
  
  this.attackDeviation = 0;
  
  this.isAllSpin = false;
  this.isTSDOnly = false;
  this.tsdCount = 0;
  this.level = 3;
  
  this.fixedGravity = [
   0, 1 / 60, 1 / 30, 1 / 25, 1 / 20, 1 / 15, 1 / 12, 1 / 10, 1 / 8, 1 / 6, 1 / 6,
   1 / 4, 1 / 4, 1 / 3, 1 / 3, 1 / 3, 1 / 2, 1, 1.5, 2, 3
  ];
  
  let lev = [0];
  
  for (let h = 0; h < 29; h++) {
   lev.push(1 / (((0.8 - ((h) * 0.007)) ** (h)) * 60));
  }
  // Proper Gravity Table
  
  this.fixedGravity = lev;
  
  
  this.nextVoice = {
   name: "",
   duration: -2,
  }
  this.attackSendDelay = -9;
  
  this.isDelayEnabled = true;
  
  this.insane = new InsaneMode("block", this);
  
  this.blockColors = {
   r: [255, 255, 255, 0, 0, 0, 127],
   g: [0, 127, 255, 255, 255, 0, 0],
   b: [0, 0, 0, 0, 255, 255, 255]
  };
  
  for (let h = 0; h < this.delayParamsLength; h++) {
   this.delay[h] = 0;
   this.delayAdd[h] = 10;
  }
  this.clear = {
   linesReady: [],
   linesDelayed: [],
   blocks: []
  };
  this.b2b = -1;
  this.combo = -1;
  this.messiness = 0.3725;
  this.currentGarbageHole = 0;
  
  this.pcSpam = {
   frame: 0,
   count: 0
  };
  
  this.rngPreview = new ParkMillerPRNG();
  
  this.preview = {
   bag: [0, 1, 2, 3, 4, 5, 6],
   queue: []
  }
  this.defaultSettings = {
   das: 9,
   arr: 1,
   gravity: this.fixedGravity[Math.min(28, this.level)],
   lock: 30,
   sft: 0.5 * 60 / 60,
  };
  this.customSettings = {
   
   das: 5,
   arr: 0,
   gravity: this.fixedGravity[Math.min(28, this.level)],
   lock: 30,
   sft: 9603,
   
  }
  this.settings = JSON.parse(JSON.stringify(this.defaultSettings));
  this.handling = {
   das: 0,
   arr: 0,
   xFirst: 0,
  }
  this.lock = {
   lowest: 0,
   reset: 15,
   delay: 30,
   delayMax: 30
  }
  this.stack = [];
  this.drawableStack = [];
  this.bitboard = new ModifiedBitboard(40, 10, 10, Uint16Array);
  this.stateBitboard = new ModifiedBitboard(40, 10, 10, Uint16Array);
  this.canForecastClear = true;
  this.fieldSize = {
   w: 10,
   h: 40,
   vh: 20,
   hh: 20
  };
  this.columnBlocks = []
  //to add cool visual effects
  
  this.effects = {
   hardDrop: new ArrayFunctionIterator((aray) => {
    for (let wm = 0, lm = aray.length; wm < lm; wm++) {
     let idx = aray[wm];
     idx.frames--;
     // drawRect(ctx
     let sx = this.parent.fieldSize.w / this.fieldSize.w;
     let sy = this.parent.fieldSize.vh / this.fieldSize.vh;
     
     let x = ~~((idx.x) * this.parent.cellSize * sx),
      y = (idx.y + 1 - (this.fieldSize.hh - this.visibleFieldBufferHeight)) * this.parent.cellSize * sy; //- (2 * this.cellSize);
     
     let c = this.parent.canvasCtx.piece;
     let depth = this.parent.cellSize * sy * (idx.dep * (idx.frames / idx.maxf));
     c.globalAlpha = Math.max(0, idx.frames) / idx.maxf;
     
     let grad = c.createLinearGradient(~~(x), ~~(y), ~~(x), ~~(y) - depth);
     let colorBase = `rgba(${this.blockColors.r[idx.blk]},${this.blockColors.g[idx.blk]},${this.blockColors.b[idx.blk]}, 1)`;
     let colorBaseZero = `rgba(${this.blockColors.r[idx.blk]},${this.blockColors.g[idx.blk]},${this.blockColors.b[idx.blk]}, 0)`;
     
     grad.addColorStop(0, colorBaseZero);
     grad.addColorStop((1 - (idx.dep - 1) / idx.dep), colorBase);
     grad.addColorStop(1, colorBaseZero);
     c.fillStyle = grad;
     
     if (this.parent.isVisible) c.fillRect(
      /*manager.skin.canvas,
      row * this.parent.cellSize,
      column * this.parent.cellSize,
      this.parent.cellSize,
      this.parent.cellSize,*/
      x,
      y - depth,
      this.parent.cellSize * sx,
      depth,
     );
     c.globalAlpha = 1;
     
     if (idx.frames <= 0) {
      aray.splice(wm, 1);
      wm--;
      lm--;
     }
     
    }
    
   }),
   appearAnim: new ArrayFunctionIterator((aray) => {
    for (let wm = 0, lm = aray.length; wm < lm; wm++) {
     let idx = aray[wm];
     idx.frames += 0.5;
     // drawRect(ctx
     let sx = this.parent.fieldSize.w / this.fieldSize.w;
     let sy = this.parent.fieldSize.vh / this.fieldSize.vh;
     
     let x = ~~((idx.x) * this.parent.cellSize * sx),
      y = (idx.y - (this.fieldSize.hh - this.visibleFieldBufferHeight)) * this.parent.cellSize * sy; //- (2 * this.cellSize);
     
     let c = this.parent.canvasCtx.piece;
     //let depth = this.parent.cellSize * sy * ((idx.frames / idx.maxf));
     /*c.globalAlpha = Math.max(0, idx.frames) / idx.maxf;

     let grad = c.createLinearGradient(~~(x), ~~(y), ~~(x), ~~(y) - depth);
     grad.addColorStop(0, "#FFF0");
     grad.addColorStop((1 - (idx.dep - 1) / idx.dep), "#FFF");
     grad.addColorStop(1, "#FFF0");
     c.fillStyle = grad;*/
     
     if (this.parent.isVisible) {
      if (idx.frames > 10) c.drawImage(
       manager.skin.canvas,
       0 * this.parent.cellSize,
       idx.cell * this.parent.cellSize,
       this.parent.cellSize,
       this.parent.cellSize,
       x,
       y,
       this.parent.cellSize,
       this.parent.cellSize,
      );
      
      let size = 2;
      
      c.drawImage(
       manager.skinAppear.canvas,
       ~~(idx.frames % 10) * 70,
       ~~(idx.frames / 10) * 70,
       70,
       70,
       (x) - (this.parent.cellSize * (size / 4)),
       (y) - (this.parent.cellSize * (size / 4)),
       this.parent.cellSize * size,
       this.parent.cellSize * size,
      );
      
      
      if (idx.frames > 30) {
       aray.splice(wm, 1);
       wm--;
       lm--;
      }
      
     }
    }
    
   }),
   clearAnim: new ArrayFunctionIterator((aray) => {
    for (let wm = 0, lm = aray.length; wm < lm; wm++) {
     let idx = aray[wm];
     idx.frames += 60 / idx.maxf;
     //this.parent.editIH("HOLD-TEXT", idx.frames)
     // drawRect(ctx
     let sx = this.parent.fieldSize.w / this.fieldSize.w;
     let sy = this.parent.fieldSize.vh / this.fieldSize.vh;
     
     let x = ~~((idx.x) * this.parent.cellSize * sx),
      y = (idx.y - (this.fieldSize.hh - this.visibleFieldBufferHeight)) * this.parent.cellSize * sy; //- (2 * this.cellSize);
     
     let c = !this.isAux ? this.parent.canvasCtx.piece : this.parent.canvasCtx.pieceAux;
     //let depth = this.parent.cellSize * sy * ((idx.frames / idx.maxf));
     /*c.globalAlpha = Math.max(0, idx.frames) / idx.maxf;
   
     let grad = c.createLinearGradient(~~(x), ~~(y), ~~(x), ~~(y) - depth);
     grad.addColorStop(0, "#FFF0");
     grad.addColorStop((1 - (idx.dep - 1) / idx.dep), "#FFF");
     grad.addColorStop(1, "#FFF0");
     c.fillStyle = grad;*/
     
     if (this.parent.isVisible) {
      let size = 4;
      
      c.drawImage(
       manager.skinClear.canvas,
       ~~(idx.frames % 10) * 70,
       ~~((idx.frames) / 10) * 70,
       70,
       70,
       (x) - (sx * this.parent.cellSize * (size / 4)) - ((sx * this.parent.cellSize) / 2),
       (y) - (sy * this.parent.cellSize * (size / 4)) - ((sy * this.parent.cellSize) / 2),
       this.parent.cellSize * size,
       this.parent.cellSize * size,
      );
      
      
      if (idx.frames > 60) {
       aray.splice(wm, 1);
       wm--;
       lm--;
      }
      
     }
    }
    
   }),
  };
  
  this.visibleFieldBufferHeight = 5;
  this.visibleFieldHeight = 0;
  
  this.garbageWait = [];
  this.meteredGarbageWaitMode = true;
  
  //for Blobs
  
  this.BLOB_REQUIRED_TARGETPOINT = 30;
  
  this.hitSoundReduce = 0;
  
  this.dasCancellation = {
   on: true,
   main: new NumberChangeFuncExec(0, (c) => {
    this.handling.das = 0;
   }),
  };
  
  this.spellTime = -3;
  this.spellAnimName = "";
  this.activeVoiceLine = "";
  
  this.repeatSpellVoice = 0;
  
  this.appearBlockFrame = -1;
  this.stackAltitude = this.fieldSize.h;
 }
 
 executeStomp() {
  this.setDelay(this.stompProps.delayIndex, 52);
  this.setDelay(3, 35);
  this.setDelay(0, 20);
  //play animation prior to the actual board stomp
  this.parent.fieldAnimations.fieldStomp.play();
 }
 stomp() {
  let board = this.stack,
   width = this.fieldSize.w,
   hiddenHeight = this.fieldSize.hh,
   height = this.fieldSize.h;
  let checked = true;
  for (let t = 0; t < height && checked; t++)
   for (var y = height - 1; y >= hiddenHeight - 2; y--) {
    for (var x = 0; x < width; x++) {
     checked = true;
     if (!this.testGridSpace(x, y - 1, width, height)) {
      continue;
     }
     if (!this.testGridSpace(x, y, width, height)) {
      board[x][y] = board[x][y - 1]
      board[x][y - 1] = 0;
      checked = false;
     }
    }
   }
  this.drawStack(this.stack);
  this.checkStackAltitude();
  
 }
 
 checkLines() {
  this.clear.linesReady.length = 0;
  let lines = 0;
  for (let y = 0; y < this.fieldSize.h; y++) {
   let count = 0;
   for (let x = 0; x < this.fieldSize.w; x++) {
    if (this.testGridSpace(x, y)) count++;
   }
   if (count >= this.fieldSize.w) {
    this.clear.linesReady.push(y);
    lines++;
   }
  }
  
  if (lines) {
   this.setDelay(2, void 0);
  }
 }
 checkStackAltitude() {
  
  let alt = this.fieldSize.h;
  for (let x = 0; x < this.fieldSize.w; x++) {
   for (let y = 0; y < this.fieldSize.h; y++) {
    if (this.stack[x][y] > 0) {
     if (y < alt) alt = y;
     break;
    }
   }
  }
  this.stackAltitude = alt;
 }
 checkWarning() {
  let isWarning = (!this.insane.isOn && (this.stackAltitude - this.parent.garbageLength) <= (this.fieldSize.hh + 5)) ? 1 : 0;
  
  this.warningTrig.assign(isWarning);
 }
 
 modifyGrid(cy, gridArr, isFlipped, isDraw, isAppearAnim) {
  this.simulateSplashOut();
  if (!isFlipped) {
   for (let x = 0; x < gridArr.length; x++) {
    for (let y = 0; y < gridArr[x].length; y++) {
     this.stack[x][y + cy] = gridArr[x][y];
     if (isAppearAnim && gridArr[x][y]) {
      this.effects.appearAnim.addItem({
       frames: -0.5,
       cell: gridArr[x][y],
       x: x,
       y: y + cy,
       
      });
     }
    }
   }
  } else {
   for (let x = 0; x < gridArr.length; x++) {
    for (let y = 0; y < gridArr[x].length; y++) {
     this.stack[x][y + cy] = gridArr[(gridArr.length - 1) - x][y];
     if (isAppearAnim && gridArr[(gridArr.length - 1) - x][y]) {
      this.effects.appearAnim.addItem({
       frames: -0.5,
       cell: gridArr[(gridArr.length - 1) - x][y],
       x: x,
       y: y + this.fieldSize.hh,
       
      });
     }
    }
   }
  };
  if (isDraw) {
   this.drawStack(this.stack);
  }
  if (isAppearAnim) {
   this.drawStack("reset");
   this.appearBlockFrame = 60;
  }
  this.checkStackAltitude();
 };
 testGridSpace(x, y) {
  if (x < 0 || x >= this.fieldSize.w) {
   return true;
  }
  if (y < this.fieldSize.h) {
   if (typeof this.stack[x][y] !== "undefined" && this.stack[x][y] !== 0) {
    return true;
   }
   return false;
  }
  return true;
 }
 
 reset() {
  this.piece.x = 0;
  this.piece.y = -295;
  this.loseDelay = -399;
  this.piece.lastDrop.x = 0;
  this.piece.lastDrop.y = -295;
  this.piece.hold = void 0;
  this.piece.rot = 0;
  this.piece.active = null;
  this.piece.count = 0;
  this.piece.activeArr = [
   []
  ];
  this.piece.isAir = false;
  this.piece.moved = true;
  this.piece.dirty = false;
  this.piece.held = false;
  this.piece.rotated = false;
  this.piece.enable = false;
  this.piece.isHardDrop = false;
  this.piece.spin.spin = 0;
  this.piece.spin.mini = 0;
  this.piece.holdable = true;
  this.b2b = -1;
  this.combo = -1;
  this.garbage = [];
  this.garbageWait.length = 0;
  this.isSpawnablePiece = true;
  this.nextVoice.duration = -999;
  this.repeatSpellVoice = 0;
  this.stompProps.afterHardDrop = false;
  this.tsdCount = 0;
  
  this.pcSpam.frame = 0;
  this.pcSpam.count = 0;
  
  this.attackSendDelay = -9;
  
  this.stackAltitude = this.fieldSize.h;
  
  this.hitSoundReduce = 0;
  
  this.delay = {};
  this.delayAdd = {};
  
  this.spellTime = -3;
  this.spellAnimName = "";
  
  //this.insane.reset();
  this.currentGarbageHole = ~~(this.parent.seeds.field.next() * this.fieldSize.w);
  
  for (let h = 0; h < this.delayParamsLength; h++) {
   this.delay[h] = -10;
   
   this.delayAdd[h] = this.isProfessional ? 0 : this.delayDefault[h];
  }
  this.lock = {
   move: 15,
   rot: 15,
   delay: 30,
  };
  this.clear.linesReady.length = 0;
  this.clear.linesDelayed.length = 0;
  this.clear.blocks.length = 0;
  this.fieldSize.w = 10;
  this.fieldSize.hh = 20;
  this.fieldSize.vh = 20;
  this.fieldSize.h = this.fieldSize.vh + this.fieldSize.hh;
  this.stack = grid(this.fieldSize.w, this.fieldSize.h, 0);
  this.bitboard = new ModifiedBitboard(this.fieldSize.h, this.fieldSize.w, this.fieldSize.w, Uint16Array);
  this.stateBitboard = new ModifiedBitboard(this.fieldSize.h, this.fieldSize.w, this.fieldSize.w, Uint16Array);
  this.drawableStack = grid(this.fieldSize.w, this.fieldSize.h, 0);
  
  this.drawStack(this.stack);
  this.drawActivePiece();
  this.previewInitialize();
  this.holdDraw();
  this.settings = JSON.parse(JSON.stringify(this.isProfessional ? this.customSettings : this.defaultSettings));
  this.handling = {
   das: 0,
   arr: 0,
   xFirst: 0,
  };
  
 }
 
 getQPosX(x) {
  let sizemult = this.isAux ? 0.47 : 1;
  return sizemult * x * (this.parent.fieldSize.w / this.fieldSize.w);
  
 }
 
 getQPosY(y) {
  let sizemult = this.isAux ? 0.47 : 1;
  return sizemult * y * ((this.parent.fieldSize.vh) / this.fieldSize.vh);
  
 }
 
 simulateSplashOut() {
  let asset = this.parent.assetRect(this.isAux ? "AUX-FIELD-CHARACTER-CANVAS" : "FIELD-CHARACTER-CANVAS");
  let sizemult = this.isAux ? 0.47 : 1;
  let aw = asset.width;
  let ah = asset.height;
  let ax = asset.x;
  let ay = asset.y;
  let bez = {
   
   x1: 0,
   x2: 0,
   x3: 1,
   x4: 1,
   y1: 0,
   y2: 0.3,
   y3: 1 + (Math.random() * 0.2),
   y4: 1,
   
  };
  for (let x = 0; x < this.fieldSize.w; x++) {
   for (let y = this.fieldSize.hh; y < this.fieldSize.h; y++)
    if (this.stack[x][y] > 0) {
     let mx = ax + (this.getQPosX(x) * this.parent.fieldCellSize) + (this.getQPosX(1) * this.parent.fieldCellSize / 2);
     let my = ay + (this.getQPosY(y - this.fieldSize.hh) * this.parent.fieldCellSize) + (this.getQPosY(1) * this.parent.fieldCellSize / 2);
     let particleSpeed = 71 + (Math.random() * 70);
     bez.y3 = 1 + (Math.random() * 0.2);
     this.parent.addParticle(true, "blobblock", 1, this.stack[x][y],
      mx,
      my,
      mx + this.getQPosX((Math.random() * 50) - (Math.random() * 50)) * this.parent.fieldCellSize,
      my + (this.getQPosY((Math.random() * 4) + 4) * this.parent.fieldCellSize) + game.resolution.h,
      particleSpeed, ((this.getQPosX(1) * this.parent.fieldCellSize) / game.cellSize), false, bez, false);
    }
  }
 }
 
 updateDelay() {
  if (!this.isDelayEnabled) return;
  let delayPrioritize = 0;
  
  for (let l = this.delayParamsLength; l >= 0; l--) {
   if (this.delay[l] >= 0) {
    delayPrioritize = l;
    break;
   }
  }
  
  
  if (delayPrioritize === 0) {
   //let lm = this.loseDelay < 0 ? !this.insane.updateDelays() : false;
   if (this.loseDelay >= 0) {
    if (this.isActive) this.loseDelay--;
   } else {
    if (!this.insane.updateDelays()) {
     this.delay[delayPrioritize]--;
    } else this.parent.isDelayStoppable = false;
    
   }
  } else {
   this.delay[delayPrioritize]--;
   this.parent.isDelayStoppable = false;
  }
  if (this.delay[this.stompProps.delayIndex] == 0) {
   this.stomp();
  }
  if (this.delay[3] == 0) {
   this.checkLines();
  }
  if (this.delay[2] == 1) this.parent.checkWaitDeterminism();
  // PRE-LINE CLEAR
  if (this.delay[2] == 0) {
   this.clearLine();
   this.spellTime = Math.max(5, Math.min(this.delay[1] - 4, 30, ));
   this.attackSendDelay = Math.max(5, Math.min(this.delay[1] - 4, 30));
  }
  
  if (this.delay[1] == 0) {
   this.stackCollapse(true);
  }
  if (this.loseDelay == 1  && this.isActive) this.parent.checkWaitDeterminism();
  if (this.loseDelay == 0) {
   this.loseDelay == -999;
   this.checkRespawnOrDie();
  }
  if (this.delay[0] == 1) this.parent.checkWaitDeterminism();
  if (this.delay[0] == 0) {
   if (this.stompProps.afterHardDrop) {
    this.stompProps.afterHardDrop = false;
    this.executeStomp();
   } else this.spawnPiece(this.previewNextBag(), false);
  }
  
  if (this.delay[delayPrioritize] == 0) {
   this.delay[delayPrioritize] = -333;
  }
  
  if (this.attackSendDelay >= 0) {
   this.attackSendDelay--;
   if (this.attackSendDelay === 1) this.parent.checkWaitDeterminism();
   if (this.attackSendDelay === 0) {
    //this.checkDropBlock();
    //this.parent.playVoice(this.nextVoice.name);
    this.emitAttack([{
     block: this.delayedGarbage,
     blob: this.delayedGarbageBlobs
    }]);
    this.delayedGarbage = 0;
    this.delayedGarbageBlobs = 0
   }
  }
 }
 
 updateContinuousDelay() {
  if (this.spellTime >= 0) {
   this.spellTime--;
   if (this.spellTime == 0) {
    this.parent.playVoice(this.activeVoiceLine);
    if (this.insane.isOn && this.insane.blocks.requireLine <= 0) {
     this.nextVoice.duration = this.parent.getVoiceDuration(this.activeVoiceLine);
     
    }
    for (let j = 1; j <= (this.repeatSpellVoice); j++) {
     this.parent.addDelayHandler(true, j * 9, () => {
      this.parent.playVoice(this.activeVoiceLine);
      
      this.nextVoice.duration = this.parent.getVoiceDuration(this.activeVoiceLine);
      
      
      
     });
    }
    this.repeatSpellVoice = 0;
    if (this.spellAnimName) this.parent.rectanim.play(this.spellAnimName);
    
   }
   
  }
  
  if (this.nextVoice.duration >= 0) {
   this.nextVoice.duration--;
   if (this.nextVoice.duration === 0) {
    //this.checkDropBlock();
    this.parent.playVoice(this.nextVoice.name);
   }
  }
 }
 
 holdShow(showhide) {
  this.parent.setStyle("HOLD", "display", !this.parent.isCompact && showhide ? "block" : "none");
  this.parent.setStyle('HOLD', "left", `${(this.parent.fieldCellSize * 0.1)}px`);
  this.parent.setStyle('HOLD', "top", `${(this.parent.fieldCellSize * 0.1)}px`);
  this.piece.holdable = showhide;
  
 }
 
 drawStack(stack) {
  if (!this.isEnable || this.isInvisible) return;
  let aux = this.isAux ? "stackAux" : "stack";
  let widthQuotient = this.parent.fieldSize.w / this.fieldSize.w;
  let heightQuotient = this.parent.fieldSize.vh / this.fieldSize.vh;
  if (stack !== void 0) {
   if (stack === "reset") {
    for (let x = 0, len = this.fieldSize.w; x < len; x++) {
     for (let y = 0, top = this.fieldSize.h; y < top; y++) {
      this.drawableStack[x][y] = 0;
     }
    }
   }
   else this.drawableStack = JSON.parse(JSON.stringify(stack));
  }
  
  this.parent.canvasClear(aux);
  if (this.canForecastClear) try {
   
   
   for (let y = this.fieldSize.hh - 1; y < this.fieldSize.h; y++) {
    for (let x = 0; x < this.fieldSize.w; x++) {
     if (this.stack[x]) this.bitboard.setCell(y, x, this.stack[x][y] ? 1 : 0)
    }
   }
  } catch (e) {
   
  }
  this.parent.drawArray(aux, this.drawableStack, 0, -1 * (this.fieldSize.hh - this.visibleFieldBufferHeight), void 0, 0, widthQuotient, heightQuotient);
 }
 
 drawActivePiece() {
  if (!this.isEnable) return;
  let aux = this.isAux ? "pieceAux" : "piece";
  this.parent.canvasClear(aux);
  if (this.piece.y < -10) return;
  let widthQuotient = this.parent.fieldSize.w / this.fieldSize.w;
  let heightQuotient = this.parent.fieldSize.vh / this.fieldSize.vh;
  this.parent.drawArray(aux, this.piece.activeArr, this.piece.x, ~~(this.piece.y) - (this.fieldSize.hh - this.visibleFieldBufferHeight), void 0, 0, widthQuotient, heightQuotient);
  let q = this.parent.canvasCtx[aux];
  let type = 3;
  q.globalAlpha = 1; //- ((game.frames % 50) / 130);
  if (!this.isInvisible) this.parent.drawArray(aux, this.piece.activeArr, this.piece.x, ~~(this.piece.y) + this.checkDrop(40) - (this.fieldSize.hh - this.visibleFieldBufferHeight), void 0, type, widthQuotient, heightQuotient);
  q.globalAlpha = 1;
  if (this.piece.spin.spin) {
   let b = 0;
   if (this.lock.delay % 8 < 2) {
    b = 1;
   } else if (this.lock.delay % 8 < 6) {
    b = 2;
   }
   this.parent.drawArray(aux, this.piece.activeArr, this.piece.x, ~~(this.piece.y) - (this.fieldSize.hh - this.visibleFieldBufferHeight), void 0, b, widthQuotient, heightQuotient);
  }
  if (this.piece.spin.mini) {
   let b = 0;
   if (this.lock.delay % 8 < 4) {
    b = 1;
   }
   this.parent.drawArray(aux, this.piece.activeArr, this.piece.x, ~~(this.piece.y) - (this.fieldSize.hh - this.visibleFieldBufferHeight), void 0, b, widthQuotient, heightQuotient);
  }
  this.isLineToClear = true;
  if (!this.piece.enable) return;
  
  let msy = ~~this.piece.y + this.checkDrop(99);
  for (let x = 0; x < this.piece.activeArr.length; x++) {
   for (let y = 0; y < this.piece.activeArr[x].length; y++) {
    if (this.piece.activeArr[x][y]) {
     this.stateBitboard.setCell(msy + y, ~~this.piece.x + x, 1);
    }
   }
  }
  let mask = (1 << this.fieldSize.w) - 1;
  ////console.log(mask)
  ////console.log(this.stateBitboard.base.toString())
  this.parent.canvasCtx.piece.globalAlpha = 0.155 + (((this.parent.inputFrames % 15) / 15) * 0.3);
  for (let g = 0; g < this.stateBitboard.base.length; g++) {
   if (this.stateBitboard.base[g] == mask) {
    
    this.parent.canvasCtx.piece.fillStyle = "#fff";
    this.parent.canvasCtx.piece.fillRect(0, this.parent.cellSize * ((g - this.fieldSize.hh + this.visibleFieldBufferHeight)), this.parent.cellSize * this.fieldSize.w, this.parent.cellSize);
    this.isLineToClear = true;
   }
  }
  this.parent.canvasCtx.piece.globalAlpha = 1;
 }
 
 checkValid(arr, cx, cy) {
  let px = cx + this.piece.x;
  let py = ~~(cy + this.piece.y)
  for (let x = 0; x < arr.length; x++) {
   for (let y = 0; y < arr[x].length; y++) {
    if (arr[x][y] && this.testGridSpace(x + px, y + py)) return false;
   }
  }
  return true;
 }
 
 checkDrop(dis) {
  let a = 0;
  while (this.checkValid(this.piece.activeArr, 0, a) && dis >= a) {
   a++;
  }
  
  return a - 1;
 }
 
 spawnPiece(index, held) {
  if (!this.isSpawnablePiece || (!this.isActive && !held)) return;
  if (this.isSpawnablePiece && this.canSpawnPiece(index, held)) {
   this.piece.spin.spin = 0;
   this.piece.spin.mini = 0;
   this.piece.y += this.checkDrop(1 + ~~(this.settings.gravity));
   //this.piece.y += this.checkDrop(1);
   let temp = this.piece.template;
   this.canRaiseGarbage = true;
   this.lock.lowest = 0;
   this.checkManipulatedPiece();
   if (this.parent.ai.active && !game.replay.isOn) {
    let h = this.piece.hold || 0;
    
    let pieceX = temp[h].x + Math.min((this.fieldSize.w - 5), ~~((this.fieldSize.w - 10) / 2)),
     pieceY = temp[h].y + this.fieldSize.hh - 2;
    this.parent.ai.evaluate(this.piece.active, this.piece.hold, this.piece.held, this.preview.queue[0], -1, -1, this.stack, pieceX, pieceY, this.piece.x, this.piece.y, this.piece.rot, this.piece.template, (fp, fx, fy, frot) => { this.parent.drawArray("stack", this.piece.template[fp].matrix[frot], fx, ~~(fy) - (this.fieldSize.hh - this.visibleFieldBufferHeight), void 0, 0) }, this.piece.count);
   }
  } else this.checkLose();
 }
 
 checkLose() {
  this.piece.enable = false;
  this.lock.delay = 30;
  this.lock.reset = 15;
  //this.lock.lowest = this.checkLowBlock();
  this.lock.lowest = 0;
  
  //this.lock.delay = 15;
  this.piece.y = -38;
  this.piece.x = 0;
  this.loseDelay = 30;
  this.piece.isAir = true;
  this.isSpawnablePiece = false;
 }
 
 immediatelyLose() {
  this.piece.enable = false;
  this.lock.delay = 30;
  this.lock.reset = 15;
  //this.lock.lowest = 0;
  this.lock.delay = 15;
  this.piece.y = -38;
  this.piece.x = 0;
  this.parent.checkLose();
  this.piece.isAir = true;
  this.isSpawnablePiece = false;
  for (let l = this.delayParamsLength; l >= 0; l--) {
   this.delay[l] = -99;
  }
 }
 
 resetGrid() {
  for (let x = 0; x < this.fieldSize.w; x++) {
   for (let y = 0; y < this.fieldSize.h; y++) {
    this.stack[x][y] = 0;
   }
  }
  this.drawStack(this.stack);
 }
 
 checkRespawnOrDie() {
  let isLose = false;
  let isWin = false;
  
  if (!this.parent.rpgAttr.isOn) {
   if (this.isTSDOnly && this.tsdCount >= 20) {
    isWin = true;
   }
   else isLose = true;
  } else {
   if (this.parent.rpgAttr.checkZeroHP()) {
    isLose = true;
   } else {
    if (this.insane.isOn && this.parent.rpgAttr.isWOIHPMode) {
     this.insane.delay.del = 5;
     this.insane.status = "fail";
     this.setDelay(0, -9);
    }
    else this.parent.rpgAttr.addHP(-(this.parent.rpgAttr.maxHP / 5), true);
    this.parent.rpgAttr.addStatusEffect(this.parent.player, "immune2garbage", 2 + 40, {});
    
    this.parent.garbage.length = 0;
    this.parent.garbageBehind.length = 0;
    this.parent.garbageLength = 0
    this.parent.garbageBehindLength = 0;
    this.parent.garbageLastForTray.assign(0);
    this.parent.garbageBehindLastForTray.assign(0);
    this.parent.rpgAttr.hpDamage = 0;
    if (this.parent.rpgAttr.checkZeroHP()) {
     isLose = true;
    }
   }
  }
  if (isLose) {
   this.parent.checkLose();
   this.delay[0] = -60;
   
   for (let l = this.delayParamsLength; l >= 0; l--) {
    this.delay[l] = -82;
    this.isSpawnablePiece = false;
   }
   
  } else if (isWin) {
   this.delay[0] = -60;
   
   for (let l = this.delayParamsLength; l >= 0; l--) {
    this.delay[l] = -82;
   }
   this.parent.checkWin();
   this.isSpawnablePiece = false;
  } else {
   this.simulateSplashOut();
   this.resetGrid();
   this.isSpawnablePiece = true;
   this.delay[0] = 10;
  }
 }
 
 canSpawnPiece(index, held) {
  let temp = this.piece.template;
  this.piece.active = index;
  this.piece.rot = 0;
  this.piece.activeArr = temp[index].matrix[0];
  this.piece.x = temp[index].x + Math.min((this.fieldSize.w - 5), ~~((this.fieldSize.w - 10) / 2));
  this.piece.y = this.fieldSize.hh - 2;
  this.lock.delay = 30;
  this.lock.reset = 15;
  
  this.piece.kickTable = temp[index].kickTable;
  this.piece.spin.spin = false;
  this.piece.spin.mini = false;
  this.piece.rotated = false;
  this.piece.isAir = false;
  this.piece.moved = false;
  this.piece.dirty = true;
  this.piece.enable = true;
  this.piece.spinTable = temp[index].spinDetection;
  
  if (!held && this.canRaiseGarbage) this.raiseGarbage();
  
  if (!this.checkValid(this.piece.activeArr, 0, 0)) return false;
  return true;
 }
 
 previewGenerateBag() {
  let pieceList = [];
  this.preview.bag.forEach(function(a) { pieceList.push(a) });
  for (var i = 0; i < pieceList.length - 1; i++)
  {
   var temp = pieceList[i];
   var rand = ~~((pieceList.length - i) * this.rngPreview.next()) + i;
   pieceList[i] = pieceList[rand];
   pieceList[rand] = temp;
  };
  return pieceList;
 }
 
 previewInitialize() {
  this.preview.queue = [];
  this.preview.queue.push.apply(this.preview.queue, this.previewGenerateBag());
  
  this.previewDraw();
 }
 
 previewModify(arr, count) {
  this.preview.queue.length = 0;
  for (let m = 0; m < count; m++)
   for (let a of arr) {
    this.preview.queue.push(a);
   }
  this.previewDraw();
 }
 
 previewNextBag(held) {
  if (!this.isSpawnablePiece && !held) return;
  
  let next = this.preview.queue.shift();
  this.preview.queue.push(...this.previewGenerateBag());
  if (!this.isActive) this.preview.queue.unshift(next);
  this.previewDraw();
  return next;
 }
 
 hold() {
  if (this.piece.enable && this.piece.holdable && this.canControl) {
   let tmp = this.piece.hold;
   if (!this.piece.held) {
    this.piece.held = true;
    if (this.piece.hold == void 0) {
     this.piece.hold = this.piece.active;
     this.spawnPiece(this.previewNextBag(true), true);
     this.parent.playSound("hold_first");
    } else {
     this.piece.hold = this.piece.active;
     this.parent.playSound("hold");
     this.spawnPiece(tmp, true);
    }
   }
   this.holdDraw();
  }
 }
 
 holdDraw() {
  if (this.isAux || !this.isEnable) return;
  if (this.parent.isCompact) {
   this.prevHoldDraw4P();
   return;
  }
  let t = this.parent;
  let ctx = "hold";
  let c = t.canvasCtx[ctx];
  this.parent.canvasClear('hold');
  if (t.isVisible) {
   c.drawImage(
    game.misc.block_hold,
    (0),
    (0),
    t.cellSize * 5,
    t.cellSize * 4,
   )
  }
  if (this.piece.hold === void 0) return;
  let m = this.piece.hold;
  
  let piece = this.piece.template[m];
  let arr = piece.matrix[0];
  let ty = 0.5,
   my = 4,
   ts = 1;
  {
   for (var x = 0, len = (arr.length); x < len; x++) {
    for (var y = 0, wid = (arr[x].length); y < wid; y++) {
     if (arr[x][y]) {
      let mc = arr[x][y];
      
      //c.fillStyle = `rgb(${Math.random()*0}, 255, 0)`;
      
      
      if (t.isVisible) c.drawImage(
       manager.skin.canvas,
       (0) * t.cellSize,
       (mc) * t.cellSize,
       t.cellSize,
       t.cellSize,
       (piece.prevx + x) * t.cellSize * ts,
       (piece.prevy + y + ty) * t.cellSize * ts,
       t.cellSize * ts,
       t.cellSize * ts,
      );
     }
    }
   }
  }
  
  
  if (this.parent.isCompact) this.prevHoldDraw4P();
  
 }
 
 previewDraw() {
  if (this.isAux || !this.isEnable) return;
  if (this.parent.isCompact) {
   this.prevHoldDraw4P();
   return;
  }
  let t = this.parent;
  this.parent.canvasClear('next');
  let ctx = "next";
  let c = t.canvasCtx[ctx];
  let ms = 0;
  for (let i = 0; i < 5; i++) {
   let m = this.preview.queue[i];
   let piece = this.piece.template[m];
   let arr = piece.matrix[0];
   let my = 4,
    ty = 0.5,
    ts = 1;
   
   if (i > 0) {
    ts = 0.85;
    ty = 0;
    my = 3;
   }
   if (this.parent.isVisible) {
    c.drawImage(
     i == 0 ? game.misc.block_next : game.misc.block_nextqueue,
     (0) * t.cellSize * ts,
     (0) * t.cellSize * ts + ms,
     t.cellSize * ts * 5,
     t.cellSize * ts * my,
    )
   }
   {
    for (var x = 0, len = (arr.length); x < len; x++) {
     for (var y = 0, wid = (arr[x].length); y < wid; y++) {
      if (arr[x][y]) {
       let mc = arr[x][y];
       
       //c.fillStyle = `rgb(${Math.random()*0}, 255, 0)`;
       
       
       if (t.isVisible) c.drawImage(
        manager.skin.canvas,
        (0) * t.cellSize,
        (mc) * t.cellSize,
        t.cellSize,
        t.cellSize,
        (piece.prevx + x) * t.cellSize * ts,
        (piece.prevy + y + ty) * t.cellSize * ts + ms,
        t.cellSize * ts,
        t.cellSize * ts,
       );
      }
     }
    }
   }
   ms += my * ts * t.cellSize;
  }
 }
 
 prevHoldDraw4P() {
  if (this.isAux || !this.isEnable) return;
  let t = this.parent;
  this.parent.canvasClear('next');
  let ctx = "next";
  let lss = 0.85;
  let c = t.canvasCtx[ctx];
  let ms = t.cellSize * ((3 * 2 * lss)),
   ns = t.cellSize * (t.fieldSize.w * 1.5 - (5 * lss * 1.33));
  let sjs = t.cellSize * (1 - lss);
  for (let i = 0; i < 5; i++) {
   let m = this.preview.queue[i];
   let piece = this.piece.template[m];
   let arr = piece.matrix[0];
   let my = 4,
    ty = 0.5,
    ts = 1;
   
   if (i > 0) {
    ts = lss;
    ty = 0;
    my = 3;
    sjs = 0;
   }
   if (this.parent.isVisible) {
    c.drawImage(
     i == 0 ? game.misc.block_next : game.misc.block_nextqueue,
     (0) * t.cellSize * ts + ns - sjs,
     (0) * t.cellSize * ts + ms,
     t.cellSize * ts * 5,
     t.cellSize * ts * my,
    );
   }
   {
    for (var x = 0, len = (arr.length); x < len; x++) {
     for (var y = 0, wid = (arr[x].length); y < wid; y++) {
      if (arr[x][y]) {
       let mc = arr[x][y];
       
       //c.fillStyle = `rgb(${Math.random()*0}, 255, 0)`;
       
       
       if (t.isVisible) c.drawImage(
        manager.skin.canvas,
        (0) * t.cellSize,
        (mc) * t.cellSize,
        t.cellSize,
        t.cellSize,
        (piece.prevx + x) * t.cellSize * ts + ns - sjs,
        (piece.prevy + y + ty) * t.cellSize * ts + ms,
        t.cellSize * ts,
        t.cellSize * ts,
       );
      }
     }
    }
   }
   {
    if (i == 0) ms -= 3 * lss * t.cellSize;
    else if (i < 2) ms -= my * ts * t.cellSize;
    else ns -= (5 * lss) * t.cellSize;
   }
  }
  
  if (this.piece.holdable) {
   let gs = t.cellSize * ((3 * 2 * lss));
   if (t.isVisible) {
    c.drawImage(
     game.misc.block_hold,
     (0),
     (gs),
     t.cellSize * 5,
     t.cellSize * 4,
    )
   }
   if (this.piece.hold === void 0) return;
   let m = this.piece.hold;
   
   let hold = this.piece.template[m];
   let harr = hold.matrix[0];
   {
    for (var x = 0, len = (harr.length); x < len; x++) {
     for (var y = 0, wid = (harr[x].length); y < wid; y++) {
      if (harr[x][y]) {
       let mc = harr[x][y];
       
       //c.fillStyle = `rgb(${Math.random()*0}, 255, 0)`;
       
       
       if (t.isVisible) c.drawImage(
        manager.skin.canvas,
        (0) * t.cellSize,
        (mc) * t.cellSize,
        t.cellSize,
        t.cellSize,
        (hold.prevx + x) * t.cellSize,
        (hold.prevy + y + 0.5) * t.cellSize + gs,
        t.cellSize,
        t.cellSize,
       );
      }
     }
    }
   }
  }
 }
 
 checkManipulatedPiece() {
  if (!this.piece.enable) return false;
  let air = this.checkValid(this.piece.activeArr, 0, 1);
  let change = false;
  
  
  if (~~this.piece.y !== ~~this.piece.last.y) {
   this.piece.last.y = ~~this.piece.y;
   change = true;
  }
  if (this.piece.dirty) {
   this.piece.dirty = false;
   change = true;
  }
  
  if (change) {
   for (let x = 0; x < this.piece.activeArr.length; x++) {
    for (let y = 0; y < this.piece.activeArr[x].length; y++) {
     if (this.piece.activeArr[x][y]) {
      if ((~~this.piece.y + y) > this.lock.lowest) {
       this.lock.lowest = ~~this.piece.y + y;
       this.lock.reset = 15;
      }
     }
    }
   }
  }
  //ih("STAT-STAT",`resets: ${this.lock.reset}, lowest alt:  ${this.lock.lowest}`)
  
  
  if (air) {
   if (!this.piece.isAir) {
    this.piece.isAir = true;
   }
  } else {
   if (this.piece.isAir) {
    this.piece.isAir = false;
    if (!this.piece.isHardDrop) {
     this.parent.playSound("lock");
    }
   }
  }
  
  if (air) {
   this.lock.delay = this.settings.lock;
   this.piece.moved = true;
  } else {
   if (this.lock.delay <= 0 || this.lock.reset <= 0) {
    this.piece.y = ~~this.piece.y;
    this.piece.lastDrop.x = this.piece.x;
    this.piece.lastDrop.y = this.piece.y;
    this.piece.held = false;
    let hasDelay = this.setDelay(0, void 0);
    this.piece.dirty = true;
    if (!this.piece.isHardDrop) {
     this.parent.playSound("lock");
    }
    this.piece.isHardDrop = false;
    this.detectSpin(!this.piece.moved && this.piece.rotated && !air);
    this.addPieceStack(this.piece.activeArr);
    
    for (let h = 0; h < this.delayParamsLength; h++) {
     if (this.delay[h] > 0) hasDelay = true;
    }
    if (hasDelay) {
     this.piece.y = -90;
     this.piece.enable = false;
    }
    
    if (this.piece.enable && this.isSpawnablePiece) {
     if (this.stompProps.afterHardDrop) {
      this.stompProps.afterHardDrop = false;
      this.executeStomp();
     } else this.spawnPiece(this.previewNextBag(), false);
    }
   }
  }
  
 }
 
 updatePiece() {
  
  if (!this.piece.enable || !this.canControl) return;
  let gravity = this.settings.gravity;
  if (this.piece.isAir) {
   if (gravity < 1) {
    this.piece.y += gravity;
   } else if (gravity == 1) {
    this.piece.y += this.checkDrop(1);
   } else if (gravity > 1) {
    this.piece.y += this.checkDrop(gravity);
   }
   this.lock.delay = this.settings.lock;
   this.checkManipulatedPiece();
  }
  // I do not use "else" for a reason that exists in an if statement above.
  if (!this.piece.isAir) {
   this.piece.y = ~~this.piece.y;
   this.lock.delay--;
   this.checkManipulatedPiece();
  }
  //this.moveX(1 * (((manager.frames % 50) < 10) ? 1 : -1));
  // (-1 * (this.fieldSize.hh - this.visibleFieldBufferHeight))
  if (this.canForecastClear) this.bitboard.copyThisBB(this.stateBitboard);
 }
 
 setDelay(type, value) {
  let delayAdd = value !== void 0 ? value : this.delayAdd[type];
  if (delayAdd <= 0) delayAdd = -10;
  this.delay[type] = delayAdd;
  return (this.delay[type] > 0);
 }
 
 rotatePiece(direction) {
  if (!this.canControl || !this.piece.enable || (!this.piece.is180able && direction == 2)) return;
  let temp = this.piece.template[this.piece.active].matrix;
  let pos = ((this.piece.rot % 4) + 4) % 4;
  let nPos = (((this.piece.rot + direction) % 4) + 4) % 4;
  let rotate = temp[nPos];
  var dirType = "right";
  switch (direction) {
   case 1:
    dirType = "right";
    break;
   case -1:
    dirType = "left";
    break;
   case 2:
    dirType = "double";
    break;
  }
  
  for (let i = 0, len = this.piece.kickTable[dirType][pos].length; i < len; i++) {
   if (this.checkValid(
     rotate,
     this.piece.kickTable[dirType][pos][i][0],
     this.piece.kickTable[dirType][pos][i][1]
    )) {
    this.parent.playSound("rotate");
    let kickX = this.piece.kickTable[dirType][pos][i][0],
     kickY = this.piece.kickTable[dirType][pos][i][1];
    this.piece.x += kickX;
    this.piece.y += kickY;
    this.piece.kickDistance.x = kickX;
    this.piece.kickDistance.y = kickY;
    this.piece.rot = nPos;
    this.piece.activeArr = rotate;
    this.lock.delay = this.settings.lock;
    
    this.lock.reset--;
    
    this.piece.moved = false;
    this.piece.rotated = true;
    this.checkManipulatedPiece();
    
    if (this.lock.reset > 0) this.detectSpin(!this.piece.moved && this.piece.rotated && !this.piece.isAir);
    if (this.piece.spin.spin) {
     this.parent.playSound("prespin");
    }
    if (this.piece.spin.mini) {
     this.parent.playSound("prespinmini");
    }
    
    
    
    
    break;
   }
  }
 }
 
 detectSpin(isMoveAir) {
  let spin = 0;
  let mini = 0;
  let x1y2 = 0;
  let check = 0;
  let posX = this.piece.x;
  let posY = ~~(this.piece.y);
  let rot = this.piece.rot;
  let a = this.piece.spinTable;
  if (isMoveAir) {
   if ((this.piece.active == 6 || this.isAllSpin) && this.piece.active !== 2) {
    for (let x = 0, len1 = a.highX[rot].length; x < len1; x++) {
     if (this.testGridSpace(posX + a.highX[rot][x], posY + a.highY[rot][x])) {
      spin++;
      check++;
     }
    }
    for (let x = 0, len1 = a.lowX[rot].length; x < len1; x++) {
     if (this.testGridSpace(posX + a.lowX[rot][x], posY + a.lowY[rot][x])) {
      mini++;
      check++;
     }
    }
    if (this.piece.kickDistance.y >= 2 && (this.piece.kickDistance.x >= 1 || this.piece.kickDistance.x <= -1)) {
     x1y2++;
    }
   }
  }
  
  this.piece.spin.spin = 0;
  this.piece.spin.mini = 0;
  //this.piece.spin.x1y2 = 0;
  
  if (check >= 3) {
   if (x1y2 > 0) {
    this.piece.spin.spin = 1;
   } else {
    if (spin > 1) {
     this.piece.spin.spin = 1;
    } else if (mini > 1) {
     this.piece.spin.mini = 1;
    }
    
   }
  }
  
  
 }
 
 moveX(shift) {
  if (!this.piece.enable || !this.canControl) return;
  if (this.checkValid(this.piece.activeArr, shift, 0)) {
   this.piece.x += shift;
   
   this.lock.reset--;
   this.lock.delay = this.settings.lock;
   this.piece.moved = true;
   this.piece.rotated = false;
   this.parent.playSound("move");
   this.checkManipulatedPiece();
  }
 }
 
 shiftDelay() {
  if (this.parent.flagPresses.right && this.handling.xFirst === 0) {
   this.handling.xFirst = 1;
  }
  if (this.parent.flagPresses.left && this.handling.xFirst === 0) {
   this.handling.xFirst = -1;
  }
  
  if (this.handling.xFirst !== 0) {
   if (this.parent.flagPresses.right && !this.parent.flagPresses.left) {
    this.handling.xFirst = 1;
   } else if (this.parent.flagPresses.left && !this.parent.flagPresses.right) {
    this.handling.xFirst = -1;
   }
  }
  
  
  
  if (!this.parent.flagPresses.right && !this.parent.flagPresses.left && this.handling.xFirst !== 0) {
   this.handling.xFirst = 0;
  }
  
  if (this.dasCancellation.on) {
   let x = 0;
   if (this.parent.flagPresses.right) x |= 0b10;
   if (this.parent.flagPresses.left) x |= 0b01;
   
   this.dasCancellation.main.assign(x);
  }
  
  if (this.parent.flagPresses.left || this.parent.flagPresses.right) {
   this.handling.das++;
   if (this.handling.das > this.settings.das) {
    this.handling.arr++;
    if (this.handling.arr > this.settings.arr) this.handling.arr = 1;
    for (let i = 0; i < this.fieldSize.w; i++) {
     let dir = 0;
     if (this.handling.xFirst === 1) {
      if (this.parent.flagPresses.left) {
       dir = -1;
      } else {
       dir = 1;
      }
     }
     if (this.handling.xFirst === -1) {
      if (this.parent.flagPresses.right) {
       dir = 1;
      } else {
       dir = -1;
      }
     }
     if (dir !== 0) this.moveX(dir);
     if (this.settings.arr !== 0) break;
    }
   }
  }
  
  
 }
 
 resetDelayAutoshiftRate() {
  this.handling.das = 0;
 }
 
 hardDrop() {
  if (this.piece.enable && this.canControl) {
   let distance = this.checkDrop(this.fieldSize.h); //this.checkDrop(Math.max(this.fieldSize.h - ~~this.settings.gravity, 0));
   let startingPos = this.piece.y;
   this.piece.y += distance;
   let endingPos = this.piece.y;
   if (distance > 0) {
    this.piece.moved = true;
    this.piece.rotated = false;
   }
   this.lock.delay = -1;
   this.piece.isHardDrop = true;
   this.parent.playSound("harddrop");
   let m = [];
   if (this.parent.rpgAttr.isOn) {
    /*this.parent.rpgAttr.addStatusEffect(this.parent.player, "absorb", 20*60, {
    	value: 25
    }, (this.parent.character.char !== "elisha") ? {} : {
    	zero: () => {
    	game.forEachPlayer(player => {
    		if (player.player !== this.parent.player) player.rpgAttr.addStatusEffect(this.parent.player, "periodicdmg", 1.5*60, {
    			value: 1,
    			maxf: 30
    		});
    	});
    		
    }
    });*/
   }
   
   this.parent.score += Math.max(distance - ~~this.settings.gravity, 0) * 2;
   for (let x = 0, km = this.piece.activeArr.length; x < km; x++) {
    for (let y = 0, mm = this.piece.activeArr[x].length; y < mm; y++) {
     if (this.piece.activeArr[x][y]) {
      m.push(x + this.piece.x);
      m.push(y + this.piece.y);
      break;
     }
    }
   }
   
   if (!this.isInvisible) {
    let bez = {
     x1: 0,
     x2: 0.1,
     x3: 0.9,
     x4: 1,
     y1: 0,
     y2: 0.1,
     y3: 0.1,
     y4: 1,
    };
    let particleSpeed = 50 + ~~(Math.random() * 20);
    let asset = this.parent.assetRect(this.isAux ? "AUX-FIELD-CHARACTER-CANVAS" : "FIELD-CHARACTER-CANVAS");
    let sizemult = this.isAux ? 0.47 : 1;
    let aw = asset.width;
    let ah = asset.height;
    let ax = asset.x;
    let ay = asset.y;
    let qw = sizemult * (this.parent.fieldSize.w / this.fieldSize.w);
    let qh = sizemult * ((this.parent.fieldSize.vh) / this.fieldSize.vh);
    let cs = this.parent.fieldCellSize;
    //TODO addBasicParticle()
    for (let yo = 0; yo < 5; yo++)
     for (let x = 0, km = this.piece.activeArr.length; x < km; x++) {
      for (let y = 0, mm = this.piece.activeArr[x].length; y < mm; y++) {
       if (this.piece.activeArr[x][y]) {
        let rx = Math.random();
        let ry = Math.random();
        this.parent.addBasicParticle(true,
         (ax) + ((x + this.piece.x) * cs) + (cs * rx),
         (ay) + ((y + this.piece.y - this.fieldSize.hh) * cs) + (cs * ry),
         (ax) + ((x + this.piece.x) * cs) + (cs * rx),
         (ay) + ((y + this.piece.y - 2 - (Math.random() * 12) - this.fieldSize.hh) * cs),
         particleSpeed, 0.025, false, bez, false);
       };
      }
     }
    
    
    
    
    
    let ln = m.length;
    let ll = Math.max(distance, 10);
    /*for (let depth = 0; depth < ll; depth++) */
    for (let lk = 0; lk < ln; lk += 1) {
     let zx = m[lk * 2],
      zy = (m[(lk * 2) + 1]);
     this.effects.hardDrop.addItem({
      x: zx,
      y: zy,
      frames: 40,
      maxf: 40,
      dep: ll,
      blk: this.piece.active
     });
    }
   }
   
   
   this.checkManipulatedPiece();
  }
 }
 
 softDrop() {
  if (this.piece.enable && this.canControl) {
   
   if (this.piece.isAir) {
    let gravity = (this.settings.gravity * (20));
    if (this.isProfessional) gravity = this.settings.sft;
    let initial = Math.floor(this.piece.y);
    if (gravity < 1) {
     this.piece.y += gravity;
    } else if (gravity == 1) {
     this.piece.y += this.checkDrop(1);
    } else if (gravity > 1) {
     this.piece.y += this.checkDrop(gravity);
    }
    let final = Math.floor(this.piece.y);
    if (initial !== final) {
     this.piece.moved = true;
     this.parent.score += final - initial;
     
    }
    this.checkManipulatedPiece();
   }
   
   //this.lock.delay = -1;
  }
 }
 
 addPieceStack(arr) {
  let lines = 0;
  let valid = false;
  let hasDelay = false;
  this.clear.linesReady.length = 0;
  this.piece.count++;
  for (let x = 0; x < arr.length; x++) {
   for (let y = 0; y < arr[x].length; y++) {
    if (arr[x][y]) {
     let px = x + this.piece.x;
     let py = ~~(y + this.piece.y);
     this.stack[px][py] = arr[x][y];
     if (py >= this.fieldSize.hh) {
      
      valid = true;
     }
    }
   }
  }
  
  
  let isPuffOut = false;
  
  
  for (let y = 0; y < this.fieldSize.h; y++) {
   let count = 0;
   for (let x = 0; x < this.fieldSize.w; x++) {
    if (this.testGridSpace(x, y)) count++;
   }
   if (count >= this.fieldSize.w) {
    this.clear.linesReady.push(y);
    lines++;
   }
  }
  
  
  
  if (lines == 0) {
   this.combo = -1;
   if (this.piece.spin.spin) {
    this.parent.playSound("tspin0");
    this.parent.score += 400 * this.level;
   }
   if (this.piece.spin.mini) {
    this.parent.playSound("tspinmini0");
    this.parent.score += 100 * this.level;
   }
   
   if (this.combo < 0) {
    this.parent.engageCleartextCombo(true, 0);
   }
   
   /*for (let p = 0, len = this.garbageWait.length; p < len; p++) {
    let k = this.gar
   }*/
   if (this.garbageWait.length > 0) {
    
    this.emitAttack(this.garbageWait, true);
    console.log(this.garbageWait)
    
    this.garbageWait.length = 0;
   }
   
   //if (this.parent.garbageBlocking === "full" && this.isProfessional) this.raiseGarbage();
   if (this.parent.garbageBlocking !== "linkblob-full" && this.parent.garbageBlocking === "full") {
    this.canRaiseGarbage = true;
   }
   if (this.insane.isOn) {
    this.insane.delay.del = 10;
    this.insane.status = "fail";
    this.nextVoice.name = `insane_fail`;
    this.nextVoice.duration = 20;
    this.setDelay(0, 50);
   }
   if (this.isAux) isPuffOut = true;
  } else {
   hasDelay = this.setDelay(2, void 0); //|| this.setDelay(4, 83);
   
   //this.executeStomp();
   if (this.parent.garbageBlocking === "limited") {
    this.canRaiseGarbage = true;
   }
  }
  
  if (isPuffOut) {
   for (let x = 0; x < arr.length; x++) {
    for (let y = 0; y < arr[x].length; y++) {
     if (arr[x][y]) {
      let px = x + this.piece.x;
      let py = ~~(y + this.piece.y);
      this.stack[px][py] = 0;
      
      this.effects.clearAnim.addItem({
       x: px,
       y: py,
       frames: 0,
       maxf: 25
      });
      
     }
    }
   }
  }
  
  
  if ((!this.insane.isUnlimited || this.insane.isCommandedEnd) && (this.insane.time <= 0 || this.insane.isCommandedEnd) && this.insane.isOn) {
   this.insane.delay.turningOff = 5;
   this.setDelay(0, 5);
  }
  
  if (!hasDelay) {
   this.clearLine();
  }
  if (this.isTSDOnly && ((this.piece.active !== 6 || (!this.piece.spin.spin || lines !== 2)) && lines > 0)) {
   valid = false;
   
   
  }
  
  if (!this.isActive) this.canRaiseGarbage = false;
  
  this.drawStack(this.stack);
  this.checkStackAltitude();
  if (!valid) {
   
   this.checkLose();
   hasDelay = this.setDelay(2, -1);
  }
  if (this.stompProps.afterHardDrop) {
   this.stompProps.afterHardDrop = false;
   this.executeStomp();
   return
  }
 }
 
 stackCollapse(sound) {
  let hasAbove = false;
  for (let j = 0, len = this.clear.linesDelayed.length; j < len; j++) {
   let y = this.clear.linesDelayed.shift();
   for (let full = y; full >= 1; full--) {
    for (let x = 0; x < this.fieldSize.w; x++) {
     if (this.stack[x][full - 1]) hasAbove = true;
     this.stack[x][full] = this.stack[x][full - 1];
    }
   }
  }
  
  
  if (sound && hasAbove) this.parent.playSound("collapse");
  
  if (this.canRaiseGarbage) {
   
   this.raiseGarbage();
   this.canRaiseGarbage = false;
  }
  this.drawStack(this.stack);
  this.checkStackAltitude();
 }
 
 emitAttack(marr, isLaunch) {
  let add = [];
  
  let neutralized = false;
  
  let remaining = 0;
  
  let attack = 0;
  
  let particleSpeed = this.parent.particleGarbageDelay;
  
  for (let l = 0, os = marr.length; l < os; l++) {
   
   let remain = 0;
   let atkblob = marr[l].blob;
   let atkmax = marr[l].block;
   let j = {
    a: marr[l].blob,
    surplus: 0
   }
   
   if (this.parent.activeType === 1) j = this.garbageConversion(marr[l].block);
   let count = this.parent.activeType == 0 ? marr[l].block : j.a;
   
   let max = atkblob;
   
   while (this.parent.garbage.length > 0 && this.parent.garbageBlocking !== "none" && count > 0) {
    let reference = this.parent.garbage[0];
    if (reference.count <= 0) {
     this.parent.garbage.shift();
     continue;
    };
    neutralized = true;
    let min = Math.min(reference.count, count);
    reference.count -= min;
    if (reference.count === 0) {
     this.parent.garbage.shift();
    }
    count -= min;
    atkblob -= min;
   }
   
   while (this.parent.garbageBehind.length > 0 && this.parent.garbageBlocking !== "none" && count > 0) {
    let reference = this.parent.garbageBehind[0];
    if (reference.count <= 0) {
     this.parent.garbageBehind.shift();
     continue;
    };
    neutralized = true;
    let min = Math.min(reference.count, count);
    reference.count -= min;
    if (reference.count === 0) {
     this.parent.garbageBehind.shift();
    }
    count -= min;
    atkblob -= min;
   }
   if (atkblob < 0) atkblob = 0;
   remain += atkblob;
   
   /*while (count > 0) {
    if (this.parent.garbageBlocking !== "none") {
     this.parent.garbage[0];
     neutralized = true;
    }
    else remain++;
    count--;
   }*/
   
   remaining += count;
   attack += max;
   if (remain > 0) add.push({
    atk: remain,
    max: max,
    atkblock: ~~Math.max(1, atkmax * (remain / max))
   });
  }
  this.parent.garbageLength = this.parent.calculateGarbage();
  this.parent.garbageBehindLength = this.parent.calculateGarbageBehind();
  if (neutralized) this.parent.rpgAttr.hpDamage = this.parent.calculateHPDamage();
  if (this.parent.isGarbageCollectionMode) {
   neutralized = true;
   for (let l = 0, os = add.length; l < os; l++) {
    this.parent.woi.add(add[l].atk);
   }
   add.length = 0;
  }
  
  let blobatk = 0,
   blockatk = 0;
  for (let l = 0, os = add.length; l < os; l++) {
   blobatk += add[l].atk;
   blockatk += add[l].atkblock;
  }
  
  let asset = this.parent.assetRect(this.isAux ? "AUX-FIELD-CHARACTER-CANVAS" : "FIELD-CHARACTER-CANVAS");
  let sizemult = this.isAux ? 0.47 : 1;
  let aw = asset.width;
  let ah = asset.height;
  let ax = asset.x;
  let ay = asset.y;
  
  let selfTarget = this.parent.assetRect("GARBAGE-TRAY-DIV");
  let gw = selfTarget.width;
  let gh = selfTarget.height
  let gx = selfTarget.x;
  let gy = selfTarget.y;
  let cs = this.parent.fieldCellSize;
  
  let qw = sizemult * (this.parent.fieldSize.w / this.fieldSize.w);
  let qh = sizemult * ((this.parent.fieldSize.vh) / this.fieldSize.vh)
  
  let ifllSound = true;
  let m = this.hitSoundReduce;
  
  let bez = {
   x1: 0,
   x2: 0.9,
   x3: 1,
   x4: 1,
   y1: 0,
   y2: 0.9,
   y3: 1,
   y4: 1,
  };
  
  if (add.length > 0) {
   if (this.meteredGarbageWaitMode && !isLaunch) {
    for (let l = 0, os = add.length; l < os; l++) {
     this.garbageWait.push({
      block: add[l].atkblock,
      blob: add[l].atk
     });
     
    }
   } else {
    let z = this.sendGarbage(add, this.parent.activeType);
    
    
    if (Object.keys(z).length > 0) {
     game.forEachPlayer(e => {
      if (e.player in z) {
       
       let target = e.assetRect("GARBAGE-TRAY-DIV");
       let tw = target.width;
       let th = target.height
       let tx = target.x;
       let ty = target.y;
       e.addDelayHandler(false, (particleSpeed * (neutralized ? 2 : 1)), () => {
        e.playSound(`hit${Math.max(Math.min(5, attack - m - 2), 1)}`);
        e.garbageLastForTray.assign(e.garbageLength);
        e.garbageBehindLastForTray.assign(e.garbageBehindLength);
        if (!e.isDying && !e.isFinishAble && !e.isDead) e.engageShakeIntensityHit(Math.max(Math.min(5, attack - m - 2), 1));
        animatedLayers.create(undefined, 30,
         tx + (tw / 2),
         ty + (th / 2),
         0,
         0,
         0,
         200,
         200,
         12,
         12,
         0.5,
         "block_hit",
         10,
         this.cellSize,
        );
       });
       
       //TODO REM
       e.check1v1Overhead(true, e.garbageLength + e.garbageBehindLength, e.garbageLength + e.garbageBehindLength, false);
       
       
       
       if (!neutralized) {
        e.addParticle(true, "attack", 0, 0,
         (ax) + (this.piece.lastDrop.x * cs),
         (ay) + ((this.piece.lastDrop.y - this.fieldSize.hh) * cs),
         tx + (tw / 2),
         ty + (th / 2),
         particleSpeed, 2.5, false, bez, true, {
          frame: particleSpeed * (0.3 + (Math.min(9, attack) * 0.1)),
          r: 255,
          g: 255,
          b: 255,
         });
       } else {
        e.addDelayHandler(true, particleSpeed, () => {
         e.addParticle(true, "attack", 0, 0,
          gx + (gw / 2),
          gy + (gh / 2),
          tx + (tw / 2),
          ty + (th / 2),
          particleSpeed, 2.5, false, bez, true, {
           frame: particleSpeed * (0.3 + (Math.min(9, attack) * 0.1)),
           r: 255,
           g: 255,
           b: 255,
          });
         
        });
       }
       
      }
      
     });
    }
    this.hitSoundReduce = 0;
   }
   if (this.meteredGarbageWaitMode && !isLaunch) {
    let garbageWait = 0;
    for (let qq = 0, leng = this.garbageWait.length; qq < leng; qq++) garbageWait += this.garbageWait[qq].blob;
    this.parent.playSound(`charge${garbageWait > 13 ? "_high" : ""}`);
    this.hitSoundReduce = 0;
    ifllSound = false;
   }
   
  }
  
  if ((neutralized) && attack > 0) {
   
   this.parent.addParticle(true, "attack", 0, 0,
    (ax) + (this.piece.lastDrop.x * cs),
    (ay) + ((this.piece.lastDrop.y - this.fieldSize.hh) * cs),
    gx + (gw / 2),
    gy + (gh / 2),
    particleSpeed, 2.5, false, bez, true, {
     frame: particleSpeed * (0.3 + (Math.min(9, attack) * 0.1)),
     r: 255,
     g: 255,
     b: 255,
    });
   
   
   this.parent.addDelayHandler(true, this.parent.particleGarbageDelay, () => {
    this.parent.garbageLastForTray.assign(this.parent.garbageLength);
    this.parent.garbageBehindLastForTray.assign(this.parent.garbageBehindLength);
    this.parent.playSound(`hit${Math.max(Math.min(5, attack - m - 2), 1)}`);
    animatedLayers.create(undefined, 30,
     gx + (gw / 2),
     gy + (gh / 2),
     0,
     0,
     0,
     200,
     200,
     12,
     12,
     0.5,
     "block_hit",
     10,
     this.cellSize,
    );
   })
  }
  
 }
 
 garbageConversion(mu) {
  let h = 0;
  let g = 0;
  let l = 4;
  let q = 0;
  while (h < mu) {
   h++;
   if (h == 1) g += 4;
   else g += 1 + ~~(q / 2.5);
   q++;
  }
  return {
   a: g,
   surplus: Math.max(0, mu - h)
  };
 }
 
 sendGarbage(lt, m) {
  this.parent.playerTarget.length = 0;
  let garbageTarget = {};
  let hpDamage = (this.parent.rpgAttr.attributes.attack + this.parent.rpgAttr.statusEffectsAttributes.attack) + (this.parent.rpgAttr.attributes.atkTolerance * this.parent.seeds.field.next());
  let blockToBlobDivisor = 1.8;
  manager.forEachPlayer(player => {
   if (player.player !== this.parent.player && player.team !== this.parent.team) this.parent.playerTarget.push(player.player);
  });
  let add = 0;
  let addBlock = 0;
  let amtBlock = [];
  for (let b = 0, o = lt.length; b < o; b++) {
   add += lt[b].atk;
   amtBlock.push(lt[b].atkblock);
  }
  
  let amtBlob = 0;
  
  let totalAdd = add;
  let isRandomBlockGarb = !this.isProfessional;
  
  let isWait = false;
  // block to blob conversion
  let h = 0;
  let g = 0;
  let l = 4;
  let q = 0;
  if (m === 0)
   while (h < totalAdd) {
    h++;
    if (h == 1) g += 4;
    else g += 1 + ~~(q / 2.5);
    q++;
   }
  amtBlob = [g];
  manager.forEachPlayer(player => {
   if ((player.rpgAttr.isOn ? (player.rpgAttr.canReceiveGarbage > 0) : true) && this.parent.playerTarget.indexOf(player.player) !== -1) {
    
    if (player.activeType === 1) {
     player.addGarbage(this.parent.player, m == 0 ? amtBlob : amtBlock, isWait, false, 70, hpDamage * (1 / (blockToBlobDivisor)));
    }
    if (player.activeType === 0) {
     player.addGarbage(this.parent.player, amtBlock, isWait, isRandomBlockGarb, 10, hpDamage);
     
    }
    if (add > 0) garbageTarget[player.player] = add;
    
   }
  });
  
  
  return garbageTarget;
 }
 raiseGarbage() {
  let a = this.parent.garbage.filter(m => m.frames <= this.parent.inputFrames && !m.wait),
   len = a.length,
   count = 0,
   removeHp = 0;
  let mpl = {};
  
  
  let j = [];
  if (len > 0)
   for (let s = 0, qw = this.parent.garbage; s < qw.length; s++) {
    j.push(qw[s].id);
   }
  
  while (len > 0) {
   let r = a[0]; //a.shift();
   let index = j.indexOf(r.id);
   if (r.count > 0) {
    //this.parent.garbage.shift();
    
    index = j.indexOf(r.id);
    
    for (var x = 0; x < this.fieldSize.w; x++) {
     for (var y = 0; y < this.fieldSize.h; y++) {
      this.stack[x][y] = this.stack[x][y + 1];
     }
    }
    for (var x = 0; x < this.fieldSize.w; x++) {
     this.stack[x][this.fieldSize.h - 1] = 9 + this.parent.garbageType;
    }
    if (r.allmess) {
     if ((this.parent.seeds.field.next()) < this.messiness) {
      while (true) {
       let la = ~~(this.parent.seeds.field.next() * this.fieldSize.w);
       if (la !== this.currentGarbageHole) {
        this.currentGarbageHole = la;
        break;
       }
      }
     }
     this.stack[(this.currentGarbageHole)][this.fieldSize.h - 1] = 0;
    }
    else this.stack[r.row][this.fieldSize.h - 1] = 0;
    count++;
    r.count--;
   }
   if (this.parent.garbage[index].count <= 0) {
    
    this.parent.garbage.splice(index, 1);
    j.splice(index, 1);
    a.shift(); /**/
    len--;
   }
   
   //removeHp += r.hpdmg;
   
   //#83
   if (this.parent.rpgAttr.isOn) game.forEachPlayer(player => {
    if (r.player === player.player) {
     if (player.player in mpl) mpl[player.player] += r.hpdmg;
     else mpl[player.player] = r.hpdmg;
    }
   });
   
   
   
   if (count >= this.garbageLimit && this.garbageLimit > 0) break;
   
  }
  if (count > 0) {
   this.parent.playSound("garbage");
   if (count > 1 && count < 4) {
    this.parent.playVoice("damage1");
    this.voiceDelay = -3;
   }
   if (count > 3) {
    this.parent.playVoice(count > 9 ? "damage3" : "damage2");
    this.parent.rectanim.play("damage2");
    this.voiceDelay = -3;
   }
   this.parent.rpgAttr.emulateDamage(mpl);
   
   this.canRaiseGarbage = this.parent.garbageBlocking == "linkblob-full" || this.parent.garbageBlocking !== "full";
   let isLose = false;
   if (this.parent.rpgAttr.isOn && this.parent.rpgAttr.checkZeroHP()) {
    isLose = true;
   }
   if (isLose) this.immediatelyLose();
   
   
   
   this.parent.garbageLength = this.parent.calculateGarbage();
   this.parent.garbageLastForTray.assign(this.parent.garbageLength);
   
   this.parent.rpgAttr.hpDamage = this.parent.calculateHPDamage();
   //this.parent.rpgAttr.setHPDamageValye
   
   this.drawStack(this.stack);
   this.checkStackAltitude();
  }
 }
 
 clearLine() {
  
  let lines = 0;
  let isPC = !this.insane.isOn;
  let hasDelay = false;
  let isCounter = false;
  let firstY = 0;
  let lengthLines = this.clear.linesReady.length;
  this.clear.blocks.length = 0;
  for (let m = 0, h = this.clear.linesReady.length; m < h; m++) {
   let y = this.clear.linesReady.shift();
   if (m == 0) firstY = y + (lengthLines / 2);
   lines++;
   if (this.insane.isOn) {
    this.insane.blocks.requireLine--;
   }
   for (let x = 0; x < this.fieldSize.w; x++) {
    this.clear.blocks.push({
     x: x,
     y: y,
     c: this.stack[x][y]
    });
    this.stack[x][y] = 0;
   };
   this.clear.linesDelayed.push(y);
   
  }
  
  for (let y = 0; y < this.fieldSize.h; y++) {
   for (let x = 0; x < this.fieldSize.w; x++) {
    if (this.testGridSpace(x, y)) isPC = false;
    else this.stack[x][y] = 0;
   }
  }
  
  if (lines > 0) {
   hasDelay = this.setDelay(1, void 0);
   this.delay[1] += this.isProfessional ? 0 : (~~(lines / this.lcdTimes5) * 5);
   hasDelay = this.delay[1] > 0;
   if (!this.isProfessional && isPC) { hasDelay = this.setDelay(1, 0); }
   
   this.combo++;
   if (this.combo > 0 && !this.isAux) {
    if (!this.insane.isOn) this.parent.engageCleartextCombo(true, 1, `${this.combo} Combo`);
   }
   if (this.piece.spin.spin) {
    if (this.piece.active !== 6) {
     let letter = ["z", "l", "o", "s", "i", "j", "t"][this.piece.active];
     this.parent.engageCleartext("spin", true, language.translate(`${letter}spin`));
    } else this.parent.engageCleartextTSpin(true, 0, lines);
    if (!this.insane.isOn) this.b2b++;
    if (this.isTSDOnly && (this.piece.active == 6 && lines == 2)) {
     this.tsdCount++;
     if (this.tsdCount < 20) this.parent.playSound(`tspin_correct`);
     else this.parent.playSound(`tspin${lines}`);
     if (this.tsdCount == 20) this.parent.playSound(`tspin_complete`);
    } else
     this.parent.playSound(`tspin${Math.min(lines, 3)}${this.b2b > 0 ? "_b2b" : ""}`);
   } else if (this.piece.spin.mini) {
    if (this.piece.active !== 6) {
     let letter = ["z", "l", "o", "s", "i", "j", "t"][this.piece.active];
     this.parent.engageCleartext("spin", true, language.translate(`${letter}spin`));
    } else
     
     this.parent.engageCleartextTSpin(true, 1, lines);
    if (!this.insane.isOn) this.b2b++;
    if (this.isTSDOnly && (this.piece.active == 6 && lines == 2)) {
     this.parent.playSound(`tspin_correct`);
     this.tsdCount++;
    } else
     this.parent.playSound(`tspinmini${Math.min(lines, 3)}${this.b2b > 0 ? "_b2b" : ""}`);
   } else if (lines > 3) {
    if (!this.insane.isOn) this.b2b++;
    this.parent.playSound(`line${Math.min(lines, 4)}${this.b2b > 0 ? "_b2b" : ""}`);
   } else {
    this.b2b = -1;
    this.parent.playSound(`line${Math.min(lines, 4)}`);
   }
   
   if (isPC) {
    let asset = this.isAux ? this.parent.assetRect("AUX-FIELD") : this.parent.assetRect("FIELD");
    let plm = this.isAux ? 0.47 : 1;
    
    let ax = asset.x;
    let ay = asset.y;
    let px = ax + ((this.piece.lastDrop.x) * this.parent.fieldCellSize * plm);
    let py = ay + ((this.piece.lastDrop.y - this.fieldSize.hh) * this.parent.fieldCellSize * plm);
    
    let tx = ax + ((this.parent.fieldSize.w / 2) * this.parent.fieldCellSize * plm);
    let ty = ay + ((this.parent.fieldSize.hh * 0.294) * this.parent.fieldCellSize * plm);
    
    animatedLayers.create(undefined, 60,
     tx,
     ty,
     0,
     0,
     0,
     200,
     200,
     12,
     12,
     1,
     "perfect_clear",
     10,
     plm * 1.2,
    );
    
    let bez = {
     
     x1: 0,
     x2: 0,
     x3: 1,
     x4: 1,
     y1: 0,
     y2: 0.3,
     y3: 1 + (Math.random() * 0.2),
     y4: 1,
     
    };
    
    this.pcSpam.frame = 20 * 60;
    this.pcSpam.count++;
    if (this.pcSpam.count >= 3) {
     htmlEffects.add(language.translate("pc_spam"), px, py, 50, {
      name: "chain-text-anim",
      iter: 1,
      timefunc: "cubic-bezier(0,0,1,0)",
      initdel: 0,
     }, `text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black; --__chaintext_size: 1.4em; color: #fff7`);
     //this.insane.delay.ready = 15;
    }
    
    for (let m = 0, h = this.clear.blocks.length; m < h; m++) {
     let n = this.clear.blocks[m];
     let y = n.y;
     let x = n.x;
     let c = this.isInvisible ? 1 : n.c;
     
     
     
     
     let mx = ax + (this.getQPosX(x) * this.parent.fieldCellSize) + (this.getQPosX(1) * this.parent.fieldCellSize / 2);
     let my = ay + (this.getQPosY(y - this.fieldSize.hh) * this.parent.fieldCellSize) + (this.getQPosY(1) * this.parent.fieldCellSize / 2);
     let particleSpeed = 121 + (Math.random() * 70);
     bez.y3 = 1 + (Math.random() * 0.2);
     this.parent.addParticle(true, "blobblock", 1, c,
      mx,
      my,
      mx + this.getQPosX((Math.random() * 50) - (Math.random() * 50)) * this.parent.fieldCellSize,
      my + (this.getQPosY((Math.random() * 4) + 4) * this.parent.fieldCellSize) + game.resolution.h,
      particleSpeed, ((this.getQPosX(1) * this.parent.fieldCellSize) / game.cellSize), false, bez, false, false, {
       speed: (Math.random() * 180) - (Math.random() * 180)
      })
     
     
    }
    
    /*htmlEffects.add("Perfect Clear", px, py, 50, {
    	name: "chain-text-anim",
    	iter: 1,
    	timefunc: "cubic-bezier(0,0,1,0)",
    	initdel: 0,
    }, `text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black; --__chaintext_size: 1.4em; color: #fff`);*/
   }
   if (this.piece.active !== 6) {
    
    this.parent.engageCleartext("line", true, language.translate(`line${lines}`));
    
    
    if (this.piece.spin.spin || this.piece.spin.mini) {
     let letter = ["z", "l", "o", "s", "i", "j", "t"][this.piece.active];
     this.parent.engageCleartext("spin", true, language.translate(`${letter}spin${this.piece.spin.mini ? "mini" : ""}`));
    } else if (lines > 5) this.parent.engageCleartext("spin", true, language.translate(`line5`));
   } else if (!(this.piece.spin.spin || this.piece.spin.mini)) {
    if (lines > 5) this.parent.engageCleartext("spin", true, language.translate(`line5`));
    this.parent.engageCleartext("line", true, language.translate(`line${lines}`));
   }
   
   if (this.parent.garbageBlocking !== "linkblob-full" && this.parent.garbageBlocking == "full") {
    this.canRaiseGarbage = false;
   }
   if (this.isTSDOnly && !this.isAux) this.parent.engageCleartext("b2b", this.tsdCount > 0, language.translate("tsd_" + (this.tsdCount == 1 ? "singular" : "plural"), [this.tsdCount]));
   else if (!this.insane.isOn && !this.isAux) this.parent.engageCleartext("b2b", this.b2b > 0, language.translate("b2b", [this.b2b]));
   
   
   
   if (this.parent.canAttack) {
    this.hitSoundReduce = 0;
    let garbage = this.getAttack(0, lines, this.piece.spin.spin, this.b2b, this.combo, isPC);
    let garbageBlob = this.getAttack(1, lines, this.piece.spin.spin, this.b2b, this.combo, isPC);
    if (isPC) this.hitSoundReduce += 4;
    
    if (this.piece.spin.spin == 1) {
     if (lines == 2) this.hitSoundReduce++;
     if (lines == 3) this.hitSoundReduce += 2;
    }
    
    isCounter = this.parent.garbageLength > 0 && garbage > this.parent.garbageLength && !this.meteredGarbageWaitMode && !isPC && lines > 2;
    
    
    
    if (!hasDelay) {
     this.emitAttack([{
      block: garbage,
      blob: garbageBlob
     }]);
    } else {
     this.delayedGarbage = garbage;
     this.delayedGarbageBlobs = garbageBlob;
    }
    
   }
   
   let lm = this.executeSpellName(lines, this.piece.spin.spin, this.b2b, this.combo, isPC, isCounter);
   this.activeVoiceLine = this.executeVoice(lines, this.piece.spin.spin, this.b2b, this.combo, isPC, isCounter);
   
   if (this.insane.isOn) {
    this.setDelay(0, 10);
    this.setDelay(1, 25);
    this.parent.insaneBg.moveEye(this.fieldSize.w / 2, firstY - this.fieldSize.hh);
    
    this.parent.insaneBg.changeColorCustom(
     this.blockColors.r[this.piece.active],
     this.blockColors.g[this.piece.active],
     this.blockColors.b[this.piece.active],
    );
    if (this.insane.blocks.requireLine <= 0) {
     this.insane.delay.del = 10;
     this.insane.status = "success";
     let ji = 1;
     if (this.insane.blocks.phase >= 4) ji++;
     if (this.insane.blocks.phase >= 7) ji++;
     if (this.insane.blocks.phase >= 10) ji++;
     if (this.insane.blocks.phase >= 13) ji++;
     this.activeVoiceLine = lm = `spell${ji}`;
     
     
     this.nextVoice.name = `insane_success`;
     
     this.repeatSpellVoice = Math.max(Math.min(this.insane.blocks.seq - 4), 0);
     
     
     this.setDelay(0, 50);
    } else {
     this.insane.blocks.seq++;
     this.activeVoiceLine = this.insane.blocks.seq >= 5 ? "init5" : `init${this.insane.blocks.seq}`;
     lm = "";
     
     this.nextVoice.duration = -1;
    }
    
   }
   
   if (hasDelay) {
    this.spellAnimName = lm;
    //this.setDelay(0, 2);
   } else {
    this.spellAnimName = lm;
    this.stackCollapse(false);
    
    this.parent.playVoice(this.activeVoiceLine);
    if (this.spellAnimName !== "") this.parent.rectanim.play(this.spellAnimName);
   }
   
   let spinDetected = this.piece.spin.spin,
    miniDetected = this.piece.spin.mini;
   
   if (hasDelay)
    for (let m = 0, h = this.clear.linesDelayed.length; m < h; m++) {
     let y = this.clear.linesDelayed[m];
     
     for (let x = 0; x < this.fieldSize.w; x++) {
      this.effects.clearAnim.addItem({
       x: x,
       y: y,
       frames: 0,
       maxf: this.delay[1] * (((y % 2 == 0) ? (x) : (this.fieldSize.w - (x))) / this.fieldSize.w)
      });
     }
    }
   
   if (lines > 4) {
    let score = lines * 200;
    if (isPC) score *= 2.5;
    if (spinDetected) score *= 1.5;
    if (miniDetected) score *= 1.2;
    if (this.b2b > 0) score *= 1.5 + (0.1 * (lines - 4));
    score *= this.level;
    this.parent.score += ~~score;
   } else this.parent.score += this.level * (SCORE_TABLE[isPC ? "pc" : "nopc"][`${this.b2b > 0 ? "" : "no"}b2b`][`${spinDetected ? "spin" : miniDetected ? "mini" : "line"}`][lines] + SCORE_TABLE.combo * Math.max(0, this.combo))
   this.parent.swapMode.add("combo");
   this.drawStack(this.stack);
   
  }
 }
 getAttack(type, line, spin, b2b, combo, pc, garbage) {
  let a = 0,
   b = 0;
  if (this.attackType == "multiplier") {
   
   if (line > 3) {
    b = spin ? (line * 2) : line;
   } else if (line == 1) {
    b = spin ? 2 : 0;
   } else if (line == 2) {
    b = spin ? 4 : 1;
   } else if (line == 3) {
    b = spin ? 6 : 2;
   }
   if (b2b > 0) b += 1;
   b *= 1;
   
   a = b + ((b / 4) * combo);
   //if (b == 0) a += [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3][Math.min(combo, 20)] * 1;
   if (b == 0) {
    let s = 0;
    let z = 1;
    let lm = 4;
    let kp = 0;
    while (s < combo) {
     if (s >= z) {
      a++;
      kp++;
      z += ((kp - 1) * 2) + (kp * lm);
     }
     s++;
    }
   }
   if (pc && line > 0) {
    a += 10;
   }
   //break;
  } else if (this.attackType == "scorebased") {
   
   let base = 1;
   let c = 0;
   let g = this.parent.blob.decreaseTargetPoint;
   let h = this.parent.blob.targetPoint;
   if (type == 1) {
    if (line > 3) {
     c = base * (spin ? (line * 2) : line);
    }
    if (line == 3) c = base * (spin ? 4 : 2);
    if (line == 2) c = base * (spin ? 3 : 1);
    if (line == 1) c = base * (spin ? 2 : 0);
   }
   if (type == 0) {
    if (line > 3) {
     c = base * (spin ? (line * 2) : line);
    }
    if (line == 3) c = base * (spin ? 6 : 2);
    if (line == 2) c = base * (spin ? 4 : 1);
    if (line == 1) c = base * (spin ? 2 : 0);
   }
   if (combo <= 1) { c += base * 0.50; }
   else if (combo > 1 && combo <= 6) { c += base * 1; }
   else if (combo > 6 && combo <= 10) { c += base * 2; }
   else if (combo > 10 && combo <= 14) { c += base * 3; }
   else if (combo > 14 && combo <= 18) { c += base * 4; }
   else if (combo > 18) { c += base * 5; }
   
   if (b2b > 0) c += base;
   if (pc) {
    if (type == 1) c = base * 6;
    if (type == 0) c = base * 10;
   }
   
   
   a = ~~(c + ((c / 8) * ((70 - (h - g)) / 2)));
   
  } else if (this.attackType == "scorebasedSwap") {
   
   let base = 1;
   let c = 0;
   if (line > 3) c = base * (spin ? (line * 2) : line);
   if (line == 3) c = base * (spin ? 6 : 2);
   if (line == 2) c = base * (spin ? 4 : 1);
   if (line == 1) c = base * (spin ? 2 : 0);
   if (combo <= 1) { c += base * 0.50; }
   else if (combo > 1 && combo <= 3) { c += base * 1; }
   else if (combo > 3 && combo <= 5) { c += base * 2; }
   else if (combo > 5 && combo <= 7) { c += base * 3; }
   else if (combo > 7 && combo <= 10) { c += base * 4; }
   else if (combo > 10) { c += base * 5; }
   
   if (b2b > 0) c += base;
   if (pc) c = base * 10;
   c *= (1 + (0.2 * this.parent.swapMode.a));
   
   
   a = ~~(c + ((c / 4) * ((this.parent.blob.decreaseTargetPoint - 1) / this.parent.blob.targetPoint)));
  } else if (this.attackType == "scorebasedWMW") {
   
   let base = 1;
   let c = 0;
   if (line > 3) c = base * (spin ? (line * 2) : line);
   if (line == 3) c = base * (spin ? 4 : 2);
   if (line == 2) c = base * (spin ? 3 : 1);
   if (line == 1) c = base * (spin ? 2 : 0);
   if (combo <= 1) { c += base * 0.50; }
   else if (combo > 1 && combo <= 6) { c += base * 1; }
   else { c += base * (1 + ~~((combo - 6) / 4)); }
   
   if (b2b > 0) c += base;
   if (pc) c = base * 6;
   
   let g = this.parent.blob.decreaseTargetPoint;
   let h = this.parent.blob.targetPoint;
   a = ~~(c + ((c / 8) * ((70 - (h - g)) / 2)));
   
  } else if (this.attackType == "normal") {
   if (pc && line > 0) {
    a = 10;
   } else {
    if (line > 3) {
     a = spin ? (line * 2) : line;
    } else if (line == 1) {
     a = spin ? 2 : 0;
    } else if (line == 2) {
     a = spin ? 4 : 1;
    } else if (line == 3) {
     a = spin ? 6 : 2;
    }
    
    if (combo > 1 && combo <= 3) { a += 1; }
    else if (combo > 3 && combo <= 5) { a += 2; }
    else if (combo > 5 && combo <= 7) { a += 3; }
    else if (combo > 7 && combo <= 10) { a += 4; }
    else if (combo > 10) { a += 5; };
    
    if (b2b > 0) a += 1;
   }
   
   
   
  }
  return Math.floor(a);
 }
 
 executeVoice(line, spin, b2b, combo, pc, counter) {
  let a = 0,
   b = 0;
  let str = "";
  if (this.isAux) return "";
  if (this.attackType === "scorebased") {
   if (pc && line > 0) {
    a = 10;
   } else {
    if (line > 3) {
     a = 4
    } else if (line == 1) {
     a = spin ? 2 : 0;
    } else if (line == 2) {
     a = spin ? 4 : 1;
    } else if (line == 3) {
     a = spin ? 6 : 2;
    }
   }
   
   if (combo > 1 && combo <= 6) { a += 1; }
   else if (combo > 6 && combo <= 10) { a += 2; }
   else if (combo > 10 && combo <= 14) { a += 3; }
   else if (combo > 14 && combo <= 18) { a += 4; }
   else if (combo > 18) { a += 5; };
   
   if (b2b > 0) a += 1;
  } else {
   if (pc && line > 0) {
    a = 10;
   } else {
    if (line > 3) {
     a = 4;
    } else if (line == 1) {
     a = spin ? 2 : 0;
    } else if (line == 2) {
     a = spin ? 4 : 1;
    } else if (line == 3) {
     a = spin ? 6 : 2;
    }
   }
   
   if (combo > 1 && combo <= 3) { a += 1; }
   else if (combo > 3 && combo <= 5) { a += 2; }
   else if (combo > 5 && combo <= 7) { a += 3; }
   else if (combo > 7 && combo <= 10) { a += 4; }
   else if (combo > 10) { a += 5; };
   
   if (b2b > 0) a += 1;
  }
  if (line > 4) str = `gtrisplus`;
  else if (line == 4) str = `gtris`;
  else if (a === 0) str = `init${Math.min(combo + 1, 5)}`;
  else if (a > 0) str = `spell${Math.min(a, 5)}`;
  
  if (counter) str = "counterattack";
  
  
  return str;
 }
 executeSpellName(line, spin, b2b, combo, pc, counter) {
  let a = 0,
   b = 0;
  let str = "";
  if (this.isAux) return str;
  if (this.attackType === "scorebased") {
   if (pc && line > 0) {
    a = 10;
   } else {
    if (line > 3) {
     a = 4
    } else if (line == 1) {
     a = spin ? 2 : 0;
    } else if (line == 2) {
     a = spin ? 4 : 1;
    } else if (line == 3) {
     a = spin ? 6 : 2;
    }
   }
   
   if (combo > 1 && combo <= 6) { a += 1; }
   else if (combo > 6 && combo <= 10) { a += 2; }
   else if (combo > 10 && combo <= 14) { a += 3; }
   else if (combo > 14 && combo <= 18) { a += 4; }
   else if (combo > 18) { a += 5; };
   
   if (b2b > 0) a += 1;
  } else {
   if (pc && line > 0) {
    a = 10;
   } else {
    if (line > 3) {
     a = 4;
    } else if (line == 1) {
     a = spin ? 2 : 0;
    } else if (line == 2) {
     a = spin ? 4 : 1;
    } else if (line == 3) {
     a = spin ? 6 : 2;
    }
   }
   
   if (combo > 1 && combo <= 3) { a += 1; }
   else if (combo > 3 && combo <= 5) { a += 2; }
   else if (combo > 5 && combo <= 7) { a += 3; }
   else if (combo > 7 && combo <= 10) { a += 4; }
   else if (combo > 10) { a += 5; };
   
   if (b2b > 0) a += 1;
  }
  //if (line > 3) str = ``;
  //if (a === 0) str = `init${Math.min(combo + 1, 5)}`;
  if (a > 0) str = `spell${Math.min(a, 5)}`;
  
  if (counter) str = "counter";
  
  
  return str;
 }
}

class NeoBlobIndividual {
 constructor(type, blob, xOffset, yOffset, disOffset, rotOffset) {
  this.type = type;
  this.blob = blob;
  this.offset = {
   x: xOffset || 0,
   y: yOffset || 0,
   distance: disOffset || 0,
   rot: rotOffset || 0
  }
 }
}

class NeoBlobGhost {
 constructor(blob, x, y) {
  this.x = x;
  this.y = y;
  this.color = blob;
 }
}

class NeoplexianBlob extends LegacyMode {
 
 constructor(parent) {
  super(parent);
  this.opponentGarbageBehind = {};
  
  this.isWarningTopOut = false;
  this.isSpawnablePiece = true;
  this.isFever = false;
  this.warningTrig = new NumberChangeFuncExec(0, (t) => {
   this.isWarning = t;
  });
  
  this.isChainUp = false;
  
  this.isDelayEnabled = true;
  this.insane = new InsaneMode("blob", this);
  this.colors = 4;
  this.colorSet = [1, 2, 3, 4, 5];
  this.isSpecialDropset = false;
  this.piece = {
   x: 0,
   y: 0,
   rot: 0,
   delay: 0,
   rotAnim: {
    timeAnim: 0,
    maxTime: 5,
    rot: 0,
    curRot: 0,
    diffRot: 0
   },
   activeArr: [
    []
   ],
   active: {
    parameters: {
     sx: 0,
     sy: 0,
     matrix: [
      []
     ],
     type: 0,
     color1: 0,
     color2: 0
    },
    type: 0,
    color1: 1,
    color2: 1,
    colorRot: 0,
   },
   dropset: [],
   dropsetN: 0,
   isBig: false,
   isAir: false,
   moved: false,
   dirty: false,
   held: false,
   enable: false,
   rotated: false,
   isHardDrop: false,
   kickTable: null,
   
   kickDistance: {
    x: 0,
    y: 0
   },
  };
  for (let i = 0; i < 16; i++) this.piece.dropset.push(0);
  
  this.dropForecast = {
   stack: [
    []
   ],
   blobs: [],
   poppable: [],
   PERMANENT_MASK: 512
  }
  
  this.lastPiece = {
   x: 0,
   y: 0,
   rot: 0
  };
  this.delay = {};
  this.delayAdd = {};
  this.delayDefault = {
   0: 10,
   1: 40,
   2: 4
  };
  this.delayParamsLength = 8;
  for (let h = 0; h < this.delayParamsLength; h++) {
   this.delay[h] = -30;
   this.delayAdd[h] = 10;
  }
  
  this.decreaseTargetPoint = 1;
  this.fixedAtkHandicap = 1;
  this.targetGarbagePlayer = {};
  
  this.rngPreview = new ParkMillerPRNG();
  
  this.preview = {
   bag: BLOBS.c2,
   queue: []
  };
  this.settings = {
   das: 8,
   arr: 4,
   gravity: 2 / 60,
   lock: 40,
   sft: 35 / 60,
  };
  this.handling = {
   das: 0,
   arr: 0,
   xFirst: 0,
  };
  this.lock = {
   move: 15,
   rot: 15,
   delay: 30,
   delayMax: 30,
   lockSoftdrop: 2,
  };
  this.lockPrevent = {
   rotate: 0
  };
  this.stack = [];
  this.drawableStack = [];
  this.poppedStack = [];
  this.firstGroupsPop = [];
  this.fieldSize = {
   w: 6,
   h: 32,
   vh: 12,
   hh: 20
  };
  this.defaultFieldSize = {
   w: 6,
   hh: 30,
   vh: 12,
   h: 42
  }
  
  this.activeBlobDisplay = {
   two: {
    "1|0": new NeoBlobIndividual(0, 0, 1, 1, 1, -1),
    "1|1": new NeoBlobIndividual(0, 0, 1, 1, 0, -1),
   },
   three: {
    "1|0": new NeoBlobIndividual(0, 0, 1, 1, 1, -1),
    "1|1": new NeoBlobIndividual(0, 0, 1, 1, 0, -1),
    "2|1": new NeoBlobIndividual(0, 0, 1, 1, 1, 0),
    
   },
   four: {
    
   }
  };
  
  this.rotateAnimationTimer = 0;
  this.rotateAnimationType = 0;
  
  this.visibleFieldBufferHeight = 3;
  this.visibleFieldHeight = 0;
  
  this.chain = 0;
  this.actualChain = 0;
  this.previousChain = 0;
  this.forecastedChain = 0;
  this.requiredChain = -2;
  this.isChainOffsetting = false;
  this.eraseInfo = [];
  this.erasedBlocks = [];
  this.holes = 0;
  this.delayDrop = -73;
  //TODO blob req
  this.blobRequire = 2;
  this.delayedGarbage = 0;
  this.divScoreTrash = 0;
  this.targetPoint = 0.70;
  
  this.NUISANCE = 6;
  this.HARD = 7;
  
  this.garbageOrder = {
   on: true,
   order: [0, 3, 2, 5, 1, 4],
   n: 0
  };
  
  this.dasCancellation = new NumberChangeFuncExec(0, (c) => {
   this.handling.das = 0;
  });
  
  this.dstModulus = 0;
  this.pop = {
   x: 0,
   y: 0
  };
  this.rotate180Timer = 0;
  
  this.canFallTrash = true;
  this.canFallTrashAfterFever = true;
  
  this.activeVoiceLine = "";
  this.repeatSpellVoice = 0;
  this.nextVoice = {
   name: "",
   duration: -2,
  }
  
  this.effects = {
   drop: new ArrayFunctionIterator((aray) => {
    let frames = 0;
    let isExist = false;
    let c = this.parent.canvasCtx[this.isAux ? "pieceAux" : "piece"];
    for (let wm = 0, lm = aray.length; wm < lm; wm++) {
     let idx = aray[wm];
     let landing = false;
     
     let bouncebackInt = 0;
     
     if (!("delay" in idx)) {
      idx.delay = -38;
     }
     
     if (!("landFrames" in idx)) {
      idx.landFrames = 0;
      //idx.landMax = 0;
     }
     if (!("landMax" in idx)) {
      
      idx.landMax = idx.landFrames;
     }
     
     if (!("triggerBoardRot" in idx)) {
      idx.triggerBoardRot = false;
     }
     
     if (idx.delay > 0) {
      idx.delay--;
     } else if (idx.frames >= 0) {
      idx.frames--;
      
     } else if (idx.landFrames >= 0) {
      idx.landFrames--;
      
     }
     frames += Math.max(0, idx.frames) + Math.max(0, idx.landFrames);
     
     if (idx.frames === 0 && idx.isLandSound) {
      switch (idx.isLandSound) {
       case 1: {
        this.parent.playSound("blub_drop");
        break;
       }
       case 2: {
        this.parent.playSound("blub_garbage1");
        break;
       }
       case 3: {
        this.parent.playSound("blub_garbage2");
        break;
       }
      }
     }
     if (idx.frames == 0) {
      if (idx.triggerBoardRot && this.triggerBoardRotates.garbageLanding.on) {
       this.parent.executeRotateWobble(this.triggerBoardRotates.garbageLanding.intensity, 40, this.isAux);
      }
     }
     //let bez = Math.min(bezier((idx.maxf - idx.frames) / idx.maxf, idx.y0, idx.y1, 0, 0, 0, 1), idx.y1);
     //NEXT
    }
    for (let wm = 0, lm = aray.length; wm < lm; wm++) {
     let idx = aray[wm];
     
     let landing = idx.delay <= 0 && idx.frames < 0 && idx.landFrames >= 0;
     let kf = Math.max(0, idx.frames);
     
     let sizeBez = 1;
     let yBez = idx.y0 + Math.min(idx.y1, (((idx.maxf - kf) / idx.maxf) * (idx.y1 - idx.y0)));
     let py = yBez;
     if (idx.fallType == 2) {
      py = Math.min(bezier((idx.maxf - idx.frames) / idx.maxf, idx.y0, idx.y1, 0, 0, 0, 1), idx.y1);
      if (landing && idx.frames < 0) {
       
       let mm = 0;
       if ((idx.landFrames % 5) > 3) {
        mm = 0.5;
       }
       py = idx.y1 + mm;
       sizeBez = 1 - mm;
      }
     } else if (idx.fallType == 1) {
      py = idx.y0 + Math.min(idx.y1, (((idx.maxf - kf) / idx.maxf) * (idx.y1 - idx.y0)));
      if (landing && idx.frames < 0) {
       
       let mm = 0;
       if ((idx.landFrames % 5) > 3) {
        mm = 0.5;
       }
       py = idx.y1 + mm;
       sizeBez = 1 - mm;
      }
     } else {
      py = idx.y0 + Math.min(idx.y1, (((idx.maxf - kf) / idx.maxf) * (idx.y1 - idx.y0)));
      if (landing && idx.frames < 0) {
       
       py = Math.max(idx.y1 + bezier((idx.landFrames) / idx.landMax, 0, 0.5, 0, 0, 0, 1), idx.y1);
       sizeBez = -Math.min(bezier((idx.landFrames) / idx.landMax, 0, 0.5, 0, 0, 0, 1), 0.5) + 1;
      }
     }
     //let bez = (idx.y0 + ((idx.y1 - idx.y0) * ((idx.maxf- idx.frames) / idx.maxf)));
     let sx = this.parent.fieldSize.w / this.fieldSize.w;
     let sy = this.parent.fieldSize.vh / this.fieldSize.vh;
     
     let x = ~~((idx.x) * this.parent.cellSize * sx),
      y = (py - (this.fieldSize.hh)) * this.parent.cellSize * sy; //- (2 * this.cellSize);
     
     
     
     
     
     
     if (this.parent.isVisible && frames > 0) {
      c.drawImage(
       manager.skinBlob.canvas,
       ((idx.cell == 6 && this.parent.garbageType == 0) ? 1 : 0) * this.parent.cellSize,
       (idx.cell - 1) * this.parent.cellSize,
       this.parent.cellSize,
       this.parent.cellSize,
       x,
       y + (this.parent.cellSize * this.parent.visibleFieldBufferHeight),
       this.parent.cellSize * sx,
       this.parent.cellSize * sy * sizeBez,
      );
      
      let ta = this.parent.canvasses[this.isAux ? "pieceAux" : "piece"];
      c.clearRect(0, 0, ta.width, this.parent.cellSize * this.parent.visibleFieldBufferHeight);
      
     }
     
     
     
     
    }
    if (frames <= (0) && aray.length > 0) {
     aray.length = 0;
     //this.parent.canvasClear(c);
     this.drawStack(this.stack);
    }
   }),
   //next: new ArrayFunctionIterator()
   /*drop: new ArrayFunctionIterator((aray) => {
    let frames = 0;
    for (let wm = 0, lm = aray.length; wm < lm; wm++) {
     let idx = aray[wm];
     if (!("delay" in idx)) {
      idx.delay = -38;
     }
   
     if (idx.delay > 0) {
      idx.delay--;
     } else if (idx.frames > 0) {
      idx.frames--;
      if (idx.frames === 0 && idx.isLandSound) {
       switch (idx.isLandSound) {
        case 1: {
         this.parent.playSound("blub_drop");
         break;
        }
        case 2: {
         this.parent.playSound("blub_garbage1");
         break;
        }
        case 3: {
         this.parent.playSound("blub_garbage2");
         break;
        }
   
       }
      }
     }
     frames += idx.frames + (idx.frames > 0 ? 1 : 0);
   
     let bez = Math.min(bezier(idx.frames / idx.maxf, idx.y1, idx.y0, 0, 1, 1, 1), idx.y1);
     //let bez = (idx.y0 + ((idx.y1 - idx.y0) * ((idx.maxf- idx.frames) / idx.maxf)));
     let sx = this.parent.fieldSize.w / this.fieldSize.w;
     let sy = this.parent.fieldSize.vh / this.fieldSize.vh;
   
     let x = ~~((idx.x) * this.parent.cellSize * sx),
      y = (bez - (this.fieldSize.hh)) * this.parent.cellSize * sy; //- (2 * this.cellSize);
   
     let c = this.parent.canvasCtx[this.isAux ? "pieceAux" : "piece"];
   
   
   
     if (this.parent.isVisible) {
      c.drawImage(
       manager.skinBlob.canvas,
       0 * this.parent.cellSize,
       idx.cell * this.parent.cellSize,
       this.parent.cellSize,
       this.parent.cellSize,
       x,
       y + (this.parent.cellSize * this.parent.visibleFieldBufferHeight),
       this.parent.cellSize * sx,
       this.parent.cellSize * sy,
      );
   
      let ta = this.parent.canvasses[this.isAux ? "pieceAux" : "piece"];
      c.clearRect(0, 0, ta.width, this.parent.cellSize * this.parent.visibleFieldBufferHeight);
   
     }
   
   
   
   
    }
    if (frames <= 0 && aray.length > 0) {
     aray.length = 0;
     this.drawStack(this.stack);
    }
   })*/
   next: {
    a: new ObjectFunctionIterator((object) => {
     let frame = this.effects.next.frame;
     let max = this.effects.next.max;
     for (let j in object) {
      let ref = object[j];
      let x1 = (ref.px1 + ref.sx1);
      let y1 = (ref.py1 + ref.sy1);
      let x2 = (ref.px2 + ref.sx2);
      let y2 = (ref.py2 + ref.sy2);
      let ox = x1 + ((x2 - x1) * ((frame) / max));
      let oy = y1 + ((y2 - y1) * ((frame) / max));
      let ms = 1.5;
      
      let isSameColor = ref.color1 == ref.color2;
      
      if (ref.type == 4) {
       this.drawRect("blobNext",
        ox / 2,
        oy / 2,
        0,
        ref.color1,
        ms * 2,
        ms * 2,
        false);
      } else {
       this.drawArray(
        "blobNext",
        ref.blob,
        ox,
        oy,
        void 0,
        0,
        ms, ms,
        false, false
       );
      }
     }
    }),
    frame: 0,
    max: 6
   }
  }
  
  for (let hb = 0; hb < 3; hb++) {
   this.effects.next.a.addItem(hb, {
    blob: [
     [0]
    ],
    type: 0,
    color1: 0,
    color2: 0,
    px1: 0,
    px2: 0,
    py1: [-1.5, 0.5, 2.5][hb],
    py2: [0.5, 2.5, 3.5][hb],
    sx1: 0,
    sy1: 0,
    sx2: 0,
    sy2: 0
   });
  }
  
  this.blobColors = {
   r: [255, 255, 0, 0, 255, 255, 0, 127],
   g: [255, 0, 255, 0, 255, 0, 0, 0],
   b: [255, 0, 0, 255, 0, 255, 255, 255]
  };
  this.triggerBoardRotates = {
   garbageLanding: {
    on: false,
    intensity: 2
   },
   a: {
    intensity: 0
   }
  };
  
  this.allClearText = {
   
   a: new NumberChangeFuncExec(null, (l) => {
    let a = this.allClearText;
    a.frame = a.max;
    a.current = l;
    let o = a.presets[l];
    a.bez = o[4];
    a.on = o[0];
    a.start[0] = o[1][0];
    a.start[1] = o[1][1];
    a.end[0] = o[2][0];
    a.end[1] = o[2][1];
    
    a.max = o[3];
    a.frame = o[3];
    
   }),
   on: false,
   current: 0,
   start: [20, 1],
   end: [0, 1],
   frame: 0,
   max: 30,
   bez: {
    y1: 0,
    y2: 0.9,
    y3: 1,
    y4: 1,
    s1: 0,
    s2: 0.9,
    s3: 1,
    s4: 1,
   },
   presets: ALL_CLEAR_ANIMATION_PRESETS
  };
  this.isAllClear = false;
  this.isAllClearTemp = -9;
 }
 
 runAllClearAnim(aux) {
  let isBool = this.allClearText.on;
  if (this.allClearText.frame > 0) {
   this.allClearText.frame--;
   isBool = true;
   
  }
  
  if (isBool) {
   let cs = this.parent.cellSize;
   let ga = this.allClearText;
   let s = 9;
   let ar = 512 / 440;
   let centerY = (cs * s / 2);
   let centerX = cs * (ar * s / 2);
   let bezY = 1;
   let bezS = 1;
   //ga.frame = (game.frames % 35);
   if (ga.frame > 0) {
    ga.frame--;
    
    bezY = bezier((ga.max - ga.frame) / ga.max, 0, 1,
     ga.bez.y1,
     ga.bez.y2,
     ga.bez.y3,
     ga.bez.y4,
    );
    bezS = bezier((ga.max - ga.frame) / ga.max, 0, 1,
     ga.bez.s1,
     ga.bez.s2,
     ga.bez.s3,
     ga.bez.s4,
    );
   }
   
   let py = 6 + (this.parent.fieldSize.vh * (ga.start[0] + ((bezY) * (ga.end[0] - ga.start[0])))),
    ps = 1;
   this.parent.canvasCtx[aux].drawImage(
    game.misc.zenkeshi,
    0,
    0,
    512,
    440,
    (cs * (this.parent.fieldSize.w / 2)) - centerX,
    (cs * py) - centerY,
    (cs * ar * s),
    (cs * s)
   );
  }
 }
 
 playAllClearAnim(toggle) {
  this.allClearText.a.assign(toggle);
 }
 
 dropsetReset(array) {
  this.piece.dropset.length = 0;
  for (let i = 0; i < 16; i++)
   if (array?.[i]) {
    this.piece.dropset.push(array[i]);
   }
  else this.piece.dropset.push(0);
  
  this.piece.dropsetN = 0;
 }
 
 setBlob(type, color1, color2) {
  let c = color1,
   d = color2
  let ma = [
   [
    [
     [0, 0, 0],
     [c, d, 0],
     [0, 0, 0]
    ],
    [
     [0, 0, 0],
     [0, d, 0],
     [0, c, 0]
    ],
    [
     [0, 0, 0],
     [0, d, c],
     [0, 0, 0]
    ],
    [
     [0, c, 0],
     [0, d, 0],
     [0, 0, 0]
    ]
   ],
   [
    [
     [0, 0, 0],
     [c, d, 0],
     [0, d, 0]
    ],
    [
     [0, 0, 0],
     [0, d, d],
     [0, c, 0]
    ],
    [
     [0, d, 0],
     [0, d, c],
     [0, 0, 0]
    ],
    [
     [0, c, 0],
     [d, d, 0],
     [0, 0, 0]
    ]
   ],
   [
    [
     [0, 0, 0],
     [d, d, 0],
     [0, c, 0]
    ],
    [
     [0, 0, 0],
     [0, d, c],
     [0, d, 0]
    ],
    [
     [0, c, 0],
     [0, d, d],
     [0, 0, 0]
    ],
    [
     [0, d, 0],
     [c, d, 0],
     [0, 0, 0]
    ]
   ],
   [
    [
     [0, 0, 0],
     [c, c, 0],
     [d, d, 0]
    ],
    [
     [0, 0, 0],
     [c, d, 0],
     [c, d, 0]
    ],
    [
     [0, 0, 0],
     [d, d, 0],
     [c, c, 0]
    ],
    [
     [0, 0, 0],
     [d, c, 0],
     [d, c, 0]
    ]
   ],
   [
    [
     [0, 0, 0],
     [d, d, 0],
     [d, d, 0],
    ],
    [
     [0, 0, 0],
     [d, d, 0],
     [d, d, 0],
    ],
    [
     [0, 0, 0],
     [d, d, 0],
     [d, d, 0],
    ],
    [
     [0, 0, 0],
     [d, d, 0],
     [d, d, 0],
    ]
   ]
  ][type];
  let t = 0;
  if (this.isFever || this.insane.isOn) t = 2;
  if (type == 1 && type == 2) t = 1;
  let centerX = 0;
  let centerY = 0;
  if (type < 3) {
   centerX = 1;
   centerY = 1;
  }
  
  return ({
   index: "",
   matrix: ma,
   color1: c,
   color2: d,
   rot: c,
   type: type,
   sx: 3,
   sy: 0,
   blobCenterX: centerX,
   blobCenterY: centerY,
   kickTable: {
    2: {
     right: [
      [
       [0, 0],
       [0, -1],
       [-1, 0],
       [0, -1],
       [-1, -1],
       [-1, 0]
      ],
      [
       [0, 0],
       [0, -1],
       [0, -1],
       [1, 0],
       [0, -1]
      ],
      [
       [0, 0],
       [0, -1],
       [1, 0],
       [0, -1],
       [1, -1],
       [1, 0]
      ],
      [
       [0, 0],
       [0, -1],
       [0, -1],
       [-1, 0],
       [0, -1]
      ],
     ],
     left: [
      [
       [0, 0],
       [0, -1],
       [1, 0],
       [0, -1],
       [1, -1],
       [1, 0]
      ],
      [
       [0, 0],
       [0, -1],
       [0, -1],
       [-1, 0],
       [0, -1]
      ],
      [
       [0, 0],
       [0, -1],
       [-1, 0],
       [0, -1],
       [-1, -1],
       [-1, 0]
      ],
      [
       [0, 0],
       [0, -1],
       [0, -1],
       [1, 0],
       [0, -1]
      ],
     ],
     double: [
      [
       [0, 0],
       [0, -1]
      ],
      [
       [0, 0],
       [0, 1]
      ],
      [
       [0, 0],
       [0, -2]
      ],
      [
       [0, 0],
       [0, 2]
      ]
     ]
    },
    0: {
     right: [
      [
       [0, 0],
       [-1, 0],
       [0, -1],
       [-1, -1],
       [-1, 0]
      ],
      [
       [0, 0],
       [0, -1],
       [0, -1],
       [1, 0],
       [0, -1]
      ],
      [
       [0, 0],
       [1, 0],
       [0, -1],
       [1, -1],
       [1, 0]
      ],
      [
       [0, 0],
       [0, -1],
       [0, -1],
       [-1, 0],
       [0, -1]
      ],
     ],
     left: [
      [
       [0, 0],
       [1, 0],
       [0, -1],
       [1, -1],
       [1, 0]
      ],
      [
       [0, 0],
       [0, -1],
       [0, -1],
       [-1, 0],
       [0, -1]
      ],
      [
       [0, 0],
       [-1, 0],
       [0, -1],
       [-1, -1],
       [-1, 0]
      ],
      [
       [0, 0],
       [0, -1],
       [0, -1],
       [1, 0],
       [0, -1]
      ],
     ],
     double: [
      [
       [0, 0],
       [0, -1]
      ],
      [
       [0, 0],
       [0, 1]
      ],
      [
       [0, 0],
       [0, -2]
      ],
      [
       [0, 0],
       [0, 2]
      ]
     ]
    },
    1: {
     right: [
      [
       [0, 0],
       [-1, 0],
       [0, -1],
       [-1, -1],
       [1, -1]
      ],
      [
       [0, 0],
       [0, -1],
       [0, -1],
       [1, 0],
       [-1, -1]
      ],
      [
       [0, 0],
       [1, 0],
       [0, -1],
       [1, -1],
       [-1, -1]
      ],
      [
       [0, 0],
       [0, -1],
       [0, -1],
       [-1, 0],
       [1, -1]
      ],
     ],
     left: [
      [
       [0, 0],
       [1, 0],
       [0, -1],
       [1, -1],
       [-1, -1]
      ],
      [
       [0, 0],
       [0, -1],
       [0, -1],
       [-1, 0],
       [1, -1]
      ],
      [
       [0, 0],
       [-1, 0],
       [0, -1],
       [-1, -1],
       [1, -1]
      ],
      [
       [0, 0],
       [0, -1],
       [0, -1],
       [1, 0],
       [-1, -1]
      ],
     ],
     double: [
      [
       [0, 0],
       [0, -1]
      ],
      [
       [0, 0],
       [0, 1]
      ],
      [
       [0, 0],
       [0, -2]
      ],
      [
       [0, 0],
       [0, 2]
      ]
     ]
    },
   } [t]
  });
  
  
  
 }
 
 replaceField(gridArr, isFlipped, isInsane) {
  let cy = this.fieldSize.hh - gridArr[0].length - 1,
   lm = gridArr[0].length
  
  this.simulateSplashOut();
  
  this.stack = grid(this.fieldSize.w, this.fieldSize.h, 0);
  let blobs = [];
  //let height = this.fieldSize.h - this.fieldSize.vh - 2;
  let highest = 0;
  let highestCol = 0;
  this.drawStack(this.stack);
  {
   for (let mx = 0, x = isFlipped ? (gridArr.length - 1) : 0; isFlipped ? (x >= 0) : (x < gridArr.length); x += (isFlipped ? -1 : 1), mx++) {
    let de = 0;
    
    let emptyY = 0,
     occupyY = 0,
     ry = 0;
    for (let y = gridArr[x].length - 1; y > 0; y--) {
     this.stack[mx][y + cy] = gridArr[x][y];
     occupyY = ry;
     //emptyY = 0;
     
     if (gridArr[x][y]) {
      let hm = this.fieldSize.h + (lm - y);
      if (highest == 0 || true) {
       //highest = lm - y;
       highestCol = mx;
      }
      
      
      
      
      blobs.push({
       x: mx,
       y0: y + cy,
       y1: this.fieldSize.h - lm + y + emptyY,
       h: (this.fieldSize.h - lm + y + emptyY) - (y + cy),
       del: de,
       cell: gridArr[x][y]
      });
      de += 3;
     } else {
      emptyY++;
      ry = emptyY;
     }
    }
   }
  }
  /* else {
     for (let x = 0; x < gridArr.length; x++) {
      
      let de = gridArr[0].length;

      
      for (let y = 0; y < gridArr[x].length; y++) {
       this.stack[x][y + cy] = gridArr[(gridArr.length - 1) - x][y];
       
  if (gridArr[(gridArr.length - 1) - x][y]) {
       let hm = this.fieldSize.h + (lm - y);
       if (highest == 0) {
        highest = lm - y;
        highestCol = x;
       }
       
       
        blobs.push ({
       x: (gridArr.length - 1) - x,
       y0: y + cy,
       y1: this.fieldSize.h - lm + y,
       del: de,
       cell: gridArr[(gridArr.length - 1) - x][y]
       });
       de--;
  }
      }


     }
    }*/
  
  
  
  let speed = isInsane ? 2.1 : 1.4;
  
  for (let blob of blobs) {
   let timeFall = Math.floor(Math.max(0, (blob.h) * speed));
   if (((speed * (blob.h)) + blob.del) > highest) highest = (speed * (blob.h)) + blob.del;
   this.effects.drop.addItem({
    x: blob.x,
    y0: blob.y0,
    y1: blob.y1,
    cell: blob.cell,
    delay: blob.del,
    frames: timeFall,
    maxf: timeFall,
    isLandSound: blob.x == highestCol ? (1) : 0,
    fallType: 0,
    landFrames: 15
   });
  }
  
  this.setDelay(0, 20 + Math.floor(Math.max(0, highest)));
  
  this.checkInstantDrop();
  this.blobCount = this.checkBlobCount(this.stack);
 }
 
 simulateSplashOut() {
  let asset = this.parent.assetRect(this.isAux ? "AUX-FIELD-CHARACTER-CANVAS" : "FIELD-CHARACTER-CANVAS");
  let sizemult = this.isAux ? 0.47 : 1;
  let aw = asset.width;
  let ah = asset.height;
  let ax = asset.x;
  let ay = asset.y;
  let bez = {
   
   x1: 0,
   x2: 0,
   x3: 1,
   x4: 1,
   y1: 0,
   y2: 0.3,
   y3: 1 + (Math.random() * 0.3),
   y4: 1,
   
  };
  for (let x = 0; x < this.fieldSize.w; x++) {
   for (let y = this.fieldSize.hh - 2; y < this.fieldSize.h; y++)
    if (this.stack[x][y] > 0) {
     let mx = ax + (this.getQPosX(x) * this.parent.fieldCellSize) + (this.getQPosX(1) * this.parent.fieldCellSize / 2);
     let my = ay + (this.getQPosY(y - this.fieldSize.hh) * this.parent.fieldCellSize) + (this.getQPosY(1) * this.parent.fieldCellSize / 2);
     let particleSpeed = 71 + (Math.random() * 30);
     bez.y3 = 1 + (Math.random() * 0.3);
     let isTwo = this.stack[x][y] == 6 && this.parent.garbageType == 0;;
     this.parent.addParticle(true, "blobblock", 0, this.stack[x][y] - 1,
      mx,
      my,
      mx + this.getQPosX((Math.random() * 30) - (Math.random() * 30)) * this.parent.fieldCellSize,
      my + (this.getQPosY((Math.random() * 4) + 4) * this.parent.fieldCellSize) + game.resolution.h,
      particleSpeed, ((this.getQPosX(1) * this.parent.fieldCellSize) / game.cellSize), false, bez, false);
    }
  }
 }
 
 testGridSpace(x, y) {
  if (x < 0 || x >= this.fieldSize.w) {
   return true;
  }
  if (y < this.fieldSize.h) {
   if (typeof this.stack[x][y] !== "undefined" && this.stack[x][y] !== 0) {
    return true;
   }
   return false;
  }
  return true;
 }
 
 reset() {
  this.activeVoiceLine = "";
  this.nextVoice.duration = -1;
  this.repeatSpellVoice = 0;
  this.nextVoice.name = "";
  this.opponentGarbageBehind = {};
  this.piece.x = 0;
  this.voiceDelay = 0;
  this.piece.y = -295;
  this.piece.isBig = false;
  
  this.garbageOrder.n = 0;
  
  
  this.playAllClearAnim(3);
  this.isAllClear = false;
  this.isAllClearTemp = -9;
  
  this.pop = {
   x: 0,
   y: 0
  };
  this.piece.rot = 0;
  this.piece.active.color1 = 0;
  this.piece.active.color2 = 0;
  this.piece.active.colorRot = 0;
  this.piece.activeArr = [
   []
  ];
  this.piece.isAir = false;
  this.piece.moved = true;
  this.piece.dirty = false;
  this.piece.held = false;
  this.piece.rotated = false;
  this.piece.enable = false;
  
  this.piece.dropsetN = 0;
  this.firstGroupsPop.length = 0;
  
  this.isChainUp = false;
  
  this.piece.isHardDrop = false;
  //this.previewInitialize();
  this.isSpawnablePiece = true;
  this.targetGarbagePlayer = {};
  this.effects.drop.reset();
  this.delayDrop = -3;
  
  
  this.dstModulus = 0;
  
  this.rotate180Timer = 0;
  
  this.canFallTrash = true;
  this.canFallTrashAfterFever = true;
  
  this.chain = 0;
  this.actualChain = 0;
  this.previousChain = 0;
  this.forecastedChain = 0;
  this.eraseInfo = [];
  this.erasedBlocks = [];
  this.holes = 0;
  this.delayDrop = -73;
  this.delayedGarbage = 0;
  this.divScoreTrash = 0;
  this.divScoreAttackingTrash = 0;
  
  this.delay = {};
  this.delayAdd = {};
  
  for (let h = 0; h < this.delayParamsLength; h++) {
   this.delay[h] = -100;
   
   this.delayAdd[h] = this.isProfessional ? 0 : this.delayDefault[h];
  }
  this.lock = {
   move: 15,
   rot: 15,
   delay: 30,
   lockSoftdrop: 2,
  };
  this.lockPrevent.rotate = 0;
  
  this.piece.rotAnim.rot = 0;
  this.piece.rotAnim.timeAnim = 0;
  this.piece.rotAnim.curRot = 0;
  this.piece.rotAnim.diffRot = 0;
  //TODO rewrite things
  
  this.defaultFieldSize.w = 6 * 1;
  this.defaultFieldSize.hh = 3 * 1;
  this.defaultFieldSize.vh = 12 * 1;
  
  this.fieldSize.w = 6 * 1;
  this.fieldSize.hh = 30 * 1;
  this.fieldSize.vh = 12 * 1;
  this.blobRequire = 4;
  this.fieldSize.h = this.fieldSize.vh + this.fieldSize.hh;
  this.stack = grid(this.fieldSize.w, this.fieldSize.h, 0);
  this.drawableStack = grid(this.fieldSize.w * 3, this.fieldSize.h * 3, 0);
  this.poppedStack = grid(this.fieldSize.w * 3, this.fieldSize.h * 3, 0);
  this.dropForecast.stack = grid(this.fieldSize.w * 3, (this.fieldSize.vh) * 3, 0);
  
  this.drawStack(this.stack);
  this.drawActivePiece();
  this.previewReset();
  this.handling = {
   das: 0,
   arr: 0,
   xFirst: 0,
  };
  
  this.blobCount = 0;
  
  this.warningTrig.assign(0);
  
 }
 
 drawRect(ctx, x, y, row, column, sx, sy, isBuffer, isEraseTop) {
  x = ~~(x * this.parent.cellSize * sx);
  y = y * this.parent.cellSize * sy; //- (2 * this.cellSize);
  
  let c = this.parent.canvasCtx[ctx];
  //c.fillStyle = `rgb(${Math.random()*0}, 255, 0)`;
  let cs = this.parent.cellSize;
  
  if (this.parent.isVisible) c.drawImage(
   manager.skinBlob.canvas,
   ~~(row * cs),
   ~~(column * cs),
   (cs),
   ~~(cs),
   x,
   y + (isBuffer ? (this.visibleFieldBufferHeight * cs * (this.parent.fieldSize.vh / this.defaultFieldSize.vh)) : 0),
   ~~(cs * sx),
   ~~(cs * sy),
  );
  if (isEraseTop) {
   let a = this.parent.canvasses[ctx];
   this.parent.canvasCtx[ctx].clearRect(0, 0, a.width, this.parent.cellSize * this.parent.visibleFieldBufferHeight);
   
  }
 }
 
 drawArray(ctx, arr, cx, cy, color, rr, sx, sy, isEraseTop, isBuffer) {
  for (var x = 0, len = (arr.length); x < len; x++) {
   for (var y = 0, wid = (arr[x].length); y < wid; y++) {
    if (arr[x][y]) {
     if (arr[x][y] % 256 >= 6) {
      let c = arr[x][y];
      /*let row = 0;
      if (c & FLAG_CONNECTIONS.up) row += 1;
      if (c & FLAG_CONNECTIONS.down) row += 2;
      if (c & FLAG_CONNECTIONS.right) row += 4;
      if (c & FLAG_CONNECTIONS.left) row += 8;*/
      c %= 256;
      let row = rr || 0;
      
      this.drawRect(ctx, (x + cx), ~~(y) + cy, rr !== void 0 ? rr : (row + ((c == 6 && this.parent.garbageType == 0) ? 1 : 0)), color !== void 0 ? (color - 1) : (c - 1), sx || 1, sy || 1, isBuffer);
     } else {
      let c = arr[x][y];
      let row = 0;
      if (c & FLAG_CONNECTIONS.up) row += 1;
      if (c & FLAG_CONNECTIONS.down) row += 2;
      if (c & FLAG_CONNECTIONS.right) row += 4;
      if (c & FLAG_CONNECTIONS.left) row += 8;
      c %= 256;
      
      this.drawRect(ctx, (x + cx), ~~(y) + cy, rr !== void 0 ? rr : row, color !== void 0 ? (color - 1) : (c - 1), sx || 1, sy || 1, isBuffer);
      
     }
    }
   }
  }
  
  if (isEraseTop) {
   let a = this.parent.canvasses[ctx];
   this.parent.canvasCtx[ctx].clearRect(0, 0, a.width, this.parent.cellSize * this.parent.visibleFieldBufferHeight);
   
  }
 }
 
 getQPosX(x) {
  let sizemult = this.isAux ? 0.47 : 1;
  return sizemult * x * (this.parent.fieldSize.w / this.fieldSize.w);
  
 }
 getQPosY(y) {
  let sizemult = this.isAux ? 0.47 : 1;
  return sizemult * y * ((this.parent.fieldSize.vh) / this.fieldSize.vh);
  
 }
 
 emitAttack(marr) {
  
  let neutralized = false;
  //let lastGarbage = 0;
  let playerNeutGarb = {};
  
  let particleSpeed = (this.insane.isOn && this.insane.insaneType !== 1) ? 18 : this.parent.particleGarbageDelay;
  
  this.divScoreAttackingTrash += (marr); // / (this.targetPoint));
  let attack = Math.floor((this.divScoreAttackingTrash / (this.targetPoint)));
  let modulus = marr % (this.targetPoint);
  this.divScoreAttackingTrash %= (this.targetPoint);
  
  let remain = 0;
  let count = attack;
  let neutralCount = 0;
  let hasAddFev = 0;
  //let isAttacking = false;
  let garbLength = this.parent.calculateGarbage() + this.parent.calculateGarbageBehind();
  //TODO debug this
  if (((this.parent.feverStat.isOn && this.isFever) || this.insane.isOn || this.isChainOffsetting) && garbLength > 0 && count == 0) count += 1;
  attack *= (this.requiredChain > this.chain || game.isSolo ? 0 : 1);
  count *= (this.requiredChain > this.chain || game.isSolo ? 0 : 1);
  
  let gCount = 0,
   excessCount = 0;
  if (this.parent.activeType === 0) {
   let mc = this.garbageConversion(count, garbLength);
   let min = Math.min(mc.converted, garbLength);
   //this.divScoreAttackingTrash
   //////console.log(mc, count, min, garbLength)
   count -= Math.max(0, mc.cost);
   //this.divScoreAttackingTrash
   //excessCount += mc.surplus;
   gCount += min;
  } else {
   
   gCount = Math.max(count, 0);
   //count -= Math.max(gCount);
  }
  while (this.parent.garbage.length > 0 && this.parent.garbageBlocking !== "none" && gCount > 0) {
   let reference = this.parent.garbage[0];
   if (reference.count <= 0) {
    this.parent.garbage.shift();
    continue;
   };
   neutralized = true;
   let min = Math.min(reference.count, gCount);
   reference.count -= min;
   neutralCount += min;
   if (reference.count <= 0) {
    this.parent.garbage.shift();
   }
   gCount -= min;
   if (this.parent.activeType == 1) count -= min;
   
   playerNeutGarb[reference.player] = min;
   
  }
  while (this.parent.garbageBehind.length > 0 && this.parent.garbageBlocking !== "none" && gCount > 0) {
   let reference = this.parent.garbageBehind[0];
   if (reference.count <= 0) {
    this.parent.garbageBehind.shift();
    continue;
   };
   neutralized = true;
   let min = Math.min(reference.count, gCount);
   reference.count -= min;
   neutralCount += min;
   if (reference.count <= 0) {
    this.parent.garbageBehind.shift();
   }
   if (this.parent.activeType == 1) count -= min;
   gCount -= min;
   playerNeutGarb[reference.player] = min;
  }
  
  remain += count + excessCount;
  //////console.log(remain, count, excessCount);
  if (this.parent.isGarbageCollectionMode) {
   this.parent.woi.add(remain);
   remain = 0;
   modulus = 0;
  }
  
  if (neutralized && garbLength > 0 && !(garbLength <= count)) modulus = 0;
  let total = ((this.targetPoint) * remain);
  ////////console.log(neutralCount, garbLength, neutralized)
  if ((garbLength > 0 || neutralized) && neutralCount < garbLength) total = 0;
  this.parent.garbageLength = this.parent.calculateGarbage();
  this.parent.garbageBehindLength = this.parent.calculateGarbageBehind();
  if (neutralized) {
   this.parent.rpgAttr.hpDamage = this.parent.calculateHPDamage();
   
   for (let h in playerNeutGarb)
    if (h in game.players) {
     let player = game.players[h];
     if ((player.feverStat.isOn && player.blob.isFever) && !player.blob.insane.isOn && !player.block.insane.isOn) {
      player.feverStat.addTime(1);
     }
    }
   if (this.parent.feverStat.isOn && this.isFever) {
    
    
    
    if (!this.insane.isOn) {
     if (this.parent.feverStat.add()) hasAddFev = 1;
    }
    if (!this.insane.isOn && this.parent.feverStat.gaugeValue >= this.parent.feverStat.maxGauge) {
     this.insane.delay.ready = 10;
    }
   }
   if ((this.parent.feverStat.isOn && this.isFever) || this.insane.isOn || this.isChainOffsetting) {
    this.canFallTrash = false;
    this.canFallTrashAfterFever = false;
   }
  }
  
  game.forEachPlayer(player => {
   if (this.parent.player === player.player || this.parent.team === player.team) return;
   if (!(player.player in this.targetGarbagePlayer)) {
    this.targetGarbagePlayer[player.player] = {
     score: total,
     trash: ~~((total) / (player.blob.targetPoint)),
    };
    return;
   }
   let qm = this.targetGarbagePlayer[player.player];
   qm.score += (total);
   qm.trash = ~~(qm.score / (player.blob.targetPoint));
  });
  
  let bez = {
   x1: 0,
   x2: 1,
   x3: 1,
   x4: 1,
   y1: 0,
   y2: 1,
   y3: 1,
   y4: 1,
  };
  
  let asset = this.parent.assetRect(this.isAux ? "AUX-FIELD-CHARACTER-CANVAS" : "FIELD-CHARACTER-CANVAS");
  let sizemult = this.isAux ? 0.47 : 1;
  let aw = asset.width;
  let ah = asset.height;
  let ax = asset.x;
  let ay = asset.y;
  
  let selfTarget = this.parent.assetRect("GARBAGE-TRAY-DIV");
  let gw = selfTarget.width;
  let gh = selfTarget.height;
  let gx = selfTarget.x;
  let gy = selfTarget.y;
  let cs = this.parent.fieldCellSize;
  
  ////////console.log(this.erasedBlocks[0])
  
  let bx = (this.erasedBlocks[0] || { x: this.piece.x }).x;
  let by = (this.erasedBlocks[0] || { y: this.piece.y }).y;
  let qw = sizemult * (this.parent.fieldSize.w / this.fieldSize.w);
  let qh = sizemult * ((this.parent.fieldSize.vh) / this.fieldSize.vh)
  let um = (this.erasedBlocks[0] || { cell: 0 }).cell;
  let yu = [0, 2, 5, 7, 4, 8]; //[(this.erasedBlocks[0] || { cell: 0 }).cell];
  
  let z = this.sendGarbage();
  let isAttack = Object.keys(z).length > 0;
  
  let y = Math.max(1, this.chain - ((this.insane.isOn || this.isFever) ? 2 : 0));
  let isCounter = attack > garbLength && garbLength > 0;
  let isChain = this.chain < this.forecastedChain;
  let isTargetCount = Object.keys(z).length > 0;
  let hitInt = this.parent.fieldCellSize * (Math.min(this.chain, 7) * 0.1);
  if (isTargetCount) {
   game.forEachPlayer(m => {
    if (m.player in z) {
     let target = m.assetRect("GARBAGE-TRAY-DIV");
     let tw = target.width;
     let th = target.height
     let tx = target.x;
     let ty = target.y;
     
     if (!m.blob.insane.isOn) m.check1v1Overhead(true, m.garbageLength + m.garbageBehindLength, m.garbageLength + m.garbageBehindLength, false);
     
     
     if (m.isVisible) m.addDelayHandler(true, particleSpeed * (neutralized ? 2 : 1), () => {
      m.garbageLastForTray.assign(m.garbageLength);
      m.garbageBehindLastForTray.assign(m.garbageBehindLength);
      m.playSound(`hit${Math.min(5, y)}`);
      animatedLayers.create(undefined, 30,
       tx + (tw / 2),
       ty + (th / 2),
       0,
       0,
       0,
       200,
       200,
       12,
       12,
       0.75,
       "blob_hit",
       10,
       this.cellSize,
      );
      if (!m.isDying && !m.isFinishAble && !m.isDead) m.engageShakeIntensityHit(hitInt);
     });
     
     if (!neutralized) {
      if (m.isVisible) {
       for (let j of this.firstGroupsPop) {
        m.addParticle(true, "attack", 0, yu[j.cell],
         (ax) + (j.x * cs * qw),
         (ay) + ((j.y - this.fieldSize.hh) * cs * qh),
         tx + (tw / 2),
         ty + (th / 2),
         particleSpeed, 2.5, false, bez, true, {
          frame: particleSpeed * (0.3 + (Math.min(9, this.chain) * 0.2)),
          r: this.blobColors.r[j.cell],
          g: this.blobColors.g[j.cell],
          b: this.blobColors.b[j.cell],
         });
       }
      }
      
     } else {
      m.addDelayHandler(true, particleSpeed, () => {
       if (m.isVisible) {
        
        m.addParticle(true, "attack", 0, yu[um],
         gx + (gw / 2),
         gy + (gh / 2),
         tx + (tw / 2),
         ty + (th / 2),
         particleSpeed, 2.5, false, bez, true, {
          frame: particleSpeed * (0.3 + (Math.min(9, this.chain) * 0.2)),
          r: this.blobColors.r[um],
          g: this.blobColors.g[um],
          b: this.blobColors.b[um],
         });
       }
       
      });
     }
     
    }
   });
  }
  
  this.parent.addDelayHandler(true, particleSpeed * (isCounter ? 2 : 1), () => {
   game.forEachPlayer((player) => {
    if (isTargetCount && player.isDying && player.isFinishAble) {
     
     if (player.player in z) {
      if (isChain) {
       player.playSound("blub_garbage2");
       player.executeRotateWobble(15, 65);
      } else {
       player.phaseLose(true);
      }
     }
     
     
    } else if (!isChain && player.isDying && player.isFinishAble) {
     player.phaseLose(false);
    }
   })
   
  });
  
  if ((neutralized && (garbLength > 0)) || (this.parent.isGarbageCollectionMode)) {
   for (let j of this.firstGroupsPop) {
    this.parent.addParticle(true, "attack", 0, yu[j.cell],
     (ax) + (j.x * cs * qw),
     (ay) + ((j.y - this.fieldSize.hh) * cs * qh),
     gx + (gw / 2),
     gy + (gh / 2),
     particleSpeed, 1.5, false, bez, true, {
      frame: particleSpeed * (0.3 + (Math.min(9, this.chain) * 0.2)),
      r: this.blobColors.r[j.cell],
      g: this.blobColors.g[j.cell],
      b: this.blobColors.b[j.cell],
     });
   }
   this.parent.addDelayHandler(false, particleSpeed, () => {
    this.parent.garbageLastForTray.assign(this.parent.garbageLength);
    this.parent.garbageBehindLastForTray.assign(this.parent.garbageBehindLength);
    this.parent.playSound(`hit${Math.min(5, y)}`);
   });
   
   this.parent.addDelayHandler(true, particleSpeed, () => {
    if (this.parent.feverStat.isOn && this.isFever && hasAddFev) {
     let fev = this.parent.feverStat;
     
     let feverTarget = this.parent.assetRect("FEVER-GAUGE");
     
     let mx = feverTarget.x;
     let my = feverTarget.y;
     let mw = feverTarget.width;
     let mh = feverTarget.height;
     //let scs = game.playerAreaSizeMult * (this.cellSize / game.resQualityMult);
     
     let fevOrb = fev.orbs[fev.gaugeValue - 1];
     //////console.log(fev.gaugeValue, fevOrb);
     
     let fx = (fevOrb.x * mw); //+ (fevOrb.cs * scs / 2);
     let fy = (fevOrb.y * mh) - (fevOrb.cs * cs / 2);
     
     if (fev.reversed) {
      fx = ((1 - fevOrb.x) * mw); //+ (fevOrb.cs * scs / 2);
      fy = ((fevOrb.y) * mh) - (fevOrb.cs * cs / 2);
     }
     
     this.parent.addParticle(true, "attack", 0, 0,
      gx + (gw / 2),
      gy + (gh / 2),
      mx + fx,
      my + fy,
      particleSpeed, 1.5, false, bez, true, {
       frame: particleSpeed * (0.2),
       r: 255,
       g: 255,
       b: 255,
      });
     this.parent.addDelayHandler(true, particleSpeed, () => {
      fev.refresh();
      this.parent.playSound("garbage");
     });
     
    }
    animatedLayers.create(undefined, 30,
     gx + (gw / 2),
     gy + (gh / 2),
     0,
     0,
     0,
     200,
     200,
     12,
     12,
     0.75,
     "blob_hit",
     10,
     this.cellSize,
    );
   });
   
   if (!this.insane.isOn && !this.isAux && !this.parent.isGarbageCollectionMode) this.parent.check1v1Overhead(false, garbLength, this.parent.garbageLength + this.parent.garbageBehindLength, isAttack);
   
  }
  
  
 }
 
 garbageConversion(count, limit) {
  let h = 0;
  let g = 0;
  let l = 4;
  let q = 1;
  let last = 0;
  let isLimit = limit !== void 0;
  while (h < count) {
   
   
   h++;
   if (h >= l) {
    //////console.log("GARB")
    l += ~~(q * 4.5);
    q++;
    g++;
   }
   if (isLimit && (limit <= g)) break;
   last = h;
   /*if (h >= l) {
    ////////console.log("GARB")
    l += ~~(q * 4.5);
    q++;
    g++;
   }*/
  }
  let costShortage = (0, h - count);
  return {
   converted: g,
   cost: h,
   shortage: costShortage,
   surplus: Math.max(count - last, 0),
  };
 }
 
 sendGarbage() {
  this.parent.playerTarget = [];
  let playerTrashSent = {};
  
  manager.forEachPlayer(player => {
   if (player.player !== this.parent.player && player.team !== this.parent.team) this.parent.playerTarget.push(player.player);
  });
  let attackHp = (this.parent.rpgAttr.attributes.attack + this.parent.rpgAttr.statusEffectsAttributes.attack) + (this.parent.rpgAttr.attributes.atkTolerance * this.parent.seeds.field.next());
  let blobToBlockMultiplier = 1.8;
  
  manager.forEachPlayer(player => {
   if (this.parent.playerTarget.indexOf(player.player) !== -1) {
    let qm = this.targetGarbagePlayer[player.player];
    if (player.rpgAttr.isOn ? (player.rpgAttr.canReceiveGarbage > 0) : true) {
     if (player.activeType === 1) {
      //////console.log(this.targetGarbagePlayer[player.player])
      if (((player.player in this.opponentGarbageBehind) && player.isGarbageBehindActive)) {
       
       player.addGarbageBehind(this.parent.player, [qm.trash], true, false, 0, attackHp);
       
      } else player.addGarbage(this.parent.player, [qm.trash], true, false, 0, attackHp);
      if (qm.trash > 0) {
       playerTrashSent[player.player] = qm.trash;
       qm.score %= player.blob.targetPoint;
      }
     }
     if (player.activeType === 0) {
      let h = 0;
      let g = 0;
      let l = 4;
      let q = 1;
      while (h < qm.trash) {
       h++;
       if (h >= l) {
        //////console.log("GARB")
        l += ~~(q * 2.75);
        q++;
        g++;
       }
       /*if (h >= l) {
        ////////console.log("GARB")
        l += ~~(q * 4.5);
        q++;
        g++;
       }*/
      }
      
      ////////console.log(player.player, player.dividedBlobScoreGarbage, player.blobGarbage, g)
      
      if (g > 0) {
       playerTrashSent[player.player] = g;
       
       if ((player.player in this.opponentGarbageBehind) && player.isGarbageBehindActive) {
        player.addGarbageBehind(this.parent.player, [g], true, true, 0, attackHp * (blobToBlockMultiplier));
       } else player.addGarbage(this.parent.player, [g], true, true, 0, attackHp * (blobToBlockMultiplier));
       
       
       qm.score %= (player.blob.targetPoint);
       qm.trash = 0;
      }
     }
    } else {
     qm.score %= (player.blob.targetPoint);
     qm.trash = 0;
    }
    
   }
  });
  for (let h of this.parent.playerTarget) {
   ////////console.log(game.players[playerTarget].garbage)
  }
  
  return playerTrashSent;
 }
 
 updateDelay() {
  if (!this.isDelayEnabled) return;
  
  let delayPrioritize = 0;
  for (let l = this.delayParamsLength - 1; l >= 0; l--) {
   if (this.delay[l] >= 0) {
    delayPrioritize = l;
    
    break;
   }
  }
  
  
  
  if (delayPrioritize === 0) {
   if (!this.insane.updateDelays()) {
    this.delay[delayPrioritize]--;
   } else this.parent.isDelayStoppable = false;
  } else {
   this.delay[delayPrioritize]--;
   this.parent.isDelayStoppable = false;
  }
  
  do {
   if (this.dropDelay >= 0) {
    this.dropDelay--;
    if (this.dropDelay === 0) {
     this.checkDropBlock();
     this.setDelay(1, 24);
    }
   }
   if (this.delay[3] == 1) this.parent.checkWaitDeterminism();
   if (this.delay[3] == 0) {
    //alert("detect?")
    let activeSpellline = "";
    this.voiceDelay = 5;
    /*for (let yy = 0; yy < this.eraseInfo.length; yy++)*/
    this.parent.playSound(`chain${Math.min(7, this.chain)}`);
    this.parent.playSound("shoosh_chain");
    //sound.sounds[`chain${Math.min(7, this.chain)}`].rate(0.9);
    let asset = this.parent.assetRect(this.isAux ? "AUX-FIELD-CHARACTER-CANVAS" : "FIELD-CHARACTER-CANVAS");
    let sizemult = (this.isAux ? 0.47 : 1) * this.getQPosX(1);
    let aw = asset.width;
    let ah = asset.height;
    let ax = asset.x;
    let ay = asset.y;
    
    let px = (ax + (this.parent.fieldCellSize * this.getQPosX(this.eraseInfo[0].x)));
    let py = (ay + (this.parent.fieldCellSize * this.getQPosY(this.eraseInfo[0].y - this.fieldSize.hh)));
    let delayed = this.delayedGarbage,
     lem = this.parent.garbageLength + this.parent.garbageBehindLength;
    if (this.chain > 0) {
     this.emitAttack(delayed, this.dstModulus);
     let blobCenterX = sizemult * this.parent.fieldCellSize / 2;
     let blobCenterY = sizemult * this.parent.fieldCellSize / 2;
     let popSize = 4;
     let len = this.eraseInfo.length;
     for (let i = 0; i < len; i++) {
      let p = this.eraseInfo[i];
      //let sx = this.getQPosX(1) * this.parent.fieldCellSize * (popSize);
      //let sy = this.getQPosY(1) * this.parent.fieldCellSize * (popSize);
      let apx = (ax + (this.parent.fieldCellSize * this.getQPosX(p.x)));
      let apy = (ay + (this.parent.fieldCellSize * this.getQPosY(p.y - this.fieldSize.hh)));
      
      
      animatedLayers.create(undefined, 25,
       apx + blobCenterX,
       apy + blobCenterY,
       0,
       0,
       0,
       200,
       200,
       popSize,
       popSize,
       0.65 + (Math.random() * 0.8),
       `blob_pop${p.cell}`,
       10,
       this.parent.fieldCellSize * sizemult, false, false, true
      );
     }
    }
    
    if (this.chain > 1) htmlEffects.add(this.chain + `<gtp style="font-size: ${this.parent.fieldFontSize * 2.3}px">-${this.insane.insaneType == 1 ? "combo" : "chain"}</gtp>`, px, py, 50, {
     name: "chain-text-anim",
     iter: 1,
     timefunc: "cubic-bezier(0,0,1,0)",
     initdel: 0,
    }, `font-size: ${~~(this.parent.fieldFontSize * 3.733)}px; text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black; --__chaintext_size: 1.4em; color: #${["fff", "ff0", "f00", "70f"][Math.min(4, ~~(this.chain / 5))]}`);
    //let lem = this.parent.garbageLength,
    //////console.log(lem)
    let isCounter = ~~((delayed / this.targetPoint) - lem) > 0 && lem > 0;
    //if (this.parent.player === 0)////console.log(this.parent.player, ~~(delayed / this.targetPoint), (isCounter), this.parent.garbageLength)
    
    if (this.parent.character.isCounting) {
     if (this.chain == 7 || this.chain == 8 || this.chain > 9) this.repeatSpellVoice++;
     else this.repeatSpellVoice = 0;
     
     if (this.forecastedChain > this.chain || this.chain < 3) {
      this.activeVoiceLine = `count${this.chain}`;
     } else {
      if (this.chain == 3) this.activeVoiceLine = "spell1";
      if (this.chain == 4) this.activeVoiceLine = "spell2";
      if (this.chain == 5) this.activeVoiceLine = "spell3";
      if (this.chain >= 6 && this.chain < 9) this.activeVoiceLine = "spell4";
      if (this.chain >= 9) this.activeVoiceLine = "spell5";
     }
    } else
    if (this.insane.isOn || this.isFever) {
     try {
      let o = "init1";
      if (this.forecastedChain > 20) {
       o = CHAIN_SEQUENCE[19][(this.chain - 1) % 20];
       if (this.chain > 20) o = o = CHAIN_SEQUENCE[19][(this.chain) % 20];
       if (this.chain == this.forecastedChain) o = "spell5";
      } else o = CHAIN_SEQUENCE[this.forecastedChain - 1][this.chain - 1];
      if (o === "init5") {
       this.repeatSpellVoice++;
      } else if (!((o.includes("spell")))) this.repeatSpellVoice = 0;
      
      this.activeVoiceLine = o;
      if (o.includes("spell")) activeSpellline = o;
     } catch (e) {
      this.activeVoiceLine = "damage2";
     } /**/
     
     if (this.chain > 0 && this.insane.insaneType !== 0) {
      if (this.parent.character.isHenshinCounting) {
       let spell = "";
       if (this.chain > MainPlayerFragment.DEFAULT_HENSHIN_SPELL_SEQUENCE.length) {
        spell = "t_large";
       } else {
        spell = MainPlayerFragment.DEFAULT_HENSHIN_SPELL_SEQUENCE[this.chain - 1];
       }
       this.activeVoiceLine = spell;
      }
     }
     
     if (this.chain > 1 && this.insane.insaneType === 2) {
      let h = 0;
      if (this.chain == 7) {
       h = 1;
      }
      if (this.chain == 12) {
       h = 2;
      }
      if (this.chain == 18) {
       h = 3;
      }
      if (this.chain == 22) {
       h = 4;
      }
      
      if (this.forecastedChain === this.chain) {
       if (this.chain <= 11) {
        h = 1;
       } else
       if (this.chain <= 17) {
        h = 2;
       } else
       if (this.chain <= 21) {
        h = 3;
       } else
       if (this.chain >= 22) {
        h = 4;
       }
      }
      if (h > 0) {
       this.parent.engagePlaycharExt("insaneTransformSpell", `tfmicspell${h}`);
      }
     }
     
    } else if (!this.isFever) {
     let spell = TSU_CHAIN_SEQUENCE.normal[Math.min(6, this.chain - 1)];
     this.activeVoiceLine = spell;
     if (spell.indexOf("spell") != -1) activeSpellline = spell;
    } else {
     this.activeVoiceLine = `init${Math.min(5, this.chain)}`;
    }
    if (isCounter && (this.chain > (this.forecastedChain > 3 ? 3 : 2))) {
     this.activeVoiceLine = `counterattack`;
     activeSpellline = "counter";
    }
    
    if (this.isAux) {
     this.activeVoiceLine = "";
     activeSpellline = "";
    }
    
    if (activeSpellline !== "") this.parent.rectanim.play(activeSpellline);
    
    
   }
   
   if (this.delay[3] > 0) {
    if ((this.delay[3] % 2) == 0) {
     
     if (true) {
      
      let aux = this.isAux ? "stackAux" : "stack";
      let widthQuotient = this.parent.fieldSize.w / this.fieldSize.w;
      let heightQuotient = (this.parent.fieldSize.vh / this.fieldSize.vh);
      this.drawArray(aux, this.poppedStack, 0, -1 * (this.fieldSize.hh), void 0, 0, widthQuotient, heightQuotient, true, true);
      
     }
    } else this.drawStack();
   }
   if (this.delay[2] == 0) {
    //alert("detect?")
    if (this.insane.isOn || this.isFever) {
     
     let speed = this.insane.isOn ? 1 : 1.2;
     
     let blobs = [];
     let isExist = false;
     let highestY = this.fieldSize.h,
      longest = 0;
     let lowestY = this.fieldSize.h;
     
     for (let x = 0; x < this.fieldSize.w; x++) {
      let firstY = 0;
      let emptyY = 0;
      let isFirst = true;
      let isEmpty = false;
      let delayDrop = 0;
      for (let y = this.fieldSize.h - 1; y >= this.fieldSize.hh - 2; y--) {
       let bl = this.stack[x][y];
       
       if (!isEmpty && bl === 0) {
        
        isEmpty = true;
       }
       
       if (isFirst && isEmpty && bl > 0) {
        
        //firstY = this.checkDropSpecific(999, x, y + 1) + 1;
        isFirst = false;
        firstY += emptyY;
        emptyY = 0;
        if (y < lowestY) lowestY = y;
       }
       if (isEmpty && bl === 0) {
        
        emptyY++;
        isFirst = true;
        //delayDrop += 4;
       }
       
       if (!isFirst && isEmpty && bl > 0) {
        isExist = true;
        //////console.log(y, firstY, firstY + y, isFirst)
        
        blobs.push({
         cell: bl,
         x: x,
         y0: y,
         y1: firstY + y,
         h: firstY + 1,
         del: delayDrop,
        });
        
        if (bl > 0 && highestY > y) {
         highestY = y;
        }
        if (longest < (delayDrop + firstY * speed) && bl > 0) {
         longest = delayDrop + (firstY * speed);
        }
        delayDrop += this.insane.isOn ? 2 : 1;
       }
       
      }
     }
     
     //////console.log(longest * speed)
     
     for (let blob of blobs) {
      let timeFall = Math.floor(Math.max(0, (blob.h) * speed));
      //TODO write down
      
      this.drawableStack[blob.x][blob.y0] = 0;
      this.effects.drop.addItem({
       x: blob.x,
       y0: blob.y0,
       y1: blob.y1,
       cell: blob.cell,
       delay: blob.del,
       frames: timeFall,
       maxf: Math.floor(Math.max(0, (blob.h) * speed)),
       isLandSound: 1,
       fallType: 0,
       landFrames: 15
      });
     }
     
     this.setDelay(1, 7 + (isExist ? 15 : 0) + Math.floor(Math.max(0, (longest))));
     //this.setDelay(1, 24);
     this.drawStack();
     this.checkInstantDrop();
    } else {
     //this.checkHoles();
     //this.checkDropBlock();
     
     {
      
      let speed = 1.25;
      
      let blobs = [];
      let isExist = false;
      let highestY = this.fieldSize.h,
       longest = 0;
      let lowestY = this.fieldSize.h;
      
      for (let x = 0; x < this.fieldSize.w; x++) {
       let firstY = 0;
       let emptyY = 0;
       let isFirst = true;
       let isEmpty = false;
       let delayDrop = 0;
       let isLand = false;
       for (let y = this.fieldSize.h - 1; y >= this.fieldSize.hh - 2; y--) {
        let bl = this.stack[x][y];
        
        let isNuisance = false;
        
        if (!isEmpty && bl === 0) {
         
         isEmpty = true;
         
        }
        
        if (isFirst && isEmpty && bl > 0) {
         
         //firstY = this.checkDropSpecific(999, x, y + 1) + 1;
         isFirst = false;
         firstY += emptyY;
         emptyY = 0;
         isLand = true;
         if (y < lowestY) lowestY = y;
        } else isLand = false;
        if (isEmpty && bl === 0) {
         
         emptyY++;
         isFirst = true;
         //delayDrop += 4;
         
        }
        
        if (!isFirst && isEmpty && bl > 0) {
         if (bl !== this.NUISANCE) isExist = true;
         //////console.log(y, firstY, firstY + y, isFirst)
         if (bl === this.NUISANCE) {
          
         }
         blobs.push({
          cell: bl,
          x: x,
          y0: y,
          y1: firstY + y,
          h: firstY + 1,
          del: delayDrop,
          isLand: isLand,
          landFrames: bl === this.NUISANCE ? 0 : 22
         });
         
         if (bl > 0 && highestY > y) {
          highestY = y;
         }
         if (longest < (delayDrop + firstY * speed) && bl > 0) {
          longest = delayDrop + (firstY * speed);
         }
         delayDrop += this.insane.isOn ? 0 : 0;
        }
        
       }
      }
      
      //////console.log(longest * speed)
      
      for (let blob of blobs) {
       let timeFall = Math.floor(Math.max(0, (blob.h) * speed));
       //TODO write down
       
       this.drawableStack[blob.x][blob.y0] = 0;
       this.effects.drop.addItem({
        x: blob.x,
        y0: blob.y0,
        y1: blob.y1,
        cell: blob.cell,
        delay: blob.del,
        frames: timeFall,
        maxf: Math.floor(Math.max(0, (blob.h) * speed)),
        isLandSound: (blob.isLand) ? 1 : 0,
        fallType: 1,
        landFrames: blob.landFrames
       });
      }
      
      this.setDelay(1, 2 + (isExist ? 25 : 0) + Math.floor(Math.max(0, (longest))));
      //this.setDelay(1, 24);
      this.drawStack();
      this.checkInstantDrop();
     }
    }
   }
   
   if (this.delay[2] == 22) { //TODO 23 is the default delay after a chain
    ////////console.log(this.activeVoiceLine)
   }
   
   if (this.delay[1] == 1) this.parent.checkWaitDeterminism();
   
   if (this.delay[1] == 0) {
    //alert("detect?")
    if (this.isEnable) this.checkChain(this.stack);
    //this.drawStack(this.stack);
    if (this.erasedBlocks.length == 0) {
     
     
     if (!this.insane.isOn || this.insane.insaneType !== 1) this.chain = 0;
     manager.forEachPlayer(player => {
      ////////console.log(player.player === this.parent.player, player.player, this.parent.player)
      if (player.player === this.parent.player) return;
      ////////console.log(player.garbage)
      arrayModifyBatch(player.garbage, dl => {
       ////////console.log(dl.player, this.parent.player);
       ////////console.log(dl)
       if (dl.player !== this.parent.player) return;
       dl.wait = false;
       dl.frames = -9999;
       ////////console.log(dl)
      });
      arrayModifyBatch(player.garbageBehind, dl => {
       ////////console.log(dl.player, this.parent.player);
       ////////console.log(dl)
       if (dl.player !== this.parent.player) return;
       dl.wait = false;
       dl.frames = -9999;
       ////////console.log(dl)
      });
     });
     if (this.canFallTrash) this.dropGarbage();
    }
   }
   
   /*if (this.delay[1] == 0) {
    this.stackCollapse(true);

    this.parent.emitAttack(this.delayedGarbage);
    this.delayedGarbage = 0;
   }*/
   if (this.delay[0] == 1) this.parent.checkWaitDeterminism();
   if (this.delay[0] == 0) {
    this.previewNextBlob();
    
   }
   
   if (this.delay[delayPrioritize] === 0) {
    this.delay[delayPrioritize] = -1;
   }
  } while (false);
  
  
  
  
  this.rotate180Timer--;
  this.warningTrig.assign(((this.blobCount + this.parent.garbageLength) > (this.fieldSize.w * this.fieldSize.vh * 0.75) && !this.insane.isOn) ? 1 : 0);
  
 }
 
 updateContinuousDelay() {
  if (this.voiceDelay === 0) {
   
   this.voiceDelay--;
   if ("" !== this.parent.activeVoiceline) {
    
    this.parent.playVoice(this.activeVoiceLine);
    let ll = this.insane.isOn ? this.parent.getVoiceDuration(this.activeVoiceLine) : -4;
    if (this.actualChain >= this.forecastedChain) {
     this.nextVoice.duration = ll;
    }
    if (this.activeVoiceLine.includes("spell")) {
     //music.stopAll();
     for (let j = 1; j <= (this.repeatSpellVoice); j++) {
      this.parent.addDelayHandler(true, j * 9, () => {
       this.parent.playVoice(this.activeVoiceLine);
       if (this.actualChain >= this.forecastedChain) {
        this.nextVoice.duration = ll;
        
       }
      }, true);
     }
     this.repeatSpellVoice = 0;
    }
   }
   
  }
  else if (this.voiceDelay >= 0) this.voiceDelay--;
  
  if (this.nextVoice.duration >= 0) {
   this.nextVoice.duration--;
   if (this.nextVoice.duration === 0) {
    //this.checkDropBlock();
    this.parent.playVoice(this.nextVoice.name);
   }
  }
  
  if (this.isAllClearTemp > 0) {
   this.isAllClearTemp--;
   if (this.isAllClearTemp == 0) {
    this.isAllClearTemp = -9;
    this.playAllClearAnim(2);
   }
  }
 }
 
 dropGarbage() {
  let a = JSON.parse(JSON.stringify(this.parent.garbage.filter(m => m.frames <= this.parent.inputFrames && m.count > 0 && !m.wait))),
   len = a.length,
   count = 0;
  
  if (len == 0) return;
  let m = [];
  let blobs = [];
  let b = 0;
  let q = 0;
  let height = 0;
  let removeHp = 0;
  let mpl = {};
  
  let spawnStartY = this.fieldSize.hh - 3,
   deepest = spawnStartY,
   depth = 0;
  
  
  if (this.garbageOrder.on && this.fieldSize.w == 6) {
   let qm = this.garbageOrder.n % 6;
   for (let hm = 0; hm < 6; hm++) {
    m.push(this.garbageOrder.order[(this.garbageOrder.n + hm) % 6])
   }
  } else {
   for (let h = 0; h < this.fieldSize.w; h++) {
    m.push(h);
   }
   m.sort(() => 0.5 - this.parent.seeds.field.next());
  }
  
  
  
  let j = [];
  if (len > 0)
   for (let s = 0, qw = this.parent.garbage; s < qw.length; s++) {
    j.push(qw[s].id);
   }
  ////////console.log(this.parent.garbage);
  
  let fallRows = {};
  for (let kx = 0; kx < this.fieldSize.w; kx++)
   for (let i = this.fieldSize.h - 1; i >= 0; i--) {
    fallRows[kx] = i;
    if (!this.testGridSpace(kx, i)) {
     if (deepest < i) {
      deepest = i;
     }
     break;
    }
   }
  while (len > 0) {
   let r = a[0];
   //this.parent.garbage.shift()
   //let p = r.id
   let rx = m[b];
   let startY = fallRows[rx];
   
   
   let index = j.indexOf(r.id);
   
   if (this.parent.rpgAttr.isOn) game.forEachPlayer(player => {
    if (r.player === player.player) {
     if (player.player in mpl) mpl[player.player] += r.hpdmg;
     else mpl[player.player] = r.hpdmg;
    }
   });
   
   this.stack[rx][startY - height] = this.NUISANCE;
   b++;
   
   //removeHp += r.hpdmg;
   
   
   blobs.push({
    cell: this.NUISANCE,
    x: rx,
    y: startY - height,
    h: height,
    ih: height == 0
   });
   if (b >= this.fieldSize.w) {
    height++;
    b = 0;
    count++;
   }
   
   r.count--;
   this.parent.garbage[index].count--;
   if (this.parent.garbage[index].count <= 0) {
    this.parent.garbage.splice(index, 1);
    j.splice(index, 1);
    a.shift();
    len--;
   }
   
   q++;
   
   
   this.canFallTrash = false;
   if (count > 4) break;
   
  }
  
  
  if (q > 0) {
   if (q > 5 && q < 18) this.parent.playVoice("damage1");
   if (q > 17) {
    this.parent.playVoice("damage2");
    this.parent.rectanim.play("damage2");
   }
   this.blobCount = this.checkBlobCount(this.stack);
   
   //this.parent.rpgAttr.addHP(-removeHp);
   this.parent.rpgAttr.emulateDamage(mpl);
   let isLose = false;
   if (this.parent.rpgAttr.isOn && this.parent.rpgAttr.checkZeroHP()) {
    isLose = true;
   }
   if (isLose) this.checkLose();
   this.parent.conclude1v1Overhead(2);
   this.parent.rpgAttr.hpDamage = this.parent.calculateHPDamage();
   
   
   //TODO test fever
   //if (q > 29 && !this.insane.isOn) this.insane.delay.readyHenshin = 3;
   this.parent.garbageLastForTray.assign(this.parent.garbageLength);
   
   depth = deepest - spawnStartY;
   
   ////////console.log("blob fall of " + this.parent.player + ": " + s)
   
   let speed = this.isFever ? (this.insane.isOn ? 1 : 2.5) : 3;
   
   //t = √(2h/g)
   if (q > 13) {
    this.triggerBoardRotates.garbageLanding.on = true;
   }
   
   for (let blob of blobs) {
    let timeFall = Math.floor((Math.max(0, fallRows[blob.x] - spawnStartY)) * speed);
    
    if (fallRows[blob.x] >= 1) this.effects.drop.addItem({
     x: blob.x,
     y0: spawnStartY - blob.h,
     y1: blob.y,
     cell: blob.cell,
     frames: timeFall,
     maxf: timeFall, //Math.floor(Math.max(((depth) * speed), 0)),
     delay: 15,
     isLandSound: blob.ih ? (q > 5 ? 3 : 2) : 0,
     triggerBoardRot: q > 13,
     fallType: 0,
     landFrames: 15
    });
   }
   
   
   if (depth > 0) this.setDelay(1, (this.isFever ? 5 : 7) + 15 + Math.floor(Math.max((depth * speed), 0)));
   this.drawStack();
   this.parent.garbageLength = this.parent.calculateGarbage();
   this.parent.garbageLastForTray.assign(this.parent.garbageLength);
   
   if (this.garbageOrder.on && this.fieldSize.w == 6) {
    this.garbageOrder.n += q;
    this.garbageOrder.n %= 6
   }
  }
  this.checkHoles();
 }
 
 #checkConn(s, xd, yd) {
  let sta = JSON.parse(JSON.stringify(s));
  let checkConn = (stack, x, y) => {
   if (x >= this.fieldSize.w || y >= this.fieldSize.h || y < 0 || x < 0) return;
   let origin = stack[x][y];
   for (let d = 0; d < FLAG_DIRECTIONS.length; d++) {
    let dir = FLAG_DIRECTIONS[d];
    let dx = dir[0],
     dy = dir[1];
    //////console.log("NO", FLAG_DIRECTIONS[d], d)
    if (y + dy < 0 || x + dx < 0 || x + dx >= this.fieldSize.w || y + dy >= this.fieldSize.h) continue;
    let ev = stack[x + dx][y + dy];
    if ((y + dy < this.fieldSize.hh) || (y < this.fieldSize.hh) || (ev !== origin) || origin !== this.NUISANCE) continue;
    if (dx == 1) stack[x][y] |= FLAG_CONNECTIONS.right;
    if (dx == -1) stack[x][y] |= FLAG_CONNECTIONS.left;
    if (dy == 1) stack[x][y] |= FLAG_CONNECTIONS.down;
    if (dy == -1) stack[x][y] |= FLAG_CONNECTIONS.up;
    //stack[x][y] = 0
    
   }
  }
  checkConn(sta, xd, yd);
  return sta;
 }
 
 drawStack(newStack) {
  //if (!this.isEnable) return;
  let aux = this.isAux ? "stackAux" : "stack";
  let widthQuotient = this.parent.fieldSize.w / this.fieldSize.w;
  let heightQuotient = (this.parent.fieldSize.vh / this.fieldSize.vh);
  
  if (newStack !== void 0) {
   if (newStack === "reset") {
    for (let x = 0, len = newStack.length; x < len; x++) {
     for (let y = 0, top = newStack[x].length; y < top; y++) {
      this.drawableStack[x][y] = 0;
     }
    }
   } else {
    for (let x = 0, len = newStack.length; x < len; x++) {
     for (let y = this.fieldSize.hh - 2, top = newStack[x].length; y < top; y++) {
      this.drawableStack[x][y] = newStack[x][y];
      //this.drawableStack = this.#checkConn(this.drawableStack, x, y);
      
      
     }
    }
    for (let x = 0, len = this.fieldSize.w; x < len; x++) {
     for (let y = this.fieldSize.hh - 2, top = this.fieldSize.h; y < top; y++) {
      
      //this.drawableStack = this.#checkConn(this.drawableStack, x, y);
      
      if (y > this.fieldSize.hh - 1 && this.drawableStack[x][y] !== this.NUISANCE)
       for (let d = 0; d < FLAG_DIRECTIONS.length; d++) {
        let dir = FLAG_DIRECTIONS[d];
        let dx = dir[0],
         dy = dir[1];
        //////console.log("NO", FLAG_DIRECTIONS[d], d)
        if (y + dy < 0 || x + dx < 0 || x + dx >= this.fieldSize.w || y + dy >= this.fieldSize.h) continue
        let ev = this.drawableStack[x + dx][y + dy] % 256,
         origin = this.drawableStack[x][y] % 256;
        if ((y + dy < this.fieldSize.hh) || (y < this.fieldSize.hh) || (ev !== origin) || ev === this.NUISANCE) continue;
        if (dx == 1) this.drawableStack[x][y] |= FLAG_CONNECTIONS.right;
        if (dx == -1) this.drawableStack[x][y] |= FLAG_CONNECTIONS.left;
        if (dy == 1) this.drawableStack[x][y] |= FLAG_CONNECTIONS.down;
        if (dy == -1) this.drawableStack[x][y] |= FLAG_CONNECTIONS.up;
        //stack[x][y] = 0
        
       }
      
     }
    }
   }
  }
  
  this.parent.canvasClear(aux);
  this.drawArray(aux, this.drawableStack, 0, -1 * (this.fieldSize.hh), void 0, void 0, widthQuotient, heightQuotient, true, true);
 }
 
 drawActive() {
  let aux = this.isAux ? "pieceAux" : "piece";
  let aux2 = this.isAux ? "backAux" : "back";
  this.parent.canvasClear(aux);
  this.parent.canvasClear(aux2);
  this.runAllClearAnim(aux2);
  this.makeGhostPiece();
  this.drawActivePiece();
  this.effects.drop.update();
 }
 
 drawActivePiece() {
  if (!this.isEnable) return;
  let aux = this.isAux ? "pieceAux" : "piece";
  let widthQuotient = this.parent.fieldSize.w / this.fieldSize.w;
  let heightQuotient = this.parent.fieldSize.vh / this.fieldSize.vh;
  
  let vertical = ((this.piece.y) - (this.fieldSize.hh));
  if (!this.isFever && !this.insane.isOn) {
   let hh = step(this.piece.y % 1, 3, 0);
   vertical = Math.floor((this.piece.y) - (this.fieldSize.hh));
   vertical += hh;
  }
  
  
  
  this.piece.rotAnim.rot = this.piece.rotAnim.curRot - (this.piece.rotAnim.diffRot * (this.piece.rotAnim.timeAnim / this.piece.rotAnim.maxTime));
  if (this.piece.isBig) {
   
   this.drawRect(aux, (1 + this.piece.x) / 2, (vertical) / 2, 0, this.colorSet[this.piece.rot] - 1, widthQuotient * 2, heightQuotient * 2, true, true);
  } else {
   let maxDir = 4;
   if (this.piece.active.type === 0) {
    for (let i = 0; i < 2; i++) {
     let reference = this.activeBlobDisplay.two[`1|${i}`];
     let angleNumber = (((this.piece.rotAnim.rot + reference.offset.rot) % maxDir) + maxDir) % maxDir;
     let ax = reference.offset.distance * Math.cos(radians((angleNumber * 90)));
     let ay = reference.offset.distance * Math.sin(radians((angleNumber * 90)));
     //////console.log(angleNumber)
     this.drawArray(aux, [
      [1]
     ], this.piece.x + ax + reference.offset.x, vertical + ay + reference.offset.y, reference.blob, void 0, widthQuotient, heightQuotient, true, true);
    }
   } else if (this.piece.active.type < 3) {
    for (let li = 1; li < 3; li++)
     for (let i = 0; i < 2; i++)
      if (`${li}|${i}` in this.activeBlobDisplay.three) {
       let reference = this.activeBlobDisplay.three[`${li}|${i}`];
       let angleNumber = (((this.piece.rotAnim.rot + reference.offset.rot) % maxDir) + maxDir) % maxDir;
       let ax = reference.offset.distance * Math.cos(radians((angleNumber * 90)));
       let ay = reference.offset.distance * Math.sin(radians((angleNumber * 90)));
       //////console.log(angleNumber)
       this.drawArray(aux, [
        [1]
       ], this.piece.x + ax + reference.offset.x, vertical + ay + reference.offset.y, reference.blob, void 0, widthQuotient, heightQuotient, true, true);
      }
   } else this.drawArray(aux, this.piece.activeArr, this.piece.x, vertical, void 0, void 0, widthQuotient, heightQuotient, true, true);
  }
  
  if (this.piece.rotAnim.timeAnim > 0) this.piece.rotAnim.timeAnim--
  
 }
 
 makeGhostPiece() {
  if (this.piece.y < -10) return;
  let aux = this.isAux ? "pieceAux" : "piece";
  let widthQuotient = this.parent.fieldSize.w / this.fieldSize.w;
  let heightQuotient = this.parent.fieldSize.vh / this.fieldSize.vh;
  
  for (let gx = 0, win = this.piece.activeArr.length; gx < win; gx++) {
   for (let raiseY = 0, len = this.piece.activeArr[gx].length, gy = len - 1; gy >= 0; gy--) {
    let lc = this.piece.isBig ? this.colorSet[this.piece.rot] : this.piece.activeArr[gx][gy];
    let lx = this.piece.x + gx;
    let ly = ~~(this.piece.y) + gy + this.checkDropSpecific(40, this.piece.x + gx, ~~(this.piece.y) + gy) - raiseY - (this.fieldSize.hh);
    if (this.piece.activeArr[gx][gy]) {
     this.drawArray(aux, [
      [1]
     ], lx, ly, 7, lc - 1, widthQuotient, heightQuotient, true, true);
     raiseY++;
    }
   }
  }
  let lem = this.dropForecast.poppable.length;
  for (let u = 0; u < lem; u++) {
   let g = this.dropForecast.poppable[u];
   //this.drawArray(aux, [[g[2]]], g[0], g[1], void 0, 0, widthQuotient, heightQuotient, true, true);
   this.parent.canvasCtx[aux].drawImage(
    game.misc.blob_target,
    (this.parent.cellSize * widthQuotient * g[0]),
    (this.parent.cellSize * heightQuotient * (g[1])) + (this.visibleFieldBufferHeight * this.parent.cellSize * (this.parent.fieldSize.vh / this.defaultFieldSize.vh)),
    (this.parent.cellSize * widthQuotient),
    (this.parent.cellSize * heightQuotient)
   )
  }
 }
 
 updateGhostPiece() {
  
  let int = 0;
  
  let blobLen = 0;
  
  for (let j = 0; j < this.dropForecast.blobs.length; j++) {
   let ref = this.dropForecast.blobs[j];
   if (ref[2] > 0) {
    if (this.dropForecast.stack[ref[0]][ref[1]] < this.dropForecast.PERMANENT_MASK && this.dropForecast.stack[ref[0]][ref[1]] > 0) {
     this.dropForecast.stack[ref[0]][ref[1]] = 0;
    }
    
   }
  }
  
  let blobs = [];
  this.dropForecast.blobs.length = 0;
  
  for (let gx = 0, win = this.piece.activeArr.length; gx < win; gx++) {
   for (let raiseY = 0, len = this.piece.activeArr[gx].length, gy = len - 1; gy >= 0; gy--) {
    let lc = this.piece.isBig ? this.colorSet[this.piece.rot] : this.piece.activeArr[gx][gy];
    let lx = this.piece.x + gx;
    let ly = ~~(Math.floor(this.piece.y) + gy + this.checkDropSpecific(40, this.piece.x + gx, ~~(this.piece.y) + gy) - raiseY - this.fieldSize.hh);
    if (this.piece.activeArr[gx][gy]) {
     //this.drawArray(aux, [[lc]], lx, ly, void 0, 16, widthQuotient, heightQuotient, true, true);
     blobLen++;
     raiseY++;
     if (lx < this.fieldSize.w && lx >= 0) blobs.push([lx, ly, lc]);
     
    } /**/
    
    //else blobs.push([0,0,0]);
    
    
   }
  }
  
  for (let j = 0; j < blobs.length; j++) {
   let ref = blobs[j];
   if (ref[2] > 0) {
    let len = this.dropForecast.blobs.length;
    let hx = (j < blobLen) ? (ref[0]) : (0);
    let hy = (j < blobLen) ? (ref[1]) : (0);
    let hc = (j < blobLen) ? (ref[2]) : (0);
    
    if (j >= len) {
     this.dropForecast.blobs.push([hx, hy, hc]);
    } else {
     
     this.dropForecast.blobs[int][0] = hx;
     this.dropForecast.blobs[int][1] = hy;
     this.dropForecast.blobs[int][2] = hc;
     
    }
    int++;
   }
  }
  
  this.checkForecastedConns();
 }
 
 checkForecastedConns() {
  //let stack = JSON.parse(JSON.stringify(this.dropForecast.stack));
  for (let j = 0; j < this.dropForecast.blobs.length; j++) {
   let ref = this.dropForecast.blobs[j];
   if (ref[2] > 0) this.dropForecast.stack[ref[0]][ref[1]] = ref[2];
   
  }
  
  let detected = {};
  this.dropForecast.poppable.length = 0;
  
  for (let j = 0; j < this.dropForecast.blobs.length; j++) {
   let ref = this.dropForecast.blobs[j];
   //this.dropForecast.stack[ref[0]][ref[1]] = ref[2];
   if (ref[2] > 0 && !(`${ref[0]}|${ref[1]}` in detected)) {
    let o = {
     
    };
    /*o[`${ref[0]}|${ref[1]}`] = {
    	x: ref[0],
    	y: ref[1],
    	color: ref[2]
    };*/
    blobChainDetector.bfs(o, this.dropForecast.stack, ref[0], ref[1], this.fieldSize.w, 0, this.fieldSize.vh, this.dropForecast.PERMANENT_MASK);
    let count = Object.keys(o).length;
    for (let h in o) {
     let m = o[h];
     detected[h] = 1;
     if (count >= this.blobRequire) {
      if (this.stack[m.x][m.y + this.fieldSize.hh] > 0) this.dropForecast.poppable.push([m.x, m.y, m.color]);
     }
    }
    
   }
   
  }
  //////console.log(detected)
  
  
 }
 
 checkValid(arr, cx, cy, ox, oy, isCeil) {
  let px = cx + ((ox !== void 0 ? ox : 0) + this.piece.x);
  let py = ~~(cy + ((oy !== void 0 ? oy : 0) + this.piece.y));
  if (isCeil) py = Math.ceil(cy + ((oy !== void 0 ? oy : 0) + this.piece.y))
  for (let x = 0; x < arr.length; x++) {
   for (let y = 0; y < arr[x].length; y++) {
    if (arr[x][y] && this.testGridSpace(x + px, y + py)) return false;
   }
  }
  return true;
 }
 
 checkDrop(dis) {
  let a = 0;
  while (this.checkValid(this.piece.activeArr, 0, a) && dis >= a) {
   a++;
  }
  ////////console.log(a)
  return a - 1;
 }
 
 checkDropSpecific(dis, x, y) {
  let a = 0;
  while (!this.testGridSpace(x, y + a) && dis >= a) {
   a++;
  }
  ////////console.log(a)
  return a - 1;
 }
 
 checkLose() {
  let isLose = false;
  
  this.piece.enabled = false;
  if (!this.parent.rpgAttr.isOn) {
   isLose = true;
  } else {
   if (this.parent.rpgAttr.checkZeroHP()) {
    isLose = true;
   } else {
    if (this.insane.isOn && this.parent.rpgAttr.isWOIHPMode) {
     
     this.preview.queue.unshift({
      type: this.piece.active.type,
      color1: this.piece.active.color1,
      color2: this.piece.active.color2
     });
     
     this.insane.delay.del = 5;
     this.insane.chainScore = -1;
     this.insane.requireChain -= 2;
     this.insane.status = "fail";
     this.piece.enable = false;
     this.piece.y = -99;
     
     this.nextVoice.name = "insane_fail";
     this.nextVoice.duration = 20;
     
     this.setDelay(0, -9);
    }
    else {
     //let mm = this.parent.calculateGarbage() * this.targetPoint / 2;
     this.parent.rpgAttr.addHP(-(this.parent.rpgAttr.maxHP / 5), true);
     //this.emitAttack(mm);
     this.simulateSplashOut();
     this.parent.rpgAttr.addStatusEffect(this.parent.player, "immune2garbage", 20 + 30, {});
     this.parent.garbage.length = 0;
     this.parent.garbageBehind.length = 0;
     this.parent.garbageLength = 0
     this.parent.garbageBehindLength = 0;
     this.parent.garbageLastForTray.assign(0);
     this.parent.garbageBehindLastForTray.assign(0);
     this.parent.rpgAttr.hpDamage = 0;
    }
    if (this.parent.rpgAttr.checkZeroHP()) {
     isLose = true;
    }
   }
  }
  if (isLose) {
   this.parent.checkLose();
   //this.delay[0] = -60;
   this.isSpawnablePiece = false;
  } else {
   this.resetGrid();
   this.delay[0] = 10;
  }
 }
 
 resetGrid() {
  for (let x = 0; x < this.fieldSize.w; x++) {
   for (let y = 0; y < this.fieldSize.h; y++) {
    if (this.stack[x][y]) this.stack[x][y] = 0;
   }
  }
  
  
  this.drawStack(this.stack);
  let aux = this.isAux ? "pieceAux" : "piece";
  this.parent.canvasClear(aux);
 }
 
 checkRespawnOrDie() {
  
 }
 
 spawnPiece(type, color1, color2, matrix, sx, sy, kickTable) {
  if (!this.isSpawnablePiece || !this.isActive) return;
  if (this.canSpawnPiece(type, color1, color2, matrix, sx, sy, kickTable)) {
   //this.piece.y += this.checkDrop(1);
   //let temp = this.piece.template;
   this.rotate180Timer = -1;
   this.canFallTrash = true;
   this.canFallTrashAfterFever = true;
   
   if (type === 4) {
    this.piece.rot = color1;
    this.piece.isBig = true;
   } else {
    this.piece.isBig = false;
    this.piece.rot = 0;
    this.piece.rotAnim.rot = 0;
    this.piece.rotAnim.curRot = 0;
    this.piece.rotAnim.timeAnim = 0;
    if (type < 3) {
     for (let px = 0; px < 3; px++) {
      for (let py = 0; py < 3; py++) {
       if (matrix[0][px][py]) {
        if (type == 0) {
         if (`${px}|${py}` in this.activeBlobDisplay.two) {
          this.activeBlobDisplay.two[`${px}|${py}`].blob = matrix[0][px][py];
          
         }
        }
        else if (type < 3) {
         if (`${px}|${py}` in this.activeBlobDisplay.three) {
          this.activeBlobDisplay.three[`${px}|${py}`].blob = matrix[0][px][py];
          
         }
        }
       }
      }
     }
    }
    
   }
   
   this.piece.dirty = true;
   //this.piece.isAir = true;
   this.piece.delay = 7;
   this.piece.y += 0.04;
   
   for (let x = 0; x < this.fieldSize.w; x++) {
    for (let y = 0; y < this.fieldSize.vh; y++) {
     /*if ((y) > -1)/**/
     this.dropForecast.stack[x][y] = this.stack[x][y + this.fieldSize.hh] + this.dropForecast.PERMANENT_MASK;
    }
   }
   this.checkManipulatedPiece();
   
   this.piece.active.parameters.type = type;
   this.piece.active.parameters.color1 = color1;
   this.piece.active.parameters.color2 = color2;
   this.piece.active.parameters.matrix = matrix;
   this.piece.active.parameters.sx = sx;
   this.piece.active.parameters.sy = sy;
   
   if (this.parent.ai.active && !game.replay.isOn) {
    let h = this.piece.hold || 0;
    
    let pieceX = sx + Math.min((this.fieldSize.w - 5), ~~((this.fieldSize.w - 10) / 2)),
     pieceY = sy + this.fieldSize.hh - 2;
    //stack, preview, w, h, hh, vh
    this.parent.aiBlob.evaluate(this.stack, this.preview.queue, this.fieldSize.w, this.fieldSize.h, this.fieldSize.hh, this.fieldSize.vh);
   }
  }
 }
 
 canSpawnPiece(type, color1, color2, matrix, sx, sy, kickTable) {
  
  
  this.piece.template = matrix
  let temp = this.piece.template;
  this.piece.active.color1 = color1;
  this.piece.rot = 0;
  this.piece.activeArr = matrix[0];
  this.piece.x = sx + Math.min((this.fieldSize.w - 5), ~~((this.fieldSize.w - 10) / 2));
  this.piece.y = this.fieldSize.hh - 2;
  this.piece.active.color2 = color2;
  //this.piece.active.colorRot = color1;
  this.piece.active.type = type;
  
  
  
  ////////console.log(temp[index], this.piece.y, this.piece.x);
  this.lock.delay = 30;
  this.lock.rot = 15;
  this.lock.move = 15;
  this.piece.kickTable = kickTable;
  this.piece.rotated = false;
  this.piece.isAir = false;
  this.piece.moved = false;
  this.piece.dirty = true;
  this.piece.enable = true;
  //////console.log([4 + Math.min((this.fieldSize.w - 5), ~~((this.fieldSize.w - 10) / 2)), this.fieldSize.hh + 1])
  
  return true;
 }
 
 checkBlockedSpawnPoint() {
  if (this.testGridSpace(4 + Math.min((this.fieldSize.w - 5), ~~((this.fieldSize.w - 10) / 2)), this.fieldSize.hh)) {
   //this.stack = grid(this.fieldSize.w, this.fieldSize.h, 0);
   return true;
  }
  if (((this.insane.insaneType !== 1 && this.insane.isOn) || this.isFever) && this.testGridSpace(5 + Math.min((this.fieldSize.w - 5), ~~((this.fieldSize.w - 10) / 2)), this.fieldSize.hh)) {
   //this.stack = grid(this.fieldSize.w, this.fieldSize.h, 0);
   return true;
  }
  
  return false
 }
 
 previewReset(seed) {
  if (seed !== void 0) this.rngPreview.seed = seed;
  this.piece.dropsetN = 0;
  this.previewInitialize();
  //let h = JSON.stringify(this.preview.queue)
  //////console.log(h)
 }
 
 previewNextBlob() {
  if (this.isSpawnablePiece && this.isActive) {
   if (this.checkBlockedSpawnPoint()) this.checkLose();
   else {
    let r = this.previewNextBag();
    let a = this.setBlob(r.type, r.color1, r.color2);
    
    //////console.log(a)
    
    this.spawnPiece(r.type, a.color1, a.color2, a.matrix, a.sx, a.sy, a.kickTable);
    this.previewDraw();
   }
  }
 }
 
 previewRefresh(seed) {
  this.rngPreview.seed = seed;
  this.previ
 }
 
 previewGenerateBag() {
  //let pieceList = [];
  //let len = this.preview.bag.length;
  //this.preview.bag.forEach(function(a) { pieceList.push(a) });
  /*for (var i = 0; i < pieceList.length - 1; i++)
  {
   var temp = pieceList[i];
   var rand = ~~((pieceList.length - i) * this.rngPreview.next()) + i;
   pieceList[i] = pieceList[rand];
   pieceList[rand] = temp;
  };*/
  
  
  
  let color1 = this.colorSet[~~(this.rngPreview.next() * this.colors)],
   color2 = this.colorSet[~~(this.rngPreview.next() * this.colors)],
   dropset = /*~~(this.rngPreview.next() * 5);/**/ this.piece.dropset[this.piece.dropsetN % 16];
  if (!this.isSpecialDropset) dropset = 0;
  
  let seed = this.rngPreview.seed;
  //dropset = 4;
  
  if (dropset === 4) {
   color1 = ~~(this.rngPreview.next() * this.colors);
  }
  
  
  
  while (color1 == color2 && dropset == 3) {
   color2 = this.colorSet[~~(this.rngPreview.next() * this.colors)];
  }
  
  if (dropset !== 0) {
   this.rngPreview.seed = seed;
  }
  
  let pieceList = {
   type: dropset,
   color1: color1,
   color2: color2,
   rot: color1
  };
  
  this.piece.dropsetN++;
  return pieceList;
 }
 
 previewInitialize() {
  this.piece.dropsetN = 0;
  while (true) {
   this.preview.queue = [];
   //for (let y of [1,2]) this.preview.queue.push(0);
   //this.previewGenerateBag();
   //this.piece.dropsetN = 0;
   for (let g = 0; g < 10; g++) this.preview.queue.push(this.previewGenerateBag());
   if (true || (this.preview.queue[0] == 0 && this.preview.queue[1] == 0)) break;
  }
  
  this.previewDraw();
 }
 
 previewNextBag() {
  let next = !this.isActive ? this.preview.queue[0] : this.preview.queue.shift();
  while (this.preview.queue.length < 10) this.preview.queue.push(this.previewGenerateBag());
  
  
  return next;
  
 }
 
 previewDraw() {
  if (this.isAux || !this.isEnable) return;
  this.parent.canvasClear('blobNext');
  let ms = 1.5;
  let m = this.preview.queue[0];
  //////console.log(m);
  if (!this.preview.queue?.[0]) return;
  
  let active = this.piece.active.parameters;
  
  let piece = this.setBlob(m.type, m.color1, m.color2);
  
  let m2 = this.preview.queue[1];
  let piece2 = this.setBlob(m2.type, m2.color1, m2.color2);
  
  let mx1 = ((this.parent.player % 2) == 1) ? 1 : 0,
   mx2 = ((this.parent.player % 2) == 0) ? 1 : 0;
  if (this.parent.isCompact) {
   mx1 = 0;
   mx2 = 1;
  }
  
  
  let x = [
   active.sx + mx1 - (active.type == 4 ? 1 : 2) - ms - (active.type !== 0 ? 0.5 : 0),
   piece.sx + mx1 - (piece.type == 4 ? 1 : 2) - ms - (piece.type !== 0 ? 0.5 : 0),
   piece2.sx + mx2 - (piece2.type == 4 ? 1 : 2) - ms - (piece2.type !== 0 ? 0.5 : 0),
   piece2.sx + mx2 - (piece2.type == 4 ? 1 : 2) - ms - (piece2.type !== 0 ? 0.5 : 0),
  ];
  
  let y = [
   -2,
   (piece.sy),
   (piece2.sy),
   (piece2.sy + 2),
  ];
  
  let nexts = [active, piece, piece2];
  
  for (let h = 0; h < 3; h++) {
   let queue = this.effects.next.a.getItem(h);
   
   let next = h + 1;
   
   queue.blob = nexts[h].matrix[0];
   let msx = x[next];
   let msy = y[next];
   if (next < 3) {
    let queue2 = this.effects.next.a.getItem(next);
    msx = queue2.sx1;
    msy = queue2.sy1;
   }
   queue.sx1 = x[h];
   queue.sx2 = msx; //x[next];
   queue.sy1 = y[h];
   queue.sy2 = msy; //y[next];
   queue.type = nexts[h].type;
   queue.color1 = nexts[h].color1;
   queue.color2 = nexts[h].color2;
   //////console.log(queue)
  }
  
  this.effects.next.frame = this.effects.next.max;
  
  
  
  /*if (m.type === 4) {
  	this.drawRect("blobNext",
  		(piece.sx + mx1 - ms - 1 - (m.type !== 0 ? 0.5 : 0)) / 2,
  		(piece.sy + 0.5) / 2,
  		0,
  		(this.colorSet[piece.rot] - 1),
  		ms * 2,
  		ms * 2,
  		false);

  } else this.drawArray(
  	"blobNext",
  	piece.matrix[0],
  	piece.sx - 2 + mx1 - ms - (piece.type !== 0 ? 0.5 : 0),
  	piece.sy + 0.5,
  	void 0,
  	0,
  	ms, ms,
  	false, false
  );
  if (m2.type === 4) {
  	this.drawRect("blobNext",
  		(piece2.sx + mx2 - ms - 1 - (m2.type !== 0 ? 0.5 : 0)) / 2,
  		(piece2.sy + 2.5) / 2,
  		0,
  		(this.colorSet[piece2.rot] - 1),
  		ms * 2,
  		ms * 2,
  		false);

  } else this.drawArray(
  	"blobNext",
  	piece2.matrix[0],
  	piece2.sx - 2 + mx2 - ms - (piece2.type !== 0 ? 0.5 : 0),
  	piece2.sy + 2.5,
  	void 0,
  	0,
  	ms, ms,
  	false, false
  );/**/
 }
 
 previewDrawUpdate() {
  this.parent.canvasClear('blobNext');
  if (this.effects.next.frame > 0) this.effects.next.frame--;
  this.effects.next.a.update();
 }
 checkManipulatedPiece() {
  if (!this.piece.enable) return false;
  let air = this.checkValid(this.piece.activeArr, 0, 1);
  
  if (air) {
   if (!this.piece.isAir) {
    this.piece.isAir = true;
   }
  } else {
   if (this.piece.isAir) {
    this.piece.isAir = false;
    if (!this.piece.isHardDrop) {}
   }
  }
  
  if (this.piece.isAir) {
   this.lock.delay = this.settings.lock;
   this.piece.moved = true;
   this.lock.lockSoftdrop = 4;
  } else {
   if ((this.lockPrevent.rotate <= 0) && (this.lock.delay <= 0 || this.lock.move <= 0 || this.lock.rot <= 0 || this.lock.lockSoftdrop <= 0)) {
    //this.piece.y = ~~this.piece.y;
    this.piece.held = false;
    let hasDelay = this.setDelay(0, void 0);
    this.piece.dirty = true;
    if (!this.piece.isHardDrop) {
     this.parent.playSound("blub_drop");
    }
    this.piece.y = Math.floor(this.piece.y);
    this.piece.isHardDrop = false;
    this.addPieceStack(this.piece.activeArr);
    
    for (let h = 0; h < this.delayParamsLength; h++) {
     if (this.delay[h] > 0) hasDelay = true;
    }
    if (hasDelay) {
     this.piece.y = -90;
     this.piece.enable = false;
    }
    
   }
  }
 }
 
 updatePiece() {
  if (!this.piece.enable || !this.canControl) return;
  let gravity = this.settings.gravity;
  if (this.piece.isAir) {
   if (this.piece.delay <= 0) {
    if (gravity < 1) {
     this.piece.y += gravity;
    } else if (gravity == 1) {
     this.piece.y += this.checkDrop(1);
    } else if (gravity > 1) {
     this.piece.y += this.checkDrop(gravity);
    }
   }
   this.lock.delay = this.settings.lock;
   this.checkManipulatedPiece();
  }
  if (this.piece.delay > 0) {
   this.piece.delay--;
  }
  if (!this.piece.isAir) {
   this.piece.y = ~~this.piece.y;
   this.lock.delay--;
   this.checkManipulatedPiece();
  }
  if (this.lockPrevent.rotate >= 0) this.lockPrevent.rotate--;
  if (
   (this.lastPiece.x !== this.piece.x) ||
   /*(this.lastPiece.y !== this.piece.y) ||*/
   (this.lastPiece.rot !== this.piece.rot) ||
   this.piece.dirty
  ) {
   this.lastPiece.x = this.piece.x;
   //this.lastPiece.y = this.piece.y;
   this.lastPiece.rot = this.piece.rot;
   this.piece.dirty = false
   this.updateGhostPiece();
  }
  
  //this.moveX(1 * (((manager.frames % 50) < 10) ? 1 : -1));
  //this.rotatePiece(1);/**/
 }
 
 setDelay(type, value) {
  let delayAdd = value !== void 0 ? value : this.delayAdd[type];
  if (delayAdd <= 0) delayAdd = -10;
  this.delay[type] = delayAdd;
  return (this.delay[type] > 0);
 }
 
 rotatePiece(_direction) {
  if (!this.canControl || !this.piece.enable) return;
  let direction = _direction;
  if (this.rotate180Timer > 0) direction = 2;
  let temp = this.piece.template;
  let maxDir = 4;
  if (this.piece.isBig) {
   //direction = 0;
   maxDir = this.colors;
   let pos = ((this.piece.rot % maxDir) + maxDir) % maxDir;
   let nPos = (((this.piece.rot + direction) % maxDir) + maxDir) % maxDir;
   
   this.piece.rot = nPos;
   
   return;
  }
  let pos = ((this.piece.rot % maxDir) + maxDir) % maxDir;
  let nPos = (((this.piece.rot + direction) % maxDir) + maxDir) % maxDir;
  let rotate = temp[nPos];
  var dirType = "right";
  // This variable seems unnecessary because of the parameter _direction
  // but I'm going for this one instead of nothing...
  let dirInt = 0;
  switch (direction) {
   case 1:
    dirType = "right";
    dirInt = 1;
    break;
   case -1:
    dirType = "left";
    dirInt = -1;
    break;
   case 2:
    dirType = "double";
    dirInt = 2;
    break;
  }
  
  let isRotate = false;
  
  for (let i = 0, len = this.piece.kickTable[dirType][nPos].length; i < len; i++) {
   if (this.checkValid(
     rotate,
     this.piece.kickTable[dirType][pos][i][0],
     this.piece.kickTable[dirType][pos][i][1],
     0, 0, direction !== 2
    )) {
    this.parent.playSound("blub_rotate");
    let kickX = this.piece.kickTable[dirType][pos][i][0],
     kickY = this.piece.kickTable[dirType][pos][i][1];
    this.piece.x += kickX;
    this.piece.y += kickY;
    this.piece.rot = nPos;
    this.piece.activeArr = rotate;
    this.lock.delay = this.settings.lock;
    this.lock.lockSoftdrop = 4;
    this.lockPrevent.rotate = 9;
    this.piece.rotAnim.curRot += dirInt;
    this.piece.rotAnim.diffRot = this.piece.rotAnim.curRot - this.piece.rotAnim.rot;
    this.piece.rotAnim.timeAnim = this.piece.rotAnim.maxTime;
    
    if (!this.checkValid(this.piece.activeArr, 0, 1)) {
     this.lock.rot--;
    }
    this.piece.moved = false;
    this.piece.rotated = true;
    
    this.checkManipulatedPiece();
    
    isRotate = true;
    
    this.rotate180Timer = -4;
    
    break;
   }
  }
  
  if (!isRotate) {
   this.rotate180Timer = 20;
  }
 }
 
 moveX(shift) {
  if (!this.piece.enable || !this.canControl) return;
  if (this.checkValid(this.piece.activeArr, shift, 0, 0, 0, true)) {
   this.piece.x += shift;
   if (!this.checkValid(this.piece.activeArr, 0, 1, 0, 0, true)) {
    this.lock.move--;
   }
   this.lock.delay = this.settings.lock;
   this.piece.moved = true;
   this.piece.rotated = false;
   this.parent.playSound("blub_move");
   this.checkManipulatedPiece();
  }
 }
 
 shiftDelay() {
  if (this.parent.flagPresses.right && this.handling.xFirst === 0) {
   this.handling.xFirst = 1;
  }
  if (this.parent.flagPresses.left && this.handling.xFirst === 0) {
   this.handling.xFirst = -1;
  }
  
  if (this.handling.xFirst !== 0) {
   if (this.parent.flagPresses.right && !this.parent.flagPresses.left) {
    this.handling.xFirst = 1;
   } else if (this.parent.flagPresses.left && !this.parent.flagPresses.right) {
    this.handling.xFirst = -1;
   }
  }
  if (!this.parent.flagPresses.right && !this.parent.flagPresses.left && this.handling.xFirst !== 0) {
   this.handling.xFirst = 0;
  }
  
  {
   let x = 0;
   if (this.parent.flagPresses.right) x |= 0b10;
   if (this.parent.flagPresses.left) x |= 0b01;
   
   this.dasCancellation.assign(x);
  }
  
  if (this.parent.flagPresses.left || this.parent.flagPresses.right) {
   this.handling.das++;
   if (this.handling.das >= this.settings.das) {
    this.handling.arr++;
    for (let i = 0; i < this.fieldSize.w; i++) {
     let dir = 0;
     if (this.handling.xFirst === 1) {
      if (this.parent.flagPresses.left) {
       dir = -1;
      } else {
       dir = 1;
      }
     }
     if (this.handling.xFirst === -1) {
      if (this.parent.flagPresses.right) {
       dir = 1;
      } else {
       dir = -1;
      }
     }
     if (dir !== 0) this.moveX(dir);
     if (this.settings.arr !== 0) break;
    }
   }
  }
 }
 
 hardDrop() {
  if (this.piece.enable && this.canControl) {
   let distance = this.checkDrop(this.fieldSize.h);
   this.piece.y += distance;
   if (distance > 0) {
    this.piece.moved = true;
    this.piece.rotated = false;
   }
   this.lock.delay = -1;
   this.lockPrevent.rotate = -1;
   this.piece.isHardDrop = true;
   this.parent.playSound("blub_drop");
   this.checkManipulatedPiece();
  }
 }
 
 softDrop() {
  if (this.piece.enable && this.piece.delay <= 0 && this.canControl) {
   
   if (this.piece.isAir) {
    let gravity = this.settings.sft;
    let initial = Math.floor(this.piece.y);
    if (gravity < 1) {
     this.piece.y += gravity;
    } else if (gravity == 1) {
     this.piece.y += this.checkDrop(1);
    } else if (gravity > 1) {
     this.piece.y += this.checkDrop(gravity);
    }
    let final = Math.floor(this.piece.y);
    if (initial !== final) {
     this.piece.moved = true;
     this.divScoreAttackingTrash += 1.25 * (final - initial);
     //this.divScoreAttackingTrash += 1;
     this.parent.score += final - initial;
    }
    this.checkManipulatedPiece();
   }
   //this.lock.delay = -1;
  }
 }
 
 addPieceStack(arr) {
  let lines = 0;
  let hasDelay = false;
  let blobs = [];
  
  for (let x = 0; x < arr.length; x++) {
   let diffY = 0;
   for (let y = arr[x].length - 1; y >= 0; y--) {
    if (arr[x][y]) {
     let px = x + this.piece.x;
     let py = ~~(y + this.piece.y);
     this.stack[px][py] = this.piece.isBig ? this.colorSet[this.piece.rot] : arr[x][y];
     ////////console.log(py)
     blobs.push({
      cell: this.piece.isBig ? this.colorSet[this.piece.rot] : arr[x][y],
      x: px,
      y: py,
      ih: diffY === 0 ? 1 : 0,
      
     });
     diffY++;
    }
   }
  }
  
  hasDelay = this.setDelay(2, -9);
  
  let speed = 2;
  
  let holesObj = this.checkHolesByRow();
  
  
  this.checkForecast();
  let isPuffOut = false;
  if (this.isAux) {
   if (this.forecastedChain <= 0) {
    isPuffOut = true;
   }
  }
  
  if (!isPuffOut) {
   let delayed = 0;
   for (let blob of blobs) {
    
    let initialY = blob.y;
    let finalY = blob.y + holesObj.row[blob.x];
    let difference = finalY - initialY;
    
    let del = (this.isFever || this.insane.isOn) ? 7 : 10;
    
    let timeFall = Math.ceil(holesObj.row[blob.x] * speed * 2) + ((difference > 0) ? del : 0);
    /*if (holesObj.row[blob.x] >= 1)/**/
    this.effects.drop.addItem({
     x: blob.x,
     y0: initialY,
     y1: finalY,
     cell: blob.cell,
     frames: timeFall,
     maxf: timeFall + 1,
     isLandSound: blob.ih,
     fallType: 2,
     landFrames: 15
    });
    
    if (difference > 0) delayed = del;
    ////console.log(difference);
    
   }
   if ((holesObj.most === 0 && !this.isFever && !this.insane.isOn) || false) this.drawStack(this.stack);
   
   this.checkInstantDrop();
   this.setDelay(1, 14);
   if (holesObj.most > 0) this.setDelay(1, 17 + (Math.ceil(holesObj.most * speed * 2)) + delayed);
   
  } else {
   for (let blob of blobs) {
    this.stack[blob.x][blob.y] = 0;
   }
   this.drawStack(this.stack);
  }
  
  this.isChainUp = this.forecastedChain > 0;
  
  if (this.insane.insaneType == 1 && this.insane.isOn) {
   this.forecastedChain += this.chain;
  }
  /*if (this.forecastedChain == 30) {
   this.setDelay(1, -9);
   this.forecastedChain = 0;
   this.setDelay(0, -99);
   this.insane.delay.turningOff = 2 + (Math.ceil(holesObj.most * speed * 2)); 
  }*/
  
  if (this.forecastedChain > 8 && !this.insane.isOn) {
   //this.setDelay(1, -99);
   
   //this.insane.delay.readyHenshin = 5 + (Math.ceil(holesObj.most * speed * 2)); /**/
   //this.forecastedChain = 0;
   //this.checkLose();
   //this.setDelay(0, 0);
   //this.chain = 9;
   //this.parent.addGarbage("SYSTEM", [300], false, false, 0, 100);
   //for (let x = 0; x < 98; x++) this.emitAttack([99999]);
   //this.chain = 0;
   
   
  }
  
  this.canFallTrash = this.isActive;
  this.canFallTrashAfterFever = this.isActive;
  
  //if (this.forecastedChain > 0) this.chain = 999;
  
 }
 
 checkHolesByRow() {
  let checked = true;
  let out = {
   most: 0,
   row: []
  };
  for (var x = 0; x < this.fieldSize.w; x++) {
   out.row[x] = 0;
   checked = false;
   for (var y = 0; y < this.fieldSize.h; y++) {
    if (checked && !this.testGridSpace(x, y)) {
     out.row[x]++;
     continue;
    }
    if (this.testGridSpace(x, y)) {
     checked = true;
    }
   }
   if (out.row[x] > out.most) {
    out.most = out.row[x];
   }
  }
  return out;
 }
 
 checkInstantDrop() {
  let checkHoles = () => {
    this.holes = 0;
    for (var x = 0; x < this.fieldSize.w; x++) {
     var block = false;
     for (var y = 0; y < this.fieldSize.h; y++) {
      if (this.stack[x][y]) {
       block = true;
      } else if (this.stack[x][y] == 0 && block) {
       this.holes++;
       //this.delay.drop = Math.floor(200 * (this.frenzy.isOn || this.frenzy.isReady ? 0.9 : 1));
       //this.delay.dropContinuous = Math.floor(15 * (this.frenzy.isOn || this.frenzy.isReady ? 0.9 : 1));;
       //this.dropDelay = 2;
      }
     }
    }
    
   },
   checkDropBlock = () => {
    if (this.holes > 0) {
     let isLand = false,
      isFront = false;
     let checked = true;
     
     for (let m = 0; m < this.fieldSize.h && checked; m++) {
      checked = false;
      for (var x = 0; x < this.fieldSize.w; x++) {
       let isPauseDrop = false;
       let isLand = false,
        isFront = false;
       for (var y = this.fieldSize.h; y >= -1; y--) {
        if (!this.testGridSpace(x, y - 1)) {
         isPauseDrop = false;
         continue;
        }
        if (!this.testGridSpace(x, y) && !isPauseDrop) {
         this.stack[x][y] = this.stack[x][y - 1];
         this.stack[x][y - 1] = 0;
         if (this.testGridSpace(x, y + 1) && !isFront) {
          isLand = true;
         }
         checked = true;
         isFront = true;
         //if (this.frenzy.isReady || this.frenzy.isOn)
         //isPauseDrop = true;
        }
       }
       //if (isLand) this.parent.playSound("lock");
      }
      if (!checked) break;
     }
    }
   };
  
  let isHole = checkHoles();
  checkDropBlock();
  
  return isHole;
 };
 
 checkChain(stack) {
  //BlobBlob BFS
  //console.table(stack);
  let isAllClear = true;
  let isExistForChain = false;
  this.eraseInfo.length = 0;
  this.erasedBlocks.length = 0;
  let highestBlobGroup = 0;
  let groupsFirstBlob = [];
  let blobEval = {};
  
  const eraseColor = {},
   sequenceBlobInfo = [],
   sequenceNuisanceInfo = [],
   erasedGarbage = [],
   existingBlobList = [],
   checkBlobOrigin = (x, y) => {
    const origin = stack[x][y];
    if (!(origin !== 0 && typeof origin !== "undefined" && origin !== null && origin !== this.NUISANCE) || y < this.fieldSize.hh) {
     return;
    };
    
    sequenceBlobInfo.push({
     x: x,
     y: y,
     cell: stack[x][y]
    });
    stack[x][y] = 0;
    
    const direction = [
     [0, 1],
     [1, 0],
     [0, -1],
     [-1, 0]
    ];
    for (let iteration = 0; iteration < direction.length; iteration++) {
     const dX = x + direction[iteration][0];
     const dY = y + direction[iteration][1];
     
     if (
      dX < 0 ||
      dY < this.fieldSize.hh ||
      dX >= this.fieldSize.w ||
      dY >= this.fieldSize.h
     ) {
      continue;
     };
     if (dY < this.fieldSize.hh) continue;
     const dCell = stack[dX][dY];
     if (!(dCell !== 0 && typeof dCell !== "undefined" && dCell !== null && dCell !== this.NUISANCE) || dCell !== origin) {
      continue;
     };
     checkBlobOrigin(dX, dY);
    };
   },
   checkNuisanceOrigin = (x, y) => {
    const origin = stack[x][y];
    //stack[x][y] = 0;
    
    const direction = [
     [0, 1],
     [1, 0],
     [0, -1],
     [-1, 0]
    ];
    for (let iteration = 0; iteration < direction.length; iteration++) {
     const dX = x + direction[iteration][0];
     const dY = y + direction[iteration][1];
     
     if (
      dX < 0 ||
      dY < this.fieldSize.hh ||
      dX >= this.fieldSize.w ||
      dY >= this.fieldSize.h
     ) {
      continue;
     };
     if (dY < this.fieldSize.hh) continue;
     const dCell = stack[dX][dY];
     if (!(dCell !== 0 && typeof dCell !== "undefined" && dCell !== null || dCell !== this.HARD)) {
      continue;
     };
     if (stack[dX][dY] == this.NUISANCE) sequenceNuisanceInfo.push({
      x: dX,
      y: dY,
      cell: stack[x][y]
     });
    };
   };
  
  for (var x = 0; x < this.fieldSize.w; x++) {
   for (var y = 0; y < this.fieldSize.h; y++) {
    if (y >= this.fieldSize.hh - 1 && stack[x][y] > 0) {
     let blobGroup = 0;
     if (stack[x][y] > 0) isAllClear = false;
     sequenceBlobInfo.length = 0; //reset sequence arr
     sequenceNuisanceInfo.length = 0;
     const blobCol = stack[x][y];
     checkBlobOrigin(x, y);
     
     
     
     
     let seqLen = sequenceBlobInfo.length;
     blobGroup = seqLen;
     if (seqLen == 0 || seqLen < this.blobRequire) {
      if (seqLen > 0) {
       existingBlobList.push(...sequenceBlobInfo);
      }
     } else {
      eraseColor[blobCol] = true;
      this.eraseInfo.push(...sequenceBlobInfo);
      for (let g = 0; g < sequenceBlobInfo.length; g++) {
       let wq = sequenceBlobInfo[g];
       if (!(`${wq.x}|${wq.y}` in blobEval)) {
        blobEval[`${wq.x}|${wq.y}`] = wq.cell;
        if (g == 0) groupsFirstBlob.push({
         x: wq.x,
         y: wq.y,
         cell: wq.cell
        });
       }
      }
      
     }
     for (const e of existingBlobList) {
      stack[e.x][e.y] = e.cell;
     }
     
     
     if (this.eraseInfo.length > 0) {
      this.drawStack(this.stack);
      if (blobGroup > highestBlobGroup) highestBlobGroup = blobGroup;
      isExistForChain = true;
      for (const isNuisance of this.eraseInfo) {
       checkNuisanceOrigin(isNuisance.x, isNuisance.y);
      }
      for (const e of sequenceNuisanceInfo) {
       stack[e.x][e.y] = 0;
       erasedGarbage.push({
        x: e.x,
        y: e.y,
        cell: e.cell
       });
      }
      this.erasedBlocks.push({
       x: x,
       y: y,
       cell: blobCol
      });
      continue;
     }
    } else if (stack[x][y] > 0) {
     stack[x][y] = 0;
    }
   }
  }
  for (let o of this.eraseInfo) this.erasedBlocks.push(o);
  if (isExistForChain) {
   
   
   this.chain += 1;
   this.actualChain += 1;
   
   this.pop.x = this.eraseInfo[0].x;
   this.pop.y = this.eraseInfo[0].y;
   
   this.canFallTrash = this.canFallTrashAfterFever = this.isActive || ((this.requiredChain > 0) && (this.chain < this.requiredChain)) || (this.parent.garbageBlocking !== "linkblob-full" && this.parent.garbageBlocking !== "full");
   this.firstGroupsPop.length = 0;
   for (let h of groupsFirstBlob) {
    this.firstGroupsPop.push(h);
   }
   
   
   
   for (let x = 0, len = this.fieldSize.w; x < len; x++) {
    for (let y = 0, top = this.fieldSize.h; y < top; y++) {
     if (this.poppedStack[x][y] !== 0) this.poppedStack[x][y] = 0;
    }
   }
   
   for (let o of this.eraseInfo) this.poppedStack[o.x][o.y] = o.cell;
   
   for (let o of erasedGarbage) this.poppedStack[o.x][o.y] = o.cell;
   
   //this.delay.chainStart = Math.floor(300 * (this.frenzy.isOn ? 0.6 : 1));
   //this.delay.chainEnd = Math.floor(100 * (this.frenzy.isOn ? sz : 1));
   //this.delay.drop = Math.floor(160 * (this.frenzy.isOn || this.frenzy.isReady ? 0.8 : 1));
   this.setDelay(3, (this.insane.isOn) ? [17, 25, 10][this.insane.insaneType] : 25); // chain start  25
   this.setDelay(2, (this.insane.isOn) ? [15, 25, 10][this.insane.insaneType] : (this.isFever ? 20 : 25)); // chain end   25
   this.setDelay(1, 2); // chain delay  2
   this.setDelay(0, 3); // piece delay 3
   //////console.log(highestBlobGroup)
   
   this.parent.swapMode.add("chain");
   
   let ll = this.isFever ? 1 : 0;
   
   let attackPreset = this.isFever ? (this.insane.isOn ? this.parent.character.blob.feverPower : this.parent.character.blob.chainPower) : TSU_CHAIN_POWER
   
   
   let blobsErased = this.eraseInfo.length + (erasedGarbage.length * 0);
   let colorBonus = COLOR_BONUS[ll][Math.min(Object.keys(eraseColor).length - 1, 5)];
   let groupBonus = GROUP_BONUS[ll][Math.min(highestBlobGroup - 1, 10)];
   let chainPower = Math.min(attackPreset[Math.min(this.chain - 1, 24)], Infinity);
   if (this.insane.isOn && this.insane.insaneType === 2) {
    let h = 0;
    let g = 0;
    let l = 0;
    let q = 0;
    while (h < this.chain) {
     h++;
     g += 1;
     g += Math.floor(q / 3);
     q++;
    }
    chainPower = g;
   }
   
   if (this.insane.isOn && this.insane.insaneType === 1) {
    let h = 0;
    let g = 0;
    let l = 0;
    let q = 0;
    while (h < this.chain) {
     h++;
     g += 1;
     g += Math.floor(q / 3);
     q++;
    }
    chainPower = g;
   }
   
   let addScore = (((blobsErased) * 10) * Math.max(chainPower + groupBonus + colorBonus, 1));
   let addGarbage = ((this.insane.isOn) ? [1, 1, 1][this.insane.insaneType] : 1) * addScore * (1 + (0.4 * this.parent.swapMode.a));
   this.parent.addScoreText = `${blobsErased * 10} x ${Math.max(chainPower + groupBonus + colorBonus, 1)}`;
   this.parent.score += addScore;
   
   this.divScoreTrash += addGarbage * this.decreaseTargetPoint * this.fixedAtkHandicap;
   this.divScoreTrash %= this.targetPoint;
   if (this.requiredChain <= this.chain) {
    this.delayedGarbage = addGarbage * this.decreaseTargetPoint * this.fixedAtkHandicap; //Math.floor((this.divScoreTrash / (this.targetPoint / (this.decreaseTargetPoint))));
    this.dstModulus = this.divScoreTrash;
   }
   
   this.divScoreTrash = 0;
   this.nextVoice.duration = -1;
   this.nextVoice.name = "";
   this.drawStack(this.stack);
   
   if (this.isAllClear) {
    this.isAllClear = false;
    this.playAllClearAnim(2);
    this.divScoreAttackingTrash += 70 * 30 * this.fixedAtkHandicap * this.decreaseTargetPoint;
   }
   
   if (this.insane.isOn) {
    //////console.log(this.getQPosY(2));
    
    if (this.insane.insaneType == 0 && this.forecastedChain == this.actualChain) {
     this.insane.chainScore = this.actualChain;
     if (this.insane.requireChain <= this.insane.chainScore) this.nextVoice.name = "insane_success";
     if (this.insane.requireChain > this.insane.chainScore) this.nextVoice.name = "insane_fail";
     //alert("nope")
    }
    
    
    
    
    this.parent.insaneBg.moveEye(this.getQPosX(this.pop.x), this.getQPosY(this.pop.y - this.fieldSize.hh), false);
    this.parent.insaneBg.changeColor();
   }
   if (this.chain == 1) {
    //this.opponentGarbageBehind = {};
    game.forEachPlayer(player => {
     delete this.opponentGarbageBehind[player.player];
     
     if (this.parent.player !== player.player && !player.isGarbageBehindActive) {
      this.opponentGarbageBehind[player.player] = 1;
      //////console.log("IS GARVAGE BEHIND ACTIF: " + player.player);
      //////console.log(this.opponentGarbageBehind)
     }
    });
   }
   
  }
  else {
   this.firstGroupsPop.length = 0;
   this.previousChain = this.chain;
   let feverAC = false;
   
   if (this.insane.isOn) {
    if (this.insane.time <= 0 || this.insane.isCommandedEnd) {
     if (this.chain > 0) {
      if (this.insane.insaneType == 0 || this.insane.insaneType === 2) {
       this.insane.chainScore = this.chain + (isAllClear ? 2 : 0);
       let sum = Math.min(this.insane.chainScore + 1, 15) - 3;
       let difference = Math.max(3, this.insane.requireChain - Math.min(2, this.insane.requireChain - this.insane.chainScore - 1)) - 3;
       
       if (this.insane.requireChain <= this.insane.chainScore) {
        this.parent.feverStat.presetChain = sum;
        
       }
       if (this.insane.requireChain > this.insane.chainScore) {
        this.insane.status = "fail";
        
       }
       
      }
     }
     this.parent.insaneBg.moveEye(this.parent.fieldSize.w / 2, this.parent.fieldSize.vh / 2, true);
     
     this.insane.delay.turningOff = 3;
    } else
    if (this.actualChain > 0) {
     this.canFallTrash = false;
     
     if (this.insane.time > 1 && this.insane.insaneType !== 1) {
      this.insane.time += this.insane.timeAdditions.fixedTimeAdd * 60;
      this.insane.time += this.insane.timeAdditions.timeAddMult * Math.max(0, this.actualChain - this.insane.timeAdditions.minChain) * game.FPS;
      //this.chain = 0;
     }
     
     
     if (this.insane.insaneType == 0 || this.insane.insaneType === 2) {
      this.insane.delay.del = 5;
      this.insane.chainScore = this.chain + (isAllClear ? 2 : 0);
      let sum = Math.min(this.insane.chainScore + 1, 15) - 3;
      let difference = Math.max(3, this.insane.requireChain - Math.min(2, this.insane.requireChain - this.insane.chainScore - 1)) - 3;
      
      if (this.insane.requireChain <= this.insane.chainScore) {
       this.parent.feverStat.presetChain = sum;
       this.insane.status = "success";
      }
      if (this.insane.requireChain > this.insane.chainScore) {
       this.insane.status = "fail";
       this.parent.feverStat.presetChain = difference;
      }
     }
     
     if (this.insane.status == "success") this.nextVoice.name = "insane_success";
     if (this.insane.status == "fail") this.nextVoice.name = "insane_fail";
     
     this.parent.insaneBg.moveEye(this.parent.fieldSize.w / 2, this.parent.fieldSize.vh / 2, true);
     
    }
    
   } else {
    //this.chain = 0;
   }
   
   if (isAllClear && this.chain > 0) {
    
    if (!this.insane.isOn) {
     if (this.isFever) {
      //this.resetGrid();
      
      //if (this.insane.time > 1) //this.insane.time += this.insane.timeAdditions.allClear * game.FPS;
      this.parent.feverStat.addTime(5);
      //this.playAllClearAnim(1);
      this.setDelay(0, 20);
      if (this.isAllClearTemp < 1) {
       this.isAllClearTemp = 40;
       this.playAllClearAnim(1);
      }
      if (this.parent.feverStat.maxGauge <= this.parent.feverStat.gaugeValue && this.insane.insaneType == 0) {
       this.parent.feverStat.presetChain += 2;
       if (this.parent.feverStat.presetChain > 15 - 3) {
        this.parent.feverStat.presetChain = 15 - 3;
       }
      }
      else this.insane.blobToField(1, true, true);
      feverAC = true;
      
      
     } else {
      
      this.playAllClearAnim(1);
      this.isAllClear = true;
      this.parent.score += 2100;
      //feverAC = true;
     }
     
     this.parent.playVoice("zenkeshi");
     
    }
    else {
     if (this.insane.time > 1 && (this.parent.feverStat.isUseTimer)) {
      this.insane.time += this.insane.timeAdditions.allClear * game.FPS;
      if (this.insane.time > (30 * game.FPS)) this.insane.time = 30 * game.FPS;
      
      
     }
     if (this.isAllClearTemp < 0) {
      this.isAllClearTemp = 40;
      this.playAllClearAnim(1);
     }
     if (this.insane.isUnlimited && this.insane.insaneType == 1) {
      this.chain += this.actualChain;
     }
    }
    
    if (this.insane.isOn) {
     
    }
    this.parent.playSound("allclear");
    
    let px = (this.parent.assetRect("FIELD").x) + (this.parent.fieldCellSize * this.getQPosX(this.pop.x));
    let py = (this.parent.assetRect("FIELD").y) + (this.parent.fieldCellSize * this.getQPosY(this.pop.y - this.fieldSize.hh));
    
    
    /*htmlEffects.add("All Clear", px, py, 50, {
    	name: "chain-text-anim",
    	iter: 1,
    	timefunc: "cubic-bezier(0,0,1,0)",
    	initdel: 0,
    }, "text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black; --__chaintext_size: 1.2em");*/
    
   }
   
   if (!feverAC) this.setDelay(0, 3);
   
   this.actualChain = 0;
   
   this.isChainUp = false;
   
  }
  
  
  //return null;
 }
 
 checkForecast() {
  let width = this.fieldSize.w,
   height = this.fieldSize.h,
   hiddenHeight = this.fieldSize.hh;
  let grid = JSON.parse(JSON.stringify(this.stack));
  let a = blobChainDetector.forecast(grid, width, hiddenHeight, height, this.blobRequire);
  this.forecastedChain = a.chain;
  this.blobCount = a.remaining;
 }
 
 checkHoles() {
  this.holes = 0;
  for (var x = 0; x < this.fieldSize.w; x++) {
   var block = false;
   for (var y = 0; y < this.fieldSize.h; y++) {
    if (this.stack[x][y]) {
     block = true;
    } else if (this.stack[x][y] == 0 && block) {
     this.holes++;
     //this.delay.drop = Math.floor(200 * (this.frenzy.isOn || this.frenzy.isReady ? 0.9 : 1));
     //this.delay.dropContinuous = Math.floor(15 * (this.frenzy.isOn || this.frenzy.isReady ? 0.9 : 1));;
     this.dropDelay = 2;
     this.setDelay(1, 10);
     this.setDelay(0, 10);
    }
   }
  }
  
 }
 
 checkDropBlock() {
  if (this.holes > 0) {
   let isLand = false,
    isFront = false;
   
   for (var x = 0; x < this.fieldSize.w; x++) {
    let isPauseDrop = false;
    let isLand = false,
     isFront = false;
    for (var y = this.fieldSize.h; y >= -1; y--) {
     if (!this.testGridSpace(x, y - 1)) {
      isPauseDrop = false;
      continue;
     }
     if (!this.testGridSpace(x, y) && !isPauseDrop) {
      this.stack[x][y] = this.stack[x][y - 1];
      this.stack[x][y - 1] = 0;
      if (this.testGridSpace(x, y + 1) && !isFront) {
       isLand = true;
      }
      isFront = true;
      //if (this.frenzy.isReady || this.frenzy.isOn)
      if (this.insane.isOn) isPauseDrop = true;
     }
    }
    if (isLand) this.parent.playSound("blub_drop");
   }
   this.checkHoles();
   this.drawStack(this.stack);
  }
 }
 
 checkBlobCount(stack) {
  let count = 0;
  if (!(this.insane.isOn) && this.isActive && this.isEnable) {
   
   for (let x = 0; x < this.fieldSize.w; x++) {
    for (let y = this.fieldSize.hh - 1; y < this.fieldSize.h; y++) {
     if (stack[x][y] > 0) count++;
    }
   }
  }
  return count;
  
 }
 
}

const blobChainDetector = new class {
 #NUISANCE = 6;
 #DIRECTIONS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0]
 ];
 constructor() {}
 
 fetchConnections(board, width, hiddenHeight, height) {
  let connectionGroups = {};
  let detected = {};
  let colors = {};
  let longestGroup = 0;
  
  for (let x = 0; x < width; x++) {
   for (let y = hiddenHeight; y < height; y++)
    if (!(`${x}|${y}` in detected) && board[x][y] > 0 && board[x][y] !== this.#NUISANCE) {
     let obj = {};
     let length = 0;
     this.bfs(obj, board, x, y, width, hiddenHeight, height);
     /*connectionGroups[`${x}|${y}`] = {
     	
     };*/
     connectionGroups[`${x}|${y}`] = {
      
     };
     let cm = connectionGroups[`${x}|${y}`];
     /*cm[`${x}|${y}`] = {
     	color: board[x][y],
     	x: x,
     	y: y
     };*/
     
     detected[`${x}|${y}`] = board[x][y];
     let c = cm;
     //connectionGroups[1][2][prop]
     for (let shot in obj) {
      let mx = obj[shot].x;
      let my = obj[shot].y;
      c[shot] = {
       color: obj[shot].color,
       x: mx,
       y: my
      };
      if (obj[shot].color in colors) {
       colors[obj[shot].color]++;
      } else {
       colors[obj[shot].color] = 1;
      }
      detected[`${mx}|${my}`] = obj[shot].color;
      length++;
     }
     //////console.log(obj);
     if (length > longestGroup) longestGroup = length;
    }
  }
  
  //////console.log(connectionGroups);
  
  return {
   connections: connectionGroups,
   colors: colors,
   longest: longestGroup
   
  }
  
 }
 
 removeAdjacentNuisance(board, x, y, width, hiddenHeight, height) {
  let popped = 0;
  for (let i = 0; i < 4; i++) {
   const dir = this.#DIRECTIONS[i];
   let dx = x + dir[0];
   let dy = y + dir[1];
   if (dx >= width || dx < 0 || dy >= height || dy < hiddenHeight) continue;
   const adjacent = board[dx][dy];
   
   if (adjacent == this.#NUISANCE && !(dx > width || dx < 0 || dy > height || dy < hiddenHeight)) {
    board[dx][dy] = 0;
    popped++;
   }
   
  }
  return popped;
 };
 
 forecast(board, width, hiddenHeight, height, requirePop) {
  let chain = 0;
  let testBoard = JSON.parse(JSON.stringify(board));
  let longestGroup = 0;
  let isAllClear = false;
  //let finished = 0;
  let popped = 0;
  let remaining = 0;
  while (true) {
   this.checkHoles(testBoard, width, hiddenHeight, height);
   let obj = this.fetchConnections(testBoard, width, hiddenHeight, height);
   let isChain = false;
   if (obj.longest === 0) {
    //isAllClear = true;
    break;
   }
   if (obj.longest < (requirePop || 4)) break;
   
   for (let j in obj.connections) {
    let count = Object.keys(obj.connections[j]).length;
    //remaining += count;
    if (count >= requirePop) {
     isChain = true;
     //testBoard[popRef.x][popRef.y] = 0;
     for (let jh in obj.connections[j]) {
      let popRef = obj.connections[j][jh];
      popped += this.removeAdjacentNuisance(testBoard, popRef.x, popRef.y, width, hiddenHeight, height);
      testBoard[popRef.x][popRef.y] = 0;
      popped++;
      
     }
    }
    
    /*for (let jl in obj.connections[j]) {
    
    }*/
   }
   if (isChain) {
    chain++;
   } else {
    break;
   }
  }
  
  for (let x = 0; x < width; x++) {
   for (let y = hiddenHeight - 1; y < height; y++) {
    if (testBoard[x][y] > 0) remaining++;
   }
  }
  
  if (remaining === 0) isAllClear = true;
  
  if (isAllClear) {
   //game.pauseGame();
   //alert("HOLY SHOT");
  }
  
  return {
   chain: chain,
   allClear: isAllClear,
   popped: popped,
   remaining: remaining
  };
 }
 
 testSpace(board, x, y, width, height) {
  if (x < 0 || x >= width) {
   return true;
  }
  if (y < height) {
   if (typeof board[x][y] !== "undefined" && board[x][y] !== 0) {
    return true;
   }
   return false;
  }
  return true;
 }
 checkHoles(board, width, hiddenHeight, height) {
  let checked = true;
  for (let t = 0; t < height && checked; t++)
   for (var y = height - 1; y >= hiddenHeight - 2; y--) {
    for (var x = 0; x < width; x++) {
     checked = true;
     if (!this.testSpace(board, x, y - 1, width, height)) {
      continue;
     }
     if (!this.testSpace(board, x, y, width, height)) {
      board[x][y] = board[x][y - 1]
      board[x][y - 1] = 0;
      checked = false;
     }
    }
   }
 }
 //BREADTH FIRST SEARCH
 bfs(referenceObject, board, x, y, width, hiddenHeight, height, modulo) {
  //recursion function: Breadth-First Search Algorithm 
  let a = referenceObject || {};
  let mod = modulo || 0;
  if (!(x > width || y >= height || y < hiddenHeight || (`${x}|${y}` in a))) {
   let origin = board[x][y];
   if (mod) {
    origin %= mod;
   }
   if (origin > 0 && origin !== this.#NUISANCE) {
    a[`${x}|${y}`] = {
     color: origin,
     x: x,
     y: y
    };
    for (let i = 0; i < 4; i++) {
     const dir = this.#DIRECTIONS[i];
     if (((x + dir[0]) < 0 || (x + dir[0]) >= width || (y + dir[1]) >= height || (y + dir[1]) < hiddenHeight)) continue;
     let adjacent = board[x + dir[0]][y + dir[1]];
     if (mod) {
      adjacent %= mod;
     }
     
     if (adjacent === origin) {
      
      this.bfs(a, board, x + dir[0], y + dir[1], width, hiddenHeight, height, mod);
     }
     
    }
   }
   
  };
  //////console.log(a);
 }
 
}();

class SwapModeParameters {
 constructor(parent) {
  this.parent = parent;
  
  this.isOn = false
  //this.time = -9;
  this.time = -9;
  this.a = 0;
  
  this.isOK = {
   chain: 0,
   combo: 0
  }
 }
 reset() {
  //this.isOn = false
  //this.time = -9;
  
  this.time = -9;
  this.a = 0;
  
  this.isOK.chain = 0,
   this.isOK.combo = 0;
  
 }
 run() {
  if (!this.isOn) return;
  if (this.time >= 0) {
   this.time--;
   if (this.time == 0) {
    
    this.a = 0;
   }
  }
  
 }
 add(type) {
  
  if (!this.isOn) return;
  if (this.a <= 0) {
   if (this.time > 0) {
    if (type == "chain") this.isOK.chain = 1;
    if (type == "combo") this.isOK.combo = 1;
    if (this.isOK.chain && this.isOK.combo) {
     this.a++;
     this.parent.playSound(`swapcombo${Math.min(7, this.a)}`)
     this.time = 10 * game.FPS;
    }
   }
  } else {
   if (this.time > 0) {
    this.a++;
    this.parent.playSound(`swapcombo${Math.min(7, this.a)}`)
   }
  }
 }
 playSwapAnim() {
  
  let ma = this.parent;
  
  let mainElem = ma.getAsset("FIELD-DYNAMIC"),
   auxElem = ma.getAsset("AUX-FIELD");
  mainElem.offsetHeight;
  auxElem.offsetHeight;
  let height = ma.fieldSize.vh + ma.visibleFieldBufferHeight,
   fieldHeight = ma.fieldSize.vh + ma.visibleFieldHeight,
   width = ma.fieldSize.w,
   px = 0.47;
  let main = ma.assetRect("FIELD-INSANE"),
   aux = ma.assetRect("AUX-FIELD-INSANE"),
   distanceMainX = aux.x - main.x,
   distanceMainY = (aux.y + (ma.fieldCellSize * (ma.visibleFieldBufferHeight * px))) - main.y,
   scaleDifferenceMain = (px * (ma.fieldCellSize * width) * (ma.fieldCellSize * fieldHeight)) / ((ma.fieldCellSize * width) * (ma.fieldCellSize * fieldHeight)),
   distanceAuxX = main.x - aux.x,
   distanceAuxY = main.y - aux.y,
   scaleDifferenceAux = ((ma.fieldCellSize * width) * (ma.fieldCellSize * fieldHeight)) / (px * (ma.fieldCellSize * width) * (ma.fieldCellSize * fieldHeight));
  
  
  mainElem.style.setProperty("--transX", `${distanceMainX}px`);
  mainElem.style.setProperty("--transY", `${distanceMainY}px`);
  mainElem.style.setProperty("--transSize", `${scaleDifferenceMain}`);
  mainElem.style.setProperty("--zIndex", `${1}`);
  
  auxElem.style.setProperty("--transX", `${distanceAuxX}px`);
  auxElem.style.setProperty("--transY", `${distanceAuxY}px`);
  auxElem.style.setProperty("--transSize", `${scaleDifferenceAux}`);
  auxElem.style.setProperty("--zIndex", `${2}`);
  
  
  ma.playUnfreezableAnimation("swapMain");
  ma.playUnfreezableAnimation("swapAux");
 }
}

class WarOfInsanityParameters {
 constructor(parent) {
  this.parent = parent;
  
  this.isOn = false;
  //this.time = -9;
  
  this.a = 0;
  this.damageSent = 0;
  this.damageSentPerHit = 4;
  this.damageReceived = 0;
  this.damageInflicted = 0;
 }
 reset() {
  //this.isOn = false
  //this.time = -9;
  this.damageInflicted = 0;
  
  this.a = 0;
  this.damageReceived = 0;
  this.damageSentPerHit = 1;
 }
 
 add(add) {
  
  if (!this.isOn) return;
  this.a += add;
 }
 
}

class WMWWormhole {
 
 constructor(parent) {
  this.parent = parent;
  this.phase = 0;
  this.canvas;
  this.ctx;
  this.cellSize = 40;
  this.colors = {
   r: 250,
   g: 60,
   b: 48,
  }
  
  this.enable = false;
  
  
  
  this.wormhole = new FrameRenderer(0, 124, (frame, max, that) => {
   if (animatedLayers.checkObject(this.parent.getCanvasAnimationPlainName("wormhole"))) {
    
    let a = animatedLayers.getObject(this.parent.getCanvasAnimationPlainName("wormhole"));
    
    if (this.phase == 0 && that.frame >= 15 * 2) {
     this.phase = 1;
    }
    
    if (this.phase == 1 && that.frame >= 45 * 2) {
     that.frame = 15 * 2;
     frame = 15 * 2;
    }
    
    if (this.phase == 2 && that.frame < 45 * 2) {
     that.frame = 45 * 2;
     frame = 45 * 2;
    }
    
    if (this.phase == 2 && that.frame > 60 * 2) {
     this.enable = false;
     //that.frame.x = 0;
     animatedLayers.remove(this.parent.getCanvasAnimationPlainName("wormhole"));
    }
    
    if (this.phase == 3 && that.frame > 0 * 2) {
     this.enable = false;
     //that.frame.x = 0;
     animatedLayers.remove(this.parent.getCanvasAnimationPlainName("wormhole"));
    }
    a.centerPos.x = this.parent.playerCenterPos.x;
    a.centerPos.y = this.parent.playerCenterPos.y;
    a.sizeMult = this.parent.fieldCellSize * 6;
    a.frame.elapsed = frame / 2;
    a.frame.int = 60 - (frame / 2);
    
   }
  });
  
  
  
  /*this.wormhole.temp = new OffscreenCanvas(200, 200),
   this.wormhole.tempCtx = this.wormhole.temp.getContext("2d"),
   this.wormhole.main = new GIFRenderer(200 * 10, 200 * 6, 200, 200, 0, (a, canv, x, y, w, h, frame, that) => {
    let b = a.canvas; // a.canvas is the main canvas, this.canvas
    a.clearRect(0, 0, b.width, b.height);
    //let mm = ((0) % 360);
    this.wormhole.tempCtx.clearRect(0, 0, w, h);


    if (that.frame.x <= -1) {
     that.frameCount = 0;
     that.frame.x = 0;
    }

    if (this.phase == 0 && that.frameCount >= 15) {
     this.phase = 1;
    }

    if (this.phase == 1 && that.frameCount >= 45) {
     that.frameCount = 15;
     that.frame.x = 15;
    }

    if (this.phase == 2 && that.frameCount < 45) {
     that.frameCount = 45;
     that.frame.x = 45;
    }

    if (this.phase == 2 && that.frameCount > 60) {
     this.enable = false;
     //that.frame.x = 0;
    }

    this.wormhole.tempCtx.drawImage(canv, ~~(x % 10) * w, (~~(x / 10)) * h, w, h, 0, 0, w, h);
    let centerSize = 6;
    //////console.log(this.parent.player + ": " + that.frame.x)

    a.drawImage(this.wormhole.temp, 0, 0, w, h, (this.parent.cellSize * ((-5) - (centerSize / 2))), this.parent.cellSize * ((-centerSize / 2)), this.parent.cellSize * (this.parent.fieldSize.vh + centerSize), this.parent.cellSize * (this.parent.fieldSize.vh + centerSize));


    that.frame.x += 0.5;
    that.frameCount += 0.5;


    //if (frame >= 30) that.enabled = false
    //if (frame == 30) that.actualFrames = 0;
   }, (frame) => {
    //this.setStyle("CLEARTEXT-CANVTEXT", "animation-delay", `${~~((1000 / -60) * (frame))}ms`);
   }, true);*/
  
  
  
 }
 
 fetchAsset(name) {
  /*this.canvas = canvas;
  this.ctx = ctx;

  /*this.wormhole.main.initialize(this.ctx);
  this.wormhole.main.loadImages([]);
  this.wormhole.main.exec(0, 0);
  this.wormhole.tempCtx.drawImage(this.wormhole.main.getCanvas(), 0, 0);
  this.wormhole.tempCtx.clearRect(0, 0, 100, 100);*/
  
  
  
  
 }
 
 reset() {
  /*this.wormhole.tempCtx.drawImage(this.wormhole.main.getCanvas(), 0, 0);

  /**/
  this.enable = true;
  this.phase = 3;
 }
 
 changeColorCustom(r, g, b) {
  //let ml = ~~(Math.random() * 10);
  this.colors.r = r;
  this.colors.g = g;
  this.colors.b = b;
  
 }
 
 engage(type) {
  this.enable = true;
  
  this.phase = type;
  animatedLayers.remove(this.parent.getCanvasAnimationPlainName("wormhole"));
  animatedLayers.create(this.parent.getCanvasAnimationPlainName("wormhole"),
   60,
   this.parent.playerCenterPos.x,
   this.parent.playerCenterPos.y,
   0, 0, 0,
   200, 200,
   5,
   5,
   1,
   "wormhole",
   10,
   this.parent.fieldCellSize * 6,
   {
    on: false
   },
   true,
   true
  );
  this.wormhole.reset(type);
 }
 draw() {
  if (!this.enable) return;
  //this.parent.canvasClear("wormhole");
  //this.eye.x = Math.random() * 10;
  
  let w = this.parent.fieldSize.w;
  let vh = this.parent.fieldSize.vh;
  
  //this.parent.canvasCtx.insane.fillStyle = `rgba(${this.colors.r * 0.8},${this.colors.g * 0.8},${this.colors.b * 0.8}, 0.8)`;
  
  /*this.parent.canvasCtx.insane.fillRect(
   0, 0,
   this.parent.cellSize * (w),
   this.parent.cellSize * (vh)
  );*/
  
  //this.parent.canvasCtx.insane.fillStyle = `rgba(${~~(Math.random() * 255)},${~~(Math.random() * 255)},${~~(Math.random() * 255)}, 0.5)`;
  
  //////console.log(this.parent.cellSize)
  this.wormhole.run();
 }
 
 
}

const feverGaugeStorage = new class {
 
 constructor() {
  this.image = new Image();
  this.canvas = new Image();
  this.ctx;
  this.Main = class {
   constructor(x, y, size) {
    this.status = 0;
    this.x = x;
    this.y = y;
    this.size = size;
   }
  };
 }
 
 load(f, l) {
  return new Promise(async res => {
   let n = await loadImage(f);
   let m = await loadImage(l);
   //this.image = n;
   this.canvas = new OffscreenCanvas(2000, (200 + 140));
   this.ctx = this.canvas.getContext("2d");
   this.ctx.drawImage(n, 0, 0);
   this.ctx.drawImage(m, 0, 0, 70 * 10, 70 * 2, 0, 200, 70 * 10, 70 * 2);
   res();
  });
 }
}();

class FeverGaugeStat {
 constructor(parent) {
  this.parent = parent;
  this.isOn = false;
  this.initialGauge = 0;
  this.gaugeValue = 1;
  this.refGaugeValue = { a: new NumberChangeFuncExec(0, n => { this.refGaugeValue.m = n }), m: 0 };
  this.maxGauge = 7;
  this.addGauge = 1;
  this.time = 15 * 60;
  this.presetChain = 2;
  this.canvas;
  this.ctx;
  this.div;
  this.dim = { w: 0, h: 0 };
  this.cellSize = 0;
  this.reversed = false;
  this.frame = { int: 10, dark: 10 };
  this.isUseTimer = false;
  this.colored = { on: false, frame: 0 };
  let orb = [{ x: .218, y: .92, cs: 1.3 }, { x: .215, y: .795, cs: 1.3 }, { x: .313, y: .678, cs: 1.5 }, { x: .48, y: .566, cs: 1.7 }, { x: .621, y: .436, cs: 1.9 }, { x: .566, y: .277, cs: 2.1 }, { x: .303, y: .117, cs: 3 }];
  this.orbs = orb;
  this.main = new ObjectFunctionIterator(main => {
   let g = Object.keys(main);
   let l = g.length;
   let ht = 0;
   this.ctx.clearRect(0, 0, this.dim.s, this.dim.h);
   let lt = true;
   for (let h = 0; h < l; h++) {
    let el = main[g[h]];
    let mm = this.refGaugeValue.m > h ? 1 : 0;
    if (this.colored.on) {
     mm = (h + 8 - ~~(this.colored.frame / 8)) % 8 + 2;
     if (lt && this.colored.frame % 8 == 0 && ~~(this.colored.frame / 8) % 8 !== 7) {
      let mt = this.parent.assetRect("FEVER-GAUGE");
      let tx = mt.x;
      let ty = mt.y;
      let dw = mt.width;
      let dh = mt.height;
      let cs = this.parent.fieldCellSize;
      let ml = main[g[~~(this.colored.frame / 8) % 8]];
      lt = false;
      if (this.parent.isVisible) animatedLayers.create(undefined, 34, tx + dw * (this.reversed ? 1 - ml.x : ml.x), ty + dh * ml.y - this.parent.fieldCellSize * 0, 0, 0, 0, 200, 200, 5, 5, 1, "fever_shine", 10, 2)
     }
    }
    this.ctx.drawImage(feverGaugeStorage.canvas, mm * 200, 0, 200, 200, this.dim.w * (this.reversed ? 1 - el.x : el.x) - this.cellSize * el.size / 2, this.dim.h * el.y - this.cellSize * el.size / 2, this.cellSize * el.size, this.cellSize * el.size);
    if (h == this.frame.dark && !this.colored.on) {
     let cctx = this.ctx;
     if (this.frame.int < 6) cctx.fillStyle = "rgba(0,0,0,0.7)";
     else cctx.fillStyle = "rgba(0,0,0,0.5)";
     cctx.globalCompositeOperation = "source-atop";
     cctx.fillRect(this.dim.w * (this.reversed ? 1 - el.x : el.x) - this.cellSize * el.size / 2, this.dim.h * el.y - this.cellSize * el.size / 2, this.cellSize * el.size, this.cellSize * el.size);
     cctx.globalCompositeOperation = "source-over"
    }
   }
  });
  for (let h = 0; h < 7; h++) {
   let ob = orb[h];
   this.main.addItem(`a${h}`, new feverGaugeStorage.Main(ob.x, ob.y, ob.cs))
  }
 }
 add() { if (this.gaugeValue < this.maxGauge) { this.gaugeValue += this.addGauge; if (this.gaugeValue > this.maxGauge) this.gaugeValue = this.maxGauge; return true } return false } reset() {
  this.gaugeValue = this.initialGauge;
  this.time = 15 * 60;
  this.playColored(false);
  this.refresh();
  this.colored.frame = 0
 }
 resetRound() {
  this.reset();
  this.presetChain = 2
 }
 resize(w, h, cs, r) {
  this.dim.w = w;
  this.dim.h = h;
  this.cellSize = cs;
  this.reversed = r
 }
 fetchAsset(canvas, ctx, div) {
  this.canvas = canvas;
  this.ctx = ctx;
  this.div = div
 }
 playColored(bool) { this.colored.on = bool; if (this.colored.on) {} } run() { if (this.isOn) {} } draw() {
  if (this.isOn) {
   this.parent.canvasClear("feverGauge");
   this.main.update();
   this.frame.int--;
   if (this.frame.int <= 0) {
    this.frame.int = 10;
    this.frame.dark++;
    if (this.frame.dark > 7) this.frame.dark = -10
   }
   if (this.colored.on) { this.colored.frame++; if (this.colored.frame >= 8 * 8) this.colored.frame = 0 } {
    let time = Math.max(0, Math.floor((this.colored.on ? this.parent.blob.insane.time : this.time) / game.FPS)),
     ones = time % 10,
     tens = ~~(time / 10);
    let mx = .3,
     my = .4,
     ms = 2.6;
    let warning = time < 6 && this.colored.frame % 16 > 8;
    this.ctx.drawImage(feverGaugeStorage.canvas, ones * 70, 200 + (warning ? 70 : 0), 70, 70, this.dim.w * (this.reversed ? 1 - mx : mx) - this.cellSize * (ms + (this.reversed ? -ms : 0)) / 2, this.dim.h * my - this.cellSize * ms / 2, this.cellSize * ms, this.cellSize * ms);
    this.ctx.drawImage(feverGaugeStorage.canvas, tens * 70, 200 + (warning ? 70 : 0), 70, 70, this.dim.w * (this.reversed ? 1 - mx : mx) - this.cellSize * (ms + (!this.reversed ? ms : 0)) / 2, this.dim.h * my - this.cellSize * ms / 2, this.cellSize * ms, this.cellSize * ms)
   }
  }
 }
 enable(bool) {
  this.isOn = bool;
  styleelem(this.div, "display", this.isOn ? "flex" : "none")
 }
 refresh() { this.refGaugeValue.a.assign(this.gaugeValue) } addTime(int) {
  if (true) {
   this.time += int * game.FPS;
   if (this.time > 30 * game.FPS) this.time = 30 * game.FPS;
   let m = this.parent.assetRect("FEVER-GAUGE");
   let px = m.x + (!this.reversed ? m.width * (1 - .3) : m.width * .3);
   let py = m.y + m.height * .3;
   htmlEffects.add(`+${int}s`, px, py, 50, { name: "chain-text-anim", iter: 1, timefunc: "cubic-bezier(0,0,1,0)", initdel: 0 }, "text-shadow: -1px 0 black, 0 1px black, 1px 0 black, 0 -1px black; --__chaintext_size: 1.2em");
   return true
  }
  return false
 }
}

class Player extends MainPlayerFragment {
 
 constructor(player, n) {
  super(player, n);
  
  //TODO make groups of Gachae Linkblobs and Gachaminoes
  
  this.visualFrames = 0;
  this.shouldWaitForOpponent = true;
  
  this.swapMode = new SwapModeParameters(this);
  this.auxEnabled = false;
  this.isCompact = false;
  this.isDead = false;
  this.isDying = false;
  this.halt = {
   names: [],
   delays: {
    manipulation: 0,
    delay: 0
   }
  };
  this.halt.names = Object.keys(this.halt.delays);
  this.lastPressStr = null;
  /*this.controlsBitwise = {
   on: true,
   bit: 0,
   //letters: "AaBbCcDdEeFfGgHhIiJjKk",
   maxBits: 0b11111111111111,
   lastBit: 0,
   bitList: {
    
   }
  };/**/
  //0.2.0 Alpha - Deprecate this.controlsBitwise
  this.isWarning = false;
  
  this.warningTrig = new NumberChangeFuncExec(0, (t) => {
   this.isWarning = t;
   this.drawCharacterBg(t);
  });
  
  this.isFinishAble = false;
  
  this.isLosePlayed = false;
  
  this.isWin = false;
  this.hasWon = false;
  
  this.block = new GachatrisBlock(this);
  this.blob = new NeoplexianBlob(this);
  
  this.insaneBg = new InsaneBackground(this);
  this.woi = new WarOfInsanityParameters(this);
  this.woiWormhole = new WMWWormhole(this);
  this.feverStat = new FeverGaugeStat(this);
  this.isGarbageCollectionMode = false;
  this.isInsaneModeOnly = false;
  
  this.canAttack = true;
  this.canReceiveGarbage = 1;
  this.garbage = [];
  this.garbageBehind = [];
  this.isGarbageBehindActive = false;
  this.delayedGarbage = 0;
  this.garbageLength = 0;
  this.garbageBehindLength = 0;
  
  this.garbageBlocking = "full";
  
  this.garbageDelay = 30;
  
  this.garbageType = 0;
  
  this.stats = {
   line1: 0,
   line2: 0,
   line3: 0,
   line4: 0,
   line5: 0,
   pc: 0,
   tspin0: 0,
   tspin1: 0,
   tspin2: 0,
   tspin3: 0,
   tspinmini0: 0,
   tspinmini1: 0,
   tspinmini2: 0,
   tspinmini3: 0,
   
   allspin0: 0,
   allspin1: 0,
   allspin2: 0,
   allspin3: 0,
   allspinmini0: 0,
   allspinmini1: 0,
   allspinmini2: 0,
   allspinmini3: 0,
   
   highestCombo: 0,
   
   
  };
  
  this.dividedBlobScoreGarbage = 0;
  this.blobGarbage = 0;
  
  this.isGarbageTrayMode = false;
  this.garbageTrayObjects = [];
  this.garbageTrayBehindObjects = [];
  this.garbageLastForTray = new NumberChangeFuncExec(-1, (m) => {
   let q = m;
   let count = 0;
   for (let b = 0; b < 6; b++) {
    let index = 0;
    if (q >= 1440) {
     q -= 1440;
     index = 7;
    } else if (q >= 720) {
     q -= 720;
     index = 6;
    } else if (q >= 360) {
     q -= 360;
     index = 5
    } else if (q >= 180) {
     q -= 180;
     index = 4;
    } else if (q >= 30) {
     q -= 30;
     index = 3;
    } else if (q >= 6) {
     q -= 6;
     index = 2;
    } else if (q >= 1) {
     q -= 1;
     index = 1;
    }
    
    this.garbageTrayObjects[b].x = index;
   }
   this.garbageTrayAnimDelay = 20;
   this.drawGarbageTray();
  });
  this.garbageBehindLastForTray = new NumberChangeFuncExec(-1, (m) => {
   let q = m;
   let count = 0;
   for (let b = 0; b < 6; b++) {
    let index = 0;
    if (q >= 1440) {
     q -= 1440;
     index = 7;
    } else if (q >= 720) {
     q -= 720;
     index = 6;
    } else if (q >= 360) {
     q -= 360;
     index = 5
    } else if (q >= 180) {
     q -= 180;
     index = 4;
    } else if (q >= 30) {
     q -= 30;
     index = 3;
    } else if (q >= 6) {
     q -= 6;
     index = 2;
    } else if (q >= 1) {
     q -= 1;
     index = 1;
    }
    
    this.garbageTrayBehindObjects[b].x = index;
   }
   this.garbageTrayBehindAnimDelay = 20;
   this.drawGarbageTrayBehind();
  });
  for (let w = 0; w < 6; w++) this.garbageTrayObjects.push(new GarbageTrayObject());
  
  for (let w = 0; w < 6; w++) this.garbageTrayBehindObjects.push(new GarbageTrayObject());
  
  this.garbageTrayAnimDelay = 20;
  this.garbageTrayBehindAnimDelay = 20;
  
  this.activeType = 0;
  
  this.fieldAnimations = {};
  
  this.playerTarget = [];
  
  this.emAnimationSetting = {
   on: false,
   time: -9,
   name: ""
  };
  
  this.simulPresses = {
   events: {},
   enabled: false
  }
  
  this.flagPresses = {};
  this.flagNamesByChar = {
   a: "left",
   b: "right",
   d: "harddrop",
   c: "softdrop",
   g: "cw",
   f: "ccw",
   h: "c180w",
   e: "hold"
  };
  
  
  
  this.flagsLowerToUpper = {};
  
  // well this is dumb
  for (let q in this.flagNamesByChar) {
   this.flagsLowerToUpper[q.toUpperCase()] = 1;
   this.simulPresses.events[this.flagNamesByChar[q]] = 0;
  }
  
  
  
  this.flagNames = [
   "left",
   "right",
   "softdrop",
   "harddrop",
   
   "hold",
   "ccw",
   "cw",
   "c180w",
   
  ];
  
  for (let u = 0; u < game.flagNames.length; u++) {
   let ref = game.flagNames[u];
   //this.controlsBitwise.bitList[ref] = 2 ** (u);
   this.flagPresses[ref] = false;
  }
  //////console.log(this.controlsBitwise.bitList)
  this.lastFlagPresses = {};
  for (let a in this.flagPresses) {
   this.lastFlagPresses[a] = false;
   //this.flagNames.push(a);
  }
  
  this.inputFrames = 0;
 }
 
 updateTeam() {
  this.canvasClear("team");
  let g = 0;
  if (this.actualTeam > -1) g = this.actualTeam
  this.canvasCtx.team.drawImage(game.misc.team_colors,
   g * 256, 0, 256, 256,
   0, 0, 500, 500
  )
 }
 
 checkHalt(man, del) {
  return (man && this.halt.delays.manipulation) ||
   (del && this.halt.delays.delay);
  
 }
 
 runAnimations() {
  for (let h = 0, m = this.animFieldNames.length; h < m; h++)
   this.fieldAnimations[this.animFieldNames[h]].run();
  
  for (let h = 0, m = this.playcharExt.animname.length; h < m; h++)
   this.playcharExt.anim[this.playcharExt.animname[h]].run();
  
  if (this.garbageTrayAnimDelay > 0) {
   this.garbageTrayAnimDelay--;
   
   let center = (((200 * 6) / 2) - (200 / 2));
   
   let l = Math.min(this.garbageTrayAnimDelay, 20);
   
   for (let g = 0, lm = this.garbageTrayObjects.length; g < lm; g++) {
    let reference = this.garbageTrayObjects[g];
    let distance = (center) - (g * 200);
    reference.gx = distance * bezier((l) / 20, 0, 1, 0, 0, 0, 1);
    
   }
   
   this.drawGarbageTray();
  }
  
  if (this.garbageTrayBehindAnimDelay > 0) {
   this.garbageTrayBehindAnimDelay--;
   
   let center = (((200 * 6) / 2) - (200 / 2));
   
   let l = Math.min(this.garbageTrayBehindAnimDelay, 20);
   
   for (let g = 0, lm = this.garbageTrayBehindObjects.length; g < lm; g++) {
    let reference = this.garbageTrayBehindObjects[g];
    let distance = (center) - (g * 200);
    reference.gx = distance * bezier((l) / 20, 0, 1, 0, 0, 0, 1);
    
   }
   
   this.drawGarbageTrayBehind();
  }
  
  if (this.emAnimationSetting.on && this.emAnimationSetting.name in this.animationTriggerEvents) {
   this.emAnimationSetting.time++;
   let again = false;
   do {
    if (this.emAnimationSetting.time in this.animationTriggerEvents[this.emAnimationSetting.name]) {
     
     again = false;
     let ind = this.animationTriggerEvents[this.emAnimationSetting.name][this.emAnimationSetting.time];
     //let ref = this.animationElements[this.emAnimationSetting.name];
     let origin = this.assetRect("OVERLAY-LAYER");
     let originX = origin.x + (origin.width / 2);
     let originY = origin.y + (origin.height / 2);
     
     //////console.log(this.emAnimationSetting.time, ind)
     for (let ma of ind) {
      if (ma.action === "createAnimLayer") {
       
       let srcRef = this.animationElements[ma.targetsrc];
       
       let mid = this.getCanvasAnimationName(ma.targetid);
       animatedLayers.create(
        mid,
        ma.framemax || 0,
        originX,
        originY,
        0,
        0,
        0,
        srcRef.framewidth,
        srcRef.frameheight,
        srcRef.aspectwidth * srcRef.cellsizemult,
        srcRef.aspectheight * srcRef.cellsizemult,
        (1 / ma.framedel),
        this.getCanvasAnimationLoadedName(ma.targetsrc),
        srcRef.xbound,
        
        this.fieldCellSize,
        
        
        {
         isOn: ma.loop || false,
         resetFrame: ma.resetframe || 0,
         
        },
        ma.paused,
        true,
       );
       animatedLayers.setOpacity(mid, "opacity" in ma ? ma.opacity : 1, -99);
       
      }
      if (ma.action == "configureAnimLayer") {
       /*
       "action": "configureAnimLayer",
        "framemax": 5,
        "framepos": 1,
        "framedel": 5,
        "loop": true,
        "paused": false,
        "targetid": "win"
       */
       //let srcRef = this.animationElements[ma.targetid];
       let target = animatedLayers.getObject(this.getCanvasAnimationName(ma.targetid));
       //////console.log(animatedLayers.main.obj, target)
       if ("framemax" in ma) {
        target.frame.max = ma.framemax;
        target.loop.targetFrame = ma.framemax;
       }
       if ("framepos" in ma) {
        target.frame.int = target.frame.max - ma.framepos;
        target.frame.elapsed = ma.framepos;
        
       }
       
       if ("framedel" in ma) target.frame.rate = 1 / ma.framedel;
       if ("loop" in ma) target.loop.isOn = ma.loop;
       if ("resetframe" in ma) target.loop.resetFrame = ma.resetframe;
       if ("paused" in ma) target.isPaused = ma.paused;
       //if ("framemax" in ma) target.frame.bound = ma.framemax;
       ////console.log(ma,target.isPaused, target.frame.elapsed, target.loop.isOn)
      }
      if (ma.action == "time") {
       this.emAnimationSetting.time = ma.time - 1;
       again = false;
      }
      if (ma.action == "move") {
       let bez = [1 / 3, 2 / 3];
       if (ma.timing == "bezier") {
        if ("bez_s1" in ma) bez[0] = ma.bez_s1;
        if ("bez_s2" in ma) bez[1] = ma.bez_s2;
       }
       //////console.log(this.character.current + " " + ma.targetid + " MOVE")
       //////console.log(this.character.current, this.animationElements, this.animationTriggerEvents)
       // let srcRef = this.animationElements[ma.targetid];
       
       let target = animatedLayers.getObject(this.getCanvasAnimationName(ma.targetid));
       target.moveOffset(
        (ma.x0),
        (ma.y0),
        (ma.x1),
        (ma.y1),
        ma.duration, bez);
      }
      if (ma.action == "rotate") {
       let bez = [1 / 3, 2 / 3];
       if (ma.timing == "bezier") {
        if ("bez_s1" in ma) bez[0] = ma.bez_s1;
        if ("bez_s2" in ma) bez[1] = ma.bez_s2;
       }
       //////console.log(this.character.current + " " + ma.targetid + " MOVE")
       //////console.log(this.character.current, this.animationElements, this.animationTriggerEvents)
       // let srcRef = this.animationElements[ma.targetid];
       
       let target = animatedLayers.getObject(this.getCanvasAnimationName(ma.targetid));
       target.rotateOffset(
        (ma.start),
        (ma.end),
        ma.duration, bez);
      }
      if (ma.action == "path") {
       let bez = [1 / 3, 2 / 3];
       if (ma.timing == "bezier") {
        if ("bez_s1" in ma) bez[0] = ma.bez_s1;
        if ("bez_s2" in ma) bez[1] = ma.bez_s2;
       }
       //////console.log(this.character.current + " " + ma.targetid + " MOVE")
       //////console.log(this.character.current, this.animationElements, this.animationTriggerEvents)
       // let srcRef = this.animationElements[ma.targetid];
       
       let target = animatedLayers.getObject(this.getCanvasAnimationName(ma.targetid));
       target.setPath(
        this.animationPaths[ma.path],
        (ma.duration),
        bez);
       
       
      }
      if (ma.action == "opacity") {
       //////console.log(this.character.current + " " + ma.targetid + " MOVE")
       //////console.log(this.character.current, this.animationElements, this.animationTriggerEvents)
       //let srcRef = this.animationElements[ma.targetid];
       animatedLayers.setOpacity(this.getCanvasAnimationName(ma.targetid), "opacity" in ma ? ma.opacity : 1, ma.duration);
       
      }
      if (ma.action == "scale") {
       let target = animatedLayers.getObject(this.getCanvasAnimationName(ma.targetid));
       let bez = [1 / 3, 2 / 3];
       if (ma.timing == "bezier") { if ("bez_s1" in ma) bez[0] = ma.bez_s1; if ("bez_s2" in ma) bez[1] = ma.bez_s2 }
       if (ma.x0 !== ma.x1) target.scaleXOffset(ma.x0, ma.x1, ma.duration, bez);
       if (ma.y0 !== ma.y1) target.scaleYOffset(ma.y0, ma.y1, ma.duration, bez)
      }
     }
    }
   } while (again);
  }
  
 }
 
 playEmAnimation(name) {
  
  this.emAnimationSetting.name = name;
  this.emAnimationSetting.time = -1;
  this.emAnimationSetting.on = true;
  
  
  
 }
 
 resetEmAnimation() {
  this.emAnimationSetting.name = "";
  this.emAnimationSetting.time = -1;
  this.emAnimationSetting.on = false;
  
  for (let n of this.animationLayerElements) {
   animatedLayers.remove(this.getCanvasAnimationName(n));
  }
 }
 
 getCanvasAnimationName(obj) {
  return `P${this.player}-${this.character.current}||LAYER||${obj}`;
 }
 
 getCanvasAnimationPlainName(obj) {
  return `P${this.player}||LAYER||${obj}`;
  
 }
 
 setPlayerName(name) {
  this.name = name;
  
  this.editIH("NAMEPLATE", name);
 }
 
 playAnimation(name, stop) {
  //this.resetAnimations();
  /**for (let h = 0, m = this.animFieldNames.length; h < m; h++)
   if (stop.indexOf(this.animFieldNames[h]) !== -1) this.fieldAnimations[this.animFieldNames[h]].reset();*/
  this.fieldAnimations[name].play();
 }
 
 stopAnimation(name) {
  //this.resetAnimations();
  /**for (let h = 0, m = this.animFieldNames.length; h < m; h++)
   if (stop.indexOf(this.animFieldNames[h]) !== -1) this.fieldAnimations[this.animFieldNames[h]].reset();*/
  this.fieldAnimations[name].reset();
 }
 
 playUnfreezableAnimation(name, stop) {
  //this.resetAnimations();
  /**for (let h = 0, m = this.animFieldNames.length; h < m; h++)
   if (stop.indexOf(this.animFieldNames[h]) !== -1) this.fieldAnimations[this.animFieldNames[h]].reset();*/
  this.unfreezableFieldAnimations[name].play();
 }
 
 resetAnimations() {
  for (let h = 0, m = this.animFieldNames.length; h < m; h++) {
   ////console.log(this.animFieldNames[h])
   this.fieldAnimations[this.animFieldNames[h]].reset();
  }
  this.setStyle("WHOLE", "opacity", "100%");
  this.setStyle("AUX-WHOLE", "opacity", "100%");
 }
 
 resetUFA() {
  for (let h = 0, m = this.namesUFA.length; h < m; h++)
   this.unfreezableFieldAnimations[this.namesUFA[h]].reset();
 }
 
 checkWaitDeterminism() {
  this.shouldWaitForOpponent = this.canWaitForOpponent;
 }
 
 executeRotateWobble(intensity, frames, aux) {
  this.fieldAnimations.fieldWobbleRotate.reset();
  if (intensity === 0) return;
  this.fieldAnimations.fieldWobbleRotate.setFrame(frames);
  this.styleVariable(aux ? "AUX-WHOLE" : "ROTATING-WHOLE", `board-rot-wob-int`, `${intensity || 20}`);
  this.fieldAnimations.fieldWobbleRotate.play();
 }
 
 runUnfreezableAnims() {
  for (let h = 0, m = this.namesUFA.length; h < m; h++)
   this.unfreezableFieldAnimations[this.namesUFA[h]].run();
  
  
  
 }
 
 removeGarbage(amount, isBehindTrayOnly) {
  let garbLength = this.calculateGarbage() + this.calculateGarbageBehind();
  let gCount = amount,
   neutralCount = 0;
  while (!isBehindTrayOnly && this.garbage.length > 0 && gCount > 0) {
   let reference = this.garbage[0];
   if (reference.count <= 0) {
    this.garbage.shift();
    continue;
   };
   
   let min = Math.min(reference.count, gCount);
   reference.count -= min;
   neutralCount += min;
   if (reference.count <= 0) {
    this.garbage.shift();
   }
   gCount -= min;
   //count -= min;
   
   
   
  }
  while (this.garbageBehind.length > 0 && gCount > 0) {
   let reference = this.garbageBehind[0];
   if (reference.count <= 0) {
    this.garbageBehind.shift();
    continue;
   };
   
   let min = Math.min(reference.count, gCount);
   reference.count -= min;
   neutralCount += min;
   if (reference.count <= 0) {
    this.garbageBehind.shift();
   }
   //count -= min;
   gCount -= min;
   
  }
  this.garbageLength = this.calculateGarbage();
  this.garbageBehindLength = this.calculateGarbageBehind();
  this.rpgAttr.hpDamage = this.calculateHPDamage();
  this.garbageLastForTray.assign(this.garbageLength);
  this.garbageBehindLastForTray.assign(this.garbageBehindLength);
  if (!this.block.insane.isOn && !this.blob.insane.isOm && !this.block.isAux && this.blob.isAux && !this.isGarbageCollectionMode) this.check1v1Overhead(false, garbLength, this.garbageLength + this.garbageBehindLength, false);
  
 }
 
 enableAuxField(h) {
  this.auxEnabled = h;
  this.setStyle("AUX-WHOLE", "display", this.auxEnabled ? "block" : "none");
  
 }
 
 switchModeType(type) {
  this.activeType = type;
  this.blob.isControl = type == 1;
  this.blob.isEnable = type == 1;
  this.blob.isActive = type == 1;
  this.block.isControl = type == 0;
  this.block.isEnable = type == 0;
  this.block.isActive = type == 0;
  this.changeBorder();
  this.adjustBlobBlockNexts();
  this.block.holdShow(type == 0);
  
  this.setStyle("AUX-BORDER-1", "display", (this.player % 2) == 0 ? "block" : "none");
  this.setStyle("AUX-BORDER-2", "display", (this.player % 2) == 1 ? "block" : "none");
  
  if (this.swapMode.isOn) {
   
   this.drawGarbageTray();
   this.drawGarbageTrayBehind();
  }
 }
 
 refreshBorderField(type) {
  //let type = this.activeType;
  
  
  this.changeBorder(type);
  this.adjustBlobBlockNexts(type);
  this.block.holdShow(type == 0);
  this.block.drawActivePiece();
  this.blob.drawActivePiece();
  this.block.drawStack();
  this.blob.drawStack();
  if (type == 0) {
   let a = this.block;
   /*a.drawActivePiece();
   a.drawStack();*/
   a.previewDraw();
   a.holdDraw();
  }
  
  if (type == 1) {
   let a = this.blob;
   /*a.drawActivePiece();
   a.drawStack();*/
   a.previewDraw();
  }
 }
 
 convertGarbageBlockToGarbageBlob(type, isChain) {
  let count = {
   system: {
    count: 0,
    hpdmg: 0,
    wait: false,
    t: "system"
   }
   
  };
  
  for (let h = 0; h < this.garbage.length; h++) {
   let ma = this.garbage[h];
   
   if (!ma.wait) {
    
    count.system.count += ma.count;
    count.system.hpdmg += ma.hpdmg;
    
   } else if (!(ma.player in count)) {
    
    
    count[ma.player] = {
     count: ma.count,
     hpdmg: ma.hpdmg,
     wait: ma.wait,
     t: ma.player
    };
   } else {
    count[ma.player].count += ma.count;
    count[ma.player].hpdmg += ma.hpdmg;
   }
  }
  
  for (let h = 0; h < this.garbageBehind.length; h++) {
   let ma = this.garbageBehind[h];
   
   if (!ma.wait) {
    
    count.system.count += ma.count;
    count.system.hpdmg += ma.hpdmg;
    
   } else if (!(ma.player in count)) {
    
    
    count[ma.player] = {
     count: ma.count,
     hpdmg: ma.hpdmg,
     wait: ma.wait,
     t: ma.player
    };
   } else {
    count[ma.player].count += ma.count;
    count[ma.player].hpdmg += ma.hpdmg;
   }
  }
  
  this.garbage.length = 0;
  this.garbageBehind.length = 0;
  
  //let countBehind = this.calculateGarbageBehind();
  if (type == 0)
   for (let cmo in count) {
    let co = count[cmo];
    let h = 4;
    let total = 0;
    let l = 0;
    let q = 0;
    while (h < co.count && co.count > 0) {
     h += l;
     l += (1);
     if (h >= co.count) break;
     q++;
     total++;
    }
    if (total > 0) this.addGarbage(co.t, [total], co.wait, true, -this.garbageDelay + 2, co.hpdmg, true);
   }
  if (type == 1)
   for (let cmo in count) {
    let co = count[cmo];
    let h = 0;
    
    let total = 0;
    let l = 4;
    let q = 0;
    while (h < co.count && co.count > 0) {
     h++;
     if (h == 1) total += 4;
     else total += 1 + ~~(q / 1);
     q++;
    }
    if (total > 0) this.addGarbage(co.t, [total], co.wait, true, -this.garbageDelay + 2, co.hpdmg, true);
    
   }
  
  
  
  this.garbageLength = this.calculateGarbage();
  this.garbageBehindLength = this.calculateGarbageBehind();
  
  this.garbageLastForTray.assign(this.garbageLength);
  this.garbageBehindLastForTray.assign(this.garbageBehindLength);
  this.rpgAttr.hpDamage = this.calculateHPDamage();
  
 }
 
 switchAuxToMain(type) {
  this.activeType = type;
  this.blob.isControl = type == 1;
  this.blob.isAux = type == 0;
  this.blob.isEnable = true;
  this.blob.isActive = type == 1;
  this.block.isControl = type == 0;
  this.block.isAux = type == 1;
  this.block.isEnable = true;
  this.block.isActive = type == 0;
  this.changeBorder();
  this.adjustBlobBlockNexts();
  this.adjustBlobBlockBG(type);
  this.block.holdShow(type == 0);
  this.block.drawActivePiece();
  this.blob.drawActivePiece();
  this.block.drawStack();
  this.blob.drawStack();
  if (type == 0) {
   let a = this.block;
   /*a.drawActivePiece();
   a.drawStack();*/
   a.previewDraw();
   a.holdDraw();
  }
  
  if (type == 1) {
   let a = this.blob;
   /*a.drawActivePiece();
   a.drawStack();*/
   a.previewDraw();
  }
  
  if (this.swapMode.isOn) {
   this.garbageType = this.activeType;
   this.drawGarbageTray();
   this.drawGarbageTrayBehind();
  }
  
  
 }
 
 clearLayerAnims() {
  for (let h of this.animationLayerElements) {
   animatedLayers.remove(this.getCanvasAnimationName(h));
  }
 }
 
 changeBorder(u) {
  let activeType = u !== void 0 ? u : this.activeType;
  
  this.setStyle("BORDER-BLOCK", "display", activeType == 0 ? "block" : "none");
  this.setStyle("BORDER-BLOB-1", "display", activeType == 1 && (this.player % 2) == 0 ? "block" : "none");
  this.setStyle("BORDER-BLOB-2", "display", activeType == 1 && (this.player % 2) == 1 ? "block" : "none");
 }
 
 check1v1Overhead(isAttacking, garbLength, newGarb, atk) {
  if (game1v1.on) {
   if (!game1v1.overhead.on) {
    if (!atk && !isAttacking && garbLength > 0 && newGarb > 0) game1v1.overhead.openClose(1, this.player, newGarb, garbLength);
   }
   else {
    if (!atk || isAttacking) {
     game1v1.overhead.checkGarbage(this.player, newGarb);
     if (newGarb == 0) {
      this.conclude1v1Overhead(3);
     }
    } else if (atk) {
     this.conclude1v1Overhead(1);
    }
    
   }
  } else {
   
  }
 }
 
 conclude1v1Overhead(n) {
  if (!game1v1.on) return;
  if (n == 0) { // instant
   game1v1.overhead.openClose(5);
  }
  
  if (n == 1) { //successful counter
   game1v1.overhead.openClose(2);
  }
  
  if (n == 2) { //failed counter
   game1v1.overhead.openClose(3);
  }
  
  if (n == 3) { //neutral, countered full
   game1v1.overhead.openClose(4);
  }
 }
 
 resize(cellSize, fontSize, sizeMult, isEv) {
  this.cellSize = ~~(cellSize * game.resQualityMult);
  this.fieldCellSize = ~~(cellSize * sizeMult);
  this.fieldFontSize = ~~(fontSize * sizeMult);
  this.isCompact = isEv;
  let block = this.block;
  let blob = this.blob;
  let paddingY = 0;
  ////////console.log(this.fieldSize)
  let height = this.fieldSize.vh + this.visibleFieldBufferHeight,
   fieldHeight = this.fieldSize.vh + this.visibleFieldHeight,
   width = this.fieldSize.w;
  /*let bheight = (blob.fieldSize.vh) + this.visibleFieldBufferHeight,
   bfieldHeight = (blob.fieldSize.vh) + this.fieldSize.h,
   bwidth = (blob.fieldSize.w);*/
  let handWidth = 5;
  
  let plm = 6;
  
  if (this.isCompact) {
   plm = 1;
   handWidth = 0;
   paddingY = this.fieldCellSize * 4;
  }
  this.setStyle("AREA", "transform", `translateY(${paddingY}px)`);
  this.meterBar.right.resize(this.fieldCellSize, 0.6, fieldHeight);
  this.meterBar.garbwait.resize(this.fieldCellSize, 0.6, fieldHeight);
  this.setStyle("AREA", "fontSize", `${this.fieldFontSize}px`);
  for (let body of ["BORDER", "AREA", "WHOLE", "ROTATING-WHOLE", "STOMP-WHOLE", "PLAYER-CHARACTER-LAYER"]) {
   this.setStyle(body, "width", `${this.fieldCellSize * ((handWidth * 2) + width + 2 + 2 + plm)}px`);
   this.setStyle(body, "height", `${this.fieldCellSize * (fieldHeight+2+2)}px`);
  }
  
  for (let body of ["BODY", "OVERLAY-LAYER"]) {
   this.setStyle(body, "width", `${this.fieldCellSize * ((handWidth * 2) + width + 2 + plm)}px`);
   this.setStyle(body, "height", `${this.fieldCellSize * (fieldHeight)}px`);
  }
  let clearTextSizeTotal = 0;
  for (let txt of [
   {
    name: "SPIN",
    size: 1.12
   },
   {
    name: "LINE",
    size: 1.9
   },
   {
    name: "B2B",
    size: 1.07
   },
   {
    name: "COMBO",
    size: 1.30
   },
   {
    name: "SPIKE",
    size: 1.0
   }, ]) {
   this.setStyle(`CLEARTEXT-TEXT-${txt.name}`, "font-size", `${this.fieldFontSize * txt.size}px`);
   this.setStyle(`CLEARTEXT-TEXT-${txt.name}`, "width", `100%`);
   this.setStyle(`CLEARTEXT-TEXT-${txt.name}`, "text-align", `right`);
   this.setStyle(`CLEARTEXT-TEXT-${txt.name}`, "opacity", `0%`);
   clearTextSizeTotal += txt.size;
  }
  
  this.setStyle('BORDER', "right", `${(this.fieldCellSize * -1)}px`);
  
  this.setStyle("DIV-CLEARTEXT", "width", `${this.fieldCellSize * 5 * 2}px`);
  this.setStyle("DIV-CLEARTEXT", "height", `${this.fieldCellSize * clearTextSizeTotal}px`);
  this.setStyle("DIV-CLEARTEXT", "margin-left", `${this.fieldCellSize * 5 * -1}px`);
  
  this.setStyle(`CLEARTEXT-TEXTS`, "width", `${this.fieldCellSize * 5 * 2}px`);
  this.setStyle(`CLEARTEXT-TEXTS`, "height", `${this.fieldCellSize * clearTextSizeTotal}px`);
  
  this.setStyle(`CLEARTEXT-CANVTEXT`, "width", `${this.fieldCellSize * 5}px`);
  this.setStyle(`CLEARTEXT-CANVTEXT`, "height", `${this.fieldCellSize * 3}px`);
  
  this.setStyle(`CLEARTEXT-TSPIN-CANVAS`, "width", `${this.fieldCellSize * 3}px`);
  this.setStyle(`CLEARTEXT-TSPIN-CANVAS`, "height", `${this.fieldCellSize * 3}px`);
  
  this.setStyle(`CLEARTEXT-TSPIN-LINE`, "width", `${this.fieldCellSize * 2}px`);
  this.setStyle(`CLEARTEXT-TSPIN-LINE`, "height", `${this.fieldCellSize * 3}px`);
  this.setCanvasSize("tspin", 180, 180);
  
  
  for (let hand of ["LEFT", "RIGHT"]) {
   this.setStyle(`${hand}-HAND`, "width", `${this.fieldCellSize * handWidth}px`);
   this.setStyle(`${hand}-HAND`, "height", `${this.fieldCellSize * height}px`);
  } /**/
  
  for (let field of ["-CHARACTER-CANVAS", "-PIECE-CANVAS", "-STACK-CANVAS", "-DYNAMIC"]) {
   this.setStyle(`FIELD${field}`, "width", `${(this.fieldCellSize * width)}px`);
   this.setStyle(`FIELD${field}`, "height", `${this.fieldCellSize * height}px`);
  }
  for (let field of ["-INSANE-CANVAS", "-INSANE", "-BACK-CANVAS"]) {
   this.setStyle(`FIELD${field}`, "width", `${(this.fieldCellSize * width)}px`);
   this.setStyle(`FIELD${field}`, "height", `${this.fieldCellSize * fieldHeight}px`);
  }
  
  this.setCanvasSize("insane", width * this.cellSize, fieldHeight * this.cellSize);
  this.setCanvasSize("back", width * this.cellSize, fieldHeight * this.cellSize);
  
  
  this.setStyle(`FIELD`, "width", `${(this.fieldCellSize * width)}px`);
  this.setStyle(`FIELD`, "height", `${this.fieldCellSize * fieldHeight}px`);
  
  this.setStyle(`FIELD-CHARACTER-CANVAS`, "width", `${(this.fieldCellSize * width)}px`);
  this.setStyle(`FIELD-CHARACTER-CANVAS`, "height", `${this.fieldCellSize * fieldHeight}px`);
  
  
  
  for (let field of ["character", "stack", "piece"]) {
   this.setCanvasSize(field, width * this.cellSize, height * this.cellSize);
  }
  
  this.setCanvasSize("character", width * this.cellSize, fieldHeight * this.cellSize);
  
  
  
  for (let field of ["DIV", "CANVAS", "BEHIND-CANVAS"]) {
   this.setStyle(`GARBAGE-TRAY-${field}`, "width", `${(this.fieldCellSize * 6*2.0)}px`);
   this.setStyle(`GARBAGE-TRAY-${field}`, "height", `${this.fieldCellSize * 2.0}px`);
   if (field === "DIV") this.setStyle(`GARBAGE-TRAY-${field}`, "top", `${this.fieldCellSize * -1*2.5}px`);
  }
  this.setCanvasSize("garbageTray", 6 * 200, 200);
  this.setCanvasSize("garbageTrayBehind", 6 * 200, 200);
  
  for (let field of ["PLAYCHAR-CANVAS-DIV", "PLAYCHAR-CANVAS"]) {
   this.setStyle(`${field}`, "width", `${(this.fieldCellSize * 26)}px`);
   this.setStyle(`${field}`, "height", `${this.fieldCellSize * 26}px`);
  }
  
  this.setStyle("PLAYCHAR-TEXT-DIV", "width", `${(this.fieldCellSize * 24)}px`);
  this.setStyle("PLAYCHAR-TEXT-DIV", "height", `${this.fieldCellSize * 4}px`);
  this.setStyle("PLAYCHAR-TEXT", "font-size", `${this.fieldFontSize * 4}px`);
  for (let hmll of ["DIV", "BG", "CANVAS"]) {
   this.setStyle(`BLOB-NEXT-${hmll}`, "width", `${(this.fieldCellSize * 3 * 1.5)}px`);
   this.setStyle(`BLOB-NEXT-${hmll}`, "height", `${this.fieldCellSize * 5 * 1.5}px`);
  }
  this.setCanvasSize("blobNext", this.cellSize * 3 * 1.5, this.cellSize * 5 * 1.5);
  
  for (let hmll of ["DIV", "CANVAS"]) {
   this.setStyle(`RECTANIM-${hmll}`, "width", `${(this.fieldCellSize * 247 * 0.06)}px`);
   this.setStyle(`RECTANIM-${hmll}`, "height", `${this.fieldCellSize * 70 * 0.06}px`);
  }
  
  
  this.setStyle(`WINS-SCORE`, "top", `${this.fieldCellSize * (height - this.visibleFieldBufferHeight + 0.5)}px`);
  let shm = 0;
  if (this.isCompact) shm = 3.3;
  //this.setStyle(`STATS-SCORE-TEXT`, "transform", `translateX(${this.fieldCellSize * (shm/2)}px)`);
  this.setStyle('WINS-SCORE', "width", `${this.fieldCellSize * this.fieldSize.w + 6}px`);
  this.setStyle('WINS-SCORE', "height", `${this.fieldCellSize * 2}px`);
  
  //this.setStyle(`TEAM-WIN`, "top", `${this.fieldCellSize * (height - this.visibleFieldBufferHeight)}px`);
  this.setStyle('TEAM-WIN', "width", `${this.fieldCellSize * 4}px`);
  this.setStyle('TEAM-WIN', "height", `${this.fieldCellSize * 1.8}px`);
  this.setStyle('TEAM-CANVAS', "width", `${this.fieldCellSize * 1.8}px`);
  this.setStyle('TEAM-CANVAS', "height", `${this.fieldCellSize * 1.8}px`);
  this.setStyle('WINS-DIV', "width", `${this.fieldCellSize * 2}px`);
  this.setStyle('WINS-DIV', "height", `${this.fieldCellSize * 2}px`);
  
  this.setStyle('TEAM-WIN', "display", this.isCompact ? "flex" : "none");
  
  
  //this.setStyle(`TEAM-WIN`, "transform", `translateX(${-this.fieldCellSize * (shm*1.2)}px)`);
  
  this.setStyle("WINS-TEXT", "font-size", `${this.fieldFontSize * 1.28}px`);
  
  
  this.setStyle('STATS-SCORE', "width", `${this.fieldCellSize * this.fieldSize.w + 2}px`);
  this.setStyle('STATS-SCORE', "height", `${this.fieldCellSize * 1.5}px`);
  
  
  this.setStyle(`RECTANIM-DIV`, "top", `${this.fieldCellSize * (height + 1 - this.visibleFieldBufferHeight)}px`);
  
  this.setStyle('HP-BAR-DIV', "width", `${this.fieldCellSize * 14}px`);
  this.setStyle('HP-BAR-DIV', "height", `${this.fieldCellSize * 1.5}px`);
  
  this.setStyle('HP-TEXT-DIV', "width", `${this.fieldCellSize * 2}px`);
  this.setStyle('HP-TEXT-DIV', "height", `${this.fieldCellSize * 1.5}px`);
  
  this.setStyle('HP-METER-CANVAS', "width", `${this.fieldCellSize * 12}px`);
  this.setStyle('HP-METER-CANVAS', "height", `${this.fieldCellSize * 1.5}px`);
  
  this.setStyle(`HP-BAR-DIV`, "top", `${this.fieldCellSize * (-1.6)}px`);
  this.setStyle(`GARBAGE-TRAY-DIV`, "top", `${this.fieldCellSize * -1*(2.3 + (this.rpgAttr.isOn ? 1.5 : 0))}px`);
  
  this.setStyle(`FIELD-CHARACTER-CANVAS`, "transform", `rotateY(${((this.player % 2) == 1 ? 180 : 0)}deg)`);
  this.setStyle(`PLAYCHAR-CANVAS`, "transform", `rotateY(${((this.player % 2) == 1 ? 180 : 0)}deg)`);
  this.setStyle(`RECTANIM-CANVAS`, "transform", `rotateY(${((this.player % 2) == 1 ? 180 : 0)}deg)`);
  
  //this.setStyle("HOLD-TEXT", "font-size", `${this.fieldFontSize * 1}px`);
  this.setStyle("STATS-SCORE-TEXT", "font-size", `${this.fieldFontSize * 1.7}px`);
  //AUXILIARY FIELDS FOR SWAP MODE
  //PX is 0.47;
  let px = 0.47;
  
  this.setStyle(`AUX-FIELD-CHARACTER-CANVAS`, "transform", `rotateY(${((this.player % 2) == 1 ? 180 : 0)}deg)`);
  
  this.setStyle("AUX-WHOLE", "top", `${this.fieldCellSize*(this.isAux && this.player % 2 == 0 ? 2 : 11)}px`);
  
  this.setStyle("FEVER-GAUGE", "top", `${this.fieldCellSize*6}px`);
  
  this.setStyle("AUX-WHOLE", this.player % 2 == 1 ? "left" : "right", `${this.fieldCellSize*-2.7}px`);
  
  this.setStyle("FEVER-GAUGE", this.player % 2 == 1 ? "left" : "right", `${this.fieldCellSize*-0.3}px`);
  
  
  
  this.setStyle("RPG-DECK", this.player % 2 == 1 ? "left" : "right", `${this.fieldCellSize*-0.9}px`)
  this.setStyle("RPG-DECK", "top", `${this.fieldCellSize*9}px`);
  for (let hmll of ["", "-CANVAS"]) {
   this.setStyle(`FEVER-GAUGE${hmll}`, "width", `${(this.fieldCellSize * 6)}px`);
   this.setStyle(`FEVER-GAUGE${hmll}`, "height", `${this.fieldCellSize * 15}px`);
  }
  this.setCanvasSize("feverGauge", this.cellSize * 6, this.cellSize * 15);
  this.feverStat.resize(this.cellSize * 6, this.cellSize * 15, this.cellSize, this.player % 2 == 1);
  
  for (let hmll of ["", "-CANVAS"]) {
   this.setStyle(`RPG-DECK${hmll}`, "width", `${(this.fieldCellSize * 8)}px`);
   this.setStyle(`RPG-DECK${hmll}`, "height", `${this.fieldCellSize * 13}px`);
  }
  this.setCanvasSize("rpgDeck", 200 * 8, 200 * 13);
  /*this.setStyle(`RPG-DECK`, "width", `${(this.fieldCellSize * 8.3)}px`);
  this.setStyle(`RPG-DECK`, "height", `${this.fieldCellSize * 14}px`);
  this.setStyle(`RPG-DECK-CANVAS`, "width", `${(this.fieldCellSize * 8.25)}px`);
  this.setStyle(`RPG-DECK-CANVAS`, "height", `${this.fieldCellSize * 13.95}px`);*/
  
  
  
  
  for (let field of ["-CHARACTER-CANVAS", "", "-PIECE-CANVAS", "-STACK-CANVAS", "-DYNAMIC"]) {
   this.setStyle(`AUX-FIELD${field}`, "width", `${(px*this.fieldCellSize * width)}px`);
   this.setStyle(`AUX-FIELD${field}`, "height", `${px*this.fieldCellSize * height}px`);
  }
  for (let field of ["-INSANE-CANVAS", "-INSANE", "-BACK-CANVAS"]) {
   this.setStyle(`AUX-FIELD${field}`, "width", `${(px*this.fieldCellSize * width)}px`);
   this.setStyle(`AUX-FIELD${field}`, "height", `${px*this.fieldCellSize * fieldHeight}px`);
  }
  
  
  for (let body of ["BORDER", "WHOLE", "ROTATING-WHOLE"]) {
   this.setStyle(`AUX-${body}`, "width", `${px * this.fieldCellSize * ((handWidth * 2) + width + 2 +2)}px`);
   this.setStyle(`AUX-${body}`, "height", `${px * this.fieldCellSize * (fieldHeight+2+2)}px`);
  }
  
  for (let field of ["characterAux", "stackAux", "pieceAux", "backAux"]) {
   this.setCanvasSize(field, width * this.cellSize, height * this.cellSize);
  }
  
  
  //this.setCanvasSize("insaneAux", width * this.cellSize, fieldHeight * this.cellSize * px);
  
  this.setStyle(`AUX-FIELD`, "width", `${(this.fieldCellSize * width * px)}px`);
  this.setStyle(`AUX-FIELD`, "height", `${this.fieldCellSize * fieldHeight * px}px`);
  
  this.setStyle(`AUX-FIELD-CHARACTER-CANVAS`, "width", `${(this.fieldCellSize * width * px)}px`);
  this.setStyle(`AUX-FIELD-CHARACTER-CANVAS`, "height", `${this.fieldCellSize * fieldHeight * px}px`);
  
  this.setStyle(`NAMEPLATE-DIV`, "top", `${this.fieldCellSize * (height + 3 - this.visibleFieldBufferHeight)}px`);
  
  
  this.setStyle(`NAMEPLATE-DIV`, "width", `${(this.fieldCellSize * width * 1.5)}px`);
  this.setStyle(`NAMEPLATE-DIV`, "height", `${this.fieldCellSize * 1.2}px`);
  
  //////console.log(originX, originY);
  
  this.setCanvasSize("characterAux", width * this.cellSize, fieldHeight * this.cellSize);
  
  this.adjustBlockResize();
  
  block.drawStack();
  block.drawActivePiece();
  this.drawCharacterBg(0);
  this.drawGarbageTray();
  
  this.adjustBlobBlockBG();
  this.adjustBlobBlockNexts();
  this.setCanvasSize("playchar", 600, 600);
  this.setCanvasSize("rectanim", 247, 70);
  
  
  let origin = this.assetRect("OVERLAY-LAYER");
  let originX = origin.x + (origin.width / 2);
  let originY = origin.y + (origin.height / 2);
  
  this.playerCenterPos.x = originX;
  this.playerCenterPos.y = originY + paddingY;
  
  //////console.log(originX, originY);
  
  
  if (this.isVisible) {
   this.drawActivePlaycharExt(this.playcharExt.positions[this.playcharExt.active]);
   for (let e = 0; e < this.animationLayerElements.length; e++) {
    let ev = this.animationLayerElements[e];
    ////console.log(ev)
    let initid = this.getCanvasAnimationName(ev);
    if (animatedLayers.checkObject(initid)) {
     let object = animatedLayers.getObject(initid);
     object.centerPos.x = this.playerCenterPos.x;
     object.centerPos.y = this.playerCenterPos.y;
     object.sizeMult = this.fieldCellSize;
    }
    
   }
  }
 }
 
 adjustBlockResize() {
  let containerHeight = 4,
   containerCanvasHeight = 4,
   containerCanvasWidth = 5,
   containerWidth = 5,
   placeholderHeight = 1,
   queueWidth = 5,
   queueHeight = 3 * 4;
  
  let nextHeight = 4 + (3 * 4 * 0.85),
   nextWidth = 5;
  let hwl = 0;
  let sz = 0.7;
  let msd = this.fieldSize.w + 2;
  let msl = 0.5;
  if (this.isCompact) {
   msd -= 2;
   msd = -5 + 2;
   nextWidth = this.fieldSize.w * 1.5;
   //sz = 1;
   nextHeight = (3 * 2 * 0.85) + (4);
   msl = -1;
   
  } else {}
  for (let canvas of ["hold"]) {
   this.setCanvasSize(canvas, this.cellSize * containerCanvasWidth, this.cellSize * containerCanvasHeight);
  }
  this.setCanvasSize("next", this.cellSize * nextWidth, this.cellSize * (nextHeight));
  
  this.setStyle('BLOCK-NEXT', "left", `${(this.fieldCellSize * (msd))}px`);
  
  this.setStyle('BLOCK-NEXT', "top", `${(this.fieldCellSize * -msl)}px`);
  this.setStyle(`BLOCK-NEXT`, "width", `${this.fieldCellSize * nextWidth*sz}px`);
  this.setStyle(`BLOCK-NEXT`, "height", `${this.fieldCellSize * nextHeight*sz}px`);
  this.setStyle(`NEXT-CANVAS`, "width", `${this.fieldCellSize * nextWidth*sz}px`);
  this.setStyle(`NEXT-CANVAS`, "height", `${this.fieldCellSize * nextHeight*sz}px`);
  
  this.setStyle('HOLD', "left", `${(this.fieldCellSize * 0.35)}px`);
  this.setStyle('HOLD', "top", `${(this.fieldCellSize * 0.225)}px`);
  this.setStyle('HOLD', "width", `${(this.fieldCellSize * containerWidth)}px`);
  this.setStyle('HOLD', "height", `${this.fieldCellSize * containerHeight}px`);
  this.setStyle(`HOLD-CANVAS`, "width", `${this.fieldCellSize * containerWidth*sz}px`);
  this.setStyle(`HOLD-CANVAS`, "height", `${this.fieldCellSize * containerCanvasHeight*sz}px`);
  
  
 }
 
 adjustBlobBlockBG(u) {
  let activeType = u !== void 0 ? u : this.activeType;
  
  this.setStyle("BORDER-BLOCK", "display", "none");
  
  this.setStyle("BORDER-BLOB-1", "display", "none");
  this.setStyle("BORDER-BLOB-2", "display", "none");
  this.setStyle("BLOB-NEXT-BG-1", "display", "none");
  this.setStyle("BLOB-NEXT-BG-2", "display", "none");
  if (this.isCompact) {
   let l = 11;
   this.getAsset("BLOB-NEXT-DIV").style.setProperty("--bn-position-y", `${-this.fieldCellSize*l}px`);
   this.getAsset("BLOCK-NEXT").style.setProperty("--bn-position-y", `${-this.fieldCellSize*l}px`);
   
   this.getAsset("BLOB-NEXT-DIV").style.setProperty("--bn-position-x", `${((this.fieldCellSize * (this.fieldSize.w / 2) - this.fieldCellSize))}px`);
   this.getAsset("BLOCK-NEXT").style.setProperty("--bn-position-x", `${((this.fieldCellSize * (this.fieldSize.w / 2) - this.fieldCellSize))}px`);
   
  } else {
   this.getAsset("BLOB-NEXT-DIV").style.setProperty("--bn-position-y", `${-this.fieldCellSize}px`);
   this.getAsset("BLOCK-NEXT").style.setProperty("--bn-position-y", `${-this.fieldCellSize}px`);
   
   this.getAsset("BLOB-NEXT-DIV").style.setProperty("--bn-position-x", `${((this.player % 2) == 0 ? 1 : -1) * ((this.fieldCellSize * (this.fieldSize.w / 2)) + (this.fieldCellSize * (3) * 1.5))}px`);
   this.getAsset("BLOCK-NEXT").style.setProperty("--bn-position-x", `${((this.player % 2) == 0 ? 1 : 1) * ((this.fieldCellSize * (this.fieldSize.w / 2)) + (this.fieldCellSize * (3) * 1.1))}px`);
  }
  if (!this.isVisible) return;
  if (activeType === 1) {
   if (!this.isCompact) {
    this.setStyle("BORDER-BLOB-1", "display", (this.player % 2) === 0 ? "block" : "none");
    this.setStyle("BORDER-BLOB-2", "display", (this.player % 2) === 1 ? "block" : "none");
   }
   let lm = (this.player % 2) === 0 || this.isCompact;
   let ls = (this.player % 2) === 1 && !this.isCompact;
   this.setStyle("BLOB-NEXT-BG-1", "display", lm ? "block" : "none");
   this.setStyle("BLOB-NEXT-BG-2", "display", ls ? "block" : "none");
  } else if (!this.isCompact) {
   this.setStyle("BORDER-BLOCK", "display", "block");
  }
  
 }
 
 adjustBlobBlockNexts(u) {
  let activeType = u !== void 0 ? u : this.activeType;
  this.setStyle("BLOB-NEXT-DIV", "display", "none");
  this.setStyle("BLOCK-NEXT", "opacity", "0%");
  if (!this.isVisible) return;
  if (activeType == 1) {
   this.setStyle("BLOB-NEXT-DIV", "display", "block");
  } else {
   this.setStyle("BLOCK-NEXT", "opacity", "100%");
  }
  
 }
 
 drawGarbageTray() {
  this.canvasClear("garbageTray");
  if (this.isVisible) {
   for (let x = 0; x < 6; x++) {
    this.canvasCtx.garbageTray.drawImage(
     manager.skinGarb.canvas,
     (this.garbageTrayObjects[x].x * 200),
     this.garbageType * 200,
     200,
     200,
     (x * 200) + this.garbageTrayObjects[x].gx,
     0,
     200,
     200,
    );
   }
  }
 }
 
 drawGarbageTrayBehind() {
  this.canvasClear("garbageTrayBehind");
  if (this.isVisible) {
   for (let x = 0; x < 6; x++) {
    this.canvasCtx.garbageTrayBehind.drawImage(
     manager.skinGarb.canvas,
     (this.garbageTrayBehindObjects[x].x * 200),
     this.garbageType * 200,
     200,
     200,
     (x * 200) + this.garbageTrayBehindObjects[x].gx,
     0,
     200,
     200,
    );
   }
  }
 }
 
 drawCharacterBg(n) {
  this.canvasClear("character");
  this.canvasCtx.character.drawImage(this.character.canvas, (n || 0) * 300, 0, 300, 600, 0, 0, this.fieldSize.w * this.cellSize, (this.fieldSize.vh + this.visibleFieldHeight) * this.cellSize);
  
  this.canvasClear("characterAux");
  this.canvasCtx.characterAux.drawImage(this.character.canvas, (n || 0) * 300, 0, 300, 600, 0, 0, this.fieldSize.w * this.cellSize, (this.fieldSize.vh) * this.cellSize);
  
 }
 
 drawRect(ctx, x, y, row, column, sx, sy) {
  x = ~~(x * this.cellSize * sx);
  y = y * this.cellSize * sy; //- (2 * this.cellSize);
  
  let c = this.canvasCtx[ctx];
  //c.fillStyle = `rgb(${Math.random()*0}, 255, 0)`;
  
  
  if (this.isVisible) c.drawImage(
   manager.skin.canvas,
   row * this.cellSize,
   column * this.cellSize,
   this.cellSize,
   this.cellSize,
   x,
   y,
   this.cellSize * sx,
   this.cellSize * sy,
  );
 }
 
 drawArray(ctx, arr, cx, cy, color, row, sx, sy, isEraseTop) {
  for (var x = 0, len = (arr.length); x < len; x++) {
   for (var y = 0, wid = (arr[x].length); y < wid; y++) {
    if (arr[x][y]) {
     this.drawRect(ctx, x + cx, y + cy, row, color !== void 0 ? color : arr[x][y], sx || 1, sy || 1);
     if (isEraseTop) {
      let a = this.canvasses[ctx];
      this.canvasCtx[ctx].clearRect(0, 0, a.width, this.cellSize * this.visibleFieldBufferHeight);
      
     }
    }
   };
  };
 }
 
 checkLose() {
  this.isDying = true;
  this.conclude1v1Overhead(2);
 }
 
 checkWin() {
  this.isWin = true;
  //this.isActive = false;
  this.conclude1v1Overhead(2);
 }
 
 phaseLose(o) {
  this.pressStr = "";
  this.lastPressStr = "";
  
  this.isDead = true;
  this.isFinishAble = false;
  
  
  this.playSound("lose");
  //this.reset();
  
  this.resetAnimations();
  this.delay[0] = 80;
  if (o) {
   if (o === "break") {
    this.playAnimation("fieldDownDelayed");
    this.delay[0] = 140;
   } else {
    this.executeRotateWobble(0);
    if (this.activeType == 1) {
     this.blob.simulateSplashOut();
     this.blob.resetGrid();
    }
    
    this.playAnimation("fieldFinisherFinalBlow1");
    this.playAnimation("fieldFinisherFinalBlow2");
    
    if (this.swapMode.isOn) this.playAnimation("fieldDownAux");
   }
  } else {
   this.playAnimation("fieldDown");
   if (this.swapMode.isOn) this.playAnimation("fieldDownAux");
  }
  
  this.setStyle("WHOLE", "opacity", "0%");
  this.setStyle("AUX-WHOLE", "opacity", "0%");
 }
 
 startNext() {
  if (this.activeType == 0) this.block.spawnPiece(this.block.previewNextBag(), false);
  if (this.activeType == 1) this.blob.previewNextBlob();
 }
 
 engageShakeIntensityHit(x) {
  this.styleVariable("WHOLE", "shakehit-x", x);
  this.playAnimation("shakeUponHit");
 }
 
 simulateWMWShakeIntensityHit() {
  this.styleVariable("WHOLE", "shakehit-wmw-x", `${this.fieldCellSize * ((Math.random() * 16) - (Math.random() * 16))}px`);
  this.styleVariable("WHOLE", "shakehit-wmw-y", `${this.fieldCellSize * ((Math.random() * 16) - (Math.random() * 16))}px`);
  
  this.playAnimation("shakeWMWHit");
 }
 
 reset() {
  this.block.reset();
  this.blob.reset();
  //this.rpgAttr.reset();
  this.swapMode.reset();
  this.woi.reset();
  this.woiWormhole.reset();
  this.feverStat.resetRound();
  this.block.canControl = true;
  this.blob.canControl = true;
  
  this.lastPressStr = null;
  
  this.inputFrames = 0;
  //if ("fieldWobbleRotate" in this.fieldAnimations) this.executeRotateWobble(0,65);
  
  this.callibrateCenter();
  
  this.insaneBg.reset();
  
  this.resetEmAnimation();
  
  this.engagePlaycharExt();
  
  if (this.fieldAnimations.tspid)
   
   this.isDelayStoppable = true;
  
  this.isWin = false;
  this.hasWon = false;
  
  this.isDead = false;
  this.isDying = false;
  this.isFinishAble = false;
  
  //this.rectanim.play("spell5")
  this.resetAnimations();
  this.resetUFA();
  
  this.block.insane.reset();
  this.blob.insane.reset();
  
  this.isLosePlayed = false;
  
  this.insaneBg.moveEye(this.fieldSize.w / 2, this.fieldSize.vh / 2);
  
  this.isGarbageBehindActive = false;
  this.rpgAttr.hpDamage = 0;
  
  
  this.score = 0;
  this.addScoreText = "";
  
  
  // this.flagNames.length = 0;
  
  for (let a in this.flagPresses) {
   this.flagPresses[a] = false;
   this.lastFlagPresses[a] = false;
   
   // this.flagNames.push(a);
  }
  
  for (let a in this.stats) {
   this.stats[a] = 0;
  }
  
  /*this.controlsBitwise.bit = 0;
  this.controlsBitwise.lastBit = this.controlsBitwise.bit*/
  
  this.playerTarget.length = 0;
  
  this.character.activeVoiceline = "";
  
  this.dividedBlobScoreGarbage = 0;
  this.blobGarbage = 0;
  
  this.garbage.length = 0;
  this.garbageBehind.length = 0;
  
  this.inputBuffer = 1;
  
  this.pressStr = 0;
  this.lastPressStr = null;
  this.delayedGarbage = 0;
  this.garbageLength = this.calculateGarbage();
  this.garbageBehindLength = this.calculateGarbageBehind();
  
  this.garbageBehindLastForTray.assign(this.garbageBehindLength);
  
  this.garbageLastForTray.assign(this.garbageLength);
  
  for (let a = 0; a < this.delayKeynamesCount; a++) {
   this.delay[a] = -9;
   //if (this.delay[a] == 0) this.delay[a] = -20;
  }
  
  this.emAnimationSetting.on = false;
  this.engageCleartext("b2b", false, "");
  this.engageCleartextCombo(false, 0, "");
 }
 
 addGarbage(player, arr, wait, allMess, del, hpdmg) {
  //if (this.)
  let mm = false;
  
  for (let l = 0, os = arr.length; l < os; l++) {
   let n = ~~(this.seeds.field.next() * this.block.fieldSize.w);
   let i = arr[l];
   let n2 = n;
   mm = true;
   while (true) {
    let rand = this.seeds.field.next();
    let limit = 0;
    if (allMess) {
     while (limit < i) {
      if (rand < this.messiness) {
       while (n == n2) n = ~~(this.seeds.field.next() * this.fieldSize.w);
       n2 = n;
       break;
      }
      /*if (allMess) {
       n2 = ~~(this.seeds.field.next() * this.fieldSize.w);
       break;
      }*/
      limit++;
     }
    } else limit = i;
    mm = true;
    
    this.garbage.push({
     id: btoa(Math.random() * Math.random()),
     wait: wait,
     row: n2,
     frames: this.garbageDelay + this.inputFrames + (del || 0),
     player: player,
     count: limit,
     allmess: allMess,
     hpdmg: (hpdmg) * (100 / (100 + (this.rpgAttr.attributes.defense + this.rpgAttr.statusEffectsAttributes.defense)))
    });
    i -= limit;
    if (i == 0) break;
   }
  }
  if (mm) {
   this.garbageLength = this.calculateGarbage();
   this.rpgAttr.hpDamage = this.calculateHPDamage();
  }
  
 }
 
 addGarbageBehind(player, arr, wait, allMess, del, hpdmg, isDirect) {
  let mm = false;
  
  for (let l = 0, os = arr.length; l < os; l++) {
   let n = ~~(this.seeds.field.next() * this.block.fieldSize.w);
   let i = arr[l];
   let n2 = n;
   mm = true;
   while (true) {
    if (i <= 0) break;
    let rand = this.seeds.field.next();
    let limit = 0;
    if (allMess) {
     while (limit < i) {
      if (rand < this.messiness) {
       while (n == n2) n = ~~(this.seeds.field.next() * this.fieldSize.w);
       n2 = n;
       break;
      }
      /*if (allMess) {
       n2 = ~~(this.seeds.field.next() * this.fieldSize.w);
       break;
      }*/
      limit++;
     }
    } else limit = i;
    mm = true;
    
    
    this.garbageBehind.push({
     id: btoa(Math.random() * Math.random()),
     wait: wait,
     row: n2,
     frames: this.garbageDelay + this.inputFrames + (del || 0),
     player: player,
     count: limit,
     allmess: allMess,
     hpdmg: (hpdmg) * (!isDirect ? (150 / (150 + (this.rpgAttr.attributes.defense + this.rpgAttr.statusEffectsAttributes.defense))) : 1)
    });
    i -= limit;
   }
  }
  if (mm) {
   this.garbageBehindLength = this.calculateGarbageBehind();
   this.rpgAttr.hpDamage = this.calculateHPDamage();
  }
  
 }
 
 calculateGarbage() {
  let count = 0;
  for (let h = 0; h < this.garbage.length; h++) {
   count += ~~this.garbage[h].count;
  }
  return count;
 }
 
 calculateGarbageBehind() {
  let count = 0;
  for (let h = 0; h < this.garbageBehind.length; h++) {
   count += ~~this.garbageBehind[h].count;
  }
  return count;
 }
 
 calculateHPDamage() {
  let count = 0;
  for (let h = 0; h < this.garbage.length; h++) {
   count += ~~(this.garbage[h].hpdmg * this.garbage[h].count);
  }
  
  for (let h = 0; h < this.garbageBehind.length; h++) {
   count += (~~this.garbageBehind[h].hpdmg * this.garbageBehind[h].count);
  }
  return count;
 }
 
 switchGarbageBehind(truefalse) {
  this.isGarbageBehindActive = truefalse;
  if (truefalse) {
   this.garbageBehind.push(...this.garbage);
   this.garbage.length = 0;
   this.garbageLength = this.calculateGarbage();
   this.garbageBehindLength = this.calculateGarbageBehind();
   this.garbageLastForTray.assign(this.garbageLength);
   this.garbageBehindLastForTray.assign(this.garbageBehindLength);
   this.rpgAttr.hpDamage = this.calculateHPDamage();
  } else {
   
   this.garbage.push(...this.garbageBehind);
   this.garbageLength = this.calculateGarbage();
   this.garbageBehind.length = 0;
   this.garbageBehindLength = this.calculateGarbageBehind();
   this.garbageLastForTray.assign(this.garbageLength);
   this.garbageBehindLastForTray.assign(this.garbageBehindLength);
   
   this.rpgAttr.hpDamage = this.calculateHPDamage();
  }
 }
 callibrateCenter() {
  let origin = this.assetRect("OVERLAY-LAYER");
  let originX = origin.x + (origin.width / 2);
  let originY = origin.y + (origin.height / 2);
  
  this.playerCenterPos.x = originX;
  this.playerCenterPos.y = originY;
 }
 
 controlsListen(canControl) {
  //let input = this.pressStr[i];
  if (this.simulPresses.enabled || true) {
   for (let g in this.simulPresses.events) {
    this.simulPresses.events[g] = 0;
   }
   let input = this.pressStr;
   
   if (input !== this.lastPressStr) {
    this.lastPressStr = input;
    for (let gsb in game.bitFlags) {
     
     this.flagPresses[gsb] = input & game.bitFlags[gsb];
     
    }
   }
   if (canControl) {
   for (let gs = 0; gs < 3; gs++)
    if ((this.flagPresses[`s${gs+1}`] && !this.lastFlagPresses[`s${gs+1}`])) {
     this.rpgAttr.executeSkill(gs);
    }
   
   if ((this.flagPresses.hold && !this.lastFlagPresses.hold)) {
    if (this.block.isControl) this.block.hold();
   }
   
   if ((this.flagPresses.ccw && !this.lastFlagPresses.ccw)) {
    if (this.block.isControl) this.block.rotatePiece(-1);
    if (this.blob.isControl) this.blob.rotatePiece(-1);
   }
   
   if ((this.flagPresses.cw && !this.lastFlagPresses.cw)) {
    if (this.block.isControl) this.block.rotatePiece(1);
    if (this.blob.isControl) this.blob.rotatePiece(1);
   }
   
   if ((this.flagPresses.c180w && !this.lastFlagPresses.c180w)) {
    if (this.block.isControl) this.block.rotatePiece(2);
   }
   
   
   if ((this.flagPresses.left && !this.lastFlagPresses.left)) {
    if (this.block.isControl) this.block.moveX(-1);
    if (this.blob.isControl) this.blob.moveX(-1);
   }
   
   if ((this.flagPresses.right && !this.lastFlagPresses.right)) {
    if (this.block.isControl) this.block.moveX(1);
    if (this.blob.isControl) this.blob.moveX(1);
   }
   
   
   if ((this.flagPresses.softdrop && !this.lastFlagPresses.softdrop)) {
    if (this.block.isControl) this.block.softDrop();
    if (this.blob.isControl) this.blob.softDrop();
   }
   
   
   if ((this.flagPresses.harddrop && !this.lastFlagPresses.harddrop)) {
    if (this.block.isControl) this.block.hardDrop();
    if (this.blob.isControl) this.blob.hardDrop();
   }
   
   if (!this.flagPresses.left && !this.flagPresses.right) {
    if (this.block.isControl) {
     this.block.handling.arr = 0;
     this.block.handling.das = 0;
    }
    if (this.blob.isControl) {
     this.blob.handling.arr = 0;
     this.blob.handling.das = 0;
    }
   }
   }
  }
  /*else {
   for (let i = 0; i < this.pressStr.length; i++) {
    //if (!this.piece.enable) continue;
    //if (isNaN(Number(this.pressStr[i])))
    let input = this.pressStr[i];
    let isNumber = !isNaN(Number(input));
    if (isNumber) {
     let isLetter = isNaN(Number(this.pressStr[i + 1])) && ("Nn").indexOf(this.pressStr[i + 1]) !== -1;
     if (isLetter) {
      let hms = 0;
      if (this.pressStr[i + 1] == "N") {
       hms = 1;
      }
      switch (this.pressStr[i]) {
       case "1": {
        
        break;
       }
       case "2": {
        
        break;
       }
       case "3": {
        
        break;
       }
      }
      i++;
      continue;
     }
    }
    //this.controlsListen(this.pressStr[i]);
    
    switch (input) {
     case "A": {
      this.flagPresses.left = true;
      if (this.block.isControl) this.block.moveX(-1);
      if (this.blob.isControl) this.blob.moveX(-1);
      break;
     }
     case "a": {
      this.flagPresses.left = false;
      break;
     }
     case "B": {
      this.flagPresses.right = true;
      if (this.block.isControl) this.block.moveX(1);
      if (this.blob.isControl) this.blob.moveX(1);
      break;
     }
     case "b": {
      this.flagPresses.right = false;
      break;
     }
     case "C": {
      this.flagPresses.softdrop = true;
      if (this.block.isControl) this.block.softDrop();
      if (this.blob.isControl) this.blob.softDrop();
      break;
     }
     case "c": {
      this.flagPresses.softdrop = false;
      break;
     }
     case "D": {
      this.flagPresses.harddrop = true;
      if (this.block.isControl) this.block.hardDrop();
      if (this.blob.isControl) this.blob.hardDrop();
      break;
     }
     case "d": {
      this.flagPresses.harddrop = false;
      break;
     }
     
     case "E": {
      this.flagPresses.hold = true;
      if (this.block.isControl) this.block.hold();
      break;
     }
     case "e": {
      this.flagPresses.hold = false;
      break;
     }
     case "F": {
      this.flagPresses.ccw = true;
      if (this.block.isControl) this.block.rotatePiece(-1);
      if (this.blob.isControl) this.blob.rotatePiece(-1);
      break;
     }
     case "f": {
      this.flagPresses.ccw = false;
      break;
     }
     case "G": {
      this.flagPresses.cw = true;
      if (this.block.isControl) this.block.rotatePiece(1);
      if (this.blob.isControl) this.blob.rotatePiece(1);
      break;
     }
     case "g": {
      this.flagPresses.cw = false;
      break;
     }
     case "H": {
      this.flagPresses.c180w = true;
      if (this.block.isControl) this.block.rotatePiece(2);
      break;
     }
     case "h": {
      this.flagPresses.c180w = false;
      break;
     }
    }
    
    if (!this.flagPresses.left && !this.flagPresses.right) {
     if (this.block.isControl) {
      this.block.handling.arr = 0;
      this.block.handling.das = 0;
     }
     if (this.blob.isControl) {
      this.blob.handling.arr = 0;
      this.blob.handling.das = 0;
     }
    }
   }
  }*/
 }
 
 inputRun(isPause) {
  
  
  
  if (!game.replay.isOn) {
   
   if (this.ai.active) {
    let prss = 0;
    if (this.activeType == 0) {
    this.ai.run();
    prss = this.ai.pressStr;
    }
    if (this.activeType == 1) {
    this.aiBlob.run();
    prss = this.aiBlob.pressStr;
    }
    if (this.rpgAttr.isRPG) {
     this.aiRPG.run();
    // prss |= this.aiRPG.pressStr;
    }
    console.log(prss)
    this.pressStr = prss;
   }
  }
  
  if (game.replay.isOn) {
   if (this.inputFrames in game.replay.data.players[this.player].keyData) {
    this.pressStr = game.replay.data.players[this.player].keyData[this.inputFrames];
   }
  } else {
   if (this.pressStr !== this.lastPressStr) game.replay.data.players[this.player].keyData[this.inputFrames] = this.pressStr;
  }
  
  this.inputFrames++;
  
  
  
  this.controlsListen(!isPause);
  if (!isPause) {
  this.isDelayStoppable = true;
  this.block.canControl = this.blob.canControl = !this.checkHalt(1, 0);
  
  if (this.block.isControl) this.block.shiftDelay();
  if (this.blob.isControl) this.blob.shiftDelay();
  
  if (this.flagPresses.softdrop && this.lastFlagPresses.softdrop) {
   if (this.block.isControl) this.block.softDrop();
   if (this.blob.isControl) {
    this.blob.softDrop();
    if (!this.blob.piece.isAir) {
     this.blob.lock.lockSoftdrop--;
     this.blob.checkManipulatedPiece();
    }
   }
  } else if (this.blob.isEnable) {
   this.blob.lock.lockSoftdrop = 6;
   
  }
  
  if (this.block.isEnable) this.block.updatePiece();
  if (this.blob.isEnable) this.blob.updatePiece();
  }
  if (this.pressStr !== this.lastPressStr) this.lastPressStr = this.pressStr;
  
  for (let g in this.flagPresses) {
   if (this.flagPresses[g] !== this.lastFlagPresses[g]) this.lastFlagPresses[g] = this.flagPresses[g];
  }
 }
 
 drawPlayer() {
  if (this.block.isEnable) {
   let bl = this.block;
   bl.drawActivePiece();
   
   bl.effects.hardDrop.update();
   bl.effects.appearAnim.update();
   bl.effects.clearAnim.update();
   bl.checkWarning();
   
   if (bl.appearBlockFrame > -1) {
    bl.appearBlockFrame--;
    
    if (bl.appearBlockFrame == 0) {
     bl.drawStack(bl.stack);
    }
   }
   
   if (bl.pcSpam.frame >= 0) {
    bl.pcSpam.frame--;
    if (bl.pcSpam.frame == 0) {
     bl.pcSpam.count = 0;
    }
   }
   this.block.insane.draw();
  }
  if (this.blob.isEnable) {
   this.blob.drawActive();
   this.blob.previewDrawUpdate();
   this.blob.insane.draw();
  }
  
  
  if (this.woiWormhole.enable) this.woiWormhole.draw();
  this.feverStat.draw();
  
  this.continuousUpdate();
 }
 
 continuousUpdate() {
  if (this.block.isEnable) this.block.updateContinuousDelay();
   if (this.blob.isEnable) this.blob.updateContinuousDelay();
 }
 
 playerUpdate() {
  //this.pressStr = "";
  if (!this.checkHalt(0, 1)) {
   if (this.block.isEnable) this.block.updateDelay();
   if (this.blob.isEnable) this.blob.updateDelay();
  }
  
  
  for (let j = 0; j < this.halt.names.length; j++) {
   let ref = this.halt.names[j]
   //let ref = this.halt.delays[j];
   if (this.halt.delays[ref] > 0) this.halt.delays[ref]--;
  }
  
  
  this.meterBar.right.assign(this.activeType == 1 ? 1 : (((this.block.fieldSize.vh + this.block.visibleFieldHeight) - this.garbageLength) / (this.block.fieldSize.vh + this.block.visibleFieldHeight)));
  {
   let garbageWait = 0;
   for (let qq = 0, leng = this.block.garbageWait.length; qq < leng; qq++) garbageWait += this.block.garbageWait[qq].blob;
   this.meterBar.garbwait.assign([
    ((this.fieldSize.vh + this.visibleFieldHeight) - Math.max(0, Math.min(garbageWait, this.fieldSize.vh))) / (this.fieldSize.vh + this.visibleFieldHeight),
    ((this.fieldSize.vh + this.visibleFieldHeight) - Math.max(0, Math.min((garbageWait - (this.fieldSize.vh)), this.fieldSize.vh))) / (this.fieldSize.vh + this.visibleFieldHeight),
    ((this.fieldSize.vh + this.visibleFieldHeight) - Math.max(0, Math.min((garbageWait - (this.fieldSize.vh * 2)), this.fieldSize.vh))) / (this.fieldSize.vh + this.visibleFieldHeight),
    
   ]);
  }
  if (this.block.isEnable) {
   this.clearText.tspin.run();
  }
  for (let m of ["b2b"]) {
   this.clearTextRenderers[m].run();
  }
  if (this.blob.delay[2] > 0 && this.blob.actualChain > 0) {
   this.scoreText.assign(this.addScoreText);
  }
  else {
   let scr = "",
    lsc = Math.min(99999999, this.score);
   for (let qu = 0; qu < 8; qu++) {
    if (qu == 7 && lsc === 0) break;
    if (10 ** qu > lsc) scr += "0";
   }
   scr += lsc;
   this.scoreText.assign(scr);
  }
  //this.scoreText.assign(Object.values(this.blob.delay));
  if (this.block.isEnable) this.block.insane.update();
  if (this.blob.isEnable) this.blob.insane.update();
  
  
  this.warningTrig.assign(
   (!this.isWin && ((this.block.isEnable && this.block.isWarning && !this.block.isAux) ||
    (this.blob.isEnable && this.blob.isWarning && !this.blob.isAux))) ? 1 : 0);
  this.rectanim.run();
  this.rpgAttr.update();
  this.swapMode.run();
  this.feverStat.run();
  
  this.runDelay();
  
  //if (this.activeType === 1) this.garbageLastForTray.assign(this.garbageLength);
 }
 
}

//fileLayer: loading_screen
const loadingScreen = new class {
	constructor() {
		this.element = id("GTRIS-LOAD-SCREEN");
		this.canvas = id("LOAD-TRIVIA-CANVAS");
		this.ctx = getCanvasCtx(this.canvas);
		this.canvas.width = 1280;
		this.canvas.height = 720;
		this.width = 1280;
		this.height = 720;
		this.images = {};

		this.frame = {
			closing: -9,
			opening: -9
		};
		this.drawnGapWidth = 1;
		this.on = false;
		this.isOpenable = false; //false to continue opening, true to keep the gate closed
		//this
	}

	run() {
		if (!this.on) return;
		
		if (this.frame.closing > 0) {
			this.frame.closing--;
			this.drawnGapWidth = (20 - this.frame.closing) / 20;

		} else if (this.frame.opening >= 0 && this.isOpenable) {
			this.frame.opening--;
			this.drawnGapWidth = (this.frame.opening) / 20;
			if (this.frame.opening == 0) {
				this.on = false;
				styleelem(this.element, "display", "none");
			}
		}

		//this.drawnGapWidth = (Math max(60, this.frame.closing - this.frame.opening, 0)) / 60
		this.draw();
	}

	draw() {
		this.ctx.clearRect(0,0,this.width, this.height);
		let lm = bezier1D(this.drawnGapWidth, 0, 1, 0,1);
		this.ctx.drawImage(this.images.gate1,
			0, 0, this.width, this.height,
			(lm - 1) * this.width,
			0,
			this.width, this.height
		);
		this.ctx.drawImage(this.images.gate2,
			0, 0, this.width, this.height,
			(1 - lm) * this.width,
			0,
			this.width, this.height
		);
	}

	toggleOn() {
		this.on = true;
		this.frame.opening = 20;
		this.frame.closing = 20;
		
		styleelem(this.element, "display", "flex");
	}
}();

//fileLayer: game
const manager = new class {
	#DelayHandler = class {
		constructor(delay, func) {
			this.func = func;
			this.delay = delay;
			this.id = btoa(Math.random() * 2147483647);
		}
		run() {
			this.delay--;
			if (this.delay == 0) this.func();
		}
	};
	#customLoops = new ObjectFunctionIterator((obj) => {
		for (let ob in obj) {
			obj[ob]();
		}
	});
	constructor() {
		this.FPS = 60;
		
		this.flagNames = [
			"left",
			"right",
			"softdrop",
			"harddrop",
			
			"hold",
			"ccw",
			"cw",
			"c180w",
			"s1",
			"s2",
			"s3"
		];
		this.bitFlags = {};
		for (let h = 0; h < this.flagNames.length; h++) {
			this.bitFlags[this.flagNames[h]] = bitwiseSL(h + 1);
		}
		
		
		this.synchroLoop = new RAFLoopHandler(this.FPS, () => {
			this.frameLoop();
		})
		
		this.presets = {
			block: {},
			blobNormal: {},
			blobMicro: {}
		}
		
		this.resQualityMult = 2;
		
		this.isRunning = false;
		
		this.pause = {
			on: true,
			frame: 0
		};
		
		this.matchEndHandler = {
			frame: -9,
			on: false,
			endable: false,
			isFinishActual: false,
			hasEnded: false
		};
		
		this.lastPressStr = "";
		
		this.fontSize = 1;
		
		this.ratio = {
			width: 16,
			height: 9
		};
		
		this.coreElement = id("CORE");
		
		this.loopParams = { isInsane: 0, zerohp: 0 };
		
		
		Object.freeze(this.FPS);
		this.frames = 0;
		this.countdown = 120;
		this.waitCountdown = 50;
		this.isFreezeHandlers = false;
		this.assetHTML = "";
		this.assetStyle = "";
		this.resolution = {
			w: 1280,
			h: 720
		};
		this.aspectResolution = {
			w: 1280,
			h: 720
		};
		this.portrait = {
			x: 720,
			y: 1289
		}
		this.landscape = {
			x: 720,
			y: 1289
		};
		this.aspectRatio = 16 / 9;
		this.orientation = null;
		this.cellSize = null;
		this.playerAreaSizeMult = 0.36; //0.56;
		
		this.activePlayer = 0;
		this.playerCount = null;
		this.players = {};
		
		this.isSolo = false;
		
		this.skinTemp = {
			canvas: void 0,
			ctx: void 0,
		};
		
		this.skin = {
			canvas: void 0,
			ctx: void 0,
		};
		
		this.skinBlob = {
			canvas: void 0,
			ctx: void 0,
		};
		
		this.skinBlobTemp = {
			canvas: void 0,
			ctx: void 0,
		};
		
		this.skinGarbTemp = {
			canvas: void 0,
			ctx: void 0,
		};
		
		this.skinParticle = {
			canvas: void 0,
			ctx: void 0,
		};
		
		this.skinParticleTemp = {
			canvas: void 0,
			ctx: void 0,
		};
		
		this.skinGarb = {
			canvas: void 0,
			ctx: void 0,
		};
		
		this.skinAppear = {
			canvas: new OffscreenCanvas(70 * 10, 70 * 4),
			ctx: void 0,
		};
		this.skinAppear.ctx = this.skinAppear.canvas.getContext("2d");
		
		this.skinClear = {
			canvas: new OffscreenCanvas(70 * 10, 70 * 6),
			ctx: void 0,
		};
		this.skinClear.ctx = this.skinClear.canvas.getContext("2d");
		
		
		this.loadCanvas = {
			canvas: void 0,
			ctx: void 0,
		};
		
		this.loadCanvas.canvas = id("LOAD-TRIVIA-CANVAS");
		this.loadCanvas.ctx = this.loadCanvas.canvas.getContext("2d");
		
		this.loadDiv = {
			main: id("GTRIS-LOAD-SCREEN"),
		};
		
		this.seeds = {
			round: new ParkMillerPRNG(),
			main: new ParkMillerPRNG(),
		};
		
		elem("CANVAS", canvas => {
			canvas.width = 250 * 16;
			canvas.height = 250 * 16;
			this.skinBlob.canvas = canvas;
			let ctx = canvas.getContext("2d");
			this.skinBlob.ctx = ctx;
		});
		
		elem("CANVAS", canvas => {
			canvas.width = 250 * 16;
			canvas.height = 250 * 16;
			this.skinBlobTemp.canvas = canvas;
			let ctx = canvas.getContext("2d");
			this.skinBlobTemp.ctx = ctx;
		});
		
		
		elem("CANVAS", canvas => {
			canvas.width = 130 * 4;
			canvas.height = 130 * 12;
			this.skin.canvas = canvas;
			let ctx = canvas.getContext("2d");
			this.skin.ctx = ctx;
		});
		
		
		elem("CANVAS", canvas => {
			canvas.width = 130 * 4;
			canvas.height = 130 * 12;
			this.skinTemp.canvas = canvas;
			let ctx = canvas.getContext("2d");
			this.skinTemp.ctx = ctx;
		});
		
		elem("CANVAS", canvas => {
			canvas.width = 1100;
			canvas.height = 100;
			this.skinParticle.canvas = canvas;
			let ctx = canvas.getContext("2d");
			this.skinParticle.ctx = ctx;
		});
		
		elem("CANVAS", canvas => {
			canvas.width = 1100;
			canvas.height = 100;
			this.skinParticleTemp.canvas = canvas;
			let ctx = canvas.getContext("2d");
			this.skinParticleTemp.ctx = ctx;
		});
		
		elem("CANVAS", canvas => {
			canvas.width = 130 * 6;
			canvas.height = 130 * 4;
			this.skinGarb.canvas = canvas;
			let ctx = canvas.getContext("2d");
			this.skinGarb.ctx = ctx;
		});
		
		elem("CANVAS", canvas => {
			canvas.width = 1600;
			canvas.height = 400;
			this.skinGarbTemp.canvas = canvas;
			let ctx = canvas.getContext("2d");
			this.skinGarbTemp.ctx = ctx;
		});
		
		this.henshinBg = {};
		this.feverBg = {};
		
		this.wormholeBg = {};
		
		this.insaneEye = {
			canvas: new OffscreenCanvas(200, 200),
			ctx: void 0
		};
		this.insaneEye.ctx = this.insaneEye.canvas.getContext("2d");
		
		this.pressStr = "";
		
		this.isRoundNext = false;
		
		this.isRoundActive = false;
		this.roundNextTime = -20;
		
		this.pressFlagInput = {
			
		};
		
		this.misc = {};
		
		//this.inGameParameters.mode = null;
		let earlyStart = 30;
		this.matchSignal = {
			html: {
				ready: id("OVERLAY-MS-READY"),
				start: id("OVERLAY-MS-START"),
			},
			separator: {
				ready: new TextToHTMLLetterSeparator(),
				/*start: new TextToHTMLLetterSeparator(),*/
			},
			main: new FrameRenderer(0, 210 - earlyStart, (frame, max) => {
				if (frame <= 150 - earlyStart) {
					let array = this.matchSignal.separator.ready.a;
					let length = array.length;
					//let mframe = frame - Math.min(0, Math.max(frame - 30, 10));
					
					if (frame < 140 - earlyStart) styleelem(this.matchSignal.html.ready, "animation-delay", `${~~((1000 / (-1 * 60)) * Math.max(0, frame - (30)))}ms`);
					if (frame == 30) sound.play("ready");
					//////console.log(~~((1000 / (-1 * 60)) * (91)), ~~((1000 / (-1 * 60)) * (frame)), frame)
					//////console.log(frame);
					for (let h = 0; h < length; h++) {
						let o = frame;
						if (frame === 150 - earlyStart) {
							o = -1;
							styleelem(array[h], "opacity", "0%");
						}
						styleelem(array[h], "animation-delay", `${~~((1000 / (-1 * 60)) * Math.max(0, o))}ms`);
					}
				}
				if (frame <= (210 - earlyStart) && frame > (89 - earlyStart)) {
					let o = frame - (150 - earlyStart);
					
					if (o == 7) sound.play("start");
					styleelem(this.matchSignal.html.start, "animation-delay", `${~~((1000 / (-1 * 60)) * Math.max(0, o))}ms`);
					//////console.log(~~((1000 / (-1 * 60)) * (91)), ~~((1000 / (-1 * 60)) * (frame)), frame)
					//////console.log(frame);
					
				}
			}),
			
		};
		
		this.replay = {
			data: {},
			isOn: false,
			isFile: false,
			replays: [],
			replaysIndex: 0
		};
		
		this.animations = {
			fadein: new AnimationFrameRenderer(id("GTRIS-OVERLAY"), 0, 14, 1000 / 60, {
				name: "blackfade-in",
				timing: "linear",
			}),
			fadeout: new AnimationFrameRenderer(id("GTRIS-OVERLAY"), 0, 14, 1000 / 60, {
				name: "blackfade-out",
				timing: "linear",
			}),
			mswhready: new AnimationFrameRenderer(this.matchSignal.html.start, 0, 180, 1000 / 60, {
				name: "matchsignal-wormhole-ready",
				timing: "linear",
			}),
			mswhstart: new AnimationFrameRenderer(this.matchSignal.html.start, 0, 180, 1000 / 60, {
				name: "matchsignal-wormhole-start",
				timing: "linear",
			}),
			
		};
		
		this.animationNames = Object.keys(this.animations);
		
		this.delayHandlers = [];
		this.continuousDelayHandlers = [];
		
		
		
		this.isGameLoaded = true;
		
		this.isPlayerJsonLoaded = true;
		
		this.targetPointSystem = {
			initial: 70,
			previous: 70,
			iteration: 0,
			iterIncDel: 16 * this.FPS,
			marginTime: 1 * this.FPS,
			targetPoint: 90,
			on: false,
			prep: {
				marginTime: 1 * this.FPS,
				initial: 70,
			}
			
		}
		
		this.numberExecHandlers = {
			insaneMFX: new NumberChangeFuncExec(-1, (am) => {
				//music.stopAll();
				background.setFGColor(0, 0, 0, 0);
				if (am == 1) {
					music.play("insane", true);
					background.setFGColor(0, 0, 0, 0.5);
				}
				if (am == 6) {
					music.play("insane_phylum", true);
					background.setFGColor(0, 0, 0, 0.5);
				}
				if (am == 7) {
					music.play("wmw_eval_phylum", true);
				}
				if (am == 8) {
					music.play("insane_phylum_continuation", true);
					background.setFGColor(0, 0, 0, 0.5);
				}
				if (am == 3) {
					music.play("wmw_eval");
					
				} //else music.stopAll();
				if (am == 2) {
					music.play("insane_transform");
				}
				if (am == 4) {
					music.play("warning");
				}
				if (am == 5) {
					music.play("game_match", true);
				}
				if (am == 0) {
					music.stopAll();
				}
			}),
			wormholeLoop: new NumberChangeFuncExec(-1, (am) => {
				//music.stopAll();
				if (am == 1) {
					sound.play("wormhole_loop");
					
				}
				if (am == 0) {
					sound.stop("wormhole_loop");
					
				} //else music.stopAll();
				
			}),
			zerohp: new NumberChangeFuncExec(-1, (am) => {
				//music.stopAll();
				if (am >= 1) {
					sound.play("rpg_zerohp");
					
				} else
				{
					sound.stop("rpg_zerohp");
					
				} //else music.stopAll();
				
			}),
		}
		
		this.isFinish = false;
		
		
		this.swapMode = {
			on: false,
			pickDel: 120,
			blockOrBlob: 0,
			time: 0,
			decidedBlockOrBlob: 0,
			maxTime: 30 * this.FPS,
			swapDel: -90
		}
		
		this.woiMode = {
			isEvaluation: false,
			shoot: 0,
			time: 0,
			restart: -9,
			timeDelay: -9,
			maxTime: 80 * this.FPS,
			rounds: 0,
			
			loopRate: -1,
		}
		
		this.timer = new FunctionTimer(this, (q, p) => {
			switch (this.inGameParameters.mode) {
				case 3: {
					this.timerDisplay.display(q);
					//////console.log(q);
					if (q <= 0) this.forEachPlayer(player => {
						player.block.insane.isCommandedEnd = true;
						player.blob.insane.isCommandedEnd = true;
					});
					
					if (q <= 10 * this.FPS && q >= 0) {
						if ((q % this.FPS) == 0 && q > 0) {
							if (q >= 4 * this.FPS) sound.play("timer2_1");
							else if (q <= 3 * this.FPS) sound.play("timer2_2");
						}
						if (q == 0) {
							sound.play("timer_zero");
						}
					}
					break;
				}
			}
		});
		
		this.timerDisplay = new class {
			constructor(w) {
				this.parent = w;
				this.timer = id("OVERLAY-TIMER-TEXT");
				this.container = id("OVERLAY-TIMER-DIV");
				this.isActive = false;
			}
			showHide(toggle) {
				this.isActive = toggle;
				styleelem(this.container, "display", this.isActive ? "flex" : "none")
			}
			
			display(frame) {
				let seconds = Math.ceil((frame / game.FPS));
				let minutes = ~~(seconds / 60);
				
				ihelem(this.timer, `${minutes}:${~~(seconds/10) % 6}${seconds%10}`);
			}
			
		}(this);
		
		this.timerDisplay.showHide(false);
		
		this.actualParameters = {
			mode: 0,
			active: 0,
			players: [],
			data: {
				
			},
			maxWins: 5
		};
		
		this.inGameParameters = {
			mode: null,
			active: 0,
			players: {},
			playerOrder: [],
			data: {},
			isRPG: false,
			round: 0,
			maxWins: 5
		};
		
		this.round = 0;
		
		this.startGameParameters = {
			frame: -28,
			type: "",
		};
		
		this.enableWarning = false;
		
		this.voiceVolume = 1;
		
		this.isEverybodyPlay = false;
		
		this.isPhylum = false;
		
		this.winnerDeclaration = {
			frames: -1,
			winners: [],
			losers: []
		};
		
		this.inputFrames = 0;
		
		this.bufferFrames = 0;
		
		this.online = {
			isOn: false,
			frames: {},
			isPrepared: false,
			timeoutFrame: 12000
		};
		
	}
	
	addLoop(id, func) {
		if (typeof this.#customLoops.getItem(id) === "object") {
			throw "a loop with this id \"" + id + "\" already exists! Yhrowing an error..."
		}
		this.#customLoops.addItem(id, func);
	}
	
	removeLoop(id) {
		if (!this.#customLoops.getItem(id) === "undefined") {
			throw "a loop with this id \"" + id + "\" already exists! Yhrowing an error..."
		}
		this.#customLoops.remove(id);
	}
	
	getLoop(id) {
		return this.#customLoops.getItem(id);
	}
	
	setupPlayers() {
		
	}
	
	createPlayerParam(name, team, char, ver, mode, isAi, rpg, params) {
		let a = {
			character: char,
			team: team || 0,
			version: ver,
			name: name,
			isAi: isAi,
			mode: mode,
			other: params,
			rpg: rpg
		};
		return a;
	}
	
	setupAnimationElement(e, opacity, name, duration, timing) {
		styleelem(e, "opacity", opacity);
		styleelem(e, "animation-name", name);
		styleelem(e, "animation-duration", `${~~((1000 / 60) * (duration))}ms`);
		styleelem(e, "animation-timing-function", timing);
		styleelem(e, "animation-play-state", "paused");
	}
	
	resetReadyMatchSignal(state) {
		
		let element = "OVERLAY-MS-READY";
		let f = id(element);
		let l = id("OVERLAY-MS-START");
		for (let e of this.matchSignal.separator.ready.a) {
			styleelem(e, "animation", "none");
			e.offsetHeight;
		}
		
		styleelem(f, "animation", "none");
		
		f.offsetHeight;
		styleelem(f, "animation-play-state", "paused");
		
		styleelem(l, "animation", "none");
		
		l.offsetHeight;
		styleelem(l, "animation-play-state", "paused");
		
		if (state == 1) {
			/*styleelem(f, "opacity", "100%");
			styleelem(f, "animation-name", "matchSignal-body-anim-spacing");
			styleelem(f, "animation-duration", `${~~((1000 / 60) * (91))}ms`);
			styleelem(f, "animation-timing-function", "cubic-bezier(0,1,1,1)");*/
			this.setupAnimationElement(f, "100%", "matchsignal-body-anim-spacing", 90, "cubic-bezier(0,1,0,1)")
			for (let o = 0, q = this.matchSignal.separator.ready.a, e = q[o]; o < q.length; o++, e = q[o]) {
				if (o == 0) {
					this.setupAnimationElement(e, "100%", "matchsignal-let-anim-first", 150 - 30, "linear");
					styleelem(e, "font-family", "copd-bold");
				}
				else this.setupAnimationElement(e, "100%", "matchsignal-let-anim", 150 - 30, "linear");
				
			}
			this.setupAnimationElement(l, "0%", "matchsignal-body-anim-start", 50, "linear")
			
			
			this.matchSignal.main.reset(0);
		} else if (state == 2) {
			styleelem(f, "opacity", "0%");
			styleelem(l, "opacity", "0%");
			this.matchSignal.main.toggleEnable(false);
		} else if (state == 0) {
			this.matchSignal.main.toggleEnable(false);
			styleelem(f, "opacity", "0%");
			styleelem(l, "opacity", "0%");
			
		}
	}
	
	addDelayHandler(delay, func, isContinuous) {
		let a = this.delayHandlers;
		if (isContinuous) a = this.continuousDelayHandlers;
		
		a.push(new this.#DelayHandler(delay, func));
		
	}
	
	runDelayHandler(isContinuous) {
		let a = this.delayHandlers;
		if (isContinuous) a = this.continuousDelayHandlers;
		let b = a.length;
		//let c = 0;
		
		for (let c = 0; c < b; c++) {
			a[c].delay--;
			if (a[c].delay == 0) {
				a[c].func();
				a.splice(c, 1);
				b--;
				c--;
				//////console.log(JSON.stringify(a))
			}
		}
	}
	
	#fetchLoaded = {};
	
	#fetchLoad(directory, type) {
		return this.#fetchLoaded[directory];
	}
	
	initGame() {
		//await language.loadLanguage("assets/lang/en_us/main.json");
		
		splash.showHide(true, __main_params__.appinfo.android);
		alertWindow.showhide(false);
		
		if (__main_params__.appinfo.android) {
			__main_params__.accessible.callSyncJava(k => {
				k.switchLanguage(menu.storage.getItem("lang", ""));
			});
			/*__main_params__.accessible.callAsyncJava("callback_promise", (l, k) => {
				k.getData(l, "user_data");
			}).then(() => {
				this.loadAssets();
			});*/
			
			__main_params__.database.read("local_data", "userdata", async (ev) => {
				if (typeof ev !== "undefined") {
					////console.log(ev)
					menu.storage.loadUserData(ev.value);
					menu.storage.loadData(ev.value);
				}
				this.loadAssets();
				
			});
			
			
		} else __main_params__.database.read("local_data", "userdata", async (ev) => {
			if (typeof ev !== "undefined") {
				////console.log(ev)
				menu.storage.loadUserData(ev.value);
				menu.storage.loadData(ev.value);
			}
			
			let version = menu.storage.getItem("version");
			let newVersion = __main_params__.appinfo.version;
			if (version != newVersion) {
				menu.storage.setItem("version", newVersion);
				menu.storage.setItem("patchnote_is_seen", 0);
				menu.storage.save();
			}
			
			
			this.loadAssets();
			
		});
		this.synchroLoop.confirmIsAsync = true;
		this.synchroLoop.start();
		
		menu.storage.initialize();
	}
	
	endGame(isForce) {
		if (this.replay.isOn) {
			touchButtons.enableControllers(true);
		} else {
			this.replay.replays.push(JSON.stringify(this.replay.data));
			menu.replayDataString = this.replayDataToString();
		}
		this.isRunning = false;
		this.synchroLoop.confirmIsAsync = true;
		this.isRoundActive = false;
		this.matchEndHandler.hasEnded = true;
		this.isFinish = true;
		if (isForce) {
			this.pause.on = true;
		}
		this.loopParams.isInsane = 0;
		this.loopParams.zerohp = 0;
		this.pause.on = true;
		this.online.isOn = false;
		this.showEndGameMenu();
	}
	
	showEndGameMenu() {
		let selectors = [];
		
		if (this.replay.isOn) {
			let md = [
					
					
					
				];
				if (!online.isOnline) {
					md.push({
						string: "gameend_watchreplay",
						type: "button",
						action: "replayreload",
						onstate: "#ffff",
						offstate: "#fff2",
						desc: "gameend_watchreplay_desc"
					
					});
					md.push({
	string: "gameend_replaycenter",
	type: "button",
	action: "replaycenter",
	onstate: "#ffff",
	offstate: "#fff2",
	backable: true,
	desc: "gameend_replaycenter_desc"
})
				}
				if (!this.replay.isFile && !online.isOnline) {
					
					md.push({
						string: "gameend_startover",
						type: "button",
						action: "restart",
						onstate: "#ffff",
						offstate: "#fff2",
						desc: "gameend_startover_desc"
					});
					
				}
				
			for (let lo of md) selectors.push(lo);
			if (!this.replay.isFile) {
				selectors.push({
					string: "gameend_downloadreplay",
					type: "button",
					action: "replaydownload",
					onstate: "#ffff",
					offstate: "#fff2",
					desc: "gameend_downloadreplay_desc"
				});
			}
		} else {
			if (!this.replay.isFile && !online.isOnline) selectors.push({
				
				string: "gameend_startover",
				type: "button",
				action: "restart",
				onstate: "#ffff",
				offstate: "#fff2",
				desc: "gameend_startover_desc"
				
			});
			
			let zn = [];
			
			if (!online.isOnline) 
			zn.push({
						string: "gameend_replaycenter",
						type: "button",
						action: "replaycenter",
						onstate: "#ffff",
						offstate: "#fff2",
						backable: true,
						desc: "gameend_replaycenter_desc"
					})
			for (let lo of zn) selectors.push(lo);
			if (!this.replay.isFile) {
				selectors.push({
					string: "gameend_replay_download",
					type: "button",
					action: "replaydownload",
					onstate: "#ffff",
					offstate: "#fff2",
					desc: "gameend_replay_download_desc"
				});
			}
		}
		
		if (!online.isOnline) selectors.push({
			string: "gameend_mainmenu",
			type: "button",
			action: "mainmenu",
			onstate: "#ffff",
			offstate: "#fff2",
			
			desc: "gameend_mainmenu_desc"
		});
		else selectors.push({
			string: "gameend_online_mainmenu",
			type: "button",
			action: "online_menu",
			onstate: "#ffff",
			offstate: "#fff2",
			
			desc: "gameend_online_mainmenu_desc"
		});
		
		let gson = {
			def: 0,
			sel: selectors,
			title: (this.replay.isOn ? "gameend_replay_title" : "gameend_title"),
			name: "main",
			"background": {
				"type": "rgba",
				"color": "#0004"
			}
		};
		menu.changeMenu(JSON.stringify(gson), false);
		menu.showMenu(true);
		
	}
	
	async loadAssets() {
		try {
			//////console.log(this)
			menu.characterMenu.setupAnims();
			//IS_LOAD_LISTER = true;
			
			
			await language.load("en-US");
			
			let h = await load("./assets/init/init.json", "text");
			let hh = JSON.parse(h);
			let count = 0;
			let evt = (max, path) => {
				count++;
				let p = language.translate("loading_init", [path]);
				if (count == max) p = language.translate("loading_init_other");
				ih("SPLASH-TEXT-TEXT", `<gtris-plextext style="width:100%">${language.translate("loading_note")}<br />${p}</gtris-plextext><gtris-bar style="width: ${this.aspectResolution.w}px; background: #fff2; height: 1em; display: inline-block; bottom: 0"> <gtris-bar style="width: ${~~(this.aspectResolution.w * (count / max))}px; background: #fff; height: 1em; display: inline-block"> ${~~(100 * (count / max))}%</gtris-bar> </gtris-bar>`);
				this.checkGameLoad(count, max);
			};
			let files = Object.keys(hh);
			let fmax = files.length;
			
			for (let ge = 0; ge < fmax; ge++) {
				let g = hh[files[ge]];
				////console.log(g)
				if (g.type == "image") {
					loadImage(g.path).then(img => {
						this.#fetchLoaded[g.path] = img;
						evt(fmax, g.path);
					});
					
				} else {
					load(g.path, g.type).then(o => {
						this.#fetchLoaded[g.path] = o;
						evt(fmax, g.path);
					});
					
				}
				//////console.log((100 * (count / hh.length)).toFixed(2));
				
			}
		} catch (e) {
			////console.log(e.stack)
		}
		
	}
	
	async checkGameLoad(count, max) {
		if (count >= max) {
			
			menu.presetSettings = JSON.parse(this.#fetchLoad("./assets/settings/settings.json"));
			menu.checkStorageSettings();
			menu.checkData();
			
			this.assetHTML = this.#fetchLoad("./assets/field/main2.xml", "text");
			this.assetStyle = this.#fetchLoad("./assets/field/main2.css", "text");
			let bpres = this.#fetchLoad("./assets/field/blobs_preset.json", "text");
			let mbpres = this.#fetchLoad("./assets/field/microblob_preset.json", "text");
			let gpres = this.#fetchLoad("./assets/field/blocks_preset.json", "text");
			//let jpres = this.#fetchLoad("./assets/field/blocks_preset_javascriptus.json", "text");
			
			this.presets.blobNormal = JSON.parse(bpres);
			this.presets.blobMicro = JSON.parse(mbpres);
			this.presets.blockNormal = JSON.parse(gpres);
			//this.presets.blockJavaScriptus = JSON.parse(jpres);
			//////console.log(this.presets.blobNormal)
			this.misc.ai = this.#fetchLoad("./assets/ai_script/ai_sapphirus_core.js", "text");
			this.misc.ai_original = this.#fetchLoad("./assets/ai_script/ai_neoplex.js", "text");
			this.misc.ai_blob_original = this.#fetchLoad("./assets/ai_script/ai_neoplex_blob_core.js", "text");
			this.misc.ai_blob_functions = this.#fetchLoad("./assets/ai_script/ai_neoplex_blob_funcs.js", "text");
			this.misc.ai_blob_sapphirus = this.#fetchLoad("./assets/ai_script/ai_sapphirus_blob.js", "text");
			this.misc.blob_target = this.#fetchLoad("./assets/field/blob_target.png", "image");
			let tspinImg = this.#fetchLoad("./assets/field/tspin.png");
			//////console.log("tspin load")
			let tspinminiImg = this.#fetchLoad("./assets/field/mini.png");
			let henshinImg = this.#fetchLoad("./assets/field/henshin.png");
			let insaneEyeImg = this.#fetchLoad("./assets/field/insane_eye.png");
			let feverImg = this.#fetchLoad("./assets/field/fever.png");
			let frenzyImg = this.#fetchLoad("./assets/field/frenzy.png");
			let wormholeImg = this.#fetchLoad("./assets/field/wormhole.png");
			
			
			this.misc.menu_cs_border_black = this.#fetchLoad("./assets/menu/images/cs_border_black.png");
			this.misc.menu_cs_border_yellow = this.#fetchLoad("./assets/menu/images/cs_border_yellow.png");
			this.misc.menu_cs_border_green = this.#fetchLoad("./assets/menu/images/cs_border_green.png");
			this.misc.menu_cs_back = this.#fetchLoad("./assets/menu/images/cs_back.png");
			this.misc.menu_cs_removeplayer = this.#fetchLoad("./assets/menu/images/cs_removeplayer.png");
			this.misc.menu_cs_team = this.#fetchLoad("./assets/menu/images/cs_team.png");
			
			
			this.misc.menu_back_normal = this.#fetchLoad("./assets/menu/images/back_normal.png");
			this.misc.menu_back_hover = this.#fetchLoad("./assets/menu/images/back_hover.png");
			this.misc.menu_back_press = this.#fetchLoad("./assets/menu/images/back_press.png");
			
			
			this.misc.menu_cs_mode_pick = this.#fetchLoad("./assets/menu/images/cs_mode_pick.png");
			this.misc.menu_switch_on = this.#fetchLoad("./assets/menu/images/switch_on.png");
			this.misc.menu_switch_off = this.#fetchLoad("./assets/menu/images/switch_off.png");
			
			this.misc.block_next = this.#fetchLoad("./assets/field/block_next.png");
			this.misc.block_hold = this.#fetchLoad("./assets/field/block_hold.png");
			this.misc.block_nextqueue = this.#fetchLoad("./assets/field/block_nextqueue.png");
			
			this.misc.team_colors = this.#fetchLoad("./assets/field/team_colors.png");
			
			
			let image = this.#fetchLoad("./assets/skins/default/block.png");
			this.skinTemp.ctx.drawImage(image, 0, 0, 130 * 4, 130 * 12, 0, 0, 130 * 4, 130 * 12);
			
			let imageBlob = this.#fetchLoad("./assets/skins/default/blob.png");
			this.skinBlobTemp.ctx.drawImage(imageBlob, 0, 0, 250 * 16, 250 * 16, 0, 0, 250 * 16, 250 * 16);
			
			let imageGarb = this.#fetchLoad("./assets/skins/default/garbage_block.png");
			this.skinGarbTemp.ctx.drawImage(imageGarb, 0, 0, 1600, 200, 0, 0, 1600, 200);
			
			this.skinGarbTemp.ctx.drawImage(this.#fetchLoad("./assets/skins/default/garbage_blob.png"), 0, 0, 1600, 200, 0, 200, 1600, 200);
			
			
			let imageParticle = this.#fetchLoad("./assets/skins/default/particle.png");
			////console.log(imageParticle.width, imageParticle.height)
			particle.addImage("attack", imageParticle, 100, 100);
			//this.skinParticleTemp.ctx.drawImage(imageParticle, 0, 0, 1100, 100, 0, 0, 1100, 100);
			
			let imageAppear = this.#fetchLoad("./assets/field/appear_block.png");
			this.skinAppear.ctx.drawImage(imageAppear, 0, 0, 70 * 10, 70 * 4, 0, 0, 70 * 10, 70 * 4);
			
			let imageClear = this.#fetchLoad("./assets/field/clear_block.png");
			this.skinClear.ctx.drawImage(imageClear, 0, 0, 70 * 10, 70 * 6, 0, 0, 70 * 10, 70 * 6);
			
			elem("CANVAS", n => {
				let particleBlobCtx = getCanvasCtx(n);
				n.width = 100 * 11;
				n.height = 100 * 2;
				
				for (let y = 0; y < 5; y++) {
					particleBlobCtx.drawImage(
						imageBlob,
						0, 250 * y, 250, 250, 100 * y, 0, 100, 100
					);
				}
				
				for (let y = 0; y < 11; y++) {
					particleBlobCtx.drawImage(
						image,
						0, 130 * (y), 130, 130, 100 * y, 100, 100, 100
					);
				}
				// TODO lol
				particleBlobCtx.drawImage(
					imageBlob,
					0, 250 * 5, 250, 250, 100 * 5, 0, 100, 100
				);
				
				particle.addImage("blobblock", n, 100, 100);
				
			});
			
			
			
			this.henshinBg = henshinImg; //.ctx.drawImage(henshinImg, 0, 0, 1800, 2160, 0, 0, 1800, 2160);
			//////console.log(this.assetHTML)
			this.feverBg = feverImg;
			
			this.frenzyBg = frenzyImg;
			this.wormholeBg = wormholeImg;
			
			this.misc.tspin = tspinImg;
			this.misc.tspinmini = tspinminiImg;
			
			this.misc.menu_cs_border_black = this.#fetchLoad("./assets/menu/images/cs_border_black.png");
			
			
			//this.insaneEye.ctx.drawImage(insaneEyeImg, 0, 0, 200, 200);
			
			loadingScreen.images.gate1 = this.#fetchLoad("./assets/menu/loading/images/gate1.png");
			loadingScreen.images.gate2 = this.#fetchLoad("./assets/menu/loading/images/gate2.png");
			
			language.loadImgsByJson(this.#fetchLoad("./assets/init/lang_images.json"));
			
			let faviconURL = URL.createObjectURL(this.#fetchLoad("./assets/favicon/favicon.png"));
			id("SW-LOGO").src = faviconURL;
			elem("LINK", (ma) => {
				ma.setAttribute("rel", "icon");
				ma.setAttribute("href", faviconURL);
				document.head.append(ma);
			})
			
			
			//language.loadCharLanguage(this.#fetchLoad("./assets/lang/en_us/characters.json"));
			//IS_LOAD_LISTER = true;
			
			//////console.log(JSON.stringify(loadLister));
			
			let mmm = [
				
				{
					dir: this.#fetchLoad("./assets/field/blob_hit.png"),
					name: "blob_hit"
				},
				{
					dir: this.#fetchLoad("./assets/field/block_hit.png"),
					name: "block_hit"
				},
				{
					
					dir: this.#fetchLoad("./assets/field/wormhole_explosion.png"),
					name: "wormhole_explosion"
					
				},
				{
					
					dir: this.#fetchLoad("./assets/field/wormhole.png"),
					name: "wormhole"
					
				},
				{
					
					dir: this.#fetchLoad("./assets/field/fever_shine.png"),
					name: "fever_shine"
					
				},
				{
					
					dir: this.#fetchLoad("./assets/field/swap_roulette.png"),
					name: "swap_roulette"
					
				},
				{
					
					dir: this.#fetchLoad("./assets/field/perfect_clear.png"),
					name: "perfect_clear"
					
				}
				
				
			];
			for (let ll = 0; ll < 5; ll++) {
				mmm.push({
					
					
					dir: this.#fetchLoad(`./assets/skins/default/blob_pop${ll + 1}.png`),
					name: `blob_pop${ll + 1}`
					
					
				})
			}
			animatedLayers.loadOfflineArr(mmm);
			
			
			await feverGaugeStorage.load("./assets/field/fever_gauge.png", "./assets/field/fever_timer.png");
			
			await background.loadBg();
			
			game1v1.loadAImgOffline([
			{
				name: "overhead_center",
				image: this.#fetchLoad("./assets/field/overhead_1v1_center.png"),
				w: 27,
				h: 200,
				frame: 120,
				bound: 30
			}]);
			
			
			await menu.load();
			//menu.characterMenu.loadImages();
			
			splash.splashImage = this.#fetchLoad("./assets/splash/controls.png");
			
			this.resize();
			
			menu.setupMouseListener();
			
			menu.showMenu(true);
			//this.initialize(3);
			
			
			splash.toggleRunner(true);
			
			
			
		}
	}
	
	startReplay(isFile) {
		this.replay.isFile = isFile;
		this.startGameSet("replay");
	}
	
	downloadReplayData() {
		let data = btoa(this.replayDataToString());
		////console.log(data);
		
	}
	
	parseReplayFile(jsonString, index, round, isFile) {
		//let jsonString = atob(b64String);
		try {
			
			let json = JSON.parse(jsonString);
			//this.replay.isFile = false;
			this.replay.replays.length = 0;
			if ("replays" in json) {
				for (let h = index; h < json.replays.length && h < round; h++) {
					this.replay.replays.push((json.replays[h]));
				}
			} else {
				
			}
			
			this.startReplay(isFile);
			
		} catch (e) {
			////console.log(e.message)
		}
	}
	
	setActualParameters() {
		let a = menu.storage;
		let b = {};
		switch (this.actualParameters.mode) {
			case 0: {
				b.insaneStart = a.getValueFromRangeListSpecific("set_prep_insane_start");
				b.professional = a.getItem("set_prep_professional(zen)");
				b.tsdonly = a.getItem("set_prep_tsdonly(zen)");
				
				break;
			}
			case 1: {
				b.professional = a.getItem("set_prep_professional(vs)");
				b.maxWins = a.getItem("set_prep_wins(vs)");
				break;
			}
			case 2: {
				b.maxWins = a.getItem("set_prep_wins(swap)");
				break;
			}
			case 3: {
				b.maxWins = a.getItem("set_prep_wins(wmw)");
				break;
			}
			case 4: {
				b.maxWins = a.getItem("set_prep_wins(fever)");
				break;
			}
			case 5: {
				
				break;
			}
			
			case 7: {
				b.maxWins = a.getItem("set_prep_wins(rpg)");
				
				break;
			}
			
			
		}
		this.actualParameters.data = b;
	}
	
	setModeParameters(mode) {
		
		sound.stop("wormhole_loop");
		sound.stop("wormhole_ready");
		this.woiMode.timeDelay = -9;
		this.woiMode.rounds = 0;
		this.timer.enabled = 0;
		this.timer.set(-9);
		this.timer.setMax(10 * game.FPS);
		this.timerDisplay.showHide(false);
		this.isRoundActive = false;
		this.isProfessional = false;
		this.misc.zenkeshi = language.getImage("images/zenkeshi.png");
		this.targetPointSystem.on = false;
		this.targetPointSystem.prep.initial = 70;
		this.targetPointSystem.prep.marginTime = 96 * 60;
		//////console.log(this.misc.zenkeshi)
		//////console.log(mode);
		let blobColors = [1, 2, 3, 4, 5];
		let defaultBlobColors = [1, 2, 3, 4, 5];
		sortRandomInt(blobColors, () => this.seeds.main.next());
		this.forEachPlayer(player => {
			//player.blob.insane.delay.ready = player.block.insane.delay.ready = 6;
			player.initialGarbage = 0;
			
			if (!(player.player in this.inGameParameters.players)) this.inGameParameters.players[player.player] = {};
			this.inGameParameters.players[player.player].wins = this.replay.data.players[player.player].wins;
			
			let blub = player.blob;
			let block = player.block;
			
			block.piece.is180able = false
			
			player.blob.colorSet = blobColors;
			
			block.insane.isCommandedEnd = false;
			blub.insane.isCommandedEnd = false;
			
			blub.garbageOrder.on = false;
			
			blub.isChainOffsetting = false;
			player.blob.insane.isUnlimited = player.block.insane.isUnlimited = 0;
			player.feverStat.isUseTimer = false;
			
			blub.insane.timeAdditions.timeAddMult = block.insane.timeAdditions.timeAddMult = 0;
			blub.insane.timeAdditions.fixedTimeAdd = block.insane.timeAdditions.fixedTimeAdd = 0;
			blub.insane.timeAdditions.allClear = block.insane.timeAdditions.allClear = 0;
			player.simulPresses.enabled = true;
			
			blub.insane.initialStart = false;
			block.insane.initialStart = false;
			
			blub.insane.initialStartHenshin = false;
			block.insane.initialStartHenshin = false;
			block.isAllSpin = false;
			player.rpgAttr.reset();
			player.rpgAttr.resetAttributes();
			player.rpgAttr.enableSkills = false;
			player.rpgAttr.isUsableSkills = false;
			player.block.isTSDOnly = false;
			ihelem(player.getAsset("WINS-TEXT"), player.wins);
		});
		switch (mode) {
			case 0: {
				this.isSolo = true;
				let p = this.getRDDataKey("insaneStart", "0-0").split("-");
				let professional = this.getRDDataKey("professional", 0) == 1;
				let tsdonly = this.getRDDataKey("tsdonly", 0) == 1;
				this.forEachPlayer(player => {
					let isInsane = false;
					if (~~p[0] > 0) {
						player.block.insane.initialStart = player.activeType == 0;
						player.blob.insane.initialStart = player.activeType == 1;
						player.block.insane.initialStartHenshin = player.activeType == 0;
						player.blob.insane.initialStartHenshin = player.activeType == 1;
					}
					player.blob.insane.delay.readyHenshin = (player.activeType == 1 && p[0] == 3) ? 6 : -9;
					player.block.insane.delay.ready = (player.activeType == 0 && p[0] == 1) ? 6 : -9;
					player.blob.insane.delay.ready = (player.activeType == 1 && p[0] == 2) ? 6 : -9;;
					player.blob.insane.timeAdditions.timeAddMult = 1.5;
					//player.blob.settings.gravity = 0;
					//	player.block.insane.delay.ready = 10;
					player.blob.insane.fixedHenshinType = player.activeType == 1 ? ~~p[1] : 0;
					//player.blob.isSpecialDropset = true;
					player.initialGarbage = 0;
					if (professional) {
						player.block.isProfessional = true;
						player.block.isAllSpin = true;
						player.block.piece.is180able = true;
					}
					if (tsdonly) {
						player.block.isTSDOnly = true;
					}
				});
				this.isProfessional = professional;
				break;
			}
			//VERSUS
			case 1: {
				/*this.targetPointSystem.prep.initial = 120;
				this.targetPointSystem.prep.marginTime = 192 * 60;
				this.forEachPlayer(player => {

						//player.blob.insane.delay.readyHenshin = 2;
					// player.initialGarbage = 1 * 200;
					if (player.player > 0) {
						let blob= player.blob;
						blob.isFever = true;
					blob.isSpecialDropset = true;
					player.garbageBlocking = "full";
					player.feverStat.enable(true);
					player.blob.insane.isUnlimited = player.block.insane.isUnlimited = false;
					blob.dropsetReset(player.character.blob.dropset);
					player.feverStat.isUseTimer = true;
					
					blob.insane.timeAdditions.timeAddMult = 1;
					blob.insane.timeAdditions.fixedTimeAdd = 0;
					blob.insane.timeAdditions.allClear = 5;
					blob.insane.timeMax = 99;
					
					blob.garbageOrder.on = true;

player.blob.insane.isExtra = true;
blob.colorSet = defaultBlobColors;
					} else player.blob.fixedAtkHandicap = (120 / 70)

				});*/
				this.targetPointSystem.on = true;
				this.forEachPlayer(player => {
					
				});
				
				let professional = this.getRDDataKey("professional", 0) == 1;
				this.forEachPlayer(player => {
					if (player.activeType === 1) professional = false;
				});
				this.isProfessional = professional;
				if (this.isProfessional) this.forEachPlayer(player => {
					player.block.isProfessional = true;
					player.block.isAllSpin = true;
					player.block.piece.is180able = true;
				});
				
				break;
			}
			//SWAP
			case 2: {
				this.swapMode.on = true;
				this.targetPointSystem.on = true;
				this.forEachPlayer(player => {
					player.blob.insane.delay.ready = player.block.insane.delay.ready = 0;
					player.switchModeType(0);
					player.swapMode.isOn = true;
					player.enableAuxField(true);
					player.block.meteredGarbageWaitMode = false;
					player.block.attackType = "scorebasedSwap";
					player.garbageBlocking = "full";
					player.initialGarbage = 0;
					///player.refreshBorderField(0);
					player.setStyle("HOLD", "display", player.activeType == 0 ? "block" : "none");
					player.adjustBlobBlockBG(0);
					player.block.garbageLimit = 8;
					player.blob.isChainOffsetting = true;
				});
				this.swapMode.decidedBlockOrBlob = ~~(this.seeds.main.next() * 2);
				this.swapMode.blockOrBlob = this.swapMode.decidedBlockOrBlob;
				
				this.swapMode.pickDel = 220;
				
				this.timerDisplay.showHide(true);
				
				
				break;
			}
			//WAR OF INSANITY
			case 3: {
				this.woiMode.on = true;
				this.woiMode.timeDelay = 1.5 * this.FPS;
				this.timer.enabled = 1;
				this.timer.set(80 * this.FPS);
				this.timer.setMax(80 * this.FPS);
				//this.targetPointSystem.o;
				this.forEachPlayer(player => {
					player.blob.insane.delay.ready = player.block.insane.delay.ready = 3;
					player.blob.insane.isUnlimited = player.block.insane.isUnlimited = true;
					player.block.insane.initialStart = true;
					player.blob.insane.initialStart = true;
					player.block.attackType = "scorebasedWMW";
					//     player.blob.insane.isUnlimited = 0
					player.blob.insane.maxTime = player.block.insane.maxTime = this.woiMode.maxTime = 80 * 60;
					player.blob.colors = 4;
					player.isGarbageCollectionMode = true;
					player.blob.insane.isExtra = false;
					player.woi.isOn = true;
					player.isInsaneModeOnly = true;
					player.rpgAttr.openClose(true);
					player.rpgAttr.setMaxHP(200);
					player.rpgAttr.reset();
					player.rpgAttr.isWOIHPMode = true;
					player.block.attackType = "scorebased";
					//player.feverStat.isUseTimer = true;
				});
				this.timerDisplay.showHide(true);
				
				break;
			}
			
			case 4: {
				this.targetPointSystem.prep.initial = 120;
				this.targetPointSystem.prep.marginTime = 192 * 60;
				this.targetPointSystem.on = true;
				this.forEachPlayer(player => {
					player.switchModeType(1);
					
					let blob = player.blob;
					blob.isFever = true;
					blob.isSpecialDropset = true;
					player.garbageBlocking = "full";
					player.feverStat.enable(true);
					player.blob.insane.isUnlimited = player.block.insane.isUnlimited = false;
					blob.dropsetReset(player.character.blob.dropset);
					
					blob.insane.timeAdditions.timeAddMult = 1;
					blob.insane.timeAdditions.fixedTimeAdd = 0.0;
					blob.insane.timeAdditions.allClear = 5;
					blob.insane.timeMax = 99;
					
					player.feverStat.isUseTimer = true;
					
					/*player.rpgAttr.openClose(true);
					player.rpgAttr.setMaxHP(1000000);
					player.rpgAttr.reset();/**/
					
					blob.garbageOrder.on = true;
					
					player.blob.insane.isExtra = true;
					blob.colorSet = defaultBlobColors;
					
					
					
				});
				break;
			}
			
			//PARTY
			
			//RPG ATTRIBUTES 
			case 7: {
				this.targetPointSystem.on = true;
				
				this.targetPointSystem.prep.initial = 70;
				this.targetPointSystem.prep.marginTime = 320 * 60;
				this.forEachPlayer(player => {
					let ap = this.replay.data.players[player.player].rpg;
					/*player.block.isProfessional = true;
					player.block.isAllSpin = true;
					player.block.piece.is180able = true;*/
					player.rpgAttr.isRPG = true;
					player.rpgAttr.openClose(true);
					player.rpgAttr.setMaxHP(ap.hp);
					player.rpgAttr.setMaxMana(ap.mana);
					player.rpgAttr.reset();
					player.rpgAttr.resetAttributes();
					
					let pr = player.rpgAttr.attributes;
					
					
					
					
					////console.log(JSON.stringify(pr), ap)
					pr.attack = ap.atk;
					pr.defense = ap.def;
					pr.lifesteal = ap.lifesteal;
					pr.lfa = ap.lfa;
					pr.deflect = ap.deflect;
					////console.log(pr, ap)
					
					for (let pm = 0; pm < 3; pm++) {
						let rs = player.rpgAttr.deck.characters[pm];
						let om = ap.cards[pm].char.split("|");
						rs.character = ~~om[0];
						rs.version = ~~om[1];
						////console.log(rs)
						rs.skill.rawDesc = ap.cards[pm].rawdesc.split("|");
						////console.log(rs.skill.rawDesc)
						rs.skill.maxCD = ap.cards[pm].cd;
						rs.skill.mana = ap.cards[pm].mana;
						rs.skill.skillVoice = ap.cards[pm].voice;
						rs.skill.skillStatusEffects = ap.cards[pm].attr;
						rs.skill.name = ap.cards[pm].name;
						rs.skill.skillValues = ap.cards[pm].skillvalues;
						let strDesc = "";
						let lms = ap.cards[pm].desc.split(","),
							con = 0;
						for (let g of lms) {
							strDesc += language.translate(`rpg_skilldesc_${g.trim()}`);
							con++;
							if (con < lms.length) strDesc += ",";
							
						}
						rs.skill.desc = strDesc;
					}
					
					player.garbageBlocking = "linkblob-full";
					player.block.garbageLimit = 8;
					player.blob.isChainOffsetting = true;
					
					
				});
				
				this.forEachPlayer(player => {
					player.rpgAttr.addStatusEffect(player.player, "regen", "unli", {
						maxf: 60,
						value: 2
					});
				});
				break;
			}
			
			//RPG BOSS BATTLE
			case 8: {
				this.isSolo = true;
				//let p = this.getRDDataKey("insaneStart", "0-0").split("-");
				//let professional = this.getRDDataKey("professional", 0) == 1;
				this.forEachPlayer(player => {
					let isInsane = false;
					player.garbageBlocking = "linkblob-full";
					player.block.garbageLimit = 8;
					player.blob.isChainOffsetting = true;
					if (professional) {
						player.block.isProfessional = true;
						player.block.isAllSpin = true;
						player.block.piece.is180able = true;
						
					}
				});
				this.isProfessional = professional;
				break;
			}
		}
	}
	
	setRDDataKey(key, value) {
		this.replay.data.data[key] = value;
	}
	getRDDataKey(key, value) {
		return this.replay.data.data[key];
	}
	
	startGameSet(m) {
		this.startGameParameters.frame = 43;
		loadingScreen.toggleOn();
		loadingScreen.isOpenable = false;
		this.startGameParameters.type = m;
	}
	
	outputReplayData() {
		
	}
	
	initialize(mode, replay, parameters, isNext, isOnline) {
		if (replay) {
			this.replay.isOn = true;
			this.replay.replaysIndex = 0;
			//this.replay.replays.push(JSON.stringify(this.replay.data));
			
			this.parseReplayData(this.replay.replays[this.replay.replaysIndex]);
			////console.log(this.replay.data);
		} else {
			this.replay.isOn = false;
			this.replay.isFile = false;
			keypressManager.setupKeybinds();
			let _mode = mode;
			if (mode === "actualparameter") {
				_mode = this.actualParameters.mode;
			}
			
			this.replay.replays.length = 0;
			
			//this.round = 0;
			
			if (!isOnline) this.setActualParameters();
			this.createReplayData(true, _mode, 0);
			
		}
		
		this.matchEndHandler.endable = false;
		this.matchEndHandler.frame = -9;
		this.matchEndHandler.on = false;
		this.matchEndHandler.isFinishActual = false;
		this.matchEndHandler.hasEnded = false;
		this.isEverybodyPlay = false;
		this.replay.replaysIndex = 0;
		
		//music.stopAll();
		
		
		sound.load("default");
		
		this.enableWarning = menu.storage.getItem("set_session_fieldwarning", 0);
		
		
		//////console.log(this.woiMode.on, "ON OR OFF")
		
		if (!isNext) {
			music.resetAllSeek();
			this.numberExecHandlers.insaneMFX.assign(0);
			
		}
		this.prepareInRoundAssets();
		this.unpauseGame();
	}
	
	initializeNext(replay) {
		if (replay) {
			if (this.replay.replays.length > this.replay.replaysIndex) {
				this.replay.replaysIndex++;
				this.parseReplayData(this.replay.replays[this.replay.replaysIndex]);
				this.prepareInRoundAssets(true);
			} else {
				
			}
			
		} else {
			this.inGameParameters.round++;
			this.replay.replays.push(JSON.stringify(this.replay.data));
			this.createReplayData(false, this.inGameParameters.mode, this.inGameParameters.round);
			this.prepareInRoundAssets(true);
		}
	}
	createRandomSeed() {
		return ~~(this.seeds.round.next() * 2147483647);
	}
	
	createReplayData(reset, _mode, round) {
		if (reset) {
			this.inGameParameters.round = 0;
		}
		let m = _mode !== void 0 ? _mode : this.inGameParameters.mode;
		let title = "No Title";
		title = `Round ${this.inGameParameters.round + 1}`;
		this.replay.data = {
			players: {},
			playerOrder: this.actualParameters.playerOrder,
			data: {
				mode: m,
				seed: this.createRandomSeed(),
				round: round,
				maxWins: this.actualParameters.data.maxWins,
				title: title
			},
			
		};
		
		for (let h in this.actualParameters.data) {
			this.replay.data.data[h] = this.actualParameters.data[h];
			
		}
		
		for (let si = 0; si < this.replay.data.playerOrder.length; si++) {
			let i = this.replay.data.playerOrder[si];
			if (reset) {
				this.inGameParameters.players[i] = {
					wins: 0
				}
			}
			this.replay.data.players[i] = {
				keyData: {},
				name: this.actualParameters.players[i].name || "No Name",
				character: this.actualParameters.players[i].character,
				version: this.actualParameters.players[i].version,
				mode: this.actualParameters.players[i].mode,
				rpg: this.actualParameters.players[i]?.rpg || {},
				wins: this.inGameParameters.players[i].wins,
				team: this.actualParameters.players[i].team || 0,
				color: ["55BBFF", "FF5555", "55FF55", "FF55BB"][i] //["55BBFF", "FF5555"][i]
			};
		}
	}
	
	parseReplayData(replayData) {
		let json = JSON.parse(replayData);
		{
			this.replay.data = json;
			//this.prepareInRoundAssets();
			////console.log(json)
		}
		//this.initialize(void 0, true);
	}
	
	loadMusic() {
		let lm = ([{
			name: "insane",
			path: "insane2",
			continuable: this.woiMode.on,
			bpmSync: { active: false }
		},
		{
			name: "insane_transform",
			path: "insane_transform",
			continuable: false,
			bpmSync: { active: false }
		},
		{
			name: "game_match",
			path: menu.storage.getValueFromRangeListSpecific("set_global_musicbank"),
			continuable: true,
			bpmSync: { active: false }
		}]);
		if (this.woiMode.on) {
			lm.push({
				name: "wmw_eval",
				path: "wmw_eval",
				continuable: false
			});
		}
		if (this.isPhylum) {
			lm.push({
				name: "insane_phylum",
				path: "phylum",
				continuable: false,
				bpmSync: { active: true, bpm: 240, timeSignature: 4 / 4 }
			});
			if (this.woiMode.on) {
				lm.push({
					name: "wmw_eval_phylum",
					path: "phylum_wmw",
					continuable: false,
					bpmSync: { active: true, bpm: 240, timeSignature: 4 / 4 }
				});
				lm.push({
					name: "insane_phylum_continuation",
					path: "phylum_continuation",
					continuable: false,
					bpmSync: { active: true, bpm: 240, timeSignature: 4 / 4 }
				});
			}
		}
		if (this.enableWarning) {
			lm.push({
				name: "warning",
				path: "warning",
				continuable: false
			});
		}
		music.load(lm);
	}
	prepareInRoundAssets(isms) {
		this.inGameParameters.playerOrder = this.replay.data.playerOrder || Object.keys(this.replay.data.players);
		this.isRunning = false;
		game1v1.overhead.openClose(5);
		this.isPhylum = false;
		this.forEachPlayer(player => {
			player.resetEmAnimation();
			
		})
		this.winnerDeclaration.winners.length = 0;
		this.winnerDeclaration.losers.length = 0;
		this.round = this.replay.data.data.round;
		
		this.loopParams.isInsane = 0;
		this.loopParams.zerohp = 0;
		
		this.inputFrames = 0;
		this.bufferFrames = 0;
		
		let isChange = this.createPlayer(Object.keys(this.replay.data.players).length);
		
		this.pause.frame = -9;
		this.pause.on = false;
		
		touchButtons.enableControllers(!this.replay.isOn);
		
		game1v1.on = Object.keys(this.players).length == 2;
		this.isEverybodyPlay = Object.keys(this.players).length > 2;
		
		menu.showMenu(false);
		
		this.inGameParameters.mode = this.replay.data.data.mode;
		
		this.inGameParameters.round = this.replay.data.data.round;
		
		this.isFreezeHandlers = false;
		
		let isChangeChars = {};
		let teamNumbers = [];
		this.forEachPlayer(player => {
			let tem = this.replay.data.players[player.player].team;
			player.actualTeam = tem !== void 0 ? tem : 0;
			if (teamNumbers.indexOf(player.actualTeam) == -1) teamNumbers.push(player.actualTeam);
		});
		
		this.forEachPlayer(async player => {
			//let char = ["epicman", /*"epicman", /**/ "elisha", "flotalendy", "elisha", "dylan_huff"][(player.player + 0 /*=== 2 ? 1 : 0/**/ ) % 52];
			//////console.log(`/assets/characters/${char}`);
			
			let c = gtcharacter.characters[this.replay.data.players[player.player].character],
				v = c.versions[this.replay.data.players[player.player].version];
			let char = `${c.core.path}/${v.path}`;
			player.team = ~~(teamNumbers.length > 1 && this.playerCount > 2 && player.actualTeam > 0 ? player.actualTeam : Math.random() * 21583328828283882);
			
			
			let change = player.loadCharacter(c.core.path, v.path);
			if (c.core.phylum) this.isPhylum = true;
			player.isPhylum = c.core.phylum;
			if (change) {
				isChangeChars[`${player.character.char}/${player.character.ver}`] = 1;
			}
			if (isChange) await player.clearText.tspin.loadImages([this.misc.tspin, this.misc.tspinmini]);
			player.changeBodyColorHex(`0x${this.replay.data.players[player.player].color}`);
		});
		
		if (Object.keys(isChangeChars).length) {
			//let chars = [];
			playerVoiceSystem.unloadAll(isChangeChars);
		}
		
		
		let seed = this.replay.data.data.seed;
		
		this.isFinish = false;
		
		this.swapMode.on = false;
		this.swapMode.swapDel = -8;
		this.swapMode.blockOrBlob = 0;
		this.swapMode.decidedBlockOrBlob = 0;
		this.woiMode.isEvaluation = false;
		this.woiMode.time = -19;
		this.woiMode.restart = -19;
		//this.woiMode.on = true;
		this.swapMode.time = 30 * this.FPS;
		this.frames = 0;
		this.delayHandlers.length = 0;
		this.continuousDelayHandlers.length = 0;
		this.isSolo = false;
		
		
		this.pause.on = false;
		
		this.woiMode.loopRate = -1;
		
		this.isRoundNext = false;
		this.roundNextTime = -20;
		
		this.countdown = 210 - 30;
		this.waitCountdown = 50;
		this.inGameParameters.maxWins = this.replay.data.data.maxWins;
		
		this.seeds.main.seed = seed;
		
		//this.matchSignal.separator.start.setSeparatedText(id("OVERLAY-MS-START"), "Start");
		
		
		this.resetReadyMatchSignal(0);
		
		let blobVsBlock = {};
		let isTwo = 0;
		this.forEachPlayer(player => {
			let jm = this.replay.data.players[player.player];
			player.wins = jm.wins;
			player.blob.dropsetReset([]);
			player.switchModeType(Math.min(1, this.replay.data.players[player.player].mode));
			player.swapMode.isOn = false;
			player.block.dasCancellation.on = true;
			let mseed = ~~(this.seeds.main.next() * 2147483647);
			player.block.rngPreview.seed = mseed;
			player.seeds.field.seed = mseed;
			player.rpgAttr.seed.seed = mseed;
			player.block.insane.rng.seed = mseed;
			player.blob.insane.rng.seed = mseed;
			player.blob.rngPreview.seed = seed;
			player.block.attackType = "normal";
			player.blob.isSpecialDropset = false;
			player.feverStat.enable(false);
			/**/
			player.ai.active = !this.online.isOn && this.activePlayer !== player.player;
			if (!(player.activeType in blobVsBlock)) blobVsBlock[player.activeType] = 1;
			player.setStyle("HOLD", "display", player.activeType == 0 ? "block" : "none");
			player.enableAuxField(false);
			player.rpgAttr.openClose(false);
			player.setPlayerName(jm.name);
			player.block.isDelayEnabled = false;
			player.blob.isDelayEnabled = false;
			player.blob.targetPoint = this.targetPointSystem.initial;
			player.isGarbageCollectionMode = false;
			player.isInsaneModeOnly = false;
			player.woi.isOn = false;
			player.block.garbageLimit = 0;
			player.blob.isFever = false;
			player.woi.reset();
			if (this.isEverybodyPlay) player.updateTeam();
			
			
		});
		
		
		
		if (1 in blobVsBlock && 0 in blobVsBlock) isTwo = 1;
		//////console.log(blobVsBlock)
		
		
		
		animatedLayers.remove("swap_roulette_object");
		
		this.forEachPlayer(player => {
			player.meterBar.garbwait.toggle(false);
			player.meterBar.right.toggle(false);
			player.block.isProfessional = false;
			player.block.meteredGarbageWaitMode = false;
			player.garbageBlocking = "limited";
			
			
		});
		
		this.gameRunningParameters = {
			hasChain: []
		};
		
		this.setModeParameters(this.inGameParameters.mode);
		
		this.loadMusic();
		
		//this.resetPlayers();
		this.targetPointSystem.marginTime = this.targetPointSystem.prep.marginTime;;
		
		this.targetPointSystem.iterIncDel = 16 * this.FPS;
		
		this.targetPointSystem.initial = this.targetPointSystem.prep.initial;
		this.targetPointSystem.targetPoint = this.targetPointSystem.initial;
		this.targetPointSystem.previous = this.targetPointSystem.initial;
		
		this.forEachPlayer(player => {
			player.block.isAux = false;
			player.blob.isAux = false;
			player.garbageType = player.activeType;
			
			if (isTwo) {
				if (player.activeType === 0) {
					player.meterBar.garbwait.toggle(true);
					player.garbageType = 1;
				} else {
					player.garbageType = 0;
				}
				player.block.isProfessional = false;
				player.block.meteredGarbageWaitMode = true;
				player.block.attackType = "scorebased";
				player.block.garbageLimit = 8;
			}
			
			if (player.block.isProfessional) {
				player.simulPresses.enabled = false;
				player.block.attackType = "multiplier";
				player.garbageBlocking = "full";
			}
		});
		
		music.volumeSet(menu.storage.getItem("set_global_mfx", 0));
		
		game1v1.winstat.openClose(game1v1.on);
		
		if (game1v1.on) {
			game1v1.winstat.setMaxWins(this.inGameParameters.maxWins);
		}
		
		let bgChange = menu.storage.getValueFromRangeListSpecific("set_global_bgtype", "0=");
		
		let msks = "Ready?";
		if (this.inGameParameters.maxWins > 1 && !this.isSolo) msks = "Round " + (this.round + 1);
		this.matchSignal.separator.ready.setSeparatedText(id("OVERLAY-MS-READY"), msks);
		ihelem(id("OVERLAY-MS-START"), `START`);
		
		
		let bgType = bgChange.split("=")[0];
		background.isOn = false;
		switch (bgType) {
			case "0": {
				background.canvas.style.background = "#000";
				break;
			}
			case "1": {
				background.canvas.style.background = "#900";
				break;
			}
			case "2": {
				background.canvas.style.background = "#090";
				break;
			}
			case "3": {
				background.canvas.style.background = "#009";
				break;
			}
			case "4": {
				background.isOn = true;
				background.canvas.style.background = "#000";
				break;
			}
		}
		
		background.loadBg(bgChange);
		
		this.forEachPlayer(player => {
			player.setStyle("METERBAR-GARBWAIT-LEFT", "background", player.block.meteredGarbageWaitMode && !player.woi.isOn ? "#000" : "rgba(0,0,0,0)")
		});
		
		if (this.online.isOn && !this.replay.isOn) {
			this.online.isPrepared = false;
		}
		
		online.isReady = false;
		
		this.startLoadLoop(isms);
	}
	
	resetPlayers() {
		this.forEachPlayer(player => {
			/*if (player.player == 0)/**/ //player.blob.insane.delay.ready = 3;
			let tempBlock = player.block.insane.delay.ready;
			let tempBlob = player.blob.insane.delay.ready;
			let tempHenBlock = player.block.insane.delay.readyHenshin;
			let tempHenBlob = player.blob.insane.delay.readyHenshin;
			
			if (!player.block.insane.initialStart) tempBlock = -99;
			
			if (!player.block.insane.initialStartHenshin) tempHenBlock = -99;
			if (!player.blob.insane.initialStart) tempBlob = -99;
			if (!player.blob.insane.initialStartHenshin) tempHenBlob = -99;
			/*for (let b = 0; b < 16; b++) {
				player.blob.piece.dropset[b] = player.character.blob.dropset[b];
			}*/
			
			player.blob.dropsetReset(player.character.blob.dropset);
			player.reset();
			
			player.block.insane.delay.ready = tempBlock;
			player.blob.insane.delay.ready = tempBlob;
			player.block.insane.delay.readyHenshin = tempHenBlock;
			player.blob.insane.delay.readyHenshin = tempHenBlob;
			
			player.addGarbage("system", [player.initialGarbage]);
			
			// player.block.insane.delay.ready = tempBlock;
			/*if (player.player == 1) /**/ //player.blob.insane.delay.ready = tempBlob;
			/*else /**/ //player.blob.insane.delay.readyHenshin = tempBlob;
			player.garbageLastForTray.assign(player.garbageLength);
		});
	}
	resetCountdown() {
		this.resetReadyMatchSignal(0);
		this.countdown = 210 - 30;
		this.waitCountdown = 40;
	}
	
	startLoadLoop() {
		if (this.isGameLoaded) this.loadLoop();
	}
	
	loadLoop(s) {
		let loaded = true;
		let canLoad = true;
		let jsonLoaded = true;
		let isOnline =  this.online.isOn && !this.replay.isOn;
		let onlineLoaded = true;
		
		if (!sound.isReady || !music.isReady || !background.isReady) canLoad = false;
		this.forEachPlayer(player => {
			if (!player.character.load) canLoad = false;
			if (!player.character.loadedJson) {
				canLoad = false;
				jsonLoaded = false;
			}
		});
		
		if (!canLoad) loaded = false;
		else {
			if (isOnline) {
				if (!this.online.isPrepared) {
					this.online.isPrepared = true;
					let wr = online.createWriter("MATCH_PREPARE", 0);
					online.send(wr.buffer);
				}
				
				loaded = online.isReady;
				
				
			} else {
				loaded = true;
			}
		}
		if (loaded) {
			if (!this.isGameLoaded) {
				this.synchroLoop.confirmIsAsync = false;
				//styleelem(this.loadDiv.main, "display", "none");
				//this.resize();
				
			}
			this.isGameLoaded = true;
			loadingScreen.isOpenable = true;
			this.playAnimation("fadeout");
			style("GTRIS-OVERLAY", "background", "#0000");
			
			this.resize();
			this.resetPlayers();
			
			if (game1v1.on) {
				this.forEachPlayer(player => {
					
					if (player.player == 0) {
						game1v1.winstat.loadPlayer("left", {
							red: player.color.r,
							green: player.color.g,
							blue: player.color.b
						});
						game1v1.winstat.setWins("left", player.wins);
					}
					if (player.player == 1) {
						game1v1.winstat.loadPlayer("right", {
							red: player.color.r,
							green: player.color.g,
							blue: player.color.b
						});
						game1v1.winstat.setWins("right", player.wins);
					}
				});
			}
			
			this.forEachPlayer(player => {
				player.block.drawStack();
				player.block.drawActivePiece();
				//player.block.previewInitialize();
				player.blob.targetPoint = this.targetPointSystem.initial;
				player.block.holdDraw();
			});
			
			//music.volume(1);
		} else {
			let l = "";
			Object.keys(this.players).forEach((a) => {
				l += `${a}: ${this.players[a].character.loadedJson}, `
				
			})
			////console.log(`${sound.isReady}, ${music.isReady}, players: ${l}`);
			if (this.isGameLoaded) {
				
				this.resize();
			}
			loadingScreen.isOpenable = false;
			this.isGameLoaded = false;
			
			if (jsonLoaded !== this.isPlayerJsonLoaded) {
				this.isPlayerJsonLoaded = jsonLoaded;
				
				if (jsonLoaded) {
					this.loadPlayerAssets();
				}
			}
			window.requestAnimationFrame(() => {
				this.loadLoop();
			})
		}
	}
	
	loadPlayerAssets() {
		let storage = {};
		let is1v1 = game1v1.on;
		
		//////console.log("load player assets")
		
		let overheadSrcs = {};
		this.forEachPlayer((player) => {
			player.loadAssets();
			//alert("load")
			
			let json = player.character.json;
			
			let imageURLs = json.sources.image;
			
			let mainDir = `/assets/characters/${player.character.char}/${player.character.ver}`;
			
			
			//let i = player.character.json;
			
			for (let file in imageURLs) {
				let ref = `${mainDir}/${imageURLs[file]}`;
				storage[`${player.character.char}/${player.character.ver}/${file}`] = ref;
			}
			
		});
		
		this.forEachPlayer(player => {
			let i = player.character.json;
			
			let a = `${player.character.char}/${player.character.ver}`
			if ("ca_overhead" in i.init) {
				let h = i.init.ca_overhead;
				let sh = i.sources.image[h.image];
				if ("image" in h) {
					overheadSrcs[a] = storage[`${a}/${h.image}`];
				}
			}
		});
		
		if (is1v1) {
			let left = this.players[0];
			let right = this.players[1];
			
			let ma = `${left.character.char}/${left.character.ver}`
			let mb = `${right.character.char}/${right.character.ver}`
			let n = [];
			
			for (let j in overheadSrcs) {
				n.push({
					name: j,
					dir: overheadSrcs[j]
				});
			}
			
			game1v1.overhead.loadImg(n);
			
			game1v1.overhead.loadPlayer("left", {
				image: ma,
				red: left.color.r,
				green: left.color.g,
				blue: left.color.b
			});
			game1v1.overhead.loadPlayer("right", {
				
				image: mb,
				red: right.color.r,
				green: right.color.g,
				blue: right.color.b
				
			});
		}
		//////console.log(overheadSrcs)
		
		
		
		
	}
	
	resize() {
		this.resolution.w = Math.max(document.documentElement.clientWidth, window.innerWidth, 1);
		this.resolution.h = Math.max(document.documentElement.clientHeight, window.innerHeight, 1);
		//this.resolution.h = this.resolution.w / (16/9);
		style("CORE", "width", `${this.resolution.w}px`);
		style("CORE", "height", `${this.resolution.h}px`);
		
		let ms = this.isEverybodyPlay ? 0.875 : 1;
		
		let screenWidth = this.resolution.w,
			screenHeight = this.resolution.h;
		let ratioWidth = screenWidth,
			ratioHeight = screenHeight;
		let aspectRatio = this.aspectRatio;
		this.landscape.x = this.portrait.x = screenWidth;
		this.landscape.y = this.portrait.y = screenHeight;
		if (screenWidth <= screenHeight) {
			this.orientation = "portrait";
			ratioHeight = (Math.floor(Math.min(screenWidth * aspectRatio, screenHeight)));
			if (screenWidth * aspectRatio >= screenHeight) {
				ratioWidth = screenWidth - (((screenWidth * aspectRatio) - screenHeight) / 2);
			}
			this.portrait.y = ratioHeight;
			this.portrait.x = ratioWidth;
			this.landscape.x = ratioWidth;
			this.landscape.y = Math.floor(ratioWidth / aspectRatio);
		} else {
			this.orientation = "landscape";
			ratioWidth = (Math.floor(screenHeight * aspectRatio));
			this.landscape.y = ratioHeight;
			this.landscape.x = ratioWidth;
			this.portrait.x = ratioHeight
			this.portrait.y = Math.floor(ratioHeight / aspectRatio);
		}
		let aspectRatioResolution = Math.max(ratioWidth, ratioHeight);
		let uhd = 0.82;
		let cellSize = (aspectRatioResolution / 50) * 1;
		let fontSizePerPx = 16 / __main_params__.appinfo.fontsize;
		this.fontSize = ((cellSize) * fontSizePerPx);
		this.cellSize = ~~cellSize;
		////console.log(fontSizePerPx, __main_params__.appinfo.fontsize)
		
		document.documentElement.style.fontSize = this.fontSize + "px";
		document.body.style["text-shadow"] = `-${fontSizePerPx}px 0 ${fontSizePerPx*2}px black, 0 ${fontSizePerPx}px ${fontSizePerPx*2}px black, ${fontSizePerPx}px 0 ${fontSizePerPx*2}px black, 0 -${fontSizePerPx}px ${fontSizePerPx*2}px black`;
		if (this.orientation == "landscape") {
			this.playerAreaSizeMult = uhd; //0.56;
			this.aspectResolution.w = this.landscape.x;
			this.aspectResolution.h = this.landscape.y;
		}
		
		if (this.orientation == "portrait") {
			this.playerAreaSizeMult = (1 / this.aspectRatio) * uhd; //0.56;
			this.aspectResolution.w = this.portrait.x;
			this.aspectResolution.h = this.portrait.y;
		}
		////console.log(window.getComputedStyle(document.body).fontSize, __main_params__.appinfo.fontsize)// = this.cellSize + "px";
		////console.log(this.resolution.w, this.resolution.h, this.cellSize)
		for (let m of ["SCREEN", "GTRIS-AREA"]) {
			style(m, "width", `${this.aspectResolution.w}px`);
			style(m, "height", `${this.aspectResolution.h}px`);
		}
		
		animatedLayers.cellSize = this.cellSize * this.playerAreaSizeMult;
		
		this.skinBlob.canvas.width = this.cellSize * 16 * this.resQualityMult;
		this.skinBlob.canvas.height = this.cellSize * 16 * this.resQualityMult;
		this.skinBlob.ctx.drawImage(this.skinBlobTemp.canvas, 0, 0, this.cellSize * 16 * this.resQualityMult, this.cellSize * 16 * this.resQualityMult);
		
		touchButtons.resize(this.orientation, this.resolution.w, this.resolution.h, this.aspectResolution.w, this.aspectResolution.h, this.cellSize);
		
		this.skin.canvas.width = this.cellSize * 4 * this.resQualityMult;
		this.skin.canvas.height = this.cellSize * 11 * this.resQualityMult;
		
		
		
		this.skin.ctx.drawImage(this.skinTemp.canvas, 0, 0, this.cellSize * 4 * this.resQualityMult, this.cellSize * 12 * this.resQualityMult);
		
		this.skinGarb.canvas.width = 1600;
		this.skinGarb.canvas.height = 400;
		
		this.skinGarb.ctx.drawImage(this.skinGarbTemp.canvas, 0, 0, 1600, 400, 0, 0, 1600, 400);
		
		this.skinParticle.canvas.width = this.cellSize * 11;
		this.skinParticle.canvas.height = this.cellSize * 1;
		
		this.skinParticle.ctx.drawImage(this.skinParticleTemp.canvas, 0, 0, this.cellSize * 11, this.cellSize * 1);
		
		style(`BEHIND-OVERLAY-BACKGROUND`, `width`, `${this.resolution.w}px`);
		style(`BEHIND-OVERLAY-BACKGROUND`, `height`, `${this.resolution.h}px`);
		
		//style("BACKGROUND-VIDEO-FRAME", `width`, `${this.landscape.x}px`);
		//style(`BACKGROUND-VIDEO-FRAME`, `height`, `${this.landscape.y}px`);
		
		style("BACKGROUND-FOREGROUND-LAYER", `width`, `${this.landscape.x}px`);
		style(`BACKGROUND-FOREGROUND-LAYER`, `height`, `${this.landscape.y}px`);
		
		style(`PARTICLE-PARTICLE-CANVAS`, `width`, `${this.resolution.w}px`);
		style(`PARTICLE-PARTICLE-CANVAS`, `height`, `${this.resolution.h}px`);
		
		style(`OVERLAY-TIMER`, `width`, `${this.resolution.w}px`);
		style(`OVERLAY-TIMER`, `height`, `${this.resolution.h}px`);
		
		style(`OVERLAY-TIMER-DIV`, `width`, `${this.cellSize * 6}px`);
		style(`OVERLAY-TIMER-DIV`, `height`, `${this.cellSize * 5}px`);
		
		style(`OVERLAY-TIMER-TEXT`, `font-size`, `${this.fontSize * 1.2}px`);
		style(`OVERLAY-TIMER-DIV`, `transform`, `translate(0, -${this.landscape.y / 2 *(this.isEverybodyPlay ? 0.9 : 0.3)}px)`);
		
		style(`OVERLAY-WINS-STATUSBAR`, `width`, `${this.landscape.x}px`);
		style(`OVERLAY-WINS-STATUSBAR`, `height`, `${this.landscape.y}px`);
		
		style(`WINSBAR-BAR`, `width`, `${this.cellSize * 12* this.playerAreaSizeMult}px`);
		style(`WINSBAR-BAR`, `height`, `${this.cellSize * 3 * this.playerAreaSizeMult}px`);
		
		style(`WINSBAR-BAR`, `bottom`, `${this.cellSize * 2 * this.playerAreaSizeMult}px`);
		
		game1v1.winstat.resize(this.cellSize * this.playerAreaSizeMult);
		//style(`WINSBAR-BAR`, `height`, `${this.cellSize * 1.2}px`);
		
		
		style(`GTRIS-PARTICLE-SCREEN`, `width`, `${this.resolution.w}px`);
		style(`GTRIS-PARTICLE-SCREEN`, `height`, `${this.resolution.h}px`);
		
		style(`GTRIS-SPLASH-DIV`, `width`, `${this.resolution.w}px`);
		style(`GTRIS-SPLASH-DIV`, `height`, `${this.resolution.h}px`);
		style(`GTRIS-FADE`, `width`, `${this.landscape.x}px`);
		style(`GTRIS-FADE`, `height`, `${this.landscape.y}px`);
		
		style(`LOAD-TEXT`, `font-size`, `${this.fontSize * 1.05}px`);
		style(`LOAD-ICON`, `width`, `${this.cellSize * 1}px`);
		style(`LOAD-ICON`, `height`, `${this.cellSize * 1}px`);
		style(`GTRIS-HTMLEFF-SCREEN`, `width`, `${this.resolution.w}px`);
		style(`GTRIS-HTMLEFF-SCREEN`, `height`, `${this.resolution.h}px`);
		
		style(`GTRIS-LOAD-SCREEN`, `width`, `${this.resolution.w}px`);
		style(`GTRIS-LOAD-SCREEN`, `height`, `${this.resolution.h}px`);
		
		styleelem(loadingScreen.canvas, `width`, `${this.landscape.x}px`);
		styleelem(loadingScreen.canvas, `height`, `${this.landscape.y}px`);
		
		
		style(`LOAD-DIV`, `width`, `${this.landscape.x}px`);
		style(`LOAD-DIV`, `height`, `${this.landscape.y}px`);
		
		let landscapeCellSize = ~~(Math.max(this.landscape.x, this.landscape.y) / 50);
		let landscapeFontSize = ~~((Math.max(this.landscape.x, this.landscape.y) / 50) * fontSizePerPx);
		
		////console.log(fontSizePerPx, "cell size:" + landscapeCellSize,"font size:" + landscapeFontSize, __main_params__.appinfo.fontsize, this.landscape.x, this.landscape.y)
		
		particle.size(this.resolution.w, this.resolution.h);
		style("GTRIS-AREA", "grid-template-columns", this.orientation === "landscape" ? "auto auto auto" : "auto auto");
		
		menu.resize(landscapeCellSize, landscapeFontSize, this.landscape.x, this.landscape.y);
		splash.resize(this.landscape.x, this.landscape.y, landscapeCellSize);
		
		if (animatedLayers.checkObject("swap_roulette_object")) {
			let ghe = animatedLayers.getObject("swap_roulette_object");
			ghe.centerPos.x = this.resolution.w / 2;
			ghe.centerPos.y = this.resolution.h / 2;
			ghe.sizeMult = this.cellSize * this.playerAreaSizeMult;
		}
		
		game1v1.resize(this.landscape.x, this.landscape.y);
		background.resize(this.landscape.x, this.landscape.y);
		fsw.resize(this.resolution.w, this.resolution.h, this.fontSize, this.cellSize);
		alertWindow.resize(this.resolution.w, this.resolution.h, this.fontSize);
		
		this.forEachPlayer(player => {
			player.resize(~~this.cellSize, ~~(this.fontSize * ms), this.playerAreaSizeMult * ms, this.isEverybodyPlay);
		});
	}
	
	forEachPlayer(func) {
		let a = 0;
		while (a in this.players) {
			let h = this.inGameParameters.playerOrder[a];
			func(this.players[h], h);
			a++;
		}
	}
	
	createPlayer(a) {
		
		if (a !== this.playerCount) {
			this.playerCount = a;
			this.players = {};
			ih("PLAYER-STYLES", "");
			
			ih("GTRIS-AREA", "");
			for (let i = 0; i < a; i++) {
				this.players[i] = new Player(i);
				let b = this.players[i];
				id("GTRIS-AREA").innerHTML += b.assetHTML;
				id("PLAYER-STYLES").innerHTML += b.assetStyle;
			}
			
			this.forEachPlayer(player => {
				//////console.log(id("GTRIS-AREA"));
				player.storeElementsToMemory();
				player.meterBar.right.initialize(player.getAsset("METERBAR-RIGHT"), [player.getAsset("MB-HAND-RIGHT"), player.getAsset("MB-HAND-RIGHT-BEHIND")]);
				player.meterBar.garbwait.initialize(player.getAsset("METERBAR-GARBWAIT-LEFT"), [player.getAsset("MB-HAND-LEFT-GWLV1"), player.getAsset("MB-HAND-LEFT-GWLV2"), player.getAsset("MB-HAND-LEFT-GWLV3")]);
				player.insaneBg.fetchAsset(player.canvasses.insane, player.canvasCtx.insane);
				player.woiWormhole.fetchAsset(player.canvasses.wormhole, player.canvasCtx.wormhole);
				player.feverStat.fetchAsset(player.canvasses.feverGauge, player.canvasCtx.feverGauge, player.getAsset("FEVER-GAUGE"));
				
			});
			
			return true;
		}
		return false;
	}
	
	updateInput() {
		this.forEachPlayer(player => {
			if (this.activePlayer === player.player) {
				//let hs = this.replay.data.players[player.player].keyData;
				/*if (!(player.inputFrames in hs)) {
					hs[player.inputFrames] = this.pressStr;;
				}*/
				player.pressStr = this.pressStr;
				
			}
		});
		this.lastPressStr = this.pressStr;
		//this.pressStr = 0;
	}
	
	typeInput(char, type) {
		if (this.replay.isOn || menu.isMenu || this.pause.on) return;
		if (type) this.pressStr |= (char)
		else this.pressStr ^= (char);
	}
	
	keyToBit(c) {
		
	}
	
	replayDataToString() {
		let string = JSON.stringify({
			title: `[${new Date(Date.now()).toLocaleString(navigator.language)}] Replay of ${menu.storage.getItem("playername")}, version ${__main_params__.appinfo.version}`,
			replays: this.replay.replays
		});
		return string;
	}
	
	frameLoop() {
		
		this.#customLoops.update();
		if (menu.isMenu) {
			menu.run();
		}
		if (menu.pressAButtonDelay > 0) {
			menu.pressAButtonDelay--;
		}
		if (this.coreElement.scrollTop) this.coreElement.scrollTop = 0;
		
		menu.runInBackground();
		fsw.update();
		alertWindow.update();
		
		if (this.startGameParameters.frame > 0) {
			this.startGameParameters.frame--;
			if (this.startGameParameters.frame == 0) {
				if (this.startGameParameters.type === "actual") this.initialize("actualparameter", false);
				if (this.startGameParameters.type === "actual_online") this.initialize("actualparameter", false, null, false, true);
				if (this.startGameParameters.type === "restart") this.initialize(void 0, false);
				if (this.startGameParameters.type === "replay") this.initialize(void 0, true);
			}
		}
		loadingScreen.run();
		if (this.pause.on && this.pause.frame > 0) {
			this.pause.frame -= 1;
			if (this.pause.frame == 1) {
				this.synchroLoop.confirmIsAsync = false;
				this.pause.on = false;
			}
		}
		//main loop statement
		if (!this.pause.on && this.isGameLoaded && this.startGameParameters.frame <= 0) {
			background.ctx.clearRect(0, 0, 1280, 720);
			background.drawVideo();
			//background.backgroundElem.currentTime -= 0.01;
			game1v1.overhead.drawImageToBG();
			let isRepeat = false;
			do	{
				isRepeat = false;
			let isInsane = !(this.matchEndHandler.on || !this.isGameLoaded || this.isFinish) ? 5 : 0;
			let zerohp = 0;
			let isInsanePhylum = false;
			
			let canContinueHaltFrame = false;
			if (this.waitCountdown >= 0) {
				this.waitCountdown--;
			} else {}
			
			

			let hasChainOngoing = false,
				isStillFinishable = false;
			
			
			
			this.forEachPlayer(player => {
				player.runUnfreezableAnims();
			});
			let isHandlePause = false;
			
			
			let isNextFrame = false;
			let isInput = false;
			let isReplay = this.replay.isOn;
			let isOnline = this.online.isOn && !isReplay;
			let canNextFrame = !isOnline || isReplay;
			if (!isReplay) this.updateInput();
			
			if (!this.replay.isOn) this.forEachPlayer(player => {
				if (this.activePlayer == player.player) {
					if ((player.activeType == 0 && player.block.piece.enable) || (player.activeType == 1 && player.blob.piece.enable)) { isInput = true }
				} else {
					
					
				}
			});
			
			let framePacketArrived = false;
			if (isOnline) {
				if ((this.frames) in this.online.frames) {
					canNextFrame = true;
					
					isRepeat = true;
					framePacketArrived = true;
					this.online.timeoutFrames = 12*this.FPS;
				} else this.online.timeoutFrames--;
			} else framePacketArrived = true;
			if (this.isRoundNext) canNextFrame = true;
			if (this.frames < 2) canNextFrame = true;
			if (canNextFrame) this.bufferFrames++;
			
			if (this.frames < this.bufferFrames) {
				isNextFrame = true;
				//isInput = !isReplay;
				framePacketArrived = true;
				this.frames++;
				this.online.timeoutFrames = 12*this.FPS;
			}
			
			if (isNextFrame) {
				if (this.swapMode.on && this.swapMode.pickDel >= 0) {
					this.swapMode.pickDel -= 1;
					canContinueHaltFrame = true;
					if (this.swapMode.pickDel == 210) {
						animatedLayers.create("swap_roulette_object", 120,
							this.resolution.w / 2,
							this.resolution.h / 2,
							0,
							0,
							0,
							200,
							200,
							11,
							11,
							1,
							"swap_roulette",
							10,
							this.cellSize * this.playerAreaSizeMult,
							{
								isOn: true,
								resetFrame: 47,
								targetFrame: 59
							},
							
							false,
							true,
						);
					}
					if (this.swapMode.pickDel == 100 && animatedLayers.checkObject("swap_roulette_object")) {
						let ghe = animatedLayers.getObject("swap_roulette_object");
						ghe.loop.isOn = false;
						ghe.setFrame([61, 98][this.swapMode.decidedBlockOrBlob]);
						sound.play("swap_pick");
					}
					if (this.swapMode.pickDel <= 172 && this.swapMode.pickDel >= 101 && (this.swapMode.pickDel % 5) == 0) {
						sound.play("swap_roulette");
					}
					if (this.swapMode.pickDel == 90 && animatedLayers.checkObject("swap_roulette_object")) {
						let ghe = animatedLayers.getObject("swap_roulette_object");
						ghe.isPaused = true;
					}
					if (this.swapMode.pickDel == 10 && animatedLayers.checkObject("swap_roulette_object")) {
						//let ghe = animatedLayers.getObject("swap_roulette_object");
						animatedLayers.setOpacity("swap_roulette_object", 0, 10);
					}
					if (this.swapMode.pickDel == 0) {
						this.forEachPlayer(player => {
							if (this.swapMode.blockOrBlob == 1) player.swapMode.playSwapAnim();
							player.switchAuxToMain(this.swapMode.decidedBlockOrBlob);
							player.playVoice(["swap_gtris", "swap_blob"][this.swapMode.decidedBlockOrBlob]);
							player.convertGarbageBlockToGarbageBlob(this.swapMode.blockOrBlob);
						});
					}
				}
				else if (this.swapMode.swapDel >= 0) {
					this.swapMode.swapDel--;
					isHandlePause = true;
					if (this.swapMode.swapDel == 0) {
						this.isFreezeHandlers = false;
						game1v1.overhead.openClose(5);
						this.forEachPlayer(player => {
							player.switchAuxToMain(this.swapMode.blockOrBlob);
							//player.startNext();
							player.canvasClear("back");
							player.canvasClear("backAux");
							player.engageCleartext("b2b", false, "");
							player.engageCleartextCombo(false, 0, "");
							
							player.swapMode.reset();
							player.swapMode.time = 16 * this.FPS;
							player.convertGarbageBlockToGarbageBlob(this.swapMode.blockOrBlob);
							if (this.isRoundActive) {
								if (this.swapMode.blockOrBlob == 1) {
									player.blob.setDelay(0, 5);
									if (player.blob.isWarning) {
										player.playVoice("swap_danger");
									} else if (player.block.isWarning) {
										player.playVoice("swap_closecall");
									} else {
										player.playVoice("swap_swap");
									}
									
								}
								
								if (this.swapMode.blockOrBlob == 0) {
									player.block.setDelay(0, 5);
									if (player.block.isWarning) {
										player.playVoice("swap_danger");
									} else if (player.blob.isWarning) {
										player.playVoice("swap_closecall");
									} else {
										player.playVoice("swap_swap");
									}
									
								}
							}
						});
					}
				} else
				if (this.countdown > 0) {
					
					this.countdown--;
					if (this.countdown == 209 - 30) {
						this.resetReadyMatchSignal(1);
						this.isRunning = true;
						//this.synchroLoop.confirmIsAsync = false;
						this.isRoundActive = true;
						//if (!this.replay.isOn) this.synchroLoop.speed = 0.3;
					}
					if (this.countdown == 0) {
						//this.endGame();
						this.forEachPlayer(player => {
							player.callibrateCenter();
							if (player.activeType == 1 && player.blob.isEnable && player.blob.isControl && !(player.blob.insane.delay.ready > 0 || player.blob.insane.delay.readyHenshin > 0)) player.blob.previewNextBlob();
							if (player.activeType == 0 && player.block.isEnable && player.block.isControl && !(player.block.insane.delay.ready > 0 || player.blob.insane.delay.readyHenshin > 0)) player.block.spawnPiece(player.block.previewNextBag());
							
							player.blob.isDelayEnabled = true;
							player.block.isDelayEnabled = true;
							if (player.rpgAttr.isRPG) player.rpgAttr.isUsableSkills = true;
							
						})
					}
				} else {
					if (this.targetPointSystem.on) {
						if (this.targetPointSystem.marginTime >= 0) {
							this.targetPointSystem.marginTime--;
							if (this.targetPointSystem.marginTime == 0 && this.targetPointSystem.targetPoint > 1) {
								this.targetPointSystem.marginTime <= 0;
								let currentTargetPoint = this.targetPointSystem.targetPoint;
								this.targetPointSystem.targetPoint = ~~(this.targetPointSystem.initial * 0.75);
								this.targetPointSystem.previous = currentTargetPoint;
								
							}
						}
						
						if (this.targetPointSystem.marginTime <= 0) {
							this.targetPointSystem.iterIncDel--;
							if (this.targetPointSystem.iterIncDel <= 0 && this.targetPointSystem.targetPoint > 1) {
								this.targetPointSystem.iterIncDel = 16 * this.FPS;
								let currentTargetPoint = this.targetPointSystem.targetPoint;
								this.targetPointSystem.targetPoint = ~~(this.targetPointSystem.previous * 0.5);
								this.targetPointSystem.previous = currentTargetPoint;
							}
						}
					}
					//////console.log(this.targetPointSystem.targetPoint)
					if (!this.isRoundNext && this.isRoundActive) {
						
						if (this.swapMode.time == 0) {
							this.swapMode.time = 30 * this.FPS;
							this.swapMode.swapDel = 40;
							this.isFreezeHandlers = true;
							
							sound.play("swap_swap");
							
							if (this.swapMode.blockOrBlob == 0) {
								this.swapMode.blockOrBlob = 1;
								
							}
							else if (this.swapMode.blockOrBlob == 1) {
								this.swapMode.blockOrBlob = 0;
								
							}
							this.forEachPlayer(player => {
								player.swapMode.playSwapAnim();
								player.block.canRaiseGarbage = false;
								player.blob.canFallTrash = false;
								player.refreshBorderField(this.swapMode.blockOrBlob);
							})
						} else if (this.swapMode.on == this.swapMode.time >= 0) {
							this.swapMode.time--;
							this.timerDisplay.display(this.swapMode.time);
						}
						if (this.swapMode.time == ~~(0.3 * this.FPS)) {
							this.forEachPlayer(player => {
								player.block.isActive = false;
								
								player.blob.isActive = false;
								
								
								
								
							});
							
						}
						if (this.swapMode.time <= this.FPS * 3 && this.swapMode.time > this.FPS * 0.1) {
							if (0 == (this.swapMode.time % this.FPS)) sound.play("timer_basic");
							
						}
					}
				}
				this.matchSignal.main.run();
			}
			
			
			
			
			
			this.forEachPlayer(player => {
				
				//let isPlayerCurrent = ((player.activeType == 0 && (player.block.piece.enable)) || (player.activeType == 1 && player.blob.piece.enable) || player.inputFrames <= this.frames);
				player.inputBuffer = 0;
				if (this.activePlayer !== player.player || isReplay) {
					let isProceed = false;
					
					if (!isReplay && (isOnline && framePacketArrived) && (player.inputFrames in this.online.frames)) {
						player.pressStr = this.online.frames[player.inputFrames][player.player];
						isProceed = true;
					}
					if (isProceed) player.inputBuffer = 1;
				} else {
					player.canWaitForOpponent = !framePacketArrived;
					if (framePacketArrived) {
						player.shouldWaitForOpponent = false;
					}
					if (!player.shouldWaitForOpponent) {
						player.inputBuffer = 1;
						isRepeat = false;
						
					} else {
						//player.inputBuffer = 0;
					}
					
				}
				if (player.inputBuffer > 0) {
					this.online.timeoutFrames = 12*this.FPS;
					if (isOnline && (this.activePlayer == player.player)) {
						let wr = online.createWriter("PLAYER_INPUT", 4 + 2);
						wr.u32(player.inputFrames);
						wr.u16(player.pressStr);
						online.send(wr.buffer);
						
					}
					player.inputRun(isHandlePause);
					
					
				}
				
			});
			if (isOnline) {
				if (this.online.timeoutFrames <= 0) {
					log.error("Network Error!", "Network error occurred. This match will end.");
					online.emit("MATCH_END", []);
					this.endGame();
					isRepeat = false;
				}
			}
			
			this.forEachPlayer(player => {
				if (player.inputBuffer > 0 && !isHandlePause) player.playerUpdate();
				player.drawPlayer();
				
			});
			if (isNextFrame) {
				
				
				
				if (!this.isFreezeHandlers) {
					for (let pla in this.gameRunningParameters.hasChain) {
						delete this.gameRunningParameters.hasChain[pla];
					}
					//////console.log("running")
					
					let teamsAlive = {};
					
					let n = false;
					let insaneDetected = 0;
					
					//isInsane = 2;
					this.forEachPlayer(player => {
						if (player.blob.insane.isOn) {
							insaneDetected = 2;
						}
						if (player.block.insane.isOn) {
							insaneDetected = 2;
						}
					});
					if (insaneDetected == 0 && this.enableWarning) this.forEachPlayer(player => {
						if (player.isWarning) {
							isInsane = 4;
						}
						
					});
					//music.volume(n ? 1 : 1)
					
					this.forEachPlayer(player => {
						
						
						player.blob.decreaseTargetPoint = Math.max(1, this.targetPointSystem.initial / this.targetPointSystem.targetPoint);
						if (!player.isDead && !player.isDying && !player.hasWon) {
							teamsAlive[player.team] = 1;
							if (player.blob.forecastedChain > 0 && (player.blob.chain > 0 || player.blob.isChainUp) && player.blob.actualChain < player.blob.forecastedChain) {
								hasChainOngoing = true;
							}
							
						}
						if (player.isFinishAble) isStillFinishable = true;
						if (player.blob.isChainUp) this.gameRunningParameters.hasChain[player.team] = 1;
						if (!player.isDead) {
							if (!this.isFinish && (player.block.insane.isOn || player.blob.insane.isOn)) {
								
								if (player.blob.insane.insaneType == 0) { isInsane = 1; if (player.isPhylum) isInsanePhylum = true; }
								if (player.blob.insane.insaneType == 2) isInsane = 2;
								if (player.blob.insane.insaneType == 1) isInsane = 2;
								
							}
						}
						if (player.rpgAttr.isZeroHPWarning && (!player.isDead && !player.isDying && !player.hasWon)) {
							zerohp += 1;
						}
					});
					if (isInsanePhylum) isInsane = (6);
					switch (this.inGameParameters.mode) {
						case 3: {
							let isInsaneOff = true;
							let isInsaneOn = false;
							let isInsanePrep = false
							
							this.forEachPlayer(player => {
								let block = player.block,
									blob = player.blob;
								if ((player.activeType == 0 && (block.insane.isOn || (block.insane.delay.ready > 0) || (block.insane.delay.in > 0) || (block.insane.delay.out > 0))) ||
									(player.activeType == 1 && (blob.insane.isOn || (blob.insane.delay.ready > 0) || (blob.insane.delay.readyHenshin > 0) || (blob.insane.delay.in > 0) || (blob.insane.delay.out > 0)))) {
									isInsaneOff = false;
									isInsanePrep = true;
								}
								
								//////console.log(blob.insane.delay.ready, this.countdown, this.frames, blob.isEnable)
								
								if ((player.activeType == 0 && (block.insane.isOn)) ||
									(player.activeType == 1 && (blob.insane.isOn))) {
									isInsaneOn = true;
									
								}
								// player.editIH("STATS-SCORE-TEXT", [JSON.stringify({ blob: blob.insane.delay, block: block.insane.delay }).replace(/,/gm, "\n"), this.woiMode.time]);
								
								
								//player.editIH("STATS-SCORE-TEXT", [blob.insane.isOn, blob.insane.delay.ready, blob.insane.delay.in, blob.insane.delay.out, blob.insane.isOn || blob.insane.delay.ready > 0 || blob.insane.delay.in > 0 || blob.insane.delay.out > 0 ])
							});
							//////console.log(isInsane)
							if (isInsaneOn) {
								if (this.woiMode.timeDelay >= 0) {
									this.woiMode.timeDelay -= 1;
								}
								this.timer.increment((this.woiMode.timeDelay > 0) ? 0 : -1);
								
							}
							
							this.timer.update();
							if (isInsanePrep) {
								isInsane = this.frames > 32 ? (this.isPhylum ? (this.woiMode.rounds > 0 ? 8 : 6) : 1) : 0;
							}
							if (isInsaneOff) {
								if (this.woiMode.time >= 0) {
									this.woiMode.time--;
									isInsane = this.isPhylum ? (7) : 3;
								}
							} else if (this.woiMode.time < (4 * this.FPS)) {
								this.woiMode.time = 4 * this.FPS;
							}
							if (this.woiMode.time == (4 * this.FPS) - 2) {
								sound.play("wormhole_ready");
								this.playAnimation("mswhready");
								ihelem(this.matchSignal.html.start, "Get ready...");
								this.forEachPlayer(player => {
									if (!player.isDead) {
										player.woiWormhole.engage(0);
									}
									player.woi.damageSent = ~~((player.activeType == 0 ? (player.block.garbageConversion(player.woi.a * 0.75).a * 1) : player.woi.a) / 6);
									//////console.log(player.player + ": " + `${player.woi.damageSent} damage pts`);
								});
								this.woiMode.rounds++;
							}
							
							if (this.woiMode.time == (0 * this.FPS)) {
								sound.play("wormhole_blast");
								//sound.play("wormhole_loop");
								sound.stop("wormhole_ready");
								this.woiMode.loopRate = 1.017;
								
								this.playAnimation("mswhstart");
								ihelem(this.matchSignal.html.start, "The Wormhole!");
								
								this.woiMode.isEvaluation = true;
								this.woiMode.shoot = -50;
								this.forEachPlayer(player => {
									if (player.isDead) return;
									if (player.woi.damageSent <= 0) {
										player.woiWormhole.engage(2);
									} else {
										animatedLayers.create(undefined,
											60,
											player.playerCenterPos.x,
											player.playerCenterPos.y,
											0, 0, 0,
											200, 200,
											15,
											15,
											1,
											"wormhole_explosion",
											10,
											3
											
										);
										
										player.playAnimation("fieldShake");
									}
									if (!player.isDead) player.playVoice("wormhole_enter");
								});
							}
							
							if (this.woiMode.isEvaluation) {
								this.woiMode.shoot += Math.min(2, this.woiMode.loopRate - 0.017);
								this.woiMode.loopRate += 0.0173;
								isInsane = this.isPhylum ? (7) : 3;
								
								if (this.woiMode.shoot >= 10) {
									this.woiMode.shoot -= 10;
									let attacks = {};
									let blocks = {};
									let isCounter = false;
									let isAttack = false;
									
									this.forEachPlayer(player => {
										if (player.woi.damageSent > 0) {
											attacks[player.player] = [];
											player.woi.damageSentPerHit = Math.max(Math.min(player.woi.damageSent, ~~(10 * (this.targetPointSystem.initial / this.targetPointSystem.targetPoint))), 0);
											blocks[player.player] = player.woi.damageSentPerHit;
											
											player.woi.damageSent -= player.woi.damageSentPerHit;
											
											if (player.woi.damageSent < 0 || player.woi.damageSent == 0) {
												
												player.woi.damageSent = 0;
												player.woiWormhole.engage(2);
												player.stopAnimation("fieldShake");
											} else {
												
											}
											//////console.log(`${player.player} ${player.woi.damageSent}`)
											this.forEachPlayer(opponent => {
												if (opponent.team !== player.team && player.player !== opponent.player && !opponent.isDead) attacks[player.player].push(opponent.player);
											});
											
										}
									});
									let rx = (this.cellSize * ((Math.random() * 5) - (Math.random() * 5)));
									let ry = (this.cellSize * ((Math.random() * 5) - (Math.random() * 5)));
									this.forEachPlayer(player => {
										let isBlock = false;
										
										if ((player.player in attacks) && !player.isDead) {
											//isAttack = true;
											for (let nb of attacks[player.player]) {
												//////console.log(`PLAYER${nb}`)
												let bez = {
													x1: 0,
													x2: 0.1,
													x3: 1.9,
													x4: 1,
													y1: 0,
													y2: 0,
													y3: 0.9,
													y4: 1,
												};
												
												let asset = player.assetRect("FIELD-INSANE-CANVAS");
												let sizemult = 1;
												let aw = asset.width;
												let ah = asset.height;
												let ax = asset.x;
												let ay = asset.y;
												let particleSpeed = 40;
												let lx = this.resolution.w / 2;
												let ly = this.resolution.h / 2;
												
												let dmg = player.woi.damageSentPerHit;
												
												let cs = player.fieldCellSize;
												let particleColor = player.player;
												sound.play("wormhole_transmit");
												if (nb in blocks) {
													
													
													let dmgNeut = blocks[nb];
													let dmgSent = player.woi.damageSentPerHit;
													dmg = Math.max(0, dmgSent - dmgNeut);
													let opp = nb;
													// lx += rx
													ly += ry;
													this.addDelayHandler(particleSpeed, () => {
														//sound.play("wormhole_block");
													});
													
													if (dmg > 0) {
														isCounter = true;
														this.addDelayHandler(particleSpeed, () => {
															
															this.forEachPlayer(opponent => {
																if (opp === opponent.player) {
																	player.woi.damageInflicted += dmg;
																	opponent.woi.damageReceived += dmg;
																	
																	let target = opponent.assetRect("FIELD-CHARACTER-CANVAS");
																	let gw = target.width;
																	let gh = target.height;
																	let gx = target.x;
																	let gy = target.y;
																	
																	let mlx = gx + (gw / 2) + (this.cellSize * ((Math.random() * 5) - (Math.random() * 5)));
																	let mly = gy + (gh / 2) + (this.cellSize * ((Math.random() * 5) - (Math.random() * 5)));
																	this.addDelayHandler(particleSpeed, () => {
																		opponent.rpgAttr.addHP(-dmg);
																		sound.play("wormhole_hit");
																		opponent.simulateWMWShakeIntensityHit();
																		animatedLayers.create(undefined, 30,
																			mlx,
																			mly,
																			0,
																			0,
																			0,
																			200,
																			200,
																			5,
																			5,
																			0.5,
																			`${player.activeType == 1 ? "blob" : "block"}_hit`,
																			10,
																			2
																		);
																	});
																	player.addParticle(true, "attack", 0, particleColor + 2,
																		lx,
																		ly,
																		mlx,
																		mly,
																		particleSpeed, 1.3, false, bez, true, {
																			frame: particleSpeed * (0.5),
																			r: 255,
																			g: 255,
																			b: 255,
																		});
																	
																	
																	
																	
																}
															});
														});
													}
													
													
												} else {
													this.forEachPlayer(opponent => {
														if (nb === opponent.player) {
															player.woi.damageInflicted += dmg;
															opponent.woi.damageReceived += dmg;
															let target = opponent.assetRect("FIELD-CHARACTER-CANVAS");
															let gw = target.width;
															let gh = target.height;
															let gx = target.x;
															let gy = target.y;
															
															lx = gx + (gw / 2) + (this.cellSize * ((Math.random() * 5) - (Math.random() * 5)));
															ly = gy + (gh / 2) + (this.cellSize * ((Math.random() * 5) - (Math.random() * 5)));
															this.addDelayHandler(particleSpeed, () => {
																opponent.rpgAttr.addHP(-dmg);
																sound.play("wormhole_hit");
																opponent.simulateWMWShakeIntensityHit();
																animatedLayers.create(undefined, 30,
																	lx,
																	ly,
																	0, 0, 0,
																	
																	200,
																	200,
																	5,
																	5,
																	0.5,
																	`${player.activeType == 1 ? "blob" : "block"}_hit`,
																	10,
																	2
																);
															});
															
														}
													});
													
												}
												
												
												player.addParticle(true, "attack", 0, particleColor + 2,
													ax + (aw / 2),
													ay + (ah / 2),
													lx,
													ly,
													particleSpeed, 1.3, false, bez, true, {
														frame: particleSpeed * (0.8),
														r: 255,
														g: 255,
														b: 255,
													});
											};
											
											
										}
										
									});
									
									this.forEachPlayer(player => {
										if (player.woi.damageSent > 0) {
											isAttack = true;
										}
										
									})
									if (!isAttack) {
										if (this.woiMode.restart <= 75) this.woiMode.restart = 75;
										//sound.stop("wormhole_loop");
										this.woiMode.isEvaluation = false;
										if (isCounter) {
											if (this.woiMode.restart <= 105) this.woiMode.restart = 105;
											
										}
									} else {
										sound.play("wormhole_transmit");
									}
									
									
									if (!isAttack) {
										
									}
								}
								
							}
							
							if (this.woiMode.restart >= 0) {
								this.woiMode.restart--;
								isInsane = isInsane = this.isPhylum ? (7) : 0;
								
								if (this.woiMode.restart == 0) {
									this.woiMode.isEvaluation = false;
									
									let isStillAlive = {};
									this.forEachPlayer((player) => {
										if (!player.rpgAttr.checkZeroHP() && !player.isDead) {
											isStillAlive[(player.team)] = 0;
										}
									});
									let mn = Object.keys(isStillAlive).length;
									if (mn >= 1) {
										this.woiMode.timeDelay = 1.5 * this.FPS;
										this.timer.set(80 * game.FPS);
									}
									this.forEachPlayer((player) => {
										player.woi.a = 0;
										if (!player.rpgAttr.checkZeroHP()) {
											if (mn > 1) {
												if (player.woi.damageReceived > 0) {
													if (player.woi.damageReceived >= (0.5 * player.rpgAttr.maxHP)) { player.playVoice("wormhole_damage2"); }
													else {
														player.playVoice("wormhole_damage1");
													}
												} else if (player.woi.damageInflicted > 0) {
													if (player.woi.damageInflicted >= (0.5 * player.rpgAttr.maxHP)) { player.playVoice("wormhole_inflict2"); }
													else {
														player.playVoice("wormhole_inflict1");
													}
												}
											} else {
												player.playVoice("wormhole_win");
											}
											
											player.woi.reset();
											if (mn > 1) {
												if (player.activeType == 0) player.block.insane.delay.ready = 50;
												if (player.activeType == 1) player.blob.insane.delay.ready = 50;
											}
										} else if (!player.isDead) {
											player.playVoice("wormhole_lose");
											player.phaseLose("break");
											player.playSound("wormhole_break");
											//TODO rewrite
										}
									});
								}
								
								
								
								
								
								
								
								
							}
							break;
							
						}
					}
					
					
					this.runDelayHandler();
					
					let teamsAliveArr = Object.keys(teamsAlive),
						teamAliveCount = teamsAliveArr.length;
					let playerWin = 0;
					let hasMaxPointsWinner = false;
					let isChain = false
					this.forEachPlayer(player => {
						if (teamAliveCount == (this.isSolo ? 0 : 1) && !player.isWin && player.team in teamsAlive) {
							
							player.isWin = true;
							player.block.piece.enable = 0;
							
							player.blob.piece.enable = 0;
							
							player.block.isActive = 0;
							
							player.blob.isActive = 0;
							this.isRoundActive = false;
						}
						if (player.isDying && !player.isFinishAble && !player.isDead && !player.isWin) {
							player.block.piece.enable = 0;
							
							player.blob.piece.enable = 0;
							
							player.block.isActive = 0;
							
							player.blob.isActive = 0;
							
							player.blob.isEnable = 0;
							player.block.isEnable = 0;
							if (player.rpgAttr.isRPG) player.rpgAttr.isUsableSkills = false;
							if (hasChainOngoing && !(player.team in this.gameRunningParameters.hasChain)) {
								player.isDead = false;
								player.isFinishAble = true;
								
							} else if (!player.isFinishAble) {
								player.phaseLose();
							}
						}
						if (player.team in teamsAlive && player.isWin && !player.hasWon && !hasChainOngoing && !isStillFinishable && !(player.team in this.gameRunningParameters.hasChain)) {
							/*player.switchModeType(0);
							player.reset();
							player.block.spawnPiece(0);*/
							player.block.piece.enable = 0;
							
							player.blob.piece.enable = 0;
							
							player.block.isActive = 0;
							
							player.blob.isActive = 0;
							if (player.rpgAttr.isRPG) player.rpgAttr.isUsableSkills = false;
							
							player.hasWon = true;
							if (!player.isDead) {
								player.playEmAnimation("win");
								player.engagePlaycharExt("result");
								player.editIH("PLAYCHAR-TEXT", "Yeah!");
							}
							//////console.log("PLAYER WIN: " + player.player);
							//player.phaseLose();
							
							
							
							playerWin++;
							this.inGameParameters.players[player.player].wins++;
							if (this.inGameParameters.players[player.player].wins >= this.inGameParameters.maxWins) {
								hasMaxPointsWinner = true;
							}
						}
						
						
					});
					
					if (!this.isRoundNext && (this.isSolo ? 0 : 1) >= teamAliveCount && !hasChainOngoing && !isStillFinishable) {
						//document.write("STAPH")
						this.roundNextTime = 170;
						if (this.isSolo || hasMaxPointsWinner) {
							if (!this.replay.isOn && !this.matchEndHandler.isFinishActual) {
								this.matchEndHandler.isFinishActual = true;
							}
							
							this.isFinish = true;
							this.winnerDeclaration.winners.length = 0;
							this.winnerDeclaration.losers.length = 0;
							if (hasMaxPointsWinner) {
								
								this.forEachPlayer(player => {
									
									if (this.inGameParameters.players[player.player].wins >= this.inGameParameters.maxWins) this.winnerDeclaration.winners.push(player);
									else this.winnerDeclaration.losers.push(player);
									
								});
								
							}
						}
						let loseNotReady = 0;
						this.forEachPlayer(player => {
							if (!player.isLosePlayed && player.isDead) loseNotReady++;
						});
						
						
						if (loseNotReady == 0) {
							
							this.isRoundNext = loseNotReady == 0;
						}
					}
					if (this.isRoundNext && this.roundNextTime >= -1) {
						let playerDoneLose = true;
						this.forEachPlayer(player => {
							if (player.checkVoicePlaying("lose")) playerDoneLose = false;
						});
						
						if (playerDoneLose) this.roundNextTime--;
						
						if (this.roundNextTime == 168) {
							this.forEachPlayer((player) => {
								if (player.hasWon) {
									if (player.isCompact) {
										ihelem(player.getAsset("WINS-TEXT"), player.wins + 1);
									}
									if (!player.isDead) {
										player.playVoice("win");
									}
								}
							});
							
							if (game1v1.on) {
								this.forEachPlayer(player => {
									if (!(player.hasWon && !player.isDead)) return;
									if (player.player == 0) {
										
										game1v1.winstat.setWins("left", player.wins + 1, true);
									}
									if (player.player == 1) {
										
										game1v1.winstat.setWins("right", player.wins + 1, true);
									}
								});
							}
							//needs simplification 
							if (this.replay.isOn) {
								if ((this.replay.replaysIndex + 1) >= this.replay.replays.length) {
									this.matchEndHandler.on = true;
								}
							} else if (this.matchEndHandler.isFinishActual) {
								this.matchEndHandler.on = true;
								
							}
							
							if (this.winnerDeclaration.winners.length > 0) {
								this.forEachPlayer(player => {
									player.playcharExt.anim.fadeout.play();
									player.setStyle("PLAYCHAR-TEXT-DIV", "opacity", "0%");
								});
								this.winnerDeclaration.frames = 50;
							}
							
							
							//this.roundNextTime = -3993;
						}
						
						if (this.roundNextTime == 6) {
							if (this.replay.isOn) {
								
							}
							if (this.matchEndHandler.on) {
								this.endGame();
								if (isOnline) {
									let wr = online.createWriter("MATCH_END", 0);
									online.send(wr.buffer);
								}
								this.roundNextTime = -9999;
							} else {
								this.playAnimation("fadein");
								style("GTRIS-OVERLAY", "background", "#000");
								//this.playAnimation("fadelayout");
							}
							
							this.woiMode.loopRate = -1;
							
						}
						if (this.roundNextTime == 0) {
							
							if (!this.matchEndHandler.on) {
								this.initializeNext(this.replay.isOn);
							}
							this.isRoundNext = false;
						}
					}
					
					if (this.winnerDeclaration.frames >= 0) {
						switch (this.winnerDeclaration.frames) {
							case 30: {
								for (let player of this.winnerDeclaration.winners) {
									player.playcharExt.anim.windeclare.play();
									player.setStyle("PLAYCHAR-TEXT-DIV", "opacity", "100%");
									player.editIH("PLAYCHAR-TEXT", language.translate("result_match_win"));
								}
								for (let player of this.winnerDeclaration.losers) {
									player.playcharExt.anim.losedeclare.play();
									player.setStyle("PLAYCHAR-TEXT-DIV", "opacity", "100%");
									player.editIH("PLAYCHAR-TEXT", language.translate("result_match_lose"));
								}
								break;
							}
							case 15: {
								if (this.winnerDeclaration.losers.length > 0) sound.play("blub_garbage2")
								break;
							}
							case 0: {
								if (this.winnerDeclaration.winners.length > 0) sound.play("allclear");
								break;
							}
						}
						
						this.winnerDeclaration.frames--;
						
					}
					
					
				}
				
				this.loopParams.isInsane = isInsane;
			this.loopParams.zerohp = zerohp;
			}
			} while(isRepeat);
			
			game1v1.run();
			particle.refresh();
			htmlEffects.run();
			this.forEachPlayer(player => {
				player.runAnimations();
			});
			
			//background.
			
			this.synchroLoop.confirmIsAsync = !this.isRunning;
			
			for (let h = 0, m = this.animationNames.length; h < m; h++)
				this.animations[this.animationNames[h]].run();
			
			
			if (this.woiMode.loopRate >= 0) {
				this.woiMode.loopRate -= 0.017;
				sound.rate("wormhole_loop", this.woiMode.loopRate);
			}
			
			
			
		}
		this.runDelayHandler(true);
		this.numberExecHandlers.wormholeLoop.assign(!this.pause.on && this.woiMode.loopRate > 0 ? 1 : 0);
		this.numberExecHandlers.insaneMFX.assign(this.loopParams.isInsane);
		this.numberExecHandlers.zerohp.assign(this.loopParams.zerohp);
		
		log.run();
	}
	
	pauseGame() {
		if (this.pause.on || !this.isGameLoaded || (this.online.isOn && !this.replay.isOn)) return;
		this.pause.on = true;
		if (this.replay.isOn) touchButtons.enableControllers(true);
		menu.changeMenu(this.replay.isOn ? JSON.stringify(menu.pauseReplaySels) : JSON.stringify(menu.pauseSels), false);
		menu.showMenu(true);
		this.synchroLoop.confirmIsAsync = true;
	}
	
	unpauseGame() {
		if (!this.pause.on || !this.isGameLoaded) return;
		this.pause.frame = 50;
		if (this.replay.isOn) touchButtons.enableControllers(false);
		//menu.changeSelectables(menu.pauseSels);
		menu.showMenu(false);
		//this.synchroLoop.confirmIsAsync = true;
	}
	
	playAnimation(h) {
		this.animations[h].play();
	}
	
	resetAnimations() {
		for (let h = 0, m = this.animationNames.length; h < m; h++)
			this.animations[this.animationNames[h]].reset();
	}
	
	
}();
const game = manager;
const keypressManager = new class {
	#listeners = {};
	constructor() {
		/*
		   pause: 27,
		    LEFT: 37,
		    RIGHT: 39,
		    SOFTDROP: 40,
		    HARDDROP: 32,
		    HOLD: 67,
		    CW: 88,
		    CCW: 90,
		    C180W: 16,
		    retry: 82,
		    */
		this.isKeyBindingMode = false;
		this.pressedKeys = {};
		this.BIND_NAMES = {
			0: ["left", "right", "softdrop", "harddrop", "hold", "cw", "ccw", "c180w", "s1", "s2", "s3"],
			1: ["left", "right", "softdrop", "harddrop", "cw", "ccw", "s1", "s2", "s3"],
			general: ["pause", "restart"]
		}
		/*this.bindsDefault = {
			0: {
				left: "arrowleft",
				right: "arrowright",
				softdrop: "arrowdown",
				harddrop: " ",
				hold: "c",
				cw: "arrowup",
				ccw: "x",
				c180w: "shift",
				s1: "1",
				s2: "2",
				s3: "3",
			},
			1: {
				left: "arrowleft",
				right: "arrowright",
				softdrop: "arrowdown",
				harddrop: "arrowup",

				cw: "x",
				ccw: "z",
				c180w: "shift",

				s1: "1",
				s2: "2",
				s3: "3",

			},
		};/**/
		this.bindsDefault = {
			0: {
				arrowleft: "left",
				arrowright: "right",
				arrowdown: "softdrop",
				arrowup: "cw",
				" ": "harddrop",
				c: "hold",
				x: "ccw",
				z: "c180w",
				"1": "s1",
				"2": "s2",
				"3": "s3",
			},
			1: {
				arrowleft: "left",
				arrowright: "right",
				arrowdown: "softdrop",
				arrowup: "harddrop",
				x: "cw",
				z: "ccw",
				"1": "s1",
				"2": "s2",
				"3": "s3",
			},
			general: {
				"escape": "pause",
				"r": "restart"
			},
			
		}
		
		this.binds = JSON.parse(JSON.stringify(this.bindsDefault));
		
		for (let aa in this.bindsDefault) {
			this.binds[aa] = {};
			for (let ab in this.bindsDefault[aa]) {
				this.binds[aa][ab] = this.bindsDefault[aa][ab];
				/*for (let ac of this.bindsDefault[aa][ab].split('||')) {
					this.binds[aa][ab][ac] = 1;
				}*/
			}
		}
		this.lastKeys = {};
		//////console.log(this.binds)
		this.flags = {
			left: {
				up: "a",
				down: "A"
			},
			right: {
				up: "b",
				down: "B"
			},
			softdrop: {
				up: "c",
				down: "C"
			},
			harddrop: {
				up: "d",
				down: "D"
			},
			hold: {
				up: "e",
				down: "E"
			},
			ccw: {
				up: "f",
				down: "F"
			},
			cw: {
				up: "g",
				down: "G"
			},
			c180w: {
				up: "h",
				down: "H"
			},
			s1: {
				up: "1n",
				down: "1N"
			},
			s2: {
				up: "2n",
				down: "2N"
			},
			s3: {
				up: "3n",
				down: "3N"
			},
			
		};
		this.STRING_SEPARATOR = "/\uFFFF\uFFFF/";
		this.isTyping = false;
		this.evtTypeInt = {
			keydown: 1,
			keyup: 0
		};
	}
	keyGeneral(code, type) {
		if (code in this.binds.general) {
			if (type === "keydown") {
				switch (this.binds.general[code]) {
					case "pause": {
						game.pauseGame();
						break;
					}
				}
			}
			return true;
		}
		return false;
	}
	keyFlag(code, categ) {
		if (code) {
			
			/*for (let r = Object.keys(this.flags)[0], f = 0, g = Object.keys(this.flags).length; f < g; f++, r = Object.keys(this.flags)[f]) {
				if (r in this.binds[categ])
					if (code in this.binds[categ][r]) {

						if (this.binds[categ]?.[r] || true) {
							return this.flags[r][["down", "up"][type]];
						}
					}
			}*/
			if (code in this.binds[categ]) {
				if (this.binds[categ][code] in this.flags) {
					let flag = game.bitFlags[this.binds[categ][code]];
					return flag;
				}
				
			}
		}
		return "";
	}
	addListener(id, func) {
		if ((id in this.#listeners)) return;
		this.#listeners[id] = (k, t) => {
			func(k, t);
		}
	}
	removeListener(id) {
		if (!(id in this.#listeners)) return;
		delete this.#listeners[id];
	}
	setupKeybinds() {
		let data = menu.storage.getItem("keyboard");
		for (let aa in data) {
			this.binds[aa] = {};
			for (let ab in data[aa]) {
				let arr = data[aa][ab].split(this.STRING_SEPARATOR);
				for (let ac of arr) {
					this.binds[aa][ac] = ab;
				}
				/*for (let ac of this.bindsDefault[aa][ab].split('||')) {
					this.binds[aa][ab][ac] = 1;
				}*/
			}
		}
	}
	listen(evt) {
		let key = evt.key.toLowerCase();
		if ([" ", "arrowleft", "arrowright", "arrowup", "arrowdown"].indexOf(key) !== -1)
			evt.preventDefault();
		if (!(key in this.lastKeys)) {
			this.lastKeys[key] = evt.type;
		} else if (this.lastKeys[key] !== evt.type) {
			this.lastKeys[key] = evt.type;
		} else return;
		/*if (evt.type === "keydown") {
		 switch (evt.keyCode) {
		  case gameStorage.currentSettings.binds.pause: {
		   this.checkTextAreaOut(evt, () => {
		    gameManager.pauseGame(!gameManager.isPaused);
		   });
		   break;
		  }
		  case gameStorage.currentSettings.binds.retry: {
		   this.checkTextAreaOut(evt, () => {
		    gameManager.prepareInitialization(gameManager.mode);
		   });
		   break;
		  }
		 }
		}*/
		
		for (let gn in this.#listeners) {
			this.#listeners[gn](key, evt.type);
		}
		if (this.isTyping) return
		if (this.isKeyBindingMode) return;
		if (game.startGameParameters.frame > 0) return;
		if (splash.isActive) {
			splash.nextSlide();
		}
		else if (fsw.isShown) {
			fsw.keyInput(key, evt.type);
		} else if (!menu.isMenu)
			do {
				if (this.keyGeneral(key, evt.type)) break;
				let player = manager.players[manager.activePlayer];
				let flag = this.keyFlag(key, player.activeType);
				//////console.log(evt.key, flag)
				manager.typeInput(flag, this.evtTypeInt[evt.type]);
				
			} while (false);
		else if (menu.characterMenu.isActive) {
			if (evt.type == "keydown") menu.characterMenu.controlsListen((key));
		} else if (menu.isMenu) {
			let ms = (evt.type).replace(/key/gmi, "");
			//if (key === "arrowdown") menu.controlsListen("down");
			switch (`${key}`) {
				case "arrowdown":
					menu.controlsListen("down", ms);
					break;
				case "arrowup":
					menu.controlsListen("up", ms);
					break;
				case "arrowleft":
					menu.controlsListen("left", ms);
					break;
				case "arrowright":
					menu.controlsListen("right", ms);
					break;
				case "enter":
					menu.controlsListen("a", ms);
					break;
				case "backspace":
					menu.controlsListen("b", ms);
					break;
			}
		}
	}
	defaultToSortedJSON() {
		let json = {
			0: {},
			1: {},
			general: {}
		};
		for (let m in this.bindsDefault) {
			for (let k in this.bindsDefault[m]) {
				if (!(this.bindsDefault[m][k] in json)) json[m][this.bindsDefault[m][k]] = [];
				json[m][this.bindsDefault[m][k]].push(k);
				//json[m][this.bindsDefault[m][k]] += ;
				//json[m][this.bindsDefault[m][k]] = mk.join(this.STRING_SEPARATOR);
			}
			
			
		}
		let fjson = {
			0: {},
			1: {},
			general: {}
		};
		for (let m in json) {
			for (let k in json[m]) {
				fjson[m][k] = json[m][k].join(this.STRING_SEPARATOR);
				//json[m][this.bindsDefault[m][k]] += ;
				//json[m][this.bindsDefault[m][k]] = mk.join(this.STRING_SEPARATOR);
			}
			
			
		}
		return fjson;
	}
}();

const htmlEffects = new class {
	constructor() {
		this.main = $("GTRIS-HTMLEFF-SCREEN");
		this.a = new ArrayFunctionIterator((at) => {
			for (let ptl = 0; ptl < at.length; ptl++) {
				let pl = at[ptl];
				let element = pl.element,
					parent = element.parentNode;
				pl.frame++;
				if (pl.frame < pl.maxf) styleelem(element, "animation-delay", `${~~((1000 / (60 * (-1))) * Math.min(pl.maxf, pl.frame))}ms`);
				else {
					this.main.removeChild(element);
					at.splice(ptl, 1);
					ptl--;
					
				}
			}
		});
	}
	
	add(text, posX, posY, frame, animation, style, id) {
		//let parent = document.createElement("GTRIS-HTMLEFF-PARENT")
		let a = document.createElement("GTRIS-HTMLEFF-ELEM");
		a.innerHTML = text;
		a.style = style;
		a.style.position = "absolute";
		a.style.transform = `translateX(var(--tx)) translateY(var(--ty))`;
		a.style.setProperty("--tx", posX + "px");
		a.style.setProperty("--ty", posY + "px")
		a.style["animation-name"] = animation.name;
		styleelem(a, "animation-duration", `${~~((1000 / (60)) * Math.max(0, frame))}ms`);
		styleelem(a, "animation-iteration-count", animation.iter);
		styleelem(a, "animation-timing-function", animation.timefunc);
		styleelem(a, "animation-delay", animation.initdel || 0);
		styleelem(a, "animation-play-state", "paused");
		
		//parent.appendChild()
		this.main.appendChild(a);
		this.a.addItem({
			element: a,
			frame: 0,
			maxf: frame
		});
	}
	run() {
		this.a.update();
	}
}();

__main_params__.__private.game = manager;
__main_params__.__private.keypressManager = keypressManager;
__main_params__.__private.htmlEffects = htmlEffects;

__main_params__.handle.__setHandle = () => {
	////////console.log(game)
	window.addEventListener("resize", () => {
		game.resize();
		window.requestAnimationFrame(() => {
			game.resize();
		})
	}, false);
	window.addEventListener("blur", () => {
		audioMaster.suspendResume(true);
	});
	window.addEventListener("focus", () => {
		audioMaster.suspendResume(false);
	});
	
	
	game.resize();
	game.initGame();
	for (let a of ["keydown", "keyup"]) window.addEventListener(a, (evt) => {
		keypressManager.listen(evt);
	});
	window.onerror = ((event, source, lineno, colno, error) => {
		
		//console.warn(event, source, lineno, colno, error);
		log.error_program(event, source, lineno, colno, error);
		//alert(`At ${source}, ${lineno}:${colno}, there is ${[`a`,`e`,`i`,`o`,`u`].indexOf(event.toLowerCase().charAt(0)) !== -1?'an':'a'} ${event}. If you see this error mesage, contact the Gachatris developer.`)
		
	})
	
};

//fileLayer: online
class BinaryWriter {
	constructor(bytes) {
		this.buffer = new ArrayBuffer(bytes);
		this.view = new DataView(this.buffer);
		this.offset = 0;
	}
	i8(value) {
		this.view.setInt8(this.offset, value);
		this.offset += 1;
	}
	i16(value) {
		this.view.setInt16(this.offset, value, true);
		this.offset += 2;
	}
	i32(value) {
		this.view.setInt32(this.offset, value, true);
		this.offset += 4;
	}
	u8(value) {
		this.view.setUint8(this.offset, value);
		this.offset += 1;
	}
	u16(value) {
		this.view.setUint16(this.offset, value, true);
		this.offset += 2;
	}
	u32(value) {
		this.view.setUint32(this.offset, value, true);
		this.offset += 4;
	}
	f32(value) {
		this.view.setFloat32(this.offset, value, true);
		this.offset += 4;
	}
	f64(value) {
		this.view.setFloat64(this.offset, value, true);
		this.offset += 8;
	}
	string(value, lentype = 8) {
		
		let enc = new TextEncoder().encode(value);
		this[`u${lentype}`](enc.byteLength);
		for (let h = 0; h < enc.byteLength; h++) {
			//console.log(enc[h])
			this.u8(enc[h]);
		}
	}
	
}

class BinaryReader {
	constructor(buffer) {
		this.buffer = buffer;
		this.view = new DataView(buffer);
		this.offset = 0;
	}
	i8() {
		let a = this.view.getInt8(this.offset);
		this.offset += 1;
		return a
	}
	i16() {
		let a = this.view.getInt16(this.offset, true);
		this.offset += 2;
		return a
	}
	i32() {
		let a = this.view.getInt32(this.offset, true);
		this.offset += 4;
		return a
	}
	u8() {
		let a = this.view.getUint8(this.offset);
		this.offset += 1;
		return a
	}
	u16() {
		let a = this.view.getUint16(this.offset, true);
		this.offset += 2;
		return a
	}
	u32() {
		let a = this.view.getUint32(this.offset, true);
		this.offset += 4;
		return a
	}
	f32() {
		let a = this.view.getFloat32(this.offset, true);
		this.offset += 4;
		return a
	}
	f64() {
		let a = this.view.getFloat64(this.offset, true);
		this.offset += 8;
		return a
	}
	string(lentype = 8) {
		let l = this[`u${lentype}`]();
		
		let u = new Uint8Array(this.buffer).subarray(this.offset, l + this.offset);
		let a = new TextDecoder().decode(u);
		this.offset += l;
		return a;
	}
}


const online = new class {
	locator = window.location;
	#urls = [`ws://localhost:27200`];
	#socket = {};
	userID = null;
	roomID = null;
	userPos = 0;
	isOnline = false;
	isReady = false;
	isPrepared = false;
	#channels = {
		SERVER_CONNECT: 0,
		SERVER_LOGIN: 1,
		SERVER_CLOSE: 2,
		INITIALIZE_MATCH: 3,
		START_QUICK_MATCH: 4,
		STOP_QUICK_MATCH: 5,
		MATCH_PREPARE: 6,
		MATCH_END: 7,
		PLAYER_INPUT: 8,
	};
	selectedCharacter = {
		character: 0,
		version: 0
	}
	#events = {
		
		LOAD: 0,
		ROUND_END: 1,
		ROUND_NEXT: 2,
		MATCH_END: 3,
		DISCONNECT: 4,
	}
	#uit = {
		8: 1,
		16: 2,
		32: 4,
		64: 8
	};
	
	playerPos = -1;
	
	matchPlayers = {};
	
	Player = class {
		constructor(parent) {
			this.parent = parent;
			this.id = "0";
			this.visualPos = 0;
			this.parameters = {};
		}
	};
	
	User = class {
		constructor(parent) {
			this.parent = parent;
			this.id = "0";
			this.playerPos = 0;
			this.parameters = {};
		}
	};
	
	constructor() {
		this.isPrep = false;
	}
	
	createWriter(channel, byte) {
		let wr = new BinaryWriter(byte + 1);
		wr.u8(this.#channels[channel]);
		return wr;
	}
	
	emit(channel, data) {
		let byteLength = 1;
		for (let h = 0; h < data.length; h++) {
			let ref = data[h];
			let endsWith = ref[0].split("");
			let byteFromType = endsWith[endsWith.length - 1];
			if (byteFromType == "g") {
				byteLength += new TextEncoder().encode(ref[1]).length + (this.#uit[ref?.[2] || 8]);
				//console.log(new TextEncoder().encode(ref[1]))
			}
			if (byteFromType == "8") {
				byteLength += 1;
			}
			if (byteFromType == "6") {
				byteLength += 2;
			}
			if (byteFromType == "2") {
				byteLength += 4;
			}
			if (byteFromType == "4") {
				byteLength += 8;
			}
		}
		
		let wr = new BinaryWriter(byteLength);
		wr.u8(this.#channels[channel]);
		for (let h = 0; h < data.length; h++) {
			
			let ref = data[h];
			//console.log(wr.offset, ref[0], ref[1])
			wr[ref[0]](ref[1], ref?.[2] || 8);
		}
		this.send(wr.buffer);
	}
	emitEvent(event, byte) {
		let wr = new BinaryWriter(2 + byte);
		wr.u8(this.#channels.PLAYER_EVENTS);
		wr.u8(this.#events[event]);
		
		return wr;
	}
	
	send(data) {
		if (this.#socket) this.#socket.send(data);
	}
	
	init() {
		
	}
	close() {
		if (this.#socket) {
			this.#socket.close();
			
		}
	}
	
	prepReady() {
		let wr = new BinaryWriter(1);
		wr.u8(this.#channels.ROOM_USER_READY);
		this.#socket.send(wr.buffer);
		
	}
	
	enterRoom() {
		//let code = docId("guiTextarea-roomname").value.replace(/ /gmi, "");
		if (code.length < 4) return;
		let ols = [
			[
				"string",
				code,
				16
			],
			[
				"string",
				selectedSettings.Names.Main,
				8
			],
			[
				"u16",
				selectedSettings.NonIterable.Character
			],
		];
		for (let g of ["DAS", "ARR", "SFT"]) {
			ols.push(["u16", selectedSettings.Tuning[g]]);
		}
		this.emit("ROOM_JOIN", ols);
	}
	
	connect(callback, closeCallback) {
		let tries = 0;
		let urls = this.#urls;
		let sj = prompt("Enter websocket address (port 27200) (e.g. 192.168.1.1:27200)", "localhost")
		urls = [`wss://${sj}`, `ws://${sj}`, ...this.#urls]

		let j = () => {
			//console.log("trying " + [urls[tries]])
			this.#socket = new WebSocket(urls[tries]);
			this.#socket.binaryType = "arraybuffer";
			let isOpen = false;
			let isAlreadyResponded = false;
			let isCheck = false;
			this.#socket.onerror = (err) => {
				//console.log(urls[tries], "ERROR", err.target.status);
				this.#socket.close();
			}
			for (let j in this.matchPlayers) delete this.matchPlayers[j];
			this.#socket.onopen = (e) => {
				isOpen = true;
				isCheck = true;
				
				callback(1, e);
				//console.log(this.emit)
				this.emit("SERVER_CONNECT", []);
				
				
			}
			this.#socket.onclose = (e) => {
				//callback(0, e, isOpen);
				if (!isCheck) {
					tries++;
					if (tries < 4) j();
					else {
						console.error("Failed to connect to server");
						closeCallback(500);
					}
					return;
				}
				this.isOnline = false;
				this.isReady = false;
				this.isPrepared = false;
				
				
				this.#socket = null;
			}
			this.#socket.onmessage = (e) => {
				//console.log(new Uint8Array(e.data))
				let rd = new BinaryReader(e.data);
				//console.log(new Uint8Array(e.data))
				let type = rd.u8();
				switch (type) {
					case 0: {
						let userID = rd.string(16);
						this.userID = userID;
						this.isOnline = true;
						break;
					}
					case this.#channels.MATCH_PREPARE: {
						this.isReady = true;
						game.online.frames = {};
						break;
					}
					case this.#channels.PLAYER_INPUT: {
						//console.log(new Uint8Array(rd.buffer));
						let frame = rd.u32();
						let count = rd.u8();
						
						
						if (!(frame in game.online.frames)) {
							game.online.frames[frame] = {};
						}
						let sh = game.online.frames[frame];
						for (let h = 0; h < count; h++) {
							let pos = rd.u8();
							let press = rd.u16();
							if (pos !== this.userPos) {
								let vis = this.matchPlayers[pos].visualPos;
								sh[vis] = press;
							}
							
						}
						
						
						//let p = [rd.string(8), rd.u16()];
						//$iH("guiText-or-rname", code);
						
						//switchMenu(15, true, gtris_transText("online_room"), "startPoint");/
						
						break;
					}
					case this.#channels.INITIALIZE_MATCH: {
						game.online.isOn = true;
						
						this.isReady = false;
						this.isRunning = true;
						
						let matchID = rd.string(16);
						let parameters = JSON.parse(rd.string(16));
						let curParams = {
							maxWins: 1,
							mode: 1,
							seed: 0
						};
						if ("maxWins" in parameters) {
							curParams.maxWins = parameters.maxWins;
						}
						
						if ("mode" in parameters) {
							curParams.mode = parameters.mode;
						}
						if ("seed" in parameters) {
							curParams.seed = parameters.seed;
						}
						
						game.seeds.round.seed = curParams.seed;
						
						let count = rd.u8();
						
						let order = [];
						
						let activePos = menu.storage.getValueFromRangeListSpecific("set_online_boardpos");
						
						let visualOrder = {};
						let voIndex = 0;
						let identifiedPos = 0;
						this.matchPlayers = {};
						
						for (let h = 0; h < count; h++) {
							let pos = rd.u8();
							let id = rd.string(16);
							
							let name = rd.string(16);
							let character = rd.u8();
							let version = rd.u8();
							let mode = rd.u8();
							
							
							
							let player = new this.Player(this);
							player.parameters = {
								name: name,
								character: character,
								version: version,
								mode: mode
							}
							player.id = id;
							player.visualPos = pos;
							
							if (id == this.userID) {
								identifiedPos = pos;
							} else {
								let _char = gtcharacter.characters[character];
								let char = language.charTranslate(_char.core.name);
						
								log.notification("Match found", `${name} (${char}) has entered the session.`);

							}
							
							this.matchPlayers[pos] = player;
							
							
						}
						
						let isOccupied = {};
						let isCurrent = {};
						let sn = 0;
						let matchPlayers = Object.keys(this.matchPlayers);
						for (let h = 0; h < matchPlayers.length; h++) {
							let _g = matchPlayers[h];
							if (_g == identifiedPos) {
								
								let g = activePos;
								visualOrder[g] = (_g);
								this.matchPlayers[_g].visualPos = g;
								isCurrent[_g] = 1;
								isOccupied[g] = 1;
							} else {
								sn++;
							}
						}
						{
							let i = 0; // board
							let t = 0; // player
							while (sn >= t) {
								if (!(t in isCurrent)) {
									if (i in isOccupied) {
										i++;
									} else {
										visualOrder[i] = t;
										this.matchPlayers[t].visualPos = i;
										t++;
										i++
									}
								} else t++;
								
							}
							
						}
						
						this.userPos = identifiedPos;
						
						let a = game.actualParameters;
						a.mode = curParams.mode;
						a.maxWins = curParams.maxWins;
						
						a.playerOrder = [];
						let gsv = Object.keys(visualOrder);
						for (let h = 0; h < gsv.length; h++) {
							a.playerOrder.push(visualOrder[gsv[h]])
						}
						a.players.length = 0;
						
						for (let u = 0; u < a.playerOrder.length; u++) {
							let h = this.matchPlayers[a.playerOrder[u]].parameters;
							let rpg = {
								hp: 0,
								mana: 0,
								atk: 0,
								def: 0,
								lifesteal: 0,
								lfa: 0,
								deflect: 0,
								cards: {}
							}
							a.players.push(game.createPlayerParam(h.name, 0, h.character, h.version, h.mode, false, rpg));
							////console.log(rpg)
						}
						//log.notification(activePos)
						
						game.activePlayer = ~~activePos;
						
						game.actualParameters.data.maxWins = ~~curParams.maxWins;
					
						game.startGameSet("actual_online");
						
												
						break;
					}
				}
			}
		}
		j();
	}
}();

//fileLayer: onevone
const game1v1 = new class {
	#AnimatedImage = class {
		constructor(image, frame, w, h, bound) {
			this.a = image || new Image();
			//this.frame = 0;
			this.max = frame,
				this.dims = {
					w: w || 100,
					h: h || 100
				}

			this.bound = bound || 10;


		}
	};

	constructor() {
		this.on = false;
		this.dim = {
			w: 1000,
			h: 1000
		}

		this.animatedImages = {};
		this.loaded = false;

		this.overhead = new class {
			constructor(p) {
				this.parent = p;
				this.div = id("OVERLAY-1V1-OVERHEAD");
				this.container = id("OVERLAY-1V1-OVERHEAD-DIV")
				this.canvas = new OffscreenCanvas(1280,100);
				this.ctx = this.canvas.getContext("2d");
				this.width = 100;
				this.height = 10;
				this.aspectRatio = (100 / 1280);
				this.pixelPerCell = 20;
				this.canvasSize = 1280;
				this.canvas.width = this.canvasSize;
				this.canvas.height = this.canvasSize * this.aspectRatio;
				this.isActive = false;
				this.on = false;
				this.maxGarbage = 0;
				this.garbage = 0;
				this.position = 0;
				this.offsetPosition = 0;
				this.supposedPosition = 0.2;
				this.isPlayerTargeted = 0;
				this.timers = [-1, 0, 0];
				this.images = {};
				this.loaded = true
				this.playerImages = {
					left: "f",
					right: "r"
				};

				this.playerColors = {};

				this.spriteDims = {
					w: 1280,
					h: 140
				};

				this.spriteCenterRatio = {
					w: 27,
					h: 200
				};

				this.frame = 0;
			}

			resize(w, h) {
				this.width = w;
				this.height = w * this.aspectRatio;
				styleelem(this.container, "width", `${w}px`);
				styleelem(this.container, "height", `${h}px`);
				let cw = this.width * this.pixelPerCell,
					ch = this.height * this.pixelPerCell;
				/*for (let mh of [this.div, this.canvas]) {
					styleelem(mh, "width", `${this.width}px`);
					styleelem(mh, "height", `${this.height}px`);
				}*/


				//////console.log(1280 * (120/1280))

			}

			run() {
				this.ctx.clearRect(0, 0, 1280, 100);

				if (this.on) {
					let position = this.position + (0.005 * (Math.random())) - (0.005 * (Math.random()));
					let gap = 0;
					let fade = 1;

					this.frame++;

					if (this.frame >= 120) this.frame = 0;

					for (let h = 0; h < 3; h++) {
						let r = this.timers[h];
						if (r > -1) this.timers[h]--;
					}

					if (this.timers[2] >= 0) {
						let mm = Math.max(this.timers[2] - 10, 0) / 15;
						//gap = mm * 1;
						//let off = this.position - this.supposedPosition;
						fade = mm;
						if (this.timers[2] == 0) {
							this.on = false;
							this.isActive = false;
							return;
						}
					}


					if (this.timers[1] >= 0) {
						let mm = Math.max(this.timers[1], 0) / 5;
						//gap = mm * 1;
						//let off = this.position - this.supposedPosition;
						position = this.position + (this.offsetPosition * mm);
					}

					if (this.timers[0] >= 0) {
						let mm = Math.max(this.timers[0] - 5, 0) / 12;
						gap = mm * 1;
						if (this.timers[0] == 0) {
							this.movePos(this.supposedPosition);
							//this.timers[0] = 25;
						}
						position = 0.5;
					}

					this.drawChars((~~this.isPlayerTargeted == 1) ? (1 - position) : position, gap, 5 * Math.random() + 10, fade);
					

				}

			}
			
			drawImageToBG() {
				background.drawImage(this.canvas, 
				0, 0, 1280, 1280 * this.aspectRatio,
				0, 0, 1280, 1280 * this.aspectRatio,
				false
				);
			}

			drawChars(position, gap, y, fade) {
				let ratio = this.spriteCenterRatio.w / this.spriteCenterRatio.h;
				let center = this.parent.getAnimatedImage("overhead_center");
				this.ctx.globalAlpha = fade;
				if (this.playerImages.left in this.images)
					if (this.images[this.playerImages.left].loaded) {
						let img = this.images[this.playerImages.left].a;

						{
							let col = this.playerColors.left;
							this.ctx.fillStyle = `rgb(${col.r},${col.g},${col.b})`;

							this.ctx.fillRect(
								0,
								0,
								~~((position * this.canvasSize) - (gap * this.spriteDims.w)),
								this.canvasSize * this.aspectRatio
							);
						}

						this.ctx.drawImage(img,
							0, y + 10, 1280, 1280 * this.aspectRatio,
							~~((position * this.canvasSize) - (this.spriteDims.w * (gap)) - (this.spriteDims.w)),
							(0),
							this.canvasSize,
							this.canvasSize * this.aspectRatio
						);
					}

				if (this.playerImages.right in this.images)
					if (this.images[this.playerImages.right].loaded) {
						let img = this.images[this.playerImages.right].a;

						{
							let col = this.playerColors.right;
							this.ctx.fillStyle = `rgb(${col.r},${col.g},${col.b})`;

							this.ctx.fillRect(

								~~((position * this.canvasSize) + (gap * this.spriteDims.w)),
								0,
								this.canvasSize - ~~((position * this.canvasSize) + (gap * this.spriteDims.w)),
								this.canvasSize * this.aspectRatio
							);
						}

						this.ctx.drawImage(img,
							0, (1280 * (this.spriteDims.h / 1280)) + y + 10, 1280, 1280 * this.aspectRatio,
							~~((position * this.canvasSize) + (this.spriteDims.w * (gap))),
							(0),
							this.canvasSize,
							this.canvasSize * this.aspectRatio
						);
					}

				if (gap == 0) {
					this.ctx.drawImage(center.a,
						this.spriteCenterRatio.w * (this.frame % center.bound),
						this.spriteCenterRatio.h * ~~(this.frame / center.bound),
						this.spriteCenterRatio.w,
						this.spriteCenterRatio.h,
						((position * this.canvasSize) - ((ratio * this.canvasSize * this.aspectRatio) * (0)) - (ratio * this.canvasSize * this.aspectRatio)),
						0,
						this.canvasSize * ratio * this.aspectRatio,
						this.canvasSize * this.aspectRatio
					)

					this.ctx.fillStyle = `#fff`;
					let mcx = 0.05;
					this.ctx.fillRect(
						0,
						(this.canvasSize * this.aspectRatio) - (this.canvasSize * this.aspectRatio * mcx),
						this.canvasSize,
						this.canvasSize * this.aspectRatio * mcx
					);
				}

				this.ctx.globalAlpha = 1;


			}

			openClose(number, player, garbage, lastGarbage) {
				this.isActive = false;
				switch (number) {
					case 1: {

						this.timers[0] = 25;
						this.timers[1] = 0;
						this.timers[2] = -1;
						this.on = true;
						this.isActive = true;
						this.isPlayerTargeted = player;
						//console.warn(this.isPlayerTargeted + " OPEN")
						this.checkGarbage(player, garbage, lastGarbage);
						//this.supposedPosition = 0.5;

						this.position = 0.5;
						//this.isActive= true;
						break;
					}
					case 2: {

						this.movePos(1.5);
						this.timers[2] = 25;
						break;
					}
					case 3: {

						this.movePos(-0.5);
						this.timers[2] = 25;
						break;
					}
					case 4: {


						this.timers[2] = 25;
						break;
					}

					case 5: {

						this.on = false;

						break;
					}
				}
			}

			async loadImg(arr) {
				let length = arr.length;
				let count = 0;
				for (let h of arr) {
					if (!(h.name in this.images)) {
						this.images[h.name] = {
							a: new Image(),
							loaded: false
						}
						this.loaded = false;
					}
				}

				for (let h of arr) {
					if ((h.name in this.images)) {
						////console.log(h)
						this.images[h.name].a = await loadImage(h.dir);
						this.images[h.name].loaded = true;
					}
				}
				this.loaded = true;
			}


			movePos(position) {
				let lastPos = this.position;
				this.supposedPosition = position;
				this.offsetPosition = lastPos - position;
				this.position = position;
				this.timers[1] = 5;
			}

			checkGarbage(player, garbage, lastGarbage) {
				if (this.on && this.isActive && ~~this.isPlayerTargeted == ~~player) {
					this.garbage = garbage;
					if (this.garbage > this.maxGarbage) this.maxGarbage = this.garbage;
					if (lastGarbage !== void 0 && lastGarbage > 0) this.maxGarbage = lastGarbage;
					let margin = 2;
					let whole = 14;
					let p = this.garbage / this.maxGarbage;


					this.movePos((((1 - (p)) * 10) + 2) / 14);
				}
			}

			loadPlayer(l, n) {
				this.playerImages[l] = n.image;
				this.playerColors[l] = {
					r: n.red,
					g: n.green,
					b: n.blue
				};
				////console.log(this.playerColors[l])
			}



		}(this);
		this.winstat = new class {
			constructor(p) {
				this.parent = p;
				this.container = id("WINSBAR-BAR");
				this.players = {};
				this.layers = {};
				this.stars = {};
				this.texts = {};
				this.maxWins = 2;
				{
					let h = [
						{
							name: "star1_l",
							id: "STAR1-LEFT",
							type: "star"
						},
						{
							name: "starnumber_l",
							id: "TEXT-LEFT",
							type: "text"
						},
						{
							name: "star2_l",
							id: "STAR2-LEFT",
							type: "star"
						},
						{
							name: "star_c",
							id: "STAR-CENTER",
							type: "star"
						},
						{
							name: "objective_text",
							id: "TEXT-CENTER",
							type: "text"
						},
						{
							name: "star2_r",
							id: "STAR2-RIGHT",
							type: "star"
						},
						{
							name: "starnumber_r",
							id: "TEXT-RIGHT",
							type: "text"
						},
						{
							name: "star1_r",
							id: "STAR1-RIGHT",
							type: "star"
						}
					];

					for (let g of h) elem("GTRIS-WINSTAT-LAYER", (a) => {
						//let m;
						if (g.type == "text") {
							let m = document.createElement("gtris-text");
							this.texts[g.name] = m;
							this.texts[g.name].style.scale = "65%";
							//m.innerText = "fuck"
							a.appendChild(m);
						}
						if (g.type == "star") {
							let m = createSVG("100%", "100%");
							m.setAttribute("xml:space", "preserve");
							m.setAttribute("viewBox", "0 0 47.94 47.94");
							let f = document.createElementNS("http://www.w3.org/2000/svg", "path");
							f.style.stroke = "#000";
							f.style.setProperty("stroke-width", "2px");
							f.setAttribute("d", "M26.285,2.486l5.407,10.956c0.376,0.762,1.103,1.29,1.944,1.412l12.091,1.757	c2.118,0.308,2.963,2.91,1.431,4.403l-8.749,8.528c-0.608,0.593-0.886,1.448-0.742,2.285l2.065,12.042	c0.362,2.109-1.852,3.717-3.746,2.722l-10.814-5.685c-0.752-0.395-1.651-0.395-2.403,0l-10.814,5.685	c-1.894,0.996-4.108-0.613-3.746-2.722l2.065-12.042c0.144-0.837-0.134-1.692-0.742-2.285l-8.749-8.528	c-1.532-1.494-0.687-4.096,1.431-4.403l12.091-1.757c0.841-0.122,1.568-0.65,1.944-1.412l5.407-10.956	C22.602,0.567,25.338,0.567,26.285,2.486z");
							f.style.setProperty("fill", "#ffffffaa");
							m.appendChild(f);
							a.appendChild(m);

							m.style.width = m.style.height = "100%";
							this.stars[g.name] = f;
						}

						a.style.display = "flex";
						a.style.position = "relative";
						styleelem(a, "justify-content", "center");
						styleelem(a, "align-items", "center");

						//m.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
						a.style.width = "20px";
						a.style.height = "20px";
						//a.style.background = "#4884";
						a.style.position = 'relative';
						this.container.appendChild(a);
						//if (g.type === "star") 
						this.layers[g.name] = a;
						//a.style.width = a.style.height = "10px";

						////console.log(m, a.innerHTML);
					});
					//for (const u of Object.entries(this.texts)) for (const y of u) //console.log(y)
				}
			}

			getLayer(layername) {

			}

			resize(w, f) {
				this.cellSize = w;

				styleelem(this.container, "width", `${w * 12}px`);
				styleelem(this.container, "height", `${w * 2}px`);

				styleelem(this.container, "bottom", `${w * 2}px`);

				for (let h = 1; h <= 2; h++) {
					styleelem(this.layers[`star${h}_l`], "width", `${w * 1.75}px`);
					styleelem(this.layers[`star${h}_l`], "height", `${w * 1.75}px`);
					styleelem(this.layers[`star${h}_r`], "width", `${w * 1.75}px`);
					styleelem(this.layers[`star${h}_r`], "height", `${w * 1.75}px`);

				}
				for (let j of ["l", "r"]) {
					styleelem(this.layers[`starnumber_${j}`], "width", `${w * 1.55}px`);
					styleelem(this.layers[`starnumber_${j}`], "height", `${w * 1.55}px`);
					styleelem(this.texts[`starnumber_${j}`], "font-size", `${f * 1.55}px`);
				}

				styleelem(this.layers.objective_text, "width", `${w * 4}px`);
				styleelem(this.layers.objective_text, "height", `${w * 2}px`);
				styleelem(this.texts.objective_text, "font-size", `${f * 2}px`);
				//////console.log(1280 * (120/1280))
				styleelem(this.layers.star_c, "width", `${w * 2.2}px`);
				styleelem(this.layers.star_c, "height", `${w * 2.2}px`);
				styleelem(this.layers.star_c, "margin-left", `${w * 0.5}px`);
				styleelem(this.layers.star_c, "margin-right", `${w * 0.5}px`);

			}

			run() {
				this.ctx.clearRect(0, 0, 1280, 100);

				if (this.on) {
					let position = this.position + (0.005 * (Math.random())) - (0.005 * (Math.random()));
					let gap = 0;
					let fade = 1;

					this.frame++;

					if (this.frame >= 120) this.frame = 0;

					for (let h = 0; h < 3; h++) {
						let r = this.timers[h];
						if (r > -1) this.timers[h]--;
					}

					if (this.timers[2] >= 0) {
						let mm = Math.max(this.timers[2] - 10, 0) / 15;
						//gap = mm * 1;
						//let off = this.position - this.supposedPosition;
						fade = mm;
						if (this.timers[2] == 0) {
							this.on = false;
							this.isActive = false;
							return;
						}
					}


					if (this.timers[1] >= 0) {
						let mm = Math.max(this.timers[1], 0) / 5;
						//gap = mm * 1;
						//let off = this.position - this.supposedPosition;
						position = this.position + (this.offsetPosition * mm);
					}

					if (this.timers[0] >= 0) {
						let mm = Math.max(this.timers[0] - 5, 0) / 12;
						gap = mm * 1;
						if (this.timers[0] == 0) {
							this.movePos(this.supposedPosition);
							//this.timers[0] = 25;
						}
						position = 0.5;
					}

					this.drawChars((~~this.isPlayerTargeted == 1) ? (1 - position) : position, gap, 5 * Math.random() + 10, fade);


				}

			}

			openClose(bool) {
				this.isActive = bool;
				styleelem(this.container, "display", (bool) ? "flex" : "none");
			}


			loadPlayer(l, n) {
				if (!(l in this.players)) this.players[l] = {};
				this.players[l] = {
					r: n.red,
					g: n.green,
					b: n.blue,
					wins: 0
				};
				////console.log(this.playerColors[l])
			}

			setWins(l, num, isShine) {
				if (!this.isActive) return;
				let a = this.players[l];
				a.wins = num;
				styleelem(this.stars.star_c, "fill", `#555`);
				if (this.maxWins > 3) {
					if (l == "left") {
						////console.log(this.texts.starnumber_l, this.stars.star1_l)
						styleelem(this.stars.star1_l, "fill", `rgb(${a.r},${a.g},${a.b})`);

						styleelem(this.texts.starnumber_l, "color", `rgb(${a.r},${a.g},${a.b})`);

						ihelem(this.texts.starnumber_l, a.wins);

					}
					if (l == "right") {

						styleelem(this.stars.star1_r, "fill", `rgb(${a.r},${a.g},${a.b})`);

						styleelem(this.texts.starnumber_r, "color", `rgb(${a.r},${a.g},${a.b})`);
						ihelem(this.texts.starnumber_r, a.wins);
					}

				} else {
					if (l == "left") {
						for (let h = 1; h < this.maxWins; h++) {
							styleelem(this.stars[`star${h}_l`], "fill", (h <= a.wins) ? `rgb(${a.r},${a.g},${a.b})` : "#333");
						}
						if (a.wins === this.maxWins) styleelem(this.stars[`star_c`], "fill", `rgb(${a.r},${a.g},${a.b})`);
					}
					if (l == "right") {
						for (let h = 1; h < this.maxWins; h++) {
							styleelem(this.stars[`star${h}_r`], "fill", (h <= a.wins) ? `rgb(${a.r},${a.g},${a.b})` : "#333");
						}
						if (a.wins === this.maxWins) styleelem(this.stars.star_c, "fill", `rgb(${a.r},${a.g},${a.b})`);
					}
				}
			}

			setMaxWins(num) {
				this.maxWins = num;
				if (!this.isActive) return;

				if (num > 3) {
					styleelem(this.layers.star_c, "display", "none");

					////console.log(h)
					for (let h = 1; h < 3; h++) {
						////console.log(h)
						styleelem(this.layers[`star${h}_l`], "display", (h < 2) ? "flex" : "none");
						styleelem(this.layers[`star${h}_r`], "display", (h < 2) ? "flex" : "none");
					}
					ihelem(this.texts.objective_text, language.translate("first_to", [this.maxWins]));
					

					//ihelem(this.texts.obj, a.wins);
					for (let j of ["l", "r"]) {
						styleelem(this.layers[`starnumber_${j}`], "display", "flex");
					}
					styleelem(this.layers.objective_text, "display", "flex");
				} else {
					styleelem(this.layers.star_c, "display", "flex");
					for (let h = 1; h < 3; h++) {
						////console.log(h)
						styleelem(this.layers[`star${h}_l`], "display", (h < num) ? "flex" : "none");
						styleelem(this.layers[`star${h}_r`], "display", (h < num) ? "flex" : "none");
					}

					for (let j of ["l", "r"]) {
						styleelem(this.layers[`starnumber_${j}`], "display", "none");
					}
					styleelem(this.layers.objective_text, "display", "none");

				}
			}



		}(this);
	}

	resize(w, h) {
		this.dim.w = w;
		this.dim.h = h;
		this.overhead.resize(w, h);
	}

	run() {
		if (!this.on) return;
		this.overhead.run()
	}

	async loadAImg(arr) {
		let loadable = [];
		for (let g of arr) {
			if (!(g.name in this.animatedImages)) loadable.push(g);
		}
		if (loadable.length > 0) {
			this.loaded = false;
			for (let h of loadable) {
				let l = await loadImage(h.dir);
				this.animatedImages[h.name] = new this.#AnimatedImage(l, h.frame, h.w, h.h, h.bound);
			}
			this.loaded = true;
		}
	}

	loadAImgOffline(arr) {
		let loadable = [];
		for (let g of arr) {
			if (!(g.name in this.animatedImages)) loadable.push(g);
		}
		//////console.log(g)
		if (loadable.length > 0) {
			//	this.loaded = false;
			for (let h of loadable) {
				let l = h.image;
				this.animatedImages[h.name] = new this.#AnimatedImage(l, h.frame, h.w, h.h, h.bound);
			}
			this.loaded = true;
		}
	}
	getAnimatedImage(image) {
		return this.animatedImages[image];
	}


}();

//fileLayer: splash
const splash = new class {
	constructor() {
		this.video;
		this.res = {
			w: 0,
			h: 0,
			size: 0
		};
		this.isActive = false;
		this.container = id("SPLASH-MAIN-CONTAINER");
		
		this.frame = 0;
		this.#showHideComponent("MAIN-CANVAS", 0);
		this.splashImage;
		this.isNext = false;
		this.isRunning = false;
		
		this.slides = [
		{
			2: () => {
				this.#showHideComponent("TEXT-TEXT", 0);
				this.renderer.play("text-show-out");
				this.ctx.drawImage(this.splashImage, 0, 0, 1280, 720);
			},
			17: () => {
				
				if (__main_params__.appinfo.android) {
					//background.backgroundElem.play();
					
					this.showHide(0);
					this.toggleRunner(false);
					touchButtons.initiateButtons();
					fsw.functions.Changelog.start();
				} else {
					this.#showHideComponent("MAIN-CANVAS", 100);
					this.renderer.play("canvas-show-in");
				}
				//////console.log(this.frame);
			},
		},
		{
			2: () => {
				this.#showHideComponent("MAIN-CANVAS", 0);
				this.renderer.play("canvas-show-out");
				//this.ctx.drawImage(this.splashImage, 0, 0, 1280, 720);
			},
			17: () => {
				
				//background.backgroundElem.play();
				this.showHide(0);
				this.toggleRunner(false);
				touchButtons.initiateButtons();
				fsw.functions.Changelog.start();
				//////console.log(this.frame);
			},
		}];
		this.slideNumber = 0;
		this.canvas = id("SPLASH-MAIN-CANVAS");
		this.ctx = this.canvas.getContext("2d");
		
		
		this.canvasDim = [1280, 720];
		
		this.canvas.width = this.canvasDim[0];
		this.canvas.height = this.canvasDim[1];
		this.runner = new DateSynchronizedLoopHandler(60, () => {
			
			this.frame++;
			let a = this.slides[this.slideNumber];
			
			if (this.frame in a) {
				a[this.frame]();
			}
			
			this.renderer.run();
		});
		
		let mm = [];
		for (let i of ["in", "out"]) {
			mm.push({
				name: `text-show-${i}`,
				a: new AnimationFrameRenderer(id("SPLASH-TEXT-TEXT"), 0, 20, 1000 / 60, {
					name: `fade-${i}`,
					timing: "cubic-bezier(0,0,1,1)",
				}),
			});
			mm.push({
				name: `canvas-show-${i}`,
				a: new AnimationFrameRenderer(this.canvas, 0, 15, 1000 / 60, {
					name: `fade-${i}`,
					timing: "cubic-bezier(0,0,1,1)",
				}),
			});
		}
		this.runner.isAsynchronous = true;
		this.renderer = new FrameRendererSet(mm, "play", "stop", "run");
		//////console.log(JSON.stringify(mm));
		if (!__main_params__.appinfo.android) this.canvas.addEventListener("click", () => {
			this.nextSlide();
		});
	}
	
	switchSlide(number) {
		this.frame = -1;
		this.slideNumber = number;
	}
	
	nextSlide() {
		if (this.isRunning) {
			if (this.slideNumber == 0) this.switchSlide(1);
		}
	}
	
	toggleRunner(toggle) {
		this.isRunning = toggle;
		if (toggle) this.runner.start();
		else this.runner.stop();
		
	}
	
	
	
	showHide(bool) {
		this.isActive = bool;
		styleelem(id("GTRIS-SPLASH-DIV"), "display", bool ? "flex" : "none");
	}
	
	#showHideComponent(id, bool) {
		style(`SPLASH-${id}`, "opacity", bool + "%");
	}
	
	
	
	resize(w, h, size) {
		this.res.w = w;
		this.res.h = h;
		this.res.size = size;
		styleelem(this.container, "width", `${w}px`);
		styleelem(this.container, "height", `${h}px`);
		
		styleelem(this.canvas, "width", `${w}px`);
		styleelem(this.canvas, "height", `${h}px`);
		
		styleelem(this.container, "font-size", `${size}px`);
		
		//style("SPLASH-TEXT-TEXT", wid)
		
	}
}();

//fileLayer: background
const background = new class {
	constructor() {
		this.backgroundElem = document.createElement("video");
		this.backgroundSrc = document.createElement("source");
		this.backgroundElem.append(this.backgroundSrc);
		this.backgroundFG = id("BACKGROUND-FOREGROUND-LAYER");
		//this.backgroundElem.preload = "auto";
		this.canvas = id("BG-BG-CANVAS");
		this.ctx = getCanvasCtx(this.canvas);
		this.sizeMult = 540 / 1280;
		this.width = 1280 * this.sizeMult;
		this.height = 720 * this.sizeMult;
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		this.aspectRatio = 16 / 9;
		this.isOn = false;
		this.active = "";
		this.isReady = true;
		this.backgroundElem.muted = true;
	}
	resize(w, h) {
		this.width = w * this.sizeMult;
		this.height = w * this.aspectRatio * this.sizeMult;
		styleelem(this.canvas, "width", `${w}px`);
		styleelem(this.canvas, "height", `${h}px`);
	}
	drawImage(input, sx, sy, sw, sh, x, y, w, h, isFlipped) {
		let ctx = this.ctx;
		let sm = this.sizeMult;
		
		if (isFlipped) {
			ctx.save();
			ctx.translate(x * sm, y * sm);
			ctx.scale(-1, 1);
			ctx.drawImage(input, sx, sy, sw, sh, -w * sm, 0, w * sm, h * sm);
			ctx.restore();
		} else {
			ctx.drawImage(input, sx, sy, sw, sh, x * sm, y * sm, w * sm, h * sm);
		}
		
	}
	async loadBg(active) {
		
		if (this.isOn) try {
			if (active !== this.active) {
				this.isReady = false;
				this.active = active;
				let url = active.split("=")[1];
				if (url !== "") {
					let blob = await load(url, "blob");
					this.backgroundSrc.src = URL.createObjectURL(blob);
					
					
					//this.backgroundElem.playbackRate = 52.5;
					this.backgroundElem.muted = true;
					
					this.backgroundElem.loop = true;
					this.backgroundElem.pause();
					this.backgroundElem.addEventListener("loadeddata", () => {
						
						this.backgroundElem.play();
						//this.backgroundElem.currentTime = duration;
						
						this.isReady = true;
					});
					this.backgroundElem.load();
					
				} else this.isReady = true;
			}
		} catch (e) {
			/*console.dir(e, {
				depth: null
			})*/
		} /**/
		else this.isReady = true;
		
		
		//this.backgroundElem.load();
	}
	drawVideo() {
		if (this.isOn) this.ctx.drawImage(this.backgroundElem, 0, 0, 1280 * this.sizeMult, 720 * this.sizeMult);
	}
	setFGColor(r, g, b, a) {
		styleelem(this.backgroundFG, "background", `rgba(${r},${g},${b},${a})`);
	}
}();

//fileLayer: menu
const menu = new class {
	#charselectCreateSelector(name, isAi) {
		return {
			version: 0,
			selection: 0,
			character: 0,
			mode: 0,
			team: 0,
			activeControl: 0,
			isOK: 0,
			lastSelection: 0,
			name: name,
			isAi: isAi,
			canOK: false,
			isAvail: true,
			isCharacterCardSelect: 0,
			characterCards: [
			{
				version: 0,
				selection: 0,
				lastSelection: 0,
				isOK: 0,
			},
			{
				version: 0,
				selection: 1,
				lastSelection: 0,
				isOK: 0,
			},
			{
				version: 0,
				selection: 2,
				lastSelection: 0,
				isOK: 0,
			}],
			characterCardIndex: 0
		};
	}
	
	#SelectionGroup = class {
		constructor(parent, parameters) {
			this.parent = parent;
			this.selectedIndex = 0;
			this.isActive = false;
			this.entities = [];
			this.selectables = [];
			this.mainElememt = parameters.element;
		}
		
		changeSelectables(a) {
			this.selectables.length = 0;
			for (let h of a.selectables) {
				this.selectables.push(this.entities[h]);
			}
			this.selectedIndex = a.default || 0;
		}
		
		showHide(bool) {
			
		}
		
	};
	
	#Selectable = class {
		constructor(parent, parameters) {
			this.parent = parent;
			this.parameters = parameters;
			this.string = "[No Name]";
			if ("string" in parameters) {
				this.string = language.translate(parameters.string);
			}
			if ("raw_string" in parameters) {
				this.string = parameters.raw_string;
			}
			this.descProps = [];
			this.items = [];
			this.current = 0;
			this.absolutePos = {}
			this.absolutePos.y = 0;
			this.absolutePos.my = 0;
			if ("property" in parameters) {
				this.current = parent.storage.getItem(parameters.property, 0);
				if (this.parameters.type.indexOf("session") !== -1) {
					this.current = parent.sessionStorage.getItem(parameters.property, 0);
				}
			}
			if (parameters.type === "range_list_specific") {
				////console.log("specific" + JSON.stringify(parameters));
				
				for (let j of this.parent.storage.getList(parameters.property).choices) {
					////console.log(j, language.settingTranslate(j)[0])
					this.items.push(language.settingTranslate(j)[0]);
				}
			}
			this.description = "";
			if ("desc" in parameters) {
				let k = language.translate(parameters.desc);
				let mm = k.split("$<");
				for (let j = 0; j < mm.length; j++) {
					let r = mm[j].split(">")[0];
					if (this.descProps.indexOf(r) === -1) this.descProps.push(r);
				}
				
				for (let g of this.descProps) {
					let temp = k.replace(new RegExp(`\\$\\<${g}\\>`, "gm"), this.parent.storage.getItem(g));
					k = temp;
				}
				this.description = k;
			}
			if ("raw_desc" in parameters) {
				this.description = parameters.raw_desc;
			}
		}
		select() {
			let a = this.parameters;
			if (a.type === "button") switch (a.action) {
				case "changelog": {
					fsw.functions.Changelog.open();
					break;
				}
				case "discord": {
					let mm = document.createElement("a");
					mm.href = "https://discord.com/invite/mnSQJQEuXy";
					mm.target = "_blank";
					mm.click();
					break;
				}
				case "submenu": {
					this.parent.changeMenuAsync(a.submenu, a.backable);
					break;
				}
				
				case "submenu_sync": {
					this.parent.changeMenu(a.submenu, a.backable, false);
					break;
				}
				
				case "unpause": {
					this.parent.game.unpauseGame();
					
					break;
				}
				
				case "restart": {
					this.parent.game.startGameSet("restart");
					
					break;
				}
				
				case "end": {
					game.endGame(true);
					break;
				}
				
				case "mainmenu": {
					this.goToMainMenu();
					break;
				}
				
				case "online_menu": {
					if (online.isOnline) this.parent.changeMenuAsync("online/main.json", false);
					else {
						this.goToMainMenu();
					}
					break;
				}
				
				case "start_online": {
					//let param = JSON.parse(JSON.stringify(a.charselect_param));
					alertWindow.editText("Connecting...");
					alertWindow.showhide(true);
					online.connect(() => {
						alertWindow.showhide(false);
						this.parent.changeMenuAsync("online/main.json", false);
					}, () => {
						alertWindow.showhide(false);
						log.error("504: Service Unavailable", "The server the Game is trying to connect to is down or is experiencing a traffic overload. If this problem persists, contact the developer.");
					});
					break
				}
				
				case "online_vsquick": {
					//let param = JSON.parse(JSON.stringify(a.charselect_param));
					
					
					this.parent.characterMenu.setParameters({
						"is_fixed": true,
						"is_pick_mode": true,
						"is_ai": false,
						"players": 1,
						"playerpos": "first"
					});
					this.parent.characterMenu.showHide(1);
					
					this.parent.characterMenu.setCallback((e) => {
						let player = e.players[0];
						let name = player.name;
						let character = player.character;
						let version = player.version;
						let mode = player.mode;
						
						let sel = [
						{
							string: "vsquick_matchmaking_stop",
							type: "button",
							action: "online_vsquick_stop",
							onstate: "#ffff",
							offstate: "#fff2",
							desc: "vsquick_matchmaking_stop_desc",
							backable: false
						}];
						
						let mel = {
							def: 0,
							name: "vsquick_matchmaking",
							title: "vsquick_matchmaking",
							sel: sel,
							background: {
								"type": "rgba",
								"color": "#222F"
							}
						};
						
						
						this.parent.changeMenu(JSON.stringify(mel), false);
						
						let wr = online.createWriter("START_QUICK_MATCH", 2 + name.length + 3);
						wr.string(name, 16);
						wr.u8(character);
						wr.u8(version);
						wr.u8(mode);
						online.send(wr.buffer);
					});
					this.parent.characterMenu.parameters.modeparams.length = 0;
					
					this.parent.characterMenu.selectUnderControl = 0;
					
					
					break;
				}
				case "online_disconnect": {
					//let param = JSON.parse(JSON.stringify(a.charselect_param));
					this.goToMainMenu();
					online.close();
					break
				}
				
				case "online_vsquick_stop": {
					//let param = JSON.parse(JSON.stringify(a.charselect_param));
					online.emit("STOP_QUICK_MATCH", []);
					if (online.isOnline) this.parent.changeMenuAsync("online/main.json", false);
					else {
						this.goToMainMenu();
					}
					break
				}
				
				case "online_createroom": {
					fsw.functions.OnlineCreateRoom.open();
					break
				}
				
				case "init": {
					let param = JSON.parse(JSON.stringify(a.charselect_param));
					
					if (!param.is_fixed) {
						param.players = parseInt(this.parent.storage.getValueFromRangeListSpecific("set_session_playeramount"));
					}
					
					this.parent.characterMenu.setParameters(param);
					this.parent.characterMenu.showHide(1);
					
					this.parent.setInit(a.init);
					this.parent.characterMenu.parameters.modeparams.length = 0;
					for (let z of a.mode_param) this.parent.characterMenu.parameters.modeparams.push(z);
					this.parent.characterMenu.selectUnderControl = 0;
					
					this.parent.characterMenu.setCallback((res) => {
						
						game.actualParameters.players = res.players;
						game.actualParameters.playerOrder = res.playerOrder;
						
						
						let sms = this.parent.characterMenu;
						game.seeds.round.seed = ~~(Math.random() * 2147483647);
						let main = this.parent;
						let professionalExists = false;
						let sel = [
						{
							string: "gameprep_start",
							type: "button",
							action: "actualinit",
							onstate: "#ffff",
							offstate: "#fff2",
							desc: "replaycenter_loadexternal_desc",
							backable: true
						}];
						for (let g of sms.parameters.modeparams) {
							let w = g.split("|");
							let setting = main.storage.getList(`set_prep_${w[0]}`);
							if (w[0] == "professional") professionalExists = true;
							sel.push({
								"string": `gameprepset_${w[2]}`,
								"type": setting.type,
								"onstate": "#ffff",
								"offstate": "#fff2",
								"property": `set_prep_${w[1]}`,
								"list": `set_prep_${w[0]}`,
								"desc": `gameprepset_${w[2]}_desc`
							});
						}
						let ms = main.sessionStorage;
						ms.createTempList("das", {
							
						});
						
						let mel = {
							def: 0,
							name: "gameprep_start",
							title_raw: language.translate("gameprep_title"),
							sel: sel,
							background: {
								"type": "rgba",
								"color": "#222F"
							}
						};
						
						
						main.changeMenu(JSON.stringify(mel), true);
						
						
					})
					break;
				}
				
				case "actualinit": {
					game.startGameSet("actual");
					break;
				}
				case "function": {
					let result = a.function;
					if ("args" in a) {
						let args = JSON.parse(JSON.stringify(g.args));
						let ii = Object.keys(args)
						for (let v = 0; v < ii.length; v++) {
							let varInstance = args[ii[v]];
							let placeholder = `#par\=${ii[v]}`;
							let regExp = new RegExp(placeholder, "gm");
							result = result.replace(regExp, varInstance);
						}
					}
					
					let ne = new Function(["menu_global", "evt"], result);
					//j.__event_functions[ats] = (event) => {
					ne(__main_params__.__private.menu, event);
					//	}
					break;
				}
				
				case "nameplate": {
					let m = this.parent.storage.getItem("playername");
					//let a = prompt(language.translate("nameplate_note", [m]), m);
					fsw.functions.Nameplate.open()
					/*if (a === null) {
						break;
					}
					this.parent.storage.setItem("playername", a);
					this.parent.refreshMenu();
					this.parent.saveFrame = 22;*/
					break;
				}
				
				case "keybindsetting": {
					
					fsw.functions.Keybinds.openSettings(a.keybind);
					break;
				}
				case "choiceselect": {
					this.parent.storage.setItem(a.select_property, a.select_choice);
					let ay = this.parent.submenuSequence.pop();
					this.parent.changeMenu(ay, false, true);
					this.parent.switchSelectionNumber(a.parent_order);
					this.parent.saveFrame = 60;
					break;
				}
				
				case "replaycenter": {
					this.parent.openReplayCenter();
					break;
				}
				
				case "replaycurrent": {
					this.parent.loadReplayData(game.replayDataToString(), false);
					break;
				}
				case "replayreload": {
					this.parent.loadReplayData(this.parent.replayDataString, false);
					break;
				}
				case "replaydownload": {
					this.parent.downloadReplayData();
					break;
				}
				
				case "replayreplay": {
					game.startReplay();
					
					break;
				}
				case "replayupload": {
					let y = document.createElement("input");
					y.setAttribute("type", "file");
					y.onchange = (event) => {
						let h = event.target.files[0];
						////console.log(h);
						if (h.name.endsWith('.gtlrx')) {
							let reader = new FileReader();
							reader.readAsText(h, 'UTF-8');
							reader.onload = (read) => {
								var ctx = read.target.result;
								try {
									let test = (ctx);
									this.parent.loadReplayData(test, false);
								} catch (e) {
									this.parent.playSound("error");
									
								}
							}
						} else {
							this.parent.playSound("error");
						}
					};
					y.click();
					
					break;
				}
				
				case "replayminmax": {
					let lam = JSON.parse(this.parent.replayDataString);
					let replays = lam.replays;
					let selectedReplays = [];
					let min = this.parent.sessionStorage.getItem("replay_start_round");
					let max = this.parent.sessionStorage.getItem("replay_end_round");
					if (max > min) {
						for (let i = min; i <= max; i++) {
							selectedReplays.push(replays[i]);
						}
					} else
						for (let i = min; i >= max; i--) {
							selectedReplays.push(replays[i]);
						}
					
					lam.replays = selectedReplays;
					//////console.log(lam);
					
					
					game.parseReplayFile(JSON.stringify(lam), 0, 9999, this.parameters.is_file);
					break;
				}
				case "replayallstart": {
					//game.replay.replaysIndex = 0;
					game.parseReplayFile(this.parent.replayDataString, 0, 9999, a.is_file);
					break;
				}
			}
			if (a.type === "range_list_specific") {
				this.parent.openChoices(language.translate(a.string, void 0), a.property, a.list, this.current, a.order)
			}
			
			if (a.type === "switch") {
				let prop = a.property;
				//let temp = a.templist;
				let b = this.parent.storage.getItem(prop);
				//let preset = this.parent.storage.getList(prop);
				b = [1, 0][this.parent.storage.getItem(prop)];
				
				
				this.parent.storage.setItem(prop, b);
				this.current = b;
				this.parent.saveFrame = 60;
			}
			
		}
		
		goToMainMenu() {
			this.parent.changeMenu(JSON.stringify(this.parent.mainMenu), false);
		}
		
		hover() {
			if (this.description !== "") {
				ih("MMC-FOOTER-TEXT", this.description);
			}
		}
		adjust(number) {
			let a = this.parameters;
			if (a.type === "range_minmax") {
				let prop = a.property;
				let setting = a.list;
				let b = this.parent.storage.getItem(prop);
				let preset = this.parent.presetSettings[setting];
				b += number;
				
				if (b > preset.max) {
					b = preset.max;
					
				}
				if (b < preset.min) {
					b = preset.min;
					
				}
				this.parent.storage.setItem(prop, b);
				this.current = b;
				
				this.parent.saveFrame = 60;
			}
			if (a.type === "session_range_minmax") {
				let prop = a.property;
				let temp = a.templist;
				let b = this.parent.sessionStorage.getItem(prop);
				let preset = this.parent.sessionStorage.getTempList(temp);
				b += number;
				
				if (b > preset.max) {
					b = preset.max;
					
				}
				if (b < preset.min) {
					b = preset.min;
					
				}
				this.parent.sessionStorage.setItem(prop, b);
				this.current = b;
				
				//this.parent.saveFrame = 60;
			}
			if (a.type === "range_list_specific") {
				let prop = a.property;
				let setting = a.list;
				let b = this.parent.storage.getItem(prop);
				let preset = this.parent.storage.getList(setting);
				b += number;
				
				if (b > preset.max) {
					b = preset.max;
					
				}
				if (b < preset.min) {
					b = preset.min;
				}
				this.parent.storage.setItem(prop, b);
				this.current = b;
				
				this.parent.saveFrame = 60;
			}
		}
	};
	storage = new class {
		constructor() {
			this.fixedData = {
				playername: "Player 1",
				lang: "en-US",
				"keyboard": {
					
				},
				patchnote_is_seen: 0,
				version: ""
			};
			//this.userDataStr= "";
			this.data = JSON.parse(JSON.stringify(this.fixedData));
			this.stringFetchData = "";
			this.lists = {};
		}
		
		initialize() {
			
			this.data.keyboard = (keypressManager.defaultToSortedJSON());
			////console.log(this.data.keyboard)
		}
		
		setItem(prop, val) {
			this.data[prop] = val;
			//////console.log(val);
		}
		
		loadData(jsonString) {
			let evaluator = JSON.parse(jsonString);
			
			
			////console.log(this.data)
			let func = (base, check) => {
				if (typeof check !== "undefined")
					for (let a in base) {
						if ((base[a] instanceof Object)) {
							func(base[a], check[a]);
						} else if ((typeof check[a] == typeof base[a])) base[a] = check[a];
					}
			}
			func(this.data, evaluator);
			
			
			
			
		}
		
		loadUserData(lo) {
			this.stringFetchData = lo;
			////console.log(this.stringFetchData)
		}
		
		createList(name, obj) {
			this.lists[name] = obj;
		}
		
		getList(a) {
			return this.lists[a];
		}
		
		
		getItem(prop, substitute) {
			if (prop in this.data) return this.data[prop];
			if (substitute !== void 0) return substitute;
			return null;
		}
		
		
		getValueFromRangeListSpecific(prop) {
			return this.getList(prop).choices[this.getItem(prop, 0)].split("||")[1];
		}
		
		save() {
			__main_params__.database.write("local_data", "userdata", JSON.stringify(this.data));
		}
		
	}();
	
	sessionStorage = new class {
		constructor() {
			this.data = {
				replayfrom: 0,
				replayto: 0,
				replayselections: "0,1,2,3,4,5,6"
			};
			this.tempLists = {};
		}
		createTempList(name, obj) {
			this.tempLists[name] = obj;
		}
		
		getTempList(a) {
			return this.tempLists[a];
		}
		setItem(prop, val) {
			this.data[prop] = val;
			//////console.log(val);
			
		}
		
		getItem(prop, substitute) {
			if (prop in this.data) return this.data[prop];
			if (substitute !== void 0) return substitute;
			return null;
		}
		
	}();
	
	constructor() {
		this.canvas = {};
		
		this.game = game;
		
		this.pauseSels = {
			def: 0,
			name: "pause",
			title: "pause_title",
			sel: [
			{
				"string": "pause_resume",
				"type": "button",
				"action": "unpause",
				"onstate": "#ffff",
				"offstate": "#fff2",
				"desc": "pause_resume_desc"
			},
			{
				"string": "pause_restart",
				"type": "button",
				"action": "restart",
				"onstate": "#ffff",
				"offstate": "#fff2",
				"desc": "pause_restart_desc"
			},
			{
				"string": "pause_end",
				"type": "button",
				"action": "end",
				"onstate": "#f00f",
				"offstate": "#f002",
				"desc": "pause_end_desc"
			}],
			"background": {
				"type": "rgba",
				"color": "#222F"
			}
		};
		
		this.pauseReplaySels = {
			def: 0,
			name: "pause",
			title: "pause_replay_title",
			sel: [
				{
					"string": "pause_resume",
					"type": "button",
					"action": "unpause",
					"onstate": "#ffff",
					"offstate": "#fff2",
					"desc": "pause_replay_resume_desc"
				},
				
				{
					"string": "pause_restart",
					"type": "button",
					"action": "replayreplay",
					"onstate": "#ffff",
					"offstate": "#fff2",
					"desc": "pause_replay_restart_desc"
				},
				{
					"string": "pause_replay_end",
					"type": "button",
					"action": "end",
					"onstate": "#f00f",
					"offstate": "#f002",
					"desc": "pause_replay_end_desc"
				}
			],
			"background": {
				"type": "rgba",
				"color": "#222F"
			}
		};
		
		this.isControlsEdit = false;
		this.controlsEditCancelTime = 0; // max is 60
		this.isPressed = false;
		
		let main = [
		{
			"string": "menu_start",
			"desc": "menu_start_desc",
			"type": "button",
			"action": "submenu",
			"onstate": "#ffff",
			"offstate": "#fff2",
			"backable": true,
			"submenu": "start/start.json"
		},
		{
			"string": "menu_replaycenter",
			"desc": "menu_replaycenter_desc",
			"type": "button",
			"action": "replaycenter",
			"onstate": "#ffff",
			"offstate": "#fff2",
			"backable": true,
		},
		{
			"string": "menu_settings",
			"desc": "menu_settings_desc",
			"type": "button",
			"action": "submenu",
			"init": 4,
			"onstate": "#ffff",
			"offstate": "#fff2",
			"backable": true,
			"submenu": "settings/list.json"
		},
		{
			"string": "menu_changelog",
			"desc": "menu_changelog_desc",
			"type": "button",
			"action": "changelog",
			"onstate": "#ffff",
			"offstate": "#fff2",
		},
		{
			"string": "menu_discord",
			"desc": "menu_discord_desc",
			"type": "button",
			"action": "discord",
			"onstate": "#ffff",
			"offstate": "#fff2",
		}];
		
		let gson = {
			def: 0,
			sel: main,
			title: "menu_main",
			name: "main",
			"background": {
				"type": "rgba",
				"color": "#222F"
			}
		};
		this.pressAButtonDelay = 0;
		this.mainMenu = JSON.parse(JSON.stringify(gson));
		
		this.sounds = {};
		
		this.saveFrame = -1;
		
		elem("canvas", canvas => {
			canvas.width = 1280;
			canvas.height = 720;
			this.canvas = canvas;
			this.ctx = canvas.getContext("2d");
		});
		
		this.presetSettings = {};
		this.center = {
			x: 1280 / 2,
			y: 720 / 2
		};
		
		//this.cellSize = 6;
		this.landscape = {
			w: 0,
			h: 0,
		};
		
		this.cellSize = 0;
		
		this.layout = {
			
		};
		
		this.isMenu = false;
		this.isControllable = true;
		this.transitionFrame = 0;
		
		this.submenuSequence = [];
		
		this.menus = {};
		
		this.hold = {
			frame: 0,
			on: false,
			press: "",
		};
		
		this.touchArea = {
			x: 0,
			y: 0,
			start: {
				x: 0,
				y: 0,
			},
			difference: {
				x: 0,
				y: 0,
			},
			isPress: false,
			isNoMove: false,
			isSelectable: false,
			
		};
		this.touchSensitivity = {
			x: 3,
			y: 3,
			difference: {
				x: 0,
				y: 0
			},
			direction: 0
		};
		
		this.interactHardwareType = 0 // 0: mouse, 1: touch
		this.mouseArea = {
			x: 0,
			y: 0,
			start: {
				x: 0,
				y: 0,
			},
			difference: {
				x: 0,
				y: 0,
			},
			isPress: false,
			isNoMove: false,
			isSelectable: false,
			
		};
		this.mouseSensitivity = {
			x: 3,
			y: 3,
			difference: {
				x: 0,
				y: 0
			},
			direction: 0
		};
		this.nativeElementsUnderHardwareInput = {
			back: false
		};
		
		this.canBack = false;
		
		
		this.temporaryElements = {
			elements: {},
			
			elementObjects: {},
			
			resizeObjects: {},
		}
		
		this.menuList = {
			
		};
		
		this.elementObjects = {};
		
		this.resizeObjects = {};
		
		this.mainElement = document.createElement("GTRIS-MENU-SCREEN");
		
		this.mainElement.style = "display: flex; justify-content: center; align-items: center; flex-direction: column;";
		
		this.container = id("MENU-MAIN-CONTENT");
		
		this.pauseContainer = id("MENU-PAUSE-DIV");
		
		this.headerContainer = id("MENU-HEADER");
		
		this.characterContainer = id("MENU-CHARSELECT-DIV");
		
		this.core = id("GTRIS-MENU-DIV");
		
		this.canvas = id("MM-CONTENT-CANVAS");
		
		this.ctx = getCanvasCtx(this.canvas);
		
		this.canvasDims = {
			ar: 16 / 9,
			w: 1280,
			h: 720,
			c: 1280 / 30
		};
		
		this.canvas.width = this.canvasDims.w;
		this.canvas.height = this.canvasDims.h;
		
		this.elements = {};
		
		this.selectables = [];
		
		this.selectionGroupName = "";
		
		this.selectableActive = 0;
		
		this.selectedJson = "";
		//this.lastSelectionGroupNumber = 0;
		
		this.scroll = {
			y: 0,
			currentY: 0,
			startY: 0
		}
		
		this.isLoading = false;
		
		this.replayDataString = "";
		
		this.characterMenu.showHide(0);
		this.keybindChange = {
			duration: 45,
			isActive: false,
			change: 0,
			index: 0, //index
		};
		this.volume = 1;
	}
	
	loadReplayData(dataString, isFile) {
		
		let a = JSON.parse(dataString);
		this.replayDataString = dataString;
		////console.log(a);
		let replays = a.replays;
		let max = replays.length - 1;
		
		
		let sel = [
			{
				string: "replayload_playall",
				type: "button",
				action: "replayallstart",
				onstate: "#ffff",
				offstate: "#fff2",
				is_file: isFile,
				desc: "replayload_playall_desc"
			}
			/*{ for future versions
				"string": "replayload_details",
				type: "submenu_sync",
				action: "unpause",
				onstate: "#ffff",
				offstate: "#fff2",
				desc: "replayload_playall_desc"
			}*/
		];
		
		
		
		if (max > 0) {
			this.sessionStorage.setItem("replay_start_round", 0);
			this.sessionStorage.setItem("replay_end_round", max);
			this.sessionStorage.createTempList("replay_start_round", {
				"type": "range_minmax",
				"min": 0,
				"max": max,
				"text": "text_limit_of",
				"offset": 1
			});
			this.sessionStorage.createTempList("replay_end_round", {
				"type": "range_minmax",
				"min": 0,
				"max": max,
				"text": "text_limit_of",
				"offset": 1
			});
			let h = [{
				"string": "replayloadmm_range_start_slider",
				"type": "session_range_minmax",
				"action": "unpause",
				"onstate": "#ffff",
				"offstate": "#fff2",
				"property": "replay_start_round",
				"templist": "replay_start_round",
				"desc": "replayload_range_start_slider_desc"
			},
			{
				"string": "replayloadmm_range_end_slider",
				"type": "session_range_minmax",
				"action": "unpause",
				"onstate": "#ffff",
				"offstate": "#fff2",
				"property": "replay_end_round",
				"templist": "replay_end_round",
				"desc": "replayload_range_end_slider_desc"
			}, {
				
				string: "replayloadmm_play",
				type: "button",
				action: "replayminmax",
				onstate: "#ffff",
				offstate: "#fff2",
				is_file: isFile,
				desc: "replayload_playall_desc"
				
			}];
			let shel = {
				def: 0,
				name: "replaymenu",
				title_raw: `${a.title}`,
				sel: h,
				background: {
					"type": "rgba",
					"color": "#225F"
				}
			};
			
			sel.push({
				string: "replayload_minmax",
				type: "button",
				action: "submenu_sync",
				onstate: "#ffff",
				offstate: "#fff2",
				submenu: JSON.stringify(shel),
				desc: "replayload_minmax_desc",
				backable: true
			});
			
		}
		
		let mel = {
			def: 0,
			name: "replaymenu",
			title_raw: a.title,
			sel: sel,
			background: {
				"type": "rgba",
				"color": "#222F"
			}
		};
		
		
		this.changeMenu(JSON.stringify(mel), true);
		
	}
	
	openChoices(title, prop, current, setting, order) {
		
		let a = this.storage.getList(prop);
		////console.log(a);
		let j = a.choices;
		let max = a.max;
		
		
		let sel = [];
		
		
		
		for (let y = 0; y < j.length; y++) {
			let p = j[y];
			let h = language.settingTranslate(p);
			sel.push({
				raw_string: h[0],
				type: "button",
				action: "choiceselect",
				select_property: prop,
				onstate: "#ffff",
				offstate: "#fff2",
				select_choice: y,
				parent_order: order,
				raw_desc: h[1]
			});
		}
		
		let mel = {
			def: this.storage.getItem(prop, 0),
			name: "selector",
			title_raw: title,
			sel: sel,
			background: {
				"type": "rgba",
				"color": "#222F"
			}
		};
		
		
		this.changeMenu(JSON.stringify(mel), true);
		
	}
	
	openPreselectionSettings(a) {
		let param = (a.charselect_param);
		this.parent.characterMenu.setParameters(param);
		this.parent.characterMenu.showHide(1);
		this.parent.setInit(a.init);
		this.parent.characterMenu.parameters.modeparams.length = 0;
		for (let z of a.mode_param) this.parent.characterMenu.parameters.modeparams.push(z);
		//m.event_listeners.click.func = loo; //menu_global.game.initialize(${g.init})
		
	}
	
	openReplayCenter() {
		
		
		
		let sel = [
		{
			string: "replaycenter_upload",
			type: "button",
			action: "replayupload",
			onstate: "#ffff",
			offstate: "#fff2",
			desc: "replaycenter_upload_desc",
			backable: true
		}];
		
		if (this.replayDataString !== "") {
			
			sel.push({
				string: "replaycenter_current",
				type: "button",
				action: "replayreload",
				onstate: "#ffff",
				offstate: "#fff2",
				desc: "replaycenter_current_desc",
				backable: true
			});
			
		}
		
		let mel = {
			def: 0,
			name: "replaycenter",
			title: "replaycenter_title",
			sel: sel,
			background: {
				"type": "rgba",
				"color": "#222F"
			}
		};
		
		
		this.changeMenu(JSON.stringify(mel), true);
		
	}
	
	downloadReplayData() {
		let u = game.replayDataToString();
		let a = document.createElement("a");
		let blob = new Blob([u], { type: 'application/octet-stream' });
		a.setAttribute("href", URL.createObjectURL(blob));
		a.setAttribute("download", `gtrislegends-${Date.now()}.gtlrx`);
		a.click();
	}
	
	MenuElementFrameAnimationRenderer = class {
		constructor(element, initial, max, fps, param, addFunc) {
			this.param = param || {};
			let paramDel = "delay" in param ? param.delay : 0;
			this.a = new FrameRenderer(initial, max + paramDel, (frame, maxFrame) => {
				let tminus = maxFrame - Math.max(0, frame - paramDel);
				//////console.log("played pi")
				
				if (tminus >= 0)
					styleelem(this.element, "animation-delay", `${~~((1000 / (60 * (-1))) * Math.min(maxFrame,Math.max(frame + 1 - paramDel, 1)))}ms`);
				
				
			}, addFunc, "loop" in param ? param.loop : false);
			this.element = element;
			this.fps = fps;
			this.max = max;
			this.isLoop = "loop" in param ? param.loop : false;
			//styleelem(this.element, "opacity", `${this.param.opacity||0}%`);
		}
		
		play() {
			this.element.offsetHeight;
			styleelem(this.element, "animation-name", this.param.name);
			styleelem(this.element, "animation-duration", `${~~((this.fps) * (this.max))}ms`);
			styleelem(this.element, "animation-timing-function", this.param.timing);
			styleelem(this.element, "animation-iteration-count", this.isLoop ? "infinite" : "1");
			styleelem(this.element, "animation-play-state", "paused");
			this.a.reset();
			
		}
		run() {
			this.a.run();
		}
		reset() {
			styleelem(this.element, "animation-name", "none");
			this.a.toggleEnable(false);
			
		}
	}
	
	load() {
		return new Promise(async res => {
			let a = await load("./assets/menu/menu.json", "text");
			let json = JSON.parse(a);
			
			this.changeMenu(JSON.stringify(this.mainMenu), false);
			
			id("HEADER-BACK").addEventListener("click", () => {
				this.backButton();
			}, false);
			
			for (let g in json.sounds) {
				/*let a = await load(`/assets/menu/${json.sounds[g]}`, "blob");
				let blob = URL.createObjectURL(a);*/
				
				this.sounds[g] = audioMaster.createAudio({
					src: `/assets/menu/${json.sounds[g]}`,
					format: "ogg",
					loop: false,
					preload: false
				});
				await this.sounds[g].load();
			}
			
			
			
			res();
		});
	}
	
	elementFocus() {
		this.isElementFocus = true;
	}
	
	saveData() {
		this.storage.save();
		////console.log(this.storage.data)
		this.checkData();
	}
	checkData() {
		let mfxvol = this.storage.getItem("set_global_mfx", 0);
		if (mfxvol !== music.volume) {
			music.volumeSet(mfxvol);
		}
		
		let sfxvol = this.storage.getItem("set_global_sfx", 0);
		if (sfxvol !== sound.volume) {
			sound.volumeSet(sfxvol);
		}
		
		let vofxvol = this.storage.getItem("set_global_voice", 0);
		if (vofxvol !== game.voiceVolume) {
			game.voiceVolume = vofxvol;
		}
		
		let ifxvol = this.storage.getItem("set_global_interface_sfx", 0);
		if (ifxvol !== this.volume) {
			this.volume = ifxvol;
		}
		
		let tmbtog = this.storage.getItem("set_global_toggle_mobilebuttons", 1);
		touchButtons.enableButtons(tmbtog);
	}
	
	checkStorageSettings() {
		////console.log(this.storage.stringFetchData)
		let data = {};
		if (this.storage.stringFetchData !== "") data = JSON.parse(this.storage.stringFetchData);;
		for (let b in this.presetSettings) {
			let c = this.presetSettings[b];
			////console.log(b,c)
			
			
			if (c.type === "range_list_specific") {
				c.min = 0;
				c.max = c.choices.length - 1;
				
			}
			if (c.type === "switch") {
				c.min = 0;
				c.max = 1;
				
			}
			this.storage.setItem(b, (b in data) ? data[b] : c.default);
			
			for (let h in c.default_obj) {
				let t = `${b}(${h})`;
				
				this.storage.setItem(t, (t in data) ? data[t] : c.default_obj[h]);
			}
			
			this.storage.createList(b, c);
			////console.log(c);
		}
		////console.log(this.presetSettings)
	}
	
	changeSelectables(_json) {
		this.selectables.length = 0;
		let json = JSON.parse(JSON.stringify(_json));
		for (let u = 0; u < json.sel.length; u++) {
			let ref = json.sel[u];
			ref.size = 1;
			ref.order = u;
		}
		for (let g of json.sel) {
			
			
			this.selectables.push(new this.#Selectable(this, g));
			
		}
		
		for (let u = 0; u < this.selectables.length; u++) {
			let ref = this.selectables[u];
			ref.size = 1;
			
		}
		let def = json.def || 0;
		if (this.selectables[json.def]) {
			this.switchSelectionNumber(json.def);
			
		}
		
		this.checkSelectables();
		this.elementFocus();
		
	}
	changeMenu(_json, backable, isBack) {
		//////console.log(_json)
		let json = JSON.parse(_json);
		if (backable) {
			this.submenuSequence.push(this.selectedJson);
			style("HEADER-TITLE-DIV", "margin-left", "5em");
			this.canBack = true;
		} else {
			if (!isBack) {
				this.submenuSequence.length = 0;
			} else {
				
			}
			style("HEADER-TITLE-DIV", "margin-left", this.submenuSequence.length > 0 ? "5em" : "0em");
			this.canBack = this.submenuSequence.length > 0;
		}
		
		if ("title" in json) {
			ih("HEADER-TITLE-TEXT", language.translate(json.title))
		}
		
		if ("title_raw" in json) {
			ih("HEADER-TITLE-TEXT", json.title_raw);
		}
		
		this.selectedJson = _json;
		
		this.changeSelectables(json);
		this.elementFocus();
	}
	
	refreshMenu() {
		let sel = this.selectableActive;
		this.changeSelectables(JSON.parse(this.selectedJson));
		this.selectableActive = sel;
		this.selectables[this.selectableActive].hover();
		this.elementFocus();
	}
	
	changeMenuAsync(url, backable) {
		this.isLoading = true;
		load(`assets/menu/sections/${url}`, "text").then((m) => {
			this.isLoading = false;
			this.changeMenu(m, backable);
			this.elementFocus();
		});
	}
	switchSelectionNumber(number) {
		if (this.selectableActive != number) {
			this.selectableActive = number;
			this.playSound("hover");
			//this.elementFocus();
		}
		
	}
	
	refreshSelectionGroup() {
		this.selectionGroup = {};
		//let ht = {};
		for (let h in this.elementObjects) {
			let a = this.elementObjects[h];
			if ("default_attributes" in a) {
				if (("id_selectable" in a.default_attributes) && ("number_selectable" in a.default_attributes)) {
					
					if (!(a.default_attributes.id_selectable in this.selectionGroup)) {
						this.selectionGroup[a.default_attributes.id_selectable] = {
							def: 0,
							elem: {},
							number: 0
						};
					}
					this.selectionGroup[a.default_attributes.id_selectable].elem[a.default_attributes.number_selectable] = ({
						a: a,
						name: h,
						hoverIn: a.__event_functions.mouseover,
						hoverOut: a.__event_functions.mouseout,
						click: a.__event_functions.click
					});
					if (("is_default_select" in a.default_attributes) && a.default_attributes.is_default_select) {
						this.selectionGroup[a.default_attributes.id_selectable].def = this.selectionGroup[a.default_attributes.id_selectable].number = a.default_attributes.number_selectable;
					}
				}
			}
		}
		//////console.log(this.selectionGroup);
	}
	
	playSound(name) {
		this.sounds[name].stop();
		this.sounds[name].play();
		this.sounds[name].volume(this.volume / 100);
	}
	
	run() {
		if (this.pressAButtonDelay > 0) this.pressAButtonDelay--;
		this.ctx.clearRect(0, 0, 1280, 720);
		let ld = id("GTRIS-MENU-DIV").getBoundingClientRect();
		let lx = this.touchArea.x - ld.x;
		let ly = this.touchArea.y - ld.y
		if (this.interactHardwareType == 0) {
			lx = this.mouseArea.x - ld.x;
			ly = this.mouseArea.y - ld.y
		} else {
			lx = this.touchArea.x - ld.x;
			ly = this.touchArea.y - ld.y
		}
		this.touchArea.isSelectable = false;
		this.mouseArea.isSelectable = false;
		for (let s in this.nativeElementsUnderHardwareInput) {
			this.nativeElementsUnderHardwareInput[s] = false;
		}
		if (
			(lx / this.landscape.w * this.canvasDims.w >= (0)) &&
			(lx / this.landscape.w * this.canvasDims.w <= (this.canvasDims.c * 3)) &&
			(ly / this.landscape.h * this.canvasDims.h >= (0)) &&
			(ly / this.landscape.h * this.canvasDims.h <= (this.canvasDims.c * 1.5))
		) {
			//this.switchSelectionNumber(g);
			this.nativeElementsUnderHardwareInput.back = true;
		} else
			for (let g = 0; g < this.selectables.length; g++) {
				let mm = this.selectables[g];
				let reference = mm.parameters;
				
				let my = 0;
				
				if (g == this.selectableActive) {
					//gy = -my;
					
				}
				
				if (reference.type === "button") {
					my = reference.size * this.canvasDims.c * 1.8;
				}
				
				if (reference.type === "range_minmax") {
					
					my = reference.size * this.canvasDims.c * 1 * 2.6;
				}
				
				
				if (reference.type === "session_range_minmax") {
					
					my = reference.size * this.canvasDims.c * 1 * 2.6;
				}
				
				if (reference.type === "range_list_specific") {
					
					my = reference.size * this.canvasDims.c * 1 * 2.6;
				}
				
				if (reference.type === "switch") {
					
					my = reference.size * this.canvasDims.c * 1.8;
				}
				
				
				//id("HEADER-TITLE-TEXT").innerHTML = `${lx}, ${this.interactHardwareType}`
				this.ctx.fillStyle = "#8388";
				//this.ctx.fillRect(this.canvasDims.w * 0.15, mm.absolutePos.y, this.canvasDims.w * 0.7, my)
				if (this.touchArea.isPress || this.interactHardwareType == 0)
					if (
						(lx / this.landscape.w * this.canvasDims.w >= (this.canvasDims.w * 0)) &&
						(lx / this.landscape.w * this.canvasDims.w <= (this.canvasDims.w * 0.75)) &&
						(ly / this.landscape.h * this.canvasDims.h >= (mm.absolutePos.y)) &&
						(ly / this.landscape.h * this.canvasDims.h <= (my + mm.absolutePos.y))
					) {
						this.switchSelectionNumber(g);
						if (this.interactHardwareType == 0) this.mouseArea.isSelectable = true;
						if (this.interactHardwareType == 1) this.touchArea.isSelectable = true;
					}
				
				
				
				//emy += my;
				
			}
		
		if (this.isElementFocus) {
			this.isElementFocus = false;
			this.scroll.currentY = this.selectables[this.selectableActive].absolutePos.my;
			////console.log(this.scroll.currentY)
		}
		
		this.draw();
	}
	
	runInBackground() {
		if (this.hold.on) {
			this.hold.frame--;
			if (this.hold.frame == 0) {
				this.controlsListen(this.hold.press, "hold");
			}
		}
		
		if (this.saveFrame >= 0) {
			this.saveFrame--;
			if (this.saveFrame == 0) {
				this.saveData();
			}
		}
	}
	
	selectableClick() {
		
		if (this.nativeElementsUnderHardwareInput.back) {
			this.pressBButton();
		}
		
		if (this.touchArea.isSelectable || this.mouseArea.isSelectable) {
			////console.log("selectable click")
			this.pressAButton();
		}
	}
	draw() {
		this.characterMenu.draw();
		let my = 0;
		let gy = 0;
		
		
		for (let g = 0; g < this.selectables.length; g++) {
			let mm = this.selectables[g];
			let reference = mm.parameters;
			
			
			let le = "#fff6";
			//let lmy = my;
			
			if (g == this.selectableActive) {
				//gy = -my;
				le = "#ffff";
				
			}
			this.scroll.y = ((this.canvasDims.h / 2) - (this.scroll.currentY)) // this.landscape.h * 720));
			
			mm.absolutePos.y = this.scroll.y + my;
			mm.absolutePos.my = my;
			
			if (reference.type === "button") {
				this.ctx.fillStyle = le;
				let p = this.ctx;
				p.beginPath();
				p.moveTo(0, this.scroll.y + (my) - reference.size * this.canvasDims.c * 0.5);
				p.lineTo(this.canvasDims.w * 0.7, this.scroll.y + (my) - reference.size * this.canvasDims.c * 0.5);
				p.lineTo(this.canvasDims.w * 0.65, this.scroll.y + (my) + reference.size * this.canvasDims.c * 1.3);
				p.lineTo(this.canvasDims.w * 0, this.scroll.y + (my) + reference.size * this.canvasDims.c * 1.3);
				this.ctx.fill()
				this.ctx.font = `${reference.size * this.canvasDims.c}px default-ttf`;
				this.ctx.strokeStyle = "#000";
				
				this.ctx.lineWidth = 10;
				this.ctx.strokeText(mm.string, this.canvasDims.w * 0.15, this.scroll.y + (my) + reference.size * this.canvasDims.c * 0.75);
				
				
				this.ctx.fillText(mm.string, this.canvasDims.w * 0.15, this.scroll.y + (my) + reference.size * this.canvasDims.c * 0.75);
				my += reference.size * this.canvasDims.c * 2;
			}
			
			if (reference.type === "range_minmax") {
				my += reference.size * this.canvasDims.c * 1;
				let prop = this.presetSettings[reference.list];
				
				this.ctx.font = `${reference.size * this.canvasDims.c * 0.8}px default-ttf`;
				this.ctx.strokeStyle = "#000";
				let lo = `${mm.string}: ${language.translate(prop.text, [mm.current])}`;
				
				
				this.ctx.lineWidth = 10;
				this.ctx.strokeText(lo, this.canvasDims.w * 0.15, this.scroll.y + (my));
				
				
				this.ctx.fillStyle = le;
				this.ctx.fillText(lo, this.canvasDims.w * 0.15, this.scroll.y + (my));
				
				my += reference.size * this.canvasDims.c * 0.6;
				
				let lsd = this.canvasDims.w - ((this.canvasDims.w * 0.1) * 2);
				this.ctx.fillRect(this.canvasDims.w * 0.1,
					my + this.scroll.y,
					lsd,
					reference.size * this.canvasDims.c * 1);
				
				let pad = (0.1) * this.canvasDims.c * reference.size;
				
				this.ctx.clearRect(
					(this.canvasDims.w * 0.1) + (pad / 2),
					this.scroll.y + my + (pad / 2),
					(lsd) - pad,
					reference.size * this.canvasDims.c * 1 * (0.9)
				);
				this.ctx.fillRect(
					(this.canvasDims.w * 0.1) + (pad / 2),
					this.scroll.y + my + (pad / 2),
					((mm.current - prop.min) / (prop.max - prop.min)) * (lsd - pad),
					reference.size * this.canvasDims.c * 1 * (0.9)
				);
				
				my += reference.size * this.canvasDims.c * 1 * 2;
			}
			
			
			if (reference.type === "session_range_minmax") {
				my += reference.size * this.canvasDims.c * 1;
				let prop = this.sessionStorage.getTempList(reference.templist);
				
				this.ctx.font = `${reference.size * this.canvasDims.c * 0.8}px default-ttf`;
				this.ctx.strokeStyle = "#000";
				let off = ("offset" in prop) ? prop.offset : 0;
				
				let lo = `${mm.string}: ${language.translate(prop.text, [mm.current + off, prop.max + off])}`;
				
				
				this.ctx.lineWidth = 10;
				this.ctx.strokeText(lo, this.canvasDims.w * 0.15, this.scroll.y + (my));
				
				
				this.ctx.fillStyle = le;
				this.ctx.fillText(lo, this.canvasDims.w * 0.15, this.scroll.y + (my));
				
				my += reference.size * this.canvasDims.c * 0.6;
				
				let lsd = this.canvasDims.w - ((this.canvasDims.w * 0.1) * 2);
				this.ctx.fillRect(this.canvasDims.w * 0.1,
					my + this.scroll.y,
					lsd,
					reference.size * this.canvasDims.c * 1);
				
				let pad = (0.1) * this.canvasDims.c * reference.size;
				
				this.ctx.clearRect(
					(this.canvasDims.w * 0.1) + (pad / 2),
					this.scroll.y + my + (pad / 2),
					(lsd) - pad,
					reference.size * this.canvasDims.c * 1 * (0.9)
				);
				this.ctx.fillRect(
					(this.canvasDims.w * 0.1) + (pad / 2),
					this.scroll.y + my + (pad / 2),
					((mm.current - prop.min) / (prop.max - prop.min)) * (lsd - pad),
					reference.size * this.canvasDims.c * 1 * (0.9)
				);
				
				my += reference.size * this.canvasDims.c * 1 * 2;
			}
			
			if (reference.type === "range_list_specific") {
				my += reference.size * this.canvasDims.c * 1;
				let prop = this.presetSettings[reference.list];
				
				this.ctx.font = `${reference.size * this.canvasDims.c * 0.8}px default-ttf`;
				this.ctx.strokeStyle = "#000";
				let lo = `${mm.string}: ${mm.items[mm.current]}`;
				
				
				this.ctx.lineWidth = 10;
				this.ctx.strokeText(lo, this.canvasDims.w * 0.15, this.scroll.y + (my));
				
				
				this.ctx.fillStyle = le;
				this.ctx.fillText(lo, this.canvasDims.w * 0.15, this.scroll.y + (my));
				
				//my += reference.size * this.canvasDims.c * 0.6;
				
				let lsd = this.canvasDims.w - ((this.canvasDims.w * 0.1) * 2);
				let msd = reference.size * this.canvasDims.c * 0.6;
				this.ctx.fillRect(this.canvasDims.w * 0.1,
					my + this.scroll.y + msd,
					lsd,
					reference.size * this.canvasDims.c * 1);
				
				let pad = (0.1) * this.canvasDims.c * reference.size;
				
				this.ctx.clearRect(
					(this.canvasDims.w * 0.1) + (pad / 2),
					this.scroll.y + my + (pad / 2) + msd,
					(lsd) - pad,
					reference.size * this.canvasDims.c * 1 * (0.9)
				);
				this.ctx.fillRect(
					(this.canvasDims.w * 0.1) + (pad / 2),
					this.scroll.y + my + (pad / 2) + msd,
					((mm.current - prop.min) / (prop.max - prop.min)) * (lsd - pad),
					reference.size * this.canvasDims.c * 1 * (0.9)
				);
				
				my += reference.size * this.canvasDims.c * 1 * 2.6;
			}
			
			if (reference.type === "switch") {
				my += reference.size * this.canvasDims.c * 1;
				let prop = this.presetSettings[reference.list];
				
				this.ctx.font = `${reference.size * this.canvasDims.c * 0.8}px default-ttf`;
				this.ctx.strokeStyle = "#000";
				
				let lo = `${mm.string}: ${language.settingTranslate(mm.current == 1 ? prop.on : prop.off)[0]}`;
				let lc = reference.size * this.canvasDims.c * 1.6;
				
				this.ctx.drawImage(game.misc[mm.current == 1 ? "menu_switch_on" : "menu_switch_off"],
					this.canvasDims.w * 0.15, this.scroll.y + (my) - (lc / 1.6),
					lc, lc
				)
				
				this.ctx.lineWidth = 10;
				this.ctx.strokeText(lo, this.canvasDims.w * 0.16 + lc, this.scroll.y + (my));
				
				
				this.ctx.fillStyle = le;
				this.ctx.fillText(lo, this.canvasDims.w * 0.16 + lc, this.scroll.y + (my));
				
				my += reference.size * this.canvasDims.c * 2;
			}
			
		}
		
		if (this.canBack) {
			let mms = "normal";
			if (this.nativeElementsUnderHardwareInput.back) {
				if (this.touchArea.isPress || this.mouseArea.isPress) {
					mms = "press";
				} else {
					mms = "hover";
				}
			}
			this.ctx.drawImage(game.misc[`menu_back_${mms}`],
				0,
				0,
				this.canvasDims.c * 3,
				this.canvasDims.c * 1.5,
				
				
			)
		}
	}
	
	moveUp() {
		if (this.characterMenu.isActive) {
			this.characterMenu.controlsListen(("arrowup"));
			return
		}
		if (!this.isControllable) return;
		
		if (this.selectables.length === 0) return;
		this.selectableActive--;
		if (this.selectableActive < 0) {
			this.selectableActive = 0;
			return;
		}
		
		this.checkSelectables();
		this.playSound("move");
		this.elementFocus();
		
	}
	moveDown() {
		if (this.characterMenu.isActive) {
			this.characterMenu.controlsListen(("arrowdown"));
			return
		}
		if (!this.isControllable) return;
		this.selectableActive++;
		if (this.selectableActive > this.selectables.length - 1) {
			this.selectableActive = this.selectables.length - 1;
			return;
		}
		this.checkSelectables();
		this.playSound("move");
		this.elementFocus()
	}
	
	setupMouseListener() {
		for (let pp of [ /*"touchstart", "touchmove", "touchend", */ "mouseover", "contextmenu", "mousedown", "mouseup", "mousemove", "wheel"]) window.addEventListener(pp, (ee) => {
			if (!fsw.isShown) ee.preventDefault();
			else return;
			//	ee.stopPropagation();
			
			this.mouseListen(ee);
			this.characterMenu.panelInteractListen(ee);
			
		}, true);
		
		//this.touchPanelSystem.initialize();
	}
	mouseListen(evt) {
		////console.log(evt.type)
		if (splash.isActive) return;
		let t = evt;
		if (fsw.isShown || this.characterMenu.isActive || !menu.isControllable || !menu.isMenu) return;
		this.interactHardwareType = 0;
		if (evt.type == "wheel") {
			let del = evt.deltaY;
			if (del >= 0) {
				this.scroll.currentY += this.canvasDims.c * 1;
			} else this.scroll.currentY -= this.canvasDims.c * 1;
			//	//console.log(del)
			
		} else if (evt.type == "mouseover") {
			//	this.mouseArea.x = t.pageX;
			//	this.mouseArea.y = t.pageY;
			
		} else if (evt.type == "mousemove") {
			this.mouseArea.x = t.pageX;
			this.mouseArea.y = t.pageY;
			this.touchArea.isPress = false;
			this.touchArea.isNoMove = false;
			////console.log(t.pageX, t.pageY)
			if (this.mouseArea.isPress) {
				
				
				this.mouseArea.difference.x = (t.pageX - this.mouseArea.start.x);
				this.mouseArea.difference.y = (t.pageY - this.mouseArea.start.y);
				
				
				let dx = this.mouseArea.x - this.mouseSensitivity.difference.x;
				let dy = this.mouseArea.y - this.mouseSensitivity.difference.y;
				let hs = true;
				//	if (fsw.isShown || this.characterMenu.isActive) {hs = false; return}
				
				if (this.mouseSensitivity.direction == 1 || this.mouseSensitivity.direction == 0) {
					let l = false;
					if (this.mouseSensitivity.direction == 0) {
						if (Math.abs(dx) >= game.cellSize * 2) {
							this.mouseSensitivity.direction = 1;
						}
						if (Math.abs(dy) >= game.cellSize * 2) {
							this.mouseSensitivity.direction = 2;
						}
						if (Math.abs(dx) >= game.cellSize * 0.5) {
							hs = false;
						}
						if (Math.abs(dy) >= game.cellSize * 0.5) {
							hs = false;
						}
					}
					while (this.mouseSensitivity.direction == 1 && dx > this.mouseSensitivity.x) {
						this.mouseSensitivity.difference.x += this.mouseSensitivity.x;
						dx -= this.mouseSensitivity.x;
						this.moveRight();
						l = true;
						
					}
					while (dx < -this.mouseSensitivity.x) {
						this.mouseSensitivity.difference.x -= this.mouseSensitivity.x;
						dx += this.mouseSensitivity.x;
						this.moveLeft();
						l = true;
					}
					if (l) this.mouseSensitivity.direction = 1;
					hs = l;
				}
				
				if (this.mouseSensitivity.direction == 2 || this.mouseSensitivity.direction == 0) {
					let l = Math.abs(this.mouseArea.difference.y) > 1;
					//console.log(l)
					/*
					while (dy > menu.touchSensitivity.y) {
						menu.touchSensitivity.difference.y += menu.touchSensitivity.y;
						dy -= menu.touchSensitivity.y;
					//	menu.moveDown();
						l = true;
					}
					while (dy < -menu.touchSensitivity.y) {
						menu.touchSensitivity.difference.y -= menu.touchSensitivity.y;
						dy += menu.touchSensitivity.y;
					//	menu.moveUp();	
						l = true;
					}*/
					if (l) this.mouseSensitivity.direction = 2;
					hs = l;
					this.scroll.currentY = ((this.scroll.startY - this.mouseArea.difference.y));
					////console.log(menu.scroll.currentY, menu.scroll.startY - this.mouseArea.difference.y)
					//menu.scroll.currentY = 
				}
				if (hs) {
					this.mouseArea.isNoMove = false;
				}
			}
		} else {
			
			
			if (!fsw.isShown && !this.characterMenu.isActive) {
				if (evt.type == "mousedown") {
					this.mouseSensitivity.direction = 0;
					this.mouseArea.isPress = true;
					this.mouseArea.isNoMove = true;
					this.mouseArea.start.x = t.pageX;
					this.mouseArea.start.y = t.pageY;
					this.mouseArea.difference.x = 0;
					this.mouseArea.difference.y = 0;
					this.mouseArea.x = t.pageX;
					this.mouseArea.y = t.pageY;
					this.mouseSensitivity.difference.x = t.pageX;
					this.mouseSensitivity.difference.y = t.pageY;
					this.scroll.startY = this.scroll.currentY;
					//////console.log(menu.touchArea.x);
				}
				if (evt.type == "mouseup") {
					//console.log(this.mouseArea.isNoMove)
					if (this.mouseArea.isNoMove) this.selectableClick();
					this.touchArea.isPress = false;
					this.touchArea.isNoMove = false;
					
					this.mouseArea.isPress = false;
					this.mouseArea.isNoMove = false;
					
					
				}
			}
			
			
		}
		
		
	}
	checkSelectables() {
		let reference = this.selectables[this.selectableActive];
		reference.hover();
		
	}
	
	moveLeft() {
		if (this.characterMenu.isActive) {
			this.characterMenu.controlsListen(("arrowleft"));
			return
		}
		if (!this.isControllable) return;
		
		if (this.selectables.length === 0) return;
		
		let reference = this.selectables[this.selectableActive];
		reference.adjust(-1);
		
		this.playSound("move");
		
	}
	
	moveRight() {
		if (this.characterMenu.isActive) {
			this.characterMenu.controlsListen(("arrowright"));
			return;
		}
		if (!this.isControllable) return;
		
		if (this.selectables.length === 0) return;
		
		let reference = this.selectables[this.selectableActive];
		reference.adjust(1);
		this.playSound("move");
		
	}
	
	
	pressAButton() {
		if (this.pressAButtonDelay > 0) return;
		if (this.characterMenu.isActive) {
			this.characterMenu.controlsListen(("enter"));
			return
		}
		if (this.selectables.length === 0 || !this.isControllable) return;
		if (this.selectables.length < 0) return;
		if (this.isControllable) {
			let reference = this.selectables[this.selectableActive];
			reference.select();
			this.playSound("select");
		}
		this.pressAButtonDelay = 10;
	}
	
	pressBButton() {
		if (!this.isControllable) return;
		this.backButton();
	}
	
	controlsListen(name, k) {
		if (!this.isLoading && !this.characterMenu.isWait && !splash.isActive && game.startGameParameters.frame <= 0 && !fsw.isShown) {
			let preventHold = false;
			switch (name) {
				case "up": {
					if (k !== "up") {
						this.moveUp();
						
					}
					break;
				}
				case "down": {
					if (k !== "up") {
						this.moveDown();
						
					}
					break;
				}
				case "left": {
					if (k !== "up") {
						this.moveLeft();
						
					}
					break;
				}
				case "right": {
					if (k !== "up") {
						this.moveRight();
						
					}
					break;
				}
				case "a": {
					if (k !== "up") {
						this.pressAButton();
						preventHold = true;
					}
					break;
				}
				case "b": {
					if (k !== "up") {
						this.pressBButton();
						preventHold = true;
					}
					break;
				}
			}
			
			if (!preventHold) {
				this.hold.press = name;
				if (k == "down") {
					this.hold.frame = 25;
					this.hold.on = true;
				}
				if (k == "hold" && this.hold.on) {
					this.hold.frame = 2;
				}
				if (k == "up") {
					this.hold.on = false;
				}
			}
		}
	}
	
	getID(elementID) {
		let h = 0;
		if (elementID in this.elements) h = this.elements[elementID];
		return h;
	}
	
	isExistingElement(elementID) {
		return elementID in this.elements;
	}
	
	isExistingObj(elementID) {
		return elementID in this.elementObjects;
	}
	
	
	getIDTemp(elementID) {
		let h = 0;
		if (elementID in this.temporaryElements.elements) h = this.temporaryElements.elements[elementID];
		return h;
	}
	
	isExistingElementTemp(elementID) {
		return elementID in this.temporaryElements.elements;
	}
	
	resize(cellSize, fontSize, w, h) {
		this.cellSize = cellSize;
		this.fontSize = fontSize;
		
		this.landscape.w = w;
		this.landscape.h = h;
		
		let header = id("MENU-HEADER");
		let charselect = id("MENU-HEADER");
		
		styleelem(this.container, "width", `${w}px`);
		styleelem(this.container, "height", `${h}px`);
		
		styleelem(this.pauseContainer, "width", `${w}px`);
		styleelem(this.pauseContainer, "height", `${h}px`);
		
		styleelem(this.characterContainer, "width", `${w}px`);
		styleelem(this.characterContainer, "height", `${h}px`);
		
		styleelem(this.core, "width", `${w}px`);
		styleelem(this.core, "height", `${h}px`);
		
		styleelem(this.canvas, "width", `${w}px`);
		styleelem(this.canvas, "height", `${h}px`);
		
		styleelem(header, "width", `${w}px`);
		styleelem(header, "height", `${this.cellSize * 2}px`);
		
		styleelem(this.mainElement, "width", `${w}px`);
		styleelem(this.mainElement, "height", `${h}px`);
		
		styleelem(this.core, "fontSize", `${this.cellSize}px`);
		
		style("HEADER-BACK", "width", `${this.cellSize * 2}px`);
		style("HEADER-BACK", "height", `${this.cellSize * 2}px`);
		
		style("HEADER-TITLE-DIV", "padding-left", `${this.cellSize * 0.5}px`);
		
		style("HEADER-TITLE-TEXT", "font-size", `${this.fontSize * 1.5}px`);
		
		style("MM-CONTENT-FOOTER", "width", `${w}px`);
		style("MM-CONTENT-FOOTER", "height", `${this.cellSize * 5}px`);
		style("MM-CONTENT-FOOTER", "font-size", `${this.fontSize * 1}px`);
		style("MMC-FOOTER-TEXT", "width", `${w * 0.9}px`);
		
		//console.log(1280, 720, this.canvas.style.width, this.canvas.style.height)
		
		//styleelem(this.mainElement, "background", "#fff5");
		
		/*for (let _w in this.resizeObjects) {
			let gh = this.resizeObjects[_w];

			if (gh.t === "whole") {
				if ("w" in gh) styleelem(this.elements[_w], "width", `${w * gh.w}px`);
				if ("h" in gh) styleelem(this.elements[_w], "height", `${h * gh.h}px`);
			}

			if (gh.t === "cell") {
				if ("w" in gh) styleelem(this.elements[_w], "width", `${this.cellSize * gh.w}px`);
				if ("h" in gh) styleelem(this.elements[_w], "height", `${this.cellSize * gh.h}px`);
			}

			//////console.log()
		}

		for (let _w in this.elementObjects) {
			let gh = this.elementObjects[_w];


			if ("font_size" in gh) styleelem(this.elements[_w], "font-size", `${gh.font_size * this.fontSize}px`);
			else styleelem(this.elements[_w], "font-size", `${this.fontSize}px`);


		}

		{
			let thisTemp = this.temporaryElements;
			for (let _w in thisTemp.resizeObjects) {
				let gh = thisTemp.resizeObjects[_w];

				if (gh.t === "whole") {
					if ("w" in gh) styleelem(thisTemp.elements[_w], "width", `${w * gh.w}px`);
					if ("h" in gh) styleelem(thisTemp.elements[_w], "height", `${h * gh.h}px`);
				}

				if (gh.t === "cell") {
					if ("w" in gh) styleelem(thisTemp.elements[_w], "width", `${this.cellSize * gh.w}px`);
					if ("h" in gh) styleelem(thisTemp.elements[_w], "height", `${this.cellSize * gh.h}px`);
				}

				//////console.log()
			}

			for (let _w in thisTemp.elementObjects) {
				let gh = thisTemp.elementObjects[_w];


				if ("font_size" in gh) styleelem(thisTemp.elements[_w], "fontSize", `${gh.font_size * this.cellSize}px`);
				else styleelem(thisTemp.elements[_w], "fontSize", `${this.cellSize}px`);


			}
		}*/
		
		
		this.characterMenu.resize();
	}
	
	convertJSONSimpleToJSONComplex(simple) {
		let complex = [];
		let n = 0;
		for (let g of simple) {
			let mfunc = "";
			let lo = g.name || Math.random() * 9999;
			complex[n] = {
				"type": "none",
				"size": {
					"type": "cell",
					"width": 10,
					"height": 2
				},
				"id": lo,
				
				"tag": "menu-object",
				"inner_html": "",
				"default_attributes": {
					"mouseout_color": "#0000",
					"mouseover_color": "#0000"
				},
				"style": { "display": "flex", "justify-content": "center", "align-items": "center" },
				
				"attributes": {
					
				},
				
				"event_listeners": {
					
				},
				
				"children": {
					
				}
			};
			let m = complex[n];
			if (g.type == "textbox") {
				
				m.children[0] = {
					"type": "none",
					"font_size": 1,
					"id": "HELL-BOX",
					"tag": "menu-object",
					"inner_html": g.string,
					"tag": "textarea",
					"default_attributes": {
						"id_selectable": false,
						"is_default_select": false
					},
					style: {
						width: "100%",
						height: "100%",
					},
					"attributes": {
						
					},
					"event_listeners": {
						change: {
							func: "",
							once: false
						}
					}
				};
				
				
				m.children[0].event_listeners.change.func = `let __value__ = evt.target.value; ${g.change};`
			}
			if (g.type == "button") {
				
				m.children[0] = {
					"type": "none",
					"font_size": 1,
					"id": lo + "-_-TEXT",
					"tag": "menu-object",
					"inner_html": g.string,
					"default_attributes": {
						
					},
					"attributes": {
						"style": "pointer-events: none; position: absolute"
					},
				};
				
				m.style["justify-content"] = "left";
				m.style["flex-direction"] = "column"
				m.event_listeners = {
					"mouseover": {
						"once": false,
						"func": `menu_global.hoverButton(${lo}, \"${g.onstate}\");`
					},
					"mouseout": {
						"once": false,
						"func": `menu_global.hoverButton(${lo},\"${g.offstate}\");`
					},
					"click": {
						"once": false,
						"func": mfunc
					}
				};
				m.default_attributes.id_selectable = g.selectname;
				m.default_attributes.number_selectable = g.selectnumber;
				m.default_attributes.is_default_select = g.is_default;
				
				
				m.style.background = g.offstate;
				
				if ("init" in g) {
					let param = JSON.parse(JSON.stringify(g.charselect_param));
					let loo = `menu_global.characterMenu.setParameters(${JSON.stringify(param)});`;
					loo += `menu_global.characterMenu.showHide(1);menu_global.setInit(${g.init});`;
					
					m.event_listeners.click.func = loo; //menu_global.game.initialize(${g.init})
				}
				
				
				
			}
			if (g.type == "button2") {
				
				m.size.type = "whole";
				m.size.width = 1;
				m.size.height = 0.14;
				
				
				m.style["clip-path"] = "polygon(0 0, 92% 0, 86% 97%, 0% 97%)";
				m.style["align-items"] = "left";
				m.style["padding-left"] = "1.3em";
				m.style["flex-direction"] = "column";
				m.default_attributes.id_selectable = g.selectname;
				m.default_attributes.number_selectable = g.selectnumber;
				m.default_attributes.is_default_select = g.is_default;
				m.children[0] = {
					"type": "none",
					"font_size": 2,
					"id": lo + "-_-TEXT",
					"tag": "menu-object",
					"inner_html": g.string,
					"default_attributes": {
						
					},
					"attributes": {
						"style": "pointer-events: none; position: relative; display: inline-block",
					},
				};
				
				m.children[1] = {
					"type": "none",
					"font_size": 1,
					"id": lo + "-_-TEXT2",
					"tag": "menu-object",
					"inner_html": g.hint || "  ",
					"default_attributes": {
						
						
					},
					"attributes": {
						"style": "pointer-events: none; position: relative; display: inline-block",
					},
				};
				m.event_listeners = {
					"mouseover": {
						"once": false,
						"func": `menu_global.hoverButton(${lo}, \"${g.onstate}\");`
					},
					"mouseout": {
						"once": false,
						"func": `menu_global.hoverButton(${lo},\"${g.offstate}\");`
					},
					"click": {
						"once": false,
						"func": mfunc
					}
				};
				
				m.style.background = g.offstate;
				
				if ("init" in g) {
					let param = JSON.parse(JSON.stringify(g.charselect_param));
					let loo = `menu_global.characterMenu.setParameters(${JSON.stringify(param)});`;
					loo += `menu_global.characterMenu.showHide(1);menu_global.setInit(${g.init});`;
					
					m.event_listeners.click.func = loo; //menu_global.game.initialize(${g.init})
				}
				
				if ("function" in g) {
					
					
					let result = g.function;
					if ("args" in g) {
						let args = JSON.parse(JSON.stringify(g.args));
						let ii = Object.keys(args)
						for (let v = 0; v < ii.length; v++) {
							let varInstance = args[ii[v]];
							let placeholder = `#par\=${ii[v]}`;
							let regExp = new RegExp(placeholder, "gm");
							result = result.replace(regExp, varInstance);
						}
					}
					
					m.event_listeners.click.func = result; //menu_global.game.initialize(${g.init})
				}
				
			}
			
			
			n++;
		}
		
		return complex;
	}
	
	setInit(g) {
		game.actualParameters.mode = g;
		
	}
	
	resetTemp() {
		for (let j in this.temporaryElements.elements) {
			delete this.temporaryElements.elements[j];
		}
		for (let j in this.temporaryElements.elementObjects) {
			delete this.temporaryElements.elementObjects[j];
		}
		for (let j in this.temporaryElements.resizeObjects) {
			delete this.temporaryElements.resizeObjects[j];
		}
	}
	
	showMenu(bool) {
		this.isMenu = bool;
		this.isControllable = bool;
		styleelem(this.container, "display", bool ? "flex" : "none");
		styleelem(this.headerContainer, "display", bool ? "flex" : "none");
	}
	
	hoverButton(id, on) {
		let j = {};
		let exist = false;
		if (this.isExistingElement(id)) {
			j = this.getID(id);
			exist = true;
		}
		if (this.isExistingElementTemp(id)) {
			j = this.getIDTemp(id);
			exist = true;
		}
		//////console.log(exist, j, id)
		if (exist) {
			j.style.background = on;
		}
	}
	
	backButton() {
		if (this.characterMenu.isActive) {
			this.characterMenu.back();
			return;
		}
		if (this.submenuSequence.length > 0) {
			let a = this.submenuSequence.pop();
			this.changeMenu(a, false, true);
		}
		this.playSound("cancel");
	}
	
	jsonMenuManager = new class {
		constructor() {
			this.loadedJson = {};
			/*this.loop = new DateSynchronizedLoopHandler(60, (l) => {
			 
			});*/
			
			this.isLoaded = false;
			
			
		}
	}();
	
	
	characterMenu = new class {
		
		constructor(a, b) {
			this.parents = {
				main: a,
				char: b
			};
			
			this.isActive = 0;
			
			this.touchPanelSystem = new DOMTouchInteractivity(id("CSFRONT-PANEL"), (event) => {
				
				this.panelInteractListen(event);
			})
			
			this.animations = {
				
			}
			
			this.animNames = [];
			//for (let aa in this.animations) this.animNames.push(aa);
			this.charNames = {
				
			};
			
			this.charSidesSelector = {};
			
			for (let kl of ["left", "right"]) {
				let ll = {
					left: 1,
					right: 2
				} [kl];
				this.charSidesSelector[kl] = ll - 1;
				this.charNames[kl] = new ChangeFuncExec("-1|-1", (ev) => {
					let split = ev.split("|");
					let isNegative = ~~split[0] < 0;
					style(`CSBEHIND-P${ll}-CHARNAME`, "display", (isNegative) ? "nome" : "block");
					style(`CSBEHIND-P${ll}-VERSIONNAME`, "display", (isNegative) ? "nome" : "block");
					
					if (split[0] > -1) {
						//this.versionNames[kl].execute();
						if (~~(split[0]) > this.parents.char.characters.length - 1) return;
						let reference = this.parents.char.characters[~~split[0]];
						ih(`CSBEHIND-P${ll}-CHARNAME`, language.charTranslate(`${reference.core.name}`));
						let ver = reference.versions[~~split[1]];
						ih(`CSBEHIND-P${ll}-VERSIONNAME`, language.charTranslate(`${ver.lang_path}>${ver.name}`));
						
					} else {
						
					}
				});
			}
			
			/*this.versionNames = {
			 
			};
			
			
			for (let kl of ["left", "right"]) {
			 let ll = {
			  left: 1,
			  right: 2
			 }[kl];
			 
			 this.versionNames[kl] = new NumberChangeFuncExec(-2, (ev) => {
			  let isNegative = ev < 0;
			  style(`CSBEHIND-P${ll}-VERSIONNAME`, "display", (isNegative) ? "nome" : "block");
			  
			  if (ev > -1) {
			   let selected = -1;
			   
			   if (selected === -1) return;
			   let reference = this.parents.char.characters[this.activeSelection[this.charSidesSelector[kl]].selection];
			   let ver = reference.versions[ev];
			   ih(`CSBEHIND-P${ll}-VERSIONNAME`, language.charTranslate(`${ver.lang_path}>${ver.name}`));
			  } else {
			   
			  }
			 });
			}*/
			
			this.canvasDims = {
				panel: [20 * 35, 20 * 20],
				background: [1280, 720],
			};
			
			this.panelSize = {
				x: 0,
				y: 0,
				w: 0,
				h: 0
			};
			
			this.panelInteraction = {
				x: 0,
				y: 0
			};
			
			this.panelInteractionDown = {
				x: 0,
				y: 0
			};
			
			this.selSqSzMrg = {
				w: 20 * 3 * 1.2,
				h: 20 * 2 * 1.2,
				m: 20 * 0.14
			};
			
			this.modeSqSzMrg = {
				w: 16 * 5 * 1.2,
				h: 16 * 5 * 1.2,
				m: 16 * 0.14
			};
			
			this.teamSqSzMrg = {
				w: 7 * 5 * 1.2,
				h: 7 * 5 * 1.2,
				m: 7 * 0.14
			};
			
			this.checkSqSzMrg = {
				w: 20 * 3 * 1.2,
				h: 20 * 3 * 1.2,
				m: 20 * 0.14
			};
			
			this.canvasses = {};
			this.canvassesCtx = {};
			
			this.selectUnderControl = 0;
			
			this.isPanelPressed = 0;
			
			this.isPanelPressedDown = 0;
			
			this.activeSelection = [];
			
			for (let st = 0; st < 2; st++) {
				this.activeSelection[st] = this.parents.main.#charselectCreateSelector();
			}
			
			this.parameters = {
				dual: 1,
				ai: 1,
				modePick: true,
				players: 2,
				rpg: false,
				modeparams: []
			};
			
			this.page = 0;
			this.isOkaySelection = {};
			
			this.characterSelectBoxes = {};
			let sj = 0;
			for (let h = 0; h < 9 * 4; h++) {
				let sg = sj;
				if (h == (4 + 9 * 3)) sg = -1;
				this.characterSelectBoxes[h] = ({
					character: sg,
					index: h,
					version: 0,
					x: h % 8,
					y: ~~(h / 8),
					selected: {},
					canOK: false,
					poscent: {
						x: 0,
						y: 0,
						w: 0,
						h: 0
					}
				});
				if (h !== (5 + 9 * 3)) sj++;
				
			}
			
			this.modeSelectBoxes = {};
			
			for (let h = 0; h < 2; h++) {
				this.modeSelectBoxes[h] = ({
					mode: h,
					x: h,
					
					selected: {},
					poscent: {
						x: 0,
						y: 0,
						w: 0,
						h: 0
					}
				});
			}
			
			this.teamSelectBoxes = {};
			
			for (let h = 0; h < 5; h++) {
				this.teamSelectBoxes[h] = ({
					mode: h,
					x: h,
					
					selected: {},
					poscent: {
						x: 0,
						y: 0,
						w: 0,
						h: 0
					}
				});
			}
			
			this.selectImages = {};
			this.introductionSounds = {};
			
			this.canvasTemp = {
				background: "CSBEHIND-BG-CANVAS",
				panel: "CSFRONT-PANEL-CANVAS"
			};
			this.isWait = false;
			this.startDelay = 0;
			
			for (let g in this.canvasTemp) {
				let h = this.canvasTemp[g];
				let cid = id(h);
				this.canvasses[g] = cid;
				this.canvassesCtx[g] = cid.getContext("2d");
				cid.width = this.canvasDims[g][0];
				cid.height = this.canvasDims[g][1];
			}
		}
		
		setupAnims() {
			//////console.log(this.parents.main.characterContainer);
			
			this.animations = {
				csShow: new AnimationFrameRenderer(this.parents.main.characterContainer, 0, 25, 1000 / 60, {
					name: "menu-layer-in",
					timing: "cubic-bezier(0,0,0,1)",
				}),
				csHide: new AnimationFrameRenderer(this.parents.main.characterContainer, 0, 25, 1000 / 60, {
					name: "menu-layer-out",
					timing: "cubic-bezier(0,0,0,1)",
				}),
				
			}
			
			this.animNames = [];
			for (let aa in this.animations) this.animNames.push(aa);
			
		}
		
		playAnimation(name) {
			if (name in this.animations) this.animations[name].play();
		}
		
		showHide(toggle) {
			this.isPanelPressed = false;
			this.isPanelPressedDown = -99;
			this.isActive = toggle ? 1 : 0;
			this.playAnimation("cs" + (this.isActive ? "Show" : "Hide"));
			if (toggle) {
				this.startDelay = 30;
			}
			styleelem(this.parents.main.characterContainer, "display", this.isActive ? "flex" : "none");
		}
		
		setParameters(param) {
			this.parameters.dual = false;
			this.parameters.ai = false;
			this.parameters.modePick = false;
			this.parameters.rpg = false;
			this.parameters.noteam = param.players < 2;
			this.parameters.activepos = "first";
			if ("no_team" in param) {
				this.parameters.noteam = param.no_team;
			}
			if (param.players == 2) {
				this.parameters.dual = true;
				this.parameters.noteam = true;
			}
			if ("is_ai" in param) {
				this.parameters.ai = param.is_ai;
			}
			if ("is_pick_mode" in param) {
				this.parameters.modePick = param.is_pick_mode;
			}
			if ("rpg" in param) {
				this.parameters.rpg = param.rpg;
			}
			if ("playerpos" in param) {
				this.parameters.activepos = param.playerpos;
			}
			
			this.loadImages();
			if (this.parameters.rpg) this.loadRPGCards();
			
			this.activeSelection.length = 0;
			let pos = 0;
			if (this.parameters.activepos == "first") pos = 0;
			game.actualParameters.active = pos;
			this.parameters.players = param.players;
			this.selectUnderControl = 0;
			if (this.parameters.dual) {
				
			}
			
			for (let h = 0; h < param.players; h++) {
				let name = "Computer " + h;
				
				let ai = this.parameters.ai;
				
				if (pos == h) name = this.parents.main.storage.getItem("playername", "Player 1");
				let lsms = this.parents.main.#charselectCreateSelector(name, pos == h ? 0 : ai);
				lsms.selection = h;
				lsms.character = h;
				this.activeSelection.push(lsms);
				
				ih(`CSBEHIND-P${Math.min(2, h + 1)}-PLAYERNAME`, name);
			}
			
			
			style("CSBEHIND-DET-P2-DIV", "display", this.parameters.dual ? "flex" : "none")
			
		}
		#callback = null;
		isCallback = true;
		setCallback(cb) {
			this.#callback = cb;
			this.isCallback = true;
		}
		
		loadImages() {
			for (let char of this.parents.char.characters) {
				for (let ver in char.versions) {
					
					let version = char.versions[ver];
					let base = `${char.core.path}/${version.path}`;
					let selectSrc = `${base}/${version.select_image}`;
					//////console.log(selectSrc)
					try {
						loadImage(`assets/characters/${selectSrc}`)
							.then(img => {
								this.selectImages[`${char.core.path}||${version.path}`] = img;
								
								
							});
						
						
						
						//////console.log(selectSrc, img);
					} catch (e) {
						////console.log(e)
						
						/*let version = char.versions[ver];
						let base = `${char.core.path}/${version.path}`;
						let selectSrc = `${base}/${version.select_image}`;*/
						this.selectImages[`${char.core.path}||${version.path}`] = new Image();
					}
				}
			}
		}
		
		async loadRPGCards() {
			for (let char of this.parents.char.characters) {
				for (let ver in char.versions) {
					
					let version = char.versions[ver];
					let base = `${char.core.path}/${version.path}`;
					let selectSrc = `${base}/${version.rpg_card}`;
					//////console.log(selectSrc)
					try {
						let img = await memoryManager.asyncLoad(`assets/characters/${selectSrc}`, "image");
						
						this.selectImages[`${char.core.path}||${version.path}(rpg)`] = img;
						
						
						
						//////console.log(selectSrc, img);
					} catch (e) {
						////console.log(e)
						
						/*let version = char.versions[ver];
						let base = `${char.core.path}/${version.path}`;
						let selectSrc = `${base}/${version.rpg_card}`;*/
						this.selectImages[`${char.core.path}||${version.path}(rpg)`] = new Image();
					}
				}
			}
		}
		#clearCanvas(canvas) {
			let c = this.canvasses[canvas];
			let ctx = this.canvassesCtx[canvas];
			ctx.clearRect(0, 0, c.width, c.height);
		}
		
		async setupPlayerGame() {
			this.isWait = true;
			let a = null,
				_b = this.activeSelection,
				b = [];
			let mplayers = [];
			
			let main = this.parents.main;
			let isPlayer = {};
			let isOccupied = {};
			let order = {};
			
			for (let u = 0; u < _b.length; u++) {
				let h = _b[u];
				if (h.character !== -1) {
					b.push(h);
				}
				
				//order[g] = (u);
			}
			
			
			
			if (b.length === 0) return;
			
			if (b.length == 2) {
				game.activePlayer = ~~menu.storage.getValueFromRangeListSpecific("set_session_boardpos_mp") % 2;
				
				////console.log(game.activePlayer);
			} else if (b.length > 2) {
				game.activePlayer = Math.min(~~menu.storage.getValueFromRangeListSpecific("set_session_boardpos_mp"), b.length);
			} else game.activePlayer = 0;
			let count = 0;
			
			////console.log(JSON.stringify(b))
			
			for (let u = 0; u < b.length; u++) {
				let h = b[u];
				if (!h.isAi) {
					let g = game.activePlayer;
					order[g] = (u);
					isPlayer[u] = g;
					isOccupied[g] = 1;
				} else count++;
				
				//order[g] = (u);
			}
			////console.log(order)
			
			let i = 0; // board
			let t = 0; // player
			while (count >= t) {
				if (!(t in isPlayer)) {
					if (i in isOccupied) {
						i++;
					} else {
						order[i] = t;
						t++;
						i++
					}
				} else t++;
				
			}
			
			////console.log(b, order)
			for (let u = 0; u < b.length; u++) {
				let h = b[order[u]];
				let rpg = {
					hp: 0,
					mana: 0,
					atk: 0,
					def: 0,
					lifesteal: 0,
					lfa: 0,
					deflect: 0,
					cards: {
						
					}
				}
				if (this.parameters.rpg) {
					let characterCards = {
						
					};
					for (let ua = 0; ua < 3; ua++) {
						
						let oo = h.characterCards[ua];
						let sel = this.parents.char.characters[oo.selection];
						let ver = sel.versions[oo.version];
						if (ua == 0) h.character = oo.selection;
						rpg.cards[ua] = {
							cd: 0,
							mana: 0,
							name: "",
							desc: "",
							char: `${oo.selection}|${oo.version}`,
							//attr: []
						}
						let rpgString = await memoryManager.asyncLoad(`assets/characters/${sel.core.path}/${ver.path}/${ver.rpg_attr_init}`);
						////console.log(rpgString);
						let rpgJson = JSON.parse(rpgString);
						let skill = rpg.cards[ua];
						skill.cd = rpgJson?.skill.cooldown || 0;
						skill.voice = rpgJson?.skill.voice || "";
						skill.mana = rpgJson?.skill.mana || 0;
						skill.name = rpgJson?.skill.skill || "";
						skill.rawdesc = rpgJson?.skill.rawdesc || "";
						skill.attr = rpgJson?.skill.attr || [];
						skill.skillvalues = rpgJson?.skill.skillvalues;
						skill.desc = rpgJson?.skill.desc || "";
						//character.skill
						rpg.hp += rpgJson?.hp || 0;
						rpg.mana += rpgJson?.mana || 0;
						rpg.atk += rpgJson?.atk || 0;
						rpg.def += rpgJson?.def || 0;
						rpg.lifesteal += 0.01 * (rpgJson?.lifesteal || 0);
						rpg.lfa += (rpgJson?.lfa || 0) * 0.01;
					}
					
				}
				
				mplayers.push(game.createPlayerParam(h.name, h.team, h.character, h.version, h.mode, h.isAi, rpg));
				////console.log(rpg)
			}
			
			let playerOrder = [];
			let om = Object.keys(order); // TODO fix probable redundancy
			for (let sm = 0; sm < om.length; sm++) {
				playerOrder.push(sm);
			}
			
			let result = {
				players: mplayers,
				playerOrder: playerOrder
			}
			
			
			
			this.#callback(result);
			
			this.showHide(0);
			this.activeSelection.length = 0;
			this.isWait = false;
			
			
			
			
			
			//game.startGameSet("actual");
			
		}
		
		checkButton(select) {
			let g = this.characterSelectBoxes[select.selection];
			
			if (!g.canOK) {
				this.parents.main.playSound("error");
				return;
			}
			
			let isError = false;
			
			let playerCount = 0;
			if (this.parameters.players !== 1) {
				for (let sh of this.activeSelection) {
					if (sh.character !== -1) playerCount++;
				}
				if (playerCount < 2) isError = true;
			}
			if (!this.activeSelection[this.selectUnderControl].isAi && this.activeSelection[this.selectUnderControl].character == -1) isError = true;
			if (isError) {
				menu.playSound("error");
				return
			}
			
			if (this.parameters.rpg) {
				let chars = {};
				for (let cardIndex = 0; cardIndex < select.characterCards.length; cardIndex++) {
					
					let card = select.characterCards[cardIndex];
					let str = `${card.selection}`;
					chars[str] = 0;
				}
				for (let cardIndex = 0; cardIndex < select.characterCards.length; cardIndex++) {
					
					let card = select.characterCards[cardIndex];
					let str = `${card.selection}`;
					if ((str in chars)) {
						chars[str]++;
						if (chars[str] > 1 && cardIndex == select.characterCardIndex) {
							this.parents.main.playSound("error");
							return;
						}
						
					}
				}
				////console.log(chars)
				if (select.characterCardIndex < 2) {
					select.characterCardIndex++;
					let newSel = select.characterCards[select.characterCardIndex];
					//let mn = newSel.
					////console.log(newSel)
					newSel.lastSelection = newSel.selection;
					
				} else {
					this.checkSel();
					select.isOK = 1;
					
				}
				
			} else {
				this.checkSel();
				select.isOK = 1;
				
			}
			this.parents.main.playSound("select");
			
			//this.parents.main.playSound("select");
		}
		back() {
			let a = this;
			let isSelActive = false;
			if (a.parameters.rpg) {
				let isBack = false;
				for (let g = a.activeSelection.length - 1; g >= 0; g--) {
					let hh = a.activeSelection[g];
					
					if (isBack) {
						hh.characterCardIndex++;
					}
					if (hh.characterCardIndex > 0) {
						isSelActive = true;
						hh.characterCardIndex--;
						hh.isOK = 0;
						if (hh.characterCardIndex == 0) {
							hh.isOK = 0;
							
						}
						
					} else {
						hh.isOK = 0;
						
					}
					
					
					if (isSelActive) break;
					if (a.selectUnderControl == g) isBack = true;
					if (a.parameters.ai == !(g - 1 < 0)) {
						a.selectUnderControl = g - 1;
						//hh.characterCardIndex++;
					}
					//////console.log(g);
					
				}
			} else
				for (let g = a.activeSelection.length - 1; g >= 0; g--) {
					let hh = a.activeSelection[g];
					if (hh.isOK) {
						isSelActive = true;
						hh.isOK = 0;
					}
					
					
					if (isSelActive) break;
					else if (a.parameters.ai == !(g - 1 < 0)) a.selectUnderControl = g - 1;
					//////console.log(g);
					
				}
			if (!isSelActive) {
				a.showHide(0);
			}
			if (!this.parameters.dual && this.selectUnderControl > 0) {
				ih(`CSBEHIND-P1-PLAYERNAME`, this.activeSelection[this.selectUnderControl].name);
			}
			this.parents.main.playSound("cancel");
		}
		checkSel() {
			if (this.selectUnderControl < this.activeSelection.length - 1) {
				
				//////console.log(select);
				
				this.selectUnderControl++;
				if (!this.parameters.dual) {
					ih(`CSBEHIND-P1-PLAYERNAME`, this.activeSelection[this.selectUnderControl].name);
				}
				//if (this.selectUnderControl >= this.activeSelection.length) this.selectUnderControl--;
			} else {
				this.setupPlayerGame();
			}
		}
		
		draw() {
			if (!this.isActive) return;
			if (this.startDelay > 0) this.startDelay--;
			for (let h = 0, m = this.animNames.length; h < m; h++)
				this.animations[this.animNames[h]].run();
			
			//////console.log(this.activeSelection);
			
			
			this.#clearCanvas("background");
			this.#clearCanvas("panel");
			
			let msm = 9;
			
			for (let g = 0; g < (msm * 4); g++) {
				
				let gw = g % msm;
				
				let boxref = this.characterSelectBoxes[g];
				
				let lx = ((this.canvasDims.panel[0] / 2) - (((this.selSqSzMrg.w * msm) + (this.selSqSzMrg.m * (msm - 1))) / 2) + ((this.selSqSzMrg.w * (gw)) + (this.selSqSzMrg.m * (gw + 1)))),
					ly = ((this.selSqSzMrg.h + this.selSqSzMrg.m) * (~~(g / msm)) + this.selSqSzMrg.m * 3),
					lw = this.selSqSzMrg.w,
					lh = this.selSqSzMrg.h;
				this.canvassesCtx.panel.fillStyle = "#2228";
				boxref.canOK = false;
				this.canvassesCtx.panel.fillRect(lx, ly, lw, lh);
				let charref = this.parents.char.characters[boxref.character];
				let reference = null
				if (boxref.character == -1) {
					
					
				} else {
					
					
					if (!charref) continue;
					if (!(`${charref.core.path}||${charref.versions[boxref.version].path}` in this.selectImages)) {
						continue;
					}
				}
				boxref.canOK = true;
				
				
				
				if (boxref.character == -1) {
					reference = game.misc.menu_cs_removeplayer;
					////console.log(game.misc.menu_cs_removeplayer)
					this.canvassesCtx.panel.drawImage(reference, 0, 0, 150, 150 * (2 / 3), lx, ly, lw, lh);
				} else reference = this.selectImages[`${charref.core.path}||${charref.versions[boxref.version].path}`];
				
				if (reference) this.canvassesCtx.panel.drawImage(reference, 600, 0, 140, 140 * (2 / 3), lx, ly, lw, lh);
				
				boxref.poscent.x = lx / this.canvasDims.panel[0];
				boxref.poscent.y = ly / this.canvasDims.panel[1];
				boxref.poscent.w = (lw + lx) / this.canvasDims.panel[0];
				boxref.poscent.h = (lh + ly) / this.canvasDims.panel[1];
				let hover = game.misc.menu_cs_border_black;
				if (boxref.poscent.x <= this.panelInteraction.x && (boxref.poscent.w) >= this.panelInteraction.x &&
					boxref.poscent.y <= this.panelInteraction.y && (boxref.poscent.h) >= this.panelInteraction.y) {
					hover = game.misc.menu_cs_border_yellow;
					
					//////console.log(g);
				}
				
				this.canvassesCtx.panel.drawImage(hover, 0, 0, 150, 100, lx, ly, lw, lh);
				
				
				if (this.isPanelPressedDown > 0) {
					
					//////console.log(this.panelInteraction.x, boxref.poscent.x, this.panelInteraction.y, boxref.poscent.y)
					if (boxref.poscent.x <= this.panelInteractionDown.x && (boxref.poscent.w) >= this.panelInteractionDown.x &&
						boxref.poscent.y <= this.panelInteractionDown.y && (boxref.poscent.h) >= this.panelInteractionDown.y) {
						let select = this.activeSelection[this.selectUnderControl];
						this.changeSelectionChar(select, boxref.index, boxref.character);
						//////console.log(g);
					}
				}
				
				
				
				
				//////console.log(boxref.poscent.x)
				
			}
			
			
			
			if (this.parameters.modePick) {
				let selected1 = 0,
					selected0 = 0;
				if (!this.parameters.ai) {
					for (let g = 0; g < (this.parameters.players); g++) {
						let boxref = this.activeSelection[g];
						if (boxref.mode == 0) selected0++;
						if (boxref.mode == 1) selected1++;
					}
				} else {
					let boxref = this.activeSelection[this.selectUnderControl];
					if (boxref.mode == 0) selected0++;
					if (boxref.mode == 1) selected1++;
				}
				
				
				for (let g = 0; g < (2); g++) {
					
					let gw = g % 8;
					
					let boxref = this.modeSelectBoxes[g];
					
					
					let lx = ((0.05 * this.canvasDims.panel[0]) + ((this.modeSqSzMrg.w * (gw)) + (this.modeSqSzMrg.m * (gw + 1)))),
						ly = (0.735 * this.canvasDims.panel[1]),
						lw = this.modeSqSzMrg.w,
						lh = this.modeSqSzMrg.h;
					/*this.canvassesCtx.panel.fillStyle = "#f83";
					
					this.canvassesCtx.panel.fillRect(lx,ly,lw,lh);*/
					
					
					
					//this.canvassesCtx.panel.drawImage(game.misc.menu_cs_border_black, 0, 0, 150, 100, lx,ly,lw,lh);
					
					
					boxref.poscent.x = lx / this.canvasDims.panel[0];
					boxref.poscent.y = ly / this.canvasDims.panel[1];
					boxref.poscent.w = (lw + lx) / this.canvasDims.panel[0];
					boxref.poscent.h = (lh + ly) / this.canvasDims.panel[1];
					
					let hover = 0;
					
					if (boxref.poscent.x <= this.panelInteraction.x && (boxref.poscent.w) >= this.panelInteraction.x &&
						boxref.poscent.y <= this.panelInteraction.y && (boxref.poscent.h) >= this.panelInteraction.y) {
						hover = 1;
						if (this.isPanelPressing) hover = 2;
						//////console.log(g);
					}
					
					this.canvassesCtx.panel.drawImage(game.misc.menu_cs_mode_pick, (100 * ((hover > 0) ? hover : ((selected0 && g == 0) || (selected1 && g == 1)) ? 3 : 0)), 100 + (g * 100), 100, 100, lx, ly, lw, lh);
					
					if (this.isPanelPressedDown > 0) {
						
						
						
						//////console.log(this.panelInteraction.x, boxref.poscent.x, this.panelInteraction.y, boxref.poscent.y)
						if (boxref.poscent.x <= this.panelInteractionDown.x && (boxref.poscent.w) >= this.panelInteractionDown.x &&
							boxref.poscent.y <= this.panelInteractionDown.y && (boxref.poscent.h) >= this.panelInteractionDown.y) {
							let select = this.activeSelection[this.selectUnderControl];
							select.mode = g;
							//////console.log(g);
						}
					}
					
					
					
					
					//////console.log(boxref.poscent.x)
					
				}
			}
			
			if (!this.parameters.noteam) {
				
				
				
				
				for (let g = 0; g < (5); g++) {
					
					let gw = g % 8;
					
					let ss = this.activeSelection[this.selectUnderControl];
					
					let boxref = this.teamSelectBoxes[g];
					
					
					let lx = ((0.05 * this.canvasDims.panel[0]) + ((this.teamSqSzMrg.w * (gw)) + (this.teamSqSzMrg.m * (gw + 1)))),
						ly = (0.6 * this.canvasDims.panel[1]),
						lw = this.teamSqSzMrg.w,
						lh = this.teamSqSzMrg.h;
					/*this.canvassesCtx.panel.fillStyle = "#f83";
					
					this.canvassesCtx.panel.fillRect(lx,ly,lw,lh);*/
					
					
					
					//this.canvassesCtx.panel.drawImage(game.misc.menu_cs_border_black, 0, 0, 150, 100, lx,ly,lw,lh);
					
					
					boxref.poscent.x = lx / this.canvasDims.panel[0];
					boxref.poscent.y = ly / this.canvasDims.panel[1];
					boxref.poscent.w = (lw + lx) / this.canvasDims.panel[0];
					boxref.poscent.h = (lh + ly) / this.canvasDims.panel[1];
					
					let hover = 0;
					
					if (boxref.poscent.x <= this.panelInteraction.x && (boxref.poscent.w) >= this.panelInteraction.x &&
						boxref.poscent.y <= this.panelInteraction.y && (boxref.poscent.h) >= this.panelInteraction.y) {
						hover = 1;
						if (this.isPanelPressing) hover = 2;
						//////console.log(g);
					}
					this.canvassesCtx.panel.drawImage(game.misc.menu_cs_team, (100 * (g)), 0, 100, 100, lx, ly, lw, lh);
					
					this.canvassesCtx.panel.drawImage(game.misc.menu_cs_team, (100 * ((hover > 0) ? hover : (g == ss.team) ? 3 : 0)), 100, 100, 100, lx, ly, lw, lh);
					
					if (this.isPanelPressedDown > 0) {
						
						
						
						//////console.log(this.panelInteraction.x, boxref.poscent.x, this.panelInteraction.y, boxref.poscent.y)
						if (boxref.poscent.x <= this.panelInteractionDown.x && (boxref.poscent.w) >= this.panelInteractionDown.x &&
							boxref.poscent.y <= this.panelInteractionDown.y && (boxref.poscent.h) >= this.panelInteractionDown.y) {
							let select = this.activeSelection[this.selectUnderControl];
							select.team = g;
							//////console.log(g);
						}
					}
					
					
					
					
					//////console.log(boxref.poscent.x)
					
				}
			}
			
			{
				let lx = ((this.canvasDims.panel[0] / 2) - (this.checkSqSzMrg.w / 2)),
					ly = (0.8 * this.canvasDims.panel[1]),
					lw = this.checkSqSzMrg.w,
					lh = this.checkSqSzMrg.h;
				/*this.canvassesCtx.panel.fillStyle = "#f83";
				
				this.canvassesCtx.panel.fillRect(lx,ly,lw,lh);*/
				//this.canvassesCtx.panel.drawImage(game.misc.menu_cs_border_black, 0, 0, 150, 100, lx,ly,lw,lh);
				let bx = lx / this.canvasDims.panel[0];
				let by = ly / this.canvasDims.panel[1];
				let bw = (lw + lx) / this.canvasDims.panel[0];
				let bh = (lh + ly) / this.canvasDims.panel[1];
				
				let hover = 0;
				
				if (bx <= this.panelInteraction.x && (bw) >= this.panelInteraction.x &&
					by <= this.panelInteraction.y && (bh) >= this.panelInteraction.y) {
					hover = 1;
					if (this.isPanelPressing) hover = 2;
					//////console.log(g);
				}
				
				this.canvassesCtx.panel.drawImage(game.misc.menu_cs_mode_pick, (100 * ((hover > 0) ? hover : (0) ? 3 : 0)), 0, 100, 100, lx, ly, lw, lh);
				
				if (this.isPanelPressedDown > 0) {
					
					
					
					//////console.log(this.panelInteraction.x, boxref.poscent.x, this.panelInteraction.y, boxref.poscent.y)
					if (bx <= this.panelInteractionDown.x && (bw) >= this.panelInteractionDown.x &&
						by <= this.panelInteractionDown.y && (bh) >= this.panelInteractionDown.y) {
						let select = this.activeSelection[this.selectUnderControl];
						//select.mode = g;
						//this.changeSelectionChar(select, boxref.character);
						//////console.log(g);
						this.checkButton(select);
					}
				}
				
				
				
				
				//////console.log(boxref.poscent.x)
				
			}
			
			if ( /*typeof this.activeSelection[this.charSidesSelector.left] !== "undefined"*/ true) {
				let select = this.activeSelection[this.parameters.dual ? this.charSidesSelector.left : this.selectUnderControl];
				let g = this.parameters.rpg ? select.characterCards[select.characterCardIndex].selection : select.selection,
					gw = g % msm;
				let v = this.parameters.rpg ? select.characterCards[select.characterCardIndex].version : select.version;
				
				//game.frames += 0.1;
				let lx = ((this.canvasDims.panel[0] / 2) - (((this.selSqSzMrg.w * msm) + (this.selSqSzMrg.m * (msm - 1))) / 2) + ((this.selSqSzMrg.w * (gw)) + (this.selSqSzMrg.m * (gw + 1)))),
					ly = ((this.selSqSzMrg.h + this.selSqSzMrg.m) * (~~(g / msm)) + this.selSqSzMrg.m * 3),
					lw = this.selSqSzMrg.w,
					lh = this.selSqSzMrg.h;
				
				
				
				
				this.canvassesCtx.panel.drawImage(game.misc.menu_cs_border_green, 0, 0, 150, 100, lx, ly, lw, lh);
				//let boxref = this.characterSelectBoxes[g];
				let charref = this.parents.char.characters[g];
				
				
				if (!this.parameters.rpg && (charref?.core) && (`${charref.core.path}||${charref.versions[select.version].path}` in this.selectImages)) {
					let reference = this.selectImages[`${charref.core.path}||${charref.versions[select.version].path}`];
					
					this.canvassesCtx.background.drawImage(reference, 0, 0, 600, 600, -140, 0, 720, 720);
					
					
				}
				
				if (this.parameters.rpg) {
					for (let kr = 0; kr < 3; kr++) {
						let rcharref = this.parents.char.characters[select.characterCards[kr].selection];
						if ((rcharref?.core) && (`${rcharref.core.path}||${rcharref.versions[select.characterCards[kr].version].path}(rpg)` in this.selectImages)) {
							let reference = this.selectImages[`${rcharref.core.path}||${rcharref.versions[select.characterCards[kr].version].path}(rpg)`];
							let aspect = 550 / 250;
							this.canvassesCtx.background.drawImage(reference, 0, 0, 550, 250, 10, 60 + 122 * kr, 120 * aspect, 120);
						}
						
					}
				}
				if (this.parameters.modePick) this.canvassesCtx.background.drawImage(game.misc.menu_cs_mode_pick, (100 * ((select.isOK) ? 3 : 0)), (100 + (100 * select.mode)), 100, 100, 20, 420, 120, 120);
				else if (select.isOK) this.canvassesCtx.background.drawImage(game.misc.menu_cs_mode_pick, (100 * 3), (0), 100, 100, 20, 420, 120, 120);
				let kse = select.isOK ? select.selection : g;
				let kve = select.isOK ? select.version : v;
				this.charNames.left.assign(`${kse}|${kve}`);
				
				//////console.log(`${select.selection}|${select.version}`)
			}
			
			
			
			if (typeof this.activeSelection[this.charSidesSelector.right] !== "undefined" && this.parameters.dual) {
				let select = this.activeSelection[this.charSidesSelector.right];
				let g = this.parameters.rpg ? select.characterCards[select.characterCardIndex].selection : select.selection,
					gw = g % msm;
				let v = this.parameters.rpg ? select.characterCards[select.characterCardIndex].version : select.version;
				//game.frames += 0.1;
				let lx = ((this.canvasDims.panel[0] / 2) - (((this.selSqSzMrg.w * msm) + (this.selSqSzMrg.m * (msm - 1))) / 2) + ((this.selSqSzMrg.w * (gw)) + (this.selSqSzMrg.m * (gw + 1)))),
					ly = ((this.selSqSzMrg.h + this.selSqSzMrg.m) * (~~(g / msm)) + this.selSqSzMrg.m * 3),
					lw = this.selSqSzMrg.w,
					lh = this.selSqSzMrg.h;
				this.canvassesCtx.panel.drawImage(game.misc.menu_cs_border_green, 0, 0, 150, 100, lx, ly, lw, lh);
				//let boxref = this.characterSelectBoxes[g];
				let charref = this.parents.char.characters[g];
				
				
				if (!this.parameters.rpg && (charref?.core) && (`${charref.core.path}||${charref.versions[select.version].path}` in this.selectImages)) {
					let reference = this.selectImages[`${charref.core.path}||${charref.versions[select.version].path}`];
					
					this.canvassesCtx.background.drawImage(reference, 0, 600, 600, 600, 1280 - 580, 0, 720, 720);
				}
				if (this.parameters.rpg) {
					for (let kr = 0; kr < 3; kr++) {
						let rcharref = this.parents.char.characters[select.characterCards[kr].selection];
						if ((rcharref?.core) && (`${rcharref.core.path}||${rcharref.versions[select.characterCards[kr].version].path}(rpg)` in this.selectImages)) {
							let reference = this.selectImages[`${rcharref.core.path}||${rcharref.versions[select.characterCards[kr].version].path}(rpg)`];
							let aspect = 550 / 250;
							this.canvassesCtx.background.save();
							this.canvassesCtx.background.translate((1280 - (120 * aspect + 10)) + (120 * aspect / 2), (60 + 122 * kr) + (120 / 2));
							this.canvassesCtx.background.scale(-1, 1);
							this.canvassesCtx.background.drawImage(reference, 0, 0, 550, 250, -(120 * aspect / 2), -(120 / 2), 120 * aspect, 120);
							//this.canvassesCtx.background.setTransform(1,0,0,1,0,0)
							this.canvassesCtx.background.restore();
						}
						
					}
				}
				if (this.parameters.modePick) this.canvassesCtx.background.drawImage(game.misc.menu_cs_mode_pick, (100 * ((select.isOK) ? 3 : 0)), (100 + (100 * select.mode)), 100, 100, 1280 - 140, 420, 120, 120);
				else if (select.isOK) this.canvassesCtx.background.drawImage(game.misc.menu_cs_mode_pick, (100 * (3)), 0, 100, 100, 1280 - 140, 420, 120, 120);
				let kse = select.isOK ? select.selection : g;
				let kve = select.isOK ? select.version : v;
				this.charNames.right.assign(`${kse}|${kve}`);
				
			}
			if (this.isPanelPressed > 0) this.isPanelPressed = 0;
			if (this.isPanelPressedDown > 0) this.isPanelPressedDown = 0;
			////console.log(this.isPanelPressedDown, "fu")
		}
		changeSelectionChar(_select, n, s) {
			let select = _select;
			if (this.parameters.rpg) {
				if (_select.characterCardIndex == 0) {
					if (select.lastSelection !== n) {
						select.selection = n;
						select.lastSelection = n;
						select.version = 0;
					}
				}
				select = _select.characterCards[_select.characterCardIndex];
				if (select.lastSelection !== n) {
					select.selection = n;
					select.lastSelection = n;
					select.version = 0;
				}
				////console.log(select)
				return;
			}
			
			if (select.lastSelection !== n) {
				select.character = s;
				select.selection = n;
				select.lastSelection = n;
				select.version = 0;
			}
			
		}
		resize() {
			let size = this.parents.main.cellSize;
			let font = this.parents.main.fontSize;
			let ls = this.parents.main.landscape;
			let bg = this.canvasses.background;
			let pn = id("CSFRONT-PANEL");
			let pnc = this.canvasses.panel;
			let lm = 1;
			
			styleelem(bg, "width", `${ls.w}px`);
			styleelem(bg, "height", `${ls.h}px`);
			for (let ll of ["FRONT", "BEHIND"]) {
				style(`CHARSELECT-${ll}-DIV`, "width", `${ls.w}px`);
				style(`CHARSELECT-${ll}-DIV`, "height", `${ls.h}px`);
			}
			
			style(`CSBEHIND-DETAILS-DIV`, "width", `${ls.w}px`);
			style(`CSBEHIND-DETAILS-DIV`, "height", `${ls.h}px`);
			
			for (let ll of [1, 2]) {
				style(`CSBEHIND-DET-P${ll}-DIV`, "width", `${ls.w}px`);
				style(`CSBEHIND-DET-P${ll}-DIV`, "height", `${size * 5.6}px`);
				
				
				
				style(`CSBEHIND-P${ll}-VERSIONNAME`, "font-size", `${~~(font*lm * 1.3)}px`);
				style(`CSBEHIND-P${ll}-CHARNAME`, "font-size", `${~~(font*lm * 2.7)}px`);
				style(`CSBEHIND-P${ll}-PLAYERNAME`, "font-size", `${~~(font*lm * 1.6)}px`);
				
				style(`CSBEHIND-P${ll}-VERSIONNAME`, "width", `${ls.w}px`);
				style(`CSBEHIND-P${ll}-VERSIONNAME`, "height", `${~~(size * 1.3)}px`);
				
				style(`CSBEHIND-P${ll}-CHARNAME`, "width", `${ls.w}px`);
				style(`CSBEHIND-P${ll}-CHARNAME`, "height", `${~~(size * 2.6)}px`);
				
				style(`CSBEHIND-P${ll}-PLAYERNAME`, "width", `${ls.w}px`);
				style(`CSBEHIND-P${ll}-PLAYERNAME`, "height", `${~~(size * 1.7)}px`);
				
				//style(`CSBEHIND-P${ll}-CHARNAME`, "font-family", "josefinsans");
				
				for (let hh of ["VERSIONNAME", "PLAYERNAME", "CHARNAME"]) {
					style(`CSBEHIND-P${ll}-${hh}`, "text-align", ["left", "right"][ll - 1]);
					style(`CSBEHIND-P${ll}-${hh}`, "vertical-align", "center");
					style(`CSBEHIND-P${ll}-${hh}`, "position", "relative");
					
					style(`CSBEHIND-P${ll}-${hh}`, "bottom", "0");
					style(`CSBEHIND-P${ll}-${hh}`, ["left", "right"][ll - 1], `${size * 1}px`);
					
					
				}
				
			}
			
			styleelem(pn, "width", `${size * 35}px`);
			styleelem(pn, "height", `${size * 20}px`);
			styleelem(pn, "top", `${size * 2}px`);
			
			this.panelSize.w = size * 35;
			this.panelSize.h = size * 20;
			
			styleelem(pnc, "width", `${size * 35}px`);
			styleelem(pnc, "height", `${size * 20}px`);
			
			let rect = pn.getBoundingClientRect();
			this.panelSize.x = rect.x;
			this.panelSize.y = rect.y;
		}
		
		panelInteractListen(evt) {
			
			//evt.preventDefault();
			if (!this.isActive || fsw.isShown) return;
			let rect = id("CSFRONT-PANEL").getBoundingClientRect();
			this.panelSize.x = rect.x;
			this.panelSize.y = rect.y;
			
			let pageX = evt.pageX;
			let pageY = evt.pageY;
			
			if (evt.type == "touchstart" || evt.type == "touchmove") {
				pageX = evt.touches[0].pageX;
				pageY = evt.touches[0].pageY;
			}
			
			if (evt.type == "mousemove" || evt.type == "touchmove") {
				
				let x = (pageX - this.panelSize.x) / this.panelSize.w;
				let y = (pageY - this.panelSize.y) / this.panelSize.h;
				//////console.log(this.panelSize.x, this.panelSize.y)
				
				this.panelInteraction.x = x;
				this.panelInteraction.y = y;
				
				//ih("MENU-HEADER-TITLE", `${x} ${y}`);
				
				this.isPanelPressed = 1;
				////console.log(evt.type, x, y, this.panelSize, evt.pageX, evt.pageY)
			}
			if (evt.type == "mousedown" || evt.type == "touchstart") {
				
				
				this.isPanelPressing = 1;
				
				let x = (pageX - this.panelSize.x) / this.panelSize.w;
				let y = (pageY - this.panelSize.y) / this.panelSize.h;
				//////console.log(this.panelSize.x, this.panelSize.y)
				
				this.panelInteractionDown.x = x;
				this.panelInteractionDown.y = y;
				
			}
			
			if (evt.type == "mouseup" || evt.type == "touchend") {
				if (this.startDelay <= 0) this.isPanelPressedDown = 1;
				this.isPanelPressing = 0;
			}
			
			
			if (this.isPanelPressed || true) {
				
				
				
				//////console.log(evt.type, x, y, evt.pageX - this.panelSize.x, evt.pageY - this.panelSize.y, this.panelSize.w, this.panelSize.h);
			}
			
		}
		
		
		
		
		
		controlsListen(key) {
			
			let addition = 0;
			let select = this.activeSelection[this.selectUnderControl];
			let change = this.parameters.rpg ? select.characterCards[select.characterCardIndex].selection : select.selection;
			
			if (key === "arrowleft") {
				addition = -1;
				if ((((~~(change / 9)) - ~~(((change + addition)) / 9))) == 1) {
					addition += 9;
				}
			}
			if (key === "arrowright") {
				addition = 1;
				if (((~~(change / 9)) - ~~((change + addition) / 9)) == -1) {
					addition -= 9;
				}
			}
			if (key === "arrowup") {
				addition = -9;
			}
			if (key === "arrowdown") {
				addition = 9;
			}
			if (key === "enter" && (this.parents.main.pressAButtonDelay <= 0)) {
				//let select = this.activeSelection[this.selectUnderControl];
				this.checkButton(select);
				
				
			}
			if (key === "m") {
				//let select = this.activeSelection[this.selectUnderControl];
				select.mode = [1, 0][select.mode];
			}
			if (key === "backspace") {
				this.parents.main.backButton();
			}
			
			//if ()
			
			change += addition;
			console.log(change)
			
			if (change >= (9 * 4)) {
				change -= 9;
			}
			if (change < (0)) {
				change += 9;
			}
			
			if (change !== -1) {
				
				if (key !== "enter") this.changeSelectionChar(select, change, this.characterSelectBoxes[change].character);
				if (addition !== 0) this.parents.main.playSound("move");
			}
			
			
		}
		
	}(this, gtcharacter);
	
	
	
	
}();

__main_params__.__private.menu = menu;
if (__main_params__.appinfo.android) {
	__main_params__.accessible.menu = menu;
}
//////console.log(__main_params__.__private)

//fileLayer: fsw
//loaf

class FullscreenWindow {
	Page = class {
		constructor(parent) {
			this.parent = parent;
			this.elements = {};
			this.dpadBehavior = {
				type: "branch", //branch, smooth_vertical, smooth_horizontal, two-way
				vertical: null,
				horizontal: null,
				sped: 1
				
			}
			this.json = {
				string: "",
				elements: {},
				definedElementIds: {},
				selectables: [],
				horizontalSelectables: [],
				verticalSelectables: [],
				eventListeners: {},
				lastSelectableX: 0,
				lastSelectableY: 0,
				maxSelectables: 0
			}
			
			this.core = document.createElement("temporary");
			//this.definedElementIds = {};
			this.coreTemp = document.createElement("temporary");
			this.selectableIndex = {
				x: 0,
				y: 0,
				vertical: 0,
				horizontal: 0
			};
			this.scrollableIds = {
				horizontal: "",
				vertical: ""
			};
			this.headerTitle = "";
		}
		loadJSON(jsonString, isNextPage) {
			//console.log(jsonString)
			let json = JSON.parse(jsonString);
			let core = document.createElement("gtris-temporary-core");
			core.innerHTML = "";
			let parents = {};
			let onSelection = () => {
				this.hoverSelectable();
			};
			let defaultSelectable = {
				x: 0,
				y: 0,
				horizontal: 0,
				vertical: 0
			};
			this.dpadBehavior.type = json?.dpad_behavior || "branch";
			let vertical = json?.scroll_vertical_id || "";
			let horizontal = json?.scroll_horizontal_id || "";
			this.scrollableIds.horizontal = horizontal;
			this.scrollableIds.vertical = vertical;
			if (json?.title_lang) this.parent.header.titleValue.innerHTML = (language.translate(json.title_lang, [__main_params__.appinfo.version], ""));
			//let elementUUIDs = {};
			this.jsonRecursion(json.element, (element, parent) => {
				
				let uuid = generateUUID();
				
				let a = document.createElement(element.tag);
				this.elements[uuid] = a;
				this.json.elements[uuid] = element;
				let innerhtml = "";
				async function func(_innerhtml) {
					//let innerhtml = JSON.stringify(_innerhtml);
					let innerhtml = _innerhtml;
					if (element?.markdown) {
						//console.log(innerhtml);
						let arr = _innerhtml.split("\n");
						//console.log(arr)
						let jsa = "";
						for (let ar of arr) {
							let ks = document.createElement("gtris-subdiv");
							ks.style.width = "100%";
							ks.style.height = "auto";
							ks.style.position = "relative";
							ks.style.display = "flex";
							ks.style.flexDirection = "column";
							//ks.style.background = `rgba(${Math.random() * 255}${Math.random() * 255}${Math.random() * 255})`
							
							let indent = 0;
							while (true) {
								if (ar[indent] !== " ") break;
								indent++;
							}
							let trim = ar.trim(); //this deletes leading and trailing spaces 
							
							if (indent > 0) {
								let kksa = document.createElement("gtris-subdiv");
								kksa.style.fontSize = "2.75em";
								kksa.style.width = `${indent * 0.5}em`;
								kksa.style.height = "100%";
								ks.append(kksa);
							}
							
							
							let kksa = document.createElement("gtris-subdiv");
							kksa.style.fontSize = "1em";
							kksa.style.width = `calc(100% - ${indent * 0.5}em)`;
							kksa.style.height = "100%";
							ks.append(kksa);
							
							if (trim.startsWith("=# ")) {
								let mnt = trim.replace("=#", "");
								kksa.style.fontSize = "2.75em";
								//console.log(mnt)
								kksa.innerHTML = mnt;
							} else if (trim.startsWith("## ")) {
								let mnt = trim.replace("## ", "");
								//console.log(mnt)
								kksa.style.fontSize = "1.75em";
								kksa.innerHTML = mnt;
							} else if (trim.startsWith("# ")) {
								let mnt = trim.replace("#\u0020", "");
								kksa.style.fontSize = "2.25em";
								kksa.innerHTML = mnt;
							} else if (trim.startsWith("- ")) {
								let mnt = trim.replace("- ", "");
								kksa.style.fontSize = "1em";
								let svg = "<svg style=\"animation:board-fallrot-finisher-chain 2500ms infinite linear;width:0.75em;height:0.75em;margin-left:0.1em;margin-right:0.1em\" viewBox=\"0 0 60 60\" xmlns='http://www.w3.org/2000/svg' width=60 height=60><polygon style=\"stroke-width:0.1em;stroke:#000;fill:#fff\" points=\"0,20 20,20 20,0 40,0 40,20 60,20 60,40 0,40\"/></svg>"
								kksa.innerHTML = svg + mnt;
							} else {
								kksa.innerHTML = ar;
								if (ar.length == 0) ks.style.height = "0.8em"
							}
							
							
							jsa += ks.outerHTML;
						}
						
						innerhtml = jsa;
					}
					a.innerHTML = innerhtml;
					//console.log(innerhtml)
				}
				
				if ("text_lang" in element) innerhtml = func(language.translate(element.text_lang, [], "no langname"));
				else if ("load_text_lang" in element) {
					try {
						load(language.getLocalizationPath(element.load_text_lang)).then(mm => {
							func(mm);
							//console.log(mm)
						});
						
					} catch (e) {
						
					}
					
					
				} else innerhtml = func(element?.text_raw || "");
				
				
				
				
				let hk = this.json.elements[uuid];
				hk.fontSize = 1;
				hk.width = null;
				hk.height = null;
				hk.typeWidth = -1; //0 = cell, 1: percent of content size
				hk.typeHeight = -1;
				hk.focus_horizontal = "";
				hk.focus_vertical = "";
				hk.selectable = {
					type: "none",
					x: 0,
					y: 0,
					vertical: 0,
					horizontal: 0
				};
				hk.maxSelectable = 0
				hk.functions = {};
				//hk.scrollByUpDown = false;
				
				for (let attrName in hk.attributes) {
					let attr = element.attributes[attrName];
					switch (attrName) {
						case "mattr": {
							for (let k in attr) {
								let attribute = attr[k];
								//console.log(a)
								a.setAttribute(k, attribute);
							}
							break;
						}
						case "id": {
							this.json.definedElementIds[attr] = uuid;
							a.setAttribute("ids", attr)
							break;
						}
						case "font_size": {
							hk.fontSize = attr;
							break;
						}
						case "width": {
							hk.width = attr;
							break;
						}
						case "height": {
							hk.height = attr;
							break;
						}
						case "value": {
							a.value = attr;
							break;
						}
						case "width_type": {
							hk.typeWidth = attr;
							break;
						}
						case "height_type": {
							hk.typeHeight = attr;
							break;
						}
						case "scroll_vertical": {
							//let ls = attr.split("default")[0];
							this.dpadBehavior.vertical = a;
							break;
						}
						case "selectable": {
							let ls = attr.split("default")[0];
							let lg = ls.split("|");
							hk.selectable.x = ~~lg[1];
							hk.selectable.y = ~~lg[0];
							hk.selectable.type = "branch";
							
							
							if (attr.includes("default")) {
								
								defaultSelectable.x = ~~lg[1];
								defaultSelectable.y = ~~lg[0];
							}
							break;
						}
						case "selectable_vertical": {
							let ls = attr.split("default")[0];
							hk.selectable.type = "vertical";
							hk.selectable.vertical = ~~ls
							if (attr.includes("default")) {
								defaultSelectable.vertical = ~~ls;
							}
							break;
						}
						case "selectable_horizontal": {
							let ls = attr.split("default")[0];
							hk.selectable.type = "horizontal";
							hk.selectable.horizontal = ~~ls
							if (attr.includes("default")) {
								defaultSelectable.horizontal = ~~ls;
							}
							break;
						}
						case "target_scroll_y": {
							//let ls = at;
							hk.focus_vertical = attr;
						}
						case "target_scroll_x": {
							//let ls = at;
							hk.focus_horizontal = attr;
						}
						case "style": {
							for (let k in attr) {
								let style = attr[k];
								//console.log(a)
								a.style.setProperty(k, style);
							}
							break;
						}
						case "event_functions": {
							for (let k in attr) {
								let str = "";
								
								let el = attr[k];
								let fun = new Function(["__this", "local", "__fsw", "__hover", "__getElementId", "__inputfocus"], el);
								hk.functions[k] = ((event, type) => {
									fun(a, __main_params__.__private, this.parent, () => {
										//console.log(hk.selectable)
										if (hk.selectable.type == "branch") this.hoverSelectable(hk.selectable.y, hk.selectable.x);
										if (hk.selectable.type == "horizontal") this.hoverSelectableX(hk.selectable.horizontal);
										if (hk.selectable.type == "vertical") this.hoverSelectableY(hk.selectable.vertical);
									}, (id) => {
										let lla = this.getElementById(id);
										//console.log(lla)
										return this.elements[lla];
									}, () => {
										
										
										let aj = function(ns) {
											keypressManager.isTyping = false;
											keypressManager.removeListener("typing");
											//a.removeEventListener("blur", aj);
										};
										a.addEventListener("blur", aj, {
											once: true
										});
										if (keypressManager.isTyping) return;
										keypressManager.isTyping = true;
										a.focus();
										keypressManager.addListener("typing", (code, type) => {
											//console.log(code, type)
											if (type == "keydown" && code == "escape") {
												aj();
											}
										})
									});
								});
							}
							break;
						}
						
						case "event_listeners": {
							for (let k in attr) {
								let el = attr[k];
								//this.json.eventListeners[];
								a.addEventListener(k, (ev) => {
									hk.functions[el](ev, k);
								});
							}
							break;
						}
						
					}
				}
				element.uuid = uuid;
				//console.log(a)why
				
			}, {});
			this.jsonRecursion(json.element, (element, parent) => {
				
				
				let parentStr = "core";
				if ("uuid" in parent) {
					parentStr = parent.uuid;
				}
				
				parents[element.uuid] = parentStr
				
			}, {});
			
			for (let elemn in parents) {
				let parent = parents[elemn];
				if (parent == "core") core.appendChild(this.elements[elemn]);
				else this.elements[parent].appendChild(this.elements[elemn]);
				
			}
			//	console.log(core.outerHTML);
			for (let elemn in this.json.elements) {
				let m = this.json.elements[elemn];
				if (m.selectable.type == "branch" && m.selectable.x >= 0 && m.selectable.y >= 0) {
					let selectionYIndex = m.selectable.y;
					if (!this.json.selectables[selectionYIndex]) this.json.selectables[selectionYIndex] = [];
					this.json.selectables[selectionYIndex].push(elemn);
					
				}
				if ((m.selectable.type == "vertical") && m.selectable.vertical >= 0) {
					this.json.verticalSelectables.push(elemn);
				}
				if ((m.selectable.type == "horizontal") && m.selectable.vertical >= 0) {
					this.json.horizontalSelectables.push(elemn);
					
				}
			}
			//console.log(core.outerHTML);
			this.core = core;
			
			switch (this.dpadBehavior.type) {
				case "branch": {
					this.hoverSelectable(defaultSelectable.y, defaultSelectable.x);
					break;
				}
				case "smooth_vertical": {
					this.hoverSelectableX(defaultSelectable.horizontal);
					break;
				}
				case "smooth_horizontal": {
					this.hoverSelectableY(defaultSelectable.vertical);
					break;
				}
				case "horizontal": {
					this.hoverSelectableX(defaultSelectable.horizontal);
					break;
				}
				case "vertical": {
					this.hoverSelectableY(defaultSelectable.vertical);
					break;
				}
			}
			//console.log(core.outerHTML);
			
			//core.innerText=""
			
			
		}
		jsonRecursion(elem, func, parent) {
			func(elem, parent);
			if ("children" in elem)
				for (let k of elem.children) {
					this.jsonRecursion(k, func, elem);
				}
		}
		getElementById(id) {
			return this.json.definedElementIds[id];
		}
		hoverSelectable(indexY, indexX, isSelect) {
			//console.log(this.json.selectables, indexY, indexX)
			//console.log(this.json.selectables);
			if (indexX == -1) {
				let j = 0;
				while (this.json.selectables[indexY][j]) {
					j++;
				}
				indexX = j;
			}
			if (!(this.json.selectables[indexY][indexX])) indexX = 0;
			if (this.json.selectables[indexY] && (this.json.selectables[indexY][indexX])) {
				let lastSelectable = this.json.selectables[this.selectableIndex.y][this.selectableIndex.x];
				//console.log(this.json.elements[lastSelectable])
				this.selectableIndex.x = indexX;
				this.selectableIndex.y = indexY
				
				
				//let lastElem = this.json.selectables[lastSelectable];
				let newElem = this.json.selectables[indexY][indexX];
				let cur = this.elements[newElem];
				let jsoncur = this.json.elements[newElem];
				if ((jsoncur.focus_horizontal !== "") || (jsoncur.focus_vertical !== "")) {
					if (jsoncur.focus_horizontal !== "") {
						let sivArgs = {
							block: "center",
							inline: "nearest",
							behavior: "smooth",
						};
						
						sivArgs.scrollable = this.elements[this.json.definedElementIds[jsoncur.focus_horizontal]];
						cur.scrollIntoView(sivArgs);
					}
					if (jsoncur.focus_vertical !== "") {
						let sivArgs = {
							block: "center",
							inline: "nearest",
							behavior: "smooth",
						};
						
						sivArgs.scrollable = this.elements[this.json.definedElementIds[jsoncur.focus_vertical]];
						
						cur.scrollIntoView(sivArgs);
					}
				}
				if (isSelect) {
					this.json.elements[newElem].functions.select();
					return;
				}
				if ("hoverout" in this.json.elements[lastSelectable]?.functions) this.json.elements[lastSelectable].functions.hoverout();
				this.json.elements[newElem].functions.hoverin();
				//console.log("blyad", newElem)
			}
		}
		hoverSelectableX(index, isSelect) {
			//console.log(this.json.selectables)
			let selSet = this.json.horizontalSelectables;
			if (this.json.horizontalSelectables[index]) {
				let lastSelectable = selSet[this.selectableIndex.horizontal];
				this.selectableIndex.horizontal = index;
				
				
				//let lastElem = this.json.selectables[lastSelectable];
				let newElem = selSet[index];
				let cur = this.elements[newElem];
				let jsoncur = this.json.elements[newElem];
				if ((jsoncur.focus_horizontal !== "") || this.scrollableIds.horizontal) {
					let sivArgs = {
						block: "center",
						inline: "nearest",
						behavior: "smooth",
					};
					if (jsoncur.focus_horizontal !== "") {
						sivArgs.scrollable = this.elements[this.json.definedElementIds[jsoncur.focus_horizontal]];
					} else
					if (this.scrollableIds.horizontal !== "") {
						
						sivArgs.scrollable = this.elements[this.json.definedElementIds[this.scrollableIds.horizontal]];
						
					}
					cur.scrollIntoView(sivArgs);
					
				}
				if (isSelect) {
					this.json.elements[newElem].functions.select();
					return;
				}
				if ("hoverout" in this.json.elements[lastSelectable]?.functions) this.json.elements[lastSelectable].functions.hoverout();
				this.json.elements[newElem].functions.hoverin();
				//console.log("blyad", newElem)
			}
		}
		hoverSelectableY(index, isSelect) {
			//console.log(this.json.selectables)
			let selSet = this.json.verticalSelectables;
			if (this.json.verticalSelectables[index]) {
				let lastSelectable = selSet[this.selectableIndex.vertical];
				this.selectableIndex.vertical = index;
				
				
				//let lastElem = this.json.selectables[lastSelectable];
				let newElem = selSet[index];
				let cur = this.elements[newElem];
				let jsoncur = this.json.elements[newElem];
				if ((jsoncur.focus_vertical !== "") || this.scrollableIds.vertical) {
					let sivArgs = {
						block: "center",
						inline: "nearest",
						behavior: "smooth",
					};
					if (jsoncur.focus_vertical !== "") {
						sivArgs.scrollable = this.elements[this.json.definedElementIds[jsoncur.focus_vertical]];
					} else
					if (this.scrollableIds.vertical !== "") {
						
						sivArgs.scrollable = this.elements[this.json.definedElementIds[this.scrollableIds.vertical]];
						
					}
					cur.scrollIntoView(sivArgs);
					
				}
				
				
				//this.parent.content.innerHTML = this.parent.content.innerHTML.replace("[object Object]", "")
				//console.log(this.parent.content.innerHTML)
				if (isSelect) {
					this.json.elements[newElem].functions.select();
					return;
				}
				if ("hoverout" in this.json.elements[lastSelectable]?.functions) this.json.elements[lastSelectable].functions.hoverout();
				this.json.elements[newElem].functions.hoverin();
				//console.log("blyad", newElem)
			}
		}
		upOrDown(num) {
			//let add = num;
			if (num == 0) return;
			let u = this.dpadBehavior.type;
			if (u === "vertical") {
				u = "smooth_horizontal";
			} else if (u === "horizontal") {
				u = "smooth_vertical";
			}
			switch (u) {
				case "branch": {
					let value = this.selectableIndex.y + num;
					this.hoverSelectable(value, this.selectableIndex.x);
					break;
				}
				
				case "smooth_horizontal": {
					let value = this.selectableIndex.vertical + num;
					this.hoverSelectableY(value);
					break;
					
				}
				case "smooth_vertical": {
					let value = this.selectableIndex.herizontal + num;
					this.hoverSelectableX(value);
					break;
					
				}
				case "vertical": {
					let value = this.selectableIndex.vertical + num;
					this.hoverSelectableY(value);
					break;
					
				}
				case "horizontal": {
					let value = this.selectableIndex.herizontal + num;
					this.hoverSelectableX(value);
					break;
					
				}
			}
		}
		leftOrRight(num) {
			//let add = num;
			if (num == 0) return;
			let u = this.dpadBehavior.type;
			if (u === "vertical") {
				u = "horizontal";
			} else if (u === "horizontal") {
				u = "vertical";
			}
			switch (u) {
				case "branch": {
					let value = this.selectableIndex.x + num;
					this.hoverSelectable(this.selectableIndex.y, value);
					break;
				}
				case "smooth_vertical": {
					let value = this.selectableIndex.horizontal + num;
					this.hoverSelectableX(value);
					break;
					
				}
				
			}
		}
		selectOrBack(num) {
			let u = this.dpadBehavior.type;
			if (u === "vertical") {
				u = "smooth_horizontal";
			} else if (u === "horizontal") {
				u = "smooth_vertical";
			}
			//console.log("select")
			if (num == 1)
				switch (u) {
					case "branch": {
						let value = this.selectableIndex.x;
						this.hoverSelectable(this.selectableIndex.y, value, true);
						break;
					}
					case "smooth_vertical": {
						let value = this.selectableIndex.horizontal;
						this.hoverSelectableX(value, true);
						break;
						
					}
					case "smooth_horizontal": {
						let value = this.selectableIndex.vertical;
						this.hoverSelectableY(value, true);
						break;
						
					}
				}
			else if (num === -1) {
				this.parent.back();
			}
		}
		listen(oneBitkey, type) {
			let v = 0,
				h = 0,
				ab = 0;
			//let oneBitkey = flag;
			if (oneBitkey & this.parent.flags.down) v = 1;
			if (oneBitkey & this.parent.flags.up) v = -1;
			if (oneBitkey & this.parent.flags.left) h = -1;
			if (oneBitkey & this.parent.flags.right) h = 1;
			if (oneBitkey & this.parent.flags.a) ab = 1;
			if (oneBitkey & this.parent.flags.b) ab = -1;
			if (type === "keydown") {
				//console.log(v, h, ab);
				this.upOrDown(v);
				this.leftOrRight(h);
			}
			if (type === "keyup") this.selectOrBack(ab);
		}
		
		update() {
			let u = this.dpadBehavior.type;
			//if (u === "vertical") u = ""
			//console.log(this.core.outerHTML)
			switch (u) {
				case "smooth_horizontal": {
					if (!this.dpadBehavior.horizontal) return;
					let v = 0;
					let oneBitkey = this.parent.bitkey;
					// TODO simulate SOCD controls   lol jk XD
					if (oneBitkey | this.parent.flags.left) v = 1;
					if (oneBitkey | this.parent.flags.right) v = -1;
					
					this.dpadBehavior.horizontal.scrollTop = Math.max(this.dpadBehavior.horizontal.scrollTop + v, 0)
					break;
				}
				case "smooth_vertical": {
					if (!this.dpadBehavior.vertical) return;
					let v = 0;
					let oneBitkey = this.parent.bitkey;
					// TODO simulate SOCD controls   lol jk XD
					if (oneBitkey | this.parent.flags.down) v = 1;
					if (oneBitkey | this.parent.flags.up) v = -1;
					
					this.dpadBehavior.horizontal.scrollTop = Math.max(this.dpadBehavior.vertical.scrollTop + v, 0)
					break;
					
				}
				case "vertical": {
					//if (!this.dpadBehavior.vertical) return;
					let v = 0;
					let oneBitkey = this.parent.bitkey;
					// TODO simulate SOCD controls   lol jk XD
					if (oneBitkey | this.parent.flags.left) v = 1;
					if (oneBitkey | this.parent.flags.right) v = -1;
					
					//this.dpadBehavior.horizontal.scrollTop = Math.max(this.dpadBehavior.horizontal.scrollTop + v, 0)
					break;
				}
				case "horizontal": {
					//if (!this.dpadBehavior.horizontal) return;
					let v = 0;
					let oneBitkey = this.parent.bitkey;
					// TODO simulate SOCD controls   lol jk XD
					if (oneBitkey | this.parent.flags.down) v = 1;
					if (oneBitkey | this.parent.flags.up) v = -1;
					
					//this.dpadBehavior.horizontal.scrollTop = Math.max(this.dpadBehavior.vertical.scrollTop + v, 0)
					break;
					
				}
				
			}
		}
		
		resizeElements(w, h, fs, cs) {
			for (let uuid in this.json.elements) {
				let ref = this.json.elements[uuid];
				let element = this.elements[uuid];
				//console.log(ref)
				
				if (ref.width !== null && ref.typeWidth !== -1) {
					let width = [cs, w / 100][ref.typeWidth] * ref.width;
					element.style.width = width + "px";
				}
				if (ref.height !== null && ref.typeHeight !== -1) {
					let height = [cs, h / 100][ref.typeHeight] * ref.height;
					element.style.height = height + "px";
				}
				
				element.style.fontSize = fs * ref.fontSize + "px";
				//console.log(element.style.width, element.attributes.ids?.value, element.style)
			}
		}
	}
	
	functions = {
		Keybinds: class {
			constructor(p) {
				this.a = p
			}
			static checkKeybindSimilarities(main, keytest, type) {
				let zl = ["general"];
				if (type !== "general") {
					zl.push(type);
				}
				for (let km of zl)
					for (let mk of keypressManager.BIND_NAMES[km]) {
						let lc = main[km][mk].split(keypressManager.STRING_SEPARATOR);
						//console.log(lc)
						for (let sj = 0; sj < lc.length; sj++) {
							let hl = lc[sj];
							if (!(hl in keytest)) keytest[hl] = 1;
							else keytest[hl]++;
						}
					}
				
			}
			static openSettings(type, isReturn) {
				
				//join all keyd first:
				let ja = fsw;
				let b = ja.functions.Keybinds;
				
				let main = menu.storage.getItem('keyboard');
				let data = main[type];
				//console.log(data)
				//EricLenovo
				//detect duplicate keys in one (self) or more (grouped) key flags.
				// multiple keys of the same kind in a single key flag may be possible if either a user data in the database
				// gets edited or the game has a bug. In case this happens, I put an extra code for it.
				
				let keytest = {};
				
				b.checkKeybindSimilarities(main, keytest, type);
				
				let a = fsw;
				let mo = "general";
				if (type !== "general") mo = ["gtris", "blob"][type];
				let test = {};
				let json = {
					"title_lang": "fsw_kb_ig_" + mo,
					"prevent_default": true,
					"dpad_behavior": "vertical",
					"scroll_vertical_id": "scroll_y",
					"element": {}
				};
				json.element = {
					"tag": "gtris-div",
					"attributes": {
						"id": "scroll_y",
						"font_size": 2,
						"width": 100,
						"height": 100,
						"width_type": 1,
						"height_type": 1,
						"style": {
							"display": "block",
							"position": "relative",
							"overflow": "hidden scroll"
						}
					},
					"children": []
				}
				let listIndex = 0;
				for (let y of keypressManager.BIND_NAMES[type]) {
					let _mk = [];
					let lc = data[y].split(keypressManager.STRING_SEPARATOR);
					for (let u of lc) {
						if (u == " ") _mk.push("[SPACE BAR]");
						else _mk.push(u);
					}
					
					
					
					let mk = "";
					let isError = false;
					for (let sj = 0; sj < lc.length; sj++) {
						let hl = lc[sj];
						if ((hl in keytest) && keytest[hl] > 1) isError = true;
						mk += `<span style="padding: 0.4em; margin: 0.6em; background: #646">${_mk[sj]}</span>`;
						if (_mk.length - 1 !== sj) mk += ", ";
					}
					let bg = isError ? "#d66" : "#ddd"
					
					let mjson = {
						
						"tag": "gtris-button",
						"attributes": {
							"font_size": 1,
							"width": 90,
							
							"width_type": 1,
							
							"selectable_vertical": `${listIndex}${listIndex == 0 ? "default":""}`,
							"style": {
								"height": "3em",
								"display": "flex",
								"justify-content": "center",
								"align-items": "center",
								"flex-direction": "column",
								"position": "relative",
								"margin-left": "auto",
								"margin-right": "auto",
								"border": "3px solid #000",
								"background": bg,
								"padding": "0.2em 0.2em 0.2em 0.2em",
								
							},
							"event_functions": {
								"hoverin": "__this.style.background = \"#a3a\";",
								"hoverout": `__this.style.background = \"${bg}\";`,
								"mouseover": "__hover();",
								"select": `__fsw.functions.Keybinds.openFlag(\"${type}\", ${listIndex});`
							},
							
							"event_listeners": {
								"mouseover": "mouseover",
								"click": "select"
							}
						},
						"children": [
						{
							"tag": "gtris-button-text",
							"text_lang": `fsw_kb_ig_${mo}_${y}`,
							"attributes": {
								"font_size": 1.3,
								"style": {
									"width": "auto",
									"height": "calc(100% - 0.9em)",
									"text_align": "center",
									"position": "relative",
									"display": "blcok"
								}
							}
						}]
						
					};
					mjson.children.push(
					{
						"tag": "gtris-button-text",
						"text_raw": mk,
						"attributes": {
							"font_size": 0.9,
							"style": {
								"width": "auto",
								"height": "0.9em",
								"position": "relative"
								
							}
						}
					})
					json.element.children.push(mjson);
					
					listIndex++;
				};
				
				
				if (isReturn) return JSON.stringify(json);
				a.loadPageSync(JSON.stringify(json), void 0);
			}
			
			static openFlag(type, flag, isReturn) {
				
				//join all keyd first:
				let ja = fsw;
				let b = ja.functions.Keybinds;
				
				let main = menu.storage.getItem('keyboard');
				let data = main[type][keypressManager.BIND_NAMES[type][flag]].split(keypressManager.STRING_SEPARATOR);
				//console.log(flag, main, data)
				//EricLenovo
				//detect duplicate keys in one (self) or more (grouped) key flags.
				// multiple keys of the same kind in a single key flag may be possible if either a user data in the database
				// gets edited or the game has a bug. In case this happens, I put an extra code for it.
				
				let keytest = {};
				b.checkKeybindSimilarities(main, keytest, type);
				
				let a = fsw;
				let mo = "general";
				if (type !== "general") mo = ["gtris", "blob"][type];
				
				let mq = keypressManager.BIND_NAMES[type][flag];
				let test = {};
				let json = {
					"title_lang": "fsw_kb_ig_" + mo,
					"prevent_default": true,
					"dpad_behavior": "branch",
					"element": {}
				};
				json.element = {
					"tag": "gtris-div",
					"attributes": {
						"id": "scroll_y",
						"font_size": 2,
						"width": 100,
						"height": 100,
						"width_type": 1,
						"height_type": 1,
						"style": {
							"display": "block",
							"position": "relative",
							"overflow": "hidden scroll"
						}
					},
					"children": []
				};
				//EricLenovo: my stupid SPCK editor had a bug when pretty-printing this
				//so to make this one look neat, I decided to do this.
				//title and description 
				
				//{
				json.element.children.push({
					"tag": "gtris-div",
					"attributes": {
						"font_size": 2,
						"width": 100,
						"width_type": 1,
						"style": {
							"display": "flex",
							"flex-direction": "row",
							"position": "relative",
							height: "auto",
							"justify-content": "center",
							"align-items": "center",
							"overflow": "hidden"
						}
					},
					"children": []
				});
				json.element.children[0].children.push(
				{
					"tag": "gtris-div",
					"attributes": {
						"font_size": 4,
						"style": {
							"display": "flex",
							"flex-direction": "column",
							"position": "relative",
							height: "auto",
							"justify-content": "center",
							"align-items": "center",
						}
					},
					"children": [{
						"tag": "gtris-button-text",
						"text_lang": `fsw_kb_ig_${mo}_${mq}`,
						"attributes": {
							"font_size": 1.215,
							"style": {
								"text_align": "center",
								"position": "relative",
								"text-align": "center",
								"vertical-align": "center",
								"display": "block"
							}
						}
					},
					{
						"tag": "gtris-button-text",
						"text_lang": `fsw_kb_ig_${mo}_${mq}_desc`,
						"attributes": {
							"font_size": 0.9,
							"style": {
								"text_align": "center",
								"position": "relative",
								"text-align": "center",
								"vertical-align": "center",
								"display": "block"
							}
						}
					}]
				})
				//}
				//add button div [1]
				json.element.children.push({
					"tag": "gtris-div",
					"attributes": {
						"font_size": 2,
						"width": 100,
						"width_type": 1,
						"style": {
							"display": "flex",
							"position": "relative",
							height: "auto",
							"justify-content": "center",
							"align-items": "center",
							"overflow": "hidden hidden"
						}
					},
					"children": []
				});
				
				//text for buttons list[2]
				json.element.children.push(
				{
					"tag": "gtris-div",
					"attributes": {
						"font_size": 4,
						"style": {
							"display": "flex",
							"flex-direction": "column",
							"position": "relative",
							height: "auto",
							"justify-content": "center",
							"align-items": "center",
						}
					},
					"children": [{
						"tag": "gtris-button-text",
						"text_lang": `fsw_kb_buttonslist_text`,
						"attributes": {
							"font_size": 1.215,
							"style": {
								"text_align": "center",
								"position": "relative",
								"text-align": "center",
								"vertical-align": "center",
								"display": "block"
							}
						}
					}]
				})
				
				//button list [3]
				json.element.children.push({
					"tag": "gtris-div",
					"attributes": {
						id: "scroll_x",
						"font_size": 2,
						"width": 100,
						"width_type": 1,
						"style": {
							"display": "flex",
							"position": "relative",
							height: "auto",
							"justify-content": "flex-start",
							"align-items": "center",
							"overflow": "scroll hidden"
						}
					},
					"children": []
				});
				//remove button div [4]
				json.element.children.push({
					"tag": "gtris-div",
					"attributes": {
						"font_size": 2,
						"width": 100,
						"width_type": 1,
						"style": {
							"display": "flex",
							"position": "relative",
							height: "auto",
							"justify-content": "center",
							"align-items": "center",
							"overflow": "hidden hidden"
						}
					},
					"children": []
				});
				
				//add button
				json.element.children[1].children.push({
					"tag": "gtris-button",
					"attributes": {
						"font_size": 1,
						"width": 7,
						"height": 2,
						"width_type": 0,
						"height_type": 0,
						"selectable": `0|0default`,
						"style": {
							"display": "flex",
							"justify-content": "center",
							"align-items": "center",
							"flex-direction": "column",
							"position": "relative",
							"margin-left": "auto",
							"margin-right": "auto",
							"border": "3px solid #000",
							"background": "#ddd",
							"padding": "0.2em 0.2em 0.2em 0.2em",
							
						},
						"event_functions": {
							"hoverin": "__this.style.background = \"#a3a\";",
							"hoverout": "__this.style.background = \"#ddd\";",
							"mouseover": "__hover();",
							"select": `__fsw.functions.Keybinds.addButton(${type}, ${flag});`
						},
						
						"event_listeners": {
							"mouseover": "mouseover",
							"click": "select"
						}
					},
					"children": [
					{
						"tag": "gtris-button-text",
						"text_lang": `fsw_kb_ig_add`,
						"attributes": {
							"font_size": 1.215,
							"style": {
								"text_align": "center",
								"position": "relative",
								"display": "blcok"
							}
						}
					}]
					
				});
				let listIndex = 0;
				
				
				for (let u of data) {
					let mk = u;
					if (u == " ") mk = ("[SPACE BAR]")
					
					
					
					let isError = (u in keytest) && keytest[u] > 1;
					
					
					//if () isError = true;
					let bg = isError ? "#d66" : "#ddd";
					
					json.element.children[3].children.push(
					{
						
						"tag": "gtris-button",
						"attributes": {
							"font_size": 1,
							"width": 7,
							"height": 2,
							"width_type": 0,
							"height_type": 0,
							"selectable": `1|${listIndex}`,
							"style": {
								"display": "flex",
								"justify-content": "center",
								"align-items": "center",
								"flex-direction": "column",
								"position": "relative",
								"margin-left": "auto",
								"margin-right": "auto",
								"border": "3px solid #000",
								"background": bg,
								"padding": "0.2em 0.2em 0.2em 0.2em",
								
							},
							"event_functions": {
								"hoverin": "__this.style.background = \"#f3a\";",
								"hoverout": `__this.style.background = \"${bg}\";`,
								"mouseover": "__hover();",
								"select": `__fsw.functions.Keybinds.changeButton(${type}, ${flag}, ${listIndex});`
							},
							
							"event_listeners": {
								"mouseover": "mouseover",
								"click": "select"
							}
						},
						"children": [
						{
							"tag": "gtris-button-text",
							"text_raw": mk,
							"attributes": {
								"font_size": 1.215,
								"style": {
									"text_align": "center",
									"position": "relative",
									"display": "blcok"
								}
							}
						}]
						
					});
					
					listIndex++;
				};
				
				
				if (isReturn) return JSON.stringify(json);
				a.loadPageSync(JSON.stringify(json), void 0);
			}
			
			static addButton(type, flag) {
				let a = fsw;
				let b = a.functions.Keybinds;
				alertWindow.showhide(true);
				let flagname = keypressManager.BIND_NAMES[type][flag];
				
				let _str = language.translate("fsw_kb_adding_text_you", [language.translate(`fsw_kb_ig_${["gtris", "blob"][type]}_${flagname}`)]).split("[nl]").join("<br />");
				
				let str = _str;
				let isUnique = true;
				let started = false;
				let del = 0;
				let saveTime = -1;
				let isKeyDown = false;
				let isKeyUp = false;
				let isDone = false;
				let isAllGood = false;
				let keycode = "";
				let startable = true; //this may be unnecessary
				let kk = menu.storage.getItem("keyboard");
				let data = kk[type][flagname].split(keypressManager.STRING_SEPARATOR);
				
				function mmm() {
					isDone = true;
					isKeyUp = 1;
					del = 10;
					window.removeEventListener("mousedown", mmm);
				}
				window.addEventListener("mousedown", mmm);
				keypressManager.isKeyBindingMode = true;
				alertWindow.editText(str);
				keypressManager.addListener("adding", (_keycode, type) => {
					if (type == "keydown" && !started) {
						isKeyDown = true;
						started = true;
						keycode = _keycode;
						for (let j of data) {
							if (keycode == j) {
								isUnique = false;
								break;
							}
						}
					}
					if (type == "keyup") {
						if (!started || keycode !== _keycode) {
							
							return;
						}
						isKeyUp = true;
					}
				});
				if (startable) {
					startable = false;
					game.addLoop("addingbind", () => {
						let mstr = "";
						if (!isKeyUp && isKeyDown) {
							del++;
							mstr = language.translate("fsw_kb_adding_binding_you", [keycode]);
							mstr += `<br /><gs style="display: inline-block; position: relative; border: 2px solid #fff; width: ${fsw.width * 0.8}px; height: 1em; text-align: left"><gs style="position: relative; background:#fff; width: ${100 * (del/60)}%; display: inline-block; height: 100%"></gs></gs>`;
							alertWindow.editText(str);
							if (del == 1) {
								menu.playSound("keybindready1");
							}
							if (del == 30) {
								menu.playSound("keybindready2");
							}
							if (del == 60) {
								isDone = true;
								//let isUnique = true;
								if (isUnique) {
									menu.playSound("keybindready3");
									isAllGood = true;
									saveTime = 10;
									data.push(keycode);
									kk[type][flagname] = data.join(keypressManager.STRING_SEPARATOR);
									menu.storage.setItem("keyboard", kk);
									//console.log(kk)
								} else {
									log.error(
										language.translate("error_kb_duplicate", [keycode]),
										language.translate("error_kb_duplicate_desc")
									)
								}
								menu.saveFrame = 10;
							}
						}
						if (isKeyUp) {
							isDone = true;
						}
						if (isDone) {
							do {
								keypressManager.isKeyBindingMode = false;
								if (del >= 60) {
									
									mstr = language.translate("fsw_kb_setting_saving_you", [keycode]);
								} else {
									menu.playSound("keybindcancel");
								}
								
								if (isAllGood) {
									if (saveTime > 0) {
										saveTime--;
										if (saveTime <= 0) {
											
											a.loadPageSync(b.openSettings(type, true), a.pageIndex - 1, true);
											a.loadPageSync(b.openFlag(type, flag, true), a.pageIndex, false);
										}
										else {
											break;
										}
									}
								}
								
								game.removeLoop("addingbind");
								keypressManager.removeListener("adding");
								window.setTimeout(() => {
									
									alertWindow.showhide(false);
								}, 10);
							} while (false);
						}
						
						alertWindow.editText(str + "<br /><br />" + mstr);
					});
				}
			}
			static changeButton(type, flag, index) {
				let a = fsw;
				let b = a.functions.Keybinds;
				alertWindow.showhide(true);
				let flagname = keypressManager.BIND_NAMES[type][flag];
				let kk = menu.storage.getItem("keyboard");
				let data = kk[type][flagname].split(keypressManager.STRING_SEPARATOR);
				let activeKeycode = data[index];
				
				let _str = language.translate("fsw_kb_changing_text_you", [language.translate(`fsw_kb_ig_${["gtris", "blob"][type]}_${flagname}`), activeKeycode]).split("[nl]").join("<br />");
				
				let str = _str;
				let isUnique = true;
				let started = false;
				let del = 0;
				let saveTime = -1;
				let isKeyDown = false;
				let isKeyUp = false;
				let isNothing = false;
				let isDone = false;
				let isAllGood = false;
				let keycode = "";
				let startable = true; //this may be unnecessary
				let isRemove = false;
				let removeIndex = -1;
				keypressManager.isKeyBindingMode = true;
				alertWindow.editText(str);
				
				function mmm() {
					isDone = true;
					isKeyUp = 1;
					del = 10;
					window.removeEventListener("mousedown", mmm);
				}
				window.addEventListener("mousedown", mmm);
				keypressManager.addListener("changing", (_keycode, type) => {
					if (type == "keydown" && !started) {
						isKeyDown = true;
						started = true;
						keycode = _keycode;
						let i = 0;
						if (activeKeycode == keycode) {
							isRemove = true;
							
						}
						for (let j of data) {
							if (keycode == j) {
								isUnique = false;
								break;
								
								
								
								removeIndex++;
							}
						}
					}
					if (type == "keyup") {
						if (!started || keycode !== _keycode) {
							
							return;
						}
						isKeyUp = true;
					}
				});
				if (startable) {
					startable = false;
					game.addLoop("changingbind", () => {
						let mstr = "";
						if (!isKeyUp && isKeyDown) {
							del++;
							if (isNothing) mstr = language.translate("fsw_kb_changing_nothing_you", [keycode]);
							else if (isRemove) mstr = language.translate("fsw_kb_changing_removing_you", [keycode]);
							else mstr = language.translate("fsw_kb_changing_binding_you", [keycode]);
							mstr += `<br /><gs style="display: inline-block; position: relative; border: 2px solid #fff; width: ${fsw.width * 0.8}px; height: 1em; text-align: left"><gs style="position: relative; background:#fff; width: ${100 * (del/60)}%; display: inline-block; height: 100%"></gs></gs>`;
							alertWindow.editText(str);
							if (del == 1) {
								menu.playSound("keybindready1");
							}
							if (del == 30) {
								menu.playSound("keybindready2");
							}
							if (del == 60) {
								isDone = true;
								//let isUnique = true;
								if (isUnique) {
									menu.playSound("keybindready3");
									isAllGood = true;
									saveTime = 10;
									data[index] = (keycode);
									kk[type][flagname] = data.join(keypressManager.STRING_SEPARATOR);
									menu.storage.setItem("keyboard", kk);
									//console.log(kk)
									menu.saveFrame = 10;
								} else if (!isRemove) {
									log.error(
										language.translate("error_kb_duplicate", [keycode]),
										language.translate("error_kb_duplicate_desc")
									);
								}
								if (isRemove)
									do {
										menu.playSound("keybindready3");
										
										//data = data.splice(index, 1);
										let newData = [];
										for (let i = 0; i < data.length; i++) {
											if (index != i) {
												newData.push(data[i])
											}
										}
										if (newData.length == 0) break;
										isAllGood = true;
										saveTime = 10;
										kk[type][flagname] = newData.join(keypressManager.STRING_SEPARATOR);
										menu.storage.setItem("keyboard", kk);
										menu.saveFrame = 10;
									} while (false);
								
							}
						}
						if (isKeyUp) {
							isDone = true;
						}
						if (isDone) {
							do {
								keypressManager.isKeyBindingMode = false;
								if (del >= 60) {
									
									mstr = language.translate("fsw_kb_setting_saving_you", [keycode]);
								} else {
									menu.playSound("keybindcancel");
								}
								
								if (isAllGood) {
									if (saveTime > 0) {
										saveTime--;
										if (saveTime <= 0) {
											
											a.loadPageSync(b.openSettings(type, true), a.pageIndex - 1, true);
											a.loadPageSync(b.openFlag(type, flag, true), a.pageIndex, false);
										}
										else {
											break;
										}
									}
								}
								
								game.removeLoop("changingbind");
								keypressManager.removeListener("changing");
								window.setTimeout(() => {
									
									alertWindow.showhide(false);
								}, 10);
							} while (false);
						}
						
						alertWindow.editText(str + "<br /><br />" + mstr);
					});
				}
			}
		},
		Changelog: class {
			static start() {
				if (menu.storage.getItem("patchnote_is_seen") === 0) {
					fsw.functions.Changelog.open();
					menu.storage.setItem("patchnote_is_seen", 1);
					menu.saveFrame = 5;
				}
			}
			static open() {
				fsw.loadPage("fsw/changelog.json");
			}
			static full() {
				log.notification(language.translate("fsw_patch_notes_coming_soon"), language.translate("fsw_patch_notes_coming_soon_desc"))
			}
			static close() {
				fsw.close();
				menu.storage.setItem("patchnote_is_seen", 1);
				menu.saveFrame = 5;
			}
		},
		Nameplate: {
			open() {
				let name = menu.storage.getItem("playername");
				let json = {
					"title_lang": "fsw_nameplate",
					"prevent_default": true,
					"dpad_behavior": "branch",
					"scroll_vertical": "a",
					
					"element": {
						"tag": "gtris-div",
						"attributes": {
							"font_size": 0.7,
							"width": 100,
							"height": 100,
							"width_type": 1,
							"height_type": 1,
							"style": {
								"display": "flex",
								"flex-direction": "column",
								"justify-content": "center",
								"align-items": "center",
								"position": "relative",
								"overflow": "hidden hidden"
							}
						},
						"children": [
						{
							"tag": "gtris-div",
							"id": "a",
							"attributes": {
								"font_size": 1,
								"width": 95,
								"height": 4.15,
								"width_type": 1,
								"height_type": 0,
								
								"style": {
								"display": "flex",
								"flex-direction": "column",
								"justify-content": "center",
								"align-items": "center",
									"overflow": "hidden scroll",
								}
							},
							"children": [
							{
								"tag": "input",

								"attributes": {
									"id": "editable",
									"font_size": 2.5,
									"mattr": {
										type: "text",
									},
									"width": 90,
									"height": 3.1,
									"width_type": 1,
									"height_type": 0,
									"selectable": "0|0default",
									"event_functions": {
										"hoverin": "__this.style.background = \"#a3a\";",
										"hoverout": "__this.style.background = \"#ddd\";",
										"mouseover": "__hover();",
										"select": "__inputfocus()",
									},
									"value": name,
									
									"event_listeners": {
										"mouseover": "mouseover",
										"click": "select",
										"focus": "select"
									},
									"style": {
										"font-family": "default-ttf",
										"position": "relative",
										"border": "0.1em solid #282",
										"color": "#fff",
									}
								}
							}]
						},
						{
							"tag": "gtris-m",
							"attributes": {
								"id": "m",
								"width": 100,
								"height": 10,
								"width_type": 1,
								"height_type": 1,
								"style": {
									"display": "flex",
									"position": "relative",
									"flex-direction": "row",
									"justify-content": "center",
									"align-items": "flex-start"
								}
							},
							"children": [
							{
								"tag": "gtris-button",
								"attributes": {
									"id": "save",
									"font_size": 1,
									"width": 20,
									"height": 1.5,
									"width_type": 1,
									"height_type": 0,
									"selectable": "1|0",
									"style": {
										"display": "flex",
										"position": "relative",
										"justify-content": "center",
										"align-items": "center",
										"border": "3px solid #000",
										"background": "#ddd"
									},
									"event_functions": {
										"hoverin": "__this.style.background = \"#a3a\";",
										"hoverout": "__this.style.background = \"#ddd\";",
										"mouseover": "__hover();",
										"select": "__fsw.functions.Nameplate.save(__getElementId(\"editable\").value);",
									},
									
									"event_listeners": {
										"mouseover": "mouseover",
										"click": "select",
									}
								},
								"children": [
								{
									"tag": "gtris-button-text",
									"text_lang": "fsw_nameplate_save",
									"attributes": {
										"font_size": 0.8,
										"style": {
											"width": "auto",
											"height": "auto",
											"position": "absolute"
										}
									}
								}]
							},
							{
								"tag": "gtris-button",
								"attributes": {
									"id": "save",
									"font_size": 1,
									"width": 20,
									"height": 1.5,
									"width_type": 1,
									"height_type": 0,
									"selectable": "1|1",
									"style": {
										"display": "flex",
										"position": "relative",
										"justify-content": "center",
										"align-items": "center",
										"border": "3px solid #000",
										"background": "#ddd"
									},
									"event_functions": {
										"hoverin": "__this.style.background = \"#a3a\";",
										"hoverout": "__this.style.background = \"#ddd\";",
										"mouseover": "__hover();",
										"select": "__fsw.functions.Nameplate.reset(__getElementId(\"editable\"));",
									},
									
									"event_listeners": {
										"mouseover": "mouseover",
										"click": "select",
									}
								},
								"children": [
								{
									"tag": "gtris-button-text",
									"text_lang": "fsw_nameplate_reset",
									"attributes": {
										"font_size": 0.8,
										"style": {
											"width": "auto",
											"height": "auto",
											"position": "absolute"
										}
									}
								}]
							}]
						}]
					}
				};
				
				fsw.loadPageSync(JSON.stringify(json));
			},
			save(_value) {
				let value = _value.trim();
			let length = value.length;
			let presaved = menu.storage.getItem("playername", "");
			if (value === presaved) {
				log.error(language.translate("fsw_nameplate_samename_title"), language.translate("fsw_nameplate_samename_desc", [presaved]));
				return;
			}
			if (length == 0) {
				log.warn(language.translate("fsw_nameplate_noname_title"), language.translate("fsw_nameplate_noname_desc"));
				return;
			}
			menu.storage.setItem("playername", value);
			menu.refreshMenu();
			menu.saveFrame = 22;
			fsw.close();
			},
			reset(element) {
				element.value = menu.storage.getItem("playername", "");
			}
		}
		
	}
	
	constructor() {
		this.width = 0;
		this.height = 0;
		this.fontSize = 0;
		this.cellSize = 0;
		this.background = id("GTRIS-SECONDARY-WINDOW-BACKGROUND");
		this.window = id("GTRIS-SECONDARY-WINDOW");
		this.header = {
			main: id("SW-HEADER"),
			logo: id("SW-LOGO-DIV"),
			logoValue: id("SW-LOGO"),
			back: id("SW-BACK-DIV"),
			backValue: id("SW-BACK"),
			title: id("SW-TITLE-DIV"),
			titleValue: id("SW-TITLE"),
		};
		this.content = id("SW-CONTENT");
		this.isShown = false;
		this.isActive = false;
		this.frame = {
			start: -1,
			end: -1,
			"switch": -1,
		};
		this.pages = [];
		this.pageIndex = -1;
		this.bitkey = 0b000000; //baleftrightupdown
		this.lastBitkey = 0;
		this.bindsKeyboard = {
			arrowleft: "left",
			arrowright: "right",
			arrowup: "up",
			arrowdown: "down",
			enter: "a",
			backspace: "b"
		};
		
		this.flags = {
			left: 0b001000,
			right: 0b000100,
			up: 0b000010,
			down: 0b000001,
			a: 0b010000,
			b: 0b100000
		};
		
		this.animations = {
			"switch": new AnimationFrameRenderer(this.content, 0, 30, 1000 / 60, {
				name: "blur-out-in",
				timing: "ease-in-out",
			})
		}
		this.loadList = [];
		this.header.back.addEventListener("click", () => {
			this.back();
		});
		
		this.isTextareaFocus = false;
		/*
		{
			str: "",
			page: index,
			isOpen: bool
		}
		*/
	}
	
	showhide(bool) {
		this.isShown = bool;
		this.frame.start = -1;
		this.frame.end = -1;
		//this.background.style.display = bool ? "flex" : "flex";
		if (bool) {
			this.background.style.display = "flex"; //completely forgetting the existence of styleelem() wrapper- O^O
			this.frame.start = 25;
		} else {
			this.frame.end = 25;
			this.pages.length = 0;
		}
	}
	
	close() {
		this.showhide(false);
		this.pages.length = 0;
		this.pageIndex = -1;
		this.content.innerHTML = "";
	}
	
	back() {
		if (this.frame.switch > 14) return;
		this.pageIndex--;
		this.pages.pop();
		if (this.pageIndex <= -1) {
			this.showhide(false);
			return;
		}
		this.frame.switch = 30;
		this.animations.switch.play();
	}
	
	startReload(arr) {
		
		let isPage = false;
		for (let m of arr) {
			if (m.isOpen) isPage = true;
		}
		if (!isPage) return;
		this.loadList = arr;
		this.frame.reload = 30;
	}
	
	loadBatch() {
		let currentPage = this.pageIndex;
		for (let m of this.loadList) {
			let a = new this.Page(this);
			a.loadJSON((m.str));
			this.pages[m.page] = a;
		}
		for (let m of this.loadList) {
			if (m.isOpen) {
				currentPage = m.page;
				break;
			}
		}
		this.loadList.length = 0;
		this.pageIndex = currentPage;
		//console.log(this.pages);
	}
	
	loadPage(url, isLoadOnly) {
		load("assets/menu/" + url).then((u) => {
			this.loadPageSync(u, this.pages.length, isLoadOnly);
		});
	}
	
	loadPageSync(jsonString, page, isLoadOnly) {
		this.loadList.push({
			str: jsonString,
			page: page !== void 0 ? page : (this.pages.length + this.loadList.length),
			isOpen: !isLoadOnly
		});
		if (!isLoadOnly) {
			this.frame.switch = 30;
			this.animations.switch.play();
			if (this.loadList.length >= 1 && !this.isShown) this.showhide(true);
		}
	}
	
	keyInput(c, updown) {
		if (!(c in this.bindsKeyboard) || keypressManager.isKeyBindingMode) return;
		let bind = this.bindsKeyboard[c];
		let flag = this.flags[bind];
		
		let currentPage = this.pages[this.pageIndex];
		if (updown === "down") this.bitkey |= flag;
		if (updown === "up") this.bitkey ^= flag;
		let a = this.pages[this?.pageIndex || 0];
		if (!a) return;
		a.listen(flag, updown);
		//console.log(updown, bind, flag)
		if (updown == "keydown") {
			
			
		}
	}
	
	update() {
		if (this.frame.start > 0) {
			this.frame.start--;
			if (this.frame.start == 0) {
				this.isActive = true;
			}
			this.window.style.setProperty("--cb", bezier(this.frame.start / 25, 1, 0, 0, 0, 0, 1));
		}
		if (this.frame.end > 0) {
			this.frame.end--;
			if (this.frame.end == 0) {
				this.isActive = false;
				this.background.style.display = "none";
			}
			//this.window.style.setProperty("--cb", ((25 - this.frame.start) / 25));
			this.window.style.setProperty("--cb", bezier(this.frame.end / 25, 0, 1, 0, 0, 0, 1));
		}
		if (this.frame.switch > 0) {
			this.frame.switch--;
			if (this.frame.switch == 15) {
				if (this.loadList.length) this.loadBatch();
				this.switchPage(this.pageIndex);
			}
			//this.window.style.setProperty("--cb", ((25 - this.frame.start) / 25));
			this.window.style.setProperty("--cb", bezier(this.frame.start / 25, 1, 0, 0, 0, 0, 1));
		}
		this.animations.switch.run();
		if (!this.isActive || this.pageIndex < 0) return;
		this.pages[this?.pageIndex || 0].update();
		this.lastBitkey = this.bitkey;
	}
	
	switchPage(number) {
		let lastPage = this.pageIndex;
		this.pageIndex = number;
		this.content.innerHTML = "";
		if (this.pages?.[lastPage]) {
			//console.log(this.pages[lastPage].core)
			//this.pages[lastPage].core.append(this.content.firstElementChild)
			
		}
		this.content.appendChild((this.pages[number].core));
		//console.log((this.pages[number].elements[Object.keys(this.pages[number].elements)[0]]))
		//console.log(JSON.stringify(this.pages[number].core));
		this.resize(this.width, this.height, this.fontSize, this.cellSize);
		
	}
	
	createElement(json) {
		let a = {};
		a.children = [];
		return a;
	}
	
	resize(fwidth, fheight, fontSize, cellSize) {
		//this.sizes = [fwidth, fheight, fontSize, cellSize];
		this.width = fwidth;
		this.height = fheight;
		this.fontSize = fontSize;
		this.cellSize = cellSize;
		this.background.style.width = ~~fwidth + "px";
		this.background.style.height = ~~fheight + "px";
		let windowWidth = fwidth - cellSize;
		let windowHeight = fheight - cellSize;
		this.window.style.width = "calc(var(--cb) * " + ~~(windowWidth) + "px)";
		this.window.style.height = "calc(var(--cb) * " + ~~(windowHeight) + "px)";
		
		let headerHeight = cellSize * 2.25;
		
		this.header.main.style.width = (~~(windowWidth)) + "px";
		this.header.main.style.height = ~~headerHeight + "px";
		let mwidth = 0;
		for (let hh of ["logo", "back"]) {
			this.header[hh].style.width = ~~headerHeight + "px";
			this.header[hh].style.height = ~~headerHeight + "px";
			mwidth += ~~headerHeight;
		}
		this.header.title.style.width = ~~(windowWidth - mwidth) + "px";
		this.header.title.style.height = ~~headerHeight + "px";
		this.header.titleValue.style.fontSize = ~~(0.8 * fontSize) + "px";
		
		this.content.style.width = ~~(windowWidth) + "px";
		this.content.style.height = ~~(windowHeight - headerHeight) + "px";
		
		for (let h of this.pages) {
			h.resizeElements(windowWidth, windowHeight - headerHeight, fontSize, cellSize);
		}
	}
	
}

const fsw = new FullscreenWindow();

__main_params__.__private.fsw = fsw;

//fileLayer: alertwindow
const alertWindow = new class {
	constructor() {
		this.isShown = false;
		this.a = id("GTRIS-ALERT-WINDOW");
		this.text = id("AW-TEXT");
		this.frame = {
			hide: 0,
			show: 0,
		};
		
	}
	showhide(bool) {
		this.isShown = bool;
		this.frame.show = -1;
		this.frame.hide = -1;
		if (this.isShown) {
			styleelem(this.a, "display", "flex");
			this.frame.show = 20;
		} else {
			this.frame.hide = 20;
		}
	}
	editText(m) {
		ihelem(this.text, m);
	}
	update() {
		if (this.frame.show > 0) {
			this.frame.show--;
			this.a.style.setProperty("opacity", bezier((20 - this.frame.show) / 20, 0, 1, 0, 0, 0, 1));
		}
		if (this.frame.hide > 0) {
			this.frame.hide--;
			if (this.frame.hide == 0) {
				styleelem(this.a, "display", "none");
			}
			
			this.a.style.setProperty("opacity", bezier(this.frame.hide / 20, 0, 1, 0, 0, 0, 1));
		}
	}
	resize(w, h, fs) {
		styleelem(this.a, "width", `${w}px`);
		styleelem(this.a, "height", `${h}px`);
		
		styleelem(this.text, "fontSize", `${fs}px`);
	}
}();

//fileLayer: log
const log = new class {
	constructor() {
		this.main = $("ERROR-STACK");
		this.a = new ArrayFunctionIterator((at) => {
			for (let ptl = 0; ptl < at.length; ptl++) {
				let pl = at[ptl];
				let element = pl.element,
					parent = element.parentNode;
				pl.frame--;
				if (pl.frame == 15 && pl.delay > 0) {
					pl.frame = 16;
					pl.delay--;
				}
				if (pl.frame > 0) styleelem(element, "animation-delay", `${~~((1000 / (60 * (-1))) * Math.min(pl.maxf - pl.frame))}ms`);
				else {
					this.main.removeChild(element);
					at.splice(ptl, 1);
					ptl--;
					
				}
			}
		});
	}
	createLog(a) {
		a.style["animation-name"] = "error-slide";
		styleelem(a, "animation-duration", `${~~((1000 / (60)) * Math.max(0, 30))}ms`);
		styleelem(a, "animation-iteration-count", 1);
		styleelem(a, "animation-timing-function", "ease-in-out");
		styleelem(a, "animation-delay", 0);
		styleelem(a, "animation-play-state", "paused");
		
		//parent.appendChild()
		this.main.appendChild(a);
		this.a.addItem({
			element: a,
			frame: 30,
			delay: 300,
			maxf: 30
		});
	}
	error_program(event, source, lineno, colno, error) {
		try {
			elem("gtris-error-error", (e) => {
				let g = document.createElement("gtris-error-source");
				g.innerHTML = `${source} ${lineno ? "@" : ""}${lineno}`;
				g.style = `border-bottom:0.5px solid #fff;pointer-events:none`;
				e.appendChild(g);
				let text = document.createElement("gtris-error-source");
				text.innerHTML = `<br />${error}`;
				text.style = `font-size:0.5em;pointer-events:none`;
				e.appendChild(text);
				e.style = `z-index: 500; position: relative; background: rgba(0, 0, 0, 0.7); margin: 0.5 em; padding: 0.4 em; border-left: 5px solid #f00`;
				this.createLog(e);
			})
			menu.playSound("error");
		} catch (o) {
		
		}
	}
	error(title, error) {
		try {
			elem("gtris-error-error", (e) => {
				let g = document.createElement("gtris-error-source");
				g.innerHTML = title;
				g.style = `border-bottom:0.5px solid #fff;pointer-events:none`;
				e.appendChild(g);
				let text = document.createElement("gtris-error-source");
				text.innerHTML = `<br />${error}`;
				text.style = `font-size:0.5em;pointer-events:none`;
				e.appendChild(text);
				e.style = `z-index: 500; position: relative; background: rgba(0, 0, 0, 0.7); margin: 0.5 em; padding: 0.4 em; border-left: 5px solid #f00`;
				this.createLog(e);
			})
			menu.playSound("error");
		} catch (o) {
			
		}
	}
	notification(title, notification) {
		try {
			elem("gtris-error-error", (e) => {
				let g = document.createElement("gtris-error-source");
				g.innerHTML = title;
				g.style = `border-bottom:0.5px solid #fff;pointer-events:none`;
				e.appendChild(g);
				let text = document.createElement("gtris-error-source");
				text.innerHTML = `<br />${notification}`;
				text.style = `font-size:0.5em;pointer-events:none`;
				e.appendChild(text);
				e.style = `z-index: 500; position: relative; background: rgba(0, 0, 0, 0.7); margin: 0.5 em; padding: 0.4 em; border-left: 5px solid #70f`;
				this.createLog(e);
				
			});
			menu.playSound("notification");
		} catch (o) {
			
		}
	}
	warn(title, notification) {
		try {
			elem("gtris-error-error", (e) => {
				let g = document.createElement("gtris-error-source");
				g.innerHTML = title;
				g.style = `border-bottom:0.5px solid #fff;pointer-events:none`;
				e.appendChild(g);
				let text = document.createElement("gtris-error-source");
				text.innerHTML = `<br />${notification}`;
				text.style = `font-size:0.5em;pointer-events:none`;
				e.appendChild(text);
				e.style = `z-index: 500; position: relative; background: rgba(0, 0, 0, 0.7); margin: 0.5 em; padding: 0.4 em; border-left: 5px solid #ff0`;
				this.createLog(e);
				
			});
			menu.playSound("exclam");
		} catch (o) {
			
		}
	}
	run() {
		this.a.update();
	}
}();

