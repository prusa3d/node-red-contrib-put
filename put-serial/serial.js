"use strict";
/*
*   based on https://www.npmjs.com/package/node-red-node-serialport
*/

const events = require("events");
const serialp = require("serialport");
const bufMaxSize = 32768;  // Max serial buffer size, for inputs...
const serialReconnectTime = 15000;
let connection = null;
module.exports = {};

module.exports.get = function() {
    const serialConfig = { newline: ';' };
    var port = '/dev/ttyS0',
        baud = 76800,
        databits = 8,
        parity = 'none',
        stopbits = 1,
        dtr = 'none',
        rts = 'none',
        cts = 'none',
        dsr = 'none',
        newline = serialConfig.newline,
        spliton = 'char',
        waitfor = '',
        binoutput = 'false',
        addchar = '',
        responsetimeout = 3000;
    // just return the connection object if already have one
    if (connection) { return connection; }

    // State variables to be used by the on('data') handler
    var i = 0; // position in the buffer
    // .newline is misleading as its meaning depends on the split input policy:
    //   "char"  : a msg will be sent after a character with value .newline is received
    //   "time"  : a msg will be sent after .newline milliseconds
    //   "count" : a msg will be sent after .newline characters
    // if we use "count", we already know how big the buffer will be
    var bufSize = (spliton === "count") ? Number(newline): bufMaxSize;

    waitfor = waitfor.replace("\\n","\n").replace("\\r","\r").replace("\\t","\t").replace("\\e","\e").replace("\\f","\f").replace("\\0","\0"); // jshint ignore:line
    if (waitfor.substr(0,2) == "0x") { waitfor = parseInt(waitfor,16); }
    if (waitfor.length === 1) { waitfor = waitfor.charCodeAt(0); }
    var active = (waitfor === "") ? true : false;
    var buf = new Buffer.alloc(bufSize);

    var splitc; // split character
    // Parse the split character onto a 1-char buffer we can immediately compare against
    if (newline.substr(0,2) == "0x") {
        splitc = new Buffer.from([newline]);
    }
    else {
        splitc = new Buffer.from(newline.replace("\\n","\n").replace("\\r","\r").replace("\\t","\t").replace("\\e","\e").replace("\\f","\f").replace("\\0","\0")); // jshint ignore:line
    }
    if (addchar === true) { addchar = splitc; }
    addchar = addchar.replace("\\n","\n").replace("\\r","\r").replace("\\t","\t").replace("\\e","\e").replace("\\f","\f").replace("\\0","\0"); // jshint ignore:line
    if (addchar.substr(0,2) == "0x") { addchar = new Buffer.from([addchar]); }
    connection = (function() {
        function incTriesAndSend(msg, node){
          msg.cmd.tries++;

          if(msg.cmd.tries <= node.retries){
            const watchdog = node.context().global.get('watchdog');
            if(watchdog === true && msg.cmd.ignore_watchdog !== true){
              node.warn('watchdog_interrupted_flow', msg);
              return;
            }

            msg.payload = msg.cmd.command;
            node.warn(`resend command: ${msg.cmd.command}`, msg);
            setTimeout(function(){
              node.status({fill:"yellow",shape:"dot",text:`Retrying ${msg.cmd.tries}/${node.retries}`});
              node.port.enqueue(msg, node, function(err, res){
                if(err){
                  node.error(err.toString(), msg);
                }
              });
            }, node.retry_delay);

          }else{
            if(node.error_msg){
              msg.error_msg = node.error_msg;
            }
            if(node.throw){
              node.error(node.error_msg || msg.cmd.command+' failed', msg);
            }
            node.status({fill:"red",shape:"dot",text:msg.payload ? msg.payload : 'Command failed'});
            if(typeof(node.on_reply) == 'function'){
              node.on_reply(msg, null);
            }else{
              node.send([msg, null]);
            }

          }
        }
        var obj = {
            _emitter: new events.EventEmitter(),
            serial: null,
            _closing: false,
            tout: null,
            queue: [],
            on: function(a,b) { this._emitter.on(a,b); },
            close: function(cb) { this.serial.close(cb); },
            encodePayload: function (payload) {
                if (!Buffer.isBuffer(payload)) {
                    if (typeof payload === "object") {
                        payload = JSON.stringify(payload);
                    }
                    else {
                        payload = payload.toString();
                    }
                    if (addchar !== "") { payload += addchar; }
                }
                else if (addchar !== "") {
                    payload = Buffer.concat([payload,addchar]);
                }
                return payload;
            },
            write: function(m,cb) { this.serial.write(m,cb); },
            update: function(m,cb) { this.serial.update(m,cb); },
            enqueue: function(msg,sender,cb) {
                var payload = this.encodePayload(msg.payload);
                var qobj = {
                    sender: sender,
                    msg: msg,
                    payload: payload,
                    cb: cb,
                }
                this.queue.push(qobj);
                // If we're enqueing the first message in line,
                // we shall send it right away
                if (this.queue.length === 1) {
                    this.writehead();
                }
            },
            writehead: function() {
                if (!this.queue.length) { return; }
                var qobj = this.queue[0];
                this.write(qobj.payload,qobj.cb);
                var msg = qobj.msg;
                var timeout = msg.timeout || responsetimeout;
                this.tout = setTimeout(function () {
                    this.tout = null;
                    var msgout = obj.dequeue() || {};
                    // if we have some leftover stuff, just send it
                    if (i !== 0) {
                        var m = buf.slice(0,i);
                        m = Buffer.from(m);
                        i = 0;
                        if (binoutput !== "bin") { m = m.toString(); }
                        msgout.payload = m;
                    }
                    if(qobj.sender !== null && typeof(msgout.cmd) == 'object' && typeof(msgout.cmd.tries) == 'number' && typeof(msgout.cmd.command) == 'string'){
                      incTriesAndSend(msgout, qobj.sender);
                      qobj.sender.status({fill:"red",shape:"ring",text:msgout.payload ? msgout.payload : 'Timeout'});
                    }else{
                      /* Notify the sender that a timeout occurred */
                      obj._emitter.emit('timeout',msgout,qobj.sender);
                    }
                }, timeout);
            },
            dequeue: function() {
                // if we are trying to dequeue stuff from an
                // empty queue, that's an unsolicited message
                if (!this.queue.length) { return null; }
                var msg = Object.assign({}, this.queue[0].msg);
                msg = Object.assign(msg, {
                    request_payload: msg.payload,
                    request_msgid: msg._msgid,
                });
                delete msg.payload;
                if (this.tout) {
                    clearTimeout(obj.tout);
                    obj.tout = null;
                }
                this.queue.shift();
                this.writehead();
                return msg;
            },
        }
        //newline = newline.replace("\\n","\n").replace("\\r","\r");
        var olderr = "";
        var setupSerial = function() {
            obj.serial = new serialp(port,{
                baudRate: baud,
                dataBits: databits,
                parity: parity,
                stopBits: stopbits,
                //parser: serialp.parsers.raw,
                autoOpen: true
            }, function(err, results) {
                if (err) {
                    if (err.toString() !== olderr) {
                        olderr = err.toString();
                        console.error(`put-serial: ${olderr}`);
                    }
                    obj.tout = setTimeout(function() {
                        setupSerial();
                    }, serialReconnectTime);
                }
            });
            obj.serial.on('error', function(err) {
                console.error(`put-serial: ${err.toString()}`);
                obj._emitter.emit('closed');
                if (obj.tout) { clearTimeout(obj.tout); }
                obj.tout = setTimeout(function() {
                    setupSerial();
                }, serialReconnectTime);
            });
            obj.serial.on('close', function() {
                if (!obj._closing) {
                    if (olderr !== "unexpected") {
                        olderr = "unexpected";
                        console.error('put-serial: port closed unexpectedly');
                    }
                    obj._emitter.emit('closed');
                    if (obj.tout) { clearTimeout(obj.tout); }
                    obj.tout = setTimeout(function() {
                        setupSerial();
                    }, serialReconnectTime);
                }
            });
            obj.serial.on('open',function() {
                olderr = "";
                console.info('put-serial: port opened');
                // Set flow control pins if necessary. Must be set all in same command.
                var flags = {};
                if (dtr != "none") { flags.dtr = (dtr!="low"); }
                if (rts != "none") { flags.rts = (rts!="low"); }
                if (cts != "none") { flags.cts = (cts!="low"); }
                if (dsr != "none") { flags.dsr = (dsr!="low"); }
                if (dtr != "none" || rts != "none" || cts != "none" || dsr != "none") { obj.serial.set(flags); }
                if (obj.tout) { clearTimeout(obj.tout); obj.tout = null; }
                //obj.serial.flush();
                obj._emitter.emit('ready');
            });

            obj.serial.on('data',function(d) {
                function emitData(data) {
                    if (active === true) {
                        var m = Buffer.from(data);
                        var last_sender = null;
                        if (obj.queue.length) { last_sender = obj.queue[0].sender; }
                        if (binoutput !== "bin") { m = m.toString(); }
                        var msgout = obj.dequeue() || {};
                        msgout.payload = m;
                        if(last_sender !== null && typeof(msgout.cmd) == 'object' && typeof(msgout.cmd.tries) == 'number' && typeof(msgout.cmd.command) == 'string'){
                          if(typeof(msgout.payload) == 'string' && msgout.payload.indexOf('INVALID_CMD|') > -1){
                            last_sender.status({fill:"red",shape:"dot",text:"Invalid command"});
                            incTriesAndSend(msgout, last_sender);

                          }else if(typeof(msgout.payload) == 'string' && msgout.payload.indexOf('LID_WATCHDOG_TRIGGERED;') > -1){
                              obj._emitter.emit('data', msgout, last_sender);
                              return;

                          }else{
                            let reply_check = last_sender.reply_check;
                            if(!reply_check && typeof(msgout.reply_check) != 'undefined'){
                              reply_check = Boolean(msgout.reply_check);
                            }

                            if(reply_check){
                              let reply_ok = last_sender.reply_ok;
                              if(reply_ok === '' && typeof(msgout.reply_ok) != 'undefined'){
                                reply_ok = msgout.reply_ok;
                              }

                              if(msgout.payload != reply_ok){
                                incTriesAndSend(msgout, last_sender);
                                return;
                              }
                            }
                            // all ok, clean up message and pass it on
                            delete msgout.reply_check;
                            delete msgout.reply_ok;
                            delete msgout.cmd;

                            last_sender.status({fill:"green",shape:"dot",text:msgout.payload ? msgout.payload : 'OK'});
                            if(typeof(last_sender.on_reply) == 'function'){
                              last_sender.on_reply(null, msgout);
                            }else{
                              last_sender.send([null, msgout]);
                            }

                          }

                        }else{
                          obj._emitter.emit('data', msgout, last_sender);
                        }
                    }
                    active = (waitfor === "") ? true : false;
                }

                for (var z=0; z<d.length; z++) {
                    var c = d[z];
                    if (c === waitfor) { active = true; }
                    if (!active) { continue; }
                    // handle the trivial case first -- single char buffer
                    if ((newline === 0)||(newline === "")) {
                        emitData(new Buffer.from([c]));
                        continue;
                    }

                    // save incoming data into local buffer
                    buf[i] = c;
                    i += 1;

                    // do the timer thing
                    if (spliton === "time" || spliton === "interbyte") {
                        // start the timeout at the first character in case of regular timeout
                        // restart it at the last character of the this event in case of interbyte timeout
                        if ((spliton === "time" && i === 1) ||
                            (spliton === "interbyte" && z === d.length-1)) {
                            // if we had a response timeout set, clear it:
                            // we'll emit at least 1 character at some point anyway
                            if (obj.tout) {
                                clearTimeout(obj.tout);
                                obj.tout = null;
                            }
                            obj.tout = setTimeout(function () {
                                obj.tout = null;
                                emitData(buf.slice(0, i));
                                i=0;
                            }, newline);
                        }
                    }
                    // count bytes into a buffer...
                    else if (spliton === "count") {
                        newline = serialConfig.newline;
                        if ( i >= parseInt(newline)) {
                            emitData(buf.slice(0,i));
                            i=0;
                        }
                    }
                    // look to match char...
                    else if (spliton === "char") {
                        if ((c === splitc[0]) || (i === bufMaxSize)) {
                            emitData(buf.slice(0,i));
                            i=0;
                        }
                    }
                }
            });
            // obj.serial.on("disconnect",function() {
            //     RED.log.error(RED._("serial.errors.disconnected",{port:port}));
            // });
        }
        setupSerial();
        return obj;
    }());
    return connection;
};


