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