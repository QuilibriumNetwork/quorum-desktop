var t = require("./chunks/index-chunk.js");

!async function output() {
  var r = await t.lanNetwork();
  process.stdout.write(JSON.stringify(r));
  process.exit(0);
}();
//# sourceMappingURL=lan-network-subprocess.js.map
