module.exports = function(RED) {
  'use strict';

  const serial = require('../../put-serial/serial.js');
  const commands_map = {
    'get_hall_current': ['I24A', 'I24A_reference', 'I24B', 'I24B_reference', 'I24_LOAD', 'I24_LOAD_reference'],
    'get_zx_current': ['I5A', 'I5B', 'I3', 'I5_LOAD'],
    'read_val': ['24VA_SNS', '24VB_SNS', '24VLD_SNS', 'I24A_AD', 'I24B_AD', '24V_PWR_AD', '5VA_SNS', '5VB_SNS', '5VLD_SNS', '5V_PWR_AD', 'I5A_AD', 'I5B_AD', '3V3A_SNS', 'I3_AD', 'CHE0', 'CHE1'],
  };

  function PutAnalogReadNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    node.do_reference = n.channel.endsWith('_reference');
    node.channel = node.do_reference ? n.channel.slice(0, -10) : n.channel;
    node.multiplier = parseFloat(n.multiplier);
    node.default_reference = 513;

    node.command = null;
    node.reply_ok = null;
    node.reply_check = false;
    node.error_msg = `analog read ${node.channel} fail`;
    node.retries = 2;
    node.retry_delay = 100;
    node.throw = true;


    node.port = serial.get();

    node.on_reply = function(err, msg){
      if(err){
        node.send([msg, null]);
      }else{
        if(msg.payload.endsWith(';')) msg.payload = msg.payload.slice(0, -1);

        if(node.do_reference){
          msg[node.channel + '_reference'] = parseFloat(msg.payload);

        }else{
          msg[node.channel] = node.multiplier == 1.0 ? parseFloat(msg.payload) : parseFloat(msg.payload) * node.multiplier;

        }

        node.send([null, msg]);
      }
    };

    node.on('input', function(msg){
      for(let prefix in commands_map){
        if(commands_map.hasOwnProperty(prefix)){
          if(commands_map[prefix].indexOf(node.channel) > -1){
            if(prefix == 'get_hall_current'){
              if(node.do_reference){
                node.command = `get_hall_current|${node.channel};`;

              }else{
                const reference = typeof(msg[node.channel + '_reference']) != 'undefined' ? parseInt(msg[node.channel + '_reference']) : node.default_reference;
                node.command = `get_hall_current|${node.channel}|${reference};`;

              }

            }else{
              node.command = `${prefix}|${node.channel};`;

            }
            break;
          }
        }
      }

      if(node.command){
        serial.request(msg, node);

      }else{
        node.status({fill: 'red', shape: 'ring', text: 'Invalid port!'});
        node.send([msg, null]);

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
  RED.nodes.registerType('put analog read', PutAnalogReadNode);
}
