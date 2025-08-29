import {goOnOrNot, selectOption} from '../readline';
import {logColorful} from '../log';
import {MysqlConfig} from '../types';

/**
 * Just easy-to-use type
 * level: site >-> username -> database
 * For one user of one site owns which databases
 */
interface GeneralConfig {
  local: {
    root: 'mysql';
    project: 'assist';
    explorer: 'explore' | 'employees' | 'employees2';
    portaldb: 'portaldb_penguin' | 'portaldb_turtle';
  };
  elif: {
    root: 'mysql';
    project: 'assist';
    explorer: 'explore' | 'employees2';
  };
}

export type Site = keyof GeneralConfig;

const SITE_INFO: {
  [site in Site]: Pick<MysqlConfig, 'host' | 'port' | 'dialect'>;
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

interface UserConfig<Site extends keyof GeneralConfig, UserName extends keyof GeneralConfig[Site]> {
  password: string;
  databaseList: Array<GeneralConfig[Site][UserName]>;
}
interface DBInfo {
  local: {
    explorer: UserConfig<'local', 'explorer'>;
    portaldb: UserConfig<'local', 'portaldb'>;
    project: UserConfig<'local', 'project'>;
    root: UserConfig<'local', 'root'>;
  };
  elif: {
    explorer: UserConfig<'elif', 'explorer'>;
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
const DB_INFO: DBInfo = {
  local: {
    root: {
      password: 'local__mysql',
      databaseList: ['mysql'],
    },
    explorer: {
      password: 'test',
      databaseList: ['explore', 'employees', 'employees2'],
    },
    project: {
      password: 'Elifxifei2023_',
      databaseList: ['assist'],
    },
    portaldb: {
      password: 'portaldb',
      databaseList: ['portaldb_penguin', 'portaldb_turtle'],
    },
  },
  elif: {
    root: {
      password: 'Wuxifei2023_',
      databaseList: ['mysql'],
    },
    explorer: {
      password: 'Elif-test_0',
      databaseList: ['explore', 'employees2'],
    },
    project: {
      password: 'Elifxifei2023_',
      databaseList: ['assist'],
    },
  },
};

export async function selectDbConfig<
  Site extends keyof GeneralConfig,
  UserName extends keyof GeneralConfig[Site]
>(options?: {
  site?: Site;
  username?: UserName;
  database?: GeneralConfig[Site][UserName];
}): Promise<MysqlConfig> {
  let {site, username, database} = options ?? {};
  const haveUndefinedValue = [site, username, database].some(it => it === undefined);
  if (site === undefined) {
    const sites = Object.keys(SITE_INFO) as Array<Site>;
    const {label} = await selectOption<{label: Site}>(
      sites.map(it => ({label: it})),
      {
        tips: ['Please select site:'],
      }
    );
    site = label;
  }
  const siteConfig = SITE_INFO[site];
  if (username === undefined) {
    const usernames = Object.keys(DB_INFO[site]) as Array<string>;
    const {label} = await selectOption<{label: string}>(
      usernames.map(it => ({label: it})),
      {
        tips: ['Please select username:'],
      }
    );
    username = label as UserName;
  }
  // @ts-ignore
  const {password, databaseList} = DB_INFO[site][username] as UserConfig<any, any>;
  if (database === undefined) {
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
  return {
    ...siteConfig,
    username: username as string,
    password,
    // @ts-ignore
    database: database as string,
  };
}

export function getDbConfig<
  Site extends keyof GeneralConfig,
  UserName extends keyof GeneralConfig[Site]
>(options: {site: Site; username: UserName; database: GeneralConfig[Site][UserName]}): MysqlConfig {
  let {site, username, database} = options;
  const siteConfig = SITE_INFO[site];
  // @ts-ignore
  const {password, databaseList} = DB_INFO[site][username] as UserConfig<any, any>;
  if (!databaseList.includes(database)) {
    throw new Error(`databse ${database} not belongs to ${username as string}`);
  }
  return {
    ...siteConfig,
    username: username as string,
    password,
    // @ts-ignore
    database: database as string,
  };
}

/** List all dbConfig belongs to one site */
export function getDbConfigBySite(site: Site) {
  const result: MysqlConfig[] = [];
  const siteConfig = DB_INFO[site];
  const siteInfo = SITE_INFO[site];
  for (const [username, useConfig] of Object.entries(siteConfig)) {
    const {password, databaseList} = useConfig as UserConfig<any, any>;
    for (const database of databaseList) {
      result.push({
        ...siteInfo,
        username,
        password,
        database,
      });
    }
  }
  return result;
}

export function allDbConfig(): Array<MysqlConfig> {
  const result: MysqlConfig[] = [];
  for (const [site, siteConfig] of Object.entries(DB_INFO)) {
    result.push(...getDbConfigBySite(site as Site));
  }
  return result;
}
