module.exports = function(RED) {
  'use strict';

  const serial = require('../../put-serial/serial.js');

  function PutLcdNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    // node.text = n.text;
    node.pos_x = parseInt(n.pos_x);
    node.pos_y = parseInt(n.pos_y);
    node.clear = n.clear;
    if(isNaN(node.pos_x)) node.pos_x = 0;
    if(isNaN(node.pos_y)) node.pos_y = 0;

    // node.command = `LCD|${node.pos_x}|${node.pos_y}|${node.text}|${node.clear ? '1' : '0'};`;
    node.reply_ok = 'LCDOK;';
    node.reply_check = true;
    node.error_msg = 'lcd fail';
    node.retries = 2;
    node.retry_delay = 100;
    node.throw = true;

    node.port = serial.get();

    node.on('input', function(msg){
      node.text = n.text !== '' ? n.text : msg.text;

      if(typeof(node.text) == 'undefined'){
        node.error('lcd text undefined', msg);
        return;
      }

      if(node.text === ''){
        node.warn('lcd text empty', msg);
      }

      node.command = `LCD|${node.pos_x}|${node.pos_y}|${node.text}|${node.clear ? '1' : '0'};`;
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
  RED.nodes.registerType('put lcd', PutLcdNode);
}
