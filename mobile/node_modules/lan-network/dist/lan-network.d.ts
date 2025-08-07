interface NetworkAssignment {
  iname: string;
  address: string;
  netmask: string;
  mac: string;
  internal: boolean;
  cidr: string | null;
  family: 'IPv4';
}
interface GatewayAssignment extends NetworkAssignment {
  gateway: string | null;
}

declare function lanNetwork(): Promise<GatewayAssignment>;
declare function lanNetworkSync(): GatewayAssignment;

export { lanNetwork, lanNetworkSync };
