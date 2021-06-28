module.exports = function(RED) {
  'use strict';

  const serial = require('../../put-serial/serial.js');
  const commands_map = {
    'single': { cmd: 'cwE;', reply: 'cwE_ok;' },
    'error': { cmd: 'cwR;', reply: 'cwR_ok;' },
  };

  function PutBeepNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    node.beep_type = n.beep_type;

    node.command = (commands_map[node.beep_type] || {}).cmd;
    node.reply_ok = (commands_map[node.beep_type] || {}).reply;
    node.reply_check = true;
    node.error_msg = `${node.beep_type} beep fail`;
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
  RED.nodes.registerType('put beep', PutBeepNode);
}
