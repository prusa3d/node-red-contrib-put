module.exports = function(RED) {
  'use strict';

  const serial = require('../../put-serial/serial.js');
  const commands_map = {
    'gsns': ['gsna', 'gsnb'],
    'digital_input': ['dia', 'dib', 'dic'],
  };

  function PutDigitalReadNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    node.channel = n.channel;
    node._port = n.port;
    node.invert = n.invert;

    node.command = null;
    node.reply_ok = null;
    node.reply_check = false;
    node.error_msg = `digital read ${node.channel}${node._port} fail`;
    node.retries = 2;
    node.retry_delay = 100;
    node.throw = true;

    for(let prefix in commands_map){
      if(commands_map.hasOwnProperty(prefix)){
        if(commands_map[prefix].indexOf(node.channel) > -1){
          if(prefix == 'gsns'){
            node.command = `gsns|${node.channel}${node._port};`;

          }else if(prefix == 'digital_input'){
            node.command = `${prefix}|${node.channel[2]}|in${node._port};`;

          }else{
            node.command = `${prefix}|${node.channel}|${node._port};`;

          }
          break;
        }
      }
    }

    if(node.command){
      node.port = serial.get();

      node.on_reply = function(err, msg){
        if(err){
          node.send([msg, null]);
        }else{
          if(typeof(msg[node.channel]) != 'object'){
            msg[node.channel] = {};
          }
          msg[node.channel][node._port] = msg.payload == '1;';
          delete msg.payload;
          node.send([null, msg]);
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
  RED.nodes.registerType('put digital read', PutDigitalReadNode);
}
