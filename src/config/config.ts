import { getLocalConfig } from './config.local';
import { getQuorumApiConfig } from './config.quorum';

export const getConfig = function () {
  // TODO: switch on env
  return getQuorumApiConfig();
};
