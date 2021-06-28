module.exports = function(RED) {
  'use strict';

  const serial = require('../../put-serial/serial.js');


  function PutDigitalOutputNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    node.channel = n.channel;
    node._port = n.port;
    node.state = n.state;

    node.command = `digital_input|${node.channel}|${node._port}|${node.state ? '1' : '0'};`;
    node.reply_ok = `di${node.channel}_${node._port}_${node.state ? 'on' : 'off'};`;
    node.reply_check = true;
    node.error_msg = `digital output ${node.channel}:${node._port}:${node.state} fail`;
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
  RED.nodes.registerType('put digital output', PutDigitalOutputNode);
}
