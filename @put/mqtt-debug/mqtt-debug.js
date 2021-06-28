module.exports = function(RED) {
  'use strict';

  const mqtt = require('../../put-mqtt/mqtt.js');


  function PutMqttDebugNode(n){
    RED.nodes.createNode(this, n);
    const node = this;
    node.topic = n.topic;
    node.retain = n.retain;
    node.mqtt = mqtt.get();

    node.on('input', function(msg){
      const context = node.context();
      const offline_mode = context.global.get('offline_mode');
      if(offline_mode){
        node.send([null, msg]);
        return;
      }

      // const debug_mode = context.global.get('debug_mode');
      const tester_id = context.global.get('tester_id');
      const tester = context.global.get('tester');
      const payload = typeof(msg.payload) == 'object' ? JSON.stringify(msg.payload) : msg.payload;
      const topic = node.topic || msg.topic || '';
      const root = `prusa-debug/prusaqc/${tester.toLowerCase()}/${tester_id}`;

      node.mqtt._client.publish(topic ? `${root}/${topic}` : root, payload, {
        qos: 2,
        retain: node.retain,
      }, function(err){
        if(err){
          node.send([msg, null]);
          return;

        }
        node.send([null, msg]);

      });

    });


    node.on('close', function(done){
      if(mqtt){
        mqtt.close(done);
      }else{
        done();
      }
    });

  }
  RED.nodes.registerType('put mqtt debug', PutMqttDebugNode);

}
