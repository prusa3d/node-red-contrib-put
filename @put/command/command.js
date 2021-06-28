module.exports = function(RED) {
  'use strict';

  const serial = require('../../put-serial/serial.js');

  function PutCommandNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    node.command = n.command;
    node.reply_ok = n.reply_ok;
    node.reply_check = n.reply_check;
    node.error_msg = n.error_msg;
    node.retries = parseInt(n.retries);
    node.retry_delay = parseInt(n.retry_delay);
    node.throw = n.throw;

    node.port = serial.get();

    node.on('input', function(msg){
      // TODO: no need to watch for watchdog trigger since put-serial already does that for us
      const watchdog = node.context().global.get('watchdog');
      if(watchdog === true){
        node.warn('watchdog_interrupted_flow', msg);
        return;
      }
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
  RED.nodes.registerType('put command', PutCommandNode);
}
