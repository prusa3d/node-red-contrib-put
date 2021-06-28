module.exports = function(RED) {
  'use strict';

  const serial = require('../../put-serial/serial.js');

  function PutStatusLedNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    node.led = n.led;
    node.state = n.state;

    node.command = `sysreg|${node.led}|${node.state ? '1' : '0'};`;
    node.reply_ok = `sysreg_${node.led}_${node.state ? 'on' : 'off'};`;
    node.reply_check = true;
    node.error_msg = `${node.led}:${node.state} fail`;
    node.retries = 2;
    node.retry_delay = 100;
    node.throw = true;

    node.port = serial.get();

    node.on('input', function(msg){
      if(node.led == 'all'){
        serial.request({_msgid: 8, cb: function(){
          node.command = `sysreg|${node.led}|${node.state ? '1' : '0'};`;
          node.reply_ok = `sysreg_${node.led}_${node.state ? 'on' : 'off'};`
          node.error_msg = `${node.led}:${node.state} fail`;
          serial.request({_msgid: 9, cb: function(){
            node.command = 'cwR;';
            node.reply_ok = 'cwR_ok;';
            node.error_msg = 'cwR fail';
            serial.request({_msgid: 10}, node);

          }}, node);

        }}, node);

      }else{
        serial.request(msg, node);

      }

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
  RED.nodes.registerType('put status led', PutStatusLedNode);
}
