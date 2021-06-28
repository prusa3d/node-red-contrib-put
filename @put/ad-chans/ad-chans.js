module.exports = function(RED) {
  'use strict';

  const serial = require('../../put-serial/serial.js');
  const commands_map = {
    'get_hall_current': ['I24A', 'I24A_reference', 'I24B', 'I24B_reference', 'I24_LOAD', 'I24_LOAD_reference'],
    'get_zx_current': ['I5A', 'I5B', 'I3', 'I5_LOAD'],
    'read_val': ['24VA_SNS', '24VB_SNS', '24VLD_SNS', 'I24A_AD', 'I24B_AD', '24V_PWR_AD', '5VA_SNS', '5VB_SNS', '5VLD_SNS', '5V_PWR_AD', 'I5A_AD', 'I5B_AD', '3V3A_SNS', 'I3_AD', 'CHE0', 'CHE1'],
  };

  function PutAdChansNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    node.chna = parseInt(n.chna);
    node.chnb = parseInt(n.chnb);
    node.chnc = parseInt(n.chnc);
    node.chnd = parseInt(n.chnd);
    node.readings = parseInt(n.readings);

    node.command = `read_ad_chans|${node.chna}|${node.chnb}|${node.chnc}|${node.chnd}|${node.readings};`;
    node.reply_ok = null;
    node.reply_check = false;
    node.error_msg = `ad chans ${node.channel} fail`;
    node.retries = 2;
    node.retry_delay = 100;
    node.throw = true;


    node.port = serial.get();

    node.on_reply = function(err, msg){
      if(err){
        node.send([msg, null]);
      }else{
        if(msg.payload.endsWith(';')) msg.payload = msg.payload.slice(0, -1);
        const split = msg.payload.split('|');

        if(typeof(msg.ad) != 'object') msg.ad = {};
        if(typeof(msg.ad.cha) != 'object') msg.ad.cha = {};
        if(typeof(msg.ad.chb) != 'object') msg.ad.chb = {};
        if(typeof(msg.ad.chc) != 'object') msg.ad.chc = {};
        if(typeof(msg.ad.chd) != 'object') msg.ad.chd = {};

        msg.ad.cha[node.chna] = parseInt(split[0]);
        msg.ad.chb[node.chnb] = parseInt(split[1]);
        msg.ad.chc[node.chnc] = parseInt(split[2]);
        msg.ad.chd[node.chnd] = parseInt(split[3]);

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

    this.on('close', function(done){
      if(serial){
        serial.close(done);
      }else{
        done();
      }
    });
  }
  RED.nodes.registerType('put ad chans', PutAdChansNode);
}
