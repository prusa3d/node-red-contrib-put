# node-red-contrib-put
Node-RED PUT NG modules. Communicates with `PUT-FW`.

To create a new tester, drag `put arduino` node into flow, set it's `Tester type`
and other required properties. When you scan a QR code, signal will be generated
on `QR` output port. Connect tester specific nodes to this output according
test's definition to create a flow...
