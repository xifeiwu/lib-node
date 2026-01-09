import {goOnOrNot, selectOption} from '../readline';
import {logColorful} from '../log';
import {MysqlConfig} from '../types';
import {PartialExcept} from '../external';

/**
 * A basic type model, it has a type map: dbService -> username -> database of the user
 */
interface DbTypeModel {
  local: {
    /** explore usage and feature of db */
    explore:
      | 'explore'
      | 'employees'
      | 'employees2'
      | 'portaldb_penguin'
      | 'portaldb_turtle'
      | 'portaldb_lion';
    /** db for project feature development */
    project: 'assist';
    root: string;
  };
  elif: {
    project: 'assist';
    explore: 'explore' | 'employees2';
    root: string;
  };
}

export type Service = keyof DbTypeModel;

/**
 * info of each db service
 */
const SERVICE_INFO: {
  [site in Service]: Pick<MysqlConfig, 'host' | 'port' | 'dialect'>;
} = {
  local: {
    host: '127.0.0.1',
    port: 3306,
    dialect: 'mysql',
  },
  elif: {
    host: 'elif.site',
    port: 3306,
    dialect: 'mysql',
  },
};

interface UserConfig<Site extends keyof DbTypeModel = any, UserName extends keyof DbTypeModel[Site] = any> {
  password: string;
  databaseList: Array<DbTypeModel[Site][UserName]>;
}
interface UserInfoPerService {
  local: {
    explore: UserConfig<'local', 'explore'>;
    project: UserConfig<'local', 'project'>;
    root: UserConfig<'local', 'root'>;
  };
  elif: {
    explore: UserConfig<'elif', 'explore'>;
    project: UserConfig<'elif', 'project'>;
    root: UserConfig<'elif', 'root'>;
  };
}
/**
User management for mysql:
DROP user xifeiwu;
create user 'project' identified by 'Elifxifei2023_';
GRANT ALL PRIVILEGES ON `assist`.* TO `project`@`%` WITH GRANT OPTION;
flush PRIVILEGES;
show grants for project;

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, RELOAD, SHUTDOWN, PROCESS, REFERENCES, INDEX, ALTER, SHOW DATABASES, CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE, REPLICATION SLAVE, REPLICATION CLIENT, CREATE VIEW, SHOW VIEW, CREATE ROUTINE, ALTER ROUTINE, CREATE USER, EVENT, TRIGGER, CREATE TABLESPACE ON *.* TO `portaldb`@`%` WITH GRANT OPTION
 */
const SERVICE_TO_USER_INFO: UserInfoPerService = {
  local: {
    root: {
      password: 'local-mysql-root',
      databaseList: ['mysql'],
    },
    explore: {
      // password: 'test',
      password: 'local-mysql-explore',
      databaseList: [
        'explore',
        'employees',
        'employees2',
        'portaldb_penguin',
        'portaldb_turtle',
        'portaldb_lion',
      ],
    },
    project: {
      password: 'Elifxifei2023_',
      databaseList: ['assist'],
    },
  },
  elif: {
    root: {
      password: 'Wuxifei2023_',
      databaseList: ['mysql'],
    },
    explore: {
      password: 'Elif-test_0',
      databaseList: ['explore', 'employees2'],
    },
    project: {
      password: 'Elifxifei2023_',
      databaseList: ['assist'],
    },
  },
};

interface GetDbConfigOptions<Service extends keyof DbTypeModel, UserName extends keyof DbTypeModel[Service]> {
  service?: Service;
  username: UserName;
  database?: DbTypeModel[Service][UserName];
  level?: 'service' | 'user' | 'database';
}

export function getUserInfoOfDbService<
  Service extends keyof DbTypeModel,
  UserName extends keyof UserInfoPerService[Service]
>(options: {service: Service}): Record<UserName, UserConfig> {
  const {service} = options;
  return SERVICE_TO_USER_INFO[service] as Record<UserName, UserConfig>;
}

function getAllDatabasesOfService<Service extends keyof DbTypeModel>(service: Service) {
  const userInfo = SERVICE_TO_USER_INFO[service];
  if (!userInfo) {
    throw new Error(`Can't find userInfo for service: ${service}`);
  }
  const allDatabases = Array.from(
    new Set(
      (Object.values(userInfo) as UserConfig[]).reduce<string[]>((sum, it) => {
        return [...sum, ...(it.databaseList ?? [])];
      }, [])
    )
  );
  return allDatabases;
}
/**
 * Get db config by provide site/username/database
 */
