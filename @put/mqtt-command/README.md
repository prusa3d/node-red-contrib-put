# mqtt-command
Sends out command over MQTT to topic `prusa/prusaqc/<tester-type>/<tester-id>/cmd` and
expects response in topic `prusa/prusaqc/<tester-type>/<tester-id>/cmd_result`.

Result is stored as:
> msg.payload = { foobar: 'baz', ... }
