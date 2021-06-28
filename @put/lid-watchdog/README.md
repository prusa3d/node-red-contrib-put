# lid-watchdog
Allows to enable/disable lid watchdog. When watchdog is triggered, `global.watchdog`
is set to `true` (meaning no commands will pass through to serial, effectively
interrupting flow) and signal is generated on `Arduino`'s `Lid Watchdog` output.
