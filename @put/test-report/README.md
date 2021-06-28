# test-report
Sends test result report over MQTT. Parameters `timestamp`, `tid` and `msg_id`
are handled internally. Parameters `qr`, `err_msg`, `err_code`, `test_mode` and
`test_result` are taken from `msg` (or set to defaults if not present in `msg`).
Target topic is `prusa/prusaqc/<tester-type>/<tester-id>/test_result`.
If reply is not received in 1sec, it will automatically resend test report, up
to 3 tries total.
