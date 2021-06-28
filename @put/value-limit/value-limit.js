module.exports = function(RED) {
  'use strict';

  const readline = require('readline');
  const path = require('path');
  const fs = require('fs');
  const putValueLimits = {};

  function PutValueLimitNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    node.value = n.value;
    node.min = n.min;
    node.max = n.max;
    node.field = n.field;
    node.throw = n.throw;

    if(node.min == '') node.min = (putValueLimits[node.value] || {}).min;
    if(node.max == '') node.max = (putValueLimits[node.value] || {}).max;
    if(node.field == '') node.field = (putValueLimits[node.value] || {}).field;
    if(node.throw == '') node.throw = (putValueLimits[node.value] || {}).throw;
    if(typeof(node.min) == 'string') node.min = parseFloat(node.min);
    if(typeof(node.max) == 'string') node.max = parseFloat(node.max);

    const split = (node.field || '').split('.');
    const field = split.pop();


    this.on('input', function(msg){
      let elm = msg;

      for(let i = 0; i < split.length; i++){
        if(elm.hasOwnProperty(split[i])){
          elm = elm[split[i]];
        }else{
          node.error(`Invalid path: ${node.field}`, msg);
          node.status({fill: 'red', shape: 'ring', text: 'Invalid path'});
          return;
        }
      }

      if(typeof(elm[field]) == 'undefined'){
        node.error(`Element missing: ${field}`, msg);
        node.status({fill: 'red', shape: 'ring', text: 'Element missing'});
        return;
      }

      if((elm[field] >= node.min) && (elm[field] <= node.max)){
        node.status({fill: 'green', shape: 'dot', text: String(elm[field])});
        node.send([null, msg]);
        return;
      }

      if(node.throw){
        node.error(node.throw, msg);
      }

      node.status({fill: 'red', shape: 'ring', text: String(elm[field])});
      this.send([msg, null]);

    });
  }

  const filename = path.join(RED.settings.userDir, 'limits.csv');
  const stream = fs.createReadStream(filename);
  const reader = readline.createInterface({input: stream});
  reader.on('line', (line) => {
    if(!line.startsWith(';')){
      const split = line.split(',');
      if(split.length >= 5){
        putValueLimits[split[0]] = {
          field: split[1],
          min: parseFloat(split[2]),
          max: parseFloat(split[3]),
          throw: split[4],
        };
      }
    }
  });

  reader.on('close', function() {
    RED.nodes.registerType('put value limit', PutValueLimitNode, {
      settings: {
        putValueLimits: {
          value: putValueLimits,
          exportable: true,
        },
      },
    });

  });

};