module.exports.close = function(done) {
    if (connection) {
        if (connection.tout != null) {
            clearTimeout(connection.tout);
        }
        connection._closing = true;
        try {
            connection.close(function() {
                console.info('put-serial: closed');
                done();
            });
        }
        catch(err) { }
        connection = null;
    }
    else {
        done();
    }
};


module.exports.request = function(msg, node) {
  const ignore_watchdog = node.ignore_watchdog === true || msg.ignore_watchdog === true;
  const watchdog = node.context().global.get('watchdog');
  let command = node.command !== '' ? node.command : msg.payload;

  if(watchdog === true && ignore_watchdog !== true){
    node.warn('watchdog_interrupted_flow', msg);
    node.status({fill:"yellow",shape:"dot",text:"watchdog_interrupted_flow"});
    return;
  }

  if(typeof(command) == 'number') command = String(command);
  if(typeof(command) == 'undefined'){
    node.error('empty command!', msg);
    node.status({fill:"red",shape:"dot",text:"Empty command"});
    return;
  }

  if (msg.hasOwnProperty("flush") && msg.flush === true) { node.port.serial.flush(); }
  node.status({fill:"yellow",shape:"dot",text:"Waiting"});

  // prepare
  msg.cmd = {
    tries: 0,
    command,
    ignore_watchdog,
  };
  msg.payload = msg.cmd.command;

  node.port.enqueue(msg, node, function(err, res){
    if(err){
      node.error(err.toString(), msg);
    }
  });
};


module.exports.trim = function(payload) {
  return payload.endsWith(';') ? payload.slice(0, -1) : payload;
}
