# ad-chans
Calls `read_ad_chans` PUT-FW command.  
Reads all four ADC channels at once using PUT's `set_ad_full` and `get_ad_chans`
functions.  
Result is stored as:
> msg.ad = { cha: { '0': 123, '1': 123, ... }, chb: { ... }, ... }

_Result should be in range of 0mV - 5000mV_
