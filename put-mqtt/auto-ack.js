'use strict';
const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://mqttstage.prusa');


client.subscribe('prusa-debug/prusaqc/auto-ack/#', function(err, ev){
  console.log('Subscribed to', ev[0].topic);

});

client.on('error', function (err){
  console.error('MQTT>', err);

});


client.on('message', function(topic, message){
  if(topic.endsWith('_verified')) return;

  let json;
  try {
    json = JSON.parse(message.toString());
  } catch (e) {
    return;
  }

  if(typeof(json.msg_id) != 'undefined'){
    setTimeout(function(){
      client.publish(json.replyTopic || `${topic}_verified`, JSON.stringify({
        msg_id: json.msg_id,
        status: '1',

      }), {
        qos: 2,
        retain: false,
      });

    }, 100);

  }

});
