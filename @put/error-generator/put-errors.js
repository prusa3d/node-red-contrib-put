module.exports = function(RED){
  const readline = require('readline');
  const path = require('path');
  const fs = require('fs');
  const putErrors = {};

  function PutErrors(config){
    RED.nodes.createNode(this, config);

    this.on('input', function(msg){
      if(config.error && putErrors[config.error]){
        if(config.fieldCode){
          msg[config.fieldCode] = config.error;
        }
        if(config.fieldMessage){
          msg[config.fieldMessage] = putErrors[config.error].msg;
        }
      }
      this.send(msg);
    });
  }

  const reader = readline.createInterface({input: fs.createReadStream(path.join(__dirname, 'errors.csv'))});
  reader.on('line', (line) => {
    if(line && line != 'err_code,err_msg'){
      const split = line.split(',');
      if(split.length >= 2){
        putErrors[split[0]] = {
          msg: split[1],
        };
      }
    }
  });

  RED.nodes.registerType('put-errors', PutErrors, {
    settings: {
      putErrors: {
        value: putErrors,
        exportable: true,
      },
    },
  });
};
