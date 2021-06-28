module.exports = function(RED) {
  'use strict';

  const serial = require('../../put-serial/serial.js');


  function PutLidWatchdogNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    node.enabled = n.enabled;
    node.lid = n.lid;
    node.state = n.state == '1';

    node.command = `lid_watchdog|${node.lid}|${node.enabled ? 'on' : 'off'}|${node.state ? '1' : '0'};`;
    node.reply_ok = node.enabled ? `lid${node.lid}_watchdog_on_${node.state ? 'closed' : 'opened'};` : `lid${node.lid}_watchdog_off;`;
    node.reply_check = true;
    node.error_msg = `lid${node.lid} watchdog ${node.enabled ? 'on' : 'off'} fail`;
    node.retries = 2;
    node.retry_delay = 100;
    node.throw = true;

    node.port = serial.get();

    node.on('input', function(msg){
      serial.request(msg, node);
    });

    node.port.on('ready', function(){
      node.status({fill: 'blue', shape: 'dot', text: 'node-red:common.status.connected'});
    });
    node.port.on('closed', function(){
      node.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.not-connected'});
    });

    this.on('close', function(done){
      if(serial){
        serial.close(done);
      }else{
        done();
      }
    });
  }
  RED.nodes.registerType('put lid watchdog', PutLidWatchdogNode);
}
