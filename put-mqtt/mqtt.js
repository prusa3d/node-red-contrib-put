'use strict';
const mqtt = require('mqtt');


let requests = {};
let connection = null;
module.exports = {};


function rand_msg_id(){
  let msg_id = Math.round(Math.random() * 99999999);
  while(msg_id in requests){
    msg_id = Math.round(Math.random() * 99999999);
  }
  return msg_id;
}


function sanitize(elm){
  for(let each in elm){
    if(elm.hasOwnProperty(each)){
      switch (typeof(elm[each])){
        case 'undefined':
          delete elm[each];
          break;

        case 'object':
          sanitize(elm[each]);
          break;

        case 'number':
          elm[each] = Math.round((elm[each] + Number.EPSILON) * 1000) / 1000;
          break;
      }
    }
  }
}
module.exports.sanitize = sanitize;


module.exports.get = function(){
  if(connection) return connection;

  connection = (function(){
    const client = mqtt.connect('mqtt://mqttstage.prusa');
    const self = {
      _client: client,
      root: 'prusa/prusaqc',
      subscribe: function(topic){
        client.subscribe(`${self.root}/${topic}`);

      },
      send: function(topic, payload, retain = false){
        client.publish(`${this.root}/${topic}`, payload, {
          qos: 2,
          retain,
        });
      },
    };


    client.on('error', function (err){
      console.error('MQTT>', err);

    });


    client.on('message', function(topic, message){
      // if(!topic.endsWith('_verified')) return;
      let json;
      try {
        json = JSON.parse(message.toString());
      } catch (e) {
        return;
      }

      if(typeof(json) == 'object' && typeof(json.msg_id) != 'undefined'){
        if(typeof(requests[json.msg_id]) != 'undefined'){
          const request = requests[json.msg_id];
          delete requests[json.msg_id];

          clearTimeout(request.timeout);
          if(typeof(request.callback) == 'function') request.callback(undefined, json);
        }
      }

    });

    return self;
  }());


  return connection;
};


module.exports.close = function(done){
  if(connection){
    connection._client.end(true, done);
    connection = null;

  }else{
    done();

  }
};


// TODO: add reporting to node.status
module.exports.request = function(topic, msg, callback, node, include_timestamp = true, reply_topic = undefined){
  if(!connection) return false;
  if(typeof(msg) != 'object') return false;

  const msg_id = rand_msg_id();
  if(!reply_topic){
    reply_topic = `${connection.root}/${topic}_verified`;

  }else{
    reply_topic = `${connection.root}/${reply_topic}`;

  }

  msg.msg_id = msg_id;
  if(include_timestamp){
    msg.timestamp = new Date().getTime();
  }

  const request = {
    payload: JSON.stringify(msg),
    timeout: null,
    retries: 0,
    callback,
    msg_id,
    topic,
    node,
    msg,
  };

  const send_and_set_timeout = function(timeout = 1000){
    connection.send(topic, request.payload);
    request.timeout = setTimeout(resend, timeout);
  };

  const resend = function(){
    if((request.retries += 1) < 3){
      send_and_set_timeout();

    }else{
      delete requests[msg_id];
      if(typeof(callback) == 'function') callback('timeout', msg);

    }
  };

  if(reply_topic in connection._client._resubscribeTopics){
    send_and_set_timeout();
    requests[msg_id] = request;

  }else{
    connection._client.subscribe(reply_topic, function(err){
      send_and_set_timeout();
      requests[msg_id] = request;

    });

  }

};
