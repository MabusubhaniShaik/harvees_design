export { registerScaSchemas } from "./sca/index.ts";
export { registerAsaSchemas } from "./asa/index.ts";

export const SCA_DB = {
  name: process.env.DB_NAME,
  appName: process.env.DB_APP_NAME,
};

export const ASA_DB = {
  name: process.env.ASA_DB_NAME,
  appName: process.env.ASA_DB_APP_NAME,
};
