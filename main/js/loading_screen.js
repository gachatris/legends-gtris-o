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