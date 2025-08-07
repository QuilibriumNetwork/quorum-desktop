#!/usr/bin/env node
var e = require("./chunks/index-chunk.js");

!function cli() {
  var r = "default";
  e: for (var a = 1; a < process.argv.length; a++) {
    var o = process.argv[a].trim().toLowerCase();
    switch (o) {
     case "-h":
     case "--help":
      r = "help";
      break e;

     case "-d":
     case "--dhcp":
      r = "dhcp";
      break;

     case "-p":
     case "--probe":
      r = "probe";
      break;

     case "-f":
     case "--fallback":
      r = "fallback";
      break;

     default:
      if (o.startsWith("-")) {
        throw new TypeError(`Invalid flag: ${o}`);
      }
    }
  }
  switch (r) {
   case "help":
    return function help() {
      var e = [ "Discover the machine's default gateway and local network IP (test utility)", "", "Usage", "  $ lan-network", "  $ lan-network --default", "", "Modes", "  --probe     Discover gateway via UDP4 socket to publicly routed address", "  --dhcp      Discover gateway via DHCPv4 discover broadcast", "  --fallback  Return highest-priority IPv4 network interface assignment", "  --default   Try the three above modes in order", "  --help      Print help output" ].join("\n");
      console.log(e);
    }();

   case "dhcp":
    return async function dhcp() {
      var r = e.interfaceAssignments();
      if (!r.length) {
        console.error("No available network interface assignments");
        process.exit(1);
      }
      var a = await Promise.allSettled(r.map((r => e.dhcpDiscover(r))));
      var o = null;
      for (var s of a) {
        if ("fulfilled" === s.status && s.value) {
          if (o = e.matchAssignment(r, s.value)) {
            break;
          }
        }
      }
      if (o && o !== e.DEFAULT_ASSIGNMENT) {
        console.log(JSON.stringify(o, null, 2));
        process.exit(0);
      } else {
        console.error("No DHCP router was discoverable");
        process.exit(1);
      }
    }();

   case "probe":
    return async function probe() {
      var r = e.interfaceAssignments();
      if (!r.length) {
        console.error("No available network interface assignments");
        process.exit(1);
      }
      try {
        var a = await e.probeDefaultRoute();
        var o = e.matchAssignment(r, a);
        if (o && o !== e.DEFAULT_ASSIGNMENT) {
          console.log(JSON.stringify(o, null, 2));
          process.exit(0);
        } else {
          console.error("No default gateway or route");
          process.exit(1);
        }
      } catch (e) {
        console.error("No default gateway or route");
        console.error(e);
        process.exit(1);
      }
    }();

   case "fallback":
    return async function fallback() {
      var r = e.interfaceAssignments();
      if (!r.length) {
        console.error("No available network interface assignments");
        process.exit(1);
      }
      var a = {
        ...r[0],
        gateway: null
      };
      console.log(JSON.stringify(a, null, 2));
      process.exit(0);
    }();

   case "default":
    return async function main() {
      var r = await e.lanNetwork();
      if (r !== e.DEFAULT_ASSIGNMENT) {
        console.log(JSON.stringify(r, null, 2));
        process.exit(0);
      } else {
        console.error("No default gateway, route, or DHCP router");
        process.exit(1);
      }
    }();
  }
}();
//# sourceMappingURL=lan-network-cli.js.map
