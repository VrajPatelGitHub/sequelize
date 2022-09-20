import { Blob } from 'node:buffer';
import type {
  CreationAttributes,
  InferAttributes,
  ModelStatic,
  CreationOptional, InferCreationAttributes,
} from '@sequelize/core';
import { DataTypes, fn, Model, ValidationError } from '@sequelize/core';
import { expect } from 'chai';
import dayjs from 'dayjs';
import DayjsTimezone from 'dayjs/plugin/timezone';
import moment from 'moment';
import 'moment-timezone';
import type { Moment } from 'moment-timezone';
import { beforeEach2, sequelize } from '../support';

dayjs.extend(DayjsTimezone);

const dialect = sequelize.dialect;

enum TestEnum {
  A = 'A',
  B = 'B',
  C = 'C',
  // arrays are separated by commas, this checks arrays of enums are properly parsed
  'D,E' = 'D,E',
}

// !TODO: add UNIT test to ensure validation is run on all model methods (including create, update, where)
// !TODO: add tests for each type to check what the raw value is when the DataType is not provided (ie. only parse() is called, not sanitize())

describe('DataTypes', () => {
  describe('STRING(<length>)', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare stringAttr: string;
      }

      User.init({
        stringAttr: {
          type: DataTypes.STRING(5),
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('serialize/deserializes strings', async () => {
      await testSimpleInOut(vars.User, 'stringAttr', '1235', '1235');
    });

    it('throws if the string is too long', async () => {
      await expect(vars.User.create({
        stringAttr: '123456',
      })).to.be.rejected;
    });

    it('rejects non-string values', async () => {
      await expect(vars.User.create({
        // @ts-expect-error
        stringAttr: 12,
      })).to.be.rejectedWith(ValidationError, 'DATATYPE STRING: 12 is not a valid string. Only the string type is accepted for non-binary strings.');
    });
  });

  describe('STRING.BINARY', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare binaryStringAttr: ArrayBuffer | string | Blob;
      }

      User.init({
        binaryStringAttr: {
          type: DataTypes.STRING.BINARY,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('serialize/deserializes buffers', async () => {
      await testSimpleInOut(vars.User, 'binaryStringAttr', Buffer.from('abc'), Buffer.from([97, 98, 99]));
    });

    it('accepts ArrayBuffers & Uint8Arrays', async () => {
      // Uint8Arrays
      await testSimpleInOut(vars.User, 'binaryStringAttr', new Uint8Array([97, 98, 99]), Buffer.from([97, 98, 99]));
      // ArrayBuffer
      await testSimpleInOut(vars.User, 'binaryStringAttr', new Uint8Array([97, 98, 99]).buffer, Buffer.from([97, 98, 99]));
    });

    // Node 14 doesn't support Blob
    if (Blob) {
      it('rejects Blobs & non-Uint8Array ArrayBufferViews', async () => {
        await expect(vars.User.create({
          binaryStringAttr: new Blob(['abc']),
        })).to.be.rejectedWith(ValidationError, 'DATATYPE STRING: Blob instances are not supported values, because reading their data is an async operation. Call blob.arrayBuffer() to get a buffer, and pass that to Sequelize instead.');

        await expect(vars.User.create({
          binaryStringAttr: new Uint16Array([97, 98, 99]),
        })).to.be.rejectedWith(ValidationError, 'DATATYPE STRING: Uint16Array(3) [ 97, 98, 99 ] is not a valid binary value: Only strings, Buffer, Uint8Array and ArrayBuffer are supported.');
      });
    }

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'binaryStringAttr', 'abc', Buffer.from([97, 98, 99]));
    });
  });

  describe('STRING(100).BINARY', () => {
    if (dialect.name === 'postgres') {
      // TODO: once we have centralized logging, check a warning message has been emitted:
      //  https://github.com/sequelize/sequelize/issues/11670
      it.skip('throws, because postgres does not support setting a limit on binary strings', async () => {
        sequelize.define('User', {
          binaryStringAttr: {
            type: DataTypes.STRING(5).BINARY,
            allowNull: false,
          },
        });
      });
    } else {
      const vars = beforeEach2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare binaryStringAttr: string;
        }

        User.init({
          binaryStringAttr: {
            type: DataTypes.STRING(5).BINARY,
            allowNull: false,
          },
        }, { sequelize });

        await User.sync();

        return { User };
      });

      // We want to have this, but is 'length' the number of bytes or the number of characters?
      // More research needed.
      it.skip('throws if the string is too long', async () => {
        await expect(vars.User.create({
          binaryStringAttr: '123456',
        })).to.be.rejected;
      });
    }
  });

  describe('TEXT', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare textAttr: string;
      }

      User.init({
        textAttr: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('serialize/deserializes strings', async () => {
      await testSimpleInOut(vars.User, 'textAttr', '123456', '123456');
    });
  });

  // !TODO: throw if not supported in this dialect
  describe(`DataTypes.TEXT(<size>)`, () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare tinyText: string;
        declare mediumText: string;
        declare longText: string;
      }

      User.init({
        tinyText: {
          type: DataTypes.TEXT('tiny'),
          allowNull: false,
        },
        mediumText: {
          type: DataTypes.TEXT('medium'),
          allowNull: false,
        },
        longText: {
          type: DataTypes.TEXT('long'),
          allowNull: false,
        },
      }, { sequelize, timestamps: false, noPrimaryKey: true });

      await User.sync();

      return { User };
    });

    it('serialize/deserializes strings', async () => {
      const data = { tinyText: '123', mediumText: '456', longText: '789' };

      await vars.User.create(data);
      const user = await vars.User.findOne({ rejectOnEmpty: true });
      expect(user.get()).to.deep.eq(data);
    });
  });

  describe('CHAR(<length>)', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare charAttr: string;
      }

      User.init({
        charAttr: {
          type: DataTypes.CHAR(20),
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('serialize/deserializes strings', async () => {
      await testSimpleInOut(vars.User, 'charAttr', '123456', '123456'.padEnd(20, ' '));
    });

    it('throws if the string is too long', async () => {
      await expect(vars.User.create({
        charAttr: '1'.repeat(21),
      })).to.be.rejected;
    });
  });

  describe('CHAR(<length>).BINARY', () => {
    if (dialect.supports.dataTypes.CHAR.BINARY) {
      const vars = beforeEach2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare binaryCharAttr: string | ArrayBuffer | Uint8Array | Blob;
        }

        User.init({
          binaryCharAttr: {
            type: DataTypes.CHAR(5).BINARY,
            allowNull: false,
          },
        }, { sequelize });

        await User.sync();

        return { User };
      });

      it('serialize/deserializes buffers with padding if the length is insufficient', async () => {
        await testSimpleInOut(vars.User, 'binaryCharAttr', Buffer.from('1234'), Buffer.from([32, 49, 50, 51, 52]));
      });

      it('accepts ArrayBuffers & Uint8Arrays', async () => {
        // Uint8Arrays
        await testSimpleInOut(vars.User, 'binaryCharAttr', new Uint8Array([49, 50, 51, 52]), Buffer.from([32, 49, 50, 51, 52]));
        // ArrayBuffer
        await testSimpleInOut(vars.User, 'binaryCharAttr', new Uint8Array([49, 50, 51, 52]).buffer, Buffer.from([32, 49, 50, 51, 52]));
      });

      // Node 14 doesn't support Blob
      if (Blob) {
        it('rejects Blobs & non-Uint8Array ArrayBufferViews', async () => {
          await expect(vars.User.create({
            binaryCharAttr: new Blob(['abcd']),
          })).to.be.rejectedWith(ValidationError, 'DATATYPE STRING: Blob instances are not supported values, because reading their data is an async operation. Call blob.arrayBuffer() to get a buffer, and pass that to Sequelize instead.');

          await expect(vars.User.create({
            binaryCharAttr: new Uint16Array([49, 50, 51, 52]),
          })).to.be.rejectedWith(ValidationError, 'DATATYPE STRING: Uint16Array(4) [ 49, 50, 51, 52 ] is not a valid value for binary strings: Only strings, numbers, Buffer, Uint8Array and ArrayBuffer are supported.');
        });
      }

      it('accepts strings', async () => {
        await testSimpleInOut(vars.User, 'binaryCharAttr', '1234', Buffer.from([32, 49, 50, 51, 52]));
      });
    } else {
      it('throws if CHAR.BINARY is used', () => {
        expect(() => {
          sequelize.define('CrashedModel', {
            attr: DataTypes.CHAR.BINARY,
          });
        }).to.throwWithCause(`An error occurred for attribute attr on model CrashedModel.
Caused by: ${dialect.name} does not support the CHAR.BINARY DataType.
See https://sequelize.org/docs/v7/other-topics/other-data-types/#strings for a list of supported DataTypes.`);
      });
    }
  });

  // !TODO: throw if not supported in this dialect
  describe('CITEXT', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare ciTextAttr: string;
      }

      User.init({
        ciTextAttr: {
          type: DataTypes.CITEXT,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('serialize/deserializes strings', async () => {
      await vars.User.create({
        ciTextAttr: 'ABCdef',
      });

      const user = await vars.User.findOne({ rejectOnEmpty: true, where: { ciTextAttr: 'abcDEF' } });
      expect(user.ciTextAttr).to.eq('ABCdef');
    });
  });

  describe('TSVECTOR', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare tsvectorAttr: string;
      }

      User.init({
        tsvectorAttr: {
          type: DataTypes.TSVECTOR,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('converts strings to TSVector', async () => {
      await testSimpleInOut(vars.User, 'tsvectorAttr', 'a:1A fat:2B,4C cat:5D', `'a':1A 'cat':5 'fat':2B,4C`);
    });

    it('accepts ts_tsvector() functions', async () => {
      await testSimpleInOut(
        vars.User,
        'tsvectorAttr',
        // TODO: .create()'s typings should accept fn, literal, and cast
        // @ts-expect-error
        fn('to_tsvector', 'english', 'The Fat Rats'),
        `'fat':2 'rat':3`,
      );
    });
  });

  describe('BOOLEAN', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare booleanAttr: boolean | string | number | bigint | Buffer;
      }

      User.init({
        booleanAttr: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('accepts booleans', async () => {
      await testSimpleInOut(vars.User, 'booleanAttr', true, true);
      await testSimpleInOut(vars.User, 'booleanAttr', false, false);
    });

    // these values are allowed when parsed from the Database, but not when inputted by the user.
    it('rejects strings', async () => {
      await expect(vars.User.create({ booleanAttr: 'true' })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: 'false' })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: '1' })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: '0' })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: 't' })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: 'f' })).to.be.rejected;
    });

    it('rejects numbers', async () => {
      await expect(vars.User.create({ booleanAttr: 1 })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: 0 })).to.be.rejected;
    });

    it('rejects bigints', async () => {
      await expect(vars.User.create({ booleanAttr: 1n })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: 0n })).to.be.rejected;
    });

    it('rejects buffers', async () => {
      await expect(vars.User.create({ booleanAttr: Buffer.from([1]) })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: Buffer.from([0]) })).to.be.rejected;
    });
  });

  // !TODO (mariaDB, mysql): TINYINT

  // !TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
  describe('SMALLINT', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare smallIntAttr: number | bigint | string;
      }

      User.init({
        smallIntAttr: {
          type: DataTypes.SMALLINT,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('accepts numbers, bigints, strings', async () => {
      await testSimpleInOut(vars.User, 'smallIntAttr', 123, 123);
      await testSimpleInOut(vars.User, 'smallIntAttr', 123n, 123);
      await testSimpleInOut(vars.User, 'smallIntAttr', '123', 123);
    });

    it('rejects non-integer numbers', async () => {
      await expect(vars.User.create({ smallIntAttr: 123.4 })).to.be.rejected;
      await expect(vars.User.create({ smallIntAttr: Number.NaN })).to.be.rejected;
      await expect(vars.User.create({ smallIntAttr: Number.NEGATIVE_INFINITY })).to.be.rejected;
      await expect(vars.User.create({ smallIntAttr: Number.POSITIVE_INFINITY })).to.be.rejected;
    });

    it('rejects non-integer strings', async () => {
      await expect(vars.User.create({ smallIntAttr: '' })).to.be.rejected;
      await expect(vars.User.create({ smallIntAttr: 'abc' })).to.be.rejected;
      await expect(vars.User.create({ smallIntAttr: '123.4' })).to.be.rejected;
    });
  });

  // !TODO (mariaDB, mysql): MEDIUMINT

  // !TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
  describe('INTEGER', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare intAttr: number | bigint | string;
      }

      User.init({
        intAttr: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('accepts numbers, bigints, strings', async () => {
      await testSimpleInOut(vars.User, 'intAttr', 123, 123);
      await testSimpleInOut(vars.User, 'intAttr', 123n, 123);
      await testSimpleInOut(vars.User, 'intAttr', '123', 123);
    });

    it('rejects non-integer numbers', async () => {
      await expect(vars.User.create({ intAttr: 123.4 })).to.be.rejected;
      await expect(vars.User.create({ intAttr: Number.NaN })).to.be.rejected;
      await expect(vars.User.create({ intAttr: Number.NEGATIVE_INFINITY })).to.be.rejected;
      await expect(vars.User.create({ intAttr: Number.POSITIVE_INFINITY })).to.be.rejected;
    });

    it('rejects non-integer strings', async () => {
      await expect(vars.User.create({ intAttr: '' })).to.be.rejected;
      await expect(vars.User.create({ intAttr: 'abc' })).to.be.rejected;
      await expect(vars.User.create({ intAttr: '123.4' })).to.be.rejected;
    });
  });

  // !TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
  describe('BIGINT', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare bigintAttr: number | bigint | string;
      }

      User.init({
        bigintAttr: {
          type: DataTypes.BIGINT,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('accepts numbers, bigints, strings', async () => {
      await testSimpleInOut(vars.User, 'bigintAttr', 123, '123');
      await testSimpleInOut(vars.User, 'bigintAttr', 123n, '123');
      await testSimpleInOut(vars.User, 'bigintAttr', '123', '123');

      await testSimpleInOut(vars.User, 'bigintAttr', 9_007_199_254_740_992n, '9007199254740992');
    });

    it('rejects unsafe integers', async () => {
      await expect(vars.User.create({ bigintAttr: 9_007_199_254_740_992 })).to.be.rejected;
      await expect(vars.User.create({ bigintAttr: -9_007_199_254_740_992 })).to.be.rejected;

      await expect(vars.User.create({ bigintAttr: 123.4 })).to.be.rejected;
      await expect(vars.User.create({ bigintAttr: Number.NaN })).to.be.rejected;
      await expect(vars.User.create({ bigintAttr: Number.NEGATIVE_INFINITY })).to.be.rejected;
      await expect(vars.User.create({ bigintAttr: Number.POSITIVE_INFINITY })).to.be.rejected;
    });

    it('rejects non-integer strings', async () => {
      await expect(vars.User.create({ bigintAttr: '' })).to.be.rejected;
      await expect(vars.User.create({ bigintAttr: 'abc' })).to.be.rejected;
      await expect(vars.User.create({ bigintAttr: '123.4' })).to.be.rejected;
    });
  });

  // !TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
  describe('REAL, DataTypes.DOUBLE, DataTypes.FLOAT', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare realAttr: number | bigint | string | null;
        declare doubleAttr: number | bigint | string | null;
        declare floatAttr: number | bigint | string | null;
      }

      User.init({
        realAttr: {
          type: DataTypes.REAL,
          allowNull: true,
        },
        doubleAttr: {
          type: DataTypes.DOUBLE,
          allowNull: true,
        },
        floatAttr: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('REAL accepts numbers, bigints, strings, NaN, +-Infinity', async () => {
      await testSimpleInOut(vars.User, 'realAttr', 123.4, 123.4);
      await testSimpleInOut(vars.User, 'realAttr', 123n, 123);
      await testSimpleInOut(vars.User, 'realAttr', '123.4', 123.4);
      await testSimpleInOut(vars.User, 'realAttr', Number.NaN, Number.NaN);
      await testSimpleInOut(vars.User, 'realAttr', Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
      await testSimpleInOut(vars.User, 'realAttr', Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
    });

    it('DOUBLE accepts numbers, bigints, strings, NaN, +-Infinity', async () => {
      await testSimpleInOut(vars.User, 'doubleAttr', 123.4, 123.4);
      await testSimpleInOut(vars.User, 'doubleAttr', 123n, 123);
      await testSimpleInOut(vars.User, 'doubleAttr', '123.4', 123.4);
      await testSimpleInOut(vars.User, 'doubleAttr', Number.NaN, Number.NaN);
      await testSimpleInOut(vars.User, 'doubleAttr', Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
      await testSimpleInOut(vars.User, 'doubleAttr', Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
    });

    it('FLOAT accepts numbers, bigints, strings, NaN, +-Infinity', async () => {
      await testSimpleInOut(vars.User, 'floatAttr', 123.4, 123.4);
      await testSimpleInOut(vars.User, 'floatAttr', 123n, 123);
      await testSimpleInOut(vars.User, 'floatAttr', '123.4', 123.4);
      await testSimpleInOut(vars.User, 'floatAttr', Number.NaN, Number.NaN);
      await testSimpleInOut(vars.User, 'floatAttr', Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
      await testSimpleInOut(vars.User, 'floatAttr', Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
    });

    it('rejects non-number strings', async () => {
      await expect(vars.User.create({ realAttr: '' })).to.be.rejected;
      await expect(vars.User.create({ realAttr: 'abc' })).to.be.rejected;
      await expect(vars.User.create({ doubleAttr: '' })).to.be.rejected;
      await expect(vars.User.create({ doubleAttr: 'abc' })).to.be.rejected;
      await expect(vars.User.create({ floatAttr: '' })).to.be.rejected;
      await expect(vars.User.create({ floatAttr: 'abc' })).to.be.rejected;
    });
  });

  // !TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
  describe('DECIMAL', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare decimalAttr: number | bigint | string;
      }

      User.init({
        decimalAttr: {
          type: DataTypes.DECIMAL,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('accepts numbers, bigints, strings', async () => {
      await testSimpleInOut(vars.User, 'decimalAttr', 123.4, '123.4');
      await testSimpleInOut(vars.User, 'decimalAttr', 123n, '123');
      await testSimpleInOut(vars.User, 'decimalAttr', '123.4', '123.4');

      await testSimpleInOut(vars.User, 'decimalAttr', Number.NaN, Number.NaN);
    });

    it('rejects unsafe integers', async () => {
      await expect(vars.User.create({ decimalAttr: 9_007_199_254_740_992 })).to.be.rejected;
      await expect(vars.User.create({ decimalAttr: -9_007_199_254_740_992 })).to.be.rejected;
    });

    it('rejects non-representable values', async () => {
      await expect(vars.User.create({ decimalAttr: Number.NEGATIVE_INFINITY })).to.be.rejected;
      await expect(vars.User.create({ decimalAttr: Number.POSITIVE_INFINITY })).to.be.rejected;
      await expect(vars.User.create({ decimalAttr: '' })).to.be.rejected;
      await expect(vars.User.create({ decimalAttr: 'abc' })).to.be.rejected;
    });
  });

  // !TODO: DATE(precision)
  // !TODO: test precision
  describe('DATE', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare dateAttr: Date | string | number | Moment | dayjs.Dayjs;
      }

      User.init({
        dateAttr: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('accepts Date objects, strings', async () => {
      const date = new Date('2022-01-01T00:00:00Z');

      await testSimpleInOut(vars.User, 'dateAttr', date, date);
      await testSimpleInOut(vars.User, 'dateAttr', '2022-01-01T00:00:00Z', date);

      // timestamp
      await testSimpleInOut(vars.User, 'dateAttr', 1_640_995_200_000, date);
    });

    it('handles timezones (moment)', async () => {
      await testSimpleInOut(
        vars.User,
        'dateAttr',
        moment.tz('2014-06-01 12:00', 'America/New_York'),
        new Date('2014-06-01T16:00:00.000Z'),
      );
    });

    it('handles timezones (dayjs)', async () => {
      await testSimpleInOut(
        vars.User,
        'dateAttr',
        dayjs.tz('2014-06-01 12:00', 'America/New_York'),
        new Date('2014-06-01T16:00:00.000Z'),
      );
    });
  });

  describe('DATEONLY', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare dateAttr: string | null;
        declare id: CreationOptional<number>;
      }

      User.init({
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        dateAttr: DataTypes.DATEONLY,
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'dateAttr', '2022-01-01', '2022-01-01');
    });

    it('should return set DATEONLY field to NULL correctly', async () => {
      const testDate = '2022-01-01';

      const record2 = await vars.User.create({ dateAttr: testDate });
      expect(record2.dateAttr).to.eq(testDate);

      const record1 = await vars.User.findByPk(record2.id, { rejectOnEmpty: true });
      expect(record1.dateAttr).to.eq(testDate);

      const record0 = await record1.update({
        dateAttr: null,
      });

      const record = await record0.reload();
      expect(record.dateAttr).to.be.eql(null);
    });
  });

  // !TODO: test precision
  describe('TIME', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare timeAttr: string;
      }

      User.init({
        timeAttr: {
          type: DataTypes.TIME,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'timeAttr', '04:05:06', '04:05:06');
    });
  });

  describe('UUID', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: string;
      }

      User.init({
        attr: {
          type: DataTypes.UUID,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('accepts UUID strings', async () => {
      const uuidV1 = '4b39e726-d455-11ec-9d64-0242ac120002';
      await testSimpleInOut(vars.User, 'attr', uuidV1, uuidV1);
      const uuidV4 = '48fbbb25-b00c-4711-add4-fae864a09d8d';
      await testSimpleInOut(vars.User, 'attr', uuidV4, uuidV4);
    });

    it('rejects non-UUID strings', async () => {
      await expect(vars.User.create({ attr: 'not-a-uuid-at-all' })).to.be.rejected;
    });
  });

  // !TODO: (mariadb, mysql): TINYBLOB, MEDIUMBLOB
  describe('BLOB', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: ArrayBuffer | string | Blob;
      }

      User.init({
        attr: {
          type: DataTypes.BLOB,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('serialize/deserializes buffers', async () => {
      await testSimpleInOut(vars.User, 'attr', Buffer.from('abc'), Buffer.from([97, 98, 99]));
    });

    it('accepts ArrayBuffers & Uint8Arrays', async () => {
      // Uint8Arrays
      await testSimpleInOut(vars.User, 'attr', new Uint8Array([49, 50, 51, 52]), Buffer.from([49, 50, 51, 52]));
      // ArrayBuffer
      await testSimpleInOut(vars.User, 'attr', new Uint8Array([49, 50, 51, 52]).buffer, Buffer.from([49, 50, 51, 52]));
    });

    // Node 14 doesn't support Blob
    if (Blob) {
      it('rejects Blobs & non-Uint8Array ArrayBufferViews', async () => {
        await expect(vars.User.create({
          attr: new Blob(['abcd']),
        })).to.be.rejectedWith(ValidationError, 'DATATYPE BLOB: Blob instances are not supported values, because reading their data is an async operation. Call blob.arrayBuffer() to get a buffer, and pass that to Sequelize instead.');

        await expect(vars.User.create({
          attr: new Uint16Array([49, 50, 51, 52]),
        })).to.be.rejectedWith(ValidationError, 'DATATYPE BLOB: Uint16Array(4) [ 49, 50, 51, 52 ] is not a valid binary value: Only strings, Buffer, Uint8Array and ArrayBuffer are supported.');
      });
    }

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'attr', 'abc', Buffer.from([97, 98, 99]));
    });
  });

  describe('ENUM', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: TestEnum;
      }

      User.init({
        attr: {
          type: DataTypes.ENUM(Object.values(TestEnum)),
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('accepts values that are part of the enum', async () => {
      await testSimpleInOut(vars.User, 'attr', TestEnum.A, TestEnum.A);
    });

    it('rejects values not part of the enum', async () => {
      // @ts-expect-error -- 'fail' is not a valid value for this enum.
      await expect(vars.User.create({ attr: 'fail' })).to.be.rejected;
    });
  });

  for (const JsonType of [DataTypes.JSON, DataTypes.JSONB]) {
    describe(`DataTypes.${JsonType.name}`, () => {
      const vars = beforeEach2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare jsonStr: string;
          declare jsonBoolean: boolean;
          declare jsonNumber: number;
          declare jsonArray: string[];
          declare jsonObject: object;
        }

        User.init({
          // test default values are properly serialized
          jsonStr: {
            type: JsonType,
            allowNull: false,
            defaultValue: 'abc',
          },
          jsonBoolean: {
            type: JsonType,
            allowNull: false,
            defaultValue: true,
          },
          jsonNumber: {
            type: JsonType,
            allowNull: false,
            defaultValue: 1,
          },
          jsonArray: {
            type: JsonType,
            allowNull: false,
            defaultValue: ['a', 'b'],
          },
          jsonObject: {
            type: JsonType,
            allowNull: false,
            defaultValue: { key: 'abc' },
          },
        }, { sequelize, timestamps: false });

        await User.sync();

        return { User };
      });

      it('properly serializes default values', async () => {
        const createdUser = await vars.User.create();
        expect(createdUser.get()).to.deep.eq({
          jsonStr: 'abc',
          jsonBoolean: true,
          jsonNumber: 1,
          jsonArray: ['a', 'b'],
          jsonObject: { key: 'abc' },
          id: 1,
        });
      });

      it('properly serializes values', async () => {
        await testSimpleInOut(vars.User, 'jsonObject', { a: 1 }, { a: 1 });
      });
    });
  }

  describe('HSTORE', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: Record<string, string> | string;
      }

      User.init({
        attr: {
          type: DataTypes.HSTORE,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('serialize/deserializes buffers', async () => {
      const hash = { key1: 'value1', key2: 'value2' };

      await testSimpleInOut(vars.User, 'attr', hash, hash);
    });

    it('rejects hstores that contain non-string values', async () => {
      await expect(vars.User.create({
        // @ts-expect-error -- key2 cannot be an int in a hstore.
        attr: { key1: 'value1', key2: 1 },
      })).to.be.rejected;
    });
  });

  describe('ARRAY', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare enumArray: TestEnum[] | null;
        declare intArray: Array<string | number | bigint> | null;
        declare bigintArray: Array<string | number | bigint> | null;
        declare booleanArray: Array<string | number | bigint | boolean> | null;
        declare dateArray: Array<string | Date> | null;
        declare stringArray: string[];
        declare arrayOfArrayOfStrings: string[][];
      }

      User.init({
        enumArray: DataTypes.ARRAY(DataTypes.ENUM(Object.values(TestEnum))),
        intArray: DataTypes.ARRAY(DataTypes.INTEGER),
        bigintArray: DataTypes.ARRAY(DataTypes.BIGINT),
        booleanArray: DataTypes.ARRAY(DataTypes.BOOLEAN),
        dateArray: DataTypes.ARRAY(DataTypes.DATE),
        stringArray: DataTypes.ARRAY(DataTypes.TEXT),
        arrayOfArrayOfStrings: DataTypes.ARRAY(DataTypes.ARRAY(DataTypes.TEXT)),
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('serialize/deserializes arrays', async () => {
      await testSimpleInOut(vars.User, 'enumArray', [TestEnum.A, TestEnum.B, TestEnum['D,E']], [TestEnum.A, TestEnum.B, TestEnum['D,E']]);
      await testSimpleInOut(vars.User, 'intArray', [1n, 2, '3'], [1, 2, 3]);
      await testSimpleInOut(vars.User, 'bigintArray', [1n, 2, '3'], ['1', '2', '3']);
      await testSimpleInOut(vars.User, 'booleanArray', [true, false], [true, false]);
      await testSimpleInOut(vars.User, 'dateArray', ['2022-01-01T00:00:00Z', new Date('2022-01-01T00:00:00Z')], [new Date('2022-01-01T00:00:00Z'), new Date('2022-01-01T00:00:00Z')]);
      await testSimpleInOut(vars.User, 'stringArray', ['a,b,c', 'd,e,f'], ['a,b,c', 'd,e,f']);
      await testSimpleInOut(vars.User, 'arrayOfArrayOfStrings', [['a', 'b,c'], ['c', 'd']], [['a', 'b,c'], ['c', 'd']]);
    });

    it('rejects non-array values', async () => {
      await expect(vars.User.create({
        // @ts-expect-error -- we're voluntarily going against the typing to test that it fails.
        booleanArray: 1,
      })).to.be.rejected;
    });
  });

  describe('CIDR', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: string;
      }

      User.init({
        attr: {
          type: DataTypes.CIDR,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'attr', '10.1.2.3/32', '10.1.2.3/32');
    });
  });

  describe('INET', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: string;
      }

      User.init({
        attr: {
          type: DataTypes.INET,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'attr', '127.0.0.1', '127.0.0.1');
    });
  });

  describe('MACADDR', () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: string;
      }

      User.init({
        attr: {
          type: DataTypes.MACADDR,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'attr', '01:23:45:67:89:ab', '01:23:45:67:89:ab');
    });
  });
});

export async function testSimpleInOut<M extends Model, Key extends keyof CreationAttributes<M>>(
  model: ModelStatic<M>,
  attributeName: Key,
  inVal: CreationAttributes<M>[Key],
  outVal: CreationAttributes<M>[Key],
  message?: string,
): Promise<void> {
  // @ts-expect-error -- we can't guarantee that this model doesn't expect more than one property, but it's just a test util.
  const createdUser = await model.create({ [attributeName]: inVal });

  const fetchedUser = await model.findOne({
    rejectOnEmpty: true,
    where: {
      // @ts-expect-error -- it's not worth it to type .id for these internal tests.
      id: createdUser.id,
    },
  });
  expect(fetchedUser[attributeName]).to.deep.eq(outVal, message);
}