export function getDbConfig<Service extends keyof DbTypeModel, UserName extends keyof DbTypeModel[Service]>(
  options: Omit<GetDbConfigOptions<Service, UserName>, 'includeDatabase'>
): MysqlConfig {
  let {service, username, database} = options;
  const serviceInfo = SERVICE_INFO[service];
  // @ts-ignore
  const {password, databaseList} = SERVICE_TO_USER_INFO[service][username] as UserConfig;
  let finalDatabaseList = databaseList;
  /** user root have all privileges on all databases in the db service */
  if (username === 'root') {
    finalDatabaseList = [...databaseList, ...getAllDatabasesOfService(service)];
  }
  if (database !== undefined && !finalDatabaseList.includes(database)) {
    throw new Error(`databse ${database} not belongs to ${username as string}`);
  }
  return {
    ...serviceInfo,
    username: username as string,
    password,
    database: database as string,
  };
}

export function getDbConfigListOfService<
  Service extends keyof DbTypeModel,
  UserName extends keyof DbTypeModel[Service]
>(options: PartialExcept<GetDbConfigOptions<Service, UserName>, 'service'>) {
  const result: MysqlConfig[] = [];
  /** set database as default level */
  const {service, level = 'database'} = options;
  const serviceInfo = SERVICE_TO_USER_INFO[service];
  if (!serviceInfo) {
    throw new Error(`Can't find serviceInfo for service: ${service}`);
  }

  for (const [username, info] of Object.entries(serviceInfo)) {
    if (options.username !== undefined) {
      /** filter out username if options.username is passed */
      if (username !== options.username) {
        continue;
      }
    }
    if (level === 'user') {
      result.push(getDbConfig({service, username: username as UserName}));
      continue;
    }
    const {databaseList} = info as UserConfig;
    let finalDatabaseList = databaseList;
    /** user root have all privileges on all databases in the db service */
    if (username === 'root') {
      finalDatabaseList = [...databaseList, ...getAllDatabasesOfService(service)];
    }
    for (const database of finalDatabaseList) {
      /** filter out database if options.database is passed */
      if (options.database !== undefined) {
        if (database !== options.database) {
          continue;
        }
      }
      // @ts-ignore
      result.push(getDbConfig({service, username, database}));
    }
  }
  return result;
}

/** Get db config list that meets filter condition passed in options */
export function getDbConfigList<
  Service extends keyof DbTypeModel,
  UserName extends keyof DbTypeModel[Service]
>(options?: GetDbConfigOptions<Service, UserName>) {
  const {service, username, database} = options ?? {};
  const result: MysqlConfig[] = [];
  if (service !== undefined) {
    // @ts-ignore
    return getDbConfigListOfService(options);
  }
  for (const it of Object.keys(SERVICE_TO_USER_INFO)) {
    const configListOfService = getDbConfigListOfService({...(options ?? {}), service: it as Service});
    result.push(...(configListOfService ?? []));
  }
  return result;
}

/**
 * Get db config by select site/username/database
 */
export async function selectDbConfig<
  Site extends keyof DbTypeModel,
  UserName extends keyof DbTypeModel[Site]
>(options?: {
  site?: Site;
  username?: UserName;
  database?: DbTypeModel[Site][UserName];
}): Promise<MysqlConfig> {
  let {site, username, database} = options ?? {};
  const haveUndefinedValue = [site, username, database].some(it => it === undefined);
  const siteList = Object.keys(SERVICE_INFO) as Array<Site>;
  if (site === undefined || !siteList.includes(site)) {
    const {label} = await selectOption<{label: Site}>(
      siteList.map(it => ({label: it})),
      {
        tips: ['Please select site:'],
      }
    );
    site = label;
  }
  const dbInfo = SERVICE_TO_USER_INFO[site];
  const usernameList = Object.keys(dbInfo) as Array<string>;
  if (username === undefined || !usernameList.includes(username as string)) {
    const {label} = await selectOption<{label: string}>(
      usernameList.map(it => ({label: it})),
      {
        tips: ['Please select username:'],
      }
    );
    username = label as UserName;
  }
  // @ts-ignore
  const {password, databaseList} = dbInfo[username] as UserConfig<any, any>;
  if (database === undefined || !databaseList.includes(database)) {
    const {label} = await selectOption(
      databaseList.map(it => ({label: it})),
      {
        tips: ['Please select database:'],
      }
    );
    database = label;
  }
  if (!databaseList.includes(database)) {
    throw new Error(`databse ${database} not belongs to ${username as string}`);
  }
  logColorful(
    {
      color: 'red',
    },
    {
      site,
      username,
      database,
    }
  );
  if (
    haveUndefinedValue &&
    !(await goOnOrNot({
      defaultValue: true,
    }))
  ) {
    throw new Error('not go on');
  }
  const siteConfig = SERVICE_INFO[site];
  return {
    ...siteConfig,
    username: username as string,
    password,
    // @ts-ignore
    database: database as string,
  };
}
