[Back to Main Page](https://github.com/SorinGFS/express-access-proxy#configuration)

### Dynamic Model

This module defines the interaction model with the database and is used dynamically based on the configured options or internally by providing the query needed to form the connection. Each database can be configured to use a single specific connector.

Selecting the specific connector for the requested database is done dynamically, **do not modify the `index.js` file!**

Initially the application contains the mongodb connector based on the [native mongodb driver](https://github.com/mongodb/node-mongodb-native), to add a new connector create a specific file for that connector.