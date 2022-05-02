import type { Class } from 'type-fest';
import { kIsDataTypeOverrideOf } from '../../dialect-toolbox.js';
import type { Dialect } from '../../sequelize.js';
import type { AbstractDataType } from './data-types.js';
import type { AbstractQueryGenerator } from './query-generator.js';
import type { AbstractQuery } from './query.js';

export type DialectSupports = {
  'DEFAULT': boolean,
  'DEFAULT VALUES': boolean,
  'VALUES ()': boolean,
  'LIMIT ON UPDATE': boolean,
  'ON DUPLICATE KEY': boolean,
  'ORDER NULLS': boolean,
  'UNION': boolean,
  'UNION ALL': boolean,
  'RIGHT JOIN': boolean,
  EXCEPTION: boolean,

  forShare?: 'LOCK IN SHARE MODE' | 'FOR SHARE' | undefined,
  lock: boolean,
  lockOf: boolean,
  lockKey: boolean,
  lockOuterJoinFailure: boolean,
  skipLocked: boolean,
  finalTable: boolean,

  /* does the dialect support returning values for inserted/updated fields */
  returnValues: false | {
    output: boolean,
    returning: boolean,
  },

  /* features specific to autoIncrement values */
  autoIncrement: {
    /* does the dialect require modification of insert queries when inserting auto increment fields */
    identityInsert: boolean,

    /* does the dialect support inserting default/null values for autoincrement fields */
    defaultValue: boolean,

    /* does the dialect support updating autoincrement fields */
    update: boolean,
  },
  /* Do we need to say DEFAULT for bulk insert */
  bulkDefault: boolean,
  schemas: boolean,
  transactions: boolean,
  settingIsolationLevelDuringTransaction: boolean,
  transactionOptions: {
    type: boolean,
  },
  migrations: boolean,
  upserts: boolean,
  inserts: {
    ignoreDuplicates: string, /* dialect specific words for INSERT IGNORE or DO NOTHING */
    updateOnDuplicate: boolean | string, /* whether dialect supports ON DUPLICATE KEY UPDATE */
    onConflictDoNothing: string, /* dialect specific words for ON CONFLICT DO NOTHING */
    conflictFields: boolean, /* whether the dialect supports specifying conflict fields or not */
  },
  constraints: {
    restrict: boolean,
    addConstraint: boolean,
    dropConstraint: boolean,
    unique: boolean,
    default: boolean,
    check: boolean,
    foreignKey: boolean,
    primaryKey: boolean,
    onUpdate: boolean,
  },
  index: {
    collate: boolean,
    length: boolean,
    parser: boolean,
    concurrently: boolean,
    type: boolean,
    using: boolean | number,
    functionBased: boolean,
    operator: boolean,
    where: boolean,
  },
  groupedLimit: boolean,
  indexViaAlter: boolean,
  JSON: boolean,
  JSONB: boolean,
  ARRAY: boolean,
  RANGE: boolean,
  GEOMETRY: boolean,
  GEOGRAPHY: boolean,
  REGEXP: boolean,
  /**
   * Case-insensitive regexp operator support ('~*' in postgres).
   */
  IREGEXP: boolean,
  HSTORE: boolean,
  TSVECTOR: boolean,
  deferrableConstraints: boolean,
  tmpTableTrigger: boolean,
  indexHints: boolean,
  searchPath: boolean,
};

