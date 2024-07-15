/** Simplified version of import {Options} from 'sequelize'; */
export interface MysqlConfig {
  host: string;
  port: number;
  dialect: 'mysql';
  username: string;
  password: string;
  database: string;
}
