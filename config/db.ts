/** Simplified version of import {Options} from 'sequelize'; */
interface DBConfig {
  host: string;
  port: number;
  dialect: 'mysql';
  username: string;
  password: string;
  database: string;
}

/**
 * level: site >-> username -> database
 * For one user of one site owns which databases
 */
interface GeneralConfig {
  local: {
    root: 'mysql';
    project: 'assist';
    newbie: 'db_feature' | 'employees' | 'employees2';
    portaldb: 'portaldb_penguin';
  };
  elif: {
    root: 'mysql';
    project: 'assist';
    newbie: 'db_feature' | 'employees2';
  };
}

export type DbSite = keyof GeneralConfig;

interface UserConfig<Site extends keyof GeneralConfig, UserName extends keyof GeneralConfig[Site]> {
  password: string;
  databaseList: Array<GeneralConfig[Site][UserName]>;
}
interface DBInfo {
  local: {
    root: UserConfig<'local', 'root'>;
    portaldb: UserConfig<'local', 'portaldb'>;
    project: UserConfig<'local', 'project'>;
    newbie: UserConfig<'local', 'newbie'>;
  };
  elif: {
    root: UserConfig<'elif', 'root'>;
    project: UserConfig<'elif', 'project'>;
    newbie: UserConfig<'elif', 'newbie'>;
  };
}

const SITE_INFO: {
  [site in keyof GeneralConfig]: Pick<DBConfig, 'host' | 'port' | 'dialect'>;
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
    newbie: {
      password: 'test',
      databaseList: ['db_feature', 'employees', 'employees2'],
    },
    project: {
      password: 'Elifxifei2023_',
      databaseList: ['assist'],
    },
    portaldb: {
      password: 'portaldb',
      databaseList: ['portaldb_penguin'],
    },
  },
  elif: {
    root: {
      password: 'Wuxifei2023_',
      databaseList: ['mysql'],
    },
    newbie: {
      password: 'Elif-test_0',
      databaseList: ['db_feature', 'employees2'],
    },
    project: {
      password: 'Elifxifei2023_',
      databaseList: ['assist'],
    },
  },
};

export function getDbConfig<Site extends keyof GeneralConfig, UserName extends keyof GeneralConfig[Site]>(
  site: Site,
  username: UserName,
  database: GeneralConfig[Site][UserName]
): DBConfig {
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
export function getDbConfigBySite(site: DbSite) {
  const result: DBConfig[] = [];
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

export function allDbConfig(): Array<DBConfig> {
  const result: DBConfig[] = [];
  for (const [site, siteConfig] of Object.entries(DB_INFO)) {
    result.push(...getDbConfigBySite(site as DbSite));
  }
  return result;
}
