module.exports = function(RED) {
  'use strict';

  const serial = require('../../put-serial/serial.js');
  const commands_map = {
    'sysreg': ['U5VBON', 'U5VBSOFT', 'U3V3ON', 'U3V3SOFT', 'sol4', 'sol5', 'sol6', 'sol7'],
    'po0': ['U24VBON', 'U24VBSOFT', 'sol0', 'sol1', 'sol2', 'sol3'],
    'power': ['_uexton'],
  };

  function PutPowerControlNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    node.port = n.port;
    node.state = n.state;

    node.command = null;
    node.reply_ok = null;
    node.reply_check = true;
    node.error_msg = `${node.port}:${node.state} fail`;
    node.retries = 2;
    node.retry_delay = 100;
    node.throw = true;

    for(let prefix in commands_map){
      if(commands_map.hasOwnProperty(prefix)){
        if(commands_map[prefix].indexOf(node.port) > -1){
          node.command = `${prefix}|${node.port}|${node.state ? '1' : '0'};`;
          node.reply_ok = `${prefix}_${node.port}_${node.state ? 'on' : 'off'};`;
          break;
        }
      }
    }

    if(node.command){
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

    }else{
      node.status({fill: 'red', shape: 'ring', text: 'Invalid port!'});

    }

    this.on('close', function(done){
      if(serial){
        serial.close(done);
      }else{
        done();
      }
    });
  }
  RED.nodes.registerType('put power control', PutPowerControlNode);
}
