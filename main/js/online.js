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
		urls = [`wss://${prompt("Enter Websocket Address (port: 27200)", "localhost:27200")}`, ...this.#urls]

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