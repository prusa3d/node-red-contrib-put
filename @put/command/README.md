# command
Sends specified command to PUT-FW. Command can be set in node's properties. If it
is set to an empty string, `msg.payload` is used instead.  
It is possible to check for specified reply if node's property `Reply check` or
`msg.reply_check` is set to `true`. Reply to copare against is specified in node's
property `Reply OK` or `msg.reply_ok`. Command resend and retries are handled
internally.

In case that watchdog was triggered (`global.watchdog === true`) no command will
pass to serial line, unless `msg.ignore_watchdog` is set to `true`. This will
effectively interrupt `msg`'s flow in case something goes wrong but still allows
control messages to pass through.

_Internally uses `put-serial` module's `request` method._
