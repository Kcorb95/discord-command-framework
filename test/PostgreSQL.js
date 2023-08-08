const Sequelize = require('sequelize');

const { db } = require('./auth.json');
const database = new Sequelize(db, { logging: false });

class Database {
    static get db() {
        return database;
    }

    static start() {
        database.authenticate()
            .then(() => console.log('[POSTGRES]: Connection to database has been established successfully.'))
            .then(() => console.log('[POSTGRES]: Synchronizing database...'))
            .then(() => database.sync()
                .then(() => console.log('[POSTGRES]: Done Synchronizing database!'))
                .catch(error => console.error(`[POSTGRES]: Error synchronizing the database: \n${error}`))
            )
            .catch(error => {
                console.error(`[POSTGRES]: Unable to connect to the database: \n${error}`);
                console.error(`[POSTGRES]: Try reconnecting in 5 seconds...`);
                setTimeout(() => Database.start(), 5000);
            });
    }
}

module.exports = Database;