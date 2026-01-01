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