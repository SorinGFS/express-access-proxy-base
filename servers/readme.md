[Back to Main Page](https://github.com/SorinGFS/express-access-proxy#configuration)

### Servers

This module builds the list of servers based on the given configuration. The servers will be loaded when the application is initialized. While the application is running, the `set-server` middleware module will allocate the server based on the requested hostname.

The server model has an integrated authentication module which is a customized implementation of [JsonWebToken from Auth0](https://github.com/auth0/node-jsonwebtoken).

Unless you really (really, really!) know what you're doing **don't edit the files here!**
