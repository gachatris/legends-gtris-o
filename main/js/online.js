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
    RTC: 9,
    RTC_START: 10,
    RTC_READY: 11
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
    rtcChannels = {
      OFFER: 0,
      ANSWER: 1,
      CANDIDATE: 2
    }
    constructor(parent) {
      this.parent = parent;
      this.id = "0";
      this.visualPos = 0;
      this.parameters = {};
      this.ready = false;
      this.rtc = new RTCPeerConnection({
        iceServers: [{
          "urls": ["stun:stun1.l.google.com:19302"]
        }]
      }); //For local player
      this.channels = {
        
      };
      let hbs = 0;
      for (let g of ["input", "inmatch"]) {
        this.channels[g] = this.rtc.createDataChannel(g, {
          negotiated: true, //since this is multiplayer vs, out-of-band is preferred
          ordered: false,
          id: hbs,
          maxRetransmits: 0
        });
        hbs++;
        this.setupChannelRTC(this.channels[g]);
      }
      
      
      this.rtc.onicecandidate = (e) => {
        if (e.candidate) {
          this.sendRTCInit("CANDIDATE", e.candidate);
        }
      }
      
      
      
    }
    /**Sets up an RTCPeerConnection datachannel whenever it's created.
     *@param {RTCDataChannel} c
     *@return {void} void
     */
    setupChannelRTC(c) {
      c.binaryType = "arraybuffer";
      
      switch (c.label) {
        case "input": {
          //if (this.rtc.status)
          c.onmessage = (e) => {
            
            let rd = new BinaryReader(e.data);
            let sframe = rd.u32();
            let flen = rd.u8();
            let vis = this.visualPos;
            let sfa = sframe;
            for (let _f = 0; _f < flen; _f++) {
              let frame = sframe - _f;
              let press = rd.u16();
              if (!(frame in game.players[vis].framePackets)) game.players[vis].framePackets[frame] = press;
              /*let wr = online.createWriter("PLAYER_INPUT", 6);
              wr.u32(frame);
              wr.u16(press);
              online.send(wr.buffer);*/
              //sfa = frame;
            }
            //game.players[vis].lastAckedFrame = Math.max(game.players[vis].lastAckedFrame, sframe);
            /*while((game.players[vis].lastAckedFrame) in game.players[vis].framePackets) {
                game.players[vis].lastAckedFrame++;
            }*/
            
            
            //console.log(game.players[vis].framePackets)
          };
          c.onopen = (ev) => {
            this.ready = true;
            let wr = online.createWriter("MATCH_PREPARE", 1); //start rtc negotiation when both players' are ready
            wr.u8(1);
            online.send(wr.buffer);
            log.warn("Starting", "");
          }
          break;
        }
      }
    }
    /**
     * @param {RTCDataChannel} channel
     * @param {"a session description object"} content
     */
    async handleRTCInit(channel, content) {
      switch (channel) {
        case this.rtcChannels.OFFER: {
          //answer the offer;
          await this.rtc.setRemoteDescription(new RTCSessionDescription(content.content));
          this.answer(content.content);
          
          break;
        }
        case this.rtcChannels.ANSWER: {
          //get the answer from remote asnwerer
          if (this.rtc.signalingState !== "have-local-offer") {
            log.error("Oops!", "RTC connection state is not satisfied.")
            break;
          }
          await this.rtc.setRemoteDescription(new RTCSessionDescription(content.content))
          
          break;
        }
        case this.rtcChannels.CANDIDATE: {
          //answer the offer;
          await this.rtc.addIceCandidate(new RTCIceCandidate(content.content))
          
          break;
        }
      }
    }
    
    sendRTCInit(channel, content, isFeedback) {
      
      let g = {
        recipient: this.parent.userID,
        content: content,
        id: isFeedback ? this.parent.userID : this.id
      };
      let ks = JSON.stringify(g);
      let wr = new BinaryWriter(2 + 2 + new TextEncoder().encode(ks).byteLength);
      wr.u8(9);
      wr.u8(this.rtcChannels[channel]);
      wr.string(ks, 16);
      
      this.parent.send(wr.buffer);
      
    }
    
    sendRTC(channel, buffer) {
      if (this.channels[channel].readyState == "open")
        this.channels[channel].send(buffer);
    }
    async offer() {
      let offer = await this.rtc.createOffer();
      await this.rtc.setLocalDescription(offer);
      this.sendRTCInit("OFFER", offer);
    }
    async answer(offer) {
      let answer = await this.rtc.createAnswer(offer);
      await this.rtc.setLocalDescription(answer);
      this.sendRTCInit("ANSWER", answer);
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
  sendRTC(channel, data) {
    for (let h in this.matchPlayers) {
      let player = this.matchPlayers[h];
      if (player.id !== this.userID) player.sendRTC(channel, data);
      
    }
  }
  
  send(data) {
    if (this.#socket) this.#socket.send(data);
  }
  
  rtcSend(data) {
    if (this.#socket) this.#socket.send(data);
  }
  
  init() {
    
  }
  close() {
    if (this.#socket) {
      this.#socket.close();
      this.isOnline = false;
    }
  }
  
  prepReady() {
    let wr = new BinaryWriter(1);
    wr.u8(this.#channels.ROOM_USER_READY);
    this.#socket.send(wr.buffer);
    
  }
  
  enterRoom() {
    
  }
  
  connect(callback, closeCallback) {
    let tries = 0;
    let urls = this.#urls;
    let sj = prompt("Enter websocket address (port 27200) (e.g. 192.168.1.1:27200)", "localhost").replace("http://", "").replace("https://", "");
    //let sj = _sj.split
    if (!sj) return;
    try {
      urls = [`wss://${sj}`, `ws://${sj}`, `ws://${sj}:27200`, ...this.#urls]
      
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
            case this.#channels.RTC: {
              let m = rd.u8();
              let g = JSON.parse(rd.string(16));
              for (let h in this.matchPlayers) {
                let player = this.matchPlayers[h];
                if (player.id == g.recipient) {
                  player.handleRTCInit(m, g);
                }
              }
              
              break;
            }
            case this.#channels.RTC_START: {
              let polite = rd.u8();
              if (polite)
                for (let h in this.matchPlayers) {
                  
                  let player = this.matchPlayers[h];
                  if (player.id == this.userID) continue;
                  player.offer();
                }
              //log.notification("RTC is being initialized", "An RTC connection is being initialized. You're about to have a serverless communication with your opponent the moment this match starts.")
              ih("LOAD-TEXT", language.translate("loading_prematch_rtc"));
              break;
            }
            case this.#channels.MATCH_PREPARE: {
              this.isReady = true;
              //game.online.frames = {};
              break;
            }
            case this.#channels.PLAYER_INPUT: {
              //console.log(new Uint8Array(rd.buffer));
              let sframe = rd.u32();
              let count = rd.u8(); //player count
              
              game.online.latestSimFrames = sframe;
              
              
              for (let h = 0; h < count; h++) {
                let pos = rd.u8();
                //let press = rd.u16();
                //let frame = sframe;
                
                /*let sh = game.players[pos].framePackets[frame];
                //let press = rd.u16();
                if (pos !== this.userPos) {
                	let vis = this.matchPlayers[pos].visualPos;
                	if (!(frame in game.players[vis].framePackets)) game.players[vis].framePackets[frame] = press;
                }*/
                let h = []
                let flen = rd.u8();
                let vis = this.matchPlayers[pos].visualPos;
                for (let _f = 0; _f < flen; _f++) {
                  let frame = sframe + _f;
                  
                  let press = rd.u16();
                  h.push(press)
                  if (pos !== this.userPos) {
                    
                    /* if (!(frame in game.players[vis].framePackets)) */
                    game.players[vis].framePackets[frame] = press;
                    
                  }
                  
                }
                //console.log(pos, sframe)
                
                
                /**/
                
                
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
                  
                  log.notification("Match found!", `${name} (${char}) has entered the session. Get ready.`);
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
    } catch (e) {
      closeCallback(e)
    }
  }
}();