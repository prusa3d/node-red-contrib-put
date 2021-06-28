module.exports = function(RED) {
  'use strict';

  const serial = require('../../put-serial/serial.js');
  const mqtt = require('../../put-mqtt/mqtt.js');
  const regex = {
    qr: /^QR\|(.+);$/,
    bsel: /^BSEL:(\w+);$/,
    hw_rev: /^HW_REV:(\w+);$/,
    fw_version: /^FW_VERSION:(\w+);$/,
    tester: /^TESTER:(\w+);$/,
  };

  function buildMsgChain(msg){
    return [
      msg.ready || null,
      msg.reset_flow || null,
      msg.qr || null,
      msg.btn_enc || null,
      msg.btn_usr || null,
      msg.btn_rst || null,
      msg.lid_watchdog || null,
      msg.output || null,
    ];
  }

  function getAddress(){
    const ifaces = Object.values(require('os').networkInterfaces());
    for (var i = 0; i < ifaces.length; i++) {
      for (var j = 0; j < ifaces[i].length; j++) {
        if(ifaces[i][j].family == 'IPv4' && !ifaces[i][j].internal && ifaces[i][j].address){
          return ifaces[i][j];
        }
      }
    }
    return null;
  }

  function PutArduinoNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    const context = node.context();
    const address = getAddress() || {};
    let hearthbeat_interval = null;
    node.tester_id = n.tester_id;
    node.store_qr = n.store_qr;
    node.bsel = n.bsel;
    node.hw_rev = n.hw_rev;
    node.fw_version = n.fw_version;

    function reset_variables(){
      context.global.set('tester_ready', false);
      context.global.set('watchdog', false);

      context.global.set('bsel', null);
      context.global.set('hw_rev', null);
      context.global.set('fw_version', null);
    }

    node.reply_check = true;
    node.retries = 2;
    node.retry_delay = 100;
    node.throw = true;

    node.status({fill:"grey",shape:"dot",text:"node-red:common.status.not-connected"});
    context.global.set('ip', address.address || '');
    context.global.set('mac', address.mac || '');
    context.global.set('mac_hash', null);
    context.global.set('tester_id', node.tester_id);
    context.global.set('offline_mode', false);
    reset_variables();

    node.port = serial.get();
    node.mqtt = mqtt.get();

    node.on_reply = function(err, msg){
      if(msg && typeof(msg.cb) == 'function'){
        msg.cb(node);
      }
    };

    node.port.on('ready', function(){
      node.status({fill: 'yellow', shape: 'dot', text: 'Restarting'});

      node.command = 'hard_reset;';
      node.reply_ok = 'hard_reset_ok;';
      node.error_msg = 'hard_reset fail';
      node.retries = 2;
      node.retry_delay = 100;
      node.throw = true;
      serial.request({_msgid: 1}, node);
    });
    this.port.on('data', function(msgout){
      switch (msgout.payload) {
        case 'INIT;':
          reset_variables();
          node.send(buildMsgChain({reset_flow: msgout}));
          break;

        case 'ARDUINO_READY;':
          if(address.address){
            let error;
            if(node.bsel != context.global.get('bsel')){
              error = `WRONG BSEL (${context.global.get('bsel')})`;

            }else if(node.hw_rev != context.global.get('hw_rev')){
              error = 'WRONG HW_REV';

            }else if(node.fw_version != context.global.get('fw_version')){
              error = 'WRONG FW_VERSION';

            }else if(!context.global.get('tester')){
              error = 'WRONG TESTER_NAME';

            }else if(!node.tester_id){
              error = 'TESTER_ID NOT SET';

            }

            if(error){
              node.command = `LCD|0|1|${error}|1;`;
              node.reply_ok = 'LCDOK;';
              node.error_msg = 'lcd fail';
              serial.request({_msgid: 8, cb: function(){
                node.command = 'sysreg|lerr|1;';
                node.reply_ok = 'sysreg_lerr_on;';
                node.error_msg = 'lerr:1 fail';
                serial.request({_msgid: 9, cb: function(){
                  node.command = 'cwR;';
                  node.reply_ok = 'cwR_ok;';
                  node.error_msg = 'cwR fail';
                  serial.request({_msgid: 10}, node);

                }}, node);

              }}, node);

            }else{
              node.command = `LCD|0|0|HW REV: ${context.global.get('hw_rev')}|1;`;
              node.reply_ok = 'LCDOK;';
              node.error_msg = 'lcd fail';
              serial.request({_msgid: 11, cb: function(){
                node.command = `LCD|0|1|FW VERSION: ${context.global.get('fw_version')}|0;`;
                node.reply_ok = 'LCDOK;';
                node.error_msg = 'lcd fail';
                serial.request({_msgid: 12, cb: function(){
                  node.command = `LCD|0|3|IP: ${context.global.get('ip')}|0;`;
                  node.reply_ok = 'LCDOK;';
                  node.error_msg = 'lcd fail';
                  serial.request({_msgid: 13, cb: function(){
                    node.command = 'cwE;';
                    node.reply_ok = 'cwE_ok;';
                    node.error_msg = 'cwE fail';
                    serial.request({_msgid: 14, cb: function(){
                      // node.command = `LCD|0|2|${context.global.get('tester')}|0;`;
                      // node.reply_ok = 'LCDOK;';
                      // node.error_msg = 'lcd fail';
                      // serial.request({_msgid: 15}, node);

                      context.global.set('tester_ready', true);
                      node.send(buildMsgChain({ready: msgout}));

                    }}, node);

                  }}, node);

                }}, node);

              }}, node);

            }

            const tester = context.global.get('tester').toLowerCase();
            const hearthbeat_topic = `prusa-debug/prusaqc/${tester}/${node.tester_id}/hearthbeat`;
            hearthbeat_interval = setInterval(function(){
              const date = new Date();
              node.mqtt._client.publish(hearthbeat_topic, String(date.getTime() / 1000), { qos: 2 });
            }, 5000);


          }else{
            node.command = 'LCD|0|1|Sit nedostupna!|1;';
            node.reply_ok = 'LCDOK;';
            node.error_msg = 'hard_reset fail';
            serial.request({_msgid: 2, cb: function(){
              node.command = 'sysreg|lerr|1;';
              node.reply_ok = 'sysreg_lerr_on;';
              node.error_msg = 'lerr:1 fail';
              serial.request({_msgid: 3, cb: function(){
                node.command = 'cwR;';
                node.reply_ok = 'cwR_ok;';
                node.error_msg = 'cwR fail';
                serial.request({_msgid: 4}, node);

              }}, node);

            }}, node);

          }
          break;

        case 'btn_enc;':
          node.send(buildMsgChain({btn_enc: msgout}));
          break;

        case 'btn_usr;':
          node.send(buildMsgChain({btn_usr: msgout}));
          break;

        case 'btn_rst;':
          node.send(buildMsgChain({btn_rst: msgout}));
          break;

        default:
          let match;
          if(msgout.payload.indexOf('LID_WATCHDOG_TRIGGERED;') > -1){
            msgout.ignore_watchdog = true;
            node.context().global.set('watchdog', true);
            node.send(buildMsgChain({lid_watchdog: msgout}));
            node.warn('Lid watchdog triggered');

          }else if(match = msgout.payload.match(regex.qr)){
            const tester_ready = context.global.get('tester_ready');
            const test_running = context.global.get('test_running');

            if(tester_ready){
              if(test_running){
                node.warn(`Got QR code during running test: ${match[1]}`);

              }else{
                context.global.set('test_running', true);
                if(node.store_qr){
                  context.global.set('qr', match[1]);
                }
                msgout.qr = match[1];

                node.command = 'sysreg|lerr|0;';
                node.reply_ok = 'sysreg_lerr_off;';
                node.error_msg = 'lerr:0 fail';
                serial.request({_msgid: 5, cb: function(){
                  node.command = 'sysreg|lok|0;';
                  node.reply_ok = 'sysreg_lok_off;';
                  node.error_msg = 'lok:0 fail';
                  serial.request({_msgid: 6, cb: function(){
                    node.command = 'sysreg|lusr|0;';
                    node.reply_ok = 'sysreg_lusr_off;';
                    node.error_msg = 'lusr:0 fail';
                    serial.request({_msgid: 7, cb: function(){
                      node.send(buildMsgChain({qr: msgout}));

                    }}, node);

                  }}, node);

                }}, node);

              }

            }

          }else if(match = msgout.payload.match(regex.bsel)){
            context.global.set('bsel', match[1]);

          }else if(match = msgout.payload.match(regex.hw_rev)){
            context.global.set('hw_rev', parseInt(match[1]));

          }else if(match = msgout.payload.match(regex.fw_version)){
            context.global.set('fw_version', parseInt(match[1]));

          }else if(match = msgout.payload.match(regex.tester)){
            context.global.set('tester', match[1]);

            if(node.tester_id){
              const date = new Date();
              node.mqtt._client.publish(`prusa-debug/prusaqc/${match[1].toLowerCase()}/${node.tester_id}/ip`, JSON.stringify({
                  ip: address.address || '',
                  ts: date.getTime() / 1000,
                  ts_hr: date.toLocaleString('cs'),
              }), {
                qos: 2,
                retain: true,
              });

            }

          }else{
            node.send(buildMsgChain({output: msgout}));

          }
      }
    });
    node.port.on('closed', function(){
      node.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.not-connected'});
    });

    this.on('close', function(done){
      if(hearthbeat_interval){
        clearInterval(hearthbeat_interval);
        hearthbeat_interval = null;
      }

      if(serial){
        serial.close(done);
      }else{
        done();
      }
    });
  }
  RED.nodes.registerType('put arduino', PutArduinoNode);
}
