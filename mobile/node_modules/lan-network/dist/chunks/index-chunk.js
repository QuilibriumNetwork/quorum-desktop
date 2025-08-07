var r = require("child_process");

var e = require("node:crypto");

var t = require("node:dgram");

var a = require("node:os");

var s = require("dgram");

var n = {
  iname: "lo0",
  address: "127.0.0.1",
  netmask: "255.0.0.0",
  family: "IPv4",
  mac: "00:00:00:00:00:00",
  internal: !0,
  cidr: "127.0.0.1/8",
  gateway: null
};

var parseMacStr = r => r.split(":").slice(0, 16).map((r => parseInt(r, 16)));

var parseIpStr = r => {
  var e = r.split(".").slice(0, 4).map((r => parseInt(r, 10)));
  return e[3] | e[2] << 8 | e[1] << 16 | e[0] << 24;
};

var getSubnetPriority = r => {
  if (r.startsWith("192.")) {
    return 5;
  } else if (r.startsWith("172.")) {
    return 4;
  } else if (r.startsWith("10.")) {
    return 3;
  } else if (r.startsWith("100.")) {
    return 2;
  } else if (r.startsWith("127.")) {
    return 1;
  } else {
    return 0;
  }
};

var isInternal = r => {
  if (r.internal) {
    return !0;
  }
  var e = parseMacStr(r.mac);
  if (e.every((r => !r))) {
    return !0;
  } else if (0 === e[0] && 21 === e[1] && 93 === e[2]) {
    return !0;
  } else if (r.iname.includes("vEthernet")) {
    return !0;
  } else {
    return !1;
  }
};

var interfaceAssignments = () => {
  var r = [];
  var e = a.networkInterfaces();
  for (var t in e) {
    var s = e[t];
    if (!s) {
      continue;
    }
    for (var n of s) {
      if ("IPv4" !== n.family) {
        continue;
      }
      r.push({
        ...n,
        iname: t
      });
    }
  }
  return r.sort(((r, e) => {
    var t = getSubnetPriority(r.address);
    var a = getSubnetPriority(e.address);
    return +isInternal(r) - +isInternal(e) || a - t || parseIpStr(e.address) - parseIpStr(r.address);
  }));
};

var matchAssignment = (r, e) => {
  var t = parseIpStr(e);
  for (var a of r) {
    var s = parseIpStr(a.address);
    if (t === s) {
      return {
        ...a,
        gateway: null
      };
    }
    var n = parseIpStr(a.netmask);
    if ((t & n) == (s & n)) {
      return {
        ...a,
        gateway: e
      };
    }
  }
  return null;
};

class DHCPTimeoutError extends TypeError {
  code="ETIMEDOUT";
}

var dhcpDiscover = r => new Promise(((a, s) => {
  var n = (r => (r => {
    var e = 255;
    var t = "";
    t += `${(r >>> 24 & e).toString(10)}.`;
    t += `${(r >>> 16 & e).toString(10)}.`;
    return (t += `${(r >>> 8 & e).toString(10)}.`) + (r & e).toString(10);
  })(parseIpStr(r.address) | ~parseIpStr(r.netmask)))(r);
  var o = (r => {
    var t = new Uint8Array(16);
    t.set(parseMacStr(r));
    var a = new Uint8Array(244);
    var s = e.randomBytes(4);
    a[0] = 1;
    a[1] = 1;
    a[2] = 6;
    a[3] = 0;
    a.set(s, 4);
    a[10] = 128;
    a.set(t, 28);
    a.set([ 99, 130, 83, 99 ], 236);
    a.set([ 53, 1, 1, 255 ], 240);
    return a;
  })(r.mac);
  var i = setTimeout((() => {
    s(new DHCPTimeoutError("Received no reply to DHCPDISCOVER in 250ms"));
  }), 250);
  var u = t.createSocket({
    type: "udp4",
    reuseAddr: !0
  }, ((e, t) => {
    if (!(s = t.address, n = r.address, o = r.netmask, d = parseIpStr(s), l = parseIpStr(n), 
    v = parseIpStr(o), (d & v) == (l & v))) {
      return;
    }
    var s, n, o, d, l, v;
    clearTimeout(i);
    a(t.address);
    u.close();
    u.unref();
  }));
  u.on("error", (r => {
    clearTimeout(i);
    s(r);
    u.close();
    u.unref();
  }));
  u.bind(68, (() => {
    u.setBroadcast(!0);
    u.setSendBufferSize(o.length);
    u.send(o, 0, o.length, 67, n, (r => {
      if (r) {
        s(r);
      }
    }));
  }));
}));

class DefaultRouteError extends TypeError {
  code="ECONNABORT";
}

var probeDefaultRoute = () => new Promise(((r, e) => {
  var t = s.createSocket({
    type: "udp4",
    reuseAddr: !0
  });
  t.on("error", (r => {
    e(r);
    t.close();
    t.unref();
  }));
  t.connect(53, "1.1.1.1", (() => {
    var a = t.address();
    if (a && "address" in a && "0.0.0.0" !== a.address) {
      r(a.address);
    } else {
      e(new DefaultRouteError("No route to host"));
    }
    t.close();
    t.unref();
  }));
}));

exports.DEFAULT_ASSIGNMENT = n;

exports.dhcpDiscover = dhcpDiscover;

exports.interfaceAssignments = interfaceAssignments;

exports.lanNetwork = async function lanNetwork() {
  var r = interfaceAssignments();
  if (!r.length) {
    return n;
  }
  var e;
  try {
    var t = await probeDefaultRoute();
    if ((e = matchAssignment(r, t)) && !isInternal(e)) {
      return e;
    }
  } catch {}
  var a = await Promise.allSettled(r.map((r => dhcpDiscover(r))));
  for (var s of a) {
    if ("fulfilled" === s.status && s.value) {
      if (e = matchAssignment(r, s.value)) {
        return e;
      }
    }
  }
  return {
    ...r[0],
    gateway: null
  };
};

exports.lanNetworkSync = function lanNetworkSync() {
  var e = require.resolve("lan-network/subprocess");
  var {error: t, status: a, stdout: s} = r.spawnSync(process.execPath, [ e ], {
    shell: !1,
    timeout: 500,
    encoding: "utf8",
    windowsVerbatimArguments: !1,
    windowsHide: !0
  });
  if (a || t) {
    return n;
  } else if (!a && "string" == typeof s) {
    var o = JSON.parse(s.trim());
    return "object" == typeof o && o && "address" in o ? o : n;
  } else {
    return n;
  }
};

exports.matchAssignment = matchAssignment;

exports.probeDefaultRoute = probeDefaultRoute;
//# sourceMappingURL=index-chunk.js.map
