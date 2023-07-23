/** Simplified version of import {Options} from 'sequelize'; */
interface Options {
  host: string;
  port: number;
  dialect: 'mysql';
  username: string;
  password: string;
  database: string;
}

/** site/username/database */
interface TDBConfig {
  local: {
    root: 'mysql';
    xifeiwu: 'housekeeper';
    newbie: 'db_feature' | 'employees' | 'employees2';
    portaldb: 'portaldb_penguin';
  };
  elif: {
    root: 'mysql';
    xifeiwu: 'housekeeper';
    newbie: 'db_feature' | 'employees2';
  };
}

export type Site = keyof TDBConfig;

interface UserConfig<Site extends keyof TDBConfig, UserName extends keyof TDBConfig[Site]> {
  password: string;
  databaseList: Array<TDBConfig[Site][UserName]>;
}
interface DBConfig {
  local: {
    root: UserConfig<'local', 'root'>;
    portaldb: UserConfig<'local', 'portaldb'>;
    xifeiwu: UserConfig<'local', 'xifeiwu'>;
    newbie: UserConfig<'local', 'newbie'>;
  };
  elif: {
    root: UserConfig<'elif', 'root'>;
    xifeiwu: UserConfig<'elif', 'xifeiwu'>;
    newbie: UserConfig<'elif', 'newbie'>;
  };
}

const SITE_INFO: {
  [site in keyof TDBConfig]: Pick<Options, 'host' | 'port' | 'dialect'>;
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

const DB_CONFIG: DBConfig = {
  local: {
    root: {
      password: 'local__mysql',
      databaseList: ['mysql'],
    },
    xifeiwu: {
      password: 'Elifxifei2023_',
      databaseList: ['housekeeper'],
    },
    newbie: {
      password: 'test',
      databaseList: ['db_feature', 'employees', 'employees2'],
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
    xifeiwu: {
      password: 'Elifxifei2023_',
      databaseList: ['housekeeper'],
    },
    newbie: {
      password: 'Elif-test_0',
      databaseList: ['db_feature', 'employees2'],
    },
  },
};

export function getDbConfig<Site extends keyof TDBConfig, UserName extends keyof TDBConfig[Site]>(
  site: Site,
  username: UserName,
  database: TDBConfig[Site][UserName]
): Options {
  // return {site, userName, database};
  const siteConfig = SITE_INFO[site];
  // @ts-ignore
  const {password, databaseList} = DB_CONFIG[site][username] as UserConfig<any, any>;
  if (!databaseList.includes(database)) {
    throw new Error(`databse ${database} not belongs to ${username as string}`);
  }
  return {
    ...siteConfig,
    username: username as string,
    password,
    database: database as string,
  };
}
export function getDbConfigBySite(site: Site) {
  const result: Options[] = [];
  const siteConfig = DB_CONFIG[site];
  const siteInfo = SITE_INFO[site];
  for (let [username, useConfig] of Object.entries(siteConfig)) {
    const {password, databaseList} = useConfig as UserConfig<any, any>;
    for (let database of databaseList) {
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

export function allDbConfig(): Array<Options> {
  const result: Options[] = [];
  for (let [site, siteConfig] of Object.entries(DB_CONFIG)) {
    result.push(...getDbConfigBySite(site as Site));
  }
  return result;
}

type DB = 'employees' | 'db_feature' | 'housekeeper';
export const DB_USED: {
  [db in DB]: {
    [site in keyof DBConfig]: Options;
  };
} = {
  employees: {
    local: getDbConfig('local', 'newbie', 'employees2'),
    elif: getDbConfig('elif', 'newbie', 'employees2'),
  },
  db_feature: {
    local: getDbConfig('local', 'newbie', 'db_feature'),
    elif: getDbConfig('elif', 'newbie', 'db_feature'),
  },
  housekeeper: {
    local: getDbConfig('local', 'xifeiwu', 'housekeeper'),
    elif: getDbConfig('elif', 'xifeiwu', 'housekeeper'),
  },
};
