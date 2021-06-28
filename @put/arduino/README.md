# arduino
Basic node for a tester. Listens on `/dev/ttyS0` (using `put-serial`) and handles
all incoming commands.  
Also handles basic tester configuration (tester type, firmware version, etc..),
displays information (firmware version, hardware revision and IP address) on LCD.  
When tester starts, it will send it's IP address over MQTT and will periodically
send out a hearthbeat. MQTT debug topic is
`prusa-debug/prusaqc/<tester-type>/<tester-id>/[ip|hearthbeat]`.