export abstract class AbstractDialect {
  /**
   * List of features this dialect supports.
   *
   * Important: Dialect implementations inherit these values.
   * When changing a default, ensure the implementations still properly declare which feature they support.
   */
  static readonly supports: DialectSupports = {
    DEFAULT: true,
    'DEFAULT VALUES': false,
    'VALUES ()': false,
    'LIMIT ON UPDATE': false,
    'ON DUPLICATE KEY': true,
    'ORDER NULLS': false,
    UNION: true,
    'UNION ALL': true,
    'RIGHT JOIN': true,
    EXCEPTION: false,
    lock: false,
    lockOf: false,
    lockKey: false,
    lockOuterJoinFailure: false,
    skipLocked: false,
    finalTable: false,
    returnValues: false,
    autoIncrement: {
      identityInsert: false,
      defaultValue: true,
      update: true,
    },
    bulkDefault: false,
    schemas: false,
    transactions: true,
    settingIsolationLevelDuringTransaction: true,
    transactionOptions: {
      type: false,
    },
    migrations: true,
    upserts: true,
    inserts: {
      ignoreDuplicates: '',
      updateOnDuplicate: false,
      onConflictDoNothing: '',
      conflictFields: false,
    },
    constraints: {
      restrict: true,
      addConstraint: true,
      dropConstraint: true,
      unique: true,
      default: false,
      check: true,
      foreignKey: true,
      primaryKey: true,
      onUpdate: true,
    },
    index: {
      collate: true,
      length: false,
      parser: false,
      concurrently: false,
      type: false,
      using: true,
      functionBased: false,
      operator: false,
      where: false,
    },
    groupedLimit: true,
    indexViaAlter: false,
    JSON: false,
    JSONB: false,
    ARRAY: false,
    RANGE: false,
    GEOMETRY: false,
    REGEXP: false,
    IREGEXP: false,
    GEOGRAPHY: false,
    HSTORE: false,
    TSVECTOR: false,
    deferrableConstraints: false,
    tmpTableTrigger: false,
    indexHints: false,
    searchPath: false,
  };

  abstract readonly defaultVersion: string;
  abstract readonly Query: typeof AbstractQuery;
  abstract readonly name: Dialect;
  abstract readonly TICK_CHAR: string;
  abstract readonly TICK_CHAR_LEFT: string;
  abstract readonly TICK_CHAR_RIGHT: string;
  abstract readonly queryGenerator: AbstractQueryGenerator;
  abstract readonly DataTypes: Record<string, Class<AbstractDataType<any>>>;

  #dataTypeOverridesCache: Map<Class<AbstractDataType<any>>, Class<AbstractDataType<any>>> | undefined;

  /**
   * A map that lists the dialect-specific data-type extensions.
   *
   * e.g. in
   */
  get dataTypeOverrides(): Map<Class<AbstractDataType<any>>, Class<AbstractDataType<any>>> {
    if (this.#dataTypeOverridesCache) {
      return this.#dataTypeOverridesCache;
    }

    const dataTypes = this.DataTypes;

    const overrides = new Map();
    for (const dataType of Object.values(dataTypes)) {
      // @ts-expect-error
      const replacedDataType: Class<AbstractDataType<any>> = dataType[kIsDataTypeOverrideOf];
      if (!replacedDataType) {
        throw new Error(`Dialect ${this.name} declares a DataType ${dataType.name}, but does not specify which base DataType it is the dialect-specific implementation of.`);
      }

      if (overrides.has(replacedDataType)) {
        throw new Error(`Dialect ${this.name} declares more than one implementation for DataType ${replacedDataType.name}.`);
      }

      overrides.set(replacedDataType, dataType);
    }

    this.#dataTypeOverridesCache = overrides;

    return overrides;
  }

  get supports(): DialectSupports {
    const Dialect = this.constructor as typeof AbstractDialect;

    return Dialect.supports;
  }

  abstract createBindCollector(): BindCollector;

  /**
   * Produces a safe representation of a Buffer for this dialect, that can be inlined in a SQL string.
   * Used mainly by DataTypes.
   *
   * @param buffer The buffer to escape
   * @returns The string, escaped for SQL.
   */
  escapeBuffer(buffer: Buffer): string {
    const hex = buffer.toString('hex');

    return `X'${hex}'`;
  }

  /**
   * Produces a safe representation of a string for this dialect, that can be inlined in a SQL string.
   * Used mainly by DataTypes.
   *
   * @param value The string to escape
   * @returns The string, escaped for SQL.
   */
  escapeString(value: string): string {
    // http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
    // http://stackoverflow.com/q/603572/130598
    value = value.replace(/'/g, '\'\'');

    return `'${value}'`;
  }
}

export type BindCollector = {
  /**
   *
   *
   * @param {string} bindParameterName The name of the bind parameter
   * @returns {string}
   */
  collect(bindParameterName: string): string,

  /**
   * Returns either an array of orders if the bind parameters are mapped to numeric parameters (e.g. '?', $1, @1),
   * or null if no mapping was necessary because the dialect supports named parameters.
   */
  getBindParameterOrder(): string[] | null,
};
