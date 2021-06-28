module.exports = function(RED) {
  'use strict';

  const serial = require('../../put-serial/serial.js');

  function PutLidStatusNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    node.lid = n.lid;
    node.invert = n.invert;

    node.command = `lid|${node.lid};`;
    // node.reply_ok = '';
    node.reply_check = false;
    node.error_msg = `lid${node.lid} fail`;
    node.retries = 2;
    node.retry_delay = 100;
    node.throw = true;

    node.port = serial.get();

    node.on_reply = function(err, msg){
      if(err){
        node.send([err, null, null]);
      }else{
        let value = msg.payload == '0;';
        if(node.invert) value = !value;
        node.send([null, value ? msg : null, value ? null : msg]);

      }
    };

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
  RED.nodes.registerType('put lid status', PutLidStatusNode);
}
