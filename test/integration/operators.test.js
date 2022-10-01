'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes, Sequelize, Op } = require('@sequelize/core');

const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Operators'), () => {
  describe('REGEXP', () => {
    beforeEach(async function () {
      this.User = this.sequelize.define('user', {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'userId',
        },
        name: {
          type: DataTypes.STRING,
          field: 'full_name',
        },
      }, {
        tableName: 'users',
        timestamps: false,
      });

      this.UserPg = this.sequelize.define('userPg', {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'userId',
        },
        name: {
          type: DataTypes.STRING,
          field: 'full_name',
        },
        metadata: {
          type: DataTypes.JSONB,
          field: 'metadata',
        },
      }, {
        tableName: 'users_pg',
        timestamps: false,
      });

      await this.sequelize.getQueryInterface().createTable('users', {
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
        },
        full_name: {
          type: DataTypes.STRING,
        },
      });

      await this.sequelize.getQueryInterface().createTable('users_pg', {
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
        },
        full_name: {
          type: DataTypes.STRING,
        },
        metadata: {
          type: DataTypes.JSONB,
        },
      });
    });

    if (['mysql', 'postgres'].includes(dialect)) {
      describe('case sensitive', () => {
        it('should work with a regexp where', async function () {
          await this.User.create({ name: 'Foobar' });
          const user = await this.User.findOne({
            where: {
              name: { [Op.regexp]: '^Foo' },
            },
          });
          expect(user).to.be.ok;
        });

        it('should work with a not regexp where', async function () {
          await this.User.create({ name: 'Foobar' });
          const user = await this.User.findOne({
            where: {
              name: { [Op.notRegexp]: '^Foo' },
            },
          });
          expect(user).to.not.be.ok;
        });

        it('should properly escape regular expressions', async function () {
          await this.User.bulkCreate([{ name: 'John' }, { name: 'Bob' }]);
          await this.User.findAll({
            where: {
              name: { [Op.notRegexp]: 'Bob\'; drop table users --' },
            },
          });
          await this.User.findAll({
            where: {
              name: { [Op.regexp]: 'Bob\'; drop table users --' },
            },
          });
          expect(await this.User.findAll()).to.have.length(2);
        });
      });
    }

    if (dialect === 'postgres') {
      describe('top level keys', () => {
        it('should properly find any of array strings exist as top-level keys', async function () {
          await this.UserPg.create({ name: 'Foobar', metadata: JSON.stringify({ threat: 'unclassified', teacherId: 1, studentId: 2 }) });
          const user = await this.UserPg.findOne({
            where: {
              name: { [Op.anyKeyExists]: ['studentId'] },
            },
          });
          // TODO: modify this instead of ok
          expect(user).to.be.ok;
        });
        it('should properly find all of array strings exist as top-level keys', async function () {
          await this.UserPg.create({ name: 'Foobar', metadata: JSON.stringify({ threat: 'unclassified', teacherId: 1, studentId: 2 }) });
          const user = await this.UserPg.findOne({
            where: {
              name: { [Op.allKeysExist]: ['studentId', 'teacherId'] },
            },
          });
          // TODO: modify this instead of ok
          expect(user).to.be.ok;
        });
      });

      describe('case insensitive', () => {
        it('should work with a case-insensitive regexp where', async function () {
          await this.UserPg.create({ name: 'Foobar' });
          const user = await this.UserPg.findOne({
            where: {
              name: { [Op.iRegexp]: '^foo' },
            },
          });
          expect(user).to.be.ok;
        });

        it('should work with a case-insensitive not regexp where', async function () {
          await this.UserPg.create({ name: 'Foobar' });
          const user = await this.UserPg.findOne({
            where: {
              name: { [Op.notIRegexp]: '^foo' },
            },
          });
          expect(user).to.not.be.ok;
        });

        it('should properly escape regular expressions', async function () {
          await this.UserPg.bulkCreate([{ name: 'John' }, { name: 'Bob' }]);
          await this.UserPg.findAll({
            where: {
              name: { [Op.iRegexp]: 'Bob\'; drop table users --' },
            },
          });
          await this.UserPg.findAll({
            where: {
              name: { [Op.notIRegexp]: 'Bob\'; drop table users --' },
            },
          });
          expect(await this.UserPg.findAll()).to.have.length(2);
        });
      });
    }
  });
});
